import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 729 (2026-05-24): Carhartt broad SKU 4건 신설 — unmatched bucket 보강.
//
// DB sample 분석 (last 14 days, sku_id IS NULL):
//  - 99_other:        136건 p50 79.5k  (knit/오버롤/모자/캡 등)
//  - 01_double_knee:   72건 p50 189k   ← carhartt_double_knee_pants mustContain group 3 제거 (별 fix)
//  - 90_bag:           28건 (skip — bag 정책)
//  - 14_cargo:         21건 (이미 SKU)
//  - 02_detroit:       18건 (이미 SKU)
//  - 10_hoodie_sweat:  18건 p50 77.5k  ← ★ broad SKU 신설
//  - 04_active_jacket: 14건 (이미 SKU)
//  - 03_santa_fe:      11건 (이미 SKU)
//  - 13_other_pants:    9건 p50 91k    ← ★ denim_pants SKU 신설 (Landon/Newel/생지)
//  - 15_shirt:          7건 p50 80k    ← ★ shirt_flannel SKU 신설
//  - 16_vest:           4건 (작은 풀 — skip)
//  - 11_overall:        4건 p50 80k    ← ★ overall_anorak SKU 신설 (+12_anorak 3건 통합)
//  - 12_anorak:         3건 p50 100k   (Nimbus anorak)
//  - 20_beanie_cap:     3건 (skip — 작은 풀)
//
// 신설 4 SKU:
//  1. carhartt_hoodie_sweat (broad — 후드/맨투맨/스웻/크루넥)
//  2. carhartt_denim_pants (Landon/Newel/생지데님/일반데님)
//  3. carhartt_overall_anorak (오버롤/Nimbus/아노락/풀오버)
//  4. carhartt_shirt_flannel (체크/플란넬/L/S 셔츠)
//
// 정책:
//  - Carhartt 일반인 친화 가격대 5-15만 (사용자 정책 부합)
//  - WIP / Heritage USA 가격 차이는 후속 narrow split 가능 (지금은 broad로 catch)
//  - 가방/지갑/모자 별도 SKU (carhartt_backpack 이미 존재) → 차단
//  - 신발 collab (Nike 95 Max collab 등) 차단
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
  "일괄", "벌크",  // 묶음 매물
] as const;

const CARHARTT_BLOCK_OTHER = [
  // Collab 별 시세군 (별 narrow SKU)
  "supreme", "슈프림",
  "junya watanabe", "준야와타나베", "준야",
  "wacko maria", "와코마리아",
  "neighborhood", "네이버후드",
  "comme des", "꼼데",
  // 신발/가방/액세서리
  "신발", "스니커즈", "shoe", "운동화", "나이키", "nike", "뉴발란스", "new balance",
  "가방", "bag", "백팩", "토트백", "지갑", "wallet", "파우치",
  "벨트", "belt", "양말", "socks", "스티커",
] as const;

