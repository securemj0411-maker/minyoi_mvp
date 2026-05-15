import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { getUserPlanState } from "@/lib/user-plan";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);
  try {
    const state = await getUserPlanState(auth.user, userRef);
    return NextResponse.json({
      planKey: state.plan.key,
      planName: state.plan.name,
      monthlyCredits: state.plan.monthlyCredits,
      status: state.status,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      currentPeriodEnd: state.currentPeriodEnd,
      dailyUsed: state.dailyUsed,
      dailyLimit: state.dailyLimit,
      dailyResetOn: state.dailyResetOn,
      isAdmin: state.isAdmin,
    });
  } catch (err) {
    // Wave 106: raw err.message 누출 차단 (subscribe/route.ts 와 동일 이유).
    console.error("[billing/me] error", { userRef, err });
    return NextResponse.json(
      { error: "plan_load_failed", message: "플랜 정보를 불러오지 못했어요." },
      { status: 500 },
    );
  }
}
