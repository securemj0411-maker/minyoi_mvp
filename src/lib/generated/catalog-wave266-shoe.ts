// Wave 266 (2026-05-20): 번개장터 deep sweep 결과 → 신발 catalog 대폭 보강.
//
// 사용자 명령: "shoe랑 fashion 깊게 분석", "카탈로그/파싱 더 강화", "방대한 catalog 필요".
//
// 번개장터 raw 카테고리 405xxx (신발) 미매칭 매물 분석:
//  - 총 23,177건 중 15,351건 미매칭 (66%)
//  - 큰 누락 풀 (n, avg_price):
//    · 발렌시아가 신발 344건 (88만)
//    · 살로몬 (XT-6 외 변형) 109건 (29만)
//    · 나이키 샥스 100건 (16만)
//    · 뉴발란스 1906 82건 (13만), 1300/1400/1500/1600/2002 다수
//    · 아디다스 송포더뮤트 32건 (19만)
//    · 컨버스 원스타 28건 (11만)
//    · 디스커버리 디워커 24건 (5만)
//    · Y-3 54건 (19만)
//    · 나이키 축구화 (슈퍼플라이/티엠포/머큐리얼) 17건
//    · 나이키 코르테즈 13건
//    · 발렌시아가 트리플S (이전 wave 차단만, narrow 신설)
//
// 정책:
//  - narrow 모델 (단가 명확) 우선 — broad SKU 가격 노이즈 회피
//  - 콜라보 / 한정 컬러 mustNotContain (다른 wave 패턴 따라)
//  - 명품 brand (발렌시아가/구찌/루이비통/프라다 등) broad SKU 동봉 — 모델 추정 안되면 fallback
//  - 가품/단품/매입 keyword 일관 차단

import type { Sku } from "@/lib/catalog";

const SHOE_COMMON_NOISE = [
  // 가품
  "짭", "가품", "레플리카", "replica", "fake", "미러", "샘플", "sample", "1:1", "11급", "이미테이션",
  "복각", "복원",
  // 키즈/단품/매입
  "td", "ps", "키즈", "유아", "아동", "toddler", "kids", "infant",
  "한짝", "한쪽만", "사이즈 미상", "파손", "찢어짐",
  "삽니다", "구합니다", "구해요", "매입", "구함",
  // 가방/의류 (반대 카테고리)
  "가방만", "의류만",
];

const SHOE_HIGH_END_NOISE = [
  // 명품 신발 broad — 카드지갑 / 키링 / 액세서리 단품 차단
  "카드지갑", "지갑", "wallet", "키링", "키체인", "키 파우치", "박스만", "보증서만", "더스트백만",
  "신발상자", "신발 상자", "신발박스", "신발 박스", "슈박스", "shoe box", "shoebox",
  "박스 세트", "박스 셋트", "더스트백 세트", "더스트백 셋트", "dust bag set", "dustbag set",
  "신발용 더스트백", "신발용 dustbag", "신발 더스트백", "신발 dustbag",
  "스트랩만", "체인만", "장식만",
];

