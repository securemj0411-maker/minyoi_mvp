// Wave 744 (2026-05-24): 레퍼럴 코드 server-side claim endpoint.
//   클라이언트가 localStorage 의 referral code 들고 호출 → 본인 user_id 와 매칭해 referral 처리.
//   가입 방식 무관 (카카오 / 이메일 / 등) 작동. callback 의존 X.
//
// 보안:
//   - requireSupabaseUser 로 본인 인증 필수
//   - createReferralAndGrantSignupBonus 가 self_referral, already_referred 차단
//   - 한 사용자 = 한 번만 referral 받음 (mvp_referrals UNIQUE constraint)
//
// 호출 시점 (client):
//   - 사용자 / 또는 /me 진입 시 ReferralCapture 가 localStorage 확인
//   - 인증된 사용자 + code 있으면 한 번 호출 → 성공 시 localStorage clear

import { NextResponse } from "next/server";
import { createReferralAndGrantSignupBonus } from "@/lib/referral";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await requireSupabaseUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const userRef = userRefForAuthUser(auth.user.id);

    let body: { code?: string } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const code = (body.code ?? "").trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }

    console.log("[api/me/referral/claim] attempt", { code, userId: auth.user.id });

    const result = await createReferralAndGrantSignupBonus({
      referrerCode: code,
      referredUserId: auth.user.id,
      referredUserRef: userRef,
    });

    if (!result.ok) {
      // self_referral / referrer_not_found / already_referred / insert_failed
      console.log("[api/me/referral/claim] skipped", { reason: result.error, code, userId: auth.user.id });
      return NextResponse.json({ ok: false, error: result.error });
    }

    console.log("[api/me/referral/claim] granted", { code, userId: auth.user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/me/referral/claim] failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
