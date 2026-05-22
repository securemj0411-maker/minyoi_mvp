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
    modelName: "Nike Dunk Low (Standard Colors)",
    aliases: ["덩크 로우", "Dunk Low"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low"],
      ["nike", "나이키", "정품", "retail"],
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
];
