import type { PipelineResult } from "@/lib/pipeline";

export type CollectRunStatus = "running" | "succeeded" | "failed";

export type CollectRun = {
  id: string;
  status: CollectRunStatus;
  triggerSource: string;
  requestMethod: string | null;
  requestPath: string | null;
  requestHost: string | null;
  requestIp: string | null;
  requestUserAgent: string | null;
  requestReferer: string | null;
  requestOrigin: string | null;
  requestVercelId: string | null;
  requestCountry: string | null;
  waitMode: boolean;
  authOk: boolean;
  authReason: string | null;
  responseMode: string | null;
  requestMeta: Record<string, unknown>;
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
  stageStats: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
};

type CollectRunRow = {
  id: string;
  status: CollectRunStatus;
  trigger_source: string;
  request_method: string | null;
  request_path: string | null;
  request_host: string | null;
  request_ip: string | null;
  request_user_agent: string | null;
  request_referer: string | null;
  request_origin: string | null;
  request_vercel_id: string | null;
  request_country: string | null;
  wait_mode: boolean | null;
  auth_ok: boolean | null;
  auth_reason: string | null;
  response_mode: string | null;
  request_meta: Record<string, unknown> | null;
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
  stage_stats: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
};

let lastStaleMarkAttemptAt = 0;

export type CollectRunRequestMeta = {
  triggerSource: string;
  requestMethod: string;
  requestPath: string;
  requestHost: string | null;
  requestIp: string | null;
  requestUserAgent: string | null;
  requestReferer: string | null;
  requestOrigin: string | null;
  requestVercelId: string | null;
  requestCountry: string | null;
  waitMode: boolean;
  authOk: boolean;
  authReason: string;
  responseMode: "sync_wait" | "background";
  requestMeta: Record<string, unknown>;
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
    requestMethod: row.request_method,
    requestPath: row.request_path,
    requestHost: row.request_host,
    requestIp: row.request_ip,
    requestUserAgent: row.request_user_agent,
    requestReferer: row.request_referer,
    requestOrigin: row.request_origin,
    requestVercelId: row.request_vercel_id,
    requestCountry: row.request_country,
    waitMode: row.wait_mode ?? false,
    authOk: row.auth_ok ?? true,
    authReason: row.auth_reason,
    responseMode: row.response_mode,
    requestMeta: row.request_meta ?? {},
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
    stageStats: row.stage_stats ?? {},
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

async function insertRun(payload: Record<string, unknown>): Promise<CollectRunRow | null> {
  const base = restUrl();
  const h = headers("return=representation");
  if (!base || !h) return null;
  try {
    const res = await fetch(`${base}/mvp_collect_runs`, {
      method: "POST",
      headers: h,
      body: JSON.stringify([payload]),
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as CollectRunRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function patchRun(id: string, payload: Record<string, unknown>): Promise<void> {
  const base = restUrl();
  const h = headers();
  if (!base || !h) return;
  try {
    await fetch(`${base}/mvp_collect_runs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // Logging must not make cron workers hang while Supabase is overloaded.
  }
}

export async function markStaleCollectRuns(maxAgeMinutes = 3): Promise<number> {
  const nowMs = Date.now();
  if (nowMs - lastStaleMarkAttemptAt < 60_000) return 0;
  lastStaleMarkAttemptAt = nowMs;
  const base = restUrl();
  const h = headers("return=representation");
  if (!base || !h) return 0;
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
  const finishedAt = new Date().toISOString();
  const res = await fetch(
    `${base}/mvp_collect_runs?status=eq.running&started_at=lt.${encodeURIComponent(cutoff)}&select=id`,
    {
      method: "PATCH",
      headers: h,
      body: JSON.stringify({
        status: "failed",
        finished_at: finishedAt,
        error_message: `stale running run auto-marked after ${maxAgeMinutes}m`,
      }),
      signal: AbortSignal.timeout(3_000),
    },
  ).catch(() => null);
  if (!res?.ok) return 0;
  const rows = (await res.json().catch(() => [])) as Array<{ id?: string }>;
  return rows.length;
}

export async function startCollectRun(meta: CollectRunRequestMeta): Promise<{ id: string | null; startedAt: string }> {
  const startedAt = new Date().toISOString();
  const row = await insertRun({
    status: "running",
    trigger_source: meta.triggerSource,
    request_method: meta.requestMethod,
    request_path: meta.requestPath,
    request_host: meta.requestHost,
    request_ip: meta.requestIp,
    request_user_agent: meta.requestUserAgent,
    request_referer: meta.requestReferer,
    request_origin: meta.requestOrigin,
    request_vercel_id: meta.requestVercelId,
    request_country: meta.requestCountry,
    wait_mode: meta.waitMode,
    auth_ok: meta.authOk,
    auth_reason: meta.authReason,
    response_mode: meta.responseMode,
    request_meta: meta.requestMeta,
    started_at: startedAt,
  });
  return { id: row?.id ?? null, startedAt };
}

export async function finishCollectRun(
  id: string | null,
  startedAt: string,
  result: PipelineResult,
  stageStats?: Record<string, unknown>,
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
    ...(stageStats ? { stage_stats: stageStats } : {}),
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
