// Wave 102 (2026-05-15): admin 전용 회원 목록 페이지. URL obfuscation + admin auth 이중 보호.
// 비admin은 notFound() → URL 존재 자체 노출 X. /admin과 별개로 운영자가 회원 현황 확인 용도.

import { notFound } from "next/navigation";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import { serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import MembersTable, { type MemberRow } from "./members-table";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuthUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  app_metadata?: { provider?: string };
  user_metadata?: { name?: string; full_name?: string; preferred_username?: string; nickname?: string };
  raw_user_meta_data?: { name?: string; full_name?: string; preferred_username?: string; nickname?: string };
};

type CreditRow = {
  auth_user_id: string;
  user_ref: string;
  balance: number;
  free_grant_tokens: number;
  free_granted_at: string | null;
  pro_until: string | null;
  is_beta_tester: boolean | null;
  beta_tester_granted_at: string | null;
  created_at: string;
  updated_at: string;
};

type PlanRow = {
  auth_user_id: string;
  plan_key: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  daily_used_count: number;
  last_payment_at: string | null;
  last_payment_amount: number | null;
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
    `${tableUrl("mvp_user_credits")}?select=auth_user_id,user_ref,balance,free_grant_tokens,free_granted_at,pro_until,is_beta_tester,beta_tester_granted_at,created_at,updated_at&limit=10000`,
    { headers: serviceHeaders(), cache: "no-store" },
  );
  if (!res.ok) return [];
  return (await res.json()) as CreditRow[];
}

async function fetchAllPlans(): Promise<PlanRow[]> {
  const res = await fetch(
    `${tableUrl("mvp_user_plans")}?select=auth_user_id,plan_key,status,cancel_at_period_end,current_period_end,daily_used_count,last_payment_at,last_payment_amount&limit=10000`,
    { headers: serviceHeaders(), cache: "no-store" },
  );
  if (!res.ok) return [];
  return (await res.json()) as PlanRow[];
}

function nicknameOf(user: AuthUser): string {
  const meta = user.user_metadata ?? user.raw_user_meta_data ?? {};
  return meta.nickname || meta.name || meta.full_name || meta.preferred_username || "";
}

export default async function MembersPage() {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok || !isAdminUser(auth.user)) notFound();

  const [users, credits, plans] = await Promise.all([fetchAuthUsers(), fetchAllCredits(), fetchAllPlans()]);
  const creditMap = new Map(credits.map((c) => [c.auth_user_id, c]));
  const planMap = new Map(plans.map((p) => [p.auth_user_id, p]));

  const rows: MemberRow[] = users
    .map((u) => {
      const credit = creditMap.get(u.id) ?? null;
      const plan = planMap.get(u.id) ?? null;
      return {
        authUserId: u.id,
        email: u.email ?? null,
        nickname: nicknameOf(u),
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        provider: u.app_metadata?.provider ?? null,
        balance: credit?.balance ?? null,
        freeGrantTokens: credit?.free_grant_tokens ?? null,
        proUntil: credit?.pro_until ?? null,
        isBetaTester: Boolean(credit?.is_beta_tester),
        betaGrantedAt: credit?.beta_tester_granted_at ?? null,
        creditRowExists: credit != null,
        planKey: plan?.plan_key ?? "free",
        planStatus: plan?.status ?? null,
        planEndAt: plan?.current_period_end ?? null,
        planCancelAtEnd: plan?.cancel_at_period_end ?? false,
        dailyUsedCount: plan?.daily_used_count ?? null,
        lastPaymentAt: plan?.last_payment_at ?? null,
        lastPaymentAmount: plan?.last_payment_amount ?? null,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalPro = rows.filter((r) => r.planKey === "pro" && r.planStatus === "active").length;
  const totalPlus = rows.filter((r) => r.planKey === "plus" && r.planStatus === "active").length;
  const totalStarter = rows.filter((r) => r.planKey === "starter" && r.planStatus === "active").length;
  const totalBeta = rows.filter((r) => r.isBetaTester).length;
  const totalActive7d = rows.filter((r) => r.lastSignInAt && Date.now() - new Date(r.lastSignInAt).getTime() < 7 * 24 * 3600 * 1000).length;

  return (
    <main className="mx-auto max-w-[1500px] p-4 sm:p-6">
      <div className="flex flex-col gap-1 border-b border-amber-200 pb-3 dark:border-amber-900/60">
        <div className="text-xs font-bold text-amber-700 dark:text-amber-300">⚙ 운영자 — 회원 목록</div>
        <h1 className="text-xl font-black text-gray-900 dark:text-gray-100 sm:text-2xl">전체 {rows.length}명</h1>
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
          <span>Pro: <b className="text-amber-700 dark:text-amber-400">{totalPro}</b></span>
          <span>Plus: <b className="text-emerald-700 dark:text-emerald-400">{totalPlus}</b></span>
          <span>Starter: <b className="text-sky-700 dark:text-sky-400">{totalStarter}</b></span>
          <span>베타 체험단: <b className="text-purple-700 dark:text-purple-400">{totalBeta}</b></span>
          <span>최근 7일 로그인: <b className="text-emerald-700 dark:text-emerald-400">{totalActive7d}</b></span>
        </div>
      </div>

      <MembersTable initialRows={rows} />
    </main>
  );
}
