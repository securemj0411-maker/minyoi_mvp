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
  // 포장재/구성품 단품. "쇼퍼백" 본품과 다르게 종이 shopping bag은 비교군 오염.
  "종이백", "종이 백", "쇼핑백", "쇼핑 백", "shopping bag", "패키지",
  // 뷰티/화장품 사은품 pouch/tote. 명품 본품 가방 비교군에서 제외.
  "뷰티", "beauty", "코스메틱", "cosmetic", "화장품", "립스틱", "립밤", "어딕트", "홀리데이",
  "백스테이지", "backstage", "블러셔", "blusher", "팔레트", "palette", "아이크림", "하이라이터",
  // SPA/협업 저가 라인. 럭셔리 broad fallback과 가격대가 다름.
  "유니클로", "유니클로u", "uniqlo", "uniqlo u",
  // 반대 카테고리
  "신발", "스니커즈", "운동화",
  "티셔츠", "후드티", "맨투맨",
  "모자", "볼캡", "스냅백", "5패널", "파이브패널", "five panel", "5 panel",
  // 액세서리
  "넥타이핀", "스트로공", "벨트", "키링", "키체인", "안경", "선글라스",
  "백앤센스", "bag and sense",
  "박스만", "더스트백만", "보증서만",
];

const BAG_TYPES = [
  // 가방 product type (모델 명시 안되도 가방으로 인식)
  "가방", "백 ", "bag", "토트", "tote", "숄더", "shoulder", "크로스백", "cross",
  "백팩", "backpack", "쇼퍼", "shopper", "버킷", "bucket", "보스턴", "boston",
  "포셰트", "pochette", "클러치", "clutch", "호보", "hobo", "메신저", "messenger",
  "더플", "duffle", "캐리어", "carrier", "여행가방", "여행 가방",
];

