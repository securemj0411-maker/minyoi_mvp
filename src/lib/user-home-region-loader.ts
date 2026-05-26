// Wave 773 (2026-05-27): 사용자 home region 로드 + Daangn 매물 거리 필터링 헬퍼.

import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export type UserHomeRegion = {
  daangn_region_id: string;
  daangn_region_name: string;
  daangn_full_path: string | null;
  source: string;
};

export async function loadUserHomeRegion(userId: string): Promise<UserHomeRegion | null> {
  if (!userId) return null;
  try {
    const res = await restFetch(
      `${tableUrl("mvp_user_home_regions")}?select=daangn_region_id,daangn_region_name,daangn_full_path,source&user_id=eq.${userId}&limit=1`,
      { headers: serviceHeaders() },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as UserHomeRegion[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Daangn 매물이 user home region 과 같은 시/도에 있는지 체크.
 *   true = 같은 시/도 → 채팅 가능 (display)
 *   false = 다른 시/도 → 채팅 불가 (hide)
 *   user home 또는 daangn full_path 없으면 true (보수적, 보여줌).
 */
export function isDaangnRegionNearby(
  userFullPath: string | null | undefined,
  itemFullPath: string | null | undefined,
): boolean {
  if (!userFullPath || !itemFullPath) return true;
  const userSido = userFullPath.split(" ")[0];
  const itemSido = itemFullPath.split(" ")[0];
  if (!userSido || !itemSido) return true;
  return userSido === itemSido;
}
