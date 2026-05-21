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
import { runJoongnaShadowIngest } from "@/lib/joongna-shadow-ingest";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";

export const maxDuration = 90;

async function handleJoongnaShadowWorker(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  const meta = buildCronRequestMeta(req, authOk, authReason, "joongna-shadow-worker");

  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const guard = await acquireCronGuardWithSourceHealth("joongna_shadow_worker", req);
  if (!guard.allowed) {
    return NextResponse.json(cronGuardSkipBody(guard));
  }

  const staleMarked = await markStaleCollectRuns(loadPipelineRuntimeConfig().staleRunMinutes);
  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      pipelineMode: "joongna_shadow_worker",
      staleMarkedBeforeRun: staleMarked,
    },
  });
  if (!run.id) {
    guard.release();
    return NextResponse.json(
      { ok: false, mode: "joongna_shadow_worker", error: "supabase_unavailable_before_pipeline", ts: run.startedAt },
      { status: 503 },
    );
  }

  try {
    const result = await runJoongnaShadowIngest({
      params: req.nextUrl.searchParams,
      runId: run.id,
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
      skippedDetails: result.skippedDetails,
      parsedUpserted: result.parsedUpserted,
      observationInserted: result.observationInserted,
      blockedSignals: result.blockedSignals,
      sourceHealthStatus: result.sourceHealthStatus,
      sourceHealthReason: result.sourceHealthReason,
    });
    return NextResponse.json({
      ok: true,
      runId: run.id,
      mode: "joongna_shadow_worker",
      result,
      ts: run.startedAt,
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json(
      {
        ok: false,
        runId: run.id,
        mode: "joongna_shadow_worker",
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
  return handleJoongnaShadowWorker(req);
}
