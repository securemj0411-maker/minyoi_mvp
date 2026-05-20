// Wave 266 (2026-05-20): 번개장터 deep sweep → 명품 가방 brand-broad catalog 신설.
//
// raw 카테고리 430xxx (가방) 미매칭 분석:
//  - 루이비통 1042건 (avg 392만)
//  - 구찌 683건 (avg 216만)
//  - 샤넬 521건 (avg 382만)
//  - 디올 515건 (avg 254만)
//  - 프라다 417건 (avg 93만)
//  - 셀린느 263건 (avg 125만)
//  - 보테가베네타 221건 (avg 90만)
//  - 에르메스 171건 (avg 1200만!)
//  - 발렌시아가 162건 (avg 717만)
//  - 버버리 153건 (avg 50만)
//  - 코치 138건 (avg 15만)
//  - 마르지엘라 89건 (avg 51만)
//  - 발렌티노 77건 (avg 36만)
//  - MCM 74건 (avg 17만)
//  - 페라가모 68건 (avg 33만)
//  - 미우미우 63건 (avg 107만)
//  - 르메르 55건 (avg 98만)
//  - 꼼데가르송 48건 (avg 24만)
//  - YSL 48건 (avg 60만)
//  - 톰브라운 32건 (avg 50만)
//
// 정책 — broad SKU 위험:
//  - 명품 가방 broad는 single model variant 가격 폭이 크다 (모델별 50만~3000만 wide).
//  - 따라서 broad SKU는 confidence_low 마크 (confusionNote)
//  - 모델 추정 정확한 narrow SKU 가 우선 — broad 는 fallback 만.
//  - 다른 카테고리 (지갑/카드지갑/지갑/액세서리) 차단

import type { Sku } from "@/lib/catalog";

const BAG_COMMON_NOISE = [
  // 가품
  "짭", "가품", "레플리카", "replica", "fake", "미러", "샘플", "sample", "1:1", "11급", "이미테이션",
  "ST급", "st급", "복각",
  // 단품/매입
  "스트랩만", "체인만", "장식만", "팁만", "핸들만", "벨트만",
  "삽니다", "구합니다", "구해요", "구함", "매입",
  "감정 가능", "감정 문의", "정가품 문의", "감정 후 입금", "감정원", "감정사", "외관 부분만",
  // 반대 카테고리
  "신발", "스니커즈", "운동화",
  "티셔츠", "후드티", "맨투맨",
  // 액세서리
  "넥타이핀", "스트로공", "벨트", "키링", "키체인", "안경", "선글라스",
  "박스만", "더스트백만", "보증서만",
];

const BAG_TYPES = [
  // 가방 product type (모델 명시 안되도 가방으로 인식)
  "가방", "백", "bag", "토트", "tote", "숄더", "shoulder", "크로스백", "cross",
  "백팩", "backpack", "쇼퍼", "shopper", "버킷", "bucket", "보스턴", "boston",
  "포셰트", "pochette", "클러치", "clutch", "호보", "hobo", "메신저", "messenger",
  "더플", "duffle", "캐리어", "carrier", "여행가방", "여행 가방",
];

// 가방 / 지갑 격리
const WALLET_NOISE = [
  "지갑", "wallet", "카드지갑", "카드 지갑", "card holder", "카드 홀더",
  "반지갑", "장지갑", "동전지갑", "코인 지갑",
  "키 포셰트", "key pouch", "키 파우치", "felicie", "펠리시", "키 홀더",
  "지갑만", "지갑 단품",
];

