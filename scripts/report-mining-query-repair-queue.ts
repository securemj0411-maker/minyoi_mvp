import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type LaneRow = {
  lane: string;
  total: number;
  skuMatchPct: string;
  laneMatchPct: string;
  parseReadyPct: string;
  needsReviewFalsePct: string;
  comparableKeyCompletePct: string;
  unknownPartsPct: string;
  action: string;
  actionReason: string;
  aiL2Reason?: string | null;
  topUnknownParts?: { part: string; count: number }[];
};

type LaneSplit = {
  generatedAt?: string;
  rows?: LaneRow[];
};

type QueueRow = {
  lane: string;
  group: "exact_lane_backfill" | "ai_l2_eval_only" | "broad_scope_query_repair" | "structured_more_mining";
  priority: number;
  why: string;
  nextTask: string;
  forbidden: string;
  evidence: {
    total: number;
    skuMatchPct: string;
    laneMatchPct: string;
    completePct: string;
    needsReviewFalsePct: string;
    unknownPartsPct: string;
    aiL2Reason: string | null;
  };
};

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");
const OUT_JSON = path.join(REPORT_DIR, "mining-query-repair-queue-latest.json");
const OUT_MD = path.join(REPORT_DIR, "mining-query-repair-queue-latest.md");

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function classify(row: LaneRow): Omit<QueueRow, "lane" | "evidence"> {
  if (row.lane === "beats_solo_4") {
    return {
      group: "exact_lane_backfill",
      priority: 1,
      why: "Closed-set lane with 100% complete parse but sample count below 20.",
      nextTask: "Backfill from existing headphone non-AirPods reports or run no-write acquisition until 30-50 clean rows, then leak-watch counterfeit/case/pouch rows.",
      forbidden: "Do not patch parser/catalog for recall.",
    };
  }
  if (row.lane === "ipad_pro_13_m2_256_wifi") {
    return {
      group: "structured_more_mining",
      priority: 2,
      why: "Structured tablet lane has decent completion but weak lane match and too few exact rows.",
      nextTask: "Mine exact 12.9/13-inch + M2/6th gen + 256 + Wi-Fi rows. Keep cellular/LTE/5G rejected.",
      forbidden: "Do not infer Wi-Fi from silence.",
    };
  }
  if (row.lane === "iphone_12_pro_128gb_self" || row.lane === "iphone_13_pro_128gb_self") {
    return {
      group: "ai_l2_eval_only",
      priority: 3,
      why: "Self-unlocked/carrier state is not safely deterministic when title/body is silent.",
      nextTask: "Mine only explicit 자급제/공기계/정상해지 samples for evaluation. Non-explicit carrier-state recall belongs to AI L2.",
      forbidden: "Do not remove self-unlocked requirement or treat silence as 자급제.",
    };
  }
  if (row.lane === "lg_gram_17_2024") {
    return {
      group: "broad_scope_query_repair",
      priority: 1,
      why: "Current samples suggest query precision problem and wrong LG appliance/older Gram contamination.",
      nextTask: "Repair mining query with 17-inch + 2024/Ultra generation + laptop/노트북 context. Produce no-write sample report before parser changes.",
      forbidden: "Do not add generation/year fallback from weak title wording.",
    };
  }
  if (row.lane === "monitor_discovered") {
    return {
      group: "broad_scope_query_repair",
      priority: 2,
      why: "Broad monitor discovery has low SKU match and low complete key rate; exact model-code lanes are the viable path.",
      nextTask: "Split into selected exact model-code acquisition queues, not broad monitor parser patching.",
      forbidden: "Do not promote broad monitor_discovered runtime.",
    };
  }
  if (row.lane === "laptop") {
    return {
      group: "broad_scope_query_repair",
      priority: 2,
      why: "Broad laptop discovery mixes generations/options; exact model/chip/storage lanes should be mined instead.",
      nextTask: "Route to exact MacBook/Gram lane acquisition and AI L2 for unknown RAM/SSD/generation rows.",
      forbidden: "Do not broaden laptop parser to guess RAM/SSD/generation.",
    };
  }
  return {
    group: "broad_scope_query_repair",
    priority: 3,
    why: "Broad category has low SKU match; query/categorical scope is the problem.",
    nextTask: "Create narrower exact-lane acquisition candidates and keep ambiguous rows for AI L2 escrow.",
    forbidden: "Do not weaken catalog tokens for recall.",
  };
}

const laneSplit = readJson<LaneSplit>(path.join(REPORT_DIR, "lane-next-action-split-latest.json"), {});
const rows = (laneSplit.rows ?? [])
  .filter((row) => row.action === "mining_or_query_repair")
  .map<QueueRow>((row) => ({
    lane: row.lane,
    ...classify(row),
    evidence: {
      total: row.total,
      skuMatchPct: row.skuMatchPct,
      laneMatchPct: row.laneMatchPct,
      completePct: row.comparableKeyCompletePct,
      needsReviewFalsePct: row.needsReviewFalsePct,
      unknownPartsPct: row.unknownPartsPct,
      aiL2Reason: row.aiL2Reason ?? null,
    },
  }))
  .sort((a, b) => a.priority - b.priority || a.group.localeCompare(b.group) || a.lane.localeCompare(b.lane));

const generatedAt = new Date().toISOString();
const groupCounts = rows.reduce<Record<string, number>>((acc, row) => {
  acc[row.group] = (acc[row.group] ?? 0) + 1;
  return acc;
}, {});
const output = {
  generatedAt,
  reportOnly: true,
  runtimeMutation: false,
  sourceLaneSplit: laneSplit.generatedAt ?? null,
  groupCounts,
  rows,
  recommendedParallelAgents: [
    "Agent M1: exact_lane_backfill for beats_solo_4.",
    "Agent M2: structured_more_mining for ipad_pro_13_m2_256_wifi.",
    "Agent M3: broad_scope_query_repair for lg_gram_17_2024 + monitor/laptop/smartphone broad lanes.",
    "Agent M4: ai_l2_eval_only sample gathering for iphone_12/13_pro self-unlocked lanes.",
  ],
};

const md = [
  "# Mining / Query Repair Queue",
  "",
  `- generatedAt: ${generatedAt}`,
  "- mode: report_only_no_runtime_mutation",
  `- sourceLaneSplit: ${laneSplit.generatedAt ?? "-"}`,
  "",
  "## Group Counts",
  "",
  ...Object.entries(groupCounts).map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Queue",
  "",
  mdTable(
    ["lane", "group", "priority", "total", "sku", "lane", "complete", "next task", "forbidden"],
    rows.map((row) => [
      row.lane,
      row.group,
      String(row.priority),
      String(row.evidence.total),
      row.evidence.skuMatchPct,
      row.evidence.laneMatchPct,
      row.evidence.completePct,
      row.nextTask,
      row.forbidden,
    ]),
  ),
  "",
  "## Parallel Agent Brief",
  "",
  ...output.recommendedParallelAgents.map((item) => `- ${item}`),
  "",
].join("\n");

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(OUT_JSON, `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(OUT_MD, md);

console.log(`wrote ${OUT_MD}`);
console.log(`wrote ${OUT_JSON}`);
console.log(JSON.stringify(groupCounts));
