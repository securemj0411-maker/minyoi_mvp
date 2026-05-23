// Wave launch-108 (2026-05-24): admin top-bar 의 KPI ticker client-side polling 용 endpoint.
//   cau 페이지 layout 의 AdminTopBar 가 SWR / setInterval 로 30s 마다 갱신.
//   기존엔 page.tsx server fetch 였는데 — nav 전환 시 새로 안 받고 sticky bar 유지하려면 client fetch 가 맞음.

import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

type PlanRow = {
  auth_user_id: string;
  plan_key: string;
  status: string;
  last_payment_at: string | null;
  last_payment_amount: number | null;
};

function kstTodayStartIso(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  return new Date(`${fmt.format(new Date())}T00:00:00+09:00`).toISOString();
}
function kstMonthStartIso(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  return new Date(`${fmt.format(new Date()).slice(0, 7)}-01T00:00:00+09:00`).toISOString();
}

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

async function fetchAllPlans(): Promise<PlanRow[]> {
  const res = await fetch(
    `${tableUrl("mvp_user_plans")}?select=auth_user_id,plan_key,status,last_payment_at,last_payment_amount&limit=10000`,
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

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const todayIso = kstTodayStartIso();
  const monthIso = kstMonthStartIso();

  const [users, plans, packOpensToday, revealsToday, clicksToday] = await Promise.all([
    fetchAuthUsers(),
    fetchAllPlans(),
    countRows("mvp_pack_opens", `opened_at=gte.${todayIso}&result=eq.success`),
    countRows("mvp_pack_reveals", `revealed_at=gte.${todayIso}`),
    countRows("mvp_pack_reveals", `link_clicked_at=gte.${todayIso}`),
  ]);

  const revenueToday = plans
    .filter((p) => p.last_payment_at && p.last_payment_at >= todayIso)
    .reduce((sum, p) => sum + (p.last_payment_amount ?? 0), 0);
  const revenueMonth = plans
    .filter((p) => p.last_payment_at && p.last_payment_at >= monthIso)
    .reduce((sum, p) => sum + (p.last_payment_amount ?? 0), 0);
  const activeSubs = plans.filter((p) => p.status === "active" && p.plan_key !== "free").length;
  const totalPro = plans.filter((p) => p.plan_key === "pro" && p.status === "active").length;
  const totalPlus = plans.filter((p) => p.plan_key === "plus" && p.status === "active").length;
  const totalStarter = plans.filter((p) => p.plan_key === "starter" && p.status === "active").length;
  const newSignupsToday = users.filter((u) => u.created_at >= todayIso).length;
  const totalAccounts = users.length;

  return NextResponse.json({
    revenueToday,
    revenueMonth,
    activeSubs,
    totalPro,
    totalPlus,
    totalStarter,
    newSignupsToday,
    packOpensToday,
    revealsToday,
    clicksToday,
    totalAccounts,
    computedAt: new Date().toISOString(),
  });
}
