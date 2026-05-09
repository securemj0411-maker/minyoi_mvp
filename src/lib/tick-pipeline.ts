import { searchPage, fetchDetail, type SearchItem } from "@/lib/bunjang";
import { CATALOG } from "@/lib/catalog";
import {
  applyAiReview,
  classifyListing,
  parseShippingFromDescription,
  parseShippingFromTrade,
  resolveShipping,
  type PipelineRow,
} from "@/lib/pipeline";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";

type Headers = Record<string, string>;

type RawListingRow = {
  pid: number;
  name: string;
  price: number;
  num_faved: number;
  free_shipping: boolean;
  url: string;
  detail_enriched_at: string | null;
  last_changed_at: string;
};

type QueueClaimRow = {
  queue_id: string;
  pid: number;
  name: string;
  price: number;
  num_faved: number;
  free_shipping: boolean;
  url: string;
  attempts: number;
};

type ScorableRawRow = RawListingRow & {
  description_preview: string;
  shop_review_rating: number | null;
  shop_review_count: number;
  trade_data: unknown;
  trades_data: unknown;
  listing_type: string;
  sku_id: string | null;
  sku_name: string | null;
};

export type StageStats = {
  collected: number;
  rawUpserted: number;
  queued: number;
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
  upserted: number;
  timedOut: boolean;
};

export type TickResult = StageStats & {
  stages: Record<string, StageStats>;
  stageDurationsMs: Record<string, number>;
};

function emptyStats(): StageStats {
  return {
    collected: 0,
    rawUpserted: 0,
    queued: 0,
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
    upserted: 0,
    timedOut: false,
  };
}

function mergeStats(parts: StageStats[]): StageStats {
  return parts.reduce((acc, part) => ({
    collected: acc.collected + part.collected,
    rawUpserted: acc.rawUpserted + part.rawUpserted,
    queued: acc.queued + part.queued,
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
    upserted: acc.upserted + part.upserted,
    timedOut: acc.timedOut || part.timedOut,
  }), emptyStats());
}

function serviceHeaders(prefer?: string): Headers {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    ...(prefer ? { prefer } : {}),
  };
}

function restBase() {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!raw) throw new Error("SUPABASE_URL missing");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function tableUrl(table: string) {
  return `${restBase()}/${table}`;
}

function rpcUrl(name: string) {
  return `${restBase()}/rpc/${name}`;
}

async function restFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase REST failed ${res.status}: ${body}`);
  }
  return res;
}

async function upsertRows(table: string, rows: unknown[], onConflict?: string): Promise<void> {
  if (rows.length === 0) return;
  const url = onConflict ? `${tableUrl(table)}?on_conflict=${encodeURIComponent(onConflict)}` : tableUrl(table);
  await restFetch(url, {
    method: "POST",
    headers: serviceHeaders("resolution=merge-duplicates"),
    body: JSON.stringify(rows),
  });
}

async function insertIgnoreRows(table: string, rows: unknown[], onConflict?: string): Promise<void> {
  if (rows.length === 0) return;
  const url = onConflict ? `${tableUrl(table)}?on_conflict=${encodeURIComponent(onConflict)}` : tableUrl(table);
  await restFetch(url, {
    method: "POST",
    headers: serviceHeaders("resolution=ignore-duplicates"),
    body: JSON.stringify(rows),
  });
}

async function patchRows(table: string, filter: string, payload: Record<string, unknown>): Promise<void> {
  await restFetch(`${tableUrl(table)}?${filter}`, {
    method: "PATCH",
    headers: serviceHeaders(),
    body: JSON.stringify(payload),
  });
}

function pidList(items: SearchItem[]) {
  return items.map((item) => Number(item.pid)).filter(Number.isFinite);
}

async function loadExistingRaw(pids: number[]): Promise<Map<number, RawListingRow>> {
  if (pids.length === 0) return new Map();
  const unique = [...new Set(pids)];
  const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,price,num_faved,free_shipping,url,detail_enriched_at,last_changed_at&pid=in.(${unique.join(",")})`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  const rows = (await res.json()) as RawListingRow[];
  return new Map(rows.map((row) => [row.pid, row]));
}

