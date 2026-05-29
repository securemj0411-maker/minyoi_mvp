// 2026-05-21: 운영자 수동 크레딧 지급 API.
// 기존 credit RPC를 재사용해서 row 생성/잔액 증가/원장 기록을 모두 service_role 경로에서 처리한다.

import { NextResponse, type NextRequest } from "next/server";
import { hasAdminActionHeader } from "@/lib/admin-action-token";
import { isAdminUser } from "@/lib/auth-users";
import { jsonBody, restFetch, rpcUrl, serviceHeaders } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MANUAL_GRANT = 1_000_000;

type CreditRpcRow = {
  balance?: number;
};

function parseCreditAmount(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(amount);
  if (rounded <= 0 || rounded > MAX_MANUAL_GRANT) return null;
  return rounded;
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });
  if (!hasAdminActionHeader(req.headers)) {
    return NextResponse.json({ error: "missing_admin_action_header" }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const targetAuthUserId = typeof payload.authUserId === "string" ? payload.authUserId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(targetAuthUserId)) {
    return NextResponse.json({ error: "invalid authUserId" }, { status: 400 });
  }

  const amount = parseCreditAmount(payload.amount);
  if (amount == null) {
    return NextResponse.json({ error: "invalid amount", maxAmount: MAX_MANUAL_GRANT }, { status: 400 });
  }

  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 500) : "";
  const targetUserRef = userRefForAuthUser(targetAuthUserId);
  const adminEmail = auth.user.email ?? auth.user.id;

  try {
    const claimRes = await restFetch(rpcUrl("claim_mvp_user_credits"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({
        p_user_ref: targetUserRef,
        p_auth_user_id: targetAuthUserId,
        p_free_grant: 0,
      }),
    });
    if (!claimRes.ok) {
      const text = await claimRes.text();
      console.error("[admin/credits/grant] claim failed", { status: claimRes.status, text: text.slice(0, 300) });
      return NextResponse.json({ error: "credit_claim_failed" }, { status: 500 });
    }

    const grantRes = await restFetch(rpcUrl("refund_mvp_user_credits"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({
        p_user_ref: targetUserRef,
        p_auth_user_id: targetAuthUserId,
        p_amount: amount,
        p_metadata: {
          source: "admin_manual_grant",
          admin_auth_user_id: auth.user.id,
          admin_email: adminEmail,
          target_auth_user_id: targetAuthUserId,
          note,
        },
      }),
    });
    if (!grantRes.ok) {
      const text = await grantRes.text();
      console.error("[admin/credits/grant] grant failed", { status: grantRes.status, text: text.slice(0, 300) });
      return NextResponse.json({ error: "credit_grant_failed" }, { status: 500 });
    }

    const rows = (await grantRes.json()) as CreditRpcRow[];
    const balance = Math.max(0, Number(rows[0]?.balance ?? 0));
    return NextResponse.json({ ok: true, authUserId: targetAuthUserId, amount, balance });
  } catch (err) {
    console.error("[admin/credits/grant] error", {
      targetAuthUserId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "credit_grant_failed" }, { status: 500 });
  }
}
