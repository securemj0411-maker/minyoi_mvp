import { createHash } from "node:crypto";

import type { Sku } from "@/lib/catalog";

export type ParsedListingOptions = {
  parserVersion: string;
  contentHash: string;
  category: Sku["category"] | null;
  family: string | null;
  model: string | null;
  variantKey: string | null;
  comparableKey: string | null;
  storageGb: number | null;
  ramGb: number | null;
  ssdGb: number | null;
  screenSizeIn: number | null;
  chip: string | null;
  releaseYear: number | null;
  batteryHealth: number | null;
  batteryCycles: number | null;
  carrier: string | null;
  connectivity: string | null;
  conditionScore: number;
  conditionNotes: string[];
  parseConfidence: number;
  needsReview: boolean;
  parsedJson: Record<string, unknown>;
};

type ParseInput = {
  title: string;
  description?: string;
  skuId?: string | null;
  skuName?: string | null;
  category?: Sku["category"] | null;
};

const PARSER_VERSION = "option-parser-v32";

const APPLE_LAPTOP_MODEL_HINTS: Record<string, { screenSizeIn?: number; chip?: string; releaseYear?: number }> = {
  a1278: { screenSizeIn: 13, chip: "intel" },
  a1286: { screenSizeIn: 15, chip: "intel" },
  a1297: { screenSizeIn: 17, chip: "intel" },
  a1369: { screenSizeIn: 13, chip: "intel" },
  a1370: { screenSizeIn: 11, chip: "intel" },
  a1398: { screenSizeIn: 15, chip: "intel" },
  a1465: { screenSizeIn: 11, chip: "intel" },
  a1466: { screenSizeIn: 13, chip: "intel" },
  a1502: { screenSizeIn: 13, chip: "intel" },
  a1534: { screenSizeIn: 12, chip: "intel" },
  a1706: { screenSizeIn: 13, chip: "intel" },
  a1707: { screenSizeIn: 15, chip: "intel" },
  a1708: { screenSizeIn: 13, chip: "intel" },
  a1932: { screenSizeIn: 13, chip: "intel" },
  a1989: { screenSizeIn: 13, chip: "intel" },
  a1990: { screenSizeIn: 15, chip: "intel" },
  a2141: { screenSizeIn: 16, chip: "intel", releaseYear: 2019 },
  a2159: { screenSizeIn: 13, chip: "intel", releaseYear: 2019 },
  a2179: { screenSizeIn: 13, chip: "intel", releaseYear: 2020 },
  a2251: { screenSizeIn: 13, chip: "intel", releaseYear: 2020 },
  a2289: { screenSizeIn: 13, chip: "intel", releaseYear: 2020 },
  a2337: { screenSizeIn: 13, chip: "m1", releaseYear: 2020 },
  a2338: { screenSizeIn: 13, chip: "m1", releaseYear: 2020 },
  a2442: { screenSizeIn: 14, releaseYear: 2021 },
  a2485: { screenSizeIn: 16, releaseYear: 2021 },
  a2681: { screenSizeIn: 13, chip: "m2", releaseYear: 2022 },
  a2686: { screenSizeIn: 13, chip: "m2", releaseYear: 2022 },
  a2779: { screenSizeIn: 14, releaseYear: 2023 },
  a2780: { screenSizeIn: 16, releaseYear: 2023 },
  a2918: { screenSizeIn: 13, chip: "m3", releaseYear: 2024 },
  a2991: { screenSizeIn: 14, releaseYear: 2023 },
  a2992: { screenSizeIn: 16, releaseYear: 2023 },
  a3113: { screenSizeIn: 13, chip: "m3", releaseYear: 2024 },
};

const LG_GRAM_MODEL_HINTS: Record<string, { screenSizeIn?: number; releaseYear?: number }> = {
  "17z90s": { screenSizeIn: 17, releaseYear: 2024 },
  "17zd90s": { screenSizeIn: 17, releaseYear: 2024 },
  "17zd90su": { screenSizeIn: 17, releaseYear: 2024 },
};

const MONITOR_MODEL_HINTS: Record<string, {
  screenSizeIn?: number;
  monitorResolution?: string;
  monitorRefreshRate?: number;
  monitorPanelType?: string;
  monitorShape?: string;
}> = {
  "24gl600f": { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 144, monitorPanelType: "tn" },
  "27gl650f": { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 144, monitorPanelType: "ips" },
  "27gp850": { screenSizeIn: 27, monitorResolution: "qhd", monitorRefreshRate: 165, monitorPanelType: "ips" },
  "27gs85q": { screenSizeIn: 27, monitorResolution: "qhd", monitorRefreshRate: 180, monitorPanelType: "ips" },
  "27ml600sw": { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 75, monitorPanelType: "ips" },
  "27mp37vq": { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 60, monitorPanelType: "ips" },
  "27up850n": { screenSizeIn: 27, monitorResolution: "uhd_4k", monitorRefreshRate: 60, monitorPanelType: "ips" },
  "27us550": { screenSizeIn: 27, monitorResolution: "uhd_4k", monitorRefreshRate: 60, monitorPanelType: "ips" },
  "32m2n8800": { screenSizeIn: 32, monitorResolution: "uhd_4k", monitorRefreshRate: 240, monitorPanelType: "oled" },
  "34gs95qe": { screenSizeIn: 34, monitorResolution: "wqhd", monitorRefreshRate: 240, monitorPanelType: "oled" },
  "39gx900a": { screenSizeIn: 39, monitorResolution: "wqhd", monitorRefreshRate: 240, monitorPanelType: "oled", monitorShape: "curved_ultrawide" },
  "247fm100": { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 100 },
  aw2525hm: { screenSizeIn: 25, monitorResolution: "fhd", monitorRefreshRate: 320, monitorPanelType: "ips" },
  bg27fm3: { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 240, monitorPanelType: "tn" },
  ls27f354fhk: { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 60, monitorPanelType: "pls" },
  mb27f165: { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 165 },
  odyssey_g4: { monitorResolution: "fhd", monitorRefreshRate: 240, monitorPanelType: "ips" },
  odyssey_g5: { monitorResolution: "qhd", monitorRefreshRate: 165 },
  pg248qp: { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 540, monitorPanelType: "tn" },
  pg27aqdp: { screenSizeIn: 27, monitorResolution: "qhd", monitorRefreshRate: 480, monitorPanelType: "oled" },
  x24f165: { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 165 },
  xg2401: { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 144 },
  xg27acdms: { screenSizeIn: 27, monitorResolution: "qhd", monitorRefreshRate: 280, monitorPanelType: "oled" },
  xl2411: { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 144, monitorPanelType: "tn" },
  xl2411k: { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 144, monitorPanelType: "tn" },
  xl2540k: { screenSizeIn: 24.5, monitorResolution: "fhd", monitorRefreshRate: 240, monitorPanelType: "tn" },
  xl2540x: { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 280, monitorPanelType: "tn" },
  xl2720: { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 144 },
  xl2720z: { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 144 },
};

const MONITOR_CM_SIZE_HINTS: Record<number, number> = {
  48: 19,
  51: 20,
  54: 21.5,
  56: 22,
  58: 24,
  59: 24,
  61: 24,
  68: 27,
  69: 27,
  71: 28,
  80: 32,
  81: 32,
  86: 34,
  95: 38,
  99: 39,
  124: 49,
};

function parseAppleLaptopModelNumber(text: string) {
  const match = normalize(text).match(/\ba\s*(\d{4})\b/i);
  return match?.[1] ? `a${match[1]}` : null;
}

function parseLgGramModelNumber(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = lower.match(/\b(17zd90su|17zd90s|17z90s)(?!p)[a-z0-9-]*\b/);
  return match?.[1] ?? null;
}

function parseLaptopReleaseYear(text: string) {
  const lower = normalize(text).toLowerCase();
  const fullYear = firstMatch(lower, [
    /\b(20(?:0[8-9]|1[0-9]|2[0-6]))\s*(?:년형|년식|형|model)(?:[^0-9a-z가-힣]|$)/,
    /\b(?:early|mid|late)\s*(20(?:0[8-9]|1[0-9]|2[0-6]))\b/,
    /\b(20(?:0[8-9]|1[0-9]|2[0-6]))\s*(?:맥북|macbook|에어|프로|air|pro)\b/,
    // v32: reverse order — "맥북프로 2019", "맥북에어 m1 2020", "맥북프로2017", "맥북 프로 16인치 2019"
    // \b가 한글 boundary로 안 먹어서 explicit char class 사용. 사이 token은 chip/inch 등 최대 15자.
    // "2025년 2월 구매" 같은 purchase year context는 brand에서 멀어서 자동 회피.
    /(?:맥북|macbook|에어|프로|air|pro|gram|그램)[a-z0-9\s./()\-인치]{0,15}?(20(?:0[8-9]|1[0-9]|2[0-6]))(?:[^0-9]|$)/,
  ]);
  if (fullYear?.[1]) return Number(fullYear[1]);

  const shortYear = firstMatch(lower, [
    /(?:^|[^0-9])([0-2][0-9])\s*(?:년형|년식)(?:[^0-9]|$)/,
    /\b(?:early|mid|late)\s*([0-2][0-9])\b/,
    // v32: "19년" / "20년" — short year + 년 suffix
    /(?:^|[^0-9])([0-2][0-9])\s*년(?:[^0-9형식]|$)/,
  ]);
  if (!shortYear?.[1]) return null;
  const twoDigit = Number(shortYear[1]);
  if (twoDigit >= 8 && twoDigit <= 26) return 2000 + twoDigit;
  return null;
}

