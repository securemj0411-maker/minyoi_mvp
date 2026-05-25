import { NextResponse } from "next/server";
import sharp from "sharp";
import { teaserBudgetRangeLabel, teaserProfitLabel } from "@/lib/feed-price-display";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

// 2026-05-17: 비로그인 사용자용 마스킹 매물 preview API.
// 메인 페이지 / 진입 시 즉시 가치 인식 — "와 이게 돈 되는 거구나".
//
// 정책:
// - 카테고리 다양화 5개 (애플 편향 차단 — smartphone/watch/airpods/laptop/etc 1개씩)
// - teaser 정보만 반환 (pid X, 원본명 X, 원본 image URL X, 정확 가격 X)
// - 수익/예산/할인율은 범위형 label 로만 반환 (guest feed 와 /me locked feed parity)
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
// Wave launch-111 (2026-05-24): 사용자 정정 — 5개 다 15만원 이하로 (tier B 300k → 150k).
//   비로그인 신규 진입자 부담 ↓. 진짜 진입가 낮춤.
const TIER_A_MAX_KRW = 100_000;
const TIER_A_COUNT = 2;
const TIER_B_MAX_KRW = 150_000;
const TIER_B_COUNT = 3;
const PREVIEW_POOL_SCAN_LIMIT = 500;
const HIGH_PROFIT_ELECTRONICS_ROI = 0.4;
const HIGH_PROFIT_WEAK_SIGNAL_ROI = 0.45;
const HIGH_PROFIT_DEFAULT_ROI = 0.6;
const HIGH_PROFIT_MARKETPLACE_VARIANCE_ROI = 0.7;
const HIGH_PROFIT_ELECTRONICS_CATEGORIES = new Set([
  "earphone",
  "smartwatch",
  "smartphone",
  "tablet",
  "laptop",
  "monitor",
  "speaker",
  "camera",
  "game_console",
  "desktop",
  "home_appliance",
  "small_appliance",
  "watch",
  "drone",
  "kickboard",
]);
const HIGH_PROFIT_MARKETPLACE_VARIANCE_CATEGORIES = new Set([
  "shoe",
  "bag",
  "clothing",
  "perfume",
  "sport_golf",
  "bike",
]);

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
// Wave launch-111 (2026-05-24): 별표 *** 마스킹 폐기 → 카테고리 친화 라벨.
//   배경: "갤** S** 울**" 같은 별표 노출이 사용자한테 더러워 보임. 사용자 정정 ("이어폰/헤드폰
//   스마트폰" 같이 카테고리만 표시). 정확한 모델/제목은 가입 후만 노출 (가입 incentive 유지).
const CATEGORY_FRIENDLY_LABEL: Record<string, string> = {
  bag: "가방",
  bike: "자전거",
  both: "기타",
  camera: "카메라",
  clothing: "의류",
  desktop: "데스크탑",
  drone: "드론",
  earphone: "이어폰",
  game_console: "게임기",
  headphone: "헤드폰",
  home_appliance: "생활가전",
  kickboard: "킥보드",
  laptop: "노트북",
  lego: "레고",
  monitor: "모니터",
  perfume: "향수",
  shoe: "신발",
  smartphone: "스마트폰",
  smartwatch: "스마트워치",
  speaker: "스피커",
  sport_golf: "골프",
  tablet: "태블릿",
  watch: "시계",
};
function categoryFriendlyLabel(category: string | null): string {
  if (!category) return "중고 상품";
  return CATEGORY_FRIENDLY_LABEL[category] ?? "중고 상품";
}

function relativeDiscountLabel(price: number | null | undefined, marketPrice: number | null | undefined) {
  const buy = Number(price ?? 0);
  const market = Number(marketPrice ?? 0);
  if (!Number.isFinite(buy) || buy <= 0 || !Number.isFinite(market) || market <= 0 || buy >= market) {
    return "시세 비교 완료";
  }
  const discount = Math.max(1, Math.round(((market - buy) / market) * 100));
  const rounded = discount >= 10 ? Math.round(discount / 5) * 5 : discount;
  return `시세보다 약 ${rounded}% 낮음`;
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
  shop_review_rating: number | null;
  shop_review_count: number | null;
};

function previewProfitRoi(row: PoolRow, raw: RawRow | undefined): number | null {
  const buyBase = Math.max(Number(raw?.price ?? 0), 1);
  const avgProfit = (Number(row.expected_profit_min ?? 0) + Number(row.expected_profit_max ?? 0)) / 2;
  if (!Number.isFinite(buyBase) || !Number.isFinite(avgProfit) || avgProfit <= 0) return null;
  const roi = avgProfit / buyBase;
  return Number.isFinite(roi) ? roi : null;
}

