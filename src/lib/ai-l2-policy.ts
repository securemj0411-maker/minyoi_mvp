// AI L2 review 정책 v1.
//
// 입력: 룰 단계에서 부여한 priceGap + scoreFlags + (선택) category.
// 출력: AI 분류기로 넘길지 + 이유 + 우선순위.
//
// 측정 근거: `scripts/experiment-ai-l2.mjs` 실험 결과
// (gpt-4o-mini, n=600, 2026-05-12. reports/ai-l2-experiment-2026-05-12.json)
//   - extreme_discount_review (gap≥0.75): overturn 0/108 → AI가 100% 노이즈 확인. 무조건 review.
//   - deep_discount_review (gap≥0.55): overturn 0/176 → 동일.
//   - weak_normal_signal alone: overturn 29/329 = 8.8%. AI가 300건 노이즈 필터. 비용 $0.002/overturn. review 유지.
//   - commercial_review, multi_model_review, suspicious_model_review, short_title:
//     broad lane 내 사실상 발화 없음 (n=0~1). 룰이 1차에서 이미 떨궈서. 발화 시에는 review.
//   - 카테고리별 overturn: smartphone 1.1%, laptop 12.0%, headphone 14.3%, desktop 5.2%.
//     모두 trust_rule 권장이지만 AI L2가 노이즈를 91~97% 필터 — AI 호출 유지가 합리적.
//   - gpt-4o vs gpt-4o-mini 22% raw agreement은 listing_type 라벨이 갈리는 것 (대부분
//     noise vs noise 안에서 다른 enum). binary "normal vs 노이즈" 동의는 훨씬 높음.
//
// 모델 추상화: production은 gpt-4o-mini (OpenAI 폴백 for Haiku 4.5). env로 swap 가능.
// Anthropic Haiku 4.5 비교는 다음 wave (D-005 이후).
//
// 다음 wave 검토 항목 (현 버전엔 미포함):
//   - weak_normal_signal alone + priceGap<0.4 부분 skip (cost 절약 vs noise leak 트레이드오프 측정).
//   - extreme_discount_review (≥0.85) tier로 split해 deterministic drop 가능성 (AI 콜 자체 절약).

export const AI_L2_FLAGS = [
  "extreme_discount_review",
  "deep_discount_review",
  "multi_model_review",
  "suspicious_model_review",
  "weak_normal_signal",
  "short_title",
  "commercial_review",
  "option_parse_review",
  "option_needs_review",
  "market_stat_missing",
  "market_confidence_low",
  "self_unlocked_ambiguity",
  "bundle_or_accessory_ambiguity",
  "generation_ambiguity",
  "connectivity_ambiguity",
  "parser_unknown_option",
] as const;

export type AiL2Flag = (typeof AI_L2_FLAGS)[number];

export type AiL2Decision = {
  review: boolean;
  reason: string;
  priority: "high" | "normal" | "skip";
};

export type AiL2Input = {
  priceGap: number;
  scoreFlags: readonly string[];
  category?: string | null;
};

// 환경변수 게이트. =1 면 정책 v1 (decideAiL2Review). 그 외/미설정이면 기존 룰 유지.
// production 기본값은 off — 측정 결과 검토 + ramp 후 켠다.
export function isAiL2PolicyEnabled(): boolean {
  return process.env.AI_L2_POLICY_ENABLED === "1";
}

// pipeline.ts shouldAiReview 의 wire 지점.
// off:  legacy boolean (scoreFlags 있거나 gap ≥ 0.55 거나 suspicious 텍스트).
// on:   decideAiL2Review(...).review.
// legacySuspicious 는 off 경로 parity 용 — on 경로에선 suspicious_model_review flag 가 동일 신호.
export function shouldReviewByPolicy(input: AiL2Input & { legacySuspicious?: boolean }): boolean {
  if (isAiL2PolicyEnabled()) return decideAiL2Review(input).review;
  return (
    input.scoreFlags.length > 0 ||
    (input.priceGap ?? 0) >= 0.55 ||
    input.legacySuspicious === true
  );
}

// 모델 추상화. production: gpt-4o-mini (OpenAI fallback for Haiku 4.5).
// Anthropic Haiku 4.5 비교는 다음 wave에서 swap 가능하게 env로 분리.
export const AI_L2_MODEL =
  process.env.AI_L2_MODEL ?? process.env.OPENAI_CLASSIFIER_MODEL ?? "gpt-4o-mini";
export const AI_L2_PROVIDER = (process.env.AI_L2_PROVIDER ?? "openai").toLowerCase() as
  | "openai"
  | "anthropic";

