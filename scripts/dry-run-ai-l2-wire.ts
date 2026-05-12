// Dry-run for AI L2 wire-up: compares legacy shouldAiReview vs policy v1 on 100 sampled
// candidates. Pure decision-diff (no AI calls). Cost = estimated $/call × policy-review count.
//
// Usage:
//   npx tsx scripts/dry-run-ai-l2-wire.ts
//
// Reads:  reports/ai-l2-candidates-cache.json (4 broad lanes × ~150 candidates each)
// Writes: reports/ai-l2-wire-dry-run-<date>.json
// Prints: human-readable table to stdout.
//
// Cost basis: gpt-4o-mini avg $0.000177/call measured in reports/ai-l2-experiment-2026-05-12.json.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { decideAiL2Review } from "../src/lib/ai-l2-policy.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const cachePath = path.join(appDir, "reports", "ai-l2-candidates-cache.json");

const COST_PER_CALL_USD = 0.000177;
const SAMPLE_SIZE = 100;

const LANE_MEDIANS: Record<string, number> = {
  smartphone_broad: 120000,
  laptop_broad: 400000,
  headphone_broad: 185000,
  desktop_custom_build: 1790000,
};
const LANE_CATEGORY: Record<string, string> = {
  smartphone_broad: "smartphone",
  laptop_broad: "laptop",
  headphone_broad: "headphone",
  desktop_custom_build: "desktop_custom_build",
};

type RawItem = {
  pid: string;
  name: string;
  price: number;
  numFaved?: number;
  freeShipping?: boolean;
  description?: string;
  query?: string;
  lane?: string;
};

const NORMAL_SIGNALS = ["미개봉", "새상품", "풀박스", "풀구성", "풀세트", "정상작동", "정상 작동", "기능 정상", "문제없", "정품", "시리얼", "구매내역", "구매 영수증", "상자", "박스", "구성품", "양쪽", "노이즈 캔슬링", "노캔", "상태양호", "상태 양호"];
const COMMERCIAL_WEAK_KEYWORDS = ["통신사 특가", "신규개통", "번호이동", "개통 조건", "2년 약정", "자급제 신규", "선착순"];
const SHORT_TITLE_MIN = 9;

function nrm(s: string) { return String(s ?? "").toLowerCase().replace(/[ \s]+/g, " ").trim(); }
function containsAny(text: string, kws: string[]) { const n = nrm(text); return kws.filter((k) => n.includes(nrm(k))); }
function compactLen(text: string) { return String(text ?? "").replace(/\s+/g, "").length; }
function hasNormalSignal(title: string, desc: string) { return containsAny(`${title}\n${desc}`, NORMAL_SIGNALS).length > 0; }
function suspiciousModelText(title: string, desc: string) {
  const text = nrm(`${title}\n${desc}`).replace(/\s+/g, "");
  return /에어팟프로[34]|airpodspro[34]/i.test(text);
}
function multiModelHits(title: string): string[] {
  const normalized = nrm(title);
  const raw = String(title ?? "").toLowerCase();
  const hasChoiceSeparator = /[/|,·+]|또는|선택|중에|중 택|중택|가격\s*상이|가격상이/.test(raw);
  if (!hasChoiceSeparator) return [];
  const compact = normalized.replace(/\s+/g, "");
  const hits: string[] = [];
  const add = (h: string) => { if (!hits.includes(h)) hits.push(h); };
  if (compact.includes("에어팟맥스") || normalized.includes("airpods max")) add("airpods_max");
  if (compact.includes("에어팟프로") || normalized.includes("airpods pro")) add("airpods_pro");
  const iphoneHits: string[] = [];
  for (const n of ["12", "13", "14", "15", "16", "17"]) {
    if (new RegExp(`아이폰\\s*${n}|iphone\\s*${n}`).test(normalized)) iphoneHits.push(`iphone_${n}`);
  }
  if (iphoneHits.length >= 2) iphoneHits.forEach(add);
  return hits.length >= 2 ? hits : [];
}

