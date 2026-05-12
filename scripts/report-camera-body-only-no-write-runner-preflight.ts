import fs from "node:fs";
import path from "node:path";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type QueryMatrixRow = {
  bodyModel: string;
  officialModelName: string;
  family: string;
  targetActiveRows: number;
  hardMinimumActiveRows: number;
  primaryQueries: string[];
  aliasQueries: string[];
  requiredTitleSignals: string[];
  requiredNegativeSignals: string[];
  comparableKey: string;
};

type ObservationDesign = {
  reportOnly: boolean;
  runtimeCatalogApply: boolean;
  runtimeApply: boolean;
  publicPromotion: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  liveDbWrites: boolean;
  liveFetchPerformed: boolean;
  runtimePatchProposal: boolean;
  metrics: Record<string, number>;
  queryMatrix: QueryMatrixRow[];
  freshnessLiveConstraints: Array<Record<string, string>>;
  saleStatusHandling: Array<Record<string, string>>;
  bodyOnlyNoLensProof: Array<Record<string, string>>;
  holdBoundaries: Array<Record<string, string | string[]>>;
  falsePositiveMetrics: Array<Record<string, string>>;
  stopConditions: string[];
};

type RunnerDesign = {
  reportOnly: boolean;
  liveDbWrites: boolean;
  liveFetchImplementation: boolean;
  runtimePatchProposal: boolean;
  metrics: Record<string, number>;
  inputSchema: Array<{ name: string; contract: string[] }>;
  outputSchema: Array<{ name: string; contract: string[] }>;
  samplingLimits: Array<Record<string, string>>;
  staleLiveInterpretation: Array<Record<string, string>>;
  bodyOnlyNoLensValidation: Array<Record<string, string>>;
  rateLimits: Array<Record<string, string>>;
  expectedMetrics: Array<Record<string, string>>;
  failureModes: Array<Record<string, string>>;
  rollbackDisablePlan: Array<Record<string, string>>;
  noWriteGuarantees: string[];
};

type OrchestrationStatus = {
  reportOnly: boolean;
  recommendedNext?: string;
  runtimePatchReadyCandidates?: number;
  sampleBackfillRequiredCandidates?: number;
  candidates?: Array<{ lane: string; status: string; blocker: string; nextAction: string; score: number }>;
};

type BoundaryAudit = {
  reportOnly: boolean;
  auditStatus: string;
  conclusion: string;
  metrics: Record<string, number>;
};

type SourceBackfill = {
  reportOnly: boolean;
  metrics: Record<string, number>;
  backfillRows: Array<{
    caseId: string;
    bodyModel: string;
    officialModelName: string;
    sourceQuality: string;
    sourceCount: number;
    enoughForInternalObservationPlanningOnly: boolean;
  }>;
};

type FixtureRow = {
  fixtureId: string;
  bodyModel: string;
  title: string;
  saleStatus: string;
  observedAtAssumption: string;
  listingUpdatedAtAssumption: string;
  expectedClassification: "active_candidate" | "manual_hold" | "hard_hold" | "schema_error";
  expectedReason: string;
};

type PreflightAuditRow = {
  check: string;
  status: "pass" | "fail";
  evidence: string;
};

type PreflightReport = {
  generatedAt: string;
  reportOnly: true;
  ownership: "camera_body_only_exact_model_no_write_dry_run_runner_preflight";
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
  metrics: Record<string, number>;
  inputFilesRead: string[];
  handoffSource: string;
  inputContract: {
    mode: string;
    acceptedInputs: string[];
    rejectedInputs: string[];
    requiredOutput: string[];
  };
  fixtureRows: FixtureRow[];
  expectedClassifications: Array<{ classification: string; definition: string; expectedCount: number }>;
  freshnessLiveObservationAssumptions: Array<{ assumption: string; passCondition: string; holdOrFailCondition: string }>;
  sourceEvidenceCoverage: Array<{ bodyModel: string; officialModelName: string; status: string; evidence: string }>;
  sourceBackfillGaps: Array<{ bodyModel: string; reason: string }>;
  rollbackNonScopeBoundaries: Array<{ boundary: string; action: string }>;
  finalPassFailAudit: PreflightAuditRow[];
};

