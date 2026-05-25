import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 734 (2026-05-24): 거대한 미발견 brand 5 SKU 신설.
//
// Wave 733 null brand sweep 결과 (last 14d, sku_id NULL, 30-500k, apparel signal):
//  - fog_essentials:  503건 / p50 10.0만 ★★★ FOG Essentials (mass-market sub-brand)
//  - patagonia:       443건 / p50 9.2만  ★★★ 아웃도어 mass
//  - acne_studios:    427건 / p50 15만   ★★  premium designer (Wave 716 denim_premium 외 일반 broad 없음)
//  - nanamica:        251건 / p50 19.4만 ★   일본 premium (고어텍스 시그니처)
//  - tommy_hilfiger:   78건 / p50 5.5만  ★   일반인 친화
//
// 총 ~1,700건 회수 (별 wave 735에 골프 footjoy/callaway/amazingcree)
//
// 정책:
//  - 모두 mass-market or 친화 가격대 (5-25만)
//  - 명품 (Hermes/Chanel/Dior) 과는 다름
//  - FOG Essentials는 Mass sub-brand (FOG mainline은 별 시세군)
//  - Acne는 premium 가격대지만 일반인이 사는 sub (스웨터/티셔츠/패딩)
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
  "일괄", "벌크",
] as const;

const NON_APPAREL_GLOBAL = [
  "가방", "bag", "백팩", "토트", "크로스백", "더플",
  "지갑", "wallet", "파우치",
  "신발", "스니커즈", "shoes", "shoe", "운동화",
  "모자", "캡 ", " cap", "비니",
  "양말", "socks",
  "시계", "watch",
  "스티커", "패치", "키링",
] as const;

const APPAREL_PRODUCT_TYPES = [
  // 상의
  "반팔", "티셔츠", "tee", "긴팔", "롱슬리브", "long sleeve",
  "후드", "hoodie", "후디", "맨투맨", "크루넥", "스웻", "sweat",
  "셔츠", "shirt", "남방", "블라우스",
  "니트", "knit", "스웨터", "sweater", "카디건", "cardigan", "가디건",
  "베스트", "vest", "조끼", "탱크탑", "tank top",
  // 자켓류
  "자켓", "jacket", "재킷",
  "바람막이", "windbreaker",
  "다운", "패딩", "푸퍼", "puffer",
  "플리스", "fleece",
  "트렌치", "trench", "코트", "coat",
  // 하의
  "팬츠", "pants", "바지", "쇼츠", "shorts", "반바지",
  "스커트", "skirt", "원피스",
  // 풀오버 / 트랙
  "풀오버", "pullover", "트랙수트", "tracksuit",
] as const;

export const WAVE_734_MEGA_BRAND: Sku[] = [
  // ※ FOG Essentials (fog_essentials_broad) catalog.ts:10813 Wave 686 이미 존재 — 503건 leak은 별 wave fix.
  // ※ Patagonia (patagonia_apparel_broad) catalog-wave266 Wave 266 이미 존재 — 443건 leak은 별 wave fix.

  // ─── Acne Studios (427건 / p50 15만) ───
  // Wave 716 acne_denim_premium 별도 (60만+ 데님 premium)
  // 이번 SKU는 일반 broad (스웨터/티셔츠/패딩 일반 가격대)
  {
    id: "clothing-acne-studios-broad",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_studios_broad",
    modelName: "Acne Studios Apparel Broad (스웨터/티셔츠/맨투맨/패딩 일반)",
    aliases: ["Acne Studios", "아크네 스튜디오", "아크네스튜디오", "Acne"],
    mustContain: [
      ["acne studios", "아크네 스튜디오", "아크네스튜디오", "acnestudios"],
      [...APPAREL_PRODUCT_TYPES,
       // Acne 시그니처
       "플로라가탄", "floragatan",
       "fn-mn", "fn mn",
       "페이스 로고", "face logo",
       "스마일리", "smiley"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // Acne 데님 premium은 별 SKU (Wave 716)
      "2021m", "2003 시그니처", "petit",
      "데님 premium", "premium denim",
      // Denim and named denim fits should not leak into apparel broad.
      "데님", "denim", "청바지", "jean", "jeans",
      "max", "맥스", "river", "리버", "rodeo", "로데오", "1995",
      // Kids/multi-brand set wording should not use Acne as the active brand.
      "세트", "set", "120-130", "120 130", "dkny", "디케이엔와이", "미니로디니", "mini rodini", "minirodini",
      // 명품 collab
      "supreme",
    ],
    msrpKrw: 290000, released: 1996,
  },

  // ─── Nanamica (251건 / p50 19.4만) ───
  {
    id: "clothing-nanamica-broad",
    brand: "Nanamica", category: "clothing", laneKey: "nanamica_apparel_broad",
    modelName: "Nanamica Apparel Broad (고어텍스/Coolmax/도쿄 collab)",
    aliases: ["Nanamica", "나나미카"],
    mustContain: [
      ["nanamica", "나나미카"],
      [...APPAREL_PRODUCT_TYPES,
       // Nanamica 시그니처
       "고어텍스", "gore-tex", "goretex", "gore tex",
       "coolmax", "쿨맥스",
       "alphadry", "알파드라이",
       "purple label", "퍼플 라벨",  // North Face Purple Label (Nanamica 제조)
       "tnf purple", "tnf 퍼플"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // Polo Purple Label (별 brand)
      "polo purple", "ralph lauren purple",
      // 다른 brand
      "supreme",
    ],
    msrpKrw: 350000, released: 2003,
  },

  // ─── Tommy Hilfiger (78건 / p50 5.5만) ───
  {
    id: "clothing-tommy-hilfiger-broad",
    brand: "Tommy Hilfiger", category: "clothing", laneKey: "tommy_hilfiger_broad",
    modelName: "Tommy Hilfiger Apparel Broad (반팔/맨투맨/자켓/바람막이)",
    aliases: ["Tommy Hilfiger", "타미힐피거", "타미 힐피거", "TH"],
    mustContain: [
      ["tommy hilfiger", "타미힐피거", "타미 힐피거"],
      [...APPAREL_PRODUCT_TYPES],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // Tommy Jeans (sub brand, separate price tier)
      "tommy jeans", "타미진즈",
      // 향수/시계
      "향수", "퍼퓸", "perfume",
    ],
    msrpKrw: 99000, released: 1985,
  },
];
