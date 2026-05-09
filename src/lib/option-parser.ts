import { createHash } from "node:crypto";

import { normalize, type Sku } from "@/lib/catalog";

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

const PARSER_VERSION = "option-parser-v1";

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
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
  const num = Number(lower.match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(num)) return null;
  if (/tb|테라/.test(lower)) return Math.round(num * 1024);
  return Math.round(num);
}

function parseStorageGb(text: string, category: Sku["category"] | null) {
  const lower = normalize(text).toLowerCase();
  const storage = firstMatch(lower, [
    /(?:용량|스토리지|저장공간)\s*[:：]?\s*(64|128|256|512|1\s*tb|2\s*tb|1테라|2테라)\s*(?:gb|g|기가|테라|tb)?/,
    /\b(64|128|256|512)\s*(?:gb|g|기가)\b/,
    /\b([12])\s*(?:tb|테라)\b/,
  ]);
  if (storage) return parseGb(storage[1]);

  if (category === "smartphone" || category === "tablet") {
    const bare = lower.match(/(?:^|[^0-9])(64|128|256|512)(?:[^0-9]|$)/);
    return parseGb(bare?.[1]);
  }
  return null;
}

function parseRamAndSsd(text: string) {
  const lower = normalize(text).toLowerCase();
  const pair = lower.match(/\b(8|16|24|32|36|48|64|96|128)\s*\/\s*(128|256|512|1\s*tb|2\s*tb|4\s*tb|1테라|2테라|4테라)\b/);
  const ramExplicit = lower.match(/(?:램|ram|memory|메모리)\s*[:：]?\s*(8|16|24|32|36|48|64|96|128)\s*(?:gb|g|기가)?/);
  const ramSuffix = lower.match(/\b(8|16|24|32|36|48|64|96|128)\s*(?:gb|g|기가)\s*(?:램|ram|memory|메모리)\b/);
  const ssdExplicit = lower.match(/(?:ssd|용량|저장공간|스토리지)\s*[:：]?\s*(128|256|512|1\s*tb|2\s*tb|4\s*tb|1테라|2테라|4테라)\s*(?:gb|g|기가|tb|테라)?/);
  const ssdSuffix = lower.match(/\b(128|256|512|1\s*tb|2\s*tb|4\s*tb|1테라|2테라|4테라)\s*(?:gb|g|기가|tb|테라)\s*(?:ssd|용량|저장공간|스토리지)?\b/);
  return {
    ramGb: parseGb(ramExplicit?.[1] ?? ramSuffix?.[1] ?? pair?.[1]),
    ssdGb: parseGb(ssdExplicit?.[1] ?? pair?.[2] ?? ssdSuffix?.[1]),
  };
}

