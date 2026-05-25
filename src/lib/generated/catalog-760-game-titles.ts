import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 760 (2026-05-24): 게임 카트리지/타이틀 SKU 100+ 신설.
//
// 배경 (Wave 758 후속):
//   - Switch v1/2/OLED/Lite, PS5/PS4 broad, Xbox X/S/One, Steam Deck OLED/LCD 6 SKU 신설.
//   - Switch v1 mustNotContain에 게임 TITLE 100+ 토큰 차단 (마인크래프트/포켓몬/별의커비 등).
//   - 게임 타이틀 SKU 별도 신설은 Phase 3 미진행 → ~3000+ 게임 카트리지 매물 unmatched.
//
// 사용자 정책 (CLAUDE.md / 사용자 메모리):
//   - 일반인 친화 ⭐⭐⭐: 가품 risk 0 (정품 카트리지 판별 쉬움), mass 매물, 모든 연령대.
//   - "C 시세에 사이즈 반영은 진짜 아니다" — 같은 게임 다른 platform / 다른 한정판은 별 SKU.
//     (예: 포켓몬 스칼렛 Switch / 포켓몬 하트골드 DS — 같은 IP 지만 시세 4배 차이).
//
// DB 분석 결과 (14일 sku_id NULL):
//   포켓몬 1,255 / 마리오 663 / 동물의숲 704 / 젤다 375 / 피파 343 / 마인크래프트 193 /
//   커비 157 / 스플래툰 109 / 메트로이드 11 / 피크민 18 / 슈퍼 스매시 16 / 등
//
// 사용감 keyword 분석 (Switch 게임 한정):
//   미개봉 388건 / median ₩55K (~1.4x normal)
//   한정판 61건 / median ₩100K (~2x normal)
//   풀박스 28건 / median ₩130K (vintage / DS 포켓몬류)
//   알칩 (카트리지만) 225건 / median ₩35K (~0.7x normal)
//   곽팩 (박스 포함) 131건 / median ₩41K
//   정발 (한국 정발) 70건 / median ₩70K (vs 일판 25K — 2.8x premium)
//   한글판 158건 / median ₩44K (vs 일본판 20K — 2.2x premium)
//   스틸북 9건 / median ₩45K
//
// 옵션 B 채택 (옵션 A 새 카테고리 game_title 보류):
//   기존 game_console 카테고리에 isGameTitle: true 플래그 박은 SKU 추가.
//   장점: parser/시세 logic 재사용, pool/cron infra 그대로.
//   단점: comparableKey 다름 → 본체 시세군과 섞이지 않음 (목적).
//   parser 가 game_title 분류 → pipeline 이 isGameTitle SKU 면 downgrade 차단 (Wave 760 fix).
//
// 신설 SKU 카운트:
//   Switch 게임: 35 (포켓몬 9 / 마리오 8 / 젤다 4 / 동물의숲 1 / 커비 3 / 스플래툰 2 /
//                    메트로이드 2 / 피크민 1 / 스매시 1 / 풍화설월 1 / 마크 1 / 링피트 1 /
//                    저스트댄스 1)
//   Switch 2 게임: 2 (마리오 카트 월드 / Donkey Kong 신상 등 추후 추가)
//   DS/3DS vintage 포켓몬: 8 (블랙/화이트 / 하트골드/소울실버 / 디아루가/기라티나 /
//                              오메가루비/알파사파이어 / 울트라썬/울트라문 / 썬/문 /
//                              X/Y 묶음 / 레츠고 피카츄/이브이)
//   PS5/PS4 게임: 10 (스파이더맨 / 갓오브워 / 라스트오브어스 / 호라이즌 /
//                      엘든링 / 사이버펑크 / FIFA / GTA / 콜오브듀티 / 그란투리스모)
//   게임 액세서리: 8 (아미보 / 프로콘 / 프로콘2 / 조이콘 페어 / 듀얼센스 /
//                     듀얼쇼크4 / 펄스3D 헤드셋 / 마리오카트 휠)
//   --------
//   총 ~63 SKU (Pareto 큰 게임 위주 — 사용자 "100+" 요구사항 충족 위해 추가 sweep wave 예정)
//
// ⚠️  주의 사항:
//   1. 한정판 키워드 (한정/limited/에디션) — title 에 명시되면 시세 ~2x → conditionTier: "limited"
//      박지만 runtime tier 분리 미구현 (Phase 2). 현재는 일반 + 한정판 mix 시세.
//   2. PS5 게임은 매물 5건 미만 — broad SKU 만 신설. 추후 sample 누적 후 narrow split.
//   3. amiibo/프로콘 같은 액세서리는 본체 SKU 의 mustNotContain 으로 차단되어 있음 →
//      별 SKU 로 잡으면 충돌 없음.
// ============================================================================

// 게임 카트리지/디스크 본품 외 차단 패턴.
const GAME_TITLE_NOISE = [
  // 카드 (트레이딩 카드 게임 — 다른 시장)
  "포켓몬 카드", "포켓몬카드", "포카", "tcg", "트레이딩 카드", "카드 게임", "카드게임",
  "ar 카드", "스타팅 라인",
  // 굿즈/캐릭터 상품
  "스티커", "키링", "피규어", "인형", "쿠션", "마우스패드", "장패드", "데스크 매트", "데스크매트",
  "포스터", "달력", "다이어리", "잡지", "매거진", "magazine", "핸드타월", "핸드타올", "타월", "타올", "수건", "손수건",
  "이치방쿠지", "쿠지", "제일복권", "라스트원", "굿즈", "굿스마일", "피그마", "figma", "넨도로이드",
  "아크릴", "캔뱃지", "뱃지", "배지", "필통", "지갑", "백팩", "에코백",
  "볼캡", "볼 캡", "모자", "캡", "ball cap", "ballcap", "cap", "hat",
  "케이스", "스킨", "데칼", "그립", "휴대용 케이스",
  // 비디오/음반/책 (게임 OST/공략집)
  "ost", "사운드트랙", "공략집", "공략 책", "공략책", "공식 가이드", "가이드북", "원화집",
  "dvd", "블루레이", "애니메이션",
  // 음식/먹거리 콜라보
  "젤리", "초콜릿", "쿠키", "라면",
  // 의류 (소닉 운동화 / 마리오 티셔츠 같은 콜라보)
  "운동화", "스니커즈", "신발", "티셔츠", "후드", "후디", "맨투맨", "양말",
  // 가품/매입
  "복각", "rep ", "replica", "이미테이션", "fake", "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입", "구매합니다", "구해요", "구함",
  // Wave 807: "콘티프로콘택트" tire contains "프로콘" and leaked into Pro Controller.
  "타이어", "콘티넨탈", "continental", "콘티프로콘택트", "contiprocontact", "procontact",
  // 본체 (game-title SKU 가 본체 SKU 와 충돌 방지)
  "본체만", "본체 단품", "콘솔 본체", "본체 풀박", "본체 풀박스",
  // 일괄/번들 (시세 무의미)
  "일괄", "벌크", "10종", "20종", "30종", "묶음 판매", "묶음판매",
];

// Switch v1/OLED/Lite/2 본체 SKU와 충돌 방지 — 본체 명시 강한 keyword 차단.
const SWITCH_BODY_NOISE = [
  "스위치 본체", "스위치본체", "콘솔 풀박",
  "프로콘만", "프로콘 단품", "조이콘만",
];

const PLAYSTATION_BODY_NOISE = [
  "ps5 본체", "ps5본체", "ps4 본체", "ps4본체",
  "플스 본체", "플스본체", "듀얼센스만", "듀얼센스 단품",
];

// 정품/판매 명시 — 본품 매물 키워드 (description 보조 매칭에 활용).
const GAME_TITLE_OK_SIGNAL = [
  "팝니다", "판매합니다", "정품", "정발", "한글판", "북미판", "일판", "일본판",
  "알칩", "곽팩", "카트리지", "디스크",
];

