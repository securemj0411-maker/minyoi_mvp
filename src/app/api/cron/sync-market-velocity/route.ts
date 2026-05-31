// 2026-05-19 P0 fix: velocity 집계 cron 자동화.
//
// 배경: `scripts/sync-market-velocity.mjs`가 psql 의존이라 Vercel cron으로 못 돌림.
//   직전 실행 = 2026-05-11 (수동 npm script 1회). 그 뒤로 8일째 stale.
//   사용자가 보는 "팔리는 속도"는 대부분 폴백 거짓값으로 떨어지고 있었음.
//
// 해결: SQL 로직을 `public.sync_market_velocity_daily()` RPC 함수로 캡슐화 (migration).
//   이 route는 매일 새벽 RPC 1회만 호출. vercel.json crons에 등록.
//
// 운영 노트:
//   - 매일 1회 (UTC 19:00 = KST 04:00) 권장. 트래픽 최저 시간.
//   - 함수 결과 jsonb (upserted_rows, high/medium/low, sold_sample_total)는 응답 body로 반환,
//     vercel cron 로그에서 history 추적.

import { NextResponse, type NextRequest } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { cronProjectRoleSkip } from "@/lib/cron-guard";
import { logAndRespond } from "@/lib/error-response";
import { rpcUrl, serviceHeaders } from "@/lib/supabase-rest";
import { startCollectRun, finishCollectRun, failCollectRun, type CollectRunRequestMeta } from "@/lib/collect-logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 함수 자체는 보통 수 초 ~ 수십 초. raw_listings 커지면 1분 근처 가능. pro 가정 90s.
export const maxDuration = 90;

// Wave 981 (2026-05-31): collect_runs 박음 + monitor. silent fail 차단.
//   배경: 어제 11:36 이후 velocity_daily 갱신 stop (사용자 짚음). route 가 collect_runs 안 박아서
//         silent fail 무방비. 이제 박음 → cron-watchdog/incident-watch 추적 가능.

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.authOk) {
    return NextResponse.json(
      { ok: false, reason: auth.authReason },
      { status: 401 },
    );
  }
  const roleSkip = cronProjectRoleSkip("sync_market_velocity");
  if (roleSkip) return NextResponse.json(roleSkip);

  const meta: CollectRunRequestMeta = {
    triggerSource: (req.headers.get("x-qstash-schedule-id") ?? req.headers.get("user-agent") ?? "sync-market-velocity").slice(0, 120),
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
    authOk: auth.authOk,
    authReason: auth.authReason,
    responseMode: "sync_wait",
    requestMeta: { pipelineMode: "sync_market_velocity" },
  };

  const run = await startCollectRun(meta);
  if (!run.id) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable_before_pipeline", ts: run.startedAt }, { status: 503 });
  }

  const startedAt = new Date();
  try {
    const res = await fetch(rpcUrl("sync_market_velocity_daily"), {
      method: "POST",
      headers: serviceHeaders(),
      body: "{}",
    });
    const bodyText = await res.text();
    if (!res.ok) {
      await failCollectRun(run.id, run.startedAt, new Error(`RPC ${res.status}: ${bodyText.slice(0, 500)}`));
      return NextResponse.json(
        {
          ok: false,
          status: res.status,
          startedAt: startedAt.toISOString(),
          finishedAt: new Date().toISOString(),
          error: bodyText.slice(0, 2000),
        },
        { status: 500 },
      );
    }
    let summary: unknown = null;
    try {
      summary = JSON.parse(bodyText);
    } catch {
      summary = { raw: bodyText.slice(0, 2000) };
    }
    const upserted = typeof summary === "object" && summary !== null && "upserted_rows" in summary ? Number((summary as { upserted_rows?: unknown }).upserted_rows ?? 0) : 0;
    await finishCollectRun(run.id, run.startedAt, {
      collected: 0, titleNormal: 0, enriched: 0, scored: 0,
      aiReviewRequested: 0, aiCacheHits: 0, aiApiCalls: 0,
      aiUnavailable: 0, aiFiltered: 0, aiKeptNormal: 0, aiKeptLowConfidence: 0,
      normal: 0, upserted,
    }, {});
    return NextResponse.json({
      ok: true,
      runId: run.id,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return logAndRespond("cron/sync-market-velocity", err, "cron_sync_market_velocity_failed", {
      context: { startedAt: startedAt.toISOString(), runId: run.id },
    });
  }
}
