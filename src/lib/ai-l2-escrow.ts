// AI L2 Phase 2 escrow gate.
//
// Phase 1은 metadata-only bridge (이미 적용). Phase 2는 `parsed.needs_review === true`인
// smartphone narrow lane row를 scoreStage에서 통과시키되, pool-policy의
// `ai_escrow_pending` flag로 hard block하여 AI verdict 전에는 사용자에게 노출되지 않게 한다.
//
// 본 모듈은 **feature gate OFF**가 default. `AI_L2_ESCROW_PHASE2_ENABLED=1` 명시 시에만
// eligibility 평가가 active. 그 외에는 `isPhase2EscrowEnabled()`가 false를 반환,
// scoreStage의 기존 needs_review skip 동작이 유지된다.
//
// 원칙:
//  - broad smartphone widening 금지 → comparable_key가 `SMARTPHONE_NARROW_PREFIXES`로
//    시작해야만 escrow 대상. open-vocabulary fallback 금지.
//  - silent carrier 추정 금지 → parse_confidence >= MIN_PARSE_CONFIDENCE 명시 게이트.
//    문맥에서 자급제/연식/구성품 추정한 row는 결정론 게이트에서 떨어진다.
//  - 비용 통제 → 한 scoreStage run 내 선택 row를 PER_RUN_CAP 이하로 제한.
//    per-day cap은 DB 측정 (Wave 31 baseline 198/day) 기반으로 별도 단계에서 enforce.
//
// 활성 절차 (Wave 34 이후):
//  1. owner 사인오프 + retention prune script live 적용.
//  2. `ai_escrow_pending`이 POOL_BLOCK_FLAGS에 포함된 것 verify.
//  3. AI_L2_ESCROW_PHASE2_ENABLED=1 으로 환경변수 set.
//  4. 첫 24h baseline 측정 후 결과에 따라 cap 조정.

export const PHASE2_ESCROW_ENV = "AI_L2_ESCROW_PHASE2_ENABLED" as const;

// 한 run(=scoreStage 한 회) 내 escrow로 선택할 수 있는 최대 row 수.
// Wave 31 baseline (AI cache +199/24h) 기반 — tick 주기/1분 cap 환산. 검증 후 조정.
export const PHASE2_ESCROW_PER_RUN_CAP = Number(
  process.env.AI_L2_ESCROW_PHASE2_PER_RUN_CAP ?? 5,
);

// parse_confidence 하한. 자급제/연식/구성품 silent 추정 row는 0~0.55 구간에 몰림.
// LAUNCH_PLAN §1.3 / Wave 29 dry-run cohort와 정렬.
export const PHASE2_ESCROW_MIN_PARSE_CONFIDENCE = 0.55;

// narrow smartphone whitelist. 추가 prefix는 별도 wave에서 측정 후 옮긴다.
// broad `smartphone|...` 또는 generic `iphone|<model>` 만 있고 storage 미상인 key는 차단.
export const SMARTPHONE_NARROW_PREFIXES = [
  "iphone|iphone_15_pro|",
  "iphone|iphone_16_pro|",
  "iphone|iphone_14_pro|",
  "iphone|iphone_13_pro|",
  "iphone|iphone_12_pro|",
  // Wave 40 — pro_max 편입 (owner option A 사인오프). catalog `iphone-15-pro-max` /
  // `iphone-16-pro-max` 기본 SKU 정합성 확인됨. parser 실측 comparable_key prefix와 일치.
  // narrow 확장이지 broad widening 아님; AI는 storage 차원만 추정 책임.
  "iphone|iphone_15_pro_max|",
  "iphone|iphone_16_pro_max|",
] as const;

export function isPhase2EscrowEnabled(): boolean {
  return process.env[PHASE2_ESCROW_ENV] === "1";
}

