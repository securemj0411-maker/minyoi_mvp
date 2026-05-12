import fs from "node:fs";
import path from "node:path";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type FixtureClassification = "active_candidate" | "manual_hold" | "hard_hold" | "schema_error";

type FixtureRow = {
  fixtureId: string;
  bodyModel: string;
  title: string;
  saleStatus: string;
  observedAtAssumption: string;
  listingUpdatedAtAssumption: string;
  expectedClassification: FixtureClassification;
  expectedReason: string;
};

type PreflightReport = {
  reportOnly: boolean;
  runtimeCatalogApply: boolean;
  runtimeApply: boolean;
  publicPromotion: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  liveDbWrites: boolean;
  liveFetchImplementation: boolean;
  runtimePatchProposal: boolean;
  metrics: Record<string, number>;
  fixtureRows: FixtureRow[];
  sourceEvidenceCoverage: Array<{
    bodyModel: string;
    officialModelName: string;
    status: string;
    evidence: string;
  }>;
  finalPassFailAudit: Array<{ check: string; status: "pass" | "fail"; evidence: string }>;
};

type RunnerDesign = {
  reportOnly: boolean;
  liveDbWrites: boolean;
  liveFetchImplementation: boolean;
  runtimePatchProposal: boolean;
  metrics: Record<string, number>;
  outputSchema: Array<{ name: string; contract: string[] }>;
  expectedMetrics: Array<{ metric: string; definition: string; expectedRangeOrTarget: string }>;
  noWriteGuarantees: string[];
};

type CategoryStatus = {
  reportOnly: boolean;
  recommendedNext?: string;
  candidates?: Array<{ lane: string; status: string; score: number }>;
};

type BoundaryAudit = {
  reportOnly: boolean;
  auditStatus: string;
  metrics: Record<string, number>;
};

type SampledRow = FixtureRow & {
  simulatedClassification: FixtureClassification;
  dispositionReason: string;
  expectationMatched: boolean;
};

type BodyModelSummary = {
  bodyModel: string;
  officialModelName: string;
  sampledRows: number;
  activeAcceptedRows: number;
  manualHoldRows: number;
  hardHoldRows: number;
  schemaErrorRows: number;
  expectationMismatches: number;
  writeTargetsTouched: string[];
};

type SimulationReport = {
  generatedAt: string;
  reportOnly: true;
  ownership: "camera_body_only_exact_model_supplied_input_no_write_runner_simulation";
  category: "camera";
  lane: "body_only_exact_model";
  conclusion: string;
  runtimeCatalogApply: false;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  directThirtyDayPlanEdit: false;
  liveDbWrites: false;
  liveFetchImplementation: false;
  runtimePatchProposal: false;
  dbAccess: false;
  metrics: Record<string, number>;
  inputFilesRead: string[];
  simulationMode: "supplied_input_fixtures_only";
  bodyModelSummaries: BodyModelSummary[];
  sampledRows: SampledRow[];
  classificationCounts: Record<FixtureClassification, number>;
  stopConditionsTriggered: Array<{ stopCondition: string; evidence: string }>;
  writeTargetsTouched: string[];
  boundaryAudit: Array<{ check: string; status: "pass" | "fail"; evidence: string }>;
};

const repoRoot = process.cwd();
const reportsDir = path.join(repoRoot, "reports");
const handoffPath = path.resolve(repoRoot, "..", "인수인계.md");

const inputPaths = {
  preflight: "reports/camera-body-only-no-write-runner-preflight-latest.json",
  runnerDesign: "reports/camera-body-only-no-write-live-market-dry-run-runner-design-latest.json",
  categoryStatus: "reports/category-orchestration-status-latest.json",
  boundaryAudit: "reports/orchestration-boundary-audit-latest.json",
};

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8")) as T;
}

function readText(absolutePath: string) {
  return fs.readFileSync(absolutePath, "utf8");
}

