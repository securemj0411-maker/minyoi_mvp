import { createHash } from "node:crypto";

import { searchPage, fetchDetail, type SearchItem } from "@/lib/bunjang";

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
import { CATALOG, ruleMatch, skuById, type Sku } from "@/lib/catalog";
import {
  decayTrimmedSellerMarket,
  madTrim,
  percentileRank,
  trimmedSellerMarket,
} from "@/lib/market-math";
import { notifyOperationalAlerts, type OperationalAlert } from "@/lib/operational-notifier";
import { bunjangLabelToConditionClass, extractConditionClass, parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import {
  applyAiReview,
  classifyConditionWithAi,
  classifyListing,
  parseShippingFromDescription,
  parseShippingFromTrade,
  resolveShipping,
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
  type SourceHealthStatus,
} from "@/lib/sold-out";
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

type RawListingRow = {
  pid: number;
  name: string;
  price: number;
  num_faved: number;
  free_shipping: boolean;
  url: string;
  seller_uid: string | null;
  thumbnail_url: string | null;
  listing_type: string;
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
  missing_count: number;
  last_missing_at: string | null;
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
  needs_review: boolean | null;
  parsed_json: Record<string, unknown> | null;
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
  active_sample_count: number;
  sold_sample_count: number;
  disappeared_sample_count: number;
  confidence: "high" | "medium" | "low";
  computed_at: string;
};

// Wave 130: comparable_key → (condition_class → row) 이중 map.
type MarketPriceStatsMap = Map<string, Map<string, MarketPriceRow>>;

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
const REST_READ_CHUNK_SIZE = 25;
const RAW_EXISTING_READ_CHUNK_SIZE = 500;
const POOL_PID_READ_CHUNK_SIZE = 500;
const REST_WRITE_CHUNK_SIZE = 50;
const RAW_TOUCH_WRITE_CHUNK_SIZE = 400;
const SELLER_WRITE_CHUNK_SIZE = 200;
// Keep seller_uid=in.(...) URLs under common proxy/request-line limits.
const SELLER_READ_CHUNK_SIZE = 80;
const DEFAULT_SELLER_SEARCH_REFRESH_MS = 3 * 60 * 60 * 1000;
const PARSED_PID_READ_CHUNK_SIZE = 300;
const REST_KEY_READ_CHUNK_SIZE = 50;
const TERMINAL_LISTING_STATES = new Set(["sold_confirmed", "disappeared", "archived"]);
const TITLE_TRIAGE_SKIP_VERSION = "title_triage_v1";
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

const SKIP_DETAIL_DECISION: DetailQueueDecision = {
  queue: false,
  reason: "search_only_update",
  priority: 0,
  listingType: "unchanged_detail",
  skuId: null,
  skuName: null,
  purpose: "skip",
};

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
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,price,num_faved,free_shipping,url,seller_uid,thumbnail_url,listing_type,sku_id,sku_name,detail_status,detail_enriched_at,detail_error,last_seen_at,last_changed_at,source_updated_at,listing_state,missing_count,last_missing_at&pid=in.(${chunk.join(",")})`;
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
  if (!decision || decision.queue || decision.reason === "search_only_update") return null;
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
  const scannedQueries: string[] = [];

  searchLoop:
  for (const query of dueQueries) {
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
  const detailDecisions = timedSearchBlock(timingsMs, "build_detail_decisions", () => new Map(
    detailRefreshItems.map((item) => [item.pid, detailQueueDecision(item, existing.get(Number(item.pid)))])
  ));
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
  await timedSearchSubstage(timingsMs, "patch_title_triage_skips", async () => {
    for (const group of titleTriageSkipGroups) {
      await patchRowsByIds("mvp_raw_listings", group.ids, {
        ...group.payload,
        updated_at: now,
      }, RAW_TOUCH_WRITE_CHUNK_SIZE);
    }
  });

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
  await timedSearchSubstage(timingsMs, "touch_raw_listings", async () => {
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
  await timedSearchSubstage(timingsMs, "request_terminal_lifecycle_recheck", () => requestTerminalLifecycleRecheck(
    items
      .filter((item) => statePatches.get(item.pid)?.terminal_preserved)
      .map((item) => Number(item.pid))
      .filter(Number.isFinite),
    now,
  ));
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
          // Wave 141 B (2026-05-16): 모호 매물 condition AI 분류 — 정규식 fail 매물에만 호출 (월 ~$9).
          // 조건: condition_score 모호(0.55~0.75) + 명확한 condition_notes 없음 + bunjang label "매핑 불가"
          // → AI 호출 → 결과로 conditionClass override.
          // 2026-05-17 (사용자 코멘트 #158): 이전 조건 `!detail.conditionLabel` 은 영어 enum truthy 때문에
          //   매핑 실패한 label 매물도 AI skip 됐음. 매핑 가능 (= metadata 신뢰) 시만 AI skip 으로 수정.
          const ambiguousCondition = parsed.conditionScore >= 0.55 && parsed.conditionScore <= 0.75;
          const hasStrongSignal = parsed.conditionNotes.some((n) =>
            ["new_or_open_box", "display_defect", "screen_replaced", "faceid_issue",
             "water_damage", "parts_only", "low_battery_health"].includes(n));
          const bunjangLabelMapped = bunjangLabelToConditionClass(detail.conditionLabel);
          if (ambiguousCondition && !hasStrongSignal && bunjangLabelMapped === null) {
            const aiClass = await classifyConditionWithAi(Number(claim.pid), claim.name, detail.description).catch(() => null);
            if (aiClass) {
              parsed.conditionClass = aiClass;
            }
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

async function loadScorableRows(limit: number): Promise<ScorableRawRow[]> {
  // P0-5: event-driven score. score_dirty=true인 row만 처리한다.
  // search touch만 발생한 row(변경 없음)는 dirty 안 됨 → score 재계산 안 함.
  // raw upsert / detail enrichment / market invalidation 시점에 dirty=true로 마킹.
  const scoreDirtyAvailable = await rawScoreDirtySchemaAvailable();
  // Wave 132: num_comment 추가 — candidate-pool-builder가 >= 8 차단.
  const baseColumns = "pid,name,price,num_faved,free_shipping,url,description_preview,shop_review_rating,shop_review_count,trade_data,trades_data,image_url_template,image_count,thumbnail_url,sku_id,sku_name,sale_status,num_comment,qty,description_hash";
  const columns = scoreDirtyAvailable ? `${baseColumns},pool_eligible` : baseColumns;
  const dirtyFilter = scoreDirtyAvailable ? "&score_dirty=eq.true" : "";
  const url = `${tableUrl("mvp_raw_listings")}?select=${columns}${dirtyFilter}&detail_status=eq.done&or=(listing_type.eq.normal,listing_type_override.eq.normal)&sku_id=not.is.null&listing_state=eq.active&order=last_seen_at.desc&limit=${limit}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as ScorableRawRow[];
}

