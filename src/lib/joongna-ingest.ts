import { CATALOG, ruleMatch, type Sku } from "@/lib/catalog";
import { evaluatePoolGate } from "@/lib/candidate-pool-builder";
import { loadCategoryReadinessMap, type CategoryReadinessMap } from "@/lib/category-readiness";
import {
  fetchJoongnaDetail,
  fetchJoongnaOrderTransactionCount,
  fetchJoongnaSearchProductUrls,
  fetchJoongnaSellerStoreInfo,
  getJoongnaSourceMode,
  JOONGNA_SOURCE_ID,
  parseJoongnaProductExternalId,
  type JoongnaBlockSignal,
  type JoongnaDetail,
  type JoongnaOrderTransactionCount,
  type JoongnaSellerStoreInfo,
} from "@/lib/joongna";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
// Wave launch-41 (사용자 짚음): joongna lifecycle 추적 활성. 매물 detail enrich 후 lifecycle_checks seed.
import { lifecycleTierForParsed, seedLifecycleChecks } from "@/lib/tick-pipeline";

const DEFAULT_SEED_QUERIES = [
  "에어팟맥스",
  "아이폰 17 프로",
  "아이패드 프로",
  "애플워치",
  "맥북",
];

const JOONGNA_QUERY_ROTATION_MINUTES = 3;
const JOONGNA_SELLER_FACT_READ_CHUNK_SIZE = 80;
const DEFAULT_JOONGNA_SELLER_FACT_TTL_MS = 6 * 60 * 60_000;
const JOONGNA_SEARCH_FAILURE_RATE_DEGRADED_THRESHOLD = 0.15;
const JOONGNA_DETAIL_SUCCESS_RATE_DEGRADED_THRESHOLD = 0.85;
const JOONGNA_INGEST_DEADLINE_SAFETY_MS = 20_000;
const JOONGNA_DETAIL_QUEUE_TABLE = "mvp_joongna_detail_queue";
const JOONGNA_DETAIL_QUEUE_LEASE_SECONDS = 180;
const JOONGNA_DETAIL_QUEUE_MIN_DETAIL_BUDGET_MS = 30_000;

type ReadyCatalogQuery = {
  query: string;
  category: Sku["category"];
  skuId: string;
};

type JoongnaIngestConfig = {
  queries: string[];
  queryPoolSize: number;
  readyCatalogQueryPoolSize: number;
  readyCatalogCategoryPoolCounts: Record<string, number>;
  selectedReadyCatalogCategoryCounts: Record<string, number>;
  detailsPerQuery: number;
  maxDetails: number;
  queryLimit: number;
  delayMs: number;
  timeoutMs: number;
  detailConcurrency: number;
};

export type JoongnaIngestResult = {
  source: typeof JOONGNA_SOURCE_ID;
  mode: ReturnType<typeof getJoongnaSourceMode>;
  skipped: boolean;
  queries: string[];
  queryPoolSize: number;
  readyCatalogQueryPoolSize: number;
  readyCatalogCategoryPoolCounts: Record<string, number>;
  selectedReadyCatalogCategoryCounts: Record<string, number>;
  searchUrls: number;
  fetchedDetails: number;
  parsedDetails: number;
  skippedDetails: number;
  blockedSignals: JoongnaBlockSignal[];
  rawUpserted: number;
  parsedUpserted: number;
  marketInvalidationsQueued: number;
  observationInserted: number;
  sellerProfilesFetched: number;
  sellerTransactionsFetched: number;
  sellerCacheHits: number;
  queueMode: boolean;
  detailQueueEnqueued: number;
  detailQueueClaimed: number;
  detailQueueDone: number;
  detailQueueFailed: number;
  detailQueueReleased: number;
  budgetStopped: boolean;
  sourceHealthStatus: "healthy" | "degraded" | "unhealthy";
  sourceHealthReason: string;
};

type JoongnaMarketInvalidationEvent = {
  comparableKey: string;
  affectedPid: number;
  parserVersion: string | null;
  priority: number;
};

type JoongnaQueuedProductUrl = {
  url: string;
  query: string;
};

type JoongnaDetailQueueClaim = {
  queue_id: string;
  product_url: string;
  external_id: string | null;
  source_query: string | null;
  attempts: number;
};

type JoongnaDetailTarget = {
  url: string;
  claim: JoongnaDetailQueueClaim | null;
};

function boundedInt(raw: string | number | null | undefined, fallback: number, min: number, max: number) {
  const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeQueryKey(raw: string) {
  return raw.trim().toLowerCase();
}

function queryListForSku(sku: Sku): string[] {
  const list = sku.searchQueries ?? sku.aliases;
  if (!Array.isArray(list)) return [];
  const candidates = list
    .map((query) => query.trim())
    .filter((query) => query.length >= 4);
  const preferred = candidates.find((query) => /[가-힣]/.test(query)) ?? candidates[0];
  return preferred ? [preferred] : [];
}

function buildReadyCatalogQueries(readinessMap: CategoryReadinessMap): ReadyCatalogQuery[] {
  const seen = new Set<string>();
  const queries: ReadyCatalogQuery[] = [];
  for (const sku of CATALOG) {
    const gate = evaluatePoolGate({ sku, category: sku.category }, { categoryReadiness: readinessMap });
    if (!gate.canEnterPool) continue;
    for (const query of queryListForSku(sku)) {
      const key = normalizeQueryKey(query);
      if (seen.has(key)) continue;
      seen.add(key);
      queries.push({ query, category: sku.category, skuId: sku.id });
    }
  }
  return queries;
}

function countReadyCatalogCategories(items: ReadyCatalogQuery[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});
}

function categoryBalancedRotatingWindow(items: ReadyCatalogQuery[], limit: number, nowMs = Date.now()): ReadyCatalogQuery[] {
  if (items.length <= limit) return items;

  const safeLimit = Math.max(1, limit);
  const groups = new Map<Sku["category"], ReadyCatalogQuery[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }

  const categories = [...groups.keys()].sort((a, b) => {
    const sizeDiff = (groups.get(b)?.length ?? 0) - (groups.get(a)?.length ?? 0);
    return sizeDiff || String(a).localeCompare(String(b));
  });
  if (categories.length === 0) return [];

  const slot = Math.floor(nowMs / (JOONGNA_QUERY_ROTATION_MINUTES * 60 * 1000));
  const categoryStart = slot % categories.length;
  const categoryOrder = [
    ...categories.slice(categoryStart),
    ...categories.slice(0, categoryStart),
  ];
  const perCategoryAdvance = Math.max(1, Math.floor(safeLimit / categories.length));
  const usedByCategory = new Map<Sku["category"], number>();
  const picked: ReadyCatalogQuery[] = [];

  while (picked.length < safeLimit) {
    let progressed = false;
    for (const category of categoryOrder) {
      const group = groups.get(category) ?? [];
      const used = usedByCategory.get(category) ?? 0;
      if (used >= group.length) continue;

      const start = (slot * perCategoryAdvance) % group.length;
      picked.push(group[(start + used) % group.length]);
      usedByCategory.set(category, used + 1);
      progressed = true;
      if (picked.length >= safeLimit) break;
    }
    if (!progressed) break;
  }

  return picked;
}

