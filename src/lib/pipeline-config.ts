export const DEFAULT_SEARCH_QUERIES = [
  "에어팟", "에어팟 프로", "에어팟 프로2", "에어팟 4세대", "에어팟 맥스",
  "애플워치", "애플워치 se", "애플워치 9", "애플워치 10", "애플워치 울트라",
  "갤럭시워치", "갤럭시 워치 6", "갤럭시 워치 7", "갤럭시 워치 울트라",
  "맥북프로", "맥북에어",
  "아이폰 13", "아이폰 14", "아이폰 14 프로", "아이폰 15", "아이폰 15 프로", "아이폰 15 프로맥스",
  "아이폰 16", "아이폰 16 프로", "아이폰 16 프로맥스", "아이폰 16e",
  "갤럭시 S23", "갤럭시 S23 울트라", "갤럭시 S24", "갤럭시 S24 울트라", "갤럭시 S25", "갤럭시 S25 울트라",
  "아이패드 프로", "아이패드 에어", "아이패드 미니", "아이패드 10세대",
  "갤럭시탭 S8", "갤럭시탭 S9", "갤럭시탭 S10",
  // Wave 54/56: narrow tech/home lane validation queries. These start as
  // gather traffic; query cadence can downrank low-yield lanes after evidence.
  // Wave 59-A cleanup: removed "LG 39GX900A" (median price 200만+ → 자본 천장 위반,
  // Wave 58 §11.C 폐기 결정), "JBL 플립6" (한글 변형 raw 0 / Wave 56·57 측정),
  // "Bose QC" (영어 단독 raw 0 / Wave 57 측정).
  "벤큐 XL2540K", "LG 27US550", "LG 27GL650F",
  "JBL Flip 6",
  "닌텐도 스위치 OLED", "스위치 OLED",
  "플스5 디스크", "PS5 디스크", "플스5 디지털", "PS5 디지털", "PS5 슬림",
  "다이슨 V12", "다이슨 V15", "로보락 S8", "Roborock S8",
  // Wave 57: Bose / Sony WH / desktop natural-language coverage (3 categories
  // were 0 in Wave 55/56 audit; only synthetic wave*_boost: tags existed).
  // start as queryFamily=unknown → gather + 5m default. Yield-based downrank
  // applies once evidence accumulates.
  "보스 QC",
  "WH-1000XM", "소니 헤드폰",
  "맥미니", "아이맥", "맥 스튜디오", "Mac Studio",
  // Wave 61: 기존 catalog narrow lane 중 자연 inflow 0~3 SKU 보강 (카메라/헤드폰/이어폰/LG그램).
  // 사업 카테고리 신규 아님 — 이미 등록된 catalog SKU에 mining query만 채움.
  "소니 A7M3", "소니 A7C", "캐논 R6 Mark II",
  "비츠 솔로4", "비츠 스튜디오 프로",
  "갤럭시 버즈 3 프로",
  "보스 QC 울트라", "보스 QC45",
  "WH-CH520",
  "LG 그램 17",
  // Wave 65: 7d inflow ≤2 SKU 보강. broader Roborock S8 query는 있으나 Pro Ultra variant
  // narrow query 부재로 SKU bound 7d=2. 소니 ULT900N / Bose SoundLink Mini II는 query 부재.
  "소니 ULT900N", "보스 사운드링크 미니", "로보락 S8 프로 울트라",
  // Wave 67: 신 사업 카테고리 진입 (owner 사인오프 후) — 시계 + 골프 + 카메라 보강.
  // Wave 58 §11.D 우선순위 기반. internal_only 시작, 측정 후 ready 결정.
  "G-Shock", "지샥 GA-2100", "지샥 DW-5600", "지샥 풀메탈 5000",
  "Seiko 5", "세이코 5 SRPD", "세이코 5 SBSA",
  "타이틀리스트 TSR2", "타이틀리스트 TSR3",
  "소니 a6400", "Sony a6400",
  // Wave 86: 시계/카메라 표본 부족 SKU 집중 mining boost. parser 강화 + ready 승격 목표.
  // 골프(Wave 67)는 충분한 표본으로 sport_golf ready 승격 (49+18건). 시계/카메라는 표본 부족
  // (DW-5600 57건만 충분, GA-2100 33건 중 28건 review로 parser 약함, GMW-B5000 11건, Seiko 1건,
  // 카메라 3 SKU 합쳐 5건). 변형 query 추가로 표본 늘림.
  // 시계 G-Shock 변형:
  // Wave 86 boost diag: "카시오크" 단독 query → 97% noise (카시오 탱크/Edifice/Exilim 디카 흡수) → 폐기.
  "지얄오크", "DW-5600BB", "DW5600 풀박스",
  "지샥 풀메탈", "GMW-B5000", "GMW B5000",
  // 시계 Seiko 변형 (한국 매물 부족 — 다양한 검색어로 시도):
  "세이코 5KX", "Seiko 5 SRPD", "세이코 SRPD",
  // 카메라 변형 (body-only 표기 다양):
  // Wave 86 boost diag: ILCE-7C 단독 query → 94% noise (액자/은화/디카 흡수) → 폐기.
  "Sony A7M3", "Sony A7 III", "ILCE-7M3",
  "Sony A7C 바디",
  "캐논 R6M2", "EOS R6 Mark II", "캐논 알육막투",
  // Wave 87: A7C broad noise 해소 — A7C II / A7CR 별도 SKU 분리 후 query 추가.
  "소니 A7C II", "Sony A7C II", "A7C2", "ILCE-7CM2",
  "소니 A7CR", "Sony A7CR", "ILCE-7CR",
  // Wave 134 (2026-05-16): 신발 narrow SKU 30개 mining boost.
  // 사용자 명령 "표본 존나 크게". Bunjang rate limit 없음 (probe 검증).
  // 카테고리 sweep (category:405)은 신규 매물 일괄 capture, narrow query는 모델별 깊이 mining.
  // 호카
  "호카 본디 8", "호카 본디 9", "호카 본디 X", "Hoka Bondi",
  "호카 클리프턴 9", "호카 클리프턴 10", "Hoka Clifton",
  // 나이키
  "페가수스 39", "페가수스 40", "페가수스 41", "Nike Pegasus",
  "에어포스 1 화이트", "에어포스 1 블랙", "에어포스 1 트리플",
  "덩크 로우 판다", "덩크 로우",
  // 어그
  "어그 클래식 숏", "어그 클래식 미니", "어그 클래식 탈", "UGG Classic",
  // 닥터마틴
  "닥터마틴 1460 블랙", "닥터마틴 1460 체리", "닥터마틴 첼시", "닥터마틴 2976",
  // 푸마
  "푸마 팔레르모", "푸마 팔레르모 블랙", "푸마 팔레르모 화이트",
  // 컨버스
  "컨버스 척70", "컨버스 척테일러 70",
  // 뉴발란스
  "뉴발란스 990v5", "뉴발란스 990v6", "뉴발란스 992", "뉴발란스 993", "뉴발란스 1906",
  "뉴발란스 530", "뉴발란스 327",
  // 아디다스
  "아디다스 삼바", "Adidas Samba", "아디다스 가젤 인도어",
  // Wave 138: 신규 broad 3개 query
  "아디다스 토바코", "Adidas Tobacco", "토바코 그루엔",
  "아디다스 가젤 OG", "아디다스 가젤", "Adidas Gazelle",
  "뉴발란스 327 ms327", "ws327",
  // Wave 140: 신규 5개 SKU query
  "컨버스 척70 하이", "Chuck 70 High",
  "호카 본디 7", "Hoka Bondi 7",
  "에어포스 1 트리플 레드", "AF1 트리플 레드",
  "컨버스 잭퍼셀", "Jack Purcell",
  "나이키 페가수스 터보", "Pegasus Turbo",
  // 기타 인기
  "아식스 젤 1130", "Asics Gel 1130",
  "온 클라우드 5", "On Cloud 5",
  "브룩스 고스트", "Brooks Ghost",
  // Wave 144 (2026-05-16 iter 7): mining query 확장 — 인기 모델 sample 누적 가속.
  "살로몬 XT-6", "Salomon XT-6",
  "살로몬 ACS", "Salomon ACS Pro",
  "호카 마하", "Hoka Mach",
  "호카 카본 X", "Hoka Carbon X",
  "나이키 줌X", "Nike Zoom X", "베이퍼플라이", "Vaporfly",
  "나이키 코르테즈", "Nike Cortez",
  "나이키 블레이저", "Nike Blazer",
  "아디다스 슈퍼스타", "Adidas Superstar",
  "아디다스 스탠스미스", "Stan Smith",
  "아디다스 컨트리 OG", "Country OG",
  "아디다스 스페지알", "Adidas Spezial",
  "반스 올드스쿨", "Vans Old Skool",
  "반스 클래식 슬립온", "Vans Classic Slip-On",
  "메종 마르지엘라 GAT", "Margiela GAT", "마르지엘라 저먼",
  // 어그 추가 variants
  "어그 클래식 울트라 미니", "UGG Ultra Mini",
  "어그 클래식 미니 II", "UGG Mini II",
  "어그 디스켓 미니", "UGG Disquette",
  // 닥마 변형
  "닥터마틴 1461", "Dr Martens 1461",
  "닥터마틴 자돈", "Dr Martens Jadon",
  "닥터마틴 윙팁",
  // 호카 더
  "호카 챌린저 ATR", "Hoka Challenger ATR",
  "호카 라잇", "Hoka Light",
  "호카 시스카이", "Hoka Skyflow",
  // Wave 182 Phase 2 (2026-05-17): 새 catalog SKU 33+7 mining query 보강.
  // 사용자 지적 "파서랑 마이닝 다 보강해야댐". collect cron 이 새 SKU 매물 가져올 수 있게.
  // — MacBook Pro 14/16 M-series
  "맥북 프로 14 M1 Pro", "맥북 프로 14 M2 Pro", "맥북 프로 14 M3 Max", "맥북 프로 14 M4 Pro",
  "맥북 프로 16 M1 Pro", "맥북 프로 16 M3 Pro", "맥북 프로 16 M4 Pro",
  "MacBook Pro 14 M1 Pro", "MacBook Pro 16 M1 Pro",
  // MacBook Air M1 13 + 15in
  "맥북 에어 M1", "MacBook Air M1", "맥북에어 M1",
  "맥북 에어 15", "MacBook Air 15",
  // iPad Pro M1 (2021)
  "아이패드 프로 11 M1", "아이패드 프로 12.9 M1", "iPad Pro M1",
  // iPad Air 4/5
  "아이패드 에어 4", "아이패드 에어 5", "iPad Air 4", "iPad Air 5",
  // iPad mini 5/6
  "아이패드 미니 5", "아이패드 미니 6", "iPad mini 5", "iPad mini 6",
  // iPad 7/8
  "아이패드 7세대", "아이패드 8세대", "iPad 7th", "iPad 8th",
  // Galaxy Tab S7
  "갤럭시탭 S7", "갤탭 S7",
  // Galaxy S20 + Note 20U/10
  "갤럭시 S20", "갤럭시 S20 울트라", "Galaxy S20",
  "갤럭시 노트20 울트라", "갤럭시 노트10", "Note 10",
  // Galaxy Z Flip/Fold 3
  "갤럭시 Z플립3", "갤럭시 Z폴드3", "Z Flip 3", "Z Fold 3",
  // Galaxy Watch 3 + Active 2
  "갤럭시 워치 3", "갤럭시 워치 액티브 2", "Galaxy Watch Active 2",
  // Wave 182 chunk 6 (2026-05-17): Sony LinkBuds, Bose 700/Earbuds II, Galaxy Buds 2/Live, Galaxy Tab S6.
  "소니 LinkBuds", "Sony LinkBuds", "링크버즈",
  "소니 LinkBuds S", "LinkBuds S",
  "소니 LinkBuds Fit", "LinkBuds Fit",
  "보스 700", "Bose 700", "Bose NC 700",
  "보스 QC 이어버드 II", "Bose QC Earbuds II",
  "갤럭시 버즈 2", "갤버즈 2", "Galaxy Buds 2",
  "갤럭시 버즈 2 프로", "Galaxy Buds 2 Pro",
  "갤럭시 버즈 라이브", "Galaxy Buds Live",
  "갤럭시탭 S6", "갤탭 S6", "Galaxy Tab S6",
  "갤럭시탭 S6 라이트", "Galaxy Tab S6 Lite",
  // Wave 182 Phase 4 (2026-05-17): Galaxy Book 시리즈.
  "갤럭시 북 4", "갤럭시북 4", "Galaxy Book 4",
  "갤럭시 북 4 프로", "Galaxy Book 4 Pro",
  "갤럭시 북 4 울트라", "Galaxy Book 4 Ultra",
  "갤럭시 북 5", "갤럭시북 5", "Galaxy Book 5",
  "갤럭시 북 5 프로", "Galaxy Book 5 Pro",
  // Wave 183 (2026-05-17): 헤어 기기 (Dyson / 시아루스 / Panasonic / BaByliss).
  "다이슨 슈퍼소닉", "Dyson Supersonic",
  "다이슨 슈퍼소닉 오리진", "Supersonic Origin",
  "다이슨 에어랩", "Dyson Airwrap",
  "다이슨 에어랩 i.d.", "Airwrap iD", "Airwrap 코안다",
  "다이슨 코랄", "Dyson Corrale",
  "시아루스 글램팜", "Glampam",
  "시아루스 매직 ProV", "Magic ProV",
  "파나소닉 나노이", "Panasonic 나노이",
  "EH-NA0J", "EH-NA9C", "EH-NA98",
  "바비리스 프로 2174", "BaByliss Pro",
  // Wave 184 (2026-05-17): 새 카테고리 "drone" — DJI 드론 + DJI 액션캠 + GoPro.
  "DJI Mini 2", "DJI 미니 2",
  "DJI Mini 3 Pro", "DJI 미니 3 프로",
  "DJI Mini 4 Pro", "DJI 미니 4 프로",
  "DJI Mavic 3", "DJI 매빅 3",
  "DJI Mavic 3 Pro",
  "DJI Mavic 3 Classic",
  "DJI Air 2S", "DJI 에어 2S",
  "DJI Air 3", "DJI 에어 3",
  "DJI Air 3S",
  "DJI Avata", "DJI 아바타",
  "DJI Avata 2",
  "DJI Osmo Action 3", "DJI 오즈모 액션",
  "DJI Osmo Action 4",
  "DJI Osmo Action 5 Pro",
  "DJI Osmo Pocket 2", "DJI 오즈모 포켓",
  "DJI Osmo Pocket 3",
  "GoPro Hero 9", "고프로 히어로 9",
  "GoPro Hero 10", "고프로 히어로 10",
  "GoPro Hero 11", "고프로 히어로 11",
  "GoPro Hero 12", "고프로 히어로 12",
  "GoPro Hero 13", "고프로 히어로 13",
  "GoPro Max", "고프로 맥스",
  // Wave 185 (2026-05-17): 새 카테고리 "perfume" — 명품 향수 22 SKU.
  "조말론 우드세이지", "Jo Malone Wood Sage",
  "조말론 라임바질", "Jo Malone Lime Basil",
  "조말론 잉글리쉬페어", "Jo Malone English Pear",
  "조말론 블랙베리", "Jo Malone Blackberry",
  "조말론 피오니", "Jo Malone Peony",
  "르라보 산탈 33", "Le Labo Santal 33",
  "르라보 누아 29", "Le Labo Noir 29",
  "딥디크 필로시코스", "Diptyque Philosykos",
  "딥디크 도손", "Diptyque Do Son",
  "딥디크 오 카피탈", "Diptyque Eau Capitale",
  "톰포드 블랙 오키드", "Tom Ford Black Orchid",
  "톰포드 토바코 바닐라", "Tom Ford Tobacco Vanille",
  "톰포드 로스트 체리", "Tom Ford Lost Cherry",
  "톰포드 우드 우드", "Tom Ford Oud Wood",
  "Replica Jazz Club", "재즈클럽 향수",
  "Replica By the Fireplace", "파이어플레이스 향수",
  "Replica Beach Walk", "비치워크 향수",
  "Replica When the Rain Stops",
  "Memo Russian Leather", "메모 러시안 레더",
  "Memo Irish Leather", "메모 아이리쉬 레더",
  "Memo Italian Leather", "메모 이탈리안 레더",
  // Wave 186 (2026-05-18): 새 카테고리 "kickboard" — 전동킥보드/스쿠터.
  "샤오미 미 스쿠터 프로 2", "Xiaomi Mi Pro 2",
  "샤오미 미 스쿠터 3", "Mi Scooter 3",
  "샤오미 미 스쿠터 4", "Mi Scooter 4",
  "샤오미 미 스쿠터 4 프로", "Mi Scooter 4 Pro",
  "샤오미 미 스쿠터 4 울트라", "Mi Scooter 4 Ultra",
  "세그웨이 닌봇 맥스 G2", "Ninebot Max G2",
  "닌봇 F40", "Ninebot F40",
  "닌봇 F30", "Ninebot F30",
  "닌봇 E45", "Ninebot E45",
  // Wave 187 (2026-05-18): 가민 워치 (운동 시계).
  "가민 페닉스 7", "Garmin Fenix 7",
  "가민 페닉스 7s", "Fenix 7S",
  "가민 페닉스 7x", "Fenix 7X",
  "가민 페닉스 8", "Garmin Fenix 8",
  "가민 포러너 265", "Forerunner 265",
  "가민 포러너 955", "Forerunner 955",
  "가민 포러너 965", "Forerunner 965",
  "가민 인스팅트 2", "Instinct 2",
  "가민 비누 3", "Venu 3",
  "가민 에픽스 프로", "Epix Pro",
];