export const SHOE_WAVE266_CATALOG: Sku[] = [
  // ═══════════════════════════════════════════════════════════
  // Salomon 추가 모델 (XT-6 외)
  // ═══════════════════════════════════════════════════════════
  {
    id: "shoe-salomon-x-ultra-broad",
    brand: "Salomon",
    category: "shoe",
    modelName: "Salomon X Ultra (3/4/360 등산화)",
    aliases: ["Salomon X Ultra", "살로몬 X 울트라", "X 울트라"],
    mustContain: [
      ["살로몬", "salomon"],
      ["x 울트라", "x-ultra", "xultra", "x ultra", "엑스 울트라"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      // 콜라보 별도
      "꼼데가르송", "comme des", "마르지엘라", "margiela",
      // 본품 외
      "끈만", "깔창만", "인솔만", "신발끈",
    ],
    msrpKrw: 220000,
    released: 2019,
    defaultProductType: "boot",
  },
  {
    id: "shoe-salomon-rx-slide-broad",
    brand: "Salomon",
    category: "shoe",
    modelName: "Salomon RX Slide (리커버리 슬리퍼)",
    aliases: ["Salomon RX Slide", "살로몬 RX 슬라이드", "RX 슬라이드"],
    mustContain: [
      ["살로몬", "salomon"],
      ["rx slide", "rx 슬라이드", "rx-slide", "rxslide"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      "꼼데가르송", "comme des", "마르지엘라",
    ],
    msrpKrw: 159000,
    released: 2020,
    defaultProductType: "slipper",
  },
  {
    id: "shoe-salomon-phantasm-broad",
    brand: "Salomon",
    category: "shoe",
    modelName: "Salomon Phantasm (러닝화)",
    aliases: ["Salomon Phantasm", "살로몬 판타즘", "판타즘"],
    mustContain: [
      ["살로몬", "salomon"],
      ["판타즘", "phantasm"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      "꼼데가르송", "comme des", "마르지엘라",
    ],
    msrpKrw: 220000,
    released: 2022,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-salomon-xt-4-broad",
    brand: "Salomon",
    category: "shoe",
    modelName: "Salomon XT-4 (트레일 러닝)",
    aliases: ["Salomon XT-4", "살로몬 XT-4", "XT-4"],
    mustContain: [
      ["살로몬", "salomon"],
      ["xt-4", "xt 4", "xt4"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 콜라보 별도
      "마르지엘라", "margiela", "mm6", "꼼데가르송", "comme des",
    ],
    msrpKrw: 220000,
    released: 2003,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-salomon-acs-pro-broad",
    brand: "Salomon",
    category: "shoe",
    modelName: "Salomon ACS Pro (어드밴스드 트레일)",
    aliases: ["Salomon ACS Pro", "살로몬 ACS Pro", "ACS Pro Advanced"],
    mustContain: [
      ["살로몬", "salomon"],
      ["acs pro", "acs-pro", "acspro", "acs 프로"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
    ],
    msrpKrw: 290000,
    released: 2023,
    defaultProductType: "sneaker",
  },

  // ═══════════════════════════════════════════════════════════
  // New Balance 추가 모델 (1300/1400/1500/1600/2002)
  // ═══════════════════════════════════════════════════════════
  {
    id: "shoe-newbalance-1300-broad",
    brand: "New Balance",
    category: "shoe",
    modelName: "New Balance 1300 (Broad)",
    aliases: ["뉴발란스 1300", "NB 1300", "M1300"],
    mustContain: [
      ["뉴발란스 1300", "뉴발 1300", "nb 1300", "nb1300", "new balance 1300", "m1300"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 콜라보 별도 (1300 콜라보 가격 +200%)
      "에임레온도르", "aime leon dore", "ald",
      "kith", "키스 ",
      "concepts", "콘셉트",
      "aimé leon dore",
    ],
    msrpKrw: 359000,
    released: 1985,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-newbalance-1400-broad",
    brand: "New Balance",
    category: "shoe",
    modelName: "New Balance 1400 (Broad)",
    aliases: ["뉴발란스 1400", "NB 1400", "M1400"],
    mustContain: [
      ["뉴발란스 1400", "뉴발 1400", "nb 1400", "nb1400", "new balance 1400", "m1400"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 콜라보 (그린 한정/J.Crew 콜라보 가격 +250%)
      "j.crew", "jcrew", "제이크루",
      "ronnie fieg", "로니피그",
      "kith", "키스 ",
    ],
    msrpKrw: 229000,
    released: 1994,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-newbalance-1500-broad",
    brand: "New Balance",
    category: "shoe",
    modelName: "New Balance 1500 (Broad, Made in UK)",
    aliases: ["뉴발란스 1500", "NB 1500", "M1500"],
    mustContain: [
      ["뉴발란스 1500", "뉴발 1500", "nb 1500", "nb1500", "new balance 1500", "m1500"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 콜라보
      "norse projects", "팩커", "packer",
      "solebox", "솔박스",
      "kith", "키스 ",
    ],
    msrpKrw: 219000,
    released: 1989,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-newbalance-1600-broad",
    brand: "New Balance",
    category: "shoe",
    modelName: "New Balance 1600 (Broad, 엘리트 라인)",
    aliases: ["뉴발란스 1600", "NB 1600", "CM1600"],
    mustContain: [
      ["뉴발란스 1600", "뉴발 1600", "nb 1600", "nb1600", "new balance 1600", "cm1600"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 콜라보
      "kith", "키스 ",
      "stussy", "스투시",
    ],
    msrpKrw: 159000,
    released: 2005,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-newbalance-2002-broad",
    brand: "New Balance",
    category: "shoe",
    modelName: "New Balance 2002R (Broad)",
    aliases: ["뉴발란스 2002", "NB 2002", "2002R", "M2002R"],
    mustContain: [
      ["뉴발란스 2002", "뉴발 2002", "nb 2002", "nb2002", "new balance 2002", "m2002", "2002r"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 콜라보 (JJJJound/Salehe Bembury 가격 +300%)
      "jjjjound", "자운드", "jjj",
      "salehe", "살레헤", "bembury", "뱀버리",
      "kith", "키스 ",
      "concepts", "콘셉트",
    ],
    msrpKrw: 219000,
    released: 2010,
    defaultProductType: "sneaker",
  },

  // ═══════════════════════════════════════════════════════════
  // Nike Shox (전 변형)
  // ═══════════════════════════════════════════════════════════
  {
    id: "shoe-nike-shox-r4-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Shox R4 (Broad)",
    aliases: ["Nike Shox R4", "나이키 샥스 R4", "샥스 R4"],
    mustContain: [
      ["nike", "나이키"],
      ["shox r4", "샥스 r4", "샥스r4", "shoxr4"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 콜라보
      "martine rose", "마틴 로즈", "마틴로즈",
      "supreme", "슈프림",
    ],
    msrpKrw: 199000,
    released: 2000,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-shox-z-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Shox Z (Broad)",
    aliases: ["Nike Shox Z", "나이키 샥스 Z", "샥스 Z"],
    mustContain: [
      ["nike", "나이키"],
      ["shox z", "샥스 z", "샥스z", "shoxz"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      "martine rose", "마틴 로즈", "supreme", "슈프림",
    ],
    msrpKrw: 159000,
    released: 2003,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-shox-tl-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Shox TL (Broad)",
    aliases: ["Nike Shox TL", "나이키 샥스 TL", "샥스 TL"],
    mustContain: [
      ["nike", "나이키"],
      ["shox tl", "샥스 tl", "샥스tl", "shoxtl"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      "martine rose", "마틴 로즈",
    ],
    msrpKrw: 219000,
    released: 2003,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-shox-ride-2-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Shox Ride 2 (Broad)",
    aliases: ["Nike Shox Ride 2", "나이키 샥스 라이드 2", "샥스 라이드"],
    mustContain: [
      ["nike", "나이키"],
      ["shox ride", "샥스 라이드", "샥스라이드"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
    ],
    msrpKrw: 189000,
    released: 2018,
    defaultProductType: "sneaker",
  },

  // ═══════════════════════════════════════════════════════════
  // Nike 기타 모델
  // ═══════════════════════════════════════════════════════════
  {
    id: "shoe-nike-cortez-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Cortez (Broad)",
    aliases: ["Nike Cortez", "나이키 코르테즈", "코르테즈"],
    mustContain: [
      ["nike", "나이키"],
      ["cortez", "코르테즈"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 콜라보 (Wave 266b API sweep — 62건 sakai 콜라보 catch)
      "stussy", "스투시",
      "supreme", "슈프림",
      "louis vuitton", "루이비통",
      "kendrick lamar", "켄드릭",
      "off-white", "오프화이트",
      "sakai", "사카이",
    ],
    msrpKrw: 119000,
    released: 1972,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-moonracer-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Moon Racer (Broad)",
    aliases: ["Nike Moon Racer", "나이키 문레이서", "문레이서"],
    mustContain: [
      ["nike", "나이키"],
      ["moon racer", "moonracer", "문레이서", "문 레이서"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 콜라보 (모나크 가격 +400%)
      "모나크", "monarch", "supreme", "슈프림",
    ],
    msrpKrw: 119000,
    released: 2018,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-spiridon-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Air Zoom Spiridon (Broad)",
    aliases: ["Nike Spiridon", "나이키 스피리돈", "스피리돈"],
    mustContain: [
      ["nike", "나이키"],
      ["spiridon", "스피리돈"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 콜라보 (Stussy/Undefeated 가격 +200%)
      "stussy", "스투시",
      "undefeated", "언디핏", "undftd",
    ],
    msrpKrw: 169000,
    released: 1997,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-superfly-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Mercurial Superfly (축구화)",
    aliases: ["Mercurial Superfly", "나이키 슈퍼플라이", "머큐리얼 슈퍼플라이"],
    mustContain: [
      ["nike", "나이키"],
      ["superfly", "슈퍼플라이"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 한정/시그니처 (Wave 265 패턴)
      "한정", "한정판", "limited",
      "베이프", "bape", "supreme", "슈프림",
      "지단", "zidane", "벨링엄", "bellingham",
      "메시", "messi", "호날두", "ronaldo",
    ],
    msrpKrw: 339000,
    released: 1998,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-tiempo-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Tiempo (축구화)",
    aliases: ["Tiempo", "나이키 티엠포", "티엠포"],
    mustContain: [
      ["nike", "나이키"],
      ["tiempo", "티엠포"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      "한정", "한정판", "limited", "베이프", "bape",
      "지단", "벨링엄", "메시", "messi",
    ],
    msrpKrw: 269000,
    released: 1984,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-mercurial-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Mercurial Vapor (축구화)",
    aliases: ["Mercurial Vapor", "나이키 머큐리얼 베이퍼", "머큐리얼"],
    mustContain: [
      ["nike", "나이키"],
      ["mercurial", "머큐리얼"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      "한정", "한정판", "limited", "베이프", "bape",
      "supreme", "슈프림",
    ],
    msrpKrw: 289000,
    released: 1998,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-sfb-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike SFB Field Boot",
    aliases: ["Nike SFB", "나이키 SFB", "SFB B1"],
    mustContain: [
      ["nike", "나이키"],
      ["sfb"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      "stussy", "스투시", "off-white", "오프화이트",
    ],
    msrpKrw: 230000,
    released: 2014,
    defaultProductType: "boot",
  },

  // ═══════════════════════════════════════════════════════════
  // Adidas 추가 모델
  // ═══════════════════════════════════════════════════════════
  {
    id: "shoe-adidas-song-for-the-mute-broad",
    brand: "Adidas",
    category: "shoe",
    modelName: "Adidas x Song For The Mute (콜라보 broad)",
    aliases: ["Song For The Mute", "송포더뮤트", "Adidas SFTM"],
    mustContain: [
      ["adidas", "아디다스"],
      ["송포더뮤트", "song for the mute", "song-for-the-mute", "sftm"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
    ],
    msrpKrw: 260000,
    released: 2023,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-adidas-stansmith-broad",
    brand: "Adidas",
    category: "shoe",
    modelName: "Adidas Stan Smith (Broad)",
    aliases: ["Stan Smith", "스탠스미스", "스탠 스미스"],
    mustContain: [
      ["adidas", "아디다스"],
      ["stansmith", "stan smith", "스탠스미스", "스탠 스미스"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 콜라보 (가격 +200~500%)
      "발렌시아가", "balenciaga",
      "마르지엘라", "margiela", "mm6",
      "라프 시몬스", "raf simons",
      "리커브", "recouture",
      "꼼데가르송", "comme des",
    ],
    msrpKrw: 129000,
    released: 1971,
    defaultProductType: "sneaker",
  },

  // ═══════════════════════════════════════════════════════════
  // Y-3 (Yohji Yamamoto x Adidas)
  // ═══════════════════════════════════════════════════════════
  {
    id: "shoe-y3-qasa-broad",
    brand: "Y-3",
    category: "shoe",
    modelName: "Y-3 Qasa High (Broad)",
    aliases: ["Y-3 Qasa", "Y3 Qasa", "콰사", "콰사 하이"],
    mustContain: [
      ["y-3", "y3", "y 3", "요지야마모토 아디다스"],
      ["qasa", "콰사"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
    ],
    msrpKrw: 590000,
    released: 2013,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-y3-broad",
    brand: "Y-3",
    category: "shoe",
    modelName: "Y-3 (Broad — 모델 미상)",
    aliases: ["Y-3", "Y3", "요지야마모토 x 아디다스"],
    mustContain: [
      ["y-3", "y3 "],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 의류 (Y-3 의류도 많아서 차단)
      "티셔츠", "tee ", "후드", "hoodie", "맨투맨", "팬츠", "셔츠", "자켓",
      "가방", "백팩", "토트", "크로스백",
      // 모델별 별도 SKU 있는 거
      "qasa", "콰사",
    ],
    msrpKrw: 390000,
    released: 2003,
  },

  // ═══════════════════════════════════════════════════════════
  // Converse 추가 (One Star 등)
  // ═══════════════════════════════════════════════════════════
  {
    id: "shoe-converse-onestar-broad",
    brand: "Converse",
    category: "shoe",
    modelName: "Converse One Star (Broad)",
    aliases: ["One Star", "원스타", "컨버스 원스타"],
    mustContain: [
      ["converse", "컨버스"],
      ["one star", "원스타", "one-star", "onestar"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 콜라보
      "golf wang", "골프 왕", "타일러", "tyler",
      "stussy", "스투시",
      "off-white", "오프화이트",
      "awake", "어웨이크",
    ],
    msrpKrw: 99000,
    released: 1974,
    defaultProductType: "sneaker",
  },

  // ═══════════════════════════════════════════════════════════
  // Discovery (한국 아웃도어 — 디워커)
  // ═══════════════════════════════════════════════════════════
  {
    id: "shoe-discovery-dwalker-broad",
    brand: "Discovery Expedition",
    category: "shoe",
    modelName: "Discovery 디워커 (D-Walker)",
    aliases: ["디워커", "D-Walker", "디스커버리 디워커", "버킷 디워커"],
    mustContain: [
      ["디스커버리", "discovery", "익스페디션"],
      ["디워커", "d-walker", "dwalker", "d 워커", "버킷 디워커"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      // 의류
      "패딩", "자켓", "후드", "티셔츠", "맨투맨",
      // 가방
      "백팩", "크로스백",
    ],
    msrpKrw: 119000,
    released: 2022,
    defaultProductType: "sneaker",
  },

  // ═══════════════════════════════════════════════════════════
  // Balenciaga 신발 (high-value broad)
  // ═══════════════════════════════════════════════════════════
  {
    id: "shoe-balenciaga-triple-s-broad",
    brand: "Balenciaga",
    category: "shoe",
    modelName: "Balenciaga Triple S (Broad)",
    aliases: ["Balenciaga Triple S", "발렌시아가 트리플S", "트리플S", "트리플 S"],
    mustContain: [
      ["발렌시아가", "balenciaga"],
      ["triple s", "triple-s", "트리플s", "트리플 s", "triple ｓ"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      // 한정판 (트리플S 센스/스머프 한정 가격 변동 큼)
      "스머프", "센스 한정", "센스한정",
    ],
    msrpKrw: 1290000,
    released: 2017,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-balenciaga-speed-broad",
    brand: "Balenciaga",
    category: "shoe",
    modelName: "Balenciaga Speed Runner / Speed Trainer",
    aliases: ["Balenciaga Speed", "발렌시아가 스피드러너", "스피드 트레이너", "발렌시아가 스피드"],
    mustContain: [
      ["발렌시아가", "balenciaga"],
      ["speed", "스피드러너", "스피드 러너", "스피드 트레이너", "speedrunner"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      // 퓨마 콜라보 별도
      "퓨마", "puma",
    ],
    msrpKrw: 990000,
    released: 2017,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-balenciaga-track-broad",
    brand: "Balenciaga",
    category: "shoe",
    modelName: "Balenciaga Track (1/2/Trail)",
    aliases: ["Balenciaga Track", "발렌시아가 트랙", "트랙2", "트랙 트레일"],
    mustContain: [
      ["발렌시아가", "balenciaga"],
      ["track", "트랙"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      // 아디다스 콜라보 (트랙 팬츠/탑) 차단
      "팬츠", "pants", "트랙수트", "tracksuit", "탑", "자켓",
      "팬츠만", "셔츠",
      "아디다스 x", "x 아디다스",
      // Wave 418: Track sneaker/trail group에서 Track Sandal 및 Tractor boot를 분리.
      "트랙 샌들", "track sandal", "트랙터", "tractor", "첼시부츠", "chelsea",
    ],
    msrpKrw: 1290000,
    released: 2018,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-balenciaga-3xl",
    brand: "Balenciaga",
    category: "shoe",
    laneKey: "balenciaga_3xl",
    modelName: "Balenciaga 3XL Sneaker",
    aliases: ["Balenciaga 3XL", "발렌시아가 3XL", "3XL 스니커즈"],
    mustContain: [
      ["발렌시아가", "balenciaga"],
      ["3xl", "3 xl"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      "티셔츠", "tee", "후드", "자켓", "재킷", "팬츠", "바지", "모자", "캡",
    ],
    msrpKrw: 1450000,
    released: 2023,
    defaultProductType: "sneaker",
    confusionNote: "Wave 418 후보: Balenciaga Runner broad에서 3XL 분리. LANE_READINESS 전까지 internal-only.",
  },
  {
    id: "shoe-balenciaga-runner-broad",
    brand: "Balenciaga",
    category: "shoe",
    modelName: "Balenciaga Runner / 3XL / X-Pander",
    aliases: ["Balenciaga Runner", "발렌시아가 러너", "뉴 러너", "3XL", "X-Pander", "엑스팬더"],
    mustContain: [
      ["발렌시아가", "balenciaga"],
      ["runner", "러너", "3xl", "x-pander", "xpander", "엑스팬더"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      // Wave 418: 3XL은 Runner/New Runner와 price/variant가 달라 narrow 후보로 분리.
      "3xl", "3 xl",
    ],
    msrpKrw: 1090000,
    released: 2022,
    defaultProductType: "sneaker",
  },

  // ═══════════════════════════════════════════════════════════
  // 명품 신발 narrow 후보 (public release는 LANE_READINESS 별도)
  // ═══════════════════════════════════════════════════════════
  {
    id: "shoe-hermes-bouncing",
    brand: "Hermes",
    category: "shoe",
    laneKey: "hermes_bouncing",
    modelName: "Hermes Bouncing Sneaker",
    aliases: ["Hermes Bouncing", "에르메스 바운싱", "바운싱 스니커즈"],
    mustContain: [
      ["hermes", "에르메스"],
      ["바운싱", "bouncing"],
      ["스니커즈", "sneaker", "신발", "shoe", "러닝화"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
    ],
    msrpKrw: 1500000,
    released: 2022,
    defaultProductType: "sneaker",
    confusionNote: "Wave 415 후보: Hermes broad 내 반복 모델. LANE_READINESS 전까지 internal-only.",
  },
  {
    id: "shoe-louisvuitton-lv-trainer",
    brand: "Louis Vuitton",
    category: "shoe",
    laneKey: "lv_trainer",
    modelName: "Louis Vuitton LV Trainer",
    aliases: ["LV Trainer", "루이비통 LV 트레이너", "루이비통 트레이너"],
    mustContain: [
      ["louis vuitton", "루이비통", " lv "],
      ["트레이너", "trainer"],
      ["스니커즈", "sneaker", "신발", "shoe"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      "부츠컷", "bootcut", "팬츠", "pants", "바지",
    ],
    msrpKrw: 1700000,
    released: 2019,
    defaultProductType: "sneaker",
    confusionNote: "Wave 415 후보: LV Trainer / Maxi Trainer. 데님 소재 스니커즈는 허용, 데님 의류는 차단.",
  },
  {
    id: "shoe-louisvuitton-runaway",
    brand: "Louis Vuitton",
    category: "shoe",
    laneKey: "lv_runaway",
    modelName: "Louis Vuitton Run Away Sneaker",
    aliases: ["LV Run Away", "루이비통 런어웨이", "런어웨이 스니커즈"],
    mustContain: [
      ["louis vuitton", "루이비통", "lv"],
      ["런어웨이", "runaway", "run away"],
      ["스니커즈", "sneaker", "신발", "shoe"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
    ],
    msrpKrw: 1500000,
    released: 2016,
    defaultProductType: "sneaker",
    confusionNote: "Wave 416 후보: LV Run Away. price spread가 아직 커서 LANE_READINESS 전까지 internal-only.",
  },
  {
    id: "shoe-gucci-ace",
    brand: "Gucci",
    category: "shoe",
    laneKey: "gucci_ace",
    modelName: "Gucci Ace Sneaker",
    aliases: ["Gucci Ace", "구찌 에이스", "에이스 스니커즈"],
    mustContain: [
      ["gucci", "구찌"],
      ["에이스", "ace"],
      ["스니커즈", "sneaker", "신발", "shoe"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
    ],
    msrpKrw: 990000,
    released: 2016,
    defaultProductType: "sneaker",
    confusionNote: "Wave 415 후보: Gucci broad 내 반복 모델. LANE_READINESS 전까지 internal-only.",
  },
  {
    id: "shoe-gucci-rhyton",
    brand: "Gucci",
    category: "shoe",
    laneKey: "gucci_rhyton",
    modelName: "Gucci Rhyton Sneaker",
    aliases: ["Gucci Rhyton", "구찌 라이톤", "구찌 롸이톤", "라이톤 스니커즈", "롸이톤 스니커즈"],
    mustContain: [
      ["gucci", "구찌"],
      ["라이톤", "롸이톤", "rhyton"],
      ["스니커즈", "sneaker", "신발", "shoe"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
    ],
    msrpKrw: 1450000,
    released: 2018,
    defaultProductType: "sneaker",
    confusionNote: "Wave 416 후보: Gucci Rhyton. LANE_READINESS 전까지 internal-only.",
  },
  {
    id: "shoe-gucci-tennis-1977",
    brand: "Gucci",
    category: "shoe",
    laneKey: "gucci_tennis_1977",
    modelName: "Gucci Tennis 1977 Sneaker",
    aliases: ["Gucci Tennis 1977", "구찌 테니스 1977", "테니스 1977"],
    mustContain: [
      ["gucci", "구찌"],
      ["테니스 1977", "tennis 1977"],
      ["스니커즈", "sneaker", "신발", "shoe", "운동화"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      // multi-item description: 벌꿀/bee 스니커즈와 Tennis 1977을 한 설명에 같이 쓰는 판매글 차단.
      "벌꿀", "벌 로고", "bee", "honey",
    ],
    msrpKrw: 1000000,
    released: 2020,
    defaultProductType: "sneaker",
    confusionNote: "Wave 418 후보: Gucci broad 내 Tennis 1977 반복 모델. LANE_READINESS 전까지 internal-only.",
  },
  {
    id: "shoe-prada-america-cup",
    brand: "Prada",
    category: "shoe",
    laneKey: "prada_america_cup",
    modelName: "Prada America's Cup Sneaker",
    aliases: ["Prada America's Cup", "프라다 아메리카컵", "프라다 아메리칸 컵"],
    mustContain: [
      ["prada", "프라다"],
      ["아메리카컵", "아메리칸 컵", "america cup", "america's cup"],
      ["스니커즈", "sneaker", "신발", "shoe"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
    ],
    msrpKrw: 1200000,
    released: 1997,
    defaultProductType: "sneaker",
    confusionNote: "Wave 418 후보: Prada broad 내 America's Cup 반복 모델. LANE_READINESS 전까지 internal-only.",
  },
  {
    id: "shoe-hermes-egerie",
    brand: "Hermes",
    category: "shoe",
    laneKey: "hermes_egerie",
    modelName: "Hermes Egerie Sandal",
    aliases: ["Hermes Egerie", "에르메스 에제리", "에제리 샌들"],
    mustContain: [
      ["hermes", "에르메스"],
      ["에제리", "egerie"],
      ["샌들", "sandal", "슬리퍼", "쪼리"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
    ],
    msrpKrw: 750000,
    released: 2021,
    defaultProductType: "sandal",
    confusionNote: "Wave 418 후보: Hermes broad 내 Egerie sandal 반복 모델. LANE_READINESS 전까지 internal-only.",
  },
  {
    id: "shoe-hermes-izmir",
    brand: "Hermes",
    category: "shoe",
    laneKey: "hermes_izmir",
    modelName: "Hermes Izmir Sandal",
    aliases: ["Hermes Izmir", "에르메스 이즈미르", "이즈미르 샌들"],
    mustContain: [
      ["hermes", "에르메스"],
      ["이즈미르", "izmir"],
      ["샌들", "sandal", "슬리퍼", "뮬"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
    ],
    msrpKrw: 1100000,
    released: 2015,
    defaultProductType: "sandal",
    confusionNote: "Wave 418 후보: Hermes broad 내 Izmir sandal 반복 모델. LANE_READINESS 전까지 internal-only.",
  },
  {
    id: "shoe-dior-b23",
    brand: "Dior",
    category: "shoe",
    laneKey: "dior_b23",
    modelName: "Dior B23 Sneaker",
    aliases: ["Dior B23", "디올 B23", "B23 오블리크"],
    mustContain: [
      ["dior", "디올"],
      ["b23"],
      ["스니커즈", "sneaker", "신발", "shoe", "하이탑", "로우"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      "캑터스", "cactus jack", "트래비스", "travis",
    ],
    msrpKrw: 1400000,
    released: 2018,
    defaultProductType: "sneaker",
    confusionNote: "Wave 415 후보: Dior B23. Collab/condition spread는 release 전 별도 sample 확인.",
  },
  {
    id: "shoe-dior-b30",
    brand: "Dior",
    category: "shoe",
    laneKey: "dior_b30",
    modelName: "Dior B30 Sneaker",
    aliases: ["Dior B30", "디올 B30", "B30 테크니컬"],
    mustContain: [
      ["dior", "디올"],
      ["b30"],
      ["스니커즈", "sneaker", "신발", "shoe", "테크니컬"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
    ],
    msrpKrw: 1600000,
    released: 2021,
    defaultProductType: "sneaker",
    confusionNote: "Wave 415 후보: Dior B30. LANE_READINESS 전까지 internal-only.",
  },
  {
    id: "shoe-dior-b25",
    brand: "Dior",
    category: "shoe",
    laneKey: "dior_b25",
    modelName: "Dior B25 Sneaker",
    aliases: ["Dior B25", "디올 B25", "B25 러너"],
    mustContain: [
      ["dior", "디올"],
      ["b25"],
      ["스니커즈", "sneaker", "신발", "shoe", "러너"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
    ],
    msrpKrw: 1500000,
    released: 2018,
    defaultProductType: "sneaker",
    confusionNote: "Wave 417 후보: Dior B25. LANE_READINESS 전까지 internal-only.",
  },
  {
    id: "shoe-dior-b27",
    brand: "Dior",
    category: "shoe",
    laneKey: "dior_b27",
    modelName: "Dior B27 Sneaker",
    aliases: ["Dior B27", "디올 B27", "B27 오블리크"],
    mustContain: [
      ["dior", "디올"],
      ["b27"],
      ["스니커즈", "sneaker", "신발", "shoe", "하이탑", "미드탑", "로우탑"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
    ],
    msrpKrw: 1500000,
    released: 2020,
    defaultProductType: "sneaker",
    confusionNote: "Wave 417 후보: Dior B27. 그래피티/갤럭시 variant는 ready 승격 전 추가 split 검토.",
  },
  {
    id: "shoe-dior-b57",
    brand: "Dior",
    category: "shoe",
    laneKey: "dior_b57",
    modelName: "Dior B57 Sneaker",
    aliases: ["Dior B57", "디올 B57", "B57 CD로고"],
    mustContain: [
      ["dior", "디올"],
      ["b57"],
      ["스니커즈", "sneaker", "신발", "shoe"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
    ],
    msrpKrw: 1600000,
    released: 2023,
    defaultProductType: "sneaker",
    confusionNote: "Wave 417 후보: Dior B57. LANE_READINESS 전까지 internal-only.",
  },

  // ═══════════════════════════════════════════════════════════
  // 명품 신발 brand-broad (모델 추정 안되면 fallback)
  // ═══════════════════════════════════════════════════════════
  {
    id: "shoe-louisvuitton-broad",
    brand: "Louis Vuitton",
    category: "shoe",
    modelName: "Louis Vuitton 신발 (Broad)",
    aliases: ["Louis Vuitton 스니커즈", "루이비통 스니커즈", "루이비통 신발", "LV 신발"],
    mustContain: [
      ["louis vuitton", "루이비통", " lv "],
      ["스니커즈", "sneaker", "신발", "shoe", "운동화", "부츠", "boot", "로퍼", "loafer", "더비", "옥스포드", "샌들", "sandal", "슬리퍼"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      // 가방/지갑/액세서리
      "가방", "백팩", "토트", "숄더", "크로스백", "포셰트", "pochette", "벨트", "belt",
      "키링", "스카프", "안경", "선글라스",
      // 모자/의류
      "캡", "모자", "후드", "티셔츠", "셔츠",
      // Wave 415: 반복 모델은 narrow 후보로 분리. broad fallback이 같이 매칭되면 ambiguity로 drop됨.
      "트레이너", "trainer",
      // Wave 416: LV Run Away narrow 후보 분리 + Nike LV8 false positive 방어.
      "런어웨이", "runaway", "run away", "lv8",
    ],
    msrpKrw: 1490000,
    released: 2024,
    confusionNote: "LV broad SKU — 모델 추정 안 되는 LV 스니커즈/부츠 fallback. variant 가격대 50만~150만 wide. confidence_low.",
  },
  {
    id: "shoe-gucci-broad",
    brand: "Gucci",
    category: "shoe",
    modelName: "Gucci 신발 (Broad)",
    aliases: ["Gucci 스니커즈", "구찌 스니커즈", "구찌 신발"],
    mustContain: [
      ["gucci", "구찌"],
      ["스니커즈", "sneaker", "신발", "shoe", "운동화", "부츠", "boot", "로퍼", "loafer", "더비", "옥스포드", "샌들", "sandal", "슬리퍼"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      // Wave 266b API sweep 발견 — 57건 bag-gucci-gg-marmont-mini query 결과에서 신발이 잡힘.
      //   bag 카테고리 매물 차단 (가방/숄더/토트/크로스백/백팩/포셰트 등).
      "가방", "백팩", "토트", "숄더", "크로스백", "shoulder", "shopper", "tote", "pochette", "포셰트",
      "벨트", "belt", "키링", "키체인",
      "캡", "모자", "후드티", "티셔츠", "셔츠 ",
      // 콜라보 (아디다스 콜라보 별도)
      "adidas x gucci", "gucci x adidas", "아디다스 x 구찌",
      // Wave 415: Gucci Ace narrow 후보 분리.
      "에이스", "ace",
      // Wave 416: Gucci Rhyton narrow 후보 분리.
      "라이톤", "롸이톤", "rhyton",
      // Wave 418: Gucci Tennis 1977 narrow 후보 분리.
      "테니스 1977", "tennis 1977",
    ],
    msrpKrw: 990000,
    released: 2024,
    confusionNote: "Gucci broad SKU — 모델 추정 안 되는 구찌 신발 fallback. variant wide.",
  },
  {
    id: "shoe-prada-broad",
    brand: "Prada",
    category: "shoe",
    modelName: "Prada 신발 (Broad)",
    aliases: ["Prada 스니커즈", "프라다 스니커즈", "프라다 신발"],
    mustContain: [
      ["prada", "프라다"],
      ["스니커즈", "sneaker", "신발", "shoe", "운동화", "부츠", "boot", "로퍼", "loafer", "더비", "옥스포드", "샌들", "sandal", "슬리퍼"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      "가방", "백팩", "토트", "숄더", "크로스백", "벨트", "belt", "키링",
      "캡", "모자", "후드", "티셔츠",
      // 콜라보 (아디다스 X 프라다 별도)
      "adidas x prada", "prada x adidas",
      // Wave 418: Prada America's Cup narrow 후보 분리.
      "아메리카컵", "아메리칸 컵", "america cup", "america's cup",
    ],
    msrpKrw: 890000,
    released: 2024,
    confusionNote: "Prada broad SKU — 모델 추정 안 되는 프라다 신발 fallback.",
  },
  {
    id: "shoe-hermes-broad",
    brand: "Hermes",
    category: "shoe",
    modelName: "Hermes 신발 (Broad)",
    aliases: ["Hermes 스니커즈", "에르메스 스니커즈", "에르메스 신발"],
    mustContain: [
      ["hermes", "에르메스"],
      ["스니커즈", "sneaker", "신발", "shoe", "운동화", "부츠", "boot", "로퍼", "loafer", "더비", "옥스포드", "샌들", "sandal", "슬리퍼"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      "가방", "백팩", "토트", "숄더", "크로스백", "벨트", "belt", "스카프",
      "캡", "모자", "후드", "티셔츠",
      // Wave 415: Hermes Bouncing narrow 후보 분리.
      "바운싱", "bouncing",
      // Wave 418: Hermes sandal repeated models 분리.
      "에제리", "egerie", "이즈미르", "izmir",
    ],
    msrpKrw: 1490000,
    released: 2024,
    confusionNote: "Hermes broad SKU — 모델 추정 안 되는 에르메스 신발 fallback.",
  },
  {
    id: "shoe-dior-broad",
    brand: "Dior",
    category: "shoe",
    modelName: "Dior 신발 (Broad)",
    aliases: ["Dior 스니커즈", "디올 스니커즈", "디올 신발"],
    mustContain: [
      ["dior", "디올"],
      ["스니커즈", "sneaker", "신발", "shoe", "운동화", "부츠", "boot", "로퍼", "loafer", "더비", "옥스포드", "샌들", "sandal", "슬리퍼"],
    ],
    mustNotContain: [
      ...SHOE_COMMON_NOISE,
      ...SHOE_HIGH_END_NOISE,
      "가방", "백팩", "토트", "숄더", "크로스백", "벨트", "belt", "키링",
      "캡", "모자", "후드", "티셔츠",
      // Wave 415: Dior B23/B30 narrow 후보 분리.
      "b23", "b30",
      // Wave 417: Dior B25/B27/B57 narrow 후보 분리 + cross-brand bait 차단.
      "b25", "b27", "b57", "구찌", "gucci", "발렌시아가", "balenciaga", "발렌",
    ],
    msrpKrw: 1390000,
    released: 2024,
    confusionNote: "Dior broad SKU — 모델 추정 안 되는 디올 신발 fallback.",
  },
];
