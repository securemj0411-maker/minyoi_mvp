import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 746 (2026-05-24): Neighborhood / Schott broad 2 SKU 신설.
//
// Pareto sweep small brand 결과:
//  - neighborhood: 71건 / p50 13.9만 (일본 streetwear premium)
//  - schott: 62건 / p50 9.9만 (미국 가죽 자켓 perfecto 시그니처)
//
// 총 ~133건 회수.
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
  "일괄", "벌크",
] as const;

const NON_APPAREL_GLOBAL = [
  "가방", "bag", "백팩", "토트", "크로스백",
  "지갑", "wallet", "파우치",
  "신발", "스니커즈", "shoes", "shoe", "운동화",
  "모자", "캡 ", " cap", "비니",
  "양말", "socks",
  "시계", "watch",
  "스티커", "패치", "키링",
] as const;

const APPAREL_PRODUCT_TYPES = [
  "반팔", "티셔츠", "tee", "긴팔", "롱슬리브",
  "후드", "hoodie", "후디", "맨투맨", "크루넥", "스웻", "sweat",
  "셔츠", "shirt", "남방",
  "니트", "knit", "스웨터", "sweater", "카디건",
  "베스트", "vest", "조끼", "탱크탑",
  "자켓", "jacket", "재킷",
  "바람막이", "windbreaker",
  "다운", "패딩", "푸퍼", "puffer",
  "플리스", "fleece",
  "트렌치", "trench", "코트", "coat",
  "팬츠", "pants", "바지", "쇼츠", "shorts",
  "스커트", "skirt", "원피스",
] as const;

export const WAVE_746_NEIGHBORHOOD_SCHOTT: Sku[] = [
  // ─── Neighborhood (71건 / p50 13.9만) ───
  // 일본 streetwear premium (도쿄)
  {
    id: "clothing-neighborhood-broad",
    brand: "Neighborhood", category: "clothing", laneKey: "neighborhood_apparel_broad",
    modelName: "Neighborhood Apparel (Broad — 후드/맨투맨/카브라/베이커)",
    aliases: ["Neighborhood", "네이버후드", "네이버 후드", "NBHD"],
    mustContain: [
      ["neighborhood", "네이버후드", "네이버 후드", "nbhd"],
      [...APPAREL_PRODUCT_TYPES,
       // Neighborhood 시그니처
       "카브라", "cabra", "카브라 후드",
       "베이커", "baker", "베이커 팬츠",
       "워크", "work",
       "데드맨", "deadman", "데드맨스 핸드",
       "초어", "chore"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // Collab 별 SKU (적은 풀이라 차단 광범위)
      "supreme", "슈프림",
      "adidas x", "x adidas",
      "converse x", "x converse",
    ],
    msrpKrw: 250000, released: 1994,
  },

  // ─── Schott (62건 / p50 9.9만) ───
  // 미국 가죽 자켓 시그니처 (Perfecto)
  {
    id: "clothing-schott-broad",
    brand: "Schott", category: "clothing", laneKey: "schott_apparel_broad",
    modelName: "Schott Apparel Broad (Perfecto 가죽 자켓 시그니처)",
    aliases: ["Schott", "쇼트", "Schott NYC", "퍼펙토", "Perfecto"],
    mustContain: [
      ["schott", "쇼트 nyc", "쇼트", "schott nyc"],
      [...APPAREL_PRODUCT_TYPES,
       // Schott 시그니처
       "퍼펙토", "perfecto",
       "라이더 자켓", "rider jacket", "moto",
       "필드 자켓", "field jacket",
       "피코트", "peacoat",
       "118", "613", "626",  // 모델 번호
       "더블 라이더", "더블라이더", "double rider",
       "싱글 라이더", "싱글라이더", "single rider"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // false positive 차단
      "숏 팬츠", "숏팬츠",  // "쇼트" 충돌
      "트레이닝 쇼트", "쇼트 트레이닝",
    ],
    msrpKrw: 590000, released: 1928,
  },
];
