// Wave 77 — Inventory pre-check endpoint for advanced search.
// 사용자가 결제 전에 조건 매칭 매물 수 미리 확인. 토큰 낭비 방지.

import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { checkRateLimit, clientIpKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RATE_LIMIT_MAX = Math.max(1, Number(process.env.PACKS_PREVIEW_RATE_LIMIT_MAX ?? 60));
const RATE_LIMIT_WINDOW_SECONDS = Math.max(1, Number(process.env.PACKS_PREVIEW_RATE_LIMIT_WINDOW_SECONDS ?? 10));
const MIN_ADVANCED_PRICE_MAX_KRW = 150_000;

type Filters = {
  band?: 1 | 2 | 3 | null;
  priceMax?: number | null;
  minProfit?: number | null;        // expected_profit_min ≥ N (원)
  minConfidence?: number | null;    // 0~1
  categories?: string[] | null;     // ['earphone','smartwatch']
  maxFreshHours?: number | null;    // last_verified_at within N hours
};

function parseFilters(url: URL): Filters {
  const band = Number(url.searchParams.get("band") ?? 0);
  const validBand = (band === 1 || band === 2 || band === 3) ? band as 1|2|3 : null;
  const priceMax = url.searchParams.get("priceMax");
  const minProfit = url.searchParams.get("minProfit");
  const minConfidence = url.searchParams.get("minConfidence");
  const categories = url.searchParams.get("categories");
  const maxFreshHours = url.searchParams.get("maxFreshHours");
  const parsedPriceMax = priceMax ? Number(priceMax) : null;
  return {
    band: validBand,
    priceMax: parsedPriceMax != null && Number.isFinite(parsedPriceMax) && parsedPriceMax > 0
      ? Math.max(MIN_ADVANCED_PRICE_MAX_KRW, parsedPriceMax)
      : null,
    minProfit: minProfit ? Number(minProfit) : null,
    minConfidence: minConfidence ? Number(minConfidence) : null,
    categories: categories ? categories.split(",").filter(Boolean) : null,
    maxFreshHours: maxFreshHours ? Number(maxFreshHours) : null,
  };
}

type PoolRow = {
  pid: number;
  profit_band: number;
  status: string;
  category: string | null;
  expected_profit_min: number | null;
  confidence: number | null;
  last_verified_at: string;
  exposure_count: number | null;
  max_exposure: number | null;
  // Wave 133 (2026-05-16): condition_class — 평균 차익 chip을 condition별 분리 표시.
  condition_class: string | null;
};

type RawRow = {
  pid: number;
  price: number | null;
};

export async function GET(req: Request) {
  const rate = await checkRateLimit({
    bucketKey: `packs.preview:ip:${clientIpKey(req)}`,
    maxRequests: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    const url = new URL(req.url);
    const filters = parseFilters(url);

    // Pool 후보 query (status=ready + 가용 노출 + filter 적용 가능한 컬럼들)
    // Wave 133 (2026-05-16): condition_class 추가 — 평균 차익 chip을 condition별 분리.
    let poolQuery = `${tableUrl("mvp_candidate_pool")}?select=pid,profit_band,status,category,expected_profit_min,confidence,last_verified_at,exposure_count,max_exposure,condition_class&status=eq.ready`;
    if (filters.band) poolQuery += `&profit_band=eq.${filters.band}`;
    if (filters.minProfit != null) poolQuery += `&expected_profit_min=gte.${filters.minProfit}`;
    if (filters.minConfidence != null) poolQuery += `&confidence=gte.${filters.minConfidence}`;
    if (filters.categories && filters.categories.length > 0) {
      poolQuery += `&category=in.(${filters.categories.map(c => `"${c}"`).join(",")})`;
    }
    if (filters.maxFreshHours != null && filters.maxFreshHours > 0) {
      const since = new Date(Date.now() - filters.maxFreshHours * 60 * 60 * 1000).toISOString();
      poolQuery += `&last_verified_at=gte.${encodeURIComponent(since)}`;
    }
    poolQuery += "&limit=1000";

    const poolRes = await restFetch(poolQuery, { headers: serviceHeaders() });
    if (!poolRes.ok) {
      const body = await poolRes.text().catch(() => "");
      console.error("preview-inventory pool query failed", { status: poolRes.status, body: body.slice(0, 500) });
      return NextResponse.json({ error: "pool_query_failed" }, { status: 500 });
    }
    const poolRows = (await poolRes.json()) as PoolRow[];

    // exposure 가용한 행만 (exposure_count < max_exposure)
    const usable = poolRows.filter(r => {
      const ec = r.exposure_count ?? 0;
      const me = r.max_exposure ?? 1;
      return ec < me;
    });

    // priceMax 필터 — JOIN 대신 raw 별도 query (PostgREST embedded resource는 제한적)
    let priceFilteredCount = usable.length;
    const byCategory: Record<string, number> = {};
    if (filters.priceMax != null && usable.length > 0) {
      const pids = usable.map(r => r.pid);
      const chunks: number[][] = [];
      for (let i = 0; i < pids.length; i += 200) chunks.push(pids.slice(i, i + 200));
      const allowedPids = new Set<number>();
      for (const chunk of chunks) {
        const rawQuery = `${tableUrl("mvp_raw_listings")}?select=pid,price&pid=in.(${chunk.join(",")})&price=lte.${filters.priceMax}`;
        const rawRes = await restFetch(rawQuery, { headers: serviceHeaders() });
        if (rawRes.ok) {
          const rawRows = (await rawRes.json()) as RawRow[];
          for (const r of rawRows) allowedPids.add(r.pid);
        }
      }
      const filtered = usable.filter(r => allowedPids.has(r.pid));
      priceFilteredCount = filtered.length;
      for (const r of filtered) {
        const c = r.category ?? "unknown";
        byCategory[c] = (byCategory[c] ?? 0) + 1;
      }
    } else {
      for (const r of usable) {
        const c = r.category ?? "unknown";
        byCategory[c] = (byCategory[c] ?? 0) + 1;
      }
    }

    const now = Date.now();
    const freshUnder2h = (filters.priceMax != null
      ? usable  // already filtered by other criteria
      : usable
    ).filter(r => {
      const t = new Date(r.last_verified_at).getTime();
      return (now - t) < 2 * 60 * 60 * 1000;
    }).length;

    // 2026-05-15 Wave 124: 신규 사용자 신뢰 시그널 — 매칭 매물의 평균 차익 (median).
    // 회전 정보는 그룹 평균이 sample 작아 representative X (개별 매물 chip 으로 충분) — 제외.
    const matchingPool = filters.priceMax != null
      ? usable.filter(r => byCategory[r.category ?? "unknown"] != null)
      : usable;
    let medianProfitWon: number | null = null;
    if (matchingPool.length > 0) {
      const profits = matchingPool
        .map(r => r.expected_profit_min)
        .filter((v): v is number => typeof v === "number" && v > 0)
        .sort((a, b) => a - b);
      if (profits.length > 0) {
        medianProfitWon = profits[Math.floor(profits.length / 2)];
      }
    }

    // Wave 133 (2026-05-16): condition별 평균 차익 분리 — 사업 보고서 L2 retention factor.
    // 같은 SKU+옵션 매물이라도 condition별 시세 spread 15~40% (Wave 130 측정).
    // 사용자가 "이 추천 매물이 어느 등급인지" 답 받으려면 condition별 평균 차익 표시 필요.
    // 예: "mint +90K / clean +75K / normal +60K / worn +45K".
    const profitByCondition: Record<string, { median: number; count: number }> = {};
    if (matchingPool.length > 0) {
      const byCondition = new Map<string, number[]>();
      for (const r of matchingPool) {
        const cls = r.condition_class ?? "normal";
        if (cls === "flawed") continue; // flawed는 풀 진입 안 되지만 안전장치
        const profit = r.expected_profit_min;
        if (typeof profit !== "number" || profit <= 0) continue;
        const arr = byCondition.get(cls) ?? [];
        arr.push(profit);
        byCondition.set(cls, arr);
      }
      for (const [cls, profits] of byCondition.entries()) {
        if (profits.length < 3) continue; // sample 부족하면 표시 X (정확성 우선)
        profits.sort((a, b) => a - b);
        profitByCondition[cls] = {
          median: profits[Math.floor(profits.length / 2)],
          count: profits.length,
        };
      }
    }

    return NextResponse.json({
      band: filters.band,
      filters,
      matchingCount: priceFilteredCount,
      freshUnder2h,
      byCategory,
      medianProfitWon,
      // Wave 133: condition별 평균 차익. UI에서 "mint +90K / worn +45K" 분리 표시.
      profitByCondition,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("preview-inventory failed", { err: message });
    return NextResponse.json({ error: "preview_inventory_failed" }, { status: 500 });
  }
}
