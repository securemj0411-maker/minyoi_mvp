// Daangn worker — Phase 4 cron endpoint.
//
// Schedule: 5분 마다 (vercel.json `*/5 * * * *`).
// Mode gate: DAANGN_SOURCE_MODE env ("off"/"probe"/"active").
//   - "off"     → 자동 skip (default)
//   - "probe"   → dry-run (DB write 안 함)
//   - "active"  → 실제 raw_listings upsert (Shadow Mode — pool_eligible=false 유지)
//
// 안전:
//   - cron-auth 체크
//   - DB lock (daangn_worker) — 동시 실행 방지
//   - blockedSignals 감지 시 source_health 갱신
//   - budget timeout 75s (Vercel cron max 60s 안쪽으로 안전 마진)

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

// Phase 6i+ budget fix: 80s → 300s (Vercel Pro 한도).
//   1 region 247 매물 upsert 가 60s 소모 (Supabase REST throughput).
//   maxCombos 1→5 가능하려면 maxDuration up 필요.
export const maxDuration = 300;

function envInt(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function daangnWorkerBudgetMs() {
  // Phase 6f: env 의존 제거. 코드 default 40s 고정.
  return 40_000;
}

async function handleDaangnWorker(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  const meta = buildCronRequestMeta(req, authOk, authReason, "daangn-worker");

  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const guard = await acquireCronGuardWithSourceHealth("daangn_worker", req);
  if (!guard.allowed) {
    return NextResponse.json(cronGuardSkipBody(guard));
  }

  const budgetMs = daangnWorkerBudgetMs();
  const staleMarked = await markStaleCollectRuns(loadPipelineRuntimeConfig().staleRunMinutes);
  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      pipelineMode: "daangn_worker",
      budgets: { daangn: budgetMs },
      staleMarkedBeforeRun: staleMarked,
    },
  });
  if (!run.id) {
    guard.release();
    return NextResponse.json(
      { ok: false, mode: "daangn_worker", error: "supabase_unavailable_before_pipeline", ts: run.startedAt },
      { status: 503 },
    );
  }

  try {
    const useRegionFirehoseEnv = process.env.DAANGN_INGEST_USE_REGION_FIREHOSE;
    const result = await runDaangnIngest({
      // env 가 source mode 결정. fetch 규모는 운영 fallback 이 필요해서 env override 를 유지한다.
      maxCombos: envInt("DAANGN_INGEST_MAX_COMBOS", 267, 1, 300),
      maxDetailSamples: envInt("DAANGN_INGEST_MAX_DETAIL_SAMPLES", 5, 0, 100),
      delayMs: envInt("DAANGN_INGEST_DELAY_MS", 400, 200, 5000),
      activeWindowHours: envInt("DAANGN_INGEST_ACTIVE_HOURS", 72, 1, 720),
      freshWindowHours: envInt("DAANGN_INGEST_FRESH_HOURS", 24, 1, 168),
      timeoutMs: envInt("DAANGN_INGEST_TIMEOUT_MS", 5_000, 1_000, 30_000),
      maxUpsertArticles: envInt("DAANGN_INGEST_MAX_UPSERT_ARTICLES", 500, 0, 5_000),
      searchConcurrency: envInt("DAANGN_INGEST_SEARCH_CONCURRENCY", 50, 1, 300),
      useRegionFirehose: useRegionFirehoseEnv === "false" ? false : undefined,
    });

    await finishCollectRunMinimal(run.id, run.startedAt, {
      collected: result.articles,
      enriched: result.detailParsed,
      titleNormal: result.uniqueOngoingUrls,
      upserted: result.rawUpserted,
    }, {
      source: result.source,
      mode: result.mode,
      skipped: result.skipped,
      skipReason: result.skipReason,
      combos: result.combos,
      searchConcurrency: result.searchConcurrency,
      executedCombos: result.executedCombos,
      blockedCombos: result.blockedCombos,
      failedCombos: result.failedCombos,
      filteredArticles: result.filteredArticles,
      articlesDroppedByCategory: result.articlesDroppedByCategory,
      articlesMissingCategory: result.articlesMissingCategory,
      categoryFilterDropRatio: result.categoryFilterDropRatio,
      catalogHintArticles: result.catalogHintArticles,
      articlesDroppedByCatalogHint: result.articlesDroppedByCatalogHint,
      maxUpsertArticles: result.maxUpsertArticles,
      upsertCandidateArticles: result.upsertCandidateArticles,
      articlesDeferredByUpsertCap: result.articlesDeferredByUpsertCap,
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
      timingsMs: result.timingsMs,  // Phase 6i+++ — 병목 식별용
    });

    return NextResponse.json({
      ok: true,
      runId: run.id,
      mode: "daangn_worker",
      result,
      ts: run.startedAt,
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json(
      {
        ok: false,
        runId: run.id,
        mode: "daangn_worker",
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
  return handleDaangnWorker(req);
}