async function clearScoreDirty(pids: number[]): Promise<void> {
  if (!(await rawScoreDirtySchemaAvailable())) return;
  const unique = [...new Set(pids.filter(Number.isFinite))];
  if (unique.length === 0) return;
  for (const chunk of chunkArray(unique, REST_WRITE_CHUNK_SIZE)) {
    await patchRowsByIds("mvp_raw_listings", chunk, { score_dirty: false }, REST_WRITE_CHUNK_SIZE);
  }
}

async function markRawScoreDirtyByComparableKeys(comparableKeys: string[]): Promise<number> {
  if (!(await rawScoreDirtySchemaAvailable())) return 0;
  const unique = [...new Set(comparableKeys.filter(Boolean))];
  if (unique.length === 0) return 0;
  // comparable_key를 가진 parsed pid를 모은 뒤 raw_listings.score_dirty=true.
  const parsedByPid = await loadParsedRowsByComparableKeys(unique, 5000);
  const pids = [...parsedByPid.keys()];
  if (pids.length === 0) return 0;
  for (const chunk of chunkArray(pids, REST_WRITE_CHUNK_SIZE)) {
    await patchRowsByIds("mvp_raw_listings", chunk, { score_dirty: true }, REST_WRITE_CHUNK_SIZE);
  }
  return pids.length;
}

