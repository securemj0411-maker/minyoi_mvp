import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 737 (2026-05-24): 신발 broad 6 SKU 추가 (Wave 733 follow-up).
//
// Wave 733-736 후 발견 (last 14d, sku_id NULL, shoe signal):
//  - drmartens:  191건 / p50 8만   ★★★ (narrow 15개 있지만 broad 없음 — leak 매물 다수)
//  - timberland: 135건 / p50 13.3만 ★★  (SKU 없음!)
//  - keen:        79건 / p50 10만   ★★  (SKU 없음!)
//  - fila:        35건 / p50 4.8만  ★   (apparel SKU만 있고 신발 없음)
//  - clarks:      29건 / p50 10만   ★   (SKU 없음! Wallabee/Desert Boot)
//  - clae:        22건 / p50 19.95만 ★  (SKU 없음! premium sneaker)
//
// 총 ~491건/주 회수.
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
  "일괄", "벌크", "한짝", "한쪽",
] as const;

const SHOE_NON_SHOE = [
  "가방", "bag", "백팩", "토트", "크로스백",
  "지갑", "wallet", "파우치",
  "모자", "캡 ", " cap", "비니",
  "양말", "socks",
  "후드", "hoodie", "맨투맨", "반팔", "tee",
  "자켓", "재킷", "jacket",
  "팬츠", "pants", "바지", "쇼츠", "shorts",
  "셔츠", "shirt",
] as const;

export const WAVE_737_SHOE_BROAD_2: Sku[] = [
  // ─── Dr. Martens Broad (191건 / p50 8만 — narrow 15개 외 catch-all) ───
  {
    id: "shoe-drmartens-broad",
    brand: "Dr. Martens", category: "shoe", laneKey: "drmartens_broad",
    modelName: "Dr. Martens Broad (1461/1460/2976/Pascal/Polley 외 일반)",
    aliases: ["Dr. Martens", "Dr Martens", "닥터마틴", "닥터 마틴", "마틴부츠"],
    mustContain: [
      ["dr. martens", "dr martens", "drmartens", "닥터마틴", "닥터 마틴", "마틴부츠"],
      ["8홀", "8eye", "10홀", "10eye", "6홀", "3홀", "부츠", "boot",
       "옥스포드", "oxford", "로퍼", "loafer", "더비", "derby",
       "샌들", "sandal", "메리제인", "mary jane",
       "옐로우 스티치", "yellow stitch",
       // 일반 모델명
       "1461", "1460", "2976",  // narrow 있는 거지만 일반 mention 대응
       "체리", "cherry",  // 컬러
       "신발", "운동화", "스니커즈"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...SHOE_NON_SHOE,
      // Narrow SKU 있는 정확 모델은 narrow로 가게
      "1461 mono", "1461 bex", "1461 quad", "1461 crazy horse", "1461 mie",
      "1460 mono", "1460 nappa",
      "2976 mono",
      "pascal", "파스칼",
      "polley", "폴리",
      // Collab 별 SKU
      "supreme", "슈프림",
    ],
    msrpKrw: 199000, released: 1960,
  },

  // ─── Timberland Broad (135건 / p50 13.3만) ───
  {
    id: "shoe-timberland-broad",
    brand: "Timberland", category: "shoe", laneKey: "timberland_broad",
    modelName: "Timberland Broad (6인치 부츠/Earthkeepers/Pro 시그니처)",
    aliases: ["Timberland", "팀버랜드", "팀버", "TBL"],
    mustContain: [
      ["timberland", "팀버랜드", "팀버"],
      ["6인치", "6 인치", "6inch",
       "프리미엄 부츠", "premium boot",
       "earthkeepers", "어스키퍼스",
       "pro", "프로",
       "로미오", "romeo",
       "콜로라도", "콜로레이도", "colorado",
       "부츠", "boot", "boots",
       "신발", "운동화", "스니커즈"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...SHOE_NON_SHOE,
      // Collab
      "supreme",
    ],
    msrpKrw: 230000, released: 1973,
  },

  // ─── Keen Broad (79건 / p50 10만 — 아웃도어 샌들/등산) ───
  {
    id: "shoe-keen-broad",
    brand: "Keen", category: "shoe", laneKey: "keen_broad",
    modelName: "Keen Broad (Newport/Targhee/Jasper/Uneek 샌들/등산)",
    aliases: ["Keen", "킨"],
    mustContain: [
      ["keen", "킨 ", "킨)"],
      ["newport", "뉴포트",
       "targhee", "타기",
       "jasper", "재스퍼",
       "uneek", "유닉",
       "voyageur", "보이저",
       "터미네이터",
       "etc", "에토스",
       "샌들", "sandal", "등산화", "트레킹화",
       "신발", "운동화"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...SHOE_NON_SHOE,
    ],
    msrpKrw: 159000, released: 2003,
  },

  // ─── Fila Shoe Broad (35건 / p50 4.8만) ───
  {
    id: "shoe-fila-broad",
    brand: "Fila", category: "shoe", laneKey: "fila_shoe_broad",
    modelName: "Fila Shoe Broad (Disruptor/Ray/Renno)",
    aliases: ["Fila", "휠라", "필라"],
    mustContain: [
      ["fila", "휠라", "필라"],
      ["disruptor", "디스럽터",
       "ray", "레이",
       "renno", "레노",
       "neptune", "넵튠",
       "scrambler", "스크램블러",
       "트레일",
       "신발", "운동화", "스니커즈", "shoes"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...SHOE_NON_SHOE,
      // 의류 별 SKU (fila_apparel)
      "트랙수트", "tracksuit", "트레이닝",
    ],
    msrpKrw: 89000, released: 1911,
  },

  // ─── Clarks Broad (29건 / p50 10만 — Wallabee/Desert Boot) ───
  {
    id: "shoe-clarks-broad",
    brand: "Clarks", category: "shoe", laneKey: "clarks_broad",
    modelName: "Clarks Broad (Wallabee/Desert Boot/Trek)",
    aliases: ["Clarks", "클락스"],
    mustContain: [
      ["clarks", "클락스"],
      ["wallabee", "왈라비",
       "desert boot", "데저트 부츠", "데저트부츠", "desert",
       "trek", "트렉",
       "originals",
       "부츠", "boot", "로퍼", "loafer",
       "신발", "운동화", "스니커즈"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...SHOE_NON_SHOE,
      // Collab
      "supreme",
    ],
    msrpKrw: 199000, released: 1825,
  },

  // ─── Clae Broad (22건 / p50 19.95만 — premium sneaker) ───
  {
    id: "shoe-clae-broad",
    brand: "Clae", category: "shoe", laneKey: "clae_broad",
    modelName: "Clae Broad (Bradley/Malone/Mills 미니멀 sneaker)",
    aliases: ["Clae", "클레", "CLAE"],
    mustContain: [
      ["clae", "클레"],
      ["bradley", "브래들리",
       "malone", "말론",
       "mills", "밀스",
       "ellington", "엘링턴",
       "deane", "딘",
       "신발", "운동화", "스니커즈"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...SHOE_NON_SHOE,
    ],
    msrpKrw: 220000, released: 2001,
  },
];
