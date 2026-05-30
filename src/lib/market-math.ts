export type SellerPricedRow = {
  pid: number;
  price: number;
  seller_uid: string | null;
  // Wave 129 (2026-05-16): exponential decay 가중 (사업 보고서 L5).
  // 최근 매물 weight ↑. observedAt(ISO string) 또는 ageDays(numeric) 제공.
  observedAt?: string | null;
  ageDays?: number | null;
  // Wave 135 (2026-05-16): launch event reset — 매물별 weight 추가 multiplier.
  // event_date 이전 매물은 0.3x 등. final weight = decay(ageDays) * weightMultiplier.
  // 사업 보고서 L5b — 신모델 launch 시점 옛 baseline 무시.
  weightMultiplier?: number | null;
};

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Wave 129 (2026-05-16): exponential decay weight 계산 — 사업 보고서 L5 temporal adjustment.
 * - 최근 7일 weight 3x (보고서 권장)
 * - 30일까지 부드러운 decay (반감기 ~10일)
 * - 30일+ 데이터도 살리되 weight ↓
 *
 * 공식: weight = 3 * exp(-ageDays / 10)
 *   ageDays=0  → weight 3.0
 *   ageDays=7  → weight 1.49 (~1.5x 가중)
 *   ageDays=10 → weight 1.10
 *   ageDays=20 → weight 0.41
 *   ageDays=30 → weight 0.15
 */
export function exponentialDecayWeight(ageDays: number): number {
  if (!Number.isFinite(ageDays) || ageDays < 0) return 1.0;
  return 3 * Math.exp(-ageDays / 10);
}

/**
 * 가중 중앙값 (weighted median).
 * 일반 median과 다름: weight 누적 50%에 해당하는 value.
 */
export function weightedMedian(items: Array<{ value: number; weight: number }>): number {
  if (items.length === 0) return 0;
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((sum, x) => sum + Math.max(0, x.weight), 0);
  if (totalWeight <= 0) return median(sorted.map((x) => x.value));
  const halfWeight = totalWeight / 2;
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += Math.max(0, item.weight);
    if (cumulative >= halfWeight) return item.value;
  }
  return sorted[sorted.length - 1].value;
}

/**
 * 시세 산정용 — observedAt이 있으면 decay weight 적용 + weightedMedian.
 * 없으면 일반 median (backward compatible).
 */
export function decayWeightedMedian(rows: Array<{ price: number; observedAt?: string | null; ageDays?: number | null }>): number {
  const now = Date.now();
  const items: Array<{ value: number; weight: number }> = [];
  for (const row of rows) {
    if (!Number.isFinite(row.price)) continue;
    let ageDays: number | null = null;
    if (row.ageDays != null && Number.isFinite(row.ageDays)) {
      ageDays = row.ageDays;
    } else if (row.observedAt) {
      const t = new Date(row.observedAt).getTime();
      if (Number.isFinite(t)) ageDays = (now - t) / 86_400_000;
    }
    const weight = ageDays != null ? exponentialDecayWeight(ageDays) : 1.0;
    items.push({ value: row.price, weight });
  }
  return weightedMedian(items);
}