async function loadMarketStatRows(limit: number): Promise<ScorableRawRow[]> {
  // Wave 132: num_comment 추가 (시세 sample 분석 시 활용 가능).
  const columns = "pid,name,price,num_faved,free_shipping,url,description_preview,shop_review_rating,shop_review_count,trade_data,trades_data,image_url_template,image_count,thumbnail_url,sku_id,sku_name,listing_state,sale_status,num_comment,qty,description_hash";
  const url = `${tableUrl("mvp_raw_listings")}?select=${columns}&detail_status=eq.done&or=(listing_type.eq.normal,listing_type_override.eq.normal)&sku_id=not.is.null&listing_state=in.(active,sold_confirmed,disappeared)&order=detail_enriched_at.desc.nullslast,last_seen_at.desc&limit=${limit}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as ScorableRawRow[];
}

async function loadMarketStatRowsByPids(pids: number[], limit: number): Promise<ScorableRawRow[]> {
  const unique = [...new Set(pids.filter(Number.isFinite))].slice(0, limit);
  if (unique.length === 0) return [];
  // Wave 132: num_comment 추가.
  const columns = "pid,name,price,num_faved,free_shipping,url,description_preview,shop_review_rating,shop_review_count,trade_data,trades_data,image_url_template,image_count,thumbnail_url,sku_id,sku_name,listing_state,sale_status,num_comment,qty,description_hash";
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
  const columns = "pid,parser_version,category,comparable_key,parse_confidence,condition_score,condition_class,needs_review,parsed_json";
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
  // Wave 130: condition_class 컬럼 fetch — 시세 산정 grouping key.
  const columns = "pid,parser_version,category,comparable_key,parse_confidence,condition_score,condition_class,needs_review,parsed_json";
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
      category: (row.category as Sku["category"] | null) ?? null,
      comparable_key: (row.comparable_key as string | null) ?? null,
      parse_confidence: (row.parse_confidence as number | null) ?? null,
      condition_score: (row.condition_score as number | null) ?? null,
      // Wave 130: condition_class — option-parser가 채움. 시세 grouping key.
      condition_class: (row.condition_class as string | null) ?? null,
      needs_review: (row.needs_review as boolean | null) ?? null,
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
    "computed_at",
  ].join(",");
  const encoded = unique.map((key) => encodeURIComponent(key)).join(",");
  // limit 늘림 — comparable_key당 condition class 6개 + 며칠치.
  const url = `${tableUrl("mvp_market_price_daily")}?select=${columns}&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc&limit=${Math.max(2000, unique.length * 12)}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  const rows = (await res.json()) as MarketPriceRow[];
  const result: MarketPriceStatsMap = new Map();
  for (const row of rows) {
    const byCond = result.get(row.comparable_key) ?? new Map<string, MarketPriceRow>();
    if (!byCond.has(row.condition_class)) byCond.set(row.condition_class, row);
    result.set(row.comparable_key, byCond);
  }
  return result;
}

// Wave 130: 매물 condition_class에 가장 적합한 시세 row 선택. sample 부족 시 fallback chain 적용.
// 시세 산정 (tick-pipeline) 용 — pack-open의 selectMarketRowByCondition과 같은 정책.
const SCORE_CONDITION_FALLBACK: Record<string, string[]> = {
  mint: ["mint", "clean", "normal", "all"],
  clean: ["clean", "normal", "mint", "all"],
  normal: ["normal", "clean", "worn", "all"],
  worn: ["worn", "normal", "all"],
  low_batt: ["low_batt", "all"],
  flawed: ["flawed", "all"],
  all: ["all", "normal", "clean", "worn", "mint"],
};

