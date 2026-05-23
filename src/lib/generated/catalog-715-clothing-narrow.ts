import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 715 (2026-05-23): 의류 catalog 체계적 narrow split.
//
// Phase 0 SQL spread audit 결과 20 broad SKU 5-150x spread 확인.
// 사용자 지시: "다 해야겠다 ㅇㅇ 막 그냥 클루지처럼 하지말고 체계적으로 순서대로 다 하자. 로그도 잘 박고."
//
// 이 파일 = P1+P2+P3 narrow split (P0는 catalog.ts/catalog-712b-bias-free.ts inline).
//
// brand별 우선순위 (impact 큰 순):
//   1. Thom Browne (640건 58x) → 4-bar / Cardigan / Coat / Knit / Shirt / Sweat 6-split
//   2. Polo Apparel broad (488건 110x) → vintage 분리 (modern 빅로고와 시세 다름)
//   3. Stone Island broad → garment dye narrow
//   4. Moncler → Maya / Grenoble / Tricot 3-split (Main과 시세 다름)
//   5. Supreme → Box Logo narrow (시즌별 가격대 크게 다름)
//   6. Carhartt WIP → Detroit Jacket narrow
//   7. CDG → PLAY / HOMME PLUS / Junya / Wallet 분리
//   8. Stussy 시즌 collab narrow
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품", "11급", "ss급정품", "1:1", "미러",
  "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입",
  // 가품 마케팅 표지
  "느낌 아시", "느낌아시", "느낌 알", "느낌알",
  // 반대 카테고리
  "신발", "스니커즈", "운동화", "shoe", "sneaker",
  "가방", "백팩", "토트", "숄더", "크로스백", "bag",
] as const;

