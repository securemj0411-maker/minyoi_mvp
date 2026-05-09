import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import {
  failCollectRun,
  finishCollectRun,
  markStaleCollectRuns,
  startCollectRun,
  type CollectRunRequestMeta,
} from "@/lib/collect-logs";
import { runPipeline, type PipelineOptions } from "@/lib/pipeline";

export const maxDuration = 60;

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null;
  return value.split(",")[0]?.trim() || null;
}

function truncate(value: string | null, max = 500): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function intParam(req: NextRequest, name: string, fallback: number, min: number, max: number) {
  const raw = req.nextUrl.searchParams.get(name);
  const parsed = raw == null ? fallback : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function pipelineConfig(req: NextRequest): { pages: number; options: PipelineOptions } {
  const pages = intParam(req, "pages", 2, 1, 3);
  const detailLimit = intParam(req, "detailLimit", 120, 0, 120);
  const aiTopN = intParam(req, "aiTopN", 30, 0, 30);
  return {
    pages,
    options: {
      detailLimit,
      aiReviewTopN: aiTopN,
      aiReviewEnabled: aiTopN > 0,
    },
  };
}

function requestMeta(req: NextRequest, authOk: boolean, authReason: string): CollectRunRequestMeta {
  const headers = req.headers;
  const waitMode = req.nextUrl.searchParams.get("wait") === "1";
  const userAgent = headers.get("user-agent");
  const cronSource = headers.get("x-cron-source");
  const requestIp =
    firstForwardedIp(headers.get("x-forwarded-for")) ??
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-vercel-forwarded-for");
  const triggerSource = cronSource ?? userAgent ?? "cron";
  const responseMode = waitMode ? "sync_wait" : "background";

  return {
    triggerSource: triggerSource.slice(0, 120),
    requestMethod: req.method,
    requestPath: `${req.nextUrl.pathname}${req.nextUrl.search}`,
    requestHost: headers.get("host"),
    requestIp,
    requestUserAgent: truncate(userAgent),
    requestReferer: truncate(headers.get("referer")),
    requestOrigin: truncate(headers.get("origin")),
    requestVercelId: headers.get("x-vercel-id"),
    requestCountry: headers.get("x-vercel-ip-country"),
    waitMode,
    authOk,
    authReason,
    responseMode,
    requestMeta: {
      cronSource,
      cronJobId: headers.get("x-cron-job-id"),
      forwardedProto: headers.get("x-forwarded-proto"),
      forwardedHost: headers.get("x-forwarded-host"),
      vercelDeploymentUrl: headers.get("x-vercel-deployment-url"),
      vercelRegion: headers.get("x-vercel-ip-country-region"),
      vercelCity: headers.get("x-vercel-ip-city"),
      query: Object.fromEntries(req.nextUrl.searchParams.entries()),
    },
  };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const authOk = !secret || auth === `Bearer ${secret}`;
  const waitForResult = req.nextUrl.searchParams.get("wait") === "1";
  const { pages, options } = pipelineConfig(req);
  const meta = requestMeta(req, authOk, authOk ? "authorized" : "invalid_or_missing_bearer");

  if (secret) {
    if (!authOk) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const staleMarked = await markStaleCollectRuns(3);
  const run = await startCollectRun({
    ...meta,
    requestMeta: {
      ...meta.requestMeta,
      pipelineConfig: { pages, ...options },
      staleMarkedBeforeRun: staleMarked,
    },
  });

  if (waitForResult) {
    try {
      const result = await runPipeline(pages, options);
      await finishCollectRun(run.id, run.startedAt, result);
      return NextResponse.json({ ok: true, started: true, completed: true, runId: run.id, pipelineConfig: { pages, ...options }, result, ts: run.startedAt });
    } catch (err) {
      await failCollectRun(run.id, run.startedAt, err);
      return NextResponse.json(
        { ok: false, started: true, completed: true, runId: run.id, pipelineConfig: { pages, ...options }, error: err instanceof Error ? err.message : String(err), ts: run.startedAt },
        { status: 500 },
      );
    }
  }

  after(async () => {
    try {
      const result = await runPipeline(pages, options);
      await finishCollectRun(run.id, run.startedAt, result);
      console.log("[cron/collect]", result);
    } catch (err) {
      await failCollectRun(run.id, run.startedAt, err);
      console.error("[cron/collect]", err instanceof Error ? err.message : String(err));
    }
  });

  return NextResponse.json({ ok: true, started: true, runId: run.id, pipelineConfig: { pages, ...options }, ts: run.startedAt });
}
