import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

type LiveRow = {
  pid: string | number;
  title: string;
  price: number;
  saleStatus: string;
  query?: string;
  disposition: "fresh_live_candidate" | "manual_review" | "hold";
  reason: string;
  description?: string;
  matchedSignals?: string[];
  holdSignals?: string[];
};

type Lane = {
  lane: string;
  label?: string;
  category?: string;
  rows: LiveRow[];
};

type EscalationRow = {
  lane: string;
  pid: string;
  title: string;
  price: number;
  saleStatus: string;
  sourceReason: string;
  escalationDecision: "ai_second_opinion_candidate" | "owner_review_only" | "hard_hold";
  escalationReason: string;
  promptPolicy: string;
};

const reportsDir = path.join(process.cwd(), "reports");
const liveReadPath = path.join(reportsDir, "category-no-write-live-read-observation-latest.json");
const robotRefinedPath = path.join(reportsDir, "robot-vacuum-refined-live-read-latest.json");
const outputJsonPath = path.join(reportsDir, "live-read-ai-escalation-contract-latest.json");
const outputMdPath = path.join(reportsDir, "live-read-ai-escalation-contract-latest.md");

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function compact(value: unknown, length = 80): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function table(headers: string[], rows: Array<Array<string | number>>) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function isManualContextEligible(row: LiveRow): boolean {
  return [
    "exact_model_but_speaker_context_missing",
    "full_unit_title_but_description_mentions_accessories",
    "exact_model_but_monitor_context_missing",
    "exact_model_but_robot_vacuum_context_missing",
  ].includes(row.reason);
}

function shouldStayOwnerReview(row: LiveRow): boolean {
  return [
    "exact_body_model_missing",
    "exact_monitor_model_missing",
    "selected_speaker_model_missing",
    "robot_vacuum_model_missing",
    "exact_robot_vacuum_model_missing",
  ].includes(row.reason);
}

function classifyEscalation(lane: string, row: LiveRow): EscalationRow {
  if (row.disposition === "hold") {
    return {
      lane,
      pid: String(row.pid),
      title: row.title,
      price: Number(row.price ?? 0),
      saleStatus: row.saleStatus,
      sourceReason: row.reason,
      escalationDecision: "hard_hold",
      escalationReason: "already_hard_hold_by_rule",
      promptPolicy: "Do not call AI for hard holds; rule already rejected the row.",
    };
  }

  if (row.disposition === "manual_review" && isManualContextEligible(row)) {
    return {
      lane,
      pid: String(row.pid),
      title: row.title,
      price: Number(row.price ?? 0),
      saleStatus: row.saleStatus,
      sourceReason: row.reason,
      escalationDecision: "ai_second_opinion_candidate",
      escalationReason: "exact_model_present_but_context_or_package_semantics_ambiguous",
      promptPolicy:
        "AI may only pass when the row is clearly a full working unit, currently sellable, and not accessory/parts/bundle-only. Any unresolved ambiguity must be hold.",
    };
  }

  if (row.disposition === "manual_review" && shouldStayOwnerReview(row)) {
    return {
      lane,
      pid: String(row.pid),
      title: row.title,
      price: Number(row.price ?? 0),
      saleStatus: row.saleStatus,
      sourceReason: row.reason,
      escalationDecision: "owner_review_only",
      escalationReason: "model_identity_missing_or_target_mismatch_ai_must_not_correct_policy",
      promptPolicy: "Do not call AI to rescue model mismatches or missing model identity.",
    };
  }

  return {
    lane,
    pid: String(row.pid),
    title: row.title,
    price: Number(row.price ?? 0),
    saleStatus: row.saleStatus,
    sourceReason: row.reason,
    escalationDecision: "owner_review_only",
    escalationReason: "not_a_narrow_ai_escalation_case",
    promptPolicy: "Owner or fixture review first.",
  };
}

function rowsFromLiveRead(report: JsonRecord): Lane[] {
  const lanes = Array.isArray(report.lanes) ? report.lanes : [];
  return lanes.map((lane) => {
    const laneRecord = asRecord(lane);
    return {
      lane: String(laneRecord.lane ?? "unknown"),
      label: String(laneRecord.label ?? ""),
      category: String(laneRecord.category ?? ""),
      rows: Array.isArray(laneRecord.rows) ? laneRecord.rows as LiveRow[] : [],
    };
  });
}

