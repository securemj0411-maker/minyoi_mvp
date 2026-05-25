import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 736 (2026-05-24): MM6 Margiela / Lacoste broad / Mountain Hardwear 신설.
//
// Wave 734-735 follow-up sweep — 추가 발견:
//  - mm6_margiela:      123건 / p50 22만  ★★ (sub-brand mass, Margiela 본라인 별 시세)
//  - lacoste:            32건 / p50 4.9만 ★  (lacoste_pique_polo 외 broad 누락)
//  - mountain_hardwear:  14건 / p50 3.9만 ★  (mass-market 아웃도어)
//
// Skip (명품 / pool 작음):
//  - moncler 74건 — 명품 정책 (skip)
//  - canada_goose 8건 — 명품 (skip)
//  - vetements/wooyoungmi — 명품 (skip)
//  - champion 51건 — 이미 SKU 있고 leak 대부분 false positive (게임/이벤트)
//  - kapital/woolrich/snow_peak/and_wander 5건 미만 — 풀 작음
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
  "일괄", "벌크",
] as const;

const APPAREL_PRODUCT_TYPES = [
  "반팔", "티셔츠", "tee", "긴팔", "롱슬리브",
  "후드", "hoodie", "후디", "맨투맨", "크루넥", "스웻", "sweat",
  "셔츠", "shirt", "남방",
  "니트", "knit", "스웨터", "sweater", "카디건", "cardigan",
  "베스트", "vest", "조끼", "탱크탑",
  "자켓", "jacket", "재킷",
  "바람막이", "windbreaker",
  "다운", "패딩", "푸퍼", "puffer",
  "플리스", "fleece",
  "트렌치", "trench", "코트", "coat",
  "팬츠", "pants", "바지", "쇼츠", "shorts", "반바지",
  "스커트", "skirt", "원피스",
  "풀오버", "pullover",
  "조거", "jogger",
] as const;

const NON_APPAREL_GLOBAL = [
  "가방", "bag", "백팩", "토트", "크로스백",
  "지갑", "wallet", "파우치",
  "신발", "스니커즈", "shoes", "shoe", "운동화",
  "모자", "캡 ", " cap",
  "양말", "socks",
  "시계", "watch",
  "스티커", "패치", "키링",
] as const;

export const WAVE_736_MM6_LACOSTE: Sku[] = [
  // ─── MM6 Maison Margiela (123건 / p50 22만) ───
  // 별 SKU 있는 것:
  //   - margiela_tabi (시그니처 신발) — Wave 712b
  //   - Wave 728 supreme_mm6_collab — Supreme×MM6 collab
  // MM6 의류 (4-stitch / 넘버 logo / cropped) broad 없음.
  {
    id: "clothing-mm6-margiela-broad",
    brand: "MM6 Maison Margiela", category: "clothing", laneKey: "mm6_margiela_apparel_broad",
    modelName: "MM6 Maison Margiela Apparel (4-stitch / 넘버 logo / cropped)",
    aliases: ["MM6", "MM6 Margiela", "MM6 마르지엘라", "MM6 마르지엘", "마르지엘라 MM6", "MM6 메종 마르지엘라"],
    mustContain: [
      ["mm6", "메종 마르지엘라", "maison margiela", "마르지엘라", "마르지엘"],
      [...APPAREL_PRODUCT_TYPES,
       // MM6 시그니처
       "4-stitch", "4 스티치", "4스티치",
       "넘버 로고", "10번", "11번", "22번",
       "cropped", "크롭",
       "재팬", "japan",
       "재팬 라벨", "japan label"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // Margiela 본 라인 차단 (별 시세군 — 200만+)
      "main line", "메인라인", "본라인", "본 라인",
      "artisanal", "아티자날",
      "0 ", "0번 ",  // Artisanal numbering
      // Collab 별 SKU
      "supreme", "슈프림",
      // Tabi 신발은 별 SKU
      "tabi", "타비",
      "reebok", "리복",
      // 향수 별 SKU (replica)
      "replica", "재즈 클럽", "by the fireplace",
    ],
    msrpKrw: 290000, released: 1997,
  },

  // ─── Lacoste broad (32건 / p50 4.9만 — pique_polo 외) ───
  {
    id: "clothing-lacoste-broad",
    brand: "Lacoste", category: "clothing", laneKey: "lacoste_apparel_broad",
    modelName: "Lacoste Apparel (Broad — pique_polo 외 반팔/맨투맨/자켓)",
    aliases: ["Lacoste", "라코스테"],
    mustContain: [
      ["lacoste", "라코스테"],
      [...APPAREL_PRODUCT_TYPES],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // 폴로 별 SKU
      "피케 폴로", "pique polo", "피케 폴로",
      // 골프 별 cycle
      "golf", "골프",
      // Collab
      "supreme", "꼼데", "꼼데가르송", "cdg", "comme des", "comme des garcons",
    ],
    msrpKrw: 79000, released: 1933,
  },

  // ─── Mountain Hardwear (14건 / p50 3.9만 — mass-market 아웃도어) ───
  {
    id: "clothing-mountain-hardwear-broad",
    brand: "Mountain Hardwear", category: "clothing", laneKey: "mountain_hardwear_broad",
    modelName: "Mountain Hardwear Apparel (플리스/패딩/자켓)",
    aliases: ["Mountain Hardwear", "마운틴하드웨어", "마운틴 하드웨어"],
    mustContain: [
      ["mountain hardwear", "마운틴하드웨어", "마운틴 하드웨어"],
      [...APPAREL_PRODUCT_TYPES],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // 등산용품
      "텐트", "침낭",
    ],
    msrpKrw: 99000, released: 1993,
  },
];
