import {
  evaluateCategoryReadiness,
  type CategoryReadinessMap,
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

export function buildCandidatePoolRows(input: {
  rows: PoolCandidateInput[];
  parsedByPid: Map<number, PoolParsedInput>;
  catalogById: Map<string, Sku>;
  categoryReadiness: CategoryReadinessMap;
  now: string;
}): CandidatePoolBuildResult {
  const entries: Record<string, unknown>[] = [];
  const invalidations: { pid: number; reason: string }[] = [];
  let skipped = 0;

  for (const row of input.rows) {
    const sellFee = Math.round(row.skuMedian * SELLING_FEE_RATE);
    const buyMax = row.price + (row.shippingFeeGeneral ?? row.shippingFee);
    const buyMin = row.estimatedBuyCost;
    const profitMax = Math.max(0, row.skuMedian - buyMin - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
    const profitMin = Math.max(0, row.skuMedian - buyMax - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
    const band = bandFromProfit(profitMin, profitMax);
    const pid = Number(row.pid);

    if (band === null) {
      skipped += 1;
      invalidations.push({ pid, reason: "profit_below_pack_band" });
      continue;
    }

    const parsed = input.parsedByPid.get(pid);
    const sku = input.catalogById.get(row.skuId ?? "");
    const category = parsed?.category ?? sku?.category ?? null;
    const readiness = evaluateCategoryReadiness(category, input.categoryReadiness);
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
