import fs from "node:fs";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

const reportsDir = path.join(process.cwd(), "reports");

function readJson<T extends JsonRecord>(file: string): T | null {
  const fullPath = path.join(reportsDir, file);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

function readText(file: string): string | null {
  const fullPath = path.join(reportsDir, file);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, "utf8");
}

function valueAt(obj: unknown, pathExpr: string): unknown {
  return pathExpr.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function parsePercentCount(value: unknown) {
  const text = String(value ?? "");
  const match = text.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

function table(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

const db = readJson<JsonRecord>("db-hotpaths-latest.json");
const pack = readJson<JsonRecord>("pack-open-quality-latest.json");
const tick = readJson<JsonRecord>("tick-write-amplification-latest.json");
const categoryBoard = readJson<JsonRecord>("category-runtime-readiness-board-latest.json");
const orchestration = readJson<JsonRecord>("category-orchestration-status-latest.json");
const reparsePlan = readJson<JsonRecord>("reparse-backfill-apply-plan-latest.json");

const revealCount = parsePercentCount(valueAt(pack, "summary.reveal"));
const sampledCount = parsePercentCount(valueAt(pack, "summary.sampled"));
const packHealthy = revealCount === sampledCount && sampledCount > 0 && parsePercentCount(valueAt(pack, "summary.errors")) === 0;

const sourceHealthStatus = asString(valueAt(db, "latestSourceHealth.status"));
const runFailureRate = asNumber(valueAt(db, "runs.failureRate"));
const sourceHealthy = sourceHealthStatus === "healthy" && runFailureRate === 0;

const sellerUpsertRatio = asNumber(valueAt(tick, "ratios.sellerUpsertToSeen"));
const rawTouchRatio = asNumber(valueAt(tick, "ratios.rawTouchToUnique"));
const rawCoalesceRatio =
  asNumber(valueAt(tick, "totals.coalesceEligible")) > 0
    ? asNumber(valueAt(tick, "totals.coalesceWouldSkip")) / asNumber(valueAt(tick, "totals.coalesceEligible"))
    : 0;

const categoryRows = Array.isArray(categoryBoard?.rows) ? (categoryBoard.rows as JsonRecord[]) : [];
const orchestrationRows = Array.isArray(orchestration?.candidates) ? (orchestration.candidates as JsonRecord[]) : [];

const readinessRows = categoryRows.map((row) => ({
  category: asString(row.category),
  status: asString(row.status),
  runtimeApplied: asNumber(row.runtimeApprovedRows) > 0 ? "yes" : "no",
  candidatePoolWired: asNumber(row.candidatePoolWiringRows) > 0 ? "yes" : "no",
  publicEnabled: asNumber(row.publicPromotionRows) > 0 ? "yes" : "no",
  failed: asNumber(row.failedRows),
  candidatePositiveOnly: asNumber(row.candidatePositiveOnlyRows),
}));

const conflicts: string[] = [];
const rolloutPlan = readText("category-wide-runtime-rollout-plan-2026-05-12.md") ?? "";
const boundaryReview = readText("subagent-boundary-review-2026-05-12.md") ?? "";
const queueSummary = readText("subagent-runtime-gap-queue-execution-summary-2026-05-12.md") ?? "";

if (/(gate는 적용 완료|leak은 적용 완료)/.test(rolloutPlan) && /Patch Review Queue|owner|suggested owner|should review/i.test(`${boundaryReview}\n${queueSummary}`)) {
  conflicts.push("category-wide rollout plan uses applied wording while boundary/queue reports still describe owner-review/runtime patch queue.");
}

if (asNumber(valueAt(reparsePlan, "summary.autoInvalidateRows")) === 0) {
  const planText = readText("reparse-backfill-apply-plan-latest.md") ?? "";
  if (/3건만|autoInvalidateRows 3/.test(planText)) {
    conflicts.push("reparse apply plan still contains stale '3 rows apply' wording despite autoInvalidateRows=0.");
  }
}

const recommendedNext = orchestration?.recommendedNext;
const recommendedNextLane =
  recommendedNext && typeof recommendedNext === "object"
    ? asString((recommendedNext as JsonRecord).lane)
    : asString(recommendedNext);

const report = {
  generatedAt: new Date().toISOString(),
  mode: "read_only_source_of_truth_board",
  operationalHealth: {
    sourceHealth: sourceHealthStatus,
    runCount: asNumber(valueAt(db, "runs.total")),
    failedRuns: asNumber(valueAt(db, "runs.failed")),
    failureRate: runFailureRate,
    packReveal: `${revealCount}/${sampledCount}`,
    packHealthy,
    activeReadyPool: asString(valueAt(pack, "summary.activeReadyPool")),
  },
  writeAmplification: {
    sellerUpsertRatio,
    sellerSkipRatio: asNumber(valueAt(tick, "ratios.sellerSkipToSeen")),
    sellerRefreshWindowMs: asNumber(valueAt(tick, "totals.sellerRefreshWindowMs")),
    rawTouchRatio,
    rawCoalesceSkipRatio: rawCoalesceRatio,
    primaryRemainingHotPath: rawTouchRatio > 0.9 ? "mvp_raw_listings.last_seen_at touch" : "mixed",
  },
  categoryRuntimeState: {
    categoriesChecked: asNumber(valueAt(categoryBoard, "metrics.categoriesChecked")),
    reportOnlyPass: asNumber(valueAt(categoryBoard, "metrics.reportOnlyPass")),
    ownerReviewNeeded: asNumber(valueAt(categoryBoard, "metrics.ownerReviewNeeded")),
    blocked: asNumber(valueAt(categoryBoard, "metrics.blocked")),
    rows: readinessRows,
  },
  orchestrationState: {
    recommendedNext: recommendedNextLane,
    runtimePatchReadyCandidates: asNumber(orchestration?.runtimePatchReadyCandidates),
    sampleBackfillRequiredCandidates: asNumber(orchestration?.sampleBackfillRequiredCandidates),
    topLanes: orchestrationRows.slice(0, 5).map((row) => ({
      lane: asString(row.lane),
      status: asString(row.status),
      score: asNumber(row.score),
      nextAction: asString(row.nextAction),
    })),
  },
  reparseBackfill: {
    activeInvalidationRows: asNumber(valueAt(reparsePlan, "summary.activeInvalidationRows")),
    autoInvalidateRows: asNumber(valueAt(reparsePlan, "summary.autoInvalidateRows")),
    plannedDbMutationsIfApplied: valueAt(reparsePlan, "summary.plannedDbMutationsIfApplied") ?? {},
  },
  conflicts,
  decision: sourceHealthy && packHealthy ? "operationally_healthy_no_runtime_mutation_needed_now" : "needs_operational_attention_before_runtime_patch",
  nextActions:
    conflicts.length > 0
      ? ["Resolve stale/conflicting report wording before runtime patch review.", "Keep subagent expansion report-only until source-of-truth board is clean."]
      : [
          "Keep seller TTL as successful.",
          "Do not expand raw touch coalescing yet; design purpose-specific timestamps first.",
          "Batch review headphone/game-console runtime patch proposals only after parser subagent report chain is complete.",
        ],
};

const jsonPath = path.join(reportsDir, "current-state-board-latest.json");
const mdPath = path.join(reportsDir, "current-state-board-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Current State / Source Of Truth Board",
  "",
  `- generated_at: ${report.generatedAt}`,
  `- mode: ${report.mode}`,
  `- decision: ${report.decision}`,
  "",
  "## Operational Health",
  "",
  table(
    ["metric", "value"],
    [
      ["source health", report.operationalHealth.sourceHealth],
      ["runs / failed", `${report.operationalHealth.runCount} / ${report.operationalHealth.failedRuns}`],
      ["failure rate", `${(report.operationalHealth.failureRate * 100).toFixed(1)}%`],
      ["pack reveal", report.operationalHealth.packReveal],
      ["pack healthy", report.operationalHealth.packHealthy ? "yes" : "no"],
      ["active ready pool", report.operationalHealth.activeReadyPool],
    ],
  ),
  "",
  "## Write Amplification",
  "",
  table(
    ["metric", "value"],
    [
      ["seller upsert ratio", `${(report.writeAmplification.sellerUpsertRatio * 100).toFixed(1)}%`],
      ["seller skip ratio", `${(report.writeAmplification.sellerSkipRatio * 100).toFixed(1)}%`],
      ["seller refresh window ms", report.writeAmplification.sellerRefreshWindowMs],
      ["raw touch ratio", `${(report.writeAmplification.rawTouchRatio * 100).toFixed(1)}%`],
      ["raw coalesce skip ratio", `${(report.writeAmplification.rawCoalesceSkipRatio * 100).toFixed(1)}%`],
      ["remaining hot path", report.writeAmplification.primaryRemainingHotPath],
    ],
  ),
  "",
  "## Runtime / Public State",
  "",
  table(
    ["category", "status", "runtime applied", "candidate pool wired", "public enabled", "failed", "candidate positive only"],
    report.categoryRuntimeState.rows.map((row) => [
      row.category,
      row.status,
      row.runtimeApplied,
      row.candidatePoolWired,
      row.publicEnabled,
      row.failed,
      row.candidatePositiveOnly,
    ]),
  ),
  "",
  "## Orchestration Queue",
  "",
  `- recommendedNext: ${report.orchestrationState.recommendedNext}`,
  `- runtimePatchReadyCandidates: ${report.orchestrationState.runtimePatchReadyCandidates}`,
  `- sampleBackfillRequiredCandidates: ${report.orchestrationState.sampleBackfillRequiredCandidates}`,
  "",
  table(
    ["lane", "status", "score", "next action"],
    report.orchestrationState.topLanes.map((row) => [row.lane, row.status, row.score, row.nextAction]),
  ),
  "",
  "## Reparse / Backfill",
  "",
  table(
    ["metric", "value"],
    [
      ["active invalidation rows", report.reparseBackfill.activeInvalidationRows],
      ["auto invalidate rows", report.reparseBackfill.autoInvalidateRows],
      ["planned DB mutations", JSON.stringify(report.reparseBackfill.plannedDbMutationsIfApplied)],
    ],
  ),
  "",
  "## Conflicts / Stale Signals",
  "",
  report.conflicts.length > 0 ? report.conflicts.map((row) => `- ${row}`).join("\n") : "- none",
  "",
  "## Next Actions",
  "",
  ...report.nextActions.map((row, index) => `${index + 1}. ${row}`),
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(
  JSON.stringify(
    {
      decision: report.decision,
      sourceHealth: report.operationalHealth.sourceHealth,
      packReveal: report.operationalHealth.packReveal,
      conflicts: report.conflicts.length,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
