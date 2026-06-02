// Wave 888 (2026-05-27): Daangn local-distance evaluator.
//
// We cannot ask Daangn whether a logged-in user can chat for a specific listing.
// Instead, we compute a conservative execution-distance signal from the user's
// confirmed home region and the listing region centroid.

import regionGeoRaw from "@/lib/generated/daangn-region-geo.json";
import regionParentsRaw from "@/lib/generated/daangn-region-parents.json";
import { resolveDaangnFullRegion } from "@/lib/daangn-region-resolver";

export type DaangnRegionGeo = {
  id: string;
  name: string;
  query: string;
  fullPath: string;
  lat: number;
  lng: number;
  source: "daangn_parent" | "daangn_seed";
};

export type DaangnDistanceBucket = "near" | "reachable" | "far" | "too_far" | "unknown";

export type DaangnDistanceSignal = {
  actionable: boolean;
  bucket: DaangnDistanceBucket;
  distanceKm: number | null;
  rank: number;
  label: string | null;
  userGeo: DaangnRegionGeo | null;
  itemGeo: DaangnRegionGeo | null;
  itemFullPath: string | null;
};

const REGION_GEO = regionGeoRaw as Record<string, DaangnRegionGeo>;
const REGION_PARENT_PATHS = regionParentsRaw as Record<string, string>;
const NEARBY_REGION_ID_CACHE = new Map<string, string[]>();

const GEO_BY_PATH = new Map<string, DaangnRegionGeo>();
for (const geo of Object.values(REGION_GEO)) {
  GEO_BY_PATH.set(normalizeRegionPath(geo.fullPath), geo);
  GEO_BY_PATH.set(normalizeRegionPath(geo.query), geo);
}

const FIRST_LEVEL_ALIASES: Record<string, string> = {
  서울: "서울",
  서울특별시: "서울",
  경기: "경기",
  경기도: "경기",
  인천: "인천",
  인천광역시: "인천",
  부산: "부산",
  부산광역시: "부산",
  대구: "대구",
  대구광역시: "대구",
  광주: "광주",
  광주광역시: "광주",
  대전: "대전",
  대전광역시: "대전",
  울산: "울산",
  울산광역시: "울산",
  세종: "세종",
  세종특별자치시: "세종",
  강원: "강원",
  강원도: "강원",
  강원특별자치도: "강원",
  충북: "충북",
  충청북도: "충북",
  충남: "충남",
  충청남도: "충남",
  전북: "전북",
  전라북도: "전북",
  전북특별자치도: "전북",
  전남: "전남",
  전라남도: "전남",
  경북: "경북",
  경상북도: "경북",
  경남: "경남",
  경상남도: "경남",
  제주: "제주",
  제주특별자치도: "제주",
};

const NEAR_KM = 6;
const REACHABLE_KM = 10;
const FAR_KM = 16;

export function normalizeRegionPath(path: string | null | undefined) {
  return String(path ?? "").trim().replace(/\s+/g, " ");
}

export function regionFirstLevel(path: string | null | undefined) {
  const first = normalizeRegionPath(path).split(" ")[0] ?? "";
  return FIRST_LEVEL_ALIASES[first] ?? first;
}

function regionSecondLevel(path: string | null | undefined) {
  return normalizeRegionPath(path).split(" ").filter(Boolean)[1] ?? "";
}

function sameLocalAdministrativeArea(
  userPath: string | null | undefined,
  itemPath: string | null | undefined,
) {
  const userFirst = regionFirstLevel(userPath);
  const itemFirst = regionFirstLevel(itemPath);
  const userSecond = regionSecondLevel(userPath);
  const itemSecond = regionSecondLevel(itemPath);
  return Boolean(userFirst && itemFirst && userSecond && itemSecond && userFirst === itemFirst && userSecond === itemSecond);
}

