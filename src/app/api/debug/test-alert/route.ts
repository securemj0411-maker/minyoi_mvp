import { NextRequest, NextResponse } from "next/server";

import { sendOperationalTestAlert } from "@/lib/operational-notifier";

export const maxDuration = 30;

function authorized(req: NextRequest, bodySecret: unknown) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}` || bodySecret === secret;
}

export async function POST(req: NextRequest) {
  let body: { secret?: string } = {};
  try {
    body = (await req.json()) as { secret?: string };
  } catch {
    body = {};
  }

  if (!authorized(req, body.secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result = await sendOperationalTestAlert();
  return NextResponse.json({
    ok: result.sent,
    result,
    testedAt: new Date().toISOString(),
  }, { status: result.sent ? 200 : 500 });
}
