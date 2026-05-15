// Wave 92 (2026-05-15): shoe/bag/bike 카테고리 parser.
// 테크와 다른 결정 변수 — 사이즈/컨디션/era/사고이력이 가격 결정 핵심.
// 단순 모델 매칭만으론 시세 비교 불가능 → comparable_key 신규 설계.
//
// 정책:
// - 셀러 표기 grade는 1단계 깎아 인식 (셀러 항상 자기 매물 과대평가).
// - 사이즈 추출 못 하면 needs_review (사용자 체형/발 매칭 위험).
// - 자전거 사고/크랙은 즉시 reject (가격 시세 무의미).

import type { ParsedListingOptions } from "@/lib/option-parser";
import type { Sku } from "@/lib/catalog";

// option-parser.ts의 ParseInput과 동일 (모듈 내부 타입이라 재정의).
type ParseInput = {
  title: string;
  description?: string;
  skuId?: string | null;
  skuName?: string | null;
  category?: Sku["category"] | null;
};

// ─── 공통 헬퍼 ───────────────────────────────────────────────────────

export type ConditionTier = "s_grade" | "a_grade" | "b_grade" | "c_grade" | "reject" | null;

// 컨디션 표현 텍스트 → 정량 grade.
// 셀러 표기는 1단계 깎음 (관용적 인플레 보정).
export function parseConditionTier(text: string): ConditionTier {
  const t = text.toLowerCase();
  // 부적격 (reject)
  if (/파손|크랙|찢어짐|구멍|얼룩 심함|변색 심함|곰팡이|악취|냄새 심함|손상|수리 필요/.test(t)) return "reject";
  // S급 (객관적 새상품 신호) — 셀러 표기와 무관
  if (/미개봉|봉인|택그대로|tag\s*on|tagon|새상품(?!\s*[abc])|민트|한번도\s*안\s*(신음|입음|멤|탐|사용)|미사용/.test(t)) return "s_grade";
  // 셀러 표기 — 1단계 깎음
  if (/[sS]급|[sS]\s*그레이드|급s급|특s급/.test(text)) return "a_grade";
  if (/[aA]급|[aA]\s*그레이드/.test(text)) return "b_grade";
  if (/[bB]급|[bB]\s*그레이드/.test(text)) return "c_grade";
  // 사용감 표현
  if (/거의\s*(새|안\s*신|안\s*입|안\s*들|안\s*탐)|1\s*[~-]?\s*2\s*번\s*(신|입|들|탐)/.test(t)) return "a_grade";
  if (/사용감\s*적|약간\s*사용|잔기스|컨디션\s*좋/.test(t)) return "b_grade";
  if (/사용감\s*있|많이\s*사용|보풀|색바램|변색/.test(t)) return "c_grade";
  return null;
}

// ─── 신발 ────────────────────────────────────────────────────────────

// 신발 사이즈 추출 (230~309mm). 부적격: 키즈/유아 사이즈.
export function parseShoeSizeMm(text: string): number | null {
  // "270mm", "270 사이즈", "사이즈 270", "270" (3자리 숫자)
  // 키즈 차단: 150~220 범위는 제외
  const patterns: RegExp[] = [
    /(?:사이즈|size|싸이즈)\s*[:\-]?\s*(2[3-9]\d|30\d)(?!\d)/i,
    /(2[3-9]\d|30\d)\s*(?:mm|사이즈|size|싸이즈)/i,
    /\b(2[3-9]\d|30\d)\b(?![\d.])/, // bare 3-digit
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n >= 230 && n <= 309) return n;
    }
  }
  return null;
}

// 신발 박스/영수증 상태.
export function parseShoeBoxStatus(text: string): "with_box" | "without_box" | "box_only" | null {
  const t = text.toLowerCase();
  if (/박스만|box\s*only/.test(t)) return "box_only";
  if (/박스\s*(없음|x|없)/.test(t)) return "without_box";
  if (/풀박|풀\s*박스|박스\s*포함|박스있/.test(t)) return "with_box";
  return null;
}