function laptopGenerationKey(
  releaseYear: number | null,
  modelNumber: string | null,
  chip: string | null = null,
) {
  if (releaseYear) return `${releaseYear}y`;
  if (modelNumber) return modelNumber;
  if (chip && /^m[1-9](?:_[a-z]+|[a-z]*)?$/i.test(chip)) return `${chip.toLowerCase().replaceAll("_", "")}_gen`;
  return null;
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function normalize(text: string) {
  return (text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/usb[\s_-]*c/g, " usbc ")
    .replace(/c[\s_-]*type/g, " usbc ")
    .replace(/c\s*타입|타입\s*c|씨\s*타입|타입\s*씨/g, " usbc ")
    .replace(/[^0-9a-z가-힣./\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value: string | null | undefined) {
  return normalize(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function cap01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function parseGb(raw: string | undefined) {
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/,/g, "");
  const compact = lower.replace(/\s+/g, "");
  const num = Number(compact.match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(num)) return null;
  if (/tb|테라|^[124]t$/.test(compact)) return Math.round(num * 1024);
  return Math.round(num);
}

function parseStorageGb(text: string, category: Sku["category"] | null) {
  const lower = normalize(text).toLowerCase();
  const storage = firstMatch(lower, [
    /(?:용량|스토리지|저장공간)\s*[:：]?\s*(32|64|128|256|512|[12]\s*(?:t|tb|테라))\s*(?:gb|g|기가|테라|tb)?/,
    /\b(32|64|128|256|512)\s*(?:gb|g|기가)\b/,
    /(?:^|[^0-9])([12]\s*(?:t|tb|테라))(?:[^0-9]|$)/,
  ]);
  if (storage) return parseGb(storage[1]);

  if (category === "smartphone" || category === "tablet") {
    const bare = lower.match(/(?:^|[^0-9])(32|64|128|256|512)(?:[^0-9]|$)/);
    const rawBare = text.toLowerCase().match(/(?:^|[^0-9])(32|64|128|256|512)\s*(?:gb|g|기가)?(?:[^0-9]|$)/);
    return parseGb(bare?.[1] ?? rawBare?.[1]);
  }
  return null;
}

function parseLooseDeviceStorageGb(text: string, category: Sku["category"] | null) {
  if (category !== "smartphone" && category !== "tablet") return null;
  const lower = normalize(text).toLowerCase();
  const modelAdjacent = lower.match(/(?:아이폰|iphone|갤럭시|galaxy|s[0-9]{2}|z플립|z폴드|ipad|아이패드|갤럭시탭|갤탭|tab|프로|울트라|플러스).{0,48}?(32|64|128|256|512)\s*(?:gb|g|기가)?(?:[^0-9]|$)/);
  return parseGb(modelAdjacent?.[1]);
}

function parseRamAndSsd(text: string, category: Sku["category"] | null) {
  const lower = normalize(text).toLowerCase();
  const ramPattern = "4|6|8|16|24|32|36|48|64|96|128";
  const pair = lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*\\/\\s*(128|250|256|500|512|1\\s*t|1\\s*tb|2\\s*t|2\\s*tb|4\\s*t|4\\s*tb|1테라|2테라|4테라)(?:[^0-9]|$)`));
  const pairWithUnits = lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*(?:gb|g|기가)?\\s*\\/\\s*(128|250|256|500|512|1\\s*t|1\\s*tb|2\\s*t|2\\s*tb|4\\s*t|4\\s*tb|1테라|2테라|4테라)\\s*(?:gb|g|기가|t|tb|테라)?(?:[^0-9]|$)`));
  const looseLaptopPair = category === "laptop"
    ? lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s+(128|256|500|512)(?:[^0-9]|$)`))
    : null;
  const adjacentLaptopPair = category === "laptop"
    ? lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*(?:gb|g|기가)\\s+(121|128|250|256|500|512|1\\s*t|1\\s*tb|2\\s*t|2\\s*tb|4\\s*t|4\\s*tb|1테라|2테라|4테라)\\s*(?:gb|g|기가|t|tb|테라|ssd)?(?:[^0-9]|$)`))
    : null;
  const reversedPair = category === "laptop"
    ? lower.match(new RegExp(`(?:^|[^0-9])(128|250|256|500|512|1\\s*t|1\\s*tb|2\\s*t|2\\s*tb|4\\s*t|4\\s*tb|1테라|2테라|4테라)\\s*(?:gb|g|기가|t|tb|테라)?\\s+(${ramPattern})\\s*(?:gb|g|기가)?(?:[^0-9]|$)`))
    : null;
  const ramExplicit = lower.match(new RegExp(`(?:램|ram|memory|메모리|통합\\s*메모리)\\s*[:：]?\\s*(${ramPattern})\\s*(?:gb|g|기가)?`));
  const ramSuffix = lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*(?:(?:gb|g|기가)\\s*)?(?:램|ram|memory|메모리|통합\\s*메모리)(?:[^0-9a-z가-힣]|$)`));
  const ramBeforeMemory = lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*(?:gb|g|기가)(?=.{0,16}(?:통합\\s*메모리|메모리|램|ram))`));
  const ramBeforeSsd = category === "laptop"
    ? lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*(?:gb|g|기가)(?=.{0,20}(?:ssd|저장공간|스토리지))`))
    : null;
  const singleLaptopRam = category === "laptop"
    ? lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*(?:gb|g|기가)(?:[^0-9a-z가-힣]|$)`))
    : null;
  const ssdExplicit = lower.match(/(?:ssd|hdd|하드|용량|저장\s*공간|저장공간|저장\s*장치|스토리지)\s*[:：]?\s*(121|128|250|256|500|512|1\s*t|1\s*tb|2\s*t|2\s*tb|4\s*t|4\s*tb|1테라|2테라|4테라)\s*(?:gb|g|기가|t|tb|테라)?/);
  const ssdSuffix = lower.match(/\b(121|128|250|256|500|512|1\s*t|1\s*tb|2\s*t|2\s*tb|4\s*t|4\s*tb|1테라|2테라|4테라)\s*(?:gb|g|기가|t|tb|테라)\s*(?:ssd|용량|저장\s*공간|저장공간|저장\s*장치|스토리지)?\b/);
  const ramGb = parseGb(ramExplicit?.[1] ?? ramSuffix?.[1] ?? ramBeforeMemory?.[1] ?? ramBeforeSsd?.[1] ?? pairWithUnits?.[1] ?? pair?.[1] ?? adjacentLaptopPair?.[1] ?? looseLaptopPair?.[1] ?? reversedPair?.[2] ?? singleLaptopRam?.[1]);
  const bareLaptopSsd = category === "laptop"
    ? lower.match(/(?:^|[^0-9])(121|128|250|256|500|512)(?:[^0-9]|$)/)
    : null;
  const compactSsd = category === "laptop"
    ? lower.match(/\b(121|128|250|256|500|512)\s*ssd\b/)
    : null;
  const teraSsd = category === "laptop"
    ? lower.match(/(?:^|[^0-9])([124])\s*(?:t|tb|테라)(?:[^0-9]|$)/)
    : null;
  const ssdGb = parseGb(ssdExplicit?.[1] ?? pairWithUnits?.[2] ?? pair?.[2] ?? adjacentLaptopPair?.[2] ?? looseLaptopPair?.[2] ?? reversedPair?.[1] ?? ssdSuffix?.[1] ?? compactSsd?.[1] ?? (teraSsd?.[1] ? `${teraSsd[1]}tb` : undefined) ?? bareLaptopSsd?.[1]);
  return { ramGb, ssdGb };
}

