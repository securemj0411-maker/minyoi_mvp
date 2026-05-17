import { NextResponse } from "next/server";
import sharp from "sharp";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

// 2026-05-17: 비로그인 사용자용 마스킹 매물 preview API.
// 메인 페이지 / 진입 시 즉시 가치 인식 — "와 이게 돈 되는 거구나".
//
// 정책:
// - 카테고리 다양화 5개 (애플 편향 차단 — smartphone/watch/airpods/laptop/etc 1개씩)
// - 마스킹 정보만 반환 (pid X, 매물명 부분 mask, image URL X)
// - 가격 / 차익 / 카테고리 / 등급은 정확히 반환 (hook)
// - 번개 API 검증 skip (비로그인 = 식별 X, 검증 비용 0)
// - 캐시 60초 (재방문 시 다양성 + 부담 ↓)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_SECONDS = 60;
const PREVIEW_COUNT = 5;
// 2026-05-17: 진입장벽 ↓ — 가격 tier 분리.
// tier A: 10만 이하 2개 (저렴한 hook — "와 진짜 싼 매물도 있네")
// tier B: 30만 이하 3개 (실제 매물 분위기)
const TIER_A_MAX_KRW = 100_000;
const TIER_A_COUNT = 2;
const TIER_B_MAX_KRW = 300_000;
const TIER_B_COUNT = 3;

// 2026-05-17: 진짜 thumbnail 서버 사이드 blur 처리.
// 원본 URL 노출 X → blur 된 base64 data URL 만 클라이언트 전송. DevTools 우회 차단.
// sharp blur sigma=10 (적당한 블러 — 사진 인식 OK + 정확 식별 어려움).
async function fetchAndBlurImage(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const blurred = await sharp(buf)
      .resize(160, 160, { fit: "cover" })
      .blur(10)
      .jpeg({ quality: 70 })
      .toBuffer();
    return `data:image/jpeg;base64,${blurred.toString("base64")}`;
  } catch {
    return null;
  }
}

// 2026-05-17: 매물명 마스킹 강화 — 사용자 보안 우려.
// 단어별 첫 글자만 보이고 나머지 * 처리 (식별 불가능 + 카테고리 느낌만 유지).
// 예: "갤럭시 S24 울트라 512GB 자급제 풀박스" → "갤** S** 울** 5**** 자** 풀**"
//     "애플워치 울트라 2 49mm 티타늄" → "애** 울** * 4*** 티**"
// DevTools 우회 차단 — 서버에서만 마스킹된 string 전송.
function maskName(name: string): string {
  if (!name) return "*****";
  return name.trim().split(/\s+/).map((w) => {
    if (w.length <= 1) return w;
    return w.charAt(0) + "*".repeat(Math.min(w.length - 1, 4));
  }).join(" ");
}

type PoolRow = {
  pid: number;
  expected_profit_min: number;
  expected_profit_max: number;
  profit_band: number;
  confidence: number | null;
  category: string | null;
  condition_class: string | null;
  comparable_key: string | null;
};

type RawRow = {
  pid: number;
  name: string;
  price: number;
  sku_median: number | null;
  thumbnail_url: string | null;
};

type RawListingMeta = {
  pid: number;
  sku_id: string | null;
  free_shipping: boolean | null;
  last_seen_at: string | null;
};

