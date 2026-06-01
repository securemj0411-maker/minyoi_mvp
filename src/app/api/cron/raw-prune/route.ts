// Wave 1001 (2026-06-01): 90일+ raw_listings sold/disappeared row DELETE cron.
//   배경: compliance-retention 은 TEXT 만 비움 (row 보존). raw_listings 934k 누적 → 모든 stage 무거움.
//   사용자 정책: "90일 지나면 죽임. 시세는 velocity_daily 에 누적되어 시세 손실 X".
//   보호: prune_raw_listings_dead_rows RPC 안에서 사용자 reveal/feedback 매물 자동 제외 (NOT IN).
//   timeout 시: route 실패 마킹 (collect_runs fail) — 다음날 또 시도. 천천히 누적 정리.

import { NextRequest, NextResponse } from "next/server";

import {
  failCollectRun,
  finishCollectRun,
  markStaleCollectRuns,
  startCollectRun,
  type CollectRunRequestMeta,
} from "@/lib/collect-logs";
import { checkCronAuth } from "@/lib/cron-auth";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";
import { jsonBody, restFetch, rpcUrl, serviceHeaders } from "@/lib/supabase-rest";

export const maxDuration = 300;

const RAW_PRUNE_DAYS = 90;
const RAW_PRUNE_BATCH_LIMIT = 5000;

async function handle(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  if (!authOk) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const meta: CollectRunRequestMeta = {
    triggerSource: (req.headers.get("x-qstash-schedule-id") ?? req.headers.get("user-agent") ?? "raw-prune").slice(0, 120),
    requestMethod: req.method,
    requestPath: `${req.nextUrl.pathname}${req.nextUrl.search}`,
    requestHost: req.headers.get("host"),
    requestIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    requestUserAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    requestReferer: req.headers.get("referer")?.slice(0, 500) ?? null,
    requestOrigin: req.headers.get("origin")?.slice(0, 500) ?? null,
    requestVercelId: req.headers.get("x-vercel-id"),
    requestCountry: req.headers.get("x-vercel-ip-country"),
    waitMode: true,
    authOk,
    authReason,
    responseMode: "sync_wait",
    requestMeta: { pipelineMode: "raw_prune", days: RAW_PRUNE_DAYS, batchLimit: RAW_PRUNE_BATCH_LIMIT },
  };

  const config = loadPipelineRuntimeConfig();
  await markStaleCollectRuns(config.staleRunMinutes);
  const run = await startCollectRun(meta);
  if (!run.id) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable_before_pipeline" }, { status: 503 });
  }

  try {
    const res = await restFetch(rpcUrl("prune_raw_listings_dead_rows"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({
        p_days: RAW_PRUNE_DAYS,
        p_batch_limit: RAW_PRUNE_BATCH_LIMIT,
        p_dry_run: false,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`prune RPC failed ${res.status}: ${text.slice(0, 500)}`);
    }
    const deleted = Number((await res.text()).trim()) || 0;
    await finishCollectRun(run.id, run.startedAt, {
      collected: 0, titleNormal: 0, enriched: 0, scored: 0,
      aiReviewRequested: 0, aiCacheHits: 0, aiApiCalls: 0,
      aiUnavailable: 0, aiFiltered: 0, aiKeptNormal: 0, aiKeptLowConfidence: 0,
      normal: 0, upserted: deleted,
    }, { stageDurationsMs: { raw_prune_deleted: deleted } });
    return NextResponse.json({ ok: true, runId: run.id, deleted });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json({ ok: false, runId: run.id, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
