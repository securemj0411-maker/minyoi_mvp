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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 함수 자체는 보통 수 초 ~ 수십 초. raw_listings 커지면 1분 근처 가능. pro 가정 90s.
export const maxDuration = 90;

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

  const startedAt = new Date();
  try {
    const res = await fetch(rpcUrl("sync_market_velocity_daily"), {
      method: "POST",
      headers: serviceHeaders(),
      body: "{}",
    });
    const bodyText = await res.text();
    if (!res.ok) {
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
    return NextResponse.json({
      ok: true,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    return logAndRespond("cron/sync-market-velocity", err, "cron_sync_market_velocity_failed", {
      context: { startedAt: startedAt.toISOString() },
    });
  }
}