// 정책 파라미터. 변경 시 reports/ai-l2-experiment-<date>.json 측정치와 함께 commit.
export const POLICY_PARAMS = {
  // priceGap absolute thresholds.
  // 측정상 둘 다 0% overturn — 같이 fire되더라도 review 강도만 다르게.
  EXTREME_GAP: 0.75,
  DEEP_GAP_FLOOR: 0.55,
  // open-set: 룰이 SKU 매칭 못 하는 카테고리. desktop은 catalog에 SKU 자체 없음 → AI 위임.
  OPEN_SET_CATEGORIES: ["desktop", "desktop_custom_build"],
  // weak_normal_signal alone + 낮은 gap 도 review (8.8% overturn → AI가 noise 91% 필터).
  // 다음 wave에서 priceGap<0.4 부분만 skip 실험 예정.
  WEAK_NORMAL_ALONE_REVIEW: true,
};

function hasFlag(flags: readonly string[], target: AiL2Flag): boolean {
  return flags.includes(target);
}

function flagsOfInterest(flags: readonly string[]): AiL2Flag[] {
  return AI_L2_FLAGS.filter((f) => flags.includes(f));
}

/**
 * 한 candidate가 AI L2 분류기로 가야 하는지 결정.
 *
 * 우선순위 (high가 latency budget 확보, normal은 best-effort):
 *  1. suspicious_model_review → review/high. 가짜/존재 안 하는 세대 표기.
 *  2. multi_model_review → review/high. 한 글에 여러 SKU 옵션.
 *  3. extreme_discount_review (priceGap ≥ 0.75) → review/high. 100% AI noise 확정.
 *  4. open-set 카테고리 (desktop_custom_build) → review/normal. SKU 자체가 없어 AI에 위임.
 *  5. parser/option ambiguity → review/normal. 결정론이 정확성 기준으로 멈춘 lane의 L2 담당.
 *  6. commercial_review → review/normal. 약한 업자 신호.
 *  7. deep_discount_review (≥ 0.55) → review/normal.
 *  8. weak_normal_signal / short_title (단독) → review/normal. 8.8% overturn = AI가 의미 있게 필터.
 *  9. flag 없음 + gap < DEEP_GAP_FLOOR → skip.
 */
export function decideAiL2Review(input: AiL2Input): AiL2Decision {
  const flags = flagsOfInterest(input.scoreFlags);
  const gap = input.priceGap ?? 0;
  const category = (input.category ?? "").toLowerCase();

  if (hasFlag(flags, "suspicious_model_review")) {
    return { review: true, priority: "high", reason: "suspicious_model_text" };
  }
  if (hasFlag(flags, "multi_model_review")) {
    return { review: true, priority: "high", reason: "multi_model_in_title" };
  }
  if (hasFlag(flags, "extreme_discount_review") || gap >= POLICY_PARAMS.EXTREME_GAP) {
    return { review: true, priority: "high", reason: `extreme_discount_gap=${gap.toFixed(2)}` };
  }
  if (POLICY_PARAMS.OPEN_SET_CATEGORIES.includes(category)) {
    return { review: true, priority: "normal", reason: "open_set_category" };
  }
  if (hasFlag(flags, "self_unlocked_ambiguity")) {
    return { review: true, priority: "normal", reason: "self_unlocked_ambiguity" };
  }
  if (hasFlag(flags, "bundle_or_accessory_ambiguity")) {
    return { review: true, priority: "normal", reason: "bundle_or_accessory_ambiguity" };
  }
  if (hasFlag(flags, "generation_ambiguity")) {
    return { review: true, priority: "normal", reason: "generation_ambiguity" };
  }
  if (hasFlag(flags, "connectivity_ambiguity")) {
    return { review: true, priority: "normal", reason: "connectivity_ambiguity" };
  }
  if (
    hasFlag(flags, "option_parse_review") ||
    hasFlag(flags, "option_needs_review") ||
    hasFlag(flags, "parser_unknown_option")
  ) {
    return { review: true, priority: "normal", reason: "parser_option_ambiguity" };
  }
  if (hasFlag(flags, "market_stat_missing") || hasFlag(flags, "market_confidence_low")) {
    return { review: true, priority: "normal", reason: "market_stat_uncertain" };
  }
  if (hasFlag(flags, "commercial_review")) {
    return { review: true, priority: "normal", reason: "commercial_weak_signal" };
  }
  if (hasFlag(flags, "deep_discount_review") || gap >= POLICY_PARAMS.DEEP_GAP_FLOOR) {
    return { review: true, priority: "normal", reason: `deep_discount_gap=${gap.toFixed(2)}` };
  }
  if (POLICY_PARAMS.WEAK_NORMAL_ALONE_REVIEW && (hasFlag(flags, "weak_normal_signal") || hasFlag(flags, "short_title"))) {
    return { review: true, priority: "normal", reason: "weak_normal_or_short_title" };
  }

  if (flags.length === 0 && gap < POLICY_PARAMS.DEEP_GAP_FLOOR) {
    return { review: false, priority: "skip", reason: "no_signal" };
  }

  return { review: true, priority: "normal", reason: "fallback_other_flag" };
}
