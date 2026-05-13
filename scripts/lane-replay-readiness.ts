import { mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";

const ROOT = process.cwd();
const LANE_DIR = path.join(ROOT, "category-intelligence");
const REPORT_DIR = path.join(ROOT, "reports");

type LaneStats = {
  lane: string;
  total: number;
  skuMatchPct: string;
  laneMatchPct: string;
  parseReadyPct: string;
  needsReviewFalsePct: string;
  unknownPartsPct: string;
  comparableKeyCompletePct: string;
  grade: "A" | "B" | "C" | "D";
  nextAction: string;
};

type ReplaySample = {
  name?: unknown;
  description?: unknown;
  parse_ready?: unknown;
};

function listLaneDirs(): string[] {
  return readdirSync(LANE_DIR).filter((name) => {
    const p = path.join(LANE_DIR, name, "samples.json");
    return existsSync(p);
  });
}

function pct(num: number, den: number): string {
  if (den === 0) return "0.0";
  return ((num / den) * 100).toFixed(1);
}

function gradeLane(input: {
  total: number;
  laneMatchPct: number;
  needsReviewFalsePct: number;
  comparableKeyCompletePct: number;
  unknownPartsPct: number;
}): LaneStats["grade"] {
  if (input.total < 20) return "D";
  if (input.comparableKeyCompletePct >= 90 && input.needsReviewFalsePct >= 90 && input.unknownPartsPct <= 2) return "A";
  if (input.comparableKeyCompletePct >= 70 && input.needsReviewFalsePct >= 70 && input.unknownPartsPct <= 10) return "B";
  if (input.comparableKeyCompletePct >= 40 || input.needsReviewFalsePct >= 40 || input.laneMatchPct >= 40) return "C";
  return "D";
}

function nextActionForGrade(grade: LaneStats["grade"], total: number) {
  if (total < 20) return "needs_more_mining";
  if (grade === "A") return "stop_deterministic_patching_watch_leaks";
  if (grade === "B") return "precision_stop_or_one_small_patch_then_stop";
  if (grade === "C") return "needs_ai_l2_or_one_measured_parser_patch";
  return "needs_ai_l2_or_query_mining_repair";
}

const results: LaneStats[] = [];

for (const lane of listLaneDirs()) {
  let samples: ReplaySample[];
  try {
    const raw = JSON.parse(readFileSync(path.join(LANE_DIR, lane, "samples.json"), "utf-8"));
    samples = Array.isArray(raw) ? raw : [];
  } catch {
    continue;
  }
  if (samples.length === 0) continue;
  // Filter to mining-validated samples only (lane_config acceptAll/reject passed).
  // Without this, D-grade lanes look fake-bad because samples include wrong-lane fetches.
  const filtered = samples.filter((s) => s.parse_ready === true);
  const effective = filtered.length > 0 ? filtered : samples;
  samples = effective;

  let skuMatched = 0;
  let laneMatched = 0;
  let parseReady = 0;
  let needsReviewFalse = 0;
  let comparableComplete = 0;
  let hasUnknown = 0;

  for (const sample of samples) {
    const title = String(sample.name ?? "");
    const desc = String(sample.description ?? "");
    const sku = ruleMatch(title, desc);
    if (sku) {
      skuMatched++;
      if (sku.laneKey === lane) laneMatched++;
    }
    const parsed = parseListingOptions({
      title,
      description: desc,
      skuId: sku?.id ?? null,
      skuName: sku?.modelName ?? null,
      category: sku?.category ?? null,
    });
    if (parsed.comparableKey) parseReady++;
    if (parsed.needsReview === false) needsReviewFalse++;
    const key = parsed.comparableKey ?? "";
    if (key && !key.includes("unknown_")) comparableComplete++;
    if (key.includes("unknown_")) hasUnknown++;
  }

  const numeric = {
    total: samples.length,
    skuMatchPct: Number(pct(skuMatched, samples.length)),
    laneMatchPct: Number(pct(laneMatched, samples.length)),
    parseReadyPct: Number(pct(parseReady, samples.length)),
    needsReviewFalsePct: Number(pct(needsReviewFalse, samples.length)),
    unknownPartsPct: Number(pct(hasUnknown, samples.length)),
    comparableKeyCompletePct: Number(pct(comparableComplete, samples.length)),
  };
  const grade = gradeLane(numeric);

  results.push({
    lane,
    total: numeric.total,
    skuMatchPct: numeric.skuMatchPct.toFixed(1),
    laneMatchPct: numeric.laneMatchPct.toFixed(1),
    parseReadyPct: numeric.parseReadyPct.toFixed(1),
    needsReviewFalsePct: numeric.needsReviewFalsePct.toFixed(1),
    unknownPartsPct: numeric.unknownPartsPct.toFixed(1),
    comparableKeyCompletePct: numeric.comparableKeyCompletePct.toFixed(1),
    grade,
    nextAction: nextActionForGrade(grade, samples.length),
  });
}

results.sort((a, b) => Number(b.laneMatchPct) - Number(a.laneMatchPct));

console.log("\nLANE REPLAY READINESS (against mining samples.json, ruleMatch + parseListingOptions)");
console.table(results);

// Summary
const totalSamples = results.reduce((s, r) => s + r.total, 0);
const avg = (key: keyof LaneStats) =>
  (results.reduce((s, r) => s + Number(r[key] as string), 0) / results.length).toFixed(1);

console.log(`\nLanes measured: ${results.length}, total samples: ${totalSamples}`);
console.log(`Avg laneMatch=${avg("laneMatchPct")}%, needsReviewFalse=${avg("needsReviewFalsePct")}%, comparableKeyComplete=${avg("comparableKeyCompletePct")}%`);

// Flag problem lanes
const problems = results.filter((r) => Number(r.laneMatchPct) < 50 || Number(r.needsReviewFalsePct) < 70);
if (problems.length > 0) {
  console.log("\n⚠ PROBLEM LANES (laneMatch<50% OR needsReviewFalse<70%):");
  console.table(problems);
}

const generatedAt = new Date().toISOString();
const gradeCounts = results.reduce<Record<string, number>>((acc, row) => {
  acc[row.grade] = (acc[row.grade] ?? 0) + 1;
  return acc;
}, {});
const actionCounts = results.reduce<Record<string, number>>((acc, row) => {
  acc[row.nextAction] = (acc[row.nextAction] ?? 0) + 1;
  return acc;
}, {});
const report = {
  generatedAt,
  totalLanes: results.length,
  totalSamples,
  averages: {
    laneMatchPct: Number(avg("laneMatchPct")),
    needsReviewFalsePct: Number(avg("needsReviewFalsePct")),
    comparableKeyCompletePct: Number(avg("comparableKeyCompletePct")),
  },
  gradeCounts,
  actionCounts,
  lanes: results,
};

const mdRows = results.map((row) => (
  `| ${row.lane} | ${row.grade} | ${row.total} | ${row.skuMatchPct}% | ${row.laneMatchPct}% | ${row.comparableKeyCompletePct}% | ${row.needsReviewFalsePct}% | ${row.unknownPartsPct}% | ${row.nextAction} |`
));
const md = [
  "# Lane Replay Readiness",
  "",
  `- generated_at: ${generatedAt}`,
  `- lanes: ${results.length}`,
  `- samples: ${totalSamples.toLocaleString("ko-KR")}`,
  `- avg_lane_match: ${avg("laneMatchPct")}%`,
  `- avg_comparable_complete: ${avg("comparableKeyCompletePct")}%`,
  `- avg_needs_review_false: ${avg("needsReviewFalsePct")}%`,
  "",
  "## Grade Counts",
  "",
  ...Object.entries(gradeCounts).sort().map(([grade, count]) => `- ${grade}: ${count}`),
  "",
  "## Action Counts",
  "",
  ...Object.entries(actionCounts).sort().map(([action, count]) => `- ${action}: ${count}`),
  "",
  "## Lanes",
  "",
  "| lane | grade | samples | sku | lane | complete | needsReviewFalse | unknown | next |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ...mdRows,
  "",
].join("\n");

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(path.join(REPORT_DIR, "lane-replay-readiness-latest.json"), JSON.stringify(report, null, 2));
writeFileSync(path.join(REPORT_DIR, "lane-replay-readiness-latest.md"), md);
console.log(`\nWrote reports/lane-replay-readiness-latest.json`);
console.log(`Wrote reports/lane-replay-readiness-latest.md`);
