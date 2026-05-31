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
import { runMarketStatsPipeline } from "@/lib/tick-pipeline";
import type { PipelineResult } from "@/lib/pipeline";

// Wave 724 (2026-05-23): max 165s 측정 (Wave 722 시점 163s) → 240s buffer. Pro plan 한도 300s.
//   Wave 722에서 180s로 늘렸으나 spike margin 더 확보.
// Wave 995 (2026-05-31): 240→300 (Vercel Pro max). 30분 안 3/3 fail (duration 379~385s 측정).
//   원인: mvp_raw_listings 더 커지면서 240s 초과. stale 6m 마킹 (wave 989 새 threshold).
//   추가 stage 분리는 별개 wave 후속.
export const maxDuration = 300;

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
    triggerSource: (headers.get("x-qstash-schedule-id") ?? userAgent ?? "market-worker").slice(0, 120),
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

function toPipelineResult(result: Awaited<ReturnType<typeof runMarketStatsPipeline>>): PipelineResult {
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

async function handleMarketWorker(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  const meta = requestMeta(req, authOk, authReason);

  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const guard = await acquireCronGuardWithSourceHealth("market_worker", req);
  if (!guard.allowed) {
    return NextResponse.json(cronGuardSkipBody(guard));
  }

  const config = loadPipelineRuntimeConfig();
  const staleMarked = await markStaleCollectRuns(config.staleRunMinutes);
  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      pipelineMode: "market_worker",
      marketStatsLimit: config.marketStatsLimit,
      staleMarkedBeforeRun: staleMarked,
    },
  });
  if (!run.id) {
    guard.release();
    return NextResponse.json(
      { ok: false, mode: "market_worker", error: "supabase_unavailable_before_pipeline", ts: run.startedAt },
      { status: 503 },
    );
  }

  try {
    const result = await runMarketStatsPipeline();
    await finishCollectRun(run.id, run.startedAt, toPipelineResult(result), {
      stages: result.stages,
      stageDurationsMs: result.stageDurationsMs,
    });
    return NextResponse.json({
      ok: true,
      runId: run.id,
      mode: "market_worker",
      result,
      ts: run.startedAt,
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json(
      {
        ok: false,
        runId: run.id,
        mode: "market_worker",
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
  return handleMarketWorker(req);
}

export async function POST(req: NextRequest) {
  return handleMarketWorker(req);
}
