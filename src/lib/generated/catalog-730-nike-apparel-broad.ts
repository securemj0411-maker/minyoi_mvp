import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 730 (2026-05-24): Nike apparel broad SKU 신설.
//
// Pareto 분석:
//  - Nike 9,522건 unmatched 중 95%는 shoe noise (Air Max/Cortez/Dunk 등이 brand bucket에 잡힘)
//  - 실 apparel unmatched 326건 (last 14 days, 30-300k, apparel signal only)
//
// 발견: Nike apparel broad SKU가 거의 없음 (nike_fog_apparel_collab만 존재).
//      → 일반 Nike 후드/맨투맨/반팔/윈드러너/Dri-FIT 매물은 sku_id NULL 기본값.
//
// 신설 SKU 5:
//  1. nike_dri_fit_therma_broad (52건 / p50 50k) — 트레이닝웨어
//  2. nike_windbreaker_broad (47건 / p50 60k) — 윈드러너/바람막이 broad (시그니처 tech_fleece 별도)
//  3. nike_hoodie_sweat_broad (36건 / p50 50k) — 후드/맨투맨/크루넥
//  4. nike_tee_broad (23건 / p50 60k) — 반팔티 broad
//  5. nike_pants_shorts_broad (16건 / p50 117k) — 카고/조거/트랙팬츠
//
// Skip (별 cycle):
//  - Nike Golf 53건 → Wave 727 골프 cycle에 추가 (별도)
//  - Stussy collab 51건 leak → Wave 731 stussy_nike_collab leak fix
//  - 기타 collab 19건 (Sacai/CDG/언더커버) → 별 narrow
//  - Tech Fleece signature 4건 → tech_fleece premium SKU 별 신설
//
// 정책:
//  - Nike는 일반 brand (사용자 정책 "일반인 친화" 부합)
//  - 가격대 50-117k (5만-12만) 친화적
//  - shoe/bag/cap 강력 차단 (제목 noise 매우 많음)
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
  "일괄", "벌크",
] as const;

// Nike 신발 모델 (extensive — Nike apparel 제목에 절대 안 나옴)
const NIKE_SHOE_NOISE = [
  // Air Max 시리즈
  "에어맥스", "air max", "에어 맥스", "에어맥스90", "에어맥스95", "에어맥스97",
  "airmax", "에어맥스1",
  // Air Force
  "에어포스", "air force", "에어 포스", "af1",
  // Jordan
  "조던", "jordan", "aj1", "aj3", "aj4", "aj11", "aj13", "에어조던",
  // Dunk
  "덩크", "dunk", "sb dunk", "덩크로우", "덩크 로우", "덩크하이",
  // Blazer
  "블레이저", "blazer",
  // Cortez
  "코르테즈", "cortez",
  // 기타
  "페가수스", "pegasus", "vapormax", "베이퍼맥스", "샥스", "shox",
  "킬샷", "killshot", "samba", "kobe", "코비", "르브론",
  "줌", "zoom", "프리덤", "freedom", "에어 줌", "p-6000", "v2k",
  "valiant", "발리언트", "프레스토", "presto",
  // Football/Soccer
  "축구화", "풋살화", "팬텀", "phantom", "티엠포", "tiempo", "엘리트",
  "머큐리얼", "mercurial",
  // Hiking/Boot
  "부츠", "트레일", "trail", "와플",
  // Slide/sandal
  "샌들", "sandal", "슬리퍼", "slipper", "슬라이드", "slide",
  "베네시", "benassi",
  // 일반 신발 단어
  "운동화", "스니커즈", "shoes", "shoe", "스니커",
  // 사이즈 표기 (신발 = 220mm/250mm/280mm)
  "220mm", "230mm", "240mm", "250mm", "260mm", "270mm", "280mm", "290mm",
] as const;