// Wave 88 (2026-05-15): 카테고리 sweep — find_v2 f_category_id 파라미터로 카테고리별 신규 매물
// 일괄 흡수. 127개 narrow query polling → 10개 카테고리 sweep으로 호출 91%↓, 매물 편향 0,
// 신규 SKU 자동 발견. order=date page 0 + catalog ruleMatch가 광고/taget 매물 분리.
// L2 leaf ID 사용 (L1 600 단독은 0건 반환). bunjang.ts CATEGORY_QUERY_PREFIX 라우팅.
//
// Wave 101 (2026-05-15): pageCount 차등. 30분 raw 측정 결과 fresh hit rate가 카테고리별
// 큰 차이 (휴대폰/태블릿/오디오 18~47% vs 자전거/가방 93%). page 0의 96건이 다 신규 못 채우는
// 카테고리는 page 1 추가 → 더 깊은 신규 매물 capture. touched < 96 카테고리는 무의미라 제외.
export const DEFAULT_CATEGORY_SWEEPS: { id: string; title: string; pageCount?: number }[] = [
  { id: "600700", title: "휴대폰", pageCount: 2 },     // Wave 101: fresh 47%, touched 134, page 1 추가
  { id: "600710", title: "태블릿", pageCount: 2 },     // Wave 101: fresh 18%, touched 139, page 1 추가
  { id: "600720", title: "워치/밴드", pageCount: 2 },   // Wave 101.1: fresh 18%, touched 71. page 1이 빈 응답이라도 capture 손실 zero 안전마진
  { id: "600100", title: "PC/노트북" },                 // fresh 72%, touched 95 — 충분
  { id: "600300", title: "카메라/DSLR" },               // fresh 87%, touched 82 — 충분
  { id: "600500", title: "오디오/영상", pageCount: 2 }, // Wave 101: fresh 47%, touched 137, page 1 추가
  { id: "600600", title: "게임/타이틀" },               // fresh 73%, touched 98 — 충분
  { id: "421",    title: "시계" },                      // fresh 64%, touched 96 — 충분
  { id: "610",    title: "가전제품" },                  // fresh 86%, touched 105 — 충분
  { id: "700600", title: "골프" },                      // fresh 88%, touched 100 — 충분
  // Wave 91: 일반인 친화 + 차익 가능. 35 sub × 100 매물 측정 결과 기반.
  // Wave 156 (2026-05-16): 신발 학습용 깊은 sweep — page 0~15 (1,500매물). 오래 안 팔린 매물 다양한 패턴 (condition/가품).
  { id: "405",    title: "신발", pageCount: 15 },        // fresh 88%, touched 98 — 깊은 sweep으로 다양한 condition 패턴 학습용
  { id: "430",    title: "가방/지갑" },                 // fresh 90%, touched 103 — 충분
  { id: "700350", title: "자전거" },                    // fresh 93%, touched 73 — 충분
];

