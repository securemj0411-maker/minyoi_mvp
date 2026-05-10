import { searchPage, fetchDetail, type SearchItem } from "@/lib/bunjang";
import { CATALOG } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import {
  applyAiReview,
  classifyListing,
  parseShippingFromDescription,
  parseShippingFromTrade,
  resolveShipping,
  type PipelineRow,
} from "@/lib/pipeline";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";
import { RESELL_SHIPPING_FEE, SAFETY_BUFFER, SELLING_FEE_RATE, bandFromProfit } from "@/lib/profit";

type Headers = Record<string, string>;

type RawListingRow = {
  pid: number;
  name: string;
  price: number;
  num_faved: number;
  free_shipping: boolean;
  url: string;
  detail_enriched_at: string | null;
  last_seen_at: string;
  last_changed_at: string;
  listing_state: string;
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
  image_url_template: string | null;
  image_count: number;
  thumbnail_url: string | null;
  listing_type: string;
  sku_id: string | null;
  sku_name: string | null;
};

type ParsedListingRow = {
  pid: number;
  comparable_key: string | null;
  parse_confidence: number | null;
  condition_score: number | null;
  needs_review: boolean | null;
};

const DETAIL_STAGE_SAFETY_MARGIN_MS = 8_000;
const POOL_CONFIDENCE_FLOOR = 0.7;
const POOL_BLOCK_FLAGS = [
  "coarse_market_price",
  "option_parse_review",
  "option_needs_review",
  "ai_review_unavailable",
  "weak_description",
  "risk_keyword_review",
];

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
  poolUpserted: number;
  poolSkipped: number;
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
    poolUpserted: 0,
    poolSkipped: 0,
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
    poolUpserted: acc.poolUpserted + part.poolUpserted,
    poolSkipped: acc.poolSkipped + part.poolSkipped,
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