function parseShoeOptions(text: string) {
  const sizeMm = parseShoeSizeMm(text);
  const conditionTier = parseConditionTier(text);
  const boxStatus = parseShoeBoxStatus(text);
  // 키즈/유아 사이즈 오염 차단
  const isKids = /\b(키즈|유아|아동|td|ps|kids|toddler)\b/i.test(text);
  return { sizeMm, conditionTier, boxStatus, isKids };
}

// ─── 가방 ────────────────────────────────────────────────────────────

export type BagEra = "vintage" | "current" | null;

// 빈티지 식별 — datecode/연도/세기 키워드.
// 빈티지 vs 현행 가격대 매우 다름 (LV 스피디 25: 빈티지 40~90만 / 현행 150만+).
export function parseBagEra(text: string): BagEra {
  const t = text.toLowerCase();
  // 명시 빈티지
  if (/빈티지|vintage|올드|구형|구\s*모델/.test(t)) return "vintage";
  // 연도 — 2010년 이전 또는 90~00년대 명시
  if (/(199\d|200\d)\s*년|90년대|00년대|1990s|2000s/.test(t)) return "vintage";
  // LV datecode (3~4자리 영문+숫자, "VI", "SR", "AR" 등 옛 코드)
  if (/datecode|date\s*code|시리얼\s*[A-Z]{2}\d{4}/i.test(text)) return "vintage";
  // 명시 현행
  if (/현행|신상|최신|신모델|new\s*model/.test(t)) return "current";
  return null; // 불명 → 시세 비교 시 두 그룹 합치지 않음 (low confidence)
}

// 가방 사이즈 변형.
export function parseBagSizeVariant(text: string): string | null {
  // 스피디 25/30/35 같은 명시 사이즈
  const numSize = text.match(/\b(20|22|24|25|26|28|30|32|35|40)\b(?!\s*(원|만|기가|gb))/i);
  if (numSize) return numSize[1];
  // 영문 사이즈
  const wordMap: Record<string, string> = {
    "미니": "mini", "mini": "mini", "초미니": "nano",
    "스몰": "small", "small": "small", "small size": "small",
    "미디움": "medium", "medium": "medium", "medium size": "medium",
    "라지": "large", "large": "large",
    "맥시": "maxi", "max": "maxi",
    "pm": "pm", "mm": "mm", "gm": "gm",  // LV 사이즈 코드
    "bb": "bb",
  };
  const t = text.toLowerCase();
  for (const [k, v] of Object.entries(wordMap)) {
    if (new RegExp(`\\b${k}\\b`, "i").test(t)) return v;
  }
  return null;
}

function parseBagOptions(text: string) {
  const era = parseBagEra(text);
  const sizeVariant = parseBagSizeVariant(text);
  const conditionTier = parseConditionTier(text);
  // 가품 의심
  const fakeFlags = /미러|짭|짝퉁|이미테이션|복각|오라리|미러급|sa급/i.test(text);
  return { era, sizeVariant, conditionTier, fakeFlags };
}

// ─── 자전거 ──────────────────────────────────────────────────────────

