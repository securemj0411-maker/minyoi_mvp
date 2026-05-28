import { NextRequest, NextResponse } from "next/server";

import {
  failCollectRun,
  finishCollectRun,
  markStaleCollectRuns,
  startCollectRun,
  type CollectRunRequestMeta,
} from "@/lib/collect-logs";
import { checkCronAuth } from "@/lib/cron-auth";
import { acquireCronGuardWithSourceHealth, cronGuardSkipBody } from "@/lib/cron-guard";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";
import { scoreStage, type ScoreStageOptions } from "@/lib/tick-pipeline";
import type { PipelineResult } from "@/lib/pipeline";

// Wave 724 (2026-05-23): p95 70.8s/max 88.3s 측정 → 150s buffer. 90s 거의 도달이라 spike fail risk.
export const maxDuration = 150;

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null;
  return value.split(",")[0]?.trim() || null;
}

function truncate(value: string | null, max = 500): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function envInt(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function envIntAny(names: string[], fallback: number, min: number, max: number): number {
  for (const name of names) {
    const parsed = Number.parseInt(process.env[name] ?? "", 10);
    if (Number.isFinite(parsed)) return Math.max(min, Math.min(max, parsed));
  }
  return fallback;
}

function scoreWorkerBudgetMs() {
  return envInt("PIPELINE_SCORE_WORKER_BUDGET_MS", 55_000, 5_000, 55_000);
}

function scoreStageOptions(): ScoreStageOptions {
  const shardCount = envIntAny(["PIPELINE_SCORE_DAANGN_SHARD_COUNT", "DAANGN_INGEST_REGION_SHARD_COUNT"], 1, 1, 20);
  const shardIndex = envIntAny(["PIPELINE_SCORE_DAANGN_SHARD_INDEX", "DAANGN_INGEST_REGION_SHARD_INDEX"], 0, 0, Math.max(0, shardCount - 1));
  return {
    lane: "a",
    cleanup: true,
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
    triggerSource: (headers.get("x-qstash-schedule-id") ?? userAgent ?? "score-worker").slice(0, 120),
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

function toPipelineResult(result: Awaited<ReturnType<typeof scoreStage>>): PipelineResult {
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

async function handleScoreWorker(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  const meta = requestMeta(req, authOk, authReason);

  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const guard = await acquireCronGuardWithSourceHealth("score_worker", req);
  if (!guard.allowed) {
    return NextResponse.json(cronGuardSkipBody(guard));
  }

  const config = loadPipelineRuntimeConfig();
  const budgetMs = scoreWorkerBudgetMs();
  const scoreOptions = scoreStageOptions();
  const staleMarked = await markStaleCollectRuns(config.staleRunMinutes);
  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      pipelineMode: "score_worker",
      budgets: {
        score: budgetMs,
      },
      scoreLimit: config.tickScoreLimit,
      scoreOptions,
      staleMarkedBeforeRun: staleMarked,
    },
  });
  if (!run.id) {
    guard.release();
    return NextResponse.json(
      { ok: false, mode: "score_worker", error: "supabase_unavailable_before_pipeline", ts: run.startedAt },
      { status: 503 },
    );
  }

  try {
    const result = await scoreStage(Date.now() + budgetMs, scoreOptions);
    await finishCollectRun(run.id, run.startedAt, toPipelineResult(result), {
      stages: { score: result },
      stageDurationsMs: { score: Date.now() - Date.parse(run.startedAt) },
    });
    return NextResponse.json({
      ok: true,
      runId: run.id,
      mode: "score_worker",
      result,
      ts: run.startedAt,
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json(
      {
        ok: false,
        runId: run.id,
        mode: "score_worker",
        error: err instanceof Error ? err.message : String(err),
        ts: run.startedAt,
      },
      { status: 500 },
    );
  } finally {
    guard.release();
  }
}

export async function GET(req: NextRequest) {
  return handleScoreWorker(req);
}

export async function POST(req: NextRequest) {
  return handleScoreWorker(req);
}
