import { NextRequest, NextResponse } from "next/server";
import {
  buildCronRequestMeta,
  failCollectRun,
  finishCollectRunMinimal,
  startCollectRun,
} from "@/lib/collect-logs";
import { checkCronAuth } from "@/lib/cron-auth";
import { refreshPreviewPoolCache } from "@/lib/preview-pool-showcases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const meta = buildCronRequestMeta(req, authOk, authReason, "preview-pool");
  const run = await startCollectRun(meta);

  try {
    const result = await refreshPreviewPoolCache();
    await finishCollectRunMinimal(run.id, run.startedAt, { upserted: result.count }, result);
    return NextResponse.json({ ok: true, ...result, refreshedAt: new Date().toISOString() });
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
