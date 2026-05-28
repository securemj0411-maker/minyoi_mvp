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
import { runDaangnPriceSweep } from "@/lib/daangn-price-sweep";
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
  return value === "1" || value === "true" || value === "yes";
}

async function handleDaangnPriceSweepWorker(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  const meta = buildCronRequestMeta(req, authOk, authReason, "daangn-price-sweep-worker");

  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const guard = await acquireCronGuardWithSourceHealth("daangn_price_sweep_worker", req);
  if (!guard.allowed) {
    return NextResponse.json(cronGuardSkipBody(guard));
  }

  const staleMarked = await markStaleCollectRuns(loadPipelineRuntimeConfig().staleRunMinutes);
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1" || envBool("DAANGN_PRICE_SWEEP_DRY_RUN", false);
  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      pipelineMode: "daangn_price_sweep_worker",
      staleMarkedBeforeRun: staleMarked,
      dryRun,
      targetSamples: envInt("DAANGN_PRICE_SWEEP_TARGET_SAMPLES", 10, 1, 50),
      maxSkus: envInt("DAANGN_PRICE_SWEEP_MAX_SKUS", 80, 1, 500),
      maxRegions: envInt("DAANGN_PRICE_SWEEP_MAX_REGIONS", 4, 1, 300),
    },
  });
  if (!run.id) {
    guard.release();
    return NextResponse.json(
      { ok: false, mode: "daangn_price_sweep_worker", error: "supabase_unavailable_before_pipeline", ts: run.startedAt },
      { status: 503 },
    );
  }

  try {
    const result = await runDaangnPriceSweep({
      dryRun,
      targetSamples: envInt("DAANGN_PRICE_SWEEP_TARGET_SAMPLES", 10, 1, 50),
      maxSkus: envInt("DAANGN_PRICE_SWEEP_MAX_SKUS", 80, 1, 500),
      maxRegions: envInt("DAANGN_PRICE_SWEEP_MAX_REGIONS", 4, 1, 300),
      maxSearchCombos: envInt("DAANGN_PRICE_SWEEP_MAX_SEARCH_COMBOS", 40, 0, 2000),
      maxCategoryCombos: envInt("DAANGN_PRICE_SWEEP_MAX_CATEGORY_COMBOS", 0, 0, 2000),
      maxDetailFetches: envInt("DAANGN_PRICE_SWEEP_MAX_DETAIL_FETCHES", 100, 0, 1000),
      searchConcurrency: envInt("DAANGN_PRICE_SWEEP_SEARCH_CONCURRENCY", 1, 1, 200),
      detailConcurrency: envInt("DAANGN_PRICE_SWEEP_DETAIL_CONCURRENCY", 2, 1, 50),
      requestDelayMs: envInt("DAANGN_PRICE_SWEEP_REQUEST_DELAY_MS", 350, 0, 30_000),
      abortOnBlockedCombo: envBool("DAANGN_PRICE_SWEEP_ABORT_ON_BLOCKED_COMBO", true),
      regionRotationOffset: envInt("DAANGN_PRICE_SWEEP_REGION_ROTATION_OFFSET", 0, 0, 300),
      timeoutMs: envInt("DAANGN_PRICE_SWEEP_TIMEOUT_MS", 8_000, 1_000, 30_000),
    });

    await finishCollectRunMinimal(run.id, run.startedAt, {
      collected: result.fetchedArticles,
      enriched: result.detailParsed,
      titleNormal: result.matchedArticles,
      upserted: result.rawUpserted,
    }, {
      source: result.source,
      mode: result.mode,
      skipped: result.skipped,
      skipReason: result.skipReason,
      dryRun: result.dryRun,
      targetSamples: result.targetSamples,
      readySkus: result.readySkus,
      deficitSkus: result.deficitSkus,
      selectedSkus: result.selectedSkus,
      regions: result.regions,
      searchCombos: result.searchCombos,
      categoryCombos: result.categoryCombos,
      executedCombos: result.executedCombos,
      fetchedArticles: result.fetchedArticles,
      duplicateArticlesDropped: result.duplicateArticlesDropped,
      matchedArticles: result.matchedArticles,
      selectedArticles: result.selectedArticles,
      detailFetched: result.detailFetched,
      detailParsed: result.detailParsed,
      detailFailed: result.detailFailed,
      rawSkippedExisting: result.rawSkippedExisting,
      marketInvalidationsQueued: result.marketInvalidationsQueued,
      blockedCombos: result.blockedCombos,
      failedCombos: result.failedCombos,
      closedMatched: result.closedMatched,
      activeMatched: result.activeMatched,
      timingsMs: result.timingsMs,
      sampleTargets: result.sampleTargets,
    });

    return NextResponse.json({
      ok: true,
      runId: run.id,
      mode: "daangn_price_sweep_worker",
      result,
      ts: run.startedAt,
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json(
      {
        ok: false,
        runId: run.id,
        mode: "daangn_price_sweep_worker",
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
  return handleDaangnPriceSweepWorker(req);
}