// 프레임 사이즈 — 가장 중요한 가격/매칭 결정 변수.
// cm, 인치, S/M/L/XL 모두 처리.
export function parseBikeFrameSize(text: string): string | null {
  // 명시 cm 사이즈 (예: "54cm 프레임", "프레임 사이즈 54")
  const cm = text.match(/(?:프레임|frame)?\s*(?:사이즈|size)?\s*[:\-]?\s*(4[2-9]|5[0-9]|6[0-2])\s*(?:cm|센티)/i);
  if (cm) return `${cm[1]}cm`;
  // 인치 (MTB)
  const inch = text.match(/(\d{2}(?:\.5)?)\s*(?:인치|"|inch|in)\b/i);
  if (inch) {
    const n = Number(inch[1]);
    if (n >= 13 && n <= 29) return `${n}in`;
  }
  // 영문 사이즈
  const word = text.match(/\b(XS|S|M|L|XL|XXL)\s*(?:사이즈|size|프레임|frame)?\b/);
  if (word) return word[1].toUpperCase();
  return null;
}

// 사고/크랙 이력. 명시되면 reject.
export function parseBikeCrashHistory(text: string): "no_crash" | "crash" | null {
  const t = text.toLowerCase();
  if (/사고|크랙|crack|프레임\s*깨|도색만|도색\s*함|넘어진|넘어짐|충격|박살/.test(t)) return "crash";
  if (/무사고|사고\s*없음|크랙\s*없|단순\s*변속|새차/.test(t)) return "no_crash";
  return null;
}

// 년식 추출. 5년 이상 → older (가격 ↓).
export function parseBikeYearTier(text: string, nowYear: number = 2026): "recent" | "mid" | "older" | null {
  // "2023년식", "23년식", "2022 모델"
  const m = text.match(/(?:^|\D)(20[12]\d|2026)\s*(?:년|모델|식)/);
  if (m) {
    const year = Number(m[1]);
    const age = nowYear - year;
    if (age <= 2) return "recent";
    if (age <= 5) return "mid";
    return "older";
  }
  return null;
}

function parseBikeOptions(text: string) {
  const frameSize = parseBikeFrameSize(text);
  const conditionTier = parseConditionTier(text);
  const crashHistory = parseBikeCrashHistory(text);
  const yearTier = parseBikeYearTier(text);
  // 부품 단품 차단
  const partsOnly = /프레임만|포크만|휠셋만|안장만|스템만|드레일러만/.test(text);
  return { frameSize, conditionTier, crashHistory, yearTier, partsOnly };
}

// ─── 통합 dispatcher ─────────────────────────────────────────────────

const PARSER_VERSION_W92 = "wave92-fashion-mobility-v1";

function slug(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9가-힣_]/g, "").replace(/__+/g, "_");
}

function modelFromSku(skuId: string | null | undefined, _skuName: string | null | undefined): string | null {
  // skuId 예: shoe-nike-jordan-1-high-chicago → jordan_1_high_chicago
  if (!skuId) return null;
  const parts = skuId.split("-").slice(2); // brand 빼고
  return parts.length > 0 ? parts.join("_") : null;
}

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return String(hash);
}

