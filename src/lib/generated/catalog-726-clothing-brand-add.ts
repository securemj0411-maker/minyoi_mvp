import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 726 (2026-05-24): 의류 deep sweep agent (a34e36f9) + DB sample 결과 신규 brand 신설.
//
// 추가 기준:
//  - 14일 unmatched 매물 ≥ 50건
//  - 가격대 일반인 친화 (사용자 정책 "일반인도 편하게 돈 벌 수 있는 AI")
//  - 명품/럭셔리 X (사용자 정책)
//  - 골프웨어는 별 cycle (Wave 727)
//
// 신설 brand:
//  1. Alpha Industries (MA-1/N3B 항공자켓) — 70건 / p50 10만
//  2. Levi's (501/550 데님) — 72건 / p50 8.5만
//  3. Discovery Expedition (패딩/맨투맨) — 74건 / p50 4.2만
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품", "11급", "ss급정품", "1:1", "미러",
  "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입",
  "느낌 아시", "느낌아시",
] as const;

export const WAVE_726_CLOTHING_BRAND_ADD: Sku[] = [
  // ─── Alpha Industries — MA-1/N3B 항공자켓 (70건 / p50 10만) ───
  {
    id: "clothing-alpha-mil-jacket",
    brand: "Alpha Industries", category: "clothing", laneKey: "alpha_mil_jacket",
    modelName: "Alpha Industries MA-1 / N3B / N2B 항공자켓",
    aliases: ["Alpha Industries", "알파인더스트리", "MA-1", "N3B", "N2B"],
    mustContain: [
      ["alpha industries", "알파인더스트리", "알파 인더스트리"],
      // OR 강력 모델명 (alpha 단어 없어도 매칭)
      ["ma-1", "ma1", "ma 1", "n3b", "n-3b", "n2b", "n-2b", "스카이마스터", "skymaster",
       "봄버", "bomber", "자켓", "jacket", "패딩", "후드"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      // 비-alpha brand 차단
      "tnf", "노스페이스", "north face", "supreme", "슈프림",
      // 신발/가방
      "신발", "스니커즈", "운동화", "shoe",
      "가방", "bag", "백팩",
      // 비관련 alpha
      "스포츠카", "테니스", "alpha 스피커", "alphacar", "alpha-7",
    ],
    msrpKrw: 290000, released: 1959,
  },

  // ─── Levi's — 501/550 데님 (72건 / p50 8.5만) ───
  {
    id: "clothing-levis-denim-broad",
    brand: "Levi's", category: "clothing", laneKey: "levis_denim_broad",
    modelName: "Levi's Denim Broad (501/550/엔지니어드/셀비지/빅이/리바이스 빈티지 클로딩)",
    aliases: ["Levis", "리바이스", "Levi's", "LVC"],
    mustContain: [
      ["levis", "리바이스", "levi's", "리바이"],
      ["501", "550", "511", "517", "데님", "denim", "청바지", "진", "jean",
       "트러커", "trucker", "자켓", "jacket", "셔츠", "shirt", "엔지니어드", "engineered",
       "셀비지", "selvedge", "lvc", "빅이", "big e"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      // 콜라보 (별도 시세군)
      "junya", "준야", "고샤", "gosha rubchinskiy",
      "nike", "나이키", "addidas", "adidas",
      // 신발 collab 차단
      "스니커즈", "sneaker", "운동화", "리바이스 스니커즈",
      // 가방
      "가방", "bag", "백팩", "지갑", "wallet",
    ],
    msrpKrw: 129000, released: 1873,
  },

  // ─── Discovery Expedition — 패딩/맨투맨 (74건 / p50 4.2만) ───
  {
    id: "clothing-discovery-broad",
    brand: "Discovery Expedition", category: "clothing", laneKey: "discovery_broad",
    modelName: "Discovery Expedition Apparel (패딩조끼/맨투맨/자켓/플리스)",
    aliases: ["Discovery", "디스커버리", "디스커버리 익스페디션", "Discovery Expedition"],
    mustContain: [
      ["디스커버리", "discovery"],
      ["익스페디션", "expedition", "패딩", "다운", "맨투맨", "후드", "자켓", "jacket",
       "조끼", "베스트", "플리스", "fleece", "셔츠", "팬츠"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      // 다른 brand 차단
      "향수", "퍼퓸", "디퓨저", "딥티크", "프레데릭말", "frederic malle",
      "discovery 세트", "discovery set", "discovery sample",  // 향수 샘플러
      // 신발/가방
      "신발", "스니커즈", "shoe", "가방", "bag", "백팩",
    ],
    msrpKrw: 119000, released: 2012,
  },
];