function computeFlags(item: RawItem, laneMedian: number): { priceGap: number; flags: string[] } {
  const { name: title, description: desc = "", price } = item;
  const text = `${title}\n${desc}`;
  const priceGap = laneMedian > 0 ? Math.max(0, Math.min(1, (laneMedian - price) / laneMedian)) : 0;
  const flags: string[] = [];
  if (priceGap >= 0.75) flags.push("extreme_discount_review");
  if (priceGap >= 0.55) flags.push("deep_discount_review");
  if (suspiciousModelText(title, desc)) flags.push("suspicious_model_review");
  if (multiModelHits(title).length > 0) flags.push("multi_model_review");
  if (compactLen(title) < SHORT_TITLE_MIN && !hasNormalSignal(title, desc)) flags.push("short_title");
  if (!hasNormalSignal(title, desc)) flags.push("weak_normal_signal");
  if (containsAny(text, COMMERCIAL_WEAK_KEYWORDS).length > 0) flags.push("commercial_review");
  return { priceGap, flags };
}

// Mirror of pipeline.ts shouldAiReview (legacy / env-off branch).
function legacyShouldReview(priceGap: number, flags: string[], suspicious: boolean): boolean {
  return flags.length > 0 || priceGap >= 0.55 || suspicious;
}

// ──────────────────────────────────────────────────────────────────────────────

const raw = JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, RawItem[]>;
const lanes = Object.keys(raw);

// Round-robin sample so all 4 lanes are represented evenly.
const perLane = Math.ceil(SAMPLE_SIZE / lanes.length);
const seed = 42;
function lcg(seed: number) { let s = seed; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000; }
const rng = lcg(seed);

const sample: Array<{ lane: string; item: RawItem }> = [];
for (const lane of lanes) {
  const pool = (raw[lane] ?? []).slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  for (const item of pool.slice(0, perLane)) sample.push({ lane, item });
}
sample.splice(SAMPLE_SIZE);

// ──────────────────────────────────────────────────────────────────────────────

type Row = {
  pid: string; lane: string; category: string; priceGap: number; flags: string[];
  suspicious: boolean; legacy: boolean; policy: boolean; reason: string; priority: string;
};

const rows: Row[] = sample.map(({ lane, item }) => {
  const laneMedian = LANE_MEDIANS[lane] ?? 0;
  const { priceGap, flags } = computeFlags(item, laneMedian);
  const suspicious = suspiciousModelText(item.name, (item.description ?? "").slice(0, 200));
  const legacy = legacyShouldReview(priceGap, flags, suspicious);
  const decision = decideAiL2Review({
    priceGap,
    scoreFlags: flags,
    category: LANE_CATEGORY[lane] ?? null,
  });
  return {
    pid: item.pid, lane, category: LANE_CATEGORY[lane] ?? "",
    priceGap: Number(priceGap.toFixed(3)),
    flags, suspicious,
    legacy, policy: decision.review,
    reason: decision.reason, priority: decision.priority,
  };
});

// ──────────────────────────────────────────────────────────────────────────────

const sums = {
  legacy_review: rows.filter((r) => r.legacy).length,
  policy_review: rows.filter((r) => r.policy).length,
  legacy_skip: rows.filter((r) => !r.legacy).length,
  policy_skip: rows.filter((r) => !r.policy).length,
  both_review: rows.filter((r) => r.legacy && r.policy).length,
  both_skip: rows.filter((r) => !r.legacy && !r.policy).length,
  off_to_on_review: rows.filter((r) => !r.legacy && r.policy).length,   // policy adds review
  on_to_off_review: rows.filter((r) => r.legacy && !r.policy).length,   // policy drops review
};

