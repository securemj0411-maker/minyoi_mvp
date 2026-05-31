// Wave 980 (2026-05-31): daangn lifecycle backfill cron.
//   배경: mvp_raw_listings 에 source='daangn' AND listing_state='active' 매물 363k 중 7k만
//         lifecycle 시드. MCP/PostgREST 일회성 INSERT 1k 도 timeout (statement_timeout > 클라이언트 timeout).
//   설계: 별도 cron route 가 PG RPC 호출 (chunk INSERT). PG 안에서 LIMIT 5000 단일 statement 라
//         빠르게 끝남. 매 5분 호출, 73 cycle ~ 6시간 안 363k 다 시드.
//   spread: next_check_at = NOW() + RANDOM() * 7days. 7일 cycle 균등 분산 → lifecycle worker
//         capacity 28,800/h 안에 fit, 신규 매물 처리 부담 없음.

import { NextRequest, NextResponse } from "next/server";

import {
  failCollectRun,
  finishCollectRun,
  markStaleCollectRuns,
  startCollectRun,
  type CollectRunRequestMeta,
} from "@/lib/collect-logs";
import { checkCronAuth } from "@/lib/cron-auth";
import { jsonBody, restFetch, rpcUrl, serviceHeaders } from "@/lib/supabase-rest";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";

// Wave 982 follow-up (2026-05-31): 60s → 180s + chunk default 5000 → 2000.
//   원인: 5k INSERT 가 PG 55s 안 끝나면 route 60s 안 finish 못 함 → stale 3m 마킹.
//   180s + 2k chunk 로 안전 margin. capacity 12회/h × 2k × 3 lane = 72k/h (363k 약 5h 안 해소).
export const maxDuration = 180;

function envInt(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (Number.isFinite(parsed)) return Math.max(min, Math.min(max, parsed));
  return fallback;
}

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
    triggerSource: (headers.get("x-qstash-schedule-id") ?? userAgent ?? "daangn-lifecycle-backfill").slice(0, 120),
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
      query: Object.fromEntries(req.nextUrl.searchParams.entries()),
    },
  };
}

async function handle(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  if (!authOk) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const meta = requestMeta(req, authOk, authReason);
  const config = loadPipelineRuntimeConfig();
  const staleMarked = await markStaleCollectRuns(config.staleRunMinutes);
  const chunkSize = envInt("DAANGN_LIFECYCLE_BACKFILL_CHUNK", 2000, 100, 20000);

  const run = await startCollectRun({
    ...meta,
    requestMeta: { ...meta.requestMeta, pipelineMode: "daangn_lifecycle_backfill", chunkSize, staleMarkedBeforeRun: staleMarked },
  });
  if (!run.id) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable_before_pipeline", ts: run.startedAt }, { status: 503 });
  }

  try {
    const res = await restFetch(rpcUrl("wave978_backfill_daangn_lifecycle_chunk"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({ p_chunk_size: chunkSize }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`backfill RPC failed ${res.status}: ${text.slice(0, 500)}`);
    }
    const inserted = Number((await res.json()) ?? 0);
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
      upserted: inserted,
    }, {});
    return NextResponse.json({ ok: true, runId: run.id, inserted, chunkSize, ts: run.startedAt });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json({ ok: false, runId: run.id, error: err instanceof Error ? err.message : String(err), ts: run.startedAt }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