function parseScreenSizeIn(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = lower.match(/\b(11|12\.9|13|13\.3|14|15|16|17)\s*(?:인치|inch|")/);
  return match ? Number(match[1]) : null;
}

function parseWatchSizeMm(text: string) {
  const match = normalize(text).toLowerCase().match(/\b(40|41|42|44|45|46|47|49)\s*mm\b/);
  return match ? Number(match[1]) : null;
}

function parseChip(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = firstMatch(lower, [
    /\b(m[1-5])\s*(ultra|max|pro)?\b/,
    /\b(i[3579])\s*(?:-| )?(\d{4,5}[a-z]*)?\b/,
  ]);
  if (!match) return null;
  return slug([match[1], match[2]].filter(Boolean).join(" "));
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
  if (/gps|블루투스|bluetooth|bt/.test(lower)) return "gps";
  if (/와이파이|wifi|wi-fi/.test(lower)) return "wifi";
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
  if (id.startsWith("macbook_air")) return "macbook_air";
  if (id.startsWith("macbook_pro")) return "macbook_pro";
  if (id.startsWith("applewatch")) return id;
  if (id.startsWith("galaxywatch")) return id;
  if (id.startsWith("airpods")) return id;
  return name || id || null;
}

function familyFrom(category: Sku["category"] | null, model: string | null) {
  if (!model) return null;
  if (model.includes("iphone")) return "iphone";
  if (model.includes("galaxy_s")) return "galaxy_s";
  if (model.includes("macbook")) return "macbook";
  if (model.includes("applewatch")) return "applewatch";
  if (model.includes("galaxywatch")) return "galaxywatch";
  if (model.includes("airpods")) return "airpods";
  return category;
}

function parseAirpodsConnector(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/usb\s*-?\s*c|usbc|c타입|타입c|씨타입|타입씨|c-type|ctype/.test(lower)) return "usbc";
  if (/라이트닝|lightning|8핀|8\s*핀/.test(lower)) return "lightning";
  return null;
}

function conditionFromText(text: string, batteryHealth: number | null, cycles: number | null) {
  const lower = normalize(text).toLowerCase();
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
  if (/수리|교체|하자|고장|불량|파손|깨짐/.test(lower)) add("repair_or_defect_signal", -0.2);
  if (batteryHealth != null && batteryHealth < 85) add("low_battery_health", -0.15);
  if (cycles != null && cycles > 500) add("high_battery_cycles", -0.1);

  return {
    conditionScore: cap01(score),
    conditionNotes: [...new Set(notes)],
  };
}

function comparableParts(input: {
  category: Sku["category"] | null;
  family: string | null;
  model: string | null;
  storageGb: number | null;
  ramGb: number | null;
  ssdGb: number | null;
  screenSizeIn: number | null;
  chip: string | null;
  connectivity: string | null;
  carrier: string | null;
  watchSizeMm: number | null;
  airpodsConnector: string | null;
}) {
  const { category, family, model } = input;
  if (!category || !family || !model) return null;
  if (category === "smartphone" || category === "tablet") {
    return [family, model, input.storageGb ? `${input.storageGb}gb` : "unknown_storage"];
  }
  if (category === "laptop") {
    return [
      family,
      model,
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
    return [family, model, input.airpodsConnector ?? "unknown_connector"];
  }
  return [family, model];
}

function confidence(input: {
  category: Sku["category"] | null;
  model: string | null;
  storageGb: number | null;
  ramGb: number | null;
  ssdGb: number | null;
  screenSizeIn: number | null;
  chip: string | null;
  connectivity: string | null;
  carrier: string | null;
  watchSizeMm: number | null;
  airpodsConnector: string | null;
  batteryHealth: number | null;
  batteryCycles: number | null;
}) {
  if (!input.category || !input.model) return 0.2;
  let score = 0.45;
  if (input.category === "smartphone" || input.category === "tablet") {
    if (input.storageGb) score += 0.3;
    if (input.batteryHealth || input.batteryCycles) score += 0.1;
    if (input.connectivity || input.carrier) score += 0.05;
  } else if (input.category === "laptop") {
    if (input.chip) score += 0.18;
    if (input.screenSizeIn) score += 0.14;
    if (input.ramGb) score += 0.14;
    if (input.ssdGb) score += 0.14;
    if (input.batteryCycles) score += 0.05;
  } else if (input.category === "smartwatch") {
    if (input.watchSizeMm) score += 0.18;
    if (input.connectivity) score += 0.12;
    if (input.batteryHealth) score += 0.05;
  } else if (input.category === "earphone") {
    score += input.airpodsConnector ? 0.25 : 0.12;
  }
  return cap01(score);
}

export function parseListingOptions(input: ParseInput): ParsedListingOptions {
  const title = input.title ?? "";
  const description = input.description ?? "";
  const text = `${title}\n${description.slice(0, 1200)}`;
  const category = input.category ?? null;
  const model = modelFromSku(input.skuId, input.skuName);
  const family = familyFrom(category, model);
  const storageGb = parseStorageGb(text, category);
  const { ramGb, ssdGb } = parseRamAndSsd(text);
  const screenSizeIn = parseScreenSizeIn(text);
  const watchSizeMm = parseWatchSizeMm(text);
  const chip = parseChip(text);
  const batteryHealth = parseBatteryHealth(text);
  const batteryCycles = parseBatteryCycles(text);
  const connectivity = parseConnectivity(text);
  const carrier = parseCarrier(text);
  const airpodsConnector = parseAirpodsConnector(text);
  const { conditionScore, conditionNotes } = conditionFromText(text, batteryHealth, batteryCycles);
  const parts = comparableParts({
    category,
    family,
    model,
    storageGb,
    ramGb,
    ssdGb,
    screenSizeIn,
    chip,
    connectivity,
    carrier,
    watchSizeMm,
    airpodsConnector,
  });
  const comparableKey = parts?.map(slug).join("|") ?? null;
  const parseConfidence = confidence({
    category,
    model,
    storageGb,
    ramGb,
    ssdGb,
    screenSizeIn,
    chip,
    connectivity,
    carrier,
    watchSizeMm,
    airpodsConnector,
    batteryHealth,
    batteryCycles,
  });
  const variantKey = parts ? parts.slice(2).join(" / ") : null;
  const needsReview = parseConfidence < 0.7 || Boolean(comparableKey?.includes("unknown_"));

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
    releaseYear: null,
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
      raw_sku_id: input.skuId ?? null,
      raw_sku_name: input.skuName ?? null,
      critical_unknown: comparableKey?.split("|").filter((part) => part.startsWith("unknown_")) ?? [],
    },
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
