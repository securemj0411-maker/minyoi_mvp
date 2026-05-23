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
//
// Wave 252.A real (2026-05-20): v3 comparable_key stale 가드 확장.
//   문제: 이전 Wave 252.A 는 admin-pool-browser 만 박힘. pack-reveal-modal + /me 는
//   여전히 marketBasisForCandidate 를 통해 v3 매물의 comparable_key (clothing|sku|grade — 3 tokens)
//   로 mvp_market_price_daily 조회 → mixed-pool row (tee + hoodie + crewneck 섞임) hit.
//   사용자 코멘트 id 201/202 (BAPE tee A-grade mint 매물이 78,200원이 아닌 119,600원으로 표시).
//
//   원인: clothing v3 (Wave 216 이전) parser 가 product_type 토큰 미박음 →
//     `clothing|bape_tee|a_grade` (3-token v3 key) 가 mvp_market_price_daily 에 잔존.
//     같은 SKU 의 v7 sibling 행 (`clothing|bape_tee|tee|a_grade`, `clothing|bape_tee|hoodie|a_grade`)
//     이 별도로 존재 → 사용자에게 v3 mixed median 보여주면 후드티 매물에 티 가격 표시.
//
//   해결: detectV3ClothingKey + loadV7SiblingPresence helper 로 batch 검증.
//     - v3 key 패턴 (clothing|<sku>|<grade>, 3 tokens, last token in {a/b/c/s_grade,unknown_condition})
//       이면서 mvp_market_price_daily 에 v7 sibling row (clothing|<sku>|<product_type>|<grade>) 존재 시,
//       v3 row 의 median 은 mixed-pool → 신뢰 불가 → null 반환 (caller 가 비교 불가능 처리).
//     - 이미 Wave 252.B step 1 이 v3 매물 2,386건 재매칭 진행 중 (별도 task). 그동안 사용자에게
//       잘못된 median 노출 차단 (additive — DB 변경 X, 발견 시점 fetch 만).

import { pickByConditionFallback } from "@/lib/condition-fallback";
import { restFetch, tableUrl } from "@/lib/supabase-rest";

// v3 clothing comparable_key 패턴 (Wave 216 이전 parser). product_type 토큰 부재.
//   shape: clothing|<sku_id>|<condition_token>
//   condition_token: a_grade / b_grade / c_grade / s_grade / unknown_condition / reject
// v7 clothing key shape: clothing|<sku_id>|<product_type>|<condition_token> (4 tokens).
//
// 본 detect 는 v3 stale 가드용. 다른 카테고리 (electronics/bag/shoe 등) 의 3-token key
// 는 v3 와 무관하므로 prefix `clothing|` 체크 필수.
const CLOTHING_CONDITION_TOKENS = new Set([
  "a_grade",
  "b_grade",
  "c_grade",
  "s_grade",
  "unknown_condition",
  "reject",
]);

/**
 * v3-pattern clothing comparable_key 감지.
 * @returns true 면 mixed-pool row → v7 sibling 존재 검증 필요.
 */
export function isClothingV3Key(comparableKey: string | null | undefined): boolean {
  if (!comparableKey) return false;
  const parts = comparableKey.split("|");
  if (parts.length !== 3) return false;
  if (parts[0] !== "clothing") return false;
  return CLOTHING_CONDITION_TOKENS.has(parts[2] ?? "");
}

/**
 * v3 clothing key 의 v7 sibling 존재 여부 batch lookup.
 *
 * v3 key `clothing|bape_tee|a_grade` 에 대해 `clothing|bape_tee|<product_type>|a_grade`
 * (또는 다른 condition) 의 v7 row 가 mvp_market_price_daily 에 있는지 확인.
 *
 * 구현: PostgREST `like` 연산자로 prefix 매칭. v3 key 의 첫 2 토큰을 prefix 로,
 * v7 sibling 은 추가 토큰 1개 (product_type) 사이에 박힘 → `clothing|bape_tee|%|<grade>`.
 *
 * @returns v3 key → true (v7 sibling 존재) / false (v7 sibling 없음).
 */
