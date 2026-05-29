import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Historical welcome-pack endpoint. The /me onboarding flow no longer calls it,
// and leaving it callable would grant exact listings outside the current credit
// model. Keep the route as an explicit tombstone for old clients.
export async function POST() {
  return NextResponse.json(
    {
      error: "legacy_welcome_pack_disabled",
      message: "가입 환영팩은 종료됐어요. /me 피드에서 오늘 추천 매물을 확인해주세요.",
    },
    { status: 410 },
  );
}
