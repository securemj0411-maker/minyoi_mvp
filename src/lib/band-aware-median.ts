// Wave 252.A (2026-05-20): band-aware sku_median fetch shared helper.
//
// Wave 247.2 가 /api/packs/pool/route.ts 안에 inline 박은 (loadMarketBandsForPool +
// bandAwareMedian) 두 함수를 lib 모듈로 추출. /admin/pool-listings 등 다른 화면도
// 같은 (comparable_key, condition_class) band-aware median 적용 가능.
//
// 정책 (사용자 메모리 ui_changes_apply_to_all_card_screens):
//   사용자 카드 3 화면 (admin-pool-browser / pack-reveal-modal / user-reveal-dashboard)
//   다 같이 박아야 함. pack-reveal-modal + user-reveal-dashboard 는 이미
//   marketBasisForCandidate (pack-open.ts) 통해 band-aware. admin-pool-browser 는
//   raw mvp_listings.sku_median 사용 중 → 본 helper 로 동일 정합 보장.
//
// 사용자 코멘트 id 201/202 (BAPE tee 후드/티 혼합) 근본 fix.
//   1) v7 parser 의 comparable_key 에 product_type 박힘 (예: bape_tee|tee|a_grade vs bape_tee|hoodie|a_grade).
//   2) mvp_market_price_daily 가 (comparable_key, condition_class) 별 row 보유.
//   3) 이 helper 로 매물 condition_class 매칭 band 우선 lookup → 가장 정확한 median.
//   4) band 없거나 sample 부족이면 condition-fallback chain (mint→clean→normal→worn) 적용.
//   5) 그래도 없으면 caller 가 raw mvp_listings.sku_median 으로 fallback (additive — DB 변경 X).

import { pickByConditionFallback } from "@/lib/condition-fallback";
import { restFetch, tableUrl } from "@/lib/supabase-rest";

export type MarketBandRow = {
  comparable_key: string;
  condition_class: string;
  blended_median_price: number | null;
  active_median_price: number | null;
  active_sample_count: number | null;
  sold_sample_count: number | null;
  disappeared_sample_count: number | null;
};

export type MarketBandMap = Map<string, Map<string, MarketBandRow>>;

/**
 * mvp_market_price_daily 에서 comparable_key in (...) 기준으로 (comparable_key, condition_class)
 * 별 최신 row fetch. caller 가 동일 helper 로 매물 condition 매칭 band 즉시 선택 가능.
 *
 * @param headers Supabase REST headers (serviceHeaders() 또는 동급).
 * @param comparableKeys lookup 대상 comparable_key 배열 (null/undefined 자동 제거).
 * @returns Map<comparable_key, Map<condition_class, MarketBandRow>>
 */
export async function loadMarketBandsForKeys(
  headers: Record<string, string>,
  comparableKeys: (string | null | undefined)[],
): Promise<MarketBandMap> {
  const unique = [...new Set(comparableKeys.filter((k): k is string => Boolean(k)))];
  if (unique.length === 0) return new Map();
  const cols = [
    "comparable_key",
    "condition_class",
    "blended_median_price",
    "active_median_price",
    "active_sample_count",
    "sold_sample_count",
    "disappeared_sample_count",
  ].join(",");
  const encoded = unique.map((k) => encodeURIComponent(k)).join(",");
  // pack-open.ts / pool/route.ts 패턴 — comparable_key in (...) + order date desc + limit ample.
  //   각 (comparable_key, condition_class) 의 가장 최신 row 만 보존.
  const res = await restFetch(
    `${tableUrl("mvp_market_price_daily")}?select=${cols}&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc&limit=${Math.max(200, unique.length * 12)}`,
    { headers },
  );
  const rows = (await res.json()) as MarketBandRow[];
  const byKey: MarketBandMap = new Map();
  for (const row of rows) {
    const byCondition = byKey.get(row.comparable_key) ?? new Map<string, MarketBandRow>();
    if (!byCondition.has(row.condition_class)) {
      byCondition.set(row.condition_class, row);
    }
    byKey.set(row.comparable_key, byCondition);
  }
  return byKey;
}

/**
 * 매물 (comparable_key, condition_class) band-aware median 반환.
 *
 *   1) 매물 condition_class 매칭 band 우선 (active_sample + sold + disappeared sample 1 이상).
 *   2) sample 부족 시 condition-fallback chain (pickByConditionFallback) 으로 가까운 등급.
 *   3) blended_median 우선 → active_median fallback.
 *   4) 모두 null/0 이면 null 반환 (caller 가 raw sku_median 으로 fallback).
 *
 * @param bandMap loadMarketBandsForKeys 의 return.
 * @param comparableKey 매물 comparable_key (null → 즉시 null).
 * @param conditionClass 매물 condition_class (null → "normal" default fallback chain).
 * @returns 매물 condition 매칭 시세 (원) 또는 null.
 */
export function bandAwareMedianForListing(
  bandMap: MarketBandMap,
  comparableKey: string | null | undefined,
  conditionClass: string | null | undefined,
): number | null {
  if (!comparableKey) return null;
  const byCondition = bandMap.get(comparableKey);
  if (!byCondition) return null;
  const { row } = pickByConditionFallback(
    byCondition,
    conditionClass ?? null,
    (r) => Number(r.active_sample_count ?? 0) + Number(r.sold_sample_count ?? 0) + Number(r.disappeared_sample_count ?? 0),
  );
  if (!row) return null;
  const price = row.blended_median_price ?? row.active_median_price ?? null;
  return price && price > 0 ? price : null;
}

/**
 * raw sku_median + band-aware median 우선순위 통합 helper.
 *
 *   band-aware median 있으면 그것, 없으면 raw mvp_listings.sku_median.
 *   raw 도 0/null 이면 0 반환 (caller 가 "비교 불가능" 처리).
 *
 * 사용 화면:
 *   - /admin/pool-listings (admin-pool-browser) — Wave 252.A.
 *   - /api/packs/pool (Wave 247.2 도 동일 정책 — 추후 본 helper 로 migrate 가능).
 *   - hotdeal.ts admin shadow display (선택 사용).
 */
export function resolveSkuMedianForDisplay(
  bandMap: MarketBandMap,
  comparableKey: string | null | undefined,
  conditionClass: string | null | undefined,
  rawSkuMedian: number | null | undefined,
): number {
  const band = bandAwareMedianForListing(bandMap, comparableKey, conditionClass);
  if (band != null && band > 0) return band;
  const raw = Number(rawSkuMedian ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}
