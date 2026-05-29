import { NextRequest, NextResponse } from "next/server";

import {
  buildCronRequestMeta,
  failCollectRun,
  finishCollectRun,
  markStaleCollectRuns,
  startCollectRun,
} from "@/lib/collect-logs";
import { checkCronAuth } from "@/lib/cron-auth";
import { acquireCronGuardWithSourceHealth, cronGuardSkipBody } from "@/lib/cron-guard";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";
import { scoreStage, type ScoreStageOptions } from "@/lib/tick-pipeline";
import type { PipelineResult } from "@/lib/pipeline";

export const maxDuration = 150;

function envInt(names: string[], fallback: number, min: number, max: number): number {
  for (const name of names) {
    const parsed = Number.parseInt(process.env[name] ?? "", 10);
    if (Number.isFinite(parsed)) return Math.max(min, Math.min(max, parsed));
  }
  return fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function isDaangnCProject(): boolean {
  return String(process.env.CRON_PROJECT_ROLE ?? "").trim().toLowerCase() === "daangn_c";
}

function scoreWorkerCBudgetMs() {
  return envInt(["PIPELINE_SCORE_WORKER_C_BUDGET_MS", "PIPELINE_SCORE_WORKER_BUDGET_MS"], 55_000, 5_000, 55_000);
}

function scoreStageOptions(): ScoreStageOptions {
  const shardCount = envInt(["PIPELINE_SCORE_C_DAANGN_SHARD_COUNT", "PIPELINE_SCORE_DAANGN_SHARD_COUNT"], 3, 1, 20);
  const shardIndex = envInt(["PIPELINE_SCORE_C_DAANGN_SHARD_INDEX"], 2, 0, Math.max(0, shardCount - 1));
  return {
    lane: "c",
    sourceFilter: "daangn",
    daangnShardCount: shardCount,
    daangnShardIndex: shardIndex,
    cleanup: false,
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

async function handleScoreWorkerC(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  const meta = buildCronRequestMeta(req, authOk, authReason, "score-worker-c");

  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isDaangnCProject()) {
    return NextResponse.json({
      ok: true,
      started: false,
      skipped: true,
      mode: "score_worker_c",
      reason: "project_role_disabled",
      projectRole: process.env.CRON_PROJECT_ROLE ?? "primary",
    });
  }

  if (!envBool("PIPELINE_SCORE_WORKER_C_ENABLED", true)) {
    return NextResponse.json({ ok: true, started: false, skipped: true, mode: "score_worker_c", reason: "disabled" });
  }

  const guard = await acquireCronGuardWithSourceHealth("score_worker_c", req);
  if (!guard.allowed) {
    return NextResponse.json(cronGuardSkipBody(guard));
  }

  const config = loadPipelineRuntimeConfig();
  const budgetMs = scoreWorkerCBudgetMs();
  const scoreOptions = scoreStageOptions();
  const staleMarked = await markStaleCollectRuns(config.staleRunMinutes);
  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      pipelineMode: "score_worker_c",
      budgets: { score: budgetMs },
      scoreLimit: config.tickScoreLimit,
      scoreOptions,
      staleMarkedBeforeRun: staleMarked,
    },
  });
  if (!run.id) {
    guard.release();
    return NextResponse.json(
      { ok: false, mode: "score_worker_c", error: "supabase_unavailable_before_pipeline", ts: run.startedAt },
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
      mode: "score_worker_c",
      result,
      ts: run.startedAt,
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json(
      {
        ok: false,
        runId: run.id,
        mode: "score_worker_c",
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
  return handleScoreWorkerC(req);
}

export async function POST(req: NextRequest) {
  return handleScoreWorkerC(req);
}
