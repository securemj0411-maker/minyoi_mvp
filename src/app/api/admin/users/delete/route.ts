// Wave launch-100 (사용자 결정): admin 회원 일괄 삭제. 테스트 계정 정리용.
//   auth.users + 관련 mvp_* row 다 cleanup. service_role 만 가능.

import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 삭제 대상 mvp_* table — auth_user_id 또는 user_ref FK column.
const CLEANUP_TABLES: Array<{ table: string; column: "auth_user_id" | "user_ref" }> = [
  { table: "mvp_user_credits", column: "auth_user_id" },
  { table: "mvp_credit_ledger", column: "auth_user_id" },
  { table: "mvp_user_plans", column: "auth_user_id" },
  { table: "mvp_payment_events", column: "auth_user_id" },
  { table: "mvp_manual_deposit_requests", column: "auth_user_id" },
  { table: "mvp_telegram_bindings", column: "user_ref" },
  { table: "mvp_admin_users", column: "auth_user_id" },
];

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  let body: { authUserIds?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_body" }, { status: 400 }); }

  const ids = Array.isArray(body.authUserIds) ? body.authUserIds.filter((v): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)) : [];
  if (ids.length === 0) return NextResponse.json({ error: "no_ids" }, { status: 400 });
  if (ids.length > 100) return NextResponse.json({ error: "too_many", message: "한 번에 최대 100명까지" }, { status: 400 });

  // 자기 자신 삭제 차단.
  if (ids.includes(auth.user.id)) {
    return NextResponse.json({ error: "self_delete_blocked", message: "운영자 본인은 삭제할 수 없어요." }, { status: 400 });
  }

  const results: Array<{ id: string; ok: boolean; reason?: string }> = [];

  // Supabase Admin REST — auth.users 삭제.
  const supabaseBase = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseBase || !serviceKey) {
    return NextResponse.json({ error: "config_missing" }, { status: 500 });
  }

  for (const id of ids) {
    try {
      // 1. mvp_* tables cleanup
      const userRef = userRefForAuthUser(id);
      for (const { table, column } of CLEANUP_TABLES) {
        const url = column === "auth_user_id"
          ? `${tableUrl(table)}?auth_user_id=eq.${id}`
          : `${tableUrl(table)}?user_ref=eq.${encodeURIComponent(userRef)}`;
        try {
          const res = await restFetch(url, {
            method: "DELETE",
            headers: { ...serviceHeaders(), Prefer: "return=minimal" },
          });
          if (!res.ok && res.status !== 404) {
            console.warn(`[admin/users/delete] cleanup ${table} non-ok`, { id, status: res.status });
          }
        } catch (err) {
          console.warn(`[admin/users/delete] cleanup ${table} threw`, { id, err: err instanceof Error ? err.message : String(err) });
        }
      }

      // 2. auth.users 삭제 — Supabase Admin REST API.
      const authRes = await fetch(`${supabaseBase}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
      });
      if (!authRes.ok) {
        const body = await authRes.text().catch(() => "");
        results.push({ id, ok: false, reason: `auth_${authRes.status}: ${body.slice(0, 120)}` });
        continue;
      }

      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    deleted: okCount,
    total: ids.length,
    results,
  });
}