function pathPrefixes(path: string) {
  const parts = normalizeRegionPath(path).split(" ").filter(Boolean);
  const out: string[] = [];
  for (let len = parts.length; len >= 1; len -= 1) {
    out.push(parts.slice(0, len).join(" "));
  }
  return out;
}

export function resolveDaangnGeoByPath(path: string | null | undefined): DaangnRegionGeo | null {
  const normalized = normalizeRegionPath(path);
  if (!normalized) return null;

  for (const prefix of pathPrefixes(normalized)) {
    const exact = GEO_BY_PATH.get(prefix);
    if (exact) return exact;
  }

  const parts = normalized.split(" ").filter(Boolean);
  const second = parts[1];
  if (second) {
    for (const geo of Object.values(REGION_GEO)) {
      const geoParts = normalizeRegionPath(geo.fullPath).split(" ");
      if (regionFirstLevel(geo.fullPath) === regionFirstLevel(normalized) && geoParts.includes(second)) {
        return geo;
      }
    }
  }

  return null;
}

export type DaangnRegionDistanceEntry = DaangnRegionGeo & {
  distanceKm: number;
};

export function listDaangnRegionsByDistance(
  userFullPath: string | null | undefined,
  maxKm = REACHABLE_KM,
  limit = Number.POSITIVE_INFINITY,
): DaangnRegionDistanceEntry[] {
  const userGeo = resolveDaangnGeoByPath(userFullPath);
  if (!userGeo) return [];

  return Object.values(REGION_GEO)
    .map((geo) => {
      const distance = distanceKm(userGeo, geo);
      return distance == null ? null : { ...geo, distanceKm: Number(distance.toFixed(1)) };
    })
    .filter((entry): entry is DaangnRegionDistanceEntry => entry != null && entry.distanceKm <= maxKm)
    .sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return a.fullPath.localeCompare(b.fullPath, "ko");
    })
    .slice(0, Math.max(0, limit));
}

export function nearbyDaangnRegionIds(
  userFullPath: string | null | undefined,
  maxKm = REACHABLE_KM,
  limit = Number.POSITIVE_INFINITY,
): string[] {
  const cacheKey = `${normalizeRegionPath(userFullPath)}|${maxKm}|${limit}`;
  const cached = NEARBY_REGION_ID_CACHE.get(cacheKey);
  if (cached) return [...cached];

  const userGeo = resolveDaangnGeoByPath(userFullPath);
  if (!userGeo) return [];

  const entries: Array<{ id: string; distanceKm: number; path: string }> = [];
  const seen = new Set<string>();
  for (const geo of listDaangnRegionsByDistance(userFullPath, maxKm)) {
    entries.push({ id: geo.id, distanceKm: geo.distanceKm, path: geo.fullPath });
    seen.add(geo.id);
  }

  // Raw Daangn rows often store parent/administrative ids (for example 흑석동=331)
  // while generated geo rows may store Daangn search ids. Include parent ids by
  // resolving their path to the nearest known centroid, otherwise nearby dong
  // listings can be invisible to feed prefetch.
  for (const [id, path] of Object.entries(REGION_PARENT_PATHS)) {
    if (seen.has(id)) continue;
    const geo = resolveDaangnGeoByPath(path);
    const distance = distanceKm(userGeo, geo);
    if (distance == null || distance > maxKm) continue;
    entries.push({ id, distanceKm: Number(distance.toFixed(1)), path });
    seen.add(id);
  }

  const ids = entries
    .sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return a.path.localeCompare(b.path, "ko");
    })
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.id);
  NEARBY_REGION_ID_CACHE.set(cacheKey, ids);
  return [...ids];
}

export function resolveDaangnGeo(
  regionId: string | number | null | undefined,
  regionName: string | null | undefined,
): { geo: DaangnRegionGeo | null; fullPath: string | null } {
  const id = regionId != null ? String(regionId).trim() : "";
  if (id && REGION_GEO[id]) {
    return { geo: REGION_GEO[id], fullPath: REGION_GEO[id].fullPath };
  }

  const fullPath = resolveDaangnFullRegion(regionId, regionName);
  return { geo: resolveDaangnGeoByPath(fullPath), fullPath };
}