export async function loadV7SiblingPresence(
  headers: Record<string, string>,
  v3Keys: string[],
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const unique = [...new Set(v3Keys.filter((k) => isClothingV3Key(k)))];
  if (unique.length === 0) return out;
  // PostgREST 는 다중 like 조건을 or 로 묶을 수 있다 — or=(comparable_key.like.prefix1*,comparable_key.like.prefix2*).
  // 비용: v3 key 당 단일 LIKE — comparable_key 컬럼은 index 있음 (lib/migrations 확인 완료).
  const orClauses: string[] = [];
  for (const v3Key of unique) {
    const parts = v3Key.split("|");
    // clothing|<sku>|<grade> → clothing|<sku>|*|<grade>... but the v7 row has 4 tokens total
    // (no further suffix). PostgREST like uses `*` as wildcard.
    // We use `clothing|<sku>|*` and post-filter on the row's last token == grade.
    // To minimize round trips, fetch `comparable_key` only and filter client-side.
    const prefix = `${parts[0]}|${parts[1]}|`;
    orClauses.push(`comparable_key.like.${encodeURIComponent(prefix + "*")}`);
  }
  if (orClauses.length === 0) return out;
  // limit ample — v7 카테고리당 product_type 최대 ~10 (tee/hoodie/crewneck/jacket/knit/pants/shorts/cardigan/coat/polo) * 5 condition.
  const limit = Math.max(200, unique.length * 50);
  const res = await restFetch(
    `${tableUrl("mvp_market_price_daily")}?select=comparable_key&or=(${orClauses.join(",")})&order=date.desc&limit=${limit}`,
    { headers },
  );
  const rows = (await res.json()) as Array<{ comparable_key: string }>;
  // Group by (sku_id, condition_token) prefix and check if any 4-token key exists.
  const v7PresenceByPrefix = new Set<string>();
  for (const row of rows) {
    const p = row.comparable_key.split("|");
    if (p.length === 4 && p[0] === "clothing") {
      // signature: clothing|<sku>|<condition>
      v7PresenceByPrefix.add(`${p[0]}|${p[1]}|${p[3]}`);
    }
  }
  for (const v3Key of unique) {
    out.set(v3Key, v7PresenceByPrefix.has(v3Key));
  }
  return out;
}

export type V7SiblingPresenceMap = Map<string, boolean>;

export type MarketBandRow = {
  comparable_key: string;
  condition_class: string;
  // Wave 722 / Stage 5 (2026-05-23): shoe/clothing은 S/A/B/C/D/UNKNOWN, 그 외는 '' (sentinel).
  condition_tier: string;
  blended_median_price: number | null;
  active_median_price: number | null;
  active_sample_count: number | null;
  sold_sample_count: number | null;
  disappeared_sample_count: number | null;
};

