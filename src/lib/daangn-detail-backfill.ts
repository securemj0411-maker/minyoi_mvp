import { DAANGN_SOURCE_ID, fetchDaangnText, parseDaangnDetailHtml } from "@/lib/daangn";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export type DaangnDetailBackfillOptions = {
  dryRun?: boolean;
  limit?: number;
  timeoutMs?: number;
  delayMs?: number;
  budgetMs?: number;
};

export type DaangnDetailBackfillResult = {
  source: typeof DAANGN_SOURCE_ID;
  mode: "daangn_detail_backfill";
  dryRun: boolean;
  selected: number;
  fetched: number;
  patched: number;
  markedGone: number;
  nullScore: number;
  parseFailed: number;
  fetchFailed: number;
  blocked: boolean;
  blockedStatus: number | null;
  blockedReason: string | null;
  skippedByBudget: number;
  marketInvalidationsQueued: number;
  durationMs: number;
};

type DetailCandidate = {
  pid: number;
  url: string;
  sourceKind: "invalidated_missing" | "raw_pending";
};

type InvalidatedMissingRow = {
  pid: number;
  raw: {
    pid: number;
    url: string | null;
    daangn_manner_temperature: number | null;
  } | null;
};

type RawPendingRow = {
  pid: number;
  url: string | null;
  daangn_manner_temperature: number | null;
};

type ParsedRow = {
  pid: number;
  comparable_key: string | null;
  parser_version: string | null;
};

const PARSED_READ_CHUNK_SIZE = 250;

function boundedInt(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value!)));
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function loadInvalidatedMissingCandidates(limit: number): Promise<DetailCandidate[]> {
  const res = await restFetch(
    `${tableUrl("mvp_candidate_pool")}` +
      `?select=pid,raw:mvp_raw_listings!inner(pid,url,source,listing_state,sku_id,daangn_manner_temperature)` +
      `&status=eq.invalidated` +
      `&invalidated_reason=eq.daangn_manner_temperature_missing` +
      `&raw.source=eq.${DAANGN_SOURCE_ID}` +
      `&raw.listing_state=eq.active` +
      `&raw.sku_id=not.is.null` +
      `&raw.daangn_manner_temperature=is.null` +
      `&order=updated_at.desc&limit=${limit}`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json()) as InvalidatedMissingRow[];
  return rows
    .filter((row) => row.raw?.url && row.raw.daangn_manner_temperature == null)
    .map((row) => ({ pid: Number(row.pid), url: row.raw!.url!, sourceKind: "invalidated_missing" as const }));
}

async function loadRawPendingCandidates(limit: number): Promise<DetailCandidate[]> {
  const res = await restFetch(
    `${tableUrl("mvp_raw_listings")}` +
      `?select=pid,url,daangn_manner_temperature` +
      `&source=eq.${DAANGN_SOURCE_ID}` +
      `&listing_state=eq.active` +
      `&sku_id=not.is.null` +
      `&daangn_manner_temperature=is.null` +
      `&order=last_seen_at.desc&limit=${limit}`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json()) as RawPendingRow[];
  return rows
    .filter((row) => row.url && row.daangn_manner_temperature == null)
    .map((row) => ({ pid: Number(row.pid), url: row.url!, sourceKind: "raw_pending" as const }));
}

async function loadCandidates(limit: number): Promise<DetailCandidate[]> {
  const primaryLimit = Math.ceil(limit * 0.7);
  const secondaryLimit = limit * 2;
  const [invalidated, rawPending] = await Promise.all([
    loadInvalidatedMissingCandidates(primaryLimit),
    loadRawPendingCandidates(secondaryLimit),
  ]);
  const seen = new Set<number>();
  const out: DetailCandidate[] = [];
  for (const candidate of [...invalidated, ...rawPending]) {
    if (seen.has(candidate.pid)) continue;
    seen.add(candidate.pid);
    out.push(candidate);
    if (out.length >= limit) break;
  }
  return out;
}

async function patchSuccess(candidate: DetailCandidate, mannerTemperature: number, reviewCount: number | null, dryRun: boolean) {
  if (dryRun) return;
  const nowIso = new Date().toISOString();
  await restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${candidate.pid}`, {
    method: "PATCH",
    headers: serviceHeaders("return=minimal"),
    body: JSON.stringify({
      daangn_manner_temperature: mannerTemperature,
      daangn_review_count: reviewCount,
      detail_status: "done",
      detail_enriched_at: nowIso,
      detail_error: null,
      score_dirty: true,
      updated_at: nowIso,
    }),
  });
}

async function patchGone(candidate: DetailCandidate, status: number, dryRun: boolean) {
  if (dryRun) return;
  const nowIso = new Date().toISOString();
  await Promise.all([
    restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${candidate.pid}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: JSON.stringify({
        listing_state: "disappeared",
        detail_error: `daangn_detail_http_${status}`,
        disappeared_at: nowIso,
        score_dirty: true,
        updated_at: nowIso,
      }),
    }),
    restFetch(`${tableUrl("mvp_candidate_pool")}?pid=eq.${candidate.pid}&status=eq.invalidated`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: JSON.stringify({
        invalidated_reason: "daangn_detail_404_manner_backfill",
        updated_at: nowIso,
      }),
    }).catch(() => null),
  ]);
}

async function patchDetailError(candidate: DetailCandidate, reason: string, dryRun: boolean) {
  if (dryRun) return;
  await restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${candidate.pid}`, {
    method: "PATCH",
    headers: serviceHeaders("return=minimal"),
    body: JSON.stringify({
      detail_error: reason.slice(0, 120),
      updated_at: new Date().toISOString(),
    }),
  });
}

