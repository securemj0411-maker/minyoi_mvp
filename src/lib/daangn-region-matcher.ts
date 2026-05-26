// Wave 773 (2026-05-27): Kakao reverse geocode 결과 → Daangn 270 region seed 매핑.
//   사용자가 "서울특별시 서초구 서초동" 거주자면 Daangn 매물 region 중 서초구 매물 우선.
//   매핑 방법:
//     1. region_parents.json (Wave 772) 에서 user's full_path 와 정확히 매칭되는 region_id 찾기.
//     2. 없으면 region2 (시군구) prefix 매칭. e.g., "서울특별시 서초구"로 시작하는 region 중 첫 번째.
//     3. 그것도 없으면 region1 (시도) prefix.
//   결과: 가장 정확한 Daangn region_id + 이름 + full_path.

import regionParentsRaw from "@/lib/generated/daangn-region-parents.json";
import { DEFAULT_DAANGN_REGION_SEEDS } from "@/lib/daangn";

const REGION_PARENTS = regionParentsRaw as Record<string, string>;

export type DaangnRegionMatch = {
  daangn_region_id: string;
  daangn_region_name: string;
  daangn_full_path: string;
};

/**
 * Kakao reverse geocode 결과 ("서울특별시 서초구 서초동") → Daangn region_id 매핑.
 */
export function matchDaangnRegionByPath(fullPath: string): DaangnRegionMatch | null {
  if (!fullPath) return null;
  const path = fullPath.trim();

  // 1. 정확 동·읍·면 매칭 (Wave 772 JSON map)
  for (const [id, mappedPath] of Object.entries(REGION_PARENTS)) {
    if (mappedPath === path) {
      // 동 이름 추출 (마지막 word)
      const parts = mappedPath.split(" ");
      const dongName = parts[parts.length - 1];
      return {
        daangn_region_id: id,
        daangn_region_name: dongName,
        daangn_full_path: mappedPath,
      };
    }
  }

  // 2. 시군구 prefix 매칭 — "서울특별시 서초구"로 시작하는 region 중 첫 번째.
  const parts = path.split(" ");
  if (parts.length >= 2) {
    const sigunguPrefix = parts.slice(0, 2).join(" ");
    for (const [id, mappedPath] of Object.entries(REGION_PARENTS)) {
      if (mappedPath.startsWith(sigunguPrefix)) {
        const dongName = mappedPath.split(" ").pop() ?? "";
        return {
          daangn_region_id: id,
          daangn_region_name: dongName,
          daangn_full_path: mappedPath,
        };
      }
    }
  }

  // 3. 시도 prefix 매칭 — "서울특별시"로 시작하는 region 중 첫 번째.
  if (parts.length >= 1) {
    const sidoPrefix = parts[0];
    for (const [id, mappedPath] of Object.entries(REGION_PARENTS)) {
      if (mappedPath.startsWith(sidoPrefix)) {
        const dongName = mappedPath.split(" ").pop() ?? "";
        return {
          daangn_region_id: id,
          daangn_region_name: dongName,
          daangn_full_path: mappedPath,
        };
      }
    }
  }

  return null;
}

/**
 * 검색용: 270 region seed list (시군구 단위) + region_parents.json (동 단위) 합쳐서 dropdown options.
 */
export function listAllDaangnRegions(): DaangnRegionMatch[] {
  const seedSet = new Set<string>();
  const out: DaangnRegionMatch[] = [];

  // region_parents.json 에 있는 동 단위 (218개) — 가장 자세함.
  for (const [id, mappedPath] of Object.entries(REGION_PARENTS)) {
    const dongName = mappedPath.split(" ").pop() ?? "";
    out.push({
      daangn_region_id: id,
      daangn_region_name: dongName,
      daangn_full_path: mappedPath,
    });
    seedSet.add(id);
  }

  // seed list 에 있지만 parents.json 에 없는 것 — 시군구 단위로 fallback.
  for (const seed of DEFAULT_DAANGN_REGION_SEEDS) {
    if (seedSet.has(seed.id)) continue;
    out.push({
      daangn_region_id: seed.id,
      daangn_region_name: seed.name,
      daangn_full_path: seed.name,  // 시군구 이름 그대로 (e.g., "강남구")
    });
  }

  return out;
}
