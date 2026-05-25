import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 732 (2026-05-24): Multi-brand apparel broad SKU 신설.
//
// Pareto 분석 (Wave 730-731 follow-up):
//  - K2/zara/ami_paris/anderson_bell SKIP (false positive 위주)
//  - 실 apparel impact 측정 결과:
//    * mlb_nike_jersey:  54건 / p50 12.5만  ★ (mlb_apparel_broad nike 차단으로 leak)
//    * uniqlo_collab:    17건 / p50 4.9만   (Lemaire/Marimekko/JW Anderson)
//    * thisisneverthat:  15건 / p50 5만
//    * columbia_apparel:  9건 / p50 6.2만
//    * blackyak_apparel:  8건 / p50 6.3만
//    * barbour_quilted:   4건 / p50 10.5만 (작지만 시그니처)
//    * nepa_apparel:      1건 (skip — 풀 너무 작음)
//
// 6 SKU 신설 (~107건 회수):
//  1. mlb_nike_jersey_collab — 야구 져지 (선수 시그니처)
//  2. thisisneverthat_apparel — 디스이즈네버댓 broad
//  3. uniqlo_collab_broad — Lemaire/Marimekko/JW Anderson 통합
//  4. columbia_apparel_broad — 패딩/플리스/자켓
//  5. blackyak_apparel_broad — 다운/패딩
//  6. barbour_quilted_jacket — 퀼팅 자켓 시그니처
//
// 정책:
//  - MLB 야구 져지 (선수 한정 — 친화도 ⭐⭐, 가격대 7-23만): borderline 일반인.
//    근데 사용자 정책 "친화" + "명품 X" 둘 다 충족 → ready 진행.
//  - Uniqlo collab은 premium tier (5-25만), 일반인 친화
//  - 한국 아웃도어 broad는 안전화/등산화 noise 강력 차단
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
  "일괄", "벌크",
] as const;

const OUTDOOR_SHOE_NOISE = [
  "신발", "스니커즈", "shoes", "shoe",
  "안전화", "등산화", "패딩화",
  "샌들", "sandal", "슬리퍼", "slipper",
  "장화", "부츠", "boots",
] as const;

const NON_APPAREL_GLOBAL = [
  "가방", "bag", "백팩", "토트", "크로스백",
  "지갑", "wallet", "파우치",
  "양말", "socks", "스티커",
] as const;

