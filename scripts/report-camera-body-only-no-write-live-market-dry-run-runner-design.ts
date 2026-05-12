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
  observationUse: string;
};

type ObservationDesignInput = {
  reportOnly: boolean;
  conclusion: string;
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

type ContractSection = {
  name: string;
  contract: string[];
};

type DryRunRunnerDesign = {
  generatedAt: string;
  reportOnly: true;
  ownership: "camera_body_only_no_write_live_market_dry_run_runner_design_only";
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
  inputReport: string;
  runnerContract: {
    purpose: string;
    allowedOperation: string;
    prohibitedOperation: string[];
  };
  inputSchema: ContractSection[];
  outputSchema: ContractSection[];
  samplingLimits: Array<{ limit: string; value: string; reason: string }>;
  staleLiveInterpretation: Array<{ fieldOrSignal: string; liveInterpretation: string; staleOrHoldInterpretation: string }>;
  bodyOnlyNoLensValidation: Array<{ validation: string; passCondition: string; failDisposition: string }>;
  rateLimits: Array<{ limit: string; value: string; disableTrigger: string }>;
  expectedMetrics: Array<{ metric: string; definition: string; expectedRangeOrTarget: string }>;
  failureModes: Array<{ failureMode: string; detection: string; requiredResponse: string }>;
  rollbackDisablePlan: Array<{ step: string; action: string; ownerDecisionNeeded: string }>;
  noWriteGuarantees: string[];
};

const repoRoot = process.cwd();
const reportsDir = path.join(repoRoot, "reports");
const inputReportPath = "reports/camera-body-only-live-market-observation-design-latest.json";

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8")) as T;
}

function assertReportOnlyInput(input: ObservationDesignInput) {
  const forbiddenFlags = [
    input.runtimeCatalogApply,
    input.runtimeApply,
    input.publicPromotion,
    input.candidatePoolPolicyWiring,
    input.productionDbMutation,
    input.directThirtyDayPlanEdit,
    input.liveDbWrites,
    input.liveFetchPerformed,
    input.runtimePatchProposal,
  ];

  if (!input.reportOnly || forbiddenFlags.some(Boolean)) {
    throw new Error("Input observation design must remain report-only/no-mutation.");
  }
}

function assertClosedBoundaries(report: DryRunRunnerDesign) {
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
    throw new Error("Dry-run runner design breached no-write report-only boundaries.");
  }

  for (const metricName of [
    "runtimeApprovedRows",
    "publicPromotionRows",
    "candidatePoolRows",
    "runtimeApplyRows",
    "liveDbWriteRows",
    "liveFetchImplementationRows",
    "runtimePatchProposalRows",
  ]) {
    if (report.metrics[metricName] !== 0) {
      throw new Error(`${metricName} must stay 0.`);
    }
  }
}