export type Phase2EscrowDecision =
  | { eligible: true; flag: "ai_escrow_pending"; reason: "narrow_smartphone_escrow" }
  | { eligible: false; flag: null; reason: Phase2EscrowSkipReason };

export type Phase2EscrowSkipReason =
  | "gate_off"
  | "per_run_cap_reached"
  | "category_not_smartphone"
  | "comparable_key_not_narrow"
  | "parse_confidence_below_floor"
  | "parsed_missing";

export type Phase2EscrowInput = {
  parsed:
    | {
        category?: string | null;
        comparable_key?: string | null;
        parse_confidence?: number | string | null;
        needs_review?: boolean | null;
      }
    | null
    | undefined;
  selectedSoFar: number;
};

// scoreStage에서 row 단위로 호출. 호출 측은 `eligible=true`일 때만 row를 점수 계산 path로
// 흘리고, 반환된 flag를 scoreFlags에 push해서 pool-policy가 차단하도록 한다.
//
// gate OFF (default) 면 무조건 `gate_off`로 떨어진다 → 호출 측은 기존 skip 그대로 유지.
// Wave 34: consumer-side helpers used by `applyAiReview` to translate AI verdict
// into escrow flag transitions. Gate OFF상에선 호출되더라도 동작 차이 없음 —
// 입력 row가 애초에 ai_escrow_pending을 보유하지 않기 때문.

export const ESCROW_PENDING_FLAG = "ai_escrow_pending" as const;
export const ESCROW_HELD_FLAG = "ai_escrow_held" as const;
export const ESCROW_UNAVAILABLE_FLAG = "ai_escrow_unavailable" as const;

export type EscrowVerdictTransition = "pass" | "hold" | "unavailable" | "reject" | "noop";

export function applyEscrowTransition(
  scoreFlags: readonly string[],
  transition: EscrowVerdictTransition,
): string[] {
  const hasPending = scoreFlags.includes(ESCROW_PENDING_FLAG);
  if (!hasPending || transition === "noop") return [...scoreFlags];
  // 모든 transition에서 pending은 제거. 남길 marker는 transition별로 추가.
  const stripped = scoreFlags.filter((f) => f !== ESCROW_PENDING_FLAG);
  if (transition === "pass") return stripped;                        // pool 진입 허용
  if (transition === "hold") return [...stripped, ESCROW_HELD_FLAG]; // 사람 review 대기
  if (transition === "unavailable") return [...stripped, ESCROW_UNAVAILABLE_FLAG]; // 다음 tick 재시도
  if (transition === "reject") return stripped;                     // row 자체 drop (caller가 null 처리)
  return stripped;
}

export function evaluatePhase2Escrow(input: Phase2EscrowInput): Phase2EscrowDecision {
  if (!isPhase2EscrowEnabled()) {
    return { eligible: false, flag: null, reason: "gate_off" };
  }
  const { parsed, selectedSoFar } = input;
  if (!parsed) {
    return { eligible: false, flag: null, reason: "parsed_missing" };
  }
  if (selectedSoFar >= PHASE2_ESCROW_PER_RUN_CAP) {
    return { eligible: false, flag: null, reason: "per_run_cap_reached" };
  }
  if (parsed.category !== "smartphone") {
    return { eligible: false, flag: null, reason: "category_not_smartphone" };
  }
  const key = parsed.comparable_key ?? "";
  const isNarrow = SMARTPHONE_NARROW_PREFIXES.some((prefix) => key.startsWith(prefix));
  if (!isNarrow) {
    return { eligible: false, flag: null, reason: "comparable_key_not_narrow" };
  }
  const conf = Number(parsed.parse_confidence ?? 0);
  if (!Number.isFinite(conf) || conf < PHASE2_ESCROW_MIN_PARSE_CONFIDENCE) {
    return { eligible: false, flag: null, reason: "parse_confidence_below_floor" };
  }
  return { eligible: true, flag: "ai_escrow_pending", reason: "narrow_smartphone_escrow" };
}
