// Wave 773 (2026-05-27): 사용자 home region 로드 + Daangn 매물 거리 필터링 헬퍼.

import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { evaluateDaangnRegionDistance } from "@/lib/daangn-region-distance";

export type UserHomeRegion = {
  daangn_region_id: string;
  daangn_region_name: string;
  daangn_full_path: string | null;
  source: string;
};

export type LoadUserHomeRegionResult = {
  region: UserHomeRegion | null;
  errored: boolean;
};

// Wave 1202 (2026-06-06, audit P1): 반환을 { region, errored }로 분리.
//   기존엔 "동네 없음"과 "조회 실패(DB blip/타임아웃)"를 둘 다 null로 반환 → 호출처가
//   에러를 "미설정"으로 오인해 정상 멤버를 온보딩으로 redirect. errored 구분으로 에러 시 redirect 보류.
export async function loadUserHomeRegion(
  userId: string,
): Promise<LoadUserHomeRegionResult> {
  if (!userId) return { region: null, errored: false };
  try {
    const res = await restFetch(
      `${tableUrl("mvp_user_home_regions")}?select=daangn_region_id,daangn_region_name,daangn_full_path,source&user_id=eq.${userId}&limit=1`,
      { headers: serviceHeaders() },
    );
    if (!res.ok) return { region: null, errored: true };
    const rows = (await res.json()) as UserHomeRegion[];
    return { region: rows[0] ?? null, errored: false };
  } catch {
    return { region: null, errored: true };
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
