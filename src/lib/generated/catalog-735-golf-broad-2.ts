import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 735 (2026-05-24): 골프웨어 broad 3 SKU 추가 (Wave 727 follow-up).
//
// Wave 727 첫 6 brand (Titleist/PXG/Malbon/G·FORE/J.Lindeberg/Mark&Lona) 후 추가 발견:
//  - footjoy:     239건 / p50 5.5만 ★★ — 풋조이 정품 골프티/바지
//  - amazingcree: 138건 / p50 9.9만 ★  — 어메이징크리 (한국 골프 brand)
//  - callaway:    135건 / p50 4.5만 ★  — 캘러웨이 (의류만, 골프채 차단)
//
// 총 ~512건/주 회수.
//
// 정책:
//  - 모두 일반인 친화 가격대 (3-12만)
//  - 골프채/골프공/캐디백 강력 차단 (FootJoy/Callaway는 골프채/공으로 더 유명)
//  - 묶음 brand 매물 차단
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
  "일괄", "벌크",
] as const;

// 골프 product type (Wave 727과 동일)
const GOLF_PRODUCT_TYPES = [
  "반팔", "긴팔", "카라티", "카라 티", "폴로", "polo",
  "슬랙스", "팬츠", "pants", "바지", "쇼츠", "shorts",
  "스커트", "skirt", "원피스",
  "베스트", "조끼", "vest",
  "자켓", "jacket", "패딩", "다운",
  "후드", "맨투맨", "스웻", "니트", "knit",
  "셔츠", "shirt",
  "골프웨어", "골프복", "골프티",
  "춘추",  // 한국 의류 시즌 표기
] as const;

// 골프 비-의류 (Wave 727과 동일 + 확장)
const GOLF_NON_APPAREL = [
  // 골프채
  "드라이버", "driver", "아이언", "iron", "퍼터", "putter", "웨지", "wedge",
  "우드", "유틸리티", "하이브리드", "wood",
  "골프채", "헤드", "샤프트", "shaft", "그립", "grip",
  "로그 st", "에피크", "epic", "프로토타입",
  // 공
  "골프공", "golf ball", "프로v1", "pro v1", "축구공", "로스트볼",
  "크롬소프트", "ChromeSoft",
  // 가방
  "캐디백", "cart bag", "스탠드백", "보스턴백", "보스턴", "이너백", "shoes bag",
  "백팩", "backpack",
  // 신발
  "골프화", "스파이크", "골프 슈즈",
  // 기타 액세서리
  "모자만", "장갑만", "벨트만", "양말만", "장갑", "글러브",
  // 묶음 brand 매물
  "지포어 말본 타이틀", "pxg 말본",  // 묶음 noise
];

export const WAVE_735_GOLF_BROAD_2: Sku[] = [
  // ─── FootJoy (239건 / p50 5.5만) ───
  {
    id: "clothing-footjoy-broad",
    brand: "FootJoy", category: "clothing", laneKey: "footjoy_apparel_broad",
    modelName: "FootJoy Golf Apparel (반팔/바지/카라티)",
    aliases: ["FootJoy", "풋조이", "FJ"],
    mustContain: [
      ["footjoy", "풋조이", "fj "],
      [...GOLF_PRODUCT_TYPES],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...GOLF_NON_APPAREL,
      // FJ 신발 모델 (광범위)
      "dryjoys 스니커즈", "premier", "프리미어", "트래디션", "tradition",
    ],
    msrpKrw: 89000, released: 1857,
  },

  // ─── AmazingCree (138건 / p50 9.9만) ───
  {
    id: "clothing-amazingcree-broad",
    brand: "AmazingCree", category: "clothing", laneKey: "amazingcree_apparel_broad",
    modelName: "AmazingCree Golf Apparel (한국 골프 brand)",
    aliases: ["AmazingCree", "어메이징크리", "AMAZINGCRE", "어메이징 크리"],
    mustContain: [
      ["amazingcree", "amazing cree", "어메이징크리", "어메이징 크리", "amazingore"],
      [...GOLF_PRODUCT_TYPES,
       // 어메이징크리 시그니처
       "아코디오", "accordio",
       "웨더가드", "워터블럭", "weather guard",
       "365",  // 365 라인
       "폴라",  // 폴라티
       "썸머", "summer"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...GOLF_NON_APPAREL,
    ],
    msrpKrw: 129000, released: 2020,
  },

  // ─── Callaway (135건 / p50 4.5만) — 의류만 (골프채/공 강력 차단) ───
  {
    id: "clothing-callaway-broad",
    brand: "Callaway", category: "clothing", laneKey: "callaway_apparel_broad",
    modelName: "Callaway Golf Apparel (의류만 — 골프채/공 차단)",
    aliases: ["Callaway", "캘러웨이"],
    mustContain: [
      ["callaway", "캘러웨이"],
      [...GOLF_PRODUCT_TYPES,
       // Callaway 시그니처 모델 (의류)
       "라이트 다운", "구스다운", "경량패딩",
       "기능성",
       "스판"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...GOLF_NON_APPAREL,
      // Callaway 의류 외 모델
      "epic flash", "에픽플래시",
      "rogue", "로그",
      "어프로치", "approach",
      "맥스 패스트", "max fast",
    ],
    msrpKrw: 79000, released: 1982,
  },
];
