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

export const maxDuration = 80;

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
    const result = await runDaangnIngest({
      // env 가 source mode 결정. options 로 강제 가능하지만 운영은 env 우선.
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
      executedCombos: result.executedCombos,
      blockedCombos: result.blockedCombos,
      failedCombos: result.failedCombos,
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