function isPreviewHighProfitAnomaly(row: PoolRow, raw: RawRow | undefined): boolean {
  const roi = previewProfitRoi(row, raw);
  if (roi == null || roi < HIGH_PROFIT_ELECTRONICS_ROI) return false;

  const category = row.category ?? "";
  if (HIGH_PROFIT_ELECTRONICS_CATEGORIES.has(category) && roi >= HIGH_PROFIT_ELECTRONICS_ROI) return true;

  const weakSignals =
    row.confidence == null ||
    Number(row.confidence) < 0.85 ||
    !row.condition_class ||
    row.comparable_key?.split("|").includes("unknown_condition");
  if (weakSignals && roi >= HIGH_PROFIT_WEAK_SIGNAL_ROI) return true;

  const threshold = HIGH_PROFIT_MARKETPLACE_VARIANCE_CATEGORIES.has(category)
    ? HIGH_PROFIT_MARKETPLACE_VARIANCE_ROI
    : HIGH_PROFIT_DEFAULT_ROI;
  return roi >= threshold;
}

export async function GET() {
  try {
    const headers = serviceHeaders();

    // Wave launch-113 (2026-05-24): 비로그인 hook 강화 — sold 표본을 내부 소스로 사용.
    // Wave launch-115 (2026-05-24): 7일 → 14일 + scan limit 500 (3개만 보이는 frustration fix).
    //   배경: 7일 sold + tier dedup 5겹 거치면 5개 못 채우는 케이스 발생.
    // Wave 2026-05-25: public 응답은 active/sold 식별키를 모두 숨긴 teaser label 만 내려준다.
    const sinceIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const soldPidsRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,sold_detected_at&listing_state=in.(sold_confirmed,disappeared)&sold_detected_at=gte.${encodeURIComponent(sinceIso)}&order=sold_detected_at.desc&limit=500`,
      { headers },
    );
    const soldPidRows = (await soldPidsRes.json()) as Array<{ pid: number; sold_detected_at: string }>;
    const soldPids = soldPidRows.map((r) => r.pid).filter((p) => Number.isFinite(p) && p > 0);

    if (soldPids.length === 0) {
      return NextResponse.json({ items: [] }, {
        headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` },
      });
    }

    // candidate_pool 에서 sold pid + positive profit 만. status 는 invalidated 거나 다른 거 (sold 면 보통 invalidated).
    const poolUrl = `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key&pid=in.(${soldPids.join(",")})&expected_profit_max=gt.0&order=profit_band.desc,expected_profit_max.desc&limit=${PREVIEW_POOL_SCAN_LIMIT}`;
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
        `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,free_shipping,last_seen_at,shop_review_rating,shop_review_count&pid=in.(${poolPids.join(",")})`,
        { headers },
      ),
    ]);
    const raws = (await rawRes.json()) as RawRow[];
    const rawListings = (await rawListingRes.json()) as RawListingMeta[];
    const rawByPid = new Map<number, RawRow>(raws.map((r) => [r.pid, r]));
    const skuByPid = new Map<number, string | null>(rawListings.map((r) => [r.pid, r.sku_id]));
    const metaByPid = new Map<number, RawListingMeta>(rawListings.map((r) => [r.pid, r]));

    // 2026-05-17: 가격 tier 분리 — 10만 이하 2개 + 10-30만 3개. SKU + category + condition_class 다양화.
    // pickFromTier 가 carry-over: cumulative usedSkus/categories/usedConditions.
    const usedSkus = new Set<string>();
    const usedCategories = new Set<string>();
    const usedConditions = new Set<string>();
    const selected: PoolRow[] = [];

    function pickFromTier(maxPriceKrw: number, target: number) {
      const tierPicked: PoolRow[] = [];
      // 1차 — sku + category + condition_class 다 dedup (가장 strict)
      for (const row of pool) {
        if (tierPicked.length >= target) break;
        if (selected.some((s) => s.pid === row.pid)) continue;
        const raw = rawByPid.get(row.pid);
        if (!raw || raw.price > maxPriceKrw) continue;
        if (isPreviewHighProfitAnomaly(row, raw)) continue;
        const sku = skuByPid.get(row.pid);
        if (sku && usedSkus.has(sku)) continue;
        const cat = row.category ?? "other";
        if (usedCategories.has(cat)) continue;
        const cc = row.condition_class ?? "normal";
        if (usedConditions.has(cc)) continue;
        tierPicked.push(row);
        if (sku) usedSkus.add(sku);
        usedCategories.add(cat);
        usedConditions.add(cc);
      }
      // 2차 — condition_class 중복 허용 (sku/category 만 유지)
      if (tierPicked.length < target) {
        for (const row of pool) {
          if (tierPicked.length >= target) break;
          if (selected.some((s) => s.pid === row.pid)) continue;
          if (tierPicked.some((s) => s.pid === row.pid)) continue;
          const raw = rawByPid.get(row.pid);
          if (!raw || raw.price > maxPriceKrw) continue;
          if (isPreviewHighProfitAnomaly(row, raw)) continue;
          const sku = skuByPid.get(row.pid);
          if (sku && usedSkus.has(sku)) continue;
          const cat = row.category ?? "other";
          if (usedCategories.has(cat)) continue;
          tierPicked.push(row);
          if (sku) usedSkus.add(sku);
          usedCategories.add(cat);
        }
      }
      // 3차 — sku 만 dedup (category 도 중복 허용, fallback)
      if (tierPicked.length < target) {
        for (const row of pool) {
          if (tierPicked.length >= target) break;
          if (selected.some((s) => s.pid === row.pid)) continue;
          if (tierPicked.some((s) => s.pid === row.pid)) continue;
          const raw = rawByPid.get(row.pid);
          if (!raw || raw.price > maxPriceKrw) continue;
          if (isPreviewHighProfitAnomaly(row, raw)) continue;
          const sku = skuByPid.get(row.pid);
          if (sku && usedSkus.has(sku)) continue;
          tierPicked.push(row);
          if (sku) usedSkus.add(sku);
        }
      }
      selected.push(...tierPicked);
    }

    pickFromTier(TIER_A_MAX_KRW, TIER_A_COUNT);
    pickFromTier(TIER_B_MAX_KRW, TIER_B_COUNT);

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
          // sold + active 합산 = 시장 거래량 (사용자: "번개에 많이 올라오는걸로 수요").
          `${tableUrl("mvp_market_price_daily")}?select=comparable_key,condition_class,sold_sample_count,active_sample_count,date&comparable_key=in.(${comparableKeys.map(encodeURIComponent).join(",")})&order=date.desc&limit=${comparableKeys.length * 10}`,
          { headers },
        ),
        restFetch(
          `${tableUrl("mvp_market_velocity")}?select=comparable_key,median_hours_to_sold&comparable_key=in.(${comparableKeys.map(encodeURIComponent).join(",")})`,
          { headers },
        ).catch(() => null),
      ])
      : [null, null];
    const demandByKey = new Map<string, number>();
    if (marketRes) {
      // 2026-05-17 v2: 사용자 정책 "번개에 많이 올라오는 = 수요". sold + active 합산.
      // sold detection 안정성 의존 X. active = 현재 매물 수 (시장 활성도). 합치면 robust.
      // latest date 의 모든 condition_class row 합산.
      const rows = (await marketRes.json()) as Array<{
        comparable_key: string;
        sold_sample_count: number | null;
        active_sample_count: number | null;
        date: string;
      }>;
      const latestByKey = new Map<string, { date: string; total: number }>();
      for (const r of rows) {
        const sample = (r.sold_sample_count ?? 0) + (r.active_sample_count ?? 0);
        if (sample <= 0) continue;
        const cur = latestByKey.get(r.comparable_key);
        if (!cur || r.date > cur.date) {
          latestByKey.set(r.comparable_key, { date: r.date, total: sample });
        } else if (r.date === cur.date) {
          cur.total += sample;
        }
      }
      for (const [k, v] of latestByKey) demandByKey.set(k, v.total);
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
      const avgProfit = (Number(row.expected_profit_min ?? 0) + Number(row.expected_profit_max ?? 0)) / 2;
      return {
        slot: idx + 1,
        // Public preview는 exact 식별키를 내리지 않는다. 내부 표본이어도 feed teaser 정책과 통일.
        previewTitle: `${categoryFriendlyLabel(row.category)} 후보`,
        profitLabel: teaserProfitLabel(avgProfit),
        budgetLabel: teaserBudgetRangeLabel(raw?.price ?? null),
        priceSignalLabel: relativeDiscountLabel(raw?.price ?? null, raw?.sku_median ?? null),
        // (deprecated) launch-111 호환성 — 클라이언트 fallback.
        maskedName: categoryFriendlyLabel(row.category),
        blurredImage: blurredImages[idx],
        category: row.category ?? "other",
        conditionClass: row.condition_class,
        price: 0,
        skuMedian: null,
        expectedProfitMin: 0,
        expectedProfitMax: 0,
        profitBand: row.profit_band,
        // 2026-05-17: 신뢰 시그널 chips (dashboard 패턴).
        confidence: confLabel(row.confidence),
        freeShipping: meta?.free_shipping ?? false,
        isFresh: isFresh(meta?.last_seen_at),
        sellerReviewRating: meta?.shop_review_rating == null ? null : Number(meta.shop_review_rating),
        sellerReviewCount: meta?.shop_review_count == null ? null : Number(meta.shop_review_count),
        // 2026-05-17 Phase 3: 근거 chip 데이터 (buildVerdicts input).
        soldSampleCount: row.comparable_key ? (demandByKey.get(row.comparable_key) ?? null) : null,
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