function changedEnough(item: SearchItem, existing: RawListingRow | undefined) {
  if (!existing) return true;
  if (!existing.detail_enriched_at) return true;
  return (
    existing.name !== item.name ||
    existing.price !== item.price ||
    existing.num_faved !== item.numFaved ||
    existing.free_shipping !== item.freeShipping
  );
}

export async function searchStage(deadlineMs: number): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const seen = new Map<string, SearchItem>();

  for (const query of config.searchQueries) {
    for (let page = 0; page < config.pagesPerQuery; page += 1) {
      if (Date.now() >= deadlineMs) {
        stats.timedOut = true;
        return stats;
      }
      const items = await searchPage(query, page);
      for (const item of items) {
        if (!seen.has(item.pid)) seen.set(item.pid, item);
      }
      stats.collected += items.length;
      if (config.searchDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, config.searchDelayMs));
    }
  }

  const items = [...seen.values()];
  const existing = await loadExistingRaw(pidList(items));
  const now = new Date().toISOString();

  await upsertRows("mvp_raw_listings", items.map((item) => {
    const current = existing.get(Number(item.pid));
    return {
      pid: Number(item.pid),
      url: item.url,
      name: item.name,
      price: item.price,
      num_faved: item.numFaved,
      free_shipping: item.freeShipping,
      query: item.query,
      source: "bunjang",
      last_seen_at: now,
      last_changed_at: changedEnough(item, current) ? now : current?.last_changed_at ?? now,
      updated_at: now,
    };
  }), "pid");
  stats.rawUpserted = items.length;

  const queueItems = items.filter((item) => changedEnough(item, existing.get(Number(item.pid))));
  await insertIgnoreRows("mvp_detail_queue", queueItems.map((item) => ({
    pid: Number(item.pid),
    status: "pending",
    priority: item.numFaved,
    available_at: now,
    locked_at: null,
    locked_until: null,
    last_error: null,
    updated_at: now,
  })), "pid");
  stats.queued = queueItems.length;

  return stats;
}

async function claimDetailQueue(): Promise<QueueClaimRow[]> {
  const config = loadPipelineRuntimeConfig();
  const res = await restFetch(rpcUrl("claim_mvp_detail_queue"), {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      p_batch_size: config.tickDetailBatchSize,
      p_lease_seconds: config.tickDetailLeaseSeconds,
    }),
  });
  return (await res.json()) as QueueClaimRow[];
}

async function markQueueDone(queueId: string) {
  await patchRows("mvp_detail_queue", `id=eq.${encodeURIComponent(queueId)}`, {
    status: "done",
    locked_until: null,
    updated_at: new Date().toISOString(),
  });
}

async function markQueueFailed(queueId: string, error: string) {
  await patchRows("mvp_detail_queue", `id=eq.${encodeURIComponent(queueId)}`, {
    status: "failed",
    locked_until: null,
    available_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    last_error: error.slice(0, 500),
    updated_at: new Date().toISOString(),
  });
}

