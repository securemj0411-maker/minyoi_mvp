// Wave 181 (2026-05-17): broader market key fallback.
//
// 풀 부족 진단 결과 (laptop 384 narrow lane 중 시세 trusted 4개 = 1%): narrow
// comparable_key (RAM/SSD/screen/storage 다 포함) 별 시세 표본 거의 0.
//
// 정확성 손해 없이 풀 늘리려면: narrow 시세 없을 때 broader key (RAM/SSD 등 narrow
// segment 제거) 단위 median fallback. 단 사용자한테 "계산된 시세" UI 표시로 정직히 알림.
//
// comparable_key 구조 (카테고리별 다름):
//   macbook|macbook_pro|2023y|m3|14in|16gb_ram|512gb_ssd
//   iphone|iphone_15_pro|256gb
//   ipad|ipad_pro|12_9in|256gb|cellular
//   shoe|gazelle_og_broad|260|unknown_condition
//
// broader chain 전략: 마지막 segment부터 trim. 가장 narrow한 옵션 (보통 storage/RAM/SSD/
// connectivity/condition)이 먼저 빠짐. 그 다음 size/year 등.

/**
 * Given a narrow comparable_key, generate a chain of progressively broader keys.
 * Returns [narrow, ...broader] — narrow first, then broader by removing trailing segments.
 *
 * Example:
 *   "macbook|macbook_pro|2023y|m3|14in|16gb_ram|512gb_ssd"
 *   → [
 *       "macbook|macbook_pro|2023y|m3|14in|16gb_ram|512gb_ssd",  // narrow
 *       "macbook|macbook_pro|2023y|m3|14in|16gb_ram",            // -ssd
 *       "macbook|macbook_pro|2023y|m3|14in",                     // -ram
 *       "macbook|macbook_pro|2023y|m3",                          // -screen
 *       "macbook|macbook_pro|2023y",                             // -chip
 *       "macbook|macbook_pro",                                   // -year
 *     ]
 *
 * Minimum segments preserved: 2 (family + model). 더 broader 가면 카테고리 자체 mixed.
 */
export function broaderMarketKeyChain(comparableKey: string): string[] {
  if (!comparableKey || typeof comparableKey !== "string") return [];
  const segments = comparableKey.split("|").filter(Boolean);
  if (segments.length <= 2) return [comparableKey];
  const chain: string[] = [comparableKey];
  // Trim trailing segments one at a time, preserving at least family + model (first 2 segments).
  for (let endIdx = segments.length - 1; endIdx >= 2; endIdx -= 1) {
    const broaderKey = segments.slice(0, endIdx).join("|");
    if (broaderKey && broaderKey !== chain[chain.length - 1]) {
      chain.push(broaderKey);
    }
  }
  return chain;
}

/**
 * Pick the first broader key with sufficient sample size.
 *
 * @returns { key, prices, broader: boolean } — broader=true if fell back from narrow.
 *          prices=[] if no key has enough samples.
 */
export function pickPricesByBroaderChain(
  comparableKey: string,
  pricesByKey: Map<string, number[]>,
  threshold: number,
): { key: string; prices: number[]; broader: boolean } {
  const chain = broaderMarketKeyChain(comparableKey);
  if (chain.length === 0) return { key: comparableKey, prices: [], broader: false };

  // 1) Try narrow first (no broader flag).
  const narrowPrices = pricesByKey.get(chain[0]) ?? [];
  if (narrowPrices.length >= threshold) {
    return { key: chain[0], prices: narrowPrices, broader: false };
  }

  // 2) Try broader keys in chain order. First key with >= threshold wins.
  let bestFallback: { key: string; prices: number[] } | null = null;
  for (let i = 1; i < chain.length; i += 1) {
    const candidate = pricesByKey.get(chain[i]) ?? [];
    if (candidate.length >= threshold) {
      return { key: chain[i], prices: candidate, broader: true };
    }
    if (!bestFallback || candidate.length > bestFallback.prices.length) {
      bestFallback = { key: chain[i], prices: candidate };
    }
  }

  // 3) Nothing met threshold. Return best available (narrow if longest, else best broader).
  if (narrowPrices.length >= (bestFallback?.prices.length ?? 0)) {
    return { key: chain[0], prices: narrowPrices, broader: false };
  }
  return {
    key: bestFallback?.key ?? chain[0],
    prices: bestFallback?.prices ?? [],
    broader: bestFallback != null,
  };
}