// Wave 722: nested key — comparable_key → condition_class → condition_tier → row.
// shoe/clothing은 tier별 별도 row, 그 외는 tier='' 하나만 존재.
export type MarketBandMap = Map<string, Map<string, Map<string, MarketBandRow>>>;

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
    // Wave 722 / Stage 5 (2026-05-23): tier 컬럼 추가 — shoe/clothing 매물 tier-aware filter.
    "condition_tier",
    "blended_median_price",
    "active_median_price",
    "active_sample_count",
    "sold_sample_count",
    "disappeared_sample_count",
  ].join(",");
  const encoded = unique.map((k) => encodeURIComponent(k)).join(",");
  // pack-open.ts / pool/route.ts 패턴 — comparable_key in (...) + order date desc + limit ample.
  //   각 (comparable_key, condition_class, condition_tier) 의 가장 최신 row 만 보존.
  // Wave 722: tier 컬럼 추가로 row 수가 카테고리당 최대 5배 (S/A/B/C/D/UNKNOWN) 증가 가능 → limit 확대.
  const res = await restFetch(
    `${tableUrl("mvp_market_price_daily")}?select=${cols}&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc&limit=${Math.max(500, unique.length * 60)}`,
    { headers },
  );
  const rows = (await res.json()) as MarketBandRow[];
  const byKey: MarketBandMap = new Map();
  for (const row of rows) {
    const tier = row.condition_tier ?? "";
    const byCondition = byKey.get(row.comparable_key) ?? new Map<string, Map<string, MarketBandRow>>();
    const byTier = byCondition.get(row.condition_class) ?? new Map<string, MarketBandRow>();
    // 가장 최신만 (order desc + 첫 매칭 보존)
    if (!byTier.has(tier)) {
      byTier.set(tier, row);
    }
    byCondition.set(row.condition_class, byTier);
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
 * Wave 252.A real (2026-05-20): optional v7SiblingPresence 가드 추가.
 *   v3 clothing key 인데 v7 sibling row 존재 시 mixed-pool 신뢰 불가 → null.
 *   caller 가 sku_median_unavailable 처리 (Wave 249 정책 동일).
 *
 * @param bandMap loadMarketBandsForKeys 의 return.
 * @param comparableKey 매물 comparable_key (null → 즉시 null).
 * @param conditionClass 매물 condition_class (null → "normal" default fallback chain).
 * @param v7SiblingPresence optional — loadV7SiblingPresence 의 return.
 * @returns 매물 condition 매칭 시세 (원) 또는 null.
 */
export function bandAwareMedianForListing(
  bandMap: MarketBandMap,
  comparableKey: string | null | undefined,
  conditionClass: string | null | undefined,
  v7SiblingPresence?: V7SiblingPresenceMap,
  conditionTier?: string | null | undefined,
): number | null {
  if (!comparableKey) return null;
  // Wave 252.A real: v3 stale 가드 — v7 sibling 존재 시 v3 row mixed-pool 차단.
  if (v7SiblingPresence && v7SiblingPresence.get(comparableKey) === true) {
    return null;
  }
  const byCondition = bandMap.get(comparableKey);
  if (!byCondition) return null;
  // Wave 722 / Stage 5 (2026-05-23): tier-aware path — shoe/clothing은 (condition_class, condition_tier) 둘 다 매칭.
  //   conditionTier 명시 + bandMap에 해당 tier row 존재하면 그것 사용.
  //   tier sample 부족 시 inter-tier fallback (인접 tier 가중평균은 별 wave — neighbor-weighted-price.ts).
  //   현재 단계: tier 매칭 row → 직접 사용, tier 매칭 row 0 → tier 무시 fallback (옛 conditionClass 그대로).
  const tierKey = conditionTier ?? "";
  if (tierKey && tierKey !== "") {
    // shoe/clothing 매물 tier 명시 → 같은 tier row 우선
    const conditionFallbackMap = collapseTierLevelToCondition(byCondition, tierKey);
    const { row: tierRow } = pickByConditionFallback(
      conditionFallbackMap,
      conditionClass ?? null,
      (r) => Number(r.active_sample_count ?? 0) + Number(r.sold_sample_count ?? 0) + Number(r.disappeared_sample_count ?? 0),
    );
    if (tierRow) {
      const price = tierRow.blended_median_price ?? tierRow.active_median_price ?? null;
      if (price && price > 0) return price;
    }
    // tier 매칭 row 없거나 0 → tier 무시 fallback (legacy path, conditionClass만).
  }
  // Legacy path — tier 무관 (전자기기 등) 또는 fallback.
  const legacyMap = collapseTierLevelToCondition(byCondition, "");
  const { row } = pickByConditionFallback(
    legacyMap,
    conditionClass ?? null,
    (r) => Number(r.active_sample_count ?? 0) + Number(r.sold_sample_count ?? 0) + Number(r.disappeared_sample_count ?? 0),
  );
  if (!row) return null;
  const price = row.blended_median_price ?? row.active_median_price ?? null;
  return price && price > 0 ? price : null;
}

/**
 * Wave 722: nested tier map → flat conditionClass map 변환 (pickByConditionFallback 호환).
 *   targetTier 명시 시 해당 tier row만 추출 (tier filter).
 *   targetTier='' 또는 매칭 없으면 모든 tier sample을 합쳐서 conditionClass별 가장 큰 sample row 선택.
 */
function collapseTierLevelToCondition(
  byCondition: Map<string, Map<string, MarketBandRow>>,
  targetTier: string,
): Map<string, MarketBandRow> {
  const out = new Map<string, MarketBandRow>();
  for (const [conditionClass, byTier] of byCondition.entries()) {
    if (targetTier) {
      // 명시 tier 추출 (없으면 skip — 다른 conditionClass에서 같은 tier 시도)
      const row = byTier.get(targetTier);
      if (row) out.set(conditionClass, row);
    } else {
      // tier 무시 — 모든 tier row 중 sample 가장 큰 것
      let best: MarketBandRow | undefined;
      let bestSample = -1;
      for (const r of byTier.values()) {
        const s = Number(r.active_sample_count ?? 0) + Number(r.sold_sample_count ?? 0) + Number(r.disappeared_sample_count ?? 0);
        if (s > bestSample) {
          best = r;
          bestSample = s;
        }
      }
      if (best) out.set(conditionClass, best);
    }
  }
  return out;
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
  v7SiblingPresence?: V7SiblingPresenceMap,
  conditionTier?: string | null | undefined,
): number {
  // Wave 722 / Stage 5 (2026-05-23): conditionTier 추가 — shoe/clothing 매물 tier-aware 시세.
  const band = bandAwareMedianForListing(bandMap, comparableKey, conditionClass, v7SiblingPresence, conditionTier);
  if (band != null && band > 0) return band;
  // Wave 252.A real: v3 stale 매물도 raw sku_median fallback 차단.
  //   raw sku_median 은 mvp_listings 에 박힌 값 — v3 매물의 경우 v3 comparable_key 시점에
  //   계산된 값 (역시 mixed pool 신뢰 불가). v7 sibling 존재 시 0 반환 → 비교 불가능.
  if (v7SiblingPresence && comparableKey && v7SiblingPresence.get(comparableKey) === true) {
    return 0;
  }
  const raw = Number(rawSkuMedian ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}
