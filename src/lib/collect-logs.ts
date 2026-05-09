import type { PipelineResult } from "@/lib/pipeline";

export type CollectRunStatus = "running" | "succeeded" | "failed";

export type CollectRun = {
  id: string;
  status: CollectRunStatus;
  triggerSource: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  collectedCount: number;
  titleNormalCount: number;
  enrichedCount: number;
  scoredCount: number;
  aiReviewRequested: number;
  aiCacheHits: number;
  aiApiCalls: number;
  aiUnavailableCount: number;
  aiFilteredCount: number;
  aiKeptNormalCount: number;
  aiKeptLowConfidenceCount: number;
  upsertedCount: number;
  errorMessage: string | null;
  createdAt: string;
};

type CollectRunRow = {
  id: string;
  status: CollectRunStatus;
  trigger_source: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  collected_count: number | null;
  title_normal_count: number | null;
  enriched_count: number | null;
  scored_count: number | null;
  ai_review_requested: number | null;
  ai_cache_hits: number | null;
  ai_api_calls: number | null;
  ai_unavailable_count: number | null;
  ai_filtered_count: number | null;
  ai_kept_normal_count: number | null;
  ai_kept_low_confidence_count: number | null;
  upserted_count: number | null;
  error_message: string | null;
  created_at: string;
};

function restUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function headers(prefer?: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    ...(prefer ? { prefer } : {}),
  };
}

function toCollectRun(row: CollectRunRow): CollectRun {
  return {
    id: row.id,
    status: row.status,
    triggerSource: row.trigger_source,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    collectedCount: row.collected_count ?? 0,
    titleNormalCount: row.title_normal_count ?? 0,
    enrichedCount: row.enriched_count ?? 0,
    scoredCount: row.scored_count ?? 0,
    aiReviewRequested: row.ai_review_requested ?? 0,
    aiCacheHits: row.ai_cache_hits ?? 0,
    aiApiCalls: row.ai_api_calls ?? 0,
    aiUnavailableCount: row.ai_unavailable_count ?? 0,
    aiFilteredCount: row.ai_filtered_count ?? 0,
    aiKeptNormalCount: row.ai_kept_normal_count ?? 0,
    aiKeptLowConfidenceCount: row.ai_kept_low_confidence_count ?? 0,
    upsertedCount: row.upserted_count ?? 0,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

async function insertRun(payload: Record<string, unknown>): Promise<CollectRunRow | null> {
  const base = restUrl();
  const h = headers("return=representation");
  if (!base || !h) return null;
  const res = await fetch(`${base}/mvp_collect_runs`, {
    method: "POST",
    headers: h,
    body: JSON.stringify([payload]),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as CollectRunRow[];
  return rows[0] ?? null;
}

async function patchRun(id: string, payload: Record<string, unknown>): Promise<void> {
  const base = restUrl();
  const h = headers();
  if (!base || !h) return;
  await fetch(`${base}/mvp_collect_runs?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify(payload),
  });
}

export async function startCollectRun(triggerSource: string): Promise<{ id: string | null; startedAt: string }> {
  const startedAt = new Date().toISOString();
  const row = await insertRun({
    status: "running",
    trigger_source: triggerSource,
    started_at: startedAt,
  });
  return { id: row?.id ?? null, startedAt };
}

export async function finishCollectRun(
  id: string | null,
  startedAt: string,
  result: PipelineResult,
): Promise<void> {
  if (!id) return;
  const finishedAt = new Date().toISOString();
  await patchRun(id, {
    status: "succeeded",
    finished_at: finishedAt,
    duration_ms: Date.parse(finishedAt) - Date.parse(startedAt),
    collected_count: result.collected,
    title_normal_count: result.titleNormal,
    enriched_count: result.enriched,
    scored_count: result.scored,
    ai_review_requested: result.aiReviewRequested,
    ai_cache_hits: result.aiCacheHits,
    ai_api_calls: result.aiApiCalls,
    ai_unavailable_count: result.aiUnavailable,
    ai_filtered_count: result.aiFiltered,
    ai_kept_normal_count: result.aiKeptNormal,
    ai_kept_low_confidence_count: result.aiKeptLowConfidence,
    upserted_count: result.upserted,
    error_message: null,
  });
}

export async function failCollectRun(id: string | null, startedAt: string, err: unknown): Promise<void> {
  if (!id) return;
  const finishedAt = new Date().toISOString();
  await patchRun(id, {
    status: "failed",
    finished_at: finishedAt,
    duration_ms: Date.parse(finishedAt) - Date.parse(startedAt),
    error_message: err instanceof Error ? err.message : String(err),
  });
}

export async function loadCollectRuns(limit = 30): Promise<CollectRun[]> {
  const base = restUrl();
  const h = headers();
  if (!base || !h) return [];
  const res = await fetch(
    `${base}/mvp_collect_runs?select=*&order=started_at.desc&limit=${limit}`,
    {
      headers: h,
      cache: "no-store",
    },
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as CollectRunRow[];
  return rows.map(toCollectRun);
}
