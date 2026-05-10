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
  tickDetailLeaseSeconds: number;
  tickScoreLimit: number;
  marketStatsLimit: number;
  deepCrawlMaxPage: number;
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
  const maxPagesPerQuery = envInt("PIPELINE_MAX_PAGES_PER_QUERY", 3, 1, 10);
  const maxDetailLimit = envInt("PIPELINE_MAX_DETAIL_LIMIT", 120, 0, 500);
  const maxDetailConcurrency = envInt("PIPELINE_MAX_DETAIL_CONCURRENCY", 4, 1, 10);
  const maxAiReviewTopN = envInt("PIPELINE_MAX_AI_REVIEW_TOP_N", 30, 0, 200);
  const maxAiReviewConcurrency = envInt("PIPELINE_MAX_AI_REVIEW_CONCURRENCY", 5, 1, 20);

  return {
    searchQueries: envQueries(),
    pagesPerQuery: envInt("PIPELINE_PAGES_PER_QUERY", 2, 1, maxPagesPerQuery),
    maxPagesPerQuery,
    searchDelayMs: envInt("PIPELINE_SEARCH_DELAY_MS", 200, 0, 3000),
    detailLimit: envIntAny(["PIPELINE_DETAIL_LIMIT", "DETAIL_ENRICH_LIMIT"], 120, 0, maxDetailLimit),
    maxDetailLimit,
    detailConcurrency: envInt("PIPELINE_DETAIL_CONCURRENCY", 2, 1, maxDetailConcurrency),
    maxDetailConcurrency,
    detailDelayMs: envInt("PIPELINE_DETAIL_DELAY_MS", 300, 0, 5000),
    aiReviewTopN: envIntAny(["PIPELINE_AI_REVIEW_TOP_N", "AI_REVIEW_TOP_N"], 30, 0, maxAiReviewTopN),
    maxAiReviewTopN,
    aiReviewConcurrency: envIntAny(["PIPELINE_AI_REVIEW_CONCURRENCY", "AI_REVIEW_CONCURRENCY"], 5, 1, maxAiReviewConcurrency),
    maxAiReviewConcurrency,
    staleRunMinutes: envInt("PIPELINE_STALE_RUN_MINUTES", 3, 1, 60),
    tickSearchBudgetMs: envInt("PIPELINE_TICK_SEARCH_BUDGET_MS", 20_000, 1_000, 120_000),
    tickDetailBudgetMs: envInt("PIPELINE_TICK_DETAIL_BUDGET_MS", 45_000, 1_000, 120_000),
    tickScoreBudgetMs: envInt("PIPELINE_TICK_SCORE_BUDGET_MS", 10_000, 1_000, 120_000),
    tickDetailBatchSize: envInt("PIPELINE_TICK_DETAIL_BATCH_SIZE", 40, 1, 200),
    tickDetailLeaseSeconds: envInt("PIPELINE_TICK_DETAIL_LEASE_SECONDS", 150, 10, 900),
    tickScoreLimit: envInt("PIPELINE_TICK_SCORE_LIMIT", 300, 10, 2000),
    marketStatsLimit: envInt("PIPELINE_MARKET_STATS_LIMIT", 3000, 100, 10000),
    deepCrawlMaxPage: envInt("PIPELINE_DEEP_CRAWL_MAX_PAGE", 10, 1, 30),
  };
}

export function boundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = raw == null ? fallback : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
