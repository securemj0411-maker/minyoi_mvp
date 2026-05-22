// Wave launch-44 (사용자 짚음 "invalidated to ready cron 해결책"):
//   recovery cron 을 score-worker 에서 분리해서 별 worker 로 박음.
//   score-worker 33% timeout 부담 ↓ + recovery 처리량 ↑ (limit 250 → 500).
//   매 1분 작동, lease 60s. 매 호출 limit 500 후보 검증 → score_dirty 마킹.
//
//   기존 chain (그대로):
//     recovery-worker → markRecoveredMarketInvalidatedPoolRowsDirty → raw.score_dirty=true
//     → 다음 score-worker tick → candidate-pool-builder 재평가 → ready or invalidated 갱신.

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
import { recoveryStage } from "@/lib/tick-pipeline";

export const maxDuration = 60;

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null;
  return value.split(",")[0]?.trim() || null;
}

function truncate(value: string | null, max = 500): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}...` : value;
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
    triggerSource: (headers.get("x-qstash-schedule-id") ?? userAgent ?? "recovery-worker").slice(0, 120),
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

async function handleRecoveryWorker(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  const meta = requestMeta(req, authOk, authReason);

  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const guard = await acquireCronGuardWithSourceHealth("recovery_worker", req);
  if (!guard.allowed) {
    return NextResponse.json(cronGuardSkipBody(guard));
  }

  const config = loadPipelineRuntimeConfig();
  const staleMarked = await markStaleCollectRuns(config.staleRunMinutes);
  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      pipelineMode: "recovery_worker",
      staleMarkedBeforeRun: staleMarked,
    },
  });
  if (!run.id) {
    guard.release();
    return NextResponse.json(
      { ok: false, mode: "recovery_worker", error: "supabase_unavailable_before_pipeline", ts: run.startedAt },
      { status: 503 },
    );
  }

  try {
    const result = await recoveryStage();
    await finishCollectRun(run.id, run.startedAt, {
      collected: 0,
      titleNormal: 0,
      enriched: 0,
      scored: 0,
      aiReviewRequested: 0,
      aiCacheHits: 0,
      aiApiCalls: 0,
      aiUnavailable: 0,
      aiFiltered: 0,
      aiKeptNormal: 0,
      aiKeptLowConfidence: 0,
      normal: 0,
      upserted: result.upserted,
    }, {
      stages: { recovery: result },
      stageDurationsMs: { recovery: Date.now() - Date.parse(run.startedAt) },
    });
    return NextResponse.json({
      ok: true,
      runId: run.id,
      mode: "recovery_worker",
      result,
      ts: run.startedAt,
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json(
      {
        ok: false,
        runId: run.id,
        mode: "recovery_worker",
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
  return handleRecoveryWorker(req);
}

export async function POST(req: NextRequest) {
  return handleRecoveryWorker(req);
}