// Wave 267b (2026-05-20): bag broad SKU에 일관 적용할 의류/신발/향수 차단 noise.
//   API sweep 발견 — bag-cdg-broad 98%/bag-balenciaga-broad 83%/bag-margiela-broad 79% 가 의류/향수 매물에 잡힘.
const BAG_NON_BAG_NOISE = [
  // 의류
  "반팔", "반팔티", "티셔츠", "tee ", "맨투맨", "후드티", "후드 티",
  "니트", "knit", "캐시미어", "cashmere",
  "데님자켓", "데님 자켓", "데님셔츠", "데님 셔츠", "데님셔츠자켓", "셔츠자켓",
  "청바지", "jeans", "스케이트진", "skate jean", "skate jeans",
  "하프집업", "하프 집업", "half zip", "풀집업",
  "스웻", "sweat", "스웻셔츠", "스웻 셔츠",
  "점퍼", "jumper", "점프수트",
  "오버핏 반팔", "오버핏 셔츠", "오버핏 자켓", "셋업",
  "패딩", "다운자켓", "다운 자켓",
  "머플러", "스카프", "scarf",
  // 향수 (Margiela Replica 등)
  "edt", "edp", "오드뚜왈렛", "오드 뚜왈렛", "오드퍼퓸", "오드 퍼퓸",
  "100ml", "50ml", "30ml", "75ml",
  "replica", "재즈클럽", "레이지선데이", "lazy sunday",
  // 신발 (Bottega 퍼들 등)
  "퍼들", "puddle", "샌들 보트", "더비 슈즈", "boot 슈즈",
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
      ...BAG_NON_BAG_NOISE,
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
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown 매물 fallback (variant wide, confidence_low 표시됨)
  },

  // ═══════════════════════════════════════════════════════════
  // Gucci — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-gucci-gg-marmont-small-shoulder",
    brand: "Gucci",
    category: "bag",
    laneKey: "bag_gucci_marmont_small_shoulder",
    modelName: "Gucci GG Marmont Matelasse Small Shoulder Bag",
    aliases: ["Gucci GG Marmont Small Shoulder", "구찌 GG 마몽 스몰 숄더백", "구찌 마몬트 마틀라세 스몰"],
    mustContain: [
      ["gucci", "구찌", "구치"],
      ["마몽", "marmont", "마몬트", "마몽트"],
      ["스몰", "small", "443497"],
      ["숄더", "shoulder", "크로스", "cross", "마틀라세", "matelasse"],
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      "미니", "mini", "슈퍼미니", "super mini", "카메라", "camera", "카드지갑", "반지갑", "지갑",
      "탑핸들", "top handle", "백팩", "backpack", "벨트백", "belt bag",
      "버킷백", "버킷 백", "bucket", "토트", "tote",
      "신발", "스니커즈", "의류", "옷",
    ],
    msrpKrw: 3600000,
    released: 2024,
    confusionNote: "Wave 485 후보: Gucci broad에서 GG Marmont small shoulder/matelasse 분리.",
    defaultProductType: "shoulder",
  },
  {
    id: "bag-gucci-ophidia-top-handle",
    brand: "Gucci",
    category: "bag",
    laneKey: "bag_gucci_ophidia_top_handle",
    modelName: "Gucci Ophidia Top Handle Bag",
    aliases: ["Gucci Ophidia Top Handle", "구찌 오피디아 탑핸들백"],
    mustContain: [
      ["gucci", "구찌", "구치"],
      ["오피디아", "ophidia"],
      ["탑핸들", "탑 핸들", "top handle", "핸들백"],
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      "토트", "tote", "라지", "large", "카드지갑", "반지갑", "지갑",
      "신발", "스니커즈", "의류", "옷",
    ],
    msrpKrw: 3200000,
    released: 2024,
    confusionNote: "Wave 485 후보: Gucci broad에서 Ophidia top-handle 분리.",
    defaultProductType: "top_handle",
  },
  {
    id: "bag-gucci-ophidia-tote",
    brand: "Gucci",
    category: "bag",
    laneKey: "bag_gucci_ophidia_tote",
    modelName: "Gucci Ophidia Tote Bag",
    aliases: ["Gucci Ophidia Tote", "구찌 오피디아 토트백"],
    mustContain: [
      ["gucci", "구찌", "구치"],
      ["오피디아", "ophidia"],
      ["토트", "tote", "쇼퍼", "shopper"],
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      "탑핸들", "탑 핸들", "top handle", "카드지갑", "반지갑", "지갑",
      "신발", "스니커즈", "의류", "옷",
    ],
    msrpKrw: 3900000,
    released: 2024,
    confusionNote: "Wave 485 후보: Gucci broad에서 Ophidia tote/shopper 분리.",
    defaultProductType: "tote",
  },
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow SKU
      "marmont mini", "마몽 미니",
      "marmont camera", "마몽 카메라",
      "dionysus mini", "디오니소스 미니", "디오니소스",
      "jackie mini", "재키 미니", "재키 1961",
      "supreme card", "카드지갑",
      // Wave 266b API sweep 발견 — 229건 contamination. narrow keyword 강화.
      "오피디아", "ophidia",
      "마몽 슈퍼미니", "marmont super mini", "마몽 백팩",
      "gg 마몽", "gg marmont", "더블 g 마몽",
      "재키", "jackie",
      "gg 캔버스 쇼퍼", "gg supreme shopper", "gg 캔버스 토트",
      "수프림 캔버스", "supreme canvas",
      "혹스턴", "horsebit",
      "실비", "sylvie", "뱀부", "bamboo",
      // 의류/신발/액세서리
      "신발", "스니커즈", "벨트", "스카프", "후드티",
      "키링", "키체인",
    ],
    msrpKrw: 1990000,
    released: 2024,
    confusionNote: "Gucci broad — 모델 추정 안 되는 구찌 가방 fallback.",
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown 매물 fallback (variant wide, confidence_low 표시됨)
  },

  // ═══════════════════════════════════════════════════════════
  // Chanel — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-chanel-cosmetic-box",
    brand: "Chanel",
    category: "bag",
    laneKey: "chanel_cosmetic_box",
    modelName: "Chanel Cosmetic Box / Cosmetic Chain Bag",
    aliases: ["Chanel Cosmetic Box", "샤넬 코스메틱백", "샤넬 코스메틱 박스백"],
    mustContain: [
      ["chanel", "샤넬"],
      ["코스메틱", "cosmetic"],
      ["백", "bag", "가방", "체인", "박스백", "box bag"],
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...BAG_NON_BAG_NOISE,
      "립스틱", "립밤", "퍼퓸", "perfume", "오 드", "edp", "edt", "향수", "ml ",
      "립", "립글로스", "화장품", "뷰티", "beauty",
      "신발", "스니커즈", "벨트", "종이백", "종이 백", "쇼핑백 단품", "쇼핑백만",
    ],
    msrpKrw: 4200000,
    released: 2020,
    confusionNote: "Wave 484 후보: Chanel broad에서 반복된 코스메틱 박스/체인백 분리. Beauty/cosmetic item은 계속 차단.",
    defaultProductType: "crossbody",
  },
  {
    id: "bag-chanel-woc-charm-wallet",
    brand: "Chanel",
    category: "bag",
    laneKey: "chanel_woc_charm_wallet",
    modelName: "Chanel Wallet on Chain / Charm Wallet",
    aliases: ["Chanel WOC", "샤넬 참월렛", "샤넬 체인 월렛"],
    mustContain: [
      ["chanel", "샤넬"],
      ["참월렛", "참 월렛", "체인 월렛", "체인월렛", "wallet on chain", "woc"],
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...BAG_NON_BAG_NOISE,
      "립스틱", "립밤", "퍼퓸", "perfume", "오 드", "edp", "edt", "향수", "ml ",
      "신발", "스니커즈", "벨트", "종이백", "종이 백", "쇼핑백 단품", "쇼핑백만",
    ],
    msrpKrw: 5800000,
    released: 2018,
    confusionNote: "Wave 484 후보: Chanel broad 내 wallet-on-chain/charm-wallet 분리.",
    defaultProductType: "crossbody",
  },
  {
    id: "bag-chanel-shopper-new-surf",
    brand: "Chanel",
    category: "bag",
    laneKey: "chanel_shopper_new_surf",
    modelName: "Chanel Shopper / New Surf Bag",
    aliases: ["Chanel Shopper", "샤넬 쇼퍼백", "샤넬 뉴서프"],
    mustContain: [
      ["chanel", "샤넬"],
      ["쇼퍼백", "shopper", "뉴서프", "new surf", "new-surf"],
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...BAG_NON_BAG_NOISE,
      "립스틱", "립밤", "퍼퓸", "perfume", "오 드", "edp", "edt", "향수", "ml ",
      "신발", "스니커즈", "벨트", "종이백", "종이 백", "paper bag", "쇼핑백 단품", "쇼핑백만",
      "패키지", "박스만", "더스트백만",
    ],
    msrpKrw: 9000000,
    released: 2024,
    confusionNote: "Wave 484 후보: Chanel broad 내 실제 shopper/new-surf bag. 종이 쇼핑백은 mustNot으로 유지.",
    defaultProductType: "tote",
  },
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      // 액세서리 별도
      "립스틱", "립밤", "퍼퓸", "perfume", "오 드", "edp", "edt", "향수", "ml ",
      "립", "립글로스",
      "신발", "스니커즈", "벨트",
    ],
    msrpKrw: 9900000,
    released: 2024,
    confusionNote: "Chanel broad — 모델 추정 안 되는 샤넬 가방 fallback. variant 100만~5000만 wide.",
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown 매물 fallback (variant wide, confidence_low 표시됨)
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      // 향수/화장품
      "퍼퓸", "perfume", "오 드", "edp", "edt", "향수", "ml ",
      "립스틱", "립밤", "립글로스", "쿠션", "파데", "마스카라", "아이섀도",
      "신발", "스니커즈", "벨트",
      // J'ADIOR slingback shoe.
      "j'adior", "jadior", "j adior",
    ],
    msrpKrw: 4990000,
    released: 2024,
    confusionNote: "Dior broad — 모델 추정 안 되는 디올 가방 fallback.",
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown 매물 fallback (variant wide, confidence_low 표시됨)
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow SKU
      "saffiano galleria mini",
      "saffiano card",
      "tessuto vintage",
      "pocono vintage",
      "nylon hobo",
      // Wave 266b API sweep 발견 — 209건 contamination. narrow keyword 강화.
      "리나일론", "re-nylon", "re nylon",
      "사피아노", "saffiano",
      "테수토", "tessuto",
      "포코노", "pocono",
      "갈레리아", "galleria",
      "심볼", "symbole",
      "트라이앵글", "triangle",
      "클리오", "cleo",
      "신발", "스니커즈", "벨트", "스카프",
      // 향수
      "퍼퓸", "perfume", "향수", "edp", "edt", "ml ",
    ],
    msrpKrw: 1690000,
    released: 2024,
    confusionNote: "Prada broad — 모델 추정 안 되는 프라다 가방 fallback.",
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown 매물 fallback (variant wide, confidence_low 표시됨)
  },

  // ═══════════════════════════════════════════════════════════
  // Celine — Triomphe family
  // ═══════════════════════════════════════════════════════════
  {
    id: "bag-celine-triomphe-broad",
    brand: "Celine",
    category: "bag",
    laneKey: "celine_triomphe_broad",
    modelName: "Celine Triomphe Bag Family (오벌/버킷/폴코/베사체/호보)",
    aliases: ["Celine Triomphe", "셀린느 트리옹프", "셀린 트리옹프"],
    mustContain: [
      ["celine", "céline", "셀린느", "셀린"],
      ["트리옹프", "트리옴프", "triomphe"],
      BAG_TYPES,
    ],
    mustNotContain: [
      ...BAG_COMMON_NOISE,
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      "신발", "벨트", "향수", "perfume", "퍼퓸", "edp", "edt", "ml ",
    ],
    msrpKrw: 3200000,
    released: 2019,
    confusionNote: "Celine Triomphe family broad — exact variant still wide; separated from generic Celine broad.",
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow
      "trio medium", "트리오 미디엄",
      "trio pouch",
      "vintage macadam",
      // Wave 266b API sweep 발견 — 92건 contamination. narrow keyword 강화.
      "트리옹프", "triomphe",
      "셀린느 클로드", "claude",
      "벨트 백", "belt bag",
      "16 백", "16 bag",
      "보스턴 백", "boston bag",  // 트리옹프 모델 다수
      // 향수
      "퍼퓸", "perfume", "향수", "edp", "edt", "ml ",
      "신발", "벨트",
    ],
    msrpKrw: 2990000,
    released: 2024,
    confusionNote: "Celine broad — 모델 추정 안 되는 셀린느 가방 fallback.",
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown 매물 fallback (variant wide, confidence_low 표시됨)
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow
      "cassette", "카세트", "cassette mini", "카세트 미니",
      "신발", "벨트",
    ],
    msrpKrw: 2690000,
    released: 2024,
    confusionNote: "Bottega broad — 모델 추정 안 되는 보테가 가방 fallback.",
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown 매물 fallback (variant wide, confidence_low 표시됨)
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
      ...BAG_NON_BAG_NOISE,
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
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown 매물 fallback (variant wide, confidence_low 표시됨)
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow
      "classic city mini",
      "신발", "스니커즈", "벨트",
    ],
    msrpKrw: 2390000,
    released: 2024,
    confusionNote: "Balenciaga broad — 모델 추정 안 되는 발렌시아가 가방 fallback.",
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown 매물 fallback (variant wide, confidence_low 표시됨)
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
      ...BAG_NON_BAG_NOISE,
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
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown 매물 fallback (variant wide, confidence_low 표시됨)
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow
      "5ac mini",
      // Wave 266b API sweep 발견 — 64건 contamination. 5AC 전 사이즈 (mini/small/medium/large) 모두 narrow에 맡김.
      "5ac",
      "5ac백", "5ac가방", "5ac크로스", "5ac크로스백", "5ac미니", "5ac마이크로", "5ac스몰",
      "글램 슬램", "glam slam",
      "재팬 백", "japanese bag",
      // 의류 별도 (MM6 의류) — 반팔/티셔츠 강화
      "티셔츠", "후드티", "맨투맨", "자켓 ", "셔츠 ", "반팔", "반팔티",
      // 살로몬 콜라보 (신발)
      "살로몬", "salomon", "xt-4",
      // 향수 (Replica)
      "replica", "ml ", "edp", "edt",
    ],
    msrpKrw: 990000,
    released: 2024,
    confusionNote: "Margiela bag broad — 5AC mini 외 fallback.",
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown 매물 fallback (variant wide, confidence_low 표시됨)
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      "신발", "스니커즈", "벨트",
    ],
    msrpKrw: 1690000,
    released: 2024,
    confusionNote: "Valentino broad — Rockstud/VLogo 등 fallback.",
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown 매물 fallback (variant wide, confidence_low 표시됨)
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      // 화장품
      "립스틱", "립밤", "립글로스", "쿠션",
      "퍼퓸", "perfume", "향수", "edp", "edt", "ml ",
      "신발", "스니커즈",
    ],
    msrpKrw: 2890000,
    released: 2024,
    confusionNote: "YSL broad — Loulou/Sac de Jour/Niki 등 fallback.",
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown 매물 fallback (variant wide, confidence_low 표시됨)
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      // 별도 narrow
      "visetos medium backpack",
      // 키워드 noise
      "맥엠", "mcm 의료기기",
    ],
    msrpKrw: 690000,
    released: 2024,
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown fallback
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      "신발", "벨트",
    ],
    msrpKrw: 1290000,
    released: 2024,
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown fallback
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
    ],
    msrpKrw: 1890000,
    released: 2024,
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown fallback
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      // 의류 별도
      "셔츠", "팬츠", "자켓", "코트",
    ],
    msrpKrw: 990000,
    released: 2024,
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown fallback
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      // 의류
      "셔츠", "팬츠", "자켓", "코트", "후드티", "맨투맨", "티셔츠", "반팔", "반팔티",
      // 신발 콜라보 (살로몬 등)
      "살로몬", "converse", "컨버스",
      // Wave 266b API sweep 발견 — PVC 가방 narrow 가능. broad는 PVC 외 일반 catch.
      "pvc",
    ],
    msrpKrw: 290000,
    released: 2024,
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown fallback
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
      ...BAG_NON_BAG_NOISE,
      ...WALLET_NOISE,
      "tom ford", "톰포드",  // 다른 브랜드
      "셔츠", "팬츠", "자켓", "코트",
      // Wave 266b API sweep 발견 — 71건 contamination (의류 반팔티 다수).
      "반팔", "반팔티", "티셔츠", "tee ", "후드", "맨투맨", "포켓 반팔", "포켓 티",
    ],
    msrpKrw: 1490000,
    released: 2024,
    defaultProductType: "shoulder", // Wave 269: broad SKU type_unknown fallback
  },
];
