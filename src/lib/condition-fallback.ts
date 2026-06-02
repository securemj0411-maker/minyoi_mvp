// Wave 159h (2026-05-17): 시세 fallback chain shared module.
// 이전 (Wave 159f/g): tick-pipeline / pack-open / landing-showcases / market-history / market-source 4곳에
// 동일 매핑 중복 → DRY 위반 + 정합성 risk.
// 이 module 에 통합. 미래 정책 변경 시 한 곳만 수정.
//
// 정책 (사용자 메모리 안전결제 의무 + 차익 부풀려짐 방지):
// - flawed/low_batt 같은 손상/저성능 매물에 unopened (다나와 새 가격) / mint 시세가 임의 fallback X
// - sample 부족 시 같은/낮은 condition 시세로 보수적 fallback
// - 임의 첫 entry fallback 절대 금지 (Map.values().next().value 사고 차단)

export type ConditionClass = string;

// Wave 178 (2026-05-17): 사용자 코멘트 pid 258306715 "새상품이랑 민트급은 다른거아니야??".
// 옛 chain은 mint → unopened, clean → mint 처럼 "위로 fallback" 허용 → mint 매물이
// unopened (다나와 새 가격) 시세로 부풀어지고 clean 매물이 mint 시세로 부풀어짐.
// 정책: 시세 추정은 보수적 (precision > recall) — 위로 fallback 차단, 같거나 아래로만.
// unopened/mint 매물 자체는 그대로 (위가 없음, 아래로 fallback 자연).
export const CONDITION_FALLBACK_CHAIN: Record<string, string[]> = {
  unopened: ["unopened", "mint", "clean", "normal", "all"],   // 가장 premium — 아래로만 자연 fallback
  mint: ["mint", "clean", "normal", "all"],                    // ❌ Wave 178: unopened 제거 (위로 차단)
  clean: ["clean", "normal", "worn", "all"],                   // ❌ Wave 178: mint 제거 (위로 차단)
  normal: ["normal", "clean", "worn", "all"],                  // normal↔clean 가까움 — 양쪽 fallback 유지
  worn: ["worn", "normal", "all"],
  low_batt: ["low_batt", "worn", "normal", "all"],
  flawed: ["flawed", "worn", "low_batt", "normal", "all"],
  all: ["all", "normal", "clean", "worn", "mint"],
};

// 안전 마지막 fallback: target/normal/worn/clean 순. unopened/mint 절대 잡지 않음.
export const SAFE_FINAL_FALLBACK: ConditionClass[] = ["normal", "worn", "clean"];

/**
 * 매물 condition_class 에 대한 fallback chain 반환.
 * 정의되지 않은 condition 이면 보수적 default ([target, "normal", "worn", "clean", "all"]).
 */
export function conditionFallbackChain(target: ConditionClass | null | undefined): string[] {
  const key = target ?? "normal";
  return CONDITION_FALLBACK_CHAIN[key] ?? [key, "normal", "worn", "clean", "all"];
}

/**
 * Map<condition_class, T> 에서 target 우선 + fallback chain 으로 row 선택.
 * sample 부족 시 다음 condition 으로 진행.
 *
 * @param byCondition condition_class → row map
 * @param target 매물 condition_class
 * @param getSamples row 에서 sample 수 추출 (sample 부족 fallback 트리거)
 * @param minSamples 충분한 sample 기준 (default 1)
 *
 * Wave 193 (2026-05-18): default 3 → 1. 사용자 보고 — clean 매물 (S급 battery_perfect)
 *   에 normal 시세 (110K) fallback 으로 표시. 실제 clean 시세 184K 인데 sample 1건 이라
 *   minSamples=3 미달 → normal 매칭 + 시세 역전 bias (normal 3건 우연히 저가).
 *   변경: minSamples 1 로 낮춤. condition-specific 시세 우선. fallbackUsed=false 로
 *   "정확 매칭" 명시 (UI 의 "인접 등급 fallback" 라벨 차단). outlier 위험은 UI 신뢰도
 *   표시 (sample count) 로 사용자 인지.
 */