const perLaneAgg = lanes.map((lane) => {
  const lr = rows.filter((r) => r.lane === lane);
  return {
    lane, n: lr.length,
    legacy_review: lr.filter((r) => r.legacy).length,
    policy_review: lr.filter((r) => r.policy).length,
    delta: lr.filter((r) => r.policy).length - lr.filter((r) => r.legacy).length,
  };
});

const priorityCounts = { high: 0, normal: 0, skip: 0 } as Record<string, number>;
const reasonCounts: Record<string, number> = {};
for (const r of rows) {
  priorityCounts[r.priority] = (priorityCounts[r.priority] ?? 0) + 1;
  reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1;
}

const flagFiring: Record<string, number> = {};
for (const r of rows) for (const f of r.flags) flagFiring[f] = (flagFiring[f] ?? 0) + 1;

const cost = {
  per_call_usd: COST_PER_CALL_USD,
  basis: "reports/ai-l2-experiment-2026-05-12.json (gpt-4o-mini avg)",
  legacy_cost_usd: Number((sums.legacy_review * COST_PER_CALL_USD).toFixed(5)),
  policy_cost_usd: Number((sums.policy_review * COST_PER_CALL_USD).toFixed(5)),
  delta_cost_usd: Number(((sums.policy_review - sums.legacy_review) * COST_PER_CALL_USD).toFixed(5)),
};

const out = {
  generated_at: new Date().toISOString(),
  sample_size: rows.length,
  seed,
  cost,
  totals: sums,
  per_lane: perLaneAgg,
  policy_priority_counts: priorityCounts,
  policy_reason_counts: reasonCounts,
  flag_firing: flagFiring,
  diff_rows: rows.filter((r) => r.legacy !== r.policy).map((r) => ({
    pid: r.pid, lane: r.lane, priceGap: r.priceGap, flags: r.flags,
    legacy: r.legacy, policy: r.policy, reason: r.reason, priority: r.priority,
  })),
};

const outPath = path.join(appDir, "reports", `ai-l2-wire-dry-run-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(outPath, JSON.stringify(out, null, 2));

// ──────────────────────────────────────────────────────────────────────────────
// Pretty-print

console.log(`\n=== AI L2 wire-up dry-run (n=${rows.length}, seed=${seed}) ===\n`);
console.log("Decision diff (legacy vs policy v1):");
console.log(`  legacy review: ${sums.legacy_review}/${rows.length}   policy review: ${sums.policy_review}/${rows.length}`);
console.log(`  both review:   ${sums.both_review}`);
console.log(`  both skip:     ${sums.both_skip}`);
console.log(`  off→on review (policy adds): ${sums.off_to_on_review}`);
console.log(`  on→off review (policy drops): ${sums.on_to_off_review}`);

console.log("\nPer-lane:");
console.log("  lane                       n   legacy_review  policy_review  delta");
for (const x of perLaneAgg) {
  console.log(`  ${x.lane.padEnd(25)} ${String(x.n).padStart(3)}  ${String(x.legacy_review).padStart(13)}  ${String(x.policy_review).padStart(13)}  ${(x.delta >= 0 ? "+" : "") + x.delta}`);
}

console.log("\nPolicy priority distribution:");
for (const [p, c] of Object.entries(priorityCounts)) console.log(`  ${p.padEnd(10)} ${c}`);

console.log("\nPolicy reason distribution:");
for (const [r, c] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) console.log(`  ${r.padEnd(35)} ${c}`);

console.log("\nFlag firing (rules):");
for (const [f, c] of Object.entries(flagFiring).sort((a, b) => b[1] - a[1])) console.log(`  ${f.padEnd(30)} ${c}`);

console.log(`\nCost (estimated):`);
console.log(`  per-call basis: $${cost.per_call_usd} (${cost.basis})`);
console.log(`  legacy:  $${cost.legacy_cost_usd}  policy: $${cost.policy_cost_usd}  delta: $${cost.delta_cost_usd}`);

console.log(`\nDetailed JSON: ${outPath}`);
