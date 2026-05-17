export const POOL_CONFIDENCE_FLOOR = 0.7;

export const POOL_BLOCK_FLAGS = [
  // Wave 13: coarse_market_price + market_confidence_low 제거.
  // trustedMarketMedian이 confidence=low + sample>=2 도 trusted로 받게 변경됨에 따라
  // 두 flag는 candidate-pool-builder 차단에서 제외. market_stat_missing은 유지 (시세 자체 없으면 차단).
  "extreme_discount_review",
  "market_stat_missing",
  "option_parse_review",
  "option_needs_review",
  "parser_unknown_option",
  "self_unlocked_ambiguity",
  "bundle_or_accessory_ambiguity",
  "generation_ambiguity",
  "connectivity_ambiguity",
  "ai_review_unavailable",
  "ai_second_opinion_hold",
  "weak_description",
  "risk_keyword_review",
  "condition_review",
  // Wave 33 — AI L2 Phase 2 escrow. AI verdict 전까지 hard block.
  "ai_escrow_pending",       // narrow smartphone needs_review row가 escrow queue에 들어간 상태.
  "ai_escrow_held",          // AI verdict가 confidence 낮거나 보류 — 사람 review 대기.
  "ai_escrow_unavailable",   // AI L2 API/cache 호출 실패 — 다음 tick에서 재시도.
];

export function bandFromProfit(profitMin, profitMax) {
  const avg = Math.round((profitMin + profitMax) / 2);
  if (avg >= 70_000) return 3;
  if (avg >= 40_000) return 2;
  // Wave 90 (2026-05-15): 1만 게이트로 lower. 배송비/수수료 net 1만 차익이면 사용자 가치.
  // 풀 산출량 측면 일반인 친화 (저자본 진입자) + outlier 매물 더 많이 흡수.
  if (avg >= 10_000) return 1;
  return null;
}

// Wave 179 (2026-05-17 사용자 코멘트): band 시스템 폐기됨. 1매물 = 1명에게만 노출 (희소성/정확성).
// 이전: band 3→1 / band 2→2 / band 1→3 (band에 따라 2~3명까지 공유)
// 2026-05-17: 일률 5 (사용자 결정) — 풀 5배 효율 + 신규 가입자 풀 부족 차단.
// 랜덤 selection 이라 같은 매물 보일 확률 ~1/N (낮음, UX 영향 미미).
export function poolMaxExposure(_band) {
  return 5;
}

export function computePoolConfidence(parseConfidence, scoreFlags = []) {
  const flags = Array.isArray(scoreFlags) ? scoreFlags : [];
  let confidence = Math.max(0, Math.min(1, Number(parseConfidence ?? 0.5) || 0.5));
  if (flags.includes("ai_normal")) confidence = Math.min(1, confidence + 0.2);
  if (flags.includes("ai_review_unavailable")) confidence = Math.max(0, confidence - 0.1);
  if (flags.some((flag) => typeof flag === "string" && flag.endsWith("_low_confidence"))) {
    confidence = Math.max(0, confidence - 0.15);
  }
  return Math.round(confidence * 100) / 100;
}

export function hasPoolBlockFlag(scoreFlags = []) {
  const flags = Array.isArray(scoreFlags) ? scoreFlags : [];
  return flags.some((flag) => (
    POOL_BLOCK_FLAGS.includes(flag) ||
    (typeof flag === "string" && flag.endsWith("_low_confidence")) ||
    (flag === "deep_discount_review" && !flags.includes("ai_normal"))
  ));
}

export function poolSkipReason(input) {
  const scoreFlags = Array.isArray(input.scoreFlags) ? input.scoreFlags : [];
  if (input.profitMin <= 0) return "profit_not_positive";
  if (input.price >= input.skuMedian) return "price_gte_market";
  const saleStatus = String(input.saleStatus ?? "").trim().toUpperCase();
  if (saleStatus && !["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE"].includes(saleStatus)) return "sale_status_inactive";
  if (input.skuMedian > 0 && input.price / input.skuMedian <= 0.25) return "blocked_extreme_discount_review";
  if (input.riskHits > 0) return "risk_keyword";
  if (!input.thumbnailUrl) return "missing_thumbnail";
  if (!input.categoryCanEnterPool) return input.categoryReason ?? "category_not_ready";
  if (!input.comparableKey) return "missing_comparable_key";
  if (input.needsReview) return "option_needs_review";
  if (input.confidence < POOL_CONFIDENCE_FLOOR) return "pool_confidence_low";
  if (hasPoolBlockFlag(scoreFlags)) {
    const flag = scoreFlags.find((item) => (
      POOL_BLOCK_FLAGS.includes(item) ||
      item.endsWith("_low_confidence") ||
      item === "deep_discount_review"
    ));
    return `blocked_${flag ?? "score_flag"}`;
  }
  return null;
}