async function loadParsedRows(pids: number[]): Promise<ParsedRow[]> {
  const unique = [...new Set(pids.filter((pid) => Number.isFinite(pid)))];
  if (unique.length === 0) return [];
  const out: ParsedRow[] = [];
  for (const chunk of chunkArray(unique, PARSED_READ_CHUNK_SIZE)) {
    const res = await restFetch(
      `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,parser_version&pid=in.(${chunk.join(",")})`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as ParsedRow[];
    out.push(...rows);
  }
  return out;
}

async function enqueueMarketInvalidations(pids: number[], dryRun: boolean): Promise<number> {
  if (dryRun) return 0;
  const parsedRows = await loadParsedRows(pids);
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
          p_reason: "daangn_detail_backfill",
          p_priority: 92,
          p_affected_pid: row.pid,
          p_old_comparable_key: row.comparable_key,
          p_new_comparable_key: row.comparable_key,
          p_parser_version: row.parser_version,
        }),
      });
      queued += 1;
    } catch (err) {
      console.warn("daangn detail backfill invalidation enqueue failed", {
        comparableKey: row.comparable_key,
        error: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
      });
    }
  }
  return queued;
}

export async function runDaangnDetailBackfill(options: DaangnDetailBackfillOptions = {}): Promise<DaangnDetailBackfillResult> {
  const startedAt = Date.now();
  const dryRun = options.dryRun ?? false;
  const limit = boundedInt(options.limit, 70, 1, 200);
  const timeoutMs = boundedInt(options.timeoutMs, 8_000, 1_000, 30_000);
  const delayMs = boundedInt(options.delayMs, 550, 0, 10_000);
  const budgetMs = boundedInt(options.budgetMs, 80_000, 5_000, 260_000);
  const deadline = startedAt + budgetMs;

  const candidates = await loadCandidates(limit);

  let fetched = 0;
  let patched = 0;
  let markedGone = 0;
  let nullScore = 0;
  let parseFailed = 0;
  let fetchFailed = 0;
  let blocked = false;
  let blockedStatus: number | null = null;
  let blockedReason: string | null = null;
  let skippedByBudget = 0;
  const marketRefreshPids: number[] = [];

  for (const candidate of candidates) {
    if (Date.now() + timeoutMs + delayMs > deadline) {
      skippedByBudget += 1;
      continue;
    }

    const fetchedDetail = await fetchDaangnText(candidate.url, timeoutMs).catch((err): null => {
      console.warn("daangn detail backfill fetch error", candidate.pid, err);
      return null;
    });
    fetched += 1;

    if (!fetchedDetail) {
      fetchFailed += 1;
      await patchDetailError(candidate, "daangn_detail_fetch_error", dryRun);
      await sleep(delayMs);
      continue;
    }

    if (fetchedDetail.blockSignal.blocked) {
      blocked = true;
      blockedStatus = fetchedDetail.status;
      blockedReason = fetchedDetail.blockSignal.reason;
      break;
    }

    if (!fetchedDetail.ok) {
      fetchFailed += 1;
      if (fetchedDetail.status === 404 || fetchedDetail.status === 410) {
        await patchGone(candidate, fetchedDetail.status, dryRun);
        markedGone += 1;
        marketRefreshPids.push(candidate.pid);
      } else {
        await patchDetailError(candidate, `daangn_detail_http_${fetchedDetail.status}`, dryRun);
      }
      await sleep(delayMs);
      continue;
    }

    const parsed = parseDaangnDetailHtml(fetchedDetail.body);
    if (!parsed) {
      parseFailed += 1;
      await patchDetailError(candidate, "daangn_detail_parse_failed", dryRun);
      await sleep(delayMs);
      continue;
    }

    const mannerTemperature = parsed.user.score;
    if (mannerTemperature == null) {
      nullScore += 1;
      await patchDetailError(candidate, "daangn_manner_temperature_parse_null", dryRun);
      await sleep(delayMs);
      continue;
    }

    await patchSuccess(candidate, mannerTemperature, parsed.user.reviewCount, dryRun);
    patched += 1;
    marketRefreshPids.push(candidate.pid);
    await sleep(delayMs);
  }

  const marketInvalidationsQueued = await enqueueMarketInvalidations(marketRefreshPids, dryRun);

  return {
    source: DAANGN_SOURCE_ID,
    mode: "daangn_detail_backfill",
    dryRun,
    selected: candidates.length,
    fetched,
    patched,
    markedGone,
    nullScore,
    parseFailed,
    fetchFailed,
    blocked,
    blockedStatus,
    blockedReason,
    skippedByBudget,
    marketInvalidationsQueued,
    durationMs: Date.now() - startedAt,
  };
}
