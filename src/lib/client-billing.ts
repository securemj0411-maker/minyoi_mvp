"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export type ClientPlanState = {
  planKey: "free" | "starter" | "plus" | "pro";
  planName: string;
  monthlyCredits: number;
  status: "active" | "cancelled" | "none";
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  dailyUsed: number;
  dailyLimit: number; // -1 = 무제한
  dailyResetOn: string | null;
  isAdmin: boolean;
};

async function authedFetch(url: string, init?: RequestInit): Promise<Response | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}

export async function loadClientPlan(): Promise<ClientPlanState | null> {
  const res = await authedFetch("/api/billing/me");
  if (!res || !res.ok) return null;
  const json = (await res.json()) as Partial<ClientPlanState>;
  return {
    planKey: (json.planKey as ClientPlanState["planKey"]) ?? "free",
    planName: String(json.planName ?? "Free"),
    monthlyCredits: Number(json.monthlyCredits ?? 0),
    status: (json.status as ClientPlanState["status"]) ?? "none",
    cancelAtPeriodEnd: Boolean(json.cancelAtPeriodEnd),
    currentPeriodEnd: json.currentPeriodEnd ?? null,
    dailyUsed: Math.max(0, Number(json.dailyUsed ?? 0)),
    dailyLimit: Number(json.dailyLimit ?? 0),
    dailyResetOn: json.dailyResetOn ?? null,
    isAdmin: Boolean(json.isAdmin),
  };
}

export async function subscribeClientPlan(planKey: "starter" | "plus" | "pro", paymentKey: string, orderId: string) {
  const res = await authedFetch("/api/billing/subscribe", {
    method: "POST",
    body: JSON.stringify({ planKey, paymentKey, orderId }),
  });
  if (!res) throw new Error("로그인이 필요합니다");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "결제 실패");
  return json as {
    ok: boolean;
    planKey: string;
    balance: number;
    currentPeriodEnd: string | null;
    amount: number;
    monthlyCredits: number;
  };
}

export async function cancelClientPlan(action: "cancel" | "reactivate" = "cancel") {
  const res = await authedFetch("/api/billing/cancel", {
    method: "POST",
    body: JSON.stringify({ action }),
  });
  if (!res) throw new Error("로그인이 필요합니다");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "요청 실패");
  return json as { ok: boolean; action: string };
}
