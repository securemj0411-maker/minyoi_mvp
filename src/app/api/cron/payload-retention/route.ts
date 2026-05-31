// Wave 994 (2026-05-31): payload retention 별도 cron 분리.
//   배경: housekeeper 가 매 30분 cron 으로 3 stage (expire_mvp_plans + cadence evaluator + payload retention)
//         동시 처리 → maxDuration 180s (wave 982) 도 초과해서 6분 stale fail (wave 989 새 threshold).
//   본질: 가장 무거운 stage (payload retention 90일 누적) 별도 cron 으로 분리.
//   trade-off: 신규 cron 1개 (Vercel 22→23 / Pro 40 한도). 운영 위험 0 (분리만).

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
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const maxDuration = 180;

const PAYLOAD_RETENTION_COOLDOWN_MS = 24 * 60 * 60_000;
const PAYLOAD_RETENTION_DAYS = 90;
const PAYLOAD_RETENTION_BATCH_LIMIT = 50_000;

async function shouldRunPayloadRetention(): Promise<boolean> {
  try {
    const res = await restFetch(
      `${tableUrl("mvp_cron_locks")}?select=lease_until&mode=eq.payload_retention_sweep&limit=1`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as Array<{ lease_until: string | null }>;
    const leaseUntil = rows[0]?.lease_until ?? null;
    if (!leaseUntil) return true;
    return Date.parse(leaseUntil) <= Date.now();
  } catch {
    return false;
  }
}

async function recordPayloadRetentionRun(): Promise<void> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + PAYLOAD_RETENTION_COOLDOWN_MS);
  try {
    await restFetch(
      `${tableUrl("mvp_cron_locks")}?on_conflict=mode`,
      {
        method: "POST",
        headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
        body: jsonBody([{
          mode: "payload_retention_sweep",
          owner: "payload-retention",
          acquired_at: now.toISOString(),
          lease_until: leaseUntil.toISOString(),
        }]),
      },
    );
  } catch (err) {
    console.error("[payload-retention] failed to record cooldown marker", err);
  }
}

async function runPayloadRetention(): Promise<number> {
  const res = await restFetch(rpcUrl("prune_listing_observation_payloads"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({ p_days: PAYLOAD_RETENTION_DAYS, p_batch_limit: PAYLOAD_RETENTION_BATCH_LIMIT }),
  });
  const body = await res.text();
  const parsed = Number.parseInt(body.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  if (!authOk) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const meta: CollectRunRequestMeta = {
    triggerSource: (req.headers.get("x-qstash-schedule-id") ?? req.headers.get("user-agent") ?? "payload-retention").slice(0, 120),
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
    requestMeta: { pipelineMode: "payload_retention" },
  };

  const config = loadPipelineRuntimeConfig();
  await markStaleCollectRuns(config.staleRunMinutes);
  const run = await startCollectRun(meta);
  if (!run.id) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable_before_pipeline" }, { status: 503 });
  }

  try {
    if (!(await shouldRunPayloadRetention())) {
      await finishCollectRun(run.id, run.startedAt, {
        collected: 0, titleNormal: 0, enriched: 0, scored: 0,
        aiReviewRequested: 0, aiCacheHits: 0, aiApiCalls: 0,
        aiUnavailable: 0, aiFiltered: 0, aiKeptNormal: 0, aiKeptLowConfidence: 0,
        normal: 0, upserted: 0,
      }, { stages: {}, stageDurationsMs: { skip_cooldown: 1 } });
      return NextResponse.json({ ok: true, runId: run.id, skipped: "cooldown" });
    }

    const deleted = await runPayloadRetention();
    await recordPayloadRetentionRun();
    await finishCollectRun(run.id, run.startedAt, {
      collected: 0, titleNormal: 0, enriched: 0, scored: 0,
      aiReviewRequested: 0, aiCacheHits: 0, aiApiCalls: 0,
      aiUnavailable: 0, aiFiltered: 0, aiKeptNormal: 0, aiKeptLowConfidence: 0,
      normal: 0, upserted: deleted,
    }, { stages: {}, stageDurationsMs: { payload_retention_deleted: deleted } });
    return NextResponse.json({ ok: true, runId: run.id, deleted });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
