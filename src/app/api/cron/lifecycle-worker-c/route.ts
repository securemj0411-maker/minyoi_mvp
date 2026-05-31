// Wave 979 (2026-05-31): lifecycle-worker-c — daangn shard 2/3 전용.
//   score-worker-c 패턴 동일. base lifecycle-worker 가 bunjang/joongna 다 + daangn shard 0/3 처리,
//   b 가 daangn shard 1/3, c 가 daangn shard 2/3. capacity 9,600/h → 28,800/h (3 lane).

import { NextRequest, NextResponse } from "next/server";

import {
  failCollectRun,
  finishCollectRun,
  markStaleCollectRuns,
  startCollectRun,
  type CollectRunRequestMeta,
} from "@/lib/collect-logs";
import { checkCronAuth } from "@/lib/cron-auth";
import {
  acquireCronGuardWithSourceHealth,
  cronGuardSkipBody,
  type CronGuardAllowed,
  type CronWorkerMode,
} from "@/lib/cron-guard";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";
import { runLifecycleWorkerPipeline, type LifecycleClaimOptions } from "@/lib/tick-pipeline";
import type { PipelineResult } from "@/lib/pipeline";

export const maxDuration = 180;

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null;
  return value.split(",")[0]?.trim() || null;
}

function truncate(value: string | null, max = 500): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function envInt(names: string[], fallback: number, min: number, max: number): number {
  for (const name of names) {
    const parsed = Number.parseInt(process.env[name] ?? "", 10);
    if (Number.isFinite(parsed)) return Math.max(min, Math.min(max, parsed));
  }
  return fallback;
}

function lifecycleCClaimOptions(): LifecycleClaimOptions {
  const shardCount = envInt(["PIPELINE_LIFECYCLE_C_DAANGN_SHARD_COUNT", "PIPELINE_LIFECYCLE_DAANGN_SHARD_COUNT"], 3, 1, 20);
  const shardIndex = envInt(["PIPELINE_LIFECYCLE_C_DAANGN_SHARD_INDEX"], 2, 0, Math.max(0, shardCount - 1));
  return {
    sourceFilter: "daangn",
    daangnShardCount: shardCount,
    daangnShardIndex: shardIndex,
  };
}

function requestMeta(req: NextRequest, authOk: boolean, authReason: string): CollectRunRequestMeta {
  const headers = req.headers;
  const userAgent = headers.get("user-agent");
  const requestIp =
    firstForwardedIp(headers.get("x-forwarded-for")) ??
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-vercel-forwarded-for");

  return {
    triggerSource: (headers.get("x-qstash-schedule-id") ?? userAgent ?? "lifecycle-worker-c").slice(0, 120),
    requestMethod: req.method,
    requestPath: `${req.nextUrl.pathname}${req.nextUrl.search}`,
    requestHost: headers.get("host"),
    requestIp,
    requestUserAgent: truncate(userAgent),
    requestReferer: truncate(headers.get("referer")),
    requestOrigin: truncate(headers.get("origin")),
    requestVercelId: headers.get("x-vercel-id"),
    requestCountry: headers.get("x-vercel-ip-country"),
    waitMode: true,
    authOk,
    authReason,
    responseMode: "sync_wait",
    requestMeta: {
      qstashScheduleId: headers.get("x-qstash-schedule-id"),
      qstashMessageId: headers.get("upstash-message-id"),
      forwardedProto: headers.get("x-forwarded-proto"),
      forwardedHost: headers.get("x-forwarded-host"),
      vercelDeploymentUrl: headers.get("x-vercel-deployment-url"),
      query: Object.fromEntries(req.nextUrl.searchParams.entries()),
    },
  };
}

function toPipelineResult(result: Awaited<ReturnType<typeof runLifecycleWorkerPipeline>>): PipelineResult {
  return {
    collected: result.collected,
    titleNormal: result.queued,
    enriched: result.enriched,
    scored: result.scored,
    aiReviewRequested: result.aiReviewRequested,
    aiCacheHits: result.aiCacheHits,
    aiApiCalls: result.aiApiCalls,
    aiUnavailable: result.aiUnavailable,
    aiFiltered: result.aiFiltered,
    aiKeptNormal: result.aiKeptNormal,
    aiKeptLowConfidence: result.aiKeptLowConfidence,
    normal: result.scored,
    upserted: result.upserted,
  };
}

async function executeLifecycleCRun(
  meta: CollectRunRequestMeta,
  guard: CronGuardAllowed,
  guardMode: CronWorkerMode,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const config = loadPipelineRuntimeConfig();
  const staleMarked = await markStaleCollectRuns(config.staleRunMinutes);
  const claimOptions = lifecycleCClaimOptions();
  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      pipelineMode: guardMode,
      lifecycleMode: "daangn_shard_c",
      claimOptions: {
        sourceFilter: claimOptions.sourceFilter,
        shardCount: claimOptions.daangnShardCount,
        shardIndex: claimOptions.daangnShardIndex,
      },
      budgets: { detail: config.tickDetailBudgetMs },
      staleMarkedBeforeRun: staleMarked,
    },
  });
  if (!run.id) {
    guard.release();
    return { status: 503, body: { ok: false, mode: guardMode, error: "supabase_unavailable_before_pipeline", ts: run.startedAt } };
  }

  try {
    const result = await runLifecycleWorkerPipeline({ terminalRecheck: false, ...claimOptions });
    await finishCollectRun(run.id, run.startedAt, toPipelineResult(result), {
      stages: result.stages,
      stageDurationsMs: result.stageDurationsMs,
    });
    return {
      status: 200,
      body: { ok: true, runId: run.id, mode: guardMode, result, ts: run.startedAt },
    };
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return {
      status: 500,
      body: { ok: false, runId: run.id, mode: guardMode, error: err instanceof Error ? err.message : String(err), ts: run.startedAt },
    };
  } finally {
    guard.release();
  }
}

async function handleLifecycleWorkerC(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  const meta = requestMeta(req, authOk, authReason);
  const guardMode: CronWorkerMode = "lifecycle_worker_c";

  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const guard = await acquireCronGuardWithSourceHealth(guardMode, req);
  if (!guard.allowed) {
    return NextResponse.json(cronGuardSkipBody(guard));
  }

  const outcome = await executeLifecycleCRun(meta, guard, guardMode);
  return NextResponse.json(outcome.body, { status: outcome.status });
}

export async function GET(req: NextRequest) {
  return handleLifecycleWorkerC(req);
}

export async function POST(req: NextRequest) {
  return handleLifecycleWorkerC(req);
}