export async function detailStage(deadlineMs: number): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const claims = await claimDetailQueue();
  stats.claimed = claims.length;

  for (const claim of claims) {
    if (Date.now() >= deadlineMs) {
      stats.timedOut = true;
      return stats;
    }
    try {
      const detail = await fetchDetail(String(claim.pid));
      if (config.detailDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, config.detailDelayMs));
      if (!detail) {
        stats.detailFailed += 1;
        await markQueueFailed(claim.queue_id, "detail api returned null");
        continue;
      }
      const { listingType, sku } = classifyListing(claim.name, detail.description, claim.price);
      const now = new Date().toISOString();
      await patchRows("mvp_raw_listings", `pid=eq.${claim.pid}`, {
        description_preview: detail.description.slice(0, 500),
        sale_status: detail.saleStatus,
        shop_review_rating: detail.shopReviewRating,
        shop_review_count: detail.shopReviewCount,
        trade_data: detail.tradeData,
        trades_data: detail.tradesData,
        listing_type: listingType,
        sku_id: sku?.id ?? null,
        sku_name: sku?.modelName ?? null,
        detail_status: "done",
        detail_enriched_at: now,
        detail_error: null,
        updated_at: now,
      });
      await markQueueDone(claim.queue_id);
      stats.enriched += 1;
    } catch (err) {
      stats.detailFailed += 1;
      await markQueueFailed(claim.queue_id, err instanceof Error ? err.message : String(err));
    }
  }

  return stats;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentileRank(values: number[], value: number) {
  if (values.length <= 1) return 0.5;
  const belowOrEqual = values.filter((v) => v <= value).length;
  return Math.max(0, Math.min(1, (belowOrEqual - 1) / (values.length - 1)));
}