export function quantile(values: number[], q: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next == null ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

export function sellerRepresentativePrices(rows: SellerPricedRow[]) {
  const bySeller = new Map<string, number[]>();
  for (const row of rows) {
    const sellerKey = row.seller_uid?.trim() ? `seller:${row.seller_uid.trim()}` : `pid:${row.pid}`;
    const prices = bySeller.get(sellerKey) ?? [];
    prices.push(row.price);
    bySeller.set(sellerKey, prices);
  }
  return [...bySeller.values()].map((prices) => Math.round(median(prices)));
}

export function madTrim(values: number[]) {
  // Wave 90 (2026-05-15): threshold 8 → 5. 사용자 코멘트로 발견 (pid 398109917 iPad mini,
  // 407677847 Apple Watch Series 9): 매물 7건 이하인 SKU는 outlier trim 안 됨 →
  // 어그로 매물 (₩410만 등) 시세 평균 왜곡. 5건이면 통계적으로 madTrim 의미 있음.
  // Wave 798c (2026-05-30): Wave 798b 변경 revert. owner 가 짚음 — Wave 90 결정을
  //   뒤집은 거고 통계 표준 위반 + 50% cutoff 안전장치 제거는 다른 SKU 시세 망칠 risk.
  //   barbour outlier case 는 catalog 차원 문제 (Wave 798a) 이지 통계 outlier 아님.
  if (values.length < 5) {
    return { values, medianValue: median(values), mad: 0, removed: 0 };
  }
  const medianValue = median(values);
  const deviations = values.map((value) => Math.abs(value - medianValue));
  const mad = median(deviations);
  if (mad <= 0) {
    return { values, medianValue, mad, removed: 0 };
  }
  const threshold = 3 * 1.4826 * mad;
  const trimmed = values.filter((value) => Math.abs(value - medianValue) <= threshold);
  if (trimmed.length < Math.max(5, Math.ceil(values.length * 0.5))) {
    return { values, medianValue, mad, removed: 0 };
  }
  return { values: trimmed, medianValue, mad, removed: values.length - trimmed.length };
}

export function trimmedSellerMarket(rows: SellerPricedRow[]) {
  const representativePrices = sellerRepresentativePrices(rows);
  const trimmed = madTrim(representativePrices);
  const values = trimmed.values;
  return {
    values,
    count: values.length,
    median: values.length > 0 ? Math.round(median(values)) : null,
    p25: values.length > 0 ? Math.round(quantile(values, 0.25)) : null,
    p75: values.length > 0 ? Math.round(quantile(values, 0.75)) : null,
  };
}

/**
 * Wave 131 (2026-05-16): exponential decay weight를 시세 산정에 wire-up — 사업 보고서 L5 temporal.
 * Wave 129에서 decayWeightedMedian 함수만 작성했고, 이번 wave에서 trimmedSellerMarket 산정 로직에 박음.
 *
 * 차이점 (vs trimmedSellerMarket):
 * - seller 대표 매물: 가장 최근 observedAt의 매물 선택 (옛 호가는 제외)
 * - 최종 median: 일반 median 대신 weightedMedian (weight = exponentialDecayWeight(ageDays))
 * - p25/p75: weighted (weight 누적 25%/75% 기준)
 * - madTrim 동일 (outlier 제거)
 *
 * 사업 가치: 옛 호가 (30일+ 매물 = 안 팔리는 매물 = 호가 inflated) weight ↓.
 * 최근 7일 매물 weight 3x → 시세가 최근 거래 트렌드 반영.
 */
type SellerRepresentative = {
  price: number;
  ageDays: number | null;
  // Wave 135: launch event multiplier carry-through.
  weightMultiplier: number;
};

function sellerRepresentativesWithAge(rows: SellerPricedRow[]): SellerRepresentative[] {
  const now = Date.now();
  const bySeller = new Map<string, SellerRepresentative[]>();
  for (const row of rows) {
    const sellerKey = row.seller_uid?.trim()
      ? `seller:${row.seller_uid.trim()}`
      : `pid:${row.pid}`;
    let ageDays: number | null = null;
    if (row.ageDays != null && Number.isFinite(row.ageDays)) {
      ageDays = Math.max(0, row.ageDays);
    } else if (row.observedAt) {
      const t = new Date(row.observedAt).getTime();
      if (Number.isFinite(t)) ageDays = Math.max(0, (now - t) / 86_400_000);
    }
    const wm = row.weightMultiplier != null && Number.isFinite(row.weightMultiplier)
      ? Math.max(0, Math.min(1, row.weightMultiplier))
      : 1;
    const list = bySeller.get(sellerKey) ?? [];
    list.push({ price: row.price, ageDays, weightMultiplier: wm });
    bySeller.set(sellerKey, list);
  }
  // 각 seller당 1개 대표: 가장 최근 매물 (ageDays가 작은 거). ageDays 없으면 가격 median.
  return [...bySeller.values()].map((items) => {
    const withAge = items.filter((x) => x.ageDays != null);
    if (withAge.length === 0) {
      // 옛 동작 fallback: ageDays 없으면 가격 median + ageDays null + 평균 multiplier
      const avgWm = items.reduce((s, x) => s + x.weightMultiplier, 0) / Math.max(1, items.length);
      return { price: Math.round(median(items.map((x) => x.price))), ageDays: null, weightMultiplier: avgWm };
    }
    withAge.sort((a, b) => (a.ageDays ?? Infinity) - (b.ageDays ?? Infinity));
    return withAge[0]; // 가장 최근 매물 (그 매물의 weightMultiplier 사용)
  });
}

function weightedQuantile(items: Array<{ value: number; weight: number }>, q: number): number {
  if (items.length === 0) return 0;
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((s, x) => s + Math.max(0, x.weight), 0);
  if (total <= 0) return quantile(sorted.map((x) => x.value), q);
  const target = total * q;
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += Math.max(0, item.weight);
    if (cumulative >= target) return item.value;
  }
  return sorted[sorted.length - 1].value;
}

export function decayTrimmedSellerMarket(rows: SellerPricedRow[]) {
  const representatives = sellerRepresentativesWithAge(rows);
  // outlier 제거 — 가격 기반 madTrim (옛 동작 그대로 outlier 보호)
  const prices = representatives.map((r) => r.price);
  const trimmedPrices = madTrim(prices);
  const allowedSet = new Set<number>();
  // madTrim이 values 그대로 return하면 모두 통과. trim된 경우 removed > 0.
  // 단순 처리: trimmedPrices.values를 multiset으로. 중복 가격 처리 위해 카운트.
  const priceCount = new Map<number, number>();
  for (const v of trimmedPrices.values) priceCount.set(v, (priceCount.get(v) ?? 0) + 1);
  const allowedItems: Array<{ value: number; weight: number }> = [];
  for (const rep of representatives) {
    const remaining = priceCount.get(rep.price) ?? 0;
    if (remaining > 0) {
      priceCount.set(rep.price, remaining - 1);
      const decayWeight = rep.ageDays != null ? exponentialDecayWeight(rep.ageDays) : 1.0;
      // Wave 135: launch event multiplier 적용. final weight = decay × multiplier.
      const weight = decayWeight * rep.weightMultiplier;
      allowedItems.push({ value: rep.price, weight });
      allowedSet.add(rep.price);
    }
  }
  const values = allowedItems.map((x) => x.value);
  return {
    values,
    count: values.length,
    median:
      values.length > 0 ? Math.round(weightedMedian(allowedItems)) : null,
    p25: values.length > 0 ? Math.round(weightedQuantile(allowedItems, 0.25)) : null,
    p75: values.length > 0 ? Math.round(weightedQuantile(allowedItems, 0.75)) : null,
  };
}

export function percentileRank(values: number[], value: number) {
  if (values.length <= 1) return 0.5;
  const belowOrEqual = values.filter((v) => v <= value).length;
  return Math.max(0, Math.min(1, (belowOrEqual - 1) / (values.length - 1)));
}
