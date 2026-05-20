import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { planForKey, type PlanKey } from "@/lib/plan-config";
import { verifyPortOnePayment } from "@/lib/portone-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { subscribeUserPlan } from "@/lib/user-plan";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wave 104: 결제 endpoint spam 차단. 같은 paymentKey 재호출 시 H3 (idempotency 없음)와
// 결합되면 크레딧 이중 grant 위험. 분당 3회로 제한 (정상 결제 흐름은 1~2회면 충분).
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// PortOne V2 결제 완료 처리.
// client에서 받은 paymentId를 서버에서 PortOne 결제 조회 API로 검증한 뒤 크레딧을 지급한다.
export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { planKey?: string; paymentId?: string; paymentKey?: string; orderId?: string };
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
  const paymentId = String(body.paymentId ?? body.paymentKey ?? "").trim();
  if (!paymentId) {
    return NextResponse.json({ error: "missing_payment_id", message: "결제 ID가 필요합니다." }, { status: 400 });
  }

  const userRef = userRefForAuthUser(auth.user.id);

  if (!isAdminUser(auth.user)) {
    const rate = await checkRateLimit({
      bucketKey: `billing.subscribe:user:${userRef}`,
      maxRequests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "결제 시도가 너무 잦아요. 잠시 후 다시 시도해주세요.",
          retryAfter: rate.retryAfterSeconds,
        },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
  }

  const verification = await verifyPortOnePayment({
    paymentId,
    expectedAmount: plan.priceKrw,
  });
  if (!verification.ok) {
    console.warn("[billing/subscribe] PortOne verification failed", {
      userRef,
      planKey,
      paymentId,
      error: verification.error,
    });
    return NextResponse.json(
      { error: verification.error, message: verification.message },
      { status: verification.statusCode },
    );
  }

  try {
    const result = await subscribeUserPlan({
      user: auth.user,
      userRef,
      planKey: planKey as Exclude<PlanKey, "free">,
      paymentKey: paymentId,
    });
    return NextResponse.json({
      ok: true,
      planKey: result.planKey,
      balance: result.balance,
      currentPeriodEnd: result.currentPeriodEnd,
      paymentId,
      verification: verification.skipped ? "skipped_dev_no_secret" : "verified",
      amount: plan.priceKrw,
      monthlyCredits: plan.monthlyCredits,
    });
  } catch (err) {
    // Wave 106: raw err.message 누출 차단. restFetch throw는 "Supabase REST failed 400 POST <RPC>: {pg body}"
    // 형태로 RPC 이름 + postgres schema/제약 메시지 그대로 노출. 서버 로그만 raw, client는 generic.
    console.error("[billing/subscribe] error", { userRef, planKey, err });
    return NextResponse.json(
      { error: "subscribe_failed", message: "결제 처리 중 오류가 났어요. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
