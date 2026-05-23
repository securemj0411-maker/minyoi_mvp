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
      // Wave 753 (2026-05-24) Pareto: 186x spread audit — 헬리녹스 텐트 + Vlone collab 차단.
      "헬리녹스", "helinox", "텐트", "tent", "터널 텐트",
      "캠핑 의자", "캠핑체어", "캠핑 체어", "체어 원",
      "vlone", "브이론", "브이로네", "vlone collab",
      "에이셉", "asap", "락키", "rocky",
      "라이더 레더 자켓", // brake 안 잡힘 - 일반 레더 자켓은 OK인데 collab 사례
    ],
    msrpKrw: 250000, released: 1994,
  },

  // ─── Hunter Rain Boots (102건 / p50 8.1만) — 영국 레인부츠 시그니처 ───
  {
    id: "shoe-hunter-broad",
    brand: "Hunter", category: "shoe", laneKey: "hunter_apparel_broad",
    modelName: "Hunter Boots Broad (Original Tall / Short / Refined)",
    aliases: ["Hunter", "헌터", "Hunter Boots"],
    mustContain: [
      ["hunter", "헌터"],
      ["부츠", "boots", "boot",
       "오리지널 톨", "original tall",
       "오리지널 숏", "original short",
       "리파인드", "refined",
       "레인부츠", "rain boots", "장화", "고무 부츠",
       "샌들", "sandal",
       "tour", "투어",
       "balmoral", "발모랄",
       "신발", "운동화", "스니커즈"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // false positive (Hunter 도구/공구 brand 차단)
      "공구", "전동", "예초기", "fishing", "낚시",
      "더 헌터", "the hunter", "hunter x hunter",
      "헌터 마운틴", "hunter mountain",
    ],
    msrpKrw: 230000, released: 1856,
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

  // ─── Dickies (15건 / p50 변동 — collab 제외 일반 워크웨어) ───
  // Wave 728에 Supreme x Dickies collab만 있어 일반 Dickies 매물 leak.
  {
    id: "clothing-dickies-broad",
    brand: "Dickies", category: "clothing", laneKey: "dickies_apparel_broad",
    modelName: "Dickies Apparel Broad (워크 셔츠/874/팬츠/코치자켓 일반)",
    aliases: ["Dickies", "디키즈"],
    mustContain: [
      ["dickies", "디키즈"],
      [...APPAREL_PRODUCT_TYPES,
       // Dickies 시그니처
       "874", "워크 팬츠", "워크팬츠", "work pants",
       "874 팬츠", "874팬츠",
       "워크 셔츠", "워크셔츠", "work shirt",
       "이튼 valid", "에이젠시", "원포인트",
       "디트로이트", "라이트닝",
       "더블니", "이튼", "스톤텍스처"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // Collab 별 SKU (Wave 728 supreme_dickies_collab 있고, Stussy/준야/Human Made collab 별)
      "supreme", "슈프림",
      "stussy", "스투시",
      "준야", "junya", "junya watanabe",
      "human made", "휴먼메이드", "휴먼 메이드",
      "몽키타임", "monkey time",
      "와코마리아", "wacko maria",
    ],
    msrpKrw: 89000, released: 1922,
  },
];
