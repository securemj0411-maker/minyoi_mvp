export const BUNJANG_SOURCE_ID = "bunjang";
export const JOONGNA_SOURCE_ID = "joongna";
export const DAANGN_SOURCE_ID = "daangn";

export type KnownMarketplaceSource =
  | typeof BUNJANG_SOURCE_ID
  | typeof JOONGNA_SOURCE_ID
  | typeof DAANGN_SOURCE_ID;

export function normalizeMarketplaceSource(source: string | null | undefined): KnownMarketplaceSource {
  const value = String(source ?? "").trim().toLowerCase();
  if (value === JOONGNA_SOURCE_ID || value === "junggonara" || value === "joonggonara") return JOONGNA_SOURCE_ID;
  if (value === DAANGN_SOURCE_ID || value === "daangnmarket" || value === "danggn") return DAANGN_SOURCE_ID;
  return BUNJANG_SOURCE_ID;
}

export function marketplaceSourceLabel(source: string | null | undefined): string {
  const normalized = normalizeMarketplaceSource(source);
  if (normalized === JOONGNA_SOURCE_ID) return "중고나라";
  if (normalized === DAANGN_SOURCE_ID) return "당근마켓";
  return "번개장터";
}

export function listingUrlForSource(
  pid: number,
  rawUrl: string | null | undefined,
  source: string | null | undefined,
): string {
  const url = String(rawUrl ?? "").trim();
  if (url) return url;
  const normalized = normalizeMarketplaceSource(source);
  if (normalized === JOONGNA_SOURCE_ID) return "";
  if (normalized === DAANGN_SOURCE_ID) return "";  // 당근 매물 URL 은 raw_listings.url 에 항상 있음
  return `https://m.bunjang.co.kr/products/${pid}`;
}

export function isJoongnaMarketplaceSource(source: string | null | undefined): boolean {
  return normalizeMarketplaceSource(source) === JOONGNA_SOURCE_ID;
}

export function isDaangnMarketplaceSource(source: string | null | undefined): boolean {
  return normalizeMarketplaceSource(source) === DAANGN_SOURCE_ID;
}