export function distanceKm(
  left: { lat: number; lng: number } | null | undefined,
  right: { lat: number; lng: number } | null | undefined,
): number | null {
  if (!left || !right) return null;
  if (!Number.isFinite(left.lat) || !Number.isFinite(left.lng) || !Number.isFinite(right.lat) || !Number.isFinite(right.lng)) {
    return null;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(right.lat - left.lat);
  const dLng = toRad(right.lng - left.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(left.lat)) * Math.cos(toRad(right.lat)) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceLabel(bucket: DaangnDistanceBucket, distance: number | null) {
  const rounded = distance == null ? null : Math.max(1, Math.round(distance));
  if (bucket === "near") return rounded == null ? "가까운 동네" : `가까운 동네 · 약 ${rounded}km`;
  if (bucket === "reachable") return rounded == null ? "근처 생활권" : `생활권 · 약 ${rounded}km`;
  if (bucket === "far") return rounded == null ? "먼 편" : `먼 편 · 약 ${rounded}km`;
  if (bucket === "too_far") return rounded == null ? "거리 멂" : `거리 멂 · 약 ${rounded}km`;
  return null;
}

export function evaluateDaangnRegionDistance(
  userFullPath: string | null | undefined,
  itemRegionId: string | number | null | undefined,
  itemRegionName: string | null | undefined,
): DaangnDistanceSignal {
  const normalizedUserPath = normalizeRegionPath(userFullPath);
  const userGeo = resolveDaangnGeoByPath(userFullPath);
  const item = resolveDaangnGeo(itemRegionId, itemRegionName);

  if (!normalizedUserPath) {
    return {
      actionable: true,
      bucket: "unknown",
      distanceKm: null,
      rank: 4,
      label: null,
      userGeo,
      itemGeo: item.geo,
      itemFullPath: item.fullPath,
    };
  }

  if (!item.fullPath) {
    return {
      actionable: false,
      bucket: "unknown",
      distanceKm: null,
      rank: 9,
      label: "거리 확인 필요",
      userGeo,
      itemGeo: item.geo,
      itemFullPath: item.fullPath,
    };
  }

  const distance = distanceKm(userGeo, item.geo);

  if (distance != null) {
    const roundedDistance = Number(distance.toFixed(1));
    const bucket: DaangnDistanceBucket =
      distance <= NEAR_KM ? "near" :
      distance <= REACHABLE_KM ? "reachable" :
      distance <= FAR_KM ? "far" :
      "too_far";

    return {
      actionable: bucket === "near" || bucket === "reachable",
      bucket,
      distanceKm: roundedDistance,
      rank: bucket === "near" ? 0 : bucket === "reachable" ? 1 : bucket === "far" ? 8 : 9,
      label: distanceLabel(bucket, distance),
      userGeo,
      itemGeo: item.geo,
      itemFullPath: item.fullPath,
    };
  }

  const sameFirstLevel = regionFirstLevel(normalizedUserPath) && regionFirstLevel(normalizedUserPath) === regionFirstLevel(item.fullPath);
  const sameLocalArea = sameLocalAdministrativeArea(normalizedUserPath, item.fullPath);
  return {
    actionable: sameLocalArea,
    bucket: sameFirstLevel ? "unknown" : "too_far",
    distanceKm: null,
    rank: sameLocalArea ? 4 : 9,
    label: sameLocalArea ? "같은 구 · 거리 확인 필요" : sameFirstLevel ? "거리 확인 필요" : "거리 멂",
    userGeo,
    itemGeo: item.geo,
    itemFullPath: item.fullPath,
  };
}

export function isDaangnDistanceActionable(signal: DaangnDistanceSignal) {
  return signal.actionable;
}
