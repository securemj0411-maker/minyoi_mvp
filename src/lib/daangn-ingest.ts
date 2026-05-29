// Daangn source production ingest module.
//
// codex/daangn-probe branch 의 probe API (src/lib/daangn.ts) 를 활용해
// 실제 cron 안에서 search → detail → raw upsert 까지 가는 ingest pipeline.
//
// Stage 1 (Shadow Mode):
//   - mvp_raw_listings 에 source='daangn' 으로 write 만
//   - candidate_pool 진입 차단 (poolEligible=false hard-coded)
//   - 검증 + parser 정확도 audit 용
//
// Stage 2+ (다음 phase):
//   - shipping_possible 매물만 pool_eligible=true
//   - detail queue 분리
//   - lifecycle/observation
//
// 환경 변수 (운영):
//   DAANGN_SOURCE_MODE              "off" (default) / "probe" / "active"
//   DAANGN_INGEST_MAX_COMBOS        12  (cron 당 search combo 수)
//   DAANGN_INGEST_MAX_DETAIL_SAMPLES 8   (cron 당 detail fetch 한도)
//   DAANGN_INGEST_DELAY_MS          600 (request 사이 delay)
//   DAANGN_INGEST_ACTIVE_HOURS      72  (boostedAt 활성 윈도)
//   DAANGN_INGEST_FRESH_HOURS       24  (detail fetch 우선순위 fresh 기준)
//
// 안전:
//   - mode=off 면 skip
//   - blockedSignals 발견 시 즉시 중단 + source_health 갱신
//   - robots.txt 우회 X (/kr/buy-sell/?in=... 만 사용)

import {
  DAANGN_BASE_URL,
  DAANGN_FASHION_CATEGORIES,
  DAANGN_SOURCE_ID,
  DAANGN_SEARCH_REGION_SEEDS,
  DEFAULT_DAANGN_FASHION_QUERY_SEEDS,
  buildDaangnSearchUrl,
  daangnLifecycleFromStatus,
  daangnInternalPid,
  fetchDaangnText,
  getDaangnSourceMode,
  parseDaangnDetailHtml,
  parseDaangnExternalId,
  parseDaangnSearchHtml,
  shouldFetchDaangnDetailCandidate,
  summarizeDaangnArticles,
  type DaangnBlockSignal,
  type DaangnCategorySeed,
  type DaangnDetailArticle,
  type DaangnQuerySeed,
  type DaangnRegionSeed,
  type DaangnSearchArticle,
  type DaangnSourceMode,
} from "@/lib/daangn";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { buildDaangnQueryPool } from "@/lib/daangn-query-pool";
import { classifyListing } from "@/lib/pipeline";
import { buildCatalogSearchQueryEntries, normalize, skuById, type Sku } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow, type ParsedListingOptions } from "@/lib/option-parser";

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

export type DaangnShippingInference = "shipping_possible" | "direct_only" | "unknown";

export type DaangnIngestCombo = {
  region: DaangnRegionSeed;
  query: DaangnQuerySeed;
  category: DaangnCategorySeed;
};

export type DaangnIngestArticleRecord = {
  article: DaangnSearchArticle;
  combo: DaangnIngestCombo;
  ageHours: number | null;
  bucket: "fresh_24h" | "active_72h" | "stale" | "unknown";
};

export type DaangnIngestDetailRecord = {
  article: DaangnDetailArticle;
  combo: DaangnIngestCombo;
  shipping: DaangnShippingInference;
};

export type DaangnRegionYieldStat = {
  regionId: string;
  regionName: string;
  fetched: number;
  targetCategory: number;
  catalogHint: number;
  upsertCandidate: number;
};

export type DaangnCategoryYieldStat = {
  sourceRegionId: string;
  sourceRegionName: string;
  categoryId: string;
  categoryName: string;
  fetched: number;
  targetCategory: number;
  catalogHint: number;
  upsertCandidate: number;
};

export type DaangnIngestResult = {
  source: typeof DAANGN_SOURCE_ID;
  mode: DaangnSourceMode;
  skipped: boolean;
  skipReason?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;

  // combo 진행
  combos: number;
  regionShardCount?: number;
  regionShardIndex?: number;
  regionShardRegions?: number;
  regionSelectionMode?: DaangnComboSelection["selectionMode"];
  adaptiveRegionScoreRegions?: number;
  executedCombos: number;
  blockedCombos: number;
  failedCombos: number;

  // 매물 통계 (probe 와 동일 키)
  articles: number;
  duplicateArticlesDropped?: number;
  filteredArticles: number;
  articlesDroppedByCategory: number;
  articlesMissingCategory: number;
  categoryFilterDropRatio: number;
  catalogHintArticles: number;
  articlesDroppedByCatalogHint: number;
  maxUpsertArticles: number;
  upsertCandidateArticles: number;
  articlesDeferredByUpsertCap: number;
  categoryBoostRegions?: number;
  categoryBoostCombos?: number;
  categoryBoostAdaptivePairs?: number;
  categoryTargetOnly?: boolean;
  categoryTargetRegions?: number;
  categoryTargetCategoryIds?: string[];
  regionYieldStats?: {
    regions: DaangnRegionYieldStat[];
    topCatalogHint: DaangnRegionYieldStat[];
    zeroCatalogHintRegions: number;
  };
  categoryYieldStats?: {
    pairs: DaangnCategoryYieldStat[];
    topCatalogHint: DaangnCategoryYieldStat[];
  };
  ongoing: number;
  crawlAllowedOngoing: number;
  freshBoosted24h: number;
  activeBoosted72h: number;
  uniqueOngoingUrls: number;

  // detail 처리
  detailCandidates: number;
  detailFetched: number;
  detailParsed: number;
  detailFailed: number;

  // shipping 분포
  shipping: { shipping_possible: number; direct_only: number; unknown: number };

  // DB write (Stage 1: 모두 0 — schema 적용 후 활성)
  rawUpserted: number;
  rawSkippedExisting: number;
  searchConcurrency: number;

  // 안전 신호
  blockedSignals: DaangnBlockSignal[];
  sourceHealthStatus: "healthy" | "degraded" | "unhealthy";
  sourceHealthReason: string;

  // Phase 6i+++ timing instrumentation — 진짜 병목 식별용
  timingsMs?: {
    searchFetch?: number;   // Promise.all 5 region fetch
    searchParse?: number;   // parseDaangnSearchHtml + push
    summarize?: number;     // summarizeDaangnArticles
    detailClassify?: number; // pre-classify for detail priority sort
    detailFetch?: number;   // sequential 5 detail fetches
    rawUpsert?: number;     // upsertDaangnRawListings (raw + parsed)
    categoryFilter?: number; // raw DB write 전 target category sieve
    catalogHint?: number;   // catalog hint preselect before classifier/parser
    upsertPreselect?: number; // freshness sort + cap
    adaptiveRegionLoad?: number; // recent region yield stats lookup
    preflight?: number;     // existing-row lookup before expensive classify
    preflightSkipped?: number; // rows skipped before classifier/parser
    preflightOverflow?: number; // changed rows left for the next run after write cap
    preflightCandidates?: number; // wider candidate window checked before classify
    writeCandidates?: number; // rows selected for raw write/touch after preflight
    classifyCandidates?: number; // rows that actually ran expensive classify/parser
    classifyCacheHits?: number; // exact input cache hits before expensive classify/parser
    preflightReusedClassified?: number; // rows that reused stable existing sku_id instead of classifier/parser
    rowBuild?: number;      // classifyListing + parseListingOptions for changed rows
    rawRpc?: number;        // daangn_bulk_upsert_raw_listings_v2
    parsedUpsert?: number;  // daangn_bulk_upsert_listing_parsed for changed pids only
    healthCheck?: number;   // source health 평가
    total?: number;
  };
};

export type DaangnIngestOptions = {
  maxCombos?: number;
  maxDetailSamples?: number;
  delayMs?: number;
  activeWindowHours?: number;
  freshWindowHours?: number;
  timeoutMs?: number;
  maxUpsertArticles?: number;
  searchConcurrency?: number;
  // test override
  regions?: DaangnRegionSeed[];
  queries?: DaangnQuerySeed[];
  categories?: DaangnCategorySeed[];
  // Phase 6i: region firehose 모드 (default true). false 시 legacy keyword combo 모드.
  useRegionFirehose?: boolean;
  // Wave 909: A/B 프로젝트가 같은 전국 firehose 를 중복으로 긁지 않도록 지역 shard 를 나눈다.
  regionShardCount?: number;
  regionShardIndex?: number;
  // Production fallback 용: maxCombos < region count 일 때 최근 수율 좋은 지역을 먼저 섞는다.
  useAdaptiveRegionRotation?: boolean;
  // Wave 907: 전국 region firehose 위에 고수율 일부 지역만 category-depth 보조 fetch.
  categoryBoostRegions?: number;
  // Wave 911: C worker category-target experiment. Broad firehose 없이
  // region x target category 조합만 수집해서 request 대비 ready 전환율을 측정한다.
  categoryTargetOnly?: boolean;
  categoryTargetRegions?: number;
  // dry-run: DB write 안 함 (Stage 1 default)
  dryRun?: boolean;
};

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

// Wave 915 (2026-05-29): A/B/C firehose can surface 5k+ already-seen rows
// before fresh candidates, especially in category-target mode. Keep the
// write/classify cap unchanged, but inspect deeper so top existing rows do not
// starve new rows from the same fetched batch.
const DAANGN_UPSERT_PREFLIGHT_MULTIPLIER = 20;
const DAANGN_UPSERT_PREFLIGHT_MAX = 15_000;
const DAANGN_PREFLIGHT_EXISTING_READ_CHUNK_SIZE = 250;
const DAANGN_PREFLIGHT_EXISTING_READ_CONCURRENCY = 4;

export const DAANGN_TARGET_CATEGORY_SEEDS: DaangnCategorySeed[] = [
  { id: 1, name: "디지털기기" },
  { id: 2, name: "취미/게임/음반" },
  { id: 3, name: "스포츠/레저" },
  { id: 5, name: "여성의류" },
  { id: 6, name: "뷰티/미용" },
  { id: 14, name: "남성패션/잡화" },
  { id: 31, name: "여성잡화" },
  { id: 172, name: "생활가전" },
];

const DAANGN_TARGET_CATEGORY_IDS = new Set(DAANGN_TARGET_CATEGORY_SEEDS.map((category) => String(category.id)));

export function daangnUpsertPreflightLimit(maxUpsertArticles: number, totalCandidates: number): number {
  const writeCap = Math.max(0, Math.floor(maxUpsertArticles));
  const total = Math.max(0, Math.floor(totalCandidates));
  if (writeCap === 0 || total === 0) return 0;
  const preflightCap = Math.max(
    writeCap,
    Math.min(DAANGN_UPSERT_PREFLIGHT_MAX, writeCap * DAANGN_UPSERT_PREFLIGHT_MULTIPLIER),
  );
  return Math.min(total, preflightCap);
}

