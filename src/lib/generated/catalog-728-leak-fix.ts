import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 728 (2026-05-24): catalog leak fix — supreme/arcteryx 누락 라인.
//
// sample 분석 (15건 × 2 brand):
//  - supreme: collab 매물 다수 (Dickies/MM6/Velvet Underground/CdG/coS) — broad mustNotContain으로 차단됨
//  - arcteryx: 한정/특수 라인 (프로톤/솔라노/람파트) narrow 없음
//
// supreme/arcteryx broad narrow가 strict한 이유:
//  - Wave 651+ outlier cycle에서 collab/한정 차단 (시세 분리 위해)
//  - 그런데 collab narrow SKU 없으면 매물 갈 곳 없음 → sku_id=null
//
// 이번 wave는 별 collab/한정 narrow 신설로 매물 회복.
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
] as const;

export const WAVE_728_LEAK_FIX: Sku[] = [
  // ─── Supreme × Dickies (collab — 카고팬츠/플란넬) ───
  {
    id: "clothing-supreme-dickies-collab",
    brand: "Supreme x Dickies", category: "clothing", laneKey: "supreme_dickies_collab",
    modelName: "Supreme × Dickies (카고팬츠/플란넬/티셔츠 collab)",
    aliases: ["Supreme Dickies", "슈프림 디키즈"],
    mustContain: [
      ["supreme", "슈프림"],
      ["dickies", "디키즈"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "신발", "shoe", "스니커즈", "운동화",
      "가방", "bag", "백팩",
    ],
    msrpKrw: 230000, released: 2018,
  },

  // ─── Supreme × MM6 Maison Margiela (collab) ───
  {
    id: "clothing-supreme-mm6-collab",
    brand: "Supreme x MM6", category: "clothing", laneKey: "supreme_mm6_collab",
    modelName: "Supreme × MM6 Maison Margiela (반팔/볼캡/collab)",
    aliases: ["Supreme MM6", "슈프림 마르지엘라", "Supreme Margiela"],
    mustContain: [
      ["supreme", "슈프림"],
      ["mm6", "마르지엘라", "margiela", "마르지엘", "마르지에라"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "신발", "스니커즈", "타비", "tabi",
      "가방", "bag", "백팩",
    ],
    msrpKrw: 280000, released: 2024,
  },

  // ─── Supreme Box Logo / Velvet Underground / 한정 시즌 collab broad ───
  // (이미 supreme_box_logo Wave 715 신설됨. 추가 broad는 일반 collab 매물 catch)
  {
    id: "clothing-supreme-collab-broad",
    brand: "Supreme", category: "clothing", laneKey: "supreme_collab_broad",
    modelName: "Supreme Collab Broad (Velvet Underground / Junya / CdG / coS / 한정 시즌)",
    aliases: ["Supreme Collab"],
    mustContain: [
      ["supreme", "슈프림"],
      // 광범위 collab 시그널. 일반 product type(후드/맨투맨/크루넥)은 plain Supreme을 오염시켜 제외.
      ["velvet underground", "벨벳 언더그라운드", "junya", "준야", "comme des garcons", "꼼데가르송",
       "cdg", "코스", "cos "],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      // 다른 narrow에 우선 매칭되는 매물 제외
      "the north face", "노스페이스", "tnf",  // tnf_supreme_collab
      "bape", "베이프",  // 별도
      "louis vuitton", "루이비통", "lv",  // 별도
      "stone island", "스톤아일랜드",  // 별도
      "box logo", "박스 로고", "박스로고", "bogo",  // supreme_box_logo (Wave 715)
      "dickies", "디키즈",  // supreme_dickies_collab (위)
      "mm6", "마르지엘라",  // supreme_mm6_collab (위)
      "stussy", "스투시",
      "nike", "나이키", "nike x supreme", "supreme x nike",
      "jordan", "조던", "air force", "에어포스", "dunk", "덩크",
      "small box", "스몰 박스", "스몰박스",
      // shoe/bag/accessory
      "신발", "shoe", "스니커즈", "운동화", "샥스", "에어포스", "샥",
      "가방", "bag", "백팩", "코듀라",
      "헤드폰", "헤드셋",
    ],
    msrpKrw: 290000, released: 1994,
  },

  // ─── Arc'teryx Proton (Insulated 시그니처 — 토륨/세륨과 별 시세) ───
  {
    id: "clothing-arcteryx-proton",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_proton",
    modelName: "Arc'teryx Proton Hoody (Insulated mid-layer)",
    aliases: ["Arc'teryx Proton", "아크테릭스 프로톤"],
    mustContain: [
      ["arcteryx", "arc'teryx", "아크테릭스"],
      ["proton", "프로톤"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "veilance", "베일런스",
      "leaf", "리프",
      // Wave 805: LT/FL/SV/AR split into explicit price lanes.
      "프로톤 lt", "프로톤lt", "proton lt", "protonlt",
      "프로톤 fl", "프로톤fl", "proton fl", "protonfl",
      "프로톤 sv", "프로톤sv", "proton sv", "protonsv",
      "프로톤 ar", "프로톤ar", "proton ar", "protonar",
    ],
    msrpKrw: 470000, released: 2014,
  },

  // ─── Arc'teryx Solano (특수 light jacket) ───
  {
    id: "clothing-arcteryx-solano",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_solano",
    modelName: "Arc'teryx Solano (light jacket)",
    aliases: ["Arc'teryx Solano", "아크테릭스 솔라노"],
    mustContain: [
      ["arcteryx", "arc'teryx", "아크테릭스"],
      ["solano", "솔라노"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "veilance", "베일런스",
    ],
    msrpKrw: 290000, released: 2017,
  },

  // ─── Arc'teryx Rampart (Pants 시그니처) ───
  {
    id: "clothing-arcteryx-rampart-pants",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_rampart_pants",
    modelName: "Arc'teryx Rampart Pants (lightweight hike)",
    aliases: ["Arc'teryx Rampart", "아크테릭스 람파트"],
    mustContain: [
      ["arcteryx", "arc'teryx", "아크테릭스"],
      ["rampart", "람파트", "람펄트"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "veilance", "베일런스",
    ],
    msrpKrw: 320000, released: 2018,
  },
];
