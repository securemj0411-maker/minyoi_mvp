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
  if (!raw) return DEFAULT_SEARCH_QUERIES;
  const queries = raw
    .split(",")
    .map((query) => query.trim())
    .filter(Boolean);
  return queries.length > 0 ? queries : DEFAULT_SEARCH_QUERIES;
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
    tickSearchBudgetMs: envInt("PIPELINE_TICK_SEARCH_BUDGET_MS", 15_000, 1_000, 120_000),
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
