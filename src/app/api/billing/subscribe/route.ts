import { NextResponse } from "next/server";
import { planForKey, type PlanKey } from "@/lib/plan-config";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { subscribeUserPlan } from "@/lib/user-plan";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mock Toss 결제. 실제 결제 연동 전까지 client에서 보낸 paymentKey/orderId만 검증.
// 프로덕션 전환 시 토스 servlet 호출(approve) 단계가 여기에 들어간다.
export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { planKey?: string; paymentKey?: string; orderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const planKey = String(body.planKey ?? "").toLowerCase();
  if (planKey !== "starter" && planKey !== "plus" && planKey !== "pro") {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }
  const plan = planForKey(planKey);
  const paymentKey = String(body.paymentKey ?? `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const userRef = userRefForAuthUser(auth.user.id);
  try {
    const result = await subscribeUserPlan({
      user: auth.user,
      userRef,
      planKey: planKey as Exclude<PlanKey, "free">,
      paymentKey,
    });
    return NextResponse.json({
      ok: true,
      planKey: result.planKey,
      balance: result.balance,
      currentPeriodEnd: result.currentPeriodEnd,
      amount: plan.priceKrw,
      monthlyCredits: plan.monthlyCredits,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "subscribe failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
