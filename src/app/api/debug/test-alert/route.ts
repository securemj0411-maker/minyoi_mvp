import { NextRequest, NextResponse } from "next/server";

import { requireDebugAdmin } from "@/lib/debug-admin";
import { sendOperationalTestAlert } from "@/lib/operational-notifier";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const auth = await requireDebugAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const result = await sendOperationalTestAlert();
  return NextResponse.json({
    ok: result.sent,
    result,
    testedAt: new Date().toISOString(),
  }, { status: result.sent ? 200 : 500 });
}
