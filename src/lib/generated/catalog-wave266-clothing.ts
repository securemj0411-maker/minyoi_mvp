// Wave 266 (2026-05-20): 번개장터 deep sweep 결과 → clothing catalog 대폭 보강.
//
// raw 카테고리 320xxx (의류) 미매칭 분석:
//  - 폴로/랄프로렌 235건 (avg 31만) — RRL/Bear 외 일반 폴로 셔츠/맨투맨 누락
//  - 베이프 147건 — 자켓/트랙탑/저지/스노보드자켓 누락 (hoodie/tee 외)
//  - 스투시 110건 — basic-tee/hoodie 외 자켓/팬츠 누락
//  - 슈프림 60건 (avg 42만) — TNF 콜라보 외 일반 보드자켓/팬츠
//  - 아크네 51건 (avg 35만)
//  - 꼼데가르송 49건 (avg 31만)
//  - 칼하트 14건 (avg 30만)
//  - 톰브라운 25건 (avg 46만)
//  - 챔피온 11건
//  - 발토로 5건 (avg 122만!) — 노스페이스 최고가 모델
//  - 눕시 14건 (avg 42만) — 우리 nuptse-1996 있지만 일반 눕시 자켓 누락
//  - 아디다스 트랙수트 28건 (avg 77만) — 발렌시아가/웨일즈보너 콜라보 다수
//
// 정책:
//  - 광범위 brand-apparel SKU 박기 (티/후드/맨투맨/자켓/팬츠 등 일반 매물 catch)
//  - 콜라보/한정 mustNotContain (가격 변동 큼)
//  - 가방/신발 반대 카테고리 차단

import type { Sku } from "@/lib/catalog";

const CLOTHING_COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "짭", "가품",
  // 반대 카테고리
  "신발", "스니커즈", "운동화", "shoe", "sneaker",
  "가방", "백팩", "토트", "숄더", "크로스백", "bag",
  // 단품/매입
  "삽니다", "구합니다", "구해요", "구함", "매입",
  "단추만", "지퍼만", "스트랩만", "박스만",
];

const COLLAB_COMMON_NOISE = [
  // 폴로 콜라보 (RRL 별도 SKU)
  "rrl", "ralph lauren rrl", "double rl",
  // 폴로 콜라보 (Bear/Country 별도)
  // 자체 collab 일반 차단
];

const CLOTHING_PRODUCT_TYPES = [
  "반팔", "티셔츠", "tee ", "t-shirt", "후드", "hoodie", "후드티", "후디",
  "맨투맨", "크루넥", "스웨트셔츠", "sweatshirt",
  "셔츠", "shirt", "남방", "블라우스", "blouse",
  "자켓", "jacket", "코트", "coat", "바람막이", "윈드러너", "윈드브레이커",
  "패딩", "다운", "down", "푸퍼",
  "팬츠", "pants", "바지", "슬랙스", "치노",
  "조거", "jogger", "쇼츠", "shorts", "반바지",
  "스웻팬츠", "sweatpants", "트랙팬츠", "트랙수트", "tracksuit",
  "트랙탑", "탑", "track top",
  "베스트", "vest", "조끼",
  "니트", "knit", "스웨터", "sweater", "가디건", "cardigan",
  "데님", "denim", "진", "jeans",
  "스커트", "skirt",
];

