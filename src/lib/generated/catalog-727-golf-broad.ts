import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 727 (2026-05-24): 골프웨어 6 brand broad SKU 신설.
//
// 사용자 핵심 원칙: "일반인도 편하게 돈 벌 수 있는 AI 사이트" — 골프 brand 일반인 친화 가격대 (5-11만).
// agent (a34e36f9) + DB sweep 결과 2,624건 sku_id=null 매물 발견.
//
// 정책:
//  - 명품 거부 X (사용자 정책 "명품 거의 안함"엔 골프 명시 없음)
//  - 가격대 친화적 (말본 8만 / 지포어 11만 등)
//  - 시세군 분리 (골프웨어 vs 일반 의류 다름 — 슬랙스/베스트/스커트/카라티 product mix)
//
// 신설 6 brand (impact 큰 순):
//  1. Titleist (1,006건 / p50 11만)
//  2. PXG (463건 / p50 8.5만)
//  3. Malbon (433건 / p50 7.9만)
//  4. G/FORE (291건 / p50 10.9만)
//  5. J.Lindeberg (241건 / p50 5.9만)
//  6. Mark&Lona (190건 / p50 9만)
//
// Skip (풀 부족 또는 별 cycle):
//  - Pearly Gates 17건 — 풀 작음
//  - Callaway / Ping — 사용자가 골프채로 더 자주 검색, 의류 풀 적음
//  - amazingcree (99건) — 신규 brand, 별 wave
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
] as const;

// 골프 product type — 카라티/슬랙스/베스트/스커트/반팔 위주
const GOLF_PRODUCT_TYPES = [
  "반팔", "긴팔", "카라티", "카라 티", "폴로", "polo",
  "슬랙스", "팬츠", "pants", "바지", "쇼츠", "shorts",
  "스커트", "skirt", "원피스",
  "베스트", "조끼", "vest",
  "자켓", "jacket", "패딩", "다운",
  "후드", "맨투맨", "스웻", "니트", "knit",
  "셔츠", "shirt",
] as const;

// 골프채/공/가방 차단 — 의류만
const GOLF_NON_APPAREL = [
  // 골프채
  "드라이버", "driver", "아이언", "iron", "퍼터", "putter", "웨지", "wedge",
  "우드", "유틸리티", "하이브리드",
  "골프채", "헤드", "샤프트", "shaft", "그립", "grip",
  // 공
  "골프공", "golf ball", "프로v1", "pro v1",
  // 가방
  "캐디백", "cart bag", "스탠드백", "보스턴백", "이너백",
  "백팩", "backpack", "shoes bag",
  // 신발
  "골프화", "스파이크", "골프 슈즈",
  // 기타 액세서리
  "모자만", "장갑만", "벨트만", "양말만",
];

export const WAVE_727_GOLF_BROAD: Sku[] = [
  // ─── Titleist (1,006건 / p50 11만) ───
  {
    id: "clothing-titleist-broad",
    brand: "Titleist", category: "clothing", laneKey: "titleist_broad",
    modelName: "Titleist Golf Apparel (Broad — 반팔/슬랙스/베스트)",
    aliases: ["Titleist", "타이틀리스트"],
    mustContain: [
      ["titleist", "타이틀리스트"],
      [...GOLF_PRODUCT_TYPES],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...GOLF_NON_APPAREL,
      // 골프채 외 비-의류
      "공만", "ball only", "ts3", "tsi", "tsr",  // 모델명 (의류엔 없음)
    ],
    msrpKrw: 159000, released: 1932,
  },

  // ─── PXG (463건 / p50 8.5만) ───
  {
    id: "clothing-pxg-broad",
    brand: "PXG", category: "clothing", laneKey: "pxg_broad",
    modelName: "PXG Golf Apparel (Broad — 반팔/슬랙스/베스트)",
    aliases: ["PXG", "P.X.G", "Parsons Xtreme Golf"],
    mustContain: [
      ["pxg", "p.x.g"],
      [...GOLF_PRODUCT_TYPES],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...GOLF_NON_APPAREL,
      // 골프채 모델
      "0311", "0317", "gen6", "gen5", "gen4", "battle ready",
      "샤프트만", "헤드커버",
    ],
    msrpKrw: 129000, released: 2015,
  },

  // ─── Malbon (433건 / p50 7.9만) ───
  {
    id: "clothing-malbon-broad",
    brand: "Malbon", category: "clothing", laneKey: "malbon_broad",
    modelName: "Malbon Golf Apparel (Broad — 일반인 친화 골프웨어)",
    aliases: ["Malbon", "말본", "Malbon Golf"],
    mustContain: [
      ["malbon", "말본"],
      [...GOLF_PRODUCT_TYPES],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...GOLF_NON_APPAREL,
    ],
    msrpKrw: 119000, released: 2017,
  },

  // ─── G/FORE (291건 / p50 10.9만) ───
  {
    id: "clothing-gfore-broad",
    brand: "G/FORE", category: "clothing", laneKey: "gfore_broad",
    modelName: "G/FORE Golf Apparel (Broad — 글러브/스니커즈 시그니처)",
    aliases: ["G/FORE", "지포어", "gfore", "g.fore", "g4"],
    mustContain: [
      ["gfore", "지포어", "g/fore", "g.fore", "g fore"],
      [...GOLF_PRODUCT_TYPES],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...GOLF_NON_APPAREL,
      // 신발 모델 (별 시세군)
      "mg4", "g4", "스니커즈", "골프화",
    ],
    msrpKrw: 169000, released: 2011,
  },

  // ─── J.Lindeberg (241건 / p50 5.9만) ───
  {
    id: "clothing-jlindeberg-broad",
    brand: "J.Lindeberg", category: "clothing", laneKey: "jlindeberg_broad",
    modelName: "J.Lindeberg Golf Apparel (Broad)",
    aliases: ["J.Lindeberg", "제이린드버그", "Jlindeberg"],
    mustContain: [
      ["j.lindeberg", "jlindeberg", "제이린드버그", "j lindeberg"],
      [...GOLF_PRODUCT_TYPES],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...GOLF_NON_APPAREL,
    ],
    msrpKrw: 99000, released: 1996,
  },

  // ─── Mark&Lona (190건 / p50 9만) ───
  {
    id: "clothing-marklona-broad",
    brand: "Mark&Lona", category: "clothing", laneKey: "marklona_broad",
    modelName: "Mark&Lona Golf Apparel (Broad — 스컬 시그니처)",
    aliases: ["Mark&Lona", "마크앤로나", "mark lona", "MARK&LONA"],
    mustContain: [
      ["mark&lona", "marklona", "mark lona", "마크앤로나", "마크 앤 로나", "mark & lona"],
      [...GOLF_PRODUCT_TYPES],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...GOLF_NON_APPAREL,
    ],
    msrpKrw: 159000, released: 2007,
  },
];
