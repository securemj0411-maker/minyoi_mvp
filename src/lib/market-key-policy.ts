export const MARKET_BLOCKED_COMPARABLE_KEY_PREFIXES = [
  // Wave 1080: golf club family lanes. These mix generations, loft/shaft axes,
  // single clubs vs sets, head-only rows, and broad brand club types.
  "sport_golf|odyssey_putter",
  "sport_golf|vokey_sm_wedge",
  "sport_golf|taylormade_iron_set",
  "sport_golf|taylormade_driver",
  "sport_golf|taylormade_wedge",
  "sport_golf|taylormade_hybrid",
  "sport_golf|callaway_driver",
  "sport_golf|callaway_wedge",
  "sport_golf|callaway_hybrid",
  "sport_golf|골프_풀세트",
  "sport_golf|mizuno_mx_골프",
  "sport_golf|mizuno_jpx_골프_아이언",
  "sport_golf|mizuno_iron_set",
  "sport_golf|srixon_driver",
  "titleist|titleist_iron_set",

  // Wave 1081: clothing family lanes. These are useful recall scaffolding but
  // too broad for public market samples until split by garment/subline.
  "clothing|polo_pony_tee",
  "clothing|polo_shirt_pattern",
  "clothing|polo_knit_sweater",
  "clothing|adidas_trefoil",
  "clothing|patagonia",
  "clothing|mlb_cap",
] as const;

export function isMarketBlockedComparableKey(comparableKey: string | null | undefined): boolean {
  const key = (comparableKey ?? "").trim();
  if (!key) return false;
  return MARKET_BLOCKED_COMPARABLE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}
