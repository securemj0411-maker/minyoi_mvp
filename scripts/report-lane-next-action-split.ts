import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type LaneReplayRow = {
  lane: string;
  total: number;
  skuMatchPct: string;
  laneMatchPct: string;
  needsReviewFalsePct: string;
  unknownPartsPct: string;
  comparableKeyCompletePct: string;
  grade: "A" | "B" | "C" | "D";
  nextAction: string;
};

type AiRoutingRow = {
  lane: string;
  decision: string;
  aiL2Reason?: string | null;
  topUnknownParts?: Array<{ part: string; count: number }>;
  notes?: string[];
};

type ActionBucket =
  | "stop_deterministic"
  | "one_measured_patch"
  | "ai_l2_primary"
  | "mining_or_query_repair"
  | "owner_or_manual_review";

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(REPORT_DIR, fileName), "utf-8")) as T;
}

function pct(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionFor(row: LaneReplayRow, route?: AiRoutingRow): { action: ActionBucket; reason: string } {
  const aiReason = route?.aiL2Reason ?? "";
  const complete = pct(row.comparableKeyCompletePct);
  const needsReviewFalse = pct(row.needsReviewFalsePct);
  const unknown = pct(row.unknownPartsPct);
  const sku = pct(row.skuMatchPct);

  if (route?.decision === "manual_or_owner_review") {
    return { action: "owner_or_manual_review", reason: "routing_report_marks_owner_or_manual_review" };
  }

  if (row.grade === "A") {
    return { action: "stop_deterministic", reason: "grade_A_high_complete_low_unknown" };
  }

  if (row.grade === "B" && complete >= 75 && needsReviewFalse >= 75 && unknown <= 5) {
    return { action: "stop_deterministic", reason: "grade_B_precision_stop_threshold_met" };
  }

  if (row.total < 20) {
    return { action: "mining_or_query_repair", reason: "sample_count_below_20" };
  }

  if (
    aiReason === "self_unlocked_ambiguity" ||
    aiReason === "generation_ambiguity" ||
    aiReason === "connectivity_ambiguity" ||
    aiReason === "bundle_or_accessory_ambiguity"
  ) {
    return { action: "ai_l2_primary", reason: aiReason };
  }

  if (sku < 20 && complete < 20) {
    return { action: "mining_or_query_repair", reason: "low_sku_and_low_complete_suggests_query_or_catalog_scope_problem" };
  }

  if (complete >= 70 && needsReviewFalse >= 70 && unknown <= 10) {
    return { action: "stop_deterministic", reason: "precision_stop_without_more_recall_patching" };
  }

  if (route?.decision === "needs_ai_l2") {
    if (aiReason === "parser_unknown_option" && unknown >= 20) {
      return { action: "ai_l2_primary", reason: "parser_unknown_option_high_unknown_parts" };
    }
    if (aiReason === "parser_unknown_option" && (complete < 70 || needsReviewFalse < 70)) {
      return { action: "ai_l2_primary", reason: "parser_unknown_option_below_precision_stop" };
    }
    return { action: "ai_l2_primary", reason: aiReason || "routing_report_needs_ai_l2" };
  }

  if (row.nextAction.includes("mining")) {
    return { action: "mining_or_query_repair", reason: row.nextAction };
  }

  return { action: "one_measured_patch", reason: "default_single_patch_candidate" };
}

function table(headers: string[], rows: Array<Array<string | number>>) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

const replay = readJson<{ generatedAt: string; lanes: LaneReplayRow[] }>("lane-replay-readiness-latest.json");
const routing = readJson<{ generatedAt: string; lanes: AiRoutingRow[] }>("ai-l2-parser-gap-routing-latest.json");
const routeByLane = new Map(routing.lanes.map((row) => [row.lane, row]));

const rows = replay.lanes.map((row) => {
  const route = routeByLane.get(row.lane);
  const split = actionFor(row, route);
  return {
    ...row,
    routingDecision: route?.decision ?? "missing",
    aiL2Reason: route?.aiL2Reason ?? null,
    topUnknownParts: route?.topUnknownParts ?? [],
    action: split.action,
    actionReason: split.reason,
  };
});

const actionCounts = rows.reduce<Record<string, number>>((acc, row) => {
  acc[row.action] = (acc[row.action] ?? 0) + 1;
  return acc;
}, {});

const generatedAt = new Date().toISOString();
const report = {
  generatedAt,
  sourceReports: {
    laneReplay: replay.generatedAt,
    aiL2Routing: routing.generatedAt,
  },
  actionCounts,
  rows,
};

const ordered = [...rows].sort((a, b) => {
  const order: Record<ActionBucket, number> = {
    one_measured_patch: 0,
    ai_l2_primary: 1,
    mining_or_query_repair: 2,
    owner_or_manual_review: 3,
    stop_deterministic: 4,
  };
  return order[a.action] - order[b.action] || b.total - a.total || a.lane.localeCompare(b.lane);
});

const md = [
  "# Lane Next Action Split",
  "",
  `- generated_at: ${generatedAt}`,
  `- source_lane_replay: ${replay.generatedAt}`,
  `- source_ai_l2_routing: ${routing.generatedAt}`,
  "",
  "## Action Counts",
  "",
  ...Object.entries(actionCounts).sort().map(([action, count]) => `- ${action}: ${count}`),
  "",
  "## Queue",
  "",
  table(
    ["lane", "action", "reason", "grade", "samples", "sku", "complete", "needsReviewFalse", "unknown", "aiL2Reason"],
    ordered.map((row) => [
      row.lane,
      row.action,
      row.actionReason,
      row.grade,
      row.total,
      `${row.skuMatchPct}%`,
      `${row.comparableKeyCompletePct}%`,
      `${row.needsReviewFalsePct}%`,
      `${row.unknownPartsPct}%`,
      row.aiL2Reason ?? "-",
    ]),
  ),
  "",
].join("\n");

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(path.join(REPORT_DIR, "lane-next-action-split-latest.json"), JSON.stringify(report, null, 2));
writeFileSync(path.join(REPORT_DIR, "lane-next-action-split-latest.md"), md);

console.log(`wrote reports/lane-next-action-split-latest.json`);
console.log(`wrote reports/lane-next-action-split-latest.md`);
console.log(JSON.stringify(actionCounts, null, 2));
