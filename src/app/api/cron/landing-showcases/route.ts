import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { refreshLandingShowcaseCache } from "@/lib/landing-showcases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const { authOk } = checkCronAuth(req);
  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const count = await refreshLandingShowcaseCache();
    return NextResponse.json({ ok: true, count, refreshedAt: new Date().toISOString() });
  } catch (error) {
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
