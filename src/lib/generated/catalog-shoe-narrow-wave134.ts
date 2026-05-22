// Wave 134 (2026-05-16): 신발 narrow SKU 30개.
// 사용자 명령: "다 해. 정확매칭이 제일중요. 10번 검토 반복".
//
// 발견 (Wave 134 variants probe):
// - 호카 본디 8 (99k) vs X (250k) = +151% 가격 차이 → narrow 분리 필수
// - 페가수스 39 (46k) vs 41 (99k) = +115% → 세대 분리
// - AF1 화이트 (115k) vs 트리플 화이트 (60k) = +92% → 컬러 분리
// - 닥마 1460 체리 (75k) vs 블랙 (110k) = +47%
// - NB 990v5 (160k) vs 992 (210k) = +31% → 세대 분리
//
// Wave 133 broad 5개 (catalog-shoe-broad-wave133.ts) → 폐기. narrow로 교체.
// 한정판 SKU (catalog-shoe-wave91.ts) 39개 유지 (그대로).
//
// 정확매칭 원칙:
// - 각 SKU mustContain 매우 정밀 (세대/컬러 명시 매물만)
// - mustNotContain: 다른 세대 + 다른 컬러 + 가품 + 키즈 + 단품
// - 명시 안 한 매물 = 매칭 X (정확성 §12b)

import type { Sku } from "@/lib/catalog";

// 공통 mustNotContain (다 적용)
const COMMON_BLOCK = [
  // 가품
  "짭", "가품", "레플리카", "replica", "fake", "미러", "샘플", "sample", "1:1", "11급", "ss급정품",
  // 키즈/유아
  "td", "ps", "키즈", "유아", "아동", "toddler", "kids", "infant", "신생아", "여아", "남아",
  // 단품/한짝/파손
  "한짝", "한쪽만", "사이즈 미상", "파손", "찢어짐", "구멍", "구겨짐 심함",
  "신발박스", "신발 박스", "신발상자", "신발 상자", "슈박스", "shoebox", "shoe box", "박스만",
  // 매입글
  "삽니다", "구합니다", "구해요", "매입",
  // Wave 166 (2026-05-17): 가방/지갑 wrong category 차단
  "가방", "지갑", "백팩", "크로스백", "토트백", "숄더백", "핸드백", "가로 ", "세로 ", "크로스로 매",
];

// Wave 136: 신발 카테고리 공통 collab/한정판 차단 (LAUNCH_PLAN 12b: Precision > Recall)
// 실제 매물에서 narrow에 끼어든 collab들 (시세 왜곡 원인) — 명시 매물 reject default
const COLLAB_BLOCK = [
  // Wave 139: 추가 collab
  "billie eilish", "빌리 아일리시", "billie",
  "tyler the creator", "타일러 더 크리에이터", "골프 왕",
  "drake", "드레이크", "nocta", "녹타",
  "rhude", "루드",
  "casablanca", "카사블랑카",
  // 디자이너/스트릿
  "off-white", "off white", "오프화이트", "오프-화이트",
  "travis", "트래비스", "trvis",
  "supreme", "슈프림", "sup ",
  "stussy", "스투시", "나투시", "stüssy",
  "fragment", "프래그먼트",
  "fear of god", "fog", "essentials",
  "louis vuitton", "루이비통", "lv ",
  "balenciaga", "발렌시아가",
  "comme des garcons", "꼼데", "cdg", "play",
  "sacai", "사카이",
  "ambush", "앰부쉬",
  // 일본 셀렉트샵
  "wtaps", "더블탭스", "double tap",
  "neighborhood", "네이버후드",
  "fragment design",
  "atmos", "아트모스",
  "ojos", "오호스",
  // NB collab
  "aimé leon dore", "aime leon dore", "ald ", "에임레온도르", "에임 레온 도르",
  "jjjjound", "자운드", "jjj자운드", "jjj 자운드",
  "kith", "키스 ",
  "packer", "패커",
  "dtlr",
  "ssz", "아키오", "하세가와",
  "joe freshgoods", "조 프레시굿즈",
  "carhartt", "칼하트", "carhartt wip",
  "concepts",
  "salehe bembury", "샐러헤", "워민 디파트먼트",
  "gallery dept", "갤러리 디파트먼트",
  // 덩크/조던 collab
  "strangelove", "스트레인지러브",
  "ben & jerry", "벤앤제리",
  "civilist", "civilist berlin",
  "syracuse", "유타", "utah",
  // 닥마 collab
  "rick owens", "릭오웬스", "릭 오웬스", "ro ",
  "a-cold-wall", "어콜드월", "acw",
  "yohji yamamoto", "요지 야마모토",
  "vetements", "베트멍",
  // 어그 collab
  "palace", "팔라스",
  "fluff", "플러프",
  "telfar", "텔파",
  // 호카/아식스 collab
  "i4p", "할스튜디오", "hal studio",
  "kiko", "키코 코스타디노프", "kiko kostadinov",
  "wales bonner", "웨일스 보너",
  // 일반 colab 키워드
  "한정", "한정판", "콜라보", "콜라보레이션", "collaboration", "collab", "limited edition",
];

