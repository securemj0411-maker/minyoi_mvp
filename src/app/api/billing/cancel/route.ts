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
    const message = err instanceof Error ? err.message : "cancel failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
