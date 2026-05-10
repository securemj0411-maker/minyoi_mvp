import { NextRequest, NextResponse } from "next/server";

import {
  failCollectRun,
  finishCollectRun,
  markStaleCollectRuns,
  startCollectRun,
  type CollectRunRequestMeta,
} from "@/lib/collect-logs";
import { boundedInt, loadPipelineRuntimeConfig } from "@/lib/pipeline-config";
import { runDeepCrawlPipeline } from "@/lib/tick-pipeline";
import type { PipelineResult } from "@/lib/pipeline";

export const maxDuration = 90;

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
    triggerSource: (headers.get("x-qstash-schedule-id") ?? userAgent ?? "deep-crawl").slice(0, 120),
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

function toPipelineResult(result: Awaited<ReturnType<typeof runDeepCrawlPipeline>>): PipelineResult {
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

async function handleDeepCrawl(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const authOk = !secret || auth === `Bearer ${secret}`;
  const meta = requestMeta(req, authOk, authOk ? "authorized" : "invalid_or_missing_bearer");

  if (secret && !authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = loadPipelineRuntimeConfig();
  const staleMarked = await markStaleCollectRuns(config.staleRunMinutes);
  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      pipelineMode: "deep_crawl",
      budgets: {
        search: config.tickSearchBudgetMs,
        detail: config.tickDetailBudgetMs,
        score: config.tickScoreBudgetMs,
      },
      staleMarkedBeforeRun: staleMarked,
    },
  });

  try {
    const pageOverride = req.nextUrl.searchParams.has("page")
      ? boundedInt(req.nextUrl.searchParams.get("page"), 1, 1, config.deepCrawlMaxPage)
      : undefined;
    const result = await runDeepCrawlPipeline(pageOverride);
    await finishCollectRun(run.id, run.startedAt, toPipelineResult(result), {
      stages: result.stages,
      stageDurationsMs: result.stageDurationsMs,
    });
    return NextResponse.json({
      ok: true,
      runId: run.id,
      mode: "deep_crawl",
      result,
      ts: run.startedAt,
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json(
      {
        ok: false,
        runId: run.id,
        mode: "deep_crawl",
        error: err instanceof Error ? err.message : String(err),
        ts: run.startedAt,
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handleDeepCrawl(req);
}

export async function POST(req: NextRequest) {
  return handleDeepCrawl(req);
}
