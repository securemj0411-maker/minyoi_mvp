export const BUNJANG_SOURCE_ID = "bunjang";
export const JOONGNA_SOURCE_ID = "joongna";

export type KnownMarketplaceSource = typeof BUNJANG_SOURCE_ID | typeof JOONGNA_SOURCE_ID;

export function normalizeMarketplaceSource(source: string | null | undefined): KnownMarketplaceSource {
  const value = String(source ?? "").trim().toLowerCase();
  if (value === JOONGNA_SOURCE_ID || value === "junggonara" || value === "joonggonara") return JOONGNA_SOURCE_ID;
  return BUNJANG_SOURCE_ID;
}

export function marketplaceSourceLabel(source: string | null | undefined): string {
  return normalizeMarketplaceSource(source) === JOONGNA_SOURCE_ID ? "중고나라" : "번개장터";
}

export function listingUrlForSource(
  pid: number,
  rawUrl: string | null | undefined,
  source: string | null | undefined,
): string {
  const url = String(rawUrl ?? "").trim();
  if (url) return url;
  if (normalizeMarketplaceSource(source) === JOONGNA_SOURCE_ID) return "";
  return `https://m.bunjang.co.kr/products/${pid}`;
}

export function isJoongnaMarketplaceSource(source: string | null | undefined): boolean {
  return normalizeMarketplaceSource(source) === JOONGNA_SOURCE_ID;
}