function table(headers: string[], rows: Array<Array<string | number>>) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replaceAll("\n", "<br>")).join(" | ")} |`),
  ].join("\n");
}

const input = readJson<ObservationDesignInput>(inputReportPath);
assertReportOnlyInput(input);

const plannedQueryRows = input.queryMatrix.reduce(
  (sum, row) => sum + row.primaryQueries.length + row.aliasQueries.length,
  0,
);

const inputSchema: ContractSection[] = [
  {
    name: "RunnerConfig",
    contract: [
      "runId: caller-supplied opaque id for a future dry-run; never a DB id.",
      "generatedAt: ISO timestamp supplied by caller for report labeling.",
      "queryMatrix: copied from observation design; runner must not mutate query definitions.",
      "sampling.maxRowsPerQuery: hard cap for in-memory evaluation only.",
      "sampling.maxRowsPerBodyModel: hard cap after dedupe for each body model.",
      "evaluation.now: ISO timestamp used to evaluate observedAt/listingUpdatedAt freshness.",
      "mode: must be no_write_evaluate_results_only.",
    ],
  },
  {
    name: "DryRunQueryResult",
    contract: [
      "query: exact query string from the query matrix.",
      "bodyModel: expected source-backed body model id.",
      "marketplace: source marketplace label; informational only.",
      "rows: array of listing-like records already fetched by an external caller.",
      "No fetchUrl, auth token, DB connection, or persistence target is accepted by this contract.",
    ],
  },
  {
    name: "DryRunListingRow",
    contract: [
      "listingId: marketplace listing id or stable no-write identifier.",
      "title: required title text used for exact-model and body-only/no-lens validation.",
      "saleStatus: active, reserved, sold, SOLD_OUT, deleted, unknown, or marketplace-specific raw status.",
      "observedAt: ISO timestamp when external caller observed this row.",
      "listingCreatedAt/listingUpdatedAt: optional marketplace timestamps for freshness checks.",
      "sellerHash/imageGroupHash: optional no-write dedupe hints; no raw account mutation.",
      "url: optional public listing URL used only for manual review context.",
    ],
  },
];

const outputSchema: ContractSection[] = [
  {
    name: "DryRunRunnerReport",
    contract: [
      "reportOnly: true.",
      "runId: copied from RunnerConfig.",
      "metrics: aggregate count fields only; no runtime/public/candidate rows can be positive.",
      "bodyModelSummaries: one summary per queryMatrix bodyModel.",
      "sampledRows: bounded in-memory review rows with disposition active_candidate, manual_hold, or hard_hold.",
      "stopConditionsTriggered: array of stop-condition ids and evidence snippets.",
      "writeTargetsTouched: must be empty.",
    ],
  },
  {
    name: "BodyModelSummary",
    contract: [
      "bodyModel and comparableKey copied from queryMatrix.",
      "activeAcceptedRows: count after saleStatus, freshness, dedupe, exact model, body-only, and no-lens validation.",
      "manualHoldRows and hardHoldRows: count rows that cannot be active evidence.",
      "meetsHardMinimumActiveRows: activeAcceptedRows >= hardMinimumActiveRows.",
      "meetsTargetActiveRows: activeAcceptedRows >= targetActiveRows.",
      "falsePositiveRateEstimate: manual review estimate from sampled rows, never an auto-approval.",
    ],
  },
  {
    name: "SampledRowDisposition",
    contract: [
      "active_candidate: active saleStatus, fresh observedAt, exact body model, body-only signal, and no lens/kit/damage/buying token.",
      "manual_hold: ambiguous model/status/freshness or reserved/negotiating status.",
      "hard_hold: sold/deleted/stale/kit/lens/accessory/fixed-lens/damaged/buying rows.",
      "dispositionReason: compact reason code for auditability.",
    ],
  },
];

const samplingLimits = [
  {
    limit: "maxRowsPerQuery",
    value: "20 rows",
    reason: "Keeps future dry-run review bounded while preserving top-query recall.",
  },
  {
    limit: "maxRowsPerBodyModel",
    value: "60 deduped rows",
    reason: "Prevents high-volume aliases from drowning smaller body models.",
  },
  {
    limit: "manualReviewSample",
    value: "minimum 10 rows or all rows if fewer than 10 per body model",
    reason: "Provides a consistent false-positive estimate without requiring full corpus review.",
  },
  {
    limit: "minimumActiveRows",
    value: `${input.metrics.hardMinimumActiveRowsPerBodyModel ?? 2} active accepted rows per body model; lane hard minimum ${
      input.metrics.laneHardMinimumActiveRows ?? input.queryMatrix.length * 2
    }`,
    reason: "Matches the upstream observation design threshold.",
  },
];

const staleLiveInterpretation = [
  {
    fieldOrSignal: "observedAt",
    liveInterpretation: "Within 72 hours of evaluation.now.",
    staleOrHoldInterpretation: "Older than 72 hours, missing, invalid, or in the future beyond clock-skew tolerance.",
  },
  {
    fieldOrSignal: "listingUpdatedAt",
    liveInterpretation: "Within 30 days when available, or absent only if observedAt is fresh and saleStatus is active.",
    staleOrHoldInterpretation: "Older than 30 days can support recall review but cannot satisfy active threshold by itself.",
  },
  {
    fieldOrSignal: "saleStatus",
    liveInterpretation: "active/selling status only.",
    staleOrHoldInterpretation: "reserved is manual_hold; SOLD_OUT/sold/deleted/unknown is hard_hold for active counts.",
  },
  {
    fieldOrSignal: "dedupe identity",
    liveInterpretation: "Unique listingId, or unique sellerHash/title/imageGroupHash when available.",
    staleOrHoldInterpretation: "Duplicate rows are collapsed; duplicates beyond the first cannot count toward thresholds.",
  },
];

const bodyOnlyNoLensValidation = [
  {
    validation: "Exact-model title match",
    passCondition: "Title contains the body model or accepted alias from the query matrix.",
    failDisposition: "manual_hold for near-family ambiguity; hard_hold for unrelated model.",
  },
  {
    validation: "Body-only positive signal",
    passCondition: "Title contains 바디, 바디만, body, body only, or 본체.",
    failDisposition: "manual_hold if exact model appears but package axis is not title-visible.",
  },
  {
    validation: "No lens/kit/package leak",
    passCondition: "Title has no lens/kit/bundle/focal-length/named-lens token.",
    failDisposition: "hard_hold because body+kit and lens bundles are outside this lane.",
  },
  {
    validation: "Normal-sale listing",
    passCondition: "Title and saleStatus do not indicate buying intent, parts, damage, repair, sold-only, or deleted listing.",
    failDisposition: "hard_hold for active threshold; may remain in negative calibration sample.",
  },
];

const rateLimits = [
  {
    limit: "runner network behavior",
    value: "0 network calls",
    disableTrigger: "Disable if any future implementation attempts fetch/http/db calls inside the evaluator.",
  },
  {
    limit: "external caller pacing recommendation",
    value: "At most 1 marketplace query per second and at most 48 planned queries per dry-run batch.",
    disableTrigger: "Disable future dry-run execution if marketplace throttling, captcha, auth prompts, or policy errors appear.",
  },
  {
    limit: "memory-only row volume",
    value: "At most 960 raw rows per dry-run input batch before per-model sampling.",
    disableTrigger: "Disable or split batch if input exceeds cap.",
  },
  {
    limit: "artifact writes",
    value: "Allowed only to write a local report artifact in a future report-only runner, never DB/runtime/candidate/public paths.",
    disableTrigger: "Disable if write target is outside reports/ or if runtime/public/candidate paths are requested.",
  },
];

const expectedMetrics = [
  {
    metric: "inputQueryRows",
    definition: "Count of query strings evaluated from the query matrix.",
    expectedRangeOrTarget: String(plannedQueryRows),
  },
  {
    metric: "rawRowsEvaluated",
    definition: "Rows supplied by external caller before dedupe and sampling.",
    expectedRangeOrTarget: "0 to 960; 0 is valid for contract-only/no-live-fetch runs.",
  },
  {
    metric: "activeAcceptedRows",
    definition: "Rows passing saleStatus, freshness, exact-model, body-only, no-lens, and normal-sale checks.",
    expectedRangeOrTarget: "Target 21 lane rows; hard minimum 14 across 7 models in a future actual dry-run.",
  },
  {
    metric: "modelHardMinimumPassCount",
    definition: "Number of body models with at least 2 active accepted rows.",
    expectedRangeOrTarget: "Hold lane if fewer than 5 of 7 models pass.",
  },
  {
    metric: "sampledFalsePositiveRate",
    definition: "Manual-review false-positive estimate among sampled active candidates.",
    expectedRangeOrTarget: "<= 5%; stop if exceeded overall or across any two body models.",
  },
  {
    metric: "kitOrLensLeakageRows",
    definition: "Counted active rows with lens/kit/bundle tokens.",
    expectedRangeOrTarget: "0.",
  },
  {
    metric: "writeTargetsTouched",
    definition: "Number of DB/runtime/candidate/public write targets touched.",
    expectedRangeOrTarget: "0 always.",
  },
];

const failureModes = [
  {
    failureMode: "Input schema drift",
    detection: "Missing queryMatrix, bodyModel, queries, saleStatus, observedAt, or title fields in supplied dry-run data.",
    requiredResponse: "Abort evaluation and emit schema_error; do not coerce unknown shapes into active evidence.",
  },
  {
    failureMode: "Marketplace stale/cache ambiguity",
    detection: "observedAt/listingUpdatedAt absent, stale, or inconsistent with saleStatus.",
    requiredResponse: "Mark affected rows manual_hold or hard_hold and keep active threshold counts unchanged.",
  },
  {
    failureMode: "Alias collision",
    detection: "Title can map to multiple generations or nearby models such as A7C/A7C II or R6/R6 Mark II.",
    requiredResponse: "Manual hold the row and add modelAmbiguityRows metric.",
  },
  {
    failureMode: "Kit/lens leakage",
    detection: "Any active candidate contains lens, kit, focal length, or bundle signal.",
    requiredResponse: "Hard hold the row and trigger stop condition if counted as active.",
  },
  {
    failureMode: "Unexpected write or fetch behavior",
    detection: "Evaluator receives credentials, DB URL, fetch target, write path outside reports/, or runtime mutation request.",
    requiredResponse: "Abort immediately; report disabled_no_write_boundary_breach.",
  },
  {
    failureMode: "Rate/throttle pressure",
    detection: "External caller reports throttling, captcha, auth challenge, or marketplace policy error.",
    requiredResponse: "Disable further dry-run batches until owner approves a compliant collection method.",
  },
];

const rollbackDisablePlan = [
  {
    step: "Pre-run gate",
    action: "Require mode=no_write_evaluate_results_only and reject any config containing DB credentials, runtime paths, or fetch targets.",
    ownerDecisionNeeded: "No, this is a hard safety gate.",
  },
  {
    step: "Runtime disable switch",
    action: "Future implementation should support DRY_RUN_ENABLED=false to skip evaluation and emit disabled status only.",
    ownerDecisionNeeded: "Yes, before enabling any scheduled or repeated execution.",
  },
  {
    step: "Failure rollback",
    action: "If false-positive, stale-status, or kit leakage stop conditions fire, archive local report artifacts and keep all models in hold.",
    ownerDecisionNeeded: "Yes, before another dry-run batch is attempted.",
  },
  {
    step: "Boundary breach response",
    action: "If any write/fetch/runtime mutation path is introduced, remove the runner from orchestration and return to report-only design review.",
    ownerDecisionNeeded: "Yes, mandatory.",
  },
];

const noWriteGuarantees = [
  "This artifact designs a runner contract only; it does not fetch marketplace data.",
  "The future evaluator accepts already-collected rows as input and writes no DB, runtime, candidate-pool, or public-promotion rows.",
  "Any future local artifact write must be confined to reports/ and remain report-only.",
  "The contract rejects credentials, DB URLs, runtime write paths, fetch URLs, and mutation targets.",
  "All runtimeApproved/publicPromotion/candidatePool/runtimeApply metrics remain 0.",
];

const metrics = {
  inputQueryMatrixBodyModels: input.queryMatrix.length,
  inputPlannedQueryRows: plannedQueryRows,
  inputTargetActiveRowsPerBodyModel: input.metrics.targetActiveRowsPerBodyModel ?? 3,
  inputHardMinimumActiveRowsPerBodyModel: input.metrics.hardMinimumActiveRowsPerBodyModel ?? 2,
  inputLaneTargetActiveRows: input.metrics.laneTargetActiveRows ?? input.queryMatrix.length * 3,
  inputLaneHardMinimumActiveRows: input.metrics.laneHardMinimumActiveRows ?? input.queryMatrix.length * 2,
  inputSchemaSections: inputSchema.length,
  outputSchemaSections: outputSchema.length,
  samplingLimits: samplingLimits.length,
  staleLiveInterpretationRules: staleLiveInterpretation.length,
  bodyOnlyNoLensValidationRules: bodyOnlyNoLensValidation.length,
  rateLimits: rateLimits.length,
  expectedMetrics: expectedMetrics.length,
  failureModes: failureModes.length,
  rollbackDisableSteps: rollbackDisablePlan.length,
  noWriteGuarantees: noWriteGuarantees.length,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
  liveDbWriteRows: 0,
  liveFetchImplementationRows: 0,
  runtimePatchProposalRows: 0,
};

const report: DryRunRunnerDesign = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  ownership: "camera_body_only_no_write_live_market_dry_run_runner_design_only",
  category: "camera",
  lane: "body_only_exact_model",
  conclusion: "camera_body_only_no_write_live_market_dry_run_runner_contract_ready_report_only",
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
  inputReport: inputReportPath,
  runnerContract: {
    purpose:
      "Define a no-write evaluator contract for future externally supplied live-market query results from the camera body-only exact-model matrix.",
    allowedOperation:
      "Evaluate in-memory rows against freshness, saleStatus, exact-model, body-only/no-lens, sampling, and stop-condition rules.",
    prohibitedOperation: [
      "No marketplace fetching inside the runner.",
      "No DB writes or Supabase access.",
      "No runtime/src/lib edits or runtime catalog mutation.",
      "No candidate pool wiring.",
      "No public promotion.",
      "No cron/lifecycle scheduling.",
    ],
  },
  inputSchema,
  outputSchema,
  samplingLimits,
  staleLiveInterpretation,
  bodyOnlyNoLensValidation,
  rateLimits,
  expectedMetrics,
  failureModes,
  rollbackDisablePlan,
  noWriteGuarantees,
};

assertClosedBoundaries(report);

const jsonPath = path.join(reportsDir, "camera-body-only-no-write-live-market-dry-run-runner-design-latest.json");
const mdPath = path.join(reportsDir, "camera-body-only-no-write-live-market-dry-run-runner-design-latest.md");

const markdown = [
  "# Camera Body-Only No-Write Live-Market Dry-Run Runner Design",
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
  "Report-only runner contract for a future no-write evaluation of externally supplied live-market rows. This artifact does not implement live fetching, DB writes, runtime patching, candidate-pool wiring, public promotion, or scheduling.",
  "",
  "## Input Report",
  "",
  `- ${report.inputReport}`,
  "",
  "## Metrics",
  "",
  table(
    ["metric", "value"],
    Object.entries(metrics).map(([key, value]) => [key, value]),
  ),
  "",
  "## Runner Contract",
  "",
  `- purpose: ${report.runnerContract.purpose}`,
  `- allowedOperation: ${report.runnerContract.allowedOperation}`,
  ...report.runnerContract.prohibitedOperation.map((operation) => `- prohibited: ${operation}`),
  "",
  "## Input Schema",
  "",
  table(
    ["section", "contract"],
    inputSchema.map((section) => [section.name, section.contract.join("<br>")]),
  ),
  "",
  "## Output Schema",
  "",
  table(
    ["section", "contract"],
    outputSchema.map((section) => [section.name, section.contract.join("<br>")]),
  ),
  "",
  "## Sampling Limits",
  "",
  table(
    ["limit", "value", "reason"],
    samplingLimits.map((row) => [row.limit, row.value, row.reason]),
  ),
  "",
  "## Stale / Live Interpretation",
  "",
  table(
    ["field or signal", "live interpretation", "stale or hold interpretation"],
    staleLiveInterpretation.map((row) => [row.fieldOrSignal, row.liveInterpretation, row.staleOrHoldInterpretation]),
  ),
  "",
  "## Body-Only / No-Lens Validation",
  "",
  table(
    ["validation", "pass condition", "fail disposition"],
    bodyOnlyNoLensValidation.map((row) => [row.validation, row.passCondition, row.failDisposition]),
  ),
  "",
  "## Rate Limits",
  "",
  table(
    ["limit", "value", "disable trigger"],
    rateLimits.map((row) => [row.limit, row.value, row.disableTrigger]),
  ),
  "",
  "## Expected Metrics",
  "",
  table(
    ["metric", "definition", "expected range or target"],
    expectedMetrics.map((row) => [row.metric, row.definition, row.expectedRangeOrTarget]),
  ),
  "",
  "## Failure Modes",
  "",
  table(
    ["failure mode", "detection", "required response"],
    failureModes.map((row) => [row.failureMode, row.detection, row.requiredResponse]),
  ),
  "",
  "## Rollback / Disable Plan",
  "",
  table(
    ["step", "action", "owner decision needed"],
    rollbackDisablePlan.map((row) => [row.step, row.action, row.ownerDecisionNeeded]),
  ),
  "",
  "## No-Write Guarantees",
  "",
  noWriteGuarantees.map((guarantee) => `- ${guarantee}`).join("\n"),
  "",
].join("\n");

fs.writeFileSync(jsonPath, `${JSON.stringify(report satisfies JsonValue, null, 2)}\n`);
fs.writeFileSync(mdPath, markdown);

console.log(
  JSON.stringify(
    {
      conclusion: report.conclusion,
      inputQueryMatrixBodyModels: metrics.inputQueryMatrixBodyModels,
      inputPlannedQueryRows: metrics.inputPlannedQueryRows,
      inputSchemaSections: metrics.inputSchemaSections,
      outputSchemaSections: metrics.outputSchemaSections,
      failureModes: metrics.failureModes,
      rollbackDisableSteps: metrics.rollbackDisableSteps,
      runtimeApprovedRows: metrics.runtimeApprovedRows,
      publicPromotionRows: metrics.publicPromotionRows,
      candidatePoolRows: metrics.candidatePoolRows,
      runtimeApplyRows: metrics.runtimeApplyRows,
      liveDbWriteRows: metrics.liveDbWriteRows,
      liveFetchImplementationRows: metrics.liveFetchImplementationRows,
      runtimePatchProposalRows: metrics.runtimePatchProposalRows,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
