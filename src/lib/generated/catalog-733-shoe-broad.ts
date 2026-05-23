import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 733 (2026-05-24): 신발 broad/narrow 7 SKU 신설.
//
// Pareto sweep 결과 (last 14d, shoe signal):
//  - Salomon 43건 / p50 14만 — XT-6 ADV/GTX signature 누락
//  - Hoka 39건 / p50 12.5만 — Bondi/Anacapa/Challenger 누락
//  - On Running 28건 / p50 12만 — Cloudflow/Vista/Cloudtec/Cloudventure 누락
//  - Skechers 50건 / p50 5만 — broad SKU 자체 없음
//  - Under Armour 27건 / p50 4.8만 — Curry/Charged broad SKU 없음
//  - Camper 26건 — false positive (Adidas Campus = "캠퍼스") + 진짜 캠퍼 mix
//
// 신설 7 SKU (~250건 회수):
//  1. salomon_xt_6 (signature narrow)
//  2. salomon_broad (XT-6 외 broad)
//  3. hoka_bondi (signature narrow)
//  4. hoka_broad (Anacapa/Challenger/Transport/Stinson 등)
//  5. on_running_broad (Cloudflow/Cloudtec/Vista/Cloudventure)
//  6. skechers_broad (50건 — Go Walk/Ultra Go/Slip-Ins)
//  7. underarmour_broad (Curry/Charged 통합)
//
// Skip:
//  - Camper 26건 — false positive (Adidas Campus) 정제 후 ~15건 정도, 별 wave 분리
//  - Brooks 9건 — 풀 작음
//  - Mizuno 12건 — 풀 작음
//
// 정책:
//  - 신발 일반인 친화 brand (Skechers/Under Armour/Hoka mass)
//  - 가격대 3-25만 친화적
//  - bag/apparel 강력 차단
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
  "일괄", "벌크", "한짝", "한쪽",
] as const;

const SHOE_NON_SHOE = [
  "가방", "bag", "백팩", "토트", "크로스백", "쇼퍼",
  "지갑", "wallet", "파우치",
  "모자", "캡 ", "캡)", " cap", "비니",
  "양말", "socks", "삭스",
  "후드", "hoodie", "맨투맨", "반팔", "tee",
  "자켓", "재킷", "jacket", "패딩", "다운", "플리스",
  "팬츠", "pants", "바지", "쇼츠", "shorts",
  "셔츠", "shirt",
  "샴푸", "shampoo", "케이스", "case",
] as const;