function buildCategorySweepQueries(): string[] {
  return DEFAULT_CATEGORY_SWEEPS.map((entry) => `category:${entry.id}`);
}

// Wave 101: query string → custom page index array. override 없으면 caller가 standard pages 사용.
// 5분당 quota 1,248건 (13 × 96) → 1,536건 (16 × 96) +23%. fresh % 낮은 3 카테고리만 page 1 추가.
export function getCategoryPageOverrides(): Record<string, number[]> {
  const map: Record<string, number[]> = {};
  for (const entry of DEFAULT_CATEGORY_SWEEPS) {
    if (entry.pageCount && entry.pageCount > 1) {
      map[`category:${entry.id}`] = Array.from({ length: entry.pageCount }, (_, i) => i);
    }
  }
  return map;
}

export type PipelineRuntimeConfig = {
  searchQueries: string[];
  pagesPerQuery: number;
  maxPagesPerQuery: number;
  searchDelayMs: number;
  detailLimit: number;
  maxDetailLimit: number;
  detailConcurrency: number;
  maxDetailConcurrency: number;
  detailDelayMs: number;
  aiReviewTopN: number;
  maxAiReviewTopN: number;
  aiReviewConcurrency: number;
  maxAiReviewConcurrency: number;
  staleRunMinutes: number;
  tickSearchBudgetMs: number;
  tickDetailBudgetMs: number;
  // Wave 187 B2: lifecycle 전용 budget (route maxDuration 90s 활용).
  lifecycleBudgetMs: number;
  tickScoreBudgetMs: number;
  tickDetailBatchSize: number;
  terminalLifecycleRecheckBatchSize: number;
  terminalLifecycleRecheckCooldownMs: number;
  terminalLifecycleRecheckPreserveStatus: boolean;
  tickDetailLeaseSeconds: number;
  tickScoreLimit: number;
  // Wave 159k (2026-05-17): score-stage에서 AI condition 호출 daily limit.
  // default 0 = 비활성 (현재 detail-worker만 trigger). 운영자가 env 변경해서 enable.
  scoreAiConditionDailyLimit: number;
  marketStatsLimit: number;
  deepCrawlMaxPage: number;
  sellerSearchRefreshMs: number;
  rawTouchCoalesceActiveSeenOnly: boolean;
  rawTouchCoalesceActiveSeenOnlyDryRun: boolean;
  rawTouchCoalesceActiveSeenOnlyWindowMs: number;
  rawTouchCoalesceActiveSeenOnlyNonPoolWindowMs: number;
};

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const parsed = raw == null ? fallback : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function envIntAny(names: string[], fallback: number, min: number, max: number): number {
  for (const name of names) {
    const raw = process.env[name];
    if (raw != null) return envInt(name, fallback, min, max);
  }
  return Math.max(min, Math.min(max, fallback));
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function envQueries(): string[] {
  const raw = process.env.PIPELINE_SEARCH_QUERIES;
  const baseQueries = raw
    ? raw.split(",").map((q) => q.trim()).filter(Boolean)
    : DEFAULT_SEARCH_QUERIES;
  const queries = baseQueries.length > 0 ? baseQueries : DEFAULT_SEARCH_QUERIES;

  // Wave 88: category sweep 자동 포함. PIPELINE_DISABLE_CATEGORY_SWEEP=1로 끌 수 있음 (PoC/rollback용).
  if (envBool("PIPELINE_DISABLE_CATEGORY_SWEEP", false)) {
    return queries;
  }
  const categoryQueries = buildCategorySweepQueries();
  // dedupe + category sweep을 FRONT에 배치 (tickSearchBudgetMs 안에서 우선 수행).
  // 첫 번째 wave 88 deploy 시 category sweep이 budget timeout으로 미실행되는 issue 발견 → 우선순위 fix.
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const q of [...categoryQueries, ...queries]) {
    if (!seen.has(q)) {
      seen.add(q);
      merged.push(q);
    }
  }
  return merged;
}

