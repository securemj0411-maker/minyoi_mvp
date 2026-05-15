export type SellerPricedRow = {
  pid: number;
  price: number;
  seller_uid: string | null;
  // Wave 129 (2026-05-16): exponential decay 가중 (사업 보고서 L5).
  // 최근 매물 weight ↑. observedAt(ISO string) 또는 ageDays(numeric) 제공.
  observedAt?: string | null;
  ageDays?: number | null;
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

export function percentileRank(values: number[], value: number) {
  if (values.length <= 1) return 0.5;
  const belowOrEqual = values.filter((v) => v <= value).length;
  return Math.max(0, Math.min(1, (belowOrEqual - 1) / (values.length - 1)));
}
