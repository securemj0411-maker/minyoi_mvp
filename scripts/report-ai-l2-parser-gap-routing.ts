import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ruleMatch, type Sku } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";

type Sample = {
  name?: unknown;
  description?: unknown;
  parse_ready?: unknown;
};

type LaneReport = {
  lane: string;
  total: number;
  category: string;
  skuMatchPct: number;
  laneMatchPct: number;
  needsReviewFalsePct: number;
  comparableCompletePct: number;
  unknownPartsPct: number;
  topUnknownParts: { part: string; count: number }[];
  decision:
    | "deterministic_ready_stop"
    | "deterministic_precision_stop"
    | "needs_ai_l2"
    | "needs_more_mining"
    | "manual_or_owner_review";
  aiL2Reason: string | null;
  notes: string[];
};

const ROOT = process.cwd();
const INTEL_DIR = path.join(ROOT, "category-intelligence");
const REPORT_DIR = path.join(ROOT, "reports");
const OUT_JSON = path.join(REPORT_DIR, "ai-l2-parser-gap-routing-latest.json");
const OUT_MD = path.join(REPORT_DIR, "ai-l2-parser-gap-routing-latest.md");

function readSamples(lane: string): Sample[] {
  const file = path.join(INTEL_DIR, lane, "samples.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
  return Array.isArray(raw) ? raw as Sample[] : [];
}

function laneDirs(): string[] {
  if (!existsSync(INTEL_DIR)) return [];
  return readdirSync(INTEL_DIR)
    .filter((name) => existsSync(path.join(INTEL_DIR, name, "samples.json")))
    .sort();
}

function pct(count: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((count / total) * 100).toFixed(1));
}

function bucketUnknown(part: string, counts: Map<string, number>) {
  counts.set(part, (counts.get(part) ?? 0) + 1);
}

function primaryCategory(categories: Map<string, number>, lane: string): string {
  const [top] = [...categories.entries()].sort((a, b) => b[1] - a[1]);
  if (top) return top[0];
  if (/iphone|galaxy_s|galaxy_z|pixel/.test(lane)) return "smartphone";
  if (/ipad|tab_|galaxy_tab/.test(lane)) return "tablet";
  if (/macbook|gram|thinkpad|laptop|notebook/.test(lane)) return "laptop";
  if (/airpods|buds|bose|sony|beats|headphone|qc/.test(lane)) return "headphone";
  if (/watch/.test(lane)) return "smartwatch";
  if (/speaker|jbl|flip/.test(lane)) return "speaker";
  if (/desktop|rtx|gpu|cpu/.test(lane)) return "desktop_custom_build";
  if (/vacuum|roborock|dyson|appliance/.test(lane)) return "home_appliance";
  return "unknown";
}

function aiReasonFor(input: {
  lane: string;
  category: string;
  comparableCompletePct: number;
  laneMatchPct: number;
  topUnknownParts: { part: string; count: number }[];
}): string | null {
  const unknownParts = input.topUnknownParts.map((p) => p.part).join(" ");
  if (input.category === "smartphone" && /_self|자급|unlocked/.test(input.lane)) {
    return "self_unlocked_ambiguity";
  }
  if (input.category === "tablet" && /unknown_connectivity|unknown_storage|unknown_screen/.test(unknownParts)) {
    return "connectivity_ambiguity";
  }
  if (input.category === "laptop" && /unknown_generation|unknown_chip|unknown_ram|unknown_ssd|unknown_screen/.test(unknownParts)) {
    return "parser_unknown_option";
  }
  if (input.category === "smartwatch" && /unknown_generation|unknown_size|unknown_connectivity/.test(unknownParts)) {
    return "generation_ambiguity";
  }
  if (/(headphone|speaker|home_appliance|camera|desktop)/.test(input.category) && input.laneMatchPct < 80) {
    return "bundle_or_accessory_ambiguity";
  }
  if (input.comparableCompletePct < 70) return "parser_unknown_option";
  return null;
}

function decideLane(input: {
  total: number;
  category: string;
  skuMatchPct: number;
  laneMatchPct: number;
  comparableCompletePct: number;
  needsReviewFalsePct: number;
  unknownPartsPct: number;
  aiL2Reason: string | null;
}): LaneReport["decision"] {
  if (input.total < 20) return "needs_more_mining";
  if (input.comparableCompletePct >= 90 && input.needsReviewFalsePct >= 90 && input.unknownPartsPct <= 2) {
    return "deterministic_ready_stop";
  }
  if (input.aiL2Reason) return "needs_ai_l2";
  if (input.comparableCompletePct >= 75 && input.needsReviewFalsePct >= 75 && input.unknownPartsPct <= 5) {
    return "deterministic_precision_stop";
  }
  return "manual_or_owner_review";
}