function mergeQueries(input: {
  seedQueries: string[];
  readyCatalogQueries: ReadyCatalogQuery[];
  queryLimit: number;
  rotate: boolean;
}) {
  const seen = new Set<string>();
  const merged: string[] = [];
  const selectedReadyCatalogQueries: ReadyCatalogQuery[] = [];

  for (const query of input.seedQueries) {
    const trimmed = query.trim();
    if (!trimmed) continue;
    const key = normalizeQueryKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
    if (merged.length >= input.queryLimit) {
      return { queries: merged, selectedReadyCatalogQueries };
    }
  }

  const readyCatalogCandidates = input.readyCatalogQueries.filter((entry) => {
    const key = normalizeQueryKey(entry.query);
    return !seen.has(key);
  });
  const remainingLimit = Math.max(0, input.queryLimit - merged.length);
  const readyCatalogWindow = input.rotate
    ? categoryBalancedRotatingWindow(readyCatalogCandidates, remainingLimit)
    : readyCatalogCandidates.slice(0, remainingLimit);

  for (const entry of readyCatalogWindow) {
    const trimmed = entry.query.trim();
    if (!trimmed) continue;
    const key = normalizeQueryKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
    selectedReadyCatalogQueries.push(entry);
    if (merged.length >= input.queryLimit) break;
  }

  return { queries: merged, selectedReadyCatalogQueries };
}

async function configFromEnvAndParams(params?: URLSearchParams): Promise<JoongnaIngestConfig> {
  const explicitQueryOverride = Boolean(params?.get("queries") ?? params?.get("query"));
  const rawQueries =
    params?.get("queries") ??
    params?.get("query") ??
    process.env.JOONGNA_INGEST_QUERIES ??
    DEFAULT_SEED_QUERIES.join(",");
  const seedQueries = rawQueries
    .split(",")
    .map((query) => query.trim())
    .filter(Boolean);

  const queryLimit = boundedInt(
    params?.get("queryLimit") ?? process.env.JOONGNA_INGEST_QUERY_LIMIT,
    80,
    explicitQueryOverride ? 1 : 80,
    120,
  );

  const readyCatalogQueries = explicitQueryOverride || process.env.JOONGNA_INGEST_DISABLE_READY_CATALOG_QUERIES === "1"
    ? []
    : buildReadyCatalogQueries(await loadCategoryReadinessMap());
  const mergedQueries = mergeQueries({
    seedQueries,
    readyCatalogQueries,
    queryLimit,
    rotate: !explicitQueryOverride,
  });

  const explicitDetailsPerQuery = Boolean(params?.get("detailsPerQuery"));
  const explicitMaxDetails = Boolean(params?.get("maxDetails") ?? params?.get("max"));
  const explicitDelayMs = Boolean(params?.get("delayMs"));
  const explicitDetailConcurrency = Boolean(params?.get("detailConcurrency"));
  return {
    queries: mergedQueries.queries.length > 0 ? mergedQueries.queries : DEFAULT_SEED_QUERIES,
    queryPoolSize: seedQueries.length + readyCatalogQueries.length,
    readyCatalogQueryPoolSize: readyCatalogQueries.length,
    readyCatalogCategoryPoolCounts: countReadyCatalogCategories(readyCatalogQueries),
    selectedReadyCatalogCategoryCounts: countReadyCatalogCategories(mergedQueries.selectedReadyCatalogQueries),
    // Wave launch-45 (사용자 짚음 "joongna sweep depth 부족"):
    //   실측: joongna search page 1 = 50 매물 / 우리 fetch 2 매물 = 96% 누락.
    //   detailsPerQuery cap 2 (env override X) → cap 20 으로 풀어줌. env 박으면 바로 적용.
    //   maxDetails cap 80 → cap 300. 매 run 처리량 ↑ 가능.
    //   joongna API rate (delay 200ms 그대로) 안전 마진 유지.
    detailsPerQuery: boundedInt(
      params?.get("detailsPerQuery") ?? process.env.JOONGNA_INGEST_DETAILS_PER_QUERY,
      2,
      1,
      20,
    ),
    maxDetails: boundedInt(
      params?.get("maxDetails") ?? params?.get("max") ?? process.env.JOONGNA_INGEST_MAX_DETAILS,
      80,
      1,
      300,
    ),
    queryLimit,
    delayMs: boundedInt(
      params?.get("delayMs") ?? process.env.JOONGNA_INGEST_DELAY_MS,
      200,
      0,
      explicitDelayMs ? 5_000 : 250,
    ),
    timeoutMs: boundedInt(
      params?.get("timeoutMs") ?? process.env.JOONGNA_INGEST_TIMEOUT_MS,
      10_000,
      1_000,
      20_000,
    ),
    detailConcurrency: boundedInt(
      params?.get("detailConcurrency") ?? process.env.JOONGNA_INGEST_DETAIL_CONCURRENCY,
      2,
      1,
      explicitDetailConcurrency ? 8 : 2,
    ),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sellerUidForStoreSeq(storeSeq: number | null | undefined) {
  return storeSeq ? `joongna:${storeSeq}` : null;
}

function joongnaTrustRating(detail: Pick<JoongnaDetail, "sellerActivityScore" | "sellerReliabilityScore">) {
  const activity = Number(detail.sellerActivityScore ?? 0);
  const reliability = Number(detail.sellerReliabilityScore ?? 0);
  const total = activity + reliability;
  if (!Number.isFinite(total) || total <= 0) return null;
  return Number(Math.max(0, Math.min(5, total / 200)).toFixed(2));
}

function dedupeRowsByKey<T extends Record<string, unknown>>(rows: T[], keyFor: (row: T) => string | null) {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = keyFor(row);
    if (!key) continue;
    byKey.set(key, row);
  }
  return [...byKey.values()];
}

type SellerEnrichmentResult = {
  details: JoongnaDetail[];
  sellerProfilesFetched: number;
  sellerTransactionsFetched: number;
  sellerCacheHits: number;
};

type CachedJoongnaSellerRow = {
  seller_uid: string;
  review_rating: number | null;
  review_count: number | null;
  sales_count: number | null;
  follower_count: number | null;
  is_proshop: boolean | null;
  is_official_seller: boolean | null;
  source_json: Record<string, unknown> | null;
  last_seen_at: string | null;
  updated_at: string | null;
};

type JoongnaSellerFact = {
  profile: JoongnaSellerStoreInfo | null;
  transactions: JoongnaOrderTransactionCount | null;
  fetchedAt: string | null;
  source: "live" | "cache";
};

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function joongnaSellerFactTtlMs() {
  return boundedInt(
    process.env.JOONGNA_INGEST_SELLER_FACT_TTL_MINUTES,
    DEFAULT_JOONGNA_SELLER_FACT_TTL_MS / 60_000,
    15,
    24 * 60,
  ) * 60_000;
}

function cachedFactFetchedAt(row: CachedJoongnaSellerRow) {
  const sourceJson = asRecord(row.source_json);
  return stringOrNull(sourceJson.sellerFactsFetchedAt) ?? row.updated_at ?? row.last_seen_at;
}

function cachedSellerFactFromRow(row: CachedJoongnaSellerRow, nowMs: number, ttlMs: number): JoongnaSellerFact | null {
  const sourceJson = asRecord(row.source_json);
  const fetchedAt = cachedFactFetchedAt(row);
  const fetchedAtMs = fetchedAt ? Date.parse(fetchedAt) : 0;
  if (!Number.isFinite(fetchedAtMs) || fetchedAtMs <= 0 || nowMs - fetchedAtMs > ttlMs) return null;

  const storeSeq = numberOrNull(sourceJson.storeSeq) ?? numberOrNull(row.seller_uid.replace(/^joongna:/, ""));
  if (!storeSeq) return null;

  return {
    source: "cache",
    fetchedAt,
    profile: {
      storeSeq,
      nickName: stringOrNull(sourceJson.nickName),
      userType: numberOrNull(sourceJson.userType),
      profileImageUrl: stringOrNull(sourceJson.profileImageUrl),
      activityScore: numberOrNull(sourceJson.activityScore),
      reliabilityScore: numberOrNull(sourceJson.reliabilityScore),
      reviewCount: numberOrNull(sourceJson.reviewCount) ?? row.review_count,
      followerCount: numberOrNull(sourceJson.followerCount) ?? row.follower_count,
      storeAbout: stringOrNull(sourceJson.storeAbout),
      businessInfo: sourceJson.businessInfo ?? null,
    },
    transactions: {
      salesCount: numberOrNull(sourceJson.safeOrderSalesCount) ?? row.sales_count,
      purchasesCount: numberOrNull(sourceJson.safeOrderPurchasesCount),
      safeOrderSalesCntText: stringOrNull(sourceJson.safeOrderSalesText),
    },
  };
}

async function loadCachedSellerFacts(storeSeqs: number[], nowMs: number, ttlMs: number) {
  const unique = [...new Set(storeSeqs.filter((seq) => Number.isFinite(seq) && seq > 0))];
  const facts = new Map<number, JoongnaSellerFact>();
  if (unique.length === 0) return facts;

  for (const chunk of chunkArray(unique, JOONGNA_SELLER_FACT_READ_CHUNK_SIZE)) {
    const sellerUids = chunk.map((seq) => sellerUidForStoreSeq(seq)).filter((uid): uid is string => Boolean(uid));
    const encoded = sellerUids.map((uid) => encodeURIComponent(uid)).join(",");
    const res = await restFetch(
      `${tableUrl("mvp_sellers")}?select=seller_uid,review_rating,review_count,sales_count,follower_count,is_proshop,is_official_seller,source_json,last_seen_at,updated_at&source=eq.${JOONGNA_SOURCE_ID}&seller_uid=in.(${encoded})`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as CachedJoongnaSellerRow[];
    for (const row of rows) {
      const fact = cachedSellerFactFromRow(row, nowMs, ttlMs);
      if (!fact?.profile?.storeSeq) continue;
      facts.set(fact.profile.storeSeq, fact);
    }
  }

  return facts;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: safeConcurrency }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]);
    }
  }));
  return results;
}