export async function GET() {
  try {
    const headers = serviceHeaders();

    // ready 매물 fetch — band desc + profit desc. filter (price/sku 다양화) 위해 더 많이 가져옴.
    const poolUrl = `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key&status=eq.ready&order=profit_band.desc,expected_profit_max.desc&limit=200`;
    const poolRes = await restFetch(poolUrl, { headers });
    const pool = (await poolRes.json()) as PoolRow[];

    if (pool.length === 0) {
      return NextResponse.json({ items: [] }, {
        headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` },
      });
    }

    // 매물 정보 fetch — 30만 이하 만 (tier B max). pool 전체 join.
    const poolPids = pool.map((r) => r.pid);
    const [rawRes, rawListingRes] = await Promise.all([
      restFetch(
        `${tableUrl("mvp_listings")}?select=pid,name,price,sku_median,thumbnail_url&pid=in.(${poolPids.join(",")})&price=lte.${TIER_B_MAX_KRW}`,
        { headers },
      ),
      restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,free_shipping,last_seen_at&pid=in.(${poolPids.join(",")})`,
        { headers },
      ),
    ]);
    const raws = (await rawRes.json()) as RawRow[];
    const rawListings = (await rawListingRes.json()) as RawListingMeta[];
    const rawByPid = new Map<number, RawRow>(raws.map((r) => [r.pid, r]));
    const skuByPid = new Map<number, string | null>(rawListings.map((r) => [r.pid, r.sku_id]));
    const metaByPid = new Map<number, RawListingMeta>(rawListings.map((r) => [r.pid, r]));

    // 2026-05-17: 가격 tier 분리 — 10만 이하 2개 + 10-30만 3개. SKU 다양화 유지.
    // pickFromTier 가 carry-over: cumulative usedSkus/categories.
    const usedSkus = new Set<string>();
    const usedCategories = new Set<string>();
    const selected: PoolRow[] = [];

    function pickFromTier(maxPriceKrw: number, target: number, allowCategoryDup: boolean) {
      const tierPicked: PoolRow[] = [];
      for (const row of pool) {
        if (tierPicked.length >= target) break;
        if (selected.some((s) => s.pid === row.pid)) continue;
        const raw = rawByPid.get(row.pid);
        if (!raw || raw.price > maxPriceKrw) continue;
        const sku = skuByPid.get(row.pid);
        if (sku && usedSkus.has(sku)) continue;
        const cat = row.category ?? "other";
        if (!allowCategoryDup && usedCategories.has(cat)) continue;
        tierPicked.push(row);
        if (sku) usedSkus.add(sku);
        usedCategories.add(cat);
      }
      // tier 못 채우면 카테고리 중복 허용 한 번 더 시도.
      if (tierPicked.length < target && !allowCategoryDup) {
        for (const row of pool) {
          if (tierPicked.length >= target) break;
          if (selected.some((s) => s.pid === row.pid)) continue;
          if (tierPicked.some((s) => s.pid === row.pid)) continue;
          const raw = rawByPid.get(row.pid);
          if (!raw || raw.price > maxPriceKrw) continue;
          const sku = skuByPid.get(row.pid);
          if (sku && usedSkus.has(sku)) continue;
          tierPicked.push(row);
          if (sku) usedSkus.add(sku);
        }
      }
      selected.push(...tierPicked);
    }

    pickFromTier(TIER_A_MAX_KRW, TIER_A_COUNT, false);
    pickFromTier(TIER_B_MAX_KRW, TIER_B_COUNT, false);

    if (selected.length === 0) {
      return NextResponse.json({ items: [] }, {
        headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` },
      });
    }

    // 2026-05-17: 서버 사이드 blur — 진짜 thumbnail fetch + sharp blur(20) + base64.
    // 원본 URL 클라이언트 노출 X. DevTools 봐도 blur 된 data URL 만 보임.
    const blurredImages = await Promise.all(
      selected.map((row) => fetchAndBlurImage(rawByPid.get(row.pid)?.thumbnail_url)),
    );

    // confidence: pool.confidence (0~1) → high (>=0.8) / medium (>=0.6) / low.
    function confLabel(c: number | null): "high" | "medium" | "low" {
      if (c == null || !Number.isFinite(c)) return "low";
      if (c >= 0.8) return "high";
      if (c >= 0.6) return "medium";
      return "low";
    }

    // fresh: last_seen_at 24시간 이내면 "신규".
    function isFresh(iso: string | null | undefined): boolean {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      if (!Number.isFinite(t)) return false;
      return Date.now() - t < 24 * 60 * 60 * 1000;
    }

    // 2026-05-17 Phase 3: selected 5개 매물에 한해서 market_price_daily + velocity fetch.
    // 사용자 의도 "근거 chip" — sold count (수요), medianHoursToSold (회전).
    const comparableKeys = selected
      .map((r) => r.comparable_key)
      .filter((k): k is string => !!k);
    const [marketRes, velocityRes] = comparableKeys.length > 0
      ? await Promise.all([
        restFetch(
          // 2026-05-17: date + condition_class 별로 row 분산되므로 select 에 date 포함 + 합산 처리.
          `${tableUrl("mvp_market_price_daily")}?select=comparable_key,condition_class,sold_sample_count,date&comparable_key=in.(${comparableKeys.map(encodeURIComponent).join(",")})&order=date.desc&limit=${comparableKeys.length * 10}`,
          { headers },
        ),
        restFetch(
          `${tableUrl("mvp_market_velocity")}?select=comparable_key,median_hours_to_sold&comparable_key=in.(${comparableKeys.map(encodeURIComponent).join(",")})`,
          { headers },
        ).catch(() => null),
      ])
      : [null, null];
    const soldByKey = new Map<string, number>();
    if (marketRes) {
      // 2026-05-17 fix: 같은 comparable_key + 최신 date 의 모든 condition_class sold 합산.
      // 이전: 첫 row 만 사용 → condition 별 분산으로 threshold (3) 못 넘김.
      // 새: latest date 의 4-5 condition row 합산 → 진짜 SKU 수요 표현.
      const rows = (await marketRes.json()) as Array<{ comparable_key: string; sold_sample_count: number | null; date: string }>;
      const latestByKey = new Map<string, { date: string; total: number }>();
      for (const r of rows) {
        if (r.sold_sample_count == null) continue;
        const cur = latestByKey.get(r.comparable_key);
        if (!cur || r.date > cur.date) {
          latestByKey.set(r.comparable_key, { date: r.date, total: r.sold_sample_count });
        } else if (r.date === cur.date) {
          cur.total += r.sold_sample_count;
        }
      }
      for (const [k, v] of latestByKey) soldByKey.set(k, v.total);
    }
    const velocityByKey = new Map<string, number>();
    if (velocityRes) {
      try {
        const rows = (await velocityRes.json()) as Array<{ comparable_key: string; median_hours_to_sold: number | null }>;
        for (const r of rows) {
          if (r.median_hours_to_sold != null) velocityByKey.set(r.comparable_key, r.median_hours_to_sold);
        }
      } catch {}
    }

    const items = selected.map((row, idx) => {
      const raw = rawByPid.get(row.pid);
      const meta = metaByPid.get(row.pid);
      return {
        slot: idx + 1,
        maskedName: maskName(raw?.name ?? ""),
        // 진짜 사진 blur 처리 base64 (원본 URL X) — DevTools 우회 불가.
        blurredImage: blurredImages[idx],
        category: row.category ?? "other",
        conditionClass: row.condition_class,
        price: raw?.price ?? 0,
        skuMedian: raw?.sku_median ?? null,
        expectedProfitMin: row.expected_profit_min,
        expectedProfitMax: row.expected_profit_max,
        profitBand: row.profit_band,
        // 2026-05-17: 신뢰 시그널 chips (dashboard 패턴).
        confidence: confLabel(row.confidence),
        freeShipping: meta?.free_shipping ?? false,
        isFresh: isFresh(meta?.last_seen_at),
        // 2026-05-17 Phase 3: 근거 chip 데이터 (buildVerdicts input).
        soldSampleCount: row.comparable_key ? (soldByKey.get(row.comparable_key) ?? null) : null,
        medianHoursToSold: row.comparable_key ? (velocityByKey.get(row.comparable_key) ?? null) : null,
      };
    });

    return NextResponse.json({ items }, {
      headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` },
    });
  } catch (err) {
    console.error("[preview-pool] error", err);
    return NextResponse.json({ error: "preview_failed" }, { status: 500 });
  }
}
