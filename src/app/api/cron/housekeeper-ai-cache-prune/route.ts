import { NextRequest, NextResponse } from "next/server";

import {
  buildCronRequestMeta,
  failCollectRun,
  finishCollectRunMinimal,
  startCollectRun,
} from "@/lib/collect-logs";
import { checkCronAuth } from "@/lib/cron-auth";
import { acquireCronGuard, cronGuardSkipBody } from "@/lib/cron-guard";
import { runAiCachePrune } from "@/lib/housekeeper-ai-cache";

export const maxDuration = 60;

async function handle(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  if (!authOk) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const guard = acquireCronGuard("housekeeper_ai_cache_prune", req);
  if (!guard.allowed) return NextResponse.json(cronGuardSkipBody(guard));

  // 2026-05-16: collect-logs 박기. 미박으면 watchdog false positive.
  const meta = buildCronRequestMeta(req, authOk, authReason, "housekeeper-ai-cache-prune");
  const run = await startCollectRun(meta);

  try {
    const result = await runAiCachePrune();
    await finishCollectRunMinimal(run.id, run.startedAt, { upserted: result.deleted }, {
      mode: "housekeeper-ai-cache-prune",
      result: result as unknown as Record<string, unknown>,
    });
    return NextResponse.json({
      ok: !result.error,
      mode: "housekeeper-ai-cache-prune",
      result,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
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
