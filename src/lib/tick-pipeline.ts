import { searchPage, fetchDetail, type SearchItem } from "@/lib/bunjang";
import { CATALOG, ruleMatch, type Sku } from "@/lib/catalog";
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
import { canPermanentlyInvalidateSoldOut, describeSignals, detectSoldOut, isSoldOut, type SourceHealthStatus } from "@/lib/sold-out";

type Headers = Record<string, string>;

type RawListingRow = {
  pid: number;
  name: string;
  price: number;
  num_faved: number;
  free_shipping: boolean;
  url: string;
  seller_uid: string | null;
  thumbnail_url: string | null;
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

type LifecycleStatus = "active" | "missing_suspect" | "sold_confirmed" | "disappeared" | "archived";
type LifecyclePriorityTier = "pool" | "near_pool" | "market_sample" | "general" | "exploration";

type LifecycleClaimRow = {
  pid: number;
  lifecycle_status: LifecycleStatus;
  priority_tier: LifecyclePriorityTier;
  consecutive_missing_count: number;
  consecutive_error_count: number;
  attempts: number;
  price: number;
  name: string;
  num_faved: number;
  listing_state: string;
  sku_id: string | null;
  sku_name: string | null;
  seller_uid: string | null;
  comparable_key: string | null;
  parser_version: string | null;
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
  seller_uid: string | null;
};

type ParsedListingRow = {
  pid: number;
  parser_version: string | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  condition_score: number | null;
  needs_review: boolean | null;
};

type MarketKeyInvalidationEvent = {
  comparableKey: string | null | undefined;
  reason: string;
  priority?: number;
  affectedPid?: number;
  oldComparableKey?: string | null;
  newComparableKey?: string | null;
  parserVersion?: string | null;
};

type SellerUpsertRow = {
  source: string;
  seller_uid: string;
  seller_name?: string | null;
  review_rating?: number | null;
  review_count?: number;
  sales_count?: number;
  follower_count?: number;
  is_proshop?: boolean;
  is_official_seller?: boolean;
  joined_at?: string | null;
  source_json?: Record<string, unknown>;
  last_seen_at: string;
  updated_at: string;
};

type MarketPriceRow = {
  date: string;
  comparable_key: string;
  active_median_price: number | null;
  sold_median_price: number | null;
  blended_median_price: number | null;
  active_sample_count: number;
  sold_sample_count: number;
  disappeared_sample_count: number;
  confidence: "high" | "medium" | "low";
  computed_at: string;
};

type CollectRunHealthRow = {
  status: string;
  collected_count: number | null;
  enriched_count: number | null;
  stage_stats: Record<string, unknown> | null;
  request_meta: Record<string, unknown> | null;
  started_at: string;
};

type SourceHealthRow = {
  status: "healthy" | "degraded" | "unhealthy";
  checked_at: string;
  baseline_json: Record<string, unknown> | null;
  hysteresis_json: Record<string, unknown> | null;
  reason: string | null;
};

type MarketKeyInvalidationRow = {
  comparable_key: string;
  reason: string;
  priority: number;
  event_count: number;
};

type PoolWarmRow = {
  pid: number;
  profit_band: 1 | 2 | 3;
  expected_profit_min: number;
  expected_profit_max: number;
  status: string;
  last_verified_at: string;
};

const DETAIL_STAGE_SAFETY_MARGIN_MS = 8_000;
const POOL_CONFIDENCE_FLOOR = 0.7;
const POOL_BLOCK_FLAGS = [
  "coarse_market_price",
  "market_confidence_low",
  "market_stat_missing",
  "option_parse_review",
  "option_needs_review",
  "ai_review_unavailable",
  "weak_description",
  "risk_keyword_review",
];
const REST_READ_CHUNK_SIZE = 250;
const REST_WRITE_CHUNK_SIZE = 200;
const REST_KEY_READ_CHUNK_SIZE = 50;

const catalogById = new Map(CATALOG.map((sku) => [sku.id, sku]));

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
};

export type TickResult = StageStats & {
  stages: Record<string, StageStats>;
  stageDurationsMs: Record<string, number>;
};

