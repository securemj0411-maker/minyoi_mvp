import { NextRequest, NextResponse } from "next/server";
import {
  buildCronRequestMeta,
  failCollectRun,
  finishCollectRunMinimal,
  startCollectRun,
} from "@/lib/collect-logs";
import { checkCronAuth } from "@/lib/cron-auth";
import { refreshLandingShowcaseCache } from "@/lib/landing-showcases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2026-05-16: collect-logs 박기. 미박으면 watchdog false positive.
  const meta = buildCronRequestMeta(req, authOk, authReason, "landing-showcases");
  const run = await startCollectRun(meta);

  try {
    const count = await refreshLandingShowcaseCache();
    await finishCollectRunMinimal(run.id, run.startedAt, { upserted: count });
    return NextResponse.json({ ok: true, count, refreshedAt: new Date().toISOString() });
  } catch (error) {
    await failCollectRun(run.id, run.startedAt, error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
