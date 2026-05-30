import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 809 (2026-05-30): Tier S 5 카테고리 catalog 박기.
//
// Background — Wave 807/808 deepsweep:
//   daangn active 3일 안 158K건, SKU 매칭 49% (77,930), 미매칭 51% (80,892).
//   80K unmatched 중 sample 직접 추출해서 parseability 진단.
//
// owner 룰:
//   - 명품 X (가격 비쌈, 위험 큼)
//   - 비싼 거 X — 저~중저가 (₩2만~₩17만) 위주
//   - 일반인 친화 (메모리 project_core_principle_consumer_friendly)
//   - parseability ⭐⭐⭐⭐+ AND 함정 ≤30% 인 카테고리만
//
// 5 카테고리 / 9 SKU:
//   1. 레고 broad (set 번호 = unique key)
//   2. 닌텐도 스위치 게임 broad (제목 = SKU)
//   3-5. 골프 유틸리티 / 골프화 / 골프웨어 broad
//   6-7. 에어팟 4세대 / 에어팟 4세대 ANC
//   8-9. 다이슨 V8 / V10 narrow (V11/V12 비싸서 skip)
//
// 추정 새 ready: +1,750 ~ 3,250건.
//
// mustNotContain 패턴 — sample 박은 진짜 함정 (왼쪽/오른쪽 유닛만,
// 본체만/거치대만, 일괄/묶음, 임팩드라이버 (Wave 787), 조던 골프, DS 게임칩 등).
// ============================================================================

const COMMON_NOISE = [
  "삽니다", "구합니다", "구매", "구매합니다", "매입",
  "이미테이션", "fake", "짝퉁", "짭", "가품",
  "rep ", "replica", "복각",
] as const;

const PARTS_NOISE = [
  "부품", "부속품", "고장", "수리", "수리용",
  "본체만", "거치대만", "스탠드만", "모터헤드만",
  "헤드 툴만", "헤드툴만", "충전 거치대만",
  "케이스만", "박스만", "빈 박스",
  "배터리만", "충전기만",
] as const;

