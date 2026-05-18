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
  categories?: string[];       // empty/undefined = 전체. 비용 공식에는 반영하지 않지만 open API payload와 공유.
  maxFreshHours?: number;      // 0/undefined = 무제한. 비용 공식에는 반영하지 않지만 open API payload와 공유.
};

function profitMult(p: number): number {
  // Wave 79: 한국 부업/리셀 현실 — 1~5만이 흔함, 10만+ 희소
  if (p >= 10) return 2.5;
  if (p >= 7) return 2.0;
  if (p >= 5) return 1.5;
  if (p >= 3) return 1.2;
  if (p >= 2) return 1.1;
  return 1.0;
}

function confMult(c: number): number {
  if (c >= 95) return 2.0;
  if (c >= 85) return 1.5;
  if (c >= 75) return 1.2;
  return 1.0;
}

function priceMult(maxManwon: number): number {
  // Wave 79: 입문자/주력/공격/전업 4-tier
  // 0 = 무제한 (전업 영역, 매우 희소)
  if (maxManwon === 0) return 2.0;
  if (maxManwon > 80) return 1.5;
  if (maxManwon > 30) return 1.2;
  if (maxManwon > 15) return 1.0;
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
