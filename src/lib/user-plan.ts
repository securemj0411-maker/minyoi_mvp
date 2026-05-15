import type { User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/auth-users";
import { planForKey, type PlanDefinition, type PlanKey } from "@/lib/plan-config";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export type UserPlanState = {
  plan: PlanDefinition;
  status: "active" | "cancelled" | "none";
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  dailyUsed: number;
  dailyLimit: number; // -1 = 무제한
  dailyResetOn: string | null;
  isAdmin: boolean;
};

type PlanRow = {
  plan_key?: string;
  status?: string;
  cancel_at_period_end?: boolean;
  current_period_end?: string | null;
  daily_used_count?: number;
  daily_reset_on?: string | null;
};

function adminPlanState(): UserPlanState {
  return {
    plan: { ...planForKey("pro"), name: "운영자", dailyOpenLimit: -1 },
    status: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    dailyUsed: 0,
    dailyLimit: -1,
    dailyResetOn: null,
    isAdmin: true,
  };
}

export async function getUserPlanState(user: User, userRef: string): Promise<UserPlanState> {
  if (isAdminUser(user)) return adminPlanState();

  const url = `${tableUrl("mvp_user_plans")}?select=plan_key,status,cancel_at_period_end,current_period_end,daily_used_count,daily_reset_on&user_ref=eq.${encodeURIComponent(userRef)}&auth_user_id=eq.${user.id}&limit=1`;
  const res = await restFetch(url, { method: "GET", headers: serviceHeaders() });
  const rows = (await res.json()) as PlanRow[];

  const row = rows[0];
  if (!row) {
    const free = planForKey("free");
    return {
      plan: free,
      status: "none",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      dailyUsed: 0,
      dailyLimit: free.dailyOpenLimit,
      dailyResetOn: null,
      isAdmin: false,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const resetOn = row.daily_reset_on ?? null;
  const stillToday = resetOn === today;
  const plan = planForKey(row.plan_key);

  return {
    plan,
    status: (row.status === "cancelled" ? "cancelled" : "active"),
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    currentPeriodEnd: row.current_period_end ?? null,
    dailyUsed: stillToday ? Math.max(0, Number(row.daily_used_count ?? 0)) : 0,
    dailyLimit: plan.dailyOpenLimit,
    dailyResetOn: resetOn,
    isAdmin: false,
  };
}

export async function subscribeUserPlan(input: {
  user: User;
  userRef: string;
  planKey: Exclude<PlanKey, "free">;
  paymentKey: string;
}): Promise<{ planKey: string; balance: number; currentPeriodEnd: string | null }> {
  const plan = planForKey(input.planKey);
  if (plan.key === "free") throw new Error("invalid plan");

  const res = await restFetch(rpcUrl("subscribe_mvp_plan"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({
      p_user_ref: input.userRef,
      p_auth_user_id: input.user.id,
      p_plan_key: plan.key,
      p_credits: plan.monthlyCredits,
      p_amount: plan.priceKrw,
      p_payment_key: input.paymentKey,
      p_period_days: 30,
    }),
  });
  const rows = (await res.json()) as Array<{ plan_key?: string; balance?: number; current_period_end?: string | null }>;
  const row = rows[0] ?? {};
  return {
    planKey: row.plan_key ?? plan.key,
    balance: Math.max(0, Number(row.balance ?? 0)),
    currentPeriodEnd: row.current_period_end ?? null,
  };
}

export async function cancelUserPlan(user: User, userRef: string): Promise<void> {
  await restFetch(rpcUrl("cancel_mvp_plan"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({ p_user_ref: userRef, p_auth_user_id: user.id }),
  });
}

export async function reactivateUserPlan(user: User, userRef: string): Promise<void> {
  await restFetch(rpcUrl("reactivate_mvp_plan"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({ p_user_ref: userRef, p_auth_user_id: user.id }),
  });
}

export async function consumeDailyQuota(input: {
  user: User;
  userRef: string;
  limit: number;
}): Promise<{ ok: boolean; used: number; limit: number; message: string }> {
  const res = await restFetch(rpcUrl("consume_mvp_daily_quota"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({
      p_user_ref: input.userRef,
      p_auth_user_id: input.user.id,
      p_limit: input.limit,
    }),
  });
  const rows = (await res.json()) as Array<{ ok?: boolean; used?: number; daily_limit?: number; message?: string }>;
  const row = rows[0] ?? {};
  return {
    ok: Boolean(row.ok),
    used: Number(row.used ?? 0),
    limit: Number(row.daily_limit ?? input.limit),
    message: String(row.message ?? ""),
  };
}
