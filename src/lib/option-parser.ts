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

const PARSER_VERSION = "option-parser-v14";

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
    /(?:용량|스토리지|저장공간)\s*[:：]?\s*(32|64|128|256|512|1\s*tb|2\s*tb|1테라|2테라)\s*(?:gb|g|기가|테라|tb)?/,
    /\b(32|64|128|256|512)\s*(?:gb|g|기가)\b/,
    /\b([12])\s*(?:tb|테라)\b/,
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
  const pair = lower.match(/\b(8|16|24|32|36|48|64|96|128)\s*\/\s*(128|250|256|500|512|1\s*t|1\s*tb|2\s*t|2\s*tb|4\s*t|4\s*tb|1테라|2테라|4테라)\b/);
  const pairWithUnits = lower.match(/\b(8|16|24|32|36|48|64|96|128)\s*(?:gb|g|기가)?\s*\/\s*(128|250|256|500|512|1\s*t|1\s*tb|2\s*t|2\s*tb|4\s*t|4\s*tb|1테라|2테라|4테라)\s*(?:gb|g|기가|t|tb|테라)?\b/);
  const looseLaptopPair = category === "laptop"
    ? lower.match(/\b(8|16|24|32|36|48|64|96|128)\s+(128|256|500|512)\b/)
    : null;
  const adjacentLaptopPair = category === "laptop"
    ? lower.match(/\b(8|16|24|32|36|48|64|96|128)\s*(?:gb|g|기가)\s+(121|128|250|256|500|512|1\s*t|1\s*tb|2\s*t|2\s*tb|4\s*t|4\s*tb|1테라|2테라|4테라)\s*(?:gb|g|기가|t|tb|테라|ssd)?\b/)
    : null;
  const reversedPair = category === "laptop"
    ? lower.match(/\b(128|250|256|500|512|1\s*t|1\s*tb|2\s*t|2\s*tb|4\s*t|4\s*tb|1테라|2테라|4테라)\s*(?:gb|g|기가|t|tb|테라)?\s+(8|16|24|32|36|48|64|96|128)\s*(?:gb|g|기가)?\b/)
    : null;
  const ramExplicit = lower.match(/(?:램|ram|memory|메모리|통합\s*메모리)\s*[:：]?\s*(8|16|24|32|36|48|64|96|128)\s*(?:gb|g|기가)?/);
  const ramSuffix = lower.match(/\b(8|16|24|32|36|48|64|96|128)\s*(?:(?:gb|g|기가)\s*)?(?:램|ram|memory|메모리|통합\s*메모리)\b/);
  const ramBeforeMemory = lower.match(/\b(8|16|24|32|36|48|64|96|128)\s*(?:gb|g|기가)\b(?=.{0,16}(?:통합\s*메모리|메모리|램|ram))/);
  const ramBeforeSsd = category === "laptop"
    ? lower.match(/\b(8|16|24|32|36|48|64|96|128)\s*(?:gb|g|기가)\b(?=.{0,20}(?:ssd|저장공간|스토리지))/)
    : null;
  const singleLaptopRam = category === "laptop"
    ? lower.match(/\b(8|16|24|32|36|48|64|96|128)\s*(?:gb|g|기가)\b/)
    : null;
  const ssdExplicit = lower.match(/(?:ssd|용량|저장\s*공간|저장공간|저장\s*장치|스토리지)\s*[:：]?\s*(121|128|250|256|500|512|1\s*t|1\s*tb|2\s*t|2\s*tb|4\s*t|4\s*tb|1테라|2테라|4테라)\s*(?:gb|g|기가|t|tb|테라)?/);
  const ssdSuffix = lower.match(/\b(121|128|250|256|500|512|1\s*t|1\s*tb|2\s*t|2\s*tb|4\s*t|4\s*tb|1테라|2테라|4테라)\s*(?:gb|g|기가|t|tb|테라)\s*(?:ssd|용량|저장\s*공간|저장공간|저장\s*장치|스토리지)?\b/);
  const ramGb = parseGb(ramExplicit?.[1] ?? ramSuffix?.[1] ?? ramBeforeMemory?.[1] ?? ramBeforeSsd?.[1] ?? pairWithUnits?.[1] ?? pair?.[1] ?? adjacentLaptopPair?.[1] ?? looseLaptopPair?.[1] ?? reversedPair?.[2] ?? singleLaptopRam?.[1]);
  const bareLaptopSsd = category === "laptop"
    ? lower.match(/(?:^|[^0-9])(121|128|250|256|500|512)(?:[^0-9]|$)/)
    : null;
  const compactSsd = category === "laptop"
    ? lower.match(/\b(121|128|250|256|500|512)\s*ssd\b/)
    : null;
  const teraSsd = category === "laptop"
    ? lower.match(/\b([124])\s*(?:t|tb|테라)\b/)
    : null;
  const ssdGb = parseGb(ssdExplicit?.[1] ?? pairWithUnits?.[2] ?? pair?.[2] ?? adjacentLaptopPair?.[2] ?? looseLaptopPair?.[2] ?? reversedPair?.[1] ?? ssdSuffix?.[1] ?? compactSsd?.[1] ?? teraSsd?.[0] ?? bareLaptopSsd?.[1]);
  return { ramGb, ssdGb };
}

