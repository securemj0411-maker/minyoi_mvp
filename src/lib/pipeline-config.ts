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
  { id: "405",    title: "신발" },                      // fresh 88%, touched 98 — 충분
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
  tickScoreBudgetMs: number;
  tickDetailBatchSize: number;
  terminalLifecycleRecheckBatchSize: number;
  terminalLifecycleRecheckCooldownMs: number;
  terminalLifecycleRecheckPreserveStatus: boolean;
  tickDetailLeaseSeconds: number;
  tickScoreLimit: number;
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
    tickScoreBudgetMs: envInt("PIPELINE_TICK_SCORE_BUDGET_MS", 10_000, 1_000, 120_000),
    tickDetailBatchSize: envInt("PIPELINE_TICK_DETAIL_BATCH_SIZE", 20, 1, 200),
    terminalLifecycleRecheckBatchSize: envInt("PIPELINE_TERMINAL_LIFECYCLE_RECHECK_BATCH_SIZE", 10, 1, 50),
    terminalLifecycleRecheckCooldownMs: envInt("PIPELINE_TERMINAL_LIFECYCLE_RECHECK_COOLDOWN_MS", 30 * 60 * 1000, 60 * 1000, 24 * 60 * 60 * 1000),
    terminalLifecycleRecheckPreserveStatus: envBool("PIPELINE_TERMINAL_LIFECYCLE_RECHECK_PRESERVE_STATUS", false),
    tickDetailLeaseSeconds: envInt("PIPELINE_TICK_DETAIL_LEASE_SECONDS", 90, 10, 900),
    tickScoreLimit: envInt("PIPELINE_TICK_SCORE_LIMIT", 150, 10, 2000),
    marketStatsLimit: envInt("PIPELINE_MARKET_STATS_LIMIT", 800, 100, 10000),
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
