// 2026-05-15: 시세 history (일별 active/sold median 누적). 카드 reveal 모달 chart용.
// auth 없음 — comparable_key 알아야 호출 가능. read-only.
// 2026-05-16: rate limit 추가. comparable_key 알면 누구나 호출 가능 → enumeration abuse 위험.
// IP 기반 30 req / 60s (일반 사용자 충분, abuse만 차단).
// 2026-05-16 (사용자 코멘트 id 105): cc (condition_class) 옵션 추가. 본 매물 condition 매칭 그래프만.
//   - cc 없으면 모든 cc 합쳐 (기존 동작).
//   - cc 있으면 매칭만. fallback: 정확 매칭 없는 date는 'all' / 'normal' fallback.
// 2026-05-18 Wave 227: strict=1 옵션 추가. 미개봉/다나와 기준 상세에서는
//   숫자는 다나와 reference인데 그래프만 normal/clean fallback으로 보이는 괴리를 차단한다.

import { NextResponse, type NextRequest } from "next/server";
import { conditionFallbackChain } from "@/lib/condition-fallback";
import { normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { checkRateLimit, clientIpKey } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DAYS = 90;
const DEFAULT_DAYS = 30;
// 2026-05-16 (N4): unopened (박스 안 뜯음) 별도 클래스 추가. mint와 분리.
const VALID_CCS = new Set(["unopened", "mint", "clean", "normal", "worn", "low_batt", "flawed", "all"]);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ck = url.searchParams.get("ck")?.trim();
  if (!ck) return NextResponse.json({ error: "missing_ck" }, { status: 400 });
  const days = Math.max(1, Math.min(MAX_DAYS, Number(url.searchParams.get("days") ?? String(DEFAULT_DAYS)) || DEFAULT_DAYS));
  const cc = url.searchParams.get("cc")?.trim();
  const ccFilter = cc && VALID_CCS.has(cc) ? cc : null;
  const strictCondition = url.searchParams.get("strict") === "1";
  const sourceParam = url.searchParams.get("source")?.trim();
  const source = sourceParam ? normalizeMarketplaceSource(sourceParam) : null;

  const rate = await checkRateLimit({
    bucketKey: `market-history:${clientIpKey(req)}`,
    maxRequests: 30,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
    // 모든 cc 가져오고 JS에서 fallback. SQL filter로 cc 만 보면 fallback 어려움.
    const table = source ? "mvp_market_price_daily_per_source" : "mvp_market_price_daily";
    const sourceFilter = source ? `&source=eq.${encodeURIComponent(source)}` : "";
    const res = await restFetch(
      `${tableUrl(table)}?select=date,condition_class,active_median_price,sold_median_price,blended_median_price,active_sample_count,sold_sample_count,confidence&comparable_key=eq.${encodeURIComponent(ck)}${sourceFilter}&date=gte.${since}&order=date.asc,computed_at.desc&limit=1000`,
      { headers: serviceHeaders() },
    );
    if (!res.ok) {
      return NextResponse.json({ error: "history_fetch_failed" }, { status: 500 });
    }
    const rows = (await res.json()) as Array<{
      date: string;
      condition_class: string | null;
      active_median_price: number | null;
      sold_median_price: number | null;
      blended_median_price: number | null;
      active_sample_count: number | null;
      sold_sample_count: number | null;
      confidence: string | null;
    }>;

    // cc filter 있으면 date 별로 fallback 적용: target → normal → all → 아무거나.
    // strict=1이면 정확 condition_class만 사용하고 fallback row는 아예 버린다.
    // cc filter 없으면 'all' 우선, 없으면 첫 row.
    const byDate = new Map<string, typeof rows>();
    for (const r of rows) {
      if (!byDate.has(r.date)) byDate.set(r.date, []);
      byDate.get(r.date)!.push(r);
    }
    // Wave 159h (2026-05-17): shared module conditionFallbackChain 사용 (DRY).
    const fallbackOrder = ccFilter ? (strictCondition ? [ccFilter] : conditionFallbackChain(ccFilter)) : ["all", "normal"];
    const picked: typeof rows = [];
    for (const [, dateRows] of byDate) {
      let chosen = null;
      for (const target of fallbackOrder) {
        const c = dateRows.find((r) => r.condition_class === target);
        if (c) { chosen = c; break; }
      }
      if (!chosen && !strictCondition) chosen = dateRows[0];
      if (!chosen) continue;
      picked.push(chosen);
    }
    picked.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      comparableKey: ck,
      source,
      conditionClass: ccFilter,
      strictCondition,
      points: picked.map((r) => ({
        date: r.date,
        conditionClass: r.condition_class,
        active: r.active_median_price ?? null,
        sold: r.sold_median_price ?? null,
        blended: r.blended_median_price ?? null,
        activeCount: Number(r.active_sample_count ?? 0),
        soldCount: Number(r.sold_sample_count ?? 0),
        confidence: r.confidence ?? "low",
      })),
    });
  } catch (err) {
    console.error("[market/history] error", err);
    return NextResponse.json({ error: "history_fetch_failed" }, { status: 500 });
  }
}
