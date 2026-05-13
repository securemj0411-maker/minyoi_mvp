import {
  evaluateCategoryReadiness,
  evaluateLaneReadinessForSku,
  LANE_READINESS,
  type CategoryReadinessDecision,
  type CategoryReadinessMap,
  type LaneReadinessMap,
} from "@/lib/category-readiness";
import type { Sku } from "@/lib/catalog";
import {
  bandFromProfit,
  computePoolConfidence,
  poolMaxExposure,
  poolSkipReason,
} from "@/lib/pool-policy.mjs";
import { RESELL_SHIPPING_FEE, SAFETY_BUFFER, SELLING_FEE_RATE } from "@/lib/profit";

export type PoolCandidateInput = {
  pid: number | string;
  price: number;
  skuMedian: number;
  estimatedBuyCost: number;
  shippingFee: number;
  shippingFeeGeneral: number | null;
  riskHits: number;
  thumbnailUrl?: string | null;
  poolEligible?: boolean | null;
  skuId: string | null;
  score: number;
  scoreFlags: string[];
  saleStatus?: string | null;
};

export type PoolParsedInput = {
  category: Sku["category"] | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
};

export type CandidatePoolBuildResult = {
  entries: Record<string, unknown>[];
  invalidations: { pid: number; reason: string }[];
  skipped: number;
};

// Lane-aware pool gate. A SKU tagged with a `ready` laneKey enters the pool
// even when its broader category is `internal_only`. SKUs without a lane (or
// whose lane is itself blocked) fall back to the category gate.
export function evaluatePoolGate(
  input: { sku?: Sku | null; category: Sku["category"] | null },
  maps: { categoryReadiness?: CategoryReadinessMap; laneReadiness?: LaneReadinessMap } = {},
): CategoryReadinessDecision {
  const laneMap = maps.laneReadiness ?? LANE_READINESS;
  const laneDecision = evaluateLaneReadinessForSku(input.sku ?? undefined, laneMap);
  if (laneDecision && laneDecision.status === "ready") return laneDecision;

  const categoryDecision = evaluateCategoryReadiness(input.category, maps.categoryReadiness);

  // Lane exists but is blocked → surface the lane reason instead of silently
  // falling through to category readiness (which might be `ready`).
  if (laneDecision && laneDecision.status !== "ready") {
    return {
      ...categoryDecision,
      status: "blocked",
      canEnterPool: false,
      reason: laneDecision.reason,
      laneKey: laneDecision.laneKey,
    };
  }
  return categoryDecision;
}

export function buildCandidatePoolRows(input: {
  rows: PoolCandidateInput[];
  parsedByPid: Map<number, PoolParsedInput>;
  catalogById: Map<string, Sku>;
  categoryReadiness: CategoryReadinessMap;
  laneReadiness?: LaneReadinessMap;
  now: string;
}): CandidatePoolBuildResult {
  const entries: Record<string, unknown>[] = [];
  const invalidations: { pid: number; reason: string }[] = [];
  let skipped = 0;

  for (const row of input.rows) {
    const pid = Number(row.pid);
    if (row.poolEligible === false) {
      skipped += 1;
      invalidations.push({ pid, reason: "pool_eligible_false" });
      continue;
    }

    const sellFee = Math.round(row.skuMedian * SELLING_FEE_RATE);
    const buyMax = row.price + (row.shippingFeeGeneral ?? row.shippingFee);
    const buyMin = row.estimatedBuyCost;
    const profitMax = Math.max(0, row.skuMedian - buyMin - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
    const profitMin = Math.max(0, row.skuMedian - buyMax - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
    const band = bandFromProfit(profitMin, profitMax);
    if (band === null) {
      skipped += 1;
      invalidations.push({ pid, reason: "profit_below_pack_band" });
      continue;
    }

    const parsed = input.parsedByPid.get(pid);
    const sku = input.catalogById.get(row.skuId ?? "");
    const category = parsed?.category ?? sku?.category ?? null;
    const readiness = evaluatePoolGate(
      { sku, category },
      { categoryReadiness: input.categoryReadiness, laneReadiness: input.laneReadiness },
    );
    const confidence = computePoolConfidence(Number(parsed?.parse_confidence ?? 0.5), row.scoreFlags);
    const comparableKey = parsed?.comparable_key ?? null;
    const skipReason = poolSkipReason({
      profitMin,
      price: row.price,
      saleStatus: row.saleStatus,
      skuMedian: row.skuMedian,
      riskHits: row.riskHits,
      thumbnailUrl: row.thumbnailUrl,
      categoryCanEnterPool: readiness.canEnterPool,
      categoryReason: readiness.reason,
      comparableKey,
      needsReview: Boolean(parsed?.needs_review),
      confidence,
      scoreFlags: row.scoreFlags,
    });

    if (skipReason) {
      skipped += 1;
      invalidations.push({ pid, reason: skipReason });
      continue;
    }

    entries.push({
      pid,
      profit_band: band,
      category,
      expected_profit_min: profitMin,
      expected_profit_max: profitMax,
      score: row.score,
      confidence,
      comparable_key: comparableKey,
      max_exposure: poolMaxExposure(band),
      last_verified_at: input.now,
      updated_at: input.now,
    });
  }

  return { entries, invalidations, skipped };
}
