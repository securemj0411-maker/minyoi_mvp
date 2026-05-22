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

const CDG_APPAREL_NOISE = [
  ...CLOTHING_COMMON_NOISE,
  "나이키", "컨버스", "뉴발란스", "반스", "구찌",
  "pvc", "pvc백", "pvc 백", "pvc bag", "핸드백", "토트백", "백 ",
  "맛", "스타일", "느낌",
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
      // Wave 266b API sweep — 75건 contamination (pony/oxford narrow가 우선이어야 함).
      "빅포니", "big pony", "포니",  // → clothing-polo-pony-tee
      "옥스포드", "옥스포드셔츠", "옥스포드 셔츠", "oxford", "oxford shirt", "옥스퍼드",  // → clothing-polo-oxford-shirt
      "피케 폴로", "피케 셔츠", "pique polo", "pique",  // → clothing-polo-pique-classic
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
      "아디다스", "adidas",
      "aape", "오마주", "fubu", "푸부",
      "콜라보", "collab", "lacoste", "라코스테", "자운드", "jound",
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
      // Wave 492: brand-stuffed listings should not fall into plain Supreme broad.
      "nike", "나이키", "adidas", "아디다스", "mlb", "엠엘비", "puma", "푸마", "퓨마", "reebok", "리복",
      // Wave 618: 다른 collab brand 추가 (Timberland/Champion/Honda/Hysteric Glamour 등).
      "timberland", "팀버랜드", "champion", "챔피온",
      "honda", "혼다", "ducati", "두카티",
      "hysteric glamour", "히스테릭 글래머", "히스테릭글래머",
      "vans", "반스",
      "schott", "쇼트",
      "levi", "리바이스",
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
      // Wave 451: explicit Acne pants lane 이 받도록 generated broad 에서는 제외.
      "팬츠", "pants", "트라우저", "trouser", "치노", "chino", "슬랙스", "slacks",
      // Wave 453: explicit Acne knit/cardigan lane 이 받도록 generated broad 에서는 제외.
      "니트", "knit", "스웨터", "sweater", "가디건", "cardigan", "peele",
      // 화장품
      "립밤", "립스틱", "토너", "에센스",
      // Wave 269 (2026-05-20): API sweep — 머플러/스카프/벨트 액세서리 격리.
      //   매물 "아크네 스튜디오 울 머플러 로즈 멜란지" 같은 액세서리는 의류 시세군 ≠.
      "머플러", "muffler", "스카프", "scarf", "벨트", "belt", "키링", "키체인",
      "쇼핑백", "shopping bag", "쇼핑 백",
    ],
    msrpKrw: 590000,
    released: 1996,
  },

  // ═══════════════════════════════════════════════════════════
  // Comme des Garçons — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-cdg-play-hoodie",
    brand: "Comme des Garçons",
    category: "clothing",
    laneKey: "cdg_play_hoodie",
    modelName: "Comme des Garçons PLAY Heart Hoodie / Zip Hoodie",
    aliases: ["Comme des Garcons PLAY", "꼼데가르송 플레이", "CDG PLAY"],
    mustContain: [
      ["comme des", "꼼데가르송", "cdg ", "꼼 데", "comme des garcons"],
      ["play", "플레이", "하트", "heart", "와펜"],
      ["후드", "후드티", "후드집업", "집업후드", "hoodie", "zip hoodie"],
    ],
    mustNotContain: [
      ...CDG_APPAREL_NOISE,
      "supreme",
      "nike",
      "converse",
      "salomon", "살로몬",
      "bape", "베이프",
      "stussy",
    ],
    msrpKrw: 360000,
    released: 2002,
  },
  {
    id: "clothing-cdg-play-polo",
    brand: "Comme des Garçons",
    category: "clothing",
    laneKey: "cdg_play_polo",
    modelName: "Comme des Garçons PLAY Heart Polo",
    aliases: ["Comme des Garcons PLAY", "꼼데가르송 플레이", "CDG PLAY"],
    mustContain: [
      ["comme des", "꼼데가르송", "cdg ", "꼼 데", "comme des garcons"],
      ["play", "플레이", "하트", "heart", "와펜"],
      ["카라티", "카라 티", "카라 셔츠", "폴로 셔츠", "폴로셔츠", "polo", "pk", "피케"],
    ],
    mustNotContain: [
      ...CDG_APPAREL_NOISE,
      "supreme",
      "nike",
      "converse",
      "salomon", "살로몬",
      "bape", "베이프",
      "stussy",
    ],
    msrpKrw: 180000,
    released: 2002,
    defaultProductType: "polo_shirt",
  },
  {
    id: "clothing-cdg-play-shirt",
    brand: "Comme des Garçons",
    category: "clothing",
    laneKey: "cdg_play_shirt",
    modelName: "Comme des Garçons PLAY Heart Shirt",
    aliases: ["Comme des Garcons PLAY", "꼼데가르송 플레이", "CDG PLAY"],
    mustContain: [
      ["comme des", "꼼데가르송", "cdg ", "꼼 데", "comme des garcons"],
      ["play", "플레이", "하트", "heart", "와펜"],
      ["셔츠", "shirt", "포플린", "스트라이프 셔츠"],
    ],
    mustNotContain: [
      ...CDG_APPAREL_NOISE,
      "supreme",
      "nike",
      "converse",
      "salomon", "살로몬",
      "bape", "베이프",
      "stussy",
      "티셔츠", "반팔티", "긴팔티", "tee", "t-shirt", "tshirt",
      "카라티", "카라 티", "카라 셔츠", "폴로 셔츠", "폴로셔츠", "폴로", "polo", "pk", "피케",
      "후드", "hoodie", "후드집업", "집업후드",
      "가디건", "cardigan",
    ],
    msrpKrw: 290000,
    released: 2002,
    defaultProductType: "shirt",
  },
  {
    id: "clothing-cdg-play-tee",
    brand: "Comme des Garçons",
    category: "clothing",
    laneKey: "cdg_play_tee",
    modelName: "Comme des Garçons PLAY Heart Tee",
    aliases: ["Comme des Garcons PLAY", "꼼데가르송 플레이", "CDG PLAY"],
    mustContain: [
      ["comme des", "꼼데가르송", "cdg ", "꼼 데", "comme des garcons"],
      ["play", "플레이", "하트", "heart", "와펜"],
      ["티셔츠", "반팔", "반팔티", "tee", "t-shirt", "tshirt"],
    ],
    mustNotContain: [
      ...CDG_APPAREL_NOISE,
      "supreme",
      "nike",
      "converse",
      "salomon", "살로몬",
      "bape", "베이프",
      "stussy",
      "카라티", "카라 티", "카라 셔츠", "폴로 셔츠", "폴로셔츠", "폴로", "polo", "pk", "피케",
      "후드", "hoodie", "후드집업", "집업후드",
    ],
    msrpKrw: 135000,
    released: 2002,
    defaultProductType: "tee",
  },
  {
    id: "clothing-cdg-play-cardigan",
    brand: "Comme des Garçons",
    category: "clothing",
    laneKey: "cdg_play_cardigan",
    modelName: "Comme des Garçons PLAY Heart Cardigan",
    aliases: ["Comme des Garcons PLAY", "꼼데가르송 플레이", "CDG PLAY"],
    mustContain: [
      ["comme des", "꼼데가르송", "cdg ", "꼼 데", "comme des garcons"],
      ["play", "플레이", "하트", "heart", "와펜"],
      ["가디건", "cardigan"],
    ],
    mustNotContain: [
      ...CDG_APPAREL_NOISE,
      "supreme",
      "nike",
      "converse",
      "salomon", "살로몬",
      "bape", "베이프",
      "stussy",
    ],
    msrpKrw: 420000,
    released: 2002,
    defaultProductType: "cardigan",
  },
  {
    id: "clothing-cdg-homme-plus-apparel-broad",
    brand: "Comme des Garçons",
    category: "clothing",
    laneKey: "cdg_homme_plus_apparel_broad",
    modelName: "Comme des Garçons Homme Plus Apparel (Broad)",
    aliases: ["Comme des Garcons Homme Plus", "꼼데가르송 옴므 플러스"],
    mustContain: [
      ["comme des", "꼼데가르송", "cdg ", "꼼 데", "comme des garcons"],
      ["homme plus", "옴므 플러스", "옴므플러스"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CDG_APPAREL_NOISE,
      "supreme",
      "nike",
      "converse",
      "salomon", "살로몬",
      "bape", "베이프",
      "stussy",
      "play", "플레이", "하트", "heart", "와펜",
    ],
    msrpKrw: 690000,
    released: 1984,
  },
  {
    id: "clothing-cdg-homme-apparel-broad",
    brand: "Comme des Garçons",
    category: "clothing",
    laneKey: "cdg_homme_apparel_broad",
    modelName: "Comme des Garçons Homme Apparel (Broad)",
    aliases: ["Comme des Garcons Homme", "꼼데가르송 옴므"],
    mustContain: [
      ["comme des", "꼼데가르송", "cdg ", "꼼 데", "comme des garcons"],
      ["homme", "옴므"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CDG_APPAREL_NOISE,
      "homme plus", "옴므 플러스", "옴므플러스",
      "supreme",
      "nike",
      "converse",
      "salomon", "살로몬",
      "bape", "베이프",
      "stussy",
      "play", "플레이", "하트", "heart", "와펜",
    ],
    msrpKrw: 490000,
    released: 1978,
  },
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
      ...CDG_APPAREL_NOISE,
      // 콜라보 별도
      "supreme",
      "nike",
      "converse",
      "salomon", "살로몬",
      "bape", "베이프",
      "stussy",
      // Wave 492: CDG Shirt x Lacoste collab should not fall into generic CDG broad.
      "lacoste", "라코스테",
      // Wave 428: PLAY heart/와펜 staples get narrow lanes to keep broad CDG samples from mixing basics.
      "play", "플레이", "하트", "heart", "와펜",
      // Wave 428: Homme lines are repeated enough to keep out of generic CDG broad.
      "homme plus", "옴므 플러스", "옴므플러스",
      "homme", "옴므",
      // Wave 609: production sample — pid 401863017 '꼼데가르송 구찌 홀리데이 PVC백' 1.05M (bag 매물 clothing 잘못).
      //   PVC 백/PVC 가방/구찌 홀리데이/구찌 콜라보 차단 (다른 lane으로 가야).
      "pvc 백", "pvc백", "pvc 가방", "구찌 홀리데이", "gucci holiday",
      // Wave 615: accessory 매물 차단 (clothing 아님).
      "머플러", "muffler", "스카프", "scarf", "넥워머",
    ],
    msrpKrw: 390000,
    released: 1969,
  },

  // ═══════════════════════════════════════════════════════════
  // Carhartt — Broad apparel
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-carhartt-detroit-jacket",
    brand: "Carhartt",
    category: "clothing",
    laneKey: "carhartt_detroit_jacket",
    modelName: "Carhartt Detroit Jacket",
    aliases: ["Carhartt", "칼하트", "Carhartt WIP", "칼하트 WIP"],
    mustContain: [
      ["carhartt", "칼하트"],
      ["detroit", "디트로이트", "j001", "j01"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "supreme",
      "junya watanabe", "준야와타나베",
      "wacko maria", "와코마리아",
    ],
    msrpKrw: 299000,
    released: 1954,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-carhartt-active-jacket",
    brand: "Carhartt",
    category: "clothing",
    laneKey: "carhartt_active_jacket",
    modelName: "Carhartt Active Jacket / J130",
    aliases: ["Carhartt", "칼하트", "Carhartt WIP", "칼하트 WIP"],
    mustContain: [
      ["carhartt", "칼하트"],
      ["active jacket", "액티브 자켓", "액티브 후드자켓", "j130"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "쇼츠", "shorts", "반바지", "숏팬츠",
      "supreme",
      "junya watanabe", "준야와타나베",
      "wacko maria", "와코마리아",
    ],
    msrpKrw: 229000,
    released: 1980,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-carhartt-double-knee-pants",
    brand: "Carhartt",
    category: "clothing",
    laneKey: "carhartt_double_knee_pants",
    modelName: "Carhartt Double Knee Pants",
    aliases: ["Carhartt Double Knee", "칼하트 더블니"],
    mustContain: [
      ["carhartt", "칼하트"],
      ["double knee", "doubleknee", "더블니", "더블 니", "b01"],
      ["팬츠", "pants", "바지", "워크팬츠", "work pants"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "supreme",
      "junya watanabe", "준야와타나베",
      "wacko maria", "와코마리아",
    ],
    msrpKrw: 189000,
    released: 1939,
    defaultProductType: "pants",
  },
  {
    id: "clothing-carhartt-cargo-pants",
    brand: "Carhartt",
    category: "clothing",
    laneKey: "carhartt_cargo_pants",
    modelName: "Carhartt Cargo Pants / Shorts",
    aliases: ["Carhartt Cargo", "칼하트 카고"],
    mustContain: [
      ["carhartt", "칼하트"],
      ["cargo", "카고"],
      ["팬츠", "pants", "바지", "쇼츠", "shorts", "반바지"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "supreme",
      "junya watanabe", "준야와타나베",
      "wacko maria", "와코마리아",
    ],
    msrpKrw: 159000,
    released: 1970,
  },
  {
    id: "clothing-carhartt-santa-fe-jacket",
    brand: "Carhartt",
    category: "clothing",
    laneKey: "carhartt_santa_fe_jacket",
    modelName: "Carhartt Santa Fe Jacket",
    aliases: ["Carhartt Santa Fe Jacket", "칼하트 산타페 자켓"],
    mustContain: [
      ["carhartt", "칼하트"],
      ["santa fe", "santafe", "산타페"],
      ["jacket", "자켓", "재킷"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "supreme",
      "junya watanabe", "준야와타나베",
      "wacko maria", "와코마리아",
    ],
    msrpKrw: 329000,
    released: 1990,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-carhartt-madison-apparel-broad",
    brand: "Carhartt",
    category: "clothing",
    laneKey: "carhartt_madison_apparel_broad",
    modelName: "Carhartt WIP Madison Apparel (Broad)",
    aliases: ["Carhartt Madison", "칼하트 메디슨"],
    mustContain: [
      ["carhartt", "칼하트"],
      ["madison", "메디슨"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "supreme",
      "junya watanabe", "준야와타나베",
      "wacko maria", "와코마리아",
    ],
    msrpKrw: 179000,
    released: 2010,
  },
  {
    id: "clothing-carhartt-landon-pants",
    brand: "Carhartt",
    category: "clothing",
    laneKey: "carhartt_landon_pants",
    modelName: "Carhartt WIP Landon Pants",
    aliases: ["Carhartt Landon Pants", "칼하트 랜든 팬츠"],
    mustContain: [
      ["carhartt", "칼하트"],
      ["landon", "랜든"],
      ["팬츠", "pants", "바지"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "쇼츠", "shorts", "반바지", "숏팬츠",
      "supreme",
      "junya watanabe", "준야와타나베",
      "wacko maria", "와코마리아",
    ],
    msrpKrw: 179000,
    released: 2018,
    defaultProductType: "pants",
  },
  {
    id: "clothing-carhartt-chase-sweatpants",
    brand: "Carhartt",
    category: "clothing",
    laneKey: "carhartt_chase_sweatpants",
    modelName: "Carhartt WIP Chase Sweatpants",
    aliases: ["Carhartt Chase Sweatpants", "칼하트 체이스 스웻팬츠"],
    mustContain: [
      ["carhartt", "칼하트"],
      ["chase", "체이스"],
      ["스웻팬츠", "스웨트팬츠", "sweatpants", "sweat pants", "팬츠", "pants", "바지"],
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "supreme",
      "junya watanabe", "준야와타나베",
      "wacko maria", "와코마리아",
    ],
    msrpKrw: 159000,
    released: 2010,
    defaultProductType: "pants",
  },
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
      "wacko maria", "와코마리아",
      "neighborhood", "네이버후드",
      "wtaps", "더블탭스",
      "kith",
      "stussy", "스투시",
      // Wave 427: repeated jacket models get their own lanes; do not pollute broad apparel price samples.
      "detroit", "디트로이트", "j001", "j01",
      "active jacket", "액티브 자켓", "액티브 후드자켓", "j130",
      // Wave 428: repeated pants lanes get their own samples.
      "double knee", "doubleknee", "더블니", "더블 니", "b01",
      "cargo", "카고",
      // Wave 428: repeated WIP/vintage model lanes stay out of generic Carhartt broad.
      "santa fe", "santafe", "산타페",
      "madison", "메디슨",
      "landon", "랜든",
      "chase", "체이스",
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
      // Wave 426: "톰브라운 스타일/룩"·pet apparel bait는 정품 사람 의류 시세군에서 제외.
      "톰브라운 스타일", "톰브라운스타일", "톰브라운 스탈", "톰브라운스탈",
      "톰브라운 룩", "톰브라운룩",
      "강아지 니트", "애견 니트", "반려견 니트", "dog knit",
      "서스펜더", "suspender", "타미진스", "타미힐피거", "tommy hilfiger",
      "koe", "코에", "미스터톰", "mister thom",
    ],
    msrpKrw: 990000,
    released: 2003,
  },

  // ═══════════════════════════════════════════════════════════
  // Champion — Reverse Weave
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-champion-reverse-weave",
    brand: "Champion",
    category: "clothing",
    laneKey: "champion_reverse_weave",
    modelName: "Champion Reverse Weave",
    aliases: ["Champion Reverse Weave", "챔피온 리버스위브", "챔피언 리버스위브"],
    mustContain: [
      ["champion", "챔피온", "챔피언"],
      ["reverse weave", "reverseweave", "리버스위브", "리버스 위브"],
      CLOTHING_PRODUCT_TYPES,
    ],
    mustNotContain: [
      ...CLOTHING_COMMON_NOISE,
      "supreme",
      "bape", "베이프",
      "stussy",
      "kith",
      "nike", "나이키", "dunk", "덩크", "air jordan", "조던", "air force", "에어포스",
      "위스키", "whisky", "샴페인",
    ],
    msrpKrw: 129000,
    released: 1938,
  },

  // ═══════════════════════════════════════════════════════════
  // Champion — Broad
  // ═══════════════════════════════════════════════════════════
  {
    id: "clothing-champion-apparel-broad",
    brand: "Champion",
    category: "clothing",
    laneKey: "champion_apparel_broad",
    modelName: "Champion Apparel (Broad)",
    aliases: ["Champion", "챔피온", "챔피언"],
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
      // "championship court" 등 신발 컬러웨이/라인명이 Champion 의류 broad로 섞이는 것을 차단.
      "nike", "나이키", "dunk", "덩크", "air jordan", "조던", "air force", "에어포스",
      "championship", "챔피언쉽", "챔피언십", "court purple", "코트 퍼플",
      // Reverse Weave is a repeated premium/vintage lane; keep broad for generic Champion apparel only.
      "reverse weave", "reverseweave", "리버스위브", "리버스 위브",
      // Repeated collab / limited lanes should not pollute generic Champion broad comps.
      "glowny", "글로니",
      "thisisneverthat", "디스이즈네버댓", "디네댓",
      "fuct", "퍽트",
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
      "retro x", "retro-x", "레트로 x", "레트로x",
      "deep pile", "딥파일", "레트로파일", "레트로 파일", "retro pile", "retro-pile",
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
      // Wave 547 (2026-05-22): 한정 시리즈 차단 (아이스 니트 500만, 스카라베오 125만 등 +5~10배).
      "아이스 니트", "아이스니트", "ice knit",
      "스카라베오", "scarabeo",
      "shadow project", "쉐도우 프로젝트",
      "ghost piece", "고스트 피스",
      "ice jacket", "아이스 자켓",
      "프리즘", "prism",
      "ghost",
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
      "supreme", "슈프림",
      "genius", "지니어스",
      "alyx", "알릭스",
      "palm angels", "팜 엔젤스", "팜엔젤스",
      "rick owens", "릭 오웬스", "릭오웬스",
      "fragment", "프래그먼트",
      "1017",
      "bape", "베이프",
      // Wave 486: Moncler broad is a high-price outerwear fallback; polo/pique shirts need a separate lane before scoring.
      "피케", "pique", "폴로", "polo", "카라티", "카라 티", "pk티", "pk 티",
      // Wave 602: 한국어 collab 표기 변형 추가 (영문만 박혀있던 collab 키워드).
      "사이클로픽", "cyclopic",  // Rick Owens collab 모델명
      "람사우", "람자우", "ramsau",  // Palm Angels collab 모델명
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
      // Wave 621: 베트멍 패러디/카피 매물 차단.
      //   production: pid 385601963 '베트멍 캐나다구스 패러디 패딩 자켓' 1.79M (가품 영향).
      "패러디", "parody", "베트멍", "vetements",  // 베트멍 자체는 collab 아닌 패러디 (다른 brand)
      "카피", "복각", "rep ", "replica",
    ],
    msrpKrw: 1290000,
    released: 1957,
    defaultProductType: "down_jacket",
  },
];
