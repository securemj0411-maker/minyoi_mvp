import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { cancelUserPlan, reactivateUserPlan } from "@/lib/user-plan";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = String(body.action ?? "cancel").toLowerCase();
  const userRef = userRefForAuthUser(auth.user.id);

  try {
    if (action === "reactivate") {
      await reactivateUserPlan(auth.user, userRef);
      return NextResponse.json({ ok: true, action: "reactivate" });
    }
    await cancelUserPlan(auth.user, userRef);
    return NextResponse.json({ ok: true, action: "cancel" });
  } catch (err) {
    // Wave 106: raw err.message 누출 차단 (subscribe/route.ts 와 동일 이유).
    console.error("[billing/cancel] error", { userRef, action, err });
    return NextResponse.json(
      { error: "cancel_failed", message: "요청 처리 중 오류가 났어요. 잠시 후 다시 시도해주세요." },
      { status: 400 },
    );
  }
}