async function insertRows(table: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  await restFetch(tableUrl(table), {
    method: "POST",
    headers: serviceHeaders("return=minimal"),
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
  const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,price,num_faved,free_shipping,url,detail_enriched_at,last_seen_at,last_changed_at,listing_state&pid=in.(${unique.join(",")})`;
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

function sameKoreanDate(a: string | undefined, b: string) {
  if (!a) return false;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(a)) ===
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(b));
}

function observationEventType(item: SearchItem, existing: RawListingRow | undefined, now: string) {
  if (!existing) return "first_seen";
  if (existing.price !== item.price) return "price_changed";
  if (existing.name !== item.name) return "title_changed";
  if (existing.num_faved !== item.numFaved) return "faved_changed";
  if (!sameKoreanDate(existing.last_seen_at, now)) return "daily_snapshot";
  return null;
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
  const observationRows = items.flatMap((item) => {
    const current = existing.get(Number(item.pid));
    const eventType = observationEventType(item, current, now);
    if (!eventType) return [];
    const changedFields = {
      price: current && current.price !== item.price,
      name: current && current.name !== item.name,
      numFaved: current && current.num_faved !== item.numFaved,
      freeShipping: current && current.free_shipping !== item.freeShipping,
    };
    return [{
      pid: Number(item.pid),
      observed_at: now,
      event_type: eventType,
      listing_state: "active",
      price: item.price,
      num_faved: item.numFaved,
      name: item.name,
      sale_status: "",
      source: "bunjang",
      raw_json: {
        query: item.query,
        url: item.url,
        freeShipping: item.freeShipping,
        previous: current ? {
          price: current.price,
          name: current.name,
          numFaved: current.num_faved,
          freeShipping: current.free_shipping,
          listingState: current.listing_state,
        } : null,
        changedFields,
      },
    }];
  });

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
      listing_state: "active",
      missing_count: 0,
      last_missing_at: null,
      last_seen_at: now,
      last_changed_at: changedEnough(item, current) ? now : current?.last_changed_at ?? now,
      updated_at: now,
    };
  }), "pid");
  stats.rawUpserted = items.length;
  await insertRows("mvp_listing_observations", observationRows);

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

  while (Date.now() < deadlineMs - DETAIL_STAGE_SAFETY_MARGIN_MS) {
    const claims = await claimDetailQueue();
    if (claims.length === 0) break;
    stats.claimed += claims.length;

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
        const parsed = parseListingOptions({
          title: claim.name,
          description: detail.description,
          skuId: sku?.id ?? null,
          skuName: sku?.modelName ?? null,
          category: sku?.category ?? null,
        });
        const now = new Date().toISOString();
        await patchRows("mvp_raw_listings", `pid=eq.${claim.pid}`, {
          description_preview: detail.description.slice(0, 500),
          sale_status: detail.saleStatus,
          shop_review_rating: detail.shopReviewRating,
          shop_review_count: detail.shopReviewCount,
          trade_data: detail.tradeData,
          trades_data: detail.tradesData,
          image_url_template: detail.imageUrlTemplate,
          image_count: detail.imageCount,
          thumbnail_url: detail.thumbnailUrl,
          listing_type: listingType,
          sku_id: sku?.id ?? null,
          sku_name: sku?.modelName ?? null,
          detail_status: "done",
          detail_enriched_at: now,
          detail_error: null,
          updated_at: now,
        });
        try {
          await upsertRows("mvp_listing_parsed", [toParsedListingRow(claim.pid, parsed)], "pid");
          await insertRows("mvp_listing_observations", [{
            pid: Number(claim.pid),
            observed_at: now,
            event_type: "detail_enriched",
            price: claim.price,
            name: claim.name,
            num_faved: claim.num_faved,
            sale_status: detail.saleStatus,
            listing_state: "active",
            sku_id: sku?.id ?? null,
            sku_name: sku?.modelName ?? null,
            comparable_key: parsed.comparableKey,
            parse_confidence: parsed.parseConfidence,
            source: "tick_detail",
            raw_json: {
              listing_type: listingType,
              parser_version: parsed.parserVersion,
              needs_review: parsed.needsReview,
            },
          }]);
        } catch (err) {
          console.error("option parse side-write failed", err);
        }
        await markQueueDone(claim.queue_id);
        stats.enriched += 1;
      } catch (err) {
        stats.detailFailed += 1;
        await markQueueFailed(claim.queue_id, err instanceof Error ? err.message : String(err));
      }
    }
  }

  if (Date.now() >= deadlineMs - DETAIL_STAGE_SAFETY_MARGIN_MS) {
    stats.timedOut = true;
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
  const columns = "pid,name,price,num_faved,free_shipping,url,description_preview,shop_review_rating,shop_review_count,trade_data,trades_data,image_url_template,image_count,thumbnail_url,listing_type,sku_id,sku_name,detail_enriched_at";
  const url = `${tableUrl("mvp_raw_listings")}?select=${columns}&detail_status=eq.done&listing_type=eq.normal&sku_id=not.is.null&order=last_seen_at.desc&limit=${limit}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as ScorableRawRow[];
}

async function loadParsedRows(pids: number[]): Promise<Map<number, ParsedListingRow>> {
  if (pids.length === 0) return new Map();
  const unique = [...new Set(pids)];
  const columns = "pid,comparable_key,parse_confidence,condition_score,needs_review";
  const url = `${tableUrl("mvp_listing_parsed")}?select=${columns}&pid=in.(${unique.join(",")})`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  const rows = (await res.json()) as ParsedListingRow[];
  return new Map(rows.map((row) => [row.pid, row]));
}

function marketGroupKey(row: ScorableRawRow, parsed: ParsedListingRow | undefined) {
  if (parsed?.comparable_key && Number(parsed.parse_confidence ?? 0) >= 0.65) {
    return parsed.comparable_key;
  }
  return row.sku_id ?? "";
}

function poolMaxExposure(band: 1 | 2 | 3) {
  if (band === 3) return 1;
  if (band === 2) return 2;
  return 3;
}

function computePoolConfidence(parseConfidence: number, scoreFlags: string[]) {
  let confidence = Math.max(0, Math.min(1, Number.isFinite(parseConfidence) ? parseConfidence : 0.5));
  if (scoreFlags.includes("ai_normal")) confidence = Math.min(1, confidence + 0.2);
  if (scoreFlags.includes("ai_review_unavailable")) confidence = Math.max(0, confidence - 0.1);
  if (scoreFlags.some((flag) => flag.endsWith("_low_confidence"))) confidence = Math.max(0, confidence - 0.15);
  return Math.round(confidence * 100) / 100;
}

function hasPoolBlockFlag(scoreFlags: string[]) {
  return scoreFlags.some((flag) => (
    POOL_BLOCK_FLAGS.includes(flag) ||
    flag.endsWith("_low_confidence") ||
    (flag === "deep_discount_review" && !scoreFlags.includes("ai_normal"))
  ));
}

export async function scoreStage(deadlineMs: number): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const rows = await loadScorableRows(config.tickScoreLimit);
  if (rows.length === 0) return stats;
  const parsedByPid = await loadParsedRows(rows.map((row) => row.pid));

  const pricesByMarket = new Map<string, number[]>();
  const favsByMarket = new Map<string, number[]>();
  const pricesBySku = new Map<string, number[]>();
  for (const row of rows) {
    const skuId = row.sku_id ?? "";
    const marketKey = marketGroupKey(row, parsedByPid.get(row.pid));
    if (!pricesByMarket.has(marketKey)) pricesByMarket.set(marketKey, []);
    if (!favsByMarket.has(marketKey)) favsByMarket.set(marketKey, []);
    if (!pricesBySku.has(skuId)) pricesBySku.set(skuId, []);
    pricesBySku.get(skuId)!.push(row.price);
    pricesByMarket.get(marketKey)!.push(row.price);
    favsByMarket.get(marketKey)!.push(row.num_faved);
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
    const parsed = parsedByPid.get(row.pid);
    const marketKey = marketGroupKey(row, parsed);
    const prices = pricesByMarket.get(marketKey) ?? [];
    const coarsePrices = pricesBySku.get(skuId) ?? [];
    const hasPreciseMarket = prices.length >= 5;
    const skuMedian = hasPreciseMarket
      ? median(prices)
      : (coarsePrices.length >= 5 ? median(coarsePrices) : (skuMsrp.get(skuId) ?? 300000) * 0.5);
    const priceGap = skuMedian <= 0 ? 0 : Math.max(0, Math.min(1, (skuMedian - row.price) / skuMedian));
    const velocity = percentileRank(favsByMarket.get(marketKey) ?? [], row.num_faved);
    const safetyBase = row.shop_review_rating == null ? 0.5 : Math.max(0, Math.min(1, Number(row.shop_review_rating) / 5));
    const safety = Math.max(0, Math.min(1, safetyBase + (row.shop_review_count >= 100 ? 0.05 : 0)));
    const riskHits = ["직거래만", "현금만", "박스없음", "박스 없음", "수리이력", "충전안됨", "충전 안됨", "고장", "불량", "먹통"]
      .filter((kw) => row.description_preview.toLowerCase().includes(kw.toLowerCase())).length;
    const parseConfidence = Number(parsed?.parse_confidence ?? 0);
    const precisionPenalty = (parseConfidence > 0 && parseConfidence < 0.65 ? 0.75 : 1) * (hasPreciseMarket ? 1 : 0.85);
    const score = (priceGap * 0.5 + velocity * 0.4 + safety * 0.1) * 100 * precisionPenalty;
    const apiParsed = parseShippingFromTrade(row.trade_data, row.trades_data);
    const descParsed = parseShippingFromDescription(row.description_preview);
    const shipping = resolveShipping(row.price, skuMedian, row.free_shipping, apiParsed, descParsed);
    const scoreFlags: string[] = [];
    if (priceGap >= 0.55) scoreFlags.push("deep_discount_review");
    if (riskHits > 0) scoreFlags.push("risk_keyword_review");
    if (row.description_preview.trim().length < 20) scoreFlags.push("weak_description");
    if (!hasPreciseMarket) scoreFlags.push("coarse_market_price");
    if (parseConfidence > 0 && parseConfidence < 0.65) scoreFlags.push("option_parse_review");
    if (parsed?.needs_review) scoreFlags.push("option_needs_review");

    scoredRows.push({
      pid: String(row.pid),
      url: row.url,
      name: row.name,
      price: row.price,
      skuId,
      skuName: row.sku_name ?? skuId,
      skuMedian: Math.round(skuMedian),
      descriptionPreview: row.description_preview.slice(0, 200),
      imageUrlTemplate: row.image_url_template,
      imageCount: row.image_count,
      thumbnailUrl: row.thumbnail_url,
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
    image_url_template: row.imageUrlTemplate,
    image_count: row.imageCount ?? 0,
    thumbnail_url: row.thumbnailUrl,
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

  const poolEntries: Record<string, unknown>[] = [];
  let poolSkipped = 0;
  for (const row of aiReview.rows) {
    const sellFee = Math.round(row.skuMedian * SELLING_FEE_RATE);
    const buyMax = row.price + (row.shippingFeeGeneral ?? row.shippingFee);
    const buyMin = row.estimatedBuyCost;
    const profitMax = Math.max(0, row.skuMedian - buyMin - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
    const profitMin = Math.max(0, row.skuMedian - buyMax - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
    const band = bandFromProfit(profitMin, profitMax);
    if (band === null) {
      poolSkipped += 1;
      continue;
    }
    const pid = Number(row.pid);
    const parsed = parsedByPid.get(pid);
    const confidence = computePoolConfidence(Number(parsed?.parse_confidence ?? 0.5), row.scoreFlags);
    const comparableKey = parsed?.comparable_key ?? null;
    if (
      profitMin <= 0 ||
      row.price >= row.skuMedian ||
      row.riskHits > 0 ||
      !row.thumbnailUrl ||
      !comparableKey ||
      parsed?.needs_review ||
      confidence < POOL_CONFIDENCE_FLOOR ||
      hasPoolBlockFlag(row.scoreFlags)
    ) {
      poolSkipped += 1;
      continue;
    }
    poolEntries.push({
      pid,
      profit_band: band,
      expected_profit_min: profitMin,
      expected_profit_max: profitMax,
      score: row.score,
      confidence,
      comparable_key: comparableKey,
      max_exposure: poolMaxExposure(band),
      last_verified_at: now,
      updated_at: now,
    });
  }
  await upsertRows("mvp_candidate_pool", poolEntries, "pid");
  stats.poolUpserted = poolEntries.length;
  stats.poolSkipped = poolSkipped;
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
