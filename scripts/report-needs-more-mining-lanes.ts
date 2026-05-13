import fs from "node:fs";
import path from "node:path";

import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";

type LaneKey =
  | "beats_solo_4"
  | "ipad_pro_13_m2_256_wifi"
  | "iphone_12_pro_128gb_self"
  | "iphone_13_pro_128gb_self"
  | "lg_gram_17_2024";

type SampleRow = {
  pid?: string | number;
  name?: string;
  description?: string;
  price?: number;
  query?: string;
  parse_ready?: boolean;
  reject_reasons?: string[];
};

type ParseSummary = {
  lane_key: string;
  category: string;
  queries: string[];
  total_fetched: number;
  parse_ready_count: number;
  rejected_count: number;
  target_reached: boolean;
  reject_breakdown: Array<{ reason: string; count: number }>;
};

const appDir = process.cwd();
const outDir = path.join(appDir, "reports");
const lanes: LaneKey[] = [
  "beats_solo_4",
  "ipad_pro_13_m2_256_wifi",
  "iphone_12_pro_128gb_self",
  "iphone_13_pro_128gb_self",
  "lg_gram_17_2024",
];

const laneGuidance: Record<LaneKey, {
  class: "closed_set_shallow" | "structured_more_mining" | "ai_l2_primary" | "query_precision_problem";
  action: string;
  queryPlan: string[];
  deterministicBoundary: string;
}> = {
  beats_solo_4: {
    class: "closed_set_shallow",
    action: "Do not patch parser now. Backfill from existing non-AirPods live/search reports or run a tiny no-write acquisition to 30-50 clean rows, then leak-watch case/pouch/counterfeit rows.",
    queryPlan: [
      "beats solo 4 헤드폰",
      "비츠 솔로4 헤드폰",
      "비츠 솔로 4 제니",
      "beats solo4 wireless",
    ],
    deterministicBoundary: "Closed-set model identity is already clean. Only add negative guards if leak evidence appears.",
  },
  ipad_pro_13_m2_256_wifi: {
    class: "structured_more_mining",
    action: "Mine more exact 12.9/13-inch M2 256 Wi-Fi rows. Keep cellular/LTE/5G rejected; do not infer Wi-Fi from silence.",
    queryPlan: [
      "아이패드 프로 12.9 6세대 256 wifi",
      "아이패드 프로 12.9 m2 256 와이파이",
      "ipad pro 12.9 m2 256 wifi",
      "아이패드 프로 6세대 256 와이파이",
      "아이패드 프로 13 m2 256 wifi",
    ],
    deterministicBoundary: "M2/6th-gen + 12.9/13 + 256 + Wi-Fi must stay title/body-visible. Bundle or cellular ambiguity goes to AI/review.",
  },
  iphone_12_pro_128gb_self: {
    class: "ai_l2_primary",
    action: "Keep deterministic lane only for explicit 자급제/공기계/정상해지 wording. Non-explicit self-unlocked recall belongs to AI L2.",
    queryPlan: [
      "아이폰12프로 128 자급제",
      "아이폰 12프로 128 공기계",
      "아이폰 12 프로 128 정상해지",
      "iphone 12 pro 128 unlocked",
    ],
    deterministicBoundary: "Do not remove self/unlocked requirement. 통신사/약정/확정기변/완납폰 ambiguity stays blocked or AI L2.",
  },
  iphone_13_pro_128gb_self: {
    class: "ai_l2_primary",
    action: "Same as iPhone 12 Pro: explicit self-unlocked rows only. More mining can improve evaluation set, not deterministic recall ceiling.",
    queryPlan: [
      "아이폰13프로 128 자급제",
      "아이폰 13프로 128 공기계",
      "아이폰 13 프로 128 정상해지",
      "iphone 13 pro 128 unlocked",
    ],
    deterministicBoundary: "Do not classify silent carrier state as self-unlocked. AI L2 handles likely-but-not-explicit cases.",
  },
  lg_gram_17_2024: {
    class: "query_precision_problem",
    action: "Fix mining query precision before any parser patch. Current query pulls LG home appliances and older/wrong-size Gram rows.",
    queryPlan: [
      "lg 그램 17 노트북 2024",
      "엘지 그램 17인치 노트북 2024",
      "lg gram 17 laptop 2024",
      "그램 17 2024 노트북 16gb 512",
      "LG그램 17 2024 울트라",
    ],
    deterministicBoundary: "17-inch + 2024/Ultra generation + laptop context must be explicit. RAM/storage/year guesses stay AI L2/review.",
  },
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function pct(num: number, den: number) {
  if (den <= 0) return 0;
  return Number(((num / den) * 100).toFixed(1));
}

function topReasons(samples: SampleRow[]) {
  const counts = new Map<string, number>();
  for (const sample of samples) {
    for (const reason of sample.reject_reasons ?? []) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([reason, count]) => ({ reason, count }));
}

function replay(samples: SampleRow[], lane: LaneKey) {
  const parseReadySamples = samples.filter((sample) => sample.parse_ready === true);
  const effective = parseReadySamples.length > 0 ? parseReadySamples : samples;
  let skuMatched = 0;
  let laneMatched = 0;
  let comparableComplete = 0;
  let needsReviewFalse = 0;
  let unknown = 0;
  const misses: Array<{ pid: string; title: string; reason: string }> = [];

  for (const sample of effective) {
    const title = String(sample.name ?? "");
    const description = String(sample.description ?? "");
    const sku = ruleMatch(title, description);
    if (sku) skuMatched += 1;
    if (sku?.laneKey === lane) laneMatched += 1;
    const parsed = parseListingOptions({
      title,
      description,
      skuId: sku?.id ?? null,
      skuName: sku?.modelName ?? null,
      category: sku?.category ?? null,
    });
    const comparableKey = parsed.comparableKey ?? "";
    if (comparableKey && !comparableKey.includes("unknown_")) comparableComplete += 1;
    if (parsed.needsReview === false) needsReviewFalse += 1;
    if (comparableKey.includes("unknown_")) unknown += 1;
    if (!sku || sku.laneKey !== lane || !comparableKey || parsed.needsReview) {
      misses.push({
        pid: String(sample.pid ?? ""),
        title: title.slice(0, 90),
        reason: !sku ? "no_sku" : sku.laneKey !== lane ? `matched_${sku.laneKey ?? sku.id}` : !comparableKey ? "no_comparable_key" : "needs_review",
      });
    }
  }

  return {
    effectiveCount: effective.length,
    skuMatchPct: pct(skuMatched, effective.length),
    laneMatchPct: pct(laneMatched, effective.length),
    comparableKeyCompletePct: pct(comparableComplete, effective.length),
    needsReviewFalsePct: pct(needsReviewFalse, effective.length),
    unknownPartsPct: pct(unknown, effective.length),
    missSamples: misses.slice(0, 5),
  };
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const rows = lanes.map((lane) => {
    const dir = path.join(appDir, "category-intelligence", lane);
    const summary = readJson<ParseSummary>(path.join(dir, "parse_summary.json"));
    const samples = readJson<SampleRow[]>(path.join(dir, "samples.json"));
    const guidance = laneGuidance[lane];
    const replayStats = replay(samples, lane);
    return {
      lane,
      category: summary.category,
      class: guidance.class,
      totalFetched: summary.total_fetched,
      parseReadyCount: summary.parse_ready_count,
      parseReadyPct: pct(summary.parse_ready_count, summary.total_fetched),
      targetReached: summary.target_reached,
      rejectedCount: summary.rejected_count,
      replay: replayStats,
      topRejectReasons: summary.reject_breakdown.slice(0, 8),
      topSampleRejectReasons: topReasons(samples),
      currentQueries: summary.queries,
      queryPlan: guidance.queryPlan,
      action: guidance.action,
      deterministicBoundary: guidance.deterministicBoundary,
    };
  });

  const report = {
    generatedAt,
    mode: "read_only_no_runtime_patch",
    rows,
  };
  const jsonPath = path.join(outDir, "needs-more-mining-lanes-latest.json");
  const mdPath = path.join(outDir, "needs-more-mining-lanes-latest.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    "# Needs More Mining Lane Diagnosis",
    "",
    `Generated: ${generatedAt}`,
    "",
    "This is read-only. It does not change runtime parser, catalog, candidate pool, Supabase schema, or public promotion.",
    "",
    "## Summary",
    "",
    mdTable(
      ["Lane", "Class", "Fetched", "Parse-ready", "Replay complete", "Replay needsReview=false", "Decision"],
      rows.map((row) => [
        row.lane,
        row.class,
        row.totalFetched,
        `${row.parseReadyCount} (${row.parseReadyPct}%)`,
        `${row.replay.comparableKeyCompletePct}%`,
        `${row.replay.needsReviewFalsePct}%`,
        row.action,
      ]),
    ),
    "",
    "## Lane Details",
    "",
    ...rows.flatMap((row) => [
      `### ${row.lane}`,
      "",
      `- Class: ${row.class}`,
      `- Deterministic boundary: ${row.deterministicBoundary}`,
      `- Action: ${row.action}`,
      "",
      "Top reject reasons:",
      "",
      mdTable(["Reason", "Count"], row.topRejectReasons.map((reason) => [reason.reason, reason.count])),
      "",
      "Proposed query plan:",
      "",
      ...row.queryPlan.map((query) => `- ${query}`),
      "",
      "Replay miss examples:",
      "",
      mdTable(["pid", "reason", "title"], row.replay.missSamples.map((miss) => [miss.pid, miss.reason, miss.title])),
      "",
    ]),
  ].join("\n");
  fs.writeFileSync(mdPath, md);
  console.log(`wrote ${mdPath}`);
  console.log(`wrote ${jsonPath}`);
  console.table(rows.map((row) => ({
    lane: row.lane,
    class: row.class,
    totalFetched: row.totalFetched,
    parseReady: row.parseReadyCount,
    replayCompletePct: row.replay.comparableKeyCompletePct,
    decision: row.action.slice(0, 64),
  })));
}

main();
