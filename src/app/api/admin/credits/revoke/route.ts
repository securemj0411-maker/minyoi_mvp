import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "legacy_credits_disabled",
      message: "크레딧 회수 기능은 종료됐어요. 멤버십 상태 관리 기능을 이용해주세요.",
    },
    { status: 410 },
  );
}