export const WAVE_729_CARHARTT_BROAD: Sku[] = [
  // ─── Carhartt Hoodie / Sweat / Crewneck Broad (18+ 건 / p50 77.5k) ───
  {
    id: "clothing-carhartt-hoodie-sweat",
    brand: "Carhartt", category: "clothing", laneKey: "carhartt_hoodie_sweat",
    modelName: "Carhartt Hoodie / Sweatshirt / Crewneck (Broad)",
    aliases: ["Carhartt Hoodie", "칼하트 후드", "Carhartt Sweat", "칼하트 맨투맨"],
    mustContain: [
      ["carhartt", "칼하트"],
      ["후드", "hoodie", "맨투맨", "크루넥", "crewneck", "스웻", "sweat", "sweatshirt",
       "풀오버", "pullover", "집업", "zip up", "지퍼업"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...CARHARTT_BLOCK_OTHER,
      // 다른 carhartt SKU 우선
      "detroit", "디트로이트",
      "active jacket", "액티브 자켓", "j130",
      "santa fe", "산타페",
      "님부스", "nimbus", "아노락", "anorak",  // overall_anorak SKU
      // Wave 848: outer jackets were leaking into hoodie/sweat via "후드"/"집업".
      "자켓", "재킷", "jacket", "봄버", "bomber", "바람막이", "윈드브레이커", "워크자켓", "워크 자켓",
      "후드자켓", "후드 자켓", "후드재킷", "후드 재킷",
    ],
    msrpKrw: 99000, released: 1989,
  },

  // ─── Carhartt Denim / Other Pants Broad (9+ 건 / p50 91k) ───
  {
    id: "clothing-carhartt-denim-pants",
    brand: "Carhartt", category: "clothing", laneKey: "carhartt_denim_pants",
    modelName: "Carhartt Denim / Newel / Simple Pants",
    aliases: ["Carhartt Denim", "칼하트 데님"],
    mustContain: [
      ["carhartt", "칼하트"],
      ["데님", "denim", "청바지", "jean",
       "newel", "뉴얼",
       "marlow", "말로우", "진청",
       "simple pant", "심플 팬츠", "심플팬츠",
       "프리미엄 데님", "premium denim",
       "생지 데님", "생지데님", "raw denim"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...CARHARTT_BLOCK_OTHER,
      // 다른 carhartt SKU 우선
      "double knee", "doubleknee", "더블니", "더블 니", "b01",  // double_knee_pants
      "cargo", "카고",  // cargo_pants
      "쇼츠", "shorts", "반바지", "숏팬츠",  // 쇼츠 별 시세
      // Wave 848: "진" token matched normal Korean words in descriptions (e.g. 사진/실사진).
      "푸퍼", "puffer", "패딩", "다운", "down", "베스트", "vest", "조끼", "자켓", "재킷", "jacket",
    ],
    msrpKrw: 119000, released: 2014,
  },

  // ─── Carhartt Overall / Nimbus Anorak Broad (4+3 = 7건 / p50 80-100k) ───
  {
    id: "clothing-carhartt-overall-anorak",
    brand: "Carhartt", category: "clothing", laneKey: "carhartt_overall_anorak",
    modelName: "Carhartt Overall / Bib / Nimbus Anorak / Pullover",
    aliases: ["Carhartt Overall", "칼하트 오버롤", "Carhartt Nimbus", "칼하트 님부스"],
    mustContain: [
      ["carhartt", "칼하트"],
      ["오버롤", "overall", "빕", "bib",
       "님부스", "nimbus",
       "아노락", "anorak"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...CARHARTT_BLOCK_OTHER,
    ],
    msrpKrw: 159000, released: 1959,
  },

  // ─── Carhartt Shirt / Flannel Broad (7건 / p50 80k) ───
  {
    id: "clothing-carhartt-shirt-flannel",
    brand: "Carhartt", category: "clothing", laneKey: "carhartt_shirt_flannel",
    modelName: "Carhartt Flannel / Workshirt / L-S Shirt",
    aliases: ["Carhartt Flannel", "칼하트 플란넬", "Carhartt Shirt", "칼하트 셔츠"],
    mustContain: [
      ["carhartt", "칼하트"],
      ["플란넬", "flannel", "체크 셔츠", "체크셔츠",
       "셔츠", "shirt", "남방",
       "workshirt", "워크 셔츠", "워크셔츠"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...CARHARTT_BLOCK_OTHER,
      // 다른 carhartt SKU 우선 (자켓류)
      "detroit", "디트로이트",  // detroit_jacket (자켓이긴 하지만 셔츠 단어 들어가는 경우 차단)
      "active jacket", "액티브 자켓", "j130",
      "santa fe", "산타페",
      // 자켓류 (별 시세) — 셔츠는 light layer, 자켓은 outer
      "자켓", "jacket", "코트", "coat",
      // Wave 848: 티셔츠의 "셔츠" syllable leaked into shirt/flannel.
      "티셔츠", "반팔티", "긴팔티", "tee", "t-shirt", "t shirt",
    ],
    msrpKrw: 99000, released: 1947,
  },
];