export const WAVE809_TIER_S_SKUS: Sku[] = [
  // ──────────────────────────────────────────────────────────────────────
  // 1. 레고 broad
  //   sample: 75345 클론트루퍼, 75376 탄티브 IV, 75339 데스 스타 등
  //   set 번호 (4~5자리) 가 unique id 역할. broad SKU 로 일단 잡고 narrow 분리 추후.
  //   함정: 일괄 매물 (11종 ₩30만 등) / 책 (DK Books) / 미니피규어만
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "lego-general-broad",
    brand: "LEGO",
    category: "lego",
    modelName: "레고 (broad)",
    aliases: ["LEGO", "레고", "Lego"],
    mustContain: [["레고", "lego"]],
    mustNotContain: [
      ...COMMON_NOISE,
      "일괄", "n종 일괄", "여러 개", "여러개", "묶음", "다양한",
      "피규어만", "미니피규어만", "미피만",
      "북스", "dk 북스", "책", "도서", "스티커북",
      "박스만", "빈 박스",
    ],
    msrpKrw: 60000,
    released: 0,
  },

  // ──────────────────────────────────────────────────────────────────────
  // 2. 닌텐도 스위치 게임 broad
  //   sample: 마리오 원더 ₩40K, 젤다 야숨 ₩41K, 마리오 오디세이 ₩45K, 동물의 숲 등
  //   가격 분포 tight: ₩2~7만
  //   함정: "본체 포함", "북미판", "DS 게임칩 N종" (오타 매칭)
  //   isGameTitle: true → pipeline 의 accessory downgrade 차단 (Wave 760 패턴)
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "game-switch-title-broad",
    brand: "Nintendo",
    category: "game_console",
    modelName: "닌텐도 스위치 게임 타이틀 (broad)",
    aliases: ["Switch Game", "스위치 게임", "닌텐도 게임"],
    mustContain: [
      ["닌텐도", "nintendo", "스위치", "switch"],
      [
        "마리오", "젤다", "포켓몬", "동물의 숲", "동숲", "동물의숲",
        "커비", "스플래툰", "스플라툰", "메트로이드",
        "야숨", "스카이워드", "토와이",
        "마리오 카트", "마리오카트", "마리오 파티", "마리오파티",
        "마리오 rpg", "마리오 메이커", "마리오 테니스",
        "오딧세이", "오디세이", "원더",
        "포켓몬 sv", "스칼렛", "바이올렛",
        "ff", "파이널 판타지", "fifa", "피파",
      ],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "본체 포함", "본체+", "본체 서비스", "+본체",
      "북미판", "북미 패키지", "북미 정발", "북미정발",
      "일괄", "n개 일괄", "묶음", "여러 개", "여러개",
      "ds 게임칩", "ds 칩", "3ds 칩",
      "조이콘만", "조이콘 단품", "조이콘 만",
      "케이스만", "빈 박스", "박스만",
    ],
    msrpKrw: 50000,
    released: 0,
    isGameTitle: true,
  },

  // ──────────────────────────────────────────────────────────────────────
  // 3. 골프 유틸리티 broad
  //   sample: 젝시오 H4 21도 ₩140K, 아담스 IDEA ₩30K, 핑 랩소디 ₩120K, OMG 13도 ₩100K
  //   함정: "임팩드라이버" (Wave 787 P0 catalog bug — 전동 공구), 조던 골프 스니커즈
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "sport-golf-utility-broad",
    brand: "골프 generic",
    category: "sport_golf",
    modelName: "골프 유틸리티 (broad)",
    aliases: ["골프채", "유틸리티"],
    mustContain: [
      ["골프"],
      ["유틸리티", "유틸", "h[0-9]", "[0-9]번 채", "[0-9]번채", "[0-9]도"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "임팩드라이버", "임팩 드라이버", "충전식 드라이버", "전동 드라이버",
      "조던", "jordan", "스위치 게임", "스위치 카트",
      "벨트만", "장갑만", "가방만", "골프공만", "샤프트만", "헤드만", "그립만",
      "골프화", "골프웨어", "스니커즈",
    ],
    msrpKrw: 200000,
    released: 0,
  },

  // ──────────────────────────────────────────────────────────────────────
  // 4. 골프화 broad
  //   sample: 뉴발 997G ₩71K, 뉴발 UGB1001W ₩100K, 언더아머 골프화 ₩40K
  //   함정: 조던 1 골프 코트 = 스니커즈 (시세 다름)
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "sport-golf-shoes-broad",
    brand: "골프화 generic",
    category: "shoe",
    modelName: "골프화 (broad)",
    aliases: ["골프화"],
    mustContain: [["골프화"]],
    mustNotContain: [
      ...COMMON_NOISE,
      "조던", "jordan", "조던 골프", "조던1 골프",
      "임팩드라이버", "스위치 게임",
      "장갑", "벨트만", "가방만",
    ],
    msrpKrw: 100000,
    released: 0,
  },

  // ──────────────────────────────────────────────────────────────────────
  // 5. 골프 웨어 broad
  //   sample: RLX 골프 하프집업 ₩40K, 디스커버리 골프웨어 반팔 ₩44K, 타이틀리스트 상의 ₩100K
  //   함정: 골프화/골프채/골프공
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "sport-golf-wear-broad",
    brand: "골프웨어 generic",
    category: "clothing",
    modelName: "골프웨어 (broad)",
    aliases: ["골프웨어"],
    mustContain: [
      ["골프"],
      [
        "반팔", "카라티", "반팔티",
        "하프집업", "하프 집업", "셔츠", "조끼", "베스트",
        "후드", "맨투맨", "스웨터", "가디건",
        "바지", "팬츠", "스커트", "원피스", "벨트",
      ],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "임팩드라이버", "조던", "스위치 게임",
      "골프채", "유틸리티", "골프공", "골프장갑",
      "골프화",
    ],
    msrpKrw: 80000,
    released: 0,
  },

  // ──────────────────────────────────────────────────────────────────────
  // 6. 에어팟 4세대 broad (ANC X)
  //   sample: 에어팟 4세대 ₩37K~160K. C타입 본체, 미개봉 등
  //   함정: 왼쪽/오른쪽 유닛만, 배터리만, 케이스만 / ANC 별도 SKU
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "earphone-airpods-4",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods 4",
    aliases: ["에어팟 4세대", "에어팟4", "AirPods 4", "에어팟4세대"],
    mustContain: [["에어팟", "airpods"], ["4세대", "4 세대", "4th", "4gen", "4 gen"]],
    mustNotContain: [
      ...COMMON_NOISE,
      ...PARTS_NOISE,
      "pro", "맥스", "max",
      "왼쪽", "오른쪽", "유닛만", "본체 없음", "본체 x",
      "anc", "노캔", "노이즈 캔슬링", "노이즈캔슬링",
      "1세대", "2세대", "3세대", "5세대",
    ],
    msrpKrw: 199000,
    released: 2024,
    confusionNote: "AirPods 4 ANC = 별도 SKU (가격 +20~50K)",
  },

  // ──────────────────────────────────────────────────────────────────────
  // 7. 에어팟 4세대 ANC broad
  //   sample: 에어팟 4세대 ANC / 노캔 / Active Noise Cancellation
  //   함정: 일반 4세대와 분리 필수 (가격 +50K)
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "earphone-airpods-4-anc",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods 4 ANC",
    aliases: ["에어팟 4 노캔", "에어팟 4세대 ANC", "AirPods 4 ANC", "에어팟4 노캔"],
    mustContain: [
      ["에어팟", "airpods"],
      ["4세대", "4 세대"],
      ["anc", "노캔", "노이즈 캔슬링", "노이즈캔슬링"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      ...PARTS_NOISE,
      "pro", "max",
      "왼쪽", "오른쪽", "유닛만",
      "1세대", "2세대", "3세대", "5세대",
    ],
    msrpKrw: 249000,
    released: 2024,
    confusionNote: "일반 AirPods 4 = 별도 SKU (ANC 없음, 가격 -50K)",
  },

  // ──────────────────────────────────────────────────────────────────────
  // 8. 다이슨 V8 narrow (저가 entry)
  //   sample: V8 무선청소기 ₩60K~170K, V8 엡솔루트 ₩170K, V8 플러피 ₩198K
  //   함정: "본체만", "거치대만", "모터헤드만", "구합니다", "헤드 툴만"
  //   참고: V11/V12 는 ₩20~38만 — 비싸서 skip (owner 룰)
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "home-appliance-dyson-v8",
    brand: "Dyson",
    category: "home_appliance",
    modelName: "Dyson V8 무선청소기",
    aliases: ["Dyson V8", "다이슨 V8", "다이슨V8"],
    mustContain: [["다이슨", "dyson"], ["v8"]],
    mustNotContain: [
      ...COMMON_NOISE,
      ...PARTS_NOISE,
      "v10", "v11", "v12", "v15", "v6", "v7",
      "supersonic", "에어랩", "airwrap", "에어스트레이트", "airstrait",
      "헤어드라이어", "고데기", "스타일러",
    ],
    msrpKrw: 800000,
    released: 0,
    confusionNote: "다이슨 헤어툴 (Supersonic/Airwrap) 과 분리 — 본 SKU 는 무선청소기만",
  },

  // ──────────────────────────────────────────────────────────────────────
  // 9. 다이슨 V10 narrow (중저가 entry)
  //   sample: V10 무선청소기 ₩260K (거치대 포함)
  //   함정: 동일 (본체만/거치대만/모터헤드만/구합니다)
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "home-appliance-dyson-v10",
    brand: "Dyson",
    category: "home_appliance",
    modelName: "Dyson V10 무선청소기",
    aliases: ["Dyson V10", "다이슨 V10", "다이슨V10"],
    mustContain: [["다이슨", "dyson"], ["v10"]],
    mustNotContain: [
      ...COMMON_NOISE,
      ...PARTS_NOISE,
      "v8", "v11", "v12", "v15", "v6", "v7",
      "supersonic", "에어랩", "airwrap", "에어스트레이트", "airstrait",
      "헤어드라이어", "고데기", "스타일러",
    ],
    msrpKrw: 1000000,
    released: 0,
    confusionNote: "다이슨 헤어툴과 분리 — 본 SKU 는 무선청소기만",
  },
];
