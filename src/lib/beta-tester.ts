// 2026-05-15: 베타 테스터 권한 helper.
// 운영자가 회원 페이지에서 사용자를 "베타 체험단"으로 등록하면 mvp_user_credits.is_beta_tester=true.
// 베타 테스터는 admin 권한 일부(운영자 풀 조회 등)를 받음. 단 admin 전용 액션(reset-db 등)은 X.

import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export async function isBetaTesterAuthId(authUserId: string): Promise<boolean> {
  if (!authUserId) return false;
  try {
    const url = `${tableUrl("mvp_user_credits")}?select=is_beta_tester&auth_user_id=eq.${encodeURIComponent(authUserId)}&limit=1`;
    const res = await restFetch(url, { method: "GET", headers: serviceHeaders() });
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ is_beta_tester?: boolean | null }>;
    return Boolean(rows[0]?.is_beta_tester);
  } catch {
    return false;
  }
}