function assertReportOnlyInputs(
  preflight: PreflightReport,
  runnerDesign: RunnerDesign,
  categoryStatus: CategoryStatus,
  boundaryAudit: BoundaryAudit,
) {
  const forbiddenFlags = [
    preflight.runtimeCatalogApply,
    preflight.runtimeApply,
    preflight.publicPromotion,
    preflight.candidatePoolPolicyWiring,
    preflight.productionDbMutation,
    preflight.directThirtyDayPlanEdit,
    preflight.liveDbWrites,
    preflight.liveFetchImplementation,
    preflight.runtimePatchProposal,
    runnerDesign.liveDbWrites,
    runnerDesign.liveFetchImplementation,
    runnerDesign.runtimePatchProposal,
  ];

  if (
    !preflight.reportOnly ||
    !runnerDesign.reportOnly ||
    !categoryStatus.reportOnly ||
    !boundaryAudit.reportOnly ||
    forbiddenFlags.some(Boolean)
  ) {
    throw new Error("Simulation inputs must remain report-only and no-write.");
  }
}

function assertClosedBoundaries(report: SimulationReport) {
  const forbiddenFlags = [
    report.runtimeCatalogApply,
    report.runtimeApply,
    report.publicPromotion,
    report.candidatePoolPolicyWiring,
    report.productionDbMutation,
    report.directThirtyDayPlanEdit,
    report.liveDbWrites,
    report.liveFetchImplementation,
    report.runtimePatchProposal,
    report.dbAccess,
  ];

  if (!report.reportOnly || forbiddenFlags.some(Boolean)) {
    throw new Error("Simulation report breached report-only/no-write boundaries.");
  }

  if (report.writeTargetsTouched.length !== 0) {
    throw new Error("writeTargetsTouched must remain empty.");
  }

  for (const metricName of [
    "runtimeApprovedRows",
    "publicPromotionRows",
    "candidatePoolRows",
    "runtimeApplyRows",
    "liveDbWriteRows",
    "dbAccessRows",
    "runtimePatchProposalRows",
  ]) {
    if (report.metrics[metricName] !== 0) {
      throw new Error(`${metricName} must remain 0.`);
    }
  }

  if (report.boundaryAudit.some((row) => row.status === "fail")) {
    throw new Error("Boundary audit contains fail rows.");
  }
}

function hasAny(text: string, tokens: string[]) {
  const normalized = text.toLowerCase();
  return tokens.some((token) => normalized.includes(token.toLowerCase()));
}

function classifyFixture(row: FixtureRow): { classification: FixtureClassification; reason: string } {
  const title = row.title.trim();
  if (!title) {
    return { classification: "schema_error", reason: "missing required title" };
  }

  if (!row.saleStatus) {
    return { classification: "schema_error", reason: "missing required saleStatus" };
  }

  if (row.observedAtAssumption === "missing_title") {
    return { classification: "schema_error", reason: "invalid fixture freshness/title assumption" };
  }

  const inactiveStatuses = ["sold", "sold_out", "SOLD_OUT", "deleted", "unknown"];
  if (inactiveStatuses.map((status) => status.toLowerCase()).includes(row.saleStatus.toLowerCase())) {
    return { classification: "hard_hold", reason: "inactive or sold saleStatus cannot count as live evidence" };
  }

  if (row.observedAtAssumption.includes("older_than_72_hours")) {
    return { classification: "hard_hold", reason: "stale observedAt assumption" };
  }

  if (hasAny(title, ["렌즈", "렌즈킷", "kit", "번들", "세트", "24-105", "28-60", "15-45", "18-150"])) {
    return { classification: "hard_hold", reason: "lens/kit/bundle token leakage" };
  }

  if (hasAny(title, ["삽니다", "구매", "고장", "수리필요", "부품", "파손", "침수"])) {
    return { classification: "hard_hold", reason: "buying/damaged/parts token" };
  }

  if (hasAny(title, ["x100", "g7x", "rx100", "cyber-shot", "ricoh gr", "x70"])) {
    return { classification: "hard_hold", reason: "fixed-lens compact boundary" };
  }

  if (!hasAny(title, ["바디", "바디만", "body", "body only", "본체"])) {
    return { classification: "manual_hold", reason: "body-only/no-lens proof is not title-visible" };
  }

  if (row.saleStatus.toLowerCase() === "reserved") {
    return { classification: "manual_hold", reason: "reserved status is not active threshold evidence" };
  }

  return { classification: "active_candidate", reason: "fresh active exact-model body-only fixture" };
}

