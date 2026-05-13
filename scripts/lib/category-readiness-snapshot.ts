import { readFile } from "node:fs/promises";
import path from "node:path";

export type CategorySnapshot = {
  category: string;
  readinessStatus: "ready" | "internal_only" | "blocked" | "unregistered";
  minReadyPool: number | null;
  minParseRate: number | null;
  minTrustedKeys: number | null;
  parsedCount: number;
  needsReviewFalseShare: number;
  comparableKeyCompleteShare: number;
  distinctComparableKeys: number;
  miningLanes: string[];
  miningTotalFetched: number;
  miningParseReady: number;
  miningParseReadyShare: number;
  semanticPollutionShare: number | null;
  comparableKeyDimensions: number;
  comparableKeyMissingAxes: number;
  notes: string[];
};

const miningDir = path.join(process.cwd(), "category-intelligence");

const CATEGORY_LANE_MAP: Record<string, string[]> = {
  earphone: [
    "airpods",
    "airpods_4_anc",
    "airpods_max_usbc",
    "airpods_pro_3",
    "beats_solo_4",
    "beats_studio_pro",
    "bose_qc45",
    "bose_qc_ultra",
    "earphone_discovered",
    "galaxy_buds_3_pro",
    "sony_wh1000xm4",
    "sony_wh_ch520",
    "headphone_discovered",
  ],
  smartwatch: ["applewatch", "applewatch_ultra_2", "galaxywatch", "smartwatch_discovered"],
  smartphone: [
    "iphone_11_pro_128gb_self",
    "iphone_12_pro_128gb_self",
    "iphone_13_pro_128gb_self",
    "iphone_14_pro_128gb_self",
    "iphone_15_pro_128gb_self",
    "iphone_16_pro_128gb_self",
    "galaxy_s23_ultra_256_self",
    "galaxy_s24_ultra_256_self",
    "galaxy_s25_ultra_256_self",
    "galaxy_z_flip_5_256_self",
    "smartphone",
  ],
  tablet: [
    "galaxy_tab_s10_ultra_256_self",
    "ipad_air_m2_11_256_wifi",
    "ipad_air_m3_11_256_wifi",
    "ipad_mini_7_128_wifi",
    "ipad_pro_11_m2_256_wifi",
    "ipad_pro_11_m4_256_wifi",
    "ipad_pro_13_m2_256_wifi",
    "ipad_pro_13_m4_256_wifi",
  ],
  laptop: [
    "laptop",
    "lg_gram_17_2024",
    "macbook_air_m2_13_256",
    "macbook_air_m3_13_256",
    "macbook_pro_14_m3_18_512",
  ],
  monitor: ["monitor_discovered"],
  speaker: ["speaker_audio_discovered"],
  camera: ["camera_discovered"],
  desktop: ["desktop_pc_discovered"],
  game_console: ["game_console_body_narrow", "game_console_discovered", "ps5_slim", "switch_oled"],
  home_appliance: ["home_appliance_tech_discovered"],
};

export const CATEGORY_DISPLAY_ORDER = [
  "earphone",
  "smartwatch",
  "smartphone",
  "tablet",
  "laptop",
  "monitor",
  "speaker",
  "camera",
  "desktop",
  "game_console",
  "home_appliance",
];

type ParseSummary = {
  total_fetched?: number;
  parse_ready_count?: number;
  reject_breakdown?: { reason: string; count: number }[];
};

const SEMANTIC_POLLUTION_LABELS = new Set([
  "reject_buying_post",
  "reject_accessory_only",
  "reject_broken_or_parts",
  "reject_refurbished_only",
  "reject_lost_or_locked",
]);

export async function aggregateMiningForCategory(category: string): Promise<{
  miningLanes: string[];
  totalFetched: number;
  parseReady: number;
  pollutionCount: number;
}> {
  const lanes = CATEGORY_LANE_MAP[category] ?? [];
  let totalFetched = 0;
  let parseReady = 0;
  let pollutionCount = 0;
  const presentLanes: string[] = [];
  for (const lane of lanes) {
    const file = path.join(miningDir, lane, "parse_summary.json");
    try {
      const parsed = JSON.parse(await readFile(file, "utf8")) as ParseSummary;
      totalFetched += parsed.total_fetched ?? 0;
      parseReady += parsed.parse_ready_count ?? 0;
      for (const r of parsed.reject_breakdown ?? []) {
        if (SEMANTIC_POLLUTION_LABELS.has(r.reason)) pollutionCount += r.count;
      }
      presentLanes.push(lane);
    } catch {
      // lane absent or missing summary — skip
    }
  }
  return { miningLanes: presentLanes, totalFetched, parseReady, pollutionCount };
}

// DB measurements are passed in from the caller (so the packet can use static measurements without re-querying supabase each run).
export type DbMeasurement = {
  parsedCount: number;
  needsReviewFalse: number;
  comparableKeyComplete: number;
  distinctComparableKeys: number;
};

export type ReadinessRow = {
  status: "ready" | "internal_only" | "blocked";
  minReadyPool: number;
  minParseRate: number;
  minTrustedKeys: number;
};

export async function buildSnapshot(
  category: string,
  dbMeasure: DbMeasurement | null,
  readinessRow: ReadinessRow | null,
  comparableKeyDimensions: number,
  comparableKeyMissingAxes: number,
  notes: string[] = [],
): Promise<CategorySnapshot> {
  const { miningLanes, totalFetched, parseReady, pollutionCount } = await aggregateMiningForCategory(category);
  const safe = (n: number, d: number) => (d > 0 ? Number((n / d).toFixed(3)) : 0);
  return {
    category,
    readinessStatus: readinessRow ? readinessRow.status : "unregistered",
    minReadyPool: readinessRow?.minReadyPool ?? null,
    minParseRate: readinessRow?.minParseRate ?? null,
    minTrustedKeys: readinessRow?.minTrustedKeys ?? null,
    parsedCount: dbMeasure?.parsedCount ?? 0,
    needsReviewFalseShare: safe(dbMeasure?.needsReviewFalse ?? 0, dbMeasure?.parsedCount ?? 0),
    comparableKeyCompleteShare: safe(dbMeasure?.comparableKeyComplete ?? 0, dbMeasure?.parsedCount ?? 0),
    distinctComparableKeys: dbMeasure?.distinctComparableKeys ?? 0,
    miningLanes,
    miningTotalFetched: totalFetched,
    miningParseReady: parseReady,
    miningParseReadyShare: safe(parseReady, totalFetched),
    semanticPollutionShare: totalFetched > 0 ? safe(pollutionCount, totalFetched) : null,
    comparableKeyDimensions,
    comparableKeyMissingAxes,
    notes,
  };
}