function parseScreenSizeIn(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = lower.match(/(?:^|[^0-9])(7\.9|8\.3|9\.7|10\.2|10\.5|10\.9|11|12\.4|12\.9|13|13\.1|13\.3|14|14\.6|15|15\.6|16|17)\s*(?:인치|inch|"|형)/);
  return match ? Number(match[1]) : null;
}

function parseMonitorBrand(text: string) {
  const lower = normalize(text).toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  const brandPatterns: Array<[string, RegExp]> = [
    ["lg", /\blg\b|엘지|울트라기어|ultragear/],
    ["samsung", /삼성|samsung|오디세이|odyssey/],
    ["benq", /벤큐|benq|zowie|조위/],
    ["dell", /\bdell\b|델\s*(?:모니터|monitor)|alienware|에일리언웨어/],
    ["asus", /asus|에이수스|아수스|rog|tuf/],
    ["msi", /\bmsi\b|엠에스아이/],
    ["gigabyte", /gigabyte|기가바이트|aorus/],
    ["viewsonic", /viewsonic|뷰소닉/],
    ["hansung", /한성|hansung/],
    ["jooyontech", /주연|jooyon/],
  ];
  for (const [brand, pattern] of brandPatterns) {
    if (pattern.test(lower) || pattern.test(compact)) return brand;
  }
  return null;
}

function parseMonitorModelCode(text: string) {
  const lower = normalize(text).toLowerCase();
  const odyssey = lower.match(/(?:오디세이|odyssey)\s*(g[3-9])\b/i);
  if (odyssey?.[1]) return `odyssey_${slug(odyssey[1])}`;
  const legion = lower.match(/\blegion\s+(\d{2}q)\s+(\d{2})\b/);
  if (legion?.[1] && legion[2]) return `${legion[1]}_${legion[2]}`;
  const matches = lower.match(/\b(?:[a-z]{1,6}\d{2,5}[a-z0-9]{0,8}|\d{2,3}[a-z]{1,5}[-_]?\d{1,5}[a-z0-9]{0,8}|\d{2,3}[a-z]{2,5})\b/g) ?? [];
  const ignored = new Set(["1080p", "1440p", "2160p"]);
  for (const raw of matches) {
    const value = slug(raw);
    if (!value || ignored.has(value)) continue;
    if (/^\d+(?:hz|gb|tb|mm|cm|in)$/.test(value)) continue;
    if (/^(fhd|qhd|uhd|oled|ips|va|tn)$/.test(value)) continue;
    return value;
  }
  return null;
}

function parseMonitorScreenSizeIn(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = lower.match(/(?:^|[^0-9])(13\.3|15\.6|16|17|19|20|21|22|23|24|24\.5|25|27|28|29|30|32|34|38|40|43|45|49|55)\s*(?:인치|inch|"|형)(?:[^0-9]|$)/);
  if (match) return Number(match[1]);
  const cmMatch = lower.match(/(?:^|[^0-9])(48|51|54|56|58|59|61|68|69|71|80|81|86|95|124)\s*(?:cm|센치|센티)(?:[^0-9]|$)/);
  const cm = cmMatch?.[1] ? Number(cmMatch[1]) : null;
  return cm ? (MONITOR_CM_SIZE_HINTS[cm] ?? null) : null;
}

function parseMonitorScreenSizeFromModelCode(modelCode: string | null) {
  if (!modelCode) return null;
  const compact = modelCode.replace(/_/g, "");
  const match = compact.match(/^(?:[a-z]{0,3})(13|15|16|17|19|20|21|22|23|24|25|27|28|29|30|32|34|38|40|43|45|49|55)(?=[a-z0-9])/);
  if (!match?.[1]) return null;
  const size = Number(match[1]);
  return Number.isFinite(size) ? size : null;
}

function parseMonitorResolution(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/3840\s*[x/]\s*2160|\b2160p\b|\buhd\b|\b4k\b/.test(lower)) return "uhd_4k";
  if (/3440\s*[x/]\s*1440|\b(?:u?wqhd|uwqhd)\b/.test(lower)) return "wqhd";
  if (/2560\s*[x/]\s*1440|\b1440p\b|\bqhd\b|\b2k\b/.test(lower)) return "qhd";
  if (/1920\s*[x/]\s*1080|\b1080p\b|\bfhd\b|\bwfhd\b|풀\s*hd/.test(lower)) return "fhd";
  return null;
}

function parseMonitorRefreshRate(text: string) {
  const lower = normalize(text).toLowerCase();
  const refreshPattern = "60|75|100|120|144|160|165|170|180|200|240|280|300|320|360|480|500|540";
  const explicit = lower.match(new RegExp(`(?:^|[^0-9])(${refreshPattern})\\s*(?:hz|헤르츠)(?:[^0-9]|$)`));
  if (explicit?.[1]) return Number(explicit[1]);

  const bareAfterContext = lower.match(new RegExp(`(?:주사율|고주사율|게이밍|게임용|리얼|모니터|fhd|qhd|wqhd|uwqhd|uhd|4k).{0,18}?(?:^|[^0-9])(${refreshPattern})(?:[^0-9]|$)`));
  if (bareAfterContext?.[1]) return Number(bareAfterContext[1]);

  const bareBeforeContext = lower.match(new RegExp(`(?:^|[^0-9])(${refreshPattern})(?:[^0-9]|$).{0,18}?(?:주사율|고주사율|게이밍|게임용|리얼|모니터|fhd|qhd|wqhd|uwqhd|uhd|4k)`));
  return bareBeforeContext?.[1] ? Number(bareBeforeContext[1]) : null;
}

function parseMonitorPanelType(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/\boled\b|올레드/.test(lower)) return "oled";
  if (/[a-z0-9]ips\b/.test(lower)) return "ips";
  if (/\bips\b/.test(lower)) return "ips";
  if (/(?:^|[^a-z])va(?:[^a-z]|$)/.test(lower)) return "va";
  if (/(?:^|[^a-z])tn(?:[^a-z]|$)/.test(lower)) return "tn";
  return null;
}

function parseMonitorShape(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/울트라\s*와이드|ultra\s*wide|ultrawide|21\s*[:/]\s*9/.test(lower)) return "ultrawide";
  if (/커브드|curved|곡면/.test(lower)) return "curved";
  if (/평면|flat/.test(lower)) return "flat";
  return null;
}

function parseTabletGeneration(text: string, model: string | null) {
  if (!model) return null;
  const lower = normalize(text).toLowerCase();
  // v32: 세대 명시 토큰을 먼저 우선 매칭. "12.9 5세대" 같은 케이스에서 "1" (decimal 일부) 잘못 캡처 방지.
  const genWithMarker = lower.match(/(\d)\s*세대/);
  if (genWithMarker?.[1]) return Number(genWithMarker[1]);

  if (model === "ipad_pro") {
    const match = firstMatch(lower, [
      // 세대 marker 없을 때만 → 모델명 "프로/pro" 인접 단일 digit 사용 (decimal 회피 위해 [^.0-9] 경계)
      /(?:아이패드\s*)?(?:프로|pro)\s+(?:[^0-9.]{0,12}?)?(\d)(?:[^0-9.]|$)/,
      /(?:^|[^0-9.])(\d)(?:[^0-9.]{0,12})?(?:프로|pro)/,
    ]);
    return match ? Number(match[1]) : null;
  }
  if (model === "ipad_mini") {
    if (/\ba\s*17\b|a17\s*pro|a17pro/.test(lower)) return 7;
    const match = firstMatch(lower, [
      /(?:아이패드\s*)?(?:미니|mini)\s+(?:[^0-9.]{0,12}?)?(\d)(?:[^0-9.]|$)/,
      /(?:^|[^0-9.])(\d)(?:[^0-9.]{0,12})?(?:미니|mini)/,
    ]);
    return match ? Number(match[1]) : null;
  }
  if (model === "ipad_air") {
    const match = firstMatch(lower, [
      /(?:아이패드\s*)?(?:에어|air)\s*(\d)(?:[^0-9.]|$)/,
      /(?:^|[^0-9.])(\d)\s*(?:에어|air)/,
    ]);
    return match ? Number(match[1]) : null;
  }
  return null;
}

function parseTabletGenerationChip(text: string, model: string | null, screenSizeIn: number | null) {
  const generation = parseTabletGeneration(text, model);
  if (!generation) return null;

  if (model === "ipad_pro") {
    if (screenSizeIn === 11) {
      if (generation === 3) return "m1";
      if (generation === 4) return "m2";
      if (generation === 5) return "m4";
    }
    if (screenSizeIn === 12.9 || screenSizeIn === 13) {
      if (generation === 5) return "m1";
      if (generation === 6) return "m2";
      if (generation === 7) return "m4";
    }
  }

  if (model === "ipad_air") {
    if (generation === 4) return "a14"; // iPad Air 4 = A14 Bionic (2020, only Air with A14)
    if (generation === 5) return "m1";
    if (generation === 6) return "m2";
    if (generation === 7) return "m3";
  }

  return null;
}

function tabletChipAxis(model: string | null, chip: string | null) {
  if (model === "ipad_pro" || model === "ipad_air") return chip ?? "unknown_chip";
  return null;
}

function hasTabletBundlePriceReview(text: string) {
  const lower = normalize(text).toLowerCase();
  return /(애플\s*펜슬|애플펜슬|애펜|apple\s*pencil|pencil|매직\s*키보드|magic\s*keyboard|키보드\s*포함|펜슬\s*포함|\+\s*(?:펜슬|키보드|케이스)|(?:펜슬|키보드|케이스).{0,16}(?:포함|같이|증정|드림|드립니다))/.test(lower);
}

function parseBareTabletScreenSizeIn(text: string, model: string | null) {
  const lower = normalize(text).toLowerCase();
  const screenPattern = "(7\\.9|8\\.3|9\\.7|10\\.2|10\\.5|10\\.9|11|12\\.4|12\\.9|13|13\\.1|14\\.6)";
  const ipadModelBefore = new RegExp(`(?:아이패드\\s*(?:프로|에어|미니)|아이패드(?:프로|에어|미니)|ipad\\s*(?:pro|air|mini)|프로|에어|미니|pro|air|mini).{0,40}?${screenPattern}(?:[^0-9]|$)`);
  const ipadModelAfter = new RegExp(`(?:^|[^0-9])${screenPattern}.{0,40}?(?:아이패드\\s*(?:프로|에어|미니)|아이패드(?:프로|에어|미니)|ipad\\s*(?:pro|air|mini)|프로|에어|미니|pro|air|mini)`);
  const galaxyTabBefore = new RegExp(`(?:갤럭시\\s*탭|갤럭시탭|갤탭|galaxy\\s*tab|tab).{0,32}?${screenPattern}(?:[^0-9]|$)`);
  const galaxyTabAfter = new RegExp(`(?:^|[^0-9])${screenPattern}.{0,32}?(?:갤럭시\\s*탭|갤럭시탭|갤탭|galaxy\\s*tab|tab)`);

  const match = lower.match(ipadModelBefore)
    ?? lower.match(ipadModelAfter)
    ?? lower.match(galaxyTabBefore)
    ?? lower.match(galaxyTabAfter);
  if (match?.[1]) return Number(match[1]);

  if (model === "ipad_pro" || model === "ipad_air") {
    const compact = lower.match(/(?:아이패드(?:프로|에어)|ipad(?:pro|air)|프로|에어)(11|13)(?:[^0-9]|$)/);
    if (compact?.[1]) return Number(compact[1]);
  }
  return null;
}

function parseTabletScreenSizeIn(text: string, model: string | null) {
  const explicit = parseScreenSizeIn(text);
  if (explicit) return explicit;
  const bare = parseBareTabletScreenSizeIn(text, model);
  if (bare) return bare;

  const generation = parseTabletGeneration(text, model);
  if (model === "ipad_mini") {
    if (generation && generation <= 5) return 7.9;
    if (generation && generation >= 6) return 8.3;
  }
  if (model === "ipad_air") {
    if (generation === 1 || generation === 2) return 9.7;
    if (generation === 3) return 10.5;
    if (generation === 4 || generation === 5) return 10.9;
  }
  return defaultTabletScreenSizeIn(model);
}

function parseLaptopScreenSizeIn(text: string) {
  const lower = normalize(text).toLowerCase();
  const explicit = parseScreenSizeIn(text);
  if (explicit) return explicit;
  const macbookBare = lower.match(/(?:맥북\s*에어|맥북에어|macbook\s*air|맥북\s*프로|맥북프로|macbook\s*pro).{0,24}?\b(13|14|15|16)\b/);
  if (macbookBare) return Number(macbookBare[1]);
  return null;
}

function parseWatchSizeMm(text: string) {
  const match = normalize(text).toLowerCase().match(/\b(40|41|42|43|44|45|46|47|49)\s*m{1,2}\b/);
  return match ? Number(match[1]) : null;
}

function parseChip(text: string) {
  const lower = normalize(text).toLowerCase();
  const coreUltra = firstMatch(lower, [
    /코어\s*울트라\s*([579])/,
    /core\s*ultra\s*([579])/,
    /\bultra\s*([579])\b/,
  ]);
  if (coreUltra?.[1]) return `ultra${coreUltra[1]}`;
  const match = firstMatch(lower, [
    /\b(m[1-5])\s*(ultra|max|pro)?\b/,
    /\b(i[3579])\s*(?:-| )?(\d{4,5}[a-z]*)?\b/,
  ]);
  if (!match) return null;
  return slug([match[1], match[2]].filter(Boolean).join(" "));
}

function parseLgGramChipFromModelNumber(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = lower.match(/\b17z(?:d)?90s(?:u)?\s+g[a-z]?([57])/);
  return match?.[1] ? `ultra${match[1]}` : null;
}

function parseBatteryHealth(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = firstMatch(lower, [
    /(?:배터리\s*)?(?:효율|성능)\s*[:：]?\s*(100|9[0-9]|8[0-9]|7[0-9])\s*%?/,
    /(?:배효)\s*[:：]?\s*(100|9[0-9]|8[0-9]|7[0-9])\s*%?/,
  ]);
  return match ? Number(match[1]) : null;
}

function parseBatteryCycles(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = firstMatch(lower, [
    /(?:사이클|cycle|충전\s*횟수)\s*[:：]?\s*(\d{1,4})\s*(?:회)?/,
  ]);
  return match ? Number(match[1]) : null;
}

function parseConnectivity(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/셀룰러|cellular|lte|5g/.test(lower)) return "cellular";
  if (/와이\s*파이|wifi|wi\s*fi|wi-fi/.test(lower)) return "wifi";
  if (/gps|블루투스|bluetooth|bt/.test(lower)) return "gps";
  return null;
}

