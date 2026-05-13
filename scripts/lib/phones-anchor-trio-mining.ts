import { readFile } from "node:fs/promises";
import path from "node:path";

export type RejectEntry = { reason: string; count: number };
export type ParseSummary = {
  version: number;
  lane_key: string;
  category: string;
  generated_at: string;
  queries: string[];
  pages: number;
  price_range_krw: [number, number];
  target_parse_ready: number;
  total_fetched: number;
  parse_ready_count: number;
  rejected_count: number;
  target_reached: boolean;
  reject_breakdown: RejectEntry[];
  accept_rules: { accept_all: string[]; accept_any_of: string[] };
  reject_rules: { label: string; pattern: string }[];
};

export type AnchorKey = "iphone_13_pro_128gb_self" | "galaxy_s23_ultra_256_self" | "galaxy_s25_ultra_256_self";

export const ANCHORS: AnchorKey[] = [
  "iphone_13_pro_128gb_self",
  "galaxy_s23_ultra_256_self",
  "galaxy_s25_ultra_256_self",
];

const miningDir = path.join(process.cwd(), "category-intelligence");

export async function readAnchorSummary(anchor: AnchorKey): Promise<ParseSummary> {
  const file = path.join(miningDir, anchor, "parse_summary.json");
  return JSON.parse(await readFile(file, "utf8")) as ParseSummary;
}

export async function readAllAnchorSummaries(): Promise<Record<AnchorKey, ParseSummary>> {
  const out = {} as Record<AnchorKey, ParseSummary>;
  for (const a of ANCHORS) {
    out[a] = await readAnchorSummary(a);
  }
  return out;
}

export function rejectCount(summary: ParseSummary, reason: string): number {
  const e = summary.reject_breakdown.find((r) => r.reason === reason);
  return e?.count ?? 0;
}

export function sumRejectsByPrefix(summary: ParseSummary, prefix: string): number {
  return summary.reject_breakdown
    .filter((r) => r.reason.startsWith(prefix))
    .reduce((acc, r) => acc + r.count, 0);
}

export function sumRejectsByLabels(summary: ParseSummary, labels: string[]): number {
  const set = new Set(labels.map((l) => `reject_${l}`));
  return summary.reject_breakdown
    .filter((r) => set.has(r.reason))
    .reduce((acc, r) => acc + r.count, 0);
}
