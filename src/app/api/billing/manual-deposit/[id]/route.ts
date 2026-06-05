import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      error: "legacy_credit_billing_disabled",
      redirectTo: "/plans",
    },
    { status: 410 },
  );
}
