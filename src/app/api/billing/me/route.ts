import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      error: "legacy_credit_billing_disabled",
      message: "크레딧 플랜은 종료됐어요. 멤버십 상태를 확인해주세요.",
      redirectTo: "/plans",
    },
    { status: 410 },
  );
}