export const WAVE_732_MULTI_BRAND: Sku[] = [
  // ─── Nike × MLB Jersey Collab (54건 / p50 12.5만) ───
  // mlb_apparel_broad가 mustNotContain "nike" 차단함 — collab은 별 SKU 필수
  {
    id: "clothing-mlb-nike-jersey-collab",
    brand: "Nike x MLB", category: "clothing", laneKey: "mlb_nike_jersey_collab",
    modelName: "Nike × MLB Official Jersey (야구 져지/유니폼/베이퍼리미티드)",
    aliases: ["Nike MLB Jersey", "나이키 MLB 져지", "MLB 유니폼", "베이퍼리미티드"],
    mustContain: [
      ["nike", "나이키"],
      ["mlb", "엠엘비"],
      ["져지", "유니폼", "베이퍼", "vapor", "리미티드", "limited",
       "야구 져지", "베이스볼 져지", "baseball jersey",
       "풀오버 져지", "어센틱", "authentic",
       "시티커넥트", "city connect", "team",
       // 한국 시그니처 선수 (특정)
       "오타니", "ohtani", "무키 베츠", "mookie betts",
       "다저스", "dodgers", "양키스", "yankees", "레드삭스", "red sox",
       "자이언츠", "giants", "메츠", "mets", "신시내티", "cincinnati",
       "추신수", "류현진", "김광현", "이정후"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // 신발 차단
      "축구화", "야구화", "스파이크",
      ...OUTDOOR_SHOE_NOISE,
      // 모자 별 SKU
      "스냅백", "snapback", "볼캡", "ballcap", "캡 ", " cap",
      "모자만", "cap only",
      // FOG/Supreme/Bape collab 차단 (별 SKU)
      "fog", "fear of god", "피어오브갓", "supreme", "슈프림", "bape", "베이프",
      // 빈티지 별 cycle
      "00s", "90s", "올드스쿨", "vintage",
    ],
    msrpKrw: 159000, released: 2020,
  },

  // ─── Thisisneverthat Apparel Broad (15건 / p50 5만) ───
  {
    id: "clothing-thisisneverthat-broad",
    brand: "Thisisneverthat", category: "clothing", laneKey: "thisisneverthat_apparel",
    modelName: "Thisisneverthat Apparel (T로고/후드/맨투맨/반팔/자켓)",
    aliases: ["Thisisneverthat", "디스이즈네버댓", "TNT"],
    mustContain: [
      ["디스이즈네버댓", "thisisneverthat", "this is never that"],
      ["후드", "hoodie", "맨투맨", "크루넥", "스웻", "반팔", "티셔츠", "tee",
       "자켓", "jacket", "패딩", "니트", "knit",
       "팬츠", "pants", "바지", "쇼츠", "반바지", "shorts"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL, ...OUTDOOR_SHOE_NOISE,
      // collab 별 SKU
      "뉴발란스", "new balance", "뉴에라", "new era", "지샥", "g-shock",
      // phone case
      "케이스티파이", "casetify", "케이스",
      "아이폰", "iphone", "갤럭시", "galaxy",
    ],
    msrpKrw: 79000, released: 2010,
  },

  // ─── Uniqlo Collab Broad (Lemaire/Marimekko/JW Anderson/Ines/Theory) (17건 / p50 4.9만) ───
  // Wave 737 leak fix: collab brand 확장 (세실리에 반센/KAWS/Warhol/EG/JWA 누락 발견)
  {
    id: "clothing-uniqlo-collab",
    brand: "Uniqlo x Designer", category: "clothing", laneKey: "uniqlo_collab_broad",
    modelName: "Uniqlo Collab (Lemaire/Marimekko/JW Anderson/Cecilie Bahnsen/KAWS/EG)",
    aliases: ["Uniqlo Lemaire", "유니클로 르메르", "유니클로 마리메꼬", "유니클로 U", "유니클로 UT"],
    mustContain: [
      ["유니클로", "uniqlo"],
      ["르메르", "lemaire",
       "마리메꼬", "marimekko",
       "jw anderson", "anderson", "jwa",
       "이네스", "ines",
       "theory", "테오리",
       "마메", "mame",
       "유니클로 u", "uniqlo u", "uniqlo ut", "유니클로 ut",
       // Wave 737 추가
       "세실리에", "cecilie", "bahnsen", "반센",
       "kaws", "카우스",
       "워홀", "warhol",
       "engineered garments", "엔지니어드 가먼츠", "엔지니어드가먼츠", "eg",
       "supreme", "슈프림",  // Supreme x Uniqlo collab
       "마리메코"],  // 다른 표기
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // 신발/유틸리티
      "유틸리티백", "포터", "porter",
      ...OUTDOOR_SHOE_NOISE,
    ],
    msrpKrw: 79000, released: 2016,
  },

  // ─── Uniqlo Generic Broad (60건/주 / 0% 매칭 — Wave 737 새 SKU) ───
  // Wave 737 (2026-05-24): Uniqlo 일반 매물 broad SKU 자체 없음 발견 (0% 매칭).
  //   collab 외 일반 유니클로 매물 catch.
  {
    id: "clothing-uniqlo-broad",
    brand: "Uniqlo", category: "clothing", laneKey: "uniqlo_apparel_broad",
    modelName: "Uniqlo Generic Apparel (collab 외 일반)",
    aliases: ["Uniqlo", "유니클로"],
    mustContain: [
      ["uniqlo", "유니클로"],
      ["반팔", "티셔츠", "tee", "긴팔", "롱슬리브",
       "후드", "hoodie", "후디", "맨투맨", "크루넥", "스웻", "sweat",
       "셔츠", "shirt",
       "니트", "knit", "스웨터", "sweater", "카디건",
       "베스트", "vest", "조끼",
       "자켓", "jacket", "재킷", "블루종", "봄버",
       "바람막이", "windbreaker",
       "다운", "패딩", "푸퍼", "puffer", "울트라 라이트", "울트라라이트",
       "플리스", "fleece",
       "트렌치", "trench", "코트", "coat",
       "팬츠", "pants", "바지", "쇼츠", "shorts",
       "스커트", "skirt", "원피스",
       "히트텍", "heattech", "에어리즘", "airism",
       "ut", "오버사이즈"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // collab 별 SKU (uniqlo_collab_broad)
      "르메르", "lemaire",
      "마리메꼬", "marimekko",
      "jw anderson", "jwa",
      "세실리에", "cecilie", "bahnsen", "반센",
      "kaws", "카우스",
      "워홀", "warhol",
      "engineered garments", "엔지니어드 가먼츠", "엔지니어드가먼츠",
      "supreme", "슈프림",
      "마메", "mame", "이네스", "ines",
      "퍼피 숄더백", "유틸리티백",  // 가방
      // Wave 849: description-only sizing reference ("유니클로 XL 입으면") must not reroute other brands.
      // Keep coach-jacket silhouettes valid for real Uniqlo titles; block Coach brand/collab contexts instead.
      "champion", "챔피언", "coach x", "x coach", "코치 x", "x 코치", "코치x", "x코치", "가죽자켓", "레더슬리브",
    ],
    msrpKrw: 39000, released: 1949,
  },

  // ─── Columbia Apparel Broad (9건 / p50 6.2만) ───
  {
    id: "clothing-columbia-broad",
    brand: "Columbia", category: "clothing", laneKey: "columbia_apparel_broad",
    modelName: "Columbia Apparel (패딩/플리스/자켓/바람막이)",
    aliases: ["Columbia", "컬럼비아"],
    mustContain: [
      ["columbia", "컬럼비아"],
      ["다운", "패딩", "푸퍼", "puffer", "롱패딩", "숏패딩",
       "자켓", "jacket", "재킷",
       "플리스", "fleece",
       "바람막이", "windbreaker",
       "후드", "hoodie", "맨투맨"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL, ...OUTDOOR_SHOE_NOISE,
      // collab/vintage
      "supreme", "슈프림", "vintage", "빈티지", "90s",
      // 후드/모자 액세서리
      " cap", "캡", "모자만",
    ],
    msrpKrw: 99000, released: 1938,
  },

  // ─── Blackyak Apparel Broad (8건 / p50 6.3만) ───
  {
    id: "clothing-blackyak-broad",
    brand: "Blackyak", category: "clothing", laneKey: "blackyak_apparel_broad",
    modelName: "Blackyak Apparel (다운/패딩/자켓/플리스)",
    aliases: ["Blackyak", "블랙야크"],
    mustContain: [
      ["블랙야크", "blackyak", "black yak"],
      ["다운", "패딩", "푸퍼", "puffer", "롱패딩", "숏패딩",
       "자켓", "jacket", "재킷",
       "플리스", "fleece",
       "바람막이", "windbreaker",
       "후드", "hoodie",
       "베스트", "vest",
       "히말라야", "원정대", "알파"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL, ...OUTDOOR_SHOE_NOISE,
      // 모자 액세서리
      " cap", "캡 ", "모자만",
    ],
    msrpKrw: 159000, released: 1973,
  },

  // ─── Barbour Quilted Jacket (4건 / p50 10.5만 — 시그니처 명확) ───
  {
    id: "clothing-barbour-quilted-jacket",
    brand: "Barbour", category: "clothing", laneKey: "barbour_quilted_jacket",
    modelName: "Barbour Quilted Jacket (리데스데일/베델/와스드)",
    aliases: ["Barbour Quilted", "바버 퀼팅", "Barbour 자켓"],
    mustContain: [
      ["바버", "barbour"],
      ["퀼팅", "quilted", "리데스데일", "리더스데일", "ridesdale",
       "베델", "bedale", "borough", "보로우",
       "왁스드", "waxed", "리프리스", "비포트", "beaufort",
       "헤리티지", "heritage",
       "자켓", "jacket"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, ...NON_APPAREL_GLOBAL,
      // 신발 차단
      "부츠", "boots", "첼시", "chelsea",
      "웰링턴", "wellington",
      ...OUTDOOR_SHOE_NOISE,
      // 다른 brand
      "벨스타프", "belstaff",
      "polo", "폴로",
    ],
    msrpKrw: 480000, released: 1894,
  },
];
