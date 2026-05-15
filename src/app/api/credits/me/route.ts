import { NextResponse } from "next/server";
import { isEffectiveAdmin } from "@/lib/auth-users";
import { checkRateLimit } from "@/lib/rate-limit";
import { claimUserCredits, getUserCreditsReadOnly } from "@/lib/user-credits";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_MAX = Math.max(1, Number(process.env.CREDITS_ME_RATE_LIMIT_MAX ?? 30));
const RATE_LIMIT_WINDOW_SECONDS = Math.max(1, Number(process.env.CREDITS_ME_RATE_LIMIT_WINDOW_SECONDS ?? 10));

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);

  if (!isEffectiveAdmin(auth.user, req)) {
    const rate = await checkRateLimit({
      bucketKey: `credits.me:user:${userRef}`,
      maxRequests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: rate.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
  }

  try {
    // 1. SELECT 우선 시도 (기존 사용자 = DB write 0회)
    let credits = await getUserCreditsReadOnly(auth.user, userRef);
    // 2. row 없으면 (신규 사용자 첫 호출) 그때만 claim — free grant 발급
    if (!credits) {
      credits = await claimUserCredits(auth.user, userRef);
    }
    return NextResponse.json({
      ...credits,
      userRef,
    });
  } catch (err) {
    // Wave 106: raw err.message 누출 차단 (#11 패턴 동일).
    console.error("[credits/me] error", { userRef, err });
    return NextResponse.json(
      { error: "credit_load_failed", message: "크레딧 정보를 불러오지 못했어요." },
      { status: 500 },
    );
  }
}