function parseCarrier(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/자급제/.test(lower)) return "unlocked";
  if (/\bskt\b|sk텔레콤/.test(lower)) return "skt";
  if (/\bkt\b/.test(lower)) return "kt";
  if (/유플|u\+|lg u/.test(lower)) return "lgu";
  return null;
}

function modelFromSku(skuId?: string | null, skuName?: string | null) {
  const id = slug(skuId);
  const name = slug(skuName);
  if (id.startsWith("iphone_")) return id.replace(/^iphone_/, "iphone_");
  if (id.startsWith("galaxy_s")) return id;
  if (id.startsWith("ipad_")) return id;
  if (id.startsWith("galaxy_tab")) return id;
  if (id.startsWith("macbook_air")) return "macbook_air";
  if (id.startsWith("macbook_pro")) return "macbook_pro";
  if (id === "lg_gram_17_2024") return "lg_gram_17_2024";
  if (id.startsWith("applewatch")) return id;
  if (id.startsWith("galaxywatch")) return id;
  if (id.startsWith("airpods")) return id;
  if (id === "camera_canon_eos_r6_mark_ii") return "eos_r6_mark_ii";
  if (id === "camera_sony_a7m3") return "a7_iii";
  if (id === "camera_sony_a7c") return "a7c";
  if (id === "camera_sony_a5100") return "a5100";
  if (id === "camera_canon_eos_m6") return "eos_m6";
  if (id === "camera_nikon_z9") return "z9";
  if (id === "camera_canon_eos_6d") return "eos_6d";
  if (id === "camera_fujifilm_x_t4") return "x_t4";
  return name || id || null;
}

function familyFrom(category: Sku["category"] | null, model: string | null) {
  if (!model) return null;
  if (model.includes("iphone")) return "iphone";
  if (model.includes("galaxy_s")) return "galaxy_s";
  if (model.includes("ipad")) return "ipad";
  if (model.includes("galaxy_tab")) return "galaxy_tab";
  if (model.includes("macbook")) return "macbook";
  if (model.includes("lg_gram")) return "lg_gram";
  if (model.includes("applewatch")) return "applewatch";
  if (model.includes("galaxywatch")) return "galaxywatch";
  if (model.includes("airpods")) return "airpods";
  if (category === "monitor") return "monitor";
  if (category === "speaker") return "speaker";
  if (category === "camera") {
    if (model.startsWith("eos_")) return "canon";
    if (model.startsWith("a")) return "sony";
    if (model.startsWith("z")) return "nikon";
    if (model.startsWith("x_")) return "fujifilm";
    return "camera";
  }
  return category;
}

function parseAirpodsConnector(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/usb\s*-?\s*c|usbc|c타입|타입c|씨타입|타입씨|c-type|ctype|c터입|c핀|c\s*핀|\ba3184\b|\bmww\d{2}/.test(lower)) return "usbc";
  if (/라이트닝|lightning|8핀|8\s*핀|팔핀|팔\s*핀|\ba2096\b/.test(lower)) return "lightning";
  return null;
}

function defaultAirpodsConnector(model: string | null, text: string) {
  const lower = normalize(text).toLowerCase();
  if (!model?.includes("airpods")) return null;
  if (
    model.includes("airpods_pro_2_usbc") ||
    model.includes("airpods_4") ||
    model.includes("airpods_pro_3")
  ) return "usbc";
  if (
    model.includes("airpods_2") ||
    model.includes("airpods_3") ||
    model.includes("airpods_pro_1") ||
    model.includes("airpods_pro_2_lightning")
  ) return "lightning";
  if (model.includes("airpods_max")) {
    if (/202[4-6]|c타입|타입c|usb\s*-?\s*c|usbc|ctype|c핀|c\s*핀|미드나이트|스타라이트|퍼플|오렌지|\ba3184\b|\bmww\d{2}/.test(lower)) return "usbc";
    if (/맥스\s*2|맥스2|max\s*2|max2|2세대|2 세대/.test(lower)) return "usbc";
    if (/1세대|1 세대|8핀|8\s*핀|팔핀|팔\s*핀|라이트닝|lightning|\ba2096\b|202[0-3]|2[0-3]\s*년/.test(lower)) return "lightning";
  }
  return null;
}

function parseAirpodsMaxGeneration(model: string | null, text: string) {
  if (!model?.includes("airpods_max")) return null;
  const lower = normalize(text).toLowerCase();
  const rawLower = (text ?? "").normalize("NFKC").toLowerCase();
  const rawCompact = rawLower.replace(/\s+/g, "");

  const ambiguous =
    /(?:1st|1\s*세대|1세대|1)\s*(?:or|또는|혹은|\/|,|와|과)\s*(?:2nd|2\s*세대|2세대|2)/.test(rawLower) ||
    /(?:1st|1\s*세대|1세대|1).{0,12}(?:2nd|2\s*세대|2세대|2).{0,12}(?:generation|세대)/.test(rawLower) ||
    /1(?:st)?or2(?:nd)?|1세대또는2세대|1세대2세대|1\/2세대/.test(rawCompact);
  if (ambiguous) return "unknown_generation";

  const usbCSignal = /202[4-6]|c타입|타입c|usb\s*-?\s*c|usbc|ctype|c핀|c\s*핀|미드나이트|스타라이트|퍼플|오렌지|\ba3184\b|\bmww\d{2}|맥스\s*2|맥스2|max\s*2|max2|2세대|2 세대/.test(lower);
  const lightningSignal = /1세대|1 세대|8핀|8\s*핀|팔핀|팔\s*핀|라이트닝|lightning|\ba2096\b|202[0-3]|2[0-3]\s*년/.test(lower);
  const legacyColorSignal = /스페이스\s*그레이|space\s*gr[ae]y|실버|silver|그린|green|핑크|pink/.test(lower);

  if (usbCSignal && legacyColorSignal) return "unknown_generation";
  if (usbCSignal && lightningSignal) return "unknown_generation";
  if (usbCSignal) return "max_usbc";
  if (lightningSignal) return "max_lightning";
  return "unknown_generation";
}

