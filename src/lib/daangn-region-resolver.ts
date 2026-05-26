// Wave 772 (2026-05-27): Daangn region_id → 시/구/동 full path resolver.
//   DB는 동만 저장 (예: "서초동"). 사용자는 어느 시/구의 동인지 알아야 거리 판단 가능.
//   src/lib/generated/daangn-region-parents.json (Wave 772 script로 생성) 에 region_id → full path 매핑.
//   UI render 시점에 이 함수로 full path 반환.

import regionParentsRaw from "@/lib/generated/daangn-region-parents.json";

const REGION_PARENTS = regionParentsRaw as Record<string, string>;

/**
 * region_id 와 region_name 받아서 가능하면 "{시도} {시군구} {동}" full path 반환.
 * 매핑 없으면 region_name fallback (동 이름만).
 * 둘 다 없으면 null.
 */
export function resolveDaangnFullRegion(
  regionId: string | number | null | undefined,
  regionName: string | null | undefined,
): string | null {
  const idStr = regionId != null ? String(regionId).trim() : "";
  const trimmedName = regionName?.trim() || "";

  if (idStr && REGION_PARENTS[idStr]) {
    return REGION_PARENTS[idStr];
  }

  return trimmedName || null;
}

/**
 * 짧은 형식 "{시군구} {동}" (시도 prefix 생략 — UI 카드 공간 절약용).
 */
export function resolveDaangnShortRegion(
  regionId: string | number | null | undefined,
  regionName: string | null | undefined,
): string | null {
  const full = resolveDaangnFullRegion(regionId, regionName);
  if (!full) return null;

  const parts = full.split(" ");
  if (parts.length < 2) return full;

  const FIRST_LEVEL_PATTERNS = /^(서울특별시|경기도|인천광역시|부산광역시|대구광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|강원특별자치도|강원도|충청북도|충청남도|전라북도|전북특별자치도|전라남도|경상북도|경상남도|제주특별자치도)$/;
  if (FIRST_LEVEL_PATTERNS.test(parts[0])) {
    return parts.slice(1).join(" ");
  }

  return full;
}
