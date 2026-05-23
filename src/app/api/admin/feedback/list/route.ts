// Wave launch-103: admin 피드백 검토 list — 최근 7일 + 50건.
// Wave launch-104b (2026-05-23): auth.users join — 닉네임/이메일 같이 반환.
//   members-table 패턴 따라 service role 로 /auth/v1/admin/users 호출.

import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthUser = {
  id: string;
  email: string | null;
  user_metadata?: { name?: string; full_name?: string; preferred_username?: string; nickname?: string };
  raw_user_meta_data?: { name?: string; full_name?: string; preferred_username?: string; nickname?: string };
};

function nicknameOf(u: AuthUser): string {
  const meta = u.user_metadata ?? u.raw_user_meta_data ?? {};
  return meta.nickname || meta.name || meta.full_name || meta.preferred_username || "";
}

async function fetchAuthUsersMap(): Promise<Map<string, { email: string | null; nickname: string }>> {
  const base = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const map = new Map<string, { email: string | null; nickname: string }>();
  if (!base || !key) return map;
  for (let page = 1; page <= 20; page += 1) {
    const res = await fetch(`${base}/auth/v1/admin/users?per_page=200&page=${page}`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) break;
    const data = (await res.json()) as { users?: AuthUser[] };
    const users = data.users ?? [];
    for (const u of users) map.set(u.id, { email: u.email, nickname: nicknameOf(u) });
    if (users.length < 200) break;
  }
  return map;
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [feedbackRes, authMap] = await Promise.all([
    restFetch(
      `${tableUrl("mvp_user_feedback")}?select=*&created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=80`,
      { headers: serviceHeaders() },
    ),
    fetchAuthUsersMap(),
  ]);
  if (!feedbackRes.ok) return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  const rows = (await feedbackRes.json()) as Array<{ auth_user_id: string } & Record<string, unknown>>;

  const enriched = rows.map((r) => {
    const profile = authMap.get(r.auth_user_id);
    return {
      ...r,
      user_email: profile?.email ?? null,
      user_nickname: profile?.nickname ?? null,
    };
  });

  return NextResponse.json({ feedback: enriched });
}