async function enrichWritableDetailsWithSellerFacts(
  details: JoongnaDetail[],
  timeoutMs: number,
): Promise<SellerEnrichmentResult> {
  const storeSeqs = [...new Set(details.flatMap((detail) => detail.storeSeq ? [detail.storeSeq] : []))];
  if (storeSeqs.length === 0) {
    return { details, sellerProfilesFetched: 0, sellerTransactionsFetched: 0, sellerCacheHits: 0 };
  }

  const concurrency = boundedInt(process.env.JOONGNA_INGEST_SELLER_PROFILE_CONCURRENCY, 4, 1, 8);
  const nowMs = Date.now();
  const cachedFacts = await loadCachedSellerFacts(storeSeqs, nowMs, joongnaSellerFactTtlMs()).catch(() => new Map<number, JoongnaSellerFact>());
  const sellerFacts = new Map<number, JoongnaSellerFact>(cachedFacts);
  const sellerCacheHits = cachedFacts.size;
  let sellerProfilesFetched = 0;
  let sellerTransactionsFetched = 0;
  const fetchStartedAt = new Date(nowMs).toISOString();
  const missingStoreSeqs = storeSeqs.filter((storeSeq) => !sellerFacts.has(storeSeq));

  await mapWithConcurrency(missingStoreSeqs, concurrency, async (storeSeq) => {
    const [profile, transactions] = await Promise.all([
      fetchJoongnaSellerStoreInfo(storeSeq, timeoutMs).catch(() => null),
      fetchJoongnaOrderTransactionCount(storeSeq, timeoutMs).catch(() => null),
    ]);
    if (profile) sellerProfilesFetched += 1;
    if (transactions) sellerTransactionsFetched += 1;
    sellerFacts.set(storeSeq, { profile, transactions, fetchedAt: fetchStartedAt, source: "live" });
  });

  return {
    sellerProfilesFetched,
    sellerTransactionsFetched,
    sellerCacheHits,
    details: details.map((detail) => {
      if (!detail.storeSeq) return detail;
      const facts = sellerFacts.get(detail.storeSeq);
      const profile = facts?.profile;
      const transactions = facts?.transactions;
      if (!profile && !transactions) return detail;
      return {
        ...detail,
        nickName: profile?.nickName ?? detail.nickName,
        sellerProfileImageUrl: profile?.profileImageUrl ?? detail.sellerProfileImageUrl,
        sellerStoreAbout: profile?.storeAbout ?? detail.sellerStoreAbout,
        sellerUserType: profile?.userType ?? detail.sellerUserType,
        sellerActivityScore: profile?.activityScore ?? detail.sellerActivityScore,
        sellerReliabilityScore: profile?.reliabilityScore ?? detail.sellerReliabilityScore,
        sellerReviewCount: profile?.reviewCount ?? detail.sellerReviewCount,
        sellerFollowerCount: profile?.followerCount ?? detail.sellerFollowerCount,
        sellerSafeOrderSalesCount: transactions?.salesCount ?? detail.sellerSafeOrderSalesCount,
        sellerSafeOrderPurchasesCount: transactions?.purchasesCount ?? detail.sellerSafeOrderPurchasesCount,
        sellerSafeOrderSalesText: transactions?.safeOrderSalesCntText ?? detail.sellerSafeOrderSalesText,
        sellerFactsFetchedAt: facts.fetchedAt,
        sellerFactsSource: facts.source,
      };
    }),
  };
}