export const WAVE_733_SHOE_BROAD: Sku[] = [
  // ※ Salomon XT-6 narrow는 catalog.ts:9460에 이미 존재 (Wave 208). 중복 신설 X.

  // ─── Salomon Broad (XT-6 외 — Pulsar/Speedcross/ACS 등) ───
  {
    id: "shoe-salomon-broad",
    brand: "Salomon", category: "shoe", laneKey: "salomon_broad",
    modelName: "Salomon Broad (Pulsar / Speedcross / Sense / Wings)",
    aliases: ["Salomon", "살로몬"],
    mustContain: [
      ["salomon", "살로몬"],
      ["pulsar", "펄사", "펄서",
       "speedcross", "스피드크로스",
       "sense", "센스",
       "wings", "윙스",  // XT-Wings 외 일반
       "xa pro", "xa-pro", "xa프로",
       "글라이드", "glide",
       "sonic", "소닉",
       "predict", "프레딕트",
       "supercross", "수퍼크로스"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...SHOE_NON_SHOE,
      // 이미 narrow SKU 있는 모델 (Wave 712b/c)
      "xt-6", "xt 6", "xt6",
      "rx slide", "rx 슬라이드",
      "phantasm", "판타즘",
      "rx mary jane", "마리 잔",
      "xt-whisper", "휘스퍼",
      "xt-4", "xt 4", "xt4",
      "xt quest", "xt 퀘스트",
      "xt-wings", "xt 윙스",
      "acs pro", "acs프로",
      "x-alp", "x alp",
      // CDG collab
      "cdg", "꼼데", "comme",
      "mm6", "margiela",
    ],
    msrpKrw: 199000, released: 1947,
  },

  // ─── Hoka Bondi (signature narrow, top-selling 모델) ───
  {
    id: "shoe-hoka-bondi",
    brand: "Hoka One One", category: "shoe", laneKey: "hoka_bondi",
    modelName: "Hoka Bondi 6/7/8/9/L (시그니처 max cushion 러닝)",
    aliases: ["Hoka Bondi", "호카 본디"],
    mustContain: [
      ["hoka", "호카", "호카원원"],
      ["bondi", "본디"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...SHOE_NON_SHOE,
      "engineered garments", "엔지니어드 가먼츠",  // EG collab 별 SKU
    ],
    msrpKrw: 230000, released: 2014,
  },

  // ─── Hoka Broad (Anacapa/Challenger/Transport/Stinson 등) ───
  {
    id: "shoe-hoka-broad",
    brand: "Hoka One One", category: "shoe", laneKey: "hoka_broad",
    modelName: "Hoka Broad (Anacapa / Challenger / Transport / Stinson / Kaha 2)",
    aliases: ["Hoka", "호카", "호카원원"],
    mustContain: [
      ["hoka", "호카", "호카원원"],
      ["아나카파", "anacapa",
       "챌린저", "challenger",
       "트랜스포트", "transport", "스타더스트", "stardust",
       "스틴슨", "stinson",
       "카하2", "kaha 2", "kaha2",  // Kaha 3는 narrow 별도
       "tor", "토르", "ora", "오라",
       "클리프톤", "clifton",  // Bondi 외 또 다른 시그니처
       "리프트", "rincon", "린콘",
       "speedgoat", "스피드고트",
       "지움", "ziom",
       "솔리마", "solimar"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...SHOE_NON_SHOE,
      // 이미 narrow 있는 모델
      "bondi", "본디",
      "kaha 3", "kaha3", "카하3",
      "mafate", "마파테",  // Xlim/Satisfy collab narrow
      "hopara", "호파라",
      "mach 6", "마하 6", "마하6",
      "cielo", "치엘로",
      // collab
      "engineered garments", "엔지니어드 가먼츠",
      "xlim", "satisfy", "사티스파이",
    ],
    msrpKrw: 199000, released: 2009,
  },

  // ─── On Running Broad (Cloudflow/Cloudtec/Vista/Cloudventure) ───
  {
    id: "shoe-on-running-broad",
    brand: "On Running", category: "shoe", laneKey: "on_running_broad",
    modelName: "On Running Broad (Cloudflow / Cloudtec / Vista / Cloudventure / Cloudswift)",
    aliases: ["On Running", "온러닝", "On"],
    mustContain: [
      ["온러닝", "on running", "on cloud", "on-cloud"],
      ["cloudflow", "클라우드플로우", "클라우드 플로우",
       "cloudtec", "클라우드텍", "클라우드테크", "cloud tec",
       "vista", "비스타",
       "cloudventure", "클라우드 벤처", "클라우드벤처",
       "cloudswift", "클라우드 스위프트", "클라우드스위프트",
       "cloudultra", "클라우드 울트라", "클라우드울트라",
       "cloud x", "클라우드 x",
       "cloud go", "클라우드 고", "클라우드고",
       "cloudtilt", "클라우드틸트",  // 다른 narrow SKU?
       "cloudtrax", "cloud trax"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...SHOE_NON_SHOE,
      // 이미 narrow 있는 모델
      "cloud 6", "클라우드 6",
      "cloudtilt mainline",  // narrow에서 보호되지만 추가 확인
      "cloudaway", "클라우드어웨이",
      "cloudboom", "클라우드붐",
      "cloudmonster", "클라우드 몬스터", "클라우드몬스터",  // 별 narrow
      // collab
      "kith", "키스 ", "loewe", "로에베",
      "post archive faction", "paf",
    ],
    msrpKrw: 169000, released: 2010,
  },

  // ─── Skechers Broad (50건 / p50 5만 — 일반인 친화) ───
  {
    id: "shoe-skechers-broad",
    brand: "Skechers", category: "shoe", laneKey: "skechers_broad",
    modelName: "Skechers Broad (Go Walk / Ultra Go / Slip-Ins / D'Lites)",
    aliases: ["Skechers", "스케쳐스", "스케처스"],
    mustContain: [
      ["스케쳐스", "스케처스", "skechers", "스케쳐", "스케처"],
      ["go walk", "고워크", "고 워크",
       "ultra go", "울트라고", "울트라 고",
       "slip-ins", "slipins", "슬립인스", "슬립 인스",
       "d'lites", "디라이츠",
       "디럭스 워커", "디럭스워커", "deluxe walker",
       "에어콜드", "air cooled", "에어 콜드",
       "맥스 쿠셔닝", "max cushioning",
       "아치 핏", "arch fit",
       "윕 라이트", "whip light",
       "운동화", "스니커즈", "워킹화",
       "슬립온", "slip on", "슬립 온"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...SHOE_NON_SHOE,
    ],
    msrpKrw: 79000, released: 1992,
  },

  // ─── Under Armour Broad (Curry signature + Charged 트레이닝) ───
  {
    id: "shoe-underarmour-broad",
    brand: "Under Armour", category: "shoe", laneKey: "underarmour_broad",
    modelName: "Under Armour Broad (Curry 농구화 + Charged 트레이닝)",
    aliases: ["Under Armour", "언더아머", "Curry", "커리"],
    mustContain: [
      ["언더아머", "under armour", "underarmour"],
      ["curry", "커리",
       "charged", "차지드", "차지",
       "hovr", "호버", "hovr",
       "록", "rock",
       "프로젝트", "project",
       "팻 타이어", "fat tire",
       "트레이닝화", "training",
       "농구화", "basketball",
       "러닝화", "running",
       "운동화", "스니커즈"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...SHOE_NON_SHOE,
      // 농구 양말 (의류 아님)
      "양말", "삭스",
    ],
    msrpKrw: 159000, released: 1996,
  },
];