function hasAirpodsMaxFullProductContext(text: string) {
  const lower = normalize(text).toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  return (
    /(풀박스|풀박|풀구성|풀세트|박스\s*포함|구성품|본품|본체|정품|새상품|미개봉|a급|s급|헤드폰|헤드셋|headphone|headset)/.test(lower) ||
    /에어팟맥스.{0,12}(정상|상태좋|상태굿|사용감|실사용|구매|애플케어|보증)|(?:정상|상태좋|상태굿|사용감|실사용|구매|애플케어|보증).{0,12}에어팟맥스/.test(compact)
  );
}

function parseAirpodsNoiseControl(model: string | null, text: string) {
  if (!model?.includes("airpods_4")) return null;
  const rawLower = (text ?? "").normalize("NFKC").toLowerCase();
  const lower = normalize(text).toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  const rawCompact = rawLower.replace(/\s+/g, "");

  if (
    /노캔.{0,20}(?:모르|되는지\s*안\s*되는지)|노캔.{0,20}되는지안되는지/.test(lower) ||
    /노캔.{0,20}(?:모르|되는지\s*안\s*되는지)|노캔.{0,20}되는지안되는지/.test(rawLower)
  ) {
    return "unknown_anc";
  }

  if (
    /노캔\s*(?:x|×|❌|ㄴㄴ|노노|없|아님|아니|안됨|안\s*됨|미지원)|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)\s*(?:x|×|❌|없|아님|아니|안됨|안\s*됨|미지원)|anc\s*(?:x|no|없|미지원)/.test(rawLower) ||
    /노캔\s*(?:x|없|아님|아니|안됨|안\s*됨|미지원)|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)\s*(?:x|없|아님|아니|안됨|안\s*됨|미지원)|anc\s*(?:x|no|없|미지원)/.test(lower) ||
    /노캔이되는모델은아니|노캔안되는|노캔없는|노캔x|노캔❌|노캔ㄴㄴ|노캔노노|노캔아님|노캔아니|노캔착각|노클x|ancx/.test(rawCompact) ||
    /노캔이되는모델은아니|노캔안되는|노캔없는|노캔x|노캔아님|노캔아니|노캔착각|노클x|ancx/.test(compact) ||
    /일반\s*모델|일반형|기본\s*모델|기본모델|유선\s*충전|유선충전|mxp63/.test(lower)
  ) {
    return "no_anc";
  }

  if (
    /노캔\s*(?:0|o|○|지원|되는|가능|됩니다|됨|되요|돼요|있|있음|모델|제품|상품|미개봉|풀박스|풀박|판매|팔아)|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)|액티브\s*노이즈|anc\s*(?:o|yes|지원)?/.test(lower) ||
    /노캔0|노캔o|노캔되는|노캔가능|노캔됩니다|노캔됨|노캔있음|노캔모델|노캔제품|노캔상품|노캔미개봉|노캔풀박|노이즈캔슬링|노이즈켄슬링|노이즈캔슬|노이즈켄슬/.test(compact) ||
    /노캔\s*(?:미개봉|풀박스|풀박|모델)?\s*$/.test(rawLower.trim())
  ) {
    return "anc";
  }

  return "unknown_anc";
}

function defaultWatchSizeMm(model: string | null) {
  if (!model) return null;
  if (model.includes("applewatch_ultra")) return 49;
  if (model.includes("galaxywatch_ultra")) return 47;
  return null;
}

function defaultConnectivity(model: string | null) {
  if (!model) return null;
  if (model.includes("applewatch_ultra") || model.includes("galaxywatch_ultra")) return "cellular";
  return null;
}

function defaultTabletScreenSizeIn(model: string | null) {
  if (!model) return null;
  if (model === "ipad_10") return 10.9;
  if (/^ipad_(?:pro|air)_11_/.test(model)) return 11;
  if (/^ipad_(?:pro|air)_13_/.test(model)) return 13;
  if (/^ipad_mini_/.test(model)) return 8.3;
  if (model === "galaxy_tab_s8" || model === "galaxy_tab_s9") return 11;
  if (model === "galaxy_tab_s9_fe") return 10.9;
  if (model === "galaxy_tab_s9_fe_plus") return 12.4;
  if (model === "galaxy_tab_s10_fe_plus") return 13.1;
  if (model === "galaxy_tab_s8_plus" || model === "galaxy_tab_s9_plus" || model === "galaxy_tab_s10_plus") return 12.4;
  if (model === "galaxy_tab_s8_ultra" || model === "galaxy_tab_s9_ultra" || model === "galaxy_tab_s10_ultra") return 14.6;
  return null;
}

function defaultLaptopMemory(category: Sku["category"] | null, model: string | null, chip: string | null, screenSizeIn: number | null, text: string) {
  if (category !== "laptop" || !model) return { ramGb: null, ssdGb: null };
  const lower = normalize(text).toLowerCase();
  const baseSignal = /기본형|기본\s*모델|깡통|베이스\s*모델|base\s*model/.test(lower);
  if (!baseSignal) return { ramGb: null, ssdGb: null };

  if (model === "macbook_air") {
    return { ramGb: 8, ssdGb: 256 };
  }

  if (model === "macbook_pro") {
    if (screenSizeIn === 13) return { ramGb: 8, ssdGb: 256 };
    if (screenSizeIn === 14 || screenSizeIn === 16 || chip?.includes("pro") || chip?.includes("max")) {
      return { ramGb: 16, ssdGb: 512 };
    }
  }

  return { ramGb: null, ssdGb: null };
}

function conditionFromText(text: string, batteryHealth: number | null, cycles: number | null) {
  const lower = normalize(text).toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  const defectRiskText = lower
    .replace(/리퍼\s*(?:제품\s*)?(?:아님|아닙니다|아닌|아니고|아니며)/g, " ")
    .replace(/(?:수리|교체)\s*(?:이력|내역)?\s*(?:없|없음|없습니다|없고|안함|안\s*함|한\s*적\s*없)/g, " ")
    .replace(/(?:하자|불량|파손|깨짐)(?:이나|이나요|은|는|이|가)?\s*(?:전혀\s*)?(?:없|없음|없습니다|없고|없이|아님|아닙니다)/g, " ")
    .replace(/(?:깨짐|기스|스크래치).{0,12}(?:없|없음|없습니다|없고)/g, " ")
    .replace(/(?:액정|디스플레이|화면)\s*(?:깨짐|파손|불량)\s*(?:없|없음|없습니다|없고)/g, " ")
    .replace(/무상\s*수리\s*가능/g, " ")
    .replace(/추후.{0,20}(?:파손|수리).{0,20}시/g, " ")
    .replace(/(?:펜슬|애플펜슬|키보드|케이스).{0,24}(?:충전|연결|작동).{0,12}(?:안되|안됨|불량|문제)/g, " ")
    .replace(/택배.{0,20}(?:파손|고장|문제).{0,20}(?:되면|생길\s*수|위험)/g, " ");
  let score = 0.75;
  const notes: string[] = [];
  const add = (note: string, delta: number) => {
    notes.push(note);
    score += delta;
  };

  if (/미개봉|새상품|새 제품|새제품|단순개봉/.test(lower)) add("new_or_open_box", 0.15);
  if (/풀박스|풀박|풀구성|풀세트|구성품\s*전부/.test(lower)) add("full_set", 0.05);
  if (/s급|상태\s*좋|상태좋|깨끗|깔끔/.test(lower)) add("good_condition", 0.05);
  if (/사용감|기스|스크래치|찍힘|생활기스|흠집/.test(lower)) add("cosmetic_wear", -0.1);
  if (/수리|교체|하자|고장|불량|파손|깨짐/.test(defectRiskText)) add("repair_or_defect_signal", -0.2);
  if (batteryHealth != null && batteryHealth < 85) add("low_battery_health", -0.15);
  if (cycles != null && cycles > 500) add("high_battery_cycles", -0.1);

  const notRefurbished = /리퍼\s*(?:제품\s*)?(?:아님|아닙니다|아닌|아니고|아니며)/.test(lower);
  if (!notRefurbished && /리퍼|리퍼폰|리퍼\s*교체|부분\s*수리|사설\s*수리|사설수리/.test(lower)) add("refurbished_or_repaired", -0.15);
  if (/(액정|디스플레이|화면).{0,16}(교체|수리)|(?:교체|수리).{0,16}(액정|디스플레이|화면)/.test(defectRiskText)) add("screen_replaced", -0.12);
  const noDisplayDefect = /무잔상|잔상\s*(?:없|없음|없습니다|전혀\s*없)|번인\s*(?:없|없음|없습니다)/.test(lower);
  if (!noDisplayDefect && /잔상|번인|burn\s*in|녹조|흑점|멍|터치\s*불량|터치불량/.test(lower)) add("display_defect", -0.25);
  const noFaceIdIssue = /(페이스\s*아이디|face\s*id|faceid).{0,30}(문제\s*(?:없|없음|없고|없습니다)|정상|잘\s*됨|작동)|기능에\s*아무\s*문제\s*없/.test(lower);
  if (!noFaceIdIssue && /(페이스\s*아이디|face\s*id|faceid).{0,20}(안됨|불가|고장|불량|문제|수리)|(?:안됨|불가|고장|불량|문제|수리).{0,20}(페이스\s*아이디|face\s*id|faceid)/.test(lower)) add("faceid_issue", -0.25);
  if (/(카메라|전면|후면).{0,20}(안됨|불가|고장|불량|흔들림|초점\s*불량|초점불량)|(?:안됨|불가|고장|불량|흔들림|초점\s*불량|초점불량).{0,20}(카메라|전면|후면)/.test(lower)) add("camera_issue", -0.2);
  if (/(유심|sim).{0,20}(인식\s*불|인식불|안됨|불가|락)|(?:인식\s*불|인식불|안됨|불가|락).{0,20}(유심|sim)/.test(lower)) add("sim_or_carrier_issue", -0.2);
  const noWaterDamage = /침수(?:폰)?\s*(?:없|없음|없습니다|아님|일절\s*취급하지|취급하지\s*않)|침수\s*라벨\s*(?:정상|깨끗)/.test(lower);
  if (!noWaterDamage && /침수|물\s*들어|물먹|물\s*먹/.test(lower)) add("water_damage", -0.35);
  const noLostOrLocked = /분실\s*도난\s*침수폰?\s*일절\s*취급하지|분실\s*(?:없|없음|신고\s*없)|도난\s*(?:없|없음)|분실.{0,8}도난.{0,16}검수\s*완료|정상\s*해지|정상해지|(?:아이클라우드|icloud).{0,16}(?:로그아웃|해제).{0,16}(?:완료|됨)|초기화\s*완료/.test(lower);
  if (!noLostOrLocked && /분실|도난|락걸림|락\s*걸림|잠김|아이클라우드|icloud|초기화\s*불가|초기화불가/.test(lower)) add("locked_or_lost_signal", -0.4);
  if (/선약|선택\s*약정|확정\s*기변|확정기변|정상\s*해지|정상해지/.test(lower)) add("carrier_status_disclosed", 0.03);
  if (/(할부|미납|요금).{0,12}(남|있|미납)|(?:남은|잔여).{0,8}할부/.test(compact)) add("installment_risk", -0.25);

  return {
    conditionScore: cap01(score),
    conditionNotes: [...new Set(notes)],
  };
}

