// Wave 106 (2026-05-15): "샀어요/포기" 응답 메커니즘 폐기.
// 정책 변경: 카드 까는 순간 = consumed (open route에서 처리). TTL 만료 = 자동 reroute.
// 정직성 가정에 의존하던 응답 통계는 사용자가 매물 정보 다 본 후에는 의미 없음.
// route는 410 Gone 으로 유지 — 옛 client cache가 호출해도 새 통계 박지 않음.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "deprecated", message: "응답 메커니즘이 폐기됐어요. 카드 열기 = 자동 처리됩니다." },
    { status: 410 },
  );
}
