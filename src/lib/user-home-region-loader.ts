// Wave 773 (2026-05-27): 사용자 home region 로드 + Daangn 매물 거리 필터링 헬퍼.

import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { evaluateDaangnRegionDistance } from "@/lib/daangn-region-distance";

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
 * Backward-compatible helper for callers that only have a resolved item path.
 * New feed code should use evaluateDaangnRegionDistance(userPath, regionId, regionName)
 * so it can use static centroid coordinates instead of broad 시/도 matching.
 */
export function isDaangnRegionNearby(
  userFullPath: string | null | undefined,
  itemFullPath: string | null | undefined,
): boolean {
  if (!userFullPath || !itemFullPath) return true;
  return evaluateDaangnRegionDistance(userFullPath, null, itemFullPath).actionable;
}
