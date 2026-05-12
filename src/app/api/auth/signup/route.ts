import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "이메일 가입은 중단했어요. 카카오 로그인만 지원합니다.",
    },
    { status: 410 },
  );
}
