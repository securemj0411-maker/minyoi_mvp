// Wave 93b: Pro 구독 판정.
// admin은 자동으로 Pro 간주 (개발/운영 테스트 편의).
// Pro 결제 통합 전에는 mvp_user_credits.pro_until column을 운영자가 수동으로 채워 활성화 (SQL).

import type { User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/auth-users";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export type ProStatus = {
  isPro: boolean;
  isAdmin: boolean;
  proUntil: string | null;
  source: "admin" | "subscription" | "none";
};

export async function getProStatus(user: User, userRef: string): Promise<ProStatus> {
  if (isAdminUser(user)) {
    return { isPro: true, isAdmin: true, proUntil: null, source: "admin" };
  }
  try {
    const res = await restFetch(
      `${tableUrl("mvp_user_credits")}?select=pro_until&user_ref=eq.${encodeURIComponent(userRef)}&auth_user_id=eq.${user.id}&limit=1`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as Array<{ pro_until: string | null }>;
    const proUntil = rows[0]?.pro_until ?? null;
    const isPro = proUntil ? new Date(proUntil) > new Date() : false;
    return { isPro, isAdmin: false, proUntil, source: isPro ? "subscription" : "none" };
  } catch {
    return { isPro: false, isAdmin: false, proUntil: null, source: "none" };
  }
}
