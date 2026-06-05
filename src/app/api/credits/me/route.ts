import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      error: "legacy_credits_disabled",
      message: "크레딧 제도는 종료됐어요.",
      tokens: 0,
      dailyUsed: 0,
      dailyLimit: null,
      dailyRemaining: null,
      isInfiniteCredits: false,
      freeGrantedAt: null,
    },
    { status: 410 },
  );
}
