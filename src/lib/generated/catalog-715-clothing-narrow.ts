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

// Wave 765 (2026-05-24): BAPE 아동/베이비 sub-line 공통 차단.
//   BAPE women+kids 라인 (APEE/BABY/KIDS/JR) — 가격대 다름 (어른 SKU 시세 ≠ 키즈/베이비 시세).
//   사용자 #4 발견: "베이프 APEE BABY 카모 반팔" 어른 bape_tee SKU 흡수.
//   적용 대상: bape_tee / bape_hoodie / bape_hoodie_zip / bape_crewneck / bape_shark_hoodie /
//             bape_varsity_jacket / bape_coach_jacket.
export const BAPE_SUBLINE_NOISE = [
  "apee", "에이피이",
  "bape baby", "babe bape", "베이프 베이비", "베이비 베이프",
  "bape kids", "베이프 키즈", "키즈 베이프", "bape jr", "베이프 jr",
  "키즈사이즈", "키즈 사이즈", "kids size", "아동사이즈", "아동 사이즈",
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
    msrpKrw: 1500000, minPriceKrw: 100000, released: 2003,  // Wave 767: 가품 floor
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
    msrpKrw: 1100000, minPriceKrw: 100000, released: 2003,  // Wave 767: 가품 floor
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
    msrpKrw: 950000, minPriceKrw: 50000, released: 2003,  // Wave 767: 가품 floor (사용자 #6 7,900원 매물 차단)
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
    msrpKrw: 550000, minPriceKrw: 50000, released: 2003,  // Wave 767: 가품 floor
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
    msrpKrw: 2500000, minPriceKrw: 200000, released: 2003,  // Wave 767: 가품 floor (코트 premium)
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
    msrpKrw: 750000, minPriceKrw: 50000, released: 2003,  // Wave 767: 가품 floor
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
    msrpKrw: 2200000, minPriceKrw: 300000, released: 2015,  // Wave 767: Moncler Maya 가품 다수, 30만 floor
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
    msrpKrw: 3000000, minPriceKrw: 300000, released: 2010,  // Wave 767: Grenoble premium floor
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
    msrpKrw: 1200000, minPriceKrw: 100000, released: 2015,  // Wave 767: Moncler Tricot floor
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
    msrpKrw: 230000, minPriceKrw: 100000, released: 1994,  // Wave 768: Supreme Box Logo 가품 다수, 10만 floor
  },

  // ============================================================================
  // ===== Carhartt Heritage USA 별도 (carhartt_detroit_jacket 이미 존재, 중복 방지) =====
  // ============================================================================

  // ─── Carhartt Heritage USA (미국산 라인, 가격 +50%) ───
  {
    id: "clothing-carhartt-heritage-usa",
    brand: "Carhartt USA", category: "clothing", laneKey: "carhartt_heritage_usa",
    modelName: "Carhartt Heritage USA (미국산 라인 — WIP과 시세 다름)",
    aliases: ["Carhartt USA", "칼하트 USA", "칼하트 미국산", "Carhartt Heritage"],
    mustContain: [
      ["carhartt", "칼하트"],
      ["usa", "미국", "미국산", "heritage", "헤리티지", "made in usa", "made in u.s.a"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      // WIP 라인 차단 (WIP는 별도 시세)
      "carhartt wip", "칼하트 wip", "칼하트wip",
      // 콜라보
      "supreme", "슈프림", "junya watanabe", "준야와타나베",
      "wacko maria", "와코마리아", "neighborhood", "네이버후드",
    ],
    msrpKrw: 450000, released: 1889,
  },

  // ============================================================================
  // ===== P2-P3 — 잔여 narrow split (polo_oxford vintage / adidas_trefoil archive / polo_rrl) =====
  // ============================================================================

  // ─── Polo Oxford Shirt Vintage (90s/00s archive) ───
  {
    id: "clothing-polo-oxford-vintage",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_oxford_vintage",
    modelName: "Polo Oxford Vintage (90s/00s archive — 신모델과 시세 다름)",
    aliases: ["Polo Oxford Vintage", "폴로 옥스포드 빈티지", "90s Polo Oxford"],
    mustContain: [
      ["폴로", "polo", "ralph lauren", "랄프로렌"],
      ["옥스포드", "oxford", "옥스퍼드"],
      ["빈티지", "vintage", "90s", "00s", "y2k", "올드",
       "1990", "1991", "1992", "1993", "1994", "1995", "1996", "1997", "1998", "1999",
       "90년대", "00년대", "90's", "archive", "아카이브"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "RRL", "더블 알엘", "double rl", "purple label",
      "polo bear", "베어", "키즈", "kids",
      // 신모델 차단 (별도 SKU)
      "신모델", "최신", "2024", "2025", "신상품",
    ],
    msrpKrw: 89000, released: 1990,
  },

  // ─── Polo Pique Vintage (90s/00s archive 폴로 카라티) ───
  {
    id: "clothing-polo-pique-vintage",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_pique_vintage",
    modelName: "Polo Pique Vintage (90s/00s archive 폴로 카라티)",
    aliases: ["Polo Pique Vintage", "폴로 피케 빈티지", "90s Polo Pique"],
    mustContain: [
      ["폴로", "polo", "ralph lauren", "랄프로렌"],
      ["피케", "pique", "pk", "카라티", "카라 티"],
      ["빈티지", "vintage", "90s", "00s", "y2k", "올드",
       "1990", "1991", "1992", "1993", "1994", "1995", "1996", "1997", "1998", "1999",
       "90년대", "00년대", "90's", "archive", "아카이브"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "RRL", "purple label", "polo bear", "베어",
      "키즈", "kids",
      "빅포니 성조기", "성조기 빅포니",
      "rlx",
    ],
    msrpKrw: 89000, released: 1990,
  },

  // ─── Adidas Trefoil Archive (90s/00s archive 트랙수트) ───
  {
    id: "clothing-adidas-trefoil-archive",
    brand: "Adidas Originals", category: "clothing", laneKey: "adidas_trefoil_archive",
    modelName: "Adidas Trefoil Archive (90s/00s vintage 트랙수트)",
    aliases: ["Adidas Vintage", "아디다스 빈티지", "Adidas Archive", "트레포일 빈티지"],
    mustContain: [
      ["adidas", "아디다스"],
      ["trefoil", "트레포일", "오리지널스", "originals", "트랙수트", "트랙"],
      ["빈티지", "vintage", "90s", "00s", "y2k", "올드", "old school", "올드스쿨",
       "1990", "1991", "1992", "1993", "1994", "1995", "1996", "1997", "1998", "1999",
       "archive", "아카이브"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      // 콜라보 별도
      "thug club", "떠그클럽", "sftm", "송포더뮤트", "y-3", "y3", "요지",
      "fear of god", "피어오브갓", "fog", "에센셜",
      "bape", "베이프", "kerwin", "moncler",
      "balenciaga", "발렌시아가", "prada", "프라다", "gucci", "구찌",
      "wales bonner", "웨일스",
    ],
    msrpKrw: 119000, released: 1990,
  },

  // ─── Polo Bear Vintage (90s 빈티지 베어, premium tier) ───
  {
    id: "clothing-polo-bear-vintage",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_bear_vintage",
    modelName: "Polo Bear Vintage (90s 빈티지 베어 — premium tier)",
    aliases: ["Polo Bear Vintage", "폴로 베어 빈티지", "90s Polo Bear"],
    mustContain: [
      ["폴로", "polo", "ralph lauren"],
      ["베어", "bear"],
      ["빈티지", "vintage", "90s", "y2k", "올드",
       "92년", "91년", "90년", "93년", "94년", "95년", "96년", "97년", "98년", "99년",
       "1990", "1991", "1992", "1993", "1994", "1995"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "RRL", "purple label",
      "키즈", "kids", "토들러", "스티커", "키링",
    ],
    msrpKrw: 230000, released: 1992,
  },

  // ─── Stussy 시즌 빈티지 콜라보 (FW/SS 가격 큰 변동) ───
  {
    id: "clothing-stussy-vintage-collab",
    brand: "Stussy", category: "clothing", laneKey: "stussy_vintage_collab",
    modelName: "Stussy Vintage Collab (Bape/Hysteric/Vans 한정)",
    aliases: ["Stussy Vintage", "스투시 빈티지", "Stussy Collab Vintage"],
    mustContain: [
      ["stussy", "스투시"],
      ["빈티지", "vintage", "90s", "00s", "올드", "archive", "아카이브",
       "x bape", "x hysteric", "x vans", "x dover street", "도버스트리트", "fragment", "프래그먼트"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      // nike collab은 별도
      "nike", "나이키", "stussy nike", "스투시 나이키",
      // shoe
      "운동화", "스니커즈", "sneaker",
    ],
    msrpKrw: 250000, released: 1995,
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

  // ─── Junya Watanabe × Carhartt collab (워크 라인) ───
  // Wave 716 (2026-05-23): cdg_junya 신설은 junya_watanabe_apparel broad와 중복 → 실제 collab narrow로 교체.
  {
    id: "clothing-junya-carhartt-collab",
    brand: "Junya Watanabe x Carhartt", category: "clothing", laneKey: "junya_carhartt_collab",
    modelName: "Junya Watanabe × Carhartt (워크자켓/카고팬츠 콜라보)",
    aliases: ["Junya Carhartt", "준야 칼하트", "Junya x Carhartt"],
    mustContain: [
      ["junya", "준야"],
      ["carhartt", "칼하트"],
    ],
    mustNotContain: [...COMMON_NOISE],
    msrpKrw: 750000, released: 2018,
  },

  // ─── Junya Watanabe × Levi's collab ───
  {
    id: "clothing-junya-levi-collab",
    brand: "Junya Watanabe x Levi's", category: "clothing", laneKey: "junya_levi_collab",
    modelName: "Junya Watanabe × Levi's (데님 콜라보)",
    aliases: ["Junya Levi", "준야 리바이스", "Junya x Levis"],
    mustContain: [
      ["junya", "준야"],
      ["levi", "리바이스", "리바이"],
    ],
    mustNotContain: [...COMMON_NOISE],
    msrpKrw: 700000, released: 2019,
  },

  // ─── Junya Watanabe × CP Company collab (premium tier) ───
  {
    id: "clothing-junya-cp-company-collab",
    brand: "Junya Watanabe x C.P. Company", category: "clothing", laneKey: "junya_cp_company_collab",
    modelName: "Junya Watanabe × C.P. Company (M65 파카/다운 패딩 premium)",
    aliases: ["Junya CP Company", "준야 CP 컴퍼니", "Junya x CP"],
    mustContain: [
      ["junya", "준야"],
      ["cp company", "c.p. company", "씨피컴퍼니", "씨피 컴퍼니"],
    ],
    mustNotContain: [...COMMON_NOISE],
    msrpKrw: 2200000, released: 2020,
  },

  // ─── Junya Watanabe × Brooks Brothers collab ───
  {
    id: "clothing-junya-brooks-brothers-collab",
    brand: "Junya Watanabe x Brooks Brothers", category: "clothing", laneKey: "junya_brooks_brothers_collab",
    modelName: "Junya Watanabe × Brooks Brothers (자켓/블레이저)",
    aliases: ["Junya Brooks Brothers", "준야 브룩스브라더스"],
    mustContain: [
      ["junya", "준야"],
      ["brooks brothers", "브룩스브라더스", "브룩스 브라더스"],
    ],
    mustNotContain: [...COMMON_NOISE],
    msrpKrw: 850000, released: 2018,
  },

  // ─── Acne Denim 2021M / Petit (premium 라인) ───
  {
    id: "clothing-acne-denim-premium",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_denim_premium",
    modelName: "Acne Denim Premium (2021M / Petit / Flare premium 라인 — 일반 데님과 시세 다름)",
    aliases: ["Acne 2021M", "Acne Petit", "아크네 2021m", "아크네 petit"],
    mustContain: [
      ["acne", "아크네"],
      ["데님", "denim", "청바지", "진", "jean"],
      // Wave 726 (2026-05-24): "페니실린" 모델명 추가 (sample 검증 — 2021m 페니실린 데님 351k unmatched).
      ["2021m", "petit", "petit 기장", "플레어진", "flare jean", "리버진", "river jean", "페니실린", "penicillin"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "키즈", "kids",
    ],
    msrpKrw: 600000, released: 2021,
  },

  // ─── Polo RRL Work / Chore Jacket (워크자켓 ~53만 median) ───
  // Wave 716 (2026-05-23): polo_rrl_jacket_coat 75x spread audit — work_chore 7건 median 53만 분리.
  {
    id: "clothing-polo-rrl-work-chore",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_work_chore_jacket",
    modelName: "Polo RRL Work / Chore Jacket (워크자켓)",
    aliases: ["RRL Chore", "RRL 워크자켓", "RRL 초어자켓"],
    mustContain: [
      ["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"],
      ["워크", "chore", "초어", "work jacket", "워크자켓", "초어자켓"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "키즈", "kids",
      "trucker", "트러커",
      "데님", "denim",
      "wool", "맥키노",
    ],
    msrpKrw: 530000, released: 2020,
  },

  // ─── Polo RRL Wool / Mackinaw Jacket (~90만 median) ───
  {
    id: "clothing-polo-rrl-wool-mackinaw",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_wool_mackinaw_jacket",
    modelName: "Polo RRL Wool / Mackinaw Jacket (~90만 premium tier)",
    aliases: ["RRL Wool Mackinaw", "RRL 울 맥키노", "RRL 맥키노"],
    mustContain: [
      ["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"],
      ["wool mackinaw", "맥키노", "wool 자켓", "울 자켓", "mackinaw"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "키즈", "kids", "워크", "chore", "초어",
      "trucker", "트러커",
    ],
    msrpKrw: 900000, released: 2020,
  },

  // ─── BAPE Varsity Jacket (바시티 ~22만 median) ───
  // Wave 716: bape_jacket_broad 40x spread — varsity 11건 + coach 10건 분리.
  {
    id: "clothing-bape-varsity-jacket",
    brand: "BAPE", category: "clothing", laneKey: "bape_varsity_jacket",
    modelName: "BAPE Varsity Jacket (바시티 자켓)",
    aliases: ["BAPE Varsity", "베이프 바시티"],
    mustContain: [
      ["bape", "베이프", "a bathing ape"],
      ["바시티", "varsity"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      ...BAPE_SUBLINE_NOISE,
      "키즈", "kids",
      "coach", "코치", "코치자켓",
      "down", "다운", "패딩",
    ],
    msrpKrw: 220000, released: 2018,
  },

  // ─── BAPE Coach Jacket (코치 ~19만 median) ───
  {
    id: "clothing-bape-coach-jacket",
    brand: "BAPE", category: "clothing", laneKey: "bape_coach_jacket",
    modelName: "BAPE Coach Jacket (코치 자켓)",
    aliases: ["BAPE Coach", "베이프 코치"],
    mustContain: [
      ["bape", "베이프", "a bathing ape"],
      ["coach", "코치", "코치자켓", "코치 자켓"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      ...BAPE_SUBLINE_NOISE,
      "키즈", "kids",
      "varsity", "바시티",
    ],
    msrpKrw: 190000, released: 2018,
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
      // Wave 751c (2026-05-24) Pareto: 350x spread — 전술배낭/drypack 차단 (가방 false match).
      "drypack", "dry pack", "전술배낭", "전술 배낭", "배낭", "백팩", "backpack",
      "리프 가방", "리프 백팩", "포치", "pouch", "체스트 리그", "chest rig",
    ],
    msrpKrw: 1200000, minPriceKrw: 200000, released: 2010,  // Wave 767: Arc'teryx LEAF 군용 premium floor
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
    msrpKrw: 950000, minPriceKrw: 150000, released: 2009,  // Wave 767: Veilance 도시 premium floor
  },
];
