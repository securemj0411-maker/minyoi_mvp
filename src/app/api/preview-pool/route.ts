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

// 2026-05-17: 진짜 thumbnail 서버 사이드 blur 처리.
// 원본 URL 노출 X → blur 된 base64 data URL 만 클라이언트 전송. DevTools 우회 차단.
// sharp blur sigma=20 (강한 블러 — 식별 불가능 + 사진 느낌 유지).
async function fetchAndBlurImage(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const blurred = await sharp(buf)
      .resize(160, 160, { fit: "cover" })
      .blur(20)
      .jpeg({ quality: 60 })
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
  category: string | null;
  condition_class: string | null;
};

type RawRow = {
  pid: number;
  name: string;
  price: number;
  sku_median: number | null;
  thumbnail_url: string | null;
};

export async function GET() {
  try {
    const headers = serviceHeaders();

    // ready 매물 fetch — band 2~3 (높은 차익 우선), 카테고리 균등 분포 위해 더 많이 가져옴.
    const poolUrl = `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,profit_band,category,condition_class&status=eq.ready&order=profit_band.desc,expected_profit_max.desc&limit=80`;
    const poolRes = await restFetch(poolUrl, { headers });
    const pool = (await poolRes.json()) as PoolRow[];

    if (pool.length === 0) {
      return NextResponse.json({ items: [] }, {
        headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` },
      });
    }

    // 카테고리 다양화 — 카테고리별 1개씩, 최대 PREVIEW_COUNT.
    const byCategory = new Map<string, PoolRow>();
    for (const row of pool) {
      const cat = row.category ?? "other";
      if (!byCategory.has(cat)) byCategory.set(cat, row);
      if (byCategory.size >= PREVIEW_COUNT) break;
    }
    let selected = Array.from(byCategory.values());
    // 카테고리 5종 미만이면 나머지 채움 (랜덤).
    if (selected.length < PREVIEW_COUNT) {
      const remaining = pool.filter((r) => !selected.some((s) => s.pid === r.pid));
      const shuffled = remaining.sort(() => Math.random() - 0.5);
      selected = [...selected, ...shuffled.slice(0, PREVIEW_COUNT - selected.length)];
    }
    selected = selected.slice(0, PREVIEW_COUNT);

    if (selected.length === 0) {
      return NextResponse.json({ items: [] }, {
        headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` },
      });
    }

    // 매물명 + 가격 + 시세 + 썸네일 fetch.
    const pids = selected.map((r) => r.pid);
    const rawUrl = `${tableUrl("mvp_listings")}?select=pid,name,price,sku_median,thumbnail_url&pid=in.(${pids.join(",")})`;
    const rawRes = await restFetch(rawUrl, { headers });
    const raws = (await rawRes.json()) as RawRow[];
    const rawByPid = new Map<number, RawRow>(raws.map((r) => [r.pid, r]));

    // 2026-05-17: 서버 사이드 blur — 진짜 thumbnail fetch + sharp blur(20) + base64.
    // 원본 URL 클라이언트 노출 X. DevTools 봐도 blur 된 data URL 만 보임.
    const blurredImages = await Promise.all(
      selected.map((row) => fetchAndBlurImage(rawByPid.get(row.pid)?.thumbnail_url)),
    );

    const items = selected.map((row, idx) => {
      const raw = rawByPid.get(row.pid);
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
