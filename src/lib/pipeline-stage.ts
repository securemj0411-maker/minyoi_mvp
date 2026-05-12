export type StageStats = {
  collected: number;
  searchSucceeded: number;
  searchFailed: number;
  rawUpserted: number;
  queued: number;
  detailQueueSkipped: number;
  claimed: number;
  enriched: number;
  detailFailed: number;
  scored: number;
  aiReviewRequested: number;
  aiCacheHits: number;
  aiApiCalls: number;
  aiUnavailable: number;
  aiFiltered: number;
  aiKeptNormal: number;
  aiKeptLowConfidence: number;
  sellerUpserted: number;
  upserted: number;
  poolUpserted: number;
  poolSkipped: number;
  timedOut: boolean;
  timingsMs?: Record<string, number>;
};

export type TickResult = StageStats & {
  stages: Record<string, StageStats>;
  stageDurationsMs: Record<string, number>;
};

export function emptyStats(): StageStats {
  return {
    collected: 0,
    searchSucceeded: 0,
    searchFailed: 0,
    rawUpserted: 0,
    queued: 0,
    detailQueueSkipped: 0,
    claimed: 0,
    enriched: 0,
    detailFailed: 0,
    scored: 0,
    aiReviewRequested: 0,
    aiCacheHits: 0,
    aiApiCalls: 0,
    aiUnavailable: 0,
    aiFiltered: 0,
    aiKeptNormal: 0,
    aiKeptLowConfidence: 0,
    sellerUpserted: 0,
    upserted: 0,
    poolUpserted: 0,
    poolSkipped: 0,
    timedOut: false,
  };
}

export function mergeStats(parts: StageStats[]): StageStats {
  return parts.reduce((acc, part) => ({
    collected: acc.collected + part.collected,
    searchSucceeded: acc.searchSucceeded + part.searchSucceeded,
    searchFailed: acc.searchFailed + part.searchFailed,
    rawUpserted: acc.rawUpserted + part.rawUpserted,
    queued: acc.queued + part.queued,
    detailQueueSkipped: acc.detailQueueSkipped + part.detailQueueSkipped,
    claimed: acc.claimed + part.claimed,
    enriched: acc.enriched + part.enriched,
    detailFailed: acc.detailFailed + part.detailFailed,
    scored: acc.scored + part.scored,
    aiReviewRequested: acc.aiReviewRequested + part.aiReviewRequested,
    aiCacheHits: acc.aiCacheHits + part.aiCacheHits,
    aiApiCalls: acc.aiApiCalls + part.aiApiCalls,
    aiUnavailable: acc.aiUnavailable + part.aiUnavailable,
    aiFiltered: acc.aiFiltered + part.aiFiltered,
    aiKeptNormal: acc.aiKeptNormal + part.aiKeptNormal,
    aiKeptLowConfidence: acc.aiKeptLowConfidence + part.aiKeptLowConfidence,
    sellerUpserted: acc.sellerUpserted + part.sellerUpserted,
    upserted: acc.upserted + part.upserted,
    poolUpserted: acc.poolUpserted + part.poolUpserted,
    poolSkipped: acc.poolSkipped + part.poolSkipped,
    timedOut: acc.timedOut || part.timedOut,
  }), emptyStats());
}

export async function timedStage<T>(
  stageDurationsMs: Record<string, number>,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    stageDurationsMs[name] = Date.now() - started;
  }
}