export function pickByConditionFallback<T>(
  byCondition: Map<ConditionClass, T> | undefined,
  target: ConditionClass | null | undefined,
  getSamples: (row: T) => number,
  minSamples = 1,
  // Wave 817 (2026-05-30): tier 인자 추가 — fashion (shoe/clothing) 의 tier 차원 lookup.
  //   tier 박혀있고 UNKNOWN 아니면 fashion path: `${tier}|` composite key 우선 lookup.
  //   tier 빈 값 → non-fashion legacy path: `|${cc}` composite + 옛 단일 cc key 동시 시도.
  //   Map key 는 fetchLatestMarketStats (Wave 816) 가 박은 `${tier}|${cc}` composite.
  //   backward compat: 옛 cc 단일 key 도 fallback 으로 시도 (한 deploy turn 안 깨짐).
  conditionTier?: ConditionClass | null,
): { row: T | undefined; conditionClass: ConditionClass | null; fallbackUsed: boolean } {
  if (!byCondition || byCondition.size === 0) {
    return { row: undefined, conditionClass: null, fallbackUsed: false };
  }

  const tier = (conditionTier ?? "").trim();
  const hasTier = tier !== "" && tier !== "UNKNOWN";

  // Wave 1023 (2026-06-02): tier-aware exact lookup for every tiered category.
  // Earlier logic treated any non-empty tier as fashion-only and looked for
  // `${tier}|` first. That missed game/golf rows stored as `${tier}|${cc}` and
  // could fall back to unrelated condition rows. Prefer same tier + same/fallback
  // condition, then same-tier classless fashion rows. Never pick another tier.
  if (hasTier) {
    const order = conditionFallbackChain(target);
    for (let i = 0; i < order.length; i += 1) {
      const cls = order[i];
      const cand = byCondition.get(`${tier}|${cls}` as ConditionClass);
      if (!cand) continue;
      const samples = getSamples(cand);
      if (samples >= minSamples || i === order.length - 1) {
        return { row: cand, conditionClass: cls, fallbackUsed: i > 0 };
      }
    }

    // Fashion rows intentionally store condition_class="" and use tier only.
    const tierOnly = byCondition.get(`${tier}|` as ConditionClass);
    if (tierOnly != null) {
      return { row: tierOnly, conditionClass: "" as ConditionClass, fallbackUsed: false };
    }

    // Wave 803i legacy compatibility: old classless rows before composite keys.
    const legacyEmpty = byCondition.get("" as ConditionClass);
    if (legacyEmpty != null) {
      return { row: legacyEmpty, conditionClass: "" as ConditionClass, fallbackUsed: true };
    }
  }

  // Non-fashion (또는 fashion fallback) — cc 기반 chain.
  //   composite `|${cc}` 우선, 옛 단일 cc key fallback.
  const order = conditionFallbackChain(target);
  for (let i = 0; i < order.length; i++) {
    const cls = order[i];
    let cand = byCondition.get(`|${cls}` as ConditionClass);
    if (!cand) cand = byCondition.get(cls);
    if (!cand) continue;
    const samples = getSamples(cand);
    if (samples >= minSamples || i === order.length - 1) {
      return { row: cand, conditionClass: cls, fallbackUsed: i > 0 };
    }
  }
  // 안전 fallback: normal/worn/clean 순. unopened/mint 임의 잡지 않음.
  for (const cls of SAFE_FINAL_FALLBACK) {
    const cand = byCondition.get(`|${cls}` as ConditionClass) ?? byCondition.get(cls);
    if (cand) return { row: cand, conditionClass: cls, fallbackUsed: true };
  }
  return { row: undefined, conditionClass: null, fallbackUsed: false };
}