function boundedInt(raw: string | number | undefined | null, fallback: number, min: number, max: number) {
  const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function ageHours(timestamp: string | null, nowMs: number): number | null {
  if (!timestamp) return null;
  const t = Date.parse(timestamp);
  if (!Number.isFinite(t)) return null;
  return (nowMs - t) / 3_600_000;
}

// shipping 추론 — 보수적 (direct_only default).
// Codex hypothesis: "shipping은 구조화 신호가 약해서 설명문에 택배 가능 근거가 없으면 direct_only 로 보수 처리".
export function inferDaangnShipping(article: DaangnSearchArticle | DaangnDetailArticle): DaangnShippingInference {
  const title = (article.title ?? "").toLowerCase();
  const content = ((article as DaangnDetailArticle).content ?? article.content ?? "").toLowerCase();
  const blob = `${title}\n${content}`;

  // 명시적 직거래 only — direct_only 확정
  if (/직거래\s*만|직거래only|택배\s*안돼|택배\s*불가|직거래\s*위주/i.test(blob)) {
    return "direct_only";
  }
  // 명시적 택배 가능 — shipping_possible
  if (/택배\s*가능|택배\s*ok|전국택배|편의점\s*택배|반택|준등기|등기|cu\s*택배|gs\s*택배|우체국\s*택배|cj대한통운|cj\s*택배|롯데\s*택배|한진\s*택배|로젠\s*택배|당근페이|안전결제/i.test(blob)) {
    return "shipping_possible";
  }
  return "unknown";
}

function buildEmptyResult(mode: DaangnSourceMode, skipReason: string | undefined, startedAt: Date): DaangnIngestResult {
  return {
    source: DAANGN_SOURCE_ID,
    mode,
    skipped: true,
    skipReason,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    combos: 0,
    executedCombos: 0,
    blockedCombos: 0,
    failedCombos: 0,
    articles: 0,
    duplicateArticlesDropped: 0,
    filteredArticles: 0,
    articlesDroppedByCategory: 0,
    articlesMissingCategory: 0,
    categoryFilterDropRatio: 0,
    catalogHintArticles: 0,
    articlesDroppedByCatalogHint: 0,
    maxUpsertArticles: 0,
    upsertCandidateArticles: 0,
    articlesDeferredByUpsertCap: 0,
    ongoing: 0,
    crawlAllowedOngoing: 0,
    freshBoosted24h: 0,
    activeBoosted72h: 0,
    uniqueOngoingUrls: 0,
    detailCandidates: 0,
    detailFetched: 0,
    detailParsed: 0,
    detailFailed: 0,
    shipping: { shipping_possible: 0, direct_only: 0, unknown: 0 },
    rawUpserted: 0,
    rawSkippedExisting: 0,
    searchConcurrency: 0,
    blockedSignals: [],
    sourceHealthStatus: "healthy",
    sourceHealthReason: skipReason ?? "no-op",
  };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex] as T, currentIndex);
    }
  }));
  return results;
}

const DAANGN_SKU_CATEGORIES_BY_CATEGORY_ID: Record<string, Set<Sku["category"]>> = {
  "1": new Set(["smartphone", "tablet", "earphone", "laptop", "smartwatch", "desktop", "speaker", "camera", "drone", "monitor"]),
  "172": new Set(["home_appliance", "small_appliance"]),
  "2": new Set(["game_console", "lego"]),
  "3": new Set(["sport_golf", "shoe", "bike", "drone", "kickboard"]),
  "5": new Set(["clothing"]),
  "6": new Set(["perfume"]),
  "14": new Set(["clothing", "shoe", "bag", "watch"]),
  "31": new Set(["clothing", "shoe", "bag", "watch"]),
};

function daangnSkuCategories(categoryId: string | null | undefined): Sku["category"][] | undefined {
  const categories = categoryId ? DAANGN_SKU_CATEGORIES_BY_CATEGORY_ID[categoryId] : null;
  return categories ? [...categories] : undefined;
}

type DaangnCatalogHintIndex = {
  buckets: Map<string, string[]>;
  shortHints: string[];
};

const EMPTY_DAANGN_CATALOG_HINT_INDEX: DaangnCatalogHintIndex = {
  buckets: new Map(),
  shortHints: [],
};

const DAANGN_CLASSIFIED_RECHECK_MS = 2 * 60 * 60 * 1000;
const DAANGN_UNCLASSIFIED_RECHECK_MS = 2 * 60 * 60 * 1000;

let daangnCatalogHintCache: Map<string, DaangnCatalogHintIndex> | null = null;

function daangnHintKey(text: string): string | null {
  const compact = text.replace(/\s+/g, "");
  return compact.length >= 2 ? compact.slice(0, 2) : null;
}

function buildDaangnCatalogHintIndex(hints: string[]): DaangnCatalogHintIndex {
  const buckets = new Map<string, string[]>();
  const shortHints: string[] = [];
  for (const hint of [...new Set(hints)].sort((a, b) => b.length - a.length)) {
    const key = daangnHintKey(hint);
    if (!key) {
      shortHints.push(hint);
      continue;
    }
    const bucket = buckets.get(key) ?? [];
    bucket.push(hint);
    buckets.set(key, bucket);
  }
  return { buckets, shortHints };
}

function daangnTextHintKeys(text: string): Set<string> {
  const compact = text.replace(/\s+/g, "");
  const keys = new Set<string>();
  for (let i = 0; i < compact.length - 1; i += 1) {
    keys.add(compact.slice(i, i + 2));
  }
  return keys;
}

function daangnCatalogHintIndex(categoryId: string | null): DaangnCatalogHintIndex {
  if (!daangnCatalogHintCache) {
    const all = buildCatalogSearchQueryEntries()
      .map((entry) => ({
        category: entry.category,
        query: normalize(entry.query),
      }))
      .filter((entry) => entry.query.replace(/\s+/g, "").length >= 4);
    const map = new Map<string, DaangnCatalogHintIndex>();
    map.set("*", buildDaangnCatalogHintIndex(all.map((entry) => entry.query)));
    for (const [daangnCategoryId, skuCategories] of Object.entries(DAANGN_SKU_CATEGORIES_BY_CATEGORY_ID)) {
      const scoped = all
        .filter((entry) => skuCategories.has(entry.category))
        .map((entry) => entry.query);
      map.set(daangnCategoryId, buildDaangnCatalogHintIndex(scoped));
    }
    daangnCatalogHintCache = map;
  }
  return daangnCatalogHintCache.get(categoryId ?? "") ?? daangnCatalogHintCache.get("*") ?? EMPTY_DAANGN_CATALOG_HINT_INDEX;
}

function hasDaangnCatalogHint(article: DaangnSearchArticle): boolean {
  const text = normalize(`${article.title ?? ""} ${article.content ?? ""}`).slice(0, 1200);
  const index = daangnCatalogHintIndex(article.category?.dbId ?? null);
  for (const hint of index.shortHints) {
    if (text.includes(hint)) return true;
  }
  const checked = new Set<string>();
  for (const key of daangnTextHintKeys(text)) {
    const bucket = index.buckets.get(key);
    if (!bucket) continue;
    for (const hint of bucket) {
      if (checked.has(hint)) continue;
      checked.add(hint);
      if (text.includes(hint)) return true;
    }
  }
  return false;
}