function pickMarketStatByCondition(
  byCondition: Map<string, MarketPriceRow> | undefined,
  conditionClass: string | null,
): MarketPriceRow | undefined {
  if (!byCondition || byCondition.size === 0) return undefined;
  const target = conditionClass ?? "normal";
  const order = SCORE_CONDITION_FALLBACK[target] ?? [target, "normal", "all"];
  // 우선순위 따라 sample 충분한 row 선택 (3건+). 부족하면 다음 class.
  for (let i = 0; i < order.length; i++) {
    const cls = order[i];
    const cand = byCondition.get(cls);
    if (!cand) continue;
    const samples =
      Number(cand.active_sample_count ?? 0) +
      Number(cand.sold_sample_count ?? 0) +
      Number(cand.disappeared_sample_count ?? 0);
    if (samples >= 3 || i === order.length - 1) return cand;
  }
  // 마지막 fallback — 어떤 row라도 반환
  return byCondition.values().next().value;
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
  if (category === "shoe") {
    if (total < 2) return null;
  } else {
    if (total < 3) return null;
    if (stat.confidence === "low" && total < 5) return null;
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

function workerFailureAlerts(
  workerBreakdown: Map<string, { total: number; failed: number; collected: number; enriched: number }>,
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
      const severity = bucket.total >= 3 && failureRate >= 0.2
        ? "critical"
        : bucket.total >= 3 && failureRate >= 0.05
          ? "warning"
          : null;
      if (!severity) return null;
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
  const operationalAlerts = workerFailureAlerts(workerBreakdown);
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
async function loadFraudGroupHashes(): Promise<Set<string>> {
  try {
    const res = await restFetch(rpcUrl("get_fraud_group_hashes"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({}),
    });
    const rows = (await res.json()) as Array<{ description_hash: string }>;
    return new Set(rows.map((r) => r.description_hash).filter(Boolean));
  } catch (err) {
    console.warn("loadFraudGroupHashes failed (non-fatal)", err);
    return new Set();
  }
}

// Wave 138 (2026-05-16): pool에 이미 있는 seller_uid별 매물 수 — buildCandidatePoolRows에 전달.
// 같은 셀러 다수 매물 추가 진입 차단 (qty 위장 업자 탐지).
async function loadExistingPoolSellerCounts(): Promise<Map<string, number>> {
  try {
    // pool ready 매물의 pid 가져온 후 raw_listings.seller_uid join (PostgREST 단순 query)
    const poolUrl = `${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.ready&limit=5000`;
    const poolRes = await restFetch(poolUrl, { headers: serviceHeaders() });
    const poolRows = (await poolRes.json()) as Array<{ pid: number }>;
    const pids = poolRows.map((r) => Number(r.pid)).filter(Number.isFinite);
    if (pids.length === 0) return new Map();

    const counts = new Map<string, number>();
    // chunk fetch
    for (const chunk of chunkArray(pids, 500)) {
      const rawUrl = `${tableUrl("mvp_raw_listings")}?select=seller_uid&pid=in.(${chunk.join(",")})&seller_uid=not.is.null`;
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
  const byKey = new Map<string, {
    comparableKey: string;
    conditionClass: string;
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
    // 14건 발견 (mvp_listings 0.12%). 진짜 호가 아니라 시세 집계에 끼면 평균 끌어올림.
    if (row.price >= 100_000_000 || row.price <= 0) continue;

    const conditionNotes = (parsed.parsed_json?.condition_notes as string[] | undefined) ?? [];
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
    // Wave 130: grouping key = (comparable_key, condition_class). 같은 SKU+옵션이라도
    // condition별 별도 시세 산정.
    const key = `${parsed.comparable_key}|${conditionClass}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        comparableKey: parsed.comparable_key,
        conditionClass,
        rows: [],
        activeRows: [],
        soldRows: [],
        disappearedRows: [],
        skuId: row.sku_id,
      });
    }
    const group = byKey.get(key)!;
    group.rows.push(row);
    const effectiveState = isActiveSaleStatus(row.sale_status) ? row.listing_state : "sold_confirmed";
    if (effectiveState === "sold_confirmed") group.soldRows.push(row);
    else if (effectiveState === "disappeared") group.disappearedRows.push(row);
    else group.activeRows.push(row);
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
  const FAKE_FLOOR_CATEGORIES_MARKET = new Set<string>(["shoe", "bag"]);
  const FAKE_FLOOR_RATIO_MARKET = 0.15;
  // Wave 171: price ceiling outlier 시세 제외 (msrp의 5배 초과 = 콜라보/한정/inflate)
  const FAKE_CEILING_RATIO_MARKET = 5;
  for (const group of byKey.values()) {
    if (!group.skuId) continue;
    const sku = skuById(group.skuId);
    if (!sku?.msrpKrw) continue;
    if (!FAKE_FLOOR_CATEGORIES_MARKET.has(sku.category)) continue;
    const floor = sku.msrpKrw * FAKE_FLOOR_RATIO_MARKET;
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
    // 수정: sold 1건 이상이면 거래가 반영 (50/50). sold 많을수록 weight 증가.
    const blendedMedian =
      soldMedian != null && sold.count >= 8 && activeMedian != null && active.count >= 5
        ? Math.round((soldMedian * 0.7) + (activeMedian * 0.3))
        : soldMedian != null && sold.count >= 5 && activeMedian != null
          ? Math.round((soldMedian * 0.6) + (activeMedian * 0.4))
          : soldMedian != null && sold.count >= 5
            ? soldMedian
            : soldMedian != null && sold.count >= 1 && activeMedian != null
              ? Math.round((soldMedian * 0.5) + (activeMedian * 0.5))
              : soldMedian != null && sold.count >= 1
                ? soldMedian
                : activeMedian != null
                  // 2026-05-15: sold 0건 + 호가만 → 호가 × 0.92 (한국 중고시장 평균 네고율 5~15% 중간값 추정).
                  // 호가 100%는 비현실적 — 셀러 부른 가격이고 실거래는 보통 낮음. 보수적 추정 (정확성 > recall, LAUNCH_PLAN §12b).
                  // TODO (2026-05-29 이후, 베타 데이터 1~2주 누적 후): 실제 거래 vs 호가 차이 측정해서 카테고리별 factor로 교체.
                  // 측정 방법 — 사용자 카드 클릭 → 번개장터 가서 거래 시도 결과 telegram 피드백 → A/B 데이터로 0.92 검증.
                  // 카테고리별 추정치: 휴대폰 ~0.95 (네고율 5%), 가전/노트북 ~0.88 (네고율 12%), 패션 ~0.80 (네고율 20%).
                  ? Math.round(activeMedian * 0.92)
                  : disappearedMedian != null && disappeared.count >= 8
                    ? Math.round(disappearedMedian * 0.9)
                    : disappearedMedian;
    const confidenceBasis = sold.count >= 8 ? sold.count : active.count;
    const confidence = confidenceBasis >= 20 ? "high" : confidenceBasis >= 8 ? "medium" : "low";
    return {
      date: today,
      comparable_key: comparableKey,
      // Wave 130: condition_class — PK 일부. condition별 별도 row.
      condition_class: group.conditionClass,
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
  await upsertRows("mvp_market_price_daily", marketRows, "date,comparable_key,condition_class");
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
  // Once a pending key has been loaded and the current eligible sample was inspected,
  // close the invalidation even if no row survived the active/sold/disappeared filters.
  // Otherwise low-sample or now-ineligible comparable_keys stay pending forever and make
  // the market queue look permanently backlogged.
  const completedInvalidationKeys = pendingInvalidations.length > 0 ? [...pendingKeys] : recomputedKeys;
  const closedInvalidations = await markMarketInvalidationsDone(completedInvalidationKeys);
  // P0-5: 시세가 갱신된 comparable_key의 raw_listings는 score를 재계산해야 한다.
  // 같은 매물이라도 trustedMedian이 바뀌면 priceGap/score가 달라지므로 dirty=true.
  const markedDirty = await markRawScoreDirtyByComparableKeys(recomputedKeys).catch((err) => {
    console.error("mark raw score dirty by comparable keys failed", err);
    return 0;
  });
  stats.scored = rows.length;
  stats.upserted = result.keyCount;
  stats.poolUpserted = result.sampleCount;
  stats.queued = pendingInvalidations.length;
  stats.enriched = closedInvalidations;
  stats.timingsMs = {
    ...(stats.timingsMs ?? {}),
    market_score_dirty_marked_rows: markedDirty,
  };
  return stats;
}

async function invalidatePoolEntries(entries: { pid: number; reason: string }[]) {
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
        `pid=in.(${chunk.join(",")})&status=in.(ready,reserved)`,
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
}

async function loadPoolWarmRows(limit: number): Promise<PoolWarmRow[]> {
  const cols = "pid,profit_band,expected_profit_min,expected_profit_max,status,last_verified_at";
  const res = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=${cols}&status=eq.ready&order=profit_band.desc,expected_profit_min.desc,last_verified_at.asc&limit=${limit}`,
    { headers: serviceHeaders() },
  );
  return (await res.json()) as PoolWarmRow[];
}

async function loadRawPriceNames(pids: number[]): Promise<Map<number, { price: number; name: string }>> {
  if (pids.length === 0) return new Map();
  const res = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid,price,name&pid=in.(${pids.join(",")})`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json()) as { pid: number; price: number; name: string }[];
  return new Map(rows.map((row) => [Number(row.pid), { price: Number(row.price), name: row.name }]));
}

async function markPoolVerified(pid: number) {
  const now = new Date().toISOString();
  await patchRows("mvp_candidate_pool", `pid=eq.${pid}`, {
    last_verified_at: now,
    updated_at: now,
  });
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
  const LIFECYCLE_BATCH_HARDCODE = 400;
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
      const detail = await fetchDetail(String(row.pid));
      if (config.detailDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, config.detailDelayMs));
      const signals = detectSoldOut(detail, row.price, { title: row.name });
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
    const detail = await fetchDetail(String(row.pid));
    if (config.detailDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, config.detailDelayMs));
    const raw = rawByPid.get(row.pid);
    const signals = detectSoldOut(detail, raw?.price, { title: raw?.name });
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
  const due: string[] = [];
  for (const query of envQueries) {
    const state = registry.get(query);
    if (!state) {
      // 새 query — registry에 없으니 즉시 due 처리. ensure 단계에서 row 생성.
      due.push(query);
      continue;
    }
    if (!state.last_scanned_at) {
      due.push(query);
      continue;
    }
    const lastMs = Date.parse(state.last_scanned_at);
    if (!Number.isFinite(lastMs)) {
      due.push(query);
      continue;
    }
    const dueAt = lastMs + state.effective_cadence_minutes * 60_000;
    if (nowMs >= dueAt) due.push(query);
  }
  return due;
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

export async function scoreStage(deadlineMs: number): Promise<StageStats> {
  const config = loadPipelineRuntimeConfig();
  const stats = emptyStats();
  const rows = await loadScorableRows(config.tickScoreLimit);
  if (rows.length === 0) return stats;
  const categoryReadiness = await loadCategoryReadinessMap();
  const laneReadiness = await loadLaneReadinessMap();
  const parsedByPid = await ensureParsedRows(rows, await loadParsedRows(rows.map((row) => row.pid)));
  const marketStatsByKey = await loadMarketPriceStats(
    rows
      .map((row) => preciseComparableKey(parsedByPid.get(row.pid)))
      .filter((key): key is string => Boolean(key))
  );

  // 2026-05-15: 미개봉/새상품 매물 시세 = 다나와 reference price (쿠팡/네이버 등 합산 최저가).
  // 중고 시세와 비교하면 호가 부풀려 풀에서 빠짐 → 진짜 꿀 매물 놓침.
  // reference price 있으면 미개봉 매물의 skuMedian = 그 가격, 없으면 기존 중고 시세 fallback.
  const referencePricesByKey = await (async () => {
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
  })();

  const pricesByMarket = new Map<string, number[]>();
  const favsByMarket = new Map<string, number[]>();
  const pricesBySku = new Map<string, number[]>();
  for (const row of rows) {
    // 2026-05-16: placeholder price (999999999, 111111111 등) 매물의 가격을 시세 fallback sample에서 제외.
    // 14건 발견 — "교환원함" / "분실" / "판매완료" 셀러가 가격 placeholder 박은 경우.
    // madTrim 이 outlier 제거하지만 sample 적으면 미흡.
    if (row.price >= 100_000_000 || row.price <= 0) continue;
    const skuId = row.sku_id ?? "";
    const marketKey = marketGroupKey(row, parsedByPid.get(row.pid));
    if (!pricesByMarket.has(marketKey)) pricesByMarket.set(marketKey, []);
    if (!favsByMarket.has(marketKey)) favsByMarket.set(marketKey, []);
    if (!pricesBySku.has(skuId)) pricesBySku.set(skuId, []);
    pricesBySku.get(skuId)!.push(row.price);
    pricesByMarket.get(marketKey)!.push(row.price);
    favsByMarket.get(marketKey)!.push(row.num_faved);
  }

  const _skuMsrp = new Map(CATALOG.map((sku) => [sku.id, sku.msrpKrw]));
  const now = new Date().toISOString();
  const scoredRows: PipelineRow[] = [];

  let needsReviewSkipped = 0;
  let phase2EscrowSelected = 0;
  const phase2EscrowFlagByPid = new Map<string, "ai_escrow_pending">();
  const handledPids: number[] = [];
  for (const row of rows) {
    if (Date.now() >= deadlineMs) {
      stats.timedOut = true;
      break;
    }
    // 처리 시도 자체를 했다면 dirty=false 후보. needs_review가 다시 false로 바뀌면
    // detail-worker의 raw patch에서 score_dirty=true로 재마킹된다.
    handledPids.push(Number(row.pid));
    const skuId = row.sku_id ?? "";
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
        continue;
      }
      phase2EscrowSelected += 1;
      phase2EscrowFlagByPid.set(String(row.pid), escrow.flag);
    }
    const marketKey = marketGroupKey(row, parsed);
    const comparableKey = preciseComparableKey(parsed);
    // Wave 130 (2026-05-16): 매물 condition_class에 매칭되는 시세 row 선택 (sample 부족 시 fallback).
    // 사업 보고서 L2: 같은 SKU+옵션도 condition별 시세 spread 15~40% — 정확성 ↑.
    const byCondition = comparableKey ? marketStatsByKey.get(comparableKey) : undefined;
    const marketStat = pickMarketStatByCondition(byCondition, parsed?.condition_class ?? null);
    const trustedMedian = trustedMarketMedian(marketStat, parsed?.category);
    const prices = pricesByMarket.get(marketKey) ?? [];
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
    const skuMedian = referencePrice != null && referencePrice > 0
      ? referencePrice
      : hasTrustedMarket ? trustedMedian : fallbackMedian;
    // 2026-05-16: placeholder price 매물 (999999999, 111111111 등)은 priceGap 0 강제 → score 0 → 풀 진입 차단.
    const isPlaceholderPrice = row.price >= 100_000_000 || row.price <= 0;
    const priceGap = isPlaceholderPrice || skuMedian <= 0 ? 0 : Math.max(0, Math.min(1, (skuMedian - row.price) / skuMedian));
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
      skuName: row.sku_name ?? skuId,
      skuMedian: Math.round(skuMedian),
      saleStatus: row.sale_status,
      descriptionPreview: row.description_preview?.slice(0, 200) ?? null,
      imageUrlTemplate: row.image_url_template,
      imageCount: row.image_count ?? null,
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

  const listings = toListingOutputRows(aiReview.rows, now);
  const rankedAnalyses = toRankedAnalysisRows(aiReview.rows, now);
  const existingOutputs = await loadExistingScoreOutputs(listings.map((row) => row.pid));
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

  await upsertRows("mvp_listings", listingUpserts, "pid");
  await upsertRows("mvp_listing_analysis", analysisUpserts, "pid");
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
  const [existingPoolSellerCounts, fraudGroupHashes] = await Promise.all([
    loadExistingPoolSellerCounts().catch((err) => {
      console.warn("loadExistingPoolSellerCounts failed (non-fatal)", err);
      return new Map<string, number>();
    }),
    loadFraudGroupHashes().catch((err) => {
      console.warn("loadFraudGroupHashes failed (non-fatal)", err);
      return new Set<string>();
    }),
  ]);

  const poolBuild = buildCandidatePoolRows({
    rows: aiReview.rows,
    parsedByPid,
    catalogById,
    categoryReadiness,
    laneReadiness,
    now,
    existingPoolSellerCounts,
    fraudGroupHashes,
  });
  const poolEntries = poolBuild.entries;
  await upsertRows("mvp_candidate_pool", poolEntries, "pid");
  await promoteLifecyclePriority(
    poolEntries.map((entry) => Number(entry.pid)).filter(Number.isFinite),
    "pool",
    new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  );
  await invalidatePoolEntries(poolBuild.invalidations);
  stats.poolUpserted = poolEntries.length;
  stats.poolSkipped = poolBuild.skipped;

  // P0-5/P0-8: score를 처리한 row(needs_review로 skip된 것 포함) 모두 dirty=false.
  // - 시도 자체를 했다면 다음 tick에 다시 후보가 되지 않게 한다.
  // - needs_review가 나중에 false로 바뀌는 시점은 detail-worker가 parsed를 갱신할 때이고,
  //   그때 raw_listings.score_dirty=true로 다시 마킹되어 자연스럽게 재진입한다.
  // - budget timeout으로 일부만 처리했다면 그 부분만 내림 — 나머지는 dirty=true 그대로.
  const processedPids = handledPids.filter(Number.isFinite);
  await clearScoreDirty(processedPids);
  stats.timingsMs = {
    ...(stats.timingsMs ?? {}),
    score_dirty_cleared_rows: processedPids.length,
    score_needs_review_skipped: needsReviewSkipped,
    score_phase2_escrow_selected: phase2EscrowSelected,
    score_phase2_escrow_gate_enabled: isPhase2EscrowEnabled() ? 1 : 0,
    score_phase2_escrow_resolved_pass: aiReview.stats.escrowResolvedPass,
    score_phase2_escrow_held: aiReview.stats.escrowHeld,
    score_phase2_escrow_unavailable_retry: aiReview.stats.escrowUnavailableRetry,
  };
  return stats;
}

export async function runTickPipeline(): Promise<TickResult> {
  const config = loadPipelineRuntimeConfig();
  const stageDurationsMs: Record<string, number> = {};

  const search = await timedStage(stageDurationsMs, "search", () => searchStage(Date.now() + config.tickSearchBudgetMs));
  const detail = await timedStage(stageDurationsMs, "detail", () => detailStage(Date.now() + config.tickDetailBudgetMs));
  const score = await timedStage(stageDurationsMs, "score", () => scoreStage(Date.now() + config.tickScoreBudgetMs));
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

  const search = await timedStage(stageDurationsMs, "search", () => searchStage(Date.now() + config.tickSearchBudgetMs, {
    pages: [0],
    mode: "fresh",
  }));
  const score = await timedStage(stageDurationsMs, "score", () => scoreStage(Date.now() + config.tickScoreBudgetMs));
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

export async function runLifecycleWorkerPipeline(options: { terminalRecheck?: boolean } = {}): Promise<TickResult> {
  const config = loadPipelineRuntimeConfig();
  const stageDurationsMs: Record<string, number> = {};
  const mode: LifecycleClaimMode = options.terminalRecheck ? "terminal_recheck" : "default";

  const search = emptyStats();
  const detail = await timedStage(stageDurationsMs, "lifecycle", () => lifecycleStage(Date.now() + config.tickDetailBudgetMs, mode));
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