function comparableParts(input: {
  category: Sku["category"] | null;
  family: string | null;
  model: string | null;
  releaseYear: number | null;
  laptopModelNumber: string | null;
  storageGb: number | null;
  ramGb: number | null;
  ssdGb: number | null;
  screenSizeIn: number | null;
  chip: string | null;
  connectivity: string | null;
  carrier: string | null;
  watchSizeMm: number | null;
  airpodsConnector: string | null;
  airpodsNoiseControl: string | null;
  monitorModelCode: string | null;
  monitorResolution: string | null;
  monitorRefreshRate: number | null;
  monitorPanelType: string | null;
  monitorShape: string | null;
}) {
  const { category, family, model } = input;
  if (!category || !family || !model) return null;
  if (category === "smartphone") {
    return [family, model, input.storageGb ? `${input.storageGb}gb` : "unknown_storage"];
  }
  if (category === "tablet") {
    const chipAxis = tabletChipAxis(model, input.chip);
    return [
      family,
      model,
      ...(chipAxis ? [chipAxis] : []),
      input.screenSizeIn ? `${input.screenSizeIn}in` : "unknown_screen",
      input.storageGb ? `${input.storageGb}gb` : "unknown_storage",
      input.connectivity ?? "unknown_connectivity",
    ];
  }
  if (category === "laptop") {
    return [
      family,
      model,
      laptopGenerationKey(input.releaseYear, input.laptopModelNumber, input.chip) ?? "unknown_generation",
      input.chip ?? "unknown_chip",
      input.screenSizeIn ? `${input.screenSizeIn}in` : "unknown_screen",
      input.ramGb ? `${input.ramGb}gb_ram` : "unknown_ram",
      input.ssdGb ? `${input.ssdGb}gb_ssd` : "unknown_ssd",
    ];
  }
  if (category === "smartwatch") {
    return [
      family,
      model,
      input.watchSizeMm ? `${input.watchSizeMm}mm` : "unknown_size",
      input.connectivity ?? "unknown_connectivity",
    ];
  }
  if (category === "earphone") {
    if (!model.includes("airpods")) {
      return [family, model];
    }
    const parts = [family, model, input.airpodsConnector ?? "unknown_connector"];
    if (model === "airpods_4") {
      parts.push(input.airpodsNoiseControl ?? "unknown_anc");
    }
    return parts;
  }
  if (category === "monitor") {
    return [
      family,
      model,
      input.screenSizeIn ? `${input.screenSizeIn}in` : "unknown_screen",
      input.monitorResolution ?? "unknown_resolution",
      input.monitorRefreshRate ? `${input.monitorRefreshRate}hz` : "unknown_refresh",
      input.monitorPanelType ?? "unknown_panel",
      input.monitorShape ?? "unknown_shape",
    ];
  }
  if (category === "speaker") {
    return [family, model, "portable_bluetooth_speaker"];
  }
  if (category === "camera") {
    return ["camera", family, model, "body_only", "no_lens"];
  }
  return [family, model];
}

function confidence(input: {
  category: Sku["category"] | null;
  model: string | null;
  releaseYear: number | null;
  laptopModelNumber: string | null;
  storageGb: number | null;
  ramGb: number | null;
  ssdGb: number | null;
  screenSizeIn: number | null;
  chip: string | null;
  connectivity: string | null;
  carrier: string | null;
  watchSizeMm: number | null;
  airpodsConnector: string | null;
  airpodsNoiseControl: string | null;
  airpodsMaxGeneration: string | null;
  monitorModelCode: string | null;
  monitorResolution: string | null;
  monitorRefreshRate: number | null;
  monitorPanelType: string | null;
  monitorShape: string | null;
  batteryHealth: number | null;
  batteryCycles: number | null;
}) {
  if (!input.category || !input.model) return 0.2;
  let score = 0.45;
  if (input.category === "smartphone") {
    if (input.storageGb) score += 0.3;
    if (input.batteryHealth || input.batteryCycles) score += 0.1;
    if (input.connectivity || input.carrier) score += 0.05;
  } else if (input.category === "tablet") {
    if (input.screenSizeIn) score += 0.12;
    if (input.storageGb) score += 0.23;
    if (input.connectivity) score += 0.12;
    if (input.batteryHealth || input.batteryCycles) score += 0.05;
  } else if (input.category === "laptop") {
    if (input.releaseYear || input.laptopModelNumber) score += 0.12;
    if (input.chip) score += 0.18;
    if (input.screenSizeIn) score += 0.14;
    if (input.ramGb) score += 0.14;
    if (input.ssdGb) score += 0.14;
    if (input.batteryCycles) score += 0.05;
  } else if (input.category === "smartwatch") {
    if (input.watchSizeMm) score += 0.25;
    if (input.connectivity) score += 0.12;
    else score += 0.05;
    if (input.batteryHealth) score += 0.05;
  } else if (input.category === "earphone") {
    if (input.model?.includes("airpods")) {
      score += input.airpodsConnector ? 0.25 : 0.12;
      if (input.model === "airpods_4") score += input.airpodsNoiseControl && input.airpodsNoiseControl !== "unknown_anc" ? 0.18 : -0.08;
      if (input.model.includes("airpods_max")) score += input.airpodsMaxGeneration && input.airpodsMaxGeneration !== "unknown_generation" ? 0.05 : -0.1;
    } else {
      score += 0.35;
    }
  } else if (input.category === "monitor") {
    if (input.monitorModelCode) score += 0.18;
    if (input.screenSizeIn) score += 0.12;
    if (input.monitorResolution) score += 0.12;
    if (input.monitorRefreshRate) score += 0.12;
    if (input.monitorPanelType) score += 0.06;
    if (input.monitorShape) score += 0.03;
  } else if (input.category === "speaker") {
    score += 0.35;
  } else if (input.category === "camera") {
    score += 0.35;
  } else if (input.category === "game_console") {
    score += 0.35;
  } else if (input.category === "desktop") {
    // Wave 17: desktop narrow lane (Mac mini M2 등). catalog ruleMatch + mustNotContain로
    // 변형/세대 분리하므로 catalog hit만으로 신뢰. speaker/camera/game_console과 동일 +0.35.
    score += 0.35;
  } else if (input.category === "home_appliance") {
    // Wave 19: home_appliance narrow lane (Dyson V12 등). catalog ruleMatch + mustNotContain로
    // V10/V11/V15 등 다른 모델 분리. desktop과 동일 +0.35.
    score += 0.35;
  }
  return cap01(score);
}