function parseScreenSizeIn(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = lower.match(/(?:^|[^0-9])(8\.3|10\.2|10\.5|10\.9|11|12\.4|12\.9|13|13\.3|14|14\.6|15|15\.6|16|17)\s*(?:인치|inch|"|형)/);
  return match ? Number(match[1]) : null;
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
  if (id.startsWith("ipad_")) return id;
  if (id.startsWith("galaxy_tab")) return id;
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
  if (model.includes("ipad")) return "ipad";
  if (model.includes("galaxy_tab")) return "galaxy_tab";
  if (model.includes("macbook")) return "macbook";
  if (model.includes("applewatch")) return "applewatch";
  if (model.includes("galaxywatch")) return "galaxywatch";
  if (model.includes("airpods")) return "airpods";
  return category;
}

function parseAirpodsConnector(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/usb\s*-?\s*c|usbc|c타입|타입c|씨타입|타입씨|c-type|ctype|c터입/.test(lower)) return "usbc";
  if (/라이트닝|lightning|8핀|8\s*핀/.test(lower)) return "lightning";
  return null;
}

function defaultAirpodsConnector(model: string | null, text: string) {
  const lower = normalize(text).toLowerCase();
  if (!model?.includes("airpods")) return null;
  if (model.includes("airpods_pro_2_usbc") || model.includes("airpods_4")) return "usbc";
  if (
    model.includes("airpods_2") ||
    model.includes("airpods_3") ||
    model.includes("airpods_pro_1") ||
    model.includes("airpods_pro_2_lightning")
  ) return "lightning";
  if (model.includes("airpods_max")) {
    if (/2024|c타입|타입c|usb\s*-?\s*c|usbc|ctype/.test(lower)) return "usbc";
    if (/맥스\s*2|맥스2|max\s*2|max2|2세대|2 세대/.test(lower)) return "usbc";
    if (/1세대|1 세대|8핀|8\s*핀|라이트닝|lightning/.test(lower)) return "lightning";
  }
  return null;
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
  if (model === "ipad_mini") return 8.3;
  if (model === "ipad_10") return 10.9;
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

  if (/리퍼|리퍼폰|리퍼\s*교체|부분\s*수리|사설\s*수리|사설수리/.test(lower)) add("refurbished_or_repaired", -0.15);
  if (/(액정|디스플레이|화면).{0,16}(교체|수리)|(?:교체|수리).{0,16}(액정|디스플레이|화면)/.test(lower)) add("screen_replaced", -0.12);
  const noDisplayDefect = /무잔상|잔상\s*(?:없|없음|없습니다|전혀\s*없)|번인\s*(?:없|없음|없습니다)/.test(lower);
  if (!noDisplayDefect && /잔상|번인|burn\s*in|녹조|흑점|멍|터치\s*불량|터치불량/.test(lower)) add("display_defect", -0.25);
  const noFaceIdIssue = /(페이스\s*아이디|face\s*id|faceid).{0,30}(문제\s*(?:없|없음|없고|없습니다)|정상|잘\s*됨|작동)|기능에\s*아무\s*문제\s*없/.test(lower);
  if (!noFaceIdIssue && /(페이스\s*아이디|face\s*id|faceid).{0,20}(안됨|불가|고장|불량|문제|수리)|(?:안됨|불가|고장|불량|문제|수리).{0,20}(페이스\s*아이디|face\s*id|faceid)/.test(lower)) add("faceid_issue", -0.25);
  if (/(카메라|전면|후면).{0,20}(안됨|불가|고장|불량|흔들림|초점\s*불량|초점불량)|(?:안됨|불가|고장|불량|흔들림|초점\s*불량|초점불량).{0,20}(카메라|전면|후면)/.test(lower)) add("camera_issue", -0.2);
  if (/(유심|sim).{0,20}(인식\s*불|인식불|안됨|불가|락)|(?:인식\s*불|인식불|안됨|불가|락).{0,20}(유심|sim)/.test(lower)) add("sim_or_carrier_issue", -0.2);
  const noWaterDamage = /침수(?:폰)?\s*(?:없|없음|없습니다|아님|일절\s*취급하지|취급하지\s*않)|침수\s*라벨\s*(?:정상|깨끗)/.test(lower);
  if (!noWaterDamage && /침수|물\s*들어|물먹|물\s*먹/.test(lower)) add("water_damage", -0.35);
  const noLostOrLocked = /분실\s*도난\s*침수폰?\s*일절\s*취급하지|분실\s*(?:없|없음|신고\s*없)|도난\s*(?:없|없음)|분실.{0,8}도난.{0,16}검수\s*완료|정상\s*해지|정상해지/.test(lower);
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
  if (category === "smartphone") {
    return [family, model, input.storageGb ? `${input.storageGb}gb` : "unknown_storage"];
  }
  if (category === "tablet") {
    return [
      family,
      model,
      input.screenSizeIn ? `${input.screenSizeIn}in` : "unknown_screen",
      input.storageGb ? `${input.storageGb}gb` : "unknown_storage",
      input.connectivity ?? "unknown_connectivity",
    ];
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
    score += input.airpodsConnector ? 0.25 : 0.12;
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
    return parts.filter((part) => ["unknown_screen", "unknown_storage", "unknown_connectivity"].includes(part));
  }
  if (category === "laptop") {
    return parts.filter((part) => ["unknown_chip", "unknown_ram", "unknown_ssd"].includes(part));
  }
  if (category === "smartwatch") {
    return parts.filter((part) => part === "unknown_size");
  }
  if (category === "earphone") {
    return parts.filter((part) => part === "unknown_connector");
  }
  return parts;
}

export function parseListingOptions(input: ParseInput): ParsedListingOptions {
  const title = input.title ?? "";
  const description = input.description ?? "";
  const text = `${title}\n${description.slice(0, 1200)}`;
  const category = input.category ?? null;
  const model = modelFromSku(input.skuId, input.skuName);
  const family = familyFrom(category, model);
  const storageGb = parseStorageGb(title, category) ?? parseLooseDeviceStorageGb(title, category) ?? parseStorageGb(text, category);
  const titleMemory = parseRamAndSsd(title, category);
  const combinedMemory = parseRamAndSsd(text, category);
  const parsedRamGb = titleMemory.ramGb ?? combinedMemory.ramGb;
  const parsedSsdGb = titleMemory.ssdGb ?? combinedMemory.ssdGb;
  const parsedScreenSizeIn = category === "laptop"
    ? (parseLaptopScreenSizeIn(title) ?? parseLaptopScreenSizeIn(text))
    : (parseScreenSizeIn(title) ?? parseScreenSizeIn(text));
  const screenSizeIn = parsedScreenSizeIn
    ?? (category === "laptop" && model === "macbook_air" ? 13 : null)
    ?? (category === "tablet" ? defaultTabletScreenSizeIn(model) : null);
  const watchSizeMm = parseWatchSizeMm(text) ?? defaultWatchSizeMm(model);
  const chip = parseChip(title) ?? parseChip(text);
  const laptopMemoryDefault = defaultLaptopMemory(category, model, chip, screenSizeIn, text);
  const ramGb = parsedRamGb ?? laptopMemoryDefault.ramGb;
  const ssdGb = parsedSsdGb ?? laptopMemoryDefault.ssdGb;
  const batteryHealth = parseBatteryHealth(text);
  const batteryCycles = parseBatteryCycles(text);
  const connectivity = parseConnectivity(title) ?? parseConnectivity(description) ?? defaultConnectivity(model);
  const carrier = parseCarrier(text);
  const airpodsConnector = parseAirpodsConnector(title) ?? parseAirpodsConnector(description) ?? defaultAirpodsConnector(model, text);
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
  const criticalUnknown = criticalUnknowns(category, comparableKey);
  const needsReview = parseConfidence < 0.65 || criticalUnknown.length > 0 || !comparableKey;

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
      inferred_screen_size: parsedScreenSizeIn == null && screenSizeIn != null,
      raw_sku_id: input.skuId ?? null,
      raw_sku_name: input.skuName ?? null,
      unknown_parts: comparableKey?.split("|").filter((part) => part.startsWith("unknown_")) ?? [],
      critical_unknown: criticalUnknown,
      condition_notes: conditionNotes,
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
