// Wave 102 (2026-05-15): admin 전용 회원 목록 페이지. URL obfuscation + admin auth 이중 보호.
// 비admin은 notFound() → URL 존재 자체 노출 X. /admin과 별개로 운영자가 회원 현황 확인 용도.

import { notFound } from "next/navigation";
import { OPS_ADMIN_DETAIL_EVENTS_PATH, OPS_ADMIN_FEEDBACK_STATS_PATH, OPS_ADMIN_LOSS_REPORTS_PATH } from "@/lib/admin-routes";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import { serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import MembersTable, { type MemberRow } from "./members-table";
// Wave launch-97: cau page 에 충전 신청 승인 panel.
import ManualDepositPanel from "./manual-deposit-panel";

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

async function countRows(table: string, filter: string): Promise<number> {
  const res = await fetch(
    `${tableUrl(table)}?select=id&${filter}&limit=1`,
    { headers: { ...serviceHeaders(), Prefer: "count=exact" }, cache: "no-store" },
  );
  if (!res.ok) return 0;
  const range = res.headers.get("content-range") ?? "0-0/0";
  return Number(range.split("/")[1] ?? 0);
}

function kstTodayStartIso(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  return new Date(`${fmt.format(new Date())}T00:00:00+09:00`).toISOString();
}

function kstMonthStartIso(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  return new Date(`${fmt.format(new Date()).slice(0, 7)}-01T00:00:00+09:00`).toISOString();
}

function nicknameOf(user: AuthUser): string {
  const meta = user.user_metadata ?? user.raw_user_meta_data ?? {};
  return meta.nickname || meta.name || meta.full_name || meta.preferred_username || "";
}

export default async function MembersPage() {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok || !isAdminUser(auth.user)) notFound();

  const todayIso = kstTodayStartIso();
  const monthIso = kstMonthStartIso();

  const [
    users, credits, plans,
    packOpensToday, revealsToday, clicksToday,
  ] = await Promise.all([
    fetchAuthUsers(),
    fetchAllCredits(),
    fetchAllPlans(),
    countRows("mvp_pack_opens", `opened_at=gte.${todayIso}&result=eq.success`),
    countRows("mvp_pack_reveals", `revealed_at=gte.${todayIso}`),
    countRows("mvp_pack_reveals", `link_clicked_at=gte.${todayIso}`),
  ]);

  const creditMap = new Map(credits.map((c) => [c.auth_user_id, c]));
  const planMap = new Map(plans.map((p) => [p.auth_user_id, p]));

  const revenueToday = plans
    .filter((p) => p.last_payment_at && p.last_payment_at >= todayIso)
    .reduce((sum, p) => sum + (p.last_payment_amount ?? 0), 0);
  const revenueMonth = plans
    .filter((p) => p.last_payment_at && p.last_payment_at >= monthIso)
    .reduce((sum, p) => sum + (p.last_payment_amount ?? 0), 0);
  const activeSubs = plans.filter((p) => p.status === "active" && p.plan_key !== "free").length;
  const newSignupsToday = users.filter((u) => u.created_at >= todayIso).length;

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

  const totalPro = rows.filter((r) => r.planKey === "pro" && r.planStatus === "active").length;
  const totalPlus = rows.filter((r) => r.planKey === "plus" && r.planStatus === "active").length;
  const totalStarter = rows.filter((r) => r.planKey === "starter" && r.planStatus === "active").length;
  const totalBeta = rows.filter((r) => r.isBetaTester).length;
  const totalActive7d = rows.filter((r) => r.lastSignInAt && Date.now() - new Date(r.lastSignInAt).getTime() < 7 * 24 * 3600 * 1000).length;

  // Wave launch-101 (사용자 정정 — "블룸버그 터미널처럼 투박하게 멋지게"):
  //   bg zinc-950 + mono font + amber/emerald/rose data-only accent.
  //   AdminTerminalNav (h-10) 자리 비우려고 pt-12.
  const nowKst = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date());
  return (
    <main className="min-h-screen bg-zinc-950 pb-10 pt-12 font-mono text-zinc-200">
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6">
        {/* 헤더 — 터미널 stat bar */}
        <header className="border-b border-zinc-800 pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">▌MEMBERS / OPERATORS</div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="text-3xl font-black tabular-nums text-zinc-50">{rows.length}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">accounts</span>
              </div>
            </div>
            <div className="text-right text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <div>SESSION {nowKst} KST</div>
              <div className="mt-0.5 text-zinc-600">v1.0 · status <span className="text-emerald-400">●live</span></div>
            </div>
          </div>

          {/* sub nav (페이지 ↔ 페이지 jump) */}
          <nav className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.16em]">
            <span className="rounded-sm border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-black text-amber-300">▶ MEMBERS</span>
            <a href={OPS_ADMIN_LOSS_REPORTS_PATH} className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 font-bold text-zinc-400 hover:border-zinc-700 hover:text-zinc-200">LOSS-REPORTS</a>
            <a href={OPS_ADMIN_FEEDBACK_STATS_PATH} className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 font-bold text-zinc-400 hover:border-zinc-700 hover:text-zinc-200">FEEDBACK-STATS</a>
            <a href={OPS_ADMIN_DETAIL_EVENTS_PATH} className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 font-bold text-zinc-400 hover:border-zinc-700 hover:text-zinc-200">DETAIL-EVENTS</a>
          </nav>
        </header>

        {/* KPI ticker — 한 줄 dense. Wave launch-102: bloomberg monochrome (amber primary). */}
        <section className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-zinc-800 bg-zinc-800 sm:grid-cols-4 md:grid-cols-7">
          <TerminalKpi label="REV TODAY" value={`₩${revenueToday.toLocaleString("ko-KR")}`} />
          <TerminalKpi label="REV MONTH" value={`₩${revenueMonth.toLocaleString("ko-KR")}`} />
          <TerminalKpi label="ACTIVE SUB" value={String(activeSubs)} sub={`P${totalPro}/PL${totalPlus}/ST${totalStarter}`} />
          <TerminalKpi label="NEW SIGNUP" value={String(newSignupsToday)} />
          <TerminalKpi label="PACK OPEN" value={String(packOpensToday)} />
          <TerminalKpi label="REVEAL" value={String(revealsToday)} />
          <TerminalKpi label="CLICK / CTR" value={String(clicksToday)} sub={revealsToday > 0 ? `${Math.round((clicksToday / revealsToday) * 100)}%` : "—"} />
        </section>

        <ManualDepositPanel />

        <MembersTable initialRows={rows} />
      </div>
    </main>
  );
}

function KpiCard({ label, value, accent, sub }: { label: string; value: string | number; accent: "amber" | "emerald" | "purple" | "sky" | "rose"; sub?: string }) {
  const styles: Record<typeof accent, string> = {
    amber: "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20",
    emerald: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20",
    purple: "border-purple-200 bg-purple-50/60 dark:border-purple-900/40 dark:bg-purple-950/20",
    sky: "border-sky-200 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/20",
    rose: "border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20",
  };
  return (
    <div className={`rounded-xl border p-3 ${styles[accent]}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-black text-gray-900 dark:text-gray-100 sm:text-xl">{value}</div>
      {sub ? <div className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{sub}</div> : null}
    </div>
  );
}

// Wave launch-101 → launch-102: bloomberg monochrome — amber primary only.
//   사용자 정정: "색깔이 너무 알록달록. 블룸버그 느낌 모름?"
function TerminalKpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-950 px-3 py-3">
      <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-[18px] font-black tabular-nums leading-none text-amber-400">{value}</div>
      {sub ? <div className="mt-1 truncate text-[9px] uppercase tracking-wide text-zinc-600">{sub}</div> : null}
    </div>
  );
}