function countClassifications(rows: SampledRow[]): Record<FixtureClassification, number> {
  return {
    active_candidate: rows.filter((row) => row.simulatedClassification === "active_candidate").length,
    manual_hold: rows.filter((row) => row.simulatedClassification === "manual_hold").length,
    hard_hold: rows.filter((row) => row.simulatedClassification === "hard_hold").length,
    schema_error: rows.filter((row) => row.simulatedClassification === "schema_error").length,
  };
}

function table(headers: string[], rows: Array<Array<string | number>>) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replaceAll("\n", "<br>")).join(" | ")} |`),
  ].join("\n");
}

const preflight = readJson<PreflightReport>(inputPaths.preflight);
const runnerDesign = readJson<RunnerDesign>(inputPaths.runnerDesign);
const categoryStatus = readJson<CategoryStatus>(inputPaths.categoryStatus);
const orchestrationBoundaryAudit = readJson<BoundaryAudit>(inputPaths.boundaryAudit);
const handoffText = readText(handoffPath);

assertReportOnlyInputs(preflight, runnerDesign, categoryStatus, orchestrationBoundaryAudit);

const sampledRows: SampledRow[] = preflight.fixtureRows.map((row) => {
  const result = classifyFixture(row);
  return {
    ...row,
    simulatedClassification: result.classification,
    dispositionReason: result.reason,
    expectationMatched: result.classification === row.expectedClassification,
  };
});

const classificationCounts = countClassifications(sampledRows);

const bodyModelSummaries: BodyModelSummary[] = preflight.sourceEvidenceCoverage.map((source) => {
  const modelRows = sampledRows.filter((row) => row.bodyModel === source.bodyModel);
  return {
    bodyModel: source.bodyModel,
    officialModelName: source.officialModelName,
    sampledRows: modelRows.length,
    activeAcceptedRows: modelRows.filter((row) => row.simulatedClassification === "active_candidate").length,
    manualHoldRows: modelRows.filter((row) => row.simulatedClassification === "manual_hold").length,
    hardHoldRows: modelRows.filter((row) => row.simulatedClassification === "hard_hold").length,
    schemaErrorRows: modelRows.filter((row) => row.simulatedClassification === "schema_error").length,
    expectationMismatches: modelRows.filter((row) => !row.expectationMatched).length,
    writeTargetsTouched: [],
  };
});

const stopConditionsTriggered =
  sampledRows.some((row) => !row.expectationMatched)
    ? [
        {
          stopCondition: "fixture_expectation_mismatch",
          evidence: `${sampledRows.filter((row) => !row.expectationMatched).length} fixture rows differed from preflight expectations.`,
        },
      ]
    : [];

const cameraCandidate = categoryStatus.candidates?.find((candidate) => candidate.lane === "camera_body_only_exact_model");
const handoffNoPublic = handoffText.includes("public promotion은 하지 말고") || handoffText.includes("public promotion: 없음");

const boundaryAudit = [
  {
    check: "no_live_fetch_or_db_access",
    status: "pass" as const,
    evidence: "Simulation consumed local preflight fixture rows only; no fetch/db client is present.",
  },
  {
    check: "write_targets_empty",
    status: "pass" as const,
    evidence: "writeTargetsTouched=[]",
  },
  {
    check: "preflight_passed",
    status:
      preflight.metrics.preflightAuditFails === 0 && preflight.metrics.sourceBackfillNeededRows === 0
        ? ("pass" as const)
        : ("fail" as const),
    evidence: `preflightAuditFails=${preflight.metrics.preflightAuditFails}; sourceBackfillNeededRows=${preflight.metrics.sourceBackfillNeededRows}`,
  },
  {
    check: "runner_contract_no_write",
    status:
      runnerDesign.metrics.liveDbWriteRows === 0 && runnerDesign.metrics.liveFetchImplementationRows === 0
        ? ("pass" as const)
        : ("fail" as const),
    evidence: `liveDbWriteRows=${runnerDesign.metrics.liveDbWriteRows}; liveFetchImplementationRows=${runnerDesign.metrics.liveFetchImplementationRows}`,
  },
  {
    check: "orchestration_boundary_audit_clean",
    status:
      orchestrationBoundaryAudit.auditStatus === "pass" &&
      orchestrationBoundaryAudit.metrics.hardFailFindings === 0 &&
      orchestrationBoundaryAudit.metrics.forbiddenTrueFlags === 0
        ? ("pass" as const)
        : ("fail" as const),
    evidence: `auditStatus=${orchestrationBoundaryAudit.auditStatus}; hardFailFindings=${orchestrationBoundaryAudit.metrics.hardFailFindings}; forbiddenTrueFlags=${orchestrationBoundaryAudit.metrics.forbiddenTrueFlags}`,
  },
  {
    check: "camera_lane_selected_report_only",
    status: cameraCandidate?.status.includes("no_write") ? ("pass" as const) : ("fail" as const),
    evidence: cameraCandidate ? `${cameraCandidate.status}; score=${cameraCandidate.score}` : "camera lane missing",
  },
  {
    check: "handoff_report_only_alignment",
    status: handoffNoPublic ? ("pass" as const) : ("fail" as const),
    evidence: "인수인계.md keeps subagent work away from public promotion and production mutation.",
  },
];

const metrics = {
  inputFilesRead: 5,
  fixtureRowsConsumed: preflight.fixtureRows.length,
  bodyModelSummaries: bodyModelSummaries.length,
  sampledRows: sampledRows.length,
  activeCandidateRows: classificationCounts.active_candidate,
  manualHoldRows: classificationCounts.manual_hold,
  hardHoldRows: classificationCounts.hard_hold,
  schemaErrorRows: classificationCounts.schema_error,
  expectationMismatches: sampledRows.filter((row) => !row.expectationMatched).length,
  stopConditionsTriggered: stopConditionsTriggered.length,
  writeTargetsTouched: 0,
  boundaryAuditChecks: boundaryAudit.length,
  boundaryAuditPasses: boundaryAudit.filter((row) => row.status === "pass").length,
  boundaryAuditFails: boundaryAudit.filter((row) => row.status === "fail").length,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
  liveDbWriteRows: 0,
  dbAccessRows: 0,
  runtimePatchProposalRows: 0,
};

const report: SimulationReport = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  ownership: "camera_body_only_exact_model_supplied_input_no_write_runner_simulation",
  category: "camera",
  lane: "body_only_exact_model",
  conclusion:
    metrics.expectationMismatches === 0 && metrics.boundaryAuditFails === 0
      ? "camera_body_only_supplied_input_runner_simulation_passed_report_only"
      : "camera_body_only_supplied_input_runner_simulation_hold_report_only",
  runtimeCatalogApply: false,
  runtimeApply: false,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  liveDbWrites: false,
  liveFetchImplementation: false,
  runtimePatchProposal: false,
  dbAccess: false,
  metrics,
  inputFilesRead: [
    inputPaths.preflight,
    inputPaths.runnerDesign,
    inputPaths.categoryStatus,
    inputPaths.boundaryAudit,
    path.relative(repoRoot, handoffPath),
  ],
  simulationMode: "supplied_input_fixtures_only",
  bodyModelSummaries,
  sampledRows,
  classificationCounts,
  stopConditionsTriggered,
  writeTargetsTouched: [],
  boundaryAudit,
};

assertClosedBoundaries(report);

const jsonPath = path.join(reportsDir, "camera-body-only-supplied-input-runner-simulation-latest.json");
const mdPath = path.join(reportsDir, "camera-body-only-supplied-input-runner-simulation-latest.md");

const markdown = [
  "# Camera Body-Only Supplied-Input Runner Simulation",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- conclusion: ${report.conclusion}`,
  `- ownership: ${report.ownership}`,
  `- reportOnly: ${report.reportOnly}`,
  `- simulationMode: ${report.simulationMode}`,
  `- runtimeCatalogApply/runtimeApply/publicPromotion/candidatePoolPolicyWiring: ${report.runtimeCatalogApply}/${report.runtimeApply}/${report.publicPromotion}/${report.candidatePoolPolicyWiring}`,
  `- runtimeApproved/publicPromotion/candidatePool/runtimeApply rows: ${metrics.runtimeApprovedRows}/${metrics.publicPromotionRows}/${metrics.candidatePoolRows}/${metrics.runtimeApplyRows}`,
  `- liveDbWrites/liveFetchImplementation/dbAccess/runtimePatchProposal: ${report.liveDbWrites}/${report.liveFetchImplementation}/${report.dbAccess}/${report.runtimePatchProposal}`,
  `- writeTargetsTouched: ${JSON.stringify(report.writeTargetsTouched)}`,
  "",
  "## Scope",
  "",
  "Report-only supplied-input simulation for the camera body-only exact-model no-write runner. It consumes only local fixture rows from the preflight JSON and does not perform live fetch, DB access, runtime mutation, public promotion, candidate-pool wiring, cron/lifecycle/source-health work, auth, or pack UI changes.",
  "",
  "## Inputs Read",
  "",
  report.inputFilesRead.map((input) => `- ${input}`).join("\n"),
  "",
  "## Metrics",
  "",
  table(
    ["metric", "value"],
    Object.entries(metrics).map(([key, value]) => [key, value]),
  ),
  "",
  "## Classification Counts",
  "",
  table(
    ["classification", "count"],
    Object.entries(classificationCounts).map(([classification, count]) => [classification, count]),
  ),
  "",
  "## Body Model Summaries",
  "",
  table(
    [
      "bodyModel",
      "officialModelName",
      "sampled",
      "active",
      "manual",
      "hard",
      "schema",
      "mismatches",
      "writeTargetsTouched",
    ],
    bodyModelSummaries.map((row) => [
      row.bodyModel,
      row.officialModelName,
      row.sampledRows,
      row.activeAcceptedRows,
      row.manualHoldRows,
      row.hardHoldRows,
      row.schemaErrorRows,
      row.expectationMismatches,
      JSON.stringify(row.writeTargetsTouched),
    ]),
  ),
  "",
  "## Sampled Rows",
  "",
  table(
    ["fixtureId", "bodyModel", "saleStatus", "expected", "simulated", "matched", "reason", "title"],
    sampledRows.map((row) => [
      row.fixtureId,
      row.bodyModel,
      row.saleStatus,
      row.expectedClassification,
      row.simulatedClassification,
      String(row.expectationMatched),
      row.dispositionReason,
      row.title || "(missing title)",
    ]),
  ),
  "",
  "## Stop Conditions",
  "",
  stopConditionsTriggered.length === 0
    ? "- none"
    : stopConditionsTriggered.map((row) => `- ${row.stopCondition}: ${row.evidence}`).join("\n"),
  "",
  "## Boundary Audit",
  "",
  table(
    ["check", "status", "evidence"],
    boundaryAudit.map((row) => [row.check, row.status, row.evidence]),
  ),
  "",
].join("\n");

fs.writeFileSync(jsonPath, `${JSON.stringify(report satisfies JsonValue, null, 2)}\n`);
fs.writeFileSync(mdPath, markdown);

console.log(
  JSON.stringify(
    {
      conclusion: report.conclusion,
      fixtureRowsConsumed: metrics.fixtureRowsConsumed,
      classificationCounts,
      stopConditionsTriggered: metrics.stopConditionsTriggered,
      writeTargetsTouched: report.writeTargetsTouched,
      runtimeApprovedRows: metrics.runtimeApprovedRows,
      publicPromotionRows: metrics.publicPromotionRows,
      candidatePoolRows: metrics.candidatePoolRows,
      runtimeApplyRows: metrics.runtimeApplyRows,
      liveDbWriteRows: metrics.liveDbWriteRows,
      dbAccessRows: metrics.dbAccessRows,
      runtimePatchProposalRows: metrics.runtimePatchProposalRows,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
