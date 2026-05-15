// Wave 102 (2026-05-15): admin 전용 회원 목록 페이지. URL obfuscation + admin auth 이중 보호.
// 비admin은 notFound() → URL 존재 자체 노출 X. /admin과 별개로 운영자가 회원 현황 확인 용도.

import { notFound } from "next/navigation";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import { serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuthUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  app_metadata?: { provider?: string };
};

type CreditRow = {
  auth_user_id: string;
  user_ref: string;
  balance: number;
  free_grant_tokens: number;
  free_granted_at: string | null;
  pro_until: string | null;
  created_at: string;
  updated_at: string;
};

async function fetchAuthUsers(): Promise<AuthUser[]> {
  const base = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return [];
  const all: AuthUser[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await fetch(`${base}/auth/v1/admin/users?per_page=200&page=${page}`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) break;
    const data = (await res.json()) as { users?: AuthUser[] };
    const users = data.users ?? [];
    all.push(...users);
    if (users.length < 200) break;
  }
  return all;
}

async function fetchAllCredits(): Promise<CreditRow[]> {
  const res = await fetch(
    `${tableUrl("mvp_user_credits")}?select=auth_user_id,user_ref,balance,free_grant_tokens,free_granted_at,pro_until,created_at,updated_at&limit=10000`,
    { headers: serviceHeaders(), cache: "no-store" },
  );
  if (!res.ok) return [];
  return (await res.json()) as CreditRow[];
}

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 16).replace("T", " ");
}

export default async function MembersPage() {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok || !isAdminUser(auth.user)) notFound();

  const [users, credits] = await Promise.all([fetchAuthUsers(), fetchAllCredits()]);
  const creditMap = new Map(credits.map((c) => [c.auth_user_id, c]));

  const rows = users
    .map((u) => ({ user: u, credit: creditMap.get(u.id) ?? null }))
    .sort((a, b) => new Date(b.user.created_at).getTime() - new Date(a.user.created_at).getTime());

  const totalPro = rows.filter((r) => r.credit?.pro_until && new Date(r.credit.pro_until) > new Date()).length;
  const totalActive7d = rows.filter((r) => {
    if (!r.user.last_sign_in_at) return false;
    return Date.now() - new Date(r.user.last_sign_in_at).getTime() < 7 * 24 * 3600 * 1000;
  }).length;

  return (
    <main className="mx-auto max-w-[1500px] p-4 sm:p-6">
      <div className="flex flex-col gap-1 border-b border-amber-200 pb-3 dark:border-amber-900/60">
        <div className="text-xs font-bold text-amber-700 dark:text-amber-300">⚙ 운영자 — 회원 목록</div>
        <h1 className="text-xl font-black text-gray-900 dark:text-gray-100 sm:text-2xl">전체 {rows.length}명</h1>
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
          <span>Pro 활성: <b className="text-amber-700 dark:text-amber-400">{totalPro}</b></span>
          <span>최근 7일 로그인: <b className="text-emerald-700 dark:text-emerald-400">{totalActive7d}</b></span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-900">
            <tr className="border-b border-gray-200 text-left text-xs font-bold text-gray-600 dark:border-zinc-800 dark:text-gray-400">
              <th className="px-3 py-2">이메일</th>
              <th className="px-3 py-2">가입일</th>
              <th className="px-3 py-2">마지막 로그인</th>
              <th className="px-3 py-2 text-right">크레딧</th>
              <th className="px-3 py-2 text-right">무료 토큰</th>
              <th className="px-3 py-2">Pro 만료</th>
              <th className="px-3 py-2">provider</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ user, credit }) => {
              const proActive = credit?.pro_until && new Date(credit.pro_until) > new Date();
              return (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-amber-50/40 dark:border-zinc-900 dark:hover:bg-amber-950/20">
                  <td className="px-3 py-2 font-mono text-xs">{user.email ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{fmt(user.created_at)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{fmt(user.last_sign_in_at)}</td>
                  <td className="px-3 py-2 text-right font-mono">{credit?.balance ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{credit?.free_grant_tokens ?? "—"}</td>
                  <td className={`px-3 py-2 font-mono text-xs ${proActive ? "font-bold text-amber-700 dark:text-amber-400" : "text-gray-400"}`}>
                    {fmt(credit?.pro_until)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{user.app_metadata?.provider ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
