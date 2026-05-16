// Wave 92 (2026-05-15): shoe/bag/bike 카테고리 parser.
// 테크와 다른 결정 변수 — 사이즈/컨디션/era/사고이력이 가격 결정 핵심.
// 단순 모델 매칭만으론 시세 비교 불가능 → comparable_key 신규 설계.
//
// 정책:
// - 셀러 표기 grade는 1단계 깎아 인식 (셀러 항상 자기 매물 과대평가).
// - 사이즈 추출 못 하면 needs_review (사용자 체형/발 매칭 위험).
// - 자전거 사고/크랙은 즉시 reject (가격 시세 무의미).

import type { ParsedListingOptions, ConditionClass } from "@/lib/option-parser";
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
// Wave 146 (2026-05-16): 신발 매물 흔한 표현 다수 추가.
// Wave 147 (2026-05-16): 객관 vs 셀러 주장 분리 (LAUNCH_PLAN §12b 강화).
//   - 객관 S급 (검증 가능): 미개봉/봉인/택 부착/박스컷 나코탭
//   - 셀러 주장 S급 (검증 X) → a_grade로 깎음 (미사용/한 번도 안 신음/박스채로)
export function parseConditionTier(text: string): ConditionTier {
  const t = text.toLowerCase();
  // 부적격 (reject) — 명시 손상
  if (/파손|크랙|찢어짐|구멍|얼룩\s*심함|변색\s*심함|곰팡이|악취|냄새\s*심함|손상|수리\s*필요|수선\s*필요|찌그러짐|변형\s*심함|밑창\s*벗겨/.test(t)) return "reject";
  // 객관 S급 (s_grade) — 셀러 주장 아닌 객관 명시 신호 (kream 정품인증/택 부착 등)
  // Wave 149 추가: 박스째/박스 및 택째 그대로
  if (
    /미개봉|봉인|택\s*달[린림힌]|택\s*부착|택\s*그대로|택째\s*그대로|tag\s*on|tagon|박스컷|나코탭|kream\s*택|크림\s*택|크림\s*인증|풀박스\s*\+?\s*택|박스\s*\+?\s*택|박스\s*및\s*택째\s*그대로|박스째\s*그대로|택\s*있/.test(t)
  ) return "s_grade";
  // 셀러 표기 — 1단계 깎음
  if (/[sS]급|[sS]\s*그레이드|급[sS]급|특[sS]급|특[aA]급|최상급|탑급|s\+/.test(text)) return "a_grade";
  if (/[aA]급|[aA]\s*그레이드|상태\s*최상/.test(text)) return "b_grade";
  if (/[bB]급|[bB]\s*그레이드/.test(text)) return "c_grade";
  // A급 (거의 새거) — 셀러 주장 S급 + 실착 1-3회 / 한두번 / 시착만 / 사이즈 미스
  // Wave 147: 셀러 주장 "미사용/한 번도 안 신음/박스채로/새상품" 1단계 깎음
  // Wave 149 추가: 한글 숫자 (두/세 번 신음), 1회 착용, 집에서만 신어보고, 구매 후 N일
  if (
    /미사용|미착용|미시착|새상품(?!\s*[abc])|민트|한\s*번도\s*안\s*(신음|입음|멤|탐|사용|신|입|착)|신은?\s*적\s*없|신어\s*본?\s*적\s*없|신지\s*않은|신지를\s*않|착용해본\s*적\s*없|착용한\s*적\s*없|박스\s*그대로|박스채로|포장\s*그대로|포장\s*그대로|박스\s*개봉\s*안|풀박\s*새상품|보관만|예비용으로\s*구매|구입만\s*하고\s*보관|신상품|매장\s*정품|거의\s*(새|안\s*신|안\s*입|안\s*들|안\s*탐|새것|새신발)|1\s*[~-]?\s*2\s*번\s*(신|입|들|탐)|한\s*두?\s*번\s*(신|입|착)|한두번|시착\s*(만|함)|시신음|착용\s*해?\s*본다고|사이즈\s*(미스|실패|안\s*맞|틀|가\s*안\s*맞)|실착\s*[1-3]\s*회|단\s*[1-3]\s*회|구매\s*후\s*[1-3]\s*회|보관용|잠깐\s*(신|착용|시\s*신|밖에\s*안)|1\s*회\s*시착|1\s*회\s*착용|[1-3]\s*회\s*착용|1\s*번\s*(신|착)|2\s*번\s*(신|착)|3\s*번\s*(신|착)|두\s*번\s*신|세\s*번\s*신|선물용으로\s*받|실내에서만\s*신|집에서만\s*신어|집에서만\s*신음|구매\s*후\s*[1-7]\s*일|발에\s*너무\s*맞지\s*않|선물받|박스\s*및\s*택째\s*그대로\s*보관|마음에\s*들지\s*않아\s*판매/.test(t)
  ) return "a_grade";
  // B급 (사용감 적음): 4-9회 단독 착용 / 상태 양호 / 컨디션 좋 / 9-10/10
  // Wave 149 추가: 상태 완전 좋/정말 좋, 상태 전반 양호, 전반적으로 좋
  if (
    /사용감\s*적|약간\s*사용|잔기스|컨디션\s*좋|상태\s*양호|상태양호|상태\s*좋|상태좋|상태\s*우수|컨디션\s*우수|excellent|excellent\s*condition|9\s*\/\s*10|10\s*\/\s*10|(?:^|[^0-9])[4-9]\s*회\s*[가-힣\s]{0,5}?(신|착|입)|깨끗|깔끔|관리\s*잘|사용감\s*거의\s*없|사용감\s*없|마모\s*없|마모\s*거의\s*없|기스\s*없|기스\s*거의\s*없|외관\s*깨끗|외부\s*깨끗|상태\s*깨끗|상태\s*완전\s*좋|상태\s*정말\s*좋|상태\s*전반\s*양호|전반\s*양호|전반적으로\s*[가-힣\s]{0,8}?좋|상태\s*매우\s*좋|상태\s*아주\s*좋/.test(t)
  ) return "b_grade";
  // C급 (사용감 많음): 사용감 있/오염/스크레치/10회+ 착용
  // Wave 149 추가: 사용감 많(있), 착용감 있/많, 까짐, 해짐, 굽 슈구칠
  if (
    /사용감\s*있|사용감\s*좀\s*있|사용감\s*많|사용감이\s*많|사용감은\s*많|착용감\s*있|착용감\s*많|착용감\s*좀\s*있|많이\s*사용|많이\s*신|보풀|색바램|변색|약간의?\s*오염|약간의?\s*얼룩|약간의?\s*스크\w*|앞코\s*스크\w*|미드솔\s*오염|밑창\s*닳|밑창\s*마모|(?:^|[^0-9])[1-9][0-9]\s*회\s*[가-힣\s]{0,5}?(신|착|입)|발자국|기스\s*있|스크래치|스크레치|굽\s*닳|굽이\s*닳|굽\s*마모|굽\s*슈구|슈구\s*칠|사용\s*흔적|뒤꿈치\s*닳|(?:가죽|앞코|뒤꿈치|밑창|매쉬|어퍼|바닥|내부)[가-힣\s]{0,12}?까짐|(?:가죽|앞코|뒤꿈치|매쉬|어퍼)[가-힣\s]{0,12}?해짐|매쉬\s*닳|로고\s*지워|로고\s*지웠|먼지가\s*조금\s*묻|약간의\s*까짐|까짐\s*조금|까짐\s*있/.test(t)
  ) return "c_grade";
  return null;
}

