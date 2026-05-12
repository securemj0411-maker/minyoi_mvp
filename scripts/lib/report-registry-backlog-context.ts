import { findRegistryGroupKeyForDiscoveredCategory, normalizeDiscoveredCategoryToRegistryCategory } from "./report-category-key-spec";
import { findEditorialSpecForGroupCategory } from "./report-category-editorial-spec";
import { registryPacketGroups, type RegistryPacketGroup } from "./report-packet-registry";

export type LaneBucket = "candidate" | "hold" | "split" | "mixed";

export type RegistryBacklogSignalRow = {
  key: string;
  category: string;
  family: string;
  phase: string;
  lane: LaneBucket;
  packets: number;
  tags: string[];
  severityScore: number;
};

function laneBucket(laneFallback: string): LaneBucket {
  if (laneFallback.includes("split")) return "split";
  if (laneFallback.includes("hold")) return "hold";
  if (laneFallback.includes("candidate")) return "candidate";
  return "mixed";
}

export function buildRegistryBacklogSignalRows(groups: readonly RegistryPacketGroup[] = registryPacketGroups): RegistryBacklogSignalRow[] {
  return groups.map((group) => {
    const candidateEditorial = findEditorialSpecForGroupCategory(group.category);
    const lane = candidateEditorial ? laneBucket(candidateEditorial.laneFallback) : "mixed";
    const severityScore =
      (group.phase === "positive-density" ? 3 : 1) +
      (group.tags.includes("guide-bridge") ? 1 : 0) +
      (lane === "hold" ? 1 : 0);

    return {
      key: group.key,
      category: group.category,
      family: group.family,
      phase: group.phase,
      lane,
      packets: group.scripts.length,
      tags: group.tags,
      severityScore,
    };
  });
}

export function sortRegistryBacklogSignalRows(rows: readonly RegistryBacklogSignalRow[]): RegistryBacklogSignalRow[] {
  return [...rows].sort((a, b) => b.severityScore - a.severityScore || b.packets - a.packets || a.key.localeCompare(b.key));
}

export function normalizeQueueCategoryToRegistryCategory(category: string): string {
  return normalizeDiscoveredCategoryToRegistryCategory(category);
}

export function findTopRegistryBacklogSignalForQueueCategory(
  queueCategory: string,
  rows: readonly RegistryBacklogSignalRow[],
): RegistryBacklogSignalRow | null {
  const explicitGroupKey = findRegistryGroupKeyForDiscoveredCategory(queueCategory);
  if (explicitGroupKey) {
    const direct = rows.find((row) => row.key === explicitGroupKey);
    if (direct) return direct;
  }
  const normalized = normalizeQueueCategoryToRegistryCategory(queueCategory);
  const matched = rows.filter((row) => row.category === normalized);
  if (matched.length === 0) return null;
  return sortRegistryBacklogSignalRows(matched)[0] ?? null;
}