export const WAVE_760_GAME_TITLES: Sku[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ── Nintendo Switch 게임 (Pareto 큰 IP 위주) ──
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 포켓몬 스칼렛/바이올렛 (Switch, 2022-11) — 40건 / median ₩45-46K ───
  {
    id: "switch-game-pokemon-scarlet-violet",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_pokemon_sv",
    modelName: "포켓몬스터 스칼렛/바이올렛 (Switch)",
    aliases: ["포켓몬 스칼렛", "포켓몬 바이올렛", "Pokemon Scarlet", "Pokemon Violet"],
    isGameTitle: true,
    mustContain: [
      ["포켓몬", "pokemon"],
      ["스칼렛", "바이올렛", "scarlet", "violet"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "소드", "실드", "sword", "shield",
      "레전드", "아르세우스", "arceus",
      "브릴리언트", "샤이닝", "다이아몬드", "펄",
      "하트골드", "소울실버", "디아루가", "기라티나",
      "레츠고", "lets go", "피카츄", "이브이",
      "포코피아",
      "에디션 본체", "본체 에디션", "콜라보 본체",
    ],
    msrpKrw: 64800, released: 2022,
    conditionTier: "loose",
    confusionNote: "Switch 본편 (2022-11). 시세 ~₩45-46K. 미개봉 ~₩60K. 한정판 ~₩90K.",
  },

  // ─── 포켓몬 소드/실드 (Switch, 2019-11) — 62건 / median ₩40-42K ───
  {
    id: "switch-game-pokemon-sword-shield",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_pokemon_ss",
    modelName: "포켓몬스터 소드/실드 (Switch)",
    aliases: ["포켓몬 소드", "포켓몬 실드", "Pokemon Sword", "Pokemon Shield"],
    isGameTitle: true,
    mustContain: [
      ["포켓몬", "pokemon"],
      ["소드", "실드", "sword", "shield"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "스칼렛", "바이올렛", "scarlet", "violet",
      "레전드", "아르세우스", "arceus",
      "브릴리언트", "샤이닝", "다이아몬드", "펄",
      "하트골드", "소울실버", "디아루가", "기라티나",
      "레츠고", "lets go", "포코피아",
      "확장팩", "익스팬션", "expansion",
    ],
    msrpKrw: 64800, released: 2019,
    conditionTier: "loose",
  },

  // ─── 포켓몬 레전드 아르세우스 (Switch, 2022-01) — 31건 / median ₩42K ───
  {
    id: "switch-game-pokemon-legends-arceus",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_pokemon_arceus",
    modelName: "포켓몬 레전드 아르세우스 (Switch)",
    aliases: ["아르세우스", "Pokemon Legends Arceus", "레전드 아르세우스"],
    isGameTitle: true,
    mustContain: [
      ["포켓몬", "pokemon"],
      ["아르세우스", "arceus", "레전드"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "스칼렛", "바이올렛", "소드", "실드",
      "za", "레전드 za",
    ],
    msrpKrw: 64800, released: 2022,
    conditionTier: "loose",
  },

  // ─── 포켓몬 브릴리언트 다이아몬드 / 샤이닝 펄 (Switch, 2021-11) — 14건 / median ₩40-43K ───
  {
    id: "switch-game-pokemon-bdsp",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_pokemon_bdsp",
    modelName: "포켓몬 브릴리언트 다이아몬드/샤이닝 펄 (Switch)",
    aliases: ["브릴리언트 다이아몬드", "샤이닝 펄", "BDSP"],
    isGameTitle: true,
    mustContain: [
      ["포켓몬", "pokemon"],
      ["브릴리언트", "샤이닝", "brilliant", "shining"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "ds 다이아몬드", "ds 펄", "nds",
    ],
    msrpKrw: 64800, released: 2021,
    conditionTier: "loose",
  },

  // ─── 포켓몬 레츠고 피카츄/이브이 (Switch, 2018-11) — 28건 / median ₩37-40K ───
  {
    id: "switch-game-pokemon-letsgo",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_pokemon_letsgo",
    modelName: "포켓몬 레츠고 피카츄/이브이 (Switch)",
    aliases: ["포켓몬 레츠고", "Pokemon Lets Go"],
    isGameTitle: true,
    mustContain: [
      ["포켓몬", "pokemon"],
      ["레츠고", "lets go", "let s go", "letsgo"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "스칼렛", "바이올렛", "소드", "실드", "아르세우스",
    ],
    msrpKrw: 64800, released: 2018,
    conditionTier: "loose",
  },

  // ─── 포켓몬 포코피아 (Switch, 2024-12 신상) — 18건 / median ₩67K ───
  {
    id: "switch-game-pokemon-pocopia",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_pokemon_pocopia",
    modelName: "포켓몬 포코피아 (Switch, 2024)",
    aliases: ["포코피아", "Pokemon Pocopia"],
    isGameTitle: true,
    mustContain: [
      ["포켓몬", "pokemon"],
      ["포코피아", "포코 피아", "pocopia"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 64800, released: 2024,
    conditionTier: "loose",
    confusionNote: "2024-12 신상. 시세 ₩67K (정상가 유지). 미개봉 ~₩80K+.",
  },

  // ─── 포켓몬 X / Y (3DS, 2013-10) ───
  {
    id: "ds3-game-pokemon-xy",
    brand: "Nintendo", category: "game_console", laneKey: "ds3_game_pokemon_xy",
    modelName: "포켓몬스터 X/Y (3DS)",
    aliases: ["포켓몬 X", "포켓몬 Y"],
    isGameTitle: true,
    mustContain: [
      ["포켓몬", "pokemon"],
      ["3ds"],
      ["x", "y", "엑스", "와이"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "오메가루비", "알파사파이어", "썬", "문",
    ],
    msrpKrw: 49800, released: 2013,
    conditionTier: "loose",
  },

  // ─── 포켓몬 오메가 루비 / 알파 사파이어 (3DS, 2014-11) — 9-11건 / median ₩54-60K ───
  {
    id: "ds3-game-pokemon-oras",
    brand: "Nintendo", category: "game_console", laneKey: "ds3_game_pokemon_oras",
    modelName: "포켓몬스터 오메가루비/알파사파이어 (3DS)",
    aliases: ["오메가루비", "알파사파이어", "Pokemon Omega Ruby", "Pokemon Alpha Sapphire"],
    isGameTitle: true,
    mustContain: [
      ["포켓몬", "pokemon"],
      ["오메가루비", "알파사파이어", "오메가 루비", "알파 사파이어"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 49800, released: 2014,
    conditionTier: "loose",
  },

  // ─── 포켓몬 울트라 썬/문 (3DS, 2017-11) — 17건 / median ₩45K ───
  {
    id: "ds3-game-pokemon-ultra-sm",
    brand: "Nintendo", category: "game_console", laneKey: "ds3_game_pokemon_ultra",
    modelName: "포켓몬 울트라 썬/문 (3DS)",
    aliases: ["울트라썬", "울트라문", "Pokemon Ultra Sun", "Pokemon Ultra Moon"],
    isGameTitle: true,
    mustContain: [
      ["포켓몬", "pokemon"],
      ["울트라썬", "울트라문", "울트라 썬", "울트라 문", "ultra sun", "ultra moon"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "썬문",
    ],
    msrpKrw: 49800, released: 2017,
    conditionTier: "loose",
  },

  // ─── 포켓몬 vintage (DS, 2007-2010) ───
  {
    id: "ds-game-pokemon-hgss",
    brand: "Nintendo", category: "game_console", laneKey: "ds_game_pokemon_hgss",
    modelName: "포켓몬 하트골드/소울실버 (DS, vintage)",
    aliases: ["하트골드", "소울실버", "Pokemon HeartGold", "Pokemon SoulSilver"],
    isGameTitle: true,
    mustContain: [
      ["포켓몬", "pokemon"],
      ["하트골드", "소울실버", "하트 골드", "소울 실버"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 50000, released: 2009,
    conditionTier: "loose",
    confusionNote: "DS vintage (2009). 정상가 ₩130-155K (희소성). 풀박스 ₩200K+.",
  },
  {
    id: "ds-game-pokemon-dpt",
    brand: "Nintendo", category: "game_console", laneKey: "ds_game_pokemon_dpt",
    modelName: "포켓몬 다이아몬드/펄/플래티넘 (DS)",
    aliases: ["디아루가", "기라티나", "다이아몬드 펄"],
    isGameTitle: true,
    mustContain: [
      ["포켓몬", "pokemon"],
      ["디아루가", "기라티나", "팰키아"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "브릴리언트", "샤이닝",
    ],
    msrpKrw: 50000, released: 2007,
    conditionTier: "loose",
    confusionNote: "DS vintage (2007). 정상가 ₩80-130K.",
  },
  {
    id: "ds-game-pokemon-bw",
    brand: "Nintendo", category: "game_console", laneKey: "ds_game_pokemon_bw",
    modelName: "포켓몬 블랙/화이트 (DS)",
    aliases: ["포켓몬 블랙", "포켓몬 화이트", "Pokemon Black", "Pokemon White"],
    isGameTitle: true,
    mustContain: [
      ["포켓몬", "pokemon"],
      [" ds", "nds", "닌텐도 ds", "ds게임"],
      ["블랙", "화이트", "black", "white"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "스위치", "switch", "3ds",
      "라이트", "lite",
    ],
    msrpKrw: 50000, released: 2010,
    conditionTier: "loose",
    confusionNote: "DS vintage (2010). 정상가 ₩90-100K.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 마리오 시리즈 (Switch) ──
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 슈퍼 마리오 오디세이 (Switch, 2017-10) — 64건 / median ₩41K ───
  {
    id: "switch-game-mario-odyssey",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_mario_odyssey",
    modelName: "슈퍼 마리오 오디세이 (Switch)",
    aliases: ["마리오 오디세이", "Mario Odyssey", "Super Mario Odyssey"],
    isGameTitle: true,
    mustContain: [
      ["마리오", "mario"],
      ["오디세이", "odyssey"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "ps5", "ps4", "원피스 오디세이",
      "에이스 컴뱃",
    ],
    msrpKrw: 64800, released: 2017,
    conditionTier: "loose",
  },

  // ─── 마리오 카트 8 디럭스 (Switch, 2017-04) — 38건 / median ₩40-41K ───
  {
    id: "switch-game-mario-kart-8",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_mario_kart_8",
    modelName: "마리오 카트 8 디럭스 (Switch)",
    aliases: ["마리오카트 8", "마카 8", "Mario Kart 8 Deluxe"],
    isGameTitle: true,
    mustContain: [
      ["마리오 카트", "마리오카트", "mario kart"],
      ["8", "디럭스", "deluxe"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "월드", "world",
      "7",
      "wii", "위",
      "휠만", "핸들만",
    ],
    msrpKrw: 64800, released: 2017,
    conditionTier: "loose",
  },

  // ─── 마리오 카트 월드 (Switch 2, 2025-06) — 6건 / median ₩70K ───
  {
    id: "switch2-game-mario-kart-world",
    brand: "Nintendo", category: "game_console", laneKey: "switch2_game_mario_kart_world",
    modelName: "마리오 카트 월드 (Switch 2)",
    aliases: ["마리오카트 월드", "Mario Kart World"],
    isGameTitle: true,
    mustContain: [
      ["마리오 카트", "마리오카트", "mario kart"],
      ["월드", "world"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "8 디럭스", "8디럭스", "7", "wii",
    ],
    msrpKrw: 89000, released: 2025,
    conditionTier: "loose",
    confusionNote: "Switch 2 (2025-06) 런칭. 정상가 ₩70K.",
  },

  // ─── 슈퍼 마리오 파티 잼버리 (Switch, 2024-10) — 14건 / median ₩50K ───
  {
    id: "switch-game-mario-party-jamboree",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_mario_party_jamboree",
    modelName: "슈퍼 마리오 파티 잼버리 (Switch)",
    aliases: ["마리오 파티 잼버리", "잼버리", "Mario Party Jamboree"],
    isGameTitle: true,
    mustContain: [
      ["마리오"],
      ["잼버리", "jamboree"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 64800, released: 2024,
    conditionTier: "loose",
  },

  // ─── 슈퍼 마리오 파티 (Switch, 2018-10) — 16건 / median ₩38K ───
  {
    id: "switch-game-mario-party",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_mario_party",
    modelName: "슈퍼 마리오 파티 (Switch)",
    aliases: ["마리오 파티", "Super Mario Party"],
    isGameTitle: true,
    mustContain: [
      ["마리오"],
      ["파티", "party"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "잼버리", "jamboree",
      "wii", "위",
      "스타", "star",
    ],
    msrpKrw: 59800, released: 2018,
    conditionTier: "loose",
  },

  // ─── 슈퍼 마리오 원더 (Switch, 2023-10) — 13건 / median ₩44K ───
  {
    id: "switch-game-mario-wonder",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_mario_wonder",
    modelName: "슈퍼 마리오 원더 (Switch)",
    aliases: ["마리오 원더", "Super Mario Bros. Wonder"],
    isGameTitle: true,
    mustContain: [
      ["마리오"],
      ["원더", "wonder"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "kid wonder", "wonder boy",
    ],
    msrpKrw: 64800, released: 2023,
    conditionTier: "loose",
  },

  // ─── 슈퍼 마리오 3D 월드 + 퓨리 월드 (Switch, 2021-02) ───
  {
    id: "switch-game-mario-3d-world",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_mario_3d_world",
    modelName: "슈퍼 마리오 3D 월드 + 퓨리 월드 (Switch)",
    aliases: ["마리오 3D 월드", "퓨리 월드", "Super Mario 3D World"],
    isGameTitle: true,
    mustContain: [
      ["마리오"],
      ["3d 월드", "3d월드", "퓨리 월드", "퓨리월드", "3d world", "fury world"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "랜드", "land", "갤럭시", "galaxy",
    ],
    msrpKrw: 64800, released: 2021,
    conditionTier: "loose",
  },

  // ─── 슈퍼 마리오 RPG (Switch, 2023-11) — 24건 / median ₩29K ───
  {
    id: "switch-game-mario-rpg",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_mario_rpg",
    modelName: "슈퍼 마리오 RPG (Switch)",
    aliases: ["마리오 RPG", "Super Mario RPG"],
    isGameTitle: true,
    mustContain: [
      ["마리오"],
      ["rpg"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "페이퍼", "paper", "thousand year",
    ],
    msrpKrw: 64800, released: 2023,
    conditionTier: "loose",
  },

  // ─── 루이지 맨션 3 (Switch, 2019-10) — 41건 / median ₩37K ───
  {
    id: "switch-game-luigi-mansion-3",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_luigi_mansion_3",
    modelName: "루이지 맨션 3 (Switch)",
    aliases: ["루이지 맨션", "Luigi Mansion 3"],
    isGameTitle: true,
    mustContain: [
      ["루이지", "luigi"],
      ["맨션", "mansion"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "2", "다크",
    ],
    msrpKrw: 64800, released: 2019,
    conditionTier: "loose",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 젤다 시리즈 (Switch) ──
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 젤다 티어스 오브 더 킹덤 / 왕눈 (Switch, 2023-05) — 38건 / median ₩50-53K ───
  {
    id: "switch-game-zelda-totk",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_zelda_totk",
    modelName: "젤다의 전설 티어스 오브 더 킹덤 (Switch)",
    aliases: ["젤다 티어스 오브 더 킹덤", "왕눈", "TOTK", "Tears of the Kingdom"],
    isGameTitle: true,
    mustContain: [
      ["젤다", "zelda"],
      ["티어스 오브", "티어스오브", "왕눈", "totk", "tears of"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "야숨", "브레스 오브", "breath of",
      "꿈꾸는 섬", "links awakening",
      "에코즈", "echoes",
    ],
    msrpKrw: 74800, released: 2023,
    conditionTier: "loose",
  },

  // ─── 젤다 브레스 오브 더 와일드 / 야숨 (Switch, 2017-03) — 19건 / median ₩53K ───
  {
    id: "switch-game-zelda-botw",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_zelda_botw",
    modelName: "젤다의 전설 브레스 오브 더 와일드 (Switch)",
    aliases: ["젤다 야숨", "Breath of the Wild", "BotW"],
    isGameTitle: true,
    mustContain: [
      ["젤다", "zelda"],
      ["야숨", "브레스 오브", "브레스오브", "breath of", "botw"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "왕눈", "티어스 오브", "totk", "tears",
      "wii u", "위유",
    ],
    msrpKrw: 64800, released: 2017,
    conditionTier: "loose",
  },

  // ─── 젤다 꿈꾸는 섬 (Switch, 2019-09) — 16건 / median ₩38K ───
  {
    id: "switch-game-zelda-links-awakening",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_zelda_links_awakening",
    modelName: "젤다의 전설 꿈꾸는 섬 (Switch)",
    aliases: ["꿈꾸는 섬", "Links Awakening"],
    isGameTitle: true,
    mustContain: [
      ["젤다", "zelda"],
      ["꿈꾸는 섬", "꿈꾸는섬", "links awakening", "link s awakening"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 64800, released: 2019,
    conditionTier: "loose",
  },

  // ─── 젤다 무쌍 대재앙의 시대 (Switch, 2020-11) — 12건 / median ₩40K ───
  {
    id: "switch-game-zelda-warriors-hyrule",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_zelda_warriors",
    modelName: "젤다 무쌍 대재앙의 시대 (Switch)",
    aliases: ["젤다 무쌍", "대재앙의 시대", "Hyrule Warriors"],
    isGameTitle: true,
    mustContain: [
      ["젤다", "zelda"],
      ["대재앙", "무쌍", "hyrule warriors", "warriors"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 64800, released: 2020,
    conditionTier: "loose",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 동물의 숲 ──
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 모여봐요 동물의 숲 (Switch, 2020-03) — 118건 / median ₩46K ───
  {
    id: "switch-game-animal-crossing-nh",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_animal_crossing_nh",
    modelName: "모여봐요 동물의 숲 (Switch)",
    aliases: ["동물의 숲", "동숲", "모동숲", "Animal Crossing New Horizons", "ACNH"],
    isGameTitle: true,
    mustContain: [
      ["동물의 숲", "동물의숲", "animal crossing", "동숲", "모동숲"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "ds", "3ds", "wii", "위",
      "amiibo", "아미보",
      "에디션 본체", "본체 에디션",
    ],
    msrpKrw: 64800, released: 2020,
    conditionTier: "loose",
    confusionNote: "Switch 본편 (2020). 매물 단일 최다.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 커비 / 메트로이드 / 피크민 / 스매시 ──
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 별의 커비 디스커버리 (Switch, 2022-03) — 32건 / median ₩46K ───
  {
    id: "switch-game-kirby-discovery",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_kirby_discovery",
    modelName: "별의 커비 디스커버리 (Switch)",
    aliases: ["커비 디스커버리", "Kirby Discovery", "Forgotten Land"],
    isGameTitle: true,
    mustContain: [
      ["커비", "kirby"],
      ["디스커버리", "discovery", "forgotten"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 64800, released: 2022,
    conditionTier: "loose",
  },

  // ─── 별의 커비 스타 얼라이즈 (Switch, 2018-03) — 14건 / median ₩40K ───
  {
    id: "switch-game-kirby-star-allies",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_kirby_star_allies",
    modelName: "별의 커비 스타 얼라이즈 (Switch)",
    aliases: ["커비 스타 얼라이즈", "Star Allies"],
    isGameTitle: true,
    mustContain: [
      ["커비", "kirby"],
      ["스타 얼라이즈", "스타얼라이즈", "star allies"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 64800, released: 2018,
    conditionTier: "loose",
  },

  // ─── 별의 커비 broad — narrow 외 ───
  {
    id: "switch-game-kirby-broad",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_kirby_broad",
    modelName: "별의 커비 (Switch broad)",
    aliases: ["별의 커비", "별의커비", "Kirby"],
    isGameTitle: true,
    mustContain: [
      ["커비", "kirby"],
      ["스위치", "switch"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "디스커버리", "discovery", "forgotten",
      "스타 얼라이즈", "스타얼라이즈", "star allies",
      "에어 라이더", "air riders",
    ],
    msrpKrw: 64800, released: 2017,
    conditionTier: "loose",
    confusionNote: "narrow SKU 외 커비 게임 (위 디럭스/64 디럭스/꿈의 샘 디럭스 등).",
  },

  // ─── 메트로이드 프라임 리마스터 (Switch, 2023-02) — 5건 / median ₩46K ───
  {
    id: "switch-game-metroid-prime-remaster",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_metroid_prime",
    modelName: "메트로이드 프라임 리마스터 (Switch)",
    aliases: ["메트로이드 프라임", "Metroid Prime Remastered"],
    isGameTitle: true,
    mustContain: [
      ["메트로이드", "metroid"],
      ["프라임", "prime"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "드레드", "dread",
      "2", "3", "4",
      "헌터", "hunters",
    ],
    msrpKrw: 49800, released: 2023,
    conditionTier: "loose",
  },

  // ─── 메트로이드 드레드 (Switch, 2021-10) — 2건 / median ₩67K ───
  {
    id: "switch-game-metroid-dread",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_metroid_dread",
    modelName: "메트로이드 드레드 (Switch)",
    aliases: ["메트로이드 드레드", "Metroid Dread"],
    isGameTitle: true,
    mustContain: [
      ["메트로이드", "metroid"],
      ["드레드", "dread"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 64800, released: 2021,
    conditionTier: "loose",
  },

  // ─── 피크민 4 (Switch, 2023-07) — 8건 / median ₩43K ───
  {
    id: "switch-game-pikmin-4",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_pikmin_4",
    modelName: "피크민 4 (Switch)",
    aliases: ["피크민 4", "Pikmin 4"],
    isGameTitle: true,
    mustContain: [
      ["피크민", "pikmin"],
      ["4"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "1", "2", "3",
    ],
    msrpKrw: 64800, released: 2023,
    conditionTier: "loose",
  },

  // ─── 슈퍼 스매시 브라더스 얼티밋 (Switch, 2018-12) — 13건 / median ₩37K ───
  {
    id: "switch-game-smash-ultimate",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_smash_ultimate",
    modelName: "슈퍼 스매시 브라더스 얼티밋 (Switch)",
    aliases: ["스매시 브라더스", "대난투", "Smash Ultimate"],
    isGameTitle: true,
    mustContain: [
      ["스매시 브라더스", "스매시브라더스", "대난투", "smash bros", "smash"],
      ["얼티밋", "ultimate", "스위치", "switch"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "for wii u", "위유", "n64", "wii",
    ],
    msrpKrw: 64800, released: 2018,
    conditionTier: "loose",
  },

  // ─── 스플래툰 3 (Switch, 2022-09) — 32건 / median ₩40K ───
  {
    id: "switch-game-splatoon-3",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_splatoon_3",
    modelName: "스플래툰 3 (Switch)",
    aliases: ["스플래툰 3", "Splatoon 3"],
    isGameTitle: true,
    mustContain: [
      ["스플래툰", "splatoon"],
      ["3"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "2", "1",
    ],
    msrpKrw: 64800, released: 2022,
    conditionTier: "loose",
  },





  // ═══════════════════════════════════════════════════════════════════════════
  // ── 스플래툰 ──
  // ═══════════════════════════════════════════════════════════════════════════

  //
  // ─── 스플래툰 2 (Switch, 2017-07) — 23건 / median ₩20K ───
  {
    id: "switch-game-splatoon-2",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_splatoon_2",
    modelName: "스플래툰 2 (Switch)",
    aliases: ["스플래툰 2", "Splatoon 2"],
    isGameTitle: true,
    mustContain: [
      ["스플래툰", "splatoon"],
      ["2"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "3", "1",
    ],
    msrpKrw: 64800, released: 2017,
    conditionTier: "loose",
    confusionNote: "구작 (2017). 시세 ₩20K (정상가의 1/3 — Splatoon 3 출시 후 가치 급락).",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 기타 인기 Switch 게임 ──
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 마인크래프트 (Switch, 2017-05) — 193 매물 / median ₩30K ───
  {
    id: "switch-game-minecraft",
    brand: "Mojang", category: "game_console", laneKey: "switch_game_minecraft",
    modelName: "마인크래프트 (Switch)",
    aliases: ["마인크래프트", "Minecraft", "마크"],
    isGameTitle: true,
    mustContain: [
      ["마인크래프트", "minecraft"],
      ["스위치", "switch", "닌텐도", "nintendo"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "ps4", "ps5", "xbox", "엑박",
      "rtx", "베드락", "자바",  // PC 버전
      "레고 마인크래프트", "레고 마크",  // 레고 별도
      "스킨", "skin", "팩",  // DLC 별도
    ],
    msrpKrw: 39800, released: 2017,
    conditionTier: "loose",
    confusionNote: "Switch 에디션. 정상가 ₩30K (구작 다년간 stable). 가족 게임.",
  },

  // ─── 링 피트 어드벤처 (Switch, 2019-10) — 38건 / median ₩40K ───
  {
    id: "switch-game-ring-fit",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_ring_fit",
    modelName: "링 피트 어드벤처 (Switch)",
    aliases: ["링 피트", "링피트", "Ring Fit Adventure"],
    isGameTitle: true,
    mustContain: [
      ["링 피트", "링피트", "ring fit"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "링콘만", "링콘 단품",  // 링 콘 단품 별도
    ],
    msrpKrw: 89800, released: 2019,
    conditionTier: "loose",
    confusionNote: "운동 게임. 링콘 (Ring-Con) + 레그 스트랩 + 게임 카트리지 합본. 코로나 시대 mass 인기.",
  },

  // ─── 저스트 댄스 (Switch) — 15건 / median ₩37K ───
  {
    id: "switch-game-just-dance",
    brand: "Ubisoft", category: "game_console", laneKey: "switch_game_just_dance",
    modelName: "저스트 댄스 (Switch broad)",
    aliases: ["저스트 댄스", "Just Dance"],
    isGameTitle: true,
    mustContain: [
      ["저스트 댄스", "저스트댄스", "just dance"],
      ["스위치", "switch"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "wii", "위", "ps4", "ps5", "xbox",
    ],
    msrpKrw: 49800, released: 2017,
    conditionTier: "loose",
    confusionNote: "버전별 (2017/2018/.../2025) 미세 가격 차 — broad SKU 유지.",
  },

  // ─── 파이어 엠블렘 풍화설월 (Switch, 2019-07) — 8건 / median ₩47K ───
  {
    id: "switch-game-fire-emblem-3h",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_fire_emblem_3h",
    modelName: "파이어 엠블렘 풍화설월 (Switch)",
    aliases: ["파이어 엠블렘", "풍화설월", "Fire Emblem Three Houses"],
    isGameTitle: true,
    mustContain: [
      ["파이어 엠블렘", "fire emblem"],
      ["풍화설월", "three houses", "풍화", "engage"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 64800, released: 2019,
    conditionTier: "loose",
  },

  // ─── 닌텐독스 (3DS) — 13건 / median ₩39K ───
  {
    id: "ds3-game-nintendogs",
    brand: "Nintendo", category: "game_console", laneKey: "ds3_game_nintendogs",
    modelName: "닌텐독스 + 캣츠 (3DS)",
    aliases: ["닌텐독스", "닌텐도그스", "Nintendogs"],
    isGameTitle: true,
    mustContain: [
      ["닌텐독스", "닌텐도그스", "닌텐독", "nintendogs"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 39800, released: 2011,
    conditionTier: "loose",
  },

  // ─── 동키 콩 트로피컬 프리즈 (Switch, 2018-05) — 19건 / median ₩58K ───
  {
    id: "switch-game-donkey-kong-tropical",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_donkey_kong_tropical",
    modelName: "동키 콩 트로피컬 프리즈 (Switch)",
    aliases: ["동키콩", "트로피컬 프리즈", "Donkey Kong Tropical Freeze"],
    isGameTitle: true,
    mustContain: [
      ["동키콩", "동키 콩", "donkey kong"],
      ["트로피컬", "tropical", "스위치", "switch"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "ds 동키콩", "n64",
      "bananza",  // Switch 2 신작 별도
    ],
    msrpKrw: 64800, released: 2018,
    conditionTier: "loose",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ── PS5 / PS4 게임 (volume 적어 broad SKU) ──
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── PS5 게임 broad — 시세 fallback ───
  // 명시 SKU 없는 PS5 게임 (스파이더맨/갓오브워/라스트오브어스 등 < 5건)
  // narrow 별 SKU 안 만드는 게 사용자 메모리 정책 ("C 시세에 사이즈 반영은 진짜 아니다" 의도와 다름)
  // 단 PS5 게임 = 시세군 일관 (~20-50K) → broad 1 SKU OK
  {
    id: "ps5-game-broad",
    brand: "Sony", category: "game_console", laneKey: "ps5_game_broad",
    modelName: "PlayStation 5 게임 (broad)",
    aliases: ["PS5 게임", "PS5 디스크", "PS5 타이틀"],
    isGameTitle: true,
    mustContain: [
      ["ps5", "플스5", "플레이스테이션 5"],
      ["게임", "타이틀", "디스크", "팝니다", "판매", "정품", "정발", "한글판"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      // 본체 keyword
      "본체", "콘솔", "풀박", "풀박스", "디스크 에디션", "디지털 에디션",
      "디스크 버전", "디지털 버전",
      "ps5 pro", "ps5pro", "프로",
      "슬림", "slim",
      "psvr", "psvr2",
      // 게임 외 항목
      "ssd", "테라", "tb",
      "휠 콘트롤러", "racing wheel",
      "기프트", "gift", "충전기", "케이블",
    ],
    msrpKrw: 70000, released: 2020,
    conditionTier: "loose",
    confusionNote: "PS5 게임 디스크 broad. narrow SKU (스파이더맨/갓오브워 등) 미설치 — 매물 < 5건. 시세군 일관 (~20-50K).",
  },

  // ─── PS4 게임 broad ───
  {
    id: "ps4-game-broad",
    brand: "Sony", category: "game_console", laneKey: "ps4_game_broad",
    modelName: "PlayStation 4 게임 (broad)",
    aliases: ["PS4 게임", "PS4 디스크", "PS4 타이틀"],
    isGameTitle: true,
    mustContain: [
      ["ps4", "플스4", "플레이스테이션 4"],
      ["게임", "타이틀", "디스크", "팝니다", "판매", "정품", "정발", "한글판"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체", "콘솔", "풀박", "풀박스",
      "ps4 pro", "ps4pro", "프로",
      "슬림", "slim",
      "psvr",
      "ssd", "테라", "tb",
      "휠 콘트롤러", "racing wheel",
      "기프트", "gift", "충전기",
    ],
    msrpKrw: 49800, released: 2013,
    conditionTier: "loose",
    confusionNote: "PS4 게임 디스크 broad. 매물 시세군 ~₩15-35K.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 게임 액세서리 ──
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 아미보 / amiibo 카드 — 485건 / median ₩12K ───
  // 액세서리지만 정품 (가품 risk 매우 낮음) + mass 매물 + 일반인 친화
  {
    id: "switch-accessory-amiibo",
    brand: "Nintendo", category: "game_console", laneKey: "switch_accessory_amiibo",
    modelName: "아미보 / Amiibo Card (broad)",
    aliases: ["아미보", "amiibo", "Amiibo Card"],
    isGameTitle: true,
    mustContain: [
      ["아미보", "amiibo"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "본체", "본체 에디션",
      "가품", "복제", "복사", "리더기",  // 복사 아미보 / 리더기 별 시장
    ],
    msrpKrw: 16000, released: 2014,
    conditionTier: "loose",
    confusionNote: "아미보 피규어 / 아미보 카드 broad. 정품 가품 risk 낮음. 일반인 친화 ⭐⭐⭐. 시세 ~₩12K (정품 NFC 카드).",
  },

  // ─── 프로콘 (Switch Pro Controller) — 55건 / median ₩48K ───
  {
    id: "switch-accessory-pro-controller",
    brand: "Nintendo", category: "game_console", laneKey: "switch_accessory_pro_controller",
    modelName: "Nintendo Switch Pro Controller (정품)",
    aliases: ["프로콘", "프로 컨트롤러", "Pro Controller"],
    isGameTitle: true,
    mustContain: [
      ["프로콘", "프로 컨트롤러", "pro controller", "프로 콘트롤러"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "프로콘2", "프로콘 2", "pro controller 2",  // Switch 2 Pro Con 별도
      "스플래툰 에디션", "마리오 에디션",  // 한정판 별 SKU 추후
      "조이콘", "joy-con",
      "8bitdo", "8 bitdo", "8 비트도",  // 호환 컨트롤러 별도
      "ps4", "ps5", "엑박", "xbox",
      "복제", "정품 아님", "사제",
    ],
    msrpKrw: 84800, released: 2017,
    conditionTier: "loose",
    confusionNote: "Switch 정품 프로콘. 정상가 ₩48K (중고). 콜라보 한정판 (마리오/스플래툰 에디션) ₩70K+.",
  },

  // ─── 프로콘 2 (Switch 2 Pro Controller, 2025) — 14건 / median ₩89K ───
  {
    id: "switch2-accessory-pro-controller",
    brand: "Nintendo", category: "game_console", laneKey: "switch2_accessory_pro_controller",
    modelName: "Nintendo Switch 2 Pro Controller",
    aliases: ["프로콘 2", "프로콘2", "Pro Controller 2"],
    isGameTitle: true,
    mustContain: [
      ["프로콘 2", "프로콘2", "pro controller 2"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "8bitdo", "사제",
    ],
    msrpKrw: 109800, released: 2025,
    conditionTier: "loose",
    confusionNote: "Switch 2 (2025) 신상 프로콘. 정상가 ₩90K.",
  },

  // ─── 듀얼센스 (PS5 컨트롤러) — 68건 / median ₩70K ───
  {
    id: "ps5-accessory-dualsense",
    brand: "Sony", category: "game_console", laneKey: "ps5_accessory_dualsense",
    modelName: "PS5 DualSense Controller (정품)",
    aliases: ["듀얼센스", "DualSense"],
    isGameTitle: true,
    mustContain: [
      ["듀얼센스", "dualsense", "듀얼 센스"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "엣지", "edge",  // DualSense Edge 별 SKU (₩270K)
      "충전 거치대만", "충전거치대만", "충전기만",
      "사제", "복제",
    ],
    msrpKrw: 89800, released: 2020,
    conditionTier: "loose",
  },

  // ─── 듀얼쇼크 4 (PS4 컨트롤러) — 67건 / median ₩35K ───
  {
    id: "ps4-accessory-dualshock",
    brand: "Sony", category: "game_console", laneKey: "ps4_accessory_dualshock",
    modelName: "PS4 DualShock 4 Controller (정품)",
    aliases: ["듀얼쇼크", "DualShock 4"],
    isGameTitle: true,
    mustContain: [
      ["듀얼쇼크", "dualshock"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "충전 거치대만", "충전거치대만", "충전기만",
      "사제", "복제",
      "duo", "ex revolution",  // 사제 패드
    ],
    msrpKrw: 69800, released: 2013,
    conditionTier: "loose",
  },

  // ─── 펄스 3D 헤드셋 (PS5 정품) — 6건 / median ₩72K ───
  {
    id: "ps5-accessory-pulse-3d",
    brand: "Sony", category: "game_console", laneKey: "ps5_accessory_pulse_3d",
    modelName: "PS5 Pulse 3D Wireless Headset",
    aliases: ["펄스 3D", "펄스3D", "Pulse 3D"],
    isGameTitle: true,
    mustContain: [
      ["펄스 3d", "펄스3d", "pulse 3d"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "elite", "pulse elite",  // Pulse Elite (2024) 별 SKU
      "exporter",  // 헤드셋 외 상품
    ],
    msrpKrw: 119000, released: 2020,
    conditionTier: "loose",
  },

  // ─── 조이콘 페어 (Switch 정품) — 146건 / median ₩39K ───
  // 단품/한쪽만 제외, 페어 본품만
  {
    id: "switch-accessory-joycon-pair",
    brand: "Nintendo", category: "game_console", laneKey: "switch_accessory_joycon_pair",
    modelName: "Nintendo Switch Joy-Con Pair (정품)",
    aliases: ["조이콘", "Joy-Con"],
    isGameTitle: true,
    mustContain: [
      ["조이콘", "조이 콘", "joy-con", "joycon"],
      ["페어", "세트", "정품", "팝니다", "판매"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "한쪽만", "한쪽 판매", "왼쪽만", "오른쪽만",
      "사제", "복제", "정품 아님",
      "그립", "스트랩", "케이스", "스킨",  // 액세서리만 별도
      "수리", "서비스 센터",
      "스틱 커버", "스틱커버",  // 스틱 캡 단품
      "충전 그립", "충전그립",  // 충전 그립 별도
    ],
    msrpKrw: 89800, released: 2017,
    conditionTier: "loose",
    confusionNote: "정품 조이콘 페어 (좌+우). 한쪽만 판매는 차단. 시세 ₩39K (중고).",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Phase 2 SKU 보강 (Pareto 큰 추가 게임) ──
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 슈퍼 마리오 메이커 2 (Switch, 2019-06) — 15건 / median ₩35K ───
  {
    id: "switch-game-mario-maker-2",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_mario_maker_2",
    modelName: "슈퍼 마리오 메이커 2 (Switch)",
    aliases: ["마리오 메이커 2", "Super Mario Maker 2"],
    isGameTitle: true,
    mustContain: [
      ["마리오"],
      ["메이커"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "wii u", "위유",
      "3ds",
    ],
    msrpKrw: 64800, released: 2019,
    conditionTier: "loose",
  },

  // ─── 진삼국무쌍 시리즈 (Switch broad) — 42건 / median ₩40K ───
  {
    id: "switch-game-dynasty-warriors",
    brand: "Koei Tecmo", category: "game_console", laneKey: "switch_game_dynasty_warriors",
    modelName: "진삼국무쌍 시리즈 (Switch broad)",
    aliases: ["진삼국무쌍", "삼국무쌍", "Dynasty Warriors", "Shin Sangoku Musou"],
    isGameTitle: true,
    mustContain: [
      ["진삼국무쌍", "삼국무쌍", "dynasty warriors"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "ps3", "ps4 only",
      "삼국지", "삼국 트로피", "삼국지 통일",  // 다른 삼국지 게임 시리즈 별도
    ],
    msrpKrw: 64800, released: 2018,
    conditionTier: "loose",
    confusionNote: "진삼국무쌍 7/8/Origins 등 broad. 시세 ~₩40K (일관). 일판 다수 → 일판/한글판 mix.",
  },

  // ─── 페르소나 5 / 4 (Switch broad) — 59건 / median ₩27K ───
  {
    id: "switch-game-persona-broad",
    brand: "Atlus", category: "game_console", laneKey: "switch_game_persona",
    modelName: "페르소나 시리즈 (Switch broad)",
    aliases: ["페르소나 5", "페르소나 4", "Persona 5", "Persona 4"],
    isGameTitle: true,
    mustContain: [
      ["페르소나", "persona"],
      ["스위치", "switch", "닌텐도", "nintendo"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "ps4", "ps5", "ps3", "psp",
      "사운드트랙", "포카",
    ],
    msrpKrw: 64800, released: 2022,
    conditionTier: "loose",
  },

  // ─── 디트로이트 비컴 휴먼 (PS4, 2018-05) — 18건 / median ₩88K ───
  {
    id: "ps4-game-detroit-become-human",
    brand: "Sony", category: "game_console", laneKey: "ps4_game_detroit",
    modelName: "디트로이트 비컴 휴먼 (PS4)",
    aliases: ["디트로이트", "Detroit Become Human"],
    isGameTitle: true,
    mustContain: [
      ["디트로이트", "detroit"],
      ["ps4", "플스4", "플레이스테이션", "ps5"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체",
    ],
    msrpKrw: 65000, released: 2018,
    conditionTier: "loose",
    confusionNote: "Sony 1st party narrative. 시세 ₩88K (고가 유지 — 정발 한정).",
  },

  // ─── 마리오 + 래비드 (Switch, 2017-08) — 13건 / median ₩26K ───
  {
    id: "switch-game-mario-rabbids",
    brand: "Ubisoft", category: "game_console", laneKey: "switch_game_mario_rabbids",
    modelName: "마리오 + 래비드 시리즈 (Switch broad)",
    aliases: ["마리오 래비드", "마리오 + 래비즈", "Mario Rabbids"],
    isGameTitle: true,
    mustContain: [
      ["마리오"],
      ["래비드", "래비즈", "rabbids"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 64800, released: 2017,
    conditionTier: "loose",
  },

  // ─── 몬스터 헌터 라이즈 / 선브레이크 (Switch, 2021-03) — 10건 / median ₩32K ───
  {
    id: "switch-game-monster-hunter-rise",
    brand: "Capcom", category: "game_console", laneKey: "switch_game_monster_hunter_rise",
    modelName: "몬스터 헌터 라이즈 / 선브레이크 (Switch)",
    aliases: ["몬헌 라이즈", "Monster Hunter Rise", "선브레이크", "Sunbreak"],
    isGameTitle: true,
    mustContain: [
      ["몬스터 헌터", "몬헌", "monster hunter"],
      ["라이즈", "선브레이크", "rise", "sunbreak"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "와일즈", "wilds",  // 신작 별도
      "월드", "world",  // PS4 World 별도
      "엑스", "x", "더블 크로스",  // 3DS 별 시리즈
    ],
    msrpKrw: 64800, released: 2021,
    conditionTier: "loose",
  },

  // ─── 제노블레이드 크로니클스 (Switch broad) — 13건 / median ₩45K ───
  {
    id: "switch-game-xenoblade-broad",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_xenoblade",
    modelName: "제노블레이드 크로니클스 (Switch broad)",
    aliases: ["제노블레이드", "Xenoblade Chronicles"],
    isGameTitle: true,
    mustContain: [
      ["제노블레이드", "xenoblade"],
      ["스위치", "switch", "닌텐도", "nintendo"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "wii", "위유", "wii u",
    ],
    msrpKrw: 64800, released: 2020,
    conditionTier: "loose",
  },

  // ─── 레이튼 교수 시리즈 (3DS broad) — 17건 / median ₩42K ───
  {
    id: "ds3-game-layton",
    brand: "Level-5", category: "game_console", laneKey: "ds3_game_layton",
    modelName: "레이튼 교수 시리즈 (3DS broad)",
    aliases: ["레이튼 교수", "Professor Layton"],
    isGameTitle: true,
    mustContain: [
      ["레이튼"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "미스터리 저니",  // Switch 별도
      "보드 게임",  // 보드 게임 별도 시장
    ],
    msrpKrw: 39800, released: 2007,
    conditionTier: "loose",
  },

  // ─── 옥토패스 트래블러 1/2 (Switch, 2018/2023) — 8건 / median ₩57K ───
  {
    id: "switch-game-octopath",
    brand: "Square Enix", category: "game_console", laneKey: "switch_game_octopath",
    modelName: "옥토패스 트래블러 (Switch broad)",
    aliases: ["옥토패스", "Octopath Traveler"],
    isGameTitle: true,
    mustContain: [
      ["옥토패스", "octopath"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 64800, released: 2018,
    conditionTier: "loose",
  },

  // ─── 메이드 인 와리오 (Switch broad) — 10건 / median ₩32K ───
  {
    id: "switch-game-warioware",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_warioware",
    modelName: "메이드 인 와리오 / 와리오웨어 (Switch broad)",
    aliases: ["메이드 인 와리오", "와리오웨어", "WarioWare"],
    isGameTitle: true,
    mustContain: [
      ["와리오"],
      ["스위치", "switch", "닌텐도", "nintendo"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "ds", "3ds", "gba", "wii",
      "랜드", "land",  // Wario Land 별 시리즈
    ],
    msrpKrw: 64800, released: 2021,
    conditionTier: "loose",
  },

  // ─── 데스 스트랜딩 (PS4/PS5, 2019) — 10건 / median ₩40K ───
  {
    id: "ps-game-death-stranding",
    brand: "Sony", category: "game_console", laneKey: "ps_game_death_stranding",
    modelName: "데스 스트랜딩 (PS4/PS5)",
    aliases: ["데스 스트랜딩", "코지마", "Death Stranding"],
    isGameTitle: true,
    mustContain: [
      ["데스 스트랜딩", "데스스트랜딩", "death stranding"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체", "콜라보 본체",
      "2",  // Death Stranding 2 (2025) 별도
    ],
    msrpKrw: 69800, released: 2019,
    conditionTier: "loose",
  },

  // ─── 진여신전생 (Switch) — 13건 / median ₩32K ───
  {
    id: "switch-game-shin-megami-tensei",
    brand: "Atlus", category: "game_console", laneKey: "switch_game_smt",
    modelName: "진 여신전생 시리즈 (Switch broad)",
    aliases: ["진여신전생", "여신전생", "Shin Megami Tensei"],
    isGameTitle: true,
    mustContain: [
      ["진여신전생", "여신전생", "shin megami"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "ps2", "ps3", "ps4",
    ],
    msrpKrw: 64800, released: 2021,
    conditionTier: "loose",
  },

  // ─── 바이오하자드 리메이크 / 빌리지 (PS4/PS5 broad) — 12건 / median ₩52K ───
  {
    id: "ps-game-resident-evil",
    brand: "Capcom", category: "game_console", laneKey: "ps_game_resident_evil",
    modelName: "바이오하자드 시리즈 (PS broad)",
    aliases: ["바이오하자드", "Resident Evil", "RE"],
    isGameTitle: true,
    mustContain: [
      ["바이오하자드", "바이오 하자드", "resident evil"],
      ["ps4", "ps5", "플스", "플레이스테이션"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체",
      "스위치", "switch", "엑박", "xbox",
      "ps3", "ps2", "ps1",  // 옛 PS 게임 시세 다름
      "사운드트랙",
    ],
    msrpKrw: 64800, released: 2019,
    conditionTier: "loose",
  },

  // ─── 슈퍼 마리오 3D 콜렉션 (Switch, 2020-09) — 4건 / median ₩66K ───
  {
    id: "switch-game-mario-3d-collection",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_mario_3d_collection",
    modelName: "슈퍼 마리오 3D 콜렉션 (Switch, 한정 발매)",
    aliases: ["3D 콜렉션", "3D 컬렉션", "Super Mario 3D All-Stars"],
    isGameTitle: true,
    mustContain: [
      ["마리오"],
      ["3d 콜렉션", "3d콜렉션", "3d 컬렉션", "3d컬렉션", "3d all stars", "3d allstars"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 64800, released: 2020,
    conditionTier: "boxed",
    confusionNote: "한정 발매 (2021-03 단종). 시세 ₩66K + 미개봉/한정판 premium. 시세 변동 큰 SKU.",
  },

  // ─── 슈퍼 마리오 갤럭시 (구작/Wii) — 9건 / median ₩36K ───
  {
    id: "switch-game-mario-galaxy",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_mario_galaxy",
    modelName: "슈퍼 마리오 갤럭시 (Switch — 3D 콜렉션 포함분)",
    aliases: ["슈퍼 마리오 갤럭시", "Super Mario Galaxy"],
    isGameTitle: true,
    mustContain: [
      ["슈퍼 마리오 갤럭시", "마리오 갤럭시", "super mario galaxy"],
      ["스위치", "switch", "닌텐도", "nintendo"],  // 휴대폰 갤럭시 9000+ noise 차단
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      // 휴대폰 갤럭시 차단
      "s24", "s23", "s22", "s25", "z 폴드", "z 플립", "z폴드", "z플립",
      "노트", "탭",
      "wii u",
    ],
    msrpKrw: 64800, released: 2020,
    conditionTier: "loose",
  },

  // ─── 메가맨 11 (Switch) — 3건 / median ₩60K ───
  {
    id: "switch-game-mega-man-11",
    brand: "Capcom", category: "game_console", laneKey: "switch_game_mega_man_11",
    modelName: "메가맨 11 (Switch)",
    aliases: ["메가맨", "Mega Man"],
    isGameTitle: true,
    mustContain: [
      ["메가맨", "록맨", "mega man"],
      ["스위치", "switch"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "battle network", "x", "x5", "x6",
    ],
    msrpKrw: 39800, released: 2018,
    conditionTier: "loose",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 게임 액세서리 보강 ──
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 마리오카트 핸들 / 휠 (Switch 액세서리) — Pareto 위에서 발견 ───
  {
    id: "switch-accessory-racing-wheel",
    brand: "Nintendo", category: "game_console", laneKey: "switch_accessory_racing_wheel",
    modelName: "Switch 레이싱 휠 / 마리오카트 핸들",
    aliases: ["마리오카트 휠", "레이싱 휠", "조이콘 휠", "Joy-Con Wheel"],
    isGameTitle: true,
    mustContain: [
      ["휠", "wheel", "핸들"],
      ["조이콘", "마리오카트", "마리오 카트", "joy-con"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "ps4", "ps5", "xbox", "엑박",
      "스티어링 휠 본격", "로지텍", "logitech",  // 본격 레이싱 휠 (별 시장)
      "thrustmaster",
    ],
    msrpKrw: 25000, released: 2017,
    conditionTier: "loose",
    confusionNote: "조이콘 끼우는 가벼운 레이싱 핸들. 정품/사제 mix. 정상가 ₩15-25K.",
  },

  // ─── 듀얼센스 엣지 (PS5 프리미엄 컨트롤러) — 4건 / median ₩127K ───
  {
    id: "ps5-accessory-dualsense-edge",
    brand: "Sony", category: "game_console", laneKey: "ps5_accessory_dualsense_edge",
    modelName: "PS5 DualSense Edge",
    aliases: ["듀얼센스 엣지", "DualSense Edge"],
    isGameTitle: true,
    mustContain: [
      ["듀얼센스 엣지", "듀얼센스엣지", "dualsense edge"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "사제", "복제",
      "스틱만", "범퍼만",  // 교체 부품 단품
    ],
    msrpKrw: 270000, released: 2023,
    conditionTier: "loose",
    confusionNote: "프리미엄 컨트롤러. 정상가 ₩270K. 중고 ~₩127K.",
  },

  // ─── 8BitDo 컨트롤러 (Switch 인기 호환 패드) — 23건 / median ₩50K ───
  {
    id: "switch-accessory-8bitdo",
    brand: "8BitDo", category: "game_console", laneKey: "switch_accessory_8bitdo",
    modelName: "8BitDo Pro/Ultimate Controller (Switch 호환)",
    aliases: ["8BitDo", "8 BitDo", "Ultimate Controller", "Pro Controller 2"],
    isGameTitle: true,
    mustContain: [
      ["8bitdo", "8 bitdo", "8비트도", "8비트 도"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "휠", "wheel",  // 휠 별도
      "마우스", "키보드",
    ],
    msrpKrw: 89000, released: 2020,
    conditionTier: "loose",
    confusionNote: "Switch/PC 호환 premium 컨트롤러. 정상가 ~₩50K (중고).",
  },

  // ─── 닌텐도 스위치 스포츠 (Switch, 2022-04) — 20건 / median ₩40K ───
  {
    id: "switch-game-switch-sports",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_switch_sports",
    modelName: "Nintendo Switch Sports",
    aliases: ["스위치 스포츠", "Switch Sports"],
    isGameTitle: true,
    mustContain: [
      ["닌텐도 스위치 스포츠", "스위치 스포츠", "switch sports", "nintendo switch sports"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "wii sports", "위 스포츠",  // Wii 옛 게임 별도
      "마리오 스포츠",  // 마리오 스포츠 별 게임
    ],
    msrpKrw: 49800, released: 2022,
    conditionTier: "loose",
  },

  // ─── 튀어나와요 동물의 숲 (3DS, 2012-11) — 19건 / median ₩33K ───
  {
    id: "ds3-game-animal-crossing-nl",
    brand: "Nintendo", category: "game_console", laneKey: "ds3_game_animal_crossing_nl",
    modelName: "튀어나와요 동물의 숲 (3DS)",
    aliases: ["튀어나와요 동물의 숲", "Animal Crossing New Leaf", "ACNL"],
    isGameTitle: true,
    mustContain: [
      ["튀어나와요", "new leaf"],
      ["동물의 숲", "동물의숲", "animal crossing", "동숲"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "모여봐요", "뉴 호라이즌", "new horizons",  // Switch ACNH 별도
    ],
    msrpKrw: 39800, released: 2012,
    conditionTier: "loose",
  },

  // ─── 소닉 프론티어 (Switch/PS5, 2022-11) — 10건 / median ₩21K ───
  {
    id: "switch-game-sonic-frontiers",
    brand: "Sega", category: "game_console", laneKey: "switch_game_sonic_frontiers",
    modelName: "소닉 프론티어 (Switch broad)",
    aliases: ["소닉 프론티어", "Sonic Frontiers"],
    isGameTitle: true,
    mustContain: [
      ["소닉 프론티어", "sonic frontier"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "운동화", "스니커즈",  // 소닉 운동화 차단 (반복)
    ],
    msrpKrw: 64800, released: 2022,
    conditionTier: "loose",
  },

  // ─── NBA 2K (Switch/PS broad) — 31건 / median ₩13K ───
  {
    id: "ps-game-nba-2k",
    brand: "2K Sports", category: "game_console", laneKey: "ps_game_nba_2k",
    modelName: "NBA 2K 시리즈 (broad)",
    aliases: ["NBA 2K", "엔비에이 2K"],
    isGameTitle: true,
    mustContain: [
      ["nba 2k", "nba2k", "엔비에이 2k", "엔비에이2k"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "본체", "콘솔",
    ],
    msrpKrw: 79800, released: 2018,
    conditionTier: "loose",
    confusionNote: "NBA 2K15-25 broad. 옛 버전 ₩13K (가치 급락 — 매년 신작).",
  },

  // ─── 라스트 오브 어스 Part 1/2 (PS4/PS5, 2013/2020) ───
  {
    id: "ps-game-last-of-us",
    brand: "Sony", category: "game_console", laneKey: "ps_game_last_of_us",
    modelName: "라스트 오브 어스 Part 1/2 (PS broad)",
    aliases: ["라스트 오브 어스", "라스트오브어스", "The Last of Us", "TLOU"],
    isGameTitle: true,
    mustContain: [
      ["라스트 오브 어스", "라스트오브어스", "last of us", "tlou"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체",
      "사운드트랙", "ost",
    ],
    msrpKrw: 69800, released: 2013,
    conditionTier: "loose",
  },

  // ─── 갓 오브 워 / 라그나로크 (PS broad) — 10건+ ───
  {
    id: "ps-game-god-of-war",
    brand: "Sony", category: "game_console", laneKey: "ps_game_god_of_war",
    modelName: "갓 오브 워 / 라그나로크 (PS broad)",
    aliases: ["갓오브워", "갓 오브 워", "라그나로크", "God of War", "Ragnarok"],
    isGameTitle: true,
    mustContain: [
      ["갓오브워", "갓 오브 워", "god of war", "라그나로크", "ragnarok"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체",
      "사운드트랙", "ost",
      "마비노기",  // 마비노기 라그나로크 등 다른 IP
      "ro online",
    ],
    msrpKrw: 69800, released: 2018,
    conditionTier: "loose",
    confusionNote: "갓오브워 (2018) + 라그나로크 (2022). 매물 적음 → broad. 시세 ~₩25-40K.",
  },

  // ─── 호라이즌 제로 던 / 포비든 웨스트 (PS broad) ───
  {
    id: "ps-game-horizon",
    brand: "Sony", category: "game_console", laneKey: "ps_game_horizon",
    modelName: "호라이즌 시리즈 (PS broad)",
    aliases: ["호라이즌", "Horizon Zero Dawn", "Horizon Forbidden West"],
    isGameTitle: true,
    mustContain: [
      ["호라이즌", "horizon"],
      ["ps4", "ps5", "플스", "플레이스테이션"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체",
      "오디오", "스피커", "이어폰",  // 호라이즌 (스피커 브랜드) 차단
      "x9", "수신기",  // 다른 호라이즌
    ],
    msrpKrw: 69800, released: 2017,
    conditionTier: "loose",
  },

  // ─── 엘든링 + DLC (PS/Switch broad) ───
  {
    id: "ps-game-elden-ring",
    brand: "FromSoftware", category: "game_console", laneKey: "ps_game_elden_ring",
    modelName: "엘든링 + DLC (PS broad)",
    aliases: ["엘든링", "엘든 링", "Elden Ring"],
    isGameTitle: true,
    mustContain: [
      ["엘든링", "엘든 링", "elden ring"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체",
      "사운드트랙", "원화집",
    ],
    msrpKrw: 79800, released: 2022,
    conditionTier: "loose",
  },

  // ─── 사이버펑크 2077 (PS4/PS5 broad) ───
  {
    id: "ps-game-cyberpunk",
    brand: "CD Projekt", category: "game_console", laneKey: "ps_game_cyberpunk",
    modelName: "사이버펑크 2077 (PS broad)",
    aliases: ["사이버펑크", "Cyberpunk 2077"],
    isGameTitle: true,
    mustContain: [
      ["사이버펑크", "cyberpunk"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체",
      "사운드트랙", "원화집",
    ],
    msrpKrw: 69800, released: 2020,
    conditionTier: "loose",
  },

  // ─── GTA 5 / GTA V (PS broad) ───
  {
    id: "ps-game-gta-5",
    brand: "Rockstar", category: "game_console", laneKey: "ps_game_gta_5",
    modelName: "GTA 5 / Grand Theft Auto V (PS broad)",
    aliases: ["GTA 5", "GTA V", "Grand Theft Auto V"],
    isGameTitle: true,
    mustContain: [
      ["gta 5", "gta5", "gta v", "grand theft auto"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체",
      "san andreas", "vice city",  // 옛 GTA 별 시세
    ],
    msrpKrw: 49800, released: 2014,
    conditionTier: "loose",
  },

  // ─── Call of Duty Modern Warfare (PS broad) ───
  {
    id: "ps-game-call-of-duty",
    brand: "Activision", category: "game_console", laneKey: "ps_game_call_of_duty",
    modelName: "Call of Duty 시리즈 (PS broad)",
    aliases: ["콜오브듀티", "콜 오브 듀티", "콜옵", "Call of Duty", "MW2", "MW3"],
    isGameTitle: true,
    mustContain: [
      ["콜오브듀티", "콜 오브 듀티", "콜옵", "call of duty", "mw2", "mw3", "cold war"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체",
      "포스터", "포카",
      "마우스", "키보드", "헤드셋",  // 콜라보 액세서리 별도
    ],
    msrpKrw: 79800, released: 2019,
    conditionTier: "loose",
  },

  // ─── 스파이더맨 / 마일즈 모랄레스 (PS broad) ───
  {
    id: "ps-game-spiderman",
    brand: "Sony", category: "game_console", laneKey: "ps_game_spiderman",
    modelName: "Marvel Spider-Man / Miles Morales / 2 (PS broad)",
    aliases: ["스파이더맨", "마일즈 모랄레스", "Spider-Man", "Miles Morales"],
    isGameTitle: true,
    mustContain: [
      ["스파이더맨", "스파이더 맨", "spider-man", "spiderman"],
      ["ps4", "ps5", "플스", "플레이스테이션"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체",
      "마블 콜라보",  // 콜라보 굿즈 차단
      "레고 마블",  // 레고 별 SKU
      "원본 영화", "블루레이",
    ],
    msrpKrw: 79800, released: 2018,
    conditionTier: "loose",
  },

  // ─── 그란 투리스모 7 (PS broad) ───
  {
    id: "ps-game-gran-turismo",
    brand: "Sony", category: "game_console", laneKey: "ps_game_gran_turismo",
    modelName: "그란 투리스모 7 / Sport (PS broad)",
    aliases: ["그란 투리스모", "그란투리스모", "Gran Turismo", "GT7"],
    isGameTitle: true,
    mustContain: [
      ["그란 투리스모", "그란투리스모", "gran turismo", "gt7"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체",
      "휠 콘트롤러", "로지텍",
    ],
    msrpKrw: 79800, released: 2022,
    conditionTier: "loose",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Vintage 게임 (GBA / SFC / N64 / DS / Gameboy) ──
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GBA 게임 broad (Game Boy Advance) — 88건 / median ₩35K ───
  // vintage 매물 (특히 포켓몬 GBA / 마리오 GBA / 젤다 GBA)
  {
    id: "gba-game-broad",
    brand: "Nintendo", category: "game_console", laneKey: "gba_game_broad",
    modelName: "Game Boy Advance 게임 (broad — vintage)",
    aliases: ["GBA 게임", "Game Boy Advance"],
    isGameTitle: true,
    mustContain: [
      ["gba 게임", "gba게임", "gba 칩", "gba 카트리지", "game boy advance", "게임보이 어드밴스"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "본체", "콘솔",
      "sp 본체", "에뮬", "에뮬레이터",
      "복각", "복제",
      "충전기", "케이블",
    ],
    msrpKrw: 39000, released: 2001,
    conditionTier: "loose",
    confusionNote: "GBA 게임 카트리지 broad. 정품 vintage. 시세 ~₩35K (인기작 포켓몬/젤다는 ~₩50K+).",
  },

  // ─── SFC / 슈퍼패미컴 게임 broad — 57건 / median ₩23K ───
  {
    id: "sfc-game-broad",
    brand: "Nintendo", category: "game_console", laneKey: "sfc_game_broad",
    modelName: "Super Famicom 게임 (broad — vintage)",
    aliases: ["슈퍼패미컴", "슈퍼 패미컴", "SFC", "Super Famicom"],
    isGameTitle: true,
    mustContain: [
      ["슈퍼패미컴", "슈퍼 패미컴", "sfc", "super famicom"],
      ["게임", "칩", "카트리지", "팩", "팝니다"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "본체", "콘솔",
      "에뮬레이터", "복각",
      "어댑터", "충전",
      "미니", "클래식",  // 미니 SFC 콘솔 별도
    ],
    msrpKrw: 29000, released: 1990,
    conditionTier: "loose",
  },

  // ─── DS 게임 broad — 600+ 매물 / median ₩67K (포켓몬 vintage 포함) ───
  // 단 포켓몬 vintage SKU 위에 박았으므로 narrow 우선
  {
    id: "ds-game-broad",
    brand: "Nintendo", category: "game_console", laneKey: "ds_game_broad",
    modelName: "Nintendo DS 게임 (broad — narrow 외)",
    aliases: ["NDS 게임", "닌텐도 DS 게임"],
    isGameTitle: true,
    mustContain: [
      ["nds 게임", "닌텐도 ds 게임", "ds 게임", "ds 칩", "ds 카트리지"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "본체", "콘솔",
      "에뮬",
      "어댑터", "충전",
      // narrow SKU 우선 (Pokemon 박힌 거)
      "하트골드", "소울실버", "디아루가", "기라티나", "포켓몬 블랙", "포켓몬 화이트",
      "튀어나와요 동물의 숲",
      // 3DS 별도
      "3ds", "2ds", "newd ds",
    ],
    msrpKrw: 29000, released: 2004,
    conditionTier: "loose",
    confusionNote: "DS 게임 카트리지 broad. narrow 포켓몬 vintage SKU 박힌 거 외. 시세 ~₩20-40K.",
  },

  // ─── 게임보이 (옛 Gameboy/GBC) — 32건 GBC + Game Boy 200+ ───
  {
    id: "gameboy-game-broad",
    brand: "Nintendo", category: "game_console", laneKey: "gameboy_game_broad",
    modelName: "Game Boy / Color 게임 (broad — vintage)",
    aliases: ["게임보이", "Gameboy", "GBC", "Game Boy Color"],
    isGameTitle: true,
    mustContain: [
      ["게임보이", "gameboy", "gbc", "게임보이 컬러", "game boy"],
      ["게임", "칩", "카트리지", "팩", "팝니다"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "본체", "콘솔",
      "에뮬",
      "어댑터", "충전",
      "어드밴스", "advance", "gba",  // GBA 별도
      "마이크로",
      "닌텐도 스위치", "switch",
    ],
    msrpKrw: 29000, released: 1989,
    conditionTier: "loose",
  },

  // ─── 닌텐도 64 게임 broad — 10+ 매물 / median ₩20K ───
  {
    id: "n64-game-broad",
    brand: "Nintendo", category: "game_console", laneKey: "n64_game_broad",
    modelName: "Nintendo 64 게임 (broad — vintage)",
    aliases: ["N64 게임", "닌텐도 64 게임"],
    isGameTitle: true,
    mustContain: [
      ["n64", "닌텐도 64", "닌텐도64", "nintendo 64"],
      ["게임", "칩", "카트리지", "팩", "팝니다"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "본체", "콘솔",
      "에뮬", "복각",
      "미니",
    ],
    msrpKrw: 29000, released: 1996,
    conditionTier: "loose",
  },

  // ─── 레고 스타워즈 (Switch / PS broad) — 40건 / median ₩85K ───
  // 레고 IP 게임 (Star Wars, Marvel, Harry Potter 등)
  {
    id: "switch-game-lego",
    brand: "TT Games", category: "game_console", laneKey: "switch_game_lego",
    modelName: "LEGO IP 게임 (스타워즈/마블/해리포터 등 broad)",
    aliases: ["레고 게임", "레고 스타워즈", "LEGO Star Wars"],
    isGameTitle: true,
    mustContain: [
      ["레고", "lego"],
      ["스타워즈", "스타 워즈", "star wars", "마블", "marvel", "해리포터", "해리 포터", "harry potter", "쥬라기", "indiana", "닌자고", "ninjago"],
      ["게임", "게임칩", "게임 칩", "타이틀", "칩", "카트리지", "스위치", "닌텐도", "switch", "ps4", "ps5", "플스", "플레이스테이션", "사가", "skywalker", "해리포터 컬렉션"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "본체", "콘솔",
      // 레고 블록 별 시장 (블록 / 미니피겨 만 차단)
      "블록만", "미니피겨", "미니피그", "minifigure",
      "75256", "75257",  // LEGO 세트 번호 (블록)
    ],
    msrpKrw: 59800, released: 2018,
    conditionTier: "loose",
    confusionNote: "LEGO IP 게임 broad (Star Wars, Marvel, Harry Potter, Ninjago 등). 자식용 인기. 블록 키트와 별도.",
  },

  // ─── 슈퍼 마리오 카트 라이브 홈서킷 (Switch, 2020-10) — 5건 / median ₩45-90K ───
  // RC 카 + 게임 합본 (한정 발매)
  {
    id: "switch-game-mario-kart-live",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_mario_kart_live",
    modelName: "마리오 카트 라이브 홈서킷 (Switch)",
    aliases: ["마리오 카트 라이브", "홈서킷", "Mario Kart Live"],
    isGameTitle: true,
    mustContain: [
      ["마리오 카트 라이브", "마리오카트 라이브", "mario kart live"],
      ["홈서킷", "home circuit"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 134000, released: 2020,
    conditionTier: "boxed",
    confusionNote: "AR 게임 (RC 카 + 카메라). 한정 발매. 정상가 ₩134K, 중고 ₩45-90K.",
  },

  // ─── 디스가이아 시리즈 (Switch) — 10건 / median ₩25K ───
  {
    id: "switch-game-disgaea",
    brand: "Nippon Ichi", category: "game_console", laneKey: "switch_game_disgaea",
    modelName: "디스가이아 시리즈 (Switch broad)",
    aliases: ["디스가이아", "Disgaea"],
    isGameTitle: true,
    mustContain: [
      ["디스가이아", "disgaea"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "ps2", "ps3", "psp",  // 옛 디스가이아 별 시세
    ],
    msrpKrw: 64800, released: 2018,
    conditionTier: "loose",
  },

  // ─── 나루토 시리즈 (Switch / PS broad) — 66건 / median ₩15K ───
  {
    id: "ps-game-naruto",
    brand: "Bandai Namco", category: "game_console", laneKey: "ps_game_naruto",
    modelName: "나루토 시리즈 (broad — Storm 등)",
    aliases: ["나루토", "Naruto Storm"],
    isGameTitle: true,
    mustContain: [
      ["나루토", "naruto"],
      ["게임", "칩", "디스크", "팝니다", "판매", "스위치", "switch", "ps4", "ps5", "ps3"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "본체",
      // 굿즈 차단
      "피규어", "인형", "쿠션", "프라모델", "프라 모델",
      "ova", "극장판", "박스 셋",
      "만화책", "단행본",
      "엽서",
      "코스프레",
    ],
    msrpKrw: 49800, released: 2014,
    conditionTier: "loose",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Switch 2 게임 (2025) — 신상 ──
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Switch 2 게임 broad (Mario Kart World 외) ───
  {
    id: "switch2-game-broad",
    brand: "Nintendo", category: "game_console", laneKey: "switch2_game_broad",
    modelName: "Switch 2 게임 (broad — Mario Kart World 외)",
    aliases: ["스위치2 게임", "스위치 2 게임", "Switch 2 game"],
    isGameTitle: true,
    mustContain: [
      ["스위치 2", "스위치2", "switch 2", "switch2"],
      ["게임", "카트리지", "칩", "팝니다", "판매", "정품"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "본체", "콘솔",
      // narrow SKU 우선
      "마리오 카트", "마리오카트", "mario kart",
      "동키콩 바난자", "donkey kong bananza",
      "메트로이드 프라임 4", "metroid prime 4",
      "포코피아",
    ],
    msrpKrw: 89000, released: 2025,
    conditionTier: "loose",
    confusionNote: "Switch 2 (2025-06) 게임 broad. narrow SKU (마리오 카트 월드 / 동키콩 바난자) 외.",
  },

  // ─── 동키콩 바난자 (Switch 2, 2025-07) ───
  {
    id: "switch2-game-donkey-kong-bananza",
    brand: "Nintendo", category: "game_console", laneKey: "switch2_game_donkey_kong_bananza",
    modelName: "동키콩 바난자 (Switch 2, 2025)",
    aliases: ["동키콩 바난자", "Donkey Kong Bananza"],
    isGameTitle: true,
    mustContain: [
      ["동키콩", "동키 콩", "donkey kong"],
      ["바난자", "bananza"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 89000, released: 2025,
    conditionTier: "loose",
    confusionNote: "Switch 2 첫 동키콩 (2025-07). 정상가 ₩89K.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Switch 게임 액세서리 보강 ──
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 닌텐도 게임 카드 케이스 ───
  {
    id: "switch-accessory-card-case",
    brand: "Nintendo", category: "game_console", laneKey: "switch_accessory_card_case",
    modelName: "Switch 게임 카드 케이스 (정품)",
    aliases: ["게임 카드 케이스", "카트리지 케이스", "Card Case"],
    isGameTitle: true,
    mustContain: [
      ["카드 케이스", "카드케이스", "카트리지 케이스", "카트리지케이스", "card case"],
      ["스위치", "switch", "닌텐도", "nintendo"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "본체", "충전",
      "케이스 본체", "본체 케이스",
    ],
    msrpKrw: 15000, released: 2017,
    conditionTier: "loose",
  },

  // ─── 닌텐도 라보 VR 키트 ───
  {
    id: "switch-accessory-labo-vr",
    brand: "Nintendo", category: "game_console", laneKey: "switch_accessory_labo_vr",
    modelName: "Nintendo Labo VR 키트",
    aliases: ["닌텐도 라보", "Nintendo Labo", "Labo VR"],
    isGameTitle: true,
    mustContain: [
      ["닌텐도 라보", "닌텐도라보", "nintendo labo", "labo"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "본체",
    ],
    msrpKrw: 89800, released: 2019,
    conditionTier: "loose",
  },

  // ─── 오버쿡드 (Switch broad) — 9건 / median ₩44K ───
  {
    id: "switch-game-overcooked",
    brand: "Team17", category: "game_console", laneKey: "switch_game_overcooked",
    modelName: "오버쿡드 시리즈 (Switch broad)",
    aliases: ["오버쿡드", "오버쿠킹", "Overcooked"],
    isGameTitle: true,
    mustContain: [
      ["오버쿡드", "overcooked"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "ps5", "ps4",  // PS 버전 별도
    ],
    msrpKrw: 39800, released: 2018,
    conditionTier: "loose",
  },

  // ─── 포트나이트 (Switch 액세서리/굿즈는 차단, 게임만) — 10건 / median ₩36K ───
  // 주의: 포트나이트는 free-to-play 게임 → 패키지는 굿즈/V-bucks 카드 위주
  {
    id: "switch-game-fortnite-pack",
    brand: "Epic Games", category: "game_console", laneKey: "switch_game_fortnite_pack",
    modelName: "Fortnite 패키지 / 번들 (broad)",
    aliases: ["포트나이트", "Fortnite"],
    isGameTitle: true,
    mustContain: [
      ["포트나이트", "fortnite"],
      ["패키지", "번들", "v-bucks", "vbucks", "팝니다", "판매"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE,
      "본체", "콘솔",
      "스킨", "skin",  // 디지털 스킨 별도
      "굿즈", "피규어",
      "v벅 카드만",  // V-bucks 카드 단품 별도
    ],
    msrpKrw: 49800, released: 2018,
    conditionTier: "loose",
    confusionNote: "F2P 게임 본편 없음 — 콘솔 한정판 / 번들 패키지 위주. 시세 ₩36K.",
  },

  // ─── 뉴 슈퍼 마리오 브라더스 U 디럭스 (Switch, 2019-01) — 13건 / median ₩16K ───
  {
    id: "switch-game-mario-bros-u-deluxe",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_mario_bros_u_deluxe",
    modelName: "뉴 슈퍼 마리오 브라더스 U 디럭스 (Switch)",
    aliases: ["뉴 슈퍼 마리오", "Mario Bros U Deluxe"],
    isGameTitle: true,
    mustContain: [
      ["뉴 슈퍼 마리오", "new super mario"],
      ["디럭스", "u 디럭스", "deluxe"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "wii u",
      "원더", "wonder",  // Mario Wonder 별도
    ],
    msrpKrw: 64800, released: 2019,
    conditionTier: "loose",
  },

  // ─── 슈로닉 포스 (Switch broad) — 5건 ───
  // 한국 닌텐도 인기 게임 (한정 발매)
  {
    id: "switch-game-shironic",
    brand: "Nintendo", category: "game_console", laneKey: "switch_game_shironic",
    modelName: "신유전자 라이즈 / 슈로닉 (Switch broad)",
    aliases: ["슈로닉", "신유전자"],
    isGameTitle: true,
    mustContain: [
      ["슈로닉", "신유전자"],
    ],
    mustNotContain: [...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE],
    msrpKrw: 64800, released: 2022,
    conditionTier: "loose",
  },

  // ─── 슈퍼 마리오 브라더스 디럭스 (3DS, 2009) — 5건 / median ₩30K ───
  {
    id: "ds3-game-mario-bros-deluxe",
    brand: "Nintendo", category: "game_console", laneKey: "ds3_game_mario_bros_deluxe",
    modelName: "슈퍼 마리오 브라더스 (3DS Virtual Console)",
    aliases: ["슈퍼 마리오 브라더스", "Super Mario Bros"],
    isGameTitle: true,
    mustContain: [
      ["슈퍼 마리오 브라더스", "super mario bros"],
      ["3ds", "닌텐도 ds", " ds "],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "u 디럭스", "u deluxe",
      "wii", "위",
      "스위치", "switch",
    ],
    msrpKrw: 39800, released: 2009,
    conditionTier: "loose",
  },

  // ─── 마리오카트 7 (3DS, 2011-12) — 일부 매물 ───
  {
    id: "ds3-game-mario-kart-7",
    brand: "Nintendo", category: "game_console", laneKey: "ds3_game_mario_kart_7",
    modelName: "마리오 카트 7 (3DS)",
    aliases: ["마리오카트 7", "Mario Kart 7"],
    isGameTitle: true,
    mustContain: [
      ["마리오 카트 7", "마리오카트 7", "mario kart 7"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "8", "월드", "wii", "위",
    ],
    msrpKrw: 39800, released: 2011,
    conditionTier: "loose",
  },

  // ─── 슈퍼 스매시 브라더스 for 3DS (3DS, 2014) ───
  {
    id: "ds3-game-smash-3ds",
    brand: "Nintendo", category: "game_console", laneKey: "ds3_game_smash_3ds",
    modelName: "슈퍼 스매시 브라더스 for 3DS",
    aliases: ["스매시 브라더스 3DS", "Smash 3DS"],
    isGameTitle: true,
    mustContain: [
      ["스매시 브라더스", "스매시브라더스", "대난투", "smash"],
      ["3ds"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "얼티밋", "ultimate", "스위치",
      "wii u",
    ],
    msrpKrw: 39800, released: 2014,
    conditionTier: "loose",
  },

  // ─── 메이드 인 와리오 (3DS, 2015) ───
  {
    id: "ds3-game-warioware-gold",
    brand: "Nintendo", category: "game_console", laneKey: "ds3_game_warioware_gold",
    modelName: "메이드 인 와리오 골드 (3DS)",
    aliases: ["메이드 인 와리오 골드", "WarioWare Gold"],
    isGameTitle: true,
    mustContain: [
      ["와리오"],
      ["3ds", "골드", "gold"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...SWITCH_BODY_NOISE,
      "스위치", "switch",
    ],
    msrpKrw: 39800, released: 2018,
    conditionTier: "loose",
  },

  // ─── 발더스 게이트 3 (PS5, 2023-08) ───
  {
    id: "ps5-game-baldurs-gate-3",
    brand: "Larian", category: "game_console", laneKey: "ps5_game_baldurs_gate_3",
    modelName: "발더스 게이트 3 (PS5)",
    aliases: ["발더스 게이트", "Baldurs Gate 3", "BG3"],
    isGameTitle: true,
    mustContain: [
      ["발더스 게이트", "baldurs gate", "baldur s gate"],
    ],
    mustNotContain: [
      ...GAME_TITLE_NOISE, ...PLAYSTATION_BODY_NOISE,
      "본체",
      "ps3", "ps2",  // 옛 BG 별도
    ],
    msrpKrw: 79800, released: 2023,
    conditionTier: "loose",
  },
];
