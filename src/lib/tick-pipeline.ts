import { createHash } from "node:crypto";

import { searchPage, fetchDetail, type SearchItem } from "@/lib/bunjang";

// Wave 132b (2026-05-16 04:38 KST): 번개 UI 댓글 수가 metrics.buntalkCount임을 확인.
// 이 시각 이전에 이미 detail_status=done이었던 row는 num_comment가 비어 있을 수 있어 재상세수집한다.
const BUNTALK_COUNT_FIX_DEPLOYED_AT_MS = Date.UTC(2026, 4, 15, 19, 38, 30);
const MAX_POOL_WARM_NUM_COMMENT = 8;

// Wave 138b (2026-05-16): description SHA256 (500자) — 다중 ID 사기 그룹 탐지.
// 같은 hash + 다른 seller_uid 2+ = 부캐 그룹 (DB 발견 27건/7셀러 패턴).
// 50자 미만은 의미 없음 (default text — null 반환).
function computeDescriptionHash(description: string | null | undefined): string | null {
  const txt = (description ?? "").slice(0, 500).trim();
  if (txt.length < 50) return null;
  return createHash("sha256").update(txt).digest("hex").slice(0, 32);
}
import { loadCategoryReadinessMap, loadLaneReadinessMap } from "@/lib/category-readiness";
import { evaluatePhase2Escrow, isPhase2EscrowEnabled } from "@/lib/ai-l2-escrow";
import { buildCandidatePoolRows } from "@/lib/candidate-pool-builder";
// Wave 238 (2026-05-19): AI L2 coverage gap fix. ready pool 매물 중 91.1% 가 AI 안 봄.
//   Phase 1 = shadow audit (ai_audit_status 기록).
//   Phase 2 = fashion non-pass residue cleanup 에서 ready/reserved 차단.
import { runShadowAudit } from "@/lib/ai-l2-shadow-audit";
import { CATALOG, ruleMatch, skuById, type Sku } from "@/lib/catalog";
import {
  decayTrimmedSellerMarket,
  madTrim,
  percentileRank,
  trimmedSellerMarket,
} from "@/lib/market-math";
import { notifyOperationalAlerts, type OperationalAlert } from "@/lib/operational-notifier";
import {
  PARSER_VERSION as OPTION_PARSER_VERSION,
  bunjangLabelToConditionClass,
  extractConditionClass,
  parseListingOptions,
  toParsedListingRow,
} from "@/lib/option-parser";
import { conditionFallbackChain, pickByConditionFallback } from "@/lib/condition-fallback";
import {
  aiHasHardRisk,
  aiSecondOpinionDecision,
  applyAiReview,
  classifyConditionWithAi,
  classifyListing,
  contentHash,
  parseShippingFromDescription,
  parseShippingFromTrade,
  resolveShipping,
  type AiClassification,
  type PipelineRow,
} from "@/lib/pipeline";
import { loadPipelineRuntimeConfig, getCategoryPageOverrides, boundedInt } from "@/lib/pipeline-config";
import {
  decideCadence,
  queryFamily,
  type CadenceDecision,
  type CategoryReadinessStatus,
  type QueryYieldRow,
} from "@/lib/search-query-cadence";
import {
  emptyStats,
  mergeStats,
  timedStage,
  type StageStats,
  type TickResult,
} from "@/lib/pipeline-stage";
import {
  canPermanentlyInvalidateSoldOut,
  describeSignals,
  detectSoldOut,
  hasStrongSoldOutSignal,
  isActiveSaleStatus,
  isSoldOut,
  soldOutTextHits,
  type SoldOutSignal,
  type SourceHealthStatus,
} from "@/lib/sold-out";
// Wave launch-41: joongna lifecycle detail fetch.
import { fetchJoongnaDetail } from "@/lib/joongna";
import { fetchDaangnLiveState } from "@/lib/daangn";
import {
  analysisOutputDiffReasons,
  analysisOutputChanged,
  listingOutputDiffReasons,
  listingOutputChanged,
  toListingOutputRows,
  toRankedAnalysisRows,
  type AnalysisOutputRow,
  type ListingOutputRow,
} from "@/lib/score-output-mapper";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { normalizeMarketplaceSource, type KnownMarketplaceSource } from "@/lib/marketplace-source";
// Wave 254.3 (2026-05-20): cap 1000 silent miss fix — restFetchAll page-loop.
import { restFetchAll } from "@/lib/rest-paginated";

type RawListingRow = {
  pid: number;
  source?: string | null;
  name: string;
  price: number;
  num_faved: number;
  free_shipping: boolean;
  query?: string | null;
  url: string;
  seller_uid: string | null;
  thumbnail_url: string | null;
  listing_type: string;
  listing_type_override?: string | null;
  sku_id: string | null;
  sku_name: string | null;
  detail_status: string;
  detail_enriched_at: string | null;
  detail_error: string | null;
  last_seen_at: string;
  last_changed_at: string;
  source_updated_at: string | null;
  listing_state: string;
  sale_status?: string | null;
  num_comment: number | null;
  missing_count: number;
  last_missing_at: string | null;
  raw_json?: Record<string, unknown> | null;
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
type LifecycleClaimMode = "default" | "terminal_recheck";

type LifecycleClaimRow = {
  pid: number;
  // Wave launch-41: source/url 추가 — joongna lifecycle 지원.
  // claim RPC (migration launch_41_lifecycle_claim_return_source_url_v2) 가 raw_listings.source/url 같이 select.
  source: "bunjang" | "joongna" | string;
  url: string | null;
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
  // Wave 132 (2026-05-16): 댓글 수 — detail-worker가 detail.commentCount 박음. candidate-pool-builder gate에서 사용.
  num_comment: number | null;
  // Wave 137 (2026-05-16): 수량 — qty > 1 = 대량 판매업자. pool 진입 차단 gate.
  qty: number | null;
  // Wave 138b (2026-05-16): description hash — 다중 ID 사기 그룹 탐지.
  description_hash: string | null;
  // Wave 217 (2026-05-19): bunjang 자체 condition 등급 (NEW/LIKE_NEW/LIGHTLY_USED/USED/HEAVILY_USED/DAMAGED).
  //   shoe 4011건 / bag 1018건 등 8000+ 매물에 박혀있는데 parseFashionMobility 가 안 씀.
  //   parseFashionMobility 안에서 bunjangLabelToConditionClass + resolveConditionClass 로 활용.
  bunjang_condition_label: string | null;
  daangn_manner_temperature: number | null;
  pool_eligible?: boolean | null;
};

type ParsedListingRow = {
  pid: number;
  parser_version: string | null;
  category: Sku["category"] | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  condition_score: number | null;
  // Wave 130 (2026-05-16): condition_class column — DB migration 추가.
  // 시세 산정 시 (comparable_key, condition_class) 복합 키로 grouping.
  condition_class: string | null;
  // Wave 722 / Stage 5 (2026-05-23): condition_tier (S/A/B/C/D/UNKNOWN) — Wave 714 신발/의류 5-tier.
  //   시세 산정 시 shoe/clothing 만 (comparable_key, condition_tier) 별 별도 row.
  //   launch-78 후속 — 라벨/비교군 UI 외에 시세 자체도 tier-aware.
  condition_tier: string | null;
  needs_review: boolean | null;
  condition_notes?: string[] | null;
  parsed_json?: Record<string, unknown> | null;
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

type ExistingSearchSellerRow = {
  seller_uid: string;
  is_proshop: boolean | null;
  last_seen_at: string | null;
  source_json: Record<string, unknown> | null;
};

type MarketPriceRow = {
  date: string;
  comparable_key: string;
  // Wave 130 (2026-05-16): condition_class — PK 일부. condition별 시세 분리.
  condition_class: string;
  active_median_price: number | null;
  sold_median_price: number | null;
  blended_median_price: number | null;
  // Wave 196 (2026-05-18): p25/p75 percentile — spread check (가품/특가 매물이 sample에 혼재하면 spread 큼).
  p25_price: number | null;
  p75_price: number | null;
  active_sample_count: number;
  sold_sample_count: number;
  disappeared_sample_count: number;
  confidence: "high" | "medium" | "low";
  computed_at: string;
};

// Wave 130: comparable_key → (condition_class → row) 이중 map.
type MarketPriceStatsMap = Map<string, Map<string, MarketPriceRow>>;

function rawJsonSource(row: { raw_json?: Record<string, unknown> | null }): string {
  const source = row.raw_json?.source;
  return typeof source === "string" ? source : "";
}

function isInternalObservationPoolIneligible(row: {
  query?: string | null;
  raw_json?: Record<string, unknown> | null;
}): boolean {
  const query = String(row.query ?? "");
  const source = rawJsonSource(row);
  return (
    query.startsWith("internal_acquisition:") ||
    /^wave\d+_.*boost:/.test(query) ||
    source === "internal_acquisition_executor" ||
    /^wave\d+_.*boost$/.test(source)
  );
}

function isStaleBunjangPoolEligibleFalse(row: {
  source?: string | null;
  query?: string | null;
  raw_json?: Record<string, unknown> | null;
  pool_eligible?: boolean | null;
}): boolean {
  return row.pool_eligible === false && row.source === "bunjang" && !isInternalObservationPoolIneligible(row);
}

function isRawPublicPoolEligible(row: {
  source?: string | null;
  query?: string | null;
  raw_json?: Record<string, unknown> | null;
  pool_eligible?: boolean | null;
}): boolean {
  return row.pool_eligible !== false || isStaleBunjangPoolEligibleFalse(row);
}

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
  last_event_at?: string | null;
  affected_pid?: number | null;
  affected_source?: string | null;
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
const REST_READ_CHUNK_SIZE = 25;
const RAW_EXISTING_READ_CHUNK_SIZE = 500;
const POOL_PID_READ_CHUNK_SIZE = 500;
const REST_WRITE_CHUNK_SIZE = 50;
const SCORE_DIRTY_CLEAR_CHUNK_SIZE = 200;
const SCORE_DIRTY_MARK_CHUNK_SIZE = 300;
const RAW_TOUCH_WRITE_CHUNK_SIZE = 400;
const SELLER_WRITE_CHUNK_SIZE = 200;
// Keep seller_uid=in.(...) URLs under common proxy/request-line limits.
const SELLER_READ_CHUNK_SIZE = 80;
const GENERAL_SCORE_SOURCES = ["bunjang"];
const POOL_LOW_SELLER_RATING_REVIEW = 3.5;
const SKU_MEDIAN_UNAVAILABLE_MARKET_REFRESH_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const DEFAULT_SELLER_SEARCH_REFRESH_MS = 3 * 60 * 60 * 1000;
const PARSED_PID_READ_CHUNK_SIZE = 300;
const REST_KEY_READ_CHUNK_SIZE = 50;
const DEFAULT_MARKET_INVALIDATION_KEY_CHUNK_SIZE = 10;
const DEFAULT_MARKET_INVALIDATION_PARSED_ROWS_PER_KEY_CHUNK = 300;
const DEFAULT_MARKET_INVALIDATION_RESCUE_ROWS_PER_KEY = 80;
const TERMINAL_LISTING_STATES = new Set(["sold_confirmed", "disappeared", "archived"]);

export type ScoreStageOptions = {
  lane?: string;
  sourceFilter?: KnownMarketplaceSource | null;
  daangnShardCount?: number;
  daangnShardIndex?: number;
  cleanup?: boolean;
};
// Wave 713 (2026-05-23): v1→v2 bump — Wave 712 catalog 152 신설 후 stale 168K 매물 reparse.
//   bias-free 검증으로 brand 매물 매칭 가능한데 title_triage_v1 단계에서 차단된 매물 대량 발견.
//   v2 bump 시 isCurrentTitleTriageSkip false → cron이 점진적 reparse.
// Wave 752 (2026-05-24): v2→v3 bump — Wave 727-751 cycle 55+ SKU 신설 (Dyson V/의류 broad/신발 신규 brand 등)
//   audit: 135,427 matters detail_status='skipped' (7일) — 9.4% sku_id 매칭률.
//   sample 확인: Nike Air Max BW / Adidas Superstar / NIKE DUNK GOLDENROD 같은 catalog match
//   가능한 매물 다수 stale v2 단계 차단. v3 bump → 점진 reparse 큐.
const TITLE_TRIAGE_SKIP_VERSION = "title_triage_v3";
let rawScoreDirtySchemaAvailablePromise: Promise<boolean> | null = null;

async function rawScoreDirtySchemaAvailable() {
  rawScoreDirtySchemaAvailablePromise ??= (async () => {
    try {
      const res = await restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid,score_dirty,pool_eligible&limit=1`,
        { headers: serviceHeaders() },
      );
      await res.arrayBuffer();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/pool_eligible|score_dirty|42703|does not exist/i.test(message)) {
        console.warn("raw score-dirty schema columns unavailable; falling back to legacy score scan");
        return false;
      }
      throw err;
    }
  })();
  return rawScoreDirtySchemaAvailablePromise;
}

const catalogById = new Map(CATALOG.map((sku) => [sku.id, sku]));
const effectiveSkuCache = new Map<string, Sku | null>();
const EFFECTIVE_SKU_CACHE_LIMIT = 5_000;

function isFashionCategory(category: string | null | undefined): boolean {
  return category === "clothing" || category === "shoe" || category === "bag";
}

function isFashionSkuId(skuId: string | null | undefined): boolean {
  return Boolean(skuId?.startsWith("clothing-") || skuId?.startsWith("shoe-") || skuId?.startsWith("bag-"));
}

function effectiveCatalogSkuForScorableRow(row: Pick<ScorableRawRow, "sku_id" | "name" | "description_preview">): Sku | null {
  const cacheKey = [
    row.sku_id ?? "",
    row.name ?? "",
    (row.description_preview ?? "").slice(0, 200),
  ].join("\u0001");
  if (effectiveSkuCache.has(cacheKey)) return effectiveSkuCache.get(cacheKey) ?? null;
  const stored = catalogById.get(row.sku_id ?? "") ?? null;
  let resolved: Sku | null;
  if (isFashionCategory(stored?.category) || isFashionSkuId(row.sku_id)) {
    // Wave 412: fashion broad/fallback rows are too risky to trust from stored raw sku_id.
    // Re-evaluate against the current catalog on every score parse; if the current catalog
    // rejects it, do not let stale shoe/bag/clothing sku_ids keep pool access.
    resolved = ruleMatch(row.name, row.description_preview) ?? null;
  } else {
    resolved = stored ?? ruleMatch(row.name, row.description_preview) ?? null;
  }
  if (effectiveSkuCache.size >= EFFECTIVE_SKU_CACHE_LIMIT) {
    const firstKey = effectiveSkuCache.keys().next().value;
    if (firstKey) effectiveSkuCache.delete(firstKey);
  }
  effectiveSkuCache.set(cacheKey, resolved);
  return resolved;
}

function isScorableRawCandidate(row: Pick<ScorableRawRow, "detail_status" | "sku_id" | "listing_state" | "listing_type"> & { listing_type_override?: string | null }): boolean {
  return row.detail_status === "done"
    && Boolean(row.sku_id)
    && row.listing_state === "active"
    && (row.listing_type === "normal" || row.listing_type_override === "normal");
}

const SKIP_DETAIL_DECISION: DetailQueueDecision = {
  queue: false,
  reason: "search_only_update",
  priority: 0,
  listingType: "unchanged_detail",
  skuId: null,
  skuName: null,
  purpose: "skip",
};

const DEFERRED_DETAIL_TRIAGE_DECISION: DetailQueueDecision = {
  queue: false,
  reason: "deferred_deep_crawl_triage_budget",
  priority: 0,
  listingType: "unknown",
  skuId: null,
  skuName: null,
  purpose: "skip",
};

const NON_PERSISTED_DETAIL_SKIP_REASONS = new Set([
  "search_only_update",
  "deferred_deep_crawl_triage_budget",
]);

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function incrementCount(map: Map<string, number>, keys: string[]) {
  for (const key of keys) map.set(key, (map.get(key) ?? 0) + 1);
}

function topCountTimings(prefix: string, counts: Map<string, number>, limit = 5) {
  return Object.fromEntries(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([key, count]) => [`${prefix}_${key}`, count]),
  );
}

async function upsertRows(table: string, rows: unknown[], onConflict?: string, chunkSize = REST_WRITE_CHUNK_SIZE): Promise<void> {
  if (rows.length === 0) return;
  const url = onConflict ? `${tableUrl(table)}?on_conflict=${encodeURIComponent(onConflict)}` : tableUrl(table);
  for (const chunk of chunkArray(rows, chunkSize)) {
    await restFetch(url, {
      method: "POST",
      headers: serviceHeaders("resolution=merge-duplicates"),
      body: jsonBody(chunk),
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
      body: jsonBody(chunk),
    });
  }
}

async function insertRows(table: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  for (const chunk of chunkArray(rows, REST_WRITE_CHUNK_SIZE)) {
    await restFetch(tableUrl(table), {
      method: "POST",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody(chunk),
    });
  }
}

// P2-2: observations split. Fact row first (must succeed), then payload row carrying raw_json.
// Worst-case partial failure leaves a "payload missing" record, which is acceptable — the fact row
// powers velocity/price graphs and is permanent; raw_json is only retained 90d anyway.
async function insertObservationsWithPayloads(rows: Array<Record<string, unknown>>): Promise<void> {
  if (rows.length === 0) return;
  for (const chunk of chunkArray(rows, REST_WRITE_CHUNK_SIZE)) {
    const factRows = chunk.map(({ raw_json: _raw, ...rest }) => rest);
    const url = `${tableUrl("mvp_listing_observations")}?select=id,pid,observed_at`;
    const res = await restFetch(url, {
      method: "POST",
      headers: serviceHeaders("return=representation"),
      body: jsonBody(factRows),
    });
    const inserted = (await res.json()) as Array<{ id: number; pid: number; observed_at: string }>;
    const payloadRows = inserted.map((ins, i) => ({
      observation_id: ins.id,
      pid: ins.pid,
      observed_at: ins.observed_at,
      raw_json: (chunk[i].raw_json as unknown) ?? {},
    }));
    try {
      await insertRows("mvp_listing_observation_payloads", payloadRows);
    } catch (err) {
      console.error("[obs-payload] payload insert failed; fact rows persisted without payload", err);
    }
  }
}

async function patchRows(table: string, filter: string, payload: Record<string, unknown>): Promise<void> {
  await restFetch(`${tableUrl(table)}?${filter}`, {
    method: "PATCH",
    headers: serviceHeaders("return=minimal"),
    body: jsonBody(payload),
  });
}

async function patchRowsByIds(table: string, ids: number[], payload: Record<string, unknown>, chunkSize = REST_WRITE_CHUNK_SIZE): Promise<void> {
  if (ids.length === 0) return;
  for (const chunk of chunkArray(ids, chunkSize)) {
    await patchRows(table, `pid=in.(${chunk.join(",")})`, payload);
  }
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
  await upsertRows("mvp_sellers", sellers, "source,seller_uid", SELLER_WRITE_CHUNK_SIZE);
  return sellers.length;
}

function searchSellerBizseller(row: ExistingSearchSellerRow | undefined) {
  const search = row?.source_json?.search;
  if (!search || typeof search !== "object" || Array.isArray(search)) return null;
  const value = (search as Record<string, unknown>).bizseller;
  return typeof value === "boolean" ? value : null;
}

export function shouldRefreshSearchSeller(
  row: SellerUpsertRow,
  existing: ExistingSearchSellerRow | undefined,
  nowMs = Date.now(),
  refreshMs = DEFAULT_SELLER_SEARCH_REFRESH_MS,
) {
  if (!existing) return true;
  if (existing.is_proshop !== row.is_proshop) return true;
  const bizseller = typeof row.source_json?.search === "object" && row.source_json.search && !Array.isArray(row.source_json.search)
    ? (row.source_json.search as Record<string, unknown>).bizseller
    : null;
  if (typeof bizseller === "boolean" && searchSellerBizseller(existing) !== bizseller) return true;
  const lastSeenMs = existing.last_seen_at ? new Date(existing.last_seen_at).getTime() : 0;
  if (!Number.isFinite(lastSeenMs) || lastSeenMs <= 0) return true;
  return nowMs - lastSeenMs >= refreshMs;
}

async function loadExistingSearchSellers(sellerUids: string[]): Promise<Map<string, ExistingSearchSellerRow>> {
  const unique = [...new Set(sellerUids.map((uid) => uid.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows: ExistingSearchSellerRow[] = [];
  for (const chunk of chunkArray(unique, SELLER_READ_CHUNK_SIZE)) {
    const encoded = chunk.map((uid) => encodeURIComponent(uid)).join(",");
    const url = `${tableUrl("mvp_sellers")}?select=seller_uid,is_proshop,last_seen_at,source_json&source=eq.bunjang&seller_uid=in.(${encoded})`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    rows.push(...((await res.json()) as ExistingSearchSellerRow[]));
  }
  return new Map(rows.map((row) => [row.seller_uid, row]));
}

async function upsertSearchSellerRows(rows: SellerUpsertRow[], timingsMs?: Record<string, number>, refreshMs = DEFAULT_SELLER_SEARCH_REFRESH_MS): Promise<number> {
  const bySeller = new Map<string, SellerUpsertRow>();
  for (const row of rows) {
    const uid = row.seller_uid.trim();
    if (!uid) continue;
    bySeller.set(uid, { ...row, seller_uid: uid });
  }
  const deduped = [...bySeller.values()];
  const existing = await timedSearchSubstage(
    timingsMs ?? {},
    "load_existing_sellers",
    () => loadExistingSearchSellers(deduped.map((row) => row.seller_uid)),
  );
  const nowMs = Date.now();
  const refreshRows = deduped.filter((row) => shouldRefreshSearchSeller(row, existing.get(row.seller_uid), nowMs, refreshMs));
  if (timingsMs) {
    timingsMs.seller_upsert_rows = refreshRows.length;
    timingsMs.seller_upsert_skipped_rows = deduped.length - refreshRows.length;
    timingsMs.seller_search_refresh_window_ms = refreshMs;
  }
  return upsertSellerRows(refreshRows);
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
  const failures: { key: string; reason: string; error: string }[] = [];
  for (const event of merged.values()) {
    // P0-7: enqueue 실패 시 catch로 삼키지 않고, 3회 backoff 재시도 후에도 실패하면
    // 명시적 stats/log로 운영 가시화. fallback DLQ 테이블은 P1에서 도입.
    const ok = await retryAsync(
      () => restFetch(rpcUrl("enqueue_mvp_market_key_invalidation"), {
        method: "POST",
        headers: serviceHeaders(),
        body: jsonBody({
          p_comparable_key: event.comparableKey,
          p_reason: event.reason.slice(0, 120),
          p_priority: Math.max(0, Math.round(event.priority ?? 0)),
          p_affected_pid: event.affectedPid ?? null,
          p_old_comparable_key: event.oldComparableKey ?? null,
          p_new_comparable_key: event.newComparableKey ?? null,
          p_parser_version: event.parserVersion ?? null,
        }),
      }),
      { attempts: 3, baseDelayMs: 200 },
    );
    if (ok.ok) {
      queued += 1;
    } else {
      failures.push({
        key: event.comparableKey ?? "",
        reason: event.reason.slice(0, 120),
        error: ok.error,
      });
    }
  }
  if (failures.length > 0) {
    console.error("market key invalidation enqueue failed after retries", {
      failed: failures.length,
      total: merged.size,
      sample: failures.slice(0, 3),
    });
    // 글로벌 카운터로 운영 가시화. /debug에서 읽기 위함.
    enqueueFailureState().marketInvalidationFailuresLastHour += failures.length;
    enqueueFailureState().lastMarketInvalidationFailureAt = new Date().toISOString();
  }
  return queued;
}

type EnqueueFailureState = {
  marketInvalidationFailuresLastHour: number;
  lastMarketInvalidationFailureAt: string | null;
};

function enqueueFailureState(): EnqueueFailureState {
  const g = globalThis as typeof globalThis & { __minyoiEnqueueFailures?: EnqueueFailureState };
  g.__minyoiEnqueueFailures ??= {
    marketInvalidationFailuresLastHour: 0,
    lastMarketInvalidationFailureAt: null,
  };
  return g.__minyoiEnqueueFailures;
}

export function getEnqueueFailureSnapshot(): EnqueueFailureState {
  return { ...enqueueFailureState() };
}

async function retryAsync<T>(
  fn: () => Promise<T>,
  opts: { attempts: number; baseDelayMs: number },
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  let lastErr: unknown = null;
  for (let i = 0; i < opts.attempts; i++) {
    try {
      const value = await fn();
      return { ok: true, value };
    } catch (err) {
      lastErr = err;
      if (i < opts.attempts - 1) {
        await new Promise((r) => setTimeout(r, opts.baseDelayMs * Math.pow(2, i)));
      }
    }
  }
  const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
  return { ok: false, error: message.slice(0, 240) };
}

function lifecycleDelayMs(tier: LifecyclePriorityTier, status: LifecycleStatus = "active") {
  if (status === "sold_confirmed" || status === "disappeared" || status === "archived") return 7 * 24 * 60 * 60 * 1000;
  if (status === "missing_suspect") return 2 * 60 * 60 * 1000;
  // 2026-05-15: 점검 주기 완화 (worker capacity 부족으로 backlog 14k 누적 발견).
  // - pool / near_pool: 사용자 노출 매물이라 그대로 (정확성 필수)
  // - exploration: 12h → 72h (시세 학습 후보군, 매일 점검 불필요)
  // - market_sample: 24h → 168h (시세 표본, 7일에 1번 충분)
  // - 기타 general: 48h → 168h (낮은 priority)
  // 결과: 필요 처리량 분당 35 → 분당 ~25로 감소. capacity 안에 fit.
  //
  // 2026-05-16 (사용자 코멘트 id 111 pid 408149902): "이거 팔렸는데 lifecycle 병목있나??".
  // 진단: pool tier next_check_at 60분이라 매물 sold 후 최대 60분 stale 가능.
  // lifecycle 5x throughput 적용 후 capacity 충분 (시간당 ~1,500-3,000건). pool 60분 → 15분.
  // near_pool 4h → 1h. 사용자 노출 매물 stale window 1/4로.
  if (tier === "pool") return 15 * 60 * 1000;
  if (tier === "near_pool") return 60 * 60 * 1000;
  if (tier === "exploration") return 72 * 60 * 60 * 1000;
  if (tier === "market_sample") return 7 * 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

function lifecycleNextCheckAt(tier: LifecyclePriorityTier, status: LifecycleStatus = "active") {
  return new Date(Date.now() + lifecycleDelayMs(tier, status)).toISOString();
}

// Wave launch-41: export — joongna-ingest 가 lifecycle seed 시 동일 tier 결정 로직 사용.
export function lifecycleTierForParsed(parsed: { parseConfidence?: number; needsReview?: boolean; comparableKey?: string | null }) {
  if (!parsed.comparableKey) return "general" as const;
  if (Number(parsed.parseConfidence ?? 0) >= 0.65 && !parsed.needsReview) return "market_sample" as const;
  return "exploration" as const;
}

// Wave launch-41 (사용자 짚음 "joongna 도 bunjang 처럼 lifecycle 되면 좋은거 아닌가"):
//   source 파라미터화. 이전엔 `source: "bunjang"` 하드코딩 → joongna 매물은 lifecycle_checks 에
//   영구 누락 → sold/disappeared 추적 X → 사용자에게 sold 매물 노출 신뢰 박살 risk.
//   joongna-ingest 가 detail 처리 후 이 함수 호출하면 lifecycle 추적 가능.
//   export 추가 — joongna-ingest 에서 import 사용.
export async function seedLifecycleChecks(rows: {
  pid: number;
  source?: "bunjang" | "joongna";
  priorityTier: LifecyclePriorityTier;
  nextCheckAt?: string;
}[]) {
  if (rows.length === 0) return 0;
  const now = new Date().toISOString();
  const deduped = new Map<number, { pid: number; source: "bunjang" | "joongna"; priorityTier: LifecyclePriorityTier; nextCheckAt?: string }>();
  const priorityScore: Record<LifecyclePriorityTier, number> = {
    pool: 5,
    near_pool: 4,
    exploration: 3,
    market_sample: 2,
    general: 1,
  };
  for (const row of rows) {
    const existing = deduped.get(row.pid);
    const next = { ...row, source: row.source ?? ("bunjang" as const) };
    if (!existing || priorityScore[next.priorityTier] > priorityScore[existing.priorityTier]) {
      deduped.set(row.pid, next);
    }
  }
  await insertIgnoreRows("mvp_lifecycle_checks", [...deduped.values()].map((row) => ({
    pid: row.pid,
    source: row.source,
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

async function requestTerminalLifecycleRecheck(pids: number[], now: string) {
  const unique = [...new Set(pids.filter(Number.isFinite))];
  if (unique.length === 0) return 0;
  const config = loadPipelineRuntimeConfig();
  const lastCheckedCutoff = new Date(Date.now() - config.terminalLifecycleRecheckCooldownMs).toISOString();
  const cooldownFilter = `or=(last_checked_at.is.null,last_checked_at.lt.${encodeURIComponent(lastCheckedCutoff)})`;
  const statusPatch = config.terminalLifecycleRecheckPreserveStatus
    ? {}
    : { status: "missing_suspect" };
  for (const chunk of chunkArray(unique, REST_WRITE_CHUNK_SIZE)) {
    await patchRows("mvp_lifecycle_checks", `pid=in.(${chunk.join(",")})&status=in.(sold_confirmed,disappeared,archived)&${cooldownFilter}`, {
      ...statusPatch,
      next_check_at: now,
      locked_at: null,
      locked_until: null,
      last_check_result: null,
      consecutive_error_count: 0,
      transition_confidence: 0.35,
      state_reason: "terminal_reappeared_in_search",
      updated_at: now,
    });
  }
  return unique.length;
}

function pidList(items: SearchItem[]) {
  return items.map((item) => Number(item.pid)).filter(Number.isFinite);
}

export function sourceUpdatedAtFromSearchUpdateTime(updateTime: number | null | undefined) {
  if (updateTime == null) return null;
  const n = Number(updateTime);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1_000_000_000_000 ? n : n * 1000;
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return null;
  if (date.getTime() < Date.UTC(2020, 0, 1)) return null;
  if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;
  return date.toISOString();
}

async function loadExistingRaw(pids: number[]): Promise<Map<number, RawListingRow>> {
  if (pids.length === 0) return new Map();
  // invalid pid (NaN/undefined/null) 차단 — PostgREST 400 방지
  const unique = [...new Set(pids.filter(Number.isFinite))];
  if (unique.length === 0) return new Map();
  const rows: RawListingRow[] = [];
  for (const chunk of chunkArray(unique, RAW_EXISTING_READ_CHUNK_SIZE)) {
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,price,num_faved,free_shipping,url,seller_uid,thumbnail_url,listing_type,sku_id,sku_name,detail_status,detail_enriched_at,detail_error,last_seen_at,last_changed_at,source_updated_at,listing_state,sale_status,num_comment,missing_count,last_missing_at&pid=in.(${chunk.join(",")})`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    rows.push(...((await res.json()) as RawListingRow[]));
  }
  return new Map(rows.map((row) => [row.pid, row]));
}

async function loadProtectedCandidatePoolPids(pids: number[]): Promise<Set<number>> {
  const unique = [...new Set(pids.filter(Number.isFinite))];
  if (unique.length === 0) return new Set();
  const rows: { pid: number }[] = [];
  for (const chunk of chunkArray(unique, POOL_PID_READ_CHUNK_SIZE)) {
    const res = await restFetch(`${tableUrl("mvp_candidate_pool")}?select=pid&status=in.(ready,reserved)&pid=in.(${chunk.join(",")})`, {
      headers: serviceHeaders(),
    });
    rows.push(...((await res.json()) as { pid: number }[]));
  }
  return new Set(rows.map((row) => Number(row.pid)).filter(Number.isFinite));
}

function isCurrentTitleTriageSkip(existing: RawListingRow | undefined) {
  return existing?.detail_status === "skipped" && existing.detail_error?.startsWith(`${TITLE_TRIAGE_SKIP_VERSION}:`);
}

function changedEnough(item: SearchItem, existing: RawListingRow | undefined) {
  if (!existing) return true;
  if (isCurrentTitleTriageSkip(existing)) return searchCoreChanged(item, existing);
  if (!existing.detail_enriched_at) return true;
  return searchCoreChanged(item, existing);
}

function searchCoreChanged(item: SearchItem, existing: RawListingRow | undefined) {
  if (!existing) return true;
  return (
    existing.name !== item.name ||
    existing.price !== item.price ||
    existing.num_faved !== item.numFaved ||
    existing.free_shipping !== item.freeShipping
  );
}

function sourceUpdatedAtForSearchItem(item: SearchItem, existing: RawListingRow | undefined) {
  return sourceUpdatedAtFromSearchUpdateTime(item.updateTime) ?? existing?.source_updated_at ?? null;
}

function sameInstant(a: string | null | undefined, b: string | null | undefined) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return a === b;
  return left === right;
}

function needsFullRawUpsert(item: SearchItem, existing: RawListingRow | undefined, sourceUpdatedAt: string | null) {
  if (!existing) return true;
  if (searchCoreChanged(item, existing)) return true;
  return (
    existing.url !== item.url ||
    existing.seller_uid !== item.sellerUid ||
    !sameInstant(existing.source_updated_at, sourceUpdatedAt) ||
    (!existing.thumbnail_url && Boolean(item.productImage))
  );
}

type DetailQueueDecision = {
  queue: boolean;
  reason: string;
  priority: number;
  listingType: string;
  skuId: string | null;
  skuName: string | null;
  purpose: "candidate" | "market_sample" | "exploration" | "skip";
};

const RAW_LISTING_TYPES = new Set([
  "normal",
  "counterfeit",
  "parts",
  "buying",
  "callout",
  "damaged",
  "accessory",
  "multi",
  "commercial",
  "unknown",
]);

export function rawListingTypeForStorage(value: string | null | undefined) {
  return value && RAW_LISTING_TYPES.has(value) ? value : "unknown";
}

function needsDetailRefresh(item: SearchItem, existing: RawListingRow | undefined) {
  if (!existing) return true;
  if (isCurrentTitleTriageSkip(existing)) return existing.name !== item.name;
  if (!existing.detail_enriched_at) return true;
  const detailEnrichedAt = new Date(existing.detail_enriched_at).getTime();
  const needsBuntalkBackfill =
    existing.num_comment == null &&
    Number.isFinite(detailEnrichedAt) &&
    detailEnrichedAt < BUNTALK_COUNT_FIX_DEPLOYED_AT_MS;
  if (needsBuntalkBackfill) return true;
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
  const explorationCategory = sku.category === "smartphone" || sku.category === "tablet" || sku.category === "laptop";
  const explorationBoost = explorationCategory && !existing?.detail_enriched_at ? 700 : 0;
  const priority =
    (likelyCandidate ? 1000 : 100) +
    explorationBoost +
    Math.min(500, Math.max(0, Math.round(roughGap / 1000))) +
    Math.min(300, Math.max(0, item.numFaved * 5));

  return {
    queue: true,
    reason: explorationBoost > 0 ? "exploration_title_pass" : likelyCandidate ? "candidate_title_pass" : "market_sample_title_pass",
    priority,
    listingType: titleOnly.listingType === "normal" ? "normal" : "title_sku_match",
    skuId: sku.id,
    skuName: sku.modelName,
    purpose: explorationBoost > 0 ? "exploration" : likelyCandidate ? "candidate" : "market_sample",
  };
}

function titleTriageSkipPatch(decision: DetailQueueDecision | undefined) {
  if (!decision || decision.queue || NON_PERSISTED_DETAIL_SKIP_REASONS.has(decision.reason)) return null;
  return {
    detail_status: "skipped",
    detail_error: `${TITLE_TRIAGE_SKIP_VERSION}:${decision.reason}`,
    listing_type: rawListingTypeForStorage(decision.listingType),
    sku_id: decision.skuId,
    sku_name: decision.skuName,
  };
}

function sameKoreanDate(a: string | undefined, b: string) {
  if (!a) return false;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(a)) ===
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(b));
}

export type SearchListingStateExisting = {
  listing_state?: string | null;
  missing_count?: number | null;
  last_missing_at?: string | null;
};

export function isTerminalListingState(state: string | null | undefined) {
  return TERMINAL_LISTING_STATES.has(state ?? "");
}

export function searchListingStatePatch(existing: SearchListingStateExisting | undefined) {
  if (isTerminalListingState(existing?.listing_state)) {
    return {
      listing_state: existing?.listing_state ?? "sold_confirmed",
      missing_count: existing?.missing_count ?? 0,
      last_missing_at: existing?.last_missing_at ?? null,
      terminal_preserved: true,
    };
  }

  return {
    listing_state: "active",
    missing_count: 0,
    last_missing_at: null,
    terminal_preserved: false,
  };
}

function needsActiveSearchStateReset(
  existing: RawListingRow | undefined,
  statePatch: ReturnType<typeof searchListingStatePatch>,
) {
  if (!existing) return true;
  return (
    existing.listing_state !== statePatch.listing_state ||
    (existing.missing_count ?? 0) !== (statePatch.missing_count ?? 0) ||
    (existing.last_missing_at ?? null) !== (statePatch.last_missing_at ?? null)
  );
}

export function shouldCoalesceActiveSeenOnlyTouch(
  existing: { last_seen_at?: string | null } | undefined,
  nowMs: number,
  windowMs: number,
) {
  if (!existing?.last_seen_at) return false;
  if (!Number.isFinite(nowMs) || !Number.isFinite(windowMs) || windowMs <= 0) return false;
  const lastSeenMs = new Date(existing.last_seen_at).getTime();
  if (!Number.isFinite(lastSeenMs) || lastSeenMs <= 0) return false;
  return nowMs - lastSeenMs < windowMs;
}

export function splitActiveSeenOnlyTouches(
  pids: number[],
  existing: Map<number, { last_seen_at?: string | null }>,
  nowMs: number,
  windowMs: number,
): { touchNow: number[]; skipped: number[] } {
  const touchNow: number[] = [];
  const skipped: number[] = [];
  for (const pid of pids) {
    if (shouldCoalesceActiveSeenOnlyTouch(existing.get(pid), nowMs, windowMs)) {
      skipped.push(pid);
    } else {
      touchNow.push(pid);
    }
  }
  return { touchNow, skipped };
}

export function splitActiveSeenOnlyTouchesByPoolProtection(
  pids: number[],
  existing: Map<number, { last_seen_at?: string | null }>,
  protectedPids: Set<number>,
  nowMs: number,
  protectedWindowMs: number,
  nonPoolWindowMs: number,
): { touchNow: number[]; skipped: number[]; protectedPool: number[]; nonPool: number[] } {
  const touchNow: number[] = [];
  const skipped: number[] = [];
  const protectedPool: number[] = [];
  const nonPool: number[] = [];
  for (const pid of pids) {
    const isProtected = protectedPids.has(pid);
    const windowMs = isProtected ? protectedWindowMs : nonPoolWindowMs;
    if (isProtected) protectedPool.push(pid);
    else nonPool.push(pid);
    if (shouldCoalesceActiveSeenOnlyTouch(existing.get(pid), nowMs, windowMs)) {
      skipped.push(pid);
    } else {
      touchNow.push(pid);
    }
  }
  return { touchNow, skipped, protectedPool, nonPool };
}

function observationEventType(item: SearchItem, existing: RawListingRow | undefined, now: string) {
  if (!existing) return "first_seen";
  if (existing.price !== item.price) return "price_changed";
  if (existing.name !== item.name) return "title_changed";
  if (existing.num_faved !== item.numFaved) return "faved_changed";
  if (isTerminalListingState(existing.listing_state)) return "search_seen";
  if (!sameKoreanDate(existing.last_seen_at, now)) return "daily_snapshot";
  return null;
}

function searchOptionsForMode(mode: SearchStageOptions["mode"]) {
  // Wave 78: 실측 결과 (source_updated_at 기준) 번개 진짜 cadence는 평균 4-10/min,
  // peak 11-12시도 max 32/min. 5분 cadence + 74 query → query당 5min window new ≈ 1-3건.
  // limit=96 → 50 (Wave 78) → 30 (Wave 79, tick 5분 전환 동반). 다운로드 -69%, 안전마진 6-30x.
  // env override: PIPELINE_FRESH_PAGE_LIMIT.
  const fresh = Math.max(10, Math.min(96, Number(process.env.PIPELINE_FRESH_PAGE_LIMIT ?? 30)));
  if (mode === "fresh" || mode === "deep") {
    return { order: "date" as const, limit: fresh };
  }
  return { order: "score" as const, limit: 30 };
}

function rotatedDeepPage(deepCrawlMaxPage: number, nowMs = Date.now()) {
  const maxDeep = Math.max(1, deepCrawlMaxPage);
  const tickBucket = Math.floor(nowMs / (30 * 60 * 1000));
  return 1 + (tickBucket % maxDeep);
}

function rotatedDeepQueryWindow<T>(items: T[], limit: number, nowMs = Date.now()): { items: T[]; start: number; limit: number } {
  const safeLimit = Math.max(1, Math.round(limit));
  if (items.length <= safeLimit) return { items, start: 0, limit: safeLimit };
  const tickBucket = Math.floor(nowMs / (30 * 60 * 1000));
  const start = (tickBucket * safeLimit) % items.length;
  const windowed = items.slice(start, start + safeLimit);
  if (windowed.length < safeLimit) {
    windowed.push(...items.slice(0, safeLimit - windowed.length));
  }
  return { items: windowed, start, limit: safeLimit };
}

export function rotateDeepCrawlQueriesForTest(queries: string[], limit: number, nowMs = Date.now()): string[] {
  return rotatedDeepQueryWindow(queries, limit, nowMs).items;
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
  maxQueries?: number;
};

async function timedSearchSubstage<T>(
  timingsMs: Record<string, number>,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    timingsMs[name] = (timingsMs[name] ?? 0) + Date.now() - started;
  }
}

function timedSearchBlock<T>(
  timingsMs: Record<string, number>,
  name: string,
  fn: () => T,
): T {
  const started = Date.now();
  try {
    return fn();
  } finally {
    timingsMs[name] = (timingsMs[name] ?? 0) + Date.now() - started;
  }
}

export async function searchStage(deadlineMs: number, options: SearchStageOptions = {}): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const timingsMs: Record<string, number> = {};
  stats.timingsMs = timingsMs;
  const seen = new Map<string, SearchItem>();
  const defaultPages = options.pages ?? searchPagesForTick(config.pagesPerQuery, config.deepCrawlMaxPage);
  const mode = options.mode ?? "mixed";
  // Wave 101: deep mode 일 때만 override 비활성 (deep-crawl rotation 보존).
  // tick fresh mode 호출 (runSearchScorePipeline)도 options.pages=[0] 명시지만,
  // 카테고리별 fresh hit 보강이 필요하므로 override 적용.
  const categoryPageOverrides = options.mode !== "deep"
    ? getCategoryPageOverrides()
    : {};

  // P2-1: registry 기반 cadence gate.
  // env의 PIPELINE_SEARCH_QUERIES가 source-of-truth (운영자가 query 추가/삭제는 env로).
  // registry는 query별 cadence_minutes·last_scanned_at만 관리.
  // - 새 query는 ensure로 registry에 row 자동 생성(default 5m, mode='gather').
  // - last_scanned_at + cadence_minutes 지났거나 NULL인 query만 이번 tick에 호출.
  // - 호출한 query는 tick 끝에 last_scanned_at = now() 갱신.
  // 면제: mode='deep'(deep-crawl의 강제 회전 — 일부 page를 의도적으로 다시 훑음).
  // mode='fresh'(일반 tick page 0 freshness scan)와 default(mixed)는 cadence gate 적용.
  const enforceCadence = options.mode !== "deep";
  await ensureSearchQueryRows(config.searchQueries);
  const dueQueries = enforceCadence
    ? await filterDueSearchQueries(config.searchQueries)
    : [...config.searchQueries];
  timingsMs.search_queries_total = config.searchQueries.length;
  timingsMs.search_queries_due = dueQueries.length;
  timingsMs.search_queries_skipped_by_cadence = config.searchQueries.length - dueQueries.length;
  const queryWindow = mode === "deep"
    ? rotatedDeepQueryWindow(dueQueries, config.deepCrawlQueryLimit)
    : { items: dueQueries, start: 0, limit: dueQueries.length };
  const scanQueries = options.maxQueries == null
    ? queryWindow.items
    : queryWindow.items.slice(0, Math.max(0, options.maxQueries));
  const tolerateNonCriticalWriteErrors = mode === "deep";
  async function timedOptionalSearchWrite(name: string, fn: () => Promise<void>) {
    try {
      await timedSearchSubstage(timingsMs, name, fn);
    } catch (err) {
      if (!tolerateNonCriticalWriteErrors) throw err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`deep crawl optional write failed: ${name}`, { error: message });
      timingsMs[`${name}_soft_failed`] = 1;
      timingsMs[`${name}_soft_error_len`] = message.length;
    }
  }
  if (mode === "deep") {
    timingsMs.search_queries_deep_window_start = queryWindow.start;
    timingsMs.search_queries_deep_window_limit = queryWindow.limit;
    timingsMs.search_queries_deep_window_size = scanQueries.length;
  }
  const scannedQueries: string[] = [];

  searchLoop:
  for (const query of scanQueries) {
    let pagesAttempted = false;
    const pagesForQuery = categoryPageOverrides[query] ?? defaultPages;
    for (const page of pagesForQuery) {
      if (Date.now() >= deadlineMs) {
        stats.timedOut = true;
        break searchLoop;
      }
      let items: SearchItem[] = [];
      try {
        items = await timedSearchSubstage(timingsMs, "api_fetch", () => searchPage(query, page, searchOptionsForMode(mode)));
        stats.searchSucceeded += 1;
        pagesAttempted = true;
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
      if (config.searchDelayMs > 0) {
        await timedSearchSubstage(timingsMs, "configured_delay", () => new Promise((resolve) => setTimeout(resolve, config.searchDelayMs)));
      }
    }
    if (pagesAttempted) scannedQueries.push(query);
  }

  // P2-1: 이번 tick에서 실제 번개장터에 던진 query만 last_scanned_at 갱신.
  if (enforceCadence && scannedQueries.length > 0) {
    const markResult = await markSearchQueriesScanned(scannedQueries);
    timingsMs.search_queries_mark_scanned_ok = markResult.ok;
    timingsMs.search_queries_mark_scanned_failed = markResult.failed;
    if (markResult.lastError) {
      timingsMs.search_queries_mark_scanned_error_len = markResult.lastError.length;
    }
  }
  timingsMs.search_queries_scanned = scannedQueries.length;
  timingsMs.search_queries_window_size = queryWindow.items.length;
  timingsMs.search_queries_max = options.maxQueries ?? queryWindow.items.length;
  timingsMs.search_queries_enforce_cadence = enforceCadence ? 1 : 0;

  const items = [...seen.values()];
  timingsMs.unique_items = items.length;
  const searchPids = pidList(items);
  const uniqueSearchPidCount = new Set(searchPids).size;
  timingsMs.load_existing_raw_requested_pids = searchPids.length;
  timingsMs.load_existing_raw_unique_pids = uniqueSearchPidCount;
  timingsMs.load_existing_raw_chunks = Math.ceil(uniqueSearchPidCount / RAW_EXISTING_READ_CHUNK_SIZE);
  const existing = await timedSearchSubstage(timingsMs, "load_existing_raw", () => loadExistingRaw(searchPids));
  timingsMs.load_existing_raw_returned_rows = existing.size;
  const now = new Date().toISOString();
  const detailRefreshItems = items.filter((item) => needsDetailRefresh(item, existing.get(Number(item.pid))));
  timingsMs.detail_refresh_items = detailRefreshItems.length;
  const detailDecisionItems = timedSearchBlock(timingsMs, "select_detail_decision_items", () => {
    if (mode !== "deep" || detailRefreshItems.length <= config.deepCrawlDetailTriageLimit) {
      return detailRefreshItems;
    }
    const sorted = [...detailRefreshItems].sort((a, b) => b.numFaved - a.numFaved || a.price - b.price);
    const priorityCount = Math.min(sorted.length, Math.ceil(config.deepCrawlDetailTriageLimit * 0.6));
    const priorityItems = sorted.slice(0, priorityCount);
    const tailLimit = Math.max(0, config.deepCrawlDetailTriageLimit - priorityItems.length);
    const rotatedTail = tailLimit > 0
      ? rotatedDeepQueryWindow(sorted.slice(priorityCount), tailLimit).items
      : [];
    timingsMs.deep_detail_triage_priority_rows = priorityItems.length;
    timingsMs.deep_detail_triage_rotated_rows = rotatedTail.length;
    return [...priorityItems, ...rotatedTail];
  });
  timingsMs.detail_decision_items = detailDecisionItems.length;
  if (mode === "deep") {
    timingsMs.deep_detail_triage_limit = config.deepCrawlDetailTriageLimit;
    timingsMs.deep_detail_triage_deferred_rows = Math.max(0, detailRefreshItems.length - detailDecisionItems.length);
  }
  const detailDecisions = timedSearchBlock(timingsMs, "build_detail_decisions", () => {
    const decisions = new Map(detailDecisionItems.map((item) => [item.pid, detailQueueDecision(item, existing.get(Number(item.pid)))]));
    if (mode === "deep" && detailDecisionItems.length < detailRefreshItems.length) {
      const selectedPids = new Set(detailDecisionItems.map((item) => item.pid));
      for (const item of detailRefreshItems) {
        if (!selectedPids.has(item.pid)) decisions.set(item.pid, DEFERRED_DETAIL_TRIAGE_DECISION);
      }
    }
    return decisions;
  });
  const statePatches = timedSearchBlock(timingsMs, "build_state_patches", () => new Map(
    items.map((item) => [item.pid, searchListingStatePatch(existing.get(Number(item.pid)))])
  ));
  const observationRows = timedSearchBlock(timingsMs, "build_observations", () => items.flatMap((item) => {
    const current = existing.get(Number(item.pid));
    const detailDecision = detailDecisions.get(item.pid) ?? SKIP_DETAIL_DECISION;
    const statePatch = statePatches.get(item.pid) ?? searchListingStatePatch(current);
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
      listing_state: statePatch.listing_state,
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
        terminalPreserved: statePatch.terminal_preserved,
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
  }));
  timingsMs.observation_rows = observationRows.length;

  const scoreDirtyAvailable = await rawScoreDirtySchemaAvailable();
  const rawFullUpsertRows = timedSearchBlock(timingsMs, "build_raw_upsert_rows", () => items.flatMap((item) => {
    const current = existing.get(Number(item.pid));
    const statePatch = statePatches.get(item.pid) ?? searchListingStatePatch(current);
    const sourceUpdatedAt = sourceUpdatedAtForSearchItem(item, current);
    if (!needsFullRawUpsert(item, current, sourceUpdatedAt)) return [];
    const detailDecision = detailDecisions.get(item.pid);
    const skipPatch = titleTriageSkipPatch(detailDecision);
    const resetSkippedPatch = isCurrentTitleTriageSkip(current) && detailDecision?.queue
      ? {
        detail_status: "pending",
        detail_error: null,
        listing_type: rawListingTypeForStorage(detailDecision.listingType),
        sku_id: detailDecision.skuId,
        sku_name: detailDecision.skuName,
      }
      : null;
    const detailPatch = skipPatch ?? resetSkippedPatch;
    return [{
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
        terminalPreserved: statePatch.terminal_preserved,
      },
      listing_state: statePatch.listing_state,
      missing_count: statePatch.missing_count,
      last_missing_at: statePatch.last_missing_at,
      source_updated_at: sourceUpdatedAt,
      last_seen_at: now,
      last_changed_at: searchCoreChanged(item, current) ? now : current?.last_changed_at ?? now,
      updated_at: now,
      listing_type: detailPatch?.listing_type ?? current?.listing_type ?? "unknown",
      sku_id: detailPatch?.sku_id ?? current?.sku_id ?? null,
      sku_name: detailPatch?.sku_name ?? current?.sku_name ?? null,
      detail_status: detailPatch?.detail_status ?? current?.detail_status ?? "pending",
      detail_error: detailPatch?.detail_error ?? current?.detail_error ?? null,
      ...(scoreDirtyAvailable ? { score_dirty: true } : {}),
    }];
  }));
  timingsMs.raw_full_upsert_rows = rawFullUpsertRows.length;
  await timedSearchSubstage(
    timingsMs,
    "upsert_raw_listings",
    () => upsertRows("mvp_raw_listings", rawFullUpsertRows, "pid"),
  );
  stats.rawUpserted = rawFullUpsertRows.length;

  const titleTriageSkipGroups = timedSearchBlock(timingsMs, "build_title_triage_skip_groups", () => {
    const groups = new Map<string, { payload: Record<string, unknown>; ids: number[] }>();
    for (const item of detailRefreshItems) {
      const current = existing.get(Number(item.pid));
      const sourceUpdatedAt = sourceUpdatedAtForSearchItem(item, current);
      if (needsFullRawUpsert(item, current, sourceUpdatedAt)) continue;
      const patch = titleTriageSkipPatch(detailDecisions.get(item.pid));
      if (!patch) continue;
      const key = JSON.stringify(patch);
      const group = groups.get(key) ?? { payload: patch, ids: [] as number[] };
      group.ids.push(Number(item.pid));
      groups.set(key, group);
    }
    return [...groups.values()];
  });
  timingsMs.title_triage_skip_rows = titleTriageSkipGroups.reduce((sum, group) => sum + group.ids.length, 0);
  await timedOptionalSearchWrite("patch_title_triage_skips", async () => {
    for (const group of titleTriageSkipGroups) {
      await patchRowsByIds("mvp_raw_listings", group.ids, {
        ...group.payload,
        updated_at: now,
      }, RAW_TOUCH_WRITE_CHUNK_SIZE);
    }
  });

  // 2026-05-19 P1-F-Fix-1: title-triage skipped pid도 lifecycle seed.
  //   배경: SKU 매칭 실패한 매물(detail_status='skipped')은 이전엔 mvp_lifecycle_checks에
  //   영구 안 박혀서 sold polling 대상에서 영구 제외 → 신발/의류/가방 sold 검출 1~5% 머묾.
  //   - 신발 4222 skipped 매물 중 4208건(99.7%)이 lifecycle 영구 누락
  //   - 의류 100%, 가방 98.6% 동일
  //   해결: general tier (가장 낮은 우선순위, 긴 cooldown)로 seed. polling 비용 최소화.
  //   insertIgnoreRows 라 기존 pid는 중복 X. SKU 매칭 후속 진행은 별개 (mining wave 후속).
  //   자세한 진단: docs/DECISIONS/2026-05-19-p1-velocity-condition-confidence-sold-detection.md
  const skippedPids = titleTriageSkipGroups.flatMap((group) => group.ids);
  if (skippedPids.length > 0) {
    await timedOptionalSearchWrite("seed_lifecycle_for_skipped", async () => {
      const seeded = await seedLifecycleChecks(
        skippedPids.map((pid) => ({ pid, priorityTier: "general" as const })),
      );
      timingsMs.skipped_lifecycle_seeded = seeded;
    });
  }

  const rawTouchGroups = timedSearchBlock(timingsMs, "build_raw_touch_groups", () => {
    const activeSeenOnly: number[] = [];
    const activeStateReset: number[] = [];
    const terminal: number[] = [];
    for (const item of items) {
      const current = existing.get(Number(item.pid));
      const sourceUpdatedAt = sourceUpdatedAtForSearchItem(item, current);
      if (needsFullRawUpsert(item, current, sourceUpdatedAt)) continue;
      const statePatch = statePatches.get(item.pid) ?? searchListingStatePatch(current);
      if (statePatch.terminal_preserved) terminal.push(Number(item.pid));
      else if (needsActiveSearchStateReset(current, statePatch)) activeStateReset.push(Number(item.pid));
      else activeSeenOnly.push(Number(item.pid));
    }
    return { activeSeenOnly, activeStateReset, terminal };
  });
  timingsMs.raw_touch_active_seen_rows = rawTouchGroups.activeSeenOnly.length;
  timingsMs.raw_touch_active_reset_rows = rawTouchGroups.activeStateReset.length;
  timingsMs.raw_touch_active_rows = rawTouchGroups.activeSeenOnly.length + rawTouchGroups.activeStateReset.length;
  timingsMs.raw_touch_terminal_rows = rawTouchGroups.terminal.length;
  let activeSeenOnlyTouchNow = rawTouchGroups.activeSeenOnly;
  if (config.rawTouchCoalesceActiveSeenOnly || config.rawTouchCoalesceActiveSeenOnlyDryRun) {
    const useNonPoolWindow =
      config.rawTouchCoalesceActiveSeenOnlyNonPoolWindowMs > config.rawTouchCoalesceActiveSeenOnlyWindowMs;
    let poolProtectedRows = 0;
    let nonPoolRows = rawTouchGroups.activeSeenOnly.length;
    let touchSplit: { touchNow: number[]; skipped: number[] };
    if (useNonPoolWindow) {
      const splitByPool = splitActiveSeenOnlyTouchesByPoolProtection(
          rawTouchGroups.activeSeenOnly,
          existing,
          await timedSearchSubstage(
            timingsMs,
            "load_protected_candidate_pool_pids",
            () => loadProtectedCandidatePoolPids(rawTouchGroups.activeSeenOnly),
          ),
          Date.parse(now),
          config.rawTouchCoalesceActiveSeenOnlyWindowMs,
          config.rawTouchCoalesceActiveSeenOnlyNonPoolWindowMs,
        );
      poolProtectedRows = splitByPool.protectedPool.length;
      nonPoolRows = splitByPool.nonPool.length;
      touchSplit = splitByPool;
    } else {
      touchSplit = splitActiveSeenOnlyTouches(
        rawTouchGroups.activeSeenOnly,
        existing,
        Date.parse(now),
        config.rawTouchCoalesceActiveSeenOnlyWindowMs,
      );
    }
    if (config.rawTouchCoalesceActiveSeenOnly) {
      activeSeenOnlyTouchNow = touchSplit.touchNow;
    }
    timingsMs.raw_touch_active_seen_coalesce_eligible_rows = rawTouchGroups.activeSeenOnly.length;
    timingsMs.raw_touch_active_seen_coalesce_would_skip_rows = touchSplit.skipped.length;
    timingsMs.raw_touch_active_seen_coalesce_skipped_rows = config.rawTouchCoalesceActiveSeenOnly ? touchSplit.skipped.length : 0;
    timingsMs.raw_touch_active_seen_coalesce_touch_now_rows = activeSeenOnlyTouchNow.length;
    timingsMs.raw_touch_active_seen_coalesce_protected_rows = rawTouchGroups.activeStateReset.length + rawTouchGroups.terminal.length;
    timingsMs.raw_touch_active_seen_coalesce_window_ms = config.rawTouchCoalesceActiveSeenOnlyWindowMs;
    timingsMs.raw_touch_active_seen_coalesce_non_pool_window_ms = config.rawTouchCoalesceActiveSeenOnlyNonPoolWindowMs;
    timingsMs.raw_touch_active_seen_coalesce_pool_protected_rows = poolProtectedRows;
    timingsMs.raw_touch_active_seen_coalesce_non_pool_rows = nonPoolRows;
    timingsMs.raw_touch_active_seen_coalesce_enabled = config.rawTouchCoalesceActiveSeenOnly ? 1 : 0;
  }
  await timedOptionalSearchWrite("touch_raw_listings", async () => {
    await patchRowsByIds("mvp_raw_listings", activeSeenOnlyTouchNow, {
      last_seen_at: now,
    }, RAW_TOUCH_WRITE_CHUNK_SIZE);
    await patchRowsByIds("mvp_raw_listings", rawTouchGroups.activeStateReset, {
      listing_state: "active",
      missing_count: 0,
      last_missing_at: null,
      last_seen_at: now,
      updated_at: now,
    }, RAW_TOUCH_WRITE_CHUNK_SIZE);
    await patchRowsByIds("mvp_raw_listings", rawTouchGroups.terminal, {
      last_seen_at: now,
    }, RAW_TOUCH_WRITE_CHUNK_SIZE);
  });
  await timedOptionalSearchWrite("request_terminal_lifecycle_recheck", async () => {
    await requestTerminalLifecycleRecheck(
      items
        .filter((item) => statePatches.get(item.pid)?.terminal_preserved)
        .map((item) => Number(item.pid))
        .filter(Number.isFinite),
      now,
    );
  });
  await timedSearchSubstage(timingsMs, "insert_observations", () => insertObservationsWithPayloads(observationRows));
  const searchSellerRows = items.flatMap((item) => {
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
  });
  timingsMs.seller_seen_rows = searchSellerRows.length;
  stats.sellerUpserted += await timedSearchSubstage(timingsMs, "upsert_sellers", () => upsertSearchSellerRows(searchSellerRows, timingsMs, config.sellerSearchRefreshMs));

  const changedItems = items.filter((item) => changedEnough(item, existing.get(Number(item.pid))));
  timingsMs.changed_items = changedItems.length;
  const marketChangedItems = changedItems.filter((item) => {
    const current = existing.get(Number(item.pid));
    return Boolean(current && (current.price !== item.price || current.name !== item.name));
  });
  timingsMs.market_changed_items = marketChangedItems.length;
  const changedParsedByPid = await timedSearchSubstage(
    timingsMs,
    "load_changed_parsed_rows",
    () => loadParsedRows(marketChangedItems.map((item) => Number(item.pid)).filter(Number.isFinite)),
  );
  const marketInvalidations = timedSearchBlock(timingsMs, "build_market_invalidations", () => marketChangedItems.flatMap((item) => {
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
  }));
  timingsMs.market_invalidations = marketInvalidations.length;
  stats.upserted += await timedSearchSubstage(timingsMs, "enqueue_market_invalidations", () => enqueueMarketKeyInvalidations(marketInvalidations));

  const queueItems = changedItems.filter((item) => detailDecisions.get(item.pid)?.queue);
  await timedSearchSubstage(timingsMs, "insert_detail_queue", () => insertIgnoreRows("mvp_detail_queue", queueItems.map((item) => ({
    pid: Number(item.pid),
    status: "pending",
    priority: detailDecisions.get(item.pid)?.priority ?? item.numFaved,
    available_at: now,
    locked_at: null,
    locked_until: null,
    last_error: null,
    updated_at: now,
  })), "pid"));
  stats.queued = queueItems.length;
  stats.detailQueueSkipped = changedItems.length - queueItems.length;

  return stats;
}

async function claimDetailQueue(): Promise<QueueClaimRow[]> {
  const config = loadPipelineRuntimeConfig();
  // 2026-05-16: Bunjang rate limit probe 시나리오 A 결과 (lifecycle 5x 성공) → detail-worker도 같은 패턴.
  // detail queue 10,224 pending (Iteration 2 발견). batch 20 → 400 hardcode.
  // 2026-05-16 (Wave 135): batch 400 실측 25-27s / maxDuration 90s 28% 사용 = 여유 3배.
  // 800 + c=15로 step up. 시간당 8,000 → 16,000 calls. 신발 reset 4,025건 15분 안 해소.
  // 2026-05-16 v46: env override (TICK_DETAIL_BATCH) — 운영자 throttle 가능. default 800 유지.
  const DETAIL_BATCH_HARDCODE = boundedInt(process.env.TICK_DETAIL_BATCH ?? null, 800, 50, 2000);
  const res = await restFetch(rpcUrl("claim_mvp_detail_queue"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({
      p_batch_size: DETAIL_BATCH_HARDCODE,
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

// 2026-05-17 v46 cleanup: exponential backoff — 영구 실패 매물 (잠긴 매물 등) 매 5분 재시도 waste 차단.
// attempts 는 claim_mvp_detail_queue RPC 가 자동 +1 박음. failed && attempts < max_attempts 시 재시도.
// max_attempts=3 default 라 attempts=3 도달하면 RPC 가 자연 차단 — backoff 는 attempts 1~max 사이 매물에 적용.
const RETRY_BACKOFF_MIN: Record<number, number> = { 1: 5, 2: 15, 3: 60 };
async function markQueueFailed(queueId: string, error: string, attempts: number = 1) {
  const minutes = RETRY_BACKOFF_MIN[attempts] ?? 60;
  await patchRows("mvp_detail_queue", `id=eq.${encodeURIComponent(queueId)}`, {
    status: "failed",
    locked_until: null,
    available_at: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
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

    // 2026-05-16: lifecycle 5x 성공 패턴 detail-worker에도 적용. queue 10,224 pending → 5x throughput.
    // sequential for → Promise.all wave concurrency 10. probe 시나리오 A로 c=10 안전 검증됨.
    // 2026-05-16 (Wave 135): c=10 → 15. probe c=20까지 OK (329 req/s + 429 0건). c=15는 안전 마진 큼.
    // 2026-05-16 v46: env override (TICK_DETAIL_CONCURRENCY) — 운영자 throttle 가능. default 15.
    const DETAIL_CONCURRENCY = boundedInt(process.env.TICK_DETAIL_CONCURRENCY ?? null, 15, 1, 30);
    let detailDeadlineHit = false;
    for (let waveStart = 0; waveStart < claims.length; waveStart += DETAIL_CONCURRENCY) {
      if (Date.now() >= deadlineMs) {
        detailDeadlineHit = true;
        break;
      }
      const wave = claims.slice(waveStart, waveStart + DETAIL_CONCURRENCY);
      await Promise.all(wave.map(async (claim) => {
      try {
        const detail = await fetchDetail(String(claim.pid));
        if (config.detailDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, config.detailDelayMs));
        if (!detail) {
          stats.detailFailed += 1;
          await markQueueFailed(claim.queue_id, "detail api returned null", claim.attempts);
          return;
        }
        const soldSignals = detectSoldOut(detail, claim.price, { title: claim.name });
        if (hasStrongSoldOutSignal(soldSignals)) {
          const now = new Date().toISOString();
          // 2026-05-16 v46: sold-out 처리 5 sequential round → Promise.all parallel + queue done sequential.
          // 4 round → 2 round. 800 매물 batch 의 sold ~5-10% (40-80건) 처리 latency 절감.
          // ordering 안전: 4 작업 서로 다른 table — race condition 없음. queue done 만 마지막 (다 끝나야 retry 차단).
          await Promise.all([
            patchRows("mvp_raw_listings", `pid=eq.${claim.pid}`, {
              description_preview: detail.description.slice(0, 500),
              sale_status: detail.saleStatus,
              trade_data: detail.tradeData,
              trades_data: detail.tradesData,
              image_url_template: detail.imageUrlTemplate,
              image_count: detail.imageCount,
              thumbnail_url: detail.thumbnailUrl,
              seller_uid: detail.shopUid,
              seller_source: "bunjang",
              listing_state: "sold_confirmed",
              sold_detected_at: now,
              // Wave 132 (2026-05-16): sold-out 매물도 num_comment 박음 (시세 sample 분석 시 활용).
              num_comment: detail.commentCount ?? null,
              // Wave 137: sold-out 매물도 qty 박음 (대량 판매업자 분석).
              qty: detail.qty ?? null,
              // Wave 138b: sold-out 매물도 description hash (다중 ID 분석).
              description_hash: computeDescriptionHash(detail.description),
              // Wave 140: sold-out 매물도 bunjang condition label 저장.
              bunjang_condition_label: detail.conditionLabel ?? null,
              detail_status: "done",
              detail_enriched_at: now,
              detail_error: null,
              updated_at: now,
            }),
            insertObservationsWithPayloads([{
              pid: Number(claim.pid),
              observed_at: now,
              event_type: "state_changed",
              price: claim.price,
              name: claim.name,
              num_faved: claim.num_faved,
              sale_status: detail.saleStatus,
              listing_state: "sold_confirmed",
              seller_uid: detail.shopUid,
              source: "tick_detail",
              raw_json: {
                sold_signals: soldSignals,
                reason: "detail_stage_strong_sold_signal",
              },
            }]),
            patchLifecycle(Number(claim.pid), {
              status: "sold_confirmed",
              last_checked_at: now,
              last_check_result: "sold",
              consecutive_missing_count: 0,
              consecutive_error_count: 0,
              next_check_at: lifecycleNextCheckAt("general", "sold_confirmed"),
              last_error: null,
              detail_status_code: 200,
              transition_confidence: 0.95,
              state_reason: `detail_stage_${describeSignals(soldSignals)}`,
            }).catch(() => undefined),
            invalidatePoolEntries([{ pid: Number(claim.pid), reason: `detail_stage_${describeSignals(soldSignals)}` }]),
          ]);
          await markQueueDone(claim.queue_id);
          stats.enriched += 1;
          stats.poolSkipped += 1;
          return;
        }
        const { listingType, sku } = classifyListing(claim.name, detail.description, claim.price);
        const storageListingType = rawListingTypeForStorage(listingType);
        const parsed = parseListingOptions({
          title: claim.name,
          description: detail.description,
          skuId: sku?.id ?? null,
          skuName: sku?.modelName ?? null,
          category: sku?.category ?? null,
          // Wave 140: 번개 detail 의 product.condition (셀러 명시) → parser condition_class strong override.
          bunjangConditionLabel: detail.conditionLabel ?? null,
          // 2026-05-16: 번개 detail의 product.condition (셀러 명시) → parser condition_class strong override.
          // Wave 236d (2026-05-19): catalog defaultProductType — narrow model SKU 만 박힘 (fallback OK).
          defaultProductType: sku?.defaultProductType ?? null,
        });
        const existingParsed = existingParsedByPid.get(Number(claim.pid));
        const now = new Date().toISOString();
        const scoreDirtyAvailable = await rawScoreDirtySchemaAvailable();
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
          seller_source: "bunjang",
          listing_type: storageListingType,
          sku_id: sku?.id ?? null,
          sku_name: sku?.modelName ?? null,
          // Wave 132 (2026-05-16): detail API의 commentCount를 persistent column에 저장.
          // 사업 정책: 댓글 >= 8 = 흥정/호가 괴리 → pool 진입 차단 (candidate-pool-builder gate).
          num_comment: detail.commentCount ?? null,
          // Wave 137 (2026-05-16): 수량 — qty > 1 = 대량 판매업자 (1:1 거래 X) → pool 진입 차단.
          qty: detail.qty ?? null,
          // Wave 138b (2026-05-16): description hash — 다중 ID 사기 그룹 탐지.
          description_hash: computeDescriptionHash(detail.description),
          // Wave 140 (2026-05-16 사용자 코멘트 #122): 번개 detail의 product.condition 저장. parser condition_class weight.
          bunjang_condition_label: detail.conditionLabel ?? null,
          detail_status: "done",
          detail_enriched_at: now,
          detail_error: null,
          updated_at: now,
          ...(scoreDirtyAvailable ? { score_dirty: true } : {}),
          // Wave 778: bunjang detail 완료 + normal 분류 + sku 매칭 → pool_eligible 즉시 true.
          //   이전: joongna-ingest 만 pool_eligible=true 박았고 bunjang 누락 → ready 카테고리 매물 stuck.
          //   Wave 778 RPC backfill 20,969건 발견 = source-level miss 본질.
          //   non-normal 분류 시 아래 invalidatePoolEntries 가 candidate_pool 에서 제거하므로 안전.
          ...(storageListingType === "normal" && sku?.id ? { pool_eligible: true } : {}),
        });
        // pool에 이미 들어간 매물이면 last_verified_at 갱신 → pack-open에서 재verify 안 함
        // (cron이 이미 fetchDetail + sold-out 체크 완료한 사실을 pool에 반영)
        await patchRows("mvp_candidate_pool", `pid=eq.${claim.pid}`, {
          last_verified_at: now,
        }).catch(() => undefined);
        // Wave 159e (2026-05-17): 재분류 결과 listing_type 이 normal 이 아니면 candidate_pool 에서 invalidate.
        // 이전: detail-worker 가 listing_type=multi/accessory/... 로 재분류해도 풀 그대로 남음. (운영자 코멘트 pid 364899054 다중상품인데 ready 풀에 있음.)
        // 운영자 override='normal' 이 박혀있으면 invalidate skip (override 의도 보존).
        if (storageListingType !== "normal") {
          const overrideRow = await restFetch(
            `${tableUrl("mvp_raw_listings")}?select=listing_type_override&pid=eq.${claim.pid}&limit=1`,
            { headers: serviceHeaders() },
          ).then((r) => r.ok ? r.json() as Promise<Array<{ listing_type_override: string | null }>> : Promise.resolve([]))
            .catch(() => [] as Array<{ listing_type_override: string | null }>);
          const overrideValue = overrideRow[0]?.listing_type_override ?? null;
          if (overrideValue !== "normal") {
            await invalidatePoolEntries([{ pid: Number(claim.pid), reason: `reclassified_${storageListingType}` }]).catch(() => undefined);
          }
        }
        try {
          if (detail.shopUid) {
            stats.sellerUpserted += await upsertSellerRows([{
              source: "bunjang",
              seller_uid: detail.shopUid,
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
          // Wave 257 (2026-05-20): ARCHITECTURE FLIP — AI default + regex whitelist fast-path.
          //
          // 사용자 근원적 지적 (정확):
          //   "그럼 우린 진짜 이런 정규식이면 100% 이런 의미다 이런 단어나 콜로케이션 조합이면
          //   100%이거다 확신이 없는 기출 변형들은? 다 AI한테 해야되는거 아닌가?"
          //
          // 기존 (Wave 141B + Wave 256 5 trigger): regex 가 confident "normal" / "flawed" 박은 후
          //   일부 case 만 AI escalation → 사용자가 든 "기스 진심 없" 같은 변형 regex 가 못 잡으면
          //   AI 안 거치고 confident normal 박힘. **사용자 의도 정반대.**
          //
          // 새 (Wave 257): regex 자신감 = whitelist (셀러 명시 명백 case) 만. 그 외 모든
          //   자연어 description → AI default. 사용자 명시 "종합 whitelist".
          //
          // 실측 baseline: 일 ~8,000 detail parse / 현재 750 AI calls (~9%).
          // Wave 257 예상: AI 호출 ~3,500-5,000/day (whitelist 미통과 50-60%).
          // 월 비용 ~$15-25 (cache hit ~50% 적용).
          const text = `${claim.name ?? ""}\n${(detail.description ?? "").slice(0, 1200)}`.toLowerCase();
          const bunjangLabelMapped = bunjangLabelToConditionClass(detail.conditionLabel);

          // === regex whitelist (fast-path — AI skip 가능 case) ===
          const fastPathReasons: string[] = [];

          // 1. bunjang label 명시 (셀러 직접 선택 — 100% 신뢰)
          //    NEW/DAMAGED/HEAVILY_USED/LIKE_NEW/LIGHTLY_USED/USED 영어 enum + 한글 fallback.
          if (bunjangLabelMapped !== null) {
            fastPathReasons.push("bunjang_label_explicit");
          }

          // 2. 박스 미개봉 명시 + battery measurement 모순 없음 (Wave 203 정책 — 객관적 모순 차단)
          //    "미개봉" 인데 battery 측정값 있으면 거짓 → 이 fast-path 빠짐 → AI default.
          const hasExplicitUnopened = /미개봉|단순개봉|박스\s*(?:미개봉|새상품)|포장\s*(?:미개봉|안\s*뜯|안뜯)|개봉\s*(?:안\s*함|안함)|뜯지\s*않은|언박싱\s*전|brand\s*new|미\s*뜯/.test(text);
          const noMeasurement = (parsed.batteryHealth === null || parsed.batteryHealth === 0) &&
                                 (parsed.batteryCycles === null || parsed.batteryCycles === 0);
          if (hasExplicitUnopened && noMeasurement) {
            fastPathReasons.push("explicit_unopened_no_measurement");
          }

          // 3. 공식 리퍼 명시 (Wave 205 정책 — 공식 리퍼 = 정상 작동)
          if (/(?:공식\s*리퍼|애플\s*리퍼|apple\s*refurbished|factory\s*refurbished|리퍼\s*폰?\s*미개봉|리퍼\s*박스\s*미개봉)/.test(text)) {
            fastPathReasons.push("explicit_factory_refurbished");
          }

          // 4. 명백 reject 신호 (regex 가 잡은 strong negative — FLAWED 확정. 변형 risk 적음)
          //    이 notes 는 regex 가 strict 패턴 + negation 처리 다 거친 결과 → 신뢰 가능.
          const strongFlawedNotes = ["display_defect", "screen_replaced", "faceid_issue", "water_damage",
            "parts_only", "locked_or_lost_signal", "refurbished_or_repaired", "buying_post",
            "single_side_only", "accessory_compatible_for_other_product", "multi_device_bundle"];
          const hasStrongFlawedNote = parsed.conditionNotes.some((n) => strongFlawedNotes.includes(n));
          if (hasStrongFlawedNote) {
            fastPathReasons.push("strong_flawed_note_regex_confident");
          }

          // 5. 객관적 battery measurement 강한 신호 (Wave 209 — 셀러 자연어보다 강함)
          //    95%+ : positive 명확. <85% : low_batt 명확.
          const hasObjBatteryHigh = parsed.batteryHealth !== null && parsed.batteryHealth >= 95;
          const hasObjBatteryLow = parsed.batteryHealth !== null && parsed.batteryHealth < 85;
          if (hasObjBatteryHigh || hasObjBatteryLow) {
            fastPathReasons.push("objective_battery_signal");
          }

          // 6. description 너무 짧음 (AI 호출해도 정보 부족 — 비용 낭비 차단)
          const descLength = (detail.description ?? "").trim().length;
          if (descLength < 20) {
            fastPathReasons.push("description_too_short");
          }

          // === AI default — whitelist 미통과 시 자연어 description 무조건 AI ===
          const shouldEscalateToAi = fastPathReasons.length === 0;

          if (shouldEscalateToAi) {
            const aiClass = await classifyConditionWithAi(Number(claim.pid), claim.name, detail.description).catch(() => null);
            if (aiClass) {
              parsed.conditionClass = aiClass;
              // Wave 257: AI default 호출 기록 — 운영자 추적 + 비용 측정.
              (parsed.parsedJson as Record<string, unknown>).ai_default_invoked = true;
              (parsed.parsedJson as Record<string, unknown>).ai_default_class = aiClass;
              (parsed.parsedJson as Record<string, unknown>).ai_default_reason = "whitelist_miss";
            } else {
              // AI fail (network/budget/rate-limit) — regex 결과 그대로 유지. 운영자 추적용 기록.
              (parsed.parsedJson as Record<string, unknown>).ai_default_invoked = true;
              (parsed.parsedJson as Record<string, unknown>).ai_default_failed = true;
            }
          } else {
            // fast-path 통과 — regex 자신감 case. AI skip + 사유 기록 (운영자 audit).
            (parsed.parsedJson as Record<string, unknown>).ai_skipped = true;
            (parsed.parsedJson as Record<string, unknown>).ai_skipped_reasons = fastPathReasons;
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
          await insertObservationsWithPayloads([{
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
        } catch (err) {
          // observations/invalidations은 best-effort. 실패해도 queue는 진행.
          console.error("option parse side-write failed", err);
        }
        // Wave 92 root fix: seedLifecycleChecks는 critical. 이전엔 위 try/catch 안에 있어서
        // 실패가 swallow되고 markQueueDone이 진행 → 영구 lifecycle 누락 (사용자 코멘트로 발견,
        // pid 407321422). seed를 try 밖으로 빼서 실패 시 outer catch (markQueueFailed) 진입 →
        // 다음 tick에 detail 재시도 보장.
        await seedLifecycleChecks([{
          pid: Number(claim.pid),
          priorityTier: lifecycleTierForParsed(parsed),
        }]);
        await markQueueDone(claim.queue_id);
        stats.enriched += 1;
      } catch (err) {
        stats.detailFailed += 1;
        await markQueueFailed(claim.queue_id, err instanceof Error ? err.message : String(err), claim.attempts);
      }
      })); // Promise.all wave 닫기
    } // outer for waveStart loop 닫기
    if (detailDeadlineHit) {
      stats.timedOut = true;
    }
    stats.upserted += await enqueueMarketKeyInvalidations(marketInvalidations);
  }

  if (Date.now() >= deadlineMs - DETAIL_STAGE_SAFETY_MARGIN_MS) {
    stats.timedOut = true;
  }

  return stats;
}

// P0-5: loadScorableRows를 event-driven으로 바꾸면서 더 이상 사용 안 함.
// (이전엔 limit*4 후보 중 unscored 우선 정렬에 쓰였으나, 이제 score_dirty=true 필터로 대체됨.)

async function loadExistingScoreOutputs(pids: number[]): Promise<{
  listings: Map<number, Record<string, unknown>>;
  analyses: Map<number, Record<string, unknown>>;
}> {
  const unique = [...new Set(pids.filter(Number.isFinite))];
  const listings = new Map<number, Record<string, unknown>>();
  const analyses = new Map<number, Record<string, unknown>>();
  if (unique.length === 0) return { listings, analyses };

  const listingColumns = [
    "pid",
    "url",
    "name",
    "price",
    "sku_name",
    "sku_median",
    "description_preview",
    "image_url_template",
    "image_count",
    "thumbnail_url",
    "shipping_fee",
    "shipping_fee_general",
    "shipping_source",
    "estimated_buy_cost",
    "gross_resell_gap",
    "net_gap_after_shipping",
  ].join(",");
  const analysisColumns = [
    "pid",
    "price_gap",
    "num_faved",
    "velocity",
    "review_rating",
    "review_count",
    "safety",
    "risk_hits",
    "score",
    "score_flags",
    "candidate_rank",
  ].join(",");

  for (const chunk of chunkArray(unique, REST_READ_CHUNK_SIZE)) {
    const pidFilter = chunk.join(",");
    const [listingRes, analysisRes] = await Promise.all([
      restFetch(`${tableUrl("mvp_listings")}?select=${listingColumns}&pid=in.(${pidFilter})`, { headers: serviceHeaders() }),
      restFetch(`${tableUrl("mvp_listing_analysis")}?select=${analysisColumns}&pid=in.(${pidFilter})`, { headers: serviceHeaders() }),
    ]);
    const listingRows = (await listingRes.json()) as Record<string, unknown>[];
    const analysisRows = (await analysisRes.json()) as Record<string, unknown>[];
    for (const row of listingRows) listings.set(Number(row.pid), row);
    for (const row of analysisRows) analyses.set(Number(row.pid), row);
  }

  return { listings, analyses };
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

function scoreStageScope(row: Pick<ScorableRawRow, "pid" | "source">, options: ScoreStageOptions): boolean {
  const source = normalizeMarketplaceSource(row.source);
  if (options.sourceFilter && source !== options.sourceFilter) return false;

  const shardCount = Math.max(1, Math.floor(Number(options.daangnShardCount ?? 1)));
  if (source === "daangn" && shardCount > 1) {
    const shardIndex = Math.max(0, Math.min(shardCount - 1, Math.floor(Number(options.daangnShardIndex ?? 0))));
    const pid = Number(row.pid);
    if (!Number.isFinite(pid)) return false;
    return positiveModulo(pid, shardCount) === shardIndex;
  }

  return true;
}

async function loadScorableRows(limit: number, options: ScoreStageOptions = {}): Promise<ScorableRawRow[]> {
  // P0-5: event-driven score. score_dirty=true인 row만 처리한다.
  // search touch만 발생한 row(변경 없음)는 dirty 안 됨 → score 재계산 안 함.
  // raw upsert / detail enrichment / market invalidation 시점에 dirty=true로 마킹.
  const scoreDirtyAvailable = await rawScoreDirtySchemaAvailable();
  // Wave 132: num_comment 추가 — candidate-pool-builder가 >= 8 차단.
  // Wave 217 (2026-05-19): bunjang_condition_label 추가 — parseFashionMobility 가 metadata 활용.
  const baseColumns = "pid,source,query,name,price,num_faved,free_shipping,url,description_preview,shop_review_rating,shop_review_count,trade_data,trades_data,image_url_template,image_count,thumbnail_url,sku_id,sku_name,detail_status,listing_type,listing_type_override,listing_state,sale_status,num_comment,qty,description_hash,bunjang_condition_label,raw_json,daangn_manner_temperature,last_seen_at";
  const columns = scoreDirtyAvailable ? `${baseColumns},pool_eligible` : baseColumns;
  const dirtyFilter = scoreDirtyAvailable ? "&score_dirty=eq.true" : "";
  const sourceFilter = options.sourceFilter ? `&source=eq.${options.sourceFilter}` : "";
  const baseFilter = `${dirtyFilter}${sourceFilter}`;
  const scorableBaseFilter = `${dirtyFilter}${sourceFilter}&detail_status=eq.done&sku_id=not.is.null&listing_state=eq.active`;
  const buildUrl = (extraFilter: string, rowLimit: number) =>
    `${tableUrl("mvp_raw_listings")}?select=${columns}${baseFilter}${extraFilter}&order=last_seen_at.desc&limit=${rowLimit}`;
  const buildDirtyScorableUrl = (extraFilter: string, rowLimit: number) =>
    `${tableUrl("mvp_raw_listings")}?select=${columns}${scorableBaseFilter}${extraFilter}&order=last_seen_at.desc&limit=${rowLimit}`;
  const fetchScorableRows = async (extraFilter: string, rowLimit: number, seenPids = new Set<number>()) => {
    const rows: ScorableRawRow[] = [];
    const scanLimit = scoreDirtyAvailable
      ? Math.max(rowLimit, Math.min(1000, Math.max(200, rowLimit * 20)))
      : rowLimit;
    const collect = (batch: ScorableRawRow[]) => {
      for (const row of batch) {
        if (scoreDirtyAvailable && !isScorableRawCandidate(row)) continue;
        if (!scoreStageScope(row, options)) continue;
        const pid = Number(row.pid);
        if (!Number.isFinite(pid) || seenPids.has(pid)) continue;
        seenPids.add(pid);
        rows.push(row);
        if (rows.length >= rowLimit) break;
      }
    };

    if (scoreDirtyAvailable) {
      // Daangn firehose can leave many dirty search-only rows. Push the cheap
      // scorable predicates into Postgres so the worker does not sort/fetch
      // rows that JS will immediately throw away.
      //
      // Keep listing_type and listing_type_override as two narrow predicates
      // instead of one PostgREST OR. Under Daangn backlog pressure the OR path
      // has intermittently hit statement_timeout on the primary score worker,
      // while each typed predicate stays index-friendly and cheap.
      for (const listingTypeFilter of ["&listing_type=eq.normal", "&listing_type_override=eq.normal"]) {
        if (rows.length >= rowLimit) break;
        const dirtyRes = await restFetch(buildDirtyScorableUrl(`${extraFilter}${listingTypeFilter}`, scanLimit), { headers: serviceHeaders() });
        collect((await dirtyRes.json()) as ScorableRawRow[]);
      }
    } else {
      const normalRes = await restFetch(buildUrl(`${extraFilter}&detail_status=eq.done&sku_id=not.is.null&listing_state=eq.active&listing_type=eq.normal`, rowLimit), { headers: serviceHeaders() });
      collect((await normalRes.json()) as ScorableRawRow[]);

      const remaining = Math.max(0, rowLimit - rows.length);
      if (remaining > 0) {
        const overrideRes = await restFetch(buildUrl(`${extraFilter}&detail_status=eq.done&sku_id=not.is.null&listing_state=eq.active&listing_type_override=eq.normal`, remaining), { headers: serviceHeaders() });
        collect((await overrideRes.json()) as ScorableRawRow[]);
      }
    }

    return rows.slice(0, rowLimit);
  };

  if (!scoreDirtyAvailable) {
    return fetchScorableRows("", limit);
  }

  // Market/parser recovery can mark old pool rows dirty. If we only order by
  // raw last_seen_at, visible or newly recovered candidates can sit behind a
  // large fresh-dirty backlog while showing stale profit math.
  const poolRows = await loadDirtyPoolScorableRows(columns, scorableBaseFilter, Math.min(limit, 50));
  const seenPids = new Set(poolRows.map((row) => Number(row.pid)).filter(Number.isFinite));
  const remainingAfterPool = Math.max(0, limit - poolRows.length);
  if (remainingAfterPool === 0) return poolRows.slice(0, limit);

  // Wave 768/891 (2026-05-27 사용자 결정 — 당근 우선): source priority 재배치.
  //   사용자: "당근이 우선임. 초반 gateway 역할. 당근 ready 빨리 늘리기."
  //   Wave 891: score-worker 1분 cadence 전환과 맞춰 Daangn reserve를 60%+로 상향.
  //   외부 marketplace fetch 증가는 없고, 이미 들어온 dirty row의 ready 승격 지연만 줄인다.

  // Daangn lane — 사용자 의도 "초반 gateway" + score backlog 4,000+ drain 우선.
  const daangnReserveLimit = Math.min(remainingAfterPool, Math.max(90, Math.floor(limit * 0.60)));
  const daangnRows = await (async () => {
    try {
      return fetchScorableRows(options.sourceFilter === "daangn" ? "" : "&source=eq.daangn", daangnReserveLimit, seenPids);
    } catch (err) {
      console.warn("loadScorableRows daangn fetch failed (non-fatal)", err);
      return [];
    }
  })();
  const remainingAfterDaangn = Math.max(0, limit - poolRows.length - daangnRows.length);
  if (remainingAfterDaangn === 0) return [...poolRows, ...daangnRows].slice(0, limit);
  if (options.sourceFilter === "daangn") return [...poolRows, ...daangnRows].slice(0, limit);

  // Wave 807: fashion parser drift backfills should not starve behind a broad fresh-dirty backlog.
  // 신발/의류는 parser/catalog split 빈도가 높아서 재채점 큐에 올라온 뒤에도 별도 reserve lane이 필요하다.
  // Wave 768: 35% → 25% (당근 우선으로 quota 양보).
  const fashionReserveLimit = Math.min(remainingAfterDaangn, Math.max(50, Math.floor(limit * 0.25)));
  const fashionRows = await (async () => {
    try {
      return fetchScorableRows(
        "&or=(sku_id.like.shoe-%2A,sku_id.like.clothing-%2A)",
        fashionReserveLimit,
        seenPids,
      );
    } catch (err) {
      console.warn("loadScorableRows fashion reserve fetch failed (non-fatal)", err);
      return [];
    }
  })();
  const remainingAfterFashion = Math.max(0, limit - poolRows.length - daangnRows.length - fashionRows.length);
  if (remainingAfterFashion === 0) return [...poolRows, ...daangnRows, ...fashionRows].slice(0, limit);

  // Joongna is a real second supply source, not just a garnish. Keep a
  // proportional lane so broad parser/fashion backfills cannot leave it stuck
  // at a tiny fixed trickle when the score queue is large.
  // Wave 768: 25% → 15% (당근 우선).
  const sourceReserveLimit = Math.min(remainingAfterFashion, Math.max(60, Math.floor(limit * 0.15)));
  const joongnaRows = await (async () => {
    try {
      return fetchScorableRows("&source=eq.joongna", sourceReserveLimit, seenPids);
    } catch (err) {
      console.warn("loadScorableRows joongna fetch failed (non-fatal)", err);
      return [];
    }
  })();
  const remainingLimit = Math.max(0, limit - poolRows.length - daangnRows.length - fashionRows.length - joongnaRows.length);
  if (remainingLimit === 0) return [...poolRows, ...daangnRows, ...fashionRows, ...joongnaRows].slice(0, limit);

  const generalRows: ScorableRawRow[] = [];
  for (const source of GENERAL_SCORE_SOURCES) {
    const sourceRemaining = Math.max(0, limit - poolRows.length - daangnRows.length - fashionRows.length - joongnaRows.length - generalRows.length);
    if (sourceRemaining === 0) break;
    try {
      generalRows.push(...await fetchScorableRows(`&source=eq.${source}`, sourceRemaining, seenPids));
    } catch (err) {
      console.warn(`loadScorableRows ${source} fetch failed (non-fatal)`, err);
    }
  }
  return [...poolRows, ...daangnRows, ...fashionRows, ...joongnaRows, ...generalRows].slice(0, limit);
}

async function loadDirtyPoolScorableRows(
  columns: string,
  baseFilter: string,
  limit: number,
): Promise<ScorableRawRow[]> {
  const rowLimit = Math.max(0, Math.min(limit, 50));
  if (rowLimit === 0) return [];
  const scanLimit = Math.max(200, Math.min(1000, rowLimit * 20));
  const [oldestRes, newestRes] = await Promise.all([
    restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid&status=in.(ready,reserved,invalidated)&order=updated_at.asc&limit=${Math.ceil(scanLimit / 2)}`,
      { headers: serviceHeaders() },
    ),
    restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid&status=in.(ready,reserved,invalidated)&order=updated_at.desc&limit=${Math.floor(scanLimit / 2)}`,
      { headers: serviceHeaders() },
    ),
  ]);
  const poolRows = [
    ...(oldestRes.ok ? ((await oldestRes.json()) as Array<{ pid: number | string | null }>) : []),
    ...(newestRes.ok ? ((await newestRes.json()) as Array<{ pid: number | string | null }>) : []),
  ];
  const pids = [...new Set(poolRows.map((row) => Number(row.pid)).filter(Number.isFinite))];
  if (pids.length === 0) return [];

  const rows: ScorableRawRow[] = [];
  for (const chunk of chunkArray(pids, PARSED_PID_READ_CHUNK_SIZE)) {
    const remaining = rowLimit - rows.length;
    if (remaining <= 0) break;
    const seen = new Set(rows.map((row) => Number(row.pid)).filter(Number.isFinite));
    for (const listingTypeFilter of ["&listing_type=eq.normal", "&listing_type_override=eq.normal"]) {
      const nextRemaining = rowLimit - rows.length;
      if (nextRemaining <= 0) break;
      let batch: ScorableRawRow[] = [];
      try {
        const res = await restFetch(
          `${tableUrl("mvp_raw_listings")}?select=${columns}${baseFilter}${listingTypeFilter}&pid=in.(${chunk.join(",")})&limit=${Math.min(nextRemaining, chunk.length)}`,
          { headers: serviceHeaders() },
        );
        if (!res.ok) continue;
        batch = (await res.json()) as ScorableRawRow[];
      } catch (err) {
        console.warn("loadDirtyPoolScorableRows raw listing chunk fetch failed (non-fatal)", err);
        continue;
      }
      for (const row of batch) {
        const pid = Number(row.pid);
        if (!Number.isFinite(pid) || seen.has(pid)) continue;
        seen.add(pid);
        rows.push(row);
      }
    }
  }
  return rows.slice(0, rowLimit);
}

async function clearScoreDirty(pids: number[]): Promise<void> {
  if (!(await rawScoreDirtySchemaAvailable())) return;
  const unique = [...new Set(pids.filter(Number.isFinite))];
  if (unique.length === 0) return;
  for (const chunk of chunkArray(unique, SCORE_DIRTY_CLEAR_CHUNK_SIZE)) {
    await patchRowsByIds("mvp_raw_listings", chunk, { score_dirty: false }, SCORE_DIRTY_CLEAR_CHUNK_SIZE);
  }
}

async function loadScoreDirtyPidsByFilter(filter: string, limit: number): Promise<number[]> {
  const rowLimit = Math.max(1, Math.min(limit, 1000));
  const res = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid&score_dirty=eq.true${filter}&order=last_seen_at.desc&limit=${rowLimit}`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json()) as Array<{ pid: number | string | null }>;
  return rows.map((row) => Number(row.pid)).filter(Number.isFinite);
}

async function clearScoreDirtyByFilter(reason: string, filter: string, limit: number): Promise<number> {
  try {
    const pids = await loadScoreDirtyPidsByFilter(filter, limit);
    await clearScoreDirty(pids);
    return pids.length;
  } catch (err) {
    console.warn(`clear score_dirty failed for ${reason} (non-fatal)`, err);
    return 0;
  }
}

async function clearNonScorableScoreDirty(limit: number): Promise<number> {
  if (!(await rawScoreDirtySchemaAvailable())) return 0;
  const rowLimit = Math.max(1, Math.min(limit, 1000));
  try {
    const res = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,listing_type,listing_type_override&score_dirty=eq.true&detail_status=eq.done&sku_id=not.is.null&listing_state=eq.active&listing_type=neq.normal&listing_type_override=is.null&limit=${rowLimit}`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as Array<{
      pid: number | string | null;
      listing_type: string | null;
      listing_type_override: string | null;
    }>;
    const pids = rows
      .filter((row) => row.listing_type !== "normal" && row.listing_type_override !== "normal")
      .map((row) => Number(row.pid))
      .filter(Number.isFinite);
    await clearScoreDirty(pids);
    return pids.length;
  } catch (err) {
    console.warn("clear non-scorable score_dirty failed (non-fatal)", err);
    return 0;
  }
}

async function clearUnscorableScoreDirty(limit: number): Promise<number> {
  if (!(await rawScoreDirtySchemaAvailable())) return 0;
  const rowLimit = Math.max(1, Math.min(limit, 2000));
  const specs: Array<{ reason: string; filter: string; limit: number }> = [
    { reason: "detail_null", filter: "&detail_status=is.null", limit: 350 },
    { reason: "detail_not_done", filter: "&detail_status=neq.done", limit: 500 },
    { reason: "sku_null", filter: "&detail_status=eq.done&sku_id=is.null", limit: 500 },
    { reason: "state_null", filter: "&detail_status=eq.done&sku_id=not.is.null&listing_state=is.null", limit: 250 },
    { reason: "state_not_active", filter: "&detail_status=eq.done&sku_id=not.is.null&listing_state=neq.active", limit: 500 },
    { reason: "type_null", filter: "&detail_status=eq.done&sku_id=not.is.null&listing_state=eq.active&listing_type=is.null&listing_type_override=is.null", limit: 250 },
    { reason: "type_not_normal", filter: "&detail_status=eq.done&sku_id=not.is.null&listing_state=eq.active&listing_type=neq.normal&listing_type_override=is.null", limit: 500 },
    { reason: "override_not_normal", filter: "&detail_status=eq.done&sku_id=not.is.null&listing_state=eq.active&listing_type=neq.normal&listing_type_override=not.is.null&listing_type_override=neq.normal", limit: 350 },
  ];
  const breakdown = new Map<string, number>();
  let total = 0;
  for (const spec of specs) {
    const remaining = rowLimit - total;
    if (remaining <= 0) break;
    const cleared = await clearScoreDirtyByFilter(spec.reason, spec.filter, Math.min(spec.limit, remaining));
    if (cleared > 0) breakdown.set(spec.reason, cleared);
    total += cleared;
  }
  if (total > 0) {
    console.info("[score-cleanup] cleared unscorable score_dirty rows", {
      total,
      ...Object.fromEntries(breakdown),
    });
  }
  return total;
}

type ScoreDirtyMarkResult = {
  candidateRows: number;
  markedRows: number;
};

async function markScoreDirtyIfClean(pids: number[]): Promise<number> {
  const unique = [...new Set(pids.filter(Number.isFinite))];
  if (unique.length === 0) return 0;
  let marked = 0;
  for (const chunk of chunkArray(unique, SCORE_DIRTY_MARK_CHUNK_SIZE)) {
    const res = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid&pid=in.(${chunk.join(",")})&score_dirty=eq.false`,
      {
        method: "PATCH",
        headers: serviceHeaders("return=representation"),
        body: jsonBody({ score_dirty: true }),
      },
    );
    const rows = (await res.json()) as Array<{ pid: number | string | null }>;
    marked += rows.length;
  }
  return marked;
}

async function markRawScoreDirtyByComparableKeys(comparableKeys: string[]): Promise<ScoreDirtyMarkResult> {
  if (!(await rawScoreDirtySchemaAvailable())) return { candidateRows: 0, markedRows: 0 };
  const unique = [...new Set(comparableKeys.filter(Boolean))];
  if (unique.length === 0) return { candidateRows: 0, markedRows: 0 };
  // comparable_key를 가진 parsed pid를 모은 뒤 raw_listings.score_dirty=true.
  const parsedByPid = await loadParsedRowsByComparableKeys(unique, 5000, {
    includeParsedJson: false,
    maxRowsPerKeyChunk: marketInvalidationParsedRowsPerKeyChunk(),
  });
  const pids = [...parsedByPid.keys()];
  if (pids.length === 0) return { candidateRows: 0, markedRows: 0 };
  const markedRows = await markScoreDirtyIfClean(pids);
  return { candidateRows: pids.length, markedRows };
}

// Wave 714c (2026-05-23): lane unblock 시 stale invalidated 매물 자동 재평가.
//
// 발견: Wave 678/679 에서 의류 4 lane (stussy_hoodie / stussy_basic_tee / bape_tee / patagonia_retro_x)
// 을 blocked → ready 로 풀어줬는데, 기존 candidate_pool 의 invalidated row 들이 그대로 남음.
// cron 은 score_dirty=true 인 row 만 재평가 → stale invalidated 38건 묶임 → 의류 ready 정체.
//
// 해결: 매 tick 마다 invalidated_reason 이 `lane_blocked_X` 패턴인 매물 중,
//   X (laneKey) 가 현재 LANE_READINESS 에서 ready 상태이면 score_dirty=true 박음.
//   cron 이 자연 재평가 → 진짜 차단 사유 있으면 다시 invalidate, 없으면 ready 진입.
//
// 안전:
//   - 직접 status update X (자연 재평가만 트리거)
//   - 매 tick 마다 row 신규 stale 만 잡음 (idempotent — 한 번 dirty 박힌 row 는 cron 처리 후 false)
//   - lane 다시 blocked 로 돌아간 경우엔 invalidated 그대로 유지 (LANE_READINESS check)
async function markStaleLaneBlockedScoreDirty(): Promise<number> {
  if (!(await rawScoreDirtySchemaAvailable())) return 0;
  try {
    const { LANE_READINESS } = await import("@/lib/category-readiness");
    const res = await restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid,invalidated_reason&status=eq.invalidated&invalidated_reason=like.lane_blocked_*&limit=2000`,
      { method: "GET", headers: serviceHeaders() },
    );
    if (!res.ok) return 0;
    const rows: Array<{ pid: number; invalidated_reason: string | null }> = await res.json();
    if (!rows.length) return 0;
    const stalePids: number[] = [];
    for (const row of rows) {
      const reason = row.invalidated_reason ?? "";
      if (!reason.startsWith("lane_blocked_")) continue;
      const laneKey = reason.slice("lane_blocked_".length);
      // LANE_READINESS 에서 lane 이 ready 면 stale — score_dirty 박기.
      const laneConfig = (LANE_READINESS as Record<string, { status: string }>)[laneKey];
      if (laneConfig?.status === "ready") {
        stalePids.push(row.pid);
      }
    }
    if (stalePids.length === 0) return 0;
    for (const chunk of chunkArray(stalePids, REST_WRITE_CHUNK_SIZE)) {
      await patchRowsByIds("mvp_raw_listings", chunk, { score_dirty: true }, REST_WRITE_CHUNK_SIZE);
    }
    return stalePids.length;
  } catch (err) {
    console.warn("[wave714c] markStaleLaneBlockedScoreDirty failed (non-fatal)", err);
    return 0;
  }
}

// Wave 184 (2026-05-17): incremental market-worker — last_seen_at lookback filter 추가.
//
// 변경 이유 (사용자 통찰):
//   "매일 18K 매물 다시 group 하는 게 비효율 — 어제 시세 row 이미 박혔는데
//    왜 또 group? 오늘 active/변경된 매물만 처리하면 되는 거 아님?"
//
// 변경 전 (Wave 132): order=detail_enriched_at.desc.nullslast,last_seen_at.desc&limit=3000
//   → PostgREST max-rows=1000 cap 으로 1000 row 만 페치. eligible 18K 중 5% 만 처리.
//   → 옛 매물 (low detail_enriched 우선순위) 영구 누락.
//
// 변경 후 (Wave 184): last_seen_at >= NOW() - LOOKBACK 매물만 페치.
//   - active 매물 search cadence 5~10분이라 lookback 24h 면 거의 다 갱신됨.
//   - 4시간 cushion 추가 (28h) — search outage 안전 마진.
//   - 1000 cap 안에 충분히 들어옴 (오늘 변경 매물 보통 1K~3K).
//   - 옛 (lookback 밖) 매물의 시세 row 는 어제 박힌 그대로 historical 유지.
//   - sold/disappeared 전환은 invalidation queue (mvp_market_key_invalidation) 가
//     자동 trigger → loadMarketStatRowsByPids 분기로 별도 targeted upsert (영향 없음).
//
// 의존성 영향 (조사 완료):
//   - pack-open marketBasis: 최신 1 row 읽기 → 오늘 row 박히면 OK
//   - market-history-chart: 30일 range → 옛 row 그대로 유지, 영향 X
//   - candidate-pool-builder skuMedian: 최신 row → 동일
//   - dirty_marked_rows + score stage: 유지 (recomputedKeys 만 dirty mark)
//   - lifecycle invalidation queue (sold/disappeared): 별 경로, 영향 X
//
// Lookback 결정:
//   - 24h 이상 가능. 1d 가 사용자 "그날 데이터만" 통찰과 정확히 일치.
//   - 너무 짧으면 outage 시 누락. 너무 길면 의미 사라짐.
//   - env override 가능 (PIPELINE_MARKET_STATS_LOOKBACK_HOURS).
const DEFAULT_MARKET_STATS_LOOKBACK_HOURS = 28;

// Wave 218 (2026-05-19): placeholder 가격 탐지 헬퍼.
//   기존: row.price >= 100_000_000 || row.price <= 0 만 차단.
//   문제: 99,999,999 / 77,777,777 / 11,111,111 / 9,999,999 / 999,999 / 111,111 등
//         "같은 자리수 반복" placeholder 가 빠짐. 사용자 지적 + 측정 (active 44건):
//         shoe-stussy-nike-collab max 99,999,999 (CV 10.73 — 시세 망가짐)
//   정책: ^(\d)\1{4,}$ 5자리+ 같은 숫자 = placeholder. 1004 (천사) / 1234 / 4321 sequential.
//   영향: upsertMarketPriceDaily + score-stage fallback + score gap 3곳 동일 헬퍼.
function isPlaceholderPrice(price: number | null | undefined): boolean {
  if (!Number.isFinite(price ?? NaN)) return true;
  const p = Number(price);
  if (p <= 0) return true;
  if (p >= 100_000_000) return true; // 1억+
  const s = String(Math.floor(p));
  if (s.length >= 5 && /^(\d)\1+$/.test(s)) return true; // 11111 / 99999 / 1111111 / 99999999
  if (p === 1004 || p === 1234 || p === 4321 || p === 12345) return true; // 의도적 sequential
  return false;
}

// Wave 719 (2026-05-23) — Task #25: 카테고리별 MAX_REASONABLE_PRICE 정의.
// 1억 미만이지만 정상 시세 5-10배 outlier 차단 (시세 median 부풀림 방지).
// 발견 sample: macbook-pro 22M, macbook-air 17.5M, iphone-15-pro-max 16M, iphone-16-pro-max 13.5M, airpods-max 7M.
// prefix 매칭 — 모든 SKU 일일이 정의 X. 합리적 정상 cap (정가 1.5-2배).
const SKU_PREFIX_MAX_KRW: Array<[RegExp, number]> = [
  // 폴더블 폰 (더 비쌈)
  [/^galaxy-z-fold/i, 5_000_000],
  [/^galaxy-z-flip/i, 3_500_000],
  // 일반 스마트폰
  [/^iphone-16-pro-max/i, 4_000_000],
  [/^iphone-17/i, 4_000_000],
  [/^iphone-16/i, 3_000_000],
  [/^iphone-15/i, 2_500_000],
  [/^iphone-14/i, 2_000_000],
  [/^iphone-13/i, 1_800_000],
  [/^iphone-11/i, 1_000_000],
  [/^iphone-/i, 2_500_000],
  [/^galaxy-s2[5-9]/i, 3_500_000],
  [/^galaxy-s2[0-4]/i, 2_500_000],
  [/^galaxy-note/i, 2_000_000],
  [/^galaxy-/i, 3_000_000],
  // 태블릿
  [/^ipad-pro/i, 5_000_000],
  [/^ipad-air/i, 3_000_000],
  [/^ipad-mini/i, 2_500_000],
  [/^ipad-/i, 2_500_000],
  [/^galaxy-tab-s10-ultra/i, 3_000_000],
  [/^galaxy-tab/i, 2_500_000],
  // 노트북
  [/^macbook-pro/i, 12_000_000], // M3 Max 800만 + 50%
  [/^macbook-air/i, 4_000_000],
  [/^macbook/i, 8_000_000],
  // 스마트워치 / 이어폰
  [/^applewatch-ultra/i, 2_500_000],
  [/^applewatch/i, 1_200_000],
  [/^airpods-max/i, 1_200_000],
  [/^airpods-pro/i, 600_000],
  [/^airpods/i, 400_000],
  // 스피커
  [/^speaker-/i, 2_000_000],
  // 드론
  [/^drone-/i, 5_000_000],
  // 자전거 (로드 카본)
  [/^bike-/i, 8_000_000],
  // 명품 가방 — Hermès legit 5000-8000만 (sentinel 1억+ 만 차단)
  [/^bag-hermes/i, 80_000_000],
  [/^bag-chanel/i, 30_000_000],
  [/^bag-lv/i, 20_000_000],
  [/^bag-gucci/i, 15_000_000],
  [/^bag-/i, 10_000_000],
  // 의류 / 신발 / 시계 — 일반적 cap
  [/^clothing-polo-purple-label/i, 5_000_000],
  [/^clothing-polo-rrl-jacket-leather/i, 5_000_000],
  [/^clothing-thombrowne-suit/i, 5_000_000],
  [/^clothing-moncler-grenoble/i, 5_000_000],
  [/^clothing-/i, 3_000_000],
  [/^shoe-/i, 3_000_000],
];

function isPriceOutlierForSku(price: number | null | undefined, skuId: string | null | undefined): boolean {
  if (!Number.isFinite(price ?? NaN)) return false;
  if (!skuId) return false;
  const p = Number(price);
  for (const [re, cap] of SKU_PREFIX_MAX_KRW) {
    if (re.test(skuId)) {
      return p > cap;
    }
  }
  return false;
}
// Supabase PostgREST max-rows=1000 강제 cap → 한 GET 당 1000 row max.
// 28h lookback 안 매물 6.7K+ (측정) — 1000 cap 으로 5.7K 누락 위험.
// → pagination 으로 chunk 페치 후 합쳐서 group/upsert. lifecycle 의 chunk wave 패턴.
const MARKET_STATS_PAGE_SIZE = 1000;
async function loadMarketStatRows(limit: number): Promise<ScorableRawRow[]> {
  // Wave 132: num_comment 추가 (시세 sample 분석 시 활용 가능).
  // Wave 217 (2026-05-19): bunjang_condition_label 추가.
  const columns = "pid,source,name,price,num_faved,free_shipping,url,description_preview,shop_review_rating,shop_review_count,trade_data,trades_data,image_url_template,image_count,thumbnail_url,sku_id,sku_name,listing_state,sale_status,last_seen_at,source_updated_at,num_comment,qty,description_hash,bunjang_condition_label";
  const lookbackHours = Math.max(
    1,
    Math.min(168, Number(process.env.PIPELINE_MARKET_STATS_LOOKBACK_HOURS ?? DEFAULT_MARKET_STATS_LOOKBACK_HOURS) || DEFAULT_MARKET_STATS_LOOKBACK_HOURS),
  );
  const sinceIso = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();
  // order 도 last_seen_at.desc 단일로 변경 — detail_enriched 우선 정책이 옛 매물 누락 원인.
  const baseUrl = `${tableUrl("mvp_raw_listings")}?select=${columns}&detail_status=eq.done&or=(listing_type.eq.normal,listing_type_override.eq.normal)&sku_id=not.is.null&listing_state=in.(active,sold_confirmed,disappeared)&last_seen_at=gte.${encodeURIComponent(sinceIso)}&order=last_seen_at.desc`;
  // Wave 184: pagination — PostgREST 1000 cap 우회. limit param 까지 chunk 별 페치 후 합침.
  // chunk 가 PAGE_SIZE 미만이면 더 없음 → break.
  const rows: ScorableRawRow[] = [];
  for (let offset = 0; offset < limit; offset += MARKET_STATS_PAGE_SIZE) {
    const pageLimit = Math.min(MARKET_STATS_PAGE_SIZE, limit - offset);
    const url = `${baseUrl}&limit=${pageLimit}&offset=${offset}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    const chunk = (await res.json()) as ScorableRawRow[];
    rows.push(...chunk);
    if (chunk.length < pageLimit) break;
  }
  return rows;
}

async function loadMarketStatRowsByPids(pids: number[], limit: number): Promise<ScorableRawRow[]> {
  const unique = [...new Set(pids.filter(Number.isFinite))].slice(0, limit);
  if (unique.length === 0) return [];
  // Wave 132: num_comment 추가.
  // Wave 217 (2026-05-19): bunjang_condition_label 추가.
  const columns = "pid,source,name,price,num_faved,free_shipping,url,description_preview,shop_review_rating,shop_review_count,trade_data,trades_data,image_url_template,image_count,thumbnail_url,sku_id,sku_name,listing_state,sale_status,last_seen_at,source_updated_at,num_comment,qty,description_hash,bunjang_condition_label";
  const rows: ScorableRawRow[] = [];
  for (const chunk of chunkArray(unique, PARSED_PID_READ_CHUNK_SIZE)) {
    const remaining = limit - rows.length;
    if (remaining <= 0) break;
    const url = `${tableUrl("mvp_raw_listings")}?select=${columns}&pid=in.(${chunk.join(",")})&detail_status=eq.done&or=(listing_type.eq.normal,listing_type_override.eq.normal)&sku_id=not.is.null&listing_state=in.(active,sold_confirmed,disappeared)&limit=${Math.min(remaining, chunk.length)}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    rows.push(...((await res.json()) as ScorableRawRow[]));
  }
  return rows.slice(0, limit);
}

async function loadParsedRows(pids: number[]): Promise<Map<number, ParsedListingRow>> {
  if (pids.length === 0) return new Map();
  const unique = [...new Set(pids.filter(Number.isFinite))];
  if (unique.length === 0) return new Map();
  // Wave 130: condition_class 컬럼 fetch — 시세 산정 grouping key.
  const columns = parsedListingColumns({ includeParsedJson: true });
  const rows: ParsedListingRow[] = [];
  for (const chunk of chunkArray(unique, REST_READ_CHUNK_SIZE)) {
    const url = `${tableUrl("mvp_listing_parsed")}?select=${columns}&pid=in.(${chunk.join(",")})`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    rows.push(...((await res.json()) as ParsedListingRow[]));
  }
  return new Map(rows.map((row) => [row.pid, row]));
}

type ParsedKeyLoadOptions = {
  includeParsedJson?: boolean;
  keyChunkSize?: number;
  maxRowsPerKeyChunk?: number;
  onAttemptedKeys?: (keys: string[]) => void;
  onFailedKeys?: (keys: string[], err: unknown) => void;
  onRescuedKeys?: (keys: string[]) => void;
  rescueRowsPerKey?: number;
};

function parsedListingColumns(options: { includeParsedJson: boolean }) {
  const base = "pid,parser_version,category,comparable_key,parse_confidence,condition_score,condition_class,condition_tier,needs_review,condition_notes";
  return options.includeParsedJson ? `${base},parsed_json` : base;
}

function marketInvalidationParsedRowsPerKeyChunk() {
  return boundedInt(
    process.env.PIPELINE_MARKET_INVALIDATION_PARSED_ROWS_PER_KEY_CHUNK ?? null,
    DEFAULT_MARKET_INVALIDATION_PARSED_ROWS_PER_KEY_CHUNK,
    50,
    5000,
  );
}

function marketInvalidationKeyChunkSize() {
  return boundedInt(
    process.env.PIPELINE_MARKET_INVALIDATION_KEY_CHUNK_SIZE ?? null,
    DEFAULT_MARKET_INVALIDATION_KEY_CHUNK_SIZE,
    1,
    REST_KEY_READ_CHUNK_SIZE,
  );
}

function marketInvalidationRescueRowsPerKey() {
  return boundedInt(
    process.env.PIPELINE_MARKET_INVALIDATION_RESCUE_ROWS_PER_KEY ?? null,
    DEFAULT_MARKET_INVALIDATION_RESCUE_ROWS_PER_KEY,
    10,
    DEFAULT_MARKET_INVALIDATION_PARSED_ROWS_PER_KEY_CHUNK,
  );
}

async function loadParsedRowsForComparableKeyChunk(input: {
  keys: string[];
  columns: string;
  maxRows: number;
}) {
  const encoded = input.keys.map((key) => encodeURIComponent(key)).join(",");
  const baseUrl = `${tableUrl("mvp_listing_parsed")}?select=${input.columns}&comparable_key=in.(${encoded})&parse_confidence=gte.0.65&needs_review=eq.false`;
  return restFetchAll<ParsedListingRow>(baseUrl, {
    maxRows: input.maxRows,
    orderBy: "pid.asc",
  });
}

async function loadParsedRowsByComparableKeys(
  comparableKeys: string[],
  limit: number,
  options: ParsedKeyLoadOptions = {},
): Promise<Map<number, ParsedListingRow>> {
  const unique = [...new Set(comparableKeys.filter(Boolean))].slice(0, limit);
  if (unique.length === 0) return new Map();
  // Wave 130: condition_class 컬럼 fetch — 시세 산정 grouping key.
  // Wave 254.3 (2026-05-20): cap 1000 silent miss fix.
  //   기존: `limit=Math.max(limit, chunk.length * 100)` → PostgREST server-side
  //   default row cap (≈1000) 으로 silent truncation. 50 key chunk × 100 = 5000
  //   limit 박아도 실제 1000 row 만 반환 → 12,736 stale 영역 1 chain 의 root cause.
  //   fix: `restFetchAll` 의 offset pagination 으로 cap 우회.
  const columns = parsedListingColumns({ includeParsedJson: options.includeParsedJson ?? true });
  const maxRowsPerKeyChunk = options.maxRowsPerKeyChunk == null
    ? Number.POSITIVE_INFINITY
    : Math.max(1, options.maxRowsPerKeyChunk);
  const keyChunkSize = Math.max(1, Math.min(options.keyChunkSize ?? REST_KEY_READ_CHUNK_SIZE, REST_KEY_READ_CHUNK_SIZE));
  const rescueRowsPerKey = Math.max(1, Math.min(options.rescueRowsPerKey ?? maxRowsPerKeyChunk, maxRowsPerKeyChunk));
  const rows: ParsedListingRow[] = [];
  for (const chunk of chunkArray(unique, keyChunkSize)) {
    const remaining = limit - rows.length;
    if (remaining <= 0) break;
    try {
      // maxRows = remaining cap. Market invalidation callers can also cap each
      // key chunk, so one hot SKU family cannot consume the whole worker budget.
      const pageRows = await loadParsedRowsForComparableKeyChunk({
        keys: chunk,
        columns,
        maxRows: Math.min(remaining, maxRowsPerKeyChunk),
      });
      options.onAttemptedKeys?.(chunk);
      rows.push(...pageRows);
    } catch (err) {
      if (chunk.length <= 1) {
        options.onFailedKeys?.(chunk, err);
        console.warn("parsed rows by comparable_key failed; deferring key", {
          key: chunk[0] ?? null,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
      console.warn("parsed rows by comparable_key chunk failed; retrying per key", {
        keyCount: chunk.length,
        error: err instanceof Error ? err.message : String(err),
      });
      for (const key of chunk) {
        const perKeyRemaining = limit - rows.length;
        if (perKeyRemaining <= 0) break;
        try {
          const pageRows = await loadParsedRowsForComparableKeyChunk({
            keys: [key],
            columns,
            maxRows: Math.min(perKeyRemaining, rescueRowsPerKey),
          });
          options.onAttemptedKeys?.([key]);
          options.onRescuedKeys?.([key]);
          rows.push(...pageRows);
        } catch (singleErr) {
          options.onFailedKeys?.([key], singleErr);
          console.warn("parsed rows by comparable_key rescue failed; deferring key", {
            key,
            error: singleErr instanceof Error ? singleErr.message : String(singleErr),
          });
        }
      }
    }
    if (rows.length >= limit) break;
  }
  return new Map(rows.slice(0, limit).map((row) => [row.pid, row]));
}

async function loadParsedRowsByShoeSizeSiblingKeys(
  comparableKeys: string[],
  limit: number,
  options: ParsedKeyLoadOptions = {},
): Promise<Map<number, ParsedListingRow>> {
  const patterns = [...new Set(comparableKeys.map(shoeSizeSiblingLikePattern).filter((key): key is string => Boolean(key)))];
  if (patterns.length === 0 || limit <= 0) return new Map();
  const columns = parsedListingColumns({ includeParsedJson: options.includeParsedJson ?? true });
  const maxRowsPerKeyChunk = options.maxRowsPerKeyChunk == null
    ? Number.POSITIVE_INFINITY
    : Math.max(1, options.maxRowsPerKeyChunk);
  const keyChunkSize = Math.max(1, Math.min(options.keyChunkSize ?? REST_KEY_READ_CHUNK_SIZE, REST_KEY_READ_CHUNK_SIZE));
  const rows: ParsedListingRow[] = [];
  for (const pattern of patterns.slice(0, keyChunkSize)) {
    const remaining = limit - rows.length;
    if (remaining <= 0) break;
    const baseUrl = `${tableUrl("mvp_listing_parsed")}?select=${columns}&comparable_key=like.${encodeURIComponent(pattern)}&parse_confidence=gte.0.65&needs_review=eq.false`;
    const pageRows = await restFetchAll<ParsedListingRow>(baseUrl, {
      maxRows: Math.min(remaining, maxRowsPerKeyChunk),
      orderBy: "pid.asc",
    });
    rows.push(...pageRows);
    if (rows.length >= limit) break;
  }
  return new Map(rows.slice(0, limit).map((row) => [row.pid, row]));
}

// Wave 216 (2026-05-19): parser_version drift 체크 — 카테고리별 최신 parser version.
//   기존: missing 만 re-parse → 새 parser 박혀도 옛 row 영원히 stale.
//   증상 (Wave 216): clothing 1253건 default 분기 (parse_confidence 0.45 + needs_review=true)
//   → market_price_daily 0건 → candidate_pool 0건. clothing parser 새로 박혔어도 자동 적용 X.
//   fix: 카테고리별 최신 parser_version 명시 → stale row 도 missingRows 에 포함.
//   다른 카테고리는 옛 버전 그대로 두기 (드리프트 정책은 카테고리별로 명시적).
const LATEST_PARSER_VERSION_BY_CATEGORY: Partial<Record<NonNullable<Sku["category"]>, string>> = {
  // v2 (2026-05-19): modelFromSku brand 포함 (polo/stussy/tnf/arcteryx 구분).
  // v3 (2026-05-19 Wave 217): bunjang_condition_label + resolveConditionClass 활용.
  // v4 (2026-05-19 Wave 236): product-type 추출 (hoodie/tee/jacket/pants/cap/belt/wallet/backpack/shoulder/tote).
  //   사용자 코멘트 22건 중 17건 "같은 SKU 다른 product-type 섞임" 근본 fix.
  //   comparable_key 에 product-type 박혀 시세 daily 자동 분리.
  // v5 (2026-05-19 Wave 236b): regex 보완 (반팔/남방/빈파포/눕시/터틀넥/탱크탑/트랙탑/윈드/호보/버킷/카메라/슬링/탑핸들/포쉐트).
  // v6 (2026-05-19 Wave 236c): defaultProductType fallback 제거 + type_unknown → needsReview.
  // v7 (2026-05-19 Wave 236d): catalog narrow model defaultProductType 박힘 시 fallback OK,
  //   broad SKU 미박힘 시 차단. 사용자 의도: "Borealis=백팩 확정" 같은 narrow 만 통과.
  // Wave 254.5 step 1+2+3 (2026-05-20): fashion 3 카테고리 일괄 v8 — 사용자 systemic 정정.
  //   사용자 SQL 검증: fashion 17,646건 condition_notes = 0% (vs tech 80%+).
  //   8,191건 suspicious_high_grade (mint/clean/unopened + notes []) 잘못 추천 가능.
  //   점진 rollout 폐기 — shoe+bag+clothing 모두 conditionFromTextFashion 동시 적용.
  //   bike 만 v7 유지 (자전거 specific signal 별도 wave).
  // Wave 264 (2026-05-20): v9 — parser regex 보강 (사용자 발견 320건 type_unknown).
  //   clothing: 블라우스/가디건/윈드러너/캡모자/베이스볼캡/6패널/워싱진/슬림내로우/데님와이드
  //   shoe: 슬라이드/이지슬라이드/클로그/아딜렛/폼러너/축구화/풋살화/F50/프레데터/코파/네메지즈/메시
  //   + catalog false positive 차단 (bag-lv-monogram-key-pouch / clothing-acne-apparel 화장품)
  // Wave 266 (2026-05-20): v10 — 번개장터 deep sweep (15K+ 미매칭 매물 분석) → 추가 regex 보강.
  //   shoe: 등산화/트레킹화/hiking boot/트레일러닝/러닝슈즈/스피드러너/골프화/테니스화/농구화/배드민턴화 등
  //   clothing: 베이스볼 저지/야구점퍼/바시티/코치자켓/하드쉘/소프트쉘/MA-1/레터맨/스타디움자켓
  //   bag: 캔버스백/쇼핑백/마트백 → tote, 데이팩/캠퍼백/책가방/학생가방 → backpack
  //   + catalog 대폭 보강 — 신발 30+ SKU (살로몬/NB/Shox/명품 broad), 의류 17 SKU (폴로/베이프/스투시/슈프림/아크네/꼼데/칼하트/톰브라운 broad), 가방 20 SKU (명품 brand-broad fallback)
  // Wave 406 (2026-05-20): v11 — 운영자풀 코멘트 기반 sleeve/zip hoodie 분리.
  //   롱슬리브/긴팔 → long_sleeve_tee, 후드집업 → hoodie_zip.
  // Wave 424 (2026-05-20): bag v11 — 제목의 bag product_type을 설명 수납품보다 우선.
  // Wave 425 (2026-05-20): clothing v13 — targeted type_unknown cleanup.
  // Wave 438 (2026-05-21): clothing v14 — cargo jacket no longer parses as pants.
  // Wave 498: shoe/bag comparable_key now preserves bag brand/lane and shoe
  // broad brand. Force stale rows to reparse so market samples stop sharing
  // generic `bag|backpack` and `shoe|broad` buckets.
  // Wave 702 (2026-05-23): shoe v35 — On Running 8 SKU (Cloudtilt/Kith/Cloudboom/Cloudaway/Cloudzone/Cloudvista/Cloudventure/Pleasures).
  // Wave 703 (2026-05-23): shoe v36 — bias-free critical hotfix. AF1 Mid '07 ('07 bleed 124건 fix) / AF1 LV ("lv" 단독 49건 fix) / Dunk panda 범고래 추가 / Palermo black-white collision 제거 / AJ1 latushi 라벨 정정 (LA to Chicago) / NB miumiu 명품 제거 / On Loewe cloudventure / Crocs 비신발+가품 차단.
  // Wave 712b (2026-05-23): shoe v37 — bias-free 21 brand 검증 신발 신설 (Onitsuka 2 / AF1 LV8+Tune+UNDEFEATED 3 / Salomon RX Slide+Phantasm+Mary Jane+XT-Whisper 4 / Hoka Mafate Xlim+Hopara+Mach 6+Kaha 3 GTX 4 / Mizuno Golf JPX+MX+Wave Prophecy 3 / Sacai split 4 / Adidas Adios Pro+Takumi+NMD R1+Pureboost 4 / Dr.Martens 5 / Vans 2 / Converse 4 / Yeezy 3 / Crocs 3 / Puma 2).
  // Wave 712c (2026-05-23): shoe v38 — 신발 추가 100+ SKU (NB vintage 12 / Asics+Onitsuka 8 / Air Max 3 / Dr.Martens family 14 / Yeezy 6 / Hoka 3 / Salomon 6 / On Running 5 / Superstar 5 / Cortez 4 / AJ1 5 / Puma 5 / Crocs 4 / Blazer 5 / Mizuno 2 / Adidas Boost 4).
  // Wave 756 (2026-05-24): shoe v39 — comparable_key에서 sizeMm 제거 (사용자 정책 "C 시세에 사이즈 반영은 진짜 아니다").
  //   기존 v38: shoe|model|sneaker|255|b_grade|with_box → size별 sample 1-2건 fragmented.
  //   Nike Dunk Panda 47건 sku_median_unavailable 1위. systemic fix.
  //   stale v38 매물 cron이 점진 reparse → size-agnostic comparable_key로 sample 통합.
  // Wave 763: shoe v41 — condition_grade.tier(UI)와 comparable_key tier 통일.
  //   parser 출력값과 drift gate 기대값 sync 유지.
  shoe: "wave92-shoe-v41",
  // Wave 660 (2026-05-22): bag v23 — Coach Tabby 폴리쉬드 페블 레더 (top tier 820k) 차단.
  // Wave 756 (2026-05-24): bag v24 — comparable_key에서 sizeVariant 제거 (shoe와 일관).
  bag: "wave92-bag-v24",
  // Wave 690 (2026-05-22): clothing v44 — stussy_nike_collab release (셋업/월드투어 차단, 30~50만 가격대 안정).
  // Wave 712a (2026-05-23): clothing v45 — bias-free 14 brand 검증 hotfix. MLB cap 엠엘비 alias + Nike/Murakami directSpecificMatch / Stussy crossbody narrow split + basic-tee shorts 차단 / Adidas trefoil Thug+SFTM+Y3+FOG+Raf 콜라보 차단 / Patagonia Synchilla 신설 (162건 회복) / Polo Big Pony Pique 신설 (193건 black hole 회복).
  // Wave 712b (2026-05-23): clothing v46 — 의류 신설 (Adidas collab 5 / FOG Main Line 4 / Polo 7 / Stone Island sub 3 / Arc'teryx Down / BAPE × Adidas + Longsleeve + Backpack / TNF Novelty + Steep Tech / Junya + CDG Converse broad / Stussy 모델 3 + Nike sub 2 / NB collab 2 / Polo Chief Keef).
  // Wave 742 (2026-05-24): clothing v47 — 의류 사이즈 추출 신설 (sizeAlpha/sizeKr/waistInch). 7,616건 v46 매물 점진 reparse.
  // Wave 779/801: clothing v52 — Baltoro/down_jacket key 유지 + fashion pool purity follow-up.
  //   parser 출력값과 drift gate 기대값 sync 유지.
  clothing: "wave216-clothing-v52",
  bike: "wave92-fashion-mobility-v7",
  // Generic option-parser categories must track the exported parser version.
  // Wave 808: v55 literals and missing game/golf/camera/etc. mappings caused the same
  // stale-parser drift class as fashion: fresh rows could be blocked as stale, while
  // old rows in unmapped categories never got automatic reparse.
  camera: OPTION_PARSER_VERSION,
  desktop: OPTION_PARSER_VERSION,
  drone: OPTION_PARSER_VERSION,
  earphone: OPTION_PARSER_VERSION,
  game_console: OPTION_PARSER_VERSION,
  home_appliance: OPTION_PARSER_VERSION,
  kickboard: OPTION_PARSER_VERSION,
  laptop: OPTION_PARSER_VERSION,
  lego: OPTION_PARSER_VERSION,
  monitor: OPTION_PARSER_VERSION,
  perfume: OPTION_PARSER_VERSION,
  smartphone: OPTION_PARSER_VERSION,
  smartwatch: OPTION_PARSER_VERSION,
  speaker: OPTION_PARSER_VERSION,
  sport_golf: OPTION_PARSER_VERSION,
  tablet: OPTION_PARSER_VERSION,
  watch: OPTION_PARSER_VERSION,
};
function isParsedStale(row: ParsedListingRow): boolean {
  if (!row.category) return false;
  const expected = LATEST_PARSER_VERSION_BY_CATEGORY[row.category];
  if (!expected) return false;
  return row.parser_version !== expected;
}

async function ensureParsedRows(rows: ScorableRawRow[], parsedByPid: Map<number, ParsedListingRow>) {
  const missingRows = rows.filter((row) => {
    const parsed = parsedByPid.get(row.pid);
    if (!parsed) return true;
    // Wave 216: parser_version drift → 강제 re-parse.
    return isParsedStale(parsed);
  });
  if (missingRows.length === 0) return parsedByPid;

  const parsedRows = missingRows.map((row) => {
    const sku = effectiveCatalogSkuForScorableRow(row);
    const parsed = parseListingOptions({
      title: row.name,
      description: row.description_preview,
      skuId: sku?.id ?? null,
      skuName: sku?.modelName ?? null,
      // Wave 217: bunjang metadata 전달 (shoe/bag/clothing 도 활용 가능하게).
      bunjangConditionLabel: row.bunjang_condition_label,
      category: sku?.category ?? null,
      // Wave 236d: catalog defaultProductType (narrow model 박힘 시 fallback, broad SKU 차단).
      defaultProductType: sku?.defaultProductType ?? null,
    });
    return toParsedListingRow(row.pid, parsed);
  });

  await upsertRows("mvp_listing_parsed", parsedRows, "pid");
  for (const row of parsedRows) {
    parsedByPid.set(Number(row.pid), {
      pid: Number(row.pid),
      parser_version: (row.parser_version as string | null) ?? null,
      category: (row.category as Sku["category"] | null) ?? null,
      comparable_key: (row.comparable_key as string | null) ?? null,
      parse_confidence: (row.parse_confidence as number | null) ?? null,
      condition_score: (row.condition_score as number | null) ?? null,
      // Wave 130: condition_class — option-parser가 채움. 시세 grouping key.
      condition_class: (row.condition_class as string | null) ?? null,
      // Wave 722 / Stage 5: condition_tier — shoe/clothing parser가 채움. 시세 grouping key (tier-aware).
      condition_tier: (row.condition_tier as string | null) ?? null,
      needs_review: (row.needs_review as boolean | null) ?? null,
      condition_notes: Array.isArray(row.condition_notes) ? row.condition_notes as string[] : null,
      parsed_json: (row.parsed_json as Record<string, unknown> | null) ?? null,
    });
  }
  return parsedByPid;
}

// Wave 130 (2026-05-16): condition별 시세 분리 fetch. comparable_key 당 최대 6 row (mint/clean/normal/worn/low_batt + legacy 'all').
async function loadMarketPriceStats(comparableKeys: string[]): Promise<MarketPriceStatsMap> {
  const unique = [...new Set(comparableKeys.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const columns = [
    "date",
    "comparable_key",
    "condition_class",
    "active_median_price",
    "sold_median_price",
    "blended_median_price",
    "active_sample_count",
    "sold_sample_count",
    "disappeared_sample_count",
    "confidence",
    "p25_price",
    "p75_price",
    "computed_at",
  ].join(",");
  // Wave 221 (2026-05-19): URL too long fix — comparable_keys 가 많아지면
  //   in.(...) 리스트가 URL 한도 (~8KB) 초과 → fetch failed.
  //   bag/clothing/shoe narrow lane 늘면서 한 번에 1000+ keys 가능.
  //   100 chunk 단위로 분할 fetch 후 merge. production cron 도 같은 문제 회피.
  const CHUNK_SIZE = 100;
  const result: MarketPriceStatsMap = new Map();
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const encoded = chunk.map((key) => encodeURIComponent(key)).join(",");
    const url = `${tableUrl("mvp_market_price_daily")}?select=${columns}&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc&limit=${Math.max(2000, chunk.length * 12)}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    const rows = (await res.json()) as MarketPriceRow[];
    for (const row of rows) {
      const byCond = result.get(row.comparable_key) ?? new Map<string, MarketPriceRow>();
      if (!byCond.has(row.condition_class)) byCond.set(row.condition_class, row);
      result.set(row.comparable_key, byCond);
    }
  }
  return result;
}

// Wave 886 Phase 3 (2026-05-26 사용자 결정): per-source 시세 로딩 (당근 전용 시세).
//   배경: 동일 SKU/condition 매물의 가격이 source 별 35-44% 차이. mixed median 사용 시 당근 매물 차익 부풀려짐.
//   목적: 매물 source 일치 sample ≥ 3 면 per-source median 사용. 부족 → mixed fallback (기존 동작).
//   비파괴: mixed median 결정 로직 그대로. per-source 는 매물 source 일치 시 우선 사용만.
type MarketPriceRowWithSource = MarketPriceRow & { source: string };
type MarketPriceStatsPerSourceMap = Map<string, Map<string, Map<string, MarketPriceRowWithSource>>>; // comparable_key → source → condition_class → row

async function loadMarketPriceStatsPerSource(comparableKeys: string[]): Promise<MarketPriceStatsPerSourceMap> {
  const unique = [...new Set(comparableKeys.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const columns = [
    "date",
    "comparable_key",
    "condition_class",
    "source",
    "active_median_price",
    "sold_median_price",
    "blended_median_price",
    "active_sample_count",
    "sold_sample_count",
    "disappeared_sample_count",
    "confidence",
    "p25_price",
    "p75_price",
    "computed_at",
  ].join(",");
  const CHUNK_SIZE = 100;
  const result: MarketPriceStatsPerSourceMap = new Map();
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const encoded = chunk.map((key) => encodeURIComponent(key)).join(",");
    const url = `${tableUrl("mvp_market_price_daily_per_source")}?select=${columns}&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc&limit=${Math.max(4000, chunk.length * 36)}`;
    try {
      const res = await restFetch(url, { headers: serviceHeaders() });
      if (!res.ok) continue;
      const rows = (await res.json()) as MarketPriceRowWithSource[];
      for (const row of rows) {
        if (!row.source) continue;
        const bySource = result.get(row.comparable_key) ?? new Map<string, Map<string, MarketPriceRowWithSource>>();
        const byCond = bySource.get(row.source) ?? new Map<string, MarketPriceRowWithSource>();
        if (!byCond.has(row.condition_class)) byCond.set(row.condition_class, row);
        bySource.set(row.source, byCond);
        result.set(row.comparable_key, bySource);
      }
    } catch (err) {
      // 비파괴 — per-source fetch 실패 시 mixed fallback (기존 동작) 유지.
      console.warn("[wave886] per-source fetch failed (non-fatal)", err instanceof Error ? err.message : String(err));
    }
  }
  return result;
}

// Wave 886 Phase 3: 매물 source 일치 per-source stat 시도 → 부족 시 null (caller 가 mixed fallback).
function pickPerSourceStatForMatter(
  perSourceMap: MarketPriceStatsPerSourceMap | null,
  comparableKey: string | null,
  conditionClass: string | null,
  matterSource: string | null | undefined,
  category?: Sku["category"] | null,
): MarketPriceRowWithSource | null {
  if (!perSourceMap || !comparableKey || !matterSource) return null;
  const bySource = perSourceMap.get(comparableKey);
  if (!bySource) return null;
  const byCond = bySource.get(matterSource);
  if (!byCond) return null;
  for (const cls of conditionFallbackChain(conditionClass)) {
    const stat = byCond.get(cls);
    if (!stat) continue;
    if (trustedMarketMedian(stat, category) != null) return stat;
  }
  return null;
}

// Wave 159h (2026-05-17): condition-fallback shared module 사용 (DRY).
function pickMarketStatByCondition(
  byCondition: Map<string, MarketPriceRow> | undefined,
  conditionClass: string | null,
): MarketPriceRow | undefined {
  const { row } = pickByConditionFallback(
    byCondition,
    conditionClass,
    (r) => Number(r.active_sample_count ?? 0) + Number(r.sold_sample_count ?? 0) + Number(r.disappeared_sample_count ?? 0),
  );
  return row;
}

const DEFAULT_MARKET_INVALIDATION_CLAIM_LIMIT = 500;
const DEFAULT_MARKET_INVALIDATION_PRIORITY_WINDOW = 3000;
const MARKET_INVALIDATION_READ_PAGE_SIZE = 1000;
const MARKET_INVALIDATION_FAST_LANE_PREFIXES = new Set(["shoe", "clothing"]);
const MARKET_INVALIDATION_PATCH_CHUNK_SIZE = 100;

function marketInvalidationPrefix(comparableKey: string | null | undefined): string {
  return String(comparableKey ?? "").split("|")[0] ?? "";
}

function marketInvalidationFastLaneBoost(row: MarketKeyInvalidationRow): number {
  const prefix = marketInvalidationPrefix(row.comparable_key);
  let boost = 0;
  if (row.affected_source === "joongna") boost += 100;
  if (prefix === "shoe") boost += 20;
  else if (prefix === "clothing") boost += 15;
  else if (prefix === "bag") boost += 5;
  return boost;
}

function compareMarketInvalidations(a: MarketKeyInvalidationRow, b: MarketKeyInvalidationRow): number {
  const priorityDiff = Number(b.priority ?? 0) - Number(a.priority ?? 0);
  if (priorityDiff !== 0) return priorityDiff;

  const boostDiff = marketInvalidationFastLaneBoost(b) - marketInvalidationFastLaneBoost(a);
  if (boostDiff !== 0) return boostDiff;

  const parsedATime = Date.parse(a.last_event_at ?? "");
  const parsedBTime = Date.parse(b.last_event_at ?? "");
  const aTime = Number.isFinite(parsedATime) ? parsedATime : Number.MAX_SAFE_INTEGER;
  const bTime = Number.isFinite(parsedBTime) ? parsedBTime : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;

  return Number(b.event_count ?? 0) - Number(a.event_count ?? 0);
}

async function loadAffectedSourcesForInvalidations(rows: MarketKeyInvalidationRow[]): Promise<Map<number, string>> {
  const pids = [...new Set(rows.map((row) => Number(row.affected_pid)).filter(Number.isFinite))];
  const out = new Map<number, string>();
  for (const chunk of chunkArray(pids, REST_READ_CHUNK_SIZE)) {
    const res = await restFetch(`${tableUrl("mvp_raw_listings")}?select=pid,source&pid=in.(${chunk.join(",")})`, { headers: serviceHeaders() });
    const rawRows = (await res.json()) as Array<{ pid: number; source: string | null }>;
    for (const row of rawRows) {
      if (row.source) out.set(Number(row.pid), row.source);
    }
  }
  return out;
}

async function loadPendingMarketInvalidations(limit = DEFAULT_MARKET_INVALIDATION_CLAIM_LIMIT): Promise<MarketKeyInvalidationRow[]> {
  try {
    const claimLimit = boundedInt(
      process.env.PIPELINE_MARKET_INVALIDATION_CLAIM_LIMIT ?? null,
      limit,
      50,
      1000,
    );
    const priorityWindow = boundedInt(
      process.env.PIPELINE_MARKET_INVALIDATION_PRIORITY_WINDOW ?? null,
      Math.max(DEFAULT_MARKET_INVALIDATION_PRIORITY_WINDOW, claimLimit * 2),
      claimLimit,
      3000,
    );
    const columns = "comparable_key,reason,priority,event_count,last_event_at,affected_pid";
    const rows: MarketKeyInvalidationRow[] = [];
    for (let offset = 0; offset < priorityWindow; offset += MARKET_INVALIDATION_READ_PAGE_SIZE) {
      const pageLimit = Math.min(MARKET_INVALIDATION_READ_PAGE_SIZE, priorityWindow - offset);
      const url = `${tableUrl("mvp_market_key_invalidation")}?select=${columns}&status=eq.pending&order=priority.desc,last_event_at.asc&limit=${pageLimit}&offset=${offset}`;
      const res = await restFetch(url, { headers: serviceHeaders() });
      const pageRows = (await res.json()) as MarketKeyInvalidationRow[];
      rows.push(...pageRows);
      if (pageRows.length < pageLimit) break;
    }
    const affectedSources = await loadAffectedSourcesForInvalidations(rows).catch((err) => {
      console.error("load invalidation affected sources failed (non-fatal)", err);
      return new Map<number, string>();
    });
    const enriched = rows.map((row) => ({
      ...row,
      affected_source: row.affected_pid ? affectedSources.get(Number(row.affected_pid)) ?? null : null,
    }));
    return enriched.sort(compareMarketInvalidations).slice(0, claimLimit);
  } catch (err) {
    console.error("load pending market invalidations failed", err);
    return [];
  }
}

function countMarketInvalidationPrefixes(rows: MarketKeyInvalidationRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const prefix = marketInvalidationPrefix(row.comparable_key) || "unknown";
    acc[prefix] = (acc[prefix] ?? 0) + 1;
    return acc;
  }, {});
}

async function markMarketInvalidationsDone(comparableKeys: string[]): Promise<number> {
  const unique = [...new Set(comparableKeys.filter(Boolean))];
  if (unique.length === 0) return 0;
  try {
    const now = new Date().toISOString();
    for (const chunk of chunkArray(unique, MARKET_INVALIDATION_PATCH_CHUNK_SIZE)) {
      const encoded = chunk.map((key) => encodeURIComponent(key)).join(",");
      await patchRows("mvp_market_key_invalidation", `comparable_key=in.(${encoded})`, {
        status: "done",
        last_recomputed_at: now,
        locked_until: null,
        last_error: null,
      });
    }
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

function shoeSizeAgnosticComparableKey(comparableKey: string | null | undefined): string | null {
  const parts = String(comparableKey ?? "").split("|");
  if (parts[0] !== "shoe") return null;
  if (parts.includes("size_any")) return null;
  if (parts.length >= 5) {
    const next = [...parts];
    next[3] = "size_any";
    return next.join("|");
  }
  if (parts.length === 4) {
    const next = [...parts];
    next[2] = "size_any";
    return next.join("|");
  }
  return null;
}

function shoeSizeSiblingLikePattern(comparableKey: string | null | undefined): string | null {
  const parts = String(comparableKey ?? "").split("|");
  if (parts[0] !== "shoe") return null;
  if (parts.includes("size_any")) return null;
  if (parts.length >= 5) {
    const next = [...parts];
    next[3] = "*";
    return next.join("|");
  }
  if (parts.length === 4) {
    const next = [...parts];
    next[2] = "*";
    return next.join("|");
  }
  return null;
}

function preciseComparableKey(parsed: ParsedListingRow | undefined) {
  if (!parsed?.comparable_key) return null;
  if (Number(parsed.parse_confidence ?? 0) < 0.65) return null;
  if (parsed.needs_review) return null;
  return parsed.comparable_key;
}

function parsedJsonObject(parsed: ParsedListingRow | undefined) {
  const value = parsed?.parsed_json;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function stringArrayFromParsedJson(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean).slice(0, 8);
}

function parserUnknownParts(parsed: ParsedListingRow | undefined, comparableKey: string | null) {
  const fromJson = stringArrayFromParsedJson(parsedJsonObject(parsed).unknown_parts);
  if (fromJson.length > 0) return fromJson;
  return comparableKey?.split("|").filter((part) => part.startsWith("unknown_")).slice(0, 8) ?? [];
}

function parserCriticalUnknownParts(parsed: ParsedListingRow | undefined) {
  return stringArrayFromParsedJson(parsedJsonObject(parsed).critical_unknown);
}

function aiEscrowKindForParserMetadata(
  parsed: ParsedListingRow | undefined,
  unknownParts: string[],
  criticalUnknownParts: string[],
) {
  if (criticalUnknownParts.length > 0) return "parser_critical_unknown";
  if (parsed?.needs_review) return "parser_option_ambiguity";
  if (unknownParts.some((part) => part.includes("connectivity") || part.includes("carrier"))) return "connectivity_ambiguity";
  if (unknownParts.some((part) => part.includes("generation") || part.includes("gen"))) return "generation_ambiguity";
  if (unknownParts.length > 0) return "parser_unknown_option";
  return null;
}

function trustedMarketMedian(stat: MarketPriceRow | undefined, category?: Sku["category"] | null) {
  if (!stat) return null;
  // 2026-05-15 (사용자 코멘트 pid 369164122 다이슨 V12): confidence=low + sold=0 +
  // active<3 매물은 "비교 매물 없는데 시세 있음" 문제 유발. sample 부족 시세는
  // 신뢰 못 함 → trusted 차단 → skuMedian=0 → pool 진입 차단 (정확성 우선 §12b).
  //
  // Wave 106 (사용자 정확도 우선 강화): low confidence + total sample < 5 차단.
  // madTrim 이 5건 미만은 trim 안 하므로 sample 작으면 outlier 1건이 median 끌어올림.
  //
  // 2026-05-16 (사용자 코멘트 id 106 pid 408078170 / id 109 pid 408117001):
  // "비교매물 1개로 시세가 망함? 5개인가 3개 비교군이 있어야".
  // wave 130 condition_class 분리 후 sample 더 작아짐 (1-2건 자주 발생).
  // confidence 무관 total<3 강제 차단 — sample 1-2건은 outlier 1건이 시세 결정 = 위험.
  //
  // Wave 173 (2026-05-17): 신발 카테고리 ready 승급 직후 — daily aggregate 전부 low
  // confidence + avg sample 1.44건이라 위 gate에서 skuMedian=0 → pool 진입 0건 차단됨.
  // 사용자 결정: 신발 한정 total ≥ 2 허용 (즉시 노출 vs precision trade-off 수용).
  // outlier 보호 safety nets — Wave 171 ceiling(msrp×5) / 4 tier 가품 floor /
  // 72 광고 차단 / Wave 138 셀러당 1 pool entry / pool ceiling 동일 — 작동 중.
  // sample 1건은 outlier=시세라 여전히 차단. 2건+부터 trust.
  const active = stat.active_sample_count ?? 0;
  const sold = stat.sold_sample_count ?? 0;
  const total = active + sold;
  // Wave 190 (2026-05-18): 신규 ready 카테고리 (drone/lego/kickboard/perfume) — Wave 173 신발과 동일 사유.
  //   condition_class 별로 시세 row 분리 후 각 sample 1~2건이라 total<3 gate 차단 → skuMedian=0 → pool 진입 0건.
  //   safety nets (msrp×5 ceiling / 4 tier fake floor / 광고 차단 / seller dup) 작동 중. sample 1건만 차단.
  //   사용자 §12b 정책 영향: shoe 와 동일한 trade-off — 즉시 노출 vs precision. internal_only 카테고리라 영향 제한적.
  // Wave 222 (2026-05-19): bag/clothing 추가 — 매물 수 적어 sample<5 흔함. low confidence + samples≥2 허용.
  //   bag 1067건 / clothing 2149건 매물이 condition별 분리 시 5 sample 미달.
  //   사용자 "ready 진입" 우선. 정확성 trade-off 인정 (다른 가품/AD floor + condition 분리로 보완).
  // Wave 773 (2026-05-24): game_console + sport_golf 추가 — 사용자 #8 보고.
  //   Wave 760 narrow SKU 신설 (게임 104 / 골프 62) 후 sample 분산 → n<5 thin_market 차단.
  //   pool 진입 0 (사용자 6h 기다림). low_sample 허용 → ready 진입 + 시세 sample 점진 누적.
  const LOW_SAMPLE_ALLOWED_CATEGORIES = new Set<string>(["shoe", "drone", "lego", "kickboard", "perfume", "bag", "clothing", "game_console", "sport_golf"]);
  if (category && LOW_SAMPLE_ALLOWED_CATEGORIES.has(category)) {
    if (total < 2) return null;
  } else {
    if (total < 3) return null;
    // Wave 885 (2026-05-26 사용자 결정): low confidence 시 sample 5 → 3 완화.
    //   배경: wave99_thin_market_n_lt_5 reason 으로 76 매물 차단 중. 사용자 "3 sample ㄱㄱ".
    //   trade-off: outlier 1건이 median 끌어올릴 위험 늘어남. 그러나 safety nets (msrp×5 ceiling /
    //   4 tier fake floor / Wave 171/152/72/138) 작동 중이라 보호됨. 사용자 합의 후 박음.
    if (stat.confidence === "low" && total < 3) return null;
  }
  // Wave 196 (2026-05-18) Option γ: 신발/가방 — p75/p25 spread > 2x + confidence=low 시 시세 차단.
  //   사용자 발견: 신발 sample에 가품/특가 매물 끼어들어 p25~p75 spread 2~3배. median 비현실적 낮음 →
  //   정상가 매물이 시세보다 비싸 보여 profit_below_pack_band 차단.
  //   spread 큰 시세 = 가품/정상 혼재 신호. confidence=low 결합으로 false positive 보호 (medium/high는 통과).
  //   대상: 신발/가방만 — 가품 risk 큰 카테고리 (msrp×5 ceiling + 4 tier fake floor 와 같은 로직).
  const FAKE_RISK_CATEGORIES = new Set<string>(["shoe", "bag"]);
  if (category && FAKE_RISK_CATEGORIES.has(category) && stat.confidence === "low") {
    const p25 = Number(stat.p25_price ?? 0);
    const p75 = Number(stat.p75_price ?? 0);
    if (p25 > 0 && p75 > 0 && p75 / p25 > 2) {
      return null;
    }
  }
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
  const limit = boundedInt(process.env.PIPELINE_SOURCE_HEALTH_RUN_LIMIT ?? null, 600, 200, 2000);
  const url = `${tableUrl("mvp_collect_runs")}?select=${columns}&started_at=gte.${encodeURIComponent(cutoff)}&order=started_at.desc&limit=${limit}`;
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
    if (bucket.total >= 3 && bucket.failed >= sourceWorkerFailureMinFailed(mode) && rate >= 0.5) {
      return { status: "unhealthy" as const, reason: `${mode}_failure_rate_high` };
    }
  }
  for (const mode of orderedModes) {
    const bucket = workerBreakdown.get(mode);
    if (!bucket || bucket.failed === 0 || bucket.total === 0) continue;
    const rate = bucket.failed / bucket.total;
    if (bucket.total >= 2 && bucket.failed >= sourceWorkerFailureMinFailed(mode) && rate >= 0.2) {
      return { status: "degraded" as const, reason: `${mode}_failure_rate_elevated` };
    }
  }
  return null;
}

function sourceWorkerFailureMinFailed(mode: string) {
  // Deep crawl runs hourly and is a coverage sweep. Two stale failures can linger
  // in the 120m health window after the runtime fix has already recovered, so
  // require a third miss before it drives source status or noisy ops alerts.
  return mode === "deep_crawl" ? 3 : 1;
}

function workerFailureAlerts(
  workerBreakdown: Map<string, { total: number; failed: number; collected: number; enriched: number }>,
  recoveryByMode: Map<string, { latestStatus: string; successStreak: number }> = new Map(),
): OperationalAlert[] {
  const labels: Record<string, string> = {
    tick: "Tick",
    detail_worker: "Detail",
    deep_crawl: "Deep crawl",
    lifecycle_worker: "Lifecycle",
    lifecycle_terminal_recheck: "Lifecycle terminal",
    market_worker: "Market",
    pool_warmer: "Warmer",
    housekeeper: "Housekeeper",
  };
  return [...workerBreakdown.entries()]
    .map(([mode, bucket]) => {
      const failureRate = bucket.total === 0 ? 0 : bucket.failed / bucket.total;
      const minFailed = sourceWorkerFailureMinFailed(mode);
      const severity = bucket.failed >= minFailed && bucket.total >= 3 && failureRate >= 0.2
        ? "critical"
        : bucket.failed >= minFailed && bucket.total >= 3 && failureRate >= 0.05
          ? "warning"
          : null;
      if (!severity) return null;
      const recovery = recoveryByMode.get(mode);
      if (recovery?.latestStatus === "succeeded" && recovery.successStreak >= 2) return null;
      return {
        key: `${mode}_failure_rate_${severity}`,
        severity: severity as "critical" | "warning",
        mode,
        label: labels[mode] ?? mode,
        message: `${labels[mode] ?? mode} worker failure rate ${Math.round(failureRate * 100)}% over source health window`,
        total: bucket.total,
        failed: bucket.failed,
        failureRate: Math.round(failureRate * 1000) / 1000,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1 };
      return severityOrder[a.severity] - severityOrder[b.severity] || b.failureRate - a.failureRate;
    });
}

function workerRecoveryByMode(rows: CollectRunHealthRow[]) {
  const result = new Map<string, { latestStatus: string; successStreak: number }>();
  for (const row of rows) {
    const mode = runMode(row);
    if (!mode || result.has(mode)) continue;
    if (row.status === "running") continue;
    result.set(mode, { latestStatus: row.status, successStreak: 0 });
  }
  for (const [mode, state] of result.entries()) {
    let streak = 0;
    for (const row of rows) {
      if (runMode(row) !== mode) continue;
      if (row.status === "running") continue;
      if (row.status !== "succeeded") break;
      streak += 1;
    }
    state.successStreak = streak;
  }
  return result;
}

function previousOperationalAlerts(previous: SourceHealthRow | null): OperationalAlert[] {
  const raw = asRecord(previous?.baseline_json).operationalAlerts;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const alert = asRecord(item);
      const severity = alert.severity === "critical" || alert.severity === "warning" ? alert.severity : null;
      if (!severity || typeof alert.key !== "string") return null;
      return {
        key: alert.key,
        severity,
        mode: String(alert.mode ?? ""),
        label: String(alert.label ?? alert.mode ?? alert.key),
        message: String(alert.message ?? ""),
        total: Number(alert.total ?? 0),
        failed: Number(alert.failed ?? 0),
        failureRate: Number(alert.failureRate ?? 0),
      };
    })
    .filter((item): item is OperationalAlert => Boolean(item));
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
  // F1 patch (wave2 owner approved): 30→120m to mitigate sparse window + stale claim
  // batch noise. threshold 0.85 + detail_success_rate definition unchanged.
  const windowMinutes = 120;
  let rows: CollectRunHealthRow[];
  let previous: SourceHealthRow | null;
  try {
    rows = await loadRecentCollectRuns(windowMinutes);
    previous = await loadLatestSourceHealth();
  } catch (err) {
    stats.detailFailed += 1;
    stats.poolSkipped += 1;
    console.error("source health stage skipped", {
      error: err instanceof Error ? err.message : String(err),
    });
    return stats;
  }
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

  // F2a patch (wave2 owner approved): denominator = visible outcomes (enriched + detailFailed)
  // 대신 detailAttempts(claimed). stale/no-op/timeout/invisible claim은 분모 제외.
  // threshold 0.85, numerator enriched 정의 그대로. denominator 0이면 neutral 1 유지.
  const detailVisibleOutcomes = detailSucceeded + detailFailed;
  const detailSuccessRate = detailVisibleOutcomes === 0 ? 1 : detailSucceeded / detailVisibleOutcomes;
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
  const recoveryByMode = workerRecoveryByMode(rows);
  const operationalAlerts = workerFailureAlerts(workerBreakdown, recoveryByMode);
  const hysteresis = applySourceHealthHysteresis(proposed, previous);
  const now = new Date().toISOString();
  const notification = await notifyOperationalAlerts({
    source: "bunjang",
    status: hysteresis.status,
    previousStatus: previous?.status ?? null,
    reason: proposed.reason,
    checkedAt: now,
    previousAlerts: previousOperationalAlerts(previous),
    alerts: operationalAlerts,
  });
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
      operationalAlerts,
      alertCount: operationalAlerts.length,
      criticalAlertCount: operationalAlerts.filter((alert) => alert.severity === "critical").length,
      notification,
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

// Wave 138b (2026-05-16): 다중 ID 사기 그룹 hash set load.
// 같은 description_hash + 다른 seller_uid 2+ = 부캐 그룹 → 그 hash 매물 모두 차단.
//
// 2026-05-17 v46 cleanup: 20K row fetch + JS aggregate → DB function (get_fraud_group_hashes).
// 이전: PostgREST 가 GROUP BY HAVING 못 해서 raw fetch + in-memory. 매 score-stage run 마다 20K row.
// 새: DB 안에서 GROUP BY HAVING — 작은 set 반환. 100배 빠름.
const MIN_FRAUD_GROUP_SELLERS = 2;
const VOLUME_GATE_TARGET_READ_CONCURRENCY = Math.max(
  1,
  Math.min(Number(process.env.PIPELINE_VOLUME_GATE_TARGET_READ_CONCURRENCY ?? 24), 32),
);
const VOLUME_GATE_BULK_QUERY_THRESHOLD = Math.max(
  1,
  Math.min(Number(process.env.PIPELINE_VOLUME_GATE_BULK_QUERY_THRESHOLD ?? 128), 200),
);
async function loadFraudGroupHashes(targetHashes?: Iterable<string>): Promise<Set<string>> {
  try {
    const target = Array.from(new Set(Array.from(targetHashes ?? [])
      .map((hash) => String(hash ?? "").trim())
      .filter(Boolean)));
    if (targetHashes && target.length === 0) return new Set();
    if (target.length > 0) {
      const sellerUidsByHash = new Map<string, Set<string>>();
      for (const chunk of chunkArray(target, 100)) {
        const encoded = chunk.map(encodeURIComponent).join(",");
        const url = `${tableUrl("mvp_raw_listings")}?select=description_hash,seller_uid&description_hash=in.(${encoded})&seller_uid=not.is.null&limit=5000`;
        const res = await restFetch(url, { headers: serviceHeaders() });
        const rows = (await res.json()) as Array<{ description_hash: string | null; seller_uid: string | null }>;
        for (const row of rows) {
          if (!row.description_hash || !row.seller_uid) continue;
          const sellers = sellerUidsByHash.get(row.description_hash) ?? new Set<string>();
          sellers.add(row.seller_uid);
          sellerUidsByHash.set(row.description_hash, sellers);
        }
      }
      const hashes = new Set<string>();
      for (const [hash, sellers] of sellerUidsByHash) {
        if (sellers.size >= MIN_FRAUD_GROUP_SELLERS) hashes.add(hash);
      }
      return hashes;
    }

    const configuredTimeoutMs = Number(process.env.PIPELINE_FRAUD_GROUP_HASH_TIMEOUT_MS ?? 8_000);
    const timeoutMs = Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
      ? Math.max(configuredTimeoutMs, 8_000)
      : 8_000;
    const res = await fetch(rpcUrl("get_fraud_group_hashes"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase REST failed ${res.status} POST /rpc/get_fraud_group_hashes: ${body}`);
    }
    const rows = (await res.json()) as Array<{ description_hash: string }>;
    return new Set(rows.map((r) => r.description_hash).filter(Boolean));
  } catch (err) {
    console.warn("loadFraudGroupHashes failed (non-fatal)", err);
    return new Set();
  }
}

// Wave 224 (2026-05-19): SKU 별 매물 빈도 < threshold 차단 — 사용자 정책 "매물 받쳐주는 거만".
//   PostgREST aggregate 직접 호출 어려움 → 매물 sku_id + first_seen_at fetch 후 client 집계.
//   shoe/clothing/bag 카테고리 매물 (현재 12000+) 만 한정.
// Wave 225 (2026-05-19) 사용자 결정 C: "2d<1 OR 7d<3" 결합 — 둘 중 하나만 못 채워도 차단.
//   누적 빈도 (7d≥3) + 최근 회전 빈도 (2d≥1) 둘 다 충족해야 통과.
//   사용자 reveal 직후 다음 매물 답답함 차단.
// Wave 796 (2026-05-27): 당근 source 표본 부족 — sku 당 당근 매물 < 3 차단용.
//   owner 정책: 당근은 안전결제 X 직거래라 시세 정확도 ↑ 필요.
async function loadDaangnVolumeBySku(targetSkuIds?: Iterable<string>): Promise<Map<string, number>> {
  try {
    const since7dIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const all: Array<{ sku_id: string }> = [];
    const PAGE = 1000;
    const hasExplicitTargets = targetSkuIds != null;
    const target = Array.from(new Set(Array.from(targetSkuIds ?? [])
      .map((id) => String(id ?? "").trim())
      .filter(Boolean)));

    if (hasExplicitTargets && target.length === 0) return new Map();

    if (target.length > 0) {
      // Wave 904 (2026-05-28): exact target-SKU volume for the current score batch.
      // The previous top-10K global scan could miss a SKU that is currently being
      // scored, causing false `daangn_volume_below_3` invalidations even when that
      // SKU had plenty of Daangn samples. Querying only batch SKUs is both cheaper
      // and more accurate.
      // Wave 918 follow-up: the pool gate only needs the <3 threshold, not an exact
      // count above 3. Fetch at most 3 rows per target SKU so popular SKUs do not
      // force a large 7-day window scan on every score run.
      if (target.length > VOLUME_GATE_BULK_QUERY_THRESHOLD) {
        for (const chunk of chunkArray(target, 100)) {
          const encoded = chunk.map(encodeURIComponent).join(",");
          let offset = 0;
          while (offset < 50_000) {
            const url = `${tableUrl("mvp_raw_listings")}?select=sku_id&source=eq.daangn&listing_state=eq.active&first_seen_at=gte.${encodeURIComponent(since7dIso)}&sku_id=in.(${encoded})&order=first_seen_at.desc&limit=${PAGE}&offset=${offset}`;
            const res = await restFetch(url, { headers: serviceHeaders() });
            const rows = (await res.json()) as Array<{ sku_id: string }>;
            all.push(...rows);
            if (rows.length < PAGE) break;
            offset += PAGE;
          }
        }
      } else {
        const counts = new Map<string, number>();
        for (const chunk of chunkArray(target, VOLUME_GATE_TARGET_READ_CONCURRENCY)) {
          const results = await Promise.all(chunk.map(async (skuId) => {
            const url = `${tableUrl("mvp_raw_listings")}?select=sku_id&source=eq.daangn&listing_state=eq.active&first_seen_at=gte.${encodeURIComponent(since7dIso)}&sku_id=eq.${encodeURIComponent(skuId)}&order=first_seen_at.desc&limit=3`;
            const res = await restFetch(url, { headers: serviceHeaders() });
            const rows = (await res.json()) as Array<{ sku_id: string }>;
            return [skuId, rows.length] as const;
          }));
          for (const [skuId, count] of results) counts.set(skuId, count);
        }
        return counts;
      }
    } else {
      let offset = 0;
      while (offset < 10000) {
        const url = `${tableUrl("mvp_raw_listings")}?select=sku_id&source=eq.daangn&listing_state=eq.active&first_seen_at=gte.${encodeURIComponent(since7dIso)}&sku_id=not.is.null&order=first_seen_at.desc&limit=${PAGE}&offset=${offset}`;
        const res = await restFetch(url, { headers: serviceHeaders() });
        const rows = (await res.json()) as Array<{ sku_id: string }>;
        all.push(...rows);
        if (rows.length < PAGE) break;
        offset += PAGE;
      }
    }
    const counts = new Map<string, number>();
    for (const r of all) {
      if (!r.sku_id) continue;
      counts.set(r.sku_id, (counts.get(r.sku_id) ?? 0) + 1);
    }
    return counts;
  } catch (err) {
    console.warn("loadDaangnVolumeBySku failed (non-fatal)", err);
    return new Map();
  }
}

async function loadLowVolumeSkuIds(targetSkuIds?: Iterable<string>): Promise<Set<string>> {
  try {
    const since7dIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const since2dMs = Date.now() - 2 * 24 * 3600 * 1000;
    const hasExplicitTargets = targetSkuIds != null;
    const target = Array.from(new Set(Array.from(targetSkuIds ?? [])
      .map((id) => String(id ?? "").trim())
      .filter(Boolean)));
    const maxRows = Number(process.env.PIPELINE_LOW_VOLUME_MAX_ROWS ?? 1_000);
    const all: Array<{ sku_id: string; first_seen_at: string }> = [];
    const PAGE = 1000;

    if (hasExplicitTargets && target.length === 0) return new Set();

    if (target.length > 0) {
      // Wave 904: exact batch-SKU counts avoid the global maxRows window
      // under-counting popular SKUs that are outside the newest page.
      // Wave 918 follow-up: this gate only needs to know whether a SKU has
      // 7d >= 3 and 2d >= 1. Query each target SKU with limit=3 so popular SKUs
      // do not force a large 7-day window scan just to prove they are not sparse.
      if (target.length > VOLUME_GATE_BULK_QUERY_THRESHOLD) {
        for (const chunk of chunkArray(target, 100)) {
          const encoded = chunk.map(encodeURIComponent).join(",");
          let offset = 0;
          while (offset < 50_000) {
            const url = `${tableUrl("mvp_raw_listings")}?select=sku_id,first_seen_at&sku_id=in.(${encoded})&first_seen_at=gte.${encodeURIComponent(since7dIso)}&listing_state=eq.active&order=first_seen_at.desc&limit=${PAGE}&offset=${offset}`;
            const res = await restFetch(url, { headers: serviceHeaders() });
            const rows = (await res.json()) as Array<{ sku_id: string; first_seen_at: string }>;
            all.push(...rows);
            if (rows.length < PAGE) break;
            offset += PAGE;
          }
        }
      } else {
        const lowVolume = new Set<string>();
        for (const chunk of chunkArray(target, VOLUME_GATE_TARGET_READ_CONCURRENCY)) {
          const results = await Promise.all(chunk.map(async (skuId) => {
            const url = `${tableUrl("mvp_raw_listings")}?select=sku_id,first_seen_at&sku_id=eq.${encodeURIComponent(skuId)}&first_seen_at=gte.${encodeURIComponent(since7dIso)}&listing_state=eq.active&order=first_seen_at.desc&limit=3`;
            const res = await restFetch(url, { headers: serviceHeaders() });
            const rows = (await res.json()) as Array<{ sku_id: string; first_seen_at: string }>;
            const hasRecent2d = rows.some((row) => {
              const ts = new Date(row.first_seen_at).getTime();
              return Number.isFinite(ts) && ts >= since2dMs;
            });
            return [skuId, rows.length, hasRecent2d] as const;
          }));
          for (const [skuId, d7, hasRecent2d] of results) {
            if (d7 > 0 && (d7 < 3 || !hasRecent2d)) lowVolume.add(skuId);
          }
        }
        return lowVolume;
      }
    } else {
      let offset = 0;
      while (!Number.isFinite(maxRows) || maxRows <= 0 || all.length < maxRows) {
        const pageLimit = Number.isFinite(maxRows) && maxRows > 0 ? Math.min(PAGE, maxRows - all.length) : PAGE;
        if (pageLimit <= 0) break;
        const url = `${tableUrl("mvp_raw_listings")}?select=sku_id,first_seen_at&sku_id=not.is.null&first_seen_at=gte.${encodeURIComponent(since7dIso)}&listing_state=eq.active&or=(sku_id.like.shoe-%2A,sku_id.like.clothing-%2A,sku_id.like.bag-%2A)&order=first_seen_at.desc&limit=${pageLimit}&offset=${offset}`;
        const res = await restFetch(url, { headers: serviceHeaders() });
        const rows = (await res.json()) as Array<{ sku_id: string; first_seen_at: string }>;
        all.push(...rows);
        if (rows.length < pageLimit) break;
        offset += pageLimit;
      }
    }
    const d7BySku = new Map<string, number>();
    const d2BySku = new Map<string, number>();
    for (const r of all) {
      if (!r.sku_id) continue;
      d7BySku.set(r.sku_id, (d7BySku.get(r.sku_id) ?? 0) + 1);
      const ts = new Date(r.first_seen_at).getTime();
      if (Number.isFinite(ts) && ts >= since2dMs) {
        d2BySku.set(r.sku_id, (d2BySku.get(r.sku_id) ?? 0) + 1);
      }
    }
    // Wave 225: 2d<1 OR 7d<3 (둘 중 하나만 못 채워도 차단).
    const lowVolume = new Set<string>();
    for (const [skuId, d7] of d7BySku) {
      const d2 = d2BySku.get(skuId) ?? 0;
      if (d7 < 3 || d2 < 1) lowVolume.add(skuId);
    }
    return lowVolume;
  } catch (err) {
    console.warn("loadLowVolumeSkuIds failed (non-fatal)", err);
    return new Set();
  }
}

// Wave 138 (2026-05-16): pool에 이미 있는 seller_uid별 매물 수 — buildCandidatePoolRows에 전달.
// 같은 셀러 다수 매물 추가 진입 차단 (qty 위장 업자 탐지).
async function loadExistingPoolSellerCounts(targetSellerUids?: Iterable<string>): Promise<Map<string, number>> {
  try {
    const target = Array.from(new Set(Array.from(targetSellerUids ?? [])
      .map((sellerUid) => String(sellerUid ?? "").trim())
      .filter(Boolean)));
    // pool ready 매물의 pid 가져온 후 raw_listings.seller_uid join (PostgREST 단순 query)
    const poolUrl = `${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.ready&limit=5000`;
    const poolRes = await restFetch(poolUrl, { headers: serviceHeaders() });
    const poolRows = (await poolRes.json()) as Array<{ pid: number }>;
    const pids = poolRows.map((r) => Number(r.pid)).filter(Number.isFinite);
    if (pids.length === 0) return new Map();

    const counts = new Map<string, number>();
    // chunk fetch
    for (const chunk of chunkArray(pids, 500)) {
      const targetFilter = target.length > 0
        ? `&seller_uid=in.(${target.map(encodeURIComponent).join(",")})`
        : "";
      const rawUrl = `${tableUrl("mvp_raw_listings")}?select=seller_uid&pid=in.(${chunk.join(",")})&seller_uid=not.is.null${targetFilter}`;
      const rawRes = await restFetch(rawUrl, { headers: serviceHeaders() });
      const rawRows = (await rawRes.json()) as Array<{ seller_uid: string | null }>;
      for (const r of rawRows) {
        if (!r.seller_uid) continue;
        counts.set(r.seller_uid, (counts.get(r.seller_uid) ?? 0) + 1);
      }
    }
    return counts;
  } catch (err) {
    console.warn("loadExistingPoolSellerCounts failed", err);
    return new Map();
  }
}

// Wave 135 (2026-05-16): launch event load — 영향 comparable_key + event_date 매핑.
// 시세 산정 시 event_date 이전 매물에 weight multiplier (default 0.3) 적용.
// 사업 보고서 L5b — 신모델 launch 시점 옛 baseline 무시.
type LaunchEvent = {
  affected_comparable_key: string;
  event_date: string; // ISO date 'YYYY-MM-DD'
  pre_event_weight: number;
  effective_until: string | null;
};
async function loadLaunchEvents(): Promise<LaunchEvent[]> {
  try {
    const url = `${tableUrl("mvp_launch_events")}?select=affected_comparable_key,event_date,pre_event_weight,effective_until&order=event_date.desc&limit=500`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    if (!res.ok) return [];
    const rows = (await res.json()) as LaunchEvent[];
    const today = kstDateString();
    // effective_until 지난 event 제외 (still in effect만)
    return rows.filter((r) => !r.effective_until || r.effective_until >= today);
  } catch (err) {
    console.warn("loadLaunchEvents failed (non-fatal)", err);
    return [];
  }
}

// 매물 observedAt이 launch event event_date 이전이면 multiplier 반환. 없으면 1.
function launchEventMultiplier(
  comparableKey: string,
  observedAt: string | null,
  events: LaunchEvent[],
): number {
  if (!observedAt || events.length === 0) return 1;
  let multiplier = 1;
  for (const ev of events) {
    if (ev.affected_comparable_key !== comparableKey) continue;
    // observedAt (ISO datetime) vs event_date (YYYY-MM-DD) — string 비교 OK (ISO 정렬됨)
    if (observedAt < ev.event_date) {
      multiplier = Math.min(multiplier, ev.pre_event_weight); // 가장 강한 reset
    }
  }
  return multiplier;
}

async function upsertMarketPriceDaily(rows: ScorableRawRow[], parsedByPid: Map<number, ParsedListingRow>) {
  // Wave 135: launch event 로드 (없으면 모든 multiplier 1 = no-op).
  const launchEvents = await loadLaunchEvents();
  // Wave 90: 시세 집계에서 risk_hits>0 매물 제외 (사용자 지적 — 분실/도난/침수 매물이
  // 시세 평균 끌어내림). mvp_listing_analysis batch fetch로 risk_hits 가져옴.
  // analysis row 없는 매물 (아직 score 안 된 새 매물) → 일단 포함 (default safe).
  const safeByPid = new Map<number, boolean>();
  if (rows.length > 0) {
    const pids = rows.map((r) => r.pid);
    for (const chunk of chunkArray(pids, REST_READ_CHUNK_SIZE)) {
      const res = await restFetch(
        `${tableUrl("mvp_listing_analysis")}?select=pid,risk_hits&pid=in.(${chunk.join(",")})`,
        { headers: serviceHeaders() },
      );
      const analyses = (await res.json()) as Array<{ pid: number; risk_hits: number }>;
      for (const a of analyses) safeByPid.set(Number(a.pid), Number(a.risk_hits ?? 0) === 0);
    }
  }

  // Wave 130 (2026-05-16): condition_class별 시세 분리 — 사업 보고서 L2 retention factor.
  // 같은 SKU+옵션 매물이라도 condition별 시세 spread 15~40% 측정됨.
  // 예: airpods_max|usbc mint 550K vs worn 430K, airpods_4_anc mint 210K vs normal 150K.
  //
  // 변경 (Wave 90/91/106 기존 hard filter 정책 통합):
  // - 차단 유지 (시세 sample 제외):
  //   * flawed class (display_defect/screen_replaced/faceid_issue/parts_only/water_damage/locked 등)
  //   * accessory_bundle (본품+액세서리 — 단품 시세와 비교 noisy)
  //   * multi_device_bundle (다른 카테고리 본품 묶임)
  // - condition별 grouping (각각 별도 시세):
  //   * mint (new_or_open_box) — 새상품 시세
  //   * clean (good_condition/full_set/applecare_premium) — 프리미엄 시세
  //   * worn (cosmetic_wear) — 사용감 매물 시세
  //   * low_batt (low_battery_health) — 배터리 저하 시세
  //   * normal — 마킹 없거나 일반 사용 매물 (default)
  //
  // grouping key: `${comparable_key}|${condition_class}`. upsert 시 PK (date, comparable_key, condition_class).
  // Wave 722 / Stage 5 (2026-05-23): shoe/clothing 만 추가 conditionTier 별 시세 분리 — launch-78 후속.
  //   같은 condition_class('clean') 안에 tier S/A/B/C/D 매물이 섞여 D급 시세 부정확. tier별 별도 row 추가.
  //   다른 카테고리는 conditionTier=null → 기존 (comparable_key, condition_class) 별 1개 row 유지.
  const byKey = new Map<string, {
    comparableKey: string;
    conditionClass: string;
    conditionTier: string;  // Wave 722: shoe/clothing은 S/A/B/C/D/UNKNOWN, 그 외는 '' (sentinel)
    rows: ScorableRawRow[];
    activeRows: ScorableRawRow[];
    soldRows: ScorableRawRow[];
    disappearedRows: ScorableRawRow[];
    skuId: string | null;
  }>();
  for (const row of rows) {
    const parsed = parsedByPid.get(row.pid);
    if (!parsed?.comparable_key || Number(parsed.parse_confidence ?? 0) < 0.65 || parsed.needs_review) continue;
    // risk_hits>0 매물 제외 (analysis 없으면 default safe)
    if (safeByPid.has(row.pid) && safeByPid.get(row.pid) === false) continue;
    // 2026-05-16: placeholder price 제외 (999999999, 111111111 등 "교환원함"/"분실"/"판매완료" 류).
    // Wave 218 (2026-05-19): isPlaceholderPrice 헬퍼 — 같은 자리수 반복 패턴 추가.
    if (isPlaceholderPrice(row.price)) continue;
    // Wave 719 (2026-05-23): 카테고리별 outlier 차단 — 정상 시세 5-10배 매물은 시세 산정 제외.
    if (isPriceOutlierForSku(row.price, row.sku_id)) continue;

    const conditionNotes = parsed.condition_notes
      ?? (parsed.parsed_json?.condition_notes as string[] | undefined)
      ?? [];
    // Wave 130: flawed class (손상/문제 매물) 시세 산정 차단 — 현재 정책 유지.
    // condition_class column이 채워져 있으면 그대로, 아니면 condition_notes에서 즉시 derive.
    const conditionClass = parsed.condition_class ?? extractConditionClass(conditionNotes);
    if (conditionClass === "flawed") continue;
    // Wave 130: bundle 매물은 단품 시세와 비교 noisy → 차단 유지 (Wave 90 정책).
    // accessory_bundle/multi_device_bundle은 condition_class와 별도 — bundle 자체가 noise.
    if (conditionNotes.includes("accessory_bundle")) continue;
    if (conditionNotes.includes("multi_device_bundle")) continue;

    // 2026-05-15 (사용자 코멘트 pid 404436811 / 404643880 / 401500642):
    // missing_suspect 매물이 6시간+ 안 보이면 사실상 사라진 상태. lifecycle worker가
    // disappeared로 전환 안 했더라도 시세 비교군에서 빼서 옛 매물 잔존 왜곡 방지.
    // 1~6시간 missing은 짧은 hiccup 가능성 있어 유지.
    if (row.listing_state === "missing_suspect" && row.last_missing_at) {
      const missingMs = Date.now() - new Date(row.last_missing_at).getTime();
      if (missingMs > 6 * 3600 * 1000) continue;
    }
    const effectiveState = isActiveSaleStatus(row.sale_status) ? row.listing_state : "sold_confirmed";
    // Wave 520: 신발 가격 시세는 exact size key와 size_any 보조 key를 함께 산정한다.
    // 사용자는 "사이즈별 가격은 크게 달라지지 않는다"고 봤고, 회전률/특이 사이즈 보정은 별도 wave로 보류.
    // exact key는 유지하고, score 단계에서 exact median이 부족할 때만 size_any를 fallback으로 사용한다.
    const comparableKeys = [
      parsed.comparable_key,
      shoeSizeAgnosticComparableKey(parsed.comparable_key),
    ].filter((key): key is string => Boolean(key));
    // Wave 722 hotfix (2026-05-23 13:00 UTC): tier-aware grouping 일시 revert.
    //   schema PK 3-col로 rollback됨 — tier 추가하면 PK violation 발생.
    //   condition_tier 컬럼은 유지하되 aggregation 그룹핑에는 제외. 다음 cycle에서 재migration.
    const conditionTier = ""; // sentinel — tier-bucketing 미적용 (Wave 722 rollback)
    for (const comparableKey of comparableKeys) {
      // Wave 130: grouping key = (comparable_key, condition_class). 같은 SKU+옵션이라도
      // condition별 별도 시세 산정.
      const key = `${comparableKey}|${conditionClass}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          comparableKey,
          conditionClass,
          conditionTier,
          rows: [],
          activeRows: [],
          soldRows: [],
          disappearedRows: [],
          skuId: row.sku_id,
        });
      }
      const group = byKey.get(key)!;
      group.rows.push(row);
      if (effectiveState === "sold_confirmed") group.soldRows.push(row);
      else if (effectiveState === "disappeared") group.disappearedRows.push(row);
      else group.activeRows.push(row);
    }
  }

  const today = kstDateString();
  // Wave 130: byKey iter — comparable_key는 group.comparableKey에서, condition_class는 group.conditionClass에서.
  // Wave 131 (2026-05-16): exponential decay weight 시세 산정에 wire-up — 사업 보고서 L5.
  //   "30일 데이터 단순 평균 X. 최근 7일 weight 3x." (보고서 권장).
  //   observedAt = source_updated_at (셀러가 매물 갱신한 시각). null이면 last_seen_at fallback.
  //   옛 매물 = 안 팔리는 매물 = 호가 inflated → decay weight ↓ → 시세 정확도 ↑.
  // Wave 135: 각 매물의 launch event multiplier 사전 계산 (comparable_key + observedAt 기반).
  const toSellerPriced = (r: ScorableRawRow, comparableKey: string) => {
    const observedAt = r.source_updated_at ?? r.last_seen_at ?? null;
    return {
      pid: r.pid,
      price: r.price,
      seller_uid: r.seller_uid,
      observedAt,
      weightMultiplier: launchEventMultiplier(comparableKey, observedAt, launchEvents),
    };
  };
  // Wave 142 (2026-05-16): 시세 집계 전 가품 매물 제외 (신발/가방 카테고리).
  // pool 진입 (Wave 141)뿐 아니라 시세 계산 자체에서도 가품 매물 제외 —
  // 안 그러면 시세 평균이 가품 매물(9k~20k)에 끌어내려져서 일반 매물도 fake_suspect로 차단됨 (악순환).
  // 발견: samba_og_broad min_price 13k, 990v5 min 9k 등 — msrp의 5% 매물 다수.
  // Wave 196 (2026-05-18) Option α: 0.15 → 0.25 강화.
  //   사용자 발견: 신발 시세 p25~p75 spread 2~3배. 가품/특가 매물이 sample에 다수 끼어들어 median
  //   비현실적 낮음 (예: dunk_low 230 median 30K vs msrp 129K, ratio 23%). msrp×15% 차단으론 부족.
  //   0.25로 올려서 더 많은 저가 매물 차단 → median 정상화. 단 정상 사용감 큰 매물 (예: chuck70 230)
  //   일부 차단 가능 — recall ↓ but precision ↑ trade-off. §12b 정확성 우선.
  // Wave 198 (2026-05-18): clothing 카테고리 추가 + ratio 0.30 (의류 가품 risk ↑).
  //   사용자 정책 — 의류는 신발보다 가품 시장 더 큼.
  const FAKE_FLOOR_CATEGORIES_MARKET = new Set<string>(["shoe", "bag", "clothing"]);
  const FAKE_FLOOR_RATIO_MARKET = (category: string) => category === "clothing" ? 0.30 : 0.25;
  // Wave 171: price ceiling outlier 시세 제외 (msrp의 5배 초과 = 콜라보/한정/inflate)
  const FAKE_CEILING_RATIO_MARKET = 5;
  for (const group of byKey.values()) {
    if (!group.skuId) continue;
    const sku = skuById(group.skuId);
    if (!sku?.msrpKrw) continue;
    if (!FAKE_FLOOR_CATEGORIES_MARKET.has(sku.category)) continue;
    const floor = sku.msrpKrw * FAKE_FLOOR_RATIO_MARKET(sku.category);
    const ceiling = sku.msrpKrw * FAKE_CEILING_RATIO_MARKET;
    group.activeRows = group.activeRows.filter((r) => r.price >= floor && r.price <= ceiling);
    group.soldRows = group.soldRows.filter((r) => r.price >= floor && r.price <= ceiling);
    group.disappearedRows = group.disappearedRows.filter((r) => r.price >= floor && r.price <= ceiling);
  }

  // Wave 163 (2026-05-16): 시세 집계에서 광고 매물 제외 (사용자 지적).
  // 발견: NB 327 광고 76건 (avg 206k) vs 정상 81건 (avg 69k) — 광고가 시세 3배 끌어올림.
  // Wave 148 광고 차단 패턴을 시세에도 적용. raw_listings.description_preview 검사.
  // pid → description map 미리 만들기 (rows 전체에서 한 번만).
  const AD_PATTERNS_MARKET = [
    /\[구매하기\]/,
    /요청\s*사항에\s*(원하|색상|사이즈)/,
    /배송\s*평균\s*\d/,
    /배송\s*기간\s*평균/,
    /주문\s*방법/,
    /행사\s*할인\s*특가/,
    /행사\s*기간/,
    /행사\s*기간\s*후\s*금액/,
    /가격\s*변동\s*있을/,
    /안심[이]?\s*하게\s*주문/,
    /즐거운\s*쇼핑\s*되세요/,
    /주문\s*확인\s*후\s*영업일\s*기준/,
    /배송주기\s*[1-9]/,
    /최대한\s*빨리\s*발송하겠습니다/,
    /다른\s*문의사항이\s*있으시면\s*연락/,
    /수령\s*후\s*불만족\s*시\s*환불/,
    /본\s*제품은\s*100%/,
    /별도\s*문의\s*없으시면\s*바로안전결제/,
    /[1-9]、/,
    /\b2[2-9]\d\s*[,\/]\s*2[2-9]\d\s*[,\/]\s*2[2-9]\d\s*[,\/]\s*2[2-9]\d/,
    /100\s*배\s*환불/,
    /만에하나\s*가품/,
    /정품임을\s*자신/,
    /해외(?:에서)?\s*대량\s*병행수입/,
    // Wave 164: 광고/가품 추가 12개
    /1000\s*%\s*환불/,
    /재고\s*많지\s*않/,
    /필요한\s*분은\s*안심\s*결제/,
    /FuelCell\s*폼.*탄성을\s*받는/i,
    /ENCAP\s*미드솔\s*쿠셔닝/i,
    /Pigskin\s*Suede.*합성\s*가죽/i,
    /캐주얼\s*경량\s*내진/,
    /신상품이라\s*상태는\s*양호/,
    /원하시는\s*사이즈로\s*주문\s*부탁/,
    /모든\s*사이즈가?\s*구비/,
    /안심하고\s*구매하세요/,
    /택[·.]\s*비닐\s*그대로\s*보관/,
    // Wave 165: 이모지 + 광고 형식 (가품 셀러 전형)
    /📢\s*판매\s*상품/,
    /✔️\s*정품\s*100\s*%\s*보장/,
    /🚚\s*주문\s*시\s*당일\s*발송/,
    /📸\s*모든\s*상품은\s*실보유\s*실사진/,
    /전상품\s*100\s*%\s*정품/,
    /크림\s*계정\s*다수\s*총\s*[0-9]+\s*건/,
    /정품\s*100\s*%\s*보장.*컨디션\s*[sSaA]급/,
    /✔[️]?\s*정품\s*100\s*%\s*보장/,
    // Wave 177 (2026-05-17): 개인 결제창 사기 매물 (사용자 코멘트 pid 406085654).
    /개인\s*결제창/,
    /[가-힣A-Za-z]+\*+[가-힣A-Za-z]?\s*고객님/,
    /고객님\s*(?:개인|전용)\s*(?:결제|페이지|링크)/,
    // Wave 198 (2026-05-18): 의류 카테고리 특화 가품 광고 패턴 — 시세 sample 정정.
    /S\s*급\s*(?:미러|레플리카|급)/i,
    /\b(?:rep|replica|미러급|미러 급)\b/i,
    /복각|이미테이션|imitation/i,
    /고퀄리티\s*복각/,
    /오프\s*화이트\s*공구/,
    /택\s*그대로\s*보관/,
  ];
  const adPidSet = new Set<number>();
  for (const row of rows) {
    if (!row.description_preview) continue;
    if (AD_PATTERNS_MARKET.some((re) => re.test(row.description_preview!))) {
      adPidSet.add(row.pid);
    }
  }
  if (adPidSet.size > 0) {
    for (const group of byKey.values()) {
      // shoe/bag 카테고리만 적용 (전자기기는 광고 매물 적음)
      if (!group.skuId) continue;
      const sku = skuById(group.skuId);
      if (!sku || !FAKE_FLOOR_CATEGORIES_MARKET.has(sku.category)) continue;
      group.activeRows = group.activeRows.filter((r) => !adPidSet.has(r.pid));
      group.soldRows = group.soldRows.filter((r) => !adPidSet.has(r.pid));
      group.disappearedRows = group.disappearedRows.filter((r) => !adPidSet.has(r.pid));
    }
  }

  const marketRows = [...byKey.values()].map((group) => {
    const comparableKey = group.comparableKey;
    // Wave 135: comparableKey를 toSellerPriced에 전달 → launch event multiplier 적용.
    const active = decayTrimmedSellerMarket(group.activeRows.map((r) => toSellerPriced(r, comparableKey)));
    const sold = decayTrimmedSellerMarket(group.soldRows.map((r) => toSellerPriced(r, comparableKey)));
    const disappeared = decayTrimmedSellerMarket(group.disappearedRows.map((r) => toSellerPriced(r, comparableKey)));
    const activeMedian = active.median;
    const soldMedian = sold.median;
    const disappearedMedian = disappeared.median;
    // 2026-05-15 (사용자 베타테스터 보고): sold ≥ 5 미만이면 active 100% fallback 됐었음.
    // 예: iPad 10세대 sold=4, active=22 → blended가 active median(38만)만 박힘 → 실제 거래가(35만) 무시.
    // 2026-05-18 Wave 221: sold 1건을 50%로 섞으면 저가 거래 1건이 시세를 붕괴시킴.
    // sold 표본이 적을수록 active anchor를 더 강하게 유지하고, sold 표본이 쌓이면 거래가 가중치를 높인다.
    const blendedMedian = (() => {
      if (soldMedian != null && activeMedian != null) {
        if (sold.count >= 8 && active.count >= 5) return Math.round((soldMedian * 0.7) + (activeMedian * 0.3));
        if (sold.count >= 5) return Math.round((soldMedian * 0.6) + (activeMedian * 0.4));
        if (sold.count >= 3) return Math.round((soldMedian * 0.45) + (activeMedian * 0.55));
        if (sold.count >= 1 && active.count >= 5) return Math.round((soldMedian * 0.3) + (activeMedian * 0.7));
        if (sold.count >= 1 && active.count >= 3) return Math.round((soldMedian * 0.25) + (activeMedian * 0.75));
        if (sold.count >= 1) return Math.round((soldMedian * 0.4) + (activeMedian * 0.6));
      }
      if (soldMedian != null && sold.count >= 1) return soldMedian;
      if (activeMedian != null) {
        // 2026-05-15: sold 0건 + 호가만 → 호가 × 0.92 (한국 중고시장 평균 네고율 5~15% 중간값 추정).
        // 호가 100%는 비현실적 — 셀러 부른 가격이고 실거래는 보통 낮음. 보수적 추정 (정확성 > recall, LAUNCH_PLAN §12b).
        // TODO (2026-05-29 이후, 베타 데이터 1~2주 누적 후): 실제 거래 vs 호가 차이 측정해서 카테고리별 factor로 교체.
        // 측정 방법 — 사용자 카드 클릭 → 번개장터 가서 거래 시도 결과 telegram 피드백 → A/B 데이터로 0.92 검증.
        // 카테고리별 추정치: 휴대폰 ~0.95 (네고율 5%), 가전/노트북 ~0.88 (네고율 12%), 패션 ~0.80 (네고율 20%).
        return Math.round(activeMedian * 0.92);
      }
      return disappearedMedian != null && disappeared.count >= 8
        ? Math.round(disappearedMedian * 0.9)
        : disappearedMedian;
    })();
    const confidenceBasis = sold.count >= 8 ? sold.count : active.count;
    const confidence = confidenceBasis >= 20 ? "high" : confidenceBasis >= 8 ? "medium" : "low";
    return {
      date: today,
      comparable_key: comparableKey,
      // Wave 130: condition_class — PK 일부. condition별 별도 row.
      condition_class: group.conditionClass,
      // Wave 722 / Stage 5 (2026-05-23): shoe/clothing 만 tier 박힘. 다른 카테고리는 null.
      condition_tier: group.conditionTier,
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

  // Wave 130: PK (date, comparable_key, condition_class) — condition별 별도 upsert.
  // Wave 722 hotfix (2026-05-23 13:00 UTC): tier-aware 일시 rollback.
  //   파일 13:00 시점에 production cron 3+시간 정체 발견.
  //   4-col PK + partial unique index 시도했으나 PostgREST가 partial index의 WHERE 전달 안 함 → 매칭 실패.
  //   schema PK 3-col로 rollback + 코드도 3-col on_conflict로 revert.
  //   condition_tier 컬럼은 유지 (data 손실 X). 다음 cycle에서 더 안전한 방식으로 재migration.
  //   Plan: code deploy 완료 확인 후 schema migration → 시간차 원인 차단.
  await upsertRows("mvp_market_price_daily", marketRows, "date,comparable_key,condition_class");

  // Wave 886 (2026-05-26 사용자 결정): per-source 시세 통계 — 당근 전용 시세 박기.
  //   배경: 동일 SKU/condition 매물도 source 별 가격 35-44% 차이 (당근이 번장의 56-67%).
  //     fee 보정만으론 부족 (fee 차이 5-10% 수준).
  //   기존 marketRows (mixed) 는 그대로 박음. 추가 per-source row 도 박음.
  //   비파괴: 새 테이블 mvp_market_price_daily_per_source 신설 (Migration wave886).
  //   사용 (candidate-pool-builder, 별도 PR): 매물 source 일치 sample ≥ 3 → per-source median, 부족 → mixed fallback.
  const perSourceMarketRows: Array<Record<string, unknown>> = [];
  for (const group of byKey.values()) {
    const comparableKey = group.comparableKey;
    type SrcBucket = { active: typeof group.activeRows; sold: typeof group.soldRows; disappeared: typeof group.disappearedRows };
    const sourceGroups = new Map<string, SrcBucket>();
    const ensureBucket = (src: string): SrcBucket => {
      let bucket = sourceGroups.get(src);
      if (!bucket) {
        bucket = { active: [], sold: [], disappeared: [] };
        sourceGroups.set(src, bucket);
      }
      return bucket;
    };
    for (const row of group.activeRows) {
      const src = (row.source ?? "").trim();
      if (!src) continue;
      ensureBucket(src).active.push(row);
    }
    for (const row of group.soldRows) {
      const src = (row.source ?? "").trim();
      if (!src) continue;
      ensureBucket(src).sold.push(row);
    }
    for (const row of group.disappearedRows) {
      const src = (row.source ?? "").trim();
      if (!src) continue;
      ensureBucket(src).disappeared.push(row);
    }
    for (const [src, srcRows] of sourceGroups) {
      const srcActive = decayTrimmedSellerMarket(srcRows.active.map((r) => toSellerPriced(r, comparableKey)));
      const srcSold = decayTrimmedSellerMarket(srcRows.sold.map((r) => toSellerPriced(r, comparableKey)));
      const srcDisappeared = decayTrimmedSellerMarket(srcRows.disappeared.map((r) => toSellerPriced(r, comparableKey)));
      if (srcActive.count === 0 && srcSold.count === 0 && srcDisappeared.count === 0) continue;
      const srcActiveMedian = srcActive.median;
      const srcSoldMedian = srcSold.median;
      const srcDisappearedMedian = srcDisappeared.median;
      // blended logic — 기존 marketRows 와 동일 (Wave 130/221 정책).
      const srcBlendedMedian = (() => {
        if (srcSoldMedian != null && srcActiveMedian != null) {
          if (srcSold.count >= 8 && srcActive.count >= 5) return Math.round((srcSoldMedian * 0.7) + (srcActiveMedian * 0.3));
          if (srcSold.count >= 5) return Math.round((srcSoldMedian * 0.6) + (srcActiveMedian * 0.4));
          if (srcSold.count >= 3) return Math.round((srcSoldMedian * 0.45) + (srcActiveMedian * 0.55));
          if (srcSold.count >= 1 && srcActive.count >= 5) return Math.round((srcSoldMedian * 0.3) + (srcActiveMedian * 0.7));
          if (srcSold.count >= 1 && srcActive.count >= 3) return Math.round((srcSoldMedian * 0.25) + (srcActiveMedian * 0.75));
          if (srcSold.count >= 1) return Math.round((srcSoldMedian * 0.4) + (srcActiveMedian * 0.6));
        }
        if (srcSoldMedian != null && srcSold.count >= 1) return srcSoldMedian;
        if (srcActiveMedian != null) return Math.round(srcActiveMedian * 0.92);
        return srcDisappearedMedian != null && srcDisappeared.count >= 8
          ? Math.round(srcDisappearedMedian * 0.9)
          : srcDisappearedMedian;
      })();
      const srcConfidenceBasis = srcSold.count >= 8 ? srcSold.count : srcActive.count;
      const srcConfidence = srcConfidenceBasis >= 20 ? "high" : srcConfidenceBasis >= 8 ? "medium" : "low";
      perSourceMarketRows.push({
        date: today,
        comparable_key: comparableKey,
        condition_class: group.conditionClass ?? "",
        // Wave 893 (2026-05-28): table PK has condition_tier NOT NULL DEFAULT ''.
        // Passing JSON null bypasses the default and makes the whole per-source upsert fail silently.
        condition_tier: group.conditionTier ?? "",
        source: src,
        ...marketKeyMeta(comparableKey, group.skuId),
        active_median_price: srcActiveMedian,
        sold_median_price: srcSoldMedian,
        blended_median_price: srcBlendedMedian,
        p25_price: srcActive.p25,
        p75_price: srcActive.p75,
        active_sample_count: srcActive.count,
        sold_sample_count: srcSold.count,
        disappeared_sample_count: srcDisappeared.count,
        confidence: srcConfidence,
        computed_at: new Date().toISOString(),
      });
    }
  }
  if (perSourceMarketRows.length > 0) {
    // 비파괴 — fire-and-catch. 실패해도 기존 mvp_market_price_daily 영향 X.
    try {
      await upsertRows(
        "mvp_market_price_daily_per_source",
        perSourceMarketRows,
        "date,comparable_key,condition_class,condition_tier,source",
      );
    } catch (err) {
      console.warn("[wave886] per-source upsert failed (non-fatal)", err instanceof Error ? err.message : String(err));
    }
  }

  return {
    keyCount: marketRows.length,
    sampleCount: marketRows.reduce((sum, row) => sum + row.active_sample_count + row.sold_sample_count + row.disappeared_sample_count, 0),
  };
}

export async function marketStatsStage(): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const pendingInvalidations = await loadPendingMarketInvalidations();
  const pendingPrefixCounts = countMarketInvalidationPrefixes(pendingInvalidations);
  stats.timingsMs = {
    ...(stats.timingsMs ?? {}),
    market_invalidation_claimed_keys: pendingInvalidations.length,
    market_invalidation_claimed_joongna_keys: pendingInvalidations.filter((row) => row.affected_source === "joongna").length,
    market_invalidation_claimed_shoe_keys: pendingPrefixCounts.shoe ?? 0,
    market_invalidation_claimed_clothing_keys: pendingPrefixCounts.clothing ?? 0,
  };
  const pendingKeys = new Set(pendingInvalidations.map((row) => row.comparable_key));
  const attemptedPendingKeys = new Set<string>();
  const rescuedPendingKeys = new Set<string>();
  const failedPendingKeys = new Set<string>();
  const invalidationKeyChunkSize = marketInvalidationKeyChunkSize();
  const invalidationRowsPerKeyChunk = marketInvalidationParsedRowsPerKeyChunk();
  const invalidationRescueRowsPerKey = marketInvalidationRescueRowsPerKey();
  stats.timingsMs = {
    ...(stats.timingsMs ?? {}),
    market_invalidation_key_chunk_size: invalidationKeyChunkSize,
    market_invalidation_parsed_rows_per_key_chunk: invalidationRowsPerKeyChunk,
    market_invalidation_rescue_rows_per_key: invalidationRescueRowsPerKey,
  };
  const invalidatedParsedByPid = await loadParsedRowsByComparableKeys([...pendingKeys], config.marketStatsLimit, {
    includeParsedJson: false,
    keyChunkSize: invalidationKeyChunkSize,
    maxRowsPerKeyChunk: invalidationRowsPerKeyChunk,
    rescueRowsPerKey: invalidationRescueRowsPerKey,
    onAttemptedKeys: (keys) => {
      for (const key of keys) attemptedPendingKeys.add(key);
    },
    onRescuedKeys: (keys) => {
      for (const key of keys) rescuedPendingKeys.add(key);
    },
    onFailedKeys: (keys) => {
      for (const key of keys) failedPendingKeys.add(key);
    },
  });
  const remainingSiblingLimit = Math.max(0, config.marketStatsLimit - invalidatedParsedByPid.size);
  const siblingParsedByPid = remainingSiblingLimit > 0
    ? await loadParsedRowsByShoeSizeSiblingKeys([...pendingKeys], remainingSiblingLimit, {
      includeParsedJson: false,
      keyChunkSize: invalidationKeyChunkSize,
      maxRowsPerKeyChunk: Math.min(500, invalidationRowsPerKeyChunk),
    })
    : new Map<number, ParsedListingRow>();
  for (const [pid, parsed] of siblingParsedByPid.entries()) {
    if (!invalidatedParsedByPid.has(pid)) invalidatedParsedByPid.set(pid, parsed);
  }
  const invalidatedPids = [...invalidatedParsedByPid.keys()];
  stats.timingsMs = {
    ...(stats.timingsMs ?? {}),
    market_invalidation_parsed_rows: invalidatedParsedByPid.size,
    market_invalidation_sibling_rows: siblingParsedByPid.size,
    market_invalidation_attempted_keys: attemptedPendingKeys.size,
    market_invalidation_deferred_keys: Math.max(0, pendingKeys.size - attemptedPendingKeys.size),
    market_invalidation_rescued_keys: rescuedPendingKeys.size,
    market_invalidation_failed_keys: failedPendingKeys.size,
  };
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
  // Once a pending key has been loaded and the current eligible sample was inspected,
  // close the invalidation even if no row survived the active/sold/disappeared filters.
  // Otherwise low-sample or now-ineligible comparable_keys stay pending forever and make
  // the market queue look permanently backlogged.
  const completedInvalidationKeys = pendingInvalidations.length > 0
    ? [...new Set([...attemptedPendingKeys, ...recomputedKeys])]
    : recomputedKeys;
  const closedInvalidations = await markMarketInvalidationsDone(completedInvalidationKeys);
  // P0-5: 시세가 갱신된 comparable_key의 raw_listings는 score를 재계산해야 한다.
  // 같은 매물이라도 trustedMedian이 바뀌면 priceGap/score가 달라지므로 dirty=true.
  const markedDirty = await markRawScoreDirtyByComparableKeys(recomputedKeys).catch((err) => {
    console.error("mark raw score dirty by comparable keys failed", err);
    return { candidateRows: 0, markedRows: 0 };
  });
  // Wave 714c (2026-05-23): lane unblock 시 stale invalidated 매물 자동 재평가.
  //   Wave 678/679 에서 4 의류 lane 풀어줬는데 candidate_pool 의 invalidated row 안 reset 발견.
  //   매 tick 마다 LANE_READINESS check 해서 ready 인 lane 의 stale invalidated → score_dirty=true.
  const staleLaneRescored = await markStaleLaneBlockedScoreDirty().catch((err) => {
    console.error("mark stale lane_blocked score dirty failed", err);
    return 0;
  });
  if (staleLaneRescored > 0) {
    console.log(`[wave714c] stale lane_blocked invalidated rescored: ${staleLaneRescored} rows`);
  }
  // Wave 191 (2026-05-18): reveal row 의 current_profit 자동 재계산.
  //   recomputedKeys 의 comparable_key 가 reveal 매물의 키와 매칭되면 그 reveal 의
  //   current_profit_min/max + market_invalidated_at 갱신. 시세 < 매입가 → /me 에서 판매완료처럼 접힘.
  //   snapshot (expected_profit_*) 는 reveal 시점 historical 그대로 유지.
  //   RPC `recompute_reveal_current_profits` (Wave 190 migration) — single batch query.
  let revealRecomputeStats = { updated: 0, invalidated: 0 };
  if (recomputedKeys.length > 0) {
    try {
      const recRes = await restFetch(rpcUrl("recompute_reveal_current_profits"), {
        method: "POST",
        headers: serviceHeaders(),
        body: jsonBody({ p_comparable_keys: recomputedKeys }),
      });
      const recRows = (await recRes.json().catch(() => [])) as Array<{ updated_count?: number; invalidated_count?: number }>;
      revealRecomputeStats = {
        updated: Number(recRows[0]?.updated_count ?? 0),
        invalidated: Number(recRows[0]?.invalidated_count ?? 0),
      };
    } catch (err) {
      console.error("recompute_reveal_current_profits failed (non-fatal)", { err: err instanceof Error ? err.message : String(err) });
    }
  }
  stats.scored = rows.length;
  stats.upserted = result.keyCount;
  stats.poolUpserted = result.sampleCount;
  stats.queued = pendingInvalidations.length;
  stats.enriched = closedInvalidations;
  stats.timingsMs = {
    ...(stats.timingsMs ?? {}),
    market_score_dirty_candidate_rows: markedDirty.candidateRows,
    market_score_dirty_marked_rows: markedDirty.markedRows,
    reveal_current_profit_updated: revealRecomputeStats.updated,
    reveal_current_profit_invalidated: revealRecomputeStats.invalidated,
  };
  return stats;
}

type PoolInvalidationEntry = {
  pid: number;
  reason: string;
  category?: Sku["category"] | null;
  comparable_key?: string | null;
  condition_class?: string | null;
};

type PoolReadyFloorState = {
  deferCleanup: boolean;
  readyCount: number;
  threshold: number;
};

async function loadPoolReadyFloorState(): Promise<PoolReadyFloorState> {
  const threshold = Number(process.env.PIPELINE_POOL_CLEANUP_MIN_READY ?? 450);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return { deferCleanup: false, readyCount: -1, threshold: 0 };
  }
  try {
    const res = await restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.ready&limit=5000`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as Array<{ pid: number | string }>;
    const readyCount = rows.length;
    return { deferCleanup: readyCount < threshold, readyCount, threshold };
  } catch (err) {
    console.warn("pool ready floor check failed; deferring cleanup for safety", err);
    return { deferCleanup: true, readyCount: -1, threshold };
  }
}

async function filterPoolInvalidationsForReadyFloor(
  entries: PoolInvalidationEntry[],
  floor: PoolReadyFloorState,
): Promise<{ entries: PoolInvalidationEntry[]; deferred: number }> {
  if (!floor.deferCleanup || entries.length === 0) return { entries, deferred: 0 };
  const pids = [...new Set(entries.map((entry) => Number(entry.pid)).filter(Number.isFinite))];
  const protectedPids = new Set<number>();
  for (const part of chunkArray(pids, REST_WRITE_CHUNK_SIZE)) {
    const res = await restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid,status&pid=in.(${part.join(",")})&status=in.(ready,reserved)&limit=${part.length}`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as Array<{ pid: number | string; status: string | null }>;
    for (const row of rows) {
      const pid = Number(row.pid);
      if (Number.isFinite(pid)) protectedPids.add(pid);
    }
  }
  const filtered = entries.filter((entry) => !protectedPids.has(Number(entry.pid)));
  return { entries: filtered, deferred: entries.length - filtered.length };
}

async function invalidatePoolEntries(entries: PoolInvalidationEntry[]) {
  const byReason = new Map<string, Set<number>>();
  for (const entry of entries) {
    const pid = Number(entry.pid);
    if (!Number.isFinite(pid)) continue;
    const reason = entry.reason.slice(0, 120);
    if (!byReason.has(reason)) byReason.set(reason, new Set());
    byReason.get(reason)?.add(pid);
  }
  const patches: Promise<void>[] = [];
  const updatedAt = new Date().toISOString();
  for (const [reason, pids] of byReason.entries()) {
    for (const chunk of chunkArray([...pids], REST_WRITE_CHUNK_SIZE)) {
      patches.push(patchRows(
        "mvp_candidate_pool",
        `pid=in.(${chunk.join(",")})&status=in.(ready,reserved,invalidated)`,
        {
          status: "invalidated",
          invalidated_reason: reason,
          reserved_until: null,
          updated_at: updatedAt,
        },
      ));
    }
  }
  const results = await Promise.allSettled(patches);
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    console.error("pool invalidation partially failed", {
      failed: failed.length,
      total: patches.length,
      errors: failed.slice(0, 3).map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason)),
    });
  }

  const metadataGroups = new Map<string, { body: Record<string, unknown>; pids: Set<number> }>();
  for (const entry of entries) {
    const pid = Number(entry.pid);
    if (!Number.isFinite(pid)) continue;
    if (entry.category === undefined && entry.comparable_key === undefined && entry.condition_class === undefined) continue;
    const body: Record<string, unknown> = {
      updated_at: updatedAt,
    };
    if (entry.category !== undefined) body.category = entry.category;
    if (entry.comparable_key !== undefined) body.comparable_key = entry.comparable_key;
    if (entry.condition_class !== undefined) body.condition_class = entry.condition_class;
    const key = JSON.stringify(body);
    if (!metadataGroups.has(key)) metadataGroups.set(key, { body, pids: new Set<number>() });
    metadataGroups.get(key)?.pids.add(pid);
  }
  const metadataPatches: Promise<void>[] = [];
  for (const group of metadataGroups.values()) {
    for (const chunk of chunkArray([...group.pids], REST_WRITE_CHUNK_SIZE)) {
      metadataPatches.push(patchRows(
        "mvp_candidate_pool",
        `pid=in.(${chunk.join(",")})&status=eq.invalidated`,
        group.body,
      ));
    }
  }
  const metadataResults = await Promise.allSettled(metadataPatches);
  const metadataFailed = metadataResults.filter((result) => result.status === "rejected");
  if (metadataFailed.length > 0) {
    console.error("pool invalidation metadata refresh partially failed", {
      failed: metadataFailed.length,
      total: metadataPatches.length,
      errors: metadataFailed.slice(0, 3).map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason)),
    });
  }
}

async function invalidatePoolIneligibleResidues(limit: number): Promise<number> {
  const res = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid&status=in.(ready,reserved)&limit=${limit}`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) {
    console.warn(`invalidatePoolIneligibleResidues fetch failed: ${res.status}`);
    return 0;
  }

  const poolRows = (await res.json()) as Array<{ pid: number | string }>;
  const pids = poolRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  if (pids.length === 0) return 0;

  const ineligible = await loadRawPoolIneligiblePids(pids);

  if (ineligible.size === 0) return 0;
  await invalidatePoolEntries([...ineligible].map((pid) => ({ pid, reason: "pool_eligible_false_residue" })));
  return ineligible.size;
}

async function invalidatePoolLowSellerRatingResidues(limit: number): Promise<number> {
  const res = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid&status=in.(ready,reserved)&limit=${limit}`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) {
    console.warn(`invalidatePoolLowSellerRatingResidues fetch failed: ${res.status}`);
    return 0;
  }

  const poolRows = (await res.json()) as Array<{ pid: number | string }>;
  const pids = poolRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  if (pids.length === 0) return 0;

  const lowSellerPids = new Set<number>();
  for (const chunk of chunkArray(pids, REST_WRITE_CHUNK_SIZE)) {
    const rawRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,shop_review_rating,shop_review_count&shop_review_rating=lt.${POOL_LOW_SELLER_RATING_REVIEW}&pid=in.(${chunk.join(",")})`,
      { headers: serviceHeaders() },
    );
    const rawRows = (await rawRes.json()) as Array<{
      pid: number | string;
      shop_review_rating: number | null;
      shop_review_count: number | null;
    }>;
    for (const row of rawRows) {
      const pid = Number(row.pid);
      const count = Number(row.shop_review_count);
      const rating = Number(row.shop_review_rating);
      if (
        Number.isFinite(pid) &&
        Number.isFinite(count) &&
        count > 0 &&
        Number.isFinite(rating) &&
        rating < POOL_LOW_SELLER_RATING_REVIEW
      ) {
        lowSellerPids.add(pid);
      }
    }
  }

  if (lowSellerPids.size === 0) return 0;
  await invalidatePoolEntries([...lowSellerPids].map((pid) => ({ pid, reason: "seller_rating_below_3_5_review" })));
  return lowSellerPids.size;
}

async function loadRawPoolIneligiblePids(pids: number[]): Promise<Set<number>> {
  const unique = [...new Set(pids.filter(Number.isFinite))];
  const ineligible = new Set<number>();
  for (const chunk of chunkArray(unique, REST_WRITE_CHUNK_SIZE)) {
    const rawRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,source,query,raw_json,pool_eligible&pool_eligible=eq.false&pid=in.(${chunk.join(",")})`,
      { headers: serviceHeaders() },
    );
    const rawRows = (await rawRes.json()) as Array<{
      pid: number | string;
      source: string | null;
      query: string | null;
      raw_json: Record<string, unknown> | null;
      pool_eligible: boolean | null;
    }>;
    for (const row of rawRows) {
      const pid = Number(row.pid);
      if (Number.isFinite(pid) && row.pool_eligible === false && !isRawPublicPoolEligible(row)) {
        ineligible.add(pid);
      }
    }
  }
  return ineligible;
}

async function invalidatePoolStaleParserResidues(limit: number): Promise<number> {
  const res = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid,category&status=in.(ready,reserved)&limit=${limit}`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) {
    console.warn(`invalidatePoolStaleParserResidues fetch failed: ${res.status}`);
    return 0;
  }

  const poolRows = (await res.json()) as Array<{ pid: number | string; category: Sku["category"] | null }>;
  const byCategory = new Map<Sku["category"], number[]>();
  for (const row of poolRows) {
    const pid = Number(row.pid);
    const category = row.category;
    if (!Number.isFinite(pid) || !category || !LATEST_PARSER_VERSION_BY_CATEGORY[category]) continue;
    byCategory.set(category, [...(byCategory.get(category) ?? []), pid]);
  }

  const staleByReason = new Map<string, Set<number>>();
  for (const [category, pids] of byCategory.entries()) {
    const expected = LATEST_PARSER_VERSION_BY_CATEGORY[category];
    if (!expected) continue;

    const parsedByPid = new Map<number, { parser_version: string | null }>();
    for (const chunk of chunkArray(pids, REST_WRITE_CHUNK_SIZE)) {
      const parsedRes = await restFetch(
        `${tableUrl("mvp_listing_parsed")}?select=pid,parser_version&pid=in.(${chunk.join(",")})`,
        { headers: serviceHeaders() },
      );
      if (!parsedRes.ok) {
        console.warn(`invalidatePoolStaleParserResidues parsed fetch failed: ${parsedRes.status}`);
        continue;
      }
      const parsedRows = (await parsedRes.json()) as Array<{ pid: number | string; parser_version: string | null }>;
      for (const parsed of parsedRows) {
        const pid = Number(parsed.pid);
        if (Number.isFinite(pid)) parsedByPid.set(pid, { parser_version: parsed.parser_version ?? null });
      }
    }

    const reason = `stale_parser_version_${category}_residue`;
    for (const pid of pids) {
      const parsed = parsedByPid.get(pid);
      if (!parsed || parsed.parser_version !== expected) {
        if (!staleByReason.has(reason)) staleByReason.set(reason, new Set());
        staleByReason.get(reason)?.add(pid);
      }
    }
  }

  const stalePids = [...staleByReason.values()].flatMap((set) => [...set]);
  if (stalePids.length === 0) return 0;
  await invalidatePoolEntries([...staleByReason.entries()].flatMap(([reason, pids]) =>
    [...pids].map((pid) => ({ pid, reason })),
  ));
  await patchRowsByIds("mvp_raw_listings", stalePids, { score_dirty: true }, REST_WRITE_CHUNK_SIZE);
  return stalePids.length;
}

async function markStaleInvalidatedPoolRowsDirty(limit: number): Promise<number> {
  const res = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid,category,invalidated_reason&status=eq.invalidated&category=in.(clothing,shoe,bag)&invalidated_reason=not.is.null&limit=${limit}`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) {
    console.warn(`markStaleInvalidatedPoolRowsDirty fetch failed: ${res.status}`);
    return 0;
  }

  const poolRows = (await res.json()) as Array<{
    pid: number | string;
    category: Sku["category"] | null;
    invalidated_reason: string | null;
  }>;
  const byCategory = new Map<Sku["category"], number[]>();
  const invalidatedReasonByPid = new Map<number, string | null>();
  for (const row of poolRows) {
    const pid = Number(row.pid);
    const category = row.category;
    if (!Number.isFinite(pid) || !category || !LATEST_PARSER_VERSION_BY_CATEGORY[category]) continue;
    invalidatedReasonByPid.set(pid, row.invalidated_reason ?? null);
    byCategory.set(category, [...(byCategory.get(category) ?? []), pid]);
  }
  if (byCategory.size === 0) return 0;

  const stalePids: number[] = [];
  for (const [category, pids] of byCategory.entries()) {
    const expected = LATEST_PARSER_VERSION_BY_CATEGORY[category];
    if (!expected) continue;

    const parsedByPid = new Map<number, string | null>();
    const rawEligible = new Set<number>();
    for (const chunk of chunkArray(pids, REST_WRITE_CHUNK_SIZE)) {
      const [parsedRes, rawRes] = await Promise.all([
        restFetch(
          `${tableUrl("mvp_listing_parsed")}?select=pid,parser_version&pid=in.(${chunk.join(",")})`,
          { headers: serviceHeaders() },
        ),
        restFetch(
          `${tableUrl("mvp_raw_listings")}?select=pid,source,query,raw_json,pool_eligible,detail_status,listing_state,listing_type,listing_type_override,sku_id&pid=in.(${chunk.join(",")})`,
          { headers: serviceHeaders() },
        ),
      ]);
      if (!parsedRes.ok || !rawRes.ok) {
        console.warn(`markStaleInvalidatedPoolRowsDirty detail fetch failed: parsed=${parsedRes.status} raw=${rawRes.status}`);
        continue;
      }
      const parsedRows = (await parsedRes.json()) as Array<{ pid: number | string; parser_version: string | null }>;
      for (const parsed of parsedRows) {
        const pid = Number(parsed.pid);
        if (Number.isFinite(pid)) parsedByPid.set(pid, parsed.parser_version ?? null);
      }
      const rawRows = (await rawRes.json()) as Array<{
        pid: number | string;
        source: string | null;
        query: string | null;
        raw_json: Record<string, unknown> | null;
        pool_eligible: boolean | null;
        detail_status: string | null;
        listing_state: string | null;
        listing_type: string | null;
        listing_type_override: string | null;
        sku_id: string | null;
      }>;
      for (const raw of rawRows) {
        const pid = Number(raw.pid);
        if (!Number.isFinite(pid)) continue;
        const normalListing = raw.listing_type === "normal" || raw.listing_type_override === "normal";
        if (isRawPublicPoolEligible(raw) && raw.detail_status === "done" && raw.listing_state === "active" && normalListing && raw.sku_id) {
          rawEligible.add(pid);
        }
      }
    }

    for (const pid of pids) {
      if (!rawEligible.has(pid)) continue;
      const parserVersion = parsedByPid.get(pid) ?? null;
      const reason = invalidatedReasonByPid.get(pid) ?? "";
      const staleParserReason = reason === `stale_parser_version_${category}` || reason === `stale_parser_version_${category}_residue`;
      if (parserVersion !== expected || staleParserReason) stalePids.push(pid);
    }
  }

  if (stalePids.length === 0) return 0;
  const unique = [...new Set(stalePids)];
  await patchRowsByIds("mvp_raw_listings", unique, { score_dirty: true }, REST_WRITE_CHUNK_SIZE);
  return unique.length;
}

// Wave launch-42 (사용자 짚음 "profit_below_pack_band 685건 ready→invalidated 전환"):
//   기존: sku_median_unavailable 사유만 + fashion (clothing/shoe/bag) 카테고리만 재평가.
//   1차 확장: 회복 가능 사유 22종 whitelist 추가.
//
// Wave launch-42b (사용자 정정 "테크 기기들은 완벽, 다른 카테고리는 fashion 안 세부 SKU 의미"):
//   초기 launch-42 에서 fashion 한정 유지했는데 사용자 진짜 의도는 전자기기 카테고리
//   (earphone/tablet/smartphone/smartwatch/laptop/watch 등) 도 포함. fashion 안 세부 SKU
//   강화는 별 영역이라 cron 작동해도 안전 (candidate-pool-builder 가 최신 parser 로 재평가).
//   → 카테고리 필터 자체 제거. 모든 카테고리 회복 cron.
//
//   검증 로직 (raw active+eligible + sku_median/comparable 회복) 그대로 — score_dirty
//   마킹은 안전한 매물만. score-worker 다음 tick → candidate-pool-builder 재호출 →
//   현재 시세/가격 기준 차익 1만+ 이면 ready 복귀, 아니면 사유 갱신.
//   → fashion 내부 SKU 강화 진행 중 매물도 평가 통과해야 ready 가니까 안전.
//
//   회복 가능 사유 (의도적 영구 차단 제외):
//   - 시세/가격 변동: sku_median_unavailable, profit_below_pack_band(legacy),
//     profit_not_positive_after_costs, negative_resell_gap,
//     wave99_thin_market_n_lt_5
//   - volume gate 재평가: daangn_volume_below_3, sku_low_volume_below_2d1_or_7d3
//   - raw 복구: pool_eligible_false_residue
//   - parser/policy stale: wave410_pool_key_drift, wave408/410_*_lane/category_*,
//     wave498/500/501_stale_*, wave226_wrong_sku_match_cleanup, wave230_sku_id_null_stale,
//     stale_parser_version_*_residue
//   - AI/검토 가치: blocked_deep_discount_review, fashion_unknown_condition_review,
//     fashion_broad_sku_review
//
//   회복 불가 사유 (whitelist 제외):
//   - lifecycle_state_* (매물 사라짐), num_comment_above_8 (인기 매물 의도 차단),
//     seller_rating_below_*, multi_id_fraud_group_*, fake_suspect_*, ad_or_retail_listing,
//     category_*_blocked, lane_blocked_*, price_above_pool_max, placeholder_price,
//     option_needs_review, *_low_confidence, ai_audit_*, ai_escrow_*
const RECOVERABLE_INVALIDATED_REASONS = [
  "sku_median_unavailable",
  "wave99_thin_market_n_lt_5",
  "profit_below_pack_band",
  "profit_not_positive_after_costs",
  "negative_resell_gap",
  "daangn_volume_below_3",
  "sku_low_volume_below_2d1_or_7d3",
  "pool_eligible_false_residue",
  "wave410_pool_key_drift",
  "wave408_category_internal_only_clothing_lane_required",
  "wave410_category_internal_only_shoe",
  "wave410_category_internal_only_clothing",
  "wave410_category_internal_only_bag",
  "wave498_stale_comparable_key",
  "wave500_stale_or_review_comparable_key",
  "wave501_stale_pool_cleanup",
  "wave501_final_ready_sample_qa",
  "wave226_wrong_sku_match_cleanup",
  "wave230_sku_id_null_stale",
  "stale_parser_version_shoe_residue",
  "stale_parser_version_clothing_residue",
  "stale_parser_version_bag_residue",
  "blocked_deep_discount_review",
  "fashion_unknown_condition_review",
  "fashion_broad_sku_review",
] as const;

async function markRecoveredMarketInvalidatedPoolRowsDirty(limit: number): Promise<number> {
  const rowLimit = Math.max(1, Math.min(limit, 250));
  const reasonsClause = `invalidated_reason=in.(${RECOVERABLE_INVALIDATED_REASONS.join(",")})`;
  // Wave launch-42b: category 필터 제거 (전자기기 카테고리 다 포함).
  const res = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.invalidated&${reasonsClause}&order=updated_at.desc&limit=${rowLimit}`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) {
    console.warn(`markRecoveredMarketInvalidatedPoolRowsDirty fetch failed: ${res.status}`);
    return 0;
  }

  const poolRows = (await res.json()) as Array<{ pid: number | string | null }>;
  const pids = [...new Set(poolRows.map((row) => Number(row.pid)).filter(Number.isFinite))];
  if (pids.length === 0) return 0;

  const eligibleRaw = new Map<number, string | null>();
  const recoveredMarket = new Set<number>();
  const parsedByPid = new Map<number, {
    category: Sku["category"] | null;
    comparable_key: string | null;
    condition_class: string | null;
  }>();
  for (const chunk of chunkArray(pids, REST_WRITE_CHUNK_SIZE)) {
    const [rawRes, listingRes, parsedRes] = await Promise.all([
      restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid,source,query,raw_json,pool_eligible,detail_status,listing_state,listing_type,listing_type_override,sku_id&pid=in.(${chunk.join(",")})`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_listings")}?select=pid,sku_median&pid=in.(${chunk.join(",")})&sku_median=gt.0`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_listing_parsed")}?select=pid,category,comparable_key,condition_class&pid=in.(${chunk.join(",")})`,
        { headers: serviceHeaders() },
      ),
    ]);
    if (!rawRes.ok || !listingRes.ok || !parsedRes.ok) {
      console.warn(`markRecoveredMarketInvalidatedPoolRowsDirty detail fetch failed: raw=${rawRes.status} listing=${listingRes.status} parsed=${parsedRes.status}`);
      continue;
    }
    const rawRows = (await rawRes.json()) as Array<{
      pid: number | string;
      source: string | null;
      query: string | null;
      raw_json: Record<string, unknown> | null;
      pool_eligible: boolean | null;
      detail_status: string | null;
      listing_state: string | null;
      listing_type: string | null;
      listing_type_override: string | null;
      sku_id: string | null;
    }>;
    for (const raw of rawRows) {
      const pid = Number(raw.pid);
      if (!Number.isFinite(pid)) continue;
      const normalListing = raw.listing_type === "normal" || raw.listing_type_override === "normal";
      if (isRawPublicPoolEligible(raw) && raw.detail_status === "done" && raw.listing_state === "active" && normalListing && raw.sku_id) {
        eligibleRaw.set(pid, raw.source ?? null);
      }
    }
    const listingRows = (await listingRes.json()) as Array<{ pid: number | string; sku_median: number | null }>;
    for (const listing of listingRows) {
      const pid = Number(listing.pid);
      if (Number.isFinite(pid) && Number(listing.sku_median ?? 0) > 0) recoveredMarket.add(pid);
    }
    const parsedRows = (await parsedRes.json()) as Array<{
      pid: number | string;
      category: Sku["category"] | null;
      comparable_key: string | null;
      condition_class: string | null;
    }>;
    for (const parsed of parsedRows) {
      const pid = Number(parsed.pid);
      if (!Number.isFinite(pid)) continue;
      parsedByPid.set(pid, {
        category: parsed.category ?? null,
        comparable_key: parsed.comparable_key ?? null,
        condition_class: parsed.condition_class ?? null,
      });
    }
  }

  const comparableKeys = [...new Set([...parsedByPid.values()].map((row) => row.comparable_key).filter(Boolean) as string[])];
  const marketStatsByKey = await loadMarketPriceStats([
    ...comparableKeys,
    ...comparableKeys.map(shoeSizeAgnosticComparableKey).filter((key): key is string => Boolean(key)),
  ]);
  const marketStatsPerSource = await loadMarketPriceStatsPerSource([
    ...comparableKeys,
    ...comparableKeys.map(shoeSizeAgnosticComparableKey).filter((key): key is string => Boolean(key)),
  ]).catch((err) => {
    console.warn("markRecoveredMarketInvalidatedPoolRowsDirty per-source fetch failed", err instanceof Error ? err.message : String(err));
    return null as MarketPriceStatsPerSourceMap | null;
  });
  for (const [pid, parsed] of parsedByPid.entries()) {
    if (recoveredMarket.has(pid) || !parsed.comparable_key) continue;
    const rawSource = eligibleRaw.get(pid) ?? null;
    if (normalizeMarketplaceSource(rawSource) === "daangn") {
      const sourceStat = pickPerSourceStatForMatter(
        marketStatsPerSource,
        parsed.comparable_key,
        parsed.condition_class ?? null,
        rawSource,
        parsed.category,
      );
      const sizeAnyKey = shoeSizeAgnosticComparableKey(parsed.comparable_key);
      const sourceSizeAnyStat = pickPerSourceStatForMatter(
        marketStatsPerSource,
        sizeAnyKey ?? null,
        parsed.condition_class ?? null,
        rawSource,
        parsed.category,
      );
      if (sourceStat || sourceSizeAnyStat) recoveredMarket.add(pid);
      continue;
    }
    const byCondition = marketStatsByKey.get(parsed.comparable_key);
    const stat = pickMarketStatByCondition(byCondition, parsed.condition_class ?? null);
    const exactMedian = trustedMarketMedian(stat, parsed.category);
    const sizeAnyKey = shoeSizeAgnosticComparableKey(parsed.comparable_key);
    const sizeAnyStat = pickMarketStatByCondition(
      sizeAnyKey ? marketStatsByKey.get(sizeAnyKey) : undefined,
      parsed.condition_class ?? null,
    );
    if (exactMedian != null || trustedMarketMedian(sizeAnyStat, parsed.category) != null) recoveredMarket.add(pid);
  }

  const recovered = pids.filter((pid) => eligibleRaw.has(pid) && recoveredMarket.has(pid));
  if (recovered.length === 0) return 0;
  await patchRowsByIds("mvp_raw_listings", recovered, { score_dirty: true }, REST_WRITE_CHUNK_SIZE);
  return recovered.length;
}

async function enqueueSkuMedianUnavailableMarketInvalidations(limit: number): Promise<number> {
  const rowLimit = Math.max(1, Math.min(limit, 250));
  const res = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid,category,comparable_key&status=eq.invalidated&invalidated_reason=eq.sku_median_unavailable&order=updated_at.desc&limit=${rowLimit}`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) {
    console.warn(`enqueueSkuMedianUnavailableMarketInvalidations fetch failed: ${res.status}`);
    return 0;
  }

  const poolRows = (await res.json()) as Array<{
    pid: number | string | null;
    category: Sku["category"] | null;
    comparable_key: string | null;
  }>;
  const pids = [...new Set(poolRows.map((row) => Number(row.pid)).filter(Number.isFinite))];
  if (pids.length === 0) return 0;

  const eligibleRaw = new Map<number, string | null>();
  for (const chunk of chunkArray(pids, REST_WRITE_CHUNK_SIZE)) {
    const rawRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,source,query,raw_json,pool_eligible,detail_status,listing_state,listing_type,listing_type_override,sku_id&pid=in.(${chunk.join(",")})`,
      { headers: serviceHeaders() },
    );
    if (!rawRes.ok) {
      console.warn(`enqueueSkuMedianUnavailableMarketInvalidations raw fetch failed: ${rawRes.status}`);
      continue;
    }
    const rawRows = (await rawRes.json()) as Array<{
      pid: number | string;
      source: string | null;
      query: string | null;
      raw_json: Record<string, unknown> | null;
      pool_eligible: boolean | null;
      detail_status: string | null;
      listing_state: string | null;
      listing_type: string | null;
      listing_type_override: string | null;
      sku_id: string | null;
    }>;
    for (const raw of rawRows) {
      const pid = Number(raw.pid);
      if (!Number.isFinite(pid)) continue;
      if (isRawPublicPoolEligible(raw) && isScorableRawCandidate({
        detail_status: raw.detail_status ?? "",
        sku_id: raw.sku_id,
        listing_state: raw.listing_state ?? "",
        listing_type: raw.listing_type ?? "",
        listing_type_override: raw.listing_type_override,
      })) {
        eligibleRaw.set(pid, raw.source ?? null);
      }
    }
  }

  const events = poolRows
    .map((row) => ({
      pid: Number(row.pid),
      comparableKey: row.comparable_key,
      category: row.category,
      source: eligibleRaw.get(Number(row.pid)) ?? null,
    }))
    .filter((row) => Number.isFinite(row.pid) && eligibleRaw.has(row.pid) && Boolean(row.comparableKey))
    .map((row) => ({
      comparableKey: row.comparableKey,
      reason: row.source === "daangn"
        ? "daangn_sku_median_unavailable_refresh"
        : row.category === "shoe"
        ? "sku_median_unavailable_size_any_refresh"
        : "sku_median_unavailable_refresh",
      priority: row.source === "daangn" ? 92 : row.category === "shoe" ? 85 : 55,
      affectedPid: row.pid,
    }));

  const cooldownKeys = await loadMarketInvalidationCooldownKeys(
    events.map((event) => event.comparableKey).filter((key): key is string => Boolean(key)),
    SKU_MEDIAN_UNAVAILABLE_MARKET_REFRESH_COOLDOWN_MS,
  );
  const refreshEvents = events.filter((event) => !cooldownKeys.has(event.comparableKey ?? ""));
  return enqueueMarketKeyInvalidations(refreshEvents);
}

async function loadMarketInvalidationCooldownKeys(comparableKeys: string[], cooldownMs: number): Promise<Set<string>> {
  const unique = [...new Set(comparableKeys.filter(Boolean))];
  const cooldown = new Set<string>();
  if (unique.length === 0) return cooldown;
  const cutoffIso = new Date(Date.now() - Math.max(0, cooldownMs)).toISOString();
  const nowIso = new Date().toISOString();

  for (const chunk of chunkArray(unique, REST_KEY_READ_CHUNK_SIZE)) {
    const encoded = chunk.map((key) => encodeURIComponent(key)).join(",");
    const res = await restFetch(
      `${tableUrl("mvp_market_key_invalidation")}?select=comparable_key,status,last_recomputed_at,locked_until&comparable_key=in.(${encoded})&limit=${chunk.length}`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as Array<{
      comparable_key: string | null;
      status: string | null;
      last_recomputed_at: string | null;
      locked_until: string | null;
    }>;
    for (const row of rows) {
      const key = row.comparable_key;
      if (!key) continue;
      if (row.status === "pending" || row.status === "processing") {
        cooldown.add(key);
        continue;
      }
      if (row.locked_until && row.locked_until > nowIso) {
        cooldown.add(key);
        continue;
      }
      if (row.status === "done" && row.last_recomputed_at && row.last_recomputed_at >= cutoffIso) {
        cooldown.add(key);
      }
    }
  }

  return cooldown;
}

function aiAuditResidueReason(status: string | null | undefined): string {
  if (status === "hold") return "ai_audit_hold_review";
  if (status === "reject") return "ai_audit_reject_review";
  if (status === "skipped_unavailable") return "ai_audit_unavailable_review";
  if (status == null) return "ai_audit_missing_review";
  return "ai_audit_unavailable_review";
}

function isAiAuditPoolPass(status: string | null | undefined): boolean {
  return status === "pass";
}

function isAiAuditDefiniteNonPass(status: string | null | undefined): boolean {
  // Wave 761 (2026-05-24): hold/skipped_unavailable 매물 invalidate 차단 (Wave 757 release mechanism).
  //   기존: hold + reject + skipped_unavailable 모두 invalidate → 신발/의류 정상 매물 80% 손실 (24/30 hold).
  //   AI hold 사유 패턴: "셀러 상세 설명 부족" / "시세보다 싼 가격 의심" — 한국 중고시장 일반 매물.
  //   사용자 핵심 원칙 (일반인 친화): hold 매물도 사용자가 직접 판단할 수 있도록 풀 유지.
  //   ready 유지하되 ai_audit_status='hold' 그대로 박혀있어 UI 에서 "AI 검토 중" 표시 가능 (별도 wave).
  //   skipped_unavailable (AI 호출 실패) 도 invalidate 안 함 — 다음 cron 에서 재시도 기회.
  //   reject 만 hard invalidate (AI 가 명확히 위험 판단한 매물).
  return status === "reject";
}

function aiAuditVerdictFromClassification(
  result: AiClassification,
): "pass" | "hold" | "reject" {
  const decision = aiSecondOpinionDecision(result);
  const hardRisk = aiHasHardRisk(result);
  // Wave 757 (2026-05-24): pass 조건 완화 (ai-l2-shadow-audit.ts와 sync).
  // hardRisk 없는 normal + confidence != low 매물은 pass. 일반인 친화.
  if (decision === "pass" && result.listingType === "normal" && !hardRisk && result.confidence !== "low") {
    return "pass";
  }
  if (decision === "reject" && result.confidence !== "low") {
    return "reject";
  }
  return "hold";
}

async function syncPoolAiAuditStatusesFromCurrentCache(
  poolEntries: Array<Record<string, unknown>>,
  rows: PipelineRow[],
): Promise<number> {
  const rowByPid = new Map<number, PipelineRow>();
  for (const row of rows) {
    const pid = Number(row.pid);
    if (Number.isFinite(pid)) rowByPid.set(pid, row);
  }

  const contentHashByPid = new Map<number, string>();
  const pids = poolEntries
    .filter((entry) => entry.category === "clothing" || entry.category === "shoe" || entry.category === "bag")
    .map((entry) => Number(entry.pid))
    .filter((pid) => Number.isFinite(pid) && rowByPid.has(pid));
  for (const pid of pids) {
    const row = rowByPid.get(pid);
    if (row) contentHashByPid.set(pid, contentHash(row));
  }
  if (pids.length === 0) return 0;

  const now = new Date().toISOString();
  let synced = 0;
  for (const chunk of chunkArray(pids, REST_WRITE_CHUNK_SIZE)) {
    const res = await restFetch(
      `${tableUrl("mvp_listing_ai_classifications")}?select=pid,content_hash,listing_type,confidence,reason,risk_keywords,model&pid=in.(${chunk.join(",")})`,
      { headers: serviceHeaders() },
    );
    if (!res.ok) {
      console.warn(`syncPoolAiAuditStatusesFromCurrentCache fetch failed: ${res.status}`);
      continue;
    }
    const cachedRows = (await res.json()) as Array<{
      pid: number | string;
      content_hash: string | null;
      listing_type: AiClassification["listingType"];
      confidence: AiClassification["confidence"];
      reason: string | null;
      risk_keywords: string[] | null;
      model: string | null;
    }>;
    for (const cached of cachedRows) {
      const pid = Number(cached.pid);
      if (!Number.isFinite(pid)) continue;
      const expectedHash = contentHashByPid.get(pid);
      if (!expectedHash || cached.content_hash !== expectedHash) continue;
      const verdict = aiAuditVerdictFromClassification({
        listingType: cached.listing_type,
        decision: null,
        confidence: cached.confidence,
        reason: cached.reason ?? "",
        riskKeywords: cached.risk_keywords ?? [],
        conditionClass: null,
        conditionReason: "",
        model: cached.model ?? "cache",
        inputTokens: null,
        outputTokens: null,
        costUsd: null,
      });
      // Wave 771 (2026-05-24): AI hold = "상태 판단 불가" 정책.
      //   사용자 #7 정책: AI 가 listingType 모름 (hold) 이면 condition 도 모르는 게 일관성 있음.
      //   condition_class 는 NOT NULL constraint 라 그대로 두고 (parser 값 유지),
      //   ai_audit_status='hold' flag 가 UI 에 "상태 모름" 배지 표시 trigger.
      //   향후 schema migration 으로 condition_class nullable 변경 검토 (별도 wave).
      const patch: Record<string, unknown> = {
        ai_audit_status: verdict,
        ai_audit_at: now,
        ai_audit_reason: (cached.reason ?? "").slice(0, 200),
      };
      await patchRows("mvp_candidate_pool", `pid=eq.${pid}`, patch);
      synced += 1;
    }
  }
  return synced;
}

async function invalidatePoolAiAuditResidues(limit: number): Promise<number> {
  // Wave 769 (2026-05-27): category filter 제거. 기존엔 clothing/shoe/bag만 cleanup → smartphone/earphone/tablet/laptop 등의 AI reject 매물이 ready로 잔존 (Wave 768 audit 발견 — 갤럭시 노트20 액정깨짐, Z플립6 디스플레이 흑변, "갤럭시 버즈 3 Pro" SKU지만 실제는 화웨이 프리버즈).
  //   reject/hold residue 검사는 카테고리 무관하게 전 풀에 적용 — `isAiAuditDefiniteNonPass`가 verdict 종류만 보고 결정.
  const res = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid,ai_audit_status&status=in.(ready,reserved)&limit=${limit}`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) {
    console.warn(`invalidatePoolAiAuditResidues fetch failed: ${res.status}`);
    return 0;
  }

  const rows = (await res.json()) as Array<{ pid: number | string; ai_audit_status: string | null }>;
  const invalidations = rows
    // Missing/null means "not audited yet", not "unsafe". The shadow audit can
    // be budget-capped, so treating null as a hard residue would shrink the
    // pool before AI gets a chance to classify it.
    .filter((row) => !isAiAuditPoolPass(row.ai_audit_status) && isAiAuditDefiniteNonPass(row.ai_audit_status))
    .map((row) => ({
      pid: Number(row.pid),
      reason: aiAuditResidueReason(row.ai_audit_status),
    }))
    .filter((entry) => Number.isFinite(entry.pid));
  if (invalidations.length === 0) return 0;
  await invalidatePoolEntries(invalidations);
  return invalidations.length;
}

async function loadPoolWarmRows(limit: number): Promise<PoolWarmRow[]> {
  const cols = "pid,profit_band,expected_profit_min,expected_profit_max,status,last_verified_at";
  const res = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=${cols}&status=eq.ready&order=profit_band.desc,expected_profit_min.desc,last_verified_at.asc&limit=${limit}`,
    { headers: serviceHeaders() },
  );
  return (await res.json()) as PoolWarmRow[];
}

async function loadRawPriceNames(pids: number[]): Promise<Map<number, { price: number; name: string; source: string | null; url: string | null }>> {
  if (pids.length === 0) return new Map();
  // Wave launch-74 (사용자 짚음 "pool warmer 도 joongna 처리해야"):
  //   source/url 도 같이 fetch — pool-warmer 가 joongna 분기 + fetchJoongnaDetail 사용 가능.
  const res = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid,price,name,source,url&pid=in.(${pids.join(",")})`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json()) as { pid: number; price: number; name: string; source: string | null; url: string | null }[];
  return new Map(rows.map((row) => [Number(row.pid), { price: Number(row.price), name: row.name, source: row.source ?? null, url: row.url ?? null }]));
}

async function markPoolVerified(pid: number) {
  const now = new Date().toISOString();
  await patchRows("mvp_candidate_pool", `pid=eq.${pid}`, {
    last_verified_at: now,
    updated_at: now,
  });
}

async function patchPoolWarmDetailFacts(pid: number, detail: { commentCount: number | null }) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    detail_enriched_at: now,
    updated_at: now,
  };
  if (detail.commentCount != null) patch.num_comment = detail.commentCount;
  await patchRows("mvp_raw_listings", `pid=eq.${pid}`, patch);
}

async function claimLifecycleChecks(mode: LifecycleClaimMode = "default"): Promise<LifecycleClaimRow[]> {
  const config = loadPipelineRuntimeConfig();
  // 2026-05-16: Bunjang rate limit probe 결과 600 calls 전부 200 응답 (429 0건).
  // c=20에서 throughput 329 req/s까지 lenient. 우리 cron 주기 7분 기준 batch 400은 매우 안전.
  // batch cap 80 → 400 (5배). Promise.all wave concurrency 10으로 처리 → 8초 안 완료 (maxDuration 90s 한도의 9%).
  // 측정 후 추가 늘림 가능 (probe 시나리오 A 결과).
  //
  // 2026-05-15 (이전 wave): backlog 14k 누적 → batch 30 → 80. 7분 cron + batch 80 = 686 calls/h.
  // 지금: batch 400 + c=10 → 3,429 calls/h (5x). backlog 2,659 → 45분 안 해소.
  // Wave 187 B2 (2026-05-17): batch 400 → 800. lifecycle 이 last_seen_at 도 갱신 (B1) 하면서
  //   market-worker incremental (Wave 184) 의 28h lookback 안에 더 많은 active 매물이 들어와야 함.
  //   현재 batch 400 + 7분 주기 = 시간당 ~3,429 매물 sweep. active 151K cover ≈ 44시간 (2일+) → 28h 부족.
  //   batch 800 으로 ≈ 22시간 (28h 안에 거의 다 cover). probe c=20 lenient 결과 안전.
  const LIFECYCLE_BATCH_HARDCODE = 800;
  const batchSize = mode === "terminal_recheck"
    ? config.terminalLifecycleRecheckBatchSize
    : LIFECYCLE_BATCH_HARDCODE;
  const rpcName = mode === "terminal_recheck"
    ? "claim_mvp_terminal_lifecycle_rechecks"
    : "claim_mvp_lifecycle_checks";
  const res = await restFetch(rpcUrl(rpcName), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({
      p_batch_size: batchSize,
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
  // Wave 187 B1 (2026-05-17): last_seen_at 동시 갱신.
  //   진단 — 전체 카테고리 active 매물 fresh_28h 비율 10~25% (신발만 80%+).
  //   원인 — search-worker broad query 가 매물 많은 SKU 의 일부만 페치 (page 1+ 매물 누락).
  //         lifecycle 이 매물 detail 가져와도 raw_listings.last_seen_at 갱신 안 함 → market-worker 28h
  //         lookback (Wave 184) 에서 누락 → 시세 산정 안 됨 (i3 macbook 케이스).
  //   fix — markRawLifecycleState 진입점에서 last_seen_at = now 같이 patch. lifecycle 가 detail fetch 한
  //         시점이라 "최근 본 매물" 의 의미와 동일.
  //   safe — search 가 박는 last_seen_at 과 동일 timestamp / idempotent. coalesce policy 영향 X (lifecycle 호출
  //         시점은 next_check_at 만료 후라 빈도 controlled).
  const patch: Record<string, unknown> = {
    listing_state: status,
    last_seen_at: now,
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

  // Wave 90 (2026-05-15): listing_state가 active 외 상태로 전환되면 candidate_pool에서
  // 자동 invalidate. 사용자 코멘트로 발견 (pid 407655201, 407614793, 407507382 등):
  // disappeared/missing_suspect 상태인 매물이 풀에 남아 있어 사용자에게 노출됨.
  // 이전엔 sold_confirmed만 호출처에서 별도 invalidate 호출 → 일관성 부재.
  // 단일 진입점 markRawLifecycleState에 추가하면 어디서 호출되든 일관됨 (idempotent).
  // missing_suspect는 임시 상태 (active 복귀 가능) — 일단 invalidate, active 복귀하면
  // candidate-pool-builder가 다음 score tick에 재진입.
  if (status === "sold_confirmed" || status === "disappeared" || status === "archived" || status === "missing_suspect") {
    await invalidatePoolEntries([{ pid: Number(row.pid), reason: `lifecycle_state_${status}` }]).catch(() => undefined);
  }
}

async function insertLifecycleObservation(row: LifecycleClaimRow, status: LifecycleStatus, result: string, detailSaleStatus?: string | null) {
  await insertObservationsWithPayloads([{
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

// Wave launch-41: source 별 lifecycle detail fetch + sold signal 감지.
//   bunjang: fetchDetail (bunjang API) + detectSoldOut (sale_status / text / image 종합)
//   joongna: fetchJoongnaDetail (HTML parse) + productStatus + text hit
//   daangn: detail HTML status (Ongoing/Reserved/Closed) 로 active/terminal 판단
//     pack-open.ts:1503-1507 의 joongna sold 감지 패턴 통합.
//   반환값: LifecycleClaimRow 의 나머지 코드 (isSoldOut, canPermanentlyInvalidateSoldOut,
//   markRawLifecycleState) 에서 사용할 saleStatus 와 signals.
//   detail null 일 때는 fetch_failed signal — bunjang/joongna 동일.
async function fetchLifecycleDetailBySource(row: LifecycleClaimRow): Promise<{
  detail: { saleStatus: string | null } | null;
  signals: SoldOutSignal[];
}> {
  const source = normalizeMarketplaceSource(row.source);
  if (source === "joongna") {
    if (!row.url) return { detail: null, signals: ["fetch_failed"] };
    const j = await fetchJoongnaDetail(row.url, 10_000);
    if (!j.ok) return { detail: null, signals: ["fetch_failed"] };
    const signals: SoldOutSignal[] = [];
    // Wave launch-73 (사용자 짚음 "판매됐는데 feed 잔존"):
    //   joongna sold/disappeared 페이지 감지 — productStatus 자체 없는 sold 페이지 ("이 상품은
    //   더 이상 판매되지 않아요"). 가장 강한 신호.
    if (j.isSoldOutPage) signals.push("sale_status_inactive");
    const soldByStatus = j.productStatus != null && j.productStatus !== 0;
    if (soldByStatus) signals.push("sale_status_inactive");
    const textHits = soldOutTextHits(j.title, j.description);
    if (textHits.length > 0) signals.push("description_traded");
    const saleStatus = j.isSoldOutPage
      ? "JOONGNA_SOLD_PAGE"
      : j.productStatus === 0
      ? "JOONGNA_STATUS_0"
      : j.productStatus != null
      ? `JOONGNA_STATUS_${j.productStatus}`
      : null;
    return { detail: { saleStatus }, signals };
  }
  if (source === "daangn") {
    if (!row.url) return { detail: null, signals: ["fetch_failed"] };
    const d = await fetchDaangnLiveState(row.url, 10_000);
    if (!d.ok) return { detail: null, signals: ["fetch_failed"] };
    const signals: SoldOutSignal[] = d.listingState === "active" ? [] : ["sale_status_inactive"];
    return { detail: { saleStatus: d.saleStatus }, signals };
  }
  // bunjang default
  const d = await fetchDetail(String(row.pid));
  const signals = detectSoldOut(d, row.price, { title: row.name });
  return { detail: d ? { saleStatus: d.saleStatus } : null, signals };
}

export async function lifecycleStage(deadlineMs: number, mode: LifecycleClaimMode = "default"): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const sourceHealth = await loadLatestSourceHealth();
  const healthStatus = sourceHealth?.status ?? "degraded";
  const claims = await claimLifecycleChecks(mode);
  stats.claimed = claims.length;
  stats.timingsMs = { claim_mode_terminal_recheck: mode === "terminal_recheck" ? 1 : 0 };
  const marketInvalidations: MarketKeyInvalidationEvent[] = [];

  // 2026-05-16: Bunjang rate limit probe 결과 c=20까지 매우 lenient (probe 600 calls 다 200 응답).
  // sequential for → Promise.all wave concurrency 10. throughput 10배. backlog 45분 해소 예상.
  // c=10은 conservative pick (probe c=20 OK였지만 DB write 부담 고려 + 안전 마진 50%).
  const LIFECYCLE_CONCURRENCY = 10;
  for (let waveStart = 0; waveStart < claims.length; waveStart += LIFECYCLE_CONCURRENCY) {
    const wave = claims.slice(waveStart, waveStart + LIFECYCLE_CONCURRENCY);
    await Promise.all(wave.map(async (row) => {
    if (Date.now() >= deadlineMs - DETAIL_STAGE_SAFETY_MARGIN_MS) {
      stats.timedOut = true;
      await patchLifecycle(row.pid, {
        last_check_result: "skipped_budget",
        next_check_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        state_reason: "lifecycle_budget_guard",
      });
      return;
    }

    if (shouldSkipLifecycleForHealth(row, healthStatus)) {
      stats.poolSkipped += 1;
      await patchLifecycle(row.pid, {
        last_check_result: "skipped_source_degraded",
        next_check_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        state_reason: `source_health_${healthStatus}`,
      });
      return;
    }

    try {
      // Wave launch-41: source 별 detail fetch + sold signal 통합. joongna 도 추적 대상.
      const { detail, signals } = await fetchLifecycleDetailBySource(row);
      if (config.detailDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, config.detailDelayMs));
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
        } else if (nextStatus === "missing_suspect" || nextStatus === "disappeared") {
          // Wave 90: 사용자 코멘트로 발견 (pid 407655201, 407507382 등): 이미 missing_suspect/
          // disappeared 상태인 매물이 풀에 잔류 → 사용자 노출. status 변경 없으면 markRawLifecycleState
          // 호출 안 돼서 invalidate 안 됨. 명시적으로 invalidate 보장 (idempotent).
          await invalidatePoolEntries([{ pid: row.pid, reason: `lifecycle_${nextStatus}_persist` }]).catch(() => undefined);
        }
        return;
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
        return;
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
    })); // Promise.all wave 끝
  }

  stats.upserted = await enqueueMarketKeyInvalidations(marketInvalidations);

  // 2026-05-15 (사용자 코멘트 pid 401500642 / 404643880 / 404436811):
  // lifecycle worker capacity 부족으로 missing_suspect 매물이 14k backlog 누적되어
  // 시세 비교군에 잔존. 매 lifecycle tick 끝에 stale 매물(12h+, consec_missing 2+)을
  // 자동 disappeared 전환 + 풀 invalidate. RPC가 무거우면 limit 1000으로 보호.
  try {
    const drainRes = await restFetch(rpcUrl("drain_stale_missing_suspect"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({ p_stale_hours: 12, p_max_rows: 1000 }),
    });
    const drainRows = (await drainRes.json()) as Array<{ drained_count?: number; pool_invalidated_count?: number }>;
    const drained = Number(drainRows[0]?.drained_count ?? 0);
    if (drained > 0) {
      stats.timingsMs = { ...(stats.timingsMs ?? {}), stale_missing_drained: drained, stale_pool_invalidated: Number(drainRows[0]?.pool_invalidated_count ?? 0) };
    }
  } catch {
    // best-effort. lifecycle main path는 이미 끝났으니 swallow.
  }

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
  const rawByPid = await loadRawPriceNames(rows.map((row) => row.pid));

  for (const row of rows) {
    if (Date.now() >= deadlineMs - DETAIL_STAGE_SAFETY_MARGIN_MS) {
      stats.timedOut = true;
      return stats;
    }
    const raw = rawByPid.get(row.pid);
    stats.claimed += 1;

    // Wave launch-74 (사용자 짚음 "pool-warmer 가 joongna 도 실시간 검증해야"):
    //   joongna 매물 = bunjang fetchDetail 호출 시 404 (pid 7T+ 다른 API).
    //   source 별 분기: bunjang = 기존 facts 갱신 + sold check, joongna = isSoldOutPage check + sold 시 invalidate.
    if (raw?.source === "joongna" && raw.url) {
      const j = await fetchJoongnaDetail(raw.url, 10_000);
      if (config.detailDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, config.detailDelayMs));
      if (!j.ok) {
        stats.detailFailed += 1;
        continue;
      }
      const soldByPage = j.isSoldOutPage === true;
      const soldByStatus = j.productStatus != null && j.productStatus !== 0;
      const soldByText = soldOutTextHits(j.title, j.description).length > 0;
      if (soldByPage || soldByStatus || soldByText) {
        const reason = soldByPage ? "pool_warmer_joongna_sold_page"
          : soldByStatus ? `pool_warmer_joongna_status_${j.productStatus}`
          : "pool_warmer_joongna_text_traded";
        await invalidatePoolEntries([{ pid: row.pid, reason }]);
        stats.poolSkipped += 1;
        continue;
      }
      await markPoolVerified(row.pid);
      stats.enriched += 1;
      continue;
    }

    if (normalizeMarketplaceSource(raw?.source) === "daangn") {
      if (!raw?.url) {
        stats.detailFailed += 1;
        continue;
      }
      const d = await fetchDaangnLiveState(raw.url, 10_000);
      if (config.detailDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, config.detailDelayMs));
      if (!d.ok) {
        if (d.status === 404) {
          const now = new Date().toISOString();
          await Promise.allSettled([
            patchRows("mvp_raw_listings", `pid=eq.${row.pid}`, {
              listing_state: "disappeared",
              sale_status: "missing",
              disappeared_at: now,
              last_missing_at: now,
              updated_at: now,
            }),
            invalidatePoolEntries([{ pid: row.pid, reason: "pool_warmer_daangn_detail_404" }]),
          ]);
          stats.poolSkipped += 1;
          continue;
        }
        stats.detailFailed += 1;
        continue;
      }
      if (d.listingState !== "active") {
        const now = new Date().toISOString();
        const rawPatch: Record<string, unknown> = {
          listing_state: d.listingState,
          sale_status: d.saleStatus,
          updated_at: now,
        };
        if (d.listingState === "sold_confirmed") rawPatch.sold_detected_at = now;
        if (d.listingState === "disappeared") {
          rawPatch.disappeared_at = now;
          rawPatch.last_missing_at = now;
        }
        await Promise.allSettled([
          patchRows("mvp_raw_listings", `pid=eq.${row.pid}`, rawPatch),
          invalidatePoolEntries([{ pid: row.pid, reason: `pool_warmer_daangn_${d.reason}` }]),
        ]);
        stats.poolSkipped += 1;
        continue;
      }
      await markPoolVerified(row.pid);
      stats.enriched += 1;
      continue;
    }

    // bunjang 기존 흐름
    const detail = await fetchDetail(String(row.pid));
    if (config.detailDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, config.detailDelayMs));
    const signals = detectSoldOut(detail, raw?.price, { title: raw?.name });
    if (!detail) {
      stats.detailFailed += 1;
      continue;
    }
    await patchPoolWarmDetailFacts(row.pid, detail);
    if (detail.commentCount != null && detail.commentCount >= MAX_POOL_WARM_NUM_COMMENT) {
      await invalidatePoolEntries([{ pid: row.pid, reason: `num_comment_above_${MAX_POOL_WARM_NUM_COMMENT}_pool_warmer` }]);
      stats.poolSkipped += 1;
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

// P2-1: searchStage가 호출하기 전에 due query 목록을 registry에서 가져온다.
// env list가 source-of-truth이고, registry는 query별 cadence·last_scanned_at 갈무리 역할.
// registry에 없는 query는 5m default로 즉시 due 취급 + 새 row 생성. 운영자가 env에서 query를 빼면 그 query는 더 이상 scan되지 않음.
type DueQueryRow = {
  query: string;
  effective_cadence_minutes: number;
  cadence_minutes: number;
  mode: string;
  reason: string;
  last_scanned_at: string | null;
};

async function loadRegistryQueryStates(queries: string[]): Promise<Map<string, DueQueryRow>> {
  if (queries.length === 0) return new Map();
  const result = new Map<string, DueQueryRow>();
  for (const chunk of chunkArray(queries, 50)) {
    const encoded = chunk.map((q) => encodeURIComponent(q)).join(",");
    const url = `${tableUrl("mvp_search_queries")}?select=query,cadence_minutes,cadence_override,mode,reason,last_scanned_at,enabled&query=in.(${encoded})`;
    try {
      const res = await restFetch(url, { headers: serviceHeaders() });
      const rows = (await res.json()) as Array<{
        query: string;
        cadence_minutes: number;
        cadence_override: number | null;
        mode: string;
        reason: string;
        last_scanned_at: string | null;
        enabled: boolean;
      }>;
      for (const row of rows) {
        if (!row.enabled) continue;
        result.set(row.query, {
          query: row.query,
          cadence_minutes: row.cadence_minutes,
          effective_cadence_minutes: row.cadence_override ?? row.cadence_minutes,
          mode: row.mode,
          reason: row.reason,
          last_scanned_at: row.last_scanned_at,
        });
      }
    } catch (err) {
      console.error("loadRegistryQueryStates failed (fallback to all-due)", { error: err instanceof Error ? err.message : String(err) });
      return new Map();
    }
  }
  return result;
}

export async function filterDueSearchQueries(envQueries: string[]): Promise<string[]> {
  const registry = await loadRegistryQueryStates(envQueries);
  const nowMs = Date.now();
  // Wave 191 (2026-05-18): never_scanned (last_scanned_at NULL) query 우선 정렬.
  //   기존: envQueries 순서 그대로 반환 → categoryQueries + DEFAULT + catalogQueries 순.
  //   문제: 1358 query 중 1016 never_scanned (75%). tickSearchBudgetMs 안에 못 처리되는
  //         후순위 query (lego/kickboard/perfume 등) 가 매번 다음 tick으로 밀려 영영 0건 scan.
  //   사용자 발견: "perfume/lego/kickboard 한 번도 scan 안 됨" — 정당한 의심.
  //   fix: due query를 last_scanned_at 오래된 순 (NULL 가장 우선) 정렬. fair rotation 보장.
  const due: { query: string; lastMs: number }[] = [];
  for (const query of envQueries) {
    const state = registry.get(query);
    if (!state) {
      due.push({ query, lastMs: 0 });
      continue;
    }
    if (!state.last_scanned_at) {
      due.push({ query, lastMs: 0 });
      continue;
    }
    const lastMs = Date.parse(state.last_scanned_at);
    if (!Number.isFinite(lastMs)) {
      due.push({ query, lastMs: 0 });
      continue;
    }
    const dueAt = lastMs + state.effective_cadence_minutes * 60_000;
    if (nowMs >= dueAt) due.push({ query, lastMs });
  }
  // 오래된 순 정렬 (NULL = lastMs 0 = 가장 우선). 같은 시간이면 envQueries 순서 안정 유지.
  due.sort((a, b) => a.lastMs - b.lastMs);
  return interleaveDueQueriesByFamily(due).map((d) => d.query);
}

type DueSearchQuery = { query: string; lastMs: number };

function interleaveDueQueriesByFamily<T extends DueSearchQuery>(due: T[]): T[] {
  const buckets = new Map<string, T[]>();
  for (const row of due) {
    const family = queryFamily(row.query);
    const bucket = buckets.get(family) ?? [];
    bucket.push(row);
    buckets.set(family, bucket);
  }
  const families = Array.from(buckets.keys()).sort((a, b) => {
    const aFirst = buckets.get(a)?.[0]?.lastMs ?? Number.MAX_SAFE_INTEGER;
    const bFirst = buckets.get(b)?.[0]?.lastMs ?? Number.MAX_SAFE_INTEGER;
    if (aFirst !== bFirst) return aFirst - bFirst;
    return a.localeCompare(b);
  });
  const interleaved: T[] = [];
  let remaining = due.length;
  while (remaining > 0) {
    for (const family of families) {
      const bucket = buckets.get(family);
      const row = bucket?.shift();
      if (!row) continue;
      interleaved.push(row);
      remaining -= 1;
    }
  }
  return interleaved;
}

export function interleaveSearchQueriesByFamilyForTest(queries: string[]): string[] {
  return interleaveDueQueriesByFamily(queries.map((query, index) => ({ query, lastMs: index })))
    .map((row) => row.query);
}

async function ensureSearchQueryRows(queries: string[]): Promise<void> {
  if (queries.length === 0) return;
  const rows = queries.map((query) => ({
    query,
    category: queryFamily(query),
    enabled: true,
  }));
  try {
    await restFetch(`${tableUrl("mvp_search_queries")}?on_conflict=query`, {
      method: "POST",
      headers: { ...serviceHeaders("resolution=ignore-duplicates,return=minimal") },
      body: jsonBody(rows),
    });
  } catch (err) {
    console.error("ensureSearchQueryRows failed (continuing)", { error: err instanceof Error ? err.message : String(err) });
  }
}

export async function markSearchQueriesScanned(queries: string[]): Promise<{ ok: number; failed: number; lastError: string | null }> {
  const result = { ok: 0, failed: 0, lastError: null as string | null };
  if (queries.length === 0) return result;
  const now = new Date().toISOString();
  for (const chunk of chunkArray(queries, 50)) {
    const encoded = chunk.map((q) => encodeURIComponent(q)).join(",");
    try {
      await restFetch(`${tableUrl("mvp_search_queries")}?query=in.(${encoded})`, {
        method: "PATCH",
        headers: { ...serviceHeaders("return=minimal") },
        body: jsonBody({ last_scanned_at: now, updated_at: now }),
      });
      result.ok += chunk.length;
    } catch (err) {
      result.failed += chunk.length;
      result.lastError = err instanceof Error ? err.message : String(err);
      console.error("markSearchQueriesScanned failed", { error: result.lastError });
    }
  }
  return result;
}

// 자동 재평가: 최근 24h 데이터로 query별 yield 측정 후 cadence 산출.
// housekeeperStage에서 1시간 cooldown으로 호출한다.
export async function evaluateSearchQueryCadences(): Promise<{
  evaluated: number;
  changed: number;
  upgradedToFaster: number;
  downgradedToSlower: number;
  errors: number;
}> {
  const stats = { evaluated: 0, changed: 0, upgradedToFaster: 0, downgradedToSlower: 0, errors: 0 };
  const cutoffMs = Date.now() - 24 * 60 * 60_000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  // 최근 24h raw_listings를 query별 집계 (PostgREST aggregate 없이 chunk로 가져와 JS 집계).
  // 데이터량이 클 수 있어 raw 컬럼은 query, last_changed_at, listing_state, detail_status, listing_type, pid만.
  const rawRows: Array<{ pid: number; query: string; last_changed_at: string | null; listing_state: string; detail_status: string; listing_type: string }> = [];
  const PAGE = 1000;
  const HARD_CAP = 100_000;
  for (let offset = 0; offset < HARD_CAP; offset += PAGE) {
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,query,last_changed_at,listing_state,detail_status,listing_type&last_seen_at=gte.${encodeURIComponent(cutoffIso)}&order=last_seen_at.desc&offset=${offset}&limit=${PAGE}`;
    let chunk: typeof rawRows;
    try {
      const res = await restFetch(url, { headers: serviceHeaders() });
      chunk = (await res.json()) as typeof rawRows;
    } catch (err) {
      stats.errors += 1;
      console.error("evaluateSearchQueryCadences raw fetch failed", err);
      break;
    }
    rawRows.push(...chunk);
    if (chunk.length < PAGE) break;
  }

  // candidate_pool 전체 status/pid 가져와 pid→status map.
  const poolByPid = new Map<number, string>();
  try {
    const poolRes = await restFetch(`${tableUrl("mvp_candidate_pool")}?select=pid,status&limit=50000`, { headers: serviceHeaders() });
    const poolRows = (await poolRes.json()) as Array<{ pid: number; status: string }>;
    for (const row of poolRows) poolByPid.set(Number(row.pid), row.status);
  } catch (err) {
    stats.errors += 1;
    console.error("evaluateSearchQueryCadences pool fetch failed", err);
  }

  // readiness map.
  const readinessByCategory = new Map<string, { status: CategoryReadinessStatus }>();
  try {
    const res = await restFetch(`${tableUrl("mvp_category_readiness")}?select=category,status`, { headers: serviceHeaders() });
    const rows = (await res.json()) as Array<{ category: string; status: CategoryReadinessStatus }>;
    for (const row of rows) readinessByCategory.set(row.category, { status: row.status });
  } catch (err) {
    stats.errors += 1;
    console.error("evaluateSearchQueryCadences readiness fetch failed", err);
  }

  // query별 집계.
  const yieldByQuery = new Map<string, QueryYieldRow>();
  for (const row of rawRows) {
    const query = String(row.query ?? "").trim();
    if (!query) continue;
    let agg = yieldByQuery.get(query);
    if (!agg) {
      agg = {
        query,
        family: queryFamily(query),
        observed: 0, changed: 0, active: 0, normalType: 0,
        detailsPending: 0, detailsDone: 0,
        poolAny: 0, poolReady: 0, poolReserved: 0, poolSpent: 0,
      };
      yieldByQuery.set(query, agg);
    }
    agg.observed += 1;
    if (row.listing_state === "active") agg.active += 1;
    if (row.detail_status === "pending") agg.detailsPending += 1;
    if (row.detail_status === "done") agg.detailsDone += 1;
    if (row.listing_type === "normal") agg.normalType += 1;
    if (row.last_changed_at && Date.parse(row.last_changed_at) >= cutoffMs) agg.changed += 1;
    const poolStatus = poolByPid.get(Number(row.pid));
    if (poolStatus) {
      agg.poolAny += 1;
      if (poolStatus === "ready") agg.poolReady += 1;
      if (poolStatus === "reserved") agg.poolReserved += 1;
      if (poolStatus === "spent") agg.poolSpent += 1;
    }
  }

  // 기존 registry 상태 fetch (변경 감지용).
  const existing = await loadRegistryQueryStates([...yieldByQuery.keys()]);

  const upserts: Array<{
    query: string;
    category: string;
    cadence_minutes: number;
    mode: string;
    reason: string;
    last_evaluated_at: string;
    last_observed: number;
    last_changed: number;
    last_pool_any: number;
    last_pool_ready: number;
    updated_at: string;
  }> = [];
  const logs: Array<{
    query: string;
    before_cadence_minutes: number | null;
    after_cadence_minutes: number;
    before_mode: string | null;
    after_mode: string;
    reason: string;
    measurement: Record<string, number>;
    source: string;
  }> = [];
  const now = new Date().toISOString();

  for (const row of yieldByQuery.values()) {
    const decision: CadenceDecision = decideCadence(row, readinessByCategory.get(row.family) ?? null);
    stats.evaluated += 1;
    const prior = existing.get(row.query);
    upserts.push({
      query: row.query,
      category: row.family,
      cadence_minutes: decision.cadenceMinutes,
      mode: decision.mode,
      reason: decision.reason,
      last_evaluated_at: now,
      last_observed: row.observed,
      last_changed: row.changed,
      last_pool_any: row.poolAny,
      last_pool_ready: row.poolReady,
      updated_at: now,
    });
    const beforeCadence = prior?.cadence_minutes ?? null;
    const beforeMode = prior?.mode ?? null;
    if (beforeCadence !== decision.cadenceMinutes || beforeMode !== decision.mode) {
      stats.changed += 1;
      if (beforeCadence != null && decision.cadenceMinutes < beforeCadence) stats.upgradedToFaster += 1;
      if (beforeCadence != null && decision.cadenceMinutes > beforeCadence) stats.downgradedToSlower += 1;
      logs.push({
        query: row.query,
        before_cadence_minutes: beforeCadence,
        after_cadence_minutes: decision.cadenceMinutes,
        before_mode: beforeMode,
        after_mode: decision.mode,
        reason: decision.reason,
        measurement: {
          observed: row.observed,
          changed: row.changed,
          poolAny: row.poolAny,
          poolReady: row.poolReady,
        },
        source: prior ? "evaluator" : "seed",
      });
    }
  }

  // upsert registry (cadence_override가 있으면 cadence_minutes 갱신은 무시되어야 함 — PG가 자동으로 함:
  // upsert는 cadence_minutes만 update하고, override는 별도 컬럼이라 영향 없음. effective는 view에서 coalesce.)
  if (upserts.length > 0) {
    for (const chunk of chunkArray(upserts, 100)) {
      try {
        await restFetch(`${tableUrl("mvp_search_queries")}?on_conflict=query`, {
          method: "POST",
          headers: { ...serviceHeaders("resolution=merge-duplicates,return=minimal") },
          body: jsonBody(chunk),
        });
      } catch (err) {
        stats.errors += 1;
        console.error("evaluateSearchQueryCadences upsert failed", err);
      }
    }
  }

  if (logs.length > 0) {
    for (const chunk of chunkArray(logs, 100)) {
      try {
        await restFetch(tableUrl("mvp_search_query_cadence_log"), {
          method: "POST",
          headers: { ...serviceHeaders("return=minimal") },
          body: jsonBody(chunk),
        });
      } catch (err) {
        stats.errors += 1;
        console.error("evaluateSearchQueryCadences log insert failed", err);
      }
    }
  }

  return stats;
}

const QUERY_CADENCE_EVAL_COOLDOWN_MS = 60 * 60_000; // 1시간
const PAYLOAD_RETENTION_COOLDOWN_MS = 24 * 60 * 60_000; // 1일
const PAYLOAD_RETENTION_DAYS = 90;
const PAYLOAD_RETENTION_BATCH_LIMIT = 50_000;
const CRON_EXECUTION_STALE_RUNNING_MINUTES = 10;
const POOL_RAW_RESIDUE_CLEANUP_LIMIT = 2_000;

async function releaseStaleCronExecutionRows(): Promise<number> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - CRON_EXECUTION_STALE_RUNNING_MINUTES * 60_000).toISOString();
  try {
    const res = await restFetch(
      `${tableUrl("mvp_cron_executions")}?select=id&status=eq.running&started_at=lt.${encodeURIComponent(cutoff)}`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders(), Prefer: "return=representation" },
        body: jsonBody({
          status: "released",
          finished_at: now.toISOString(),
          detail: {
            reason: "housekeeper_stale_running_cleanup",
            stale_after_minutes: CRON_EXECUTION_STALE_RUNNING_MINUTES,
          },
        }),
      },
    );
    if (!res.ok) return 0;
    const rows = (await res.json().catch(() => [])) as Array<{ id: number }>;
    return rows.length;
  } catch (err) {
    console.error("[housekeeper] stale cron execution cleanup failed", err);
    return 0;
  }
}

async function invalidateRawNotScorablePoolResidues(limit = POOL_RAW_RESIDUE_CLEANUP_LIMIT): Promise<number> {
  const res = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid&status=in.(ready,reserved)&order=updated_at.asc&limit=${Math.max(1, Math.min(limit, 5_000))}`,
    { headers: serviceHeaders() },
  );
  const poolRows = (await res.json()) as Array<{ pid: number | string }>;
  const pids = poolRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  if (pids.length === 0) return 0;

  const invalidations: Array<{ pid: number; reason: string }> = [];
  for (const chunk of chunkArray(pids, REST_WRITE_CHUNK_SIZE)) {
    const rawRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,source,query,raw_json,pool_eligible,detail_status,listing_state,listing_type,listing_type_override,sku_id&pid=in.(${chunk.join(",")})`,
      { headers: serviceHeaders() },
    );
    const rawRows = (await rawRes.json()) as Array<{
      pid: number | string;
      source: string | null;
      query: string | null;
      raw_json: Record<string, unknown> | null;
      pool_eligible: boolean | null;
      detail_status: string | null;
      listing_state: string | null;
      listing_type: string | null;
      listing_type_override: string | null;
      sku_id: string | null;
    }>;
    const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
    for (const pid of chunk) {
      const raw = rawByPid.get(pid);
      if (!raw) {
        invalidations.push({ pid, reason: "raw_missing_residue" });
        continue;
      }
      if (!isRawPublicPoolEligible(raw)) {
        invalidations.push({ pid, reason: "pool_eligible_false_residue" });
        continue;
      }
      const normalListing = raw.listing_type === "normal" || raw.listing_type_override === "normal";
      if (raw.listing_state !== "active") {
        invalidations.push({ pid, reason: `lifecycle_state_${raw.listing_state ?? "unknown"}_residue` });
      } else if (raw.detail_status !== "done") {
        invalidations.push({ pid, reason: "raw_detail_not_done_residue" });
      } else if (!normalListing) {
        invalidations.push({ pid, reason: "raw_listing_type_not_normal_residue" });
      } else if (!raw.sku_id) {
        invalidations.push({ pid, reason: "wave230_sku_id_null_stale" });
      }
    }
  }

  if (invalidations.length === 0) return 0;
  await invalidatePoolEntries(invalidations);
  const skuNullPids = invalidations
    .filter((entry) => entry.reason === "wave230_sku_id_null_stale")
    .map((entry) => entry.pid);
  if (skuNullPids.length > 0) {
    await patchRowsByIds("mvp_raw_listings", skuNullPids, { score_dirty: true }, REST_WRITE_CHUNK_SIZE);
  }
  return invalidations.length;
}

// P2-2: observation payload 90일 retention 게이트. mvp_cron_locks 테이블을 marker로 재활용해
// 마지막 sweep 시각을 멀티 인스턴스 안전하게 공유한다(lease_until = 다음 실행 가능 시각).
async function shouldRunPayloadRetention(): Promise<boolean> {
  try {
    const res = await restFetch(
      `${tableUrl("mvp_cron_locks")}?select=lease_until&mode=eq.payload_retention_sweep&limit=1`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as Array<{ lease_until: string | null }>;
    const leaseUntil = rows[0]?.lease_until ?? null;
    if (!leaseUntil) return true;
    return Date.parse(leaseUntil) <= Date.now();
  } catch {
    return false;
  }
}

async function recordPayloadRetentionRun(): Promise<void> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + PAYLOAD_RETENTION_COOLDOWN_MS);
  try {
    await restFetch(
      `${tableUrl("mvp_cron_locks")}?on_conflict=mode`,
      {
        method: "POST",
        headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
        body: jsonBody([{
          mode: "payload_retention_sweep",
          owner: "housekeeper",
          acquired_at: now.toISOString(),
          lease_until: leaseUntil.toISOString(),
        }]),
      },
    );
  } catch (err) {
    console.error("[payload-retention] failed to record cooldown marker", err);
  }
}

async function runPayloadRetention(): Promise<number> {
  const res = await restFetch(rpcUrl("prune_listing_observation_payloads"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({ p_days: PAYLOAD_RETENTION_DAYS, p_batch_limit: PAYLOAD_RETENTION_BATCH_LIMIT }),
  });
  const body = await res.text();
  const parsed = Number.parseInt(body.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function shouldRunCadenceEvaluator(): Promise<boolean> {
  // 가장 최근 evaluator 실행 시각을 registry에서 본다(메모리 의존 X, 멀티 인스턴스 안전).
  try {
    const res = await restFetch(
      `${tableUrl("mvp_search_queries")}?select=last_evaluated_at&order=last_evaluated_at.desc.nullslast&limit=1`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as Array<{ last_evaluated_at: string | null }>;
    const lastIso = rows[0]?.last_evaluated_at ?? null;
    if (!lastIso) return true;
    const ageMs = Date.now() - Date.parse(lastIso);
    return Number.isFinite(ageMs) && ageMs >= QUERY_CADENCE_EVAL_COOLDOWN_MS;
  } catch {
    // DB 읽기 실패 시 보수적으로 skip (다음 housekeeper에 다시 시도).
    return false;
  }
}

export async function housekeeperStage(): Promise<StageStats> {
  const stats = emptyStats();
  const now = new Date().toISOString();

  const staleCronExecutionsReleased = await releaseStaleCronExecutionRows();
  if (staleCronExecutionsReleased > 0) {
    stats.timingsMs = {
      ...(stats.timingsMs ?? {}),
      stale_cron_executions_released: staleCronExecutionsReleased,
    };
  }

  try {
    const rawResiduesInvalidated = await invalidateRawNotScorablePoolResidues();
    if (rawResiduesInvalidated > 0) {
      stats.timingsMs = {
        ...(stats.timingsMs ?? {}),
        raw_not_scorable_pool_residues_invalidated: rawResiduesInvalidated,
      };
    }
  } catch (err) {
    console.error("[housekeeper] raw pool residue cleanup failed", err);
  }

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

  // Wave 104 H2: 만료 plan 자동 free 다운그레이드. current_period_end < now인 paid plan → free.
  // cancel_at_period_end=true 사용자도 동일 처리 (취소 예약 → 만료 시 free).
  try {
    const expireRes = await restFetch(rpcUrl("expire_mvp_plans"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({}),
    });
    if (expireRes.ok) {
      const rows = (await expireRes.json().catch(() => [])) as Array<{ expired_count?: number }>;
      const expiredCount = Number(rows[0]?.expired_count ?? 0);
      if (expiredCount > 0) {
        stats.timingsMs = { ...(stats.timingsMs ?? {}), plans_expired: expiredCount };
        console.log(`[housekeeper] expired ${expiredCount} paid plans → free`);
      }
    }
  } catch (err) {
    console.error("expire_mvp_plans failed", err);
  }

  // P2-1: 1시간 cooldown으로 query cadence 자동 재평가.
  // cooldown 체크는 registry에서 가장 최근 last_evaluated_at을 보고 결정(멀티 인스턴스 안전).
  // override 만료도 같이 처리.
  if (await shouldRunCadenceEvaluator()) {
    try {
      await restFetch(rpcUrl("expire_search_query_cadence_overrides"), {
        method: "POST",
        headers: serviceHeaders(),
        body: jsonBody({}),
      });
    } catch (err) {
      console.error("expire cadence overrides failed", err);
    }
    try {
      const result = await evaluateSearchQueryCadences();
      stats.timingsMs = {
        ...(stats.timingsMs ?? {}),
        cadence_evaluator_evaluated: result.evaluated,
        cadence_evaluator_changed: result.changed,
        cadence_evaluator_upgraded: result.upgradedToFaster,
        cadence_evaluator_downgraded: result.downgradedToSlower,
        cadence_evaluator_errors: result.errors,
      };
    } catch (err) {
      console.error("cadence evaluator threw", err);
    }
  }

  // P2-2: observation payload 90일 retention. daily cooldown.
  if (await shouldRunPayloadRetention()) {
    try {
      const deleted = await runPayloadRetention();
      stats.timingsMs = {
        ...(stats.timingsMs ?? {}),
        payload_retention_deleted: deleted,
      };
    } catch (err) {
      console.error("[payload-retention] sweep failed", err);
    }
    // marker는 sweep 성공/실패 무관하게 기록 — 실패 시에도 다음 실행은 24h 뒤로(로그/알람으로 별도 대응).
    await recordPayloadRetentionRun();
  }

  return stats;
}

export async function scoreStage(deadlineMs: number, options: ScoreStageOptions = {}): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const addScoreTiming = (name: string, durationMs: number) => {
    const current = Number(stats.timingsMs?.[name] ?? 0);
    stats.timingsMs = {
      ...(stats.timingsMs ?? {}),
      [name]: current + durationMs,
    };
  };
  const timedScoreSubstage = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const started = Date.now();
    try {
      return await fn();
    } finally {
      addScoreTiming(name, Date.now() - started);
    }
  };
  const timedScoreBlock = <T>(name: string, fn: () => T): T => {
    const started = Date.now();
    try {
      return fn();
    } finally {
      addScoreTiming(name, Date.now() - started);
    }
  };
  const readyFloor = await timedScoreSubstage("score_ready_floor", () => loadPoolReadyFloorState());
  const cleanupEnabled = options.cleanup !== false;
  const unscorableDirtyCleared = !cleanupEnabled || readyFloor.deferCleanup
    ? 0
    : await timedScoreSubstage("score_cleanup_clear_unscorable", () => clearUnscorableScoreDirty(Math.max(config.tickScoreLimit * 20, 1000)));
  const nonScorableDirtyCleared = !cleanupEnabled || readyFloor.deferCleanup
    ? 0
    : await timedScoreSubstage("score_cleanup_clear_non_scorable", () => clearNonScorableScoreDirty(Math.max(config.tickScoreLimit * 2, 500)));
  const poolIneligibleResidues = !cleanupEnabled || readyFloor.deferCleanup
    ? 0
    : await timedScoreSubstage("score_cleanup_pool_ineligible_residue", () => invalidatePoolIneligibleResidues(Math.max(config.tickScoreLimit * 2, 1000)));
  const poolLowSellerRatingResidues = !cleanupEnabled || readyFloor.deferCleanup
    ? 0
    : await timedScoreSubstage("score_cleanup_low_seller_residue", () => invalidatePoolLowSellerRatingResidues(Math.max(config.tickScoreLimit * 2, 1000)));
  const poolStaleParserResidues = !cleanupEnabled || readyFloor.deferCleanup
    ? 0
    : await timedScoreSubstage("score_cleanup_stale_parser_residue", () => invalidatePoolStaleParserResidues(Math.max(config.tickScoreLimit * 2, 1000)));
  const staleInvalidatedPoolDirtyMarked = !cleanupEnabled || readyFloor.deferCleanup
    ? 0
    : await timedScoreSubstage("score_cleanup_mark_stale_invalidated", () => markStaleInvalidatedPoolRowsDirty(Math.min(Math.max(config.tickScoreLimit, 100), 250)));
  const skuMedianUnavailableMarketInvalidations = !cleanupEnabled || readyFloor.deferCleanup
    ? 0
    : await timedScoreSubstage("score_cleanup_enqueue_median_invalidations", () => enqueueSkuMedianUnavailableMarketInvalidations(Math.min(Math.max(config.tickScoreLimit, 100), 250)));
  // Wave launch-44 (사용자 짚음 "invalidated to ready cron 해결책"):
  //   markRecoveredMarketInvalidatedPoolRowsDirty 호출 제거. recovery-worker (별도 cron) 로 이전.
  //   score_worker 부담 ↓ (33% timeout 대응) + recovery 자체 처리량 ↑ (큰 limit 가능).
  const poolAiAuditResidues = !cleanupEnabled || readyFloor.deferCleanup
    ? 0
    : await timedScoreSubstage("score_cleanup_ai_audit_residue", () => invalidatePoolAiAuditResidues(Math.max(config.tickScoreLimit * 2, 1000)));
  stats.timingsMs = {
    ...(stats.timingsMs ?? {}),
    score_lane_b_worker: options.lane === "b" ? 1 : 0,
    score_source_filter_daangn: options.sourceFilter === "daangn" ? 1 : 0,
    score_cleanup_enabled: cleanupEnabled ? 1 : 0,
    score_daangn_shard_count: Math.max(1, Math.floor(Number(options.daangnShardCount ?? 1))),
    score_daangn_shard_index: Math.max(0, Math.floor(Number(options.daangnShardIndex ?? 0))),
    score_pool_ready_floor_count: readyFloor.readyCount,
    score_pool_ready_floor_threshold: readyFloor.threshold,
    score_pool_ready_floor_cleanup_deferred: readyFloor.deferCleanup ? 1 : 0,
    score_unscorable_dirty_cleared_rows: unscorableDirtyCleared,
    score_non_scorable_dirty_cleared_rows: nonScorableDirtyCleared,
    score_pool_ineligible_residue_invalidated_rows: poolIneligibleResidues,
    score_pool_low_seller_rating_residue_invalidated_rows: poolLowSellerRatingResidues,
    score_pool_stale_parser_residue_invalidated_rows: poolStaleParserResidues,
    score_stale_invalidated_pool_dirty_marked_rows: staleInvalidatedPoolDirtyMarked,
    score_sku_median_unavailable_market_invalidations: skuMedianUnavailableMarketInvalidations,
    score_pool_ai_audit_residue_invalidated_rows: poolAiAuditResidues,
  };
  const rows = await timedScoreSubstage("score_load_rows", () => loadScorableRows(config.tickScoreLimit, options));
  stats.timingsMs = {
    ...(stats.timingsMs ?? {}),
    score_rows_loaded: rows.length,
  };
  if (rows.length === 0) return stats;
  const [categoryReadiness, laneReadiness] = await timedScoreSubstage("score_load_readiness", () => Promise.all([
    loadCategoryReadinessMap(),
    loadLaneReadinessMap(),
  ]));
  const parsedByPid = await timedScoreSubstage("score_load_and_parse_rows", async () => ensureParsedRows(rows, await loadParsedRows(rows.map((row) => row.pid))));
  const preciseKeys = timedScoreBlock("score_build_precise_keys", () => rows
    .map((row) => preciseComparableKey(parsedByPid.get(row.pid)))
    .filter((key): key is string => Boolean(key)));
  const marketStatsByKey = await timedScoreSubstage("score_load_market_stats", () => loadMarketPriceStats([
    ...preciseKeys,
    ...preciseKeys.map(shoeSizeAgnosticComparableKey).filter((key): key is string => Boolean(key)),
  ]));

  // Wave 886 Phase 3 (2026-05-26 사용자 결정): per-source 시세 같이 로딩 — 당근 매물 한정 우선 사용.
  //   당근 매물 source = daangn → per-source map 의 daangn stat 시도 (sample ≥ 3 면) → 부족 시 mixed fallback.
  //   비파괴: fetch 실패해도 mixed 만 사용 (try/catch).
  const marketStatsPerSource = await timedScoreSubstage("score_load_market_stats_per_source", () => loadMarketPriceStatsPerSource([
    ...preciseKeys,
    ...preciseKeys.map(shoeSizeAgnosticComparableKey).filter((key): key is string => Boolean(key)),
  ])).catch((err) => {
    console.warn("[wave886] per-source loader fall back to mixed only", err instanceof Error ? err.message : String(err));
    return null as MarketPriceStatsPerSourceMap | null;
  });

  // 2026-05-15: 미개봉/새상품 매물 시세 = 다나와 reference price (쿠팡/네이버 등 합산 최저가).
  // 중고 시세와 비교하면 호가 부풀려 풀에서 빠짐 → 진짜 꿀 매물 놓침.
  // reference price 있으면 미개봉 매물의 skuMedian = 그 가격, 없으면 기존 중고 시세 fallback.
  const referencePricesByKey = await timedScoreSubstage("score_load_reference_prices", async () => {
    try {
      const refRes = await restFetch(
        `${tableUrl("mvp_reference_prices")}?select=comparable_key,effective_price&effective_price=not.is.null`,
        { headers: serviceHeaders() }
      );
      const refRows = (await refRes.json()) as Array<{ comparable_key: string; effective_price: number | null }>;
      const map = new Map<string, number>();
      for (const r of refRows) {
        if (r.effective_price && r.effective_price > 0) map.set(r.comparable_key, r.effective_price);
      }
      return map;
    } catch {
      return new Map<string, number>();
    }
  });

  const effectiveSkuByPid = timedScoreBlock("score_build_effective_sku_map", () => new Map(
    rows.map((row) => [Number(row.pid), effectiveCatalogSkuForScorableRow(row)]),
  ));
  const batchPriceMapStart = Date.now();
  const pricesByMarket = new Map<string, number[]>();
  // Wave 179b (2026-05-17 사용자 코멘트 iPad mini 6 stale): broad SKU mixed batch median 차단.
  // 이전: marketKey 하나에 모든 condition + 다른 세대/옵션 매물 가격 섞임 → median 부풀려짐.
  // 새: marketKey + condition_class 분리. 매물 자체 condition 매칭만 batch median.
  // sample 부족 시 condition_fallback.ts chain 따라 (위로 차단, 같거나 아래로).
  const pricesByMarketCondition = new Map<string, number[]>();
  const favsByMarket = new Map<string, number[]>();
  const pricesBySku = new Map<string, number[]>();
  for (const row of rows) {
    // 2026-05-16: placeholder price (999999999, 111111111 등) 매물의 가격을 시세 fallback sample에서 제외.
    // Wave 218 (2026-05-19): isPlaceholderPrice 헬퍼 사용 (같은 자리수 반복 5+ 패턴 포함).
    if (isPlaceholderPrice(row.price)) continue;
    // Wave 719 (2026-05-23): score-stage 동일 outlier 필터 (시세 fallback sample 부풀림 차단).
    const effectiveSku = effectiveSkuByPid.get(Number(row.pid)) ?? null;
    if (isPriceOutlierForSku(row.price, effectiveSku?.id ?? null)) continue;
    const skuId = effectiveSku?.id ?? "";
    const parsedRow = parsedByPid.get(row.pid);
    const marketKey = marketGroupKey(row, parsedRow);
    const condClass = parsedRow?.condition_class ?? "normal";
    const compositeKey = `${marketKey}|${condClass}`;
    if (!pricesByMarket.has(marketKey)) pricesByMarket.set(marketKey, []);
    if (!favsByMarket.has(marketKey)) favsByMarket.set(marketKey, []);
    if (!pricesBySku.has(skuId)) pricesBySku.set(skuId, []);
    if (!pricesByMarketCondition.has(compositeKey)) pricesByMarketCondition.set(compositeKey, []);
    pricesBySku.get(skuId)!.push(row.price);
    pricesByMarket.get(marketKey)!.push(row.price); // legacy (favsByMarket용 sample size)
    pricesByMarketCondition.get(compositeKey)!.push(row.price);
    favsByMarket.get(marketKey)!.push(row.num_faved);
  }
  addScoreTiming("score_build_batch_price_maps", Date.now() - batchPriceMapStart);

  const _skuMsrp = new Map(CATALOG.map((sku) => [sku.id, sku.msrpKrw]));
  const now = new Date().toISOString();
  const scoredRows: PipelineRow[] = [];

  // Wave 159k (2026-05-17): score-stage condition AI 호출 daily limit.
  // 측정 결과 detail-worker만으로는 AI condition 호출 0건 (11K trigger 대상 매물 모두 미작동).
  // env PIPELINE_SCORE_AI_CONDITION_DAILY_LIMIT > 0 일 때 활성. default 0 = 비활성.
  let conditionAiCallsLeft = 0;
  if (config.scoreAiConditionDailyLimit > 0) {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const countRes = await restFetch(
        `${tableUrl("mvp_listing_ai_classifications")}?select=pid&condition_class=not.is.null&classified_at=gte.${todayStart.toISOString()}&limit=1`,
        { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
      );
      const range = countRes.headers.get("content-range") ?? "0-0/0";
      const todayCount = Number(range.split("/")[1] ?? 0);
      conditionAiCallsLeft = Math.max(0, config.scoreAiConditionDailyLimit - todayCount);
    } catch {
      conditionAiCallsLeft = 0;
    }
  }

  let needsReviewSkipped = 0;
  const parserNeedsReviewPoolInvalidations: { pid: number; reason: string }[] = [];
  let phase2EscrowSelected = 0;
  const phase2EscrowFlagByPid = new Map<string, "ai_escrow_pending">();
  const handledPids: number[] = [];
  const scoreRowLoopStart = Date.now();
  for (const row of rows) {
    if (Date.now() >= deadlineMs) {
      stats.timedOut = true;
      break;
    }
    // 처리 시도 자체를 했다면 dirty=false 후보. needs_review가 다시 false로 바뀌면
    // detail-worker의 raw patch에서 score_dirty=true로 재마킹된다.
    handledPids.push(Number(row.pid));
    const effectiveSku = effectiveSkuByPid.get(Number(row.pid)) ?? null;
    if (!effectiveSku) continue;
    const skuId = effectiveSku?.id ?? "";
    const parsed = parsedByPid.get(row.pid);
    // P0-8: needs_review=true인 parsed는 신뢰도 낮음. score 계산 자체를 건너뛰고
    // mvp_listings/mvp_listing_analysis output에 못 들어가게 한다. pool에는 이미 pool-policy에서 차단되어 있지만,
    // listings output을 통해 노출되는 경로(랜딩/디버그/관리)에서 보이는 것을 막는다.
    // parsed가 아예 없는 경우(ensureParsedRows 실패)는 기존처럼 fallback 처리.
    //
    // Wave 33: Phase 2 escrow gate. AI_L2_ESCROW_PHASE2_ENABLED=1 + narrow smartphone +
    // parse_confidence >= 0.55 row는 scoreStage를 통과시키되, pool-policy의
    // `ai_escrow_pending` flag로 pool 진입을 차단한다. AI verdict 후 detail-worker가
    // flag 제거 + score_dirty=true 재마킹. gate OFF가 default → 기존 skip 동작 유지.
    if (parsed?.needs_review === true) {
      const escrow = evaluatePhase2Escrow({ parsed, selectedSoFar: phase2EscrowSelected });
      if (!escrow.eligible) {
        needsReviewSkipped += 1;
        parserNeedsReviewPoolInvalidations.push({ pid: Number(row.pid), reason: "parser_needs_review" });
        continue;
      }
      phase2EscrowSelected += 1;
      phase2EscrowFlagByPid.set(String(row.pid), escrow.flag);
    }
    // Wave 159k (2026-05-17): score-stage condition AI 호출 (env enable 시).
    // 매물별 trigger: ambiguous(0.55~0.75) + description 보유. daily limit 초과 시 skip.
    // detail-worker가 처리 못한 기존 매물 backfill 효과.
    if (
      conditionAiCallsLeft > 0
      && parsed
      && parsed.condition_score != null
      && parsed.condition_score >= 0.55
      && parsed.condition_score <= 0.75
      && row.description_preview
    ) {
      const aiClass = await classifyConditionWithAi(Number(row.pid), row.name ?? "", row.description_preview).catch(() => null);
      if (aiClass) {
        parsed.condition_class = aiClass;
        conditionAiCallsLeft -= 1;
      }
    }

    const marketKey = marketGroupKey(row, parsed);
    const comparableKey = preciseComparableKey(parsed);
    // Wave 130 (2026-05-16): 매물 condition_class에 매칭되는 시세 row 선택 (sample 부족 시 fallback).
    // 사업 보고서 L2: 같은 SKU+옵션도 condition별 시세 spread 15~40% — 정확성 ↑.
    const byCondition = comparableKey ? marketStatsByKey.get(comparableKey) : undefined;
    const exactMixedMarketStat = pickMarketStatByCondition(byCondition, parsed?.condition_class ?? null);
    // Wave 886 Phase 3 (2026-05-26 사용자 결정): 매물 source 일치 per-source stat 시도.
    //   당근 매물 (source=daangn): 같은 SKU/condition 의 당근 sample ≥ 3 → 당근 median.
    //   Wave 897 (2026-05-28): 당근은 local execution market 이라 mixed fallback 으로 차익 계산 금지.
    //   번장/중나 매물: per-source 도 시도하되 부족하면 mixed fallback 유지.
    const perSourceMarketStat = pickPerSourceStatForMatter(
      marketStatsPerSource,
      comparableKey,
      parsed?.condition_class ?? null,
      row.source,
      parsed?.category,
    );
    const matterSource = normalizeMarketplaceSource(row.source);
    const requiresSourceMarket = matterSource === "daangn";
    const exactMarketStat = perSourceMarketStat ?? (requiresSourceMarket ? undefined : exactMixedMarketStat);
    let marketStat = exactMarketStat;
    let trustedMedian = trustedMarketMedian(marketStat, parsed?.category);
    let usedShoeSizeAnyMarket = false;
    if (trustedMedian == null && comparableKey && !requiresSourceMarket) {
      const sizeAnyKey = shoeSizeAgnosticComparableKey(comparableKey);
      const sizeAnyStat = pickMarketStatByCondition(
        sizeAnyKey ? marketStatsByKey.get(sizeAnyKey) : undefined,
        parsed?.condition_class ?? null,
      );
      const sizeAnyMedian = trustedMarketMedian(sizeAnyStat, parsed?.category);
      if (sizeAnyMedian != null) {
        marketStat = sizeAnyStat;
        trustedMedian = sizeAnyMedian;
        usedShoeSizeAnyMarket = true;
      }
    }
    // Wave 179b (2026-05-17 사용자 코멘트): 매물 condition 매칭 batch median 우선.
    // 같은 marketKey + condition_class 매물끼리만 batch (broad SKU mixed 차단).
    // sample 부족 시 condition-fallback chain (worn → normal → all, mint/unopened 위로 X).
    const targetCondition = parsed?.condition_class ?? "normal";
    const condFallback = conditionFallbackChain(targetCondition);
    let prices: number[] = [];
    for (const cond of condFallback) {
      const key = `${marketKey}|${cond}`;
      const candidate = pricesByMarketCondition.get(key) ?? [];
      if (candidate.length >= (parsed?.category === "shoe" ? 2 : 5)) {
        prices = candidate;
        break;
      }
      if (candidate.length > prices.length) prices = candidate; // 마지막 fallback용
    }
    const _coarsePrices = pricesBySku.get(skuId) ?? [];
    const hasTrustedMarket = trustedMedian != null;
    // Wave 90 (2026-05-15): catalog gap 분석 결과 (broad SKU 42 변형 / 가격 ratio 20x)로
    // root cause 발견. MSRP × 0.5 fallback + sku_id coarse 평균 둘 다 부정확.
    // 정확한 시세 source 우선순위:
    //   1. trustedMedian (mvp_market_price_daily의 comparable_key 기준 daily aggregate) — 가장 정확
    //   2. prices ≥ 5 (marketGroupKey 기준 batch median, parsed OK면 comparable_key) — 정확
    //   3. coarsePrices (sku_id 기준 broad 평균) — broad SKU 부정확 → 폐기
    //   4. MSRP × 0.5 fallback — false positive 양산 → 폐기
    // sample 부족 SKU는 sku_median=0 → bandFromProfit null → 풀 진입 차단 (정확성 우선 §12b)
    // Wave 106 (MJ 코멘트 #3 갤럭시 워치7): outlier 1건이 평균 끌어올림 — madTrim 적용으로
    // ±3 MAD 벗어난 outlier 제거. 5건 이상이면 trim, 미만이면 raw median (madTrim 자체가 5건 미만은 trim X).
    //
    // Wave 174 (2026-05-17): 신발 한정 batch median threshold 5 → 2 — Wave 173 trustedMedian
    // 완화에도 신발 시세 daily coverage 1.7%라 priceGap=0 → pool 0건. 같은 batch 안 동일
    // marketKey 매물 2건+ 시 batch median 사용. outlier 위험은 Wave 171 ceiling(msrp×5) +
    // 가품 floor 4 tier + 광고 차단 72 patterns + 셀러당 1 pool entry safety nets로 차단.
    const fallbackThreshold = parsed?.category === "shoe" ? 2 : 5;
    const fallbackMedian = prices.length >= fallbackThreshold ? madTrim(prices).medianValue : 0;
    // 2026-05-15: 미개봉/새상품 매물의 시세 = 다나와 reference_price (쿠팡/네이버 등 새 가격) 우선.
    // 베타테스터 통찰: 업자/일반인 모두 미개봉 선호 → 미개봉 매물 시세 정확해야.
    // 중고 시세와 비교하면 호가 부풀어져 풀에서 빠짐 (진짜 꿀 매물 놓침).
    const conditionNotesScore = (parsedJsonObject(parsed)?.condition_notes as string[] | undefined) ?? [];
    const isNewItem = conditionNotesScore.includes("new_or_open_box");
    const referencePrice = comparableKey && isNewItem ? referencePricesByKey.get(comparableKey) : null;
    const skuMedianCandidate = referencePrice != null && referencePrice > 0
      ? referencePrice
      : hasTrustedMarket ? trustedMedian : fallbackMedian;
    const skuMedian = Math.max(0, Number(skuMedianCandidate ?? 0));
    // 2026-05-16: placeholder price 매물 (999999999, 111111111 등)은 priceGap 0 강제 → score 0 → 풀 진입 차단.
    // Wave 218 (2026-05-19): isPlaceholderPrice 헬퍼 사용 (같은 자리수 반복 5+ 패턴 포함).
    // Wave 719 (2026-05-23): 카테고리별 outlier (iphone 1억, macbook 2200만 등)도 priceGap=0 → 풀 차단.
    const placeholder = isPlaceholderPrice(row.price) || isPriceOutlierForSku(row.price, effectiveSku?.id ?? null);
    const priceGap = placeholder || skuMedian <= 0 ? 0 : Math.max(0, Math.min(1, (skuMedian - row.price) / skuMedian));
    const velocity = percentileRank(favsByMarket.get(marketKey) ?? [], row.num_faved);
    const safetyBase = row.shop_review_rating == null ? 0.5 : Math.max(0, Math.min(1, Number(row.shop_review_rating) / 5));
    const sellerSafety = Math.max(0, Math.min(1, safetyBase + (row.shop_review_count >= 100 ? 0.05 : 0)));
    const conditionScore = parsed?.condition_score == null ? 0.75 : Math.max(0, Math.min(1, Number(parsed.condition_score)));
    const safety = Math.max(0, Math.min(1, sellerSafety * 0.7 + conditionScore * 0.3));
    const riskHits = ["직거래만", "현금만", "박스없음", "박스 없음", "수리이력", "충전안됨", "충전 안됨", "고장", "불량", "먹통"]
      .filter((kw) => row.description_preview.toLowerCase().includes(kw.toLowerCase())).length;
    const parseConfidence = Number(parsed?.parse_confidence ?? 0);
    const precisionPenalty = (parseConfidence > 0 && parseConfidence < 0.65 ? 0.75 : 1) * (hasTrustedMarket ? 1 : 0.65);
    const score = (priceGap * 0.5 + velocity * 0.4 + safety * 0.1) * 100 * precisionPenalty;
    const apiParsed = parseShippingFromTrade(row.trade_data, row.trades_data);
    const descParsed = parseShippingFromDescription(row.description_preview);
    const shipping = resolveShipping(row.price, skuMedian, row.free_shipping, apiParsed, descParsed);
    const scoreFlags: string[] = [];
    if (priceGap >= 0.75) scoreFlags.push("extreme_discount_review");
    if (priceGap >= 0.55) scoreFlags.push("deep_discount_review");
    if (riskHits > 0) scoreFlags.push("risk_keyword_review");
    if (row.description_preview.trim().length < 20) scoreFlags.push("weak_description");
    if (!hasTrustedMarket) {
      scoreFlags.push("coarse_market_price");
      if (!comparableKey || !marketStat) {
        // Wave 175 (2026-05-17): 신발 한정 — fallbackMedian > 0 (batch median 계산됨)이면
        // market_stat_missing 박지 X. Wave 174에서 신발 batch threshold 2로 완화한 효과를
        // pool-policy block flag가 무효화하던 사각지대 차단.
        // Wave 175b (2026-05-17): referencePrice (unopened 매물 다나와 시세) 사용도 포함 —
        // skuMedian > 0이면 시세 source 무엇이든 시세 있음. 검증 시점 priceGap > 0 매물 18건
        // (unopened referencePrice case) 차단 발견.
        const hasShoeUsableMedian = parsed?.category === "shoe" && skuMedian > 0;
        if (!hasShoeUsableMedian) scoreFlags.push("market_stat_missing");
      } else if (marketStat.confidence === "low") scoreFlags.push("market_confidence_low");
    }
    if (usedShoeSizeAnyMarket) scoreFlags.push("shoe_size_any_market_price");
    if (parseConfidence > 0 && parseConfidence < 0.65) scoreFlags.push("option_parse_review");
    if (parsed?.needs_review) scoreFlags.push("option_needs_review");
    const escrowFlag = phase2EscrowFlagByPid.get(String(row.pid));
    if (escrowFlag) scoreFlags.push(escrowFlag);
    if (conditionScore < 0.65) scoreFlags.push("condition_review");
    const unknownParts = parserUnknownParts(parsed, comparableKey);
    const criticalUnknownParts = parserCriticalUnknownParts(parsed);
    const aiEscrowKind = aiEscrowKindForParserMetadata(parsed, unknownParts, criticalUnknownParts);

    scoredRows.push({
      pid: String(row.pid),
      url: row.url,
      name: row.name,
      price: row.price,
      skuId,
      skuName: effectiveSku?.modelName ?? skuId,
      skuMedian: Math.round(skuMedian),
      saleStatus: row.sale_status,
      descriptionPreview: row.description_preview?.slice(0, 200) ?? null,
      imageUrlTemplate: row.image_url_template,
      imageCount: row.image_count ?? null,
      thumbnailUrl: row.thumbnail_url,
      source: row.source ?? null,
      priceGap,
      numFaved: row.num_faved,
      velocity,
      reviewRating: row.shop_review_rating,
      reviewCount: row.shop_review_count,
      safety,
      riskHits,
      score,
      scoreFlags,
      parseConfidence: parsed?.parse_confidence ?? null,
      parserNeedsReview: parsed?.needs_review ?? null,
      comparableKey,
      parserUnknownParts: unknownParts,
      parserCriticalUnknown: criticalUnknownParts,
      aiEscrowKind,
      // Wave 132 (2026-05-16): row.num_comment를 PipelineRow에 박음 → candidate-pool-builder가 >= 8 gate에서 사용.
      numComment: row.num_comment ?? null,
      // Wave 137 (2026-05-16): row.qty → candidate-pool-builder qty > 1 gate.
      qty: row.qty ?? null,
      // Wave 138 (2026-05-16): seller_uid → seller-level pool gate (다수 매물 차단).
      sellerUid: row.seller_uid ?? null,
      // Wave 138b (2026-05-16): description hash → multi-ID 사기 그룹 차단 gate.
      descriptionHash: row.description_hash ?? null,
      // Wave 145 (2026-05-16): 셀러 신뢰도 → 가품 floor v2 tier 2 gate.
      shopReviewCount: row.shop_review_count ?? null,
      shopReviewRating: row.shop_review_rating ?? null,
      daangnMannerTemperature: row.daangn_manner_temperature ?? null,
      poolEligible: row.pool_eligible ?? null,
      poolEligibleFalseStale: isStaleBunjangPoolEligibleFalse(row),
      ...shipping,
    });
  }
  addScoreTiming("score_row_loop", Date.now() - scoreRowLoopStart);

  let parserNeedsReviewPoolInvalidationDeferred = 0;
  if (parserNeedsReviewPoolInvalidations.length > 0) {
    const guarded = await timedScoreSubstage("score_filter_parser_needs_review_invalidations", () => filterPoolInvalidationsForReadyFloor(parserNeedsReviewPoolInvalidations, readyFloor));
    parserNeedsReviewPoolInvalidationDeferred = guarded.deferred;
    await timedScoreSubstage("score_invalidate_parser_needs_review_pool", () => invalidatePoolEntries(guarded.entries));
  }

  const aiReview = await timedScoreSubstage("score_apply_ai_review", () => applyAiReview(scoredRows, {
    enabled: config.aiReviewTopN > 0,
    topN: config.aiReviewTopN,
    concurrency: config.aiReviewConcurrency,
  }));
  stats.aiReviewRequested = aiReview.stats.requested;
  stats.aiCacheHits = aiReview.stats.cacheHits;
  stats.aiApiCalls = aiReview.stats.apiCalls;
  stats.aiUnavailable = aiReview.stats.unavailable;
  stats.aiFiltered = aiReview.stats.filtered;
  stats.aiKeptNormal = aiReview.stats.keptNormal;
  stats.aiKeptLowConfidence = aiReview.stats.keptLowConfidence;

  // Wave 34: escrow unavailable row는 다음 tick에서 재시도되도록 raw.score_dirty=true 재마킹.
  // gate OFF 면 escrowUnavailablePids 는 빈 배열이므로 no-op.
  if (aiReview.escrowUnavailablePids.length > 0) {
    const scoreDirtyAvailable = await rawScoreDirtySchemaAvailable();
    if (scoreDirtyAvailable) {
      const ids = aiReview.escrowUnavailablePids.map((p) => Number(p)).filter(Number.isFinite);
      if (ids.length > 0) {
        await patchRowsByIds("mvp_raw_listings", ids, { score_dirty: true }, REST_WRITE_CHUNK_SIZE);
      }
    }
  }

  const listings = timedScoreBlock("score_build_listing_outputs", () => toListingOutputRows(aiReview.rows, now));
  const rankedAnalyses = timedScoreBlock("score_build_analysis_outputs", () => toRankedAnalysisRows(aiReview.rows, now));
  const existingOutputs = await timedScoreSubstage("score_load_existing_outputs", () => loadExistingScoreOutputs(listings.map((row) => row.pid)));
  const listingDiffCounts = new Map<string, number>();
  const analysisDiffCounts = new Map<string, number>();
  const listingUpserts: ListingOutputRow[] = listings.filter((row) => {
    const reasons = listingOutputDiffReasons(row, existingOutputs.listings.get(row.pid));
    incrementCount(listingDiffCounts, reasons);
    return listingOutputChanged(row, existingOutputs.listings.get(row.pid));
  });
  const analysisUpserts: AnalysisOutputRow[] = rankedAnalyses.filter((row) => {
    const reasons = analysisOutputDiffReasons(row, existingOutputs.analyses.get(row.pid));
    incrementCount(analysisDiffCounts, reasons);
    return analysisOutputChanged(row, existingOutputs.analyses.get(row.pid));
  });

  await timedScoreSubstage("score_upsert_listings", () => upsertRows("mvp_listings", listingUpserts, "pid"));
  await timedScoreSubstage("score_upsert_analysis", () => upsertRows("mvp_listing_analysis", analysisUpserts, "pid"));
  stats.scored = scoredRows.length;
  stats.upserted = new Set([
    ...listingUpserts.map((row) => row.pid),
    ...analysisUpserts.map((row) => row.pid),
  ]).size;
  stats.timingsMs = {
    ...(stats.timingsMs ?? {}),
    score_output_rows: listings.length,
    score_listing_upsert_rows: listingUpserts.length,
    score_listing_skipped_rows: listings.length - listingUpserts.length,
    score_analysis_upsert_rows: analysisUpserts.length,
    score_analysis_skipped_rows: rankedAnalyses.length - analysisUpserts.length,
    ...topCountTimings("score_listing_diff", listingDiffCounts),
    ...topCountTimings("score_analysis_diff", analysisDiffCounts),
  };

  // Wave 138 (2026-05-16): pool에 이미 있는 seller_uid별 매물 수 fetch.
  // 새 매물이 같은 셀러 매물 추가 진입 시도 시 차단 (qty 위장 업자 탐지).
  // Wave 138b: 다중 ID 사기 그룹 hash set (같은 description + 다른 셀러 2+).
  // Wave 224 (2026-05-19): SKU 별 7d 매물 수 < 3 차단 — 사용자 정책 "매물 받쳐주는 거만".
  //   sparse SKU (LV variant / Yeezy colorway / 한정 Jordan / Hoka 모델 등) pool 진입 차단.
  const daangnVolumeTargetSkuIds = new Set(
    aiReview.rows
      .filter((row) => normalizeMarketplaceSource(row.source) === "daangn")
      .map((row) => row.skuId)
      .filter((skuId): skuId is string => Boolean(skuId)),
  );
  const lowVolumeTargetSkuIds = new Set(
    aiReview.rows
      .map((row) => row.skuId)
      .filter((skuId): skuId is string => (
        Boolean(skuId) &&
        (skuId.startsWith("shoe-") || skuId.startsWith("clothing-") || skuId.startsWith("bag-"))
      )),
  );
  const poolGateTargetSellerUids = new Set(
    aiReview.rows
      .map((row) => row.sellerUid)
      .filter((sellerUid): sellerUid is string => Boolean(sellerUid)),
  );
  const poolGateTargetDescriptionHashes = new Set(
    aiReview.rows
      .map((row) => row.descriptionHash)
      .filter((hash): hash is string => Boolean(hash)),
  );
  stats.timingsMs = {
    ...(stats.timingsMs ?? {}),
    score_pool_gate_target_sellers: poolGateTargetSellerUids.size,
    score_pool_gate_target_hashes: poolGateTargetDescriptionHashes.size,
    score_pool_gate_low_volume_target_skus: lowVolumeTargetSkuIds.size,
    score_pool_gate_daangn_volume_target_skus: daangnVolumeTargetSkuIds.size,
  };

  const [existingPoolSellerCounts, fraudGroupHashes, lowVolumeSkuIds, daangnVolumeBySku] = await timedScoreSubstage("score_load_pool_gate_inputs", () => Promise.all([
    timedScoreSubstage("score_load_existing_pool_seller_counts", () => loadExistingPoolSellerCounts(poolGateTargetSellerUids)).catch((err) => {
      console.warn("loadExistingPoolSellerCounts failed (non-fatal)", err);
      return new Map<string, number>();
    }),
    timedScoreSubstage("score_load_fraud_group_hashes", () => loadFraudGroupHashes(poolGateTargetDescriptionHashes)).catch((err) => {
      console.warn("loadFraudGroupHashes failed (non-fatal)", err);
      return new Set<string>();
    }),
    timedScoreSubstage("score_load_low_volume_sku_ids", () => loadLowVolumeSkuIds(lowVolumeTargetSkuIds)).catch((err) => {
      console.warn("loadLowVolumeSkuIds failed (non-fatal)", err);
      return new Set<string>();
    }),
    timedScoreSubstage("score_load_daangn_volume_by_sku", () => loadDaangnVolumeBySku(daangnVolumeTargetSkuIds)).catch((err) => {
      console.warn("loadDaangnVolumeBySku failed (non-fatal)", err);
      return new Map<string, number>();
    }),
  ]));

  const poolBuild = timedScoreBlock("score_build_candidate_pool_rows", () => buildCandidatePoolRows({
    rows: aiReview.rows,
    parsedByPid,
    catalogById,
    categoryReadiness,
    laneReadiness,
    now,
    latestParserVersionByCategory: LATEST_PARSER_VERSION_BY_CATEGORY,
    existingPoolSellerCounts,
    fraudGroupHashes,
    lowVolumeSkuIds,
    daangnVolumeBySku,
  }));
  const poolBuildPids = poolBuild.entries
    .map((entry) => Number(entry.pid))
    .filter(Number.isFinite);
  const rawPoolEligibilityByPid = new Map(rows.map((row) => [Number(row.pid), {
    source: row.source ?? null,
    query: row.query ?? null,
    raw_json: row.raw_json ?? null,
    pool_eligible: row.pool_eligible ?? null,
  }]));
  const rawPoolIneligiblePids = await timedScoreSubstage("score_load_raw_pool_ineligible_pids", () => loadRawPoolIneligiblePids(poolBuildPids));
  const poolEntries = poolBuild.entries.filter((entry) => {
    const pid = Number(entry.pid);
    const rawEligibility = rawPoolEligibilityByPid.get(pid);
    return (!rawEligibility || isRawPublicPoolEligible(rawEligibility)) && !rawPoolIneligiblePids.has(pid);
  });
  const runtimePoolEligibilityInvalidations = poolBuild.entries
    .filter((entry) => {
      const pid = Number(entry.pid);
      const rawEligibility = rawPoolEligibilityByPid.get(pid);
      return (rawEligibility ? !isRawPublicPoolEligible(rawEligibility) : false) || rawPoolIneligiblePids.has(pid);
    })
    .map((entry) => ({ pid: Number(entry.pid), reason: "pool_eligible_false" }))
    .filter((entry) => Number.isFinite(entry.pid));
  await timedScoreSubstage("score_upsert_candidate_pool", () => upsertRows("mvp_candidate_pool", poolEntries, "pid"));
  const poolAiAuditCacheSynced = await timedScoreSubstage("score_sync_pool_ai_audit_cache", () => syncPoolAiAuditStatusesFromCurrentCache(poolEntries, aiReview.rows));
  await timedScoreSubstage("score_promote_lifecycle_priority", () => promoteLifecyclePriority(
    poolEntries.map((entry) => Number(entry.pid)).filter(Number.isFinite),
    "pool",
    new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  ));
  const poolInvalidations = [...poolBuild.invalidations, ...runtimePoolEligibilityInvalidations].map((entry) => {
    const parsed = parsedByPid.get(Number(entry.pid));
    return {
      ...entry,
      category: parsed?.category ?? null,
      comparable_key: parsed?.comparable_key ?? null,
      condition_class: parsed?.condition_class ?? null,
    };
  });
  const guardedPoolInvalidations = await timedScoreSubstage("score_filter_pool_invalidations", () => filterPoolInvalidationsForReadyFloor(poolInvalidations, readyFloor));
  await timedScoreSubstage("score_invalidate_pool_entries", () => invalidatePoolEntries(guardedPoolInvalidations.entries));
  const postPoolIneligibleResidues = !cleanupEnabled || readyFloor.deferCleanup
    ? 0
    : await timedScoreSubstage("score_cleanup_post_pool_ineligible_residue", () => invalidatePoolIneligibleResidues(Math.max(config.tickScoreLimit * 2, 1000)));
  const postPoolStaleParserResidues = !cleanupEnabled || readyFloor.deferCleanup
    ? 0
    : await timedScoreSubstage("score_cleanup_post_stale_parser_residue", () => invalidatePoolStaleParserResidues(Math.max(config.tickScoreLimit * 2, 1000)));

  // Wave 238 (2026-05-19): shadow audit — ready 매물 중 AI 안 본 매물 강제 호출.
  //   baseline 91.1% AI 안 봄 → fashion mismatch 근본 source. Option A 본체.
  //   Phase 1 = shadow audit 기록, Phase 2 = fashion non-pass ready/reserved 즉시 cleanup.
  //   비용 cap (AI_L2_DAILY_BUDGET_USD env, default $10/일) + telegram alert.
  try {
    const auditStats = await timedScoreSubstage("score_run_shadow_audit", () => runShadowAudit({
      rows: aiReview.rows,
      poolEntries: poolEntries.map((e) => ({
        pid: Number(e.pid),
        category: (e.category as string | null) ?? null,
      })),
      resolveSkuId: (pid) => {
        const row = aiReview.rows.find((r) => Number(r.pid) === pid);
        return row?.skuId ?? null;
      },
    }));
    (stats as Record<string, unknown>).aiL2ShadowAudit = {
      enabled: auditStats.enabled,
      candidates: auditStats.candidates,
      audited: auditStats.audited,
      pass: auditStats.passCount,
      hold: auditStats.holdCount,
      reject: auditStats.rejectCount,
      learning_enqueued: auditStats.learningEnqueued,
      budget_ok: auditStats.budgetGuardOk,
      spent_usd: Number(auditStats.spentUsdToday.toFixed(4)),
      budget_usd: auditStats.budgetUsd,
      duration_ms: auditStats.durationMs,
    };
    if (auditStats.audited > 0) {
      console.info("[wave238] shadow audit", {
        candidates: auditStats.candidates,
        audited: auditStats.audited,
        pass: auditStats.passCount,
        hold: auditStats.holdCount,
        reject: auditStats.rejectCount,
        learning_enqueued: auditStats.learningEnqueued,
        spent_usd: auditStats.spentUsdToday.toFixed(4),
      });
    }
  } catch (err) {
    // shadow audit 실패는 pipeline 전체 중단 X — Phase 1 비파괴 원칙.
    console.warn("[wave238] shadow audit failed (non-fatal)", err);
    (stats as Record<string, unknown>).aiL2ShadowAuditError = (err as Error).message?.slice(0, 200) ?? "unknown";
  }
  const postAuditPoolAiAuditResidues = !cleanupEnabled || readyFloor.deferCleanup
    ? 0
    : await timedScoreSubstage("score_cleanup_post_ai_audit_residue", () => invalidatePoolAiAuditResidues(Math.max(config.tickScoreLimit * 2, 1000)));
  stats.timingsMs = {
    ...(stats.timingsMs ?? {}),
    score_pool_ineligible_pre_upsert_blocked_rows: runtimePoolEligibilityInvalidations.length,
    score_pool_ineligible_post_residue_invalidated_rows: postPoolIneligibleResidues,
    score_pool_stale_parser_post_residue_invalidated_rows: postPoolStaleParserResidues,
    score_pool_ready_floor_invalidations_deferred_rows: guardedPoolInvalidations.deferred,
    score_parser_needs_review_ready_floor_deferred_rows: parserNeedsReviewPoolInvalidationDeferred,
    score_pool_ai_audit_synced_from_cache: poolAiAuditCacheSynced,
    score_pool_ai_audit_post_residue_invalidated_rows: postAuditPoolAiAuditResidues,
  };
  stats.poolUpserted = poolEntries.length;
  stats.poolSkipped = poolBuild.skipped;
  // Wave 190 (2026-05-18): 풀 진입 0건 디버깅 — skip reason 별 카운터.
  //   기존엔 stats.poolSkipped 총합만 있어서 어느 gate가 차단했는지 모름.
  //   사용자 보고 "drone/lego/kickboard/perfume candidate_pool 0건" 진단 시 1시간+ 걸림.
  //   각 reason 별 카운터 stats + console 양쪽에 출력.
  (stats as Record<string, unknown>).poolSkipReasons = poolBuild.skipReasonCounts;
  if (Object.keys(poolBuild.skipReasonCounts).length > 0) {
    const topReasons = Object.entries(poolBuild.skipReasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    console.info("pool skip reasons (top 8)", {
      totalSkipped: poolBuild.skipped,
      totalAccepted: poolEntries.length,
      reasons: Object.fromEntries(topReasons),
    });
  }

  // P0-5/P0-8: score를 처리한 row(needs_review로 skip된 것 포함) 모두 dirty=false.
  // - 시도 자체를 했다면 다음 tick에 다시 후보가 되지 않게 한다.
  // - needs_review가 나중에 false로 바뀌는 시점은 detail-worker가 parsed를 갱신할 때이고,
  //   그때 raw_listings.score_dirty=true로 다시 마킹되어 자연스럽게 재진입한다.
  // - budget timeout으로 일부만 처리했다면 그 부분만 내림 — 나머지는 dirty=true 그대로.
  const processedPids = handledPids.filter(Number.isFinite);
  await timedScoreSubstage("score_clear_score_dirty", () => clearScoreDirty(processedPids));
  stats.timingsMs = {
    ...(stats.timingsMs ?? {}),
    score_dirty_cleared_rows: processedPids.length,
    score_needs_review_skipped: needsReviewSkipped,
    score_needs_review_pool_invalidated: parserNeedsReviewPoolInvalidations.length - parserNeedsReviewPoolInvalidationDeferred,
    score_phase2_escrow_selected: phase2EscrowSelected,
    score_phase2_escrow_gate_enabled: isPhase2EscrowEnabled() ? 1 : 0,
    score_phase2_escrow_resolved_pass: aiReview.stats.escrowResolvedPass,
    score_phase2_escrow_held: aiReview.stats.escrowHeld,
    score_phase2_escrow_unavailable_retry: aiReview.stats.escrowUnavailableRetry,
  };
  return stats;
}

// Wave 255 (2026-05-20): parser_version drift auto-detection.
// 사용자 발견 root cause (사용자 SQL 검증):
//   - scoreStage 가 score_dirty=true 매물만 처리 → ensureParsedRows 호출
//   - score_dirty=false + parser_version drift 매물 평생 옛 분류
//   - 매 wave 박을 때 manual rematch 필요 = whack-a-mole 진짜 본질
// fix: cron tick 마다 parser_version mismatch 매물 sample 검색 → score_dirty=true 자동 set
//   - 미래 모든 parser_version bump 자동 production 적용 (manual rematch 불필요)
//   - additive only (score_dirty: false → true = 정상 reparse trigger)
// systemic: LATEST_PARSER_VERSION_BY_CATEGORY 의 모든 카테고리 자동 cover.
// 효과: Wave 254.5 (fashion v8) + 254.6 (regex 우선순위) production 적용 자동화.
export async function parserDriftStage(deadlineMs: number): Promise<StageStats> {
  const stats = emptyStats();
  const deadlineGuardMs = 30_000;

  const scoreDirtyAvailable = await rawScoreDirtySchemaAvailable();
  if (!scoreDirtyAvailable) return stats; // legacy compat

  for (const [category, latestVersion] of Object.entries(LATEST_PARSER_VERSION_BY_CATEGORY)) {
    if (!latestVersion) continue;
    if (Date.now() > deadlineMs - deadlineGuardMs) break;

    // Wave 257 (2026-05-20): ORDER BY updated_at ASC — 옛 매물 우선 마킹 + sample limit 3000 (속도 3x).
    //   사용자 발견 root: Wave 255 sample 정렬 X → 같은 매물 반복 fetch → 사용자 매물 (가젤 볼드 / 눕시 쇼츠) 영원히 미마킹.
    //   fix: 가장 옛 매물 (updated_at ASC) 부터 마킹 — 사용자 우려 영역 (1-2일 전 매물) 우선.
    //   limit 3000 (옛 1000) — 17,711 stale → 6 tick (~7분) 완료.
    const sampleLimit = (category === "bag" || category === "bike") ? 1500 : 3000;
    const url = `${tableUrl("mvp_listing_parsed")}?select=pid&category=eq.${encodeURIComponent(category)}&parser_version=neq.${encodeURIComponent(latestVersion)}&order=updated_at.asc&limit=${sampleLimit}`;

    let rows: Array<{ pid: number | string }> = [];
    try {
      const res = await restFetch(url, { headers: serviceHeaders() });
      if (!res.ok) {
        console.error(`[parserDriftStage] ${category} fetch ${res.status}`);
        continue;
      }
      rows = await res.json();
    } catch (err) {
      console.error(`[parserDriftStage] ${category} fetch exception`, err);
      continue;
    }

    if (!Array.isArray(rows) || rows.length === 0) continue;
    const pids = rows.map((r) => Number(r.pid)).filter(Number.isFinite);
    if (pids.length === 0) continue;

    try {
      await patchRowsByIds("mvp_raw_listings", pids, { score_dirty: true }, REST_WRITE_CHUNK_SIZE);
      console.log(`[parserDriftStage] ${category}: marked ${pids.length} drift → score_dirty=true (target: ${latestVersion})`);
    } catch (err) {
      console.error(`[parserDriftStage] ${category} patch fail`, err);
    }
  }

  return stats;
}

// Wave 778: systemic pool_eligible RPC hook.
// 문제 (Wave 772 발견 root): bunjang ingest 시 pool_eligible flag 누락 (joongna 만 박혔음).
//   → ready 카테고리 (game_console/sport_golf 등) 매물 detail=done 인데 pool_eligible=false 로 영원히 stuck.
//   → Wave 772 manual SQL 1,347건 fix → Wave 778 manual SQL 20,969건 추가 fix (systemic 누락 확인).
// systemic fix: cron tick 마다 ready 카테고리 detail=done 매물 자동 pool_eligible=true + score_dirty=true 마킹.
//   ensure_pool_eligible_for_ready_categories() RPC (SECURITY DEFINER plpgsql) — additive only.
//   → 미래 모든 신규 ready 카테고리 매물 자동 pool 진입 (manual SQL 불필요).
//   → bunjang/joongna ingest 누락 source-level fix 까지 시간 벌어줌.
export async function poolEligibleBackfillStage(deadlineMs: number): Promise<StageStats> {
  const stats = emptyStats();
  if (Date.now() > deadlineMs) return stats;

  try {
    const res = await restFetch(rpcUrl("ensure_pool_eligible_for_ready_categories"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({}),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[poolEligibleBackfillStage] RPC ${res.status}: ${body.slice(0, 200)}`);
      return stats;
    }
    const updated = Number(await res.json().catch(() => 0)) || 0;
    if (updated > 0) {
      console.log(`[poolEligibleBackfillStage] flagged ${updated} ready-category matters → pool_eligible=true + score_dirty=true`);
    }
    stats.upserted = updated;
  } catch (err) {
    console.error(`[poolEligibleBackfillStage] exception`, err);
  }

  return stats;
}

export async function runTickPipeline(): Promise<TickResult> {
  const config = loadPipelineRuntimeConfig();
  const stageDurationsMs: Record<string, number> = {};

  const search = await timedStage(stageDurationsMs, "search", () => searchStage(Date.now() + config.tickSearchBudgetMs));
  const detail = await timedStage(stageDurationsMs, "detail", () => detailStage(Date.now() + config.tickDetailBudgetMs));
  // Wave 255: parser_version drift 매물 자동 trigger (score_dirty=false + drift → score_dirty=true)
  const parserDrift = await timedStage(stageDurationsMs, "parser_drift", () => parserDriftStage(Date.now() + 60_000));
  // Wave 778: ready 카테고리 매물 pool_eligible 자동 backfill (bunjang ingest 누락 systemic safety net)
  const poolBackfill = await timedStage(stageDurationsMs, "pool_eligible_backfill", () => poolEligibleBackfillStage(Date.now() + 15_000));
  const score = await timedStage(stageDurationsMs, "score", () => scoreStage(Date.now() + config.tickScoreBudgetMs));
  const total = mergeStats([search, detail, parserDrift, poolBackfill, score]);
  return {
    ...total,
    stages: { search, detail, score },
    stageDurationsMs,
  };
}

export async function runSearchScorePipeline(): Promise<TickResult> {
  const config = loadPipelineRuntimeConfig();
  const stageDurationsMs: Record<string, number> = {};

  const search = await timedStage(stageDurationsMs, "search", () => searchStage(Date.now() + config.tickSearchBudgetMs, {
    pages: [0],
    mode: "fresh",
    maxQueries: config.tickSearchQueryLimit,
  }));
  const score = config.tickInlineScoreEnabled
    ? await timedStage(stageDurationsMs, "score", () => scoreStage(Date.now() + config.tickScoreBudgetMs))
    : emptyStats();
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

  const page = pageOverride != null
    ? Math.max(1, Math.min(config.deepCrawlMaxPage, Math.round(pageOverride)))
    : rotatedDeepPage(config.deepCrawlMaxPage);
  const search = await timedStage(stageDurationsMs, "deep", () => searchStage(Date.now() + config.tickSearchBudgetMs, {
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

  const search = emptyStats();
  const detail = await timedStage(stageDurationsMs, "detail", () => detailStage(Date.now() + config.tickDetailBudgetMs));
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

  const search = emptyStats();
  const detail = await timedStage(stageDurationsMs, "pool_warmer", () => poolWarmerStage(Date.now() + config.tickDetailBudgetMs));

  // Wave 93b: pool-warmer가 ready 매물을 추가한 직후 hotdeal enqueue + dispatch.
  // 별도 cron 불필요 — 기존 5분 주기에 piggyback. 새 ready 매물이 들어오는 자연스러운 시점.
  const hotdealStats = await timedStage(stageDurationsMs, "hotdeal", async () => {
    const stats = emptyStats();
    try {
      const { enqueueHotdealsFromPool, dispatchAvailableHotdeals } = await import("@/lib/hotdeal");
      const enq = await enqueueHotdealsFromPool();
      const dis = await dispatchAvailableHotdeals();
      stats.upserted = enq.enqueued;
      stats.scored = dis.sent;
      stats.aiFiltered = dis.admin_shadowed;
      stats.timingsMs = {
        hotdeal_scanned: enq.scanned,
        hotdeal_enqueued: enq.enqueued,
        hotdeal_skipped_existing: enq.skipped_existing,
        hotdeal_claimed: dis.claimed,
        hotdeal_sent: dis.sent,
        hotdeal_failed: dis.failed,
        hotdeal_admin_shadow: dis.admin_shadowed,
      };
    } catch (err) {
      console.error("[hotdeal stage] failed", err);
    }
    return stats;
  });

  const score = emptyStats();
  const total = mergeStats([search, detail, hotdealStats, score]);
  return {
    ...total,
    stages: { search, detail, hotdeal: hotdealStats, score },
    stageDurationsMs,
  };
}

// Wave launch-44 (사용자 짚음 "invalidated to ready cron 해결책"):
//   recovery-worker 전용 stage. score-worker 에서 분리.
//
//   배경 측정 (launch-43):
//   - score_worker avg 40s / p95 72s / max 88s / 33% timeout (90s lease 한계)
//   - 1 stage 안 7 책임 (scoring + 4종 residue + 2종 recovery) 묶임
//   - recovery cron 마킹 매 분 200+ (가치 검증) but score_worker 시간 ~5-10s 차지
//
//   분리 효과:
//   - score_worker 부담 ↓ (33% timeout → 20-25% 추정)
//   - recovery 자체 limit ↑ 가능 (250 → 500) — 더 빠른 backlog 해소
//   - 새 worker 가벼움 (한 함수만 호출, 예상 5-15초)
//
//   향후 (별 wave) 큰 fix:
//   - 옵션 E (event-driven scheduled retry) — invalidate 시점 next_score_check_at 박음
//   - 옵션 F (worker split 전체) — score-worker 의 cleanup/residue 도 별 worker
export async function recoveryStage(): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  // launch-44: limit 250 → 500 (별 worker 라 시간 여유). 60s lease 안 충분.
  const recoveryLimit = Math.min(Math.max(config.tickScoreLimit * 2, 250), 500);
  const recoveredMarked = await markRecoveredMarketInvalidatedPoolRowsDirty(recoveryLimit);
  stats.upserted = recoveredMarked;
  stats.timingsMs = {
    recovery_marked_rows: recoveredMarked,
    recovery_limit: recoveryLimit,
  };
  return stats;
}

export async function runRecoveryWorkerPipeline(): Promise<TickResult> {
  const stageDurationsMs: Record<string, number> = {};
  const search = emptyStats();
  const detail = emptyStats();
  const score = await timedStage(stageDurationsMs, "recovery", () => recoveryStage());
  const total = mergeStats([search, detail, score]);
  return {
    ...total,
    stages: { search, detail, recovery: score, score: emptyStats() },
    stageDurationsMs,
  };
}

export async function runLifecycleWorkerPipeline(options: { terminalRecheck?: boolean } = {}): Promise<TickResult> {
  const config = loadPipelineRuntimeConfig();
  const stageDurationsMs: Record<string, number> = {};
  const mode: LifecycleClaimMode = options.terminalRecheck ? "terminal_recheck" : "default";

  const search = emptyStats();
  // Wave 187 B2 (2026-05-17): tickDetailBudgetMs (20s) → lifecycleBudgetMs (75s) 전용 budget.
  //   route maxDuration 90s 활용 — batch 800/1000 처리 시 timeout 차단.
  const detail = await timedStage(stageDurationsMs, "lifecycle", () => lifecycleStage(Date.now() + config.lifecycleBudgetMs, mode));
  stageDurationsMs.lifecycleMode = options.terminalRecheck ? 1 : 0;
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

  const search = emptyStats();
  const detail = emptyStats();
  const health = await timedStage(stageDurationsMs, "source_health", () => sourceHealthStage());
  const market = await timedStage(stageDurationsMs, "market_stats", () => marketStatsStage());
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

  const search = emptyStats();
  const detail = emptyStats();
  const score = await timedStage(stageDurationsMs, "housekeeper", () => housekeeperStage());
  const total = mergeStats([search, detail, score]);
  return {
    ...total,
    stages: { search, detail, score },
    stageDurationsMs,
  };
}
