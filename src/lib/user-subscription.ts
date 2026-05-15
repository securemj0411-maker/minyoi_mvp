// Wave 104 (2026-05-15): Pro 구독 판정 — mvp_user_plans (실제 구독 테이블) 기반으로 통일.
//
// 이전: mvp_user_credits.pro_until 만 읽음. 그러나 결제 시 subscribe_mvp_plan RPC가 mvp_user_plans만
// update하고 pro_until은 안 건드림 → 사용자가 Pro 결제해도 isPro=false → 핫딜/신선도 슬라이더 게이팅 작동 X.
//
// 수정: source of truth = mvp_user_plans.plan_key + current_period_end. pro_until column은 legacy로 유지
// (admin 수동 박기용 fallback). admin은 gating 편의를 위해 auto-Pro (실 결제 안 해도 기능 테스트 가능).

import type { User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/auth-users";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export type ProStatus = {
  isPro: boolean;
  isAdmin: boolean;
  proUntil: string | null;
  source: "admin" | "subscription" | "legacy_pro_until" | "none";
};

export async function getProStatus(user: User, userRef: string): Promise<ProStatus> {
  if (isAdminUser(user)) {
    return { isPro: true, isAdmin: true, proUntil: null, source: "admin" };
  }
  try {
    // 1차: mvp_user_plans (실제 결제 시스템).
    const planRes = await restFetch(
      `${tableUrl("mvp_user_plans")}?select=plan_key,status,current_period_end&user_ref=eq.${encodeURIComponent(userRef)}&auth_user_id=eq.${user.id}&limit=1`,
      { headers: serviceHeaders() },
    );
    const planRows = (await planRes.json()) as Array<{
      plan_key: string | null;
      status: string | null;
      current_period_end: string | null;
    }>;
    const row = planRows[0];
    if (row && row.plan_key === "pro") {
      const periodEnd = row.current_period_end;
      const inWindow = !periodEnd || new Date(periodEnd) > new Date();
      // status가 'cancelled'여도 current_period_end 안이면 Pro 유지 (cancelAtPeriodEnd 정책).
      if (inWindow && row.status !== "expired") {
        return { isPro: true, isAdmin: false, proUntil: periodEnd, source: "subscription" };
      }
    }

    // 2차 fallback: legacy mvp_user_credits.pro_until (admin 수동 박기 등).
    const creditRes = await restFetch(
      `${tableUrl("mvp_user_credits")}?select=pro_until&user_ref=eq.${encodeURIComponent(userRef)}&auth_user_id=eq.${user.id}&limit=1`,
      { headers: serviceHeaders() },
    );
    const creditRows = (await creditRes.json()) as Array<{ pro_until: string | null }>;
    const proUntil = creditRows[0]?.pro_until ?? null;
    if (proUntil && new Date(proUntil) > new Date()) {
      return { isPro: true, isAdmin: false, proUntil, source: "legacy_pro_until" };
    }
    return { isPro: false, isAdmin: false, proUntil: null, source: "none" };
  } catch {
    return { isPro: false, isAdmin: false, proUntil: null, source: "none" };
  }
}
