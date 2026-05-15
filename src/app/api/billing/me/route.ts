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
    const message = err instanceof Error ? err.message : "plan load failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