export const SHOE_NARROW_CATALOG: Sku[] = [
  // ─── 호카 본디 (세대 분리) ─────────────────────────────────
  {
    id: "shoe-hoka-bondi-8",
    brand: "Hoka",
    category: "shoe",
    modelName: "Hoka Bondi 8",
    aliases: ["호카 본디 8", "호카본디8", "Hoka Bondi 8"],
    mustContain: [
      ["호카", "hoka"],
      ["본디 8", "본디8", "본디 8ts", "본디8ts", "호카본디 8", "호카본디8", "호카원본디 8", "호카원본디8", "bondi 8", "bondi8", "bondi 8ts", "bondi8ts"],
    ],
    mustNotContain: [
      "본디 9", "본디9", "bondi 9", "bondi9",
      "본디 x", "본디x", "bondi x", "bondix",
      "본디 7", "본디7", "bondi 7",
      "본디 sr", "bondi sr", "본디 l", "bondi l",
      "본디 6", "본디6", "bondi 6", "본디 5", "본디 4",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 219000,
    released: 2022,
  },
  {
    id: "shoe-hoka-bondi-9",
    brand: "Hoka",
    category: "shoe",
    modelName: "Hoka Bondi 9",
    aliases: ["호카 본디 9", "호카본디9", "Hoka Bondi 9"],
    mustContain: [
      ["호카", "hoka"],
      ["본디 9", "본디9", "호카본디 9", "호카본디9", "호카원본디 9", "호카원본디9", "bondi 9", "bondi9"],
    ],
    mustNotContain: [
      "본디 8", "본디8", "bondi 8", "bondi8",
      "본디 x", "본디x", "bondi x", "bondix",
      "본디 sr", "bondi sr",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 239000,
    released: 2024,
  },
  {
    id: "shoe-hoka-bondi-x",
    brand: "Hoka",
    category: "shoe",
    modelName: "Hoka Bondi X",
    aliases: ["호카 본디 X", "Hoka Bondi X"],
    mustContain: [
      ["호카", "hoka"],
      ["본디 x", "본디x", "bondi x", "bondix"],
    ],
    mustNotContain: [
      "본디 8", "본디8", "bondi 8",
      "본디 9", "본디9", "bondi 9",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 270000,
    released: 2022,
  },

  // ─── 호카 클리프턴 (세대 분리) ────────────────────────────
  {
    id: "shoe-hoka-clifton-9",
    brand: "Hoka",
    category: "shoe",
    modelName: "Hoka Clifton 9",
    aliases: ["호카 클리프턴 9", "Hoka Clifton 9"],
    mustContain: [
      ["호카", "hoka"],
      ["클리프턴 9", "클리프턴9", "clifton 9", "clifton9"],
    ],
    mustNotContain: [
      "클리프턴 8", "clifton 8",
      "클리프턴 10", "clifton 10",
      "클리프턴 l", "clifton l",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 199000,
    released: 2023,
  },
  {
    id: "shoe-hoka-clifton-10",
    brand: "Hoka",
    category: "shoe",
    modelName: "Hoka Clifton 10",
    aliases: ["호카 클리프턴 10", "Hoka Clifton 10"],
    mustContain: [
      ["호카", "hoka"],
      ["클리프턴 10", "클리프턴10", "clifton 10", "clifton10"],
    ],
    mustNotContain: [
      "클리프턴 9", "clifton 9",
      "클리프턴 8", "clifton 8",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 199000,
    released: 2024,
  },

  // ─── 나이키 페가수스 (세대 분리) ──────────────────────────
  {
    id: "shoe-nike-pegasus-39",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Pegasus 39",
    aliases: ["페가수스 39", "Pegasus 39"],
    mustContain: [
      ["페가수스", "pegasus"],
      ["39"],
    ],
    mustNotContain: [
      "페가수스 40", "pegasus 40",
      "페가수스 41", "pegasus 41",
      "페가수스 38", "pegasus 38",
      "페가수스 trail", "pegasus trail",
      "터보", "turbo",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 119000,
    released: 2022,
  },
  {
    id: "shoe-nike-pegasus-40",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Pegasus 40",
    aliases: ["페가수스 40", "Pegasus 40"],
    mustContain: [
      ["페가수스", "pegasus"],
      ["40"],
    ],
    mustNotContain: [
      "페가수스 39", "pegasus 39",
      "페가수스 41", "pegasus 41",
      "페가수스 trail", "pegasus trail",
      "터보", "turbo",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 149000,
    released: 2023,
  },
  {
    id: "shoe-nike-pegasus-41",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Pegasus 41",
    aliases: ["페가수스 41", "Pegasus 41"],
    mustContain: [
      ["페가수스", "pegasus"],
      ["41"],
    ],
    mustNotContain: [
      "페가수스 40", "pegasus 40",
      "페가수스 39", "pegasus 39",
      "페가수스 plus", "pegasus plus",
      "페가수스 trail", "pegasus trail",
      "premium", "프리미엄",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 169000,
    released: 2024,
  },

  // ─── 에어포스 1 (컬러 분리) ──────────────────────────────
  {
    id: "shoe-nike-airforce-1-low-white",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Air Force 1 Low Triple White",
    aliases: ["에어포스 1 화이트", "AF1 화이트", "Air Force 1 White"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "af1"],
      ["트리플 화이트", "트리플화이트", "triple white", "올화이트", "all white", "white/white", "화이트"],
    ],
    mustNotContain: [
      "블랙", "black", "트리플 블랙",
      "쉐도우", "shadow", "오프화이트", "off-white", "off white",
      "travis", "트래비스", "supreme", "슈프림", "louis vuitton", "루이비통",
      "high", "하이", "mid", "미드",
      // Wave 138: AF1 variant 차단
      "녹타", "nocta", "drake", "드레이크",
      "꼼데가르송", "comme des", "cdg",
      "할로윈", "halloween", "올검포스",
      "유틸리티", "utility",
      "플랫폼", "platform",
      "발렌타인", "valentine", "발렌타인스",
      "shadow", "sb", "스케이트보드",
      "experimental", "익스페리멘탈",
      "react", "리액트",
      "go the distance",
      "color of the month", "월간 컬러",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 139000,
    released: 1982,
  },
  {
    id: "shoe-nike-airforce-1-low-black",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Air Force 1 Low Triple Black",
    aliases: ["에어포스 1 블랙", "AF1 블랙", "Air Force 1 Black"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "af1"],
      ["트리플 블랙", "트리플블랙", "triple black", "올블랙", "all black", "black/black", "블랙"],
    ],
    mustNotContain: [
      "화이트", "white",
      "쉐도우", "shadow", "오프화이트", "off-white",
      "travis", "트래비스", "supreme",
      "high", "하이", "mid", "미드",
      // Wave 138: AF1 variant 차단
      "녹타", "nocta", "drake", "드레이크",
      "꼼데가르송", "comme des", "cdg",
      "할로윈", "halloween", "올검포스",
      "유틸리티", "utility",
      "플랫폼", "platform",
      "발렌타인", "valentine",
      "sb", "스케이트보드", "experimental", "익스페리멘탈",
      "react", "리액트",
      "color of the month", "월간 컬러",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 139000,
    released: 1982,
  },

  // ─── 덩크 로우 (컬러 분리) ───────────────────────────────
  {
    id: "shoe-nike-dunk-low-panda",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Dunk Low Panda (White Black)",
    aliases: ["덩크 로우 판다", "Dunk Low Panda"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["판다", "panda", "white black", "화이트 블랙", "화이트블랙"],
    ],
    mustNotContain: [
      "오프화이트", "off-white", "travis", "트래비스",
      "supreme", "슈프림", "sb", "ben & jerry",
      "high", "하이", "미드", "mid",
      "리버스", "reverse", "리버스 판다",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 119000,
    released: 2021,
  },
  {
    id: "shoe-nike-dunk-low-black-white",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Dunk Low Black/White (Standard Panda variant)",
    aliases: ["덩크 로우 블랙 화이트", "Dunk Low Black White", "검흰"],
    // Wave 692 (2026-05-23): mustContain narrow — 정확히 black-white 명시 매물만.
    //   일반 colorway 매물은 shoe-nike-dunk-low-broad (Wave 691)로 흘림 → needs_review 면제.
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["nike", "나이키"],
      ["블랙 화이트", "블랙화이트", "검흰", "흰검", "black white", "white black", "black/white", "white/black"],
    ],
    mustNotContain: [
      // 한정판 차단
      "판다", "panda", "오프화이트", "off-white", "off white",
      "travis", "트래비스", "supreme", "슈프림", "sb", "ben & jerry", "벤앤제리",
      "ambush", "앰부쉬", "co.jp", "civilist", "유타", "utah", "syracuse",
      // Wave 267 (2026-05-20): API sweep 발견 — syracuse/seoul/kentucky/michigan 등 narrow color SKU 들이
      //   black-white broad에 잡혀버림. narrow color keyword 차단 강화.
      "시라큐스", "syracues", "syracuse",  // narrow syracuse SKU 우선
      "서울", "seoul", "se seoul",  // narrow seoul SKU 우선
      "켄터키", "kentucky",  // narrow kentucky SKU 우선
      "미시간", "michigan",  // narrow michigan SKU 우선
      "스트레인지러브", "strangelove",
      "청키 덩키", "chunky dunky",
      "리버스 판다", "reverse panda",
      "카시나", "kasina",
      "베니자나", "veneer",
      "헤마초", "huf",
      // 다른 모델
      "high", "하이", "미드", "mid", "sky", "스카이",
      // Wave 137: 한정 컬러/SP 변형 차단 (가격 매우 다름)
      "잭팟", "jackpot", "말라카이트", "malachite",
      "플럼", "plum", "라이트 스모크 그레이",
      "넵튠", "neptune", "그린 앤 세일", "green and sail", "green & sail",
      "sp", "스페셜 박스", "special box",
      "retro",
      // Wave 599: production sample (pid 231299330/318174330/367318466/262029485/393706757) 발견 —
      // 명시 colorway 매물이 standard black/white SKU에 잘못 매칭. 각 colorway 차단.
      "유니버시티 블루", "university blue", "ub blue",
      "클리어제이드", "clear jade", "clearjade",
      "코끼리덩크", "코끼리 덩크", "elephant dunk", "엘레펀트",
      "미디움 커리", "medium curry", "커리\\b",
      "비비드 그린", "vivid green",
      "울프 그레이", "wolf grey", "wolf gray",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 119000,
    released: 1985,
  },

  // ─── 어그 (모델 분리) ────────────────────────────────────
  {
    id: "shoe-ugg-classic-short",
    brand: "UGG",
    category: "shoe",
    modelName: "UGG Classic Short",
    aliases: ["어그 클래식 숏", "UGG Classic Short", "어그 숏"],
    mustContain: [
      ["어그", "ugg"],
      ["클래식 숏", "classic short", "숏 부츠", "short boot", "클래식숏"],
    ],
    mustNotContain: [
      "미니", "mini", "탈", "tall", "얼티멋", "ultimate",
      // Wave 137: 변형 차단
      "웨더하이브리드", "weather hybrid", "하이브리드",
      "쇼트 ii", "short ii", "쇼트2", "short 2",
      "플랫폼", "platform",
      // Wave 138: classic_short 변형 추가
      "뉴 하이츠", "new heights",
      "청키", "chunky", "힐", "heel",
      "쥬얼", "jewel",
      "지퍼", "zipper",
      "ii ", "iii ",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 169000,
    released: 1978,
  },
  {
    id: "shoe-ugg-classic-mini",
    brand: "UGG",
    category: "shoe",
    modelName: "UGG Classic Mini",
    aliases: ["어그 클래식 미니", "UGG Classic Mini", "어그 미니"],
    mustContain: [
      ["어그", "ugg"],
      ["클래식 미니", "classic mini", "어그 미니", "ugg mini", "미니"],
    ],
    mustNotContain: [
      "숏", "short", "탈", "tall", "얼티멋", "ultimate",
      "fluff", "플러프",
      // Wave 137: 변형 모델 차단 (가격 다름)
      "울트라 미니", "ultra mini", "울트라미니",
      "플랫폼 미니", "platform mini", "플랫폼미니", "플랫폼",
      "디스켓", "disquette", "디퍼", "dipper", "디스코",
      "웨더하이브리드", "weather hybrid", "하이브리드",
      "디퍼 레그워머", "레그워머", "legwarmer",
      // Wave 139: 추가 변형 차단
      "미니 ii", "mini ii", "미니2", "mini 2", "미니투",
      "클리어 미니", "clear mini",
      "스웨이드 레더 미니", "스웨이드 레더",
      "그레니", "grani",
      "넵튠", "neptune",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 149000,
    released: 2017,
  },
  {
    id: "shoe-ugg-classic-tall",
    brand: "UGG",
    category: "shoe",
    modelName: "UGG Classic Tall",
    aliases: ["어그 클래식 탈", "UGG Classic Tall", "어그 탈"],
    mustContain: [
      ["어그", "ugg"],
      ["클래식 탈", "classic tall", "탈 부츠", "tall boot", "클래식탈"],
    ],
    mustNotContain: [
      "미니", "mini", "숏", "short", "얼티멋",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 209000,
    released: 1978,
  },

  // ─── 닥터마틴 1460 (컬러 분리) ──────────────────────────
  {
    id: "shoe-drmartens-1460-black",
    brand: "Dr. Martens",
    category: "shoe",
    modelName: "Dr. Martens 1460 Black",
    aliases: ["닥터마틴 1460 블랙", "Dr Martens 1460 Black", "닥마 1460 블랙"],
    mustContain: [
      ["닥터마틴", "닥마", "dr martens", "dr.martens", "drmartens"],
      ["1460"],
      ["블랙", "black"],
    ],
    mustNotContain: [
      "체리", "cherry", "화이트", "white", "옐로우", "yellow",
      "2976", "첼시", "chelsea", "1461",
      "키즈", "주니어",
      // Wave 137: 변형 모델 차단 (가격 다름)
      "트윈지퍼", "twin zipper", "지퍼",
      "쥬얼리", "jewel", "큐트",
      "인페르노", "inferno",
      "플로라", "flora", "꽃",
      "smooth", "스무스",  // 1460 smooth = 기본 모델은 OK인데 "1460 스무스 + 다른 컬러" variant 차단
      "쿼드", "quad",
      "vegan", "비건",
      "마돌리", "molly", "맥스",  // 파스칼 맥스 등
      "보이드", "void",
      "메가", "mega",  // 메가 레이스
      "dmxl", "xl ", "엑스라지",
      "코어", "core",  // 코어 색상 (한정)
      "스튜디오", "studio",  // 할 스튜디오 등
      // Wave 139: 추가 변형
      "스터드", "stud", "wanama",
      "워크", "work boot",  // workboot 변형
      "톨", "tall",
      "j ",  // 1460 J (키즈/주니어)
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 219000,
    released: 1960,
    defaultProductType: "boot",
  },
  {
    id: "shoe-drmartens-1460-cherry",
    brand: "Dr. Martens",
    category: "shoe",
    modelName: "Dr. Martens 1460 Cherry Red",
    aliases: ["닥터마틴 1460 체리", "Dr Martens 1460 Cherry", "닥마 1460 체리"],
    mustContain: [
      ["닥터마틴", "닥마", "dr martens", "dr.martens"],
      ["1460"],
      ["체리", "cherry", "와인", "와인색"],
    ],
    mustNotContain: [
      "블랙", "black", "화이트", "white",
      "2976", "첼시", "1461",
      // Wave 137: 변형 차단
      "트윈지퍼", "twin zipper", "지퍼",
      "쥬얼리", "jewel",
      "인페르노", "inferno",
      "플로라", "flora",
      "쿼드", "quad",
      "vegan", "비건",
      "vintage", "빈티지",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 219000,
    released: 1960,
    defaultProductType: "boot",
  },
  {
    id: "shoe-drmartens-2976-chelsea",
    brand: "Dr. Martens",
    category: "shoe",
    modelName: "Dr. Martens 2976 Chelsea",
    aliases: ["닥터마틴 첼시", "닥터마틴 2976", "Dr Martens 2976"],
    mustContain: [
      ["닥터마틴", "닥마", "dr martens", "dr.martens"],
      ["2976", "첼시", "chelsea"],
    ],
    mustNotContain: [
      "1460", "1461",
      "키즈",
      // Wave 137: 첼시 variant 차단 (가격 다름)
      "플라워", "flower", "꽃무늬",
      "퀴어", "queer", "프라이드", "pride",
      "vegan", "비건",
      "플랫폼", "platform",
      "벡스", "vex",
      // Wave 138: 첼시 variant 추가 차단
      "모노", "mono",
      "mie", "made in england", "메이드 인 잉글랜드",
      "vintage", "빈티지",
      "버클", "buckle",
      // Wave 536: Flora is a separate women's Chelsea line and should not share 2976 samples.
      "플로라", "flora",
      // Wave 139: 추가 변형
      "2076",  // 별도 모델 (2976과 다름)
      "하이", "hi top", "하이탑", "high",
      "옥스포드", "oxford",
      "메리제인", "mary jane",
      "스무스 vintage", "스무스 빈티지",
      // Wave 662 (2026-05-22): 추가 variant — c_grade spread 4.17x audit.
      "메이볼", "maybelle", "pascal maybelle",  // Maybelle variant (Pascal 라인)
      "se13", "플로랄",  // Floral SE13 변형 (Wave 537 flora 보완)
      // 다중 색상 묶음 매물 (한 매물에 두 색상)
      "블랙 브라운", "블랙/브라운", "블랙 브라운 세트", "블랙브라운",
      "브라운 블랙", "브라운/블랙", "두색상", "두 색상",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 239000,
    released: 1976,
    defaultProductType: "boot", // Wave 236e — 2976 Chelsea = boot.
  },

  // ─── 푸마 팔레르모 (컬러 분리) ─────────────────────────
  {
    id: "shoe-puma-palermo-black",
    brand: "Puma",
    category: "shoe",
    modelName: "Puma Palermo Black",
    aliases: ["푸마 팔레르모 블랙", "Puma Palermo Black"],
    mustContain: [
      ["푸마", "puma"],
      ["팔레르모", "palermo"],
      ["블랙", "black"],
    ],
    mustNotContain: [
      "화이트", "white", "그린", "green", "베이지", "beige",
      "premium", "프리미엄", "한정",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 119000,
    released: 2024,
  },
  {
    id: "shoe-puma-palermo-white",
    brand: "Puma",
    category: "shoe",
    modelName: "Puma Palermo White",
    aliases: ["푸마 팔레르모 화이트", "Puma Palermo White"],
    mustContain: [
      ["푸마", "puma"],
      ["팔레르모", "palermo"],
      ["화이트", "white"],
    ],
    mustNotContain: [
      "블랙", "black", "그린", "green", "베이지", "beige",
      "한정",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 119000,
    released: 2024,
  },

  // ─── 컨버스 척70 (컬러 분리) ───────────────────────────
  {
    id: "shoe-converse-chuck70-black",
    brand: "Converse",
    category: "shoe",
    modelName: "Converse Chuck 70 Black",
    aliases: ["컨버스 척70 블랙", "Chuck 70 Black", "컨버스 척테일러 70 블랙"],
    mustContain: [
      ["컨버스", "converse", "척", "chuck"],
      ["70", "척70", "chuck70"],
      ["블랙", "black"],
    ],
    mustNotContain: [
      "화이트", "white", "빈티지", "vintage",
      "cdg", "꼼데", "comme des garcons", "play",
      "사카이", "sacai", "이로", "stussy",
      // Wave 138: chuck70 variant 차단
      "다크쉐도우", "dark shadow", "터보다크", "turbo dark",
      "래커드", "lacquered", "데님", "denim",
      "하이", "high", "hi top", "하이탑",
      "쇼츠", "shoreline",
      "tyler", "타일러", "더 크리에이터",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 105000,
    released: 2013,
  },
  {
    id: "shoe-converse-chuck70-white",
    brand: "Converse",
    category: "shoe",
    modelName: "Converse Chuck 70 White",
    aliases: ["컨버스 척70 화이트", "Chuck 70 White"],
    mustContain: [
      ["컨버스", "converse", "척", "chuck"],
      ["70", "척70", "chuck70"],
      ["화이트", "white"],
    ],
    mustNotContain: [
      "블랙", "black", "빈티지", "vintage",
      "cdg", "꼼데", "comme des garcons",
      "사카이", "sacai",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 105000,
    released: 2013,
  },

  // ─── 뉴발란스 (세대 분리) ───────────────────────────────
  {
    id: "shoe-newbalance-990v5",
    brand: "New Balance",
    category: "shoe",
    modelName: "New Balance 990v5",
    aliases: ["뉴발란스 990v5", "NB 990v5"],
    // Wave 239 (2026-05-19): production audit — "뉴발란스 410v5" 매물 매칭. "v5" 단독 매칭이 위험.
    //   다른 NB 모델 (410/411/412/810/910 등) 도 v5 표기. "990v5"/"990 v5" 만 강제.
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "nb"],
      ["990v5", "990 v5"],
    ],
    mustNotContain: [
      "990v6", "v6", "990v4", "v4",
      "991", "992", "993", "997", "998",
      "joe freshgoods", "조 프레시굿즈", "ald", "aime leon dore",
      // Wave 239: 다른 NB 모델 차단 (v5 표기 공유 모델)
      "410", "411", "412", "810", "910", "996", "999",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 269000,
    released: 2019,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-newbalance-990v6",
    brand: "New Balance",
    category: "shoe",
    modelName: "New Balance 990v6",
    aliases: ["뉴발란스 990v6", "NB 990v6"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "nb"],
      ["990v6", "990 v6", "v6"],
    ],
    mustNotContain: [
      "990v5", "v5", "990v4",
      "991", "992", "993", "997", "998",
      "joe freshgoods", "ald", "aime leon dore",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 289000,
    released: 2022,
  },
  {
    id: "shoe-newbalance-992",
    brand: "New Balance",
    category: "shoe",
    modelName: "New Balance 992",
    aliases: ["뉴발란스 992", "NB 992"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "nb"],
      ["992"],
    ],
    mustNotContain: [
      "990", "991", "993", "997", "998",
      "joe freshgoods", "ald",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 249000,
    released: 2006,
  },
  {
    id: "shoe-newbalance-993",
    brand: "New Balance",
    category: "shoe",
    modelName: "New Balance 993",
    aliases: ["뉴발란스 993", "NB 993"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "nb"],
      ["993"],
    ],
    mustNotContain: [
      "990", "991", "992", "997", "998",
      // Wave 138: 993 한정 컬러 variant 차단 (가격 다름)
      "차이브", "chive",
      "토프", "taupe",
      "머쉬룸", "mushroom",
      "msg",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 249000,
    released: 2008,
  },
  {
    id: "shoe-newbalance-1906",
    brand: "New Balance",
    category: "shoe",
    modelName: "New Balance 1906R",
    aliases: ["뉴발란스 1906", "NB 1906", "1906R"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "nb"],
      ["1906"],
    ],
    mustNotContain: [
      "1905", "1907",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 209000,
    released: 2023,
  },
  // NB 530 (Wave 133 broad는 유지 — variant 가격 차이 작음)

  // ─── 아디다스 삼바 (그대로 broad 유지 — variant 적음) ──
  // ─── 추가 인기 모델 ─────────────────────────────────────
  {
    id: "shoe-asics-gel-1130",
    brand: "Asics",
    category: "shoe",
    modelName: "Asics Gel-1130",
    aliases: ["아식스 젤 1130", "Asics Gel 1130", "Gel-1130"],
    mustContain: [
      ["아식스", "asics"],
      ["gel-1130", "gel 1130", "젤 1130", "1130"],
    ],
    mustNotContain: [
      "kayano", "카야노", "nimbus", "님버스",
      "gt", "lyte",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 149000,
    released: 2008,
  },
  {
    id: "shoe-adidas-gazelle-indoor",
    brand: "Adidas",
    category: "shoe",
    modelName: "Adidas Gazelle Indoor",
    aliases: ["아디다스 가젤 인도어", "Adidas Gazelle Indoor"],
    mustContain: [
      ["아디다스", "adidas"],
      ["가젤", "gazelle"],
      ["인도어", "indoor"],
    ],
    mustNotContain: [
      "og", "samba", "삼바", "spezial", "스페즐",
      "bold orange", "bold-orange",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 159000,
    released: 1968,
  },

  // ─── Wave 691 (2026-05-23): UGG / Adidas Samba broad / Gazelle / Dunk broad — Pareto top brand 신설 ──
  // 사용자 명시: 여성 친화 (UGG) + 신발 풀 0~30만 친화가 확보 우선.
  // raw 7d 매물 = 5,300건/주 (lane 부재 → 매칭 0).

  // ─── UGG (695 매물/주) — 여성 친화 ──────────────────────
  // 인기 모델: Classic Short/Mini/Tall, Tasman, Ultra Mini, Neumel, Disquette
  // Noise: "어그로 아님" (자전거 매물), 가방/파우치, 패딩
  {
    id: "shoe-ugg-classic-broad",
    brand: "UGG",
    category: "shoe",
    modelName: "UGG Classic Boot (Short / Mini / Tall / Ultra Mini broad)",
    aliases: ["UGG Classic", "어그 클래식", "어그 미니", "어그 부츠"],
    mustContain: [
      ["ugg", "어그"],
      ["부츠", "boot", "미니", "mini", "숏", "short", "톨", "tall", "타스만", "tasman", "뉴멜", "neumel", "디스켓", "disquette", "디퍼", "오즈웨어"],
    ],
    mustNotContain: [
      // 짝퉁
      "uggs", "짝퉁", "카피", "이미테이션",
      // 자전거 매물 "어그로" 슬랭 false positive
      "어그로", "어그로아님", "어그로ㄴ", "어그로 ㄴ", "어그로 x", "어그로x", "어그로 xx",
      // cross-category (어그 가방/파우치/패딩)
      "가방", "토트", "토트백", "크로스백", "파우치", "월렛", "지갑",
      "패딩", "다운", "구스다운", "덕다운", "오리털", "폭스",
      // 자전거 부품
      "픽시", "mtb", "기어", "픽시바이크", "카본 88림", "카본픽시", "스기노젠",
      "콘스탄틴", "디페", "엔진 11", "스프린트", "랩3", "지프 스프린트",
      // 슬리퍼는 별도 (옵션)
      "슬리퍼", "slipper",
      // 짝/단품/박스
      "한짝", "한쪽만", "박스만", "사이즈 미상", "사이즈 모름",
      // 키즈
      "키즈", "kids", "유아", "아동", "여아", "남아", "infant", "td",
      // 명품/콜라보 한정 (가격대 다름)
      "프라다 x", "x 프라다", "telfar", "텔파", "molly goddard",
      // 셀럽
      "셀럽 착용",
      // 매입
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 250000,
    released: 1978,
    defaultProductType: "boot",
  },

  // ─── Adidas Samba broad (596 매물/주, collab 별도) ──────
  {
    id: "shoe-adidas-samba-broad",
    brand: "Adidas",
    category: "shoe",
    modelName: "Adidas Samba (Broad — OG/Classic, collab 별도)",
    aliases: ["Adidas Samba", "아디다스 삼바", "Samba OG", "Samba Classic"],
    mustContain: [
      ["adidas", "아디다스"],
      ["samba", "삼바"],
    ],
    mustNotContain: [
      // collab 별도 SKU 다 있음
      "kith", "키스",
      "wales bonner", "웨일스 보너", "웨일즈보너", "웨일즈 보너",
      "pharrell", "퍼렐",
      "sporty rich", "스포티앤리치", "스포티 앤 리치", "sporty & rich",
      "ronnie fieg", "로니피그",
      // 한정 / 명품
      "gucci", "구찌", "prada", "프라다",
      "한정판", "limited edition",
      // 키즈
      "키즈", "kids", "유아", "아동", "여아", "남아", "infant", "td",
      // 가품
      "짝퉁", "카피", "이미테이션", "rep ", "replica", "fake",
      // 단품/박스
      "한짝", "한쪽만", "박스만",
      // 매입
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 159000,
    released: 1950,
    defaultProductType: "sneaker",
  },

  // ─── Adidas Gazelle (601 매물/주) ──────────────────────
  {
    id: "shoe-adidas-gazelle-broad",
    brand: "Adidas",
    category: "shoe",
    modelName: "Adidas Gazelle (OG/Indoor broad)",
    aliases: ["Adidas Gazelle", "아디다스 가젤", "Gazelle OG", "Gazelle Indoor"],
    mustContain: [
      ["adidas", "아디다스"],
      ["gazelle", "가젤"],
    ],
    mustNotContain: [
      // collab
      "wales bonner", "웨일즈 보너", "웨일스 보너",
      "gucci", "구찌",
      "kith", "키스",
      // 한정
      "한정판", "limited edition",
      // 키즈
      "키즈", "kids", "유아", "아동", "여아", "남아", "infant", "td",
      // 가품
      "짝퉁", "카피", "이미테이션", "rep ", "replica", "fake",
      // 단품/박스
      "한짝", "한쪽만", "박스만",
      // 매입
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 139000,
    released: 1968,
    defaultProductType: "sneaker",
  },

  // ─── Nike Dunk Low broad (1374 매물/주) ────────────────
  // Wave 134 narrow 2개 (Panda + Black/White Standard) 있고 일반 colorway broad 없음.
  // 이미 narrow에서 한정/SP 다 차단 → broad는 일반 colorway 다 흡수.
  {
    id: "shoe-nike-dunk-low-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Dunk Low (Broad — 일반 colorway)",
    aliases: ["Nike Dunk Low", "덩크 로우", "Dunk Low"],
    mustContain: [
      ["nike", "나이키"],
      ["덩크 로우", "덩크로우", "dunk low"],
    ],
    mustNotContain: [
      // narrow SKU 우선 — Panda / Black-White Standard 차단
      "판다", "panda",
      // 한정/SP collab (가격 200~500만+)
      "오프화이트", "off-white", "off white",
      "travis", "트래비스", "트래비스 스캇", "트래비스스캇",
      "supreme", "슈프림", "sb dunk", "sb low",
      "civilist", "civilist", "ben & jerry", "벤앤제리",
      "ambush", "앰부쉬", "co.jp",
      "stussy", "스투시", "kasina", "카시나",
      "stranglove", "strangelove", "스트레인지러브",
      "chunky dunky", "청키 덩키",
      "reverse panda", "리버스 판다",
      // 다른 모델
      "high", "하이", "미드", "mid",
      // 다른 SKU
      "syracuse", "시라큐스", "kentucky", "켄터키", "michigan", "미시간",
      "veneer", "베니자나", "huf", "헤마초",
      // 키즈
      "키즈", "kids", "유아", "아동", "여아", "남아", "infant", "td", "gs",
      // 가품
      "짝퉁", "카피", "이미테이션", "rep ", "replica", "fake", "11급", "ss급",
      // 단품/박스
      "한짝", "한쪽만", "박스만",
      // 매입
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 119000,
    released: 1985,
    defaultProductType: "sneaker",
  },

  // ─── Air Jordan 1 broad (AJ 2,231 매물/주 — Pareto 1위) ─
  // AJ1 가품 위험 매우 큼 — narrow Mid / Low 만 broad, High 별도 + collab 다 차단.
  {
    id: "shoe-nike-airjordan-1-low",
    brand: "Nike",
    category: "shoe",
    modelName: "Air Jordan 1 Low (broad)",
    aliases: ["Air Jordan 1 Low", "조던 1 로우", "AJ1 Low"],
    mustContain: [
      ["조던", "jordan", "aj1", "에어조던"],
      ["로우", "low"],
      ["1 ", "1세대", " 1\\b"],
    ],
    mustNotContain: [
      "high", "하이", "mid", "미드",
      // collab (가품 매우 큼)
      "travis", "트래비스", "오프화이트", "off-white", "off white",
      "fragment", "프래그먼트", "dior", "디올",
      "union", "유니온",
      "한정판", "limited edition",
      // 키즈
      "키즈", "kids", "유아", "아동", "여아", "남아", "infant", "td", "gs",
      // 가품
      "짝퉁", "카피", "이미테이션", "rep ", "replica", "fake", "11급", "ss급정품", "1:1",
      // 단품/박스
      "한짝", "한쪽만", "박스만",
      // 매입
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 139000,
    released: 1985,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-airjordan-1-mid",
    brand: "Nike",
    category: "shoe",
    modelName: "Air Jordan 1 Mid (broad)",
    aliases: ["Air Jordan 1 Mid", "조던 1 미드", "AJ1 Mid"],
    mustContain: [
      ["조던", "jordan", "aj1", "에어조던"],
      ["미드", "mid"],
      ["1 ", "1세대", " 1\\b"],
    ],
    mustNotContain: [
      "high", "하이", "low", "로우",
      // collab
      "travis", "트래비스", "오프화이트", "off-white", "off white",
      "fragment", "프래그먼트", "dior", "디올", "union", "유니온",
      "한정판", "limited edition",
      // 키즈
      "키즈", "kids", "유아", "아동", "여아", "남아", "infant", "td", "gs",
      // 가품
      "짝퉁", "카피", "이미테이션", "rep ", "replica", "fake", "11급", "ss급정품", "1:1",
      "한짝", "한쪽만", "박스만",
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 139000,
    released: 1985,
    defaultProductType: "sneaker",
  },

  // Wave 693 (2026-05-23): Air Jordan family 확장 (AJ1 High / AJ3 / AJ4 / AJ11).
  // AJ family raw 매물 7d:
  //   AJ4 130, AJ1 High 128, AJ11 45, AJ3 34 (= 337건/주 추가).
  //   AJ family 가품 위험 매우 큼 — Travis/Off-White/Dior/Union/Fragment + 11급/SS급/1:1 명시 차단.

  {
    id: "shoe-nike-airjordan-1-high",
    brand: "Nike",
    category: "shoe",
    modelName: "Air Jordan 1 High (broad)",
    aliases: ["Air Jordan 1 High", "조던 1 하이", "AJ1 High"],
    mustContain: [
      ["조던", "jordan", "aj1", "에어조던"],
      ["하이", "high"],
      ["1 ", "1세대", " 1\\b"],
    ],
    mustNotContain: [
      "mid", "미드", "low", "로우",
      // collab (가품 매우 큼)
      "travis", "트래비스", "오프화이트", "off-white", "off white",
      "fragment", "프래그먼트", "dior", "디올", "union", "유니온",
      "spider verse", "스파이더버스", "off noir",
      "한정판", "limited edition",
      // 키즈
      "키즈", "kids", "유아", "아동", "여아", "남아", "infant", "td", "gs",
      // 가품
      "짝퉁", "카피", "이미테이션", "rep ", "replica", "fake", "11급", "ss급정품", "ss급 정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만",
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 189000,
    released: 1985,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-airjordan-3",
    brand: "Nike",
    category: "shoe",
    modelName: "Air Jordan 3 (broad)",
    aliases: ["Air Jordan 3", "조던 3", "AJ3"],
    mustContain: [
      ["조던", "jordan", "에어조던"],
      ["aj3", " 3 ", "3세대", "3 retro"],
    ],
    mustNotContain: [
      // 다른 세대
      "aj1", "aj4", "aj5", "aj6", "aj11", "aj13", "조던 1", "조던 4", "조던 5", "조던 11",
      "1 미드", "1 하이", "1 로우", "1 mid", "1 high", "1 low", "4 retro",
      // collab
      "travis", "트래비스", "오프화이트", "off-white", "off white",
      "fragment", "프래그먼트", "dior", "디올",
      "한정판", "limited edition",
      // 키즈
      "키즈", "kids", "유아", "아동", "여아", "남아", "infant", "td", "gs",
      // 가품
      "짝퉁", "카피", "이미테이션", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만",
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 219000,
    released: 1988,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-airjordan-4",
    brand: "Nike",
    category: "shoe",
    modelName: "Air Jordan 4 (broad)",
    aliases: ["Air Jordan 4", "조던 4", "AJ4"],
    mustContain: [
      ["조던", "jordan", "에어조던"],
      ["aj4", " 4 ", "4세대", "4 retro", "조던4"],
    ],
    mustNotContain: [
      // 다른 세대
      "aj1", "aj3", "aj5", "aj11", "조던 1", "조던 3", "조던 5", "조던 11",
      "1 미드", "1 하이", "3 retro", "5 retro", "11 retro",
      // collab (가품 매우 큼)
      "travis", "트래비스", "오프화이트", "off-white", "off white",
      "fragment", "프래그먼트", "dior", "디올",
      "kaws", "카우스", "union", "유니온",
      "에미넴", "eminem", "ovo",
      "한정판", "limited edition", "sp",
      // 키즈
      "키즈", "kids", "유아", "아동", "여아", "남아", "infant", "td", "gs",
      // 가품
      "짝퉁", "카피", "이미테이션", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만",
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 219000,
    released: 1989,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-airjordan-11",
    brand: "Nike",
    category: "shoe",
    modelName: "Air Jordan 11 (broad)",
    aliases: ["Air Jordan 11", "조던 11", "AJ11"],
    mustContain: [
      ["조던", "jordan", "에어조던"],
      ["aj11", " 11 ", "11세대", "11 retro", "조던11"],
    ],
    mustNotContain: [
      // 다른 세대
      "aj1", "aj3", "aj4", "aj5", "aj13", "조던 1", "조던 3", "조던 4", "조던 13",
      "1 미드", "1 하이", "3 retro", "4 retro", "13 retro",
      // collab
      "travis", "트래비스", "오프화이트", "off-white", "off white",
      "fragment", "프래그먼트", "dior", "디올",
      "한정판", "limited edition",
      // 키즈
      "키즈", "kids", "유아", "아동", "여아", "남아", "infant", "td", "gs",
      // 가품
      "짝퉁", "카피", "이미테이션", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만",
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 269000,
    released: 1995,
    defaultProductType: "sneaker",
  },

  // ═══════════════════════════════════════════════════════════
  // Wave 694 (2026-05-23): Dunk Low 32 narrow SKU 신설
  // Agent deep sweep (966건 raw, 89% 색상 식별) → 30+ 새 colorway 발견.
  // 한국 줄임말 (코퍼/미네/유레드/검흰/코끼리덩크) + collab + silhouette 분리.
  // ═══════════════════════════════════════════════════════════

  // --- 1단계: COLLAB narrow (가격 spread 큼, 별 SKU 필수) ---

  {
    id: "shoe-nike-dunk-low-offwhite",
    brand: "Nike x Off-White", category: "shoe",
    modelName: "Nike x Off-White Dunk Low (The 50)",
    aliases: ["Off-White Dunk Low", "오프화이트 덩크 로우", "Dunk Low The 50"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["오프화이트", "off-white", "off white", "offwhite", "lot ", "the 50", "더 50", "더50"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs", "유아", "아동",
      "에어맥스", "에어포스", "조던", "jordan", "blazer", "force",
      "짝퉁", "카피", "이미테이션", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "구해요", "매입"],
    msrpKrw: 1500000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-supreme",
    brand: "Nike x Supreme", category: "shoe",
    modelName: "Nike SB x Supreme Dunk Low",
    aliases: ["Supreme Dunk Low", "슈프림 덩크 로우", "Supreme SB Dunk"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["슈프림", "supreme", "라멜지", "ramellzee", "오션 포그", "오션포그", "ocean fog", "쥬얼 스우시", "쥬얼"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "조던", "jordan", "에어맥스", "에어포스",
      "짝퉁", "카피", "이미테이션", "rep ", "replica", "fake", "11급", "ss급정품", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 350000, released: 2002,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-kasina",
    brand: "Nike x Kasina", category: "shoe",
    modelName: "Nike x Kasina Dunk Low (한국 collab)",
    aliases: ["Kasina Dunk Low", "카시나 덩크 로우", "80's Bus"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["카시나", "kasina", "80's 버스", "80s 버스", "블루버스", "넵튠 그린", "아이언스톤"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs", "조던", "jordan",
      "짝퉁", "카피", "rep ", "replica", "fake", "11급", "ss급정품", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 300000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-travis-scott",
    brand: "Nike x Travis Scott", category: "shoe",
    modelName: "Nike SB Dunk Low Travis Scott",
    aliases: ["Travis Scott SB Dunk Low", "트래비스 스캇 덩크 로우", "트스 덩크"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["트래비스", "travis", "travis scott", "트래비스스캇", "트레비스", "cactus jack", "트스"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "조던", "jordan", "에어맥스", "에어포스", "force",
      "짝퉁", "카피", "이미테이션", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 1500000, released: 2020,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-undefeated",
    brand: "Nike x Undefeated", category: "shoe",
    modelName: "Nike x Undefeated Dunk Low SP",
    aliases: ["Undefeated Dunk Low", "언디핏 덩크 로우", "Dunk Low 5 On It"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["언디핏", "언디피티드", "undefeated", "undftd", "5 on it", "sp 5"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "조던", "jordan",
      "짝퉁", "카피", "rep ", "replica", "fake", "11급", "ss급정품", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 200000, released: 2020,
    defaultProductType: "sneaker",
  },

  // --- 1단계: Mass narrow (인기 colorway, 8~22만) ---

  {
    id: "shoe-nike-dunk-low-university-red",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low University Red (유레드)",
    aliases: ["Dunk Low University Red", "덩크 로우 유레드", "Dunk Low UR"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["유니버시티 레드", "유니버시티레드", "university red", "유레드", "u red", "팀 레드", "팀레드", "team red"],
    ],
    mustNotContain: ["sb ", "에스비",
      "짐레드", "짐 레드", "gym red",
      "챔피언쉽", "championship", "trail red",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-university-blue",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low University Blue (유블루)",
    aliases: ["Dunk Low University Blue", "덩크 로우 유블루"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["유니버시티 블루", "유니버시티블루", "university blue", "유블루"],
    ],
    mustNotContain: ["sb ", "에스비", "코스트", "coast",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-court-purple",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Court Purple (코퍼)",
    aliases: ["Dunk Low Court Purple", "덩크 로우 코퍼", "코트 퍼플"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["코트 퍼플", "코트퍼플", "court purple", "코퍼", "챔피언쉽 코트 퍼플", "championship court purple"],
    ],
    mustNotContain: ["sb ", "에스비",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-coast",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Coast (WMNS 연파랑)",
    aliases: ["Dunk Low Coast", "덩크 로우 코스트"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["코스트", "coast", "발리언트 블루"],
    ],
    mustNotContain: ["sb ", "유니버시티 블루", "university blue",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-wolf-grey",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Wolf Grey",
    aliases: ["Dunk Low Wolf Grey", "덩크 로우 울프 그레이"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["울프 그레이", "울프그레이", "wolf grey", "wolf gray"],
    ],
    mustNotContain: ["sb ", "그레이 포그", "grey fog", "smoke",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-grey-fog",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Grey Fog",
    aliases: ["Dunk Low Grey Fog", "덩크 로우 그레이 포그"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["그레이 포그", "그레이포그", "grey fog", "gray fog"],
    ],
    mustNotContain: ["sb ", "울프", "wolf", "smoke",
      "잭팟", "jackpot",  // Jackpot Grey Fog 별도
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-midnight-navy",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Midnight Navy (미네)",
    aliases: ["Dunk Low Midnight Navy", "덩크 로우 미드나잇", "미네"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["미드나잇 네이비", "미드나잇네이비", "midnight navy", "미네", "미드나잇", "midnight"],
    ],
    mustNotContain: ["sb ", "유니버시티 블루", "university blue", "컬리지", "college navy",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-chicago",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Chicago",
    aliases: ["Dunk Low Chicago", "덩크 로우 시카고"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["시카고", "chicago"],
    ],
    mustNotContain: ["sb pro", "sb 프로",  // SB Pro Chicago 별도 + 가품 위험
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-varsity-green",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Varsity Green",
    aliases: ["Dunk Low Varsity Green", "덩크 로우 바시티 그린"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["바시티 그린", "바시티그린", "varsity green"],
    ],
    mustNotContain: ["sb ", "바시티 메이즈", "varsity maize",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2021,
    defaultProductType: "sneaker",
  },

  // --- 1단계: 시즌/한정 + Silhouette 분리 ---

  {
    id: "shoe-nike-dunk-low-halloween",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Halloween (시즌 한정)",
    aliases: ["Dunk Low Halloween", "덩크 로우 할로윈"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["할로윈", "halloween", "할로원", "glow"],
    ],
    mustNotContain: ["sb ", "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-disrupt",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Disrupt (Disrupt 2 — silhouette 다름)",
    aliases: ["Dunk Low Disrupt", "덩크 로우 디스럽트", "Disrupt 2"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["디스럽트", "disrupt"],
    ],
    mustNotContain: ["sb ", "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 2020,
    defaultProductType: "sneaker",
  },

  // --- 2단계: MEDIUM narrow (5~10건/月, 매물 있음) ---

  {
    id: "shoe-nike-dunk-low-gym-red",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Gym Red (≠ University Red)",
    aliases: ["Dunk Low Gym Red", "덩크 로우 짐 레드"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["짐 레드", "짐레드", "gym red"],
    ],
    mustNotContain: ["sb ", "유니버시티 레드", "university red", "유레드",
      "키즈", "kids", "td", "gs", "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2020,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-lx",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low LX (Premium Leather/Suede)",
    aliases: ["Dunk Low LX", "덩크 로우 LX"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["lx ", "dunk lx", "덩크 lx"],
    ],
    mustNotContain: ["sb ", "키즈", "kids", "td", "gs", "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-medium-curry",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Medium Curry (커리)",
    aliases: ["Dunk Low Medium Curry", "덩크 로우 미디엄 커리"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["미디엄 커리", "미디움 커리", "medium curry", "커리", "curry"],
    ],
    mustNotContain: ["sb ", "키즈", "kids", "td", "gs", "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-smoke-grey",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Smoke Grey",
    aliases: ["Dunk Low Smoke Grey", "덩크 로우 스모크 그레이"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["스모크 그레이", "스모크그레이", "smoke grey", "smoke gray", "라이트 스모크"],
    ],
    mustNotContain: ["sb ", "울프", "wolf", "키즈", "kids", "td", "gs", "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-photon-dust",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Photon Dust",
    aliases: ["Dunk Low Photon Dust", "덩크 로우 포톤더스트"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["포톤 더스트", "포톤더스트", "photon dust", "포톤"],
    ],
    mustNotContain: ["sb ", "키즈", "kids", "td", "gs", "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-golden-road",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Golden Road",
    aliases: ["Dunk Low Golden Road", "덩크 로우 골든로드", "Championship Goldenrod"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["골든로드", "골든 로드", "golden road", "goldenrod", "챔피언쉽 골든로드"],
    ],
    mustNotContain: ["sb ", "키즈", "kids", "td", "gs", "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-varsity-maize",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Varsity Maize",
    aliases: ["Dunk Low Varsity Maize", "덩크 로우 바시티 메이즈"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["바시티 메이즈", "varsity maize"],
    ],
    mustNotContain: ["sb ", "바시티 그린", "varsity green", "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-jackpot",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Jackpot (Malachite)",
    aliases: ["Dunk Low Jackpot", "덩크 로우 잭팟", "Jackpot Malachite"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["잭팟", "jackpot", "말라카이트", "malachite"],
    ],
    mustNotContain: ["sb ", "키즈", "kids", "td", "gs", "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-paisley",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Paisley",
    aliases: ["Dunk Low Paisley", "덩크 로우 페이즐리", "Bandana"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["페이즐리", "paisley", "반다나"],
    ],
    mustNotContain: ["sb ", "발레이", "valerian", "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-zebra",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Zebra",
    aliases: ["Dunk Low Zebra", "덩크 로우 지브라"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["지브라", "zebra"],
    ],
    mustNotContain: ["sb pro", "쿼터스낵스", "quartersnacks",  // SB collab 별도
      "키즈", "kids", "td", "gs", "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 2023,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-light-bone",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Light Bone",
    aliases: ["Dunk Low Light Bone", "덩크 로우 라이트 본"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["라이트 본", "라이트본", "light bone"],
    ],
    mustNotContain: ["sb ", "키즈", "kids", "td", "gs", "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-clear-jade",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Clear Jade (코끼리덩크)",
    aliases: ["Dunk Low Clear Jade", "덩크 로우 클리어 제이드", "코끼리덩크"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["클리어 제이드", "clear jade", "코끼리", "elephant"],
    ],
    mustNotContain: ["sb ", "키즈", "kids", "td", "gs", "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-summit-white",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Summit White (Triple White)",
    aliases: ["Dunk Low Summit White", "덩크 로우 트리플 화이트", "Triple White"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["서밋 화이트", "서밋화이트", "summit white", "트리플 화이트", "triple white", "올화이트", "올 화이트"],
    ],
    mustNotContain: ["sb ", "panda", "범고래", "팬더", "판다", "blackwhite", "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-akio-pink",
    brand: "Nike", category: "shoe",
    modelName: "Nike Dunk Low Akio Pink (WMNS)",
    aliases: ["Dunk Low Akio", "덩크 로우 아키오 핑크"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["아키오", "akio"],
    ],
    mustNotContain: ["sb ", "트리플 핑크", "triple pink", "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-union",
    brand: "Nike x Union", category: "shoe",
    modelName: "Nike x Union Dunk Low (Passport Pack)",
    aliases: ["Union Dunk Low", "유니온 덩크 로우", "Passport Pack"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["유니온", "union", "패스포트 팩", "passport pack", "피스타치오"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs", "조던", "jordan",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 250000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-dunk-low-lebron-pebbles",
    brand: "Nike x LeBron", category: "shoe",
    modelName: "Nike Dunk Low LeBron James x Fruity Pebbles",
    aliases: ["LeBron Dunk Low", "르브론 덩크", "Fruity Pebbles"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["르브론", "lebron", "페블스", "pebbles", "fruity"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs", "조던", "jordan",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 200000, released: 2023,
    defaultProductType: "sneaker",
  },

  // ═══════════════════════════════════════════════════════════
  // Wave 698 (2026-05-23): NB 25 SKU 신설 (1단계 14 broad + 11 collab)
  // Agent deep sweep 3,629건 — 한국 은어 다 매핑 (문빔/씨솔트/머쉬룸/마카다미아).
  // collab 가품 위험 — ALD/CDG/Kith/Junya/Miumiu (luxury) 등 별 SKU 필수.
  // ═══════════════════════════════════════════════════════════

  // --- NB 1단계 Mass Broad 14개 ---

  {
    id: "shoe-newbalance-327-broad",
    brand: "New Balance", category: "shoe",
    modelName: "New Balance 327 (Broad — 332 매물, mass 인기)",
    aliases: ["NB 327", "뉴발란스 327", "U327", "MS327"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["327", "u327", "ms327", "wl327", "ws327"]],
    mustNotContain: ["키즈", "kids", "td", "gs", "유아", "아동",
      "casablanca", "카사블랑카", "ald", "에임", "joe freshgoods",
      "키스", "kith", "junya", "준야",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2020, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-2002r-broad",
    brand: "New Balance", category: "shoe",
    modelName: "NB 2002R (Broad — 217 매물)",
    aliases: ["NB 2002R", "뉴발란스 2002R", "M2002R"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["2002r", "2002 r"]],
    mustNotContain: ["키즈", "kids", "td", "gs", "유아", "아동",
      "ald", "에임", "kith", "키스", "고어텍스", "gore-tex",  // GTX variant 가격 다름
      "jjjjound", "자운드",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 2010, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-992",
    brand: "New Balance", category: "shoe",
    modelName: "NB 992 (Made in USA Premium, 215 매물 평균 30만)",
    aliases: ["NB 992", "뉴발란스 992"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["992"]],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "kith", "키스", "ald", "에임",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 290000, released: 2006, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-530-broad",
    brand: "New Balance", category: "shoe",
    modelName: "NB 530 (Broad — 213 매물 mass 베스트셀러)",
    aliases: ["NB 530", "뉴발란스 530", "MR530", "PZ530"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["530", "mr530", "pz530", "gr530"]],
    mustNotContain: ["키즈", "kids", "td", "gs", "유아", "아동",
      "miumiu", "미우미우", "530 sl", "530sl",  // luxury collab 별도
      "joe freshgoods",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 99000, released: 2020, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-993",
    brand: "New Balance", category: "shoe",
    modelName: "NB 993 (Made in USA, 162 매물)",
    aliases: ["NB 993", "뉴발란스 993"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["993"]],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "kith", "키스", "joe freshgoods", "ald", "에임",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 250000, released: 2008, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-1906r-broad",
    brand: "New Balance", category: "shoe",
    modelName: "NB 1906R (Broad — 신상 mass, 146 매물)",
    aliases: ["NB 1906R", "뉴발란스 1906R"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["1906r", "1906 r"]],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "1906a", "1906d",  // 다른 모델
      "cdg", "꼼데", "auralee", "오라리",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 2022, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-990v6-broad",
    brand: "New Balance", category: "shoe",
    modelName: "NB 990v6 (Made in USA 신상, 81 매물)",
    aliases: ["NB 990v6", "뉴발란스 990v6"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["990v6", "990 v6", "990v 6"]],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "990v3", "990v4", "990v5", "990v7",
      "action bronson",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 290000, released: 2022, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-991-broad",
    brand: "New Balance", category: "shoe",
    modelName: "NB 991 (Made in UK, 67 매물)",
    aliases: ["NB 991", "뉴발란스 991", "M991"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["991", "m991"]],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "kith", "키스", "stone island", "스톤아일랜드", "jjjjound", "자운드",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 230000, released: 2001, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-1906a-broad",
    brand: "New Balance", category: "shoe",
    modelName: "NB 1906A (신상 mass — 실버 메탈릭, 63 매물)",
    aliases: ["NB 1906A", "뉴발란스 1906A"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["1906a", "1906 a"]],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "1906r", "1906d",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 2024, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-1400-broad",
    brand: "New Balance", category: "shoe",
    modelName: "NB 1400 (vintage USA, 65 매물)",
    aliases: ["NB 1400", "뉴발란스 1400", "M1400"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["1400", "m1400"]],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "j.crew", "j crew", "제이크루",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 219000, released: 1994, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-1300-broad",
    brand: "New Balance", category: "shoe",
    modelName: "NB 1300 (vintage USA, 61 매물 평균 27만)",
    aliases: ["NB 1300", "뉴발란스 1300"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["1300", "m1300"]],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "ald", "에임", "kith", "키스",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 350000, released: 1985, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-1600-broad",
    brand: "New Balance", category: "shoe",
    modelName: "NB 1600 (vintage USA mass, 61 매물)",
    aliases: ["NB 1600", "뉴발란스 1600", "CM1600"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["1600", "cm1600"]],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 2002, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-1500-broad",
    brand: "New Balance", category: "shoe",
    modelName: "NB 1500 (Made in UK, 56 매물)",
    aliases: ["NB 1500", "뉴발란스 1500", "M1500"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["1500", "m1500"]],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 219000, released: 1989, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-550-broad",
    brand: "New Balance", category: "shoe",
    modelName: "NB 550 (농구 retro, 29 매물)",
    aliases: ["NB 550", "뉴발란스 550", "BB550"],
    mustContain: [["뉴발란스", "뉴발", "new balance", "newbalance", "nb"], ["550", "bb550"]],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "ald", "에임", "district vision", "디스트릭트", "joe freshgoods",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 1989, defaultProductType: "sneaker",
  },

  // --- NB 1단계 COLLAB 11개 (가품 위험 큼) ---

  {
    id: "shoe-newbalance-aime-leon-dore-collab",
    brand: "NB x Aimé Leon Dore", category: "shoe",
    modelName: "NB x ALD Collab (1300/990/993/550/860v2/475)",
    aliases: ["NB ALD", "뉴발 에임레온도르"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "newbalance", "nb"],
      ["에임 레온 도르", "에임레온도르", "에메레온도르", "aime leon dore", "aimé leon dore", "ald"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 280000, released: 2020, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-cdg-collab",
    brand: "NB x CDG", category: "shoe",
    modelName: "NB x Comme des Garcons Collab (1906R/574/610/509/2010)",
    aliases: ["NB CDG", "꼼데가르송 뉴발란스"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "newbalance", "nb"],
      ["꼼데가르송", "꼼데 가르송", "comme des garcons", "cdg", "꼼데 준야", "junya"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 350000, released: 2022, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-kith-collab",
    brand: "NB x Kith", category: "shoe",
    modelName: "NB x Kith Collab (990v4/991v2/992/993/1300/2010)",
    aliases: ["NB Kith", "키스 뉴발란스"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "newbalance", "nb"],
      ["키스", "kith"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs", "skirt", "스커트",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 380000, released: 2022, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-junya-watanabe-collab",
    brand: "NB x Junya Watanabe", category: "shoe",
    modelName: "NB x Junya Watanabe Collab (574/471/480/AM574)",
    aliases: ["NB Junya", "준야 와타나베 뉴발란스"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "newbalance", "nb"],
      ["준야", "junya", "와타나베", "watanabe"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 350000, released: 2020, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-auralee-collab",
    brand: "NB x Auralee", category: "shoe",
    modelName: "NB x Auralee Collab (990v4/1906R/475/XC-72/WRPD)",
    aliases: ["NB Auralee", "오라리 뉴발란스"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "newbalance", "nb"],
      ["오라리", "auralee"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 320000, released: 2022, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-stone-island-collab",
    brand: "NB x Stone Island", category: "shoe",
    modelName: "NB x Stone Island Collab (991v2/574)",
    aliases: ["NB Stone Island", "스톤아일랜드 뉴발란스"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "newbalance", "nb"],
      ["스톤아일랜드", "스톤 아일랜드", "stone island", "stone-island"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 400000, released: 2022, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-miumiu-collab",
    brand: "NB x Miu Miu", category: "shoe",
    modelName: "NB x Miu Miu Collab (530 SL/442) — luxury 가품 폭탄",
    aliases: ["NB Miu Miu", "미우미우 뉴발란스"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "newbalance", "nb"],
      ["미우미우", "miumiu", "miu miu"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1", "미러", "복각",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 800000, released: 2023, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-jjjjound-collab",
    brand: "NB x JJJJound", category: "shoe",
    modelName: "NB x JJJJound Collab (990v3/v4/991/2002R Gore-Tex)",
    aliases: ["NB JJJJound", "자운드 뉴발란스"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "newbalance", "nb"],
      ["자운드", "jjjjound"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 450000, released: 2021, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-jcrew-collab",
    brand: "NB x J.Crew", category: "shoe",
    modelName: "NB x J.Crew Collab (1400)",
    aliases: ["NB J.Crew", "제이크루 뉴발란스"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "newbalance", "nb"],
      ["제이크루", "j.crew", "j crew", "jcrew"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 220000, released: 2018, defaultProductType: "sneaker",
  },

  {
    id: "shoe-newbalance-casablanca-collab",
    brand: "NB x Casablanca", category: "shoe",
    modelName: "NB x Casablanca Collab (327)",
    aliases: ["NB Casablanca", "카사블랑카 뉴발란스"],
    mustContain: [
      ["뉴발란스", "뉴발", "new balance", "newbalance", "nb"],
      ["카사블랑카", "casablanca"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 200000, released: 2021, defaultProductType: "sneaker",
  },

  // shoe-newbalance-levis-collab는 catalog-shoe-wave91.ts에 이미 있음 — 별 추가 X

  // ═══════════════════════════════════════════════════════════
  // Wave 700 (2026-05-23): Puma 4 broad 신설 (Speedcat/Palermo/Suede/Clyde)
  // 사용자 인용 분석 — Puma 460 매물/월, 매칭률 65%, Speedcat/Palermo catalog 부재.
  // ═══════════════════════════════════════════════════════════

  {
    id: "shoe-puma-speedcat-broad",
    brand: "Puma", category: "shoe",
    modelName: "Puma Speedcat (OG / Open YY collab broad)",
    aliases: ["Puma Speedcat", "푸마 스피드캣"],
    mustContain: [["puma", "푸마"], ["speedcat", "스피드캣", "스피드 캣", "speed cat"]],
    mustNotContain: ["키즈", "kids", "td", "gs", "유아", "아동",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 99000, released: 2024, defaultProductType: "sneaker",
  },

  {
    id: "shoe-puma-palermo-broad",
    brand: "Puma", category: "shoe",
    modelName: "Puma Palermo (Elevata / OG broad)",
    aliases: ["Puma Palermo", "푸마 팔레르모"],
    mustContain: [["puma", "푸마"], ["palermo", "팔레르모"]],
    mustNotContain: ["키즈", "kids", "td", "gs", "유아", "아동",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 99000, released: 2024, defaultProductType: "sneaker",
  },

  {
    id: "shoe-puma-suede-broad",
    brand: "Puma", category: "shoe",
    modelName: "Puma Suede (Classic broad)",
    aliases: ["Puma Suede", "푸마 스웨이드"],
    mustContain: [["puma", "푸마"], ["suede", "스웨이드"]],
    mustNotContain: ["키즈", "kids", "td", "gs", "유아", "아동",
      "rhuigi", "ruyy",
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 89000, released: 1968, defaultProductType: "sneaker",
  },

  {
    id: "shoe-puma-clyde-broad",
    brand: "Puma", category: "shoe",
    modelName: "Puma Clyde (Classic broad)",
    aliases: ["Puma Clyde", "푸마 클라이드"],
    mustContain: [["puma", "푸마"], ["clyde", "클라이드"]],
    mustNotContain: ["키즈", "kids", "td", "gs", "유아", "아동",
      "atelier de copine",  // collab 별도
      "짝퉁", "rep ", "replica", "fake", "11급", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 89000, released: 1973, defaultProductType: "sneaker",
  },

  // ═══════════════════════════════════════════════════════════
  // Wave 696 (2026-05-23): AF1 + Air Max 1단계 22 SKU 신설
  // Agent deep sweep — AF1 960건 (기존 3 → 53 후보), Air Max 1476건 (기존 5 → 23 후보).
  // Pareto 80% 흡수 (1단계).
  // ═══════════════════════════════════════════════════════════

  // --- AF1 1단계 — Mass narrow 7개 ---

  {
    id: "shoe-nike-airforce-1-low-triple-white",
    brand: "Nike", category: "shoe",
    modelName: "Air Force 1 Low Triple White (트화/올화)",
    aliases: ["AF1 Low Triple White", "에어포스1 트리플 화이트", "트화"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1", "에어 포스 1"],
      ["트리플 화이트", "트리플화이트", "triple white", "트화", "올화", "흰포스", "올 화이트", "white/white"],
    ],
    mustNotContain: ["mid", "미드", "high", "하이",
      "트리플 블랙", "트블", "올블", "supreme", "슈프림", "오프화이트", "off-white",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 1982,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-airforce-1-low-triple-black",
    brand: "Nike", category: "shoe",
    modelName: "Air Force 1 Low Triple Black (트블/올블/올검)",
    aliases: ["AF1 Low Triple Black", "에어포스1 트리플 블랙", "트블"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1"],
      ["트리플 블랙", "트리플블랙", "triple black", "트블", "올블", "올검", "검포스", "올검포스", "black/black"],
    ],
    mustNotContain: ["mid", "미드", "high", "하이",
      "트리플 화이트", "트화", "올화", "supreme", "슈프림", "오프화이트", "off-white", "스투시", "stussy",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 1982,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-airforce-1-low-black-white",
    brand: "Nike", category: "shoe",
    modelName: "Air Force 1 Low Black/White (Two-tone)",
    aliases: ["AF1 Low Black White", "에어포스1 블랙 화이트"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1"],
      ["블랙/화이트", "블랙 화이트", "흰검", "black/white", "white/black", "black white"],
    ],
    mustNotContain: ["mid", "미드", "high", "하이",
      "트리플", "올블", "올화", "supreme", "슈프림",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 1982,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-airforce-1-mid-07",
    brand: "Nike", category: "shoe",
    modelName: "Air Force 1 Mid '07 (Black/White/Triple)",
    aliases: ["AF1 Mid 07", "에어포스1 미드 07"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1"],
      ["미드", "mid", "07", "'07"],
    ],
    mustNotContain: ["low", "로우", "high", "하이",
      "supreme", "슈프림", "오프화이트", "off-white", "스투시", "stussy",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 2007,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-airforce-1-low-shadow",
    brand: "Nike", category: "shoe",
    modelName: "Air Force 1 Low Shadow (WMNS)",
    aliases: ["AF1 Low Shadow", "에어포스1 섀도우"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1"],
      ["섀도", "쉐도", "쉐도우", "shadow"],
    ],
    mustNotContain: ["mid", "미드", "high", "하이",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 2020,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-airforce-1-low-goretex",
    brand: "Nike", category: "shoe",
    modelName: "Air Force 1 Low Gore-Tex",
    aliases: ["AF1 Low Gore-Tex", "에어포스1 고어텍스", "고어텍스포스"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1"],
      ["고어텍스", "gore-tex", "goretex"],
    ],
    mustNotContain: ["mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 199000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-airforce-1-low-wheat",
    brand: "Nike", category: "shoe",
    modelName: "Air Force 1 Low Wheat / Khaki (된장포스)",
    aliases: ["AF1 Low Wheat", "에어포스1 휘트", "된장포스"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1"],
      ["휘트", "wheat", "카키", "khaki", "올리브", "olive", "된장포스"],
    ],
    mustNotContain: ["mid", "미드", "high", "하이",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 2022,
    defaultProductType: "sneaker",
  },

  // --- AF1 1단계 COLLAB 6개 (가품 위험 큼) ---

  {
    id: "shoe-gdragon-airforce1-paranoise",
    brand: "Nike x Peaceminusone (GD)", category: "shoe",
    modelName: "Air Force 1 Paranoise (지디 콜라보 — 한국 핵심)",
    aliases: ["AF1 Paranoise", "에어포스1 파라노이즈", "피마원", "지디포스"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1"],
      ["피마원", "피스마이너스원", "paranoise", "파라노이즈", "지디", "지드래곤", "peaceminusone"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 290000, released: 2019,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-stussy-airforce1-collab",
    brand: "Nike x Stussy", category: "shoe",
    modelName: "Air Force 1 Stussy Collab",
    aliases: ["AF1 Stussy", "에어포스1 스투시"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1"],
      ["스투시", "stussy", "스튜시"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 200000, released: 2020,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-offwhite-airforce1-collab",
    brand: "Nike x Off-White", category: "shoe",
    modelName: "Air Force 1 Off-White (Brooklyn/MoMA/Lemonade)",
    aliases: ["AF1 Off-White", "에어포스1 오프화이트"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1"],
      ["오프화이트", "off-white", "off white", "offwhite", "버질", "virgil", "moma", "brooklyn", "lemonade"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 800000, released: 2017,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-ambush-airforce1-collab",
    brand: "Nike x AMBUSH", category: "shoe",
    modelName: "Air Force 1 AMBUSH Collab",
    aliases: ["AF1 AMBUSH", "에어포스1 앰부쉬"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1"],
      ["앰부쉬", "엠부쉬", "ambush"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 250000, released: 2020,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-tiffany-airforce1-collab",
    brand: "Nike x Tiffany", category: "shoe",
    modelName: "Air Force 1 Tiffany & Co. (가품 위험 매우 큼)",
    aliases: ["AF1 Tiffany", "에어포스1 티파니"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1"],
      ["티파니", "tiffany"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 700000, released: 2023,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-louis-vuitton-airforce1-virgil",
    brand: "Nike x Louis Vuitton", category: "shoe",
    modelName: "Air Force 1 Louis Vuitton x Virgil Abloh (luxury 가품 폭탄)",
    aliases: ["AF1 LV", "에어포스1 루이비통"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1"],
      ["루이비통", "louis vuitton", "lv", "버질 아블로", "virgil abloh"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러", "복각",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 2500000, released: 2022,
    defaultProductType: "sneaker",
  },

  // --- Air Max 1단계 — Generation broad 4개 ---

  {
    id: "shoe-nike-airmax-plus-tn-broad",
    brand: "Nike", category: "shoe",
    modelName: "Air Max Plus / TN (Broad — 에맥 플러스/TN)",
    aliases: ["Air Max Plus", "Air Max TN", "에어맥스 플러스", "에맥 플러스"],
    // 주의: "플러스" 단독 매칭 금지 (갤럭시/아이폰/꼼데 옴므플러스 false positive).
    // mustContain에 "에어맥스 플러스" 또는 "TN" 동반 강제.
    mustContain: [
      ["에어맥스 플러스", "에어맥스플러스", "에어 맥스 플러스", "air max plus", "airmax plus",
       "에어맥스 tn", "에어맥스tn", "air max tn", "airmax tn", "am tn", "am plus"],
    ],
    mustNotContain: ["supreme", "슈프림", "nocta", "녹타", "drake", "드레이크",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 199000, released: 1998,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-airmax-dn-broad",
    brand: "Nike", category: "shoe",
    modelName: "Air Max DN / DN8 (Broad — 2024 신모델)",
    aliases: ["Air Max DN", "Air Max DN8", "에어맥스 DN"],
    mustContain: [
      ["에어맥스 dn", "에어맥스dn", "air max dn", "airmax dn", "에어맥스 dn8", "airmax dn8", "am dn"],
    ],
    mustNotContain: ["supreme", "슈프림", "palace", "팰리스",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 199000, released: 2024,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-airmax-270-broad",
    brand: "Nike", category: "shoe",
    modelName: "Air Max 270 (Broad)",
    aliases: ["Air Max 270", "에어맥스 270", "AM270"],
    mustContain: [
      ["에어맥스 270", "에어맥스270", "air max 270", "airmax 270", "am270", "에맥 270"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 199000, released: 2018,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-airmax-98-broad",
    brand: "Nike", category: "shoe",
    modelName: "Air Max 98 (Broad)",
    aliases: ["Air Max 98", "에어맥스 98", "AM98"],
    mustContain: [
      ["에어맥스 98", "에어맥스98", "air max 98", "airmax 98", "am98"],
    ],
    mustNotContain: ["supreme", "슈프림", "tailwind",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 219000, released: 1998,
    defaultProductType: "sneaker",
  },

  // --- Air Max 1단계 COLLAB 4개 ---

  {
    id: "shoe-kasina-airmax-1-sp",
    brand: "Nike x Kasina", category: "shoe",
    modelName: "Air Max 1 SP Kasina (원앙)",
    aliases: ["AM1 Kasina", "카시나 에어맥스", "원앙 에어맥스"],
    mustContain: [
      ["에어맥스 1", "에어맥스1", "air max 1", "airmax 1", "am1"],
      ["카시나", "kasina", "원앙"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 200000, released: 2023,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-cdg-nike-airmax-collab",
    brand: "Nike x CDG", category: "shoe",
    modelName: "Air Max CDG Collab (premium — 가품 위험)",
    aliases: ["Air Max CDG", "꼼데가르송 에어맥스"],
    mustContain: [
      ["에어맥스", "air max", "airmax"],
      ["꼼데가르송", "cdg", "꼼데", "comme des garcons", "옴므플러스"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 500000, released: 2020,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-travis-nike-airmax-1",
    brand: "Nike x Travis Scott", category: "shoe",
    modelName: "Air Max 1 Travis Scott (Cactus Jack/Wheat)",
    aliases: ["AM1 Travis", "에어맥스1 트래비스"],
    mustContain: [
      ["에어맥스 1", "에어맥스1", "air max 1", "airmax 1", "am1"],
      ["트래비스", "travis", "스캇", "scott", "cactus jack", "와트", "wheat"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 300000, released: 2023,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-offwhite-nike-airmax-collab",
    brand: "Nike x Off-White", category: "shoe",
    modelName: "Air Max Off-White (90 The Ten / 97)",
    aliases: ["Air Max Off-White", "에어맥스 오프화이트"],
    mustContain: [
      ["에어맥스", "air max", "airmax"],
      ["오프화이트", "off-white", "off white", "offwhite", "버질", "virgil", "더 텐", "the ten"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 800000, released: 2017,
    defaultProductType: "sneaker",
  },

  // ═══════════════════════════════════════════════════════════
  // Wave 695 (2026-05-23): AJ1 30 narrow SKU 신설 (1단계 17 + 2단계 13)
  // Agent deep sweep (1500건 raw, 22.3% colorway 미기재) — 45+ SKU 확장.
  // 가품 위험 매우 큼 — collab 별 SKU 분리 + broad mustNotContain 강력 차단.
  // ═══════════════════════════════════════════════════════════

  // --- AJ1 1단계 COLLAB 7개 (가품 위험 매우 큼, 가격 spread 큼) ---

  {
    id: "shoe-nike-jordan-1-low-cactus-jack-olive",
    brand: "Nike x Travis Scott", category: "shoe",
    modelName: "AJ1 Low x Travis Scott Cactus Jack Olive",
    aliases: ["AJ1 Low Olive", "트래비스 카나리 올리브", "Cactus Jack Olive"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1", "에어조던 1"],
      ["로우", "low"],
      ["트래비스", "travis", "스캇", "scott", "트스", "cactus jack"],
      ["올리브", "olive", "카나리", "canary"],
    ],
    mustNotContain: ["모카", "mocha", "팬텀", "phantom", "리저록", "reservoir",
      "fragment", "프라그", "high", "하이", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 250000, released: 2024,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-low-travis-phantom",
    brand: "Nike x Travis Scott", category: "shoe",
    modelName: "AJ1 Low x Travis Scott Phantom",
    aliases: ["AJ1 Low Phantom", "트래비스 팬텀", "Black Phantom"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1", "에어조던 1"],
      ["로우", "low"],
      ["트래비스", "travis", "스캇", "scott", "트스"],
      ["팬텀", "phantom", "블랙 팬텀", "black phantom"],
    ],
    mustNotContain: ["모카", "mocha", "올리브", "olive", "카나리", "canary",
      "fragment", "프라그", "리저록", "reservoir",
      "high", "하이", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 250000, released: 2024,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-low-fragment",
    brand: "Nike x Fragment", category: "shoe",
    modelName: "AJ1 Low Fragment (Black/Royal)",
    aliases: ["AJ1 Low Fragment", "프라그먼트 AJ1 Low"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["로우", "low"],
      ["프라그먼트", "프래그먼트", "fragment", "프라그", "히로시", "후지와라"],
    ],
    mustNotContain: ["travis", "트래비스", "스캇", "trasvis", "scott", "트스", "밀리터리 블루", "military blue",
      "high", "하이", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 200000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-low-fragment-travis-military-blue",
    brand: "Nike x Fragment x Travis Scott", category: "shoe",
    modelName: "AJ1 Low Fragment x Travis Military Blue (highest tier)",
    aliases: ["AJ1 Low Fragment Travis Military Blue", "프라그 트스 밀리터리"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["로우", "low"],
      ["프라그먼트", "fragment", "프라그"],
      ["트래비스", "travis", "스캇", "scott", "트스"],
      ["밀리터리 블루", "military blue", "밀리터리"],
    ],
    mustNotContain: ["high", "하이", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 269000, released: 2025,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-union-la",
    brand: "Nike x Union LA", category: "shoe",
    modelName: "AJ1 High Union LA",
    aliases: ["AJ1 High Union LA", "유니온 AJ1 High"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["유니온", "union", "union la"],
    ],
    mustNotContain: ["low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 250000, released: 2018,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-off-white",
    brand: "Nike x Off-White", category: "shoe",
    modelName: "AJ1 High Off-White (Chicago/UNC/White/Royal)",
    aliases: ["AJ1 High Off-White", "오프화이트 AJ1"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["오프화이트", "off-white", "off white", "오화", "virgil", "버질"],
    ],
    mustNotContain: ["low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 1500000, released: 2017,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-alaska-vaa",
    brand: "Nike VAA", category: "shoe",
    modelName: "AJ1 High Alaska VAA (Vibram)",
    aliases: ["AJ1 High Alaska", "알래스카 AJ1", "VAA"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["알래스카", "alaska", "vaa", "vibram", "비브람"],
    ],
    mustNotContain: ["low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 600000, released: 2024,
    defaultProductType: "sneaker",
  },

  // --- AJ1 1단계 Mass narrow 10개 (인기 colorway 10~25 매물) ---

  {
    id: "shoe-nike-jordan-1-high-dark-mocha",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 High Dark Mocha",
    aliases: ["AJ1 High Dark Mocha", "다크 모카"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["다크 모카", "다크모카", "dark mocha", "블랙 모카", "black mocha"],
    ],
    mustNotContain: ["travis", "트래비스", "스캇", "scott", "트스",
      "리버스 모카", "reverse mocha",
      "low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 189000, released: 2020,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-hyper-royal",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 High Hyper Royal",
    aliases: ["AJ1 High Hyper Royal", "하이퍼 로얄"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["하이퍼 로얄", "하이퍼로얄", "hyper royal", "하이퍼 로열"],
    ],
    mustNotContain: ["royal blue", "로얄 블루", "로열 블루",
      "low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 189000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-shattered-backboard",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 High Shattered Backboard (SBB)",
    aliases: ["AJ1 High SBB", "Shattered Backboard", "백보드", "백보드 3.0"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["sbb", "shattered backboard", "백보드"],
    ],
    mustNotContain: ["low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 199000, released: 2015,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-killer-whale",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 High Killer Whale (범고래)",
    aliases: ["AJ1 High Killer Whale", "조던 1 범고래"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["범고래", "killer whale"],
    ],
    mustNotContain: ["덩크", "dunk",  // dunk panda는 별 SKU
      "low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 189000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-latushi-pearl",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 High Latushi (Pearl Pink — Korea 명칭)",
    aliases: ["AJ1 High Latushi", "라투시"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["라투시", "latushi"],
    ],
    mustNotContain: ["low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 200000, released: 2024,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-black-toe",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 High Black Toe",
    aliases: ["AJ1 High Black Toe", "블랙 토"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["블랙 토", "블랙토", "black toe"],
    ],
    mustNotContain: ["low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 189000, released: 1985,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-low-starfish",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 Low Starfish",
    aliases: ["AJ1 Low Starfish", "스타피쉬"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["로우", "low"],
      ["스타피쉬", "스타피시", "starfish"],
    ],
    mustNotContain: ["high", "하이", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-mid-grey-fog-w",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 Mid Grey Fog (WMNS)",
    aliases: ["AJ1 Mid Grey Fog W", "그레이 포그 미드 우먼스"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["미드", "mid"],
      ["그레이 포그", "그레이포그", "grey fog", "gray fog"],
    ],
    mustNotContain: ["덩크", "dunk", "high", "하이", "low", "로우",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-mid-midnight-navy-cojp",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 Mid Midnight Navy CO.JP (Japan exclusive)",
    aliases: ["AJ1 Mid Midnight Navy", "미드나잇 네이비 미드", "CO.JP"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["미드", "mid"],
      ["미드나잇 네이비", "미드나잇네이비", "midnight navy", "co.jp", "cojp"],
    ],
    mustNotContain: ["덩크", "dunk", "high", "하이", "low", "로우",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 2020,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-low-magpie-snkrs-korea",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 Low Magpie (까치 — SNKRS Day Korea)",
    aliases: ["AJ1 Low Magpie", "까치 조던", "SNKRS Day Korea"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["로우", "low"],
      ["까치", "magpie", "snkrs day"],
    ],
    mustNotContain: ["high", "하이", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 189000, released: 2023,
    defaultProductType: "sneaker",
  },

  // --- AJ1 2단계 Mass narrow (5~10 매물) ---

  {
    id: "shoe-nike-jordan-1-high-court-purple",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 High Court Purple",
    aliases: ["AJ1 High Court Purple", "코트 퍼플"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["코트 퍼플", "코트퍼플", "court purple"],
    ],
    mustNotContain: ["덩크", "dunk", "low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 189000, released: 2018,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-pine-green",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 High Pine Green",
    aliases: ["AJ1 High Pine Green", "파인 그린"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["파인 그린", "파인그린", "pine green"],
    ],
    mustNotContain: ["오프화이트", "off-white",  // OW collab 별도
      "low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 189000, released: 2018,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-lucky-green",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 High Lucky Green",
    aliases: ["AJ1 High Lucky Green", "럭키 그린"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["럭키 그린", "럭키그린", "lucky green"],
    ],
    mustNotContain: ["파인 그린", "pine green",
      "low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 189000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-obsidian",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 High Obsidian",
    aliases: ["AJ1 High Obsidian", "옵시디언"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["옵시디언", "obsidian"],
    ],
    mustNotContain: ["low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 189000, released: 2019,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-yellow-toe-taxi",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 High Yellow Toe (Taxi)",
    aliases: ["AJ1 High Yellow Toe", "옐로 토", "택시"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["옐로 토", "옐로토", "yellow toe", "택시", "taxi"],
    ],
    mustNotContain: ["low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 2020,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-bordeaux",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 High Bordeaux",
    aliases: ["AJ1 High Bordeaux", "보르도"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["보르도", "bordeaux"],
    ],
    mustNotContain: ["low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 199000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-patent-bred",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 High Patent Bred",
    aliases: ["AJ1 High Patent Bred", "패턴트 브레드"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["패턴트 브레드", "패턴트브레드", "patent bred"],
    ],
    mustNotContain: ["low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 199000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-mid-smoke-grey",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 Mid Smoke Grey (Light Smoke Grey 통합)",
    aliases: ["AJ1 Mid Smoke Grey", "스모크 그레이", "Light Smoke Grey"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["미드", "mid"],
      ["스모크 그레이", "스모크그레이", "smoke grey", "smoke gray", "라이트 스모크", "light smoke"],
    ],
    mustNotContain: ["덩크", "dunk", "high", "하이", "low", "로우",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 159000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-low-wolf-grey",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 Low Wolf Grey",
    aliases: ["AJ1 Low Wolf Grey", "울프 그레이 Low"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["로우", "low"],
      ["울프 그레이", "울프그레이", "wolf grey", "wolf gray"],
    ],
    mustNotContain: ["덩크", "dunk", "스모크", "smoke",
      "high", "하이", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-low-tokyo-gyokuro",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 Low Tokyo Gyokuro",
    aliases: ["AJ1 Low Tokyo", "도쿄", "교쿠로"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["로우", "low"],
      ["도쿄", "토쿄", "tokyo", "교쿠로", "gyokuro"],
    ],
    mustNotContain: ["high", "하이", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 139000, released: 2022,
    defaultProductType: "sneaker",
  },

  // --- Collab 2단계 ---

  {
    id: "shoe-nike-jordan-1-low-nigel-sylvester",
    brand: "Nike x Nigel Sylvester", category: "shoe",
    modelName: "AJ1 Low Nigel Sylvester",
    aliases: ["AJ1 Low Nigel", "나이젤"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["로우", "low"],
      ["나이젤", "nigel"],
    ],
    mustNotContain: ["high", "하이", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 200000, released: 2023,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-low-zion-williamson",
    brand: "Nike x Zion", category: "shoe",
    modelName: "AJ1 Low Zion Williamson",
    aliases: ["AJ1 Low Zion", "자이언"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["로우", "low"],
      ["자이언", "zion"],
    ],
    mustNotContain: ["high", "하이", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 220000, released: 2022,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-high-trophy-room",
    brand: "Nike x Trophy Room", category: "shoe",
    modelName: "AJ1 High Trophy Room",
    aliases: ["AJ1 High Trophy Room", "트로피 룸"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["하이", "high"],
      ["트로피 룸", "trophy room"],
    ],
    mustNotContain: ["low", "로우", "mid", "미드",
      "키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 300000, released: 2021,
    defaultProductType: "sneaker",
  },

  // --- AJ1 silhouette variant ---

  {
    id: "shoe-nike-jordan-1-element-goretex",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 Element Gore-Tex (silhouette variant)",
    aliases: ["AJ1 Element", "엘리먼트", "고어텍스 조던"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["엘리먼트", "element", "고어텍스", "gore-tex", "goretex"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 220000, released: 2021,
    defaultProductType: "sneaker",
  },

  {
    id: "shoe-nike-jordan-1-zoom-comfort",
    brand: "Nike", category: "shoe",
    modelName: "AJ1 Zoom Comfort CMFT (silhouette variant)",
    aliases: ["AJ1 Zoom Comfort", "줌 컴포트", "CMFT"],
    mustContain: [
      ["조던 1", "조던1", "jordan 1", "aj1"],
      ["줌 컴포트", "줌컴포트", "zoom comfort", "cmft"],
    ],
    mustNotContain: ["키즈", "kids", "td", "gs",
      "짝퉁", "rep ", "replica", "fake", "11급",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입"],
    msrpKrw: 199000, released: 2020,
    defaultProductType: "sneaker",
  },

  // --- SB Pro broad (silhouette 분리 — 일반 Dunk Low와 별도 ecosystem) ---
  {
    id: "shoe-nike-sb-dunk-low-broad",
    brand: "Nike SB", category: "shoe",
    modelName: "Nike SB Dunk Low Pro (Broad — 일반 colorway, collab 별도)",
    aliases: ["Nike SB Dunk Low", "SB 덩크 로우", "SB Pro Dunk Low"],
    mustContain: [
      ["sb 덩크 로우", "sb 덩크로우", "sb dunk low", "에스비 덩크 로우", "에스비덩크로우", "nike sb dunk"],
    ],
    mustNotContain: [
      // 일반 Dunk Low와 분리
      // collab (가품 위험 매우 큼)
      "travis", "트래비스", "오프화이트", "off-white", "off white",
      "supreme", "슈프림", "ramellzee", "라멜지",
      "concepts", "콘셉트", "lobster", "랍스터",
      "stussy", "스투시", "civilist", "시빌리스트",
      "chunky dunky", "청키 덩키", "ben jerry", "벤앤제리",
      "stranglove", "strangelove", "스트레인지러브",
      "born x raised", "bxr", "born raised",
      "yuto", "호리고메", "헤일리", "hayley",
      "albino", "알비노", "프레토", "pretto",
      "쿼터스낵스", "quartersnacks", "나헌터스",
      "아츠-렉", "art-rec", "트럭잇", "truck it",
      "파워퍼프", "powerpuff", "패리스 괴벨",
      "j balvin", "jbalvin", "발빈",
      "패리스 괴벨", "paris goebel",
      "한정판", "limited edition", "sp ",
      // 일반 차단
      "키즈", "kids", "td", "gs", "유아", "아동",
      "짝퉁", "rep ", "replica", "fake", "11급", "ss급정품", "1:1", "미러",
      "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 159000, released: 2002,
    defaultProductType: "sneaker",
  },
];
