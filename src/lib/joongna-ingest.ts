import { ruleMatch } from "@/lib/catalog";
import {
  fetchJoongnaDetail,
  fetchJoongnaSearchProductUrls,
  getJoongnaSourceMode,
  JOONGNA_SOURCE_ID,
  type JoongnaBlockSignal,
  type JoongnaDetail,
} from "@/lib/joongna";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const DEFAULT_QUERIES = [
  "에어팟맥스",
  "아이폰 17 프로",
  "아이패드 프로",
  "애플워치",
  "맥북",
];

type JoongnaIngestConfig = {
  queries: string[];
  detailsPerQuery: number;
  maxDetails: number;
  delayMs: number;
  timeoutMs: number;
};

export type JoongnaIngestResult = {
  source: typeof JOONGNA_SOURCE_ID;
  mode: ReturnType<typeof getJoongnaSourceMode>;
  skipped: boolean;
  queries: string[];
  searchUrls: number;
  fetchedDetails: number;
  parsedDetails: number;
  skippedDetails: number;
  blockedSignals: JoongnaBlockSignal[];
  rawUpserted: number;
  parsedUpserted: number;
  observationInserted: number;
  sourceHealthStatus: "healthy" | "degraded" | "unhealthy";
  sourceHealthReason: string;
};