function emptyStats(): StageStats {
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

function mergeStats(parts: StageStats[]): StageStats {
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function restFetch(path: string, init: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (err) {
    const method = init.method ?? "GET";
    throw new Error(`Supabase REST fetch failed ${method} ${path.slice(0, 240)}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase REST failed ${res.status}: ${body}`);
  }
  return res;
}

async function upsertRows(table: string, rows: unknown[], onConflict?: string): Promise<void> {
  if (rows.length === 0) return;
  const url = onConflict ? `${tableUrl(table)}?on_conflict=${encodeURIComponent(onConflict)}` : tableUrl(table);
  for (const chunk of chunkArray(rows, REST_WRITE_CHUNK_SIZE)) {
    await restFetch(url, {
      method: "POST",
      headers: serviceHeaders("resolution=merge-duplicates"),
      body: JSON.stringify(chunk),
    });
  }
}

async function insertIgnoreRows(table: string, rows: unknown[], onConflict?: string): Promise<void> {
  if (rows.length === 0) return;
  const url = onConflict ? `${tableUrl(table)}?on_conflict=${encodeURIComponent(onConflict)}` : tableUrl(table);
  for (const chunk of chunkArray(rows, REST_WRITE_CHUNK_SIZE)) {
    await restFetch(url, {
      method: "POST",
      headers: serviceHeaders("resolution=ignore-duplicates"),
      body: JSON.stringify(chunk),
    });
  }
}

async function insertRows(table: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  for (const chunk of chunkArray(rows, REST_WRITE_CHUNK_SIZE)) {
    await restFetch(tableUrl(table), {
      method: "POST",
      headers: serviceHeaders("return=minimal"),
      body: JSON.stringify(chunk),
    });
  }
}

async function patchRows(table: string, filter: string, payload: Record<string, unknown>): Promise<void> {
  await restFetch(`${tableUrl(table)}?${filter}`, {
    method: "PATCH",
    headers: serviceHeaders(),
    body: JSON.stringify(payload),
  });
}

async function softInsertRows(table: string, rows: unknown[]): Promise<boolean> {
  if (rows.length === 0) return true;
  try {
    await insertRows(table, rows);
    return true;
  } catch (err) {
    console.error(`soft insert failed for ${table}`, err);
    return false;
  }
}

async function upsertSellerRows(rows: SellerUpsertRow[]): Promise<number> {
  const bySeller = new Map<string, SellerUpsertRow>();
  for (const row of rows) {
    const uid = row.seller_uid.trim();
    if (!uid) continue;
    const existing = bySeller.get(uid);
    bySeller.set(uid, {
      ...existing,
      ...row,
      seller_uid: uid,
      seller_name: row.seller_name ?? existing?.seller_name,
      review_rating: row.review_rating ?? existing?.review_rating,
      review_count: row.review_count ?? existing?.review_count,
      sales_count: row.sales_count ?? existing?.sales_count,
      follower_count: row.follower_count ?? existing?.follower_count,
      is_proshop: row.is_proshop ?? existing?.is_proshop,
      is_official_seller: row.is_official_seller ?? existing?.is_official_seller,
      joined_at: row.joined_at ?? existing?.joined_at,
      source_json: { ...(existing?.source_json ?? {}), ...(row.source_json ?? {}) },
      last_seen_at: row.last_seen_at > (existing?.last_seen_at ?? "") ? row.last_seen_at : existing?.last_seen_at ?? row.last_seen_at,
      updated_at: row.updated_at > (existing?.updated_at ?? "") ? row.updated_at : existing?.updated_at ?? row.updated_at,
    });
  }
  const sellers = [...bySeller.values()];
  await upsertRows("mvp_sellers", sellers, "source,seller_uid");
  return sellers.length;
}

async function enqueueMarketKeyInvalidations(events: MarketKeyInvalidationEvent[]): Promise<number> {
  const merged = new Map<string, MarketKeyInvalidationEvent>();
  for (const event of events) {
    const key = event.comparableKey?.trim();
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing || (event.priority ?? 0) > (existing.priority ?? 0)) {
      merged.set(key, { ...event, comparableKey: key });
    }
  }
  let queued = 0;
  for (const event of merged.values()) {
    try {
      await restFetch(rpcUrl("enqueue_mvp_market_key_invalidation"), {
        method: "POST",
        headers: serviceHeaders(),
        body: JSON.stringify({
          p_comparable_key: event.comparableKey,
          p_reason: event.reason.slice(0, 120),
          p_priority: Math.max(0, Math.round(event.priority ?? 0)),
          p_affected_pid: event.affectedPid ?? null,
          p_old_comparable_key: event.oldComparableKey ?? null,
          p_new_comparable_key: event.newComparableKey ?? null,
          p_parser_version: event.parserVersion ?? null,
        }),
      });
      queued += 1;
    } catch (err) {
      console.error("market key invalidation enqueue failed", err);
    }
  }
  return queued;
}

function lifecycleDelayMs(tier: LifecyclePriorityTier, status: LifecycleStatus = "active") {
  if (status === "sold_confirmed" || status === "disappeared" || status === "archived") return 7 * 24 * 60 * 60 * 1000;
  if (status === "missing_suspect") return 2 * 60 * 60 * 1000;
  if (tier === "pool") return 60 * 60 * 1000;
  if (tier === "near_pool") return 4 * 60 * 60 * 1000;
  if (tier === "exploration") return 12 * 60 * 60 * 1000;
  if (tier === "market_sample") return 24 * 60 * 60 * 1000;
  return 48 * 60 * 60 * 1000;
}

function lifecycleNextCheckAt(tier: LifecyclePriorityTier, status: LifecycleStatus = "active") {
  return new Date(Date.now() + lifecycleDelayMs(tier, status)).toISOString();
}

function lifecycleTierForParsed(parsed: { parseConfidence?: number; needsReview?: boolean; comparableKey?: string | null }) {
  if (!parsed.comparableKey) return "general" as const;
  if (Number(parsed.parseConfidence ?? 0) >= 0.65 && !parsed.needsReview) return "market_sample" as const;
  return "exploration" as const;
}

async function seedLifecycleChecks(rows: {
  pid: number;
  priorityTier: LifecyclePriorityTier;
  nextCheckAt?: string;
}[]) {
  if (rows.length === 0) return 0;
  const now = new Date().toISOString();
  const deduped = new Map<number, { pid: number; priorityTier: LifecyclePriorityTier; nextCheckAt?: string }>();
  const priorityScore: Record<LifecyclePriorityTier, number> = {
    pool: 5,
    near_pool: 4,
    exploration: 3,
    market_sample: 2,
    general: 1,
  };
  for (const row of rows) {
    const existing = deduped.get(row.pid);
    if (!existing || priorityScore[row.priorityTier] > priorityScore[existing.priorityTier]) {
      deduped.set(row.pid, row);
    }
  }
  await insertIgnoreRows("mvp_lifecycle_checks", [...deduped.values()].map((row) => ({
    pid: row.pid,
    source: "bunjang",
    status: "active",
    priority_tier: row.priorityTier,
    next_check_at: row.nextCheckAt ?? lifecycleNextCheckAt(row.priorityTier),
    state_reason: "seeded_from_pipeline",
    updated_at: now,
  })), "pid");
  return deduped.size;
}

async function promoteLifecyclePriority(pids: number[], tier: LifecyclePriorityTier, nextCheckAt?: string) {
  const unique = [...new Set(pids.filter(Number.isFinite))];
  if (unique.length === 0) return 0;
  const now = new Date().toISOString();
  for (const chunk of chunkArray(unique, REST_WRITE_CHUNK_SIZE)) {
    await patchRows("mvp_lifecycle_checks", `pid=in.(${chunk.join(",")})&status=in.(active,missing_suspect)`, {
      priority_tier: tier,
      next_check_at: nextCheckAt ?? lifecycleNextCheckAt(tier),
      locked_at: null,
      locked_until: null,
      updated_at: now,
    });
  }
  return unique.length;
}

function pidList(items: SearchItem[]) {
  return items.map((item) => Number(item.pid)).filter(Number.isFinite);
}

async function loadExistingRaw(pids: number[]): Promise<Map<number, RawListingRow>> {
  if (pids.length === 0) return new Map();
  const unique = [...new Set(pids)];
  const rows: RawListingRow[] = [];
  for (const chunk of chunkArray(unique, REST_READ_CHUNK_SIZE)) {
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,price,num_faved,free_shipping,url,seller_uid,thumbnail_url,detail_enriched_at,last_seen_at,last_changed_at,listing_state&pid=in.(${chunk.join(",")})`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    rows.push(...((await res.json()) as RawListingRow[]));
  }
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

type DetailQueueDecision = {
  queue: boolean;
  reason: string;
  priority: number;
  listingType: string;
  skuId: string | null;
  skuName: string | null;
  purpose: "candidate" | "market_sample" | "skip";
};

function needsDetailRefresh(item: SearchItem, existing: RawListingRow | undefined) {
  if (!existing) return true;
  if (!existing.detail_enriched_at) return true;
  return existing.name !== item.name;
}

function roughUsedSeed(sku: Sku) {
  // 상세 전 단계의 거친 우선순위용 시드. 실제 후보 판단은 detail/option parse 이후에만 한다.
  return Math.round(sku.msrpKrw * 0.55);
}

function detailQueueDecision(item: SearchItem, existing: RawListingRow | undefined): DetailQueueDecision {
  if (!needsDetailRefresh(item, existing)) {
    return {
      queue: false,
      reason: "search_only_update",
      priority: 0,
      listingType: "unchanged_detail",
      skuId: null,
      skuName: null,
      purpose: "skip",
    };
  }

  const titleOnly = classifyListing(item.name, "", item.price);
  const sku = titleOnly.sku ?? ruleMatch(item.name, "");
  const hardNoiseTypes = new Set(["buying", "callout", "parts", "damaged", "accessory", "multi", "commercial"]);

  if (hardNoiseTypes.has(titleOnly.listingType)) {
    return {
      queue: false,
      reason: `title_noise_${titleOnly.listingType}`,
      priority: 0,
      listingType: titleOnly.listingType,
      skuId: null,
      skuName: null,
      purpose: "skip",
    };
  }

  if (!sku) {
    return {
      queue: false,
      reason: "title_unknown_sku",
      priority: 0,
      listingType: titleOnly.listingType,
      skuId: null,
      skuName: null,
      purpose: "skip",
    };
  }

  const roughGap = roughUsedSeed(sku) - item.price;
  const likelyCandidate = roughGap >= 20_000 || item.numFaved >= 10;
  const priority =
    (likelyCandidate ? 1000 : 100) +
    Math.min(500, Math.max(0, Math.round(roughGap / 1000))) +
    Math.min(300, Math.max(0, item.numFaved * 5));

  return {
    queue: true,
    reason: likelyCandidate ? "candidate_title_pass" : "market_sample_title_pass",
    priority,
    listingType: titleOnly.listingType === "normal" ? "normal" : "title_sku_match",
    skuId: sku.id,
    skuName: sku.modelName,
    purpose: likelyCandidate ? "candidate" : "market_sample",
  };
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

function searchOptionsForMode(mode: SearchStageOptions["mode"]) {
  if (mode === "fresh" || mode === "deep") {
    return { order: "date" as const, limit: 96 };
  }
  return { order: "score" as const, limit: 30 };
}

function rotatedDeepPage(deepCrawlMaxPage: number, nowMs = Date.now()) {
  const maxDeep = Math.max(1, deepCrawlMaxPage);
  const tickBucket = Math.floor(nowMs / (30 * 60 * 1000));
  return 1 + (tickBucket % maxDeep);
}

function searchPagesForTick(pagesPerQuery: number, deepCrawlMaxPage: number, nowMs = Date.now()) {
  if (pagesPerQuery <= 1) return [0];
  const maxDeep = Math.max(1, deepCrawlMaxPage);
  const tickBucket = Math.floor(nowMs / (5 * 60 * 1000));
  const deepStart = 1 + (tickBucket % maxDeep);
  const pages = new Set<number>([0]);
  for (let i = 0; pages.size < pagesPerQuery; i += 1) {
    pages.add(1 + ((deepStart - 1 + i) % maxDeep));
  }
  return [...pages];
}

type SearchStageOptions = {
  pages?: number[];
  mode?: "fresh" | "deep" | "mixed";
};

export async function searchStage(deadlineMs: number, options: SearchStageOptions = {}): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const seen = new Map<string, SearchItem>();
  const pages = options.pages ?? searchPagesForTick(config.pagesPerQuery, config.deepCrawlMaxPage);
  const mode = options.mode ?? "mixed";

  for (const query of config.searchQueries) {
    for (const page of pages) {
      if (Date.now() >= deadlineMs) {
        stats.timedOut = true;
        return stats;
      }
      let items: SearchItem[] = [];
      try {
        items = await searchPage(query, page, searchOptionsForMode(mode));
        stats.searchSucceeded += 1;
      } catch (err) {
        stats.searchFailed += 1;
        console.error("search page failed", {
          query,
          page,
          mode,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
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
  const detailDecisions = new Map(
    items.map((item) => [item.pid, detailQueueDecision(item, existing.get(Number(item.pid)))])
  );
  const observationRows = items.flatMap((item) => {
    const current = existing.get(Number(item.pid));
    const detailDecision = detailDecisions.get(item.pid);
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
      seller_uid: item.sellerUid,
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
        searchMeta: {
          order: searchOptionsForMode(mode).order,
          limit: searchOptionsForMode(mode).limit,
          sellerUid: item.sellerUid,
          sellerProshop: item.sellerProshop,
          sellerBizseller: item.sellerBizseller,
          location: item.location,
          updateTime: item.updateTime,
          productImage: item.productImage,
        },
        searchMode: mode,
        detailTriage: detailDecision ? {
          queue: detailDecision.queue,
          reason: detailDecision.reason,
          purpose: detailDecision.purpose,
          listingType: detailDecision.listingType,
          skuId: detailDecision.skuId,
          priority: detailDecision.priority,
        } : null,
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
      seller_uid: item.sellerUid,
      seller_source: "bunjang",
      thumbnail_url: current?.thumbnail_url ?? item.productImage,
      raw_json: {
        search: item.raw,
        searchMeta: {
          order: searchOptionsForMode(mode).order,
          limit: searchOptionsForMode(mode).limit,
          sellerUid: item.sellerUid,
          sellerProshop: item.sellerProshop,
          sellerBizseller: item.sellerBizseller,
          location: item.location,
          updateTime: item.updateTime,
          productImage: item.productImage,
        },
      },
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
  stats.sellerUpserted += await upsertSellerRows(items.flatMap((item) => {
    if (!item.sellerUid) return [];
    return [{
      source: "bunjang",
      seller_uid: item.sellerUid,
      is_proshop: item.sellerProshop,
      source_json: {
        search: {
          proshop: item.sellerProshop,
          bizseller: item.sellerBizseller,
          query: item.query,
          pid: item.pid,
        },
      },
      last_seen_at: now,
      updated_at: now,
    }];
  }));

  const changedItems = items.filter((item) => changedEnough(item, existing.get(Number(item.pid))));
  const changedParsedByPid = await loadParsedRows(changedItems.map((item) => Number(item.pid)).filter(Number.isFinite));
  const marketInvalidations = changedItems.flatMap((item) => {
    const current = existing.get(Number(item.pid));
    const parsed = changedParsedByPid.get(Number(item.pid));
    if (!current || !parsed?.comparable_key) return [];
    if (current.price !== item.price) {
      return [{
        comparableKey: parsed.comparable_key,
        reason: "search_price_changed",
        priority: 90,
        affectedPid: Number(item.pid),
        oldComparableKey: parsed.comparable_key,
        parserVersion: parsed.parser_version,
      }];
    }
    if (current.name !== item.name) {
      return [{
        comparableKey: parsed.comparable_key,
        reason: "search_title_changed",
        priority: 70,
        affectedPid: Number(item.pid),
        oldComparableKey: parsed.comparable_key,
        parserVersion: parsed.parser_version,
      }];
    }
    return [];
  });
  stats.upserted += await enqueueMarketKeyInvalidations(marketInvalidations);

  const queueItems = changedItems.filter((item) => detailDecisions.get(item.pid)?.queue);
  await insertIgnoreRows("mvp_detail_queue", queueItems.map((item) => ({
    pid: Number(item.pid),
    status: "pending",
    priority: detailDecisions.get(item.pid)?.priority ?? item.numFaved,
    available_at: now,
    locked_at: null,
    locked_until: null,
    last_error: null,
    updated_at: now,
  })), "pid");
  stats.queued = queueItems.length;
  stats.detailQueueSkipped = changedItems.length - queueItems.length;

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
  let batchesProcessed = 0;

  while (Date.now() < deadlineMs - DETAIL_STAGE_SAFETY_MARGIN_MS) {
    if (batchesProcessed >= 1) break;
    const claims = await claimDetailQueue();
    if (claims.length === 0) break;
    batchesProcessed += 1;
    stats.claimed += claims.length;
    const existingParsedByPid = await loadParsedRows(claims.map((claim) => Number(claim.pid)));
    const marketInvalidations: MarketKeyInvalidationEvent[] = [];

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
        const existingParsed = existingParsedByPid.get(Number(claim.pid));
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
          seller_uid: detail.shopUid,
          seller_name: detail.shopName,
          seller_source: "bunjang",
          listing_type: listingType,
          sku_id: sku?.id ?? null,
          sku_name: sku?.modelName ?? null,
          detail_status: "done",
          detail_enriched_at: now,
          detail_error: null,
          updated_at: now,
        });
        try {
          if (detail.shopUid) {
            stats.sellerUpserted += await upsertSellerRows([{
              source: "bunjang",
              seller_uid: detail.shopUid,
              seller_name: detail.shopName,
              review_rating: detail.shopReviewRating,
              review_count: detail.shopReviewCount,
              sales_count: detail.shopSalesCount,
              follower_count: detail.shopFollowerCount,
              is_proshop: detail.shopProshop,
              is_official_seller: detail.shopOfficialSeller,
              joined_at: detail.shopJoinDate,
              source_json: {
                detail: detail.shopData,
                pid: claim.pid,
              },
              last_seen_at: now,
              updated_at: now,
            }]);
          }
          await upsertRows("mvp_listing_parsed", [toParsedListingRow(claim.pid, parsed)], "pid");
          if (existingParsed?.comparable_key && existingParsed.comparable_key !== parsed.comparableKey) {
            marketInvalidations.push({
              comparableKey: existingParsed.comparable_key,
              reason: "parser_key_changed_old",
              priority: 100,
              affectedPid: Number(claim.pid),
              oldComparableKey: existingParsed.comparable_key,
              newComparableKey: parsed.comparableKey,
              parserVersion: parsed.parserVersion,
            });
          }
          if (parsed.comparableKey) {
            marketInvalidations.push({
              comparableKey: parsed.comparableKey,
              reason: existingParsed?.comparable_key && existingParsed.comparable_key !== parsed.comparableKey
                ? "parser_key_changed_new"
                : "detail_enriched",
              priority: existingParsed?.comparable_key === parsed.comparableKey ? 75 : 95,
              affectedPid: Number(claim.pid),
              oldComparableKey: existingParsed?.comparable_key ?? null,
              newComparableKey: parsed.comparableKey,
              parserVersion: parsed.parserVersion,
            });
          }
          await insertRows("mvp_listing_observations", [{
            pid: Number(claim.pid),
            observed_at: now,
            event_type: "detail_enriched",
            price: claim.price,
            name: claim.name,
            num_faved: claim.num_faved,
            sale_status: detail.saleStatus,
            listing_state: "active",
            seller_uid: detail.shopUid,
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
          await seedLifecycleChecks([{
            pid: Number(claim.pid),
            priorityTier: lifecycleTierForParsed(parsed),
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
    stats.upserted += await enqueueMarketKeyInvalidations(marketInvalidations);
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

function quantile(values: number[], q: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next == null ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function sellerRepresentativePrices(rows: ScorableRawRow[]) {
  const bySeller = new Map<string, number[]>();
  for (const row of rows) {
    const sellerKey = row.seller_uid?.trim() ? `seller:${row.seller_uid.trim()}` : `pid:${row.pid}`;
    const prices = bySeller.get(sellerKey) ?? [];
    prices.push(row.price);
    bySeller.set(sellerKey, prices);
  }
  return [...bySeller.values()].map((prices) => Math.round(median(prices)));
}

function trimmedSellerMarket(rows: ScorableRawRow[]) {
  const representativePrices = sellerRepresentativePrices(rows);
  const trimmed = madTrim(representativePrices);
  const values = trimmed.values;
  return {
    values,
    count: values.length,
    median: values.length > 0 ? Math.round(median(values)) : null,
    p25: values.length > 0 ? Math.round(quantile(values, 0.25)) : null,
    p75: values.length > 0 ? Math.round(quantile(values, 0.75)) : null,
  };
}

function madTrim(values: number[]) {
  if (values.length < 8) {
    return { values, medianValue: median(values), mad: 0, removed: 0 };
  }
  const medianValue = median(values);
  const deviations = values.map((value) => Math.abs(value - medianValue));
  const mad = median(deviations);
  if (mad <= 0) {
    return { values, medianValue, mad, removed: 0 };
  }
  const threshold = 3 * 1.4826 * mad;
  const trimmed = values.filter((value) => Math.abs(value - medianValue) <= threshold);
  if (trimmed.length < Math.max(5, Math.ceil(values.length * 0.5))) {
    return { values, medianValue, mad, removed: 0 };
  }
  return { values: trimmed, medianValue, mad, removed: values.length - trimmed.length };
}

function percentileRank(values: number[], value: number) {
  if (values.length <= 1) return 0.5;
  const belowOrEqual = values.filter((v) => v <= value).length;
  return Math.max(0, Math.min(1, (belowOrEqual - 1) / (values.length - 1)));
}

async function loadScorableRows(limit: number): Promise<ScorableRawRow[]> {
  const columns = "pid,name,price,num_faved,free_shipping,url,description_preview,shop_review_rating,shop_review_count,trade_data,trades_data,image_url_template,image_count,thumbnail_url,listing_type,sku_id,sku_name,seller_uid,detail_enriched_at,listing_state";
  const url = `${tableUrl("mvp_raw_listings")}?select=${columns}&detail_status=eq.done&listing_type=eq.normal&sku_id=not.is.null&listing_state=eq.active&order=last_seen_at.desc&limit=${limit}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as ScorableRawRow[];
}

async function loadMarketStatRows(limit: number): Promise<ScorableRawRow[]> {
  const columns = "pid,name,price,num_faved,free_shipping,url,description_preview,shop_review_rating,shop_review_count,trade_data,trades_data,image_url_template,image_count,thumbnail_url,listing_type,sku_id,sku_name,seller_uid,detail_enriched_at,listing_state";
  const url = `${tableUrl("mvp_raw_listings")}?select=${columns}&detail_status=eq.done&listing_type=eq.normal&sku_id=not.is.null&listing_state=in.(active,sold_confirmed,disappeared)&order=detail_enriched_at.desc.nullslast,last_seen_at.desc&limit=${limit}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as ScorableRawRow[];
}

async function loadMarketStatRowsByPids(pids: number[], limit: number): Promise<ScorableRawRow[]> {
  const unique = [...new Set(pids.filter(Number.isFinite))].slice(0, limit);
  if (unique.length === 0) return [];
  const columns = "pid,name,price,num_faved,free_shipping,url,description_preview,shop_review_rating,shop_review_count,trade_data,trades_data,image_url_template,image_count,thumbnail_url,listing_type,sku_id,sku_name,seller_uid,detail_enriched_at,listing_state";
  const rows: ScorableRawRow[] = [];
  for (const chunk of chunkArray(unique, REST_READ_CHUNK_SIZE)) {
    const remaining = limit - rows.length;
    if (remaining <= 0) break;
    const url = `${tableUrl("mvp_raw_listings")}?select=${columns}&pid=in.(${chunk.join(",")})&detail_status=eq.done&listing_type=eq.normal&sku_id=not.is.null&listing_state=in.(active,sold_confirmed,disappeared)&limit=${Math.min(remaining, chunk.length)}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    rows.push(...((await res.json()) as ScorableRawRow[]));
  }
  return rows.slice(0, limit);
}

async function loadParsedRows(pids: number[]): Promise<Map<number, ParsedListingRow>> {
  if (pids.length === 0) return new Map();
  const unique = [...new Set(pids)];
  const columns = "pid,parser_version,comparable_key,parse_confidence,condition_score,needs_review";
  const rows: ParsedListingRow[] = [];
  for (const chunk of chunkArray(unique, REST_READ_CHUNK_SIZE)) {
    const url = `${tableUrl("mvp_listing_parsed")}?select=${columns}&pid=in.(${chunk.join(",")})`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    rows.push(...((await res.json()) as ParsedListingRow[]));
  }
  return new Map(rows.map((row) => [row.pid, row]));
}

async function loadParsedRowsByComparableKeys(comparableKeys: string[], limit: number): Promise<Map<number, ParsedListingRow>> {
  const unique = [...new Set(comparableKeys.filter(Boolean))].slice(0, limit);
  if (unique.length === 0) return new Map();
  const columns = "pid,parser_version,comparable_key,parse_confidence,condition_score,needs_review";
  const rows: ParsedListingRow[] = [];
  for (const chunk of chunkArray(unique, REST_KEY_READ_CHUNK_SIZE)) {
    const encoded = chunk.map((key) => encodeURIComponent(key)).join(",");
    const url = `${tableUrl("mvp_listing_parsed")}?select=${columns}&comparable_key=in.(${encoded})&parse_confidence=gte.0.65&needs_review=eq.false&limit=${Math.max(limit, chunk.length * 100)}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    rows.push(...((await res.json()) as ParsedListingRow[]));
  }
  return new Map(rows.map((row) => [row.pid, row]));
}

async function ensureParsedRows(rows: ScorableRawRow[], parsedByPid: Map<number, ParsedListingRow>) {
  const missingRows = rows.filter((row) => !parsedByPid.has(row.pid));
  if (missingRows.length === 0) return parsedByPid;

  const parsedRows = missingRows.map((row) => {
    const sku = catalogById.get(row.sku_id ?? "");
    const parsed = parseListingOptions({
      title: row.name,
      description: row.description_preview,
      skuId: row.sku_id,
      skuName: row.sku_name,
      category: sku?.category ?? null,
    });
    return toParsedListingRow(row.pid, parsed);
  });

  await upsertRows("mvp_listing_parsed", parsedRows, "pid");
  for (const row of parsedRows) {
    parsedByPid.set(Number(row.pid), {
      pid: Number(row.pid),
      parser_version: (row.parser_version as string | null) ?? null,
      comparable_key: (row.comparable_key as string | null) ?? null,
      parse_confidence: (row.parse_confidence as number | null) ?? null,
      condition_score: (row.condition_score as number | null) ?? null,
      needs_review: (row.needs_review as boolean | null) ?? null,
    });
  }
  return parsedByPid;
}

async function loadMarketPriceStats(comparableKeys: string[]): Promise<Map<string, MarketPriceRow>> {
  const unique = [...new Set(comparableKeys.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const columns = [
    "date",
    "comparable_key",
    "active_median_price",
    "sold_median_price",
    "blended_median_price",
    "active_sample_count",
    "sold_sample_count",
    "disappeared_sample_count",
    "confidence",
    "computed_at",
  ].join(",");
  const encoded = unique.map((key) => encodeURIComponent(key)).join(",");
  const url = `${tableUrl("mvp_market_price_daily")}?select=${columns}&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc&limit=${Math.max(1000, unique.length * 5)}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  const rows = (await res.json()) as MarketPriceRow[];
  const latest = new Map<string, MarketPriceRow>();
  for (const row of rows) {
    if (!latest.has(row.comparable_key)) latest.set(row.comparable_key, row);
  }
  return latest;
}

async function loadPendingMarketInvalidations(limit = 200): Promise<MarketKeyInvalidationRow[]> {
  try {
    const columns = "comparable_key,reason,priority,event_count";
    const url = `${tableUrl("mvp_market_key_invalidation")}?select=${columns}&status=eq.pending&order=priority.desc,last_event_at.asc&limit=${limit}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    return (await res.json()) as MarketKeyInvalidationRow[];
  } catch (err) {
    console.error("load pending market invalidations failed", err);
    return [];
  }
}

async function markMarketInvalidationsDone(comparableKeys: string[]): Promise<number> {
  const unique = [...new Set(comparableKeys.filter(Boolean))];
  if (unique.length === 0) return 0;
  try {
    const encoded = unique.map((key) => encodeURIComponent(key)).join(",");
    await patchRows("mvp_market_key_invalidation", `comparable_key=in.(${encoded})`, {
      status: "done",
      last_recomputed_at: new Date().toISOString(),
      locked_until: null,
      last_error: null,
    });
    return unique.length;
  } catch (err) {
    console.error("mark market invalidations done failed", err);
    return 0;
  }
}

function marketGroupKey(row: ScorableRawRow, parsed: ParsedListingRow | undefined) {
  if (parsed?.comparable_key && Number(parsed.parse_confidence ?? 0) >= 0.65) {
    return parsed.comparable_key;
  }
  return row.sku_id ?? "";
}

function preciseComparableKey(parsed: ParsedListingRow | undefined) {
  if (!parsed?.comparable_key) return null;
  if (Number(parsed.parse_confidence ?? 0) < 0.65) return null;
  if (parsed.needs_review) return null;
  return parsed.comparable_key;
}

function trustedMarketMedian(stat: MarketPriceRow | undefined) {
  if (!stat) return null;
  if (stat.confidence !== "high" && stat.confidence !== "medium") return null;
  const value = Number(stat.blended_median_price ?? stat.active_median_price ?? 0);
  return value > 0 ? value : null;
}

function kstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
}

function marketKeyMeta(comparableKey: string, skuId: string | null) {
  const parts = comparableKey.split("|").filter(Boolean);
  const sku = skuId ? CATALOG.find((item) => item.id === skuId) : null;
  return {
    category: sku?.category ?? null,
    family: parts[0] ?? null,
    model: parts[1] ?? null,
    variant_key: parts.slice(2).join("|") || null,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> {
  return asRecord(asRecord(value)[key]);
}

function numberField(value: unknown, key: string) {
  const raw = asRecord(value)[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

async function loadRecentCollectRuns(windowMinutes: number): Promise<CollectRunHealthRow[]> {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const columns = "status,collected_count,enriched_count,stage_stats,request_meta,started_at";
  const url = `${tableUrl("mvp_collect_runs")}?select=${columns}&started_at=gte.${encodeURIComponent(cutoff)}&order=started_at.desc&limit=200`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as CollectRunHealthRow[];
}

async function loadLatestSourceHealth(): Promise<SourceHealthRow | null> {
  try {
    const url = `${tableUrl("mvp_source_health")}?select=status,checked_at,baseline_json,hysteresis_json,reason&source=eq.bunjang&order=checked_at.desc&limit=1`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    const rows = (await res.json()) as SourceHealthRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function runMode(row: CollectRunHealthRow) {
  const meta = asRecord(row.request_meta);
  return String(meta.pipelineMode ?? "");
}

function isSourceRelevantMode(mode: string) {
  return mode === "tick" || mode === "deep_crawl" || mode === "detail_worker" || mode === "pool_warmer";
}

function sourceWorkerFailureStatus(
  workerBreakdown: Map<string, { total: number; failed: number; collected: number; enriched: number }>,
) {
  const orderedModes = ["tick", "detail_worker", "deep_crawl", "pool_warmer"];
  for (const mode of orderedModes) {
    const bucket = workerBreakdown.get(mode);
    if (!bucket || bucket.failed === 0 || bucket.total === 0) continue;
    const rate = bucket.failed / bucket.total;
    if (bucket.total >= 3 && rate >= 0.5) {
      return { status: "unhealthy" as const, reason: `${mode}_failure_rate_high` };
    }
  }
  for (const mode of orderedModes) {
    const bucket = workerBreakdown.get(mode);
    if (!bucket || bucket.failed === 0 || bucket.total === 0) continue;
    const rate = bucket.failed / bucket.total;
    if (rate >= 0.2) {
      return { status: "degraded" as const, reason: `${mode}_failure_rate_elevated` };
    }
  }
  return null;
}

function proposeSourceStatus(input: {
  runCount: number;
  failedRunRate: number;
  detailAttempts: number;
  detailSuccessRate: number;
  searchRunCount: number;
  avgSearchCollected: number;
  searchAttemptCount: number;
  searchFailureRate: number;
  dominantSearchFailureMode: string | null;
  workerBreakdown: Map<string, { total: number; failed: number; collected: number; enriched: number }>;
}) {
  if (input.runCount === 0) {
    return { status: "degraded" as const, reason: "no_recent_source_runs" };
  }
  const workerFailure = sourceWorkerFailureStatus(input.workerBreakdown);
  if (workerFailure) {
    return workerFailure;
  }
  if (input.failedRunRate >= 0.5) {
    return { status: "unhealthy" as const, reason: "source_worker_failure_rate_high" };
  }
  if (input.detailAttempts >= 10 && input.detailSuccessRate < 0.5) {
    return { status: "unhealthy" as const, reason: "detail_success_rate_critical" };
  }
  if (input.searchAttemptCount >= 10 && input.searchFailureRate >= 0.5) {
    return { status: "unhealthy" as const, reason: `${input.dominantSearchFailureMode ?? "search"}_partial_failure_rate_high` };
  }
  if (input.searchRunCount > 0 && input.avgSearchCollected < 30) {
    return { status: "unhealthy" as const, reason: "search_result_count_critical" };
  }
  if (input.failedRunRate >= 0.2) {
    return { status: "degraded" as const, reason: "source_worker_failure_rate_elevated" };
  }
  if (input.detailAttempts >= 10 && input.detailSuccessRate < 0.85) {
    return { status: "degraded" as const, reason: "detail_success_rate_elevated" };
  }
  if (input.searchAttemptCount >= 10 && input.searchFailureRate >= 0.2) {
    return { status: "degraded" as const, reason: `${input.dominantSearchFailureMode ?? "search"}_partial_failure_rate_elevated` };
  }
  if (input.searchRunCount > 0 && input.avgSearchCollected < 100) {
    return { status: "degraded" as const, reason: "search_result_count_low" };
  }
  return { status: "healthy" as const, reason: "within_operating_bounds" };
}

const SOURCE_HEALTH_ENTER_DEGRADED_MS = 5 * 60 * 1000;
const SOURCE_HEALTH_ENTER_UNHEALTHY_MS = 5 * 60 * 1000;
const SOURCE_HEALTH_RECOVER_HEALTHY_MS = 15 * 60 * 1000;

type ProposedSourceStatus = ReturnType<typeof proposeSourceStatus>;

function isoOrNow(raw: unknown, nowMs: number) {
  if (typeof raw !== "string") return new Date(nowMs).toISOString();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? raw : new Date(nowMs).toISOString();
}

function applySourceHealthHysteresis(
  proposed: ProposedSourceStatus,
  previous: SourceHealthRow | null,
  nowMs = Date.now(),
) {
  const previousHysteresis = asRecord(previous?.hysteresis_json);
  const previousStatus = previous?.status ?? null;
  const previousProposedStatus = typeof previousHysteresis.proposedStatus === "string"
    ? previousHysteresis.proposedStatus
    : typeof asRecord(previous?.baseline_json).proposedStatus === "string"
      ? asRecord(previous?.baseline_json).proposedStatus
      : previousStatus;

  const proposedStatusSince = previousProposedStatus === proposed.status
    ? isoOrNow(previousHysteresis.proposedStatusSince, nowMs)
    : new Date(nowMs).toISOString();
  const proposedStatusAgeMs = Math.max(0, nowMs - Date.parse(proposedStatusSince));

  const healthySince = proposed.status === "healthy"
    ? (previousProposedStatus === "healthy" ? isoOrNow(previousHysteresis.healthySince, nowMs) : new Date(nowMs).toISOString())
    : null;
  const nonHealthySince = proposed.status !== "healthy"
    ? (previousProposedStatus !== "healthy" ? isoOrNow(previousHysteresis.nonHealthySince, nowMs) : new Date(nowMs).toISOString())
    : null;
  const unhealthySince = proposed.status === "unhealthy"
    ? (previousProposedStatus === "unhealthy" ? isoOrNow(previousHysteresis.unhealthySince, nowMs) : new Date(nowMs).toISOString())
    : null;

  let status: SourceHealthRow["status"] = previousStatus ?? proposed.status;
  let gateDecision = "hold_previous_status";

  if (!previousStatus) {
    status = proposed.status;
    gateDecision = "initial_snapshot";
  } else if (proposed.status === "healthy") {
    if (previousStatus === "healthy") {
      status = "healthy";
      gateDecision = "already_healthy";
    } else if (healthySince && nowMs - Date.parse(healthySince) >= SOURCE_HEALTH_RECOVER_HEALTHY_MS) {
      status = "healthy";
      gateDecision = "recovered_after_hysteresis";
    } else {
      status = previousStatus === "unhealthy" ? "degraded" : previousStatus;
      gateDecision = "waiting_for_recovery_hysteresis";
    }
  } else if (proposed.status === "degraded") {
    if (previousStatus === "unhealthy") {
      status = "degraded";
      gateDecision = "recover_one_level_from_unhealthy";
    } else if (previousStatus === "degraded") {
      status = "degraded";
      gateDecision = "already_degraded";
    } else if (nonHealthySince && nowMs - Date.parse(nonHealthySince) >= SOURCE_HEALTH_ENTER_DEGRADED_MS) {
      status = "degraded";
      gateDecision = "entered_degraded_after_hysteresis";
    } else {
      status = "healthy";
      gateDecision = "waiting_for_degraded_hysteresis";
    }
  } else {
    if (previousStatus === "unhealthy") {
      status = "unhealthy";
      gateDecision = "already_unhealthy";
    } else if (unhealthySince && nowMs - Date.parse(unhealthySince) >= SOURCE_HEALTH_ENTER_UNHEALTHY_MS) {
      status = "unhealthy";
      gateDecision = "entered_unhealthy_after_hysteresis";
    } else {
      status = "degraded";
      gateDecision = "degraded_while_waiting_for_unhealthy_hysteresis";
    }
  }

  return {
    status,
    changed: previousStatus !== status,
    gateDecision,
    proposedStatusSince,
    proposedStatusAgeMs,
    healthySince,
    nonHealthySince,
    unhealthySince,
    previousStatus,
    previousProposedStatus,
  };
}

export async function sourceHealthStage(): Promise<StageStats> {
  const stats = emptyStats();
  const windowMinutes = 30;
  const rows = await loadRecentCollectRuns(windowMinutes);
  const previous = await loadLatestSourceHealth();
  const sourceRows = rows.filter((row) => isSourceRelevantMode(runMode(row)));
  const failedRuns = sourceRows.filter((row) => row.status === "failed").length;
  const failedRunRate = sourceRows.length === 0 ? 0 : failedRuns / sourceRows.length;
  const workerBreakdown = new Map<string, { total: number; failed: number; collected: number; enriched: number }>();
  let detailAttempts = 0;
  let detailSucceeded = 0;
  let detailFailed = 0;
  let searchCollected = 0;
  let searchRunCount = 0;
  let searchSucceeded = 0;
  let searchFailed = 0;
  const searchFailedByMode = new Map<string, number>();

  for (const row of rows) {
    const stages = nestedRecord(row.stage_stats, "stages");
    const detail = nestedRecord(stages, "detail");
    const search = nestedRecord(stages, "search");
    const mode = runMode(row);
    const bucket = workerBreakdown.get(mode) ?? { total: 0, failed: 0, collected: 0, enriched: 0 };
    bucket.total += 1;
    if (row.status === "failed") bucket.failed += 1;
    bucket.collected += Number(row.collected_count ?? 0);
    bucket.enriched += Number(row.enriched_count ?? 0);
    workerBreakdown.set(mode, bucket);
    const claimed = numberField(detail, "claimed");
    const enriched = numberField(detail, "enriched");
    const failed = numberField(detail, "detailFailed");
    if (mode === "detail_worker" || mode === "pool_warmer" || claimed > 0) {
      detailAttempts += claimed;
      detailSucceeded += enriched;
      detailFailed += failed;
    }
    const collected = numberField(search, "collected") || Number(row.collected_count ?? 0);
    const searchSucceededForRun = numberField(search, "searchSucceeded");
    const searchFailedForRun = numberField(search, "searchFailed");
    if (mode === "tick" || mode === "deep_crawl" || collected > 0 || searchSucceededForRun > 0 || searchFailedForRun > 0) {
      searchRunCount += 1;
      searchCollected += collected;
      searchSucceeded += searchSucceededForRun;
      searchFailed += searchFailedForRun;
      if (searchFailedForRun > 0) {
        searchFailedByMode.set(mode, (searchFailedByMode.get(mode) ?? 0) + searchFailedForRun);
      }
    }
  }

  const detailSuccessRate = detailAttempts === 0 ? 1 : detailSucceeded / detailAttempts;
  const avgSearchCollected = searchRunCount === 0 ? 0 : searchCollected / searchRunCount;
  const searchAttemptCount = searchSucceeded + searchFailed;
  const searchFailureRate = searchAttemptCount === 0 ? 0 : searchFailed / searchAttemptCount;
  const dominantSearchFailureMode = [...searchFailedByMode.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const proposed = proposeSourceStatus({
    runCount: sourceRows.length,
    failedRunRate,
    detailAttempts,
    detailSuccessRate,
    searchRunCount,
    avgSearchCollected,
    searchAttemptCount,
    searchFailureRate,
    dominantSearchFailureMode,
    workerBreakdown,
  });
  const hysteresis = applySourceHealthHysteresis(proposed, previous);
  const now = new Date().toISOString();
  const payload = {
    source: "bunjang",
    checked_at: now,
    window_minutes: windowMinutes,
    status: hysteresis.status,
    previous_status: previous?.status ?? null,
    detail_success_rate: Math.round(detailSuccessRate * 1000) / 1000,
    detail_404_rate: 0,
    detail_5xx_rate: 0,
    sold_transition_rate: 0,
    disappeared_transition_rate: 0,
    search_result_count: searchCollected,
    baseline_json: {
      proposedStatus: proposed.status,
      runCount: sourceRows.length,
      allWorkerRunCount: rows.length,
      failedRuns,
      failedRunRate: Math.round(failedRunRate * 1000) / 1000,
      detailAttempts,
      detailSucceeded,
      detailFailed,
      searchRunCount,
      searchSucceeded,
      searchFailed,
      searchAttemptCount,
      searchFailureRate: Math.round(searchFailureRate * 1000) / 1000,
      searchFailedByMode: Object.fromEntries(searchFailedByMode.entries()),
      avgSearchCollected: Math.round(avgSearchCollected),
      previousCheckedAt: previous?.checked_at ?? null,
      effectiveStatus: hysteresis.status,
      ignoredInternalWorkerFailures: rows.filter((row) => !isSourceRelevantMode(runMode(row)) && row.status === "failed").length,
      workerBreakdown: Object.fromEntries(workerBreakdown.entries()),
    },
    hysteresis_json: {
      changed: hysteresis.changed,
      note: "source_health_hysteresis_active",
      gateDecision: hysteresis.gateDecision,
      proposedStatus: proposed.status,
      previousProposedStatus: hysteresis.previousProposedStatus,
      proposedStatusSince: hysteresis.proposedStatusSince,
      proposedStatusAgeMs: hysteresis.proposedStatusAgeMs,
      healthySince: hysteresis.healthySince,
      nonHealthySince: hysteresis.nonHealthySince,
      unhealthySince: hysteresis.unhealthySince,
      enterDegradedAfterMinutes: 5,
      enterUnhealthyAfterMinutes: 5,
      recoverHealthyAfterMinutes: 15,
      policy: "healthy=all_transitions,degraded=pool_and_high_priority,unhealthy=no_lifecycle_transitions",
    },
    reason: proposed.reason,
  };
  const inserted = await softInsertRows("mvp_source_health", [payload]);
  stats.scored = rows.length;
  stats.upserted = inserted ? 1 : 0;
  stats.detailFailed = detailFailed;
  if (hysteresis.status !== "healthy") stats.poolSkipped = 1;
  return stats;
}

async function upsertMarketPriceDaily(rows: ScorableRawRow[], parsedByPid: Map<number, ParsedListingRow>) {
  const byKey = new Map<string, {
    rows: ScorableRawRow[];
    activeRows: ScorableRawRow[];
    soldRows: ScorableRawRow[];
    disappearedRows: ScorableRawRow[];
    skuId: string | null;
  }>();
  for (const row of rows) {
    const parsed = parsedByPid.get(row.pid);
    if (!parsed?.comparable_key || Number(parsed.parse_confidence ?? 0) < 0.65 || parsed.needs_review) continue;
    const key = parsed.comparable_key;
    if (!byKey.has(key)) byKey.set(key, { rows: [], activeRows: [], soldRows: [], disappearedRows: [], skuId: row.sku_id });
    const group = byKey.get(key)!;
    group.rows.push(row);
    if (row.listing_state === "sold_confirmed") group.soldRows.push(row);
    else if (row.listing_state === "disappeared") group.disappearedRows.push(row);
    else group.activeRows.push(row);
  }

  const today = kstDateString();
  const marketRows = [...byKey.entries()].map(([comparableKey, group]) => {
    const active = trimmedSellerMarket(group.activeRows);
    const sold = trimmedSellerMarket(group.soldRows);
    const disappeared = trimmedSellerMarket(group.disappearedRows);
    const activeMedian = active.median;
    const soldMedian = sold.median;
    const disappearedMedian = disappeared.median;
    const blendedMedian =
      soldMedian != null && sold.count >= 8 && activeMedian != null && active.count >= 5
        ? Math.round((soldMedian * 0.7) + (activeMedian * 0.3))
        : soldMedian != null && sold.count >= 5
          ? soldMedian
          : activeMedian != null
            ? activeMedian
            : disappearedMedian != null && disappeared.count >= 8
              ? Math.round(disappearedMedian * 0.9)
              : disappearedMedian;
    const confidenceBasis = sold.count >= 8 ? sold.count : active.count;
    const confidence = confidenceBasis >= 20 ? "high" : confidenceBasis >= 8 ? "medium" : "low";
    return {
      date: today,
      comparable_key: comparableKey,
      ...marketKeyMeta(comparableKey, group.skuId),
      active_median_price: activeMedian,
      sold_median_price: soldMedian,
      blended_median_price: blendedMedian,
      p25_price: active.p25,
      p75_price: active.p75,
      active_sample_count: active.count,
      sold_sample_count: sold.count,
      disappeared_sample_count: disappeared.count,
      confidence,
      computed_at: new Date().toISOString(),
    };
  });

  await upsertRows("mvp_market_price_daily", marketRows, "date,comparable_key");
  return {
    keyCount: marketRows.length,
    sampleCount: marketRows.reduce((sum, row) => sum + row.active_sample_count + row.sold_sample_count + row.disappeared_sample_count, 0),
  };
}

export async function marketStatsStage(): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const pendingInvalidations = await loadPendingMarketInvalidations();
  const pendingKeys = new Set(pendingInvalidations.map((row) => row.comparable_key));
  const invalidatedParsedByPid = await loadParsedRowsByComparableKeys([...pendingKeys], config.marketStatsLimit);
  const invalidatedPids = [...invalidatedParsedByPid.keys()];
  if (pendingInvalidations.length > 0 && invalidatedPids.length === 0) {
    stats.queued = pendingInvalidations.length;
    stats.enriched = await markMarketInvalidationsDone([...pendingKeys]);
    return stats;
  }
  const rows = invalidatedPids.length > 0
    ? await loadMarketStatRowsByPids(invalidatedPids, config.marketStatsLimit)
    : await loadMarketStatRows(config.marketStatsLimit);
  if (rows.length === 0) {
    stats.queued = pendingInvalidations.length;
    if (pendingInvalidations.length > 0) {
      stats.enriched = await markMarketInvalidationsDone([...pendingKeys]);
    }
    return stats;
  }

  const parsedByPid = invalidatedPids.length > 0
    ? await ensureParsedRows(rows, invalidatedParsedByPid)
    : await ensureParsedRows(rows, await loadParsedRows(rows.map((row) => row.pid)));
  const result = await upsertMarketPriceDaily(rows, parsedByPid);
  const recomputedKeys = [...new Set(
    rows
      .map((row) => preciseComparableKey(parsedByPid.get(row.pid)))
      .filter((key): key is string => Boolean(key))
  )];
  const completedInvalidationKeys = recomputedKeys.filter((key) => pendingKeys.has(key));
  const closedInvalidations = await markMarketInvalidationsDone(completedInvalidationKeys);
  stats.scored = rows.length;
  stats.upserted = result.keyCount;
  stats.poolUpserted = result.sampleCount;
  stats.queued = pendingInvalidations.length;
  stats.enriched = closedInvalidations;
  return stats;
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

async function invalidatePoolEntries(entries: { pid: number; reason: string }[]) {
  const results = await Promise.allSettled(entries.map((entry) => patchRows(
    "mvp_candidate_pool",
    `pid=eq.${entry.pid}&status=in.(ready,reserved)`,
    {
      status: "invalidated",
      invalidated_reason: entry.reason.slice(0, 120),
      reserved_until: null,
      updated_at: new Date().toISOString(),
    },
  )));
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    console.error("pool invalidation partially failed", {
      failed: failed.length,
      total: entries.length,
      errors: failed.slice(0, 3).map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason)),
    });
  }
}

async function loadPoolWarmRows(limit: number): Promise<PoolWarmRow[]> {
  const cols = "pid,profit_band,expected_profit_min,expected_profit_max,status,last_verified_at";
  const res = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=${cols}&status=eq.ready&order=profit_band.desc,expected_profit_min.desc,last_verified_at.asc&limit=${limit}`,
    { headers: serviceHeaders() },
  );
  return (await res.json()) as PoolWarmRow[];
}

async function loadRawPrices(pids: number[]): Promise<Map<number, number>> {
  if (pids.length === 0) return new Map();
  const res = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid,price&pid=in.(${pids.join(",")})`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json()) as { pid: number; price: number }[];
  return new Map(rows.map((row) => [Number(row.pid), Number(row.price)]));
}

async function markPoolVerified(pid: number) {
  const now = new Date().toISOString();
  await patchRows("mvp_candidate_pool", `pid=eq.${pid}`, {
    last_verified_at: now,
    updated_at: now,
  });
}

async function claimLifecycleChecks(): Promise<LifecycleClaimRow[]> {
  const config = loadPipelineRuntimeConfig();
  const res = await restFetch(rpcUrl("claim_mvp_lifecycle_checks"), {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      p_batch_size: Math.min(30, config.tickDetailBatchSize),
      p_lease_seconds: config.tickDetailLeaseSeconds,
    }),
  });
  return (await res.json()) as LifecycleClaimRow[];
}

async function patchLifecycle(pid: number, payload: Record<string, unknown>) {
  await patchRows("mvp_lifecycle_checks", `pid=eq.${pid}`, {
    ...payload,
    locked_at: null,
    locked_until: null,
    updated_at: new Date().toISOString(),
  });
}

async function markRawLifecycleState(row: LifecycleClaimRow, status: LifecycleStatus, detailSaleStatus?: string | null) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    listing_state: status,
    updated_at: now,
  };
  if (status === "sold_confirmed") patch.sold_detected_at = now;
  if (status === "disappeared") patch.disappeared_at = now;
  if (status === "missing_suspect" || status === "disappeared") {
    patch.last_missing_at = now;
  }
  if (status === "active") {
    patch.missing_count = 0;
  }
  if (detailSaleStatus != null) patch.sale_status = detailSaleStatus;
  await patchRows("mvp_raw_listings", `pid=eq.${row.pid}`, patch);
}

async function insertLifecycleObservation(row: LifecycleClaimRow, status: LifecycleStatus, result: string, detailSaleStatus?: string | null) {
  await insertRows("mvp_listing_observations", [{
    pid: Number(row.pid),
    observed_at: new Date().toISOString(),
    event_type: "state_changed",
    price: Number(row.price ?? 0),
    name: row.name,
    num_faved: Number(row.num_faved ?? 0),
    sale_status: detailSaleStatus ?? "",
    listing_state: status,
    seller_uid: row.seller_uid,
    sku_id: row.sku_id,
    sku_name: row.sku_name,
    comparable_key: row.comparable_key,
    source: "lifecycle_worker",
    raw_json: {
      lifecycle_result: result,
      previous_status: row.lifecycle_status,
      priority_tier: row.priority_tier,
      parser_version: row.parser_version,
    },
  }]);
}

function shouldSkipLifecycleForHealth(row: LifecycleClaimRow, health: SourceHealthStatus) {
  if (health === "healthy") return false;
  if (health === "unhealthy") return true;
  return row.priority_tier !== "pool" && row.priority_tier !== "near_pool";
}

export async function lifecycleStage(deadlineMs: number): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const sourceHealth = await loadLatestSourceHealth();
  const healthStatus = sourceHealth?.status ?? "degraded";
  const claims = await claimLifecycleChecks();
  stats.claimed = claims.length;
  const marketInvalidations: MarketKeyInvalidationEvent[] = [];

  for (const row of claims) {
    if (Date.now() >= deadlineMs - DETAIL_STAGE_SAFETY_MARGIN_MS) {
      stats.timedOut = true;
      await patchLifecycle(row.pid, {
        last_check_result: "skipped_budget",
        next_check_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        state_reason: "lifecycle_budget_guard",
      });
      continue;
    }

    if (shouldSkipLifecycleForHealth(row, healthStatus)) {
      stats.poolSkipped += 1;
      await patchLifecycle(row.pid, {
        last_check_result: "skipped_source_degraded",
        next_check_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        state_reason: `source_health_${healthStatus}`,
      });
      continue;
    }

    try {
      const detail = await fetchDetail(String(row.pid));
      if (config.detailDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, config.detailDelayMs));
      const signals = detectSoldOut(detail, row.price);
      const reason = describeSignals(signals);
      stats.enriched += detail ? 1 : 0;
      stats.detailFailed += detail ? 0 : 1;

      if (!detail) {
        const missingCount = row.consecutive_missing_count + 1;
        const nextStatus: LifecycleStatus = missingCount >= 3 && healthStatus === "healthy" ? "disappeared" : "missing_suspect";
        await patchLifecycle(row.pid, {
          status: nextStatus,
          last_checked_at: new Date().toISOString(),
          last_check_result: missingCount >= 3 ? "missing" : "error",
          consecutive_missing_count: missingCount,
          consecutive_error_count: row.consecutive_error_count + 1,
          next_check_at: lifecycleNextCheckAt(row.priority_tier, nextStatus),
          last_error: "detail api returned null",
          transition_confidence: nextStatus === "disappeared" ? 0.7 : 0.35,
          state_reason: nextStatus === "disappeared" ? "repeated_detail_fetch_missing" : "detail_fetch_missing_once",
        });
        if (nextStatus !== row.lifecycle_status) {
          await markRawLifecycleState(row, nextStatus);
          await insertLifecycleObservation(row, nextStatus, reason);
          marketInvalidations.push({
            comparableKey: row.comparable_key,
            reason: `lifecycle_${nextStatus}`,
            priority: 100,
            affectedPid: row.pid,
            oldComparableKey: row.comparable_key,
            parserVersion: row.parser_version,
          });
        }
        continue;
      }

      if (isSoldOut(signals) && canPermanentlyInvalidateSoldOut(signals, healthStatus)) {
        await patchLifecycle(row.pid, {
          status: "sold_confirmed",
          last_checked_at: new Date().toISOString(),
          last_check_result: "sold",
          consecutive_missing_count: 0,
          consecutive_error_count: 0,
          next_check_at: lifecycleNextCheckAt(row.priority_tier, "sold_confirmed"),
          last_error: null,
          detail_status_code: 200,
          transition_confidence: healthStatus === "healthy" ? 0.95 : 0.8,
          state_reason: `sold_signal_${reason}`,
        });
        await markRawLifecycleState(row, "sold_confirmed", detail.saleStatus);
        await invalidatePoolEntries([{ pid: row.pid, reason: `lifecycle_sold_${reason}` }]);
        await insertLifecycleObservation(row, "sold_confirmed", reason, detail.saleStatus);
        marketInvalidations.push({
          comparableKey: row.comparable_key,
          reason: "lifecycle_sold_confirmed",
          priority: 100,
          affectedPid: row.pid,
          oldComparableKey: row.comparable_key,
          parserVersion: row.parser_version,
        });
        stats.poolSkipped += 1;
        continue;
      }

      await patchLifecycle(row.pid, {
        status: "active",
        last_checked_at: new Date().toISOString(),
        last_check_result: "active",
        consecutive_missing_count: 0,
        consecutive_error_count: 0,
        attempts: 0,
        next_check_at: lifecycleNextCheckAt(row.priority_tier, "active"),
        last_error: null,
        detail_status_code: 200,
        transition_confidence: 1,
        state_reason: reason === "active" ? "detail_active" : `non_terminal_signal_${reason}`,
      });
      if (row.lifecycle_status !== "active" || row.listing_state !== "active") {
        await markRawLifecycleState(row, "active", detail.saleStatus);
        await insertLifecycleObservation(row, "active", reason, detail.saleStatus);
        marketInvalidations.push({
          comparableKey: row.comparable_key,
          reason: "lifecycle_reactivated",
          priority: 90,
          affectedPid: row.pid,
          oldComparableKey: row.comparable_key,
          parserVersion: row.parser_version,
        });
      }
    } catch (err) {
      stats.detailFailed += 1;
      await patchLifecycle(row.pid, {
        last_check_result: "error",
        consecutive_error_count: row.consecutive_error_count + 1,
        next_check_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        last_error: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
        state_reason: "lifecycle_exception",
      });
    }
  }

  stats.upserted = await enqueueMarketKeyInvalidations(marketInvalidations);
  return stats;
}

export async function poolWarmerStage(deadlineMs: number): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const sourceHealth = await loadLatestSourceHealth();
  const healthStatus = sourceHealth?.status ?? "degraded";
  if (healthStatus === "unhealthy") {
    stats.poolSkipped = 1;
    return stats;
  }
  const rows = await loadPoolWarmRows(Math.min(80, config.tickDetailBatchSize * 2));
  const prices = await loadRawPrices(rows.map((row) => row.pid));

  for (const row of rows) {
    if (Date.now() >= deadlineMs - DETAIL_STAGE_SAFETY_MARGIN_MS) {
      stats.timedOut = true;
      return stats;
    }
    const detail = await fetchDetail(String(row.pid));
    if (config.detailDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, config.detailDelayMs));
    const signals = detectSoldOut(detail, prices.get(row.pid));
    stats.claimed += 1;
    if (!detail) {
      stats.detailFailed += 1;
      continue;
    }
    if (isSoldOut(signals)) {
      if (canPermanentlyInvalidateSoldOut(signals, healthStatus)) {
        await invalidatePoolEntries([{ pid: row.pid, reason: `pool_warmer_${healthStatus}_${describeSignals(signals)}` }]);
      }
      stats.poolSkipped += 1;
      continue;
    }
    await markPoolVerified(row.pid);
    stats.enriched += 1;
  }

  return stats;
}

export async function housekeeperStage(): Promise<StageStats> {
  const stats = emptyStats();
  const now = new Date().toISOString();

  const expiredPoolRes = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid,exposure_count,max_exposure&status=eq.reserved&reserved_until=lt.${encodeURIComponent(now)}&limit=200`,
    { headers: serviceHeaders() },
  );
  const expiredPool = (await expiredPoolRes.json()) as { pid: number; exposure_count: number; max_exposure: number }[];
  await Promise.all(expiredPool.map((row) => patchRows("mvp_candidate_pool", `pid=eq.${row.pid}&status=eq.reserved`, {
    status: Number(row.exposure_count) >= Number(row.max_exposure) ? "spent" : "ready",
    reserved_until: null,
    updated_at: now,
  })));

  const staleQueueRes = await restFetch(
    `${tableUrl("mvp_detail_queue")}?select=id,status&status=eq.processing&locked_until=lt.${encodeURIComponent(now)}&limit=200`,
    { headers: serviceHeaders() },
  );
  const staleQueue = (await staleQueueRes.json()) as { id: string }[];
  await Promise.all(staleQueue.map((row) => patchRows("mvp_detail_queue", `id=eq.${encodeURIComponent(row.id)}`, {
    status: "pending",
    locked_at: null,
    locked_until: null,
    available_at: now,
    updated_at: now,
  })));

  stats.upserted = expiredPool.length;
  stats.queued = staleQueue.length;
  return stats;
}

export async function scoreStage(deadlineMs: number): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const rows = await loadScorableRows(config.tickScoreLimit);
  if (rows.length === 0) return stats;
  const parsedByPid = await ensureParsedRows(rows, await loadParsedRows(rows.map((row) => row.pid)));
  const marketStatsByKey = await loadMarketPriceStats(
    rows
      .map((row) => preciseComparableKey(parsedByPid.get(row.pid)))
      .filter((key): key is string => Boolean(key))
  );

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
    const comparableKey = preciseComparableKey(parsed);
    const marketStat = comparableKey ? marketStatsByKey.get(comparableKey) : undefined;
    const trustedMedian = trustedMarketMedian(marketStat);
    const prices = pricesByMarket.get(marketKey) ?? [];
    const coarsePrices = pricesBySku.get(skuId) ?? [];
    const hasTrustedMarket = trustedMedian != null;
    const fallbackMedian = prices.length >= 5
      ? median(prices)
      : (coarsePrices.length >= 5 ? median(coarsePrices) : (skuMsrp.get(skuId) ?? 300000) * 0.5);
    const skuMedian = hasTrustedMarket ? trustedMedian : fallbackMedian;
    const priceGap = skuMedian <= 0 ? 0 : Math.max(0, Math.min(1, (skuMedian - row.price) / skuMedian));
    const velocity = percentileRank(favsByMarket.get(marketKey) ?? [], row.num_faved);
    const safetyBase = row.shop_review_rating == null ? 0.5 : Math.max(0, Math.min(1, Number(row.shop_review_rating) / 5));
    const safety = Math.max(0, Math.min(1, safetyBase + (row.shop_review_count >= 100 ? 0.05 : 0)));
    const riskHits = ["직거래만", "현금만", "박스없음", "박스 없음", "수리이력", "충전안됨", "충전 안됨", "고장", "불량", "먹통"]
      .filter((kw) => row.description_preview.toLowerCase().includes(kw.toLowerCase())).length;
    const parseConfidence = Number(parsed?.parse_confidence ?? 0);
    const precisionPenalty = (parseConfidence > 0 && parseConfidence < 0.65 ? 0.75 : 1) * (hasTrustedMarket ? 1 : 0.65);
    const score = (priceGap * 0.5 + velocity * 0.4 + safety * 0.1) * 100 * precisionPenalty;
    const apiParsed = parseShippingFromTrade(row.trade_data, row.trades_data);
    const descParsed = parseShippingFromDescription(row.description_preview);
    const shipping = resolveShipping(row.price, skuMedian, row.free_shipping, apiParsed, descParsed);
    const scoreFlags: string[] = [];
    if (priceGap >= 0.55) scoreFlags.push("deep_discount_review");
    if (riskHits > 0) scoreFlags.push("risk_keyword_review");
    if (row.description_preview.trim().length < 20) scoreFlags.push("weak_description");
    if (!hasTrustedMarket) {
      scoreFlags.push("coarse_market_price");
      if (!comparableKey || !marketStat) scoreFlags.push("market_stat_missing");
      else if (marketStat.confidence === "low") scoreFlags.push("market_confidence_low");
    }
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
  const poolInvalidations: { pid: number; reason: string }[] = [];
  let poolSkipped = 0;
  for (const row of aiReview.rows) {
    const sellFee = Math.round(row.skuMedian * SELLING_FEE_RATE);
    const buyMax = row.price + (row.shippingFeeGeneral ?? row.shippingFee);
    const buyMin = row.estimatedBuyCost;
    const profitMax = Math.max(0, row.skuMedian - buyMin - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
    const profitMin = Math.max(0, row.skuMedian - buyMax - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
    const band = bandFromProfit(profitMin, profitMax);
    const pid = Number(row.pid);
    if (band === null) {
      poolSkipped += 1;
      poolInvalidations.push({ pid, reason: "profit_below_pack_band" });
      continue;
    }
    const parsed = parsedByPid.get(pid);
    const confidence = computePoolConfidence(Number(parsed?.parse_confidence ?? 0.5), row.scoreFlags);
    const comparableKey = parsed?.comparable_key ?? null;
    const skipReason =
      profitMin <= 0 ? "profit_not_positive" :
      row.price >= row.skuMedian ? "price_gte_market" :
      row.riskHits > 0 ? "risk_keyword" :
      !row.thumbnailUrl ? "missing_thumbnail" :
      !comparableKey ? "missing_comparable_key" :
      parsed?.needs_review ? "option_needs_review" :
      confidence < POOL_CONFIDENCE_FLOOR ? "pool_confidence_low" :
      hasPoolBlockFlag(row.scoreFlags) ? `blocked_${row.scoreFlags.find((flag) => POOL_BLOCK_FLAGS.includes(flag) || flag.endsWith("_low_confidence")) ?? "score_flag"}` :
      null;
    if (skipReason) {
      poolSkipped += 1;
      poolInvalidations.push({ pid, reason: skipReason });
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
  await promoteLifecyclePriority(
    poolEntries.map((entry) => Number(entry.pid)).filter(Number.isFinite),
    "pool",
    new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  );
  await invalidatePoolEntries(poolInvalidations);
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

export async function runSearchScorePipeline(): Promise<TickResult> {
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

  const search = await timed("search", () => searchStage(Date.now() + config.tickSearchBudgetMs, {
    pages: [0],
    mode: "fresh",
  }));
  const score = await timed("score", () => scoreStage(Date.now() + config.tickScoreBudgetMs));
  const detail = emptyStats();
  const total = mergeStats([search, detail, score]);
  return {
    ...total,
    stages: { search, detail, score },
    stageDurationsMs,
  };
}

export async function runDeepCrawlPipeline(pageOverride?: number): Promise<TickResult> {
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

  const page = pageOverride != null
    ? Math.max(1, Math.min(config.deepCrawlMaxPage, Math.round(pageOverride)))
    : rotatedDeepPage(config.deepCrawlMaxPage);
  const search = await timed("deep", () => searchStage(Date.now() + config.tickSearchBudgetMs, {
    pages: [page],
    mode: "deep",
  }));
  const detail = emptyStats();
  const score = emptyStats();
  const total = mergeStats([search, detail, score]);
  return {
    ...total,
    stages: { search, detail, score },
    stageDurationsMs: { ...stageDurationsMs, deepPage: page },
  };
}

export async function runDetailWorkerPipeline(): Promise<TickResult> {
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

  const search = emptyStats();
  const detail = await timed("detail", () => detailStage(Date.now() + config.tickDetailBudgetMs));
  const score = emptyStats();
  const total = mergeStats([search, detail, score]);
  return {
    ...total,
    stages: { search, detail, score },
    stageDurationsMs,
  };
}

export async function runPoolWarmerPipeline(): Promise<TickResult> {
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

  const search = emptyStats();
  const detail = await timed("pool_warmer", () => poolWarmerStage(Date.now() + config.tickDetailBudgetMs));
  const score = emptyStats();
  const total = mergeStats([search, detail, score]);
  return {
    ...total,
    stages: { search, detail, score },
    stageDurationsMs,
  };
}

export async function runLifecycleWorkerPipeline(): Promise<TickResult> {
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

  const search = emptyStats();
  const detail = await timed("lifecycle", () => lifecycleStage(Date.now() + config.tickDetailBudgetMs));
  const score = emptyStats();
  const total = mergeStats([search, detail, score]);
  return {
    ...total,
    stages: { search, detail, lifecycle: detail, score },
    stageDurationsMs,
  };
}

export async function runMarketStatsPipeline(): Promise<TickResult> {
  const stageDurationsMs: Record<string, number> = {};

  async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
      return await fn();
    } finally {
      stageDurationsMs[name] = Date.now() - started;
    }
  }

  const search = emptyStats();
  const detail = emptyStats();
  const health = await timed("source_health", () => sourceHealthStage());
  const market = await timed("market_stats", () => marketStatsStage());
  const score = mergeStats([health, market]);
  const total = mergeStats([search, detail, score]);
  return {
    ...total,
    stages: { search, detail, source_health: health, market_stats: market, score },
    stageDurationsMs,
  };
}

export async function runHousekeeperPipeline(): Promise<TickResult> {
  const stageDurationsMs: Record<string, number> = {};

  async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
      return await fn();
    } finally {
      stageDurationsMs[name] = Date.now() - started;
    }
  }

  const search = emptyStats();
  const detail = emptyStats();
  const score = await timed("housekeeper", () => housekeeperStage());
  const total = mergeStats([search, detail, score]);
  return {
    ...total,
    stages: { search, detail, score },
    stageDurationsMs,
  };
}
