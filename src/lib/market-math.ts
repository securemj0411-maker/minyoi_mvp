export type SellerPricedRow = {
  pid: number;
  price: number;
  seller_uid: string | null;
};

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
  if (values.length < 8) {
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