// ─── 신발 ────────────────────────────────────────────────────────────

// 신발 사이즈 추출 (220~309mm). 부적격: 진짜 키즈/유아 (130~215).
// Wave 137 (2026-05-16): UK 사이즈 → mm 변환 추가.
// Wave 138 (2026-05-16): 사이즈 범위 220~309 확장 (여성 220/225 일반 사이즈).
export function parseShoeSizeMm(text: string): number | null {
  // "270mm", "270 사이즈", "사이즈 270", "270" (3자리 숫자)
  // 진짜 키즈 차단: 130~215 범위는 제외 (220+는 여성 일반)
  const patterns: RegExp[] = [
    /(?:사이즈|size|싸이즈)\s*[:\-]?\s*(2[2-9]\d|30\d)(?!\d)/i,
    /(2[2-9]\d|30\d)\s*(?:mm|사이즈|size|싸이즈)/i,
    /\b(2[2-9]\d|30\d)\b(?![\d.])/, // bare 3-digit
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n >= 220 && n <= 309) return n;
    }
  }
  // Wave 137: UK 사이즈 → mm 변환 (닥마식 기준, ±10mm 오차 OK)
  // UK 3=220, UK 4=230, UK 5=240, UK 6=250, UK 7=260, UK 8=270, UK 9=280, UK 10=290, UK 11=300
  // 정수 UK만 — 6.5, 7.5 등 부동소수점은 무시 (정확도 우선)
  // 명시 anchored: "UK 6", "UK6", "uk6" (반드시 "uk" 다음 정수)
  const ukMatch = text.match(/(?:^|[^a-z0-9])uk\s*([3-9]|1[0-2])(?![\d.])/i);
  if (ukMatch) {
    const uk = Number(ukMatch[1]);
    const UK_TO_MM: Record<number, number> = {
      3: 220, 4: 230, 5: 240, 6: 250, 7: 260,
      8: 270, 9: 280, 10: 290, 11: 300, 12: 310,
    };
    const mm = UK_TO_MM[uk];
    if (mm !== undefined && mm >= 220 && mm <= 309) return mm;
  }
  // Wave 138: cm 표기 → mm 변환 (예: "26cm" → 260, "25.5cm" → 255)
  // 230~309mm 범위만 (23~30.9cm)
  const cmMatch = text.match(/\b(2[2-9](?:\.\d)?|30(?:\.\d)?)\s*cm\b/i);
  if (cmMatch) {
    const cm = Number(cmMatch[1]);
    const mm = Math.round(cm * 10);
    if (mm >= 220 && mm <= 309) return mm;
  }
  // Wave 139 (2026-05-16): EU 사이즈 → mm 변환 (어그/닥마/유럽 브랜드 매물 흔함)
  // 35-46 → 220-300mm. 명시 "EU 38" / "eu39" / "유로 40" 또는 어그 매물 "(35)" 같은 단독 표기.
  // 보수적: "EU" prefix 있을 때만 (false positive 차단). 단독 35-46은 미국/유럽 미구분.
  const euMatch = text.match(/(?:eu|유로|유럽|europe)\s*(3[5-9]|4[0-6])\b/i);
  if (euMatch) {
    const eu = Number(euMatch[1]);
    const EU_TO_MM: Record<number, number> = {
      35: 220, 36: 230, 37: 235, 38: 240, 39: 245,
      40: 250, 41: 260, 42: 265, 43: 275, 44: 280, 45: 285, 46: 290,
    };
    const mm = EU_TO_MM[eu];
    if (mm !== undefined && mm >= 220 && mm <= 309) return mm;
  }
  // Wave 139: US 사이즈 → mm 변환 (보수적 unisex 매핑, "US" prefix 명시 필요)
  // US 5-13 → mm. 남/녀 미구분 = 남성 기준 (정확도 우선, ±10mm 오차 받아들임).
  const usMatch = text.match(/(?:us|미국)\s*([5-9]|1[0-3])\b/i);
  if (usMatch) {
    const us = Number(usMatch[1]);
    const US_TO_MM: Record<number, number> = {
      5: 230, 6: 240, 7: 250, 8: 260, 9: 270,
      10: 280, 11: 290, 12: 300, 13: 310,
    };
    const mm = US_TO_MM[us];
    if (mm !== undefined && mm >= 220 && mm <= 309) return mm;
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
  // Wave 134 (2026-05-16): shoe condition_tier → condition_class 매핑.
  // 이전: 모든 신발 conditionClass = "normal" (Wave 130까지 미구현).
  // 변경: s_grade → unopened / a_grade → mint / b_grade → clean / c_grade → worn / reject → flawed.
  let conditionClassResult: ConditionClass = "normal";

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
      // Wave 134: condition_tier → condition_class 매핑.
      const tierMap: Record<string, ConditionClass> = {
        s_grade: "unopened",
        a_grade: "mint",
        b_grade: "clean",
        c_grade: "worn",
        reject: "flawed",
      };
      conditionClassResult = tierMap[opt.conditionTier] ?? "normal";
    } else {
      partsForKey.push("unknown_condition");
      unknownParts.push("unknown_condition");
    }
    if (opt.boxStatus) {
      partsForKey.push(opt.boxStatus);
      parseConfidence += 0.05;
      // Wave 134: 박스 미개봉이면 condition tier 없어도 unopened 가능성.
      if (opt.boxStatus === "with_box" && opt.conditionTier === "s_grade") {
        conditionClassResult = "unopened";
      }
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
    // Wave 134 (2026-05-16): 신발 condition_tier → condition_class 매핑 추가. 가방/자전거는 normal 유지.
    conditionClass: conditionClassResult,
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
