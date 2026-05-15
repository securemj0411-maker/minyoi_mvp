// Wave 93b: 핫딜 워커. enqueue + dispatch 한 번에.
// 권장 cron 주기: 5분.
// QStash schedule 등록 필요 (Vercel cron config 없음).

import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { acquireCronGuard, cronGuardSkipBody } from "@/lib/cron-guard";
import { dispatchAvailableHotdeals, enqueueHotdealsFromPool } from "@/lib/hotdeal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const { authOk } = checkCronAuth(req);
  if (!authOk) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const guard = acquireCronGuard("hotdeal_worker", req);
  if (!guard.allowed) return NextResponse.json(cronGuardSkipBody(guard));

  const startedAt = new Date().toISOString();
  try {
    const enqueue = await enqueueHotdealsFromPool();
    const dispatch = await dispatchAvailableHotdeals();
    return NextResponse.json({
      ok: true,
      ts: startedAt,
      enqueue,
      dispatch,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      ts: startedAt,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  } finally {
    guard.release();
  }
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
