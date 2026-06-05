import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "legacy_credit_billing_disabled",
      message: "크레딧 결제 관리는 종료됐어요. 멤버십 관리 페이지를 이용해주세요.",
      redirectTo: "/plans",
    },
    { status: 410 },
  );
}
