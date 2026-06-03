import { NextResponse, type NextRequest } from "next/server";
import { hasAdminActionHeader } from "@/lib/admin-action-token";
import { isAdminUser } from "@/lib/auth-users";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: number;
  user_ref: string;
  auth_user_id: string;
  email: string | null;
  display_name: string | null;
  status: string;
  price_krw: number | null;
};

function periodEnd(days: number) {
  const end = new Date();
  end.setDate(end.getDate() + days);
  return end.toISOString();
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });
  if (!hasAdminActionHeader(req.headers)) {
    return NextResponse.json({ error: "missing_admin_action_header" }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try { payload = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const id = Number(payload.id);
  const decision = typeof payload.decision === "string" ? payload.decision.trim() : "";
  const adminNote = typeof payload.adminNote === "string" ? payload.adminNote.trim().slice(0, 1000) : "";
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  if (decision !== "approve" && decision !== "reject") return NextResponse.json({ error: "invalid_decision" }, { status: 400 });

  const lookupRes = await restFetch(
    `${tableUrl("mvp_membership_applications")}?select=id,user_ref,auth_user_id,email,display_name,status,price_krw&id=eq.${id}&limit=1`,
    { headers: serviceHeaders() },
  );
  const rows = (await lookupRes.json()) as ApplicationRow[];
  const application = rows[0];
  if (!application) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (application.status !== "pending") {
    return NextResponse.json({ error: `already_${application.status}` }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  let planEndAt: string | null = null;

  if (decision === "approve") {
    planEndAt = periodEnd(90);
    await restFetch(`${tableUrl("mvp_user_plans")}?on_conflict=user_ref`, {
      method: "POST",
      headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
      body: jsonBody([{
        user_ref: application.user_ref,
        auth_user_id: application.auth_user_id,
        plan_key: "pro",
        status: "active",
        cancel_at_period_end: false,
        current_period_start: nowIso,
        current_period_end: planEndAt,
        daily_used_count: 0,
        daily_reset_on: nowIso.slice(0, 10),
        last_payment_at: nowIso,
        last_payment_amount: application.price_krw ?? 99000,
        last_payment_key: `membership_application_${application.id}`,
        updated_at: nowIso,
      }]),
    });

    await restFetch(`${tableUrl("mvp_payment_events")}`, {
      method: "POST",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody([{
        user_ref: application.user_ref,
        auth_user_id: application.auth_user_id,
        event_type: "subscribe",
        plan_key: "pro",
        amount: application.price_krw ?? 99000,
        payment_method: "membership_application",
        payment_key: `membership_application_${application.id}`,
        metadata: {
          source: "admin_membership_application",
          application_id: application.id,
          admin_auth_user_id: auth.user.id,
          admin_email: auth.user.email ?? null,
        },
        created_at: nowIso,
      }]),
    }).catch(() => undefined);
  }

  const updateRes = await restFetch(
    `${tableUrl("mvp_membership_applications")}?id=eq.${application.id}&status=eq.pending`,
    {
      method: "PATCH",
      headers: serviceHeaders("return=representation"),
      body: jsonBody({
        status: decision === "approve" ? "approved" : "rejected",
        admin_note: adminNote || null,
        decided_by: auth.user.id,
        decided_at: nowIso,
        updated_at: nowIso,
      }),
    },
  );
  const updated = (await updateRes.json()) as Array<{ id: number; status: string }>;
  if (updated.length === 0) return NextResponse.json({ error: "decision_race" }, { status: 409 });

  return NextResponse.json({
    ok: true,
    id: application.id,
    status: updated[0].status,
    authUserId: application.auth_user_id,
    planEndAt,
  });
}