async function loadScorableRows(limit: number): Promise<ScorableRawRow[]> {
  const columns = "pid,name,price,num_faved,free_shipping,url,description_preview,shop_review_rating,shop_review_count,trade_data,trades_data,listing_type,sku_id,sku_name,detail_enriched_at";
  const url = `${tableUrl("mvp_raw_listings")}?select=${columns}&detail_status=eq.done&listing_type=eq.normal&sku_id=not.is.null&order=last_seen_at.desc&limit=${limit}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as ScorableRawRow[];
}

export async function scoreStage(deadlineMs: number): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const rows = await loadScorableRows(config.tickScoreLimit);
  if (rows.length === 0) return stats;

  const pricesBySku = new Map<string, number[]>();
  const favsBySku = new Map<string, number[]>();
  for (const row of rows) {
    const skuId = row.sku_id ?? "";
    if (!pricesBySku.has(skuId)) pricesBySku.set(skuId, []);
    if (!favsBySku.has(skuId)) favsBySku.set(skuId, []);
    pricesBySku.get(skuId)!.push(row.price);
    favsBySku.get(skuId)!.push(row.num_faved);
  }

  const skuMsrp = new Map(CATALOG.map((sku) => [sku.id, sku.msrpKrw]));
  const now = new Date().toISOString();
  const scoredRows: PipelineRow[] = [];

  for (const row of rows) {
    if (Date.now() >= deadlineMs) {
      stats.timedOut = true;
      break;
    }
    const skuId = row.sku_id ?? "";
    const prices = pricesBySku.get(skuId) ?? [];
    const skuMedian = prices.length >= 5 ? median(prices) : (skuMsrp.get(skuId) ?? 300000) * 0.5;
    const priceGap = skuMedian <= 0 ? 0 : Math.max(0, Math.min(1, (skuMedian - row.price) / skuMedian));
    const velocity = percentileRank(favsBySku.get(skuId) ?? [], row.num_faved);
    const safetyBase = row.shop_review_rating == null ? 0.5 : Math.max(0, Math.min(1, Number(row.shop_review_rating) / 5));
    const safety = Math.max(0, Math.min(1, safetyBase + (row.shop_review_count >= 100 ? 0.05 : 0)));
    const riskHits = ["직거래만", "현금만", "박스없음", "박스 없음", "수리이력", "충전안됨", "충전 안됨", "고장", "불량", "먹통"]
      .filter((kw) => row.description_preview.toLowerCase().includes(kw.toLowerCase())).length;
    const score = (priceGap * 0.5 + velocity * 0.4 + safety * 0.1) * 100;
    const apiParsed = parseShippingFromTrade(row.trade_data, row.trades_data);
    const descParsed = parseShippingFromDescription(row.description_preview);
    const shipping = resolveShipping(row.price, skuMedian, row.free_shipping, apiParsed, descParsed);
    const scoreFlags: string[] = [];
    if (priceGap >= 0.55) scoreFlags.push("deep_discount_review");
    if (riskHits > 0) scoreFlags.push("risk_keyword_review");
    if (row.description_preview.trim().length < 20) scoreFlags.push("weak_description");

    scoredRows.push({
      pid: String(row.pid),
      url: row.url,
      name: row.name,
      price: row.price,
      skuId,
      skuName: row.sku_name ?? skuId,
      skuMedian: Math.round(skuMedian),
      descriptionPreview: row.description_preview.slice(0, 200),
      priceGap,
      numFaved: row.num_faved,
      velocity,
      reviewRating: row.shop_review_rating,
      reviewCount: row.shop_review_count,
      safety,
      riskHits,
      score,
      scoreFlags,
      ...shipping,
    });
  }

  const aiReview = await applyAiReview(scoredRows, {
    enabled: config.aiReviewTopN > 0,
    topN: config.aiReviewTopN,
    concurrency: config.aiReviewConcurrency,
  });
  stats.aiReviewRequested = aiReview.stats.requested;
  stats.aiCacheHits = aiReview.stats.cacheHits;
  stats.aiApiCalls = aiReview.stats.apiCalls;
  stats.aiUnavailable = aiReview.stats.unavailable;
  stats.aiFiltered = aiReview.stats.filtered;
  stats.aiKeptNormal = aiReview.stats.keptNormal;
  stats.aiKeptLowConfidence = aiReview.stats.keptLowConfidence;

  const listings = aiReview.rows.map((row) => ({
    pid: Number(row.pid),
    url: row.url,
    name: row.name,
    price: row.price,
    sku_name: row.skuName,
    sku_median: row.skuMedian,
    description_preview: row.descriptionPreview,
    shipping_fee: row.shippingFee,
    shipping_fee_general: row.shippingFeeGeneral,
    shipping_source: row.shippingSource,
    estimated_buy_cost: row.estimatedBuyCost,
    gross_resell_gap: row.grossResellGap,
    net_gap_after_shipping: row.netGapAfterShipping,
    source_json: { pipeline: "tick" },
    generated_at: now,
    updated_at: now,
  }));
  const analyses = aiReview.rows.map((row) => ({
    pid: Number(row.pid),
    price_gap: row.priceGap,
    num_faved: row.numFaved,
    velocity: row.velocity,
    review_rating: row.reviewRating,
    review_count: row.reviewCount,
    safety: row.safety,
    risk_hits: row.riskHits,
    score: row.score,
    score_flags: row.scoreFlags,
    source_json: { pipeline: "tick" },
    analyzed_at: now,
    updated_at: now,
  }));

  const ranked = analyses
    .map((analysis, index) => ({ ...analysis, originalIndex: index }))
    .sort((a, b) => Number(b.score) - Number(a.score));
  const rankByPid = new Map(ranked.map((analysis, index) => [analysis.pid, index + 1]));
  const rankedAnalyses = analyses.map((analysis) => ({
    ...analysis,
    candidate_rank: rankByPid.get(analysis.pid) ?? null,
  }));

  await upsertRows("mvp_listings", listings, "pid");
  await upsertRows("mvp_listing_analysis", rankedAnalyses, "pid");
  stats.scored = scoredRows.length;
  stats.upserted = listings.length;
  return stats;
}

export async function runTickPipeline(): Promise<TickResult> {
  const config = loadPipelineRuntimeConfig();
  const stageDurationsMs: Record<string, number> = {};

  async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
      return await fn();
    } finally {
      stageDurationsMs[name] = Date.now() - started;
    }
  }

  const search = await timed("search", () => searchStage(Date.now() + config.tickSearchBudgetMs));
  const detail = await timed("detail", () => detailStage(Date.now() + config.tickDetailBudgetMs));
  const score = await timed("score", () => scoreStage(Date.now() + config.tickScoreBudgetMs));
  const total = mergeStats([search, detail, score]);
  return {
    ...total,
    stages: { search, detail, score },
    stageDurationsMs,
  };
}