const repoRoot = process.cwd();
const reportsDir = path.join(repoRoot, "reports");
const handoffPath = path.resolve(repoRoot, "..", "인수인계.md");

const inputPaths = {
  liveObservation: "reports/camera-body-only-live-market-observation-design-latest.json",
  runnerDesign: "reports/camera-body-only-no-write-live-market-dry-run-runner-design-latest.json",
  categoryStatus: "reports/category-orchestration-status-latest.json",
  boundaryAudit: "reports/orchestration-boundary-audit-latest.json",
  sourceBackfill: "reports/camera-body-only-source-backfill-latest.json",
};

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8")) as T;
}

function readText(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

function assertNoMutationInputs(live: ObservationDesign, runner: RunnerDesign, audit: BoundaryAudit) {
  const forbiddenFlags = [
    live.runtimeCatalogApply,
    live.runtimeApply,
    live.publicPromotion,
    live.candidatePoolPolicyWiring,
    live.productionDbMutation,
    live.directThirtyDayPlanEdit,
    live.liveDbWrites,
    live.liveFetchPerformed,
    live.runtimePatchProposal,
    runner.liveDbWrites,
    runner.liveFetchImplementation,
    runner.runtimePatchProposal,
  ];

  if (!live.reportOnly || !runner.reportOnly || !audit.reportOnly || forbiddenFlags.some(Boolean)) {
    throw new Error("Preflight inputs must remain report-only and no-mutation.");
  }
}

function assertClosedBoundaries(report: PreflightReport) {
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
  ];

  if (!report.reportOnly || forbiddenFlags.some(Boolean)) {
    throw new Error("Preflight report breached report-only/no-write boundaries.");
  }

  for (const metricName of [
    "runtimeApprovedRows",
    "publicPromotionRows",
    "candidatePoolRows",
    "runtimeApplyRows",
    "liveDbWriteRows",
    "runtimePatchProposalRows",
  ]) {
    if (report.metrics[metricName] !== 0) {
      throw new Error(`${metricName} must remain 0.`);
    }
  }

  if (report.finalPassFailAudit.some((row) => row.status === "fail")) {
    throw new Error("Preflight final audit contains fail rows.");
  }
}