function analyzeLane(lane: string): LaneReport | null {
  const rawSamples = readSamples(lane);
  const readySamples = rawSamples.filter((sample) => sample.parse_ready === true);
  const samples = readySamples.length > 0 ? readySamples : rawSamples;
  if (samples.length === 0) return null;

  let skuMatch = 0;
  let laneMatch = 0;
  let needsReviewFalse = 0;
  let comparableComplete = 0;
  let unknownPartsRows = 0;
  const unknownCounts = new Map<string, number>();
  const categories = new Map<string, number>();

  for (const sample of samples) {
    const title = String(sample.name ?? "");
    const description = String(sample.description ?? "");
    const sku = ruleMatch(title, description);
    if (sku) {
      skuMatch++;
      categories.set(sku.category, (categories.get(sku.category) ?? 0) + 1);
      if (sku.laneKey === lane) laneMatch++;
    }

    const parsed = parseListingOptions({
      title,
      description,
      skuId: sku?.id ?? null,
      skuName: sku?.modelName ?? null,
      category: (sku?.category ?? null) as Sku["category"] | null,
    });
    if (parsed.needsReview === false) needsReviewFalse++;
    const comparableKey = parsed.comparableKey ?? "";
    const parts = comparableKey.split("|").filter((part) => part.startsWith("unknown_"));
    if (comparableKey && parts.length === 0) comparableComplete++;
    if (parts.length > 0) {
      unknownPartsRows++;
      for (const part of parts) bucketUnknown(part, unknownCounts);
    }
  }

  const category = primaryCategory(categories, lane);
  const topUnknownParts = [...unknownCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([part, count]) => ({ part, count }));
  const metrics = {
    total: samples.length,
    category,
    skuMatchPct: pct(skuMatch, samples.length),
    laneMatchPct: pct(laneMatch, samples.length),
    needsReviewFalsePct: pct(needsReviewFalse, samples.length),
    comparableCompletePct: pct(comparableComplete, samples.length),
    unknownPartsPct: pct(unknownPartsRows, samples.length),
    topUnknownParts,
  };
  const aiL2Reason = aiReasonFor({ lane, ...metrics });
  const decision = decideLane({ ...metrics, aiL2Reason });
  const notes: string[] = [];
  if (readySamples.length > 0) notes.push(`mining_parse_ready_subset=${readySamples.length}/${rawSamples.length}`);
  if (decision === "deterministic_ready_stop") notes.push("stop_deterministic_patching");
  if (decision === "needs_ai_l2") notes.push("do_not_weaken_catalog_tokens_for_recall");
  if (metrics.unknownPartsPct > 0) notes.push(`unknown_parts=${topUnknownParts.map((p) => `${p.part}:${p.count}`).join(",")}`);

  return {
    lane,
    ...metrics,
    decision,
    aiL2Reason,
    notes,
  };
}

function mdTable(rows: LaneReport[]): string {
  const lines = [
    "| lane | decision | aiL2Reason | category | total | laneMatch | complete | needsReviewFalse | unknown |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const row of rows) {
    lines.push([
      row.lane,
      row.decision,
      row.aiL2Reason ?? "-",
      row.category,
      String(row.total),
      `${row.laneMatchPct}%`,
      `${row.comparableCompletePct}%`,
      `${row.needsReviewFalsePct}%`,
      `${row.unknownPartsPct}%`,
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  return lines.join("\n");
}

const lanes = laneDirs().map(analyzeLane).filter((row): row is LaneReport => Boolean(row));
lanes.sort((a, b) => {
  const order = ["needs_ai_l2", "manual_or_owner_review", "deterministic_precision_stop", "needs_more_mining", "deterministic_ready_stop"];
  return order.indexOf(a.decision) - order.indexOf(b.decision) || a.lane.localeCompare(b.lane);
});

const summary = lanes.reduce<Record<string, number>>((acc, lane) => {
  acc[lane.decision] = (acc[lane.decision] ?? 0) + 1;
  return acc;
}, {});

const generatedAt = new Date().toISOString();
const output = {
  generatedAt,
  reportOnly: true,
  runtimeMutation: false,
  summary,
  lanes,
};

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(OUT_JSON, `${JSON.stringify(output, null, 2)}\n`);

const markdown = [
  "# AI L2 Parser Gap Routing",
  "",
  `- generatedAt: ${generatedAt}`,
  "- mode: report_only_no_runtime_mutation",
  "- purpose: lane replay 결과를 결정론 stop / AI L2 / owner-review로 자동 분류",
  "",
  "## Summary",
  "",
  ...Object.entries(summary).map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Lanes",
  "",
  mdTable(lanes),
  "",
  "## Policy Notes",
  "",
  "- `deterministic_ready_stop`: 추가 결정론 patch 금지. leak 감시만.",
  "- `needs_ai_l2`: recall을 올리기 위해 catalog token을 약화하지 말고 AI L2 또는 사람 검수로 넘긴다.",
  "- `manual_or_owner_review`: AI가 모델 identity를 rescue하면 안 되는 정책/owner 결정 영역이다.",
].join("\n");

writeFileSync(OUT_MD, `${markdown}\n`);

console.log(`wrote ${OUT_MD}`);
console.log(`wrote ${OUT_JSON}`);
console.table(Object.entries(summary).map(([decision, count]) => ({ decision, count })));