export function parseFashionMobility(input: ParseInput): ParsedListingOptions {
  const title = input.title ?? "";
  const description = input.description ?? "";
  const text = `${title}\n${description.slice(0, 1200)}`;
  const category = input.category ?? null;
  if (category !== "shoe" && category !== "bag" && category !== "bike") {
    throw new Error(`parseFashionMobility called with non-fashion-mobility category: ${category}`);
  }

  const model = modelFromSku(input.skuId, input.skuName);
  const family = category;

  const unknownParts: string[] = [];
  const partsForKey: string[] = [family, model ?? "unknown_model"];
  const criticalUnknown: string[] = [];
  let parseConfidence = 0.45;
  const parsedJson: Record<string, unknown> = {
    raw_sku_id: input.skuId ?? null,
    raw_sku_name: input.skuName ?? null,
  };
  let needsReview = false;

  if (category === "shoe") {
    const opt = parseShoeOptions(text);
    parsedJson.shoe_size_mm = opt.sizeMm;
    parsedJson.shoe_condition_tier = opt.conditionTier;
    parsedJson.shoe_box_status = opt.boxStatus;
    parsedJson.shoe_is_kids = opt.isKids;
    if (opt.isKids) {
      needsReview = true;
      criticalUnknown.push("shoe_kids_size_mismatch");
    }
    if (opt.conditionTier === "reject") {
      needsReview = true;
      criticalUnknown.push("shoe_damage_reject");
    }
    if (opt.sizeMm != null) {
      partsForKey.push(String(opt.sizeMm));
      parseConfidence += 0.3;
    } else {
      partsForKey.push("unknown_size");
      unknownParts.push("unknown_size");
      criticalUnknown.push("unknown_size");
    }
    if (opt.conditionTier) {
      partsForKey.push(opt.conditionTier);
      parseConfidence += 0.15;
    } else {
      partsForKey.push("unknown_condition");
      unknownParts.push("unknown_condition");
    }
    if (opt.boxStatus) {
      partsForKey.push(opt.boxStatus);
      parseConfidence += 0.05;
    }
  } else if (category === "bag") {
    const opt = parseBagOptions(text);
    parsedJson.bag_era = opt.era;
    parsedJson.bag_size_variant = opt.sizeVariant;
    parsedJson.bag_condition_tier = opt.conditionTier;
    parsedJson.bag_fake_flags = opt.fakeFlags;
    if (opt.fakeFlags) {
      needsReview = true;
      criticalUnknown.push("bag_fake_suspect");
    }
    if (opt.conditionTier === "reject") {
      needsReview = true;
      criticalUnknown.push("bag_damage_reject");
    }
    if (opt.era) {
      partsForKey.push(opt.era);
      parseConfidence += 0.2;
    } else {
      // era 미명시는 흔함 → critical 아님, 단 confidence 약간 감소.
      partsForKey.push("era_unknown");
      unknownParts.push("unknown_era");
      parseConfidence += 0.05;
    }
    if (opt.sizeVariant) {
      partsForKey.push(opt.sizeVariant);
      parseConfidence += 0.15;
    } else {
      partsForKey.push("unknown_size_variant");
      unknownParts.push("unknown_size_variant");
    }
    if (opt.conditionTier) {
      partsForKey.push(opt.conditionTier);
      parseConfidence += 0.1;
    }
  } else {
    // bike
    const opt = parseBikeOptions(text);
    parsedJson.bike_frame_size = opt.frameSize;
    parsedJson.bike_condition_tier = opt.conditionTier;
    parsedJson.bike_crash_history = opt.crashHistory;
    parsedJson.bike_year_tier = opt.yearTier;
    parsedJson.bike_parts_only = opt.partsOnly;
    if (opt.partsOnly) {
      needsReview = true;
      criticalUnknown.push("bike_parts_only_reject");
    }
    if (opt.crashHistory === "crash") {
      needsReview = true;
      criticalUnknown.push("bike_crash_reject");
    }
    if (opt.conditionTier === "reject") {
      needsReview = true;
      criticalUnknown.push("bike_damage_reject");
    }
    if (opt.frameSize) {
      partsForKey.push(opt.frameSize);
      parseConfidence += 0.25;
    } else {
      // frame_size 미명시도 흔함 (특히 폴딩/하이브리드) → unknown 표기만, critical 아님.
      // 사용자 UI에서 "프레임 사이즈 확인 필요" 뱃지 표시 권장.
      partsForKey.push("frame_size_unknown");
      unknownParts.push("unknown_frame_size");
      parseConfidence += 0.1;
    }
    if (opt.crashHistory === "no_crash") {
      partsForKey.push("no_crash");
      parseConfidence += 0.1;
    } else if (opt.crashHistory == null) {
      partsForKey.push("crash_unknown");
      unknownParts.push("unknown_crash_history");
    }
    if (opt.conditionTier) {
      partsForKey.push(opt.conditionTier);
      parseConfidence += 0.1;
    }
  }

  const comparableKey = partsForKey.map(slug).join("|");
  const variantKey = partsForKey.slice(2).join(" / ");
  parseConfidence = Math.min(1, Math.max(0, parseConfidence));

  // critical unknown 있으면 needsReview (시세 비교 무의미).
  if (criticalUnknown.length > 0) needsReview = true;
  if (parseConfidence < 0.55) needsReview = true;

  return {
    parserVersion: PARSER_VERSION_W92,
    contentHash: hashText(text),
    category,
    family,
    model,
    variantKey,
    comparableKey,
    storageGb: null,
    ramGb: null,
    ssdGb: null,
    screenSizeIn: null,
    chip: null,
    releaseYear: null,
    batteryHealth: null,
    batteryCycles: null,
    carrier: null,
    connectivity: null,
    conditionScore: 0.5,
    conditionNotes: [],
    // Wave 130 (2026-05-16): fashion/mobility는 condition_notes 추출 미구현 → default normal.
    // 후속 wave에서 신발/가방 마모/사용감 keyword 추가 시 conditionClass 정밀화.
    conditionClass: "normal",
    parseConfidence,
    needsReview,
    parsedJson: {
      ...parsedJson,
      unknown_parts: unknownParts,
      critical_unknown: criticalUnknown,
      wave92_parser: true,
    },
  };
}
