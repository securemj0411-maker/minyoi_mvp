// Wave 773 (2026-05-27): Kakao reverse geocode 결과 → Daangn region seed 매핑.
//   사용자가 "서울특별시 서초구 서초동" 거주자면 Daangn 매물 region 중 같은 시도 매물 우선.
//   매핑 방법:
//     1. region_parents.json (Wave 914) 에서 user's full_path 와 정확히 매칭되는 region_id 찾기.
//     2. 없으면 DEFAULT_DAANGN_REGION_SEEDS 에서 시군구 seed 를 찾되, 표시 full_path 는 Kakao 원문 유지.
//   중요: 같은 구의 "첫 번째 동"으로 대체하면 상도1동 → 사당동처럼 사용자 확인값이 바뀐다.

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
  const path = normalizeRegionPath(fullPath);
  const parts = path.split(" ").filter(Boolean);

  // 1. 정확 동·읍·면 매칭 (Wave 914 leaf JSON map)
  for (const [id, mappedPath] of Object.entries(REGION_PARENTS)) {
    if (normalizeRegionPath(mappedPath) === path) {
      // 동 이름 추출 (마지막 word)
      const mappedParts = normalizeRegionPath(mappedPath).split(" ");
      const dongName = mappedParts[mappedParts.length - 1];
      return {
        daangn_region_id: id,
        daangn_region_name: dongName,
        daangn_full_path: mappedPath,
      };
    }
  }

  // 2. 정확 동 매핑이 없으면 시군구 seed 만 연결한다.
  //    표시값은 Kakao full path 그대로 유지해야 "상도1동 확인 → 사당동 저장" 같은 오표기가 없다.
  const seed = findAreaSeed(parts);
  if (seed) {
    return {
      daangn_region_id: seed.id,
      daangn_region_name: parts[parts.length - 1] ?? seed.name,
      daangn_full_path: path,
    };
  }

  return null;
}

function normalizeRegionPath(path: string) {
  return path.trim().replace(/\s+/g, " ");
}

function findAreaSeed(parts: string[]) {
  if (parts.length < 2) return null;
  const candidates = new Set<string>();

  // Kakao region2 can contain a space, e.g. "성남시 분당구".
  if (parts.length >= 4) candidates.add(parts.slice(1, -1).join(" "));
  candidates.add(parts[1]);
  if (parts.length >= 3) candidates.add(`${parts[1]} ${parts[2]}`);
  candidates.add(parts[0]);

  for (const name of candidates) {
    const seed = DEFAULT_DAANGN_REGION_SEEDS.find((r) => r.name === name);
    if (seed) return seed;
  }

  return null;
}

/**
 * 검색용: leaf region map + legacy area seed list 를 합쳐서 dropdown options.
 */
export function listAllDaangnRegions(): DaangnRegionMatch[] {
  const seedSet = new Set<string>();
  const out: DaangnRegionMatch[] = [];

  // region_parents.json 에 있는 동·읍·면 단위 — 가장 자세함.
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
