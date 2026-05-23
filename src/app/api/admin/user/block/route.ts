// Wave launch-95 (사용자 결정): 운영자 회원 차단/해제 toggle.
//   차단 사용자는 manual-deposit POST 에서 거부 + 향후 다른 결제 path 도 거부.

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
  const blocked = Boolean(payload.blocked);
  const reason = typeof payload.reason === "string" ? payload.reason.trim().slice(0, 500) : null;
  const targetUserRef = userRefForAuthUser(targetAuthUserId);

  const nowIso = new Date().toISOString();
  const upsertRes = await restFetch(
    `${tableUrl("mvp_user_credits")}?on_conflict=user_ref`,
    {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: jsonBody([{
        user_ref: targetUserRef,
        auth_user_id: targetAuthUserId,
        blocked_at: blocked ? nowIso : null,
        blocked_reason: blocked ? (reason || "blocked by operator") : null,
        updated_at: nowIso,
      }]),
    },
  );
  if (!upsertRes.ok) {
    console.error("[admin/user/block] upsert failed");
    return NextResponse.json({ error: "block_toggle_failed" }, { status: 500 });
  }

  // Wave launch-99b: ledger insert throw 안전망 — block 자체는 이미 성공.
  try {
    const ledgerRes = await restFetch(
      `${tableUrl("mvp_credit_ledger")}`,
      {
        method: "POST",
        headers: { ...serviceHeaders(), Prefer: "return=minimal" },
        body: jsonBody([{
          user_ref: targetUserRef,
          auth_user_id: targetAuthUserId,
          event_type: blocked ? "admin_block" : "admin_unblock",
          amount: 0,
          balance_after: 0,
          metadata: {
            admin_auth_user_id: auth.user.id,
            admin_email: auth.user.email ?? null,
            reason,
          },
          created_at: nowIso,
        }]),
      },
    );
    if (!ledgerRes.ok) {
      console.warn("[admin/user/block] ledger insert non-ok", ledgerRes.status);
    }
  } catch (err) {
    console.warn("[admin/user/block] ledger insert threw", err instanceof Error ? err.message : String(err));
  }

  return NextResponse.json({
    ok: true,
    authUserId: targetAuthUserId,
    blocked,
    blockedAt: blocked ? nowIso : null,
  });
}
