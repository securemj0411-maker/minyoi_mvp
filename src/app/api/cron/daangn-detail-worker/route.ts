import { NextRequest, NextResponse } from "next/server";

import {
  buildCronRequestMeta,
  failCollectRun,
  finishCollectRunMinimal,
  markStaleCollectRuns,
  startCollectRun,
} from "@/lib/collect-logs";
import { checkCronAuth } from "@/lib/cron-auth";
import { acquireCronGuardWithSourceHealth, cronGuardSkipBody, type CronWorkerMode } from "@/lib/cron-guard";
import { runDaangnDetailBackfill } from "@/lib/daangn-detail-backfill";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";

export const maxDuration = 300;

function envInt(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function envBool(name: string, fallback = false): boolean {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function isDaangnDetailProject() {
  const role = String(process.env.CRON_PROJECT_ROLE ?? "").trim().toLowerCase();
  return !role || role === "primary" || role === "all" || role === "daangn_detail" || role === "daangn_b" || role === "daangn_c";
}

function defaultDetailShardIndex() {
  const role = String(process.env.CRON_PROJECT_ROLE ?? "").trim().toLowerCase();
  if (role === "daangn_b") return 1;
  if (role === "daangn_c") return 2;
  return 0;
}

function defaultDetailShardCount() {
  const role = String(process.env.CRON_PROJECT_ROLE ?? "").trim().toLowerCase();
  return !role || role === "primary" || role === "all" || role === "daangn_b" || role === "daangn_c" ? 3 : 1;
}

function detailGuardMode(shardCount: number, shardIndex: number): CronWorkerMode {
  if (shardCount <= 1) return "daangn_detail_worker";
  if (shardIndex === 1) return "daangn_detail_worker_b";
  if (shardIndex === 2) return "daangn_detail_worker_c";
  return "daangn_detail_worker_a";
}

async function handleDaangnDetailWorker(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  const meta = buildCronRequestMeta(req, authOk, authReason, "daangn-detail-worker");

  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isDaangnDetailProject()) {
    return NextResponse.json({
      ok: true,
      started: false,
      skipped: true,
      mode: "daangn_detail_worker",
      reason: "project_role_disabled",
      projectRole: process.env.CRON_PROJECT_ROLE ?? null,
    });
  }

  if (!envBool("DAANGN_DETAIL_WORKER_ENABLED", true)) {
    return NextResponse.json({ ok: true, started: false, skipped: true, mode: "daangn_detail_worker", reason: "disabled" });
  }

  const shardCount = envInt("DAANGN_DETAIL_WORKER_SHARD_COUNT", defaultDetailShardCount(), 1, 3);
  const shardIndex = envInt("DAANGN_DETAIL_WORKER_SHARD_INDEX", defaultDetailShardIndex(), 0, Math.max(0, shardCount - 1));
  const guardMode = detailGuardMode(shardCount, shardIndex);
  const guard = await acquireCronGuardWithSourceHealth(guardMode, req);
  if (!guard.allowed) {
    return NextResponse.json(cronGuardSkipBody(guard));
  }

  const staleMarked = await markStaleCollectRuns(loadPipelineRuntimeConfig().staleRunMinutes);
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1" || envBool("DAANGN_DETAIL_WORKER_DRY_RUN", false);
  const limit = envInt("DAANGN_DETAIL_WORKER_LIMIT", shardCount > 1 ? 100 : 150, 1, 200);
  const budgetMs = envInt("DAANGN_DETAIL_WORKER_BUDGET_MS", 175_000, 5_000, 260_000);
  const concurrency = envInt("DAANGN_DETAIL_WORKER_CONCURRENCY", shardCount > 1 ? 2 : 1, 1, 3);
  const delayMs = envInt("DAANGN_DETAIL_WORKER_DELAY_MS", concurrency > 1 ? 600 : 350, 0, 10_000);
  const timeoutMs = envInt("DAANGN_DETAIL_WORKER_TIMEOUT_MS", 8_000, 1_000, 30_000);

  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      pipelineMode: "daangn_detail_worker",
      staleMarkedBeforeRun: staleMarked,
      dryRun,
      limit,
      budgetMs,
      delayMs,
      timeoutMs,
      concurrency,
      shardCount,
      shardIndex,
      guardMode,
    },
  });
  if (!run.id) {
    guard.release();
    return NextResponse.json(
      { ok: false, mode: "daangn_detail_worker", error: "supabase_unavailable_before_pipeline", ts: run.startedAt },
      { status: 503 },
    );
  }

  try {
    const result = await runDaangnDetailBackfill({
      dryRun,
      limit,
      budgetMs,
      delayMs,
      timeoutMs,
      concurrency,
      shardCount,
      shardIndex,
    });

    await finishCollectRunMinimal(run.id, run.startedAt, {
      collected: result.selected,
      enriched: result.patched,
      titleNormal: result.fetched,
      upserted: result.patched,
    }, {
      source: result.source,
      mode: result.mode,
      dryRun: result.dryRun,
      selected: result.selected,
      fetched: result.fetched,
      patched: result.patched,
      markedGone: result.markedGone,
      nullScore: result.nullScore,
      parseFailed: result.parseFailed,
      fetchFailed: result.fetchFailed,
      blocked: result.blocked,
      blockedStatus: result.blockedStatus,
      blockedReason: result.blockedReason,
      skippedByBudget: result.skippedByBudget,
      marketInvalidationsQueued: result.marketInvalidationsQueued,
      shardCount: result.shardCount,
      shardIndex: result.shardIndex,
      concurrency: result.concurrency,
      guardMode,
      durationMs: result.durationMs,
    });

    return NextResponse.json({
      ok: true,
      runId: run.id,
      mode: "daangn_detail_worker",
      result,
      ts: run.startedAt,
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json(
      {
        ok: false,
        runId: run.id,
        mode: "daangn_detail_worker",
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
  return handleDaangnDetailWorker(req);
}
