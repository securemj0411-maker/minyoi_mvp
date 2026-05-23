// Wave 102 (2026-05-15): admin 전용 회원 목록 페이지. URL obfuscation + admin auth 이중 보호.
//   비admin은 notFound() → URL 존재 자체 노출 X.
// Wave launch-108 (2026-05-24): layout.tsx 가 admin auth + AdminTopBar (sticky nav + KPI ticker) 공유.
//   이 페이지는 본문만 (헤더 / nav / KPI 다 layout 으로 위임). 페이지 전환 시 sticky bar 유지.

import { serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import MembersTable, { type MemberRow } from "./members-table";
import ManualDepositPanel from "./manual-deposit-panel";
import FeedbackPanel from "./feedback-panel";

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
  blocked_at: string | null;
  blocked_reason: string | null;
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
    `${tableUrl("mvp_user_credits")}?select=auth_user_id,user_ref,balance,free_grant_tokens,free_granted_at,pro_until,is_beta_tester,beta_tester_granted_at,blocked_at,blocked_reason,created_at,updated_at&limit=10000`,
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
  // admin auth 는 layout 에서 처리 (Wave launch-108).
  const [users, credits, plans] = await Promise.all([
    fetchAuthUsers(),
    fetchAllCredits(),
    fetchAllPlans(),
  ]);

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
        blockedAt: credit?.blocked_at ?? null,
        blockedReason: credit?.blocked_reason ?? null,
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

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 pb-10 pt-4 sm:px-6">
      <header className="mb-4 border-b border-zinc-800 pb-3">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">▌MEMBERS / OPERATORS</div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="text-3xl font-black tabular-nums text-zinc-50">{rows.length}</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">accounts</span>
        </div>
      </header>

      <ManualDepositPanel />
      <FeedbackPanel />
      <MembersTable initialRows={rows} />
    </main>
  );
}
