import {
  CATALOG,
  normalize,
  type Sku,
} from "@/lib/catalog";
import {
  CATEGORY_READINESS,
  LANE_READINESS,
  evaluateCategoryReadiness,
  evaluateLaneReadinessForSku,
  loadCategoryReadinessMap,
  loadLaneReadinessMap,
  type CategoryReadinessMap,
  type LaneReadinessMap,
} from "@/lib/category-readiness";
import {
  DAANGN_BASE_URL,
  DAANGN_SOURCE_ID,
  DAANGN_SEARCH_REGION_SEEDS,
  DEFAULT_DAANGN_REGION_SEEDS,
  buildDaangnSearchUrl,
  daangnInternalPid,
  fetchDaangnText,
  getDaangnSourceMode,
  parseDaangnDetailHtml,
  parseDaangnExternalId,
  parseDaangnSearchHtml,
  type DaangnCategorySeed,
  type DaangnRegionSeed,
  type DaangnSearchArticle,
  type DaangnSourceMode,
} from "@/lib/daangn";
import {
  inferDaangnShipping,
  upsertDaangnRawListings,
  type DaangnIngestCombo,
  type DaangnIngestDetailRecord,
} from "@/lib/daangn-ingest";
import { classifyListing } from "@/lib/pipeline";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

type SampleCounts = {
  total: number;
  sold: number;
  active: number;
  disappeared: number;
};

type SweepTarget = {
  sku: Sku;
  current: SampleCounts;
  deficit: number;
  categoryIds: number[];
  queries: string[];
  needles: string[];
};

type SweepCombo = {
  mode: "keyword" | "category";
  region: DaangnRegionSeed;
  category: DaangnCategorySeed;
  search: string | null;
  targetSkuId?: string;
  url: string;
};

type MatchedArticle = {
  article: DaangnSearchArticle;
  combo: SweepCombo;
  sku: Sku;
};

type ParsedRow = {
  pid: number;
  comparable_key: string | null;
  parser_version: string | null;
};

export type DaangnPriceSweepOptions = {
  mode?: DaangnSourceMode;
  targetSamples?: number;
  maxSkus?: number;
  maxRegions?: number;
  maxSearchCombos?: number;
  maxCategoryCombos?: number;
  maxDetailFetches?: number;
  searchConcurrency?: number;
  detailConcurrency?: number;
  requestDelayMs?: number;
  abortOnBlockedCombo?: boolean;
  regionRotationOffset?: number;
  timeoutMs?: number;
  dryRun?: boolean;
  now?: Date;
};

export type DaangnPriceSweepResult = {
  source: typeof DAANGN_SOURCE_ID;
  mode: DaangnSourceMode;
  skipped: boolean;
  skipReason?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  dryRun: boolean;
  targetSamples: number;
  readySkus: number;
  deficitSkus: number;
  selectedSkus: number;
  regions: number;
  searchCombos: number;
  categoryCombos: number;
  executedCombos: number;
  fetchedArticles: number;
  duplicateArticlesDropped: number;
  matchedArticles: number;
  selectedArticles: number;
  detailFetched: number;
  detailParsed: number;
  detailFailed: number;
  rawUpserted: number;
  rawSkippedExisting: number;
  marketInvalidationsQueued: number;
  blockedCombos: number;
  failedCombos: number;
  closedMatched: number;
  activeMatched: number;
  timingsMs: Record<string, number>;
  sampleTargets: Array<{
    skuId: string;
    label: string;
    beforeTotal: number;
    beforeSold: number;
    deficit: number;
    selected: number;
  }>;
};

const DEFAULT_TARGET_SAMPLES = 10;
const DEFAULT_MAX_SKUS = 80;
const DEFAULT_MAX_REGIONS = 8;
const DEFAULT_MAX_SEARCH_COMBOS = 0;
const DEFAULT_MAX_CATEGORY_COMBOS = 8;
const DEFAULT_MAX_DETAIL_FETCHES = 100;
const DEFAULT_SEARCH_CONCURRENCY = 2;
const DEFAULT_DETAIL_CONCURRENCY = 2;
const DEFAULT_REQUEST_DELAY_MS = 250;
const DEFAULT_TIMEOUT_MS = 8_000;

