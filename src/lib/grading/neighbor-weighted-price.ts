// Wave 714 (2026-05-23): tier sample 부족 시 인접 tier 가중평균 시세.
//
// 사용자 요구: "무족건 같은 sample아니고 가중치로 특정 상태와 가까운 상태의 시세도 가중치"
//
// 단순화 공식:
//   final_price(tier_X) = α × median_X + (1 - α) × weighted_neighbor_avg
//   α = min(1, n_X / N_THRESHOLD)
//   weighted_neighbor_avg = Σ (w_i × median_i) / Σ w_i
//   w_i = 1 / (tier_distance + 1)
//
// 보수적:
//   - upward fallback 차단 (default) — D 매물에 S 시세 fallback 금지. 시세 부풀림 방지.
//   - UNKNOWN tier 는 baseline median × 0.85 (false positive 방지).

import { TIER_LADDER, TIER_WEIGHT } from "./types";
import type { ConditionTier } from "./types";

const N_THRESHOLD = 6;

export interface TierSample {
  median: number;
  count: number;
}

export interface WeightedPriceOptions {
  nThreshold?: number;
  allowUpwardFallback?: boolean;
}

export interface WeightedPriceResult {
  price: number | null;
  alpha: number;
  fallbackUsed: boolean;
  contributions: Array<{ tier: ConditionTier; weight: number; median: number }>;
}

export function weightedNeighborPrice(
  targetTier: ConditionTier,
  samples: Map<ConditionTier, TierSample>,
  options: WeightedPriceOptions = {},
): WeightedPriceResult {
  const nThreshold = options.nThreshold ?? N_THRESHOLD;
  const allowUpward = options.allowUpwardFallback ?? false;

  if (targetTier === "UNKNOWN") {
    const entries: Array<[ConditionTier, TierSample]> = [];
    samples.forEach((s, t) => {
      if (s.count > 0) entries.push([t, s]);
    });
    if (entries.length === 0) {
      return { price: null, alpha: 0, fallbackUsed: false, contributions: [] };
    }
    const totalCount = entries.reduce((sum, [, s]) => sum + s.count, 0);
    const weightedAvg = entries.reduce((sum, [, s]) => sum + s.median * s.count, 0) / totalCount;
    return {
      price: Math.round(weightedAvg * TIER_WEIGHT.UNKNOWN),
      alpha: 0,
      fallbackUsed: true,
      contributions: entries.map(([tier, s]) => ({ tier, weight: 1, median: s.median })),
    };
  }

  const targetIdx = TIER_LADDER.indexOf(targetTier);
  if (targetIdx < 0) {
    return { price: null, alpha: 0, fallbackUsed: false, contributions: [] };
  }

  const own = samples.get(targetTier);
  const ownCount = own?.count ?? 0;
  const ownMedian = own?.median ?? null;
  const alpha = Math.min(1, ownCount / nThreshold);

  const contributions: WeightedPriceResult["contributions"] = [];
  for (let i = 0; i < TIER_LADDER.length; i++) {
    if (i === targetIdx) continue;
    if (!allowUpward && i < targetIdx) continue;
    const tier = TIER_LADDER[i];
    const s = samples.get(tier);
    if (!s || s.count === 0) continue;
    const distance = Math.abs(i - targetIdx);
    contributions.push({ tier, weight: 1 / (distance + 1), median: s.median });
  }

  if (ownCount > 0 && ownMedian !== null) {
    contributions.unshift({ tier: targetTier, weight: alpha, median: ownMedian });
  }

  if (contributions.length === 0) {
    return { price: null, alpha, fallbackUsed: false, contributions: [] };
  }

  if (alpha >= 1 && ownMedian !== null) {
    return {
      price: Math.round(ownMedian),
      alpha: 1,
      fallbackUsed: false,
      contributions: [{ tier: targetTier, weight: 1, median: ownMedian }],
    };
  }

  const neighborContribs = contributions.filter((c) => c.tier !== targetTier);
  if (neighborContribs.length === 0 && ownMedian !== null) {
    return {
      price: Math.round(ownMedian),
      alpha: 1,
      fallbackUsed: false,
      contributions: [{ tier: targetTier, weight: 1, median: ownMedian }],
    };
  }

  const neighborWeightSum = neighborContribs.reduce((s, c) => s + c.weight, 0);
  const neighborAvg =
    neighborWeightSum > 0
      ? neighborContribs.reduce((s, c) => s + c.weight * c.median, 0) / neighborWeightSum
      : 0;

  let finalPrice: number;
  if (ownMedian !== null && alpha > 0) {
    finalPrice = alpha * ownMedian + (1 - alpha) * neighborAvg;
  } else {
    finalPrice = neighborAvg;
  }

  return {
    price: Math.round(finalPrice),
    alpha,
    fallbackUsed: alpha < 1 || ownMedian === null,
    contributions,
  };
}