function criticalUnknowns(category: Sku["category"] | null, comparableKey: string | null) {
  const parts = comparableKey?.split("|").filter((part) => part.startsWith("unknown_")) ?? [];
  if (parts.length === 0) return [];
  if (category === "smartphone") {
    return parts.filter((part) => part === "unknown_storage");
  }
  if (category === "tablet") {
    return parts.filter((part) => ["unknown_chip", "unknown_screen", "unknown_storage", "unknown_connectivity"].includes(part));
  }
  if (category === "laptop") {
    return parts.filter((part) => ["unknown_generation", "unknown_chip", "unknown_ram", "unknown_ssd"].includes(part));
  }
  if (category === "smartwatch") {
    return parts.filter((part) => part === "unknown_size");
  }
  if (category === "earphone") {
    return parts.filter((part) => part === "unknown_connector" || part === "unknown_anc");
  }
  if (category === "monitor") {
    return parts.filter((part) => ["unknown_screen", "unknown_resolution", "unknown_refresh"].includes(part));
  }
  return parts;
}

export function parseListingOptions(input: ParseInput): ParsedListingOptions {
  const title = input.title ?? "";
  const description = input.description ?? "";
  const text = `${title}\n${description.slice(0, 1200)}`;
  const category = input.category ?? null;
  const monitorBrand = category === "monitor" ? (parseMonitorBrand(title) ?? parseMonitorBrand(text)) : null;
  const monitorModelCode = category === "monitor" ? (parseMonitorModelCode(title) ?? parseMonitorModelCode(text)) : null;
  const monitorModelHint = monitorModelCode ? (MONITOR_MODEL_HINTS[monitorModelCode] ?? null) : null;
  const model = category === "monitor" ? (monitorModelCode ?? "generic_monitor") : modelFromSku(input.skuId, input.skuName);
  const family = familyFrom(category, model);
  const storageGb = parseStorageGb(title, category) ?? parseLooseDeviceStorageGb(title, category) ?? parseStorageGb(text, category);
  const titleMemory = parseRamAndSsd(title, category);
  const combinedMemory = parseRamAndSsd(text, category);
  const parsedRamGb = titleMemory.ramGb ?? combinedMemory.ramGb;
  const parsedSsdGb = titleMemory.ssdGb ?? combinedMemory.ssdGb;
  const laptopModelNumber = category === "laptop"
    ? (parseAppleLaptopModelNumber(title) ?? parseAppleLaptopModelNumber(text) ?? parseLgGramModelNumber(title) ?? parseLgGramModelNumber(text))
    : null;
  const laptopModelHint = laptopModelNumber ? (APPLE_LAPTOP_MODEL_HINTS[laptopModelNumber] ?? LG_GRAM_MODEL_HINTS[laptopModelNumber] ?? null) : null;
  const parsedReleaseYear = category === "laptop"
    ? (parseLaptopReleaseYear(title) ?? parseLaptopReleaseYear(text))
    : null;
  const releaseYear = category === "laptop"
    ? (parsedReleaseYear ?? laptopModelHint?.releaseYear ?? null)
    : null;
  const parsedScreenSizeIn = category === "laptop"
    ? (parseLaptopScreenSizeIn(title) ?? parseLaptopScreenSizeIn(text))
    : category === "tablet"
      ? (parseTabletScreenSizeIn(title, model) ?? parseTabletScreenSizeIn(text, model))
    : category === "monitor"
      ? (parseMonitorScreenSizeIn(title) ?? parseMonitorScreenSizeIn(text))
    : (parseScreenSizeIn(title) ?? parseScreenSizeIn(text));
  const screenSizeIn = parsedScreenSizeIn
    ?? (category === "laptop" ? (laptopModelHint?.screenSizeIn ?? null) : null)
    ?? (category === "monitor" ? (monitorModelHint?.screenSizeIn ?? null) : null)
    ?? (category === "monitor" ? parseMonitorScreenSizeFromModelCode(monitorModelCode) : null)
    ?? (category === "laptop" && model === "macbook_air" ? 13 : null)
    ?? (category === "tablet" ? defaultTabletScreenSizeIn(model) : null);
  const watchSizeMm = parseWatchSizeMm(text) ?? defaultWatchSizeMm(model);
  const explicitChip = parseChip(title) ?? parseChip(text);
  const chip = explicitChip
    ?? (category === "tablet" ? parseTabletGenerationChip(text, model, screenSizeIn) : null)
    ?? (category === "laptop" ? (parseLgGramChipFromModelNumber(text) ?? laptopModelHint?.chip ?? null) : null);
  const laptopMemoryDefault = defaultLaptopMemory(category, model, chip, screenSizeIn, text);
  const ramGb = parsedRamGb ?? laptopMemoryDefault.ramGb;
  const ssdGb = parsedSsdGb ?? laptopMemoryDefault.ssdGb;
  const batteryHealth = parseBatteryHealth(text);
  const batteryCycles = parseBatteryCycles(text);
  const connectivity = parseConnectivity(title) ?? parseConnectivity(description) ?? defaultConnectivity(model) ?? (category === "tablet" ? "wifi" : null);
  const carrier = parseCarrier(text);
  const airpodsConnector = category === "earphone"
    ? (parseAirpodsConnector(title) ?? parseAirpodsConnector(description) ?? defaultAirpodsConnector(model, text))
    : null;
  const airpodsNoiseControl = category === "earphone" ? parseAirpodsNoiseControl(model, text) : null;
  const airpodsMaxGeneration = category === "earphone" ? parseAirpodsMaxGeneration(model, text) : null;
  const airpodsMaxFullProductContext =
    category === "earphone" && model?.includes("airpods_max")
      ? hasAirpodsMaxFullProductContext(text)
      : false;
  const monitorResolution = category === "monitor"
    ? (parseMonitorResolution(title) ?? parseMonitorResolution(text) ?? monitorModelHint?.monitorResolution ?? null)
    : null;
  const monitorRefreshRate = category === "monitor"
    ? (parseMonitorRefreshRate(title) ?? parseMonitorRefreshRate(text) ?? monitorModelHint?.monitorRefreshRate ?? null)
    : null;
  const monitorPanelType = category === "monitor"
    ? (parseMonitorPanelType(title) ?? parseMonitorPanelType(text) ?? monitorModelHint?.monitorPanelType ?? null)
    : null;
  const monitorShape = category === "monitor"
    ? (parseMonitorShape(title) ?? parseMonitorShape(text) ?? monitorModelHint?.monitorShape ?? null)
    : null;
  const { conditionScore, conditionNotes } = conditionFromText(text, batteryHealth, batteryCycles);
  const tabletBundlePriceReview = category === "tablet" && hasTabletBundlePriceReview(text);
  const parts = comparableParts({
    category,
    family,
    model,
    releaseYear,
    laptopModelNumber,
    storageGb,
    ramGb,
    ssdGb,
    screenSizeIn,
    chip,
    connectivity,
    carrier,
    watchSizeMm,
    airpodsConnector,
    airpodsNoiseControl,
    monitorModelCode,
    monitorResolution,
    monitorRefreshRate,
    monitorPanelType,
    monitorShape,
  });
  const comparableKey = parts?.map(slug).join("|") ?? null;
  const parseConfidence = confidence({
    category,
    model,
    releaseYear,
    laptopModelNumber,
    storageGb,
    ramGb,
    ssdGb,
    screenSizeIn,
    chip,
    connectivity,
    carrier,
    watchSizeMm,
    airpodsConnector,
    airpodsNoiseControl,
    airpodsMaxGeneration,
    monitorModelCode,
    monitorResolution,
    monitorRefreshRate,
    monitorPanelType,
    monitorShape,
    batteryHealth,
    batteryCycles,
  });
  const variantKey = parts ? parts.slice(2).join(" / ") : null;
  const criticalUnknown = criticalUnknowns(category, comparableKey);
  const needsReview = parseConfidence < 0.65
    || criticalUnknown.length > 0
    || tabletBundlePriceReview
    || airpodsMaxGeneration === "unknown_generation"
    || (airpodsMaxGeneration === "max_lightning" && !airpodsMaxFullProductContext)
    || (category === "monitor" && !monitorModelCode)
    || !comparableKey;

  return {
    parserVersion: PARSER_VERSION,
    contentHash: hashText(`${title}\n${description.slice(0, 1200)}`),
    category,
    family,
    model,
    variantKey,
    comparableKey,
    storageGb,
    ramGb,
    ssdGb,
    screenSizeIn,
    chip,
    releaseYear,
    batteryHealth,
    batteryCycles,
    carrier,
    connectivity,
    conditionScore,
    conditionNotes,
    parseConfidence,
    needsReview,
    parsedJson: {
      watch_size_mm: watchSizeMm,
      airpods_connector: airpodsConnector,
      airpods_noise_control: airpodsNoiseControl,
      airpods_max_generation: airpodsMaxGeneration,
      airpods_max_full_product_context: airpodsMaxFullProductContext,
      monitor_brand: monitorBrand,
      monitor_model_code: monitorModelCode,
      monitor_resolution: monitorResolution,
      monitor_refresh_rate_hz: monitorRefreshRate,
      monitor_panel_type: monitorPanelType,
      monitor_shape: monitorShape,
      monitor_model_hint: monitorModelHint,
      laptop_model_number: laptopModelNumber,
      laptop_model_hint: laptopModelHint,
      inferred_release_year: parsedReleaseYear == null && releaseYear != null,
      inferred_screen_size: parsedScreenSizeIn == null && screenSizeIn != null,
      raw_sku_id: input.skuId ?? null,
      raw_sku_name: input.skuName ?? null,
      unknown_parts: comparableKey?.split("|").filter((part) => part.startsWith("unknown_")) ?? [],
      critical_unknown: criticalUnknown,
      tablet_bundle_price_review: tabletBundlePriceReview,
      condition_notes: conditionNotes,
    },
  };
}