const NIKE_NON_APPAREL = [
  // 가방/액세서리
  "가방", "bag", "백팩", "토트", "크로스백", "메신저", "더플",
  "지갑", "wallet", "파우치",
  "모자", "캡 ", "캡)", " cap", " cap ", "헬멧",
  "양말", "socks", "사물함", "헤드밴드",
  // 시계
  "시계", "watch", "워치",
  // 기타
  "스티커", "패치", "키링",
  // Nike 비-스포츠웨어
  "수영복", "swim", "스윔",
  "비치 타올", "타올", "towel",
] as const;

export const WAVE_730_NIKE_APPAREL_BROAD: Sku[] = [
  // ─── Nike Dri-FIT / Therma Training Apparel Broad (52건 / p50 50k) ───
  {
    id: "clothing-nike-dri-fit-therma",
    brand: "Nike", category: "clothing", laneKey: "nike_dri_fit_therma_broad",
    modelName: "Nike Dri-FIT / Therma Training Apparel (Broad)",
    aliases: ["Nike Dri-FIT", "나이키 드라이핏", "Nike Therma", "나이키 써마"],
    mustContain: [
      ["nike", "나이키"],
      ["dri-fit", "drifit", "드라이핏", "드라이 핏",
       "therma", "써마", "테크니컬", "technical",
       "기능성", "쿨", "냉감"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NIKE_SHOE_NOISE, ...NIKE_NON_APPAREL,
      // 골프 별 cycle
      "골프", "golf", "골프복",
      // collab 별 cycle
      "stussy", "스투시", "나투시",
      "꼼데", "comme", "준야", "junya",
      "fear of god", "fog", "피어오브갓",
      "sacai", "사카이", "off-white", "오프화이트",
      "louis vuitton", "루이비통",
    ],
    msrpKrw: 69000, released: 2002,
  },

  // ─── Nike Windrunner / Windbreaker Broad (47건 / p50 60k + windrunner 4건 / p50 225k) ───
  {
    id: "clothing-nike-windbreaker",
    brand: "Nike", category: "clothing", laneKey: "nike_windbreaker_broad",
    modelName: "Nike Windrunner / Windbreaker / Anorak (Broad)",
    aliases: ["Nike Windrunner", "나이키 윈드러너", "Nike 바람막이"],
    mustContain: [
      ["nike", "나이키"],
      ["윈드러너", "windrunner", "바람막이", "윈드브레이커", "windbreaker",
       "아노락", "anorak", "wind"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NIKE_SHOE_NOISE, ...NIKE_NON_APPAREL,
      "골프", "golf",
      "stussy", "스투시", "나투시",
      "꼼데", "comme", "준야", "junya",
      "fear of god", "fog", "피어오브갓",
      "sacai", "사카이", "off-white", "오프화이트",
      "louis vuitton", "루이비통",
      // Tech Fleece 별 시세
      "tech fleece", "테크플리스", "테크 플리스", "테크팩", "tech pack",
    ],
    msrpKrw: 99000, released: 1978,
  },

  // ─── Nike Hoodie / Sweat / Crewneck Broad (36건 / p50 50k) ───
  {
    id: "clothing-nike-hoodie-sweat",
    brand: "Nike", category: "clothing", laneKey: "nike_hoodie_sweat_broad",
    modelName: "Nike Hoodie / Sweatshirt / Crewneck (Broad)",
    aliases: ["Nike Hoodie", "나이키 후드", "Nike Sweat", "나이키 맨투맨"],
    mustContain: [
      ["nike", "나이키"],
      ["후드티", "후드 티", "후디", "hoodie", "후드집업", "후드 집업", "zip up",
       "맨투맨", "크루넥", "crewneck", "스웻", "sweat", "sweatshirt",
       "풀오버", "pullover"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NIKE_SHOE_NOISE, ...NIKE_NON_APPAREL,
      "골프", "golf",
      "stussy", "스투시", "나투시",
      "꼼데", "comme", "준야", "junya",
      "fear of god", "fog", "피어오브갓",
      "sacai", "사카이", "off-white", "오프화이트",
      "louis vuitton", "루이비통",
      "human made", "휴먼메이드", "니고",
      "언더커버", "undercover",
      // Tech Fleece signature 별 시세
      "tech fleece", "테크플리스", "테크 플리스", "테크팩", "tech pack",
      // Dri-FIT 별 SKU
      "dri-fit", "drifit", "드라이핏", "therma", "써마",
      // 빈티지 별 cycle
      "빈티지", "vintage", "올드스쿨", "y2k", "90s", "90's",
    ],
    msrpKrw: 79000, released: 1971,
  },

  // ─── Nike Tee / Short Sleeve Broad (23건 / p50 60k) ───
  {
    id: "clothing-nike-tee-broad",
    brand: "Nike", category: "clothing", laneKey: "nike_tee_broad",
    modelName: "Nike Tee / Short Sleeve (Broad)",
    aliases: ["Nike Tee", "나이키 반팔티", "Nike T-Shirt"],
    mustContain: [
      ["nike", "나이키"],
      ["반팔티", "반팔 티", "티셔츠", "t-shirt", "t 셔츠", "tee", "반팔",
       "그래픽 티", "swoosh tee"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NIKE_SHOE_NOISE, ...NIKE_NON_APPAREL,
      // 골프 폴로 (별 cycle)
      "골프", "golf", "골프티", "카라티", "카라 티", "폴로", "polo",
      // collab (별 cycle)
      "stussy", "스투시", "나투시",
      "꼼데", "comme", "준야", "junya",
      "fear of god", "fog", "피어오브갓",
      "sacai", "사카이", "off-white", "오프화이트",
      "louis vuitton", "루이비통",
      "human made", "휴먼메이드", "니고",
      "언더커버", "undercover",
      "supreme", "슈프림",
      // Dri-FIT 별 SKU
      "dri-fit", "drifit", "드라이핏",
      // 빈티지 별 cycle
      "빈티지", "vintage", "올드스쿨", "y2k",
    ],
    msrpKrw: 49000, released: 1971,
  },

  // ─── Nike Pants / Cargo / Shorts Broad (16건 / p50 117k) ───
  {
    id: "clothing-nike-pants-shorts",
    brand: "Nike", category: "clothing", laneKey: "nike_pants_shorts_broad",
    modelName: "Nike Pants / Cargo / Shorts / Jogger (Broad)",
    aliases: ["Nike Pants", "나이키 팬츠", "Nike Cargo", "나이키 카고"],
    mustContain: [
      ["nike", "나이키"],
      ["카고팬츠", "카고 팬츠", "조거팬츠", "조거 팬츠", "트랙팬츠", "트랙 팬츠",
       "팬츠", "pants", "바지",
       "쇼츠", "shorts", "반바지", "숏팬츠",
       "스웻팬츠", "sweatpants"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NIKE_SHOE_NOISE, ...NIKE_NON_APPAREL,
      "골프", "golf",
      "stussy", "스투시", "나투시",
      "꼼데", "comme", "준야", "junya",
      "fear of god", "fog", "피어오브갓",
      "sacai", "사카이", "off-white", "오프화이트",
      "louis vuitton", "루이비통",
      "human made", "휴먼메이드",
      "언더커버", "undercover",
      "supreme", "슈프림",
      // Tech Fleece signature
      "tech fleece", "테크플리스", "테크 플리스", "테크팩", "tech pack",
      // Dri-FIT 별 SKU
      "dri-fit", "drifit", "드라이핏", "therma", "써마",
      // 빈티지 별 cycle
      "빈티지", "vintage", "올드스쿨", "y2k",
      // collab 패턴
      "리바이스", "levis", "리메이크", "remake",
    ],
    msrpKrw: 89000, released: 1971,
  },
];
