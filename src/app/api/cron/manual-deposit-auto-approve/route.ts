import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  return NextResponse.json({
    ok: true,
    disabled: true,
    reason: "legacy_credit_manual_deposit_disabled",
    processed: 0,
  });
}

export async function POST() {
  return GET();
}
