import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 731 (2026-05-24): Adidas apparel broad SKU 신설.
//
// Wave 730 Nike pattern과 동일 — apparel-only 정제 후 측정.
//
// 발견 (last 14d, sku_id NULL, 30-300k, apparel signal, shoe noise 차단):
//  - 13_tee:              34건 / p50 4.4만  ★
//  - 10_windbreaker:      32건 / p50 7.7만  ★
//  - 12_hoodie:           30건 / p50 10.0만 ★
//  - 16_pants_shorts:     18건 / p50 14.5만 ★
//  - 11_sweat_crewneck:   12건 / p50 13.7만 (hoodie 통합)
//  - 03_trefoil_basic:     8건 / p50 5.0만 (vintage SKU 보강은 별 wave)
//  - 14_down_padding:      7건 / p50 6.3만 ★
//  - 02_tracksuit_other:   7건 / p50 4.9만 ★
//  - 01_firebird_tracksuit: 4건 / p50 6.2만 (tracksuit 통합)
//  - 15_fleece:            4건 / p50 7.5만 (windbreaker 통합)
//  - 05_y3:                3건 (premium tier, 별 SKU 후속)
//
// 신설 5 SKU (총 ~140건 회수):
//  1. adidas_tracksuit_broad (firebird 4 + tracksuit 7 = 11건) — 시그니처 트랙수트
//  2. adidas_tee_broad (34건)
//  3. adidas_windbreaker_broad (32+4=36건, fleece 포함)
//  4. adidas_hoodie_sweat_broad (30+12=42건)
//  5. adidas_pants_shorts_broad (18건)
//  6. adidas_down_padding (7건) — 시즌성
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
  "일괄", "벌크",
] as const;

// Adidas 신발 모델 (apparel 제목엔 안 나옴)
const ADIDAS_SHOE_NOISE = [
  "삼바", "samba",
  "가젤", "gazelle",
  "스탠스미스", "stansmith", "stan smith", "스탠 스미스",
  "슈퍼스타", "superstar",
  "이지", "yeezy",
  "핸드볼", "spezial", "스페지알",
  "포레스트", "forest",
  "포룸", "forum",
  "캠퍼스", "campus",
  "울트라부스트", "ultraboost", "ultra boost",
  "nmd", "엔엠디",
  "코파", "copa", "predator", "프레데터", "f50",
  "축구화", "풋살화", "부츠", "boots", "샌들", "sandal",
  "운동화", "스니커즈", "shoes", "shoe", "스니커",
  // mm 사이즈 (신발)
  "220mm", "230mm", "240mm", "245mm", "250mm", "255mm", "260mm", "265mm", "270mm", "275mm", "280mm",
] as const;

const ADIDAS_NON_APPAREL = [
  "가방", "bag", "백팩", "토트", "크로스백", "메신저", "더플",
  "지갑", "wallet", "파우치",
  "모자", "캡 ", "캡)", " cap", " cap ",
  "양말", "socks",
  "시계", "watch", "워치",
  "스티커", "패치", "키링",
] as const;

const ADIDAS_COLLAB_BLOCK = [
  // Premium collab — 별 SKU
  "gosha", "고샤",
  "prada", "프라다",
  "balenciaga", "발렌시아가",
  "thug club", "thugclub", "썩 클럽", "썩클럽",
  "wales bonner", "웨일즈 보너",
  "y-3", "y3 ", "요지", "yohji",
  "stella mccartney", "스텔라",
  // Supreme도 차단
  "supreme", "슈프림",
  // Junya x Adidas (별도)
  "junya", "준야",
] as const;

