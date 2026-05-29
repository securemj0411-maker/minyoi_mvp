// Wave 102 (2026-05-15): admin이 회원을 베타 체험단으로 승격/해제.
// 권한 부여 내용은 별도 (이따 정의 예정).

import { NextResponse } from "next/server";
import { hasAdminActionHeader } from "@/lib/admin-action-token";
import { isAdminUser } from "@/lib/auth-users";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });
  if (!hasAdminActionHeader(req.headers)) {
    return NextResponse.json({ error: "missing_admin_action_header" }, { status: 403 });
  }

  let body: { authUserId?: string; isBetaTester?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const targetId = typeof body.authUserId === "string" ? body.authUserId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
    return NextResponse.json({ error: "invalid authUserId" }, { status: 400 });
  }
  const grant = Boolean(body.isBetaTester);

  try {
    const res = await restFetch(
      `${tableUrl("mvp_user_credits")}?auth_user_id=eq.${encodeURIComponent(targetId)}`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders("return=representation") },
        body: JSON.stringify({
          is_beta_tester: grant,
          beta_tester_granted_at: grant ? new Date().toISOString() : null,
        }),
      },
    );
    if (!res.ok) {
      const txt = await res.text();
      console.error("beta-tester patch failed", { targetId, status: res.status, body: txt.slice(0, 200) });
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
    const rows = (await res.json()) as Array<{ auth_user_id: string; is_beta_tester: boolean }>;
    if (rows.length === 0) {
      return NextResponse.json({ error: "user_not_found_in_credits" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, isBetaTester: rows[0].is_beta_tester });
  } catch (err) {
    console.error("beta-tester threw", { targetId, err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