export const BAG_WAVE266_CATALOG: Sku[] = [
  // ═══════════════════════════════════════════════════════════
  // Louis Vuitton — Broad fallback
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-lv-broad",
    brand: "Louis Vuitton",
    category: "bag",
    laneKey: "lv_broad",
    modelName: "Louis Vuitton 가방 (Broad — 모델 미상 fallback)",
    aliases: ["Louis Vuitton", "루이비통", "LV", "루비통", "비통"],
    mustContain: [
      ["louis vuitton", "루이비통", " lv ", "luiviton"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow SKU (이미 있음)
      "speedy 25", "speedy 30", "speedy 35", "speedy 40",
      "neverfull pm",
      "alma bb",
      "pochette accessoires", "포셰트 액세서리",
      "pochette metis", "포셰트 메티스",
      "felicie",
      // 의류/신발/벨트
      "신발", "스니커즈", "벨트", "스카프",
    ],
    msrpKrw: 2990000,
    released: 2024,
    confusionNote: "LV broad — 모델 추정 안 되는 LV 가방 fallback. variant 50만~3000만 wide. sku_median 신뢰도 낮음. 사용자에게 confidence_low 표시.",
  },

  // ═══════════════════════════════════════════════════════════
  // Gucci — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-gucci-broad",
    brand: "Gucci",
    category: "bag",
    laneKey: "gucci_broad",
    modelName: "Gucci 가방 (Broad)",
    aliases: ["Gucci", "구찌", "구치"],
    mustContain: [
      ["gucci", "구찌", "구치"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow SKU
      "marmont mini", "마몽 미니",
      "marmont camera", "마몽 카메라",
      "dionysus mini", "디오니소스 미니",
      "jackie mini", "재키 미니",
      "supreme card", "카드지갑",
      // 의류/신발
      "신발", "스니커즈", "벨트", "스카프", "후드티",
    ],
    msrpKrw: 1990000,
    released: 2024,
    confusionNote: "Gucci broad — 모델 추정 안 되는 구찌 가방 fallback.",
  },

  // ═══════════════════════════════════════════════════════════
  // Chanel — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-chanel-broad",
    brand: "Chanel",
    category: "bag",
    laneKey: "chanel_broad",
    modelName: "Chanel 가방 (Broad)",
    aliases: ["Chanel", "샤넬"],
    mustContain: [
      ["chanel", "샤넬"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 액세서리 별도
      "립스틱", "립밤", "퍼퓸", "perfume", "오 드", "edp", "edt", "향수", "ml ",
      "립", "립글로스",
      "신발", "스니커즈", "벨트",
    ],
    msrpKrw: 9900000,
    released: 2024,
    confusionNote: "Chanel broad — 모델 추정 안 되는 샤넬 가방 fallback. variant 100만~5000만 wide.",
  },

  // ═══════════════════════════════════════════════════════════
  // Dior — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-dior-broad",
    brand: "Dior",
    category: "bag",
    laneKey: "dior_broad",
    modelName: "Dior 가방 (Broad)",
    aliases: ["Dior", "디올", "Christian Dior"],
    mustContain: [
      ["dior", "디올"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 향수/화장품
      "퍼퓸", "perfume", "오 드", "edp", "edt", "향수", "ml ",
      "립스틱", "립밤", "립글로스", "쿠션", "파데", "마스카라", "아이섀도",
      "신발", "스니커즈", "벨트",
    ],
    msrpKrw: 4990000,
    released: 2024,
    confusionNote: "Dior broad — 모델 추정 안 되는 디올 가방 fallback.",
  },

  // ═══════════════════════════════════════════════════════════
  // Prada — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-prada-broad",
    brand: "Prada",
    category: "bag",
    laneKey: "prada_broad",
    modelName: "Prada 가방 (Broad)",
    aliases: ["Prada", "프라다"],
    mustContain: [
      ["prada", "프라다"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow SKU
      "saffiano galleria mini",
      "saffiano card",
      "tessuto vintage",
      "pocono vintage",
      "nylon hobo",
      "신발", "스니커즈", "벨트", "스카프",
      // 향수
      "퍼퓸", "perfume", "향수", "edp", "edt", "ml ",
    ],
    msrpKrw: 1690000,
    released: 2024,
    confusionNote: "Prada broad — 모델 추정 안 되는 프라다 가방 fallback.",
  },

  // ═══════════════════════════════════════════════════════════
  // Celine — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-celine-broad",
    brand: "Celine",
    category: "bag",
    laneKey: "celine_broad",
    modelName: "Celine 가방 (Broad)",
    aliases: ["Celine", "셀린느", "셀린", "Céline"],
    mustContain: [
      ["celine", "céline", "셀린느", "셀린"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow
      "trio medium", "트리오 미디엄",
      "trio pouch",
      "vintage macadam",
      // 향수
      "퍼퓸", "perfume", "향수", "edp", "edt", "ml ",
      "신발", "벨트",
    ],
    msrpKrw: 2990000,
    released: 2024,
    confusionNote: "Celine broad — 모델 추정 안 되는 셀린느 가방 fallback.",
  },

  // ═══════════════════════════════════════════════════════════
  // Bottega Veneta — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-bottega-broad",
    brand: "Bottega Veneta",
    category: "bag",
    laneKey: "bottega_broad",
    modelName: "Bottega Veneta 가방 (Broad)",
    aliases: ["Bottega Veneta", "보테가베네타", "보테가 베네타", "보테가"],
    mustContain: [
      ["bottega", "보테가"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow
      "cassette mini", "카세트 미니",
      "신발", "벨트",
    ],
    msrpKrw: 2690000,
    released: 2024,
    confusionNote: "Bottega broad — 모델 추정 안 되는 보테가 가방 fallback.",
  },

  // ═══════════════════════════════════════════════════════════
  // Hermes — Broad (버킨/켈리 외)
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-hermes-broad",
    brand: "Hermes",
    category: "bag",
    laneKey: "hermes_broad",
    modelName: "Hermes 가방 (버킨/켈리 외 broad)",
    aliases: ["Hermes", "에르메스", "Hermès"],
    mustContain: [
      ["hermes", "에르메스", "hermès"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 버킨/켈리는 별도 (영업가 너무 다름)
      "birkin", "버킨",
      "kelly", "켈리",
      // 스카프/액세서리
      "스카프", "scarf", "벨트", "키링",
      "퍼퓸", "perfume", "향수", "edp", "edt", "ml ",
    ],
    msrpKrw: 5990000,
    released: 2024,
    confusionNote: "Hermes broad (non-Birkin/Kelly) — Constance/Garden Party/Evelyne/Picotin 등 fallback.",
  },

  // ═══════════════════════════════════════════════════════════
  // Balenciaga — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-balenciaga-broad",
    brand: "Balenciaga",
    category: "bag",
    laneKey: "balenciaga_broad",
    modelName: "Balenciaga 가방 (Broad)",
    aliases: ["Balenciaga", "발렌시아가"],
    mustContain: [
      ["balenciaga", "발렌시아가"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow
      "classic city mini",
      "신발", "스니커즈", "벨트",
    ],
    msrpKrw: 2390000,
    released: 2024,
    confusionNote: "Balenciaga broad — 모델 추정 안 되는 발렌시아가 가방 fallback.",
  },

  // ═══════════════════════════════════════════════════════════
  // Burberry — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-burberry-broad",
    brand: "Burberry",
    category: "bag",
    laneKey: "burberry_broad",
    modelName: "Burberry 가방 (Broad)",
    aliases: ["Burberry", "버버리"],
    mustContain: [
      ["burberry", "버버리"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 향수/스카프/의류
      "퍼퓸", "perfume", "향수", "edp", "edt", "ml ",
      "스카프", "scarf",
      "트렌치", "trench", "트렌치코트", "코트",
      "신발", "스니커즈",
    ],
    msrpKrw: 1490000,
    released: 2024,
    confusionNote: "Burberry broad — 모델 추정 안 되는 버버리 가방 fallback.",
  },

  // ═══════════════════════════════════════════════════════════
  // Coach — Broad (signature-tote 외 broad)
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-coach-apparel-broad",
    brand: "Coach",
    category: "bag",
    laneKey: "coach_apparel_broad",
    modelName: "Coach 가방 (Broad — 일반 라인)",
    aliases: ["Coach", "코치"],
    mustContain: [
      ["coach", "코치"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow
      "signature tote", "시그니처 토트",
      // 코치 자켓 (의류)
      "자켓", "jacket", "야구점퍼",
      // 굿즈 (주술회전 등)
      "주술회전", "고죠", "굿즈", "교복", "회옥절",
      // 코치 (스포츠 코치) 의류
      "코치자켓", "코치 자켓",
    ],
    msrpKrw: 590000,
    released: 2024,
    confusionNote: "Coach broad — 모델 추정 안 되는 코치 가방 fallback (signature-tote 외).",
  },

  // ═══════════════════════════════════════════════════════════
  // Maison Margiela — Bag broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-margiela-broad",
    brand: "Maison Margiela",
    category: "bag",
    laneKey: "margiela_bag_broad",
    modelName: "Maison Margiela 가방 (Broad — 5AC 외)",
    aliases: ["Maison Margiela", "메종 마르지엘라", "마르지엘라", "Margiela", "MM6"],
    mustContain: [
      ["maison margiela", "마르지엘라", "margiela", "mm6"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow
      "5ac mini",
      // 의류 별도 (MM6 의류)
      "티셔츠", "후드티", "맨투맨", "자켓 ", "셔츠 ",
      // 살로몬 콜라보 (신발)
      "살로몬", "salomon", "xt-4",
      // 향수 (Replica)
      "replica", "ml ", "edp", "edt",
    ],
    msrpKrw: 990000,
    released: 2024,
    confusionNote: "Margiela bag broad — 5AC mini 외 fallback.",
  },

  // ═══════════════════════════════════════════════════════════
  // Valentino — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-valentino-broad",
    brand: "Valentino",
    category: "bag",
    laneKey: "valentino_broad",
    modelName: "Valentino 가방 (Broad)",
    aliases: ["Valentino", "발렌티노"],
    mustContain: [
      ["valentino", "발렌티노"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      "신발", "스니커즈", "벨트",
    ],
    msrpKrw: 1690000,
    released: 2024,
    confusionNote: "Valentino broad — Rockstud/VLogo 등 fallback.",
  },

  // ═══════════════════════════════════════════════════════════
  // YSL (Saint Laurent) — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-ysl-broad",
    brand: "Saint Laurent",
    category: "bag",
    laneKey: "ysl_broad",
    modelName: "Saint Laurent / YSL 가방 (Broad)",
    aliases: ["Saint Laurent", "입생로랑", "YSL", "생로랑"],
    mustContain: [
      ["saint laurent", "입생로랑", "ysl", "생로랑"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 화장품
      "립스틱", "립밤", "립글로스", "쿠션",
      "퍼퓸", "perfume", "향수", "edp", "edt", "ml ",
      "신발", "스니커즈",
    ],
    msrpKrw: 2890000,
    released: 2024,
    confusionNote: "YSL broad — Loulou/Sac de Jour/Niki 등 fallback.",
  },

  // ═══════════════════════════════════════════════════════════
  // MCM — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-mcm-broad",
    brand: "MCM",
    category: "bag",
    laneKey: "mcm_broad",
    modelName: "MCM 가방 (Broad — visetos 외)",
    aliases: ["MCM", "엠씨엠"],
    mustContain: [
      ["mcm", "엠씨엠"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow
      "visetos medium backpack",
      // 키워드 noise
      "맥엠", "mcm 의료기기",
    ],
    msrpKrw: 690000,
    released: 2024,
  },

  // ═══════════════════════════════════════════════════════════
  // Ferragamo — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-ferragamo-broad",
    brand: "Salvatore Ferragamo",
    category: "bag",
    laneKey: "ferragamo_broad",
    modelName: "Ferragamo 가방 (Broad)",
    aliases: ["Ferragamo", "페라가모", "Salvatore Ferragamo"],
    mustContain: [
      ["ferragamo", "페라가모"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      "신발", "벨트",
    ],
    msrpKrw: 1290000,
    released: 2024,
  },

  // ═══════════════════════════════════════════════════════════
  // Miu Miu — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-miumiu-broad",
    brand: "Miu Miu",
    category: "bag",
    laneKey: "miumiu_broad",
    modelName: "Miu Miu 가방 (Broad)",
    aliases: ["Miu Miu", "미우미우", "MiuMiu"],
    mustContain: [
      ["miu miu", "miumiu", "미우미우"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
    ],
    msrpKrw: 1890000,
    released: 2024,
  },

  // ═══════════════════════════════════════════════════════════
  // Lemaire — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-lemaire-broad",
    brand: "Lemaire",
    category: "bag",
    laneKey: "lemaire_broad",
    modelName: "Lemaire 가방 (Broad)",
    aliases: ["Lemaire", "르메르"],
    mustContain: [
      ["lemaire", "르메르"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 의류 별도
      "셔츠", "팬츠", "자켓", "코트",
    ],
    msrpKrw: 990000,
    released: 2024,
  },

  // ═══════════════════════════════════════════════════════════
  // CDG Bag — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-cdg-broad",
    brand: "Comme des Garçons",
    category: "bag",
    laneKey: "cdg_bag_broad",
    modelName: "CDG / 꼼데가르송 지갑/가방 (Broad)",
    aliases: ["Comme des Garcons", "꼼데가르송", "CDG", "comme des"],
    mustContain: [
      ["comme des", "꼼데가르송", "cdg "],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      // 의류
      "셔츠", "팬츠", "자켓", "코트", "후드티", "맨투맨", "티셔츠",
      // 신발 콜라보 (살로몬 등)
      "살로몬", "converse", "컨버스",
    ],
    msrpKrw: 290000,
    released: 2024,
  },

  // ═══════════════════════════════════════════════════════════
  // Tom Browne — Bag broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-thombrowne-broad",
    brand: "Thom Browne",
    category: "bag",
    laneKey: "thombrowne_bag_broad",
    modelName: "Thom Browne 가방 (Broad)",
    aliases: ["Thom Browne", "톰브라운"],
    mustContain: [
      ["thom browne", "톰브라운", "톰 브라운"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...WALLET_NOISE,
      "tom ford", "톰포드",  // 다른 브랜드
      "셔츠", "팬츠", "자켓", "코트",
    ],
    msrpKrw: 1490000,
    released: 2024,
  },
];