function boundedInt(raw: string | number | null | undefined, fallback: number, min: number, max: number) {
  const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function configFromEnvAndParams(params?: URLSearchParams): JoongnaIngestConfig {
  const rawQueries =
    params?.get("queries") ??
    params?.get("query") ??
    process.env.JOONGNA_INGEST_QUERIES ??
    DEFAULT_QUERIES.join(",");
  const queries = rawQueries
    .split(",")
    .map((query) => query.trim())
    .filter(Boolean)
    .slice(0, 8);
  return {
    queries: queries.length > 0 ? queries : DEFAULT_QUERIES,
    detailsPerQuery: boundedInt(
      params?.get("detailsPerQuery") ?? process.env.JOONGNA_INGEST_DETAILS_PER_QUERY,
      5,
      1,
      20,
    ),
    maxDetails: boundedInt(
      params?.get("maxDetails") ?? params?.get("max") ?? process.env.JOONGNA_INGEST_MAX_DETAILS,
      12,
      1,
      50,
    ),
    delayMs: boundedInt(params?.get("delayMs") ?? process.env.JOONGNA_INGEST_DELAY_MS, 450, 0, 5_000),
    timeoutMs: boundedInt(
      params?.get("timeoutMs") ?? process.env.JOONGNA_INGEST_TIMEOUT_MS,
      10_000,
      1_000,
      20_000,
    ),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function listingStateFor(detail: JoongnaDetail) {
  if (detail.productStatus === 0) return "active";
  return "source_nonactive";
}

function saleStatusFor(detail: JoongnaDetail) {
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
  const observationRows: Record<string, unknown>[] = [];
  const payloadRows: Record<string, unknown>[] = [];
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
    const sellerUid = detail.storeSeq ? `joongna:${detail.storeSeq}` : null;
    const skuId = parsed && !parsed.needsReview ? matched?.id ?? null : null;
    const skuName = parsed && !parsed.needsReview ? matched?.modelName ?? null : null;

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
      shop_review_rating: null,
      shop_review_count: 0,
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
        productTradeType: detail.productTradeType,
        viewCount: detail.viewCount,
        labels: detail.labels,
        sortDate: detail.sortDate,
        updateDate: detail.updateDate,
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

  return { rawRows, parsedRows, observationRows, payloadRows };
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

export async function runJoongnaIngest(options: {
  params?: URLSearchParams;
  runId?: string | null;
} = {}): Promise<JoongnaIngestResult> {
  const mode = getJoongnaSourceMode();
  const config = configFromEnvAndParams(options.params);
  if (mode === "off") {
    return {
      source: JOONGNA_SOURCE_ID,
      mode,
      skipped: true,
      queries: config.queries,
      searchUrls: 0,
      fetchedDetails: 0,
      parsedDetails: 0,
      skippedDetails: 0,
      blockedSignals: [],
      rawUpserted: 0,
      parsedUpserted: 0,
      observationInserted: 0,
      sourceHealthStatus: "degraded",
      sourceHealthReason: "source_mode_off",
    };
  }

  const productUrls = new Set<string>();
  const searchFailures: string[] = [];
  for (const query of config.queries) {
    try {
      const urls = await fetchJoongnaSearchProductUrls(query, {
        limit: config.detailsPerQuery,
        timeoutMs: config.timeoutMs,
      });
      for (const url of urls) {
        productUrls.add(url);
        if (productUrls.size >= config.maxDetails) break;
      }
    } catch (err) {
      searchFailures.push(`${query}:${err instanceof Error ? err.message : String(err)}`);
    }
    if (productUrls.size >= config.maxDetails) break;
    if (config.delayMs > 0) await sleep(config.delayMs);
  }

  const details: JoongnaDetail[] = [];
  const blockedSignals: JoongnaBlockSignal[] = [];
  let detail404 = 0;
  let detail5xx = 0;
  for (const url of [...productUrls].slice(0, config.maxDetails)) {
    try {
      const detail = await fetchJoongnaDetail(url, config.timeoutMs);
      details.push(detail);
      if (detail.status === 404) detail404 += 1;
      if (detail.status >= 500) detail5xx += 1;
      if (detail.blockSignal.blocked) {
        blockedSignals.push(detail.blockSignal);
        break;
      }
    } catch (err) {
      detail5xx += 1;
      blockedSignals.push({ blocked: true, reason: err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120), status: 0 });
      break;
    }
    if (config.delayMs > 0) await sleep(config.delayMs);
  }

  const writableDetails = details.filter(isWritableDetail);
  const skippedDetails = details.length - writableDetails.length;
  const now = new Date().toISOString();
  const { rawRows, parsedRows, observationRows, payloadRows } = buildRows(writableDetails, now, options.runId ?? null);
  if (rawRows.length > 0) {
    await upsertRows("mvp_raw_listings", rawRows, "pid");
  }
  if (parsedRows.length > 0) {
    await upsertRows("mvp_listing_parsed", parsedRows, "pid");
  }
  const observationInserted = await insertObservations(observationRows, payloadRows);

  const detailSuccessRate = details.length > 0
    ? Number((details.filter((detail) => detail.ok).length / details.length).toFixed(3))
    : 0;
  const hasBlock = blockedSignals.some((signal) => signal.blocked);
  const sourceHealthStatus = hasBlock ? "unhealthy" : searchFailures.length > 0 || writableDetails.length === 0 ? "degraded" : "healthy";
  const sourceHealthReason = hasBlock
    ? blockedSignals.find((signal) => signal.blocked)?.reason ?? "blocked"
    : searchFailures.length > 0
      ? "search_partial_failure"
      : writableDetails.length === 0
        ? "no_writable_details"
        : "active_ingest_ok";

  await insertSourceHealth({
    status: sourceHealthStatus,
    reason: sourceHealthReason,
    searchResultCount: productUrls.size,
    metrics: {
      mode,
      queries: config.queries,
      searchUrls: productUrls.size,
      searchFailures,
      fetchedDetails: details.length,
      writableDetails: writableDetails.length,
      skippedDetails,
      detailSuccessRate,
      detail404Rate: details.length > 0 ? Number((detail404 / details.length).toFixed(3)) : 0,
      detail5xxRate: details.length > 0 ? Number((detail5xx / Math.max(1, details.length)).toFixed(3)) : 0,
      rawUpserted: rawRows.length,
      parsedUpserted: parsedRows.length,
      observationInserted,
    },
  });

  return {
    source: JOONGNA_SOURCE_ID,
    mode,
    skipped: false,
    queries: config.queries,
    searchUrls: productUrls.size,
    fetchedDetails: details.length,
    parsedDetails: writableDetails.length,
    skippedDetails,
    blockedSignals,
    rawUpserted: rawRows.length,
    parsedUpserted: parsedRows.length,
    observationInserted,
    sourceHealthStatus,
    sourceHealthReason,
  };
}
