const FIRST_LEVEL_SHORT: Record<string, string> = {
  서울특별시: "서울",
  경기도: "경기",
  인천광역시: "인천",
  부산광역시: "부산",
  대구광역시: "대구",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  강원특별자치도: "강원",
  강원도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전라북도: "전북",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};

const FIRST_LEVELS = new Set(Object.keys(FIRST_LEVEL_SHORT));
const METRO_FIRST_LEVELS = new Set([
  "서울특별시",
  "인천광역시",
  "부산광역시",
  "대구광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
]);

function looksLikeLocalToken(token: string) {
  return /[가-힣]+(?:동|읍|면|리|가)$/u.test(token);
}

function scoreLocationPart(part: string) {
  const tokens = part.split(/\s+/).filter(Boolean);
  let score = tokens.length;
  if (tokens.some((token) => FIRST_LEVELS.has(token))) score += 4;
  if (tokens.some((token) => /[가-힣]+(?:시|군|구)$/u.test(token))) score += 2;
  if (tokens.some(looksLikeLocalToken)) score += 2;
  return score;
}

export function compactTradeLocationLabel(location: string | null | undefined): string | null {
  const cleaned = String(location ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const parts = cleaned
    .split(/\s*[·,]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const primary = parts.sort((a, b) => scoreLocationPart(b) - scoreLocationPart(a))[0] ?? cleaned;
  const tokens = primary.split(/\s+/).filter(Boolean);
  if (tokens.length <= 2) return primary;

  const firstLevel = FIRST_LEVELS.has(tokens[0]) ? tokens[0] : null;
  if (!firstLevel) {
    const localIndex = tokens.findLastIndex(looksLikeLocalToken);
    if (localIndex > 0) return tokens.slice(Math.max(0, localIndex - 1), localIndex + 1).join(" ");
    return tokens.slice(-2).join(" ");
  }

  const rest = tokens.slice(1);
  if (METRO_FIRST_LEVELS.has(firstLevel)) {
    return rest.slice(-2).join(" ");
  }

  if (rest.length >= 3) return rest.slice(-3).join(" ");
  return rest.join(" ");
}

export function daangnFeedLocationLabel(input: {
  directTradeLocation?: string | null;
  distanceLabel?: string | null;
}) {
  const compactLocation = compactTradeLocationLabel(input.directTradeLocation);
  const distance = input.distanceLabel?.match(/약\s*\d+(?:\.\d+)?km/u)?.[0] ?? null;
  if (compactLocation && distance) return `${compactLocation} · ${distance}`;
  return compactLocation ?? input.distanceLabel ?? null;
}
