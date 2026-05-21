import { NextRequest, NextResponse } from "next/server";

import {
  buildCronRequestMeta,
  failCollectRun,
  finishCollectRunMinimal,
  markStaleCollectRuns,
  startCollectRun,
} from "@/lib/collect-logs";
import { checkCronAuth } from "@/lib/cron-auth";
import { acquireCronGuardWithSourceHealth, cronGuardSkipBody } from "@/lib/cron-guard";
import { runJoongnaIngest } from "@/lib/joongna-ingest";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";

export const maxDuration = 90;

function envInt(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function joongnaWorkerBudgetMs() {
  return envInt("JOONGNA_WORKER_BUDGET_MS", 75_000, 10_000, 85_000);
}

async function handleJoongnaWorker(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  const meta = buildCronRequestMeta(req, authOk, authReason, "joongna-worker");

  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const guard = await acquireCronGuardWithSourceHealth("joongna_worker", req);
  if (!guard.allowed) {
    return NextResponse.json(cronGuardSkipBody(guard));
  }

  const budgetMs = joongnaWorkerBudgetMs();
  const staleMarked = await markStaleCollectRuns(loadPipelineRuntimeConfig().staleRunMinutes);
  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      pipelineMode: "joongna_worker",
      budgets: {
        joongna: budgetMs,
      },
      staleMarkedBeforeRun: staleMarked,
    },
  });
  if (!run.id) {
    guard.release();
    return NextResponse.json(
      { ok: false, mode: "joongna_worker", error: "supabase_unavailable_before_pipeline", ts: run.startedAt },
      { status: 503 },
    );
  }

  try {
    const result = await runJoongnaIngest({
      params: req.nextUrl.searchParams,
      runId: run.id,
      deadlineMs: Date.now() + budgetMs,
    });
    await finishCollectRunMinimal(run.id, run.startedAt, {
      collected: result.searchUrls,
      enriched: result.fetchedDetails,
      titleNormal: result.parsedDetails,
      upserted: result.rawUpserted,
    }, {
      source: result.source,
      mode: result.mode,
      skipped: result.skipped,
      queries: result.queries,
      readyCatalogCategoryPoolCounts: result.readyCatalogCategoryPoolCounts,
      selectedReadyCatalogCategoryCounts: result.selectedReadyCatalogCategoryCounts,
      skippedDetails: result.skippedDetails,
      parsedUpserted: result.parsedUpserted,
      marketInvalidationsQueued: result.marketInvalidationsQueued,
      observationInserted: result.observationInserted,
      budgetStopped: result.budgetStopped,
      sellerProfilesFetched: result.sellerProfilesFetched,
      sellerTransactionsFetched: result.sellerTransactionsFetched,
      sellerCacheHits: result.sellerCacheHits,
      blockedSignals: result.blockedSignals,
      sourceHealthStatus: result.sourceHealthStatus,
      sourceHealthReason: result.sourceHealthReason,
    });
    return NextResponse.json({
      ok: true,
      runId: run.id,
      mode: "joongna_worker",
      result,
      ts: run.startedAt,
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json(
      {
        ok: false,
        runId: run.id,
        mode: "joongna_worker",
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
  return handleJoongnaWorker(req);
}