async function upsertRows(table: string, rows: Record<string, unknown>[], onConflict: string) {
  if (rows.length === 0) return;
  const res = await restFetch(`${tableUrl(table)}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
    body: jsonBody(rows),
  });
  if (!res.ok) {
    throw new Error(`${table} upsert failed: ${res.status} ${await res.text()}`);
  }
}

async function insertRows(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return [];
  const res = await restFetch(`${tableUrl(table)}?select=*`, {
    method: "POST",
    headers: serviceHeaders("return=representation"),
    body: jsonBody(rows),
  });
  return (await res.json()) as Array<Record<string, unknown>>;
}

let joongnaDetailQueueAvailableCache: boolean | null = null;

async function joongnaDetailQueueAvailable() {
  if (process.env.JOONGNA_DETAIL_QUEUE_ENABLED === "0") return false;
  if (joongnaDetailQueueAvailableCache != null) return joongnaDetailQueueAvailableCache;

  try {
    const res = await restFetch(`${tableUrl(JOONGNA_DETAIL_QUEUE_TABLE)}?select=id&limit=1`, {
      headers: serviceHeaders(),
    });
    joongnaDetailQueueAvailableCache = res.ok;
  } catch (err) {
    joongnaDetailQueueAvailableCache = false;
    console.warn("joongna detail queue unavailable; falling back to direct ingest", {
      error: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
    });
  }

  return joongnaDetailQueueAvailableCache;
}

function joongnaDetailQueuePriority(item: JoongnaQueuedProductUrl) {
  const normalized = normalizeQueryKey(item.query);
  if (/(신발|운동화|스니커|나이키|아디다스|호카|아식스|뉴발|살로몬|노바블라스트|삼바|가젤)/.test(normalized)) {
    return 80;
  }
  if (/(의류|자켓|후드|맨투맨|셔츠|니트|바지|데님|폴로|스투시|슈프림|아크테릭스|rrl)/i.test(normalized)) {
    return 80;
  }
  if (/(가방|백|프라다|셀린느|샤넬|보테가|루이비통)/.test(normalized)) {
    return 70;
  }
  return 50;
}

async function enqueueJoongnaDetailQueue(items: JoongnaQueuedProductUrl[]): Promise<number> {
  if (items.length === 0) return 0;
  const deduped = [...items.reduce((acc, item) => {
    if (item.url.trim()) acc.set(item.url, item);
    return acc;
  }, new Map<string, JoongnaQueuedProductUrl>()).values()];
  const now = new Date().toISOString();
  const rows = deduped.map((item) => ({
    product_url: item.url,
    external_id: parseJoongnaProductExternalId(item.url),
    source_query: item.query.slice(0, 200),
    status: "pending",
    priority: joongnaDetailQueuePriority(item),
    available_at: now,
    updated_at: now,
    raw_json: {
      source: "joongna_search",
      query: item.query,
      discoveredAt: now,
    },
  }));
  const res = await restFetch(
    `${tableUrl(JOONGNA_DETAIL_QUEUE_TABLE)}?on_conflict=product_url`,
    {
      method: "POST",
      headers: serviceHeaders("resolution=ignore-duplicates,return=minimal"),
      body: jsonBody(rows),
    },
  );
  if (!res.ok) {
    throw new Error(`joongna detail queue enqueue failed: ${res.status} ${await res.text()}`);
  }
  return rows.length;
}

async function claimJoongnaDetailQueue(limit: number): Promise<JoongnaDetailQueueClaim[]> {
  const res = await restFetch(rpcUrl("claim_mvp_joongna_detail_queue"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({
      p_batch_size: limit,
      p_lease_seconds: JOONGNA_DETAIL_QUEUE_LEASE_SECONDS,
    }),
  });
  if (!res.ok) {
    throw new Error(`joongna detail queue claim failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as JoongnaDetailQueueClaim[];
}

async function patchJoongnaDetailQueue(queueId: string, payload: Record<string, unknown>) {
  const res = await restFetch(
    `${tableUrl(JOONGNA_DETAIL_QUEUE_TABLE)}?id=eq.${encodeURIComponent(queueId)}`,
    {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody(payload),
    },
  );
  if (!res.ok) {
    throw new Error(`joongna detail queue patch failed: ${res.status} ${await res.text()}`);
  }
}

async function markJoongnaDetailQueueDone(claims: JoongnaDetailQueueClaim[]) {
  if (claims.length === 0) return 0;
  const now = new Date().toISOString();
  await Promise.all(claims.map((claim) => patchJoongnaDetailQueue(claim.queue_id, {
    status: "done",
    locked_at: null,
    locked_until: null,
    last_error: null,
    last_fetched_at: now,
    updated_at: now,
  })));
  return claims.length;
}

async function markJoongnaDetailQueueFailed(
  failures: Array<{ claim: JoongnaDetailQueueClaim; error: string }>,
) {
  if (failures.length === 0) return 0;
  const nowMs = Date.now();
  await Promise.all(failures.map(({ claim, error }) => {
    const retryMinutes = Math.min(60, 5 * Math.max(1, claim.attempts));
    return patchJoongnaDetailQueue(claim.queue_id, {
      status: "failed",
      locked_at: null,
      locked_until: null,
      last_error: error.slice(0, 500),
      available_at: new Date(nowMs + retryMinutes * 60_000).toISOString(),
      updated_at: new Date(nowMs).toISOString(),
    });
  }));
  return failures.length;
}

async function releaseJoongnaDetailQueuePending(claims: JoongnaDetailQueueClaim[], reason: string) {
  if (claims.length === 0) return 0;
  const now = new Date().toISOString();
  await Promise.all(claims.map((claim) => patchJoongnaDetailQueue(claim.queue_id, {
    status: "pending",
    locked_at: null,
    locked_until: null,
    last_error: reason.slice(0, 500),
    available_at: now,
    updated_at: now,
  })));
  return claims.length;
}

function joongnaMarketInvalidationPriority(comparableKey: string | null | undefined) {
  const prefix = String(comparableKey ?? "").split("|")[0] ?? "";
  if (prefix === "shoe" || prefix === "clothing") return 96;
  if (prefix === "bag") return 86;
  return 78;
}

async function enqueueJoongnaMarketInvalidations(events: JoongnaMarketInvalidationEvent[]): Promise<number> {
  const merged = new Map<string, JoongnaMarketInvalidationEvent>();
  for (const event of events) {
    const key = event.comparableKey.trim();
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing || event.priority > existing.priority) {
      merged.set(key, { ...event, comparableKey: key });
    }
  }

  let queued = 0;
  const failures: Array<{ key: string; error: string }> = [];
  for (const event of merged.values()) {
    try {
      await restFetch(rpcUrl("enqueue_mvp_market_key_invalidation"), {
        method: "POST",
        headers: serviceHeaders(),
        body: jsonBody({
          p_comparable_key: event.comparableKey,
          p_reason: "joongna_active_snapshot",
          p_priority: event.priority,
          p_affected_pid: event.affectedPid,
          p_old_comparable_key: null,
          p_new_comparable_key: event.comparableKey,
          p_parser_version: event.parserVersion,
        }),
      });
      queued += 1;
    } catch (err) {
      failures.push({
        key: event.comparableKey,
        error: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
      });
    }
  }
  if (failures.length > 0) {
    console.error("joongna market key invalidation enqueue failed", {
      failed: failures.length,
      total: merged.size,
      sample: failures.slice(0, 3),
    });
  }
  return queued;
}

