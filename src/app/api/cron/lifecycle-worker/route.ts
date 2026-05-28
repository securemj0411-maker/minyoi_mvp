import { NextRequest, NextResponse } from "next/server";

import {
  failCollectRun,
  finishCollectRun,
  markStaleCollectRuns,
  startCollectRun,
  type CollectRunRequestMeta,
} from "@/lib/collect-logs";
import { checkCronAuth } from "@/lib/cron-auth";
import {
  acquireCronGuardWithSourceHealth,
  cronGuardSkipBody,
  type CronGuardAllowed,
  type CronWorkerMode,
} from "@/lib/cron-guard";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";
import { runLifecycleWorkerPipeline } from "@/lib/tick-pipeline";
import type { PipelineResult } from "@/lib/pipeline";

// Wave 724 (2026-05-23): max 106s 측정 (90s 이미 초과) → 180s. duplicate invocation 별 별 분석 필요.
export const maxDuration = 180;

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null;
  return value.split(",")[0]?.trim() || null;
}

function truncate(value: string | null, max = 500): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function envBool(name: string, fallback: boolean): boolean {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes" || value === "on";
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
    triggerSource: (headers.get("x-qstash-schedule-id") ?? userAgent ?? "lifecycle-worker").slice(0, 120),
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

function toPipelineResult(result: Awaited<ReturnType<typeof runLifecycleWorkerPipeline>>): PipelineResult {
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

function isTerminalRecheckMode(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("mode") ?? req.nextUrl.searchParams.get("target");
  return raw === "terminal-recheck" || raw === "terminal_recheck";
}

function lifecycleGuardMode(terminalRecheck: boolean): CronWorkerMode {
  return terminalRecheck ? "lifecycle_terminal_recheck" : "lifecycle_worker";
}

type LifecycleRunOutcome = {
  status: number;
  body: Record<string, unknown>;
};

async function executeLifecycleRun(
  meta: CollectRunRequestMeta,
  guard: CronGuardAllowed,
  guardMode: CronWorkerMode,
  terminalRecheck: boolean,
  requestMetaExtras: Record<string, unknown> = {},
): Promise<LifecycleRunOutcome> {
  const config = loadPipelineRuntimeConfig();
  const staleMarked = await markStaleCollectRuns(config.staleRunMinutes);
  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      ...requestMetaExtras,
      pipelineMode: guardMode,
      lifecycleMode: terminalRecheck ? "terminal_recheck" : "default",
      budgets: {
        detail: config.tickDetailBudgetMs,
      },
      staleMarkedBeforeRun: staleMarked,
    },
  });
  if (!run.id) {
    guard.release();
    return {
      status: 503,
      body: { ok: false, mode: guardMode, error: "supabase_unavailable_before_pipeline", ts: run.startedAt },
    };
  }

  try {
    const result = await runLifecycleWorkerPipeline({ terminalRecheck });
    await finishCollectRun(run.id, run.startedAt, toPipelineResult(result), {
      stages: result.stages,
      stageDurationsMs: result.stageDurationsMs,
    });
    return {
      status: 200,
      body: {
        ok: true,
        runId: run.id,
        mode: guardMode,
        lifecycleMode: terminalRecheck ? "terminal_recheck" : "default",
        result,
        ts: run.startedAt,
      },
    };
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return {
      status: 500,
      body: {
        ok: false,
        runId: run.id,
        mode: guardMode,
        error: err instanceof Error ? err.message : String(err),
        ts: run.startedAt,
      },
    };
  } finally {
    guard.release();
  }
}

async function handleLifecycleWorker(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  const meta = requestMeta(req, authOk, authReason);
  const terminalRecheck = isTerminalRecheckMode(req);
  const guardMode = lifecycleGuardMode(terminalRecheck);

  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const guard = await acquireCronGuardWithSourceHealth(guardMode, req);
  if (!guard.allowed) {
    return NextResponse.json(cronGuardSkipBody(guard));
  }

  const outcome = await executeLifecycleRun(meta, guard, guardMode, terminalRecheck);

  if (terminalRecheck || outcome.status !== 200) {
    return NextResponse.json(outcome.body, { status: outcome.status });
  }

  // Wave 915: terminal claim RPC is timing out in production and creating
  // failed collect runs after successful lifecycle sweeps. Keep explicit
  // ?mode=terminal-recheck available, but stop embedding it until the DB-side
  // claim path is indexed/reworked.
  if (!envBool("PIPELINE_EMBEDDED_TERMINAL_RECHECK_ENABLED", false)) {
    return NextResponse.json({
      ...outcome.body,
      terminalRecheck: {
        ok: true,
        skipped: true,
        reason: "embedded_terminal_recheck_disabled",
      },
    });
  }

  const terminalGuardMode: CronWorkerMode = "lifecycle_terminal_recheck";
  const terminalGuard = await acquireCronGuardWithSourceHealth(terminalGuardMode, req);
  if (!terminalGuard.allowed) {
    return NextResponse.json({
      ...outcome.body,
      terminalRecheck: cronGuardSkipBody(terminalGuard),
    });
  }

  const terminalOutcome = await executeLifecycleRun(
    meta,
    terminalGuard,
    terminalGuardMode,
    true,
    {
      embeddedIn: "lifecycle_worker",
      embeddedTriggerPath: meta.requestPath,
    },
  );

  return NextResponse.json({
    ...outcome.body,
    terminalRecheck: terminalOutcome.body,
  });
}

export async function GET(req: NextRequest) {
  return handleLifecycleWorker(req);
}

export async function POST(req: NextRequest) {
  return handleLifecycleWorker(req);
}