function rowsFromRobotRefined(report: JsonRecord | null): Lane[] {
  if (!report) return [];
  const rows = Array.isArray(report.rows) ? report.rows as LiveRow[] : [];
  return [{
    lane: "home_appliance_robot_vacuum_refined",
    label: "Robot vacuum refined query rows",
    category: "home_appliance_tech_discovered",
    rows,
  }];
}

async function main() {
  const liveRead = await readJson<JsonRecord>(liveReadPath);
  if (!liveRead) throw new Error("category-no-write-live-read-observation-latest.json not found");
  const robotRefined = await readJson<JsonRecord>(robotRefinedPath);

  const lanes = [...rowsFromLiveRead(liveRead), ...rowsFromRobotRefined(robotRefined)];
  const escalationRows = lanes.flatMap((lane) => lane.rows.map((row) => classifyEscalation(lane.lane, row)));
  const aiCandidates = escalationRows.filter((row) => row.escalationDecision === "ai_second_opinion_candidate");
  const ownerOnlyRows = escalationRows.filter((row) => row.escalationDecision === "owner_review_only");
  const hardHoldRows = escalationRows.filter((row) => row.escalationDecision === "hard_hold");

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    aiApiCalls: 0,
    conclusion: "live_read_ai_escalation_contract_ready_report_only_no_api_calls",
    metrics: {
      totalRowsReviewed: escalationRows.length,
      aiSecondOpinionCandidates: aiCandidates.length,
      ownerReviewOnlyRows: ownerOnlyRows.length,
      hardHoldRows: hardHoldRows.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      dbMutationRows: 0,
    },
    aiCandidates,
    ownerOnlyRows,
    hardHoldExamples: hardHoldRows.slice(0, 12),
    promptContract: {
      role: "conservative second-opinion reviewer",
      passAllowedOnlyIf: [
        "full working unit is explicit",
        "exact target model is explicit",
        "currently sellable sale status",
        "no accessory/parts/bundle-only ambiguity",
        "no buying/sold/rental/fraud/damaged/counterfeit signal",
      ],
      defaultWhenUnsure: "hold",
      neverUseAiFor: [
        "model mismatch",
        "missing exact model identity",
        "already hard-held rows",
        "public promotion or candidate-pool wiring",
      ],
    },
  };

  const md = `# Live-Read AI Escalation Contract

- generatedAt: ${report.generatedAt}
- conclusion: ${report.conclusion}
- reportOnly: true
- aiApiCalls: 0
- runtime/public/candidate/db mutation: false/false/false/false

## Metrics

${table(
  ["metric", "value"],
  Object.entries(report.metrics).map(([key, value]) => [key, Number(value)]),
)}

## AI Second-Opinion Candidates

${aiCandidates.length === 0 ? "_none_" : table(
  ["lane", "pid", "price", "reason", "title"],
  aiCandidates.map((row) => [row.lane, row.pid, row.price.toLocaleString("ko-KR"), row.sourceReason, compact(row.title)]),
)}

## Owner Review Only

${ownerOnlyRows.length === 0 ? "_none_" : table(
  ["lane", "pid", "reason", "why", "title"],
  ownerOnlyRows.slice(0, 20).map((row) => [row.lane, row.pid, row.sourceReason, row.escalationReason, compact(row.title)]),
)}

## Hard Hold Examples

${hardHoldRows.length === 0 ? "_none_" : table(
  ["lane", "pid", "reason", "title"],
  hardHoldRows.slice(0, 12).map((row) => [row.lane, row.pid, row.sourceReason, compact(row.title)]),
)}

## Prompt Contract

- AI is a second opinion, not a primary classifier.
- Pass is allowed only when full-unit / exact-model / active sellability are all clear.
- If the model identity is missing or mismatched, do not ask AI to rescue it.
- If uncertain, hold.
- This report makes no API calls and writes no DB rows.
`;

  await mkdir(reportsDir, { recursive: true });
  await writeFile(outputJsonPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(outputMdPath, md, "utf8");

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    metrics: report.metrics,
    jsonPath: outputJsonPath,
    mdPath: outputMdPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
