import { NextRequest, NextResponse } from "next/server";

import { checkCronAuth } from "@/lib/cron-auth";
import { acquireCronGuard, cronGuardSkipBody } from "@/lib/cron-guard";
import { runAiCachePrune } from "@/lib/housekeeper-ai-cache";

export const maxDuration = 60;

async function handle(req: NextRequest) {
  const { authOk } = checkCronAuth(req);
  if (!authOk) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const guard = acquireCronGuard("housekeeper_ai_cache_prune", req);
  if (!guard.allowed) return NextResponse.json(cronGuardSkipBody(guard));

  try {
    const result = await runAiCachePrune();
    return NextResponse.json({
      ok: !result.error,
      mode: "housekeeper-ai-cache-prune",
      result,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        mode: "housekeeper-ai-cache-prune",
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      },
      { status: 500 },
    );
  } finally {
    guard.release();
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
