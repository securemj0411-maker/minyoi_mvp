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
import { runDaangnIngest } from "@/lib/daangn-ingest";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";

export const maxDuration = 300;

function envBool(name: string, fallback: boolean): boolean {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function envInt(names: string[], fallback: number, min: number, max: number): number {
  for (const name of names) {
    const parsed = Number.parseInt(process.env[name] ?? "", 10);
    if (Number.isFinite(parsed)) return Math.max(min, Math.min(max, parsed));
  }
  return fallback;
}

function daangnWorkerBBudgetMs() {
  return envInt(["DAANGN_INGEST_B_BUDGET_MS", "DAANGN_INGEST_BUDGET_MS"], 40_000, 5_000, 55_000);
}

async function handleDaangnWorkerB(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  const meta = buildCronRequestMeta(req, authOk, authReason, "daangn-worker-b");

  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!envBool("DAANGN_WORKER_B_ENABLED", true)) {
    return NextResponse.json({ ok: true, started: false, skipped: true, mode: "daangn_worker_b", reason: "disabled" });
  }

  const guard = await acquireCronGuardWithSourceHealth("daangn_worker_b", req);
  if (!guard.allowed) {
    return NextResponse.json(cronGuardSkipBody(guard));
  }

  const budgetMs = daangnWorkerBBudgetMs();
  const staleMarked = await markStaleCollectRuns(loadPipelineRuntimeConfig().staleRunMinutes);
  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      pipelineMode: "daangn_worker_b",
      budgets: { daangn: budgetMs },
      staleMarkedBeforeRun: staleMarked,
    },
  });
  if (!run.id) {
    guard.release();
    return NextResponse.json(
      { ok: false, mode: "daangn_worker_b", error: "supabase_unavailable_before_pipeline", ts: run.startedAt },
      { status: 503 },
    );
  }

  try {
    const useRegionFirehoseEnv = process.env.DAANGN_INGEST_B_USE_REGION_FIREHOSE ?? process.env.DAANGN_INGEST_USE_REGION_FIREHOSE;
    const result = await runDaangnIngest({
      maxCombos: envInt(["DAANGN_INGEST_B_MAX_COMBOS", "DAANGN_INGEST_MAX_COMBOS"], 267, 1, 300),
      maxDetailSamples: envInt(["DAANGN_INGEST_B_MAX_DETAIL_SAMPLES", "DAANGN_INGEST_MAX_DETAIL_SAMPLES"], 8, 0, 100),
      delayMs: envInt(["DAANGN_INGEST_B_DELAY_MS", "DAANGN_INGEST_DELAY_MS"], 400, 200, 5000),
      activeWindowHours: envInt(["DAANGN_INGEST_B_ACTIVE_HOURS", "DAANGN_INGEST_ACTIVE_HOURS"], 72, 1, 720),
      freshWindowHours: envInt(["DAANGN_INGEST_B_FRESH_HOURS", "DAANGN_INGEST_FRESH_HOURS"], 24, 1, 168),
      timeoutMs: envInt(["DAANGN_INGEST_B_TIMEOUT_MS", "DAANGN_INGEST_TIMEOUT_MS"], 5_000, 1_000, 30_000),
      maxUpsertArticles: envInt(["DAANGN_INGEST_B_MAX_UPSERT_ARTICLES", "DAANGN_INGEST_MAX_UPSERT_ARTICLES"], 800, 0, 5_000),
      categoryBoostRegions: envInt(["DAANGN_INGEST_B_CATEGORY_BOOST_REGIONS"], 30, 0, 30),
      searchConcurrency: envInt(["DAANGN_INGEST_B_SEARCH_CONCURRENCY", "DAANGN_INGEST_SEARCH_CONCURRENCY"], 50, 1, 300),
      regionShardCount: envInt(["DAANGN_INGEST_B_REGION_SHARD_COUNT", "DAANGN_INGEST_REGION_SHARD_COUNT"], 2, 1, 20),
      regionShardIndex: envInt(["DAANGN_INGEST_B_REGION_SHARD_INDEX"], 1, 0, 19),
      useRegionFirehose: useRegionFirehoseEnv === "false" ? false : undefined,
    });

    await finishCollectRunMinimal(run.id, run.startedAt, {
      collected: result.articles,
      enriched: result.detailParsed,
      titleNormal: result.uniqueOngoingUrls,
      upserted: result.rawUpserted,
    }, {
      source: result.source,
      lane: "b",
      mode: result.mode,
      skipped: result.skipped,
      skipReason: result.skipReason,
      combos: result.combos,
      regionShardCount: result.regionShardCount,
      regionShardIndex: result.regionShardIndex,
      regionShardRegions: result.regionShardRegions,
      regionSelectionMode: result.regionSelectionMode,
      adaptiveRegionScoreRegions: result.adaptiveRegionScoreRegions,
      searchConcurrency: result.searchConcurrency,
      executedCombos: result.executedCombos,
      blockedCombos: result.blockedCombos,
      failedCombos: result.failedCombos,
      filteredArticles: result.filteredArticles,
      duplicateArticlesDropped: result.duplicateArticlesDropped,
      articlesDroppedByCategory: result.articlesDroppedByCategory,
      articlesMissingCategory: result.articlesMissingCategory,
      categoryFilterDropRatio: result.categoryFilterDropRatio,
      catalogHintArticles: result.catalogHintArticles,
      articlesDroppedByCatalogHint: result.articlesDroppedByCatalogHint,
      maxUpsertArticles: result.maxUpsertArticles,
      upsertCandidateArticles: result.upsertCandidateArticles,
      articlesDeferredByUpsertCap: result.articlesDeferredByUpsertCap,
      categoryBoostRegions: result.categoryBoostRegions,
      categoryBoostCombos: result.categoryBoostCombos,
      categoryBoostAdaptivePairs: result.categoryBoostAdaptivePairs,
      regionYieldStats: result.regionYieldStats,
      categoryYieldStats: result.categoryYieldStats,
      ongoing: result.ongoing,
      crawlAllowedOngoing: result.crawlAllowedOngoing,
      freshBoosted24h: result.freshBoosted24h,
      activeBoosted72h: result.activeBoosted72h,
      detailCandidates: result.detailCandidates,
      detailFetched: result.detailFetched,
      detailFailed: result.detailFailed,
      shipping: result.shipping,
      rawSkippedExisting: result.rawSkippedExisting,
      blockedSignals: result.blockedSignals,
      sourceHealthStatus: result.sourceHealthStatus,
      sourceHealthReason: result.sourceHealthReason,
      durationMs: result.durationMs,
      timingsMs: result.timingsMs,
    });

    return NextResponse.json({
      ok: true,
      runId: run.id,
      mode: "daangn_worker_b",
      result,
      ts: run.startedAt,
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json(
      {
        ok: false,
        runId: run.id,
        mode: "daangn_worker_b",
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
  return handleDaangnWorkerB(req);
}
