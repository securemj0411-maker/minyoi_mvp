// Wave 750 (2026-05-25): 득템 점수 (Deal Score) — 통합 공식.
//
// 기존:
//   - `pack-reveal-modal.tsx::calculateDealScore` — base 50 + profit cap 30%(+40) + confidence/seller/sample 보너스.
//     문제: 차익률 27%+ 면 무조건 +40 cap. 풀은 30%+ 가 보통 → 거의 다 100점. 200% 차익이랑 30% 차익이 동점.
//   - `preview-detail/page.tsx::calcDealScore` — 완전 다른 공식 + confidence bug
//     (`confidence * 0.2` 인데 confidence 가 0~1 → 최대 +0.2. confidence 가 점수에 영향 X).
//
// 통합 공식 (max 100, 100 = unicorn 만):
//   base 30
//   + profit (max 35): linear profitPct * 0.7, cap 35 → 50% 차익 시 cap
//   + confidence (max 15): 0.9 → 15, 0.8 → 12, 0.7 → 8, 0.5 → 4
//   + samples (max 12): 50+ → 12, 30+ → 9, 15+ → 6, 7+ → 3
//   + seller (max 8): 4.9 & 10리뷰+ → 8, 4.7 & 5+ → 5, 4.5+ → 2
//
// 분포 예시:
//   typical (profit 25%, conf 0.75, sample 12, seller 4.6)   = 30 + 17.5 + 8 + 3 + 2 = 60
//   great   (profit 40%, conf 0.85, sample 25, seller 4.9)   = 30 + 28 + 12 + 6 + 5 = 81
//   amazing (profit 60%, conf 0.92, sample 40, seller 4.95)  = 30 + 35 + 15 + 9 + 8 = 97
//   unicorn (profit 80%, conf 0.95, sample 100, seller 4.99) = 30 + 35 + 15 + 12 + 8 = 100
//
// 100 점은 진짜 드물어야 함. 차익 50%+ AND conf 0.9+ AND sample 50+ AND seller 4.9+ 다 만족해야 도달.

export const SELLER_TRUST_MIN_REVIEW_COUNT = 10;

export interface DealScoreInput {
  price: number;
  expectedProfitMin: number;
  expectedProfitMax: number;
  confidence: number | null;
  sampleCount: number | null;
  sellerReviewRating: number | null;
  sellerReviewCount: number | null;
}

export interface DealScore {
  score: number; // 0~100
  label: string;
  toneClass: string;
}

function profitPercentFrom(input: DealScoreInput): number {
  if (!input.price || input.price <= 0) return 0;
  const profitAvg = (input.expectedProfitMin + input.expectedProfitMax) / 2;
  const pct = (profitAvg / input.price) * 100;
  return Number.isFinite(pct) ? pct : 0;
}

function profitScoreFrom(profitPct: number): number {
  if (profitPct <= 0) return 0;
  // 0.7 가중 + cap 35. 50% 차익 시 cap.
  return Math.min(35, profitPct * 0.7);
}

function confidenceScoreFrom(confidence: number | null): number {
  const c = confidence ?? 0;
  if (c >= 0.9) return 15;
  if (c >= 0.8) return 12;
  if (c >= 0.7) return 8;
  if (c >= 0.5) return 4;
  return 0;
}

function sampleScoreFrom(sampleCount: number | null): number {
  const n = sampleCount ?? 0;
  if (n >= 50) return 12;
  if (n >= 30) return 9;
  if (n >= 15) return 6;
  if (n >= 7) return 3;
  return 0;
}

function sellerScoreFrom(rating: number | null, reviewCount: number | null): number {
  if (rating == null) return 0;
  const reviews = reviewCount ?? 0;
  if (rating >= 4.9 && reviews >= SELLER_TRUST_MIN_REVIEW_COUNT) return 8;
  if (rating >= 4.7 && reviews >= 5) return 5;
  if (rating >= 4.5) return 2;
  return 0;
}

export function computeDealScore(input: DealScoreInput): DealScore {
  const profitPct = profitPercentFrom(input);
  const profitScore = profitScoreFrom(profitPct);
  const confScore = confidenceScoreFrom(input.confidence);
  const sampleScore = sampleScoreFrom(input.sampleCount);
  const sellerScore = sellerScoreFrom(input.sellerReviewRating, input.sellerReviewCount);

  const raw = 30 + profitScore + confScore + sampleScore + sellerScore;
  const score = Math.min(100, Math.max(0, Math.round(raw)));

  let label = "보통";
  let toneClass = "text-zinc-500 dark:text-zinc-400";
  if (score >= 90) {
    label = "최고";
    toneClass = "text-blue-700 dark:text-blue-300";
  } else if (score >= 80) {
    label = "강추";
    toneClass = "text-blue-600 dark:text-blue-400";
  } else if (score >= 70) {
    label = "좋음";
    toneClass = "text-blue-500 dark:text-blue-400";
  } else if (score >= 60) {
    label = "양호";
    toneClass = "text-zinc-600 dark:text-zinc-300";
  }
  return { score, label, toneClass };
}
