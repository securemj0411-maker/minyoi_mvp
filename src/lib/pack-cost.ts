// Wave 78: 동적 cost 공식 (UI + server 공유)
// costPerCardStep = base × profit_mult × confidence_mult × price_mult
// totalCost = ceil(requestedCards / 2) × costPerCardStep

import type { PackBand } from "@/lib/pack-open";

export const BASE_COST_BY_BAND: Record<PackBand, number> = { 1: 1, 2: 2, 3: 3 };
export const CARDS_PER_COST_STEP = 2;

export type CostFilters = {
  minProfitManwon: number;     // 슬라이더 값 (만원)
  minConfidencePct: number;    // 0~100
  priceMaxManwon: number;      // 0 = 무제한, 그 외 만원 단위
};

function profitMult(p: number): number {
  if (p >= 10) return 2.0;
  if (p >= 7) return 1.5;
  if (p >= 5) return 1.2;
  return 1.0;
}

function confMult(c: number): number {
  if (c >= 95) return 2.0;
  if (c >= 85) return 1.5;
  if (c >= 75) return 1.2;
  return 1.0;
}

function priceMult(maxManwon: number): number {
  // 0 = 무제한, 더 비싼 매물 발견 가능 → 더 비쌈
  if (maxManwon === 0) return 1.5;
  if (maxManwon > 200) return 1.5;
  if (maxManwon > 80) return 1.2;
  if (maxManwon > 30) return 1.0;
  return 0.8;
}

export type CostBreakdown = {
  base: number;
  profitMult: number;
  confidenceMult: number;
  priceMult: number;
  rawPerCardStep: number;
  perCardStep: number;
  totalCost: number;
};

export function computeCostBreakdown(
  band: PackBand,
  requestedCards: number,
  filters?: CostFilters | null,
): CostBreakdown {
  const base = BASE_COST_BY_BAND[band];
  const pm = filters ? profitMult(filters.minProfitManwon) : 1.0;
  const cm = filters ? confMult(filters.minConfidencePct) : 1.0;
  const prm = filters ? priceMult(filters.priceMaxManwon) : 1.0;
  const raw = base * pm * cm * prm;
  const perCardStep = Math.max(1, Math.round(raw));
  const steps = Math.ceil(Math.max(1, requestedCards) / CARDS_PER_COST_STEP);
  return {
    base,
    profitMult: pm,
    confidenceMult: cm,
    priceMult: prm,
    rawPerCardStep: raw,
    perCardStep,
    totalCost: steps * perCardStep,
  };
}

export function computeTokenCost(
  band: PackBand,
  requestedCards: number,
  filters?: CostFilters | null,
): number {
  return computeCostBreakdown(band, requestedCards, filters).totalCost;
}
