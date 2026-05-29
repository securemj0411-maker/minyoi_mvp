import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Legacy pack opening has been superseded by /api/packs/pool/detail-access.
// Keeping this endpoint active would let direct callers reveal multiple exact
// listings with the old pack pricing model, bypassing the current 1 detail = 1
// credit contract.
export async function POST() {
  return NextResponse.json(
    {
      error: "legacy_pack_open_disabled",
      message: "추천 팩 열기는 종료됐어요. /me 피드에서 매물별 상세 분석을 열어주세요.",
    },
    { status: 410 },
  );
}
