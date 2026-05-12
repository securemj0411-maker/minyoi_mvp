export type ReportCategoryKeySpec = {
  registryCategory: string;
  discoveredCategory: string;
  registryGroupKey: string;
};

export const reportCategoryKeySpecs: ReportCategoryKeySpec[] = [
  { registryCategory: "earphone", discoveredCategory: "earphone_discovered", registryGroupKey: "earphone-airpods-galaxybuds" },
  { registryCategory: "headphone", discoveredCategory: "headphone_discovered", registryGroupKey: "headphone-airpodsmax" },
  { registryCategory: "monitor", discoveredCategory: "monitor_discovered", registryGroupKey: "monitor-modelcode" },
  { registryCategory: "desktop", discoveredCategory: "desktop_pc_discovered", registryGroupKey: "desktop-fullunit" },
  { registryCategory: "game-console-body", discoveredCategory: "game_console_body_narrow", registryGroupKey: "game-console-body" },
  { registryCategory: "game-console-broad", discoveredCategory: "game_console_discovered", registryGroupKey: "game-console-body" },
  { registryCategory: "camera", discoveredCategory: "camera_discovered", registryGroupKey: "camera-package" },
  { registryCategory: "smartwatch", discoveredCategory: "smartwatch_discovered", registryGroupKey: "smartwatch-wearables" },
  { registryCategory: "speaker", discoveredCategory: "speaker_audio_discovered", registryGroupKey: "speaker-portable" },
  { registryCategory: "home-appliance", discoveredCategory: "home_appliance_tech_discovered", registryGroupKey: "home-appliance-vacuum" },
];

const discoveredByRegistry = new Map(reportCategoryKeySpecs.map((spec) => [spec.registryCategory, spec.discoveredCategory]));
const registryByDiscovered = new Map(reportCategoryKeySpecs.map((spec) => [spec.discoveredCategory, spec.registryCategory]));
const groupKeyByDiscovered = new Map(reportCategoryKeySpecs.map((spec) => [spec.discoveredCategory, spec.registryGroupKey]));
const groupKeyByRegistry = new Map(reportCategoryKeySpecs.map((spec) => [spec.registryCategory, spec.registryGroupKey]));

export function findDiscoveredCategoryForRegistryCategory(registryCategory: string): string | null {
  return discoveredByRegistry.get(registryCategory) ?? null;
}

export function findRegistryGroupKeyForDiscoveredCategory(discoveredCategory: string): string | null {
  return groupKeyByDiscovered.get(discoveredCategory) ?? null;
}

export function findRegistryGroupKeyForRegistryCategory(registryCategory: string): string | null {
  return groupKeyByRegistry.get(registryCategory) ?? null;
}

export function normalizeDiscoveredCategoryToRegistryCategory(discoveredCategory: string): string {
  return (
    registryByDiscovered.get(discoveredCategory) ??
    discoveredCategory
      .replace(/_body_narrow$/g, "-body")
      .replace(/_discovered$/g, "")
      .replace(/_audio$/g, "")
      .replace(/_pc$/g, "")
      .replace(/_tech$/g, "")
      .replace(/_/g, "-")
  );
}