const CATEGORY_IDS_BY_SKU_CATEGORY: Partial<Record<Sku["category"], number[]>> = {
  smartphone: [1],
  tablet: [1],
  earphone: [1],
  laptop: [1],
  smartwatch: [1],
  desktop: [1],
  speaker: [1],
  camera: [1],
  drone: [1, 3],
  monitor: [1],
  home_appliance: [172],
  small_appliance: [172],
  game_console: [2],
  lego: [2],
  sport_golf: [3],
  shoe: [3, 14, 31],
  bike: [3],
  kickboard: [3],
  clothing: [5, 14],
  perfume: [6],
  bag: [14, 31],
  watch: [14, 31],
};

const SKU_CATEGORIES_BY_DAANGN_CATEGORY_ID: Record<number, readonly Sku["category"][]> = {
  1: ["smartphone", "tablet", "earphone", "laptop", "smartwatch", "desktop", "speaker", "camera", "drone", "monitor"],
  172: ["home_appliance", "small_appliance"],
  2: ["game_console", "lego"],
  3: ["sport_golf", "shoe", "bike", "drone", "kickboard"],
  5: ["clothing"],
  6: ["perfume"],
  14: ["clothing", "shoe", "bag", "watch"],
  31: ["clothing", "shoe", "bag", "watch"],
};

const CATEGORY_NAMES_BY_ID: Record<number, string> = {
  1: "디지털기기",
  172: "생활가전",
  2: "취미/게임/음반",
  3: "스포츠/레저",
  5: "여성의류",
  6: "뷰티/미용",
  14: "남성패션/잡화",
  31: "여성잡화",
};

function toPositiveInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value as number)));
}

function sampleCounts(): SampleCounts {
  return { total: 0, sold: 0, active: 0, disappeared: 0 };
}

function isReadySku(sku: Sku, categoryMap: CategoryReadinessMap, laneMap: LaneReadinessMap): boolean {
  const lane = evaluateLaneReadinessForSku(sku, laneMap);
  if (lane) return lane.canEnterPool;
  return evaluateCategoryReadiness(sku.category, categoryMap).canEnterPool;
}

function isExplicitlyBlockedSku(sku: Sku, categoryMap: CategoryReadinessMap, laneMap: LaneReadinessMap): boolean {
  const lane = evaluateLaneReadinessForSku(sku, laneMap);
  if (lane) return !lane.canEnterPool;
  return !evaluateCategoryReadiness(sku.category, categoryMap).canEnterPool;
}

function categoryIdsForSku(sku: Sku): number[] {
  return CATEGORY_IDS_BY_SKU_CATEGORY[sku.category] ?? [];
}

function queryListForSku(sku: Sku): string[] {
  const source = sku.searchQueries !== undefined ? sku.searchQueries : [...sku.aliases, sku.modelName];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of source) {
    const query = String(raw ?? "").trim();
    if (query.length < 2) continue;
    const key = normalize(query);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(query);
    if (out.length >= 3) break;
  }
  return out;
}

