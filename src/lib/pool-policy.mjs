export const POOL_CONFIDENCE_FLOOR = 0.7;

export const POOL_BLOCK_FLAGS = [
  "coarse_market_price",
  "extreme_discount_review",
  "market_confidence_low",
  "market_stat_missing",
  "option_parse_review",
  "option_needs_review",
  "ai_review_unavailable",
  "ai_second_opinion_hold",
  "weak_description",
  "risk_keyword_review",
  "condition_review",
];

export function bandFromProfit(profitMin, profitMax) {
  const avg = Math.round((profitMin + profitMax) / 2);
  if (avg >= 70_000) return 3;
  if (avg >= 40_000) return 2;
  if (avg >= 20_000) return 1;
  return null;
}

export function poolMaxExposure(band) {
  if (band === 3) return 1;
  if (band === 2) return 2;
  return 3;
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
