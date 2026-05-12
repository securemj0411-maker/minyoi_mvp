import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";

const ROOT = process.cwd();
const LANE_DIR = path.join(ROOT, "category-intelligence");

type LaneStats = {
  lane: string;
  total: number;
  skuMatchPct: string;
  laneMatchPct: string;
  parseReadyPct: string;
  needsReviewFalsePct: string;
  unknownPartsPct: string;
  comparableKeyCompletePct: string;
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

const results: LaneStats[] = [];

for (const lane of listLaneDirs()) {
  let samples: any[];
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

  results.push({
    lane,
    total: samples.length,
    skuMatchPct: pct(skuMatched, samples.length),
    laneMatchPct: pct(laneMatched, samples.length),
    parseReadyPct: pct(parseReady, samples.length),
    needsReviewFalsePct: pct(needsReviewFalse, samples.length),
    unknownPartsPct: pct(hasUnknown, samples.length),
    comparableKeyCompletePct: pct(comparableComplete, samples.length),
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
