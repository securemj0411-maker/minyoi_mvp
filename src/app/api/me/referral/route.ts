// Wave 731 (2026-05-24): 사용자 추천 코드 + 추천 현황 fetch.
// `/invite` 페이지 + 카카오 공유 버튼에서 사용.

import { NextResponse } from "next/server";
import { ensureReferralCode, getReferralStats } from "@/lib/referral";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireSupabaseUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const userRef = userRefForAuthUser(auth.user.id);

    // referral_code 없으면 생성 (idempotent)
    const code = await ensureReferralCode(auth.user.id, userRef);
    if (!code) {
      console.error("[api/me/referral] ensureReferralCode returned null");
      return NextResponse.json({ error: "code_generation_failed" }, { status: 500 });
    }

    const stats = await getReferralStats(auth.user.id);

    return NextResponse.json({
      code,
      stats,
    });
  } catch (err) {
    console.error("[api/me/referral] failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