export const CLOTHING_WAVE266_CATALOG: Sku[] = [
  // ═══════════════════════════════════════════════════════════
  // Polo Ralph Lauren — 일반 폴로 의류 broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-polo-apparel-broad",
    brand: "Polo Ralph Lauren",
    category: "clothing",
    laneKey: "polo_apparel_broad",
    modelName: "Polo Ralph Lauren Apparel (Broad, 일반 라인)",
    aliases: ["Polo Ralph Lauren", "폴로 랄프로렌", "랄프로렌", "Polo", "랄프 로렌"],
    mustContain: [
      ["polo ralph", "폴로 랄프", "랄프로렌", "랄프 로렌", "ralph lauren", "polo 랄프", "polo by ralph"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      // 별도 SKU
      "rrl", "double rl",
      "polo bear", "bear sweater", "곰", "베어",
      "purple label", "퍼플라벨", "rlx",
      // 자체 colab
      "supreme x polo", "polo x supreme",
    ],
    msrpKrw: 169000,
    released: 1967,
  },

  // ═══════════════════════════════════════════════════════════
  // BAPE — 자켓/트랙탑 (hoodie/tee 외)
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-bape-jacket-broad",
    brand: "A Bathing Ape (BAPE)",
    category: "clothing",
    laneKey: "bape_jacket_broad",
    modelName: "BAPE Jacket / 트랙탑 / 보드자켓 (Broad)",
    aliases: ["BAPE Jacket", "베이프 자켓", "BAPE Tracktop", "베이프 트랙탑"],
    mustContain: [
      ["bape", "베이프", "a bathing ape"],
      ["자켓", "jacket", "트랙탑", "track top", "tracktop", "보드자켓", "snowboard", "스노보드", "코치자켓", "윈드", "야구점퍼", "베이스볼 저지", "varsity", "바시티"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      // 별도 SKU
      "샤크 후드", "shark hoodie",
      "shark", "샤크",
      "반팔", "티셔츠", "후드티",
      // 콜라보
      "travis scott", "트래비스 스캇",
      "moncler", "몽클레어",
      "stussy", "스투시",
      "wtaps",
      "puma", "푸마",
      "꼼데가르송", "cdg",
      "타미", "tommy",
      "아디다스",
    ],
    msrpKrw: 590000,
    released: 1993,
    defaultProductType: "jacket",
  },

  // ═══════════════════════════════════════════════════════════
  // Stussy — 자켓/팬츠 broad (basic-tee/hoodie 외)
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-stussy-apparel-broad",
    brand: "Stussy",
    category: "clothing",
    laneKey: "stussy_apparel_broad",
    modelName: "Stussy Apparel (Broad — 자켓/팬츠/셔츠)",
    aliases: ["Stussy", "스투시", "Stüssy"],
    mustContain: [
      ["stussy", "stüssy", "스투시"],
      ["자켓", "jacket", "패딩", "코트", "셔츠", "팬츠", "pants", "바지", "조거", "쇼츠", "베스트", "조끼", "니트", "knit", "가디건", "윈드"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      // 별도 SKU
      "basic tee", "베이직 티", "8ball",
      "hoodie", "후드티", "후디",
      "반팔", "티셔츠",
      // 콜라보
      "nike x stussy", "stussy x nike",
      "dior", "디올",
      "bape", "베이프",
      "kapital",
      "cdg", "꼼데가르송",
    ],
    msrpKrw: 159000,
    released: 1980,
  },

  // ═══════════════════════════════════════════════════════════
  // Supreme — 일반 broad (TNF/BAPE collab 별도)
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-supreme-apparel-broad",
    brand: "Supreme",
    category: "clothing",
    laneKey: "supreme_apparel_broad",
    modelName: "Supreme Apparel (Broad — 일반 라인)",
    aliases: ["Supreme", "슈프림"],
    mustContain: [
      ["supreme", "슈프림"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      // 별도 SKU
      "the north face", "노스페이스", "tnf",
      "bape", "베이프",
      "louis vuitton", "루이비통", "lv",
      "stone island", "스톤아일랜드",
      "comme des", "꼼데가르송",
      "nike x supreme", "supreme x nike",
      "stussy",
      // 가짜
      "1:1", "11급", "미러", "복각",
    ],
    msrpKrw: 199000,
    released: 1994,
  },

  // ═══════════════════════════════════════════════════════════
  // Acne Studios — Broad apparel (apparel narrow 외 보강)
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-acne-broad",
    brand: "Acne Studios",
    category: "clothing",
    laneKey: "acne_broad",
    modelName: "Acne Studios Apparel (Broad)",
    aliases: ["Acne Studios", "아크네 스튜디오", "아크네", "Acne"],
    mustContain: [
      ["acne", "아크네"],
      ["자켓", "코트", "패딩", "셔츠", "팬츠", "스커트", "베스트", "조끼", "니트", "knit", "가디건", "스웨터"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      // 별도 SKU (이미 narrow 있음)
      "denim", "데님", "진 ", " 진 ",
      "tee", "티셔츠", "반팔",
      "hoodie", "후드티",
      "맨투맨", "sweat",
      // 화장품
      "립밤", "립스틱", "토너", "에센스",
    ],
    msrpKrw: 590000,
    released: 1996,
  },

  // ═══════════════════════════════════════════════════════════
  // Comme des Garçons — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-cdg-apparel-broad",
    brand: "Comme des Garçons",
    category: "clothing",
    laneKey: "cdg_apparel_broad",
    modelName: "Comme des Garçons Apparel (Broad)",
    aliases: ["Comme des Garcons", "꼼데가르송", "CDG", "꼼데", "Comme des Garçons", "PLAY"],
    mustContain: [
      ["comme des", "꼼데가르송", "cdg ", "꼼 데", "comme des garcons"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      // 콜라보 별도
      "supreme",
      "nike",
      "converse",
      "salomon", "살로몬",
      "bape", "베이프",
      "stussy",
    ],
    msrpKrw: 390000,
    released: 1969,
  },

  // ═══════════════════════════════════════════════════════════
  // Carhartt — Broad apparel
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-carhartt-apparel-broad",
    brand: "Carhartt",
    category: "clothing",
    laneKey: "carhartt_apparel_broad",
    modelName: "Carhartt Apparel (Broad, WIP / Heritage)",
    aliases: ["Carhartt", "칼하트", "Carhartt WIP", "칼하트 WIP", "Carhartt Heritage"],
    mustContain: [
      ["carhartt", "칼하트"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      // 콜라보 별도
      "supreme",
      "junya watanabe", "준야와타나베",
      "neighborhood", "네이버후드",
      "wtaps", "더블탭스",
      "kith",
      "stussy", "스투시",
    ],
    msrpKrw: 179000,
    released: 1889,
  },

  // ═══════════════════════════════════════════════════════════
  // Thom Browne — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-thombrowne-apparel-broad",
    brand: "Thom Browne",
    category: "clothing",
    laneKey: "thombrowne_apparel_broad",
    modelName: "Thom Browne Apparel (Broad)",
    aliases: ["Thom Browne", "톰브라운", "톰 브라운"],
    mustContain: [
      ["thom browne", "톰브라운", "톰 브라운"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "tom ford", "톰포드",  // 다른 브랜드
    ],
    msrpKrw: 990000,
    released: 2003,
  },

  // ═══════════════════════════════════════════════════════════
  // Champion — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-champion-apparel-broad",
    brand: "Champion",
    category: "clothing",
    laneKey: "champion_apparel_broad",
    modelName: "Champion Apparel (Broad, Reverse Weave)",
    aliases: ["Champion", "챔피온", "챔피언", "Reverse Weave"],
    mustContain: [
      ["champion", "챔피온", "챔피언"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "supreme",
      "bape", "베이프",
      "stussy",
      "kith",
      // "Champion" 양주
      "위스키", "whisky", "샴페인",
    ],
    msrpKrw: 89000,
    released: 1919,
  },

  // ═══════════════════════════════════════════════════════════
  // MLB — Apparel broad (cap 별도)
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-mlb-apparel-broad",
    brand: "MLB",
    category: "clothing",
    laneKey: "mlb_apparel_broad",
    modelName: "MLB Apparel (Broad — 의류, cap 별도)",
    aliases: ["MLB", "엠엘비"],
    mustContain: [
      ["mlb", "엠엘비"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      // cap 별도
      "cap", "캡",
      "모자", "볼캡", "스냅백",
      // 콜라보
      "gucci", "구찌",
      "murakami", "무라카미",
      "nike",
    ],
    msrpKrw: 89000,
    released: 1997,
  },

  // ═══════════════════════════════════════════════════════════
  // Discovery Expedition — Apparel broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-discovery-broad",
    brand: "Discovery Expedition",
    category: "clothing",
    laneKey: "discovery_broad",
    modelName: "Discovery Expedition Apparel (Broad)",
    aliases: ["Discovery Expedition", "디스커버리 익스페디션", "디스커버리"],
    mustContain: [
      ["discovery expedition", "디스커버리 익스페디션", "디스커버리"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      // 신발 별도 SKU
      "디워커", "d-walker",
      // OTT 채널
      "디스커버리 채널", "discovery channel",
    ],
    msrpKrw: 199000,
    released: 2012,
  },

  // ═══════════════════════════════════════════════════════════
  // 노스페이스 추가 변형 (Nuptse general / Denali fleece)
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-tnf-nuptse-broad",
    brand: "The North Face",
    category: "clothing",
    laneKey: "tnf_nuptse_broad",
    modelName: "TNF Nuptse 일반 다운자켓 (1996 외)",
    aliases: ["TNF Nuptse", "노스페이스 눕시", "눕시 자켓", "Nuptse"],
    mustContain: [
      ["north face", "노스페이스", "tnf"],
      ["nuptse", "눕시"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      // 별도 SKU
      "1996", "96",
      "supreme", "슈프림",
      "gucci", "구찌",
      "mm6", "margiela", "마르지엘라",
      // 베스트/조끼는 가격대 별도
      "베스트", "vest", "조끼",
      // 키즈
      "꼬마", "주니어",
    ],
    msrpKrw: 459000,
    released: 1996,
    defaultProductType: "down_jacket",
  },
  {
    id: "clothing-tnf-baltoro-broad",
    brand: "The North Face",
    category: "clothing",
    laneKey: "tnf_baltoro_broad",
    modelName: "TNF Baltoro (Goose Down 700 / 800)",
    aliases: ["TNF Baltoro", "노스페이스 발토로", "발토로", "Baltoro"],
    mustContain: [
      ["north face", "노스페이스", "tnf"],
      ["baltoro", "발토로"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "supreme", "슈프림",  // Supreme x TNF Baltoro 별도 SKU
    ],
    msrpKrw: 990000,
    released: 2010,
    defaultProductType: "down_jacket",
  },
  {
    id: "clothing-tnf-mcmurdo-broad",
    brand: "The North Face",
    category: "clothing",
    laneKey: "tnf_mcmurdo_broad",
    modelName: "TNF McMurdo Parka (다운 파카)",
    aliases: ["TNF McMurdo", "노스페이스 맥머도", "McMurdo Parka"],
    mustContain: [
      ["north face", "노스페이스", "tnf"],
      ["mcmurdo", "맥머도"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "supreme", "슈프림",
    ],
    msrpKrw: 690000,
    released: 2010,
    defaultProductType: "down_jacket",
  },
  {
    id: "clothing-tnf-himalayan-broad",
    brand: "The North Face",
    category: "clothing",
    laneKey: "tnf_himalayan_broad",
    modelName: "TNF Himalayan Parka",
    aliases: ["TNF Himalayan", "노스페이스 히말라야", "Himalayan Parka", "히말라얀"],
    mustContain: [
      ["north face", "노스페이스", "tnf"],
      ["himalayan", "히말라야", "히말라얀"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "supreme", "슈프림",
    ],
    msrpKrw: 990000,
    released: 2010,
    defaultProductType: "down_jacket",
  },

  // ═══════════════════════════════════════════════════════════
  // Patagonia — 일반 broad (현재 retro-x/down/shell narrow 있음)
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-patagonia-apparel-broad",
    brand: "Patagonia",
    category: "clothing",
    laneKey: "patagonia_apparel_broad",
    modelName: "Patagonia Apparel (Broad — narrow 외)",
    aliases: ["Patagonia", "파타고니아"],
    mustContain: [
      ["patagonia", "파타고니아"],
      ["티셔츠", "tee", "후드", "hoodie", "맨투맨", "셔츠", "팬츠", "바지", "쇼츠", "베스트", "조끼"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      // narrow SKU 있는 거 차단
      "retro x", "retro-x", "레트로 x",
      "deep pile", "딥파일",
      // 다운/쉘은 별도 narrow
      "다운", "down",
      "쉘", "shell",
      // 등산용품
      "텐트", "침낭",
    ],
    msrpKrw: 159000,
    released: 1973,
  },

  // ═══════════════════════════════════════════════════════════
  // Stone Island — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-stone-island-broad",
    brand: "Stone Island",
    category: "clothing",
    laneKey: "stone_island_broad",
    modelName: "Stone Island Apparel (Broad)",
    aliases: ["Stone Island", "스톤아일랜드", "스톤 아일랜드"],
    mustContain: [
      ["stone island", "스톤아일랜드", "스톤 아일랜드"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "supreme",  // Supreme x Stone Island 별도 SKU
    ],
    msrpKrw: 490000,
    released: 1982,
  },

  // ═══════════════════════════════════════════════════════════
  // 톰포드 의류 (구별 위해)
  // ═══════════════════════════════════════════════════════════
  // (skipping - 매물 적음 + 향수와 격리 필요)

  // ═══════════════════════════════════════════════════════════
  // Moncler — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-moncler-broad",
    brand: "Moncler",
    category: "clothing",
    laneKey: "moncler_broad",
    modelName: "Moncler Apparel (Broad — 패딩 메인)",
    aliases: ["Moncler", "몽클레어", "몽클레르"],
    mustContain: [
      ["moncler", "몽클레어", "몽클레르"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      // 콜라보
      "supreme",
      "genius",
      "alyx",
      "palm angels",
      "rick owens",
      "fragment",
      "1017",
      "bape", "베이프",
    ],
    msrpKrw: 1490000,
    released: 1952,
  },

  // ═══════════════════════════════════════════════════════════
  // 캐나다 구스 — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-canada-goose-broad",
    brand: "Canada Goose",
    category: "clothing",
    laneKey: "canada_goose_broad",
    modelName: "Canada Goose 패딩 (Broad)",
    aliases: ["Canada Goose", "캐나다구스", "캐나다 구스"],
    mustContain: [
      ["canada goose", "캐나다구스", "캐나다 구스"],
      ["패딩", "다운", "파카", "parka", "자켓", "jacket", "코트", "베스트", "조끼"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
    ],
    msrpKrw: 1290000,
    released: 1957,
    defaultProductType: "down_jacket",
  },
];