// ─── Narrow lane reject rules ────────────────────────────────────────────────
// Scoped to specific narrow lanes only. Do not extend to broad categories —
// broad smartphone/headphone/laptop pipelines go through AI L2 (Agent A).
// Mined and verified by Agent D against 200+ samples per lane.

export type NarrowLaneKey =
  | "ipad_pro_11_m4_256_wifi"
  | "sony_wh1000xm4"
  | "iphone_15_pro_128gb_self";

export type NarrowLaneEvaluation = {
  laneKey: NarrowLaneKey;
  parseReady: boolean;
  rejectReasons: string[];
};

type NarrowLaneRule = {
  laneKey: NarrowLaneKey;
  acceptAll: RegExp[];
  reject: { label: string; pattern: RegExp }[];
};

const NARROW_LANE_RULES: Record<NarrowLaneKey, NarrowLaneRule> = {
  ipad_pro_11_m4_256_wifi: {
    laneKey: "ipad_pro_11_m4_256_wifi",
    acceptAll: [/m4/i, /256/, /아이패드|ipad/i],
    reject: [
      { label: "wrong_chip_m1_m2_m3", pattern: /\bm[123]\b|m1\s*칩|m2\s*칩|m3\s*칩/i },
      { label: "wrong_storage_512_1tb_2tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|2\s*tb|1\s*테라|2\s*테라/i },
      { label: "wrong_storage_128", pattern: /(?:^|[^0-9])128\s*(?:gb|기가)?\b/i },
      { label: "wrong_size_13_inch", pattern: /13\s*인치|12\.9\s*인치|13"|13″/ },
      { label: "cellular_variant", pattern: /셀룰러|cellular|\blte\b|\b5g\b|유심|sim\s*트레이|esim/i },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품|개별)|필름\s*(?:만|단품)|키보드\s*만|펜슬\s*만|어댑터\s*만|충전기\s*만/i },
      { label: "case_or_smart_folio_listing", pattern: /(?:스마트\s*폴리오|스마트\s*커버|폴리오\s*케이스).{0,8}판매|매직\s*키보드\s*판매/i },
      { label: "broken_or_parts_only", pattern: /액정\s*파손|부품\s*용|부품용|파손\s*품/i },
      { label: "buying_post", pattern: /매입|삽니다|구매\s*합니다|구매합니다|사요|구해요/ },
      { label: "ipad_air_or_mini", pattern: /아이패드\s*에어|ipad\s*air|아이패드\s*미니|ipad\s*mini/i },
    ],
  },
  sony_wh1000xm4: {
    laneKey: "sony_wh1000xm4",
    acceptAll: [/1000\s*xm4|wh\s*-?\s*1000\s*xm4|\bxm4\b/i],
    reject: [
      { label: "wrong_gen_xm3", pattern: /1000\s*xm3|wh\s*-?\s*1000\s*xm3|\bxm3\b/i },
      { label: "wrong_gen_xm5", pattern: /1000\s*xm5|wh\s*-?\s*1000\s*xm5|\bxm5\b/i },
      { label: "wrong_gen_xm6", pattern: /1000\s*xm6|\bxm6\b/i },
      { label: "case_only", pattern: /케이스\s*(?:만|단품|개별)|하드\s*케이스\s*만|파우치\s*만|보관\s*케이스\s*만/ },
      { label: "earpad_only", pattern: /이어\s*패드(?:\s*만|\s*교체|\s*단품)?|패드\s*교체용|쿠션\s*교체|패드만\s*판매/ },
      { label: "charger_or_cable_only", pattern: /충전기\s*만|케이블\s*만|usb\s*케이블\s*만|어댑터\s*만/i },
      { label: "parts_only", pattern: /부품\s*용|부품용|파트\s*만|리퍼\s*부품|단자\s*만|힌지\s*부품/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "wrong_product_earbuds", pattern: /무선\s*이어폰|이어버드|wf\s*-?\s*1000|linkbuds/i },
      { label: "wrong_product_neckband", pattern: /넥밴드|wi\s*-?\s*c\d{3}|sp\s*510/i },
      { label: "non_sony_clone", pattern: /짝퉁|가품|복제품|레플리카/ },
      { label: "broken", pattern: /고장|불량\s*품|파손\s*품|작동\s*안\s*됨|소리\s*안\s*나/ },
    ],
  },
  iphone_15_pro_128gb_self: {
    laneKey: "iphone_15_pro_128gb_self",
    acceptAll: [/아이폰\s*15\s*프로|iphone\s*15\s*pro/i],
    reject: [
      { label: "wrong_model_pro_max", pattern: /프로\s*맥스|promax|pro\s*max|프맥/i },
      { label: "wrong_model_15_base_or_plus", pattern: /아이폰\s*15\s*플러스|iphone\s*15\s*plus|아이폰\s*15\s*기본/i },
      { label: "wrong_model_14", pattern: /아이폰\s*14|iphone\s*14/i },
      { label: "wrong_model_16", pattern: /아이폰\s*16|iphone\s*16/i },
      { label: "wrong_storage_64", pattern: /(?:^|[^0-9])64\s*(?:gb|기가)\b/i },
      { label: "wrong_storage_256", pattern: /(?:^|[^0-9])256\s*(?:gb|기가)?\b/i },
      { label: "wrong_storage_512_1tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|1\s*테라/i },
      { label: "carrier_skt", pattern: /\bskt\b|sk\s*텔레콤|에스케이\s*텔레콤/ },
      { label: "carrier_kt", pattern: /(?:^|\s)kt\s*(?:완납|개통|약정|이동|번호|요금|승계|유심)|케이티\s*개통|kt\s*전용/i },
      { label: "carrier_lg", pattern: /\blgu\+?|\blg\s*u\+?|유플\s*러스|엘지\s*유플|엘지유플|lg\s*전용/i },
      { label: "carrier_locked_generic", pattern: /통신사\s*(?:개통|이동|전용|확정)|번호\s*이동|약정\s*(?:승계|진행|걸|남)|선택\s*약정|공시\s*지원|완납\s*폰|완납폰|제휴\s*카드|할부\s*승계|할부\s*원금|할부\s*잔여|개통\s*후|확정\s*기변|확정기변/ },
      { label: "broken_or_parts", pattern: /액정\s*파손|부품\s*용|부품용|파손\s*품|침수|배터리\s*교체\s*요망/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "refurbished_only", pattern: /리퍼\s*폰|리퍼폰|리퍼\s*제품|리퍼\s*수령/ },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품)|필름\s*(?:만|단품)|충전기\s*만|보호\s*필름\s*만/ },
    ],
  },
};

function normalizeForNarrowLane(text: string): string {
  return (text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/[^0-9a-z가-힣./\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function evaluateNarrowLane(
  laneKey: NarrowLaneKey,
  input: { title: string; description?: string },
): NarrowLaneEvaluation {
  const rule = NARROW_LANE_RULES[laneKey];
  if (!rule) {
    return { laneKey, parseReady: false, rejectReasons: ["unknown_lane"] };
  }
  const text = normalizeForNarrowLane(`${input.title}\n${input.description ?? ""}`);
  const rejectReasons: string[] = [];

  for (const pattern of rule.acceptAll) {
    if (!pattern.test(text)) rejectReasons.push(`missing_${pattern.source.slice(0, 24).replace(/[^a-z0-9가-힣]+/gi, "_")}`);
  }
  for (const rejectRule of rule.reject) {
    if (rejectRule.pattern.test(text)) rejectReasons.push(`reject_${rejectRule.label}`);
  }
  return {
    laneKey,
    parseReady: rejectReasons.length === 0,
    rejectReasons,
  };
}

export function toParsedListingRow(pid: number | string, parsed: ParsedListingOptions) {
  return {
    pid: Number(pid),
    parser_version: parsed.parserVersion,
    content_hash: parsed.contentHash,
    category: parsed.category,
    family: parsed.family,
    model: parsed.model,
    variant_key: parsed.variantKey,
    comparable_key: parsed.comparableKey,
    storage_gb: parsed.storageGb,
    ram_gb: parsed.ramGb,
    ssd_gb: parsed.ssdGb,
    screen_size_in: parsed.screenSizeIn,
    chip: parsed.chip,
    release_year: parsed.releaseYear,
    battery_health: parsed.batteryHealth,
    battery_cycles: parsed.batteryCycles,
    carrier: parsed.carrier,
    connectivity: parsed.connectivity,
    condition_score: parsed.conditionScore,
    condition_notes: parsed.conditionNotes,
    parse_confidence: parsed.parseConfidence,
    needs_review: parsed.needsReview,
    parsed_json: parsed.parsedJson,
    parsed_at: new Date().toISOString(),
  };
}