function listingStateFor(detail: JoongnaDetail) {
  if (detail.productStatus === 0) return "active";
  return "source_nonactive";
}

function saleStatusFor(detail: JoongnaDetail) {
  if (detail.productStatus === 0) return "ACTIVE";
  return detail.productStatus == null ? "JOONGNA_STATUS_UNKNOWN" : `JOONGNA_STATUS_${detail.productStatus}`;
}

function isWritableDetail(detail: JoongnaDetail) {
  return (
    detail.ok &&
    Boolean(detail.externalId) &&
    detail.internalPid > 0 &&
    Boolean(detail.title) &&
    detail.price != null &&
    detail.price > 0 &&
    detail.productStatus === 0
  );
}

function buildRows(
  details: JoongnaDetail[],
  now: string,
  runId: string | null,
) {
  const rawRows: Record<string, unknown>[] = [];
  const parsedRows: Record<string, unknown>[] = [];
  const marketInvalidationEvents: JoongnaMarketInvalidationEvent[] = [];
  const observationRows: Record<string, unknown>[] = [];
  const payloadRows: Record<string, unknown>[] = [];
  const sellerRows: Record<string, unknown>[] = [];
  // Wave launch-41: joongna lifecycle seed rows. detail enrich 된 매물 모두 추적 대상 (active 상태).
  const lifecycleSeedRows: { pid: number; source: "joongna"; priorityTier: ReturnType<typeof lifecycleTierForParsed> }[] = [];
  const ingestSource = "joongna_active";

  for (const detail of details) {
    const title = detail.title ?? "";
    const description = detail.description ?? "";
    const classified = classifyListing(title, description, detail.price ?? 0);
    const matched = classified.listingType === "normal" ? ruleMatch(title, description) : null;
    const parsed = matched
      ? parseListingOptions({
        title,
        description,
        skuId: matched.id,
        skuName: matched.modelName,
        category: matched.category,
      })
      : null;
    const listingState = listingStateFor(detail);
    const saleStatus = saleStatusFor(detail);
    const sellerUid = sellerUidForStoreSeq(detail.storeSeq);
    const sellerReviewRating = joongnaTrustRating(detail);
    const sellerReviewCount = Math.max(0, Math.round(Number(detail.sellerReviewCount ?? 0)));
    const sellerFollowerCount = Math.max(0, Math.round(Number(detail.sellerFollowerCount ?? 0)));
    const sellerSalesCount = Math.max(0, Math.round(Number(detail.sellerSafeOrderSalesCount ?? 0)));
    const skuId = parsed && !parsed.needsReview ? matched?.id ?? null : null;
    const skuName = parsed && !parsed.needsReview ? matched?.modelName ?? null : null;

    if (sellerUid) {
      sellerRows.push({
        source: JOONGNA_SOURCE_ID,
        seller_uid: sellerUid,
        review_rating: sellerReviewRating,
        review_count: sellerReviewCount,
        sales_count: sellerSalesCount,
        follower_count: sellerFollowerCount,
        is_proshop: detail.sellerUserType === 2 || detail.sellerUserType === 3,
        is_official_seller: detail.sellerUserType === 3,
        source_json: {
          source: JOONGNA_SOURCE_ID,
          storeSeq: detail.storeSeq,
          nickName: detail.nickName,
          profileImageUrl: detail.sellerProfileImageUrl,
          storeAbout: detail.sellerStoreAbout,
          userType: detail.sellerUserType,
          activityScore: detail.sellerActivityScore,
          reliabilityScore: detail.sellerReliabilityScore,
          reviewCount: detail.sellerReviewCount,
          followerCount: detail.sellerFollowerCount,
          safeOrderSalesCount: detail.sellerSafeOrderSalesCount,
          safeOrderPurchasesCount: detail.sellerSafeOrderPurchasesCount,
          safeOrderSalesText: detail.sellerSafeOrderSalesText,
          sellerFactsFetchedAt: detail.sellerFactsFetchedAt ?? now,
          sellerFactsSource: detail.sellerFactsSource ?? "live",
          ratingScale: sellerReviewRating == null ? null : "joongna_activity_plus_reliability_score_1000_to_5",
        },
        last_seen_at: now,
        updated_at: now,
      });
    }

    rawRows.push({
      pid: detail.internalPid,
      url: detail.url,
      name: title,
      price: detail.price,
      num_faved: 0,
      free_shipping: detail.parcelFeeYn === 1,
      query: ingestSource,
      source: JOONGNA_SOURCE_ID,
      description_preview: description.slice(0, 1_500),
      sale_status: saleStatus,
      seller_source: JOONGNA_SOURCE_ID,
      shop_review_rating: sellerReviewRating,
      shop_review_count: sellerReviewCount,
      seller_uid: sellerUid,
      trade_data: null,
      trades_data: null,
      image_url_template: detail.thumbnailUrl,
      image_count: detail.imageCount,
      thumbnail_url: detail.thumbnailUrl,
      listing_type: classified.listingType,
      sku_id: skuId,
      sku_name: skuName,
      detail_status: "done",
      detail_enriched_at: now,
      detail_error: null,
      listing_state: listingState,
      missing_count: 0,
      num_comment: detail.commentCount,
      last_missing_at: null,
      source_uploaded_at: detail.sourceUpdatedAt,
      source_updated_at: detail.sourceUpdatedAt,
      pool_eligible: true,
      score_dirty: true,
      last_seen_at: now,
      last_changed_at: now,
      updated_at: now,
      raw_json: {
        source: ingestSource,
        sourceExternalId: detail.externalId,
        productStatus: detail.productStatus,
        categoryName: detail.categoryName,
        categorySeq: detail.categorySeq,
        parcelFeeYn: detail.parcelFeeYn,
        productTradeType: detail.productTradeType,
        viewCount: detail.viewCount,
        labels: detail.labels,
        sortDate: detail.sortDate,
        updateDate: detail.updateDate,
        seller: {
          storeSeq: detail.storeSeq,
          nickName: detail.nickName,
          profileImageUrl: detail.sellerProfileImageUrl,
          storeAbout: detail.sellerStoreAbout,
          userType: detail.sellerUserType,
          activityScore: detail.sellerActivityScore,
          reliabilityScore: detail.sellerReliabilityScore,
          reviewCount: detail.sellerReviewCount,
          followerCount: detail.sellerFollowerCount,
          safeOrderSalesCount: detail.sellerSafeOrderSalesCount,
          safeOrderPurchasesCount: detail.sellerSafeOrderPurchasesCount,
          safeOrderSalesText: detail.sellerSafeOrderSalesText,
          trustRatingNormalized: sellerReviewRating,
          sellerFactsFetchedAt: detail.sellerFactsFetchedAt ?? now,
          sellerFactsSource: detail.sellerFactsSource ?? "live",
        },
        commentCount: detail.commentCount,
        commentCountSource: detail.commentCount == null ? "joongna_public_chat_count_unavailable" : "joongna",
        parser: {
          listingType: classified.listingType,
          skuId,
          comparableKey: parsed?.comparableKey ?? null,
          parseConfidence: parsed?.parseConfidence ?? null,
          needsReview: parsed?.needsReview ?? null,
        },
      },
    });

    if (parsed && matched) {
      parsedRows.push(toParsedListingRow(detail.internalPid, parsed));
      if (!parsed.needsReview && parsed.comparableKey) {
        marketInvalidationEvents.push({
          comparableKey: parsed.comparableKey,
          affectedPid: detail.internalPid,
          parserVersion: parsed.parserVersion,
          priority: joongnaMarketInvalidationPriority(parsed.comparableKey),
        });
      }
    }

    // Wave launch-41: lifecycle seed. parsed 정보 따라 tier 결정 (market_sample / exploration / general).
    //   active 매물만 seed (sold/disappeared 는 detail enrich 자체가 listingState 로 마킹됨).
    //   active 외 상태는 이미 invalidate 대상이라 lifecycle 추적 필요 X.
    if (listingState === "active") {
      lifecycleSeedRows.push({
        pid: detail.internalPid,
        source: JOONGNA_SOURCE_ID,
        priorityTier: lifecycleTierForParsed({
          parseConfidence: parsed?.parseConfidence,
          needsReview: parsed?.needsReview,
          comparableKey: parsed?.comparableKey,
        }),
      });
    }

    observationRows.push({
      pid: detail.internalPid,
      observed_at: now,
      run_id: runId,
      event_type: "daily_snapshot",
      listing_state: listingState,
      price: detail.price,
      num_faved: 0,
      name: title,
      sale_status: saleStatus,
      sku_id: skuId,
      sku_name: skuName,
      comparable_key: parsed?.comparableKey ?? null,
      parse_confidence: parsed?.parseConfidence ?? null,
      source: JOONGNA_SOURCE_ID,
      seller_uid: sellerUid,
    });
    payloadRows.push({
      pid: detail.internalPid,
      observed_at: now,
      raw_json: {
        source: ingestSource,
        sourceExternalId: detail.externalId,
        url: detail.url,
        productStatus: detail.productStatus,
        labels: detail.labels,
      },
    });
  }

  return {
    rawRows,
    parsedRows,
    marketInvalidationEvents,
    observationRows,
    payloadRows,
    sellerRows: dedupeRowsByKey(sellerRows, (row) => `${row.source}:${row.seller_uid}`),
    // Wave launch-41: joongna lifecycle seed rows.
    lifecycleSeedRows,
  };
}