export function loadPipelineRuntimeConfig(): PipelineRuntimeConfig {
  const maxPagesPerQuery = envInt("PIPELINE_MAX_PAGES_PER_QUERY", 1, 1, 10);
  const maxDetailLimit = envInt("PIPELINE_MAX_DETAIL_LIMIT", 60, 0, 500);
  const maxDetailConcurrency = envInt("PIPELINE_MAX_DETAIL_CONCURRENCY", 2, 1, 10);
  const maxAiReviewTopN = envInt("PIPELINE_MAX_AI_REVIEW_TOP_N", 10, 0, 200);
  const maxAiReviewConcurrency = envInt("PIPELINE_MAX_AI_REVIEW_CONCURRENCY", 2, 1, 20);

  const rawTouchCoalesceActiveSeenOnlyWindowMs = envInt("RAW_TOUCH_COALESCE_ACTIVE_SEEN_ONLY_WINDOW_MS", 10 * 60 * 1000, 60 * 1000, 24 * 60 * 60 * 1000);

  return {
    searchQueries: envQueries(),
    pagesPerQuery: envInt("PIPELINE_PAGES_PER_QUERY", 1, 1, maxPagesPerQuery),
    maxPagesPerQuery,
    searchDelayMs: envInt("PIPELINE_SEARCH_DELAY_MS", 100, 0, 3000),
    detailLimit: envIntAny(["PIPELINE_DETAIL_LIMIT", "DETAIL_ENRICH_LIMIT"], 60, 0, maxDetailLimit),
    maxDetailLimit,
    detailConcurrency: envInt("PIPELINE_DETAIL_CONCURRENCY", 2, 1, maxDetailConcurrency),
    maxDetailConcurrency,
    detailDelayMs: envInt("PIPELINE_DETAIL_DELAY_MS", 300, 0, 5000),
    aiReviewTopN: envIntAny(["PIPELINE_AI_REVIEW_TOP_N", "AI_REVIEW_TOP_N"], 10, 0, maxAiReviewTopN),
    maxAiReviewTopN,
    aiReviewConcurrency: envIntAny(["PIPELINE_AI_REVIEW_CONCURRENCY", "AI_REVIEW_CONCURRENCY"], 5, 1, maxAiReviewConcurrency),
    maxAiReviewConcurrency,
    staleRunMinutes: envInt("PIPELINE_STALE_RUN_MINUTES", 3, 1, 60),
    // Wave 88 follow-up: 15s → 25s. 127 narrow + 10 category sweep을 한 tick에 다 처리.
    // Vercel maxDuration 60s 안에 search(25s) + score(10s) + DB write(~5s) = 40s 여유.
    tickSearchBudgetMs: envInt("PIPELINE_TICK_SEARCH_BUDGET_MS", 25_000, 1_000, 120_000),
    tickDetailBudgetMs: envInt("PIPELINE_TICK_DETAIL_BUDGET_MS", 20_000, 1_000, 120_000),
    // Wave 187 B2 (2026-05-17): lifecycle 전용 budget. tickDetailBudgetMs (20s) 공유 시
    //   batch 800 매물 처리에 timeout (claimed 800 / enriched 139). budget 늘려서 cycle 처리량 ↑.
    //   60s 결정 이유: lifecycle-worker route 가 lifecycle + terminal_recheck 둘 다 호출.
    //   maxDuration 90s 안에 lifecycle 60s + terminal_recheck 30s 안전 분배.
    //   실측 75s budget 시 batch 800 → enriched 621 (78%). 60s 시 ~466 enriched 예상.
    lifecycleBudgetMs: envInt("PIPELINE_LIFECYCLE_BUDGET_MS", 60_000, 1_000, 120_000),
    tickScoreBudgetMs: envInt("PIPELINE_TICK_SCORE_BUDGET_MS", 10_000, 1_000, 120_000),
    tickDetailBatchSize: envInt("PIPELINE_TICK_DETAIL_BATCH_SIZE", 20, 1, 200),
    terminalLifecycleRecheckBatchSize: envInt("PIPELINE_TERMINAL_LIFECYCLE_RECHECK_BATCH_SIZE", 10, 1, 50),
    terminalLifecycleRecheckCooldownMs: envInt("PIPELINE_TERMINAL_LIFECYCLE_RECHECK_COOLDOWN_MS", 30 * 60 * 1000, 60 * 1000, 24 * 60 * 60 * 1000),
    terminalLifecycleRecheckPreserveStatus: envBool("PIPELINE_TERMINAL_LIFECYCLE_RECHECK_PRESERVE_STATUS", false),
    tickDetailLeaseSeconds: envInt("PIPELINE_TICK_DETAIL_LEASE_SECONDS", 90, 10, 900),
    // Wave 159j (2026-05-17): 150 → 800. score_dirty backlog 119K건 처리 매우 느림 (13h 추정).
    // budget 10초 안에서 처리 가능 (단순 DB read + score + write, detail 호출 X).
    // 매물당 ~12ms 가정 → 800건/9.6초.
    tickScoreLimit: envInt("PIPELINE_TICK_SCORE_LIMIT", 800, 10, 2000),
    // Wave 159k (2026-05-17): score-stage condition AI 호출 daily limit.
    // 0 = 비활성 (default). 측정 결과 11,243건 trigger 대상이지만 실제 호출 0건.
    // 운영자가 enable 시 PIPELINE_SCORE_AI_CONDITION_DAILY_LIMIT=500 같이 박음.
    // cost: 매물당 ~$0.0002 → 500/day = $0.10/day = $3/month.
    scoreAiConditionDailyLimit: envInt("PIPELINE_SCORE_AI_CONDITION_DAILY_LIMIT", 0, 0, 10000),
    // Wave 174 (2026-05-17): 800 → 3000 — Wave 156 신발 sweep 깊게 (2,182건 매물) 이후
    // 전 카테고리 14K+ 매물 중 시세 daily 박힘 비율 1.7-3.3% 머무름. 신발 ready 승급(Wave 172) +
    // trustedMedian total≥2 완화(Wave 173) 했는데도 시세 daily 36 row만 → pool 0건.
    // 한 tick 4-5초 → 15-20초로 늘어남 (maxDuration 60초 한도 안).
    // Wave 184 (2026-05-17): 3000 → 8000. incremental lookback 28h 안 매물 6.7K 측정.
    //   PostgREST max-rows=1000 cap → loadMarketStatRows 가 pagination 으로 chunk 페치.
    //   8000 / 1000 = 8 chunks max. lookback 안 6.7K 다 cover + 마진.
    //   1 chunk ≈ 5s → 8 chunks ≈ 40s + group/upsert. maxDuration 90 안에 들어옴.
    marketStatsLimit: envInt("PIPELINE_MARKET_STATS_LIMIT", 8000, 100, 20000),
    deepCrawlMaxPage: envInt("PIPELINE_DEEP_CRAWL_MAX_PAGE", 3, 1, 30),
    sellerSearchRefreshMs: envInt("PIPELINE_SELLER_SEARCH_REFRESH_MS", 3 * 60 * 60 * 1000, 10 * 60 * 1000, 24 * 60 * 60 * 1000),
    rawTouchCoalesceActiveSeenOnly: envBool("RAW_TOUCH_COALESCE_ACTIVE_SEEN_ONLY", false),
    rawTouchCoalesceActiveSeenOnlyDryRun: envBool("RAW_TOUCH_COALESCE_ACTIVE_SEEN_ONLY_DRY_RUN", false),
    rawTouchCoalesceActiveSeenOnlyWindowMs,
    rawTouchCoalesceActiveSeenOnlyNonPoolWindowMs: envInt(
      "RAW_TOUCH_COALESCE_ACTIVE_SEEN_ONLY_NON_POOL_WINDOW_MS",
      rawTouchCoalesceActiveSeenOnlyWindowMs,
      rawTouchCoalesceActiveSeenOnlyWindowMs,
      24 * 60 * 60 * 1000,
    ),
  };
}

export function boundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = raw == null ? fallback : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