export const WAVE_731_ADIDAS_APPAREL_BROAD: Sku[] = [
  // ─── Adidas Tracksuit Broad (Firebird + 일반, 11건 / p50 5-6만) ───
  {
    id: "clothing-adidas-tracksuit",
    brand: "Adidas", category: "clothing", laneKey: "adidas_tracksuit_broad",
    modelName: "Adidas Tracksuit / Firebird (Broad)",
    aliases: ["Adidas Tracksuit", "아디다스 트랙수트", "Firebird"],
    mustContain: [
      ["adidas", "아디다스"],
      ["트랙수트", "tracksuit", "track suit", "트랙 수트",
       "파이어버드", "firebird",
       "track top", "트랙 탑", "트랙탑"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...ADIDAS_SHOE_NOISE, ...ADIDAS_NON_APPAREL, ...ADIDAS_COLLAB_BLOCK,
      "골프", "golf",
      "빈티지", "vintage", "올드스쿨", "y2k", "90s",
    ],
    msrpKrw: 99000, released: 1969,
  },

  // ─── Adidas Tee Broad (34건 / p50 4.4만) ───
  {
    id: "clothing-adidas-tee-broad",
    brand: "Adidas", category: "clothing", laneKey: "adidas_tee_broad",
    modelName: "Adidas Tee / Short Sleeve (Broad)",
    aliases: ["Adidas Tee", "아디다스 반팔", "Adidas T-Shirt"],
    mustContain: [
      ["adidas", "아디다스"],
      ["반팔티", "반팔 티", "티셔츠", "t-shirt", "t 셔츠", "tee", "반팔",
       "그래픽 티", "logo tee"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...ADIDAS_SHOE_NOISE, ...ADIDAS_NON_APPAREL, ...ADIDAS_COLLAB_BLOCK,
      // 골프 폴로 (별 cycle)
      "골프", "golf", "골프티", "카라티", "카라 티", "폴로", "polo",
      // 빈티지 (별 cycle)
      "빈티지", "vintage", "올드스쿨", "y2k", "90s", "00s",
      "trefoil archive", "트레포일 아카이브",
    ],
    msrpKrw: 49000, released: 1949,
  },

  // ─── Adidas Windbreaker / Fleece Broad (32+4=36건 / p50 7-8만) ───
  {
    id: "clothing-adidas-windbreaker",
    brand: "Adidas", category: "clothing", laneKey: "adidas_windbreaker_broad",
    modelName: "Adidas Windbreaker / Fleece / Anorak (Broad)",
    aliases: ["Adidas Windbreaker", "아디다스 바람막이", "Adidas Fleece"],
    mustContain: [
      ["adidas", "아디다스"],
      ["바람막이", "windbreaker", "윈드브레이커", "windrunner",
       "플리스", "fleece",
       "아노락", "anorak"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...ADIDAS_SHOE_NOISE, ...ADIDAS_NON_APPAREL, ...ADIDAS_COLLAB_BLOCK,
      "골프", "golf",
      "빈티지", "vintage", "올드스쿨", "y2k", "90s",
    ],
    msrpKrw: 89000, released: 1972,
  },

  // ─── Adidas Hoodie / Sweat / Crewneck Broad (30+12=42건 / p50 10-14만) ───
  {
    id: "clothing-adidas-hoodie-sweat",
    brand: "Adidas", category: "clothing", laneKey: "adidas_hoodie_sweat_broad",
    modelName: "Adidas Hoodie / Sweatshirt / Crewneck (Broad)",
    aliases: ["Adidas Hoodie", "아디다스 후드", "Adidas Sweat", "아디다스 맨투맨"],
    mustContain: [
      ["adidas", "아디다스"],
      ["후드티", "후드 티", "후디", "hoodie", "후드집업", "후드 집업", "zip up",
       "맨투맨", "크루넥", "crewneck", "스웻", "sweat", "sweatshirt",
       "풀오버", "pullover"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...ADIDAS_SHOE_NOISE, ...ADIDAS_NON_APPAREL, ...ADIDAS_COLLAB_BLOCK,
      "골프", "golf",
      "빈티지", "vintage", "올드스쿨", "y2k", "90s", "00s",
      "trefoil archive", "트레포일 아카이브",
    ],
    msrpKrw: 89000, released: 1949,
  },

  // ─── Adidas Pants / Cargo / Shorts Broad (18건 / p50 14.5만) ───
  {
    id: "clothing-adidas-pants-shorts",
    brand: "Adidas", category: "clothing", laneKey: "adidas_pants_shorts_broad",
    modelName: "Adidas Pants / Cargo / Shorts / Jogger (Broad)",
    aliases: ["Adidas Pants", "아디다스 팬츠", "Adidas Cargo", "아디다스 카고"],
    mustContain: [
      ["adidas", "아디다스"],
      ["카고팬츠", "카고 팬츠", "조거팬츠", "조거 팬츠", "트랙팬츠", "트랙 팬츠",
       "팬츠", "pants", "바지",
       "쇼츠", "shorts", "반바지", "숏팬츠",
       "스웻팬츠", "sweatpants"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...ADIDAS_SHOE_NOISE, ...ADIDAS_NON_APPAREL, ...ADIDAS_COLLAB_BLOCK,
      "골프", "golf",
      "빈티지", "vintage", "올드스쿨", "y2k", "90s",
    ],
    msrpKrw: 79000, released: 1949,
  },

  // ─── Adidas Down / Padding Broad (7건 / p50 6.3만) ───
  {
    id: "clothing-adidas-down-padding",
    brand: "Adidas", category: "clothing", laneKey: "adidas_down_padding_broad",
    modelName: "Adidas Down / Padding / Puffer (Broad)",
    aliases: ["Adidas Down", "아디다스 패딩", "Adidas Puffer"],
    mustContain: [
      ["adidas", "아디다스"],
      ["다운", "패딩", "푸퍼", "puffer",
       "벤치파카", "벤치 파카", "롱패딩", "숏패딩"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...ADIDAS_SHOE_NOISE, ...ADIDAS_NON_APPAREL, ...ADIDAS_COLLAB_BLOCK,
      "골프", "golf",
      "빈티지", "vintage", "올드스쿨", "y2k", "90s",
    ],
    msrpKrw: 159000, released: 1980,
  },
];