async function insertObservations(
  rows: Record<string, unknown>[],
  payloads: Record<string, unknown>[],
) {
  if (rows.length === 0) return 0;
  const inserted = await insertRows("mvp_listing_observations", rows);
  const payloadRows = inserted.flatMap((row, index) => {
    const id = row.id;
    if (id == null) return [];
    return [{
      ...payloads[index],
      observation_id: id,
      pid: row.pid,
      observed_at: row.observed_at,
    }];
  });
  if (payloadRows.length > 0) {
    await insertRows("mvp_listing_observation_payloads", payloadRows);
  }
  return inserted.length;
}

async function loadPreviousSourceStatus() {
  const res = await restFetch(
    `${tableUrl("mvp_source_health")}?select=status&source=eq.${JOONGNA_SOURCE_ID}&order=checked_at.desc&limit=1`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json()) as Array<{ status?: string | null }>;
  return rows[0]?.status ?? null;
}

async function insertSourceHealth(input: {
  status: "healthy" | "degraded" | "unhealthy";
  reason: string;
  searchResultCount: number;
  metrics: Record<string, unknown>;
}) {
  const previous = await loadPreviousSourceStatus();
  await insertRows("mvp_source_health", [{
    source: JOONGNA_SOURCE_ID,
    checked_at: new Date().toISOString(),
    window_minutes: 15,
    status: input.status,
    previous_status: previous,
    detail_success_rate: input.metrics.detailSuccessRate ?? null,
    detail_404_rate: input.metrics.detail404Rate ?? null,
    detail_5xx_rate: input.metrics.detail5xxRate ?? null,
    sold_transition_rate: 0,
    disappeared_transition_rate: 0,
    search_result_count: input.searchResultCount,
    baseline_json: input.metrics,
    hysteresis_json: { note: "joongna_ingest_initial_probe" },
    reason: input.reason,
  }]);
}

function shouldStopForJoongnaDeadline(deadlineMs: number | null | undefined) {
  return deadlineMs != null && Date.now() >= deadlineMs - JOONGNA_INGEST_DEADLINE_SAFETY_MS;
}

function hasJoongnaDetailQueueBudget(deadlineMs: number | null | undefined) {
  return deadlineMs == null || Date.now() < deadlineMs - JOONGNA_DETAIL_QUEUE_MIN_DETAIL_BUDGET_MS;
}