function articleFreshnessMs(article: DaangnSearchArticle): number {
  const parsed = Date.parse(article.boostedAt ?? article.createdAt ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

type DaangnPreflightRow = {
  article: DaangnSearchArticle | DaangnDetailArticle;
  externalId: string;
  pid: number;
  title: string;
  descriptionPreview: string;
  price: number;
  numFaved: number;
  numComment: number;
  thumbnailUrl: string | null;
  imageCount: number;
  listingState: "active" | "sold_confirmed" | "disappeared";
  saleStatus: string;
  sourceUpdatedAt: string;
  rawJson: Record<string, unknown>;
  daangnRegionId: string | null;
  daangnRegionName: string | null;
  daangnBoostedAt: string | null;
  daangnWebCrawlAllowed: boolean;
  daangnShippingInferred: DaangnShippingInference;
};

type ExistingDaangnRawRow = {
  pid: number;
  name: string | null;
  price: number | null;
  num_faved: number | null;
  num_comment: number | null;
  thumbnail_url: string | null;
  image_count: number | null;
  description_preview: string | null;
  listing_state: string | null;
  sale_status: string | null;
  detail_status: string | null;
  source_updated_at: string | null;
  last_seen_at: string | null;
  raw_json: Record<string, unknown> | null;
  listing_type: string | null;
  sku_id: string | null;
  sku_name: string | null;
  pool_eligible: boolean | null;
  daangn_region_id: string | null;
  daangn_region_name: string | null;
  daangn_boosted_at: string | null;
  daangn_web_crawl_allowed: boolean | null;
  daangn_shipping_inferred: string | null;
  daangn_manner_temperature: number | null;
  daangn_review_count: number | null;
};

function daangnDetailUser(article: DaangnSearchArticle | DaangnDetailArticle): {
  score?: number | null;
  reviewCount?: number | null;
  profileImage?: string | null;
  regionName?: string | null;
} | null {
  return article.user as {
    score?: number | null;
    reviewCount?: number | null;
    profileImage?: string | null;
    regionName?: string | null;
  } | null;
}

function daangnImageCount(article: DaangnSearchArticle | DaangnDetailArticle): number {
  return Array.isArray(article.images) ? article.images.length : 0;
}

type ReusedDaangnClassification = {
  listingType: "normal";
  skuId: string;
  skuName: string;
};

type DaangnClassifyParseResult = {
  storageListingType: string;
  skuId: string | null;
  skuName: string | null;
  parsedOptions: ParsedListingOptions | null;
};

const DAANGN_CLASSIFY_PARSE_CACHE_MAX = 20_000;
const daangnClassifyParseCache = new Map<string, DaangnClassifyParseResult>();

export function hasDaangnDetailPayload(article: DaangnSearchArticle | DaangnDetailArticle): boolean {
  const detailUser = daangnDetailUser(article);
  return Boolean(
    Object.prototype.hasOwnProperty.call(article, "recommendedCount")
    || Object.prototype.hasOwnProperty.call(article, "commentCount")
    || Object.prototype.hasOwnProperty.call(detailUser ?? {}, "score")
    || Object.prototype.hasOwnProperty.call(detailUser ?? {}, "reviewCount")
  );
}

function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const at = Date.parse(a);
  const bt = Date.parse(b);
  if (!Number.isFinite(at) || !Number.isFinite(bt)) return a === b;
  return at === bt;
}

export function sameDaangnRawJson(a: Record<string, unknown> | null | undefined, b: Record<string, unknown>): boolean {
  if (!a) return false;
  const aRegion = (a.region && typeof a.region === "object") ? a.region as Record<string, unknown> : null;
  const bRegion = (b.region && typeof b.region === "object") ? b.region as Record<string, unknown> : null;
  // viewCount drifts constantly and is not used for score/pool decisions; do
  // not let it re-run the expensive SKU classifier for otherwise stable rows.
  return (
    a.source === b.source &&
    a.externalId === b.externalId &&
    Number(a.imageCount ?? 0) === Number(b.imageCount ?? 0) &&
    (aRegion?.dbId ?? null) === (bRegion?.dbId ?? null) &&
    (aRegion?.name ?? null) === (bRegion?.name ?? null)
  );
}

function buildDaangnPreflightRow(
  article: DaangnSearchArticle | DaangnDetailArticle,
  shipping: DaangnShippingInference | null,
): DaangnPreflightRow | null {
  const externalId = parseDaangnExternalId(article.href);
  if (!externalId) return null;
  if (article.price == null || !Number.isFinite(Number(article.price))) return null;
  const title = article.title || "(no title)";
  const description = ((article as DaangnDetailArticle).content ?? article.content ?? "") as string;
  const lifecycle = daangnLifecycleFromStatus(article.status);
  const imageCount = daangnImageCount(article);
  return {
    article,
    externalId,
    pid: daangnInternalPid(externalId),
    title,
    descriptionPreview: (description ?? "").slice(0, 500),
    price: Math.max(0, Math.round(Number(article.price))),
    numFaved: article.favoriteCount ?? 0,
    numComment: article.chatCount ?? 0,
    thumbnailUrl: article.thumbnail ?? null,
    imageCount,
    listingState: lifecycle.listingState,
    saleStatus: lifecycle.saleStatus,
    sourceUpdatedAt: article.boostedAt ?? article.createdAt ?? new Date(0).toISOString(),
    rawJson: {
      source: DAANGN_SOURCE_ID,
      externalId,
      viewCount: article.viewCount,
      imageCount,
      region: article.region,
    },
    daangnRegionId: article.region.dbId ?? null,
    daangnRegionName: article.region.name ?? null,
    daangnBoostedAt: article.boostedAt ?? null,
    daangnWebCrawlAllowed: !article.user.webCrawlNotAllowed,
    daangnShippingInferred: shipping ?? "unknown",
  };
}

function canSkipDaangnClassify(existing: ExistingDaangnRawRow | undefined, row: DaangnPreflightRow, nowMs: number): boolean {
  if (!existing) return false;
  const lastSeenMs = existing.last_seen_at ? Date.parse(existing.last_seen_at) : 0;
  if (!Number.isFinite(lastSeenMs)) return false;
  const incomingHasDetailPayload = hasDaangnDetailPayload(row.article);
  if (incomingHasDetailPayload) {
    const detailUser = daangnDetailUser(row.article);
    const score = detailUser?.score ?? null;
    const reviewCount = detailUser?.reviewCount ?? null;
    if (existing.detail_status !== "done") return false;
    if (score != null && Number(existing.daangn_manner_temperature ?? Number.NaN) !== score) return false;
    if (reviewCount != null && Number(existing.daangn_review_count ?? Number.NaN) !== reviewCount) return false;
  }
  // sku_id 없는 row 도 매 tick 재분류하면 firehose 반복 CPU 가 커진다.
  // raw RPC no-op window 와 맞춰 2시간마다 다시 열고, catalog 대형 패치는 별도 rematch 로 즉시 반영한다.
  const recheckMs = existing.sku_id ? DAANGN_CLASSIFIED_RECHECK_MS : DAANGN_UNCLASSIFIED_RECHECK_MS;
  if (nowMs - lastSeenMs >= recheckMs) return false;
  return (
    existing.name === row.title &&
    Number(existing.price ?? -1) === row.price &&
    Number(existing.num_faved ?? 0) === row.numFaved &&
    Number(existing.num_comment ?? 0) === row.numComment &&
    (existing.thumbnail_url ?? null) === row.thumbnailUrl &&
    Number(existing.image_count ?? 0) === row.imageCount &&
    (existing.description_preview ?? "") === row.descriptionPreview &&
    existing.listing_state === row.listingState &&
    existing.sale_status === row.saleStatus &&
    sameInstant(existing.source_updated_at, row.sourceUpdatedAt) &&
    sameDaangnRawJson(existing.raw_json, row.rawJson) &&
    (existing.daangn_region_id ?? null) === row.daangnRegionId &&
    (existing.daangn_region_name ?? null) === row.daangnRegionName &&
    sameInstant(existing.daangn_boosted_at, row.daangnBoostedAt) &&
    Boolean(existing.daangn_web_crawl_allowed) === row.daangnWebCrawlAllowed &&
    (existing.daangn_shipping_inferred ?? "unknown") === row.daangnShippingInferred
  );
}

function reusableDaangnClassification(
  existing: ExistingDaangnRawRow | undefined,
  row: DaangnPreflightRow,
): ReusedDaangnClassification | null {
  if (!existing?.sku_id) return null;
  if (existing.listing_type !== "normal") return null;

  // If the parser input is unchanged, a scheduled 2h touch does not need to
  // re-run the expensive catalog matcher. Catalog-wide rematches should use
  // explicit reparse/rematch jobs, not every Daangn firehose tick.
  if (existing.name !== row.title) return null;
  if (Number(existing.price ?? -1) !== row.price) return null;
  if ((existing.description_preview ?? "") !== row.descriptionPreview) return null;

  const sku = skuById(existing.sku_id);
  if (!sku) return null;
  return {
    listingType: "normal",
    skuId: existing.sku_id,
    skuName: existing.sku_name ?? sku.modelName,
  };
}

function daangnClassifyParseCacheKey(input: {
  title: string;
  description: string;
  price: number;
  categoryId: string | null | undefined;
}): string {
  return [
    input.categoryId ?? "",
    Math.round(input.price),
    input.title,
    input.description,
  ].join("\u0000");
}

function getDaangnClassifyParseCache(key: string): DaangnClassifyParseResult | null {
  const hit = daangnClassifyParseCache.get(key);
  if (!hit) return null;
  daangnClassifyParseCache.delete(key);
  daangnClassifyParseCache.set(key, hit);
  return hit;
}

function setDaangnClassifyParseCache(key: string, value: DaangnClassifyParseResult) {
  daangnClassifyParseCache.set(key, value);
  while (daangnClassifyParseCache.size > DAANGN_CLASSIFY_PARSE_CACHE_MAX) {
    const oldest = daangnClassifyParseCache.keys().next().value;
    if (!oldest) break;
    daangnClassifyParseCache.delete(oldest);
  }
}

function classifyParseDaangnRow(input: {
  title: string;
  description: string;
  price: number;
  categoryId: string | null | undefined;
}): DaangnClassifyParseResult & { cacheHit: boolean } {
  const cacheKey = daangnClassifyParseCacheKey(input);
  const cached = getDaangnClassifyParseCache(cacheKey);
  if (cached) return { ...cached, cacheHit: true };

  const classified = classifyListing(input.title, input.description, input.price, {
    categories: daangnSkuCategories(input.categoryId),
  });
  const storageListingType = classified.listingType === "normal" ? "normal" : (classified.listingType ?? "unknown");
  const matched = classified.listingType === "normal" ? classified.sku : null;
  const parsedOptions = matched
    ? parseListingOptions({
      title: input.title,
      description: input.description,
      skuId: matched.id,
      skuName: matched.modelName,
      category: matched.category,
    })
    : null;
  const skuId = parsedOptions && !parsedOptions.needsReview ? matched?.id ?? null : null;
  const skuName = parsedOptions && !parsedOptions.needsReview ? matched?.modelName ?? null : null;
  const result = { storageListingType, skuId, skuName, parsedOptions };
  setDaangnClassifyParseCache(cacheKey, result);
  return { ...result, cacheHit: false };
}

async function loadExistingDaangnRawRows(pids: number[]): Promise<Map<number, ExistingDaangnRawRow>> {
  if (pids.length === 0) return new Map();
  const out = new Map<number, ExistingDaangnRawRow>();
  const columns = [
    "pid",
    "name",
    "price",
    "num_faved",
    "num_comment",
    "thumbnail_url",
    "image_count",
    "description_preview",
    "listing_state",
    "sale_status",
    "detail_status",
    "source_updated_at",
    "last_seen_at",
    "raw_json",
    "listing_type",
    "sku_id",
    "sku_name",
    "pool_eligible",
    "daangn_region_id",
    "daangn_region_name",
    "daangn_boosted_at",
    "daangn_web_crawl_allowed",
    "daangn_shipping_inferred",
    "daangn_manner_temperature",
    "daangn_review_count",
  ].join(",");
  const chunks: number[][] = [];
  for (let i = 0; i < pids.length; i += DAANGN_PREFLIGHT_EXISTING_READ_CHUNK_SIZE) {
    chunks.push(pids.slice(i, i + DAANGN_PREFLIGHT_EXISTING_READ_CHUNK_SIZE));
  }
  const batches = await mapWithConcurrency(chunks, DAANGN_PREFLIGHT_EXISTING_READ_CONCURRENCY, async (chunk) => {
    const res = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=${columns}&source=eq.${DAANGN_SOURCE_ID}&pid=in.(${chunk.join(",")})`,
      { headers: serviceHeaders() },
    );
    return (await res.json()) as ExistingDaangnRawRow[];
  });
  for (const rows of batches) {
    for (const row of rows) out.set(Number(row.pid), row);
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// DB upsert
// ───────────────────────────────────────────────────────────────────────────

function buildRawListingRow(
  article: DaangnSearchArticle | DaangnDetailArticle,
  shipping: DaangnShippingInference | null,
  nowIso: string,
  queryLabel?: string | null,
  reuse?: ReusedDaangnClassification | null,
): { raw: Record<string, unknown>; parsed: Record<string, unknown> | null; sku_id: string | null; classifyCacheHit: boolean } | null {
  const externalId = parseDaangnExternalId(article.href);
  if (!externalId) return null;
  // mvp_raw_listings.price 는 NOT NULL (no default).
  // 당근 매물 중 price=null = "가격 협의" 등 → reseller 가치 0 → skip.
  if (article.price == null || !Number.isFinite(Number(article.price))) return null;
  const pid = daangnInternalPid(externalId);
  const fullUrl = article.href.startsWith("http") ? article.href : `${DAANGN_BASE_URL}${article.href}`;

  // Phase 6 — classifier + parser 통합 (bunjang detail-worker 패턴).
  //   sku_id 매칭 → score-worker 가 처리 가능.
  //   detail.content 가 있으면 description 으로 사용 (parser quality ↑).
  const title = article.title ?? "";
  const description = ((article as DaangnDetailArticle).content ?? article.content ?? "") as string;
  const price = Number(article.price ?? 0);
  let storageListingType = reuse?.listingType ?? "unknown";
  let skuId: string | null = reuse?.skuId ?? null;
  let skuName: string | null = reuse?.skuName ?? null;
  let parsedRow: Record<string, unknown> | null = null;
  let classifyCacheHit = false;
  if (!reuse) {
    const classified = classifyParseDaangnRow({
      title,
      description,
      price,
      categoryId: article.category?.dbId,
    });
    storageListingType = classified.storageListingType;
    skuId = classified.skuId;
    skuName = classified.skuName;
    classifyCacheHit = classified.cacheHit;
    const parsedOptions = classified.parsedOptions;
    parsedRow = parsedOptions ? toParsedListingRow(pid, parsedOptions) : null;
  }
  const lifecycle = daangnLifecycleFromStatus(article.status);

  // pool_eligible 정책 (Phase 6 수정 — 사용자 정책):
  //   당근 매물 = 동네 직거래 default OK.
  //   direct_only / unknown / shipping_possible 모두 pool 진입 후보.
  //   매물 노출 시 사용자 동네 매칭은 per-user filter (Phase 7).
  //   sku_id NULL = 분류 실패 → pool 차단.
  const poolEligible =
    Boolean(skuId) &&
    storageListingType === "normal" &&
    lifecycle.listingState === "active" &&
    !article.user.webCrawlNotAllowed;

  // mvp_raw_listings NOT NULL columns — 안전 fallback 박기 (NOT NULL no-default 모두 cover):
  //   pid, url, name, price (no-default — 위에서 skip 처리)
  //   그 외 default 있는 것 (num_faved, free_shipping, query, source, description_preview, sale_status,
  //   shop_review_count, listing_type, detail_status, raw_json, listing_state, missing_count,
  //   seller_source, score_dirty) 는 default 사용 가능하지만 명시 박기.
  const priceInt = Math.max(0, Math.round(Number(article.price)));
  const detailUser = daangnDetailUser(article);
  const hasDetailPayload = hasDaangnDetailPayload(article);
  const imageCount = daangnImageCount(article);
  const raw: Record<string, unknown> = {
    pid,
    source: DAANGN_SOURCE_ID,
    url: fullUrl,
    name: title || "(no title)",
    price: priceInt,
    num_faved: article.favoriteCount ?? 0,
    num_comment: article.chatCount ?? 0,
    free_shipping: false,
    thumbnail_url: article.thumbnail ?? null,
    description_preview: (description ?? "").slice(0, 500),
    query: queryLabel || `daangn:${article.region.name ?? article.region.dbId ?? "unknown"}`,
    seller_uid: article.user.dbId ?? null,
    seller_source: DAANGN_SOURCE_ID,
    listing_state: lifecycle.listingState,
    listing_type: storageListingType,
    sku_id: skuId,
    sku_name: skuName,
    sale_status: lifecycle.saleStatus,
    shop_review_count: 0,
    image_count: imageCount,
    missing_count: 0,
    detail_status: hasDetailPayload ? "done" : "pending",
    detail_enriched_at: hasDetailPayload ? nowIso : null,
    source_updated_at: article.boostedAt ?? article.createdAt ?? nowIso,
    last_seen_at: nowIso,
    last_changed_at: nowIso,
    updated_at: nowIso,
    pool_eligible: poolEligible,
    score_dirty: poolEligible,  // sku 매칭 + normal → score-worker 가 다음 cycle 에 처리
    // Phase 6i+++ → 6j rollback: region 정보 raw_json 에 다시 박기 (UI direct-location endpoint 필요).
    //   marketplaceLocationCombined() 가 raw_json 안 region 정보 lookup.
    //   payload size 증가 약간 있지만 UI 필수 정보.
    raw_json: {
      source: DAANGN_SOURCE_ID,
      externalId,
      queryLabel: queryLabel ?? null,
      viewCount: article.viewCount,
      imageCount,
      region: article.region,  // { dbId, name } — direct-location 표시용
    },
    // Daangn 전용 컬럼 (Phase 3 schema migration)
    daangn_region_id: article.region.dbId,
    daangn_region_name: article.region.name,
    daangn_boosted_at: article.boostedAt,
    daangn_web_crawl_allowed: !article.user.webCrawlNotAllowed,
    daangn_shipping_inferred: shipping ?? "unknown",
    // Wave 758 (2026-05-26): 매너온도 + 리뷰 수 — detail article 일 때만 user.score/reviewCount 추출.
    //   search-only article 은 NULL (RPC 에서 COALESCE 로 옛 값 유지).
    //   당근 신뢰 신호는 manner temperature (0~99.9°C) 주축. reviewCount 는 참고.
    daangn_manner_temperature: hasDetailPayload ? (detailUser?.score ?? null) : null,
    daangn_review_count: hasDetailPayload ? (detailUser?.reviewCount ?? null) : null,
  };
  return { raw, parsed: parsedRow, sku_id: skuId, classifyCacheHit };
}

export async function upsertDaangnRawListings(
  articles: DaangnSearchArticle[],
  detailRecords: DaangnIngestDetailRecord[],
  options: { maxClassifyRows?: number } = {},
): Promise<{
  rawUpserted: number;
  rawSkippedExisting: number;
  rawRpcMs: number;
  parsedUpsertMs: number;
  preflightMs: number;
  preflightSkipped: number;
  preflightOverflow: number;
  preflightCandidates: number;
  writeCandidates: number;
  classifyCandidates: number;
  classifyCacheHits: number;
  preflightReusedClassified: number;
  rowBuildMs: number;
  affectedPids: number[];
}> {
  if (articles.length === 0) {
    return {
      rawUpserted: 0,
      rawSkippedExisting: 0,
      rawRpcMs: 0,
      parsedUpsertMs: 0,
      preflightMs: 0,
      preflightSkipped: 0,
      preflightOverflow: 0,
      preflightCandidates: 0,
      writeCandidates: 0,
      classifyCandidates: 0,
      classifyCacheHits: 0,
      preflightReusedClassified: 0,
      rowBuildMs: 0,
      affectedPids: [],
    };
  }
  const nowIso = new Date().toISOString();
  const nowMs = Date.parse(nowIso);

  // detail enriched 매물 (shipping 추론됨) 은 우선 사용
  const detailShippingByExternal = new Map<string, DaangnShippingInference>();
  // Wave 758 (2026-05-26): detail article (user.score 포함) 도 매핑 — 같은 ext 면 search 대신 detail 사용.
  //   buildRawListingRow 는 DaangnDetailArticle 일 때 manner_temperature 추출.
  const detailArticleByExternal = new Map<string, DaangnDetailArticle>();
  const detailQueryLabelByExternal = new Map<string, string>();
  for (const r of detailRecords) {
    const ext = parseDaangnExternalId(r.article.href);
    if (ext) {
      detailShippingByExternal.set(ext, r.shipping);
      detailArticleByExternal.set(ext, r.article);
      detailQueryLabelByExternal.set(ext, r.combo.query.label);
    }
  }

  // 같은 매물이 region/category combo 여러 개에서 반복 유입된다.
  // 비싼 classifier/parser 를 태우기 전에 external id 기준으로 먼저 줄인다.
  const uniqueArticles = new Map<string, DaangnSearchArticle>();
  for (const article of articles) {
    const ext = parseDaangnExternalId(article.href);
    if (ext && !uniqueArticles.has(ext)) uniqueArticles.set(ext, article);
  }

  const preflightStart = Date.now();
  const preflightRows: DaangnPreflightRow[] = [];
  for (const article of uniqueArticles.values()) {
    const ext = parseDaangnExternalId(article.href);
    if (!ext) continue;
    const detailArticle = detailArticleByExternal.get(ext);
    const articleToUse: DaangnSearchArticle | DaangnDetailArticle = detailArticle ?? article;
    const row = buildDaangnPreflightRow(articleToUse, detailShippingByExternal.get(ext) ?? null);
    if (row) preflightRows.push(row);
  }
  const existingRows = await loadExistingDaangnRawRows(preflightRows.map((row) => row.pid));
  const rowsNeedingClassify = preflightRows.filter((row) => !canSkipDaangnClassify(existingRows.get(row.pid), row, nowMs));
  const preflightSkipped = preflightRows.length - rowsNeedingClassify.length;
  const maxClassifyRows = Math.max(0, Math.floor(options.maxClassifyRows ?? rowsNeedingClassify.length));
  const rowsSelectedForWrite = rowsNeedingClassify.slice(0, maxClassifyRows);
  const preflightOverflow = Math.max(0, rowsNeedingClassify.length - rowsSelectedForWrite.length);
  const preflightMs = Date.now() - preflightStart;

  // dedupe by pid (같은 매물 여러 combo 중복 검색됨)
  const rowBuildStart = Date.now();
  const byPid = new Map<number, { raw: Record<string, unknown>; parsed: Record<string, unknown> | null }>();
  let preflightReusedClassified = 0;
  let classifyCandidates = 0;
  let classifyCacheHits = 0;
  for (const row of rowsSelectedForWrite) {
    const ext = parseDaangnExternalId(row.article.href);
    const reuse = reusableDaangnClassification(existingRows.get(row.pid), row);
    if (reuse) preflightReusedClassified += 1;
    const built = buildRawListingRow(row.article, row.daangnShippingInferred, nowIso, ext ? detailQueryLabelByExternal.get(ext) : null, reuse);
    if (!built) continue;
    if (!reuse && built.classifyCacheHit) classifyCacheHits += 1;
    else if (!reuse) classifyCandidates += 1;
    byPid.set(built.raw.pid as number, { raw: built.raw, parsed: built.parsed });
  }
  const rowBuildMs = Date.now() - rowBuildStart;

  const rawRows = [...byPid.values()].map((b) => b.raw);
  const parsedRows = [...byPid.values()].map((b) => b.parsed).filter((p): p is Record<string, unknown> => Boolean(p));
  if (rawRows.length === 0) {
    return {
      rawUpserted: 0,
      rawSkippedExisting: preflightSkipped,
      rawRpcMs: 0,
      parsedUpsertMs: 0,
      preflightMs,
      preflightSkipped,
      preflightOverflow,
      preflightCandidates: preflightRows.length,
      writeCandidates: rowsSelectedForWrite.length,
      classifyCandidates,
      classifyCacheHits,
      preflightReusedClassified,
      rowBuildMs,
      affectedPids: [],
    };
  }

  // Phase 6i++++ RPC bulk upsert: PostgREST ON CONFLICT 처리 serialize 한계 우회.
  //   parallel chunked 도 효과 X 확인 (213s) — Supabase 가 row 별 락 leitung.
  //   Postgres 안에서 single SQL transaction 으로 처리 → 5-10x 단축 기대.
  const rawRpcStart = Date.now();
  const rawRes = await restFetch(rpcUrl("daangn_bulk_upsert_raw_listings_v2"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({ rows: rawRows }),
  });
  if (!rawRes.ok) {
    throw new Error(`daangn_bulk_upsert_raw_listings_v2 RPC failed: ${rawRes.status} ${await rawRes.text()}`);
  }
  const rawPayload = await rawRes.json() as { affected?: unknown; affectedPids?: unknown } | number;
  const rawRpcMs = Date.now() - rawRpcStart;
  const affectedPids = Array.isArray((rawPayload as { affectedPids?: unknown }).affectedPids)
    ? ((rawPayload as { affectedPids: unknown[] }).affectedPids)
      .map((pid) => Number(pid))
      .filter(Number.isFinite)
    : [];
  const rawAffected = typeof rawPayload === "number" ? rawPayload : Number(rawPayload.affected);
  const rawUpserted = Number.isFinite(rawAffected) ? Math.max(0, Math.floor(rawAffected)) : rawRows.length;

  const affectedPidSet = new Set(affectedPids);
  const parsedRowsToUpsert = affectedPidSet.size > 0
    ? parsedRows.filter((row) => affectedPidSet.has(Number(row.pid)))
    : (rawUpserted >= rawRows.length ? parsedRows : []);

  let parsedUpsertMs = 0;
  if (parsedRowsToUpsert.length > 0) {
    const parsedStart = Date.now();
    const parsedRes = await restFetch(rpcUrl("daangn_bulk_upsert_listing_parsed"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({ rows: parsedRowsToUpsert }),
    });
    parsedUpsertMs = Date.now() - parsedStart;
    if (!parsedRes.ok) {
      // parsed upsert 실패는 fatal X — raw 는 박혔으니 다음 cron 재시도
      console.warn(`daangn_bulk_upsert_listing_parsed RPC failed: ${parsedRes.status} ${await parsedRes.text()}`);
    }
  }

  return {
    rawUpserted,
    rawSkippedExisting: preflightSkipped + Math.max(0, rawRows.length - rawUpserted),
    rawRpcMs,
    parsedUpsertMs,
    preflightMs,
    preflightSkipped,
    preflightOverflow,
    preflightCandidates: preflightRows.length,
    writeCandidates: rowsSelectedForWrite.length,
    classifyCandidates,
    classifyCacheHits,
    preflightReusedClassified,
    rowBuildMs,
    affectedPids,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Combo selection (rotation strategy)
// ───────────────────────────────────────────────────────────────────────────

export type DaangnComboSelection = {
  combos: DaangnIngestCombo[];
  totalSpace: number;
  selectionMode?: "all_regions" | "random" | "adaptive";
};

export function selectDaangnCombos(input: {
  regions: DaangnRegionSeed[];
  queries: DaangnQuerySeed[];
  categories: DaangnCategorySeed[];
  maxCombos: number;
  // Phase 6h: production 은 shuffleRegions=true 로 111 region 골고루 hit.
  //   tests/순수함수 검증 시 false 로 결과 deterministic 유지.
  shuffleRegions?: boolean;
}): DaangnComboSelection {
  const { regions, queries, categories, maxCombos } = input;
  const shuffleRegions = input.shuffleRegions ?? false;
  const out: DaangnIngestCombo[] = [];
  let space = 0;

  // Phase 6e fallback: regions 가 빈 배열일 때 placeholder 1개로 동작.
  //   사용자별 동네 검색 등 future use case 대비.
  //   현실: nationwide 검색 안 됨 (ElasticSearch region sharding) — 운영 코드는 항상 regions 전달.
  if (regions.length === 0) {
    const placeholderRegion: DaangnRegionSeed = { id: "", name: "전국" };
    for (const query of queries) {
      for (const cat of categories) {
        space += 1;
        if (out.length >= maxCombos) continue;
        if (query.categoryIds.length > 0 && !query.categoryIds.includes(cat.id)) continue;
        out.push({ region: placeholderRegion, query, category: cat });
      }
    }
    return { combos: out, totalSpace: space };
  }

  // Phase 6h: region-round-robin + optional shuffle.
  //   - 기존 linear iteration: 111 region × 6 query × 3 cat = 1998 combo space,
  //     maxCombos=30 cap 으로 첫 1-2 region 만 hit → region 30+은 영영 cover 안 됨.
  //   - 새 방식: depth-first round-robin (1번째 query/cat 를 모든 region 에서 한 번씩,
  //     그 다음 2번째 query/cat 를 다시 모든 region) → maxCombos 안에서도 region 다양성 max.
  //   - shuffleRegions=true 시 매 tick 마다 region order 무작위화 → 운영에서 24h 누적 시
  //     모든 region 골고루 cover.

  // 1) per-region combo list 미리 build (category filter 통과한 것만)
  const regionOrder = shuffleRegions ? shuffleArray(regions) : regions;
  const perRegion: DaangnIngestCombo[][] = regionOrder.map((region) => {
    const list: DaangnIngestCombo[] = [];
    for (const query of queries) {
      for (const cat of categories) {
        space += 1;
        if (query.categoryIds.length > 0 && !query.categoryIds.includes(cat.id)) continue;
        list.push({ region, query, category: cat });
      }
    }
    return list;
  });

  // 2) depth-first round-robin: depth 0 ⇒ 각 region 의 0번째 combo, depth 1 ⇒ 1번째, ...
  let depth = 0;
  while (out.length < maxCombos) {
    let appended = false;
    for (const list of perRegion) {
      if (depth < list.length) {
        out.push(list[depth]);
        appended = true;
        if (out.length >= maxCombos) break;
      }
    }
    if (!appended) break;
    depth += 1;
  }

  return { combos: out, totalSpace: space };
}

// 순수 함수: Fisher-Yates shuffle (Math.random 사용, test 시 비결정적).
function shuffleArray<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function stableShardHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function selectDaangnRegionShard(
  regions: DaangnRegionSeed[],
  shardCount: number,
  shardIndex: number,
): DaangnRegionSeed[] {
  const count = Math.max(1, Math.floor(shardCount));
  if (count <= 1) return regions;
  const index = Math.max(0, Math.min(count - 1, Math.floor(shardIndex)));
  const selected = regions.filter((region) => stableShardHash(region.id || region.name) % count === index);
  return selected.length > 0 ? selected : regions;
}

// Phase 6i: Region firehose 모드 sentinel.
//   ?in=구-id 만으로 fetch (키워드/카테고리 filter X) → 지역 최신 매물 통째 ingest.
//   keyword combo 의 99% 흘림 문제 해결 — 자릿수 다른 ingest 양.
const DAANGN_FIREHOSE_QUERY: DaangnQuerySeed = {
  label: "firehose",
  search: "",
  categoryIds: [],
};
const DAANGN_FIREHOSE_CATEGORY: DaangnCategorySeed = {
  id: 0,  // sentinel — buildDaangnSearchUrl 가 0 / empty 시 category_id param 생략
  name: "전체",
};

// Phase 6i: 지역 피드 firehose combo 생성기.
//   - input.maxRegions 만큼 region 선택 (shuffle 시 매 tick 다른 region)
//   - 각 region 당 1 combo (no keyword × no category filter)
//   - selectDaangnCombos 의 keyword × cat × region 매트릭스 우회
export function selectDaangnFirehoseCombos(input: {
  regions: DaangnRegionSeed[];
  maxRegions: number;
  shuffleRegions?: boolean;
  regionScores?: Map<string, number>;
  explorationRatio?: number;
}): DaangnComboSelection {
  const shuffleRegions = input.shuffleRegions ?? false;
  const maxRegions = Math.max(0, input.maxRegions);
  let selectionMode: DaangnComboSelection["selectionMode"] = "random";
  let order: DaangnRegionSeed[];
  if (maxRegions >= input.regions.length) {
    order = shuffleRegions ? shuffleArray(input.regions) : input.regions;
    selectionMode = "all_regions";
  } else if (input.regionScores && input.regionScores.size > 0) {
    const explorationRatio = Math.max(0, Math.min(0.5, input.explorationRatio ?? 0.2));
    const exploreCount = Math.min(maxRegions, Math.max(1, Math.floor(maxRegions * explorationRatio)));
    const exploitCount = Math.max(0, maxRegions - exploreCount);
    const shuffled = shuffleRegions ? shuffleArray(input.regions) : [...input.regions];
    const scored = [...shuffled].sort((a, b) => (input.regionScores?.get(b.id) ?? 0) - (input.regionScores?.get(a.id) ?? 0));
    const exploit = scored.slice(0, exploitCount);
    const exploitIds = new Set(exploit.map((region) => region.id));
    const explore = shuffled.filter((region) => !exploitIds.has(region.id)).slice(0, exploreCount);
    order = [...exploit, ...explore];
    selectionMode = "adaptive";
  } else {
    order = shuffleRegions ? shuffleArray(input.regions) : input.regions;
  }
  const limit = Math.min(maxRegions, order.length);
  const combos: DaangnIngestCombo[] = [];
  for (let i = 0; i < limit; i += 1) {
    combos.push({
      region: order[i],
      query: DAANGN_FIREHOSE_QUERY,
      category: DAANGN_FIREHOSE_CATEGORY,
    });
  }
  return { combos, totalSpace: input.regions.length, selectionMode };
}

export function selectDaangnCategoryBoostCombos(input: {
  regions: DaangnRegionSeed[];
  categories: DaangnCategorySeed[];
  maxRegions: number;
  shuffleRegions?: boolean;
  regionScores?: Map<string, number>;
  pairScores?: Map<string, number>;
  explorationRatio?: number;
}): DaangnComboSelection {
  const maxRegions = Math.max(0, input.maxRegions);
  const shuffled = input.shuffleRegions ? shuffleArray(input.regions) : [...input.regions];
  const order = input.regionScores && input.regionScores.size > 0
    ? shuffled.sort((a, b) => (input.regionScores?.get(b.id) ?? 0) - (input.regionScores?.get(a.id) ?? 0))
    : shuffled;
  const maxCombos = Math.min(input.regions.length * input.categories.length, maxRegions * input.categories.length);
  const combos: DaangnIngestCombo[] = [];

  if (input.pairScores && input.pairScores.size > 0 && maxCombos > 0) {
    const allPairs = shuffled.flatMap((region) =>
      input.categories.map((category) => ({
        region,
        category,
        key: daangnRegionCategoryScoreKey(region.id, String(category.id)),
        score: input.pairScores?.get(daangnRegionCategoryScoreKey(region.id, String(category.id))) ?? 0,
      }))
    );
    const explorationRatio = Math.max(0, Math.min(0.5, input.explorationRatio ?? 0.2));
    const exploreCount = Math.min(maxCombos, Math.floor(maxCombos * explorationRatio));
    const exploitCount = Math.max(0, maxCombos - exploreCount);
    const exploit = [...allPairs]
      .sort((a, b) => b.score - a.score)
      .filter((pair) => pair.score > 0)
      .slice(0, exploitCount);
    const exploitKeys = new Set(exploit.map((pair) => pair.key));
    const explore = allPairs
      .filter((pair) => !exploitKeys.has(pair.key))
      .slice(0, maxCombos - exploit.length);
    for (const pair of [...exploit, ...explore]) {
      combos.push({
        region: pair.region,
        query: DAANGN_FIREHOSE_QUERY,
        category: pair.category,
      });
    }
    return {
      combos,
      totalSpace: input.regions.length * input.categories.length,
      selectionMode: "adaptive",
    };
  }

  const limit = Math.min(maxRegions, order.length);
  for (let i = 0; i < limit; i += 1) {
    for (const category of input.categories) {
      combos.push({
        region: order[i],
        query: DAANGN_FIREHOSE_QUERY,
        category,
      });
    }
  }
  return {
    combos,
    totalSpace: input.regions.length * input.categories.length,
    selectionMode: input.regionScores && input.regionScores.size > 0 ? "adaptive" : "random",
  };
}

function daangnArticleRegionKey(article: DaangnSearchArticle): { id: string; name: string } {
  return {
    id: article.region.dbId ?? "unknown",
    name: article.region.name ?? article.region.dbId ?? "unknown",
  };
}

function daangnArticleCategoryKey(article: DaangnSearchArticle): { id: string; name: string } {
  return {
    id: article.category?.dbId ?? "unknown",
    name: article.category?.name ?? article.category?.dbId ?? "unknown",
  };
}

function daangnRegionCategoryScoreKey(regionId: string, categoryId: string): string {
  return `${regionId}:${categoryId}`;
}

function countDaangnArticlesBySourceRegion(
  articles: DaangnSearchArticle[],
  sourceRegionByHref: Map<string, DaangnRegionSeed>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const article of articles) {
    const sourceRegion = article.href ? sourceRegionByHref.get(article.href) : null;
    const id = sourceRegion?.id ?? daangnArticleRegionKey(article).id;
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

function countDaangnArticlesBySourceRegionCategory(
  articles: DaangnSearchArticle[],
  sourceRegionByHref: Map<string, DaangnRegionSeed>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const article of articles) {
    const sourceRegion = article.href ? sourceRegionByHref.get(article.href) : null;
    const regionId = sourceRegion?.id ?? daangnArticleRegionKey(article).id;
    const categoryId = daangnArticleCategoryKey(article).id;
    if (!DAANGN_TARGET_CATEGORY_IDS.has(categoryId)) continue;
    const key = daangnRegionCategoryScoreKey(regionId, categoryId);
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

function buildDaangnRegionYieldStats(input: {
  selectedRegions: DaangnRegionSeed[];
  sourceRegionByHref: Map<string, DaangnRegionSeed>;
  allArticles: DaangnSearchArticle[];
  filteredArticles: DaangnSearchArticle[];
  catalogHintArticles: DaangnSearchArticle[];
  upsertCandidateArticles: DaangnSearchArticle[];
}): NonNullable<DaangnIngestResult["regionYieldStats"]> {
  const selectedNames = new Map(input.selectedRegions.map((region) => [region.id, region.name]));
  const names = new Map(selectedNames);
  for (const article of input.allArticles) {
    const { id, name } = daangnArticleRegionKey(article);
    if (!names.has(id)) names.set(id, name);
  }
  const fetched = countDaangnArticlesBySourceRegion(input.allArticles, input.sourceRegionByHref);
  const targetCategory = countDaangnArticlesBySourceRegion(input.filteredArticles, input.sourceRegionByHref);
  const catalogHint = countDaangnArticlesBySourceRegion(input.catalogHintArticles, input.sourceRegionByHref);
  const upsertCandidate = countDaangnArticlesBySourceRegion(input.upsertCandidateArticles, input.sourceRegionByHref);
  const ids = new Set<string>([
    ...selectedNames.keys(),
    ...fetched.keys(),
    ...targetCategory.keys(),
    ...catalogHint.keys(),
    ...upsertCandidate.keys(),
  ]);
  const regions = [...ids].map((id) => ({
    regionId: id,
    regionName: names.get(id) ?? id,
    fetched: fetched.get(id) ?? 0,
    targetCategory: targetCategory.get(id) ?? 0,
    catalogHint: catalogHint.get(id) ?? 0,
    upsertCandidate: upsertCandidate.get(id) ?? 0,
  })).sort((a, b) => (
    b.catalogHint - a.catalogHint ||
    b.targetCategory - a.targetCategory ||
    b.fetched - a.fetched ||
    a.regionName.localeCompare(b.regionName, "ko")
  ));
  return {
    regions,
    topCatalogHint: regions.slice(0, 20),
    zeroCatalogHintRegions: regions.filter((region) => region.catalogHint === 0).length,
  };
}

function buildDaangnCategoryYieldStats(input: {
  sourceRegionByHref: Map<string, DaangnRegionSeed>;
  allArticles: DaangnSearchArticle[];
  filteredArticles: DaangnSearchArticle[];
  catalogHintArticles: DaangnSearchArticle[];
  upsertCandidateArticles: DaangnSearchArticle[];
}): NonNullable<DaangnIngestResult["categoryYieldStats"]> {
  const regionNames = new Map<string, string>();
  const categoryNames = new Map<string, string>();
  for (const article of input.allArticles) {
    const sourceRegion = article.href ? input.sourceRegionByHref.get(article.href) : null;
    const region = sourceRegion ?? daangnArticleRegionKey(article);
    regionNames.set(region.id, region.name);
    const category = daangnArticleCategoryKey(article);
    categoryNames.set(category.id, category.name);
  }
  for (const category of DAANGN_TARGET_CATEGORY_SEEDS) {
    categoryNames.set(String(category.id), category.name);
  }

  const fetched = countDaangnArticlesBySourceRegionCategory(input.allArticles, input.sourceRegionByHref);
  const targetCategory = countDaangnArticlesBySourceRegionCategory(input.filteredArticles, input.sourceRegionByHref);
  const catalogHint = countDaangnArticlesBySourceRegionCategory(input.catalogHintArticles, input.sourceRegionByHref);
  const upsertCandidate = countDaangnArticlesBySourceRegionCategory(input.upsertCandidateArticles, input.sourceRegionByHref);
  const keys = new Set<string>([
    ...fetched.keys(),
    ...targetCategory.keys(),
    ...catalogHint.keys(),
    ...upsertCandidate.keys(),
  ]);
  const pairs = [...keys].map((key) => {
    const [sourceRegionId = "unknown", categoryId = "unknown"] = key.split(":");
    return {
      sourceRegionId,
      sourceRegionName: regionNames.get(sourceRegionId) ?? sourceRegionId,
      categoryId,
      categoryName: categoryNames.get(categoryId) ?? categoryId,
      fetched: fetched.get(key) ?? 0,
      targetCategory: targetCategory.get(key) ?? 0,
      catalogHint: catalogHint.get(key) ?? 0,
      upsertCandidate: upsertCandidate.get(key) ?? 0,
    };
  }).sort((a, b) => (
    b.catalogHint - a.catalogHint ||
    b.upsertCandidate - a.upsertCandidate ||
    b.targetCategory - a.targetCategory ||
    b.fetched - a.fetched ||
    a.sourceRegionName.localeCompare(b.sourceRegionName, "ko")
  ));
  return {
    pairs: pairs.slice(0, 120),
    topCatalogHint: pairs.slice(0, 40),
  };
}

type CollectRunRegionStatsRow = {
  stage_stats: {
    regionYieldStats?: {
      regions?: DaangnRegionYieldStat[];
    };
    categoryYieldStats?: {
      pairs?: DaangnCategoryYieldStat[];
    };
  } | null;
};

const DAANGN_INGEST_CRON_PATHS = [
  "/api/cron/daangn-worker",
  "/api/cron/daangn-worker-b",
  "/api/cron/daangn-worker-c",
] as const;

async function loadRecentDaangnCollectRuns(): Promise<CollectRunRegionStatsRow[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    return [];
  }
  const rows = await Promise.all(DAANGN_INGEST_CRON_PATHS.map(async (path) => {
    try {
      const res = await restFetch(
        `${tableUrl("mvp_collect_runs")}?select=stage_stats&status=eq.succeeded&request_path=eq.${encodeURIComponent(path)}&order=started_at.desc&limit=12`,
        { headers: serviceHeaders() },
      );
      return (await res.json()) as CollectRunRegionStatsRow[];
    } catch {
      return [];
    }
  }));
  return rows.flat();
}

async function loadRecentDaangnRegionScores(): Promise<Map<string, number>> {
  const rows = await loadRecentDaangnCollectRuns();
  const scores = new Map<string, number>();
  rows.forEach((row, index) => {
    const regions = row.stage_stats?.regionYieldStats?.regions;
    if (!Array.isArray(regions)) return;
    const recencyWeight = Math.max(0.25, 1 - index * 0.04);
    for (const stat of regions) {
      if (!stat.regionId) continue;
      const score =
        stat.catalogHint * 10 +
        stat.upsertCandidate * 20 +
        stat.targetCategory * 0.15 +
        stat.fetched * 0.01;
      scores.set(stat.regionId, (scores.get(stat.regionId) ?? 0) + score * recencyWeight);
    }
  });
  return scores;
}

async function loadRecentDaangnRegionCategoryScores(): Promise<Map<string, number>> {
  const rows = await loadRecentDaangnCollectRuns();
  const scores = new Map<string, number>();
  rows.forEach((row, index) => {
    const pairs = row.stage_stats?.categoryYieldStats?.pairs;
    if (!Array.isArray(pairs)) return;
    const recencyWeight = Math.max(0.25, 1 - index * 0.04);
    for (const stat of pairs) {
      if (!stat.sourceRegionId || !stat.categoryId) continue;
      const key = daangnRegionCategoryScoreKey(stat.sourceRegionId, stat.categoryId);
      const score =
        stat.catalogHint * 20 +
        stat.upsertCandidate * 40 +
        stat.targetCategory * 0.1 +
        stat.fetched * 0.02;
      scores.set(key, (scores.get(key) ?? 0) + score * recencyWeight);
    }
  });
  return scores;
}

// ───────────────────────────────────────────────────────────────────────────
// Main ingest
// ───────────────────────────────────────────────────────────────────────────

export async function runDaangnIngest(options: DaangnIngestOptions = {}): Promise<DaangnIngestResult> {
  const startedAt = new Date();
  const mode = getDaangnSourceMode();

  if (mode === "off") {
    return buildEmptyResult(mode, "mode_off", startedAt);
  }

  // Phase 6f: env 의존 제거 — 코드 default 가 항상 우선.
  //   사용자가 Vercel env 매번 변경하는 부담 제거.
  //   options 으로만 override 가능 (test/특수 케이스).
  // Phase 6i+ budget fix v2: 10 region 도 80s timeout (Vercel rate-limit slowdown 의심).
  //   3 region 으로 안전 마진 — 19:35/19:40/19:45/19:50 cron 다 timeout 났음.
  //   24h 누적: 3 × 288 tick = 864 region-hit / day → 111 region pool 8 cycle / day.
  //   대형 batch upsert path 최적화 후 다시 증가 (별도 wave).
  // Phase 6i+ budget fix v5: maxDuration 80→300s 박았으니 다시 증가.
  //   1 region 247 매물 = 73s. 5 region = ~250s 예상 (5x).
  //   24h × 5 region/tick × 288 tick = 1440 region-hits → 111 구 풀 13 cycle / day.
  //   detail 도 다시 활성화 (5 sample × 5s = 25s, budget 안에 들어옴).
  // Wave 777 (2026-05-27 사용자 결정): 5 → 267 (전국 region 다 ingest).
  //   사용자 의도: "옛날로 돌려라. 번개장터 급 유입. firehose + 모든 지역. 미스매칭 상관없음."
  //   안전 검증 (Wave 776): region 267 병렬 fetch 5초 안 끝남, lambda 300s 한도 안. Wave 776 의 revert 사유는
  //   raw filter 로직 실패였음 — region 늘림 자체는 검증됨.
  //   효과: 신선도 4.4h → 5분 (53배), 매물 유입 53배.
  //   trade-off: 당근 rate limit 위험 약간 ↑ (Wave 776 검증 통과). Vercel 비용 fetch 시간 그대로 (병렬).
  //   복원 가이드: 위험 신호 (429/403) 시 env DAANGN_INGEST_MAX_COMBOS=5 박으면 즉시 fallback.
  const maxCombos = boundedInt(options.maxCombos, 267, 1, 300);
  const maxDetailSamples = boundedInt(options.maxDetailSamples, 5, 0, 100);
  const delayMs = boundedInt(options.delayMs, 400, 200, 5000);
  const activeWindowHours = boundedInt(options.activeWindowHours, 72, 1, 720);
  const freshWindowHours = boundedInt(options.freshWindowHours, 24, 1, 168);
  const timeoutMs = boundedInt(options.timeoutMs, 5_000, 1_000, 30_000);
  const maxUpsertArticles = boundedInt(options.maxUpsertArticles, 500, 0, 5_000);
  // Wave 907: +120 fetch/run default. 267 full-region firehose is safe; full category
  // matrix (267 * 8) crossed previous block-risk boundaries, so only boost top pairs.
  const categoryBoostRegions = boundedInt(options.categoryBoostRegions, 15, 0, 30);
  const categoryTargetOnly = options.categoryTargetOnly ?? false;
  const categoryTargetRegions = boundedInt(options.categoryTargetRegions, 24, 1, 80);
  const searchConcurrency = boundedInt(options.searchConcurrency, 50, 1, 300);
  const dryRun = options.dryRun ?? mode !== "active";
  const useAdaptiveRegionRotation = options.useAdaptiveRegionRotation ?? true;
  const regionShardCount = boundedInt(options.regionShardCount, 1, 1, 20);
  const regionShardIndex = boundedInt(options.regionShardIndex, 0, 0, Math.max(0, regionShardCount - 1));

  // Phase 6i+++ timing instrumentation
  const timings: NonNullable<DaangnIngestResult["timingsMs"]> = {};
  const tIngestStart = Date.now();

  // Region 기반 ingest (Phase 6g — 6e 전국 검색 가설 폐기).
  // Wave 914 (2026-05-29): Daangn gu/city ids resolve to one representative dong
  // (e.g. 동작구→사당동, 강남구→역삼동). Runtime ingest must use leaf dong/eup/myeon
  // region ids discovered from Daangn's own region links, while DEFAULT_DAANGN_REGION_SEEDS
  // stays available for home-region fallback and operator context.
  //   options.regions 으로 override 가능 (테스트/실험용).
  const allRegions = options.regions ?? DAANGN_SEARCH_REGION_SEEDS;
  const regions = selectDaangnRegionShard(allRegions, regionShardCount, regionShardIndex);

  // Phase 6i: Region firehose 모드 default ON.
  //   배경: keyword × region combo 가 99% 매물 흘림 (지역 firehose 가 진짜 프리미티브).
  //   `?in=구-id` 단독 fetch → 지역 최신 매물 50+개 통째 ingest → 자릿수 다른 throughput.
  //   options.useRegionFirehose=false 로 keyword 모드 fallback 가능 (실험/테스트).
  const useRegionFirehose = options.useRegionFirehose ?? true;

  let combos: DaangnIngestCombo[];
  let regionSelectionMode: DaangnComboSelection["selectionMode"] | undefined;
  let adaptiveRegionScoreRegions = 0;
  let categoryBoostCombos = 0;
  let categoryBoostAdaptivePairs = 0;
  if (categoryTargetOnly) {
    // Wave 911: C worker category-target mode.
    // Broad firehose 를 끄고, 당근 target category URL만 훑는다. A/B가 넓은
    // 발견을 맡고 C는 request 대비 catalog-hint/ready 전환율을 측정한다.
    let regionScores: Map<string, number> | undefined;
    let regionCategoryScores: Map<string, number> | undefined;
    if (useAdaptiveRegionRotation) {
      const tAdaptiveRegionLoadStart = Date.now();
      try {
        const [loadedRegionScores, loadedRegionCategoryScores] = await Promise.all([
          loadRecentDaangnRegionScores(),
          loadRecentDaangnRegionCategoryScores(),
        ]);
        regionScores = loadedRegionScores;
        regionCategoryScores = loadedRegionCategoryScores;
        adaptiveRegionScoreRegions = regionScores.size;
        categoryBoostAdaptivePairs = regionCategoryScores.size;
      } catch (err) {
        console.warn("loadRecentDaangn category scores failed (non-fatal)", err);
        regionScores = undefined;
        regionCategoryScores = undefined;
      }
      timings.adaptiveRegionLoad = Date.now() - tAdaptiveRegionLoadStart;
    }
    const categories = options.categories ?? DAANGN_TARGET_CATEGORY_SEEDS;
    const result = selectDaangnCategoryBoostCombos({
      regions,
      categories,
      maxRegions: categoryTargetRegions,
      shuffleRegions: true,
      regionScores,
      pairScores: regionCategoryScores,
    });
    combos = result.combos.slice(0, maxCombos);
    regionSelectionMode = result.selectionMode;
    categoryBoostCombos = combos.length;
  } else if (useRegionFirehose) {
    // Firehose 모드: keyword/category filter X, region 만 iteration.
    //   maxCombos = 한 tick 에서 fetch 할 region 수.
    let regionScores: Map<string, number> | undefined;
    let regionCategoryScores: Map<string, number> | undefined;
    if (useAdaptiveRegionRotation && (maxCombos < regions.length || categoryBoostRegions > 0)) {
      const tAdaptiveRegionLoadStart = Date.now();
      try {
        const [loadedRegionScores, loadedRegionCategoryScores] = await Promise.all([
          loadRecentDaangnRegionScores(),
          categoryBoostRegions > 0 ? loadRecentDaangnRegionCategoryScores() : Promise.resolve(new Map<string, number>()),
        ]);
        regionScores = loadedRegionScores;
        regionCategoryScores = loadedRegionCategoryScores;
        adaptiveRegionScoreRegions = regionScores.size;
        categoryBoostAdaptivePairs = regionCategoryScores.size;
      } catch (err) {
        console.warn("loadRecentDaangnRegionScores failed (non-fatal)", err);
        regionScores = undefined;
        regionCategoryScores = undefined;
      }
      timings.adaptiveRegionLoad = Date.now() - tAdaptiveRegionLoadStart;
    }
    const result = selectDaangnFirehoseCombos({
      regions,
      maxRegions: maxCombos,
      shuffleRegions: true,
      regionScores,
    });
    combos = result.combos;
    regionSelectionMode = result.selectionMode;
    if (categoryBoostRegions > 0) {
      const boost = selectDaangnCategoryBoostCombos({
        regions,
        categories: DAANGN_TARGET_CATEGORY_SEEDS,
        maxRegions: categoryBoostRegions,
        shuffleRegions: true,
        regionScores,
        pairScores: regionCategoryScores,
      });
      categoryBoostCombos = boost.combos.length;
      combos = [...combos, ...boost.combos];
      if (regionSelectionMode === "all_regions" && boost.selectionMode === "adaptive") {
        regionSelectionMode = "all_regions";
      }
    }
  } else {
    // Legacy keyword 모드: catalog query × region × category combo (Phase 6g 동작).
    let queries = options.queries;
    if (!queries || queries.length === 0) {
      try {
        const built = buildDaangnQueryPool({ maxQueries: 50, includeBroad: true });
        queries = built.length > 0 ? built : DEFAULT_DAANGN_FASHION_QUERY_SEEDS;
      } catch (err) {
        console.warn("buildDaangnQueryPool failed (non-fatal)", err);
        queries = DEFAULT_DAANGN_FASHION_QUERY_SEEDS;
      }
    }
    const categories = options.categories ?? DAANGN_FASHION_CATEGORIES;
    const result = selectDaangnCombos({ regions, queries, categories, maxCombos, shuffleRegions: true });
    combos = result.combos;
    regionSelectionMode = result.selectionMode;
  }

  // 진행 통계
  let executedCombos = 0;
  let blockedCombos = 0;
  let failedCombos = 0;
  const blockedSignals: DaangnBlockSignal[] = [];

  const allArticles: DaangnSearchArticle[] = [];
  const ongoingSeenUrls = new Set<string>();
  const sourceRegionByHref = new Map<string, DaangnRegionSeed>();

  // Phase 6i++ parallel search: sequential 5 region × ~50s = 250s. 제한된 동시성으로 burst block 위험 완화.
  //   delayMs 는 sequential 시 rate-limit 회피용이라 parallel 에서는 의미 X.
  //   block signal 감지 시 후속 결과 모두 무시 (race condition X — 결과 받은 후 평가).
  const tSearchFetchStart = Date.now();
  const comboResults = await mapWithConcurrency(combos, searchConcurrency, async (combo) => {
    const url = buildDaangnSearchUrl({
      regionId: combo.region.id || undefined,
      categoryId: combo.category.id,
      search: combo.query.search,
    });
    try {
      const resp = await fetchDaangnText(url, timeoutMs);
      return { combo, resp, error: null as Error | null };
    } catch (err) {
      return { combo, resp: null, error: err as Error };
    }
  });
  timings.searchFetch = Date.now() - tSearchFetchStart;

  // 결과 평가 — block 감지 시 후속 결과는 모두 무시 (안전).
  const tSearchParseStart = Date.now();
  let blockedDetected = false;
  for (const { combo, resp, error } of comboResults) {
    if (blockedDetected) break;
    if (error || !resp) {
      failedCombos += 1;
      continue;
    }
    if (resp.blockSignal.blocked) {
      blockedCombos += 1;
      blockedSignals.push(resp.blockSignal);
      blockedDetected = true;
      break;
    }
    if (!resp.ok) {
      failedCombos += 1;
      continue;
    }
    try {
      const parsed = parseDaangnSearchHtml(resp.body);
      for (const a of parsed.articles) {
        allArticles.push(a);
        if (a.href && !sourceRegionByHref.has(a.href)) sourceRegionByHref.set(a.href, combo.region);
        if (a.status === "Ongoing" && a.href) ongoingSeenUrls.add(a.href);
      }
      executedCombos += 1;
    } catch {
      failedCombos += 1;
    }
  }
  timings.searchParse = Date.now() - tSearchParseStart;

  // Category-depth boost intentionally overlaps with the broad region firehose.
  // Dedupe immediately so duplicate hrefs do not consume detail/preselect windows.
  const uniqueArticleByHref = new Map<string, DaangnSearchArticle>();
  const hreflessArticles: DaangnSearchArticle[] = [];
  for (const article of allArticles) {
    if (!article.href) {
      hreflessArticles.push(article);
      continue;
    }
    if (!uniqueArticleByHref.has(article.href)) uniqueArticleByHref.set(article.href, article);
  }
  const searchArticles = [...uniqueArticleByHref.values(), ...hreflessArticles];
  const duplicateArticlesDropped = Math.max(0, allArticles.length - searchArticles.length);

  // Summarize
  const tSummarizeStart = Date.now();
  const summary = summarizeDaangnArticles(searchArticles, {
    freshWindowHours,
    activeWindowHours,
    staleBoostedDays: 14,
  });
  timings.summarize = Date.now() - tSummarizeStart;
  const nowMs = Date.now();

  // Phase 6i+: Detail fetch 선별 priority — [sku_id 매칭 우선, then 신선도]
  //   배경: firehose 8K 매물 중 ~99% noise (catalog SKU 외). FIFO 신선도-only 정렬 시
  //         freshest 15 = 거의 noise → detail 낭비.
  //   대응: top 200 freshest 만 pre-classify (200ms cost), sku 매칭된 매물 우선
  //         enrich → shipping_possible/direct_only 정확도 ↑ → pool entry 정확도 ↑.
  // Phase 6i+++ rollback: pre-classify 200 articles 가 32s 소모 (production 측정).
  //   buildRawListingRow 가 어차피 매물별 classify 함 (중복) — 여기 30s 낭비.
  //   단순 freshness-only sort 로 복귀.
  const tDetailClassifyStart = Date.now();
  const detailCandidates = searchArticles
    .filter((a) => shouldFetchDaangnDetailCandidate(a, { activeWindowHours, nowMs }))
    .map((a) => ({ article: a, hours: ageHours(a.boostedAt ?? a.createdAt, nowMs) }))
    .sort((a, b) => (a.hours ?? Infinity) - (b.hours ?? Infinity))
    .slice(0, maxDetailSamples);
  timings.detailClassify = Date.now() - tDetailClassifyStart;

  let detailFetched = 0;
  let detailParsed = 0;
  let detailFailed = 0;
  const shipping = { shipping_possible: 0, direct_only: 0, unknown: 0 };
  const detailRecords: DaangnIngestDetailRecord[] = [];

  const tDetailFetchStart = Date.now();
  for (const cand of detailCandidates) {
    const url = cand.article.href.startsWith("http") ? cand.article.href : `https://www.daangn.com${cand.article.href}`;
    let resp;
    try {
      resp = await fetchDaangnText(url, timeoutMs);
      detailFetched += 1;
    } catch {
      detailFailed += 1;
      if (delayMs > 0) await sleep(delayMs);
      continue;
    }

    if (resp.blockSignal.blocked) {
      blockedSignals.push(resp.blockSignal);
      break;
    }

    if (!resp.ok) {
      detailFailed += 1;
      if (delayMs > 0) await sleep(delayMs);
      continue;
    }

    const parsed = parseDaangnDetailHtml(resp.body);
    if (!parsed) {
      detailFailed += 1;
      if (delayMs > 0) await sleep(delayMs);
      continue;
    }
    detailParsed += 1;

    const ship = inferDaangnShipping(parsed);
    shipping[ship] += 1;
    detailRecords.push({
      article: parsed,
      combo: combos[0], // best-effort — TODO: combo trace 유지
      shipping: ship,
    });

    if (delayMs > 0) await sleep(delayMs);
  }
  timings.detailFetch = Date.now() - tDetailFetchStart;

  // Source health 평가
  const tHealthStart = Date.now();
  let sourceHealthStatus: DaangnIngestResult["sourceHealthStatus"] = "healthy";
  let sourceHealthReason = "ok";
  if (blockedSignals.length > 0) {
    sourceHealthStatus = "unhealthy";
    sourceHealthReason = `blocked:${blockedSignals[0].reason ?? "unknown"}`;
  } else if (failedCombos / Math.max(1, combos.length) > 0.5) {
    sourceHealthStatus = "degraded";
    sourceHealthReason = `failed_rate_${Math.round((failedCombos / combos.length) * 100)}pct`;
  }
  timings.healthCheck = Date.now() - tHealthStart;

  // DB write (Stage 1 = Shadow Mode — raw_listings 까지만, pool_eligible=false hard-coded)
  const tRawUpsertStart = Date.now();
  let rawUpserted = 0;
  let rawSkippedExisting = 0;

  // Wave 778 (2026-05-27 사용자 결정): DB 저장 전 카테고리 filter — 우리 catalog 매핑 8개만 keep.
  //   배경: firehose mode 라 한 region 검색 = 모든 카테고리 매물 섞임 (94% 잡화 — 책/가구/식품/유아/도서).
  //   사용자: "DB 저장 전에 거를 수 있는데 왜 가지고 있는거임? catalog SKU 없으면 진짜 무관."
  //   당근 카테고리 ID → 우리 ready SKU 카테고리 매핑:
  //     1   디지털기기      → smartphone/tablet/earphone/laptop/smartwatch/desktop/speaker/camera/drone/monitor
  //     2   취미/게임/음반  → game_console/lego
  //     3   스포츠/레저     → sport_golf/shoe/bike
  //     5   여성의류        → clothing
  //     6   뷰티/미용       → perfume
  //     14  남성패션/잡화   → clothing/shoe/bag
  //     31  여성잡화        → bag
  //     172 생활가전        → home_appliance
  //   효과: DB 부담 ~16GB/월 → ~3.2GB/월 (80% drop). API limit 무관 (fetch 동일).
  //   안전: drop = 진짜 catalog 외 매물 (책/가구/식품 등). Wave 776 동일 logic 박았다가 즉흥 revert (commit log 빈).
  //   safety log: drop 비율 99% 초과 시 logic bug 의심 — console.warn.
  const tCategoryFilterStart = Date.now();
  let articlesMissingCategory = 0;
  const filteredArticles = searchArticles.filter((article) => {
    const catId = article.category?.dbId;
    if (catId == null) articlesMissingCategory += 1;
    return catId != null && DAANGN_TARGET_CATEGORY_IDS.has(String(catId));
  });
  const articlesDropped = searchArticles.length - filteredArticles.length;
  const categoryFilterDropRatio = searchArticles.length > 0 ? articlesDropped / searchArticles.length : 0;
  if (searchArticles.length > 0) {
    if (categoryFilterDropRatio >= 0.99) {
      console.warn(`[wave778] DROP RATIO ${(categoryFilterDropRatio * 100).toFixed(1)}% (${articlesDropped}/${searchArticles.length}) — logic bug 의심? category.dbId 측정 실패 가능성.`);
    } else if (articlesDropped > 0) {
      console.log(`[wave778] filter: ${articlesDropped}/${searchArticles.length} 매물 drop (${(categoryFilterDropRatio * 100).toFixed(1)}%, 비-target 카테고리)`);
    }
  }
  if (searchArticles.length > 0 && filteredArticles.length === 0) {
    sourceHealthStatus = "degraded";
    sourceHealthReason = `category_filter_zero_keep:missing_category_${articlesMissingCategory}`;
  }
  timings.categoryFilter = Date.now() - tCategoryFilterStart;

  // Wave 779 hotfix: firehose target categories are still huge (clothing/digital alone can be 20K+ per tick).
  // DB write 전 catalog search-query hint 로 한 번 더 좁힌다. 실제 SKU match 는 buildRawListingRow 에서
  // ruleMatch/parseListingOptions 로 다시 확정하므로, 이 단계는 expensive matcher 앞의 cheap sieve 역할이다.
  const tCatalogHintStart = Date.now();
  const catalogHintArticles = filteredArticles.filter(hasDaangnCatalogHint);
  const articlesDroppedByCatalogHint = filteredArticles.length - catalogHintArticles.length;
  if (filteredArticles.length > 0 && catalogHintArticles.length === 0) {
    sourceHealthStatus = "degraded";
    sourceHealthReason = `catalog_hint_zero_keep:category_kept_${filteredArticles.length}`;
  } else if (articlesDroppedByCatalogHint > 0) {
    console.log(`[wave779] catalog hint: ${articlesDroppedByCatalogHint}/${filteredArticles.length} target-category 매물 skip (${((articlesDroppedByCatalogHint / Math.max(1, filteredArticles.length)) * 100).toFixed(1)}%)`);
  }
  timings.catalogHint = Date.now() - tCatalogHintStart;
  const tUpsertPreselectStart = Date.now();
  const upsertPreflightLimit = daangnUpsertPreflightLimit(maxUpsertArticles, catalogHintArticles.length);
  const upsertCandidateArticles = [...catalogHintArticles]
    .sort((a, b) => articleFreshnessMs(b) - articleFreshnessMs(a))
    .slice(0, upsertPreflightLimit);
  const articlesDeferredByUpsertCap = Math.max(0, catalogHintArticles.length - upsertCandidateArticles.length);
  if (articlesDeferredByUpsertCap > 0) {
    console.log(`[wave891] upsert preflight window: ${articlesDeferredByUpsertCap}/${catalogHintArticles.length} catalog-hint 매물 defer (preflight=${upsertPreflightLimit}, writeCap=${maxUpsertArticles})`);
  }
  timings.upsertPreselect = Date.now() - tUpsertPreselectStart;
  const selectedRegions = [...new Map(combos.map((combo) => [combo.region.id, combo.region])).values()];
  const regionYieldStats = buildDaangnRegionYieldStats({
    selectedRegions,
    sourceRegionByHref,
    allArticles: searchArticles,
    filteredArticles,
    catalogHintArticles,
    upsertCandidateArticles,
  });
  const categoryYieldStats = buildDaangnCategoryYieldStats({
    sourceRegionByHref,
    allArticles: searchArticles,
    filteredArticles,
    catalogHintArticles,
    upsertCandidateArticles,
  });

  if (!dryRun) {
    try {
      const upsertResult = await upsertDaangnRawListings(upsertCandidateArticles, detailRecords, {
        maxClassifyRows: maxUpsertArticles,
      });
      rawUpserted = upsertResult.rawUpserted;
      rawSkippedExisting = upsertResult.rawSkippedExisting;
      timings.rawRpc = upsertResult.rawRpcMs;
      timings.parsedUpsert = upsertResult.parsedUpsertMs;
      timings.preflight = upsertResult.preflightMs;
      timings.preflightSkipped = upsertResult.preflightSkipped;
      timings.preflightOverflow = upsertResult.preflightOverflow;
      timings.preflightCandidates = upsertResult.preflightCandidates;
      timings.writeCandidates = upsertResult.writeCandidates;
      timings.classifyCandidates = upsertResult.classifyCandidates;
      timings.classifyCacheHits = upsertResult.classifyCacheHits;
      timings.preflightReusedClassified = upsertResult.preflightReusedClassified;
      timings.rowBuild = upsertResult.rowBuildMs;
    } catch (err) {
      sourceHealthStatus = "degraded";
      // 디버그 측면에서 충분히 보이도록 800자까지 보존
      sourceHealthReason = `db_write_error:${err instanceof Error ? err.message.slice(0, 800) : String(err).slice(0, 800)}`;
    }
  }
  timings.rawUpsert = Date.now() - tRawUpsertStart;
  timings.total = Date.now() - tIngestStart;

  const finishedAt = new Date();
  return {
    source: DAANGN_SOURCE_ID,
    mode,
    skipped: false,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),

    combos: combos.length,
    regionShardCount,
    regionShardIndex,
    regionShardRegions: regions.length,
    regionSelectionMode,
    adaptiveRegionScoreRegions,
    executedCombos,
    blockedCombos,
    failedCombos,

    articles: summary.total,
    duplicateArticlesDropped,
    filteredArticles: filteredArticles.length,
    articlesDroppedByCategory: articlesDropped,
    articlesMissingCategory,
    categoryFilterDropRatio,
    catalogHintArticles: catalogHintArticles.length,
    articlesDroppedByCatalogHint,
    maxUpsertArticles,
    upsertCandidateArticles: upsertCandidateArticles.length,
    articlesDeferredByUpsertCap,
    categoryBoostRegions,
    categoryBoostCombos,
    categoryBoostAdaptivePairs,
    categoryTargetOnly,
    categoryTargetRegions: categoryTargetOnly ? categoryTargetRegions : undefined,
    categoryTargetCategoryIds: categoryTargetOnly
      ? [...new Set(combos.map((combo) => String(combo.category.id)).filter((id) => id !== "0"))]
      : undefined,
    regionYieldStats,
    categoryYieldStats,
    ongoing: summary.ongoing,
    crawlAllowedOngoing: summary.crawlAllowedOngoing,
    freshBoosted24h: summary.freshBoosted24h,
    activeBoosted72h: summary.activeBoosted72h,
    uniqueOngoingUrls: ongoingSeenUrls.size,

    detailCandidates: detailCandidates.length,
    detailFetched,
    detailParsed,
    detailFailed,

    shipping,
    rawUpserted,
    rawSkippedExisting,
    searchConcurrency,

    blockedSignals,
    sourceHealthStatus,
    sourceHealthReason,
    timingsMs: timings,
  };
}