function table(headers: string[], rows: Array<Array<string | number>>) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replaceAll("\n", "<br>")).join(" | ")} |`),
  ].join("\n");
}

function fixtureTitle(row: QueryMatrixRow) {
  return `${row.officialModelName} 바디`;
}

const liveObservation = readJson<ObservationDesign>(inputPaths.liveObservation);
const runnerDesign = readJson<RunnerDesign>(inputPaths.runnerDesign);
const categoryStatus = readJson<OrchestrationStatus>(inputPaths.categoryStatus);
const boundaryAudit = readJson<BoundaryAudit>(inputPaths.boundaryAudit);
const sourceBackfill = readJson<SourceBackfill>(inputPaths.sourceBackfill);
const handoffText = readText(handoffPath);

assertNoMutationInputs(liveObservation, runnerDesign, boundaryAudit);

const positiveFixtures: FixtureRow[] = liveObservation.queryMatrix.map((row) => ({
  fixtureId: `PRE-CAMERA-BODY-ONLY-ACTIVE-${row.bodyModel}`,
  bodyModel: row.bodyModel,
  title: fixtureTitle(row),
  saleStatus: "active",
  observedAtAssumption: "within_72_hours",
  listingUpdatedAtAssumption: "within_30_days_or_absent_with_fresh_observedAt",
  expectedClassification: "active_candidate",
  expectedReason: "exact body model plus title-visible body-only signal and no lens/kit/damage/buying token",
}));

const boundaryFixtures: FixtureRow[] = [
  {
    fixtureId: "PRE-CAMERA-BODY-ONLY-HOLD-KIT",
    bodyModel: "eos_r6_mark_ii",
    title: "Canon EOS R6 Mark II 바디 렌즈킷 24-105",
    saleStatus: "active",
    observedAtAssumption: "within_72_hours",
    listingUpdatedAtAssumption: "within_30_days",
    expectedClassification: "hard_hold",
    expectedReason: "lens/kit token leakage must not count as body-only/no-lens",
  },
  {
    fixtureId: "PRE-CAMERA-BODY-ONLY-HOLD-SOLD",
    bodyModel: "a5100",
    title: "Sony a5100 바디",
    saleStatus: "SOLD_OUT",
    observedAtAssumption: "within_72_hours",
    listingUpdatedAtAssumption: "within_30_days",
    expectedClassification: "hard_hold",
    expectedReason: "sold-only rows cannot count as live active evidence",
  },
  {
    fixtureId: "PRE-CAMERA-BODY-ONLY-HOLD-STALE",
    bodyModel: "eos_m6",
    title: "Canon EOS M6 바디",
    saleStatus: "active",
    observedAtAssumption: "older_than_72_hours",
    listingUpdatedAtAssumption: "older_than_30_days",
    expectedClassification: "hard_hold",
    expectedReason: "stale observation cannot satisfy live-market threshold",
  },
  {
    fixtureId: "PRE-CAMERA-BODY-ONLY-MANUAL-AMBIGUOUS",
    bodyModel: "a7c",
    title: "Sony A7C 카메라",
    saleStatus: "active",
    observedAtAssumption: "within_72_hours",
    listingUpdatedAtAssumption: "within_30_days",
    expectedClassification: "manual_hold",
    expectedReason: "exact model appears but body-only/no-lens package proof is not title-visible",
  },
  {
    fixtureId: "PRE-CAMERA-BODY-ONLY-HOLD-BUYING",
    bodyModel: "z9",
    title: "Nikon Z9 바디 삽니다",
    saleStatus: "active",
    observedAtAssumption: "within_72_hours",
    listingUpdatedAtAssumption: "within_30_days",
    expectedClassification: "hard_hold",
    expectedReason: "buying intent is outside normal-sale evidence",
  },
  {
    fixtureId: "PRE-CAMERA-BODY-ONLY-HOLD-FIXED-LENS",
    bodyModel: "x_t4",
    title: "FUJIFILM X100 바디",
    saleStatus: "active",
    observedAtAssumption: "within_72_hours",
    listingUpdatedAtAssumption: "within_30_days",
    expectedClassification: "hard_hold",
    expectedReason: "fixed-lens compact taxonomy is outside interchangeable body-only",
  },
  {
    fixtureId: "PRE-CAMERA-BODY-ONLY-SCHEMA-ERROR",
    bodyModel: "eos_6d",
    title: "",
    saleStatus: "active",
    observedAtAssumption: "missing_title",
    listingUpdatedAtAssumption: "within_30_days",
    expectedClassification: "schema_error",
    expectedReason: "title is required by DryRunListingRow contract",
  },
];

const fixtureRows = [...positiveFixtures, ...boundaryFixtures];

const sourceBackfillGaps = sourceBackfill.backfillRows
  .filter(
    (row) =>
      row.sourceQuality !== "official_only" ||
      row.sourceCount < 1 ||
      !row.enoughForInternalObservationPlanningOnly,
  )
  .map((row) => ({
    bodyModel: row.bodyModel,
    reason: "source_backfill_needed: official source coverage is incomplete or not marked ready for internal observation planning",
  }));

const sourceEvidenceCoverage = sourceBackfill.backfillRows.map((row) => ({
  bodyModel: row.bodyModel,
  officialModelName: row.officialModelName,
  status: sourceBackfillGaps.some((gap) => gap.bodyModel === row.bodyModel) ? "source_backfill_needed" : "official_evidence_available",
  evidence: `${row.sourceQuality}; sourceCount=${row.sourceCount}; enoughForInternalObservationPlanningOnly=${row.enoughForInternalObservationPlanningOnly}`,
}));

const expectedClassifications = [
  {
    classification: "active_candidate",
    definition: "Fresh active normal-sale row with exact model, body-only signal, and no lens/kit/damage/buying token.",
    expectedCount: positiveFixtures.length,
  },
  {
    classification: "manual_hold",
    definition: "Ambiguous row that cannot prove body-only/no-lens from title-visible evidence.",
    expectedCount: boundaryFixtures.filter((row) => row.expectedClassification === "manual_hold").length,
  },
  {
    classification: "hard_hold",
    definition: "Rows that are stale, sold, kit/lens/accessory, fixed-lens, damaged/parts, or buying intent.",
    expectedCount: boundaryFixtures.filter((row) => row.expectedClassification === "hard_hold").length,
  },
  {
    classification: "schema_error",
    definition: "Rows missing required contract fields and therefore not eligible for classification.",
    expectedCount: boundaryFixtures.filter((row) => row.expectedClassification === "schema_error").length,
  },
];

const freshnessLiveObservationAssumptions = [
  {
    assumption: "evaluation.now is supplied by caller and never inferred from DB/server state",
    passCondition: "observedAt is within 72 hours of evaluation.now",
    holdOrFailCondition: "missing/invalid/future observedAt becomes schema_error or hard_hold",
  },
  {
    assumption: "listingUpdatedAt is optional but useful for staleness review",
    passCondition: "listingUpdatedAt is within 30 days, or absent with fresh observedAt and active saleStatus",
    holdOrFailCondition: "older than 30 days cannot count alone toward active threshold",
  },
  {
    assumption: "saleStatus is externally supplied and normalized only in memory",
    passCondition: "active/selling is the only active threshold class",
    holdOrFailCondition: "reserved is manual_hold; sold/SOLD_OUT/deleted/unknown is hard_hold",
  },
];

const rollbackNonScopeBoundaries = [
  {
    boundary: "runtime/src/lib and parser catalog",
    action: "Non-scope. Stop and return to owner review if runtime patching is requested.",
  },
  {
    boundary: "Supabase/DB, candidate pool, public promotion",
    action: "Non-scope. No write target is accepted by the preflight or future no-write runner.",
  },
  {
    boundary: "cron/lifecycle/auth/pack UI",
    action: "Non-scope. Disable preflight continuation if scheduling, auth, or UI integration is requested.",
  },
  {
    boundary: "30일_실행계획.md and 인수인계.md",
    action: "Read-only context for this task; main agent owns decision log updates.",
  },
  {
    boundary: "source evidence gaps",
    action: "If any model is source_backfill_needed, hold that model from active-candidate fixture requirements.",
  },
];

const cameraCandidate = categoryStatus.candidates?.find((candidate) => candidate.lane === "camera_body_only_exact_model");
const handoffHasNoPublicPromotionRule = handoffText.includes("public promotion은 하지 말고") || handoffText.includes("public promotion: 없음");
const acceptedCameraLaneStatuses = new Set([
  "no_write_live_market_dry_run_runner_contract_ready",
  "supplied_input_no_write_runner_simulation_passed_report_only",
]);

const finalPassFailAudit: PreflightAuditRow[] = [
  {
    check: "input_observation_design_report_only",
    status: liveObservation.reportOnly && liveObservation.metrics.runtimeApplyRows === 0 ? "pass" : "fail",
    evidence: `reportOnly=${liveObservation.reportOnly}; runtimeApplyRows=${liveObservation.metrics.runtimeApplyRows}`,
  },
  {
    check: "runner_design_no_write_contract",
    status:
      runnerDesign.reportOnly &&
      runnerDesign.metrics.liveDbWriteRows === 0 &&
      runnerDesign.metrics.liveFetchImplementationRows === 0
        ? "pass"
        : "fail",
    evidence: `liveDbWriteRows=${runnerDesign.metrics.liveDbWriteRows}; liveFetchImplementationRows=${runnerDesign.metrics.liveFetchImplementationRows}`,
  },
  {
    check: "orchestration_status_camera_lane",
    status: cameraCandidate && acceptedCameraLaneStatuses.has(cameraCandidate.status) ? "pass" : "fail",
    evidence: cameraCandidate ? `${cameraCandidate.status}; score=${cameraCandidate.score}` : "camera lane missing",
  },
  {
    check: "boundary_audit_clean",
    status:
      boundaryAudit.auditStatus === "pass" &&
      boundaryAudit.metrics.hardFailFindings === 0 &&
      boundaryAudit.metrics.forbiddenTrueFlags === 0
        ? "pass"
        : "fail",
    evidence: `${boundaryAudit.conclusion}; hardFailFindings=${boundaryAudit.metrics.hardFailFindings}; forbiddenTrueFlags=${boundaryAudit.metrics.forbiddenTrueFlags}`,
  },
  {
    check: "official_source_coverage",
    status: sourceBackfillGaps.length === 0 ? "pass" : "fail",
    evidence: `sourceBackfilledModels=${sourceBackfill.metrics.sourceBackfilledModels}; gaps=${sourceBackfillGaps.length}`,
  },
  {
    check: "handoff_scope_alignment",
    status: handoffHasNoPublicPromotionRule ? "pass" : "fail",
    evidence: "인수인계.md keeps subagents in internal/report-only work and excludes public promotion.",
  },
];

const metrics = {
  inputReportsRead: 6,
  queryMatrixBodyModels: liveObservation.queryMatrix.length,
  plannedQueryRows: liveObservation.metrics.plannedQueryRows,
  runnerInputSchemaSections: runnerDesign.inputSchema.length,
  runnerOutputSchemaSections: runnerDesign.outputSchema.length,
  fixtureRows: fixtureRows.length,
  activeCandidateFixtures: fixtureRows.filter((row) => row.expectedClassification === "active_candidate").length,
  manualHoldFixtures: fixtureRows.filter((row) => row.expectedClassification === "manual_hold").length,
  hardHoldFixtures: fixtureRows.filter((row) => row.expectedClassification === "hard_hold").length,
  schemaErrorFixtures: fixtureRows.filter((row) => row.expectedClassification === "schema_error").length,
  sourceEvidenceRows: sourceEvidenceCoverage.length,
  sourceBackfillNeededRows: sourceBackfillGaps.length,
  preflightAuditChecks: finalPassFailAudit.length,
  preflightAuditPasses: finalPassFailAudit.filter((row) => row.status === "pass").length,
  preflightAuditFails: finalPassFailAudit.filter((row) => row.status === "fail").length,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
  liveDbWriteRows: 0,
  runtimePatchProposalRows: 0,
};

const report: PreflightReport = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  ownership: "camera_body_only_exact_model_no_write_dry_run_runner_preflight",
  category: "camera",
  lane: "body_only_exact_model",
  conclusion: "camera_body_only_no_write_runner_preflight_passed_report_only",
  runtimeCatalogApply: false,
  runtimeApply: false,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  liveDbWrites: false,
  liveFetchImplementation: false,
  runtimePatchProposal: false,
  metrics,
  inputFilesRead: [
    inputPaths.liveObservation,
    inputPaths.runnerDesign,
    inputPaths.categoryStatus,
    inputPaths.boundaryAudit,
    inputPaths.sourceBackfill,
    path.relative(repoRoot, handoffPath),
  ],
  handoffSource: handoffPath,
  inputContract: {
    mode: "no_write_evaluate_results_only",
    acceptedInputs: [
      "RunnerConfig with runId, generatedAt, evaluation.now, queryMatrix, and bounded sampling settings",
      "DryRunQueryResult arrays supplied by an external caller after collection",
      "DryRunListingRow records with listingId, title, saleStatus, observedAt, optional listing timestamps, optional dedupe hints, and optional URL",
    ],
    rejectedInputs: [
      "DB credentials or Supabase URLs",
      "fetch URLs, auth tokens, or network execution hooks",
      "runtime/src/lib paths, candidate-pool targets, public-promotion targets, cron/lifecycle hooks, auth or pack UI integration",
      "rows missing required title/saleStatus/observedAt fields",
    ],
    requiredOutput: [
      "reportOnly DryRunRunnerReport",
      "bodyModelSummaries for all 7 queryMatrix body models",
      "bounded sampledRows with active_candidate/manual_hold/hard_hold/schema_error dispositions",
      "stopConditionsTriggered and writeTargetsTouched=[]",
    ],
  },
  fixtureRows,
  expectedClassifications,
  freshnessLiveObservationAssumptions,
  sourceEvidenceCoverage,
  sourceBackfillGaps,
  rollbackNonScopeBoundaries,
  finalPassFailAudit,
};

assertClosedBoundaries(report);

const jsonPath = path.join(reportsDir, "camera-body-only-no-write-runner-preflight-latest.json");
const mdPath = path.join(reportsDir, "camera-body-only-no-write-runner-preflight-latest.md");

const markdown = [
  "# Camera Body-Only No-Write Runner Preflight",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- conclusion: ${report.conclusion}`,
  `- ownership: ${report.ownership}`,
  `- reportOnly: ${report.reportOnly}`,
  `- runtimeCatalogApply/runtimeApply/publicPromotion/candidatePoolPolicyWiring: ${report.runtimeCatalogApply}/${report.runtimeApply}/${report.publicPromotion}/${report.candidatePoolPolicyWiring}`,
  `- runtimeApproved/publicPromotion/candidatePool/runtimeApply rows: ${metrics.runtimeApprovedRows}/${metrics.publicPromotionRows}/${metrics.candidatePoolRows}/${metrics.runtimeApplyRows}`,
  `- liveDbWrites/liveFetchImplementation/runtimePatchProposal: ${report.liveDbWrites}/${report.liveFetchImplementation}/${report.runtimePatchProposal}`,
  "",
  "## Scope",
  "",
  "Implementation-prep/preflight packet for the camera body-only exact-model no-write dry-run runner. This does not implement live fetch, runtime parser changes, DB writes, candidate-pool wiring, public promotion, cron/lifecycle hooks, auth, pack UI, or 30-day-plan edits.",
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
  "## Input Contract",
  "",
  `- mode: ${report.inputContract.mode}`,
  "",
  "### Accepted Inputs",
  "",
  report.inputContract.acceptedInputs.map((item) => `- ${item}`).join("\n"),
  "",
  "### Rejected Inputs",
  "",
  report.inputContract.rejectedInputs.map((item) => `- ${item}`).join("\n"),
  "",
  "### Required Output",
  "",
  report.inputContract.requiredOutput.map((item) => `- ${item}`).join("\n"),
  "",
  "## Fixture Rows",
  "",
  table(
    ["fixtureId", "bodyModel", "saleStatus", "freshness", "expected", "reason", "title"],
    fixtureRows.map((row) => [
      row.fixtureId,
      row.bodyModel,
      row.saleStatus,
      `${row.observedAtAssumption}/${row.listingUpdatedAtAssumption}`,
      row.expectedClassification,
      row.expectedReason,
      row.title || "(missing title)",
    ]),
  ),
  "",
  "## Expected Classifications",
  "",
  table(
    ["classification", "definition", "expectedCount"],
    expectedClassifications.map((row) => [row.classification, row.definition, row.expectedCount]),
  ),
  "",
  "## Freshness / Live Observation Assumptions",
  "",
  table(
    ["assumption", "pass condition", "hold or fail condition"],
    freshnessLiveObservationAssumptions.map((row) => [
      row.assumption,
      row.passCondition,
      row.holdOrFailCondition,
    ]),
  ),
  "",
  "## Source Evidence Coverage",
  "",
  table(
    ["bodyModel", "officialModelName", "status", "evidence"],
    sourceEvidenceCoverage.map((row) => [row.bodyModel, row.officialModelName, row.status, row.evidence]),
  ),
  "",
  "## Source Backfill Gaps",
  "",
  sourceBackfillGaps.length === 0
    ? "- none"
    : sourceBackfillGaps.map((gap) => `- ${gap.bodyModel}: ${gap.reason}`).join("\n"),
  "",
  "## Rollback / Non-Scope Boundaries",
  "",
  table(
    ["boundary", "action"],
    rollbackNonScopeBoundaries.map((row) => [row.boundary, row.action]),
  ),
  "",
  "## Final Pass/Fail Audit",
  "",
  table(
    ["check", "status", "evidence"],
    finalPassFailAudit.map((row) => [row.check, row.status, row.evidence]),
  ),
  "",
].join("\n");

fs.writeFileSync(jsonPath, `${JSON.stringify(report satisfies JsonValue, null, 2)}\n`);
fs.writeFileSync(mdPath, markdown);

console.log(
  JSON.stringify(
    {
      conclusion: report.conclusion,
      fixtureRows: metrics.fixtureRows,
      activeCandidateFixtures: metrics.activeCandidateFixtures,
      sourceBackfillNeededRows: metrics.sourceBackfillNeededRows,
      preflightAuditPasses: metrics.preflightAuditPasses,
      preflightAuditFails: metrics.preflightAuditFails,
      runtimeApprovedRows: metrics.runtimeApprovedRows,
      publicPromotionRows: metrics.publicPromotionRows,
      candidatePoolRows: metrics.candidatePoolRows,
      runtimeApplyRows: metrics.runtimeApplyRows,
      liveDbWriteRows: metrics.liveDbWriteRows,
      runtimePatchProposalRows: metrics.runtimePatchProposalRows,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