export async function runJoongnaIngest(options: {
  params?: URLSearchParams;
  runId?: string | null;
  deadlineMs?: number | null;
} = {}): Promise<JoongnaIngestResult> {
  const mode = getJoongnaSourceMode();
  const config = await configFromEnvAndParams(options.params);
  if (mode === "off") {
    return {
      source: JOONGNA_SOURCE_ID,
      mode,
      skipped: true,
      queries: config.queries,
      queryPoolSize: config.queryPoolSize,
      readyCatalogQueryPoolSize: config.readyCatalogQueryPoolSize,
      readyCatalogCategoryPoolCounts: config.readyCatalogCategoryPoolCounts,
      selectedReadyCatalogCategoryCounts: config.selectedReadyCatalogCategoryCounts,
      searchUrls: 0,
      fetchedDetails: 0,
      parsedDetails: 0,
      skippedDetails: 0,
      blockedSignals: [],
      rawUpserted: 0,
      parsedUpserted: 0,
      marketInvalidationsQueued: 0,
      observationInserted: 0,
      sellerProfilesFetched: 0,
      sellerTransactionsFetched: 0,
      sellerCacheHits: 0,
      queueMode: false,
      detailQueueEnqueued: 0,
      detailQueueClaimed: 0,
      detailQueueDone: 0,
      detailQueueFailed: 0,
      detailQueueReleased: 0,
      budgetStopped: false,
      sourceHealthStatus: "degraded",
      sourceHealthReason: "source_mode_off",
    };
  }

  let queueMode = await joongnaDetailQueueAvailable();
  let detailQueueEnqueued = 0;
  let detailQueueClaimed = 0;
  let detailQueueDone = 0;
  let detailQueueFailed = 0;
  let detailQueueReleased = 0;
  const productUrls = new Set<string>();
  const queuedProductUrls = new Map<string, JoongnaQueuedProductUrl>();
  let detailTargets: JoongnaDetailTarget[] = [];
  let claimedBeforeSearch = false;
  const searchDiscoveryLimit = queueMode
    ? Math.min(500, Math.max(config.maxDetails, config.queryLimit * config.detailsPerQuery))
    : config.maxDetails;
  const searchFailures: string[] = [];
  let budgetStopped = false;
  let searchAttempts = 0;

  if (queueMode && hasJoongnaDetailQueueBudget(options.deadlineMs)) {
    try {
      const claims = await claimJoongnaDetailQueue(config.maxDetails);
      detailQueueClaimed = claims.length;
      if (claims.length > 0) {
        claimedBeforeSearch = true;
        detailTargets = claims.map((claim) => ({ url: claim.product_url, claim }));
      }
    } catch (err) {
      queueMode = false;
      console.warn("joongna detail queue pre-claim failed; falling back to direct ingest for this run", {
        error: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
      });
    }
  }

  if (!claimedBeforeSearch) {
    for (const query of config.queries) {
      if (shouldStopForJoongnaDeadline(options.deadlineMs)) {
        budgetStopped = true;
        break;
      }
      searchAttempts += 1;
      try {
        const urls = await fetchJoongnaSearchProductUrls(query, {
          limit: config.detailsPerQuery,
          timeoutMs: config.timeoutMs,
        });
        for (const url of urls) {
          productUrls.add(url);
          if (!queuedProductUrls.has(url)) queuedProductUrls.set(url, { url, query });
          if (productUrls.size >= searchDiscoveryLimit) break;
        }
      } catch (err) {
        searchFailures.push(`${query}:${err instanceof Error ? err.message : String(err)}`);
      }
      if (productUrls.size >= searchDiscoveryLimit) break;
      if (config.delayMs > 0) await sleep(config.delayMs);
    }
  }

  if (detailTargets.length === 0) {
    detailTargets = [...productUrls]
      .slice(0, config.maxDetails)
      .map((url) => ({ url, claim: null }));
  }
  if (queueMode && !claimedBeforeSearch) {
    try {
      detailQueueEnqueued = await enqueueJoongnaDetailQueue([...queuedProductUrls.values()]);
      if (!hasJoongnaDetailQueueBudget(options.deadlineMs)) {
        budgetStopped = true;
        detailTargets = [];
      } else {
        const claims = await claimJoongnaDetailQueue(config.maxDetails);
        detailQueueClaimed += claims.length;
        detailTargets = claims.map((claim) => ({ url: claim.product_url, claim }));
      }
    } catch (err) {
      queueMode = false;
      console.warn("joongna detail queue failed; falling back to direct ingest for this run", {
        error: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
      });
    }
  }

  const details: JoongnaDetail[] = [];
  const blockedSignals: JoongnaBlockSignal[] = [];
  const detailFetchFailures: string[] = [];
  const detailQueueDoneClaims: JoongnaDetailQueueClaim[] = [];
  const detailQueueFailedClaims: Array<{ claim: JoongnaDetailQueueClaim; error: string }> = [];
  let detailAttempts = 0;
  let detail404 = 0;
  let detail5xx = 0;
  for (let index = 0; index < detailTargets.length; index += config.detailConcurrency) {
    if (shouldStopForJoongnaDeadline(options.deadlineMs)) {
      budgetStopped = true;
      if (queueMode) {
        const remainingClaims = detailTargets
          .slice(index)
          .flatMap((item) => item.claim ? [item.claim] : []);
        detailQueueReleased += await releaseJoongnaDetailQueuePending(
          remainingClaims,
          "budget_stopped_before_detail_fetch",
        );
      }
      break;
    }

    const wave = detailTargets.slice(index, index + config.detailConcurrency);
    const waveResults = await Promise.all(wave.map(async (target) => {
      try {
        const detail = await fetchJoongnaDetail(target.url, config.timeoutMs);
        return { target, detail, error: null as string | null };
      } catch (err) {
        const message = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
        return { target, detail: null, error: message };
      }
    }));

    for (const result of waveResults) {
      detailAttempts += 1;
      const { target, detail, error } = result;
      if (!detail) {
        detail5xx += 1;
        detailFetchFailures.push(`${target.url}:${error ?? "unknown_error"}`);
        if (target.claim) {
          detailQueueFailedClaims.push({ claim: target.claim, error: error ?? "unknown_error" });
        }
        continue;
      }

      details.push(detail);
      if (detail.status === 404) detail404 += 1;
      if (detail.status >= 500) detail5xx += 1;
      if (target.claim) {
        if (detail.blockSignal.blocked || detail.status >= 500) {
          detailQueueFailedClaims.push({
            claim: target.claim,
            error: detail.blockSignal.reason ?? `http_${detail.status}`,
          });
        } else {
          detailQueueDoneClaims.push(target.claim);
        }
      }
      if (detail.blockSignal.blocked) {
        blockedSignals.push(detail.blockSignal);
      }
    }

    if (blockedSignals.some((signal) => signal.blocked)) break;
    if (config.delayMs > 0) await sleep(config.delayMs);
  }

  const writableDetails = details.filter(isWritableDetail);
  const skippedDetails = details.length - writableDetails.length;
  const sellerEnrichment = await enrichWritableDetailsWithSellerFacts(writableDetails, config.timeoutMs);
  const now = new Date().toISOString();
  const { rawRows, parsedRows, marketInvalidationEvents, observationRows, payloadRows, sellerRows, lifecycleSeedRows } = buildRows(
    sellerEnrichment.details,
    now,
    options.runId ?? null,
  );
  if (sellerRows.length > 0) {
    await upsertRows("mvp_sellers", sellerRows, "source,seller_uid");
  }
  if (rawRows.length > 0) {
    await upsertRows("mvp_raw_listings", rawRows, "pid");
  }
  if (parsedRows.length > 0) {
    await upsertRows("mvp_listing_parsed", parsedRows, "pid");
  }
  // Wave launch-41 (사용자 짚음 "joongna 도 bunjang 처럼"): lifecycle 추적 시작.
  //   raw_listings upsert 후 seed (PK 무결성). best-effort — 실패해도 ingest 진행.
  let lifecycleSeeded = 0;
  if (lifecycleSeedRows.length > 0) {
    try {
      lifecycleSeeded = await seedLifecycleChecks(lifecycleSeedRows);
    } catch (err) {
      console.warn("joongna lifecycle seed failed (non-fatal)", err instanceof Error ? err.message : String(err));
    }
  }
  const marketInvalidationsQueued = await enqueueJoongnaMarketInvalidations(marketInvalidationEvents);
  const observationInserted = await insertObservations(observationRows, payloadRows);
  if (queueMode) {
    detailQueueDone = await markJoongnaDetailQueueDone(detailQueueDoneClaims);
    detailQueueFailed = await markJoongnaDetailQueueFailed(detailQueueFailedClaims);
  }

  const detailSuccessRate = detailAttempts > 0
    ? Number((details.filter((detail) => detail.ok).length / detailAttempts).toFixed(3))
    : 0;
  const hasBlock = blockedSignals.some((signal) => signal.blocked);
  const searchFailureRate = searchAttempts > 0 ? Number((searchFailures.length / searchAttempts).toFixed(3)) : 0;
  const searchFailureRateHigh = searchFailureRate >= JOONGNA_SEARCH_FAILURE_RATE_DEGRADED_THRESHOLD;
  const detailSuccessRateLow = detailAttempts > 0 && detailSuccessRate < JOONGNA_DETAIL_SUCCESS_RATE_DEGRADED_THRESHOLD;
  const queueNoPendingDetails = queueMode && productUrls.size > 0 && detailQueueClaimed === 0 && detailAttempts === 0;
  const queueSearchOnlyBudgetStop = queueMode && budgetStopped && productUrls.size > 0 && detailQueueClaimed === 0;
  let sourceHealthStatus: JoongnaIngestResult["sourceHealthStatus"] = "healthy";
  let sourceHealthReason = "active_ingest_ok";
  if (hasBlock) {
    sourceHealthStatus = "unhealthy";
    sourceHealthReason = blockedSignals.find((signal) => signal.blocked)?.reason ?? "blocked";
  } else if (queueSearchOnlyBudgetStop) {
    sourceHealthStatus = "healthy";
    sourceHealthReason = "queue_search_only_budget_stop";
  } else if (queueNoPendingDetails) {
    sourceHealthStatus = "healthy";
    sourceHealthReason = "queue_no_pending_details";
  } else if (searchFailureRateHigh) {
    sourceHealthStatus = "degraded";
    sourceHealthReason = "search_failure_rate_high";
  } else if (detailSuccessRateLow) {
    sourceHealthStatus = "degraded";
    sourceHealthReason = "detail_success_rate_low";
  } else if (writableDetails.length === 0) {
    sourceHealthStatus = "degraded";
    sourceHealthReason = "no_writable_details";
  }

  await insertSourceHealth({
    status: sourceHealthStatus,
    reason: sourceHealthReason,
    searchResultCount: productUrls.size,
    metrics: {
      mode,
      queries: config.queries,
      queryPoolSize: config.queryPoolSize,
      readyCatalogQueryPoolSize: config.readyCatalogQueryPoolSize,
      readyCatalogCategoryPoolCounts: config.readyCatalogCategoryPoolCounts,
      selectedReadyCatalogCategoryCounts: config.selectedReadyCatalogCategoryCounts,
      queryLimit: config.queryLimit,
      maxDetails: config.maxDetails,
      detailsPerQuery: config.detailsPerQuery,
      detailConcurrency: config.detailConcurrency,
      queueMode,
      detailQueueEnqueued,
      detailQueueClaimed,
      detailQueueDone,
      detailQueueFailed,
      detailQueueReleased,
      claimedBeforeSearch,
      searchDiscoveryLimit,
      searchUrls: productUrls.size,
      searchAttempts,
      searchFailures,
      searchFailureRate,
      searchFailureRateDegradedThreshold: JOONGNA_SEARCH_FAILURE_RATE_DEGRADED_THRESHOLD,
      detailAttempts,
      detailFetchFailures: detailFetchFailures.slice(0, 20),
      fetchedDetails: details.length,
      writableDetails: writableDetails.length,
      skippedDetails,
      detailSuccessRate,
      detailSuccessRateDegradedThreshold: JOONGNA_DETAIL_SUCCESS_RATE_DEGRADED_THRESHOLD,
      detail404Rate: detailAttempts > 0 ? Number((detail404 / detailAttempts).toFixed(3)) : 0,
      detail5xxRate: detailAttempts > 0 ? Number((detail5xx / detailAttempts).toFixed(3)) : 0,
      rawUpserted: rawRows.length,
      parsedUpserted: parsedRows.length,
      marketInvalidationsQueued,
      observationInserted,
      lifecycleSeeded,
      budgetStopped,
      deadlineSafetyMs: JOONGNA_INGEST_DEADLINE_SAFETY_MS,
      sellerProfilesFetched: sellerEnrichment.sellerProfilesFetched,
      sellerTransactionsFetched: sellerEnrichment.sellerTransactionsFetched,
      sellerCacheHits: sellerEnrichment.sellerCacheHits,
    },
  });

  return {
    source: JOONGNA_SOURCE_ID,
    mode,
    skipped: false,
    queries: config.queries,
    queryPoolSize: config.queryPoolSize,
    readyCatalogQueryPoolSize: config.readyCatalogQueryPoolSize,
    readyCatalogCategoryPoolCounts: config.readyCatalogCategoryPoolCounts,
    selectedReadyCatalogCategoryCounts: config.selectedReadyCatalogCategoryCounts,
    searchUrls: productUrls.size,
    fetchedDetails: details.length,
    parsedDetails: writableDetails.length,
    skippedDetails,
    blockedSignals,
    rawUpserted: rawRows.length,
    parsedUpserted: parsedRows.length,
    marketInvalidationsQueued,
    observationInserted,
    budgetStopped,
    sellerProfilesFetched: sellerEnrichment.sellerProfilesFetched,
    sellerTransactionsFetched: sellerEnrichment.sellerTransactionsFetched,
    sellerCacheHits: sellerEnrichment.sellerCacheHits,
    queueMode,
    detailQueueEnqueued,
    detailQueueClaimed,
    detailQueueDone,
    detailQueueFailed,
    detailQueueReleased,
    sourceHealthStatus,
    sourceHealthReason,
  };
}
