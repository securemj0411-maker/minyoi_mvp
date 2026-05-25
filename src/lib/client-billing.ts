"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { PlanKey } from "@/lib/plan-config";

export type ClientPlanState = {
  planKey: PlanKey;
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

// Wave launch-7 (audit CRITICAL #6 — PortOne webhook 부재 대안):
// subscribeClientPlan 호출 시 망 끊김 / timeout 으로 한 번 실패하면 사용자가 결제는 됐는데
// credit 못 받음 → 카톡 컴플레인. webhook 박는 대신 retry 강화 + idempotency RPC
// (subscribe_mvp_plan_idempotent) 로 99.9% 케이스 해결.
//
// 전략: 최대 3회 retry, exponential backoff (1s → 2s → 4s).
// 멱등성 보장 = 우리 RPC 가 paymentId UNIQUE 처리 → 중복 호출 안전.
// 마지막 시도까지 실패 시 throw — UI 에서 paymentId 보존 + "다시 시도" 버튼.

const SUBSCRIBE_MAX_ATTEMPTS = 3;
const SUBSCRIBE_RETRY_BASE_MS = 1000;

type SubscribeResponse = {
  ok: boolean;
  planKey: string;
  balance: number;
  currentPeriodEnd: string | null;
  amount: number;
  monthlyCredits: number;
  paymentId: string;
  verification: "verified" | "skipped_dev_no_secret";
};

function shouldRetry(status: number, hadResponse: boolean): boolean {
  // 망 오류 (response 없음) 또는 5xx / 408 / 429 → retry.
  // 4xx (다른 거) 는 비즈니스 거절이라 retry 무의미 — invalid plan, 멱등성 충돌 등.
  if (!hadResponse) return true;
  if (status === 408 || status === 429) return true;
  if (status >= 500) return true;
  return false;
}

export async function subscribeClientPlan(planKey: Exclude<PlanKey, "free">, paymentId: string, orderId: string) {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= SUBSCRIBE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await authedFetch("/api/billing/subscribe", {
        method: "POST",
        body: JSON.stringify({ planKey, paymentId, orderId }),
      });
      if (!res) throw new Error("로그인이 필요합니다");
      const json = await res.json();
      if (!res.ok) {
        if (shouldRetry(res.status, true) && attempt < SUBSCRIBE_MAX_ATTEMPTS) {
          lastError = new Error(json.message ?? json.error ?? `subscribe ${res.status}`);
          await new Promise((r) => setTimeout(r, SUBSCRIBE_RETRY_BASE_MS * Math.pow(2, attempt - 1)));
          continue;
        }
        throw new Error(json.message ?? json.error ?? "결제 완료 등록 실패");
      }
      return json as SubscribeResponse;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // fetch 자체 throw (offline 등) → retry.
      if (shouldRetry(0, false) && attempt < SUBSCRIBE_MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, SUBSCRIBE_RETRY_BASE_MS * Math.pow(2, attempt - 1)));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error("결제 완료 등록 실패");
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
