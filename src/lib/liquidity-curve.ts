// Wave 183 (2026-05-17): Liquidity 곡선 — 가격 위치별 회전 시간 추정.
// 사업 보고서 L6 (Retention 1순위) — "회전 기간이 떡상점수보다 retention-critical".
// "이 가격 → 평균 N시간 회전, 시세 -5% 인하 → N시간 (더 빠름)" 사용자 자본 묶임 두려움 해소.
//
// 입력: 매물 price + market basis (p25/median/p75 price) + velocity basis (p25/median/p75 hours)
// 출력: 가격 위치 + 추정 회전 시간 + "5% 인하 시" 추정 보조 정보
//
// 현재 데이터 한계: velocity 는 condition='all' 만 박힘 (price 는 condition 별).
// 매칭 약함 → 일단 가용 데이터 기반 추정. condition 별 velocity 분리는 후속 wave.

export type LiquidityCurveInput = {
  price: number | null;
  p25Price: number | null;
  medianPrice: number | null;
  p75Price: number | null;
  p25Hours: number | null;
  medianHours: number | null;
  p75Hours: number | null;
  soldSampleCount: number | null;
};

export type LiquidityPosition = "fast" | "average" | "slow" | "unknown";

export type LiquidityCurve = {
  position: LiquidityPosition;
  estimatedHours: number | null;
  estimatedHoursAt5PctDiscount: number | null;
  estimatedHoursAt5PctMarkup: number | null;
  priceRatio: number | null; // 0 = p25, 0.5 = median, 1 = p75. clamp [0, 1].
  soldSampleCount: number | null;
  // 5칸 mini-bar 위치 (0~4). 5개 bucket: very_fast/fast/avg/slow/very_slow
  bucketIndex: number;
  // confidence: 데이터 충분도 (sample count + percentile span 기반)
  confident: boolean;
};

function hasFinite(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n);
}

// 선형 interpolation — price 위치 (0~1) → hours.
// price <= p25 → p25Hours, price >= p75 → p75Hours, 중간은 linear.
function interpolateHours(input: LiquidityCurveInput, price: number): number | null {
  const { p25Price, p75Price, p25Hours, p75Hours, medianPrice, medianHours } = input;
  if (!hasFinite(price)) return null;

  // 3-point interpolation 가능 (p25 → median → p75)
  if (hasFinite(p25Price) && hasFinite(p75Price) && hasFinite(p25Hours) && hasFinite(p75Hours)) {
    if (price <= p25Price) return p25Hours;
    if (price >= p75Price) return p75Hours;

    // median 거쳐서 piecewise linear
    if (hasFinite(medianPrice) && hasFinite(medianHours)) {
      if (price <= medianPrice) {
        const t = (price - p25Price) / Math.max(1, medianPrice - p25Price);
        return p25Hours + t * (medianHours - p25Hours);
      } else {
        const t = (price - medianPrice) / Math.max(1, p75Price - medianPrice);
        return medianHours + t * (p75Hours - medianHours);
      }
    }
    // median 없으면 직접 보간
    const t = (price - p25Price) / Math.max(1, p75Price - p25Price);
    return p25Hours + t * (p75Hours - p25Hours);
  }

  // p25/p75 없으면 median fallback
  if (hasFinite(medianHours)) return medianHours;
  return null;
}

export function buildLiquidityCurve(input: LiquidityCurveInput): LiquidityCurve {
  const price = input.price ?? null;
  const estimatedHours = price != null ? interpolateHours(input, price) : input.medianHours;
  const estimatedHoursAt5PctDiscount = price != null && price > 0
    ? interpolateHours(input, Math.round(price * 0.95))
    : null;
  const estimatedHoursAt5PctMarkup = price != null && price > 0
    ? interpolateHours(input, Math.round(price * 1.05))
    : null;

  // priceRatio: 0 = p25, 0.5 = median, 1 = p75
  let priceRatio: number | null = null;
  if (hasFinite(price) && hasFinite(input.p25Price) && hasFinite(input.p75Price)) {
    const span = input.p75Price - input.p25Price;
    if (span > 0) {
      priceRatio = Math.max(0, Math.min(1, (price - input.p25Price) / span));
    }
  }

  // 5 bucket — 0 (very fast/cheap) ~ 4 (very slow/expensive)
  let bucketIndex = 2; // default avg
  if (priceRatio != null) {
    if (priceRatio <= 0.15) bucketIndex = 0;
    else if (priceRatio <= 0.40) bucketIndex = 1;
    else if (priceRatio <= 0.60) bucketIndex = 2;
    else if (priceRatio <= 0.85) bucketIndex = 3;
    else bucketIndex = 4;
  }

  const position: LiquidityPosition =
    priceRatio == null ? "unknown" :
    priceRatio < 0.33 ? "fast" :
    priceRatio < 0.67 ? "average" : "slow";

  const soldSampleCount = input.soldSampleCount ?? null;
  // sample 5건 이상 & p25/p75 둘 다 있으면 신뢰.
  const confident = (soldSampleCount ?? 0) >= 5
    && hasFinite(input.p25Hours)
    && hasFinite(input.p75Hours);

  return {
    position,
    estimatedHours,
    estimatedHoursAt5PctDiscount,
    estimatedHoursAt5PctMarkup,
    priceRatio,
    soldSampleCount,
    bucketIndex,
    confident,
  };
}

// 시간(hours) → 한국어 라벨 ("3시간" / "1.5일")
export function liquidityHoursLabel(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return "—";
  if (hours < 24) {
    const h = Math.max(1, Math.round(hours));
    return `${h}시간`;
  }
  const days = hours / 24;
  if (days < 10) {
    const roundedDays = Math.round(days * 10) / 10;
    return `${Number.isInteger(roundedDays) ? roundedDays : roundedDays.toFixed(1)}일`;
  }
  return `${Math.round(days)}일`;
}

// position → tailwind tone class
export const LIQUIDITY_POSITION_CLASS: Record<LiquidityPosition, string> = {
  fast: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
  average: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200",
  slow: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200",
  unknown: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
};

export const LIQUIDITY_POSITION_LABEL: Record<LiquidityPosition, string> = {
  fast: "빨리 팔릴 가격",
  average: "보통 속도",
  slow: "느리게 팔릴 가격",
  unknown: "판매 속도 정보 부족",
};

// 5 bucket → tailwind class (mini bar)
export const LIQUIDITY_BUCKET_CLASS: Record<number, string> = {
  0: "bg-emerald-500/90 dark:bg-emerald-500/80",
  1: "bg-emerald-400/80 dark:bg-emerald-500/60",
  2: "bg-amber-400/80 dark:bg-amber-500/70",
  3: "bg-rose-400/80 dark:bg-rose-500/70",
  4: "bg-rose-500/90 dark:bg-rose-500/80",
};