function needleListForSku(sku: Sku, queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [sku.modelName, ...sku.aliases, ...queries]) {
    const normalized = normalize(String(raw ?? ""));
    const compact = normalized.replace(/\s+/g, "");
    for (const token of [normalized, compact]) {
      if (token.length < 3 || seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

async function loadDaangnSampleCounts(skuIds: string[]): Promise<Map<string, SampleCounts>> {
  const counts = new Map<string, SampleCounts>();
  for (const skuId of skuIds) counts.set(skuId, sampleCounts());
  const targetSet = new Set(skuIds);
  const pageSize = 500;
  const maxRows = toPositiveInt(Number(process.env.DAANGN_PRICE_SWEEP_SAMPLE_COUNT_SCAN_ROWS), 5_000, 1000, 100_000);
  let cursor: string | null = null;
  let scanned = 0;
  while (scanned < maxRows) {
    const url =
      `${tableUrl("mvp_raw_listings")}` +
      `?select=sku_id,listing_state,last_seen_at&source=eq.${DAANGN_SOURCE_ID}` +
      `&detail_status=eq.done&sku_id=not.is.null` +
      `&listing_state=in.(active,sold_confirmed,disappeared)` +
      `${cursor ? `&last_seen_at=lt.${encodeURIComponent(cursor)}` : ""}` +
      `&order=last_seen_at.desc&limit=${pageSize}`;
    let rows: Array<{ sku_id: string | null; listing_state: string | null; last_seen_at: string | null }>;
    try {
      const res = await restFetch(url, { headers: serviceHeaders() });
      rows = (await res.json()) as Array<{ sku_id: string | null; listing_state: string | null; last_seen_at: string | null }>;
    } catch (err) {
      console.warn("daangn price sweep sample count scan stopped early", {
        scanned,
        cursor,
        error: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
      });
      break;
    }
    for (const row of rows) {
      if (!row.sku_id || !targetSet.has(row.sku_id)) continue;
      const c = counts.get(row.sku_id) ?? sampleCounts();
      c.total += 1;
      if (row.listing_state === "sold_confirmed") c.sold += 1;
      else if (row.listing_state === "active") c.active += 1;
      else c.disappeared += 1;
      counts.set(row.sku_id, c);
    }
    scanned += rows.length;
    cursor = rows[rows.length - 1]?.last_seen_at ?? null;
    if (rows.length < pageSize) break;
    if (!cursor) break;
  }
  return counts;
}

async function loadRecentDaangnPoolPressureBySku(): Promise<Map<string, number>> {
  const pressure = new Map<string, number>();
  const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const reasons = [
    "daangn_volume_below_3",
    "sku_median_unavailable",
    "daangn_market_basis_missing",
    "blocked_market_stat_missing",
  ].join(",");
  try {
    const res = await restFetch(
      `${tableUrl("mvp_candidate_pool")}` +
      `?select=pid,invalidated_reason,raw:mvp_raw_listings!inner(sku_id,source)` +
      `&status=eq.invalidated` +
      `&invalidated_reason=in.(${reasons})` +
      `&updated_at=gte.${encodeURIComponent(sinceIso)}` +
      `&raw.source=eq.${DAANGN_SOURCE_ID}` +
      `&order=updated_at.desc&limit=1000`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as Array<{ raw?: { sku_id?: string | null } | null }>;
    for (const row of rows) {
      const skuId = row.raw?.sku_id?.trim();
      if (!skuId) continue;
      pressure.set(skuId, (pressure.get(skuId) ?? 0) + 1);
    }
  } catch (err) {
    console.warn("daangn price sweep pool pressure load failed (non-fatal)", {
      error: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
    });
  }
  return pressure;
}

function buildTargets(
  readySkus: Sku[],
  counts: Map<string, SampleCounts>,
  pressureBySku: Map<string, number>,
  targetSamples: number,
  maxSkus: number,
  rotationSeed: number,
): SweepTarget[] {
  const all = readySkus
    .map((sku): SweepTarget | null => {
      const current = counts.get(sku.id) ?? sampleCounts();
      const pressure = pressureBySku.get(sku.id) ?? 0;
      const categoryIds = categoryIdsForSku(sku);
      const queries = queryListForSku(sku);
      const needles = needleListForSku(sku, queries);
      if (categoryIds.length === 0) return null;
      const totalDeficit = Math.max(0, targetSamples - current.total);
      const activeGateDeficit = pressure > 0 ? Math.max(1, 3 - current.active) : 0;
      const deficit = Math.max(totalDeficit, activeGateDeficit);
      if (deficit <= 0) return null;
      return { sku, current, deficit, categoryIds, queries, needles };
    })
    .filter((target): target is SweepTarget => Boolean(target))
    .sort((a, b) => {
      const aPressure = pressureBySku.get(a.sku.id) ?? 0;
      const bPressure = pressureBySku.get(b.sku.id) ?? 0;
      const aNeedsTotal = a.current.total < targetSamples ? 1 : 0;
      const bNeedsTotal = b.current.total < targetSamples ? 1 : 0;
      if (aNeedsTotal !== bNeedsTotal) return bNeedsTotal - aNeedsTotal;
      if (aPressure !== bPressure) return bPressure - aPressure;
      // Fill SKUs with proven Daangn signal first. Pure zero-sample long-tail SKUs
      // can burn hundreds of keyword searches on rare English/collab names before
      // adding any useful market basis.
      const aHasSignal = a.current.total > 0 ? 1 : 0;
      const bHasSignal = b.current.total > 0 ? 1 : 0;
      if (aHasSignal !== bHasSignal) return bHasSignal - aHasSignal;
      // For a sample-filling sweep, proven Daangn SKUs should reach the target
      // first. Lowest-total sorting spent early requests on rare long-tail SKUs
      // and barely moved ready recovery.
      if (a.current.total !== b.current.total) return b.current.total - a.current.total;
      if (a.current.active !== b.current.active) return b.current.active - a.current.active;
      if (a.current.sold !== b.current.sold) return b.current.sold - a.current.sold;
      return b.deficit - a.deficit;
    });

  if (all.length <= maxSkus) return all;
  const priorityPrefix = all.filter((target) => (pressureBySku.get(target.sku.id) ?? 0) > 0);
  const remaining = all.slice(priorityPrefix.length);
  const remainingSlots = Math.max(0, maxSkus - priorityPrefix.length);
  if (remainingSlots <= 0) return priorityPrefix.slice(0, maxSkus);
  const offset = remaining.length > 0 ? rotationSeed % remaining.length : 0;
  return [
    ...priorityPrefix,
    ...remaining.slice(offset, offset + remainingSlots),
    ...remaining.slice(0, Math.max(0, remainingSlots - Math.max(0, remaining.length - offset))),
  ].slice(0, maxSkus);
}

function buildSweepCombos(
  targets: SweepTarget[],
  regions: DaangnRegionSeed[],
  maxSearchCombos: number,
  maxCategoryCombos: number,
): { searchCombos: SweepCombo[]; categoryCombos: SweepCombo[] } {
  const searchCombos: SweepCombo[] = [];
  const categoryCombos: SweepCombo[] = [];
  const searchSeen = new Set<string>();
  const categorySeen = new Set<string>();

  const searchRegions = regions.slice(0, Math.min(2, regions.length));
  for (let queryIndex = 0; queryIndex < 2 && searchCombos.length < maxSearchCombos; queryIndex += 1) {
    for (const target of targets) {
      if (searchCombos.length >= maxSearchCombos) break;
      const query = target.queries[queryIndex];
      if (!query) continue;
      const categoryId = target.categoryIds[0];
      for (const region of searchRegions) {
        if (searchCombos.length >= maxSearchCombos) break;
        const key = `${region.id}:${query}`;
        if (searchSeen.has(key)) continue;
        searchSeen.add(key);
        const category = { id: categoryId, name: CATEGORY_NAMES_BY_ID[categoryId] ?? String(categoryId) };
        searchCombos.push({
          mode: "keyword",
          region,
          category,
          search: query,
          targetSkuId: target.sku.id,
          // Keep category out of the URL. Search+region is the stable payload path;
          // category-only payloads can return empty loader data. Use category only
          // as a local classifier hint and avoid duplicate URL fetches.
          url: buildDaangnSearchUrl({ regionId: region.id, search: query }),
        });
      }
    }
  }

  for (const region of regions) {
    if (categoryCombos.length >= maxCategoryCombos) break;
    const key = `${region.id}:firehose`;
    if (categorySeen.has(key)) continue;
    categorySeen.add(key);
    categoryCombos.push({
      mode: "category",
      region,
      category: { id: 0, name: "전체" },
      search: null,
      // Daangn currently returns rows reliably for region-only firehose URLs.
      // `search=` or `category_id=` can produce empty loader payloads even with 200.
      url: buildDaangnSearchUrl({ regionId: region.id }),
    });
  }

  return { searchCombos, categoryCombos };
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) break;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

function sleep(ms: number): Promise<void> {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function articleUrl(article: DaangnSearchArticle): string {
  if (/^https?:\/\//i.test(article.href)) return article.href;
  return `${DAANGN_BASE_URL}${article.href}`;
}

function articleFreshnessMs(article: DaangnSearchArticle): number {
  const parsed = Date.parse(article.boostedAt ?? article.createdAt ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function acceptedStatus(status: string | null): boolean {
  return status === "Closed" || status === "Ongoing";
}

function scoreArticle(article: DaangnSearchArticle): number {
  const closedBonus = article.status === "Closed" ? 100_000_000 : 0;
  return articleFreshnessMs(article) + closedBonus;
}

async function fetchSearchCombos(
  combos: SweepCombo[],
  concurrency: number,
  timeoutMs: number,
  requestDelayMs: number,
  abortOnBlockedCombo: boolean,
): Promise<{
  articles: MatchedComboArticle[];
  blockedCombos: number;
  failedCombos: number;
}> {
  if (abortOnBlockedCombo) {
    const articles: MatchedComboArticle[] = [];
    let blockedCombos = 0;
    let failedCombos = 0;
    for (const combo of combos) {
      await sleep(requestDelayMs);
      try {
        const fetched = await fetchDaangnText(combo.url, timeoutMs);
        if (!fetched.ok) {
          if (fetched.blockSignal.blocked) {
            blockedCombos += 1;
            break;
          }
          failedCombos += 1;
          continue;
        }
        const parsed = parseDaangnSearchHtml(fetched.body);
        articles.push(...parsed.articles.map((article) => ({ article, combo })));
      } catch {
        failedCombos += 1;
      }
    }
    return { articles, blockedCombos, failedCombos };
  }

  const results = await mapLimit(combos, concurrency, async (combo) => {
    await sleep(requestDelayMs);
    try {
      const fetched = await fetchDaangnText(combo.url, timeoutMs);
      if (!fetched.ok) {
        return {
          combo,
          articles: [] as MatchedComboArticle[],
          blocked: fetched.blockSignal.blocked,
          failed: !fetched.blockSignal.blocked,
        };
      }
      const parsed = parseDaangnSearchHtml(fetched.body);
      return {
        combo,
        articles: parsed.articles.map((article) => ({ article, combo })),
        blocked: false,
        failed: false,
      };
    } catch {
      return { combo, articles: [] as MatchedComboArticle[], blocked: false, failed: true };
    }
  });
  return {
    articles: results.flatMap((result) => result.articles),
    blockedCombos: results.filter((result) => result.blocked).length,
    failedCombos: results.filter((result) => result.failed).length,
  };
}

type MatchedComboArticle = {
  article: DaangnSearchArticle;
  combo: SweepCombo;
};

function matchArticlesToTargets(
  comboArticles: MatchedComboArticle[],
  targetMap: Map<string, SweepTarget>,
): {
  matched: MatchedArticle[];
  duplicates: number;
  closedMatched: number;
  activeMatched: number;
} {
  const unique = new Map<string, MatchedComboArticle>();
  let duplicates = 0;
  for (const row of comboArticles) {
    const ext = parseDaangnExternalId(row.article.href);
    if (!ext) continue;
    if (unique.has(ext)) {
      duplicates += 1;
      continue;
    }
    unique.set(ext, row);
  }

  const rows = [...unique.values()].sort((a, b) => scoreArticle(b.article) - scoreArticle(a.article));
  const hintsByCategory = new Map<number, SweepTarget[]>();
  for (const target of targetMap.values()) {
    for (const categoryId of target.categoryIds) {
      const list = hintsByCategory.get(categoryId) ?? [];
      list.push(target);
      hintsByCategory.set(categoryId, list);
    }
  }
  const allTargets = [...targetMap.values()];
  const selectedPerSku = new Map<string, number>();
  const matched: MatchedArticle[] = [];
  let closedMatched = 0;
  let activeMatched = 0;

  for (const row of rows) {
    const article = row.article;
    if (!acceptedStatus(article.status)) continue;
    if (!Number.isFinite(article.price) || Number(article.price) <= 0) continue;
    const articleCategoryId = Number(article.category.dbId);
    const categoryId = Number.isFinite(articleCategoryId) && articleCategoryId > 0
      ? articleCategoryId
      : Number(row.combo.category.id);
    const normalizedText = normalize(`${article.title ?? ""}\n${article.content ?? ""}`);
    const compactText = normalizedText.replace(/\s+/g, "");
    const hintTargets = hintsByCategory.get(categoryId) ?? allTargets;
    const likelyTarget = hintTargets.some((target) =>
      target.needles.some((needle) => normalizedText.includes(needle) || compactText.includes(needle)),
    );
    if (!likelyTarget) continue;
    const categories = SKU_CATEGORIES_BY_DAANGN_CATEGORY_ID[categoryId] ?? [];
    const classified = classifyListing(article.title ?? "", article.content ?? "", Number(article.price), { categories });
    if (classified.listingType !== "normal" || !classified.sku) continue;
    const target = targetMap.get(classified.sku.id);
    if (!target) continue;
    const selected = selectedPerSku.get(target.sku.id) ?? 0;
    if (selected >= target.deficit) continue;
    selectedPerSku.set(target.sku.id, selected + 1);
    matched.push({ article, combo: row.combo, sku: target.sku });
    if (article.status === "Closed") closedMatched += 1;
    if (article.status === "Ongoing") activeMatched += 1;
  }

  return { matched, duplicates, closedMatched, activeMatched };
}

function comboForMatchedArticle(row: MatchedArticle): DaangnIngestCombo {
  const querySearch = row.combo.search ?? row.sku.modelName;
  return {
    region: row.combo.region,
    category: row.combo.category,
    query: {
      label: `price_sweep:${row.sku.id}`,
      search: querySearch,
      categoryIds: [row.combo.category.id],
    },
  };
}

async function fetchDetailsForMatches(
  matches: MatchedArticle[],
  concurrency: number,
  timeoutMs: number,
  requestDelayMs: number,
): Promise<{
  detailRecords: DaangnIngestDetailRecord[];
  detailFetched: number;
  detailParsed: number;
  detailFailed: number;
}> {
  const results = await mapLimit(matches, concurrency, async (row) => {
    await sleep(requestDelayMs);
    try {
      const fetched = await fetchDaangnText(articleUrl(row.article), timeoutMs);
      if (!fetched.ok) {
        return { ok: false as const };
      }
      const detail = parseDaangnDetailHtml(fetched.body);
      if (!detail) return { ok: false as const };
      const shipping = inferDaangnShipping(detail);
      const record: DaangnIngestDetailRecord = {
        article: detail,
        combo: comboForMatchedArticle(row),
        shipping,
      };
      return { ok: true as const, record };
    } catch {
      return { ok: false as const };
    }
  });
  const detailRecords = results
    .filter((result): result is { ok: true; record: DaangnIngestDetailRecord } => result.ok)
    .map((result) => result.record);
  return {
    detailRecords,
    detailFetched: matches.length,
    detailParsed: detailRecords.length,
    detailFailed: Math.max(0, matches.length - detailRecords.length),
  };
}

async function loadParsedRows(pids: number[]): Promise<ParsedRow[]> {
  if (pids.length === 0) return [];
  const out: ParsedRow[] = [];
  const chunkSize = 250;
  for (let i = 0; i < pids.length; i += chunkSize) {
    const chunk = pids.slice(i, i + chunkSize);
    const res = await restFetch(
      `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,parser_version&pid=in.(${chunk.join(",")})`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as ParsedRow[];
    out.push(...rows);
  }
  return out;
}

async function enqueueMarketInvalidations(pids: number[]): Promise<number> {
  const parsedRows = await loadParsedRows([...new Set(pids)]);
  const byKey = new Map<string, ParsedRow>();
  for (const row of parsedRows) {
    const key = row.comparable_key?.trim();
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, row);
  }
  let queued = 0;
  for (const row of byKey.values()) {
    try {
      await restFetch(rpcUrl("enqueue_mvp_market_key_invalidation"), {
        method: "POST",
        headers: serviceHeaders(),
        body: jsonBody({
          p_comparable_key: row.comparable_key,
          p_reason: "daangn_price_sweep",
          p_priority: 80,
          p_affected_pid: row.pid,
          p_old_comparable_key: row.comparable_key,
          p_new_comparable_key: row.comparable_key,
          p_parser_version: row.parser_version,
        }),
      });
      queued += 1;
    } catch (err) {
      console.warn("daangn price sweep invalidation enqueue failed", {
        comparableKey: row.comparable_key,
        error: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
      });
    }
  }
  return queued;
}

export async function runDaangnPriceSweep(options: DaangnPriceSweepOptions = {}): Promise<DaangnPriceSweepResult> {
  const startedAt = (options.now ?? new Date()).toISOString();
  const startedMs = Date.now();
  const timingsMs: Record<string, number> = {};
  const mode = options.mode ?? getDaangnSourceMode();
  const dryRun = options.dryRun ?? false;
  const targetSamples = toPositiveInt(options.targetSamples, DEFAULT_TARGET_SAMPLES, 1, 50);
  const maxSkus = toPositiveInt(options.maxSkus, DEFAULT_MAX_SKUS, 1, 500);
  const searchRegionSeeds = DAANGN_SEARCH_REGION_SEEDS.length > 0 ? DAANGN_SEARCH_REGION_SEEDS : DEFAULT_DAANGN_REGION_SEEDS;
  const maxRegions = toPositiveInt(options.maxRegions, DEFAULT_MAX_REGIONS, 1, searchRegionSeeds.length);
  const maxSearchCombos = toPositiveInt(options.maxSearchCombos, DEFAULT_MAX_SEARCH_COMBOS, 0, 2000);
  const maxCategoryCombos = toPositiveInt(options.maxCategoryCombos, DEFAULT_MAX_CATEGORY_COMBOS, 0, 2000);
  const maxDetailFetches = toPositiveInt(options.maxDetailFetches, DEFAULT_MAX_DETAIL_FETCHES, 0, 1000);
  const searchConcurrency = toPositiveInt(options.searchConcurrency, DEFAULT_SEARCH_CONCURRENCY, 1, 200);
  const detailConcurrency = toPositiveInt(options.detailConcurrency, DEFAULT_DETAIL_CONCURRENCY, 1, 50);
  const requestDelayMs = toPositiveInt(options.requestDelayMs, DEFAULT_REQUEST_DELAY_MS, 0, 30_000);
  const abortOnBlockedCombo = options.abortOnBlockedCombo ?? true;
  const regionRotationOffset = toPositiveInt(options.regionRotationOffset, 0, 0, searchRegionSeeds.length - 1);
  const timeoutMs = toPositiveInt(options.timeoutMs, DEFAULT_TIMEOUT_MS, 1000, 30_000);

  if (mode === "off") {
    const finishedAt = new Date().toISOString();
    return {
      source: DAANGN_SOURCE_ID,
      mode,
      skipped: true,
      skipReason: "daangn_source_mode_off",
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
      dryRun,
      targetSamples,
      readySkus: 0,
      deficitSkus: 0,
      selectedSkus: 0,
      regions: 0,
      searchCombos: 0,
      categoryCombos: 0,
      executedCombos: 0,
      fetchedArticles: 0,
      duplicateArticlesDropped: 0,
      matchedArticles: 0,
      selectedArticles: 0,
      detailFetched: 0,
      detailParsed: 0,
      detailFailed: 0,
      rawUpserted: 0,
      rawSkippedExisting: 0,
      marketInvalidationsQueued: 0,
      blockedCombos: 0,
      failedCombos: 0,
      closedMatched: 0,
      activeMatched: 0,
      timingsMs,
      sampleTargets: [],
    };
  }

  const readinessStart = Date.now();
  const [categoryMap, laneMap] = await Promise.all([
    loadCategoryReadinessMap().catch(() => CATEGORY_READINESS),
    loadLaneReadinessMap().catch(() => LANE_READINESS),
  ]);
  const readySkus = CATALOG.filter((sku) => isReadySku(sku, categoryMap, laneMap) && !isExplicitlyBlockedSku(sku, categoryMap, laneMap));
  timingsMs.readiness = Date.now() - readinessStart;

  const countsStart = Date.now();
  const [counts, pressureBySku] = await Promise.all([
    loadDaangnSampleCounts(readySkus.map((sku) => sku.id)),
    loadRecentDaangnPoolPressureBySku(),
  ]);
  timingsMs.sampleCounts = Date.now() - countsStart;

  const rotationSeed = Math.floor((options.now?.getTime() ?? Date.now()) / (30 * 60_000));
  const targets = buildTargets(readySkus, counts, pressureBySku, targetSamples, maxSkus, rotationSeed);
  const targetMap = new Map(targets.map((target) => [target.sku.id, target]));
  const regionOffset = maxRegions >= searchRegionSeeds.length
    ? 0
    : ((rotationSeed * maxRegions) + regionRotationOffset) % searchRegionSeeds.length;
  const rotatedRegions = [
    ...searchRegionSeeds.slice(regionOffset),
    ...searchRegionSeeds.slice(0, regionOffset),
  ];
  const regions = rotatedRegions.slice(0, maxRegions);
  const { searchCombos, categoryCombos } = buildSweepCombos(targets, regions, maxSearchCombos, maxCategoryCombos);
  const combos = [...searchCombos, ...categoryCombos];

  const fetchStart = Date.now();
  const fetched = await fetchSearchCombos(combos, searchConcurrency, timeoutMs, requestDelayMs, abortOnBlockedCombo);
  timingsMs.fetchSearch = Date.now() - fetchStart;

  const matchStart = Date.now();
  const matched = matchArticlesToTargets(fetched.articles, targetMap);
  const selectedMatches = matched.matched.slice(0, maxDetailFetches);
  timingsMs.match = Date.now() - matchStart;

  const detailStart = Date.now();
  const detail = await fetchDetailsForMatches(selectedMatches, detailConcurrency, timeoutMs, requestDelayMs);
  timingsMs.fetchDetails = Date.now() - detailStart;

  let rawUpserted = 0;
  let rawSkippedExisting = 0;
  let marketInvalidationsQueued = 0;
  const fallbackPids = detail.detailRecords
    .map((record) => parseDaangnExternalId(record.article.href))
    .filter((externalId): externalId is string => Boolean(externalId))
    .map((externalId) => daangnInternalPid(externalId));

  if (!dryRun && detail.detailRecords.length > 0) {
    const upsertStart = Date.now();
    const upsert = await upsertDaangnRawListings(
      detail.detailRecords.map((record) => record.article),
      detail.detailRecords,
      { maxClassifyRows: detail.detailRecords.length },
    );
    timingsMs.upsert = Date.now() - upsertStart;
    rawUpserted = upsert.rawUpserted;
    rawSkippedExisting = upsert.rawSkippedExisting;

    const invalidationStart = Date.now();
    const pids = upsert.affectedPids.length > 0 ? upsert.affectedPids : fallbackPids;
    marketInvalidationsQueued = await enqueueMarketInvalidations(pids);
    timingsMs.invalidate = Date.now() - invalidationStart;
  }

  const selectedBySku = new Map<string, number>();
  for (const row of selectedMatches) {
    selectedBySku.set(row.sku.id, (selectedBySku.get(row.sku.id) ?? 0) + 1);
  }

  const finishedAt = new Date().toISOString();
  return {
    source: DAANGN_SOURCE_ID,
    mode,
    skipped: false,
    startedAt,
    finishedAt,
    durationMs: Date.now() - startedMs,
    dryRun,
    targetSamples,
    readySkus: readySkus.length,
    deficitSkus: readySkus.filter((sku) => (counts.get(sku.id)?.total ?? 0) < targetSamples).length,
    selectedSkus: targets.length,
    regions: regions.length,
    searchCombos: searchCombos.length,
    categoryCombos: categoryCombos.length,
    executedCombos: combos.length,
    fetchedArticles: fetched.articles.length,
    duplicateArticlesDropped: matched.duplicates,
    matchedArticles: matched.matched.length,
    selectedArticles: selectedMatches.length,
    detailFetched: detail.detailFetched,
    detailParsed: detail.detailParsed,
    detailFailed: detail.detailFailed,
    rawUpserted,
    rawSkippedExisting,
    marketInvalidationsQueued,
    blockedCombos: fetched.blockedCombos,
    failedCombos: fetched.failedCombos,
    closedMatched: matched.closedMatched,
    activeMatched: matched.activeMatched,
    timingsMs,
    sampleTargets: targets.slice(0, 40).map((target) => ({
      skuId: target.sku.id,
      label: target.sku.modelName,
      beforeTotal: target.current.total,
      beforeSold: target.current.sold,
      deficit: target.deficit,
      selected: selectedBySku.get(target.sku.id) ?? 0,
    })),
  };
}
