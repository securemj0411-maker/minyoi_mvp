// Wave launch-95 (사용자 결정): 운영자 수동 크레딧 회수.
//   양심 신뢰 manual-deposit 후 입금 안 한 사용자 회수 용도.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  let payload: Record<string, unknown>;
  try { payload = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const targetAuthUserId = typeof payload.authUserId === "string" ? payload.authUserId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(targetAuthUserId)) {
    return NextResponse.json({ error: "invalid authUserId" }, { status: 400 });
  }
  const amount = Math.round(Number(payload.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }
  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 500) : "";
  const targetUserRef = userRefForAuthUser(targetAuthUserId);

  // 현재 balance 조회
  const credRes = await restFetch(
    `${tableUrl("mvp_user_credits")}?select=balance&user_ref=eq.${encodeURIComponent(targetUserRef)}&auth_user_id=eq.${targetAuthUserId}&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!credRes.ok) return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  const credRows = (await credRes.json()) as Array<{ balance: number }>;
  if (credRows.length === 0) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  const currentBalance = Number(credRows[0].balance ?? 0);
  const newBalance = Math.max(0, currentBalance - amount);
  const actualRevoked = currentBalance - newBalance;

  const nowIso = new Date().toISOString();
  const upsertRes = await restFetch(
    `${tableUrl("mvp_user_credits")}?on_conflict=user_ref,auth_user_id`,
    {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: jsonBody([{
        user_ref: targetUserRef,
        auth_user_id: targetAuthUserId,
        balance: newBalance,
        updated_at: nowIso,
      }]),
    },
  );
  if (!upsertRes.ok) {
    console.error("[admin/credits/revoke] upsert failed");
    return NextResponse.json({ error: "revoke_failed" }, { status: 500 });
  }

  await restFetch(
    `${tableUrl("mvp_credit_ledger")}`,
    {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: jsonBody([{
        user_ref: targetUserRef,
        auth_user_id: targetAuthUserId,
        event_type: "admin_revoke",
        amount: -actualRevoked,
        balance_after: newBalance,
        metadata: {
          admin_auth_user_id: auth.user.id,
          admin_email: auth.user.email ?? null,
          requested_amount: amount,
          actual_revoked: actualRevoked,
          note,
        },
        created_at: nowIso,
      }]),
    },
  );

  return NextResponse.json({ ok: true, authUserId: targetAuthUserId, revoked: actualRevoked, balance: newBalance });
}
