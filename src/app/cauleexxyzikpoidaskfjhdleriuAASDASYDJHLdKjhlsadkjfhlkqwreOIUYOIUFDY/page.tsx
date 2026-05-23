// Wave 102 (2026-05-15): admin 전용 회원 목록 페이지. URL obfuscation + admin auth 이중 보호.
// 비admin은 notFound() → URL 존재 자체 노출 X. /admin과 별개로 운영자가 회원 현황 확인 용도.

import { notFound } from "next/navigation";
import { OPS_ADMIN_DETAIL_EVENTS_PATH, OPS_ADMIN_FEEDBACK_STATS_PATH, OPS_ADMIN_LOSS_REPORTS_PATH } from "@/lib/admin-routes";
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

  return (
    <main className="mx-auto max-w-[1500px] p-4 sm:p-6">
      {/* Wave 188: 운영자 페이지 nav — 회원 / 손해 신고 / 신고 통계 (3 페이지 통일). */}
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-amber-100 px-2.5 py-1 font-black text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          ⚙ 회원 목록 (현재)
        </span>
        <a
          href={OPS_ADMIN_LOSS_REPORTS_PATH}
          className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-black text-amber-900 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
        >
          🔍 사용자 신고 검수
        </a>
        <a
          href={OPS_ADMIN_FEEDBACK_STATS_PATH}
          className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-black text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
        >
          📊 신고 통계
        </a>
        <a
          href={OPS_ADMIN_DETAIL_EVENTS_PATH}
          className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 font-black text-sky-900 hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100"
        >
          👀 상세 행동
        </a>
      </nav>

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

      <section className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiCard label="오늘 매출" value={`₩${revenueToday.toLocaleString("ko-KR")}`} accent="amber" />
        <KpiCard label="이번달 매출" value={`₩${revenueMonth.toLocaleString("ko-KR")}`} accent="amber" />
        <KpiCard label="활성 구독자" value={activeSubs} accent="emerald" sub={`Pro ${totalPro} · Plus ${totalPlus} · Starter ${totalStarter}`} />
        <KpiCard label="오늘 신규 가입" value={newSignupsToday} accent="rose" />
        <KpiCard label="오늘 팩 열기" value={packOpensToday} accent="sky" />
        <KpiCard label="오늘 공개" value={revealsToday} accent="sky" />
        <KpiCard label="오늘 번개장터 클릭" value={clicksToday} accent="sky" sub={revealsToday > 0 ? `CTR ${Math.round((clicksToday / revealsToday) * 100)}%` : undefined} />
        <KpiCard label="베타 체험단" value={totalBeta} accent="purple" sub={`최근 7일 로그인 ${totalActive7d}`} />
      </section>

      <MembersTable initialRows={rows} />
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