export const WAVE_715_CLOTHING_NARROW: Sku[] = [
  // ============================================================================
  // ===== Thom Browne 6-split (640건 58x → narrow) =====
  // ============================================================================

  // ─── Thom Browne 4-bar stripe signature ───
  {
    id: "clothing-thombrowne-4bar",
    brand: "Thom Browne", category: "clothing", laneKey: "thombrowne_4bar",
    modelName: "Thom Browne 4-Bar Stripe (시그니처 4바)",
    aliases: ["Thom Browne 4-bar", "톰브라운 4바", "포바", "사바"],
    mustContain: [
      ["thom browne", "톰브라운", "톰 브라운"],
      ["4-bar", "4바", "포바", "포 바", "사 바", "사바", "four bar", "사선", "스트라이프 4", "4 stripe"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "tom ford", "톰포드",
      "톰브라운 스타일", "톰브라운스타일", "강아지", "애견", "반려견", "dog",
    ],
    msrpKrw: 1500000, released: 2003,
  },

  // ─── Thom Browne Cardigan (시그니처 단추 가디건) ───
  {
    id: "clothing-thombrowne-cardigan",
    brand: "Thom Browne", category: "clothing", laneKey: "thombrowne_cardigan",
    modelName: "Thom Browne Cardigan (시그니처 V넥/포멀 가디건)",
    aliases: ["Thom Browne Cardigan", "톰브라운 가디건", "톰브라운 카디건"],
    mustContain: [
      ["thom browne", "톰브라운", "톰 브라운"],
      ["가디건", "카디건", "cardigan"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "tom ford", "톰포드",
      "톰브라운 스타일", "톰브라운스타일", "강아지", "애견", "반려견", "dog",
      // 4-bar는 별도 SKU
      "4-bar", "4바", "포바", "사바",
    ],
    msrpKrw: 1100000, released: 2003,
  },

  // ─── Thom Browne Knit Sweater ───
  {
    id: "clothing-thombrowne-knit",
    brand: "Thom Browne", category: "clothing", laneKey: "thombrowne_knit",
    modelName: "Thom Browne Knit Sweater (케이블/긴팔 니트)",
    aliases: ["Thom Browne Knit", "톰브라운 니트", "톰브라운 스웨터"],
    mustContain: [
      ["thom browne", "톰브라운", "톰 브라운"],
      ["니트", "knit", "스웨터", "sweater", "케이블"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "tom ford", "톰포드",
      "톰브라운 스타일", "톰브라운스타일", "강아지", "애견", "반려견",
      "가디건", "카디건", "cardigan",
      "4-bar", "4바", "포바", "사바",
    ],
    msrpKrw: 950000, released: 2003,
  },

  // ─── Thom Browne Shirt (옥스포드/드레스 셔츠) ───
  {
    id: "clothing-thombrowne-shirt",
    brand: "Thom Browne", category: "clothing", laneKey: "thombrowne_shirt",
    modelName: "Thom Browne Shirt (옥스포드/드레스/럭비)",
    aliases: ["Thom Browne Shirt", "톰브라운 셔츠", "톰브라운 럭비"],
    mustContain: [
      ["thom browne", "톰브라운", "톰 브라운"],
      ["셔츠", "shirt", "옥스포드", "옥스퍼드", "럭비", "rugby", "폴로", "polo", "버튼다운"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "tom ford", "톰포드",
      "톰브라운 스타일", "톰브라운스타일",
      "4-bar", "4바", "포바", "사바",
    ],
    msrpKrw: 550000, released: 2003,
  },

  // ─── Thom Browne Suit / Blazer / Coat (premium tier) ───
  {
    id: "clothing-thombrowne-suit-coat",
    brand: "Thom Browne", category: "clothing", laneKey: "thombrowne_suit_coat",
    modelName: "Thom Browne Suit/Blazer/Coat (premium tier 200~400만)",
    aliases: ["Thom Browne Suit", "톰브라운 슈트", "톰브라운 코트", "톰브라운 블레이저"],
    mustContain: [
      ["thom browne", "톰브라운", "톰 브라운"],
      ["슈트", "suit", "블레이저", "blazer", "코트", "coat", "오버코트", "트렌치"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "tom ford", "톰포드",
      "톰브라운 스타일", "톰브라운스타일",
      // 4-bar 라인은 별도
      "4-bar", "4바", "포바", "사바",
      // 자켓은 별도 SKU (선택적, 분리 가능)
    ],
    msrpKrw: 2500000, released: 2003,
  },

  // ─── Thom Browne Sweat / Hoodie ───
  {
    id: "clothing-thombrowne-sweat-hoodie",
    brand: "Thom Browne", category: "clothing", laneKey: "thombrowne_sweat_hoodie",
    modelName: "Thom Browne Sweat/Hoodie (스웻셔츠/맨투맨/후디)",
    aliases: ["Thom Browne Sweat", "톰브라운 맨투맨", "톰브라운 후디"],
    mustContain: [
      ["thom browne", "톰브라운", "톰 브라운"],
      ["맨투맨", "스웻", "sweat", "후드", "hoodie", "후디", "크루넥"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "tom ford", "톰포드",
      "톰브라운 스타일", "톰브라운스타일",
      "4-bar", "4바", "포바", "사바",
      "니트", "knit", "스웨터", "sweater",
    ],
    msrpKrw: 750000, released: 2003,
  },

  // ============================================================================
  // ===== Polo Apparel broad (488건 110x) → vintage 분리 =====
  // ============================================================================

  // ─── Polo Vintage (90s/2000s 빈티지 라인) ───
  {
    id: "clothing-polo-vintage",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_apparel_vintage",
    modelName: "Polo Ralph Lauren Vintage (90s/00s archive 의류)",
    aliases: ["Polo Vintage", "폴로 빈티지", "랄프로렌 빈티지", "90s Polo"],
    mustContain: [
      ["polo ralph", "폴로 랄프", "랄프로렌", "랄프 로렌", "ralph lauren"],
      ["빈티지", "vintage", "90s", "90's", "00s", "y2k", "올드", "old", "archive", "아카이브",
       "90년대", "00년대", "2000년대", "1990", "1991", "1992", "1993", "1994", "1995", "1996", "1997", "1998", "1999"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "rrl", "double rl",
      "purple label", "퍼플라벨", "rlx",
      // 별도 narrow 라인은 제외
      "stadium", "스타디움", "chief keef", "치프키프",
      // 키즈 빈티지는 의류 시세군 다름
      "신생아", "유아",
    ],
    msrpKrw: 169000, released: 1990,
  },

  // ============================================================================
  // ===== Moncler 3-split (Maya / Grenoble / Tricot) =====
  // ============================================================================

  // ─── Moncler Maya (시그니처 light down jacket) ───
  {
    id: "clothing-moncler-maya",
    brand: "Moncler", category: "clothing", laneKey: "moncler_maya",
    modelName: "Moncler Maya (시그니처 라이트 다운 자켓)",
    aliases: ["Moncler Maya", "몽클레르 마야", "몽클레어 마야"],
    mustContain: [
      ["moncler", "몽클레르", "몽클레어"],
      ["maya", "마야"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "키즈 마야", "kids maya",
    ],
    msrpKrw: 2200000, released: 2015,
  },

  // ─── Moncler Grenoble (skiwear premium line) ───
  {
    id: "clothing-moncler-grenoble",
    brand: "Moncler Grenoble", category: "clothing", laneKey: "moncler_grenoble",
    modelName: "Moncler Grenoble (스키웨어 premium line)",
    aliases: ["Moncler Grenoble", "몽클레르 그르노블", "그르노블"],
    mustContain: [
      ["moncler", "몽클레르", "몽클레어"],
      ["grenoble", "그르노블", "그레노블", "그르노블르"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
    ],
    msrpKrw: 3000000, released: 2010,
  },

  // ─── Moncler Tricot (니트/카디건 sub-line) ───
  {
    id: "clothing-moncler-tricot",
    brand: "Moncler", category: "clothing", laneKey: "moncler_tricot",
    modelName: "Moncler Tricot/Cardigan (니트 sub-line)",
    aliases: ["Moncler Tricot", "몽클레르 니트", "몽클레르 카디건"],
    mustContain: [
      ["moncler", "몽클레르", "몽클레어"],
      ["tricot", "트리코", "니트", "knit", "가디건", "카디건", "cardigan"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "maya", "마야", "grenoble", "그르노블",
    ],
    msrpKrw: 1200000, released: 2015,
  },

  // ============================================================================
  // ===== Supreme Box Logo narrow =====
  // ============================================================================

  // ─── Supreme Box Logo (시즌별 hoodie/tee가 시세 가장 큼) ───
  {
    id: "clothing-supreme-box-logo",
    brand: "Supreme", category: "clothing", laneKey: "supreme_box_logo",
    modelName: "Supreme Box Logo (Hoodie/Tee/Crewneck — 시즌별 가격 상이)",
    aliases: ["Supreme Box Logo", "슈프림 박스 로고", "박스 로고", "BOGO"],
    mustContain: [
      ["supreme", "슈프림"],
      ["box logo", "박스 로고", "박스로고", "bogo", "보고", "bogo hoodie"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      // Pet apparel 차단
      "강아지", "애견", "반려견", "dog",
      // 가품 시그널
      "느낌 좋", "느낌 만점",
    ],
    msrpKrw: 230000, released: 1994,
  },

  // ============================================================================
  // ===== Carhartt WIP Detroit Jacket =====
  // ============================================================================

  // ─── Carhartt WIP Detroit Jacket (시그니처 캔버스 자켓) ───
  {
    id: "clothing-carhartt-wip-detroit",
    brand: "Carhartt WIP", category: "clothing", laneKey: "carhartt_wip_detroit",
    modelName: "Carhartt WIP Detroit Jacket (캔버스 자켓 시그니처)",
    aliases: ["Carhartt WIP Detroit", "칼하트 디트로이트", "칼하트 WIP 디트로이트"],
    mustContain: [
      ["carhartt wip", "칼하트 wip", "칼하트wip", "carhartt", "칼하트"],
      ["detroit", "디트로이트"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      // US/일반 칼하트 (브랜드 다름)
      "carhartt usa", "칼하트 미국", "칼하트 유에스", "carhartt us",
      // 키즈
      "키즈 디트로이트",
    ],
    msrpKrw: 280000, released: 2003,
  },

  // ============================================================================
  // ===== CDG line-by-line (PLAY/HOMME PLUS/Junya/Wallet) =====
  // ============================================================================

  // ─── CDG PLAY (heart logo basic line) ───
  {
    id: "clothing-cdg-play",
    brand: "Comme des Garçons PLAY", category: "clothing", laneKey: "cdg_play",
    modelName: "CDG PLAY (heart 로고 basic line 티/카디건)",
    aliases: ["CDG PLAY", "꼼데가르송 플레이", "꼼데 플레이", "꼼플레", "꼼데가르송 PLAY"],
    mustContain: [
      ["꼼데가르송", "꼼데", "comme des garcons", "comme des garçons", "cdg"],
      ["play", "플레이"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "homme plus", "홈므 플러스", "옴므 플러스", "junya", "준야",
      "wallet", "지갑", "pvc", "nike", "컨버스", "converse",
    ],
    msrpKrw: 169000, released: 2002,
  },

  // ─── CDG Homme Plus (mainline premium) ───
  {
    id: "clothing-cdg-homme-plus",
    brand: "Comme des Garçons Homme Plus", category: "clothing", laneKey: "cdg_homme_plus",
    modelName: "CDG Homme Plus (premium mainline 자켓/셔츠)",
    aliases: ["CDG Homme Plus", "꼼데가르송 옴므 플러스", "꼼데 옴플", "옴므 플러스"],
    mustContain: [
      ["꼼데가르송", "꼼데", "comme des garcons", "comme des garçons", "cdg"],
      ["homme plus", "옴므 플러스", "옴므플러스", "홈므 플러스", "홈므플러스"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "play", "플레이", "junya", "준야",
    ],
    msrpKrw: 1100000, released: 1984,
  },

  // ─── CDG Junya Watanabe ───
  {
    id: "clothing-cdg-junya",
    brand: "Junya Watanabe Comme des Garçons", category: "clothing", laneKey: "cdg_junya",
    modelName: "Junya Watanabe Comme des Garçons (sub-line)",
    aliases: ["Junya Watanabe", "준야 와타나베", "꼼데 준야"],
    mustContain: [
      ["junya", "준야", "준야 와타나베", "준야와타나베"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "play", "플레이",
    ],
    msrpKrw: 800000, released: 1992,
  },

  // ============================================================================
  // ===== Stussy: Nike collab은 existing clothing-stussy-nike-collab (laneKey stussy_nike_collab) 활용 =====
  // ============================================================================

  // ============================================================================
  // ===== Arc'teryx LEAF / Veilance 별도 SKU (군용/도시 premium) =====
  // ============================================================================

  // ─── Arc'teryx LEAF (Law Enforcement And Forces — 군용/방산) ───
  {
    id: "clothing-arcteryx-leaf",
    brand: "Arc'teryx LEAF", category: "clothing", laneKey: "arcteryx_leaf",
    modelName: "Arc'teryx LEAF (Law Enforcement And Forces — 군용/방산 premium)",
    aliases: ["Arc'teryx LEAF", "아크테릭스 리프", "리프 알파"],
    mustContain: [
      ["arcteryx", "arc'teryx", "아크테릭스"],
      ["leaf", "리프", "리프 알파", "leaf alpha", "리프 자켓", "leaf jacket", "리프 콜드", "leaf cold"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      // 일반 자켓과 시세군 다름 — 정밀 분리
      "veilance", "베일런스",
    ],
    msrpKrw: 1200000, released: 2010,
  },

  // ─── Arc'teryx Veilance (도시 premium minimalist) ───
  {
    id: "clothing-arcteryx-veilance",
    brand: "Arc'teryx Veilance", category: "clothing", laneKey: "arcteryx_veilance",
    modelName: "Arc'teryx Veilance (도시 premium minimalist)",
    aliases: ["Arc'teryx Veilance", "아크테릭스 베일런스", "베일런스"],
    mustContain: [
      ["arcteryx", "arc'teryx", "아크테릭스"],
      ["veilance", "베일런스", "베일런 스"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "leaf", "리프",
    ],
    msrpKrw: 950000, released: 2009,
  },
];
