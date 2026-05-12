import fs from "node:fs";
import path from "node:path";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type SourceBackfillRow = {
  caseId: string;
  pid: string;
  title: string;
  family: string;
  bodyModel: string;
  packageAxis: string;
  lensAxis: string;
  comparableKey: string;
  officialModelName: string;
  aliases: string[];
  releaseOrLaunchYear?: number;
  currentOrDiscontinuedStatus?: string;
  mountOrSystem?: string;
  sourceQuality: string;
  sourceCount: number;
  enoughForInternalObservationPlanningOnly: boolean;
};

type SourceBackfillReport = {
  reportOnly: boolean;
  conclusion: string;
  runtimeCatalogApply: boolean;
  runtimeApply: boolean;
  publicPromotion: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  metrics: Record<string, number>;
  backfillRows: SourceBackfillRow[];
};

type SublanePlanReport = {
  reportOnly: boolean;
  conclusion: string;
  metrics: Record<string, number>;
  positiveRows: Array<{
    caseId: string;
    pid: string;
    title: string;
    family: string;
    bodyModel: string;
    packageAxis: string;
    lensAxis: string;
    comparableKey: string;
  }>;
  heldBoundaries: Array<{
    id: string;
    title: string;
    requirements: string[];
  }>;
  observationMetrics: Array<{
    metric: string;
    target: string;
    source: string;
    rollbackOrHoldTrigger: string;
  }>;
};

type QueryMatrixRow = {
  bodyModel: string;
  officialModelName: string;
  family: string;
  releaseOrLaunchYear?: number;
  statusEvidence?: string;
  targetActiveRows: number;
  hardMinimumActiveRows: number;
  primaryQueries: string[];
  aliasQueries: string[];
  requiredTitleSignals: string[];
  requiredNegativeSignals: string[];
  comparableKey: string;
  observationUse: "internal_observation_planning_only";
};

type ObservationDesign = {
  generatedAt: string;
  reportOnly: true;
  ownership: "camera_body_only_exact_model_internal_live_market_observation_design_only";
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
  liveFetchPerformed: false;
  runtimePatchProposal: false;
  metrics: Record<string, number>;
  inputReports: string[];
  queryMatrix: QueryMatrixRow[];
  freshnessLiveConstraints: Array<{ rule: string; requirement: string; holdTrigger: string }>;
  saleStatusHandling: Array<{ saleStatusClass: string; observationUse: string; handling: string }>;
  bodyOnlyNoLensProof: Array<{ proofType: string; requirement: string; rejectIf: string }>;
  holdBoundaries: Array<{ boundary: string; handling: string; examplesOrSignals: string[] }>;
  falsePositiveMetrics: Array<{ metric: string; target: string; stopOrHoldTrigger: string }>;
  stopConditions: string[];
  internalObservationPlanningOnly: {
    ready: boolean;
    readyForRuntimeApplyNow: false;
    reason: string;
  };
};

const repoRoot = process.cwd();
const reportsDir = path.join(repoRoot, "reports");

const sourceBackfillPath = "reports/camera-body-only-source-backfill-latest.json";
const sublanePlanPath = "reports/camera-body-only-internal-sublane-plan-latest.json";

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8")) as T;
}

function assertReportOnlyInputs(sourceBackfill: SourceBackfillReport, sublanePlan: SublanePlanReport) {
  if (!sourceBackfill.reportOnly || !sublanePlan.reportOnly) {
    throw new Error("Input reports must be report-only.");
  }

  const closedFlags = [
    sourceBackfill.runtimeCatalogApply,
    sourceBackfill.runtimeApply,
    sourceBackfill.publicPromotion,
    sourceBackfill.candidatePoolPolicyWiring,
    sourceBackfill.productionDbMutation,
    sourceBackfill.directThirtyDayPlanEdit,
  ];

  if (closedFlags.some(Boolean)) {
    throw new Error("Source backfill input has a mutation/promotion flag enabled.");
  }
}

function assertClosedBoundaries(report: ObservationDesign) {
  const expectedFalse = [
    report.runtimeCatalogApply,
    report.runtimeApply,
    report.publicPromotion,
    report.candidatePoolPolicyWiring,
    report.productionDbMutation,
    report.directThirtyDayPlanEdit,
    report.liveDbWrites,
    report.liveFetchPerformed,
    report.runtimePatchProposal,
  ];

  if (!report.reportOnly || expectedFalse.some(Boolean)) {
    throw new Error("Observation design breached report-only boundaries.");
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
}

function compactAliases(row: SourceBackfillRow) {
  return Array.from(new Set([row.officialModelName, ...row.aliases])).filter(Boolean);
}

function queryTerms(row: SourceBackfillRow) {
  const aliases = compactAliases(row);
  const bodyAliases = aliases.slice(0, 4);
  return {
    primaryQueries: [
      `${row.officialModelName} 바디`,
      `${row.officialModelName} 바디만`,
      `${row.officialModelName} body only`,
    ],
    aliasQueries: bodyAliases.map((alias) => `${alias} 바디`).slice(0, 4),
  };
}

function buildQueryMatrix(rows: SourceBackfillRow[]): QueryMatrixRow[] {
  return rows.map((row) => {
    const { primaryQueries, aliasQueries } = queryTerms(row);
    return {
      bodyModel: row.bodyModel,
      officialModelName: row.officialModelName,
      family: row.family,
      releaseOrLaunchYear: row.releaseOrLaunchYear,
      statusEvidence: row.currentOrDiscontinuedStatus,
      targetActiveRows: 3,
      hardMinimumActiveRows: 2,
      primaryQueries,
      aliasQueries,
      requiredTitleSignals: [
        "title-visible exact body model or accepted alias",
        "title-visible body-only signal: 바디, 바디만, body, body only, or 본체",
        "no title-visible lens/kit/bundle token",
      ],
      requiredNegativeSignals: [
        "렌즈",
        "렌즈킷",
        "kit",
        "번들",
        "세트",
        "악세사리",
        "부품",
        "고장",
        "삽니다",
        "구매",
        "예약중",
        "판매완료",
      ],
      comparableKey: `camera|${row.family}|${row.bodyModel}|body_only|no_lens`,
      observationUse: "internal_observation_planning_only",
    };
  });
}

function table(headers: string[], rows: Array<Array<string | number>>) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replaceAll("\n", "<br>")).join(" | ")} |`),
  ].join("\n");
}

const sourceBackfill = readJson<SourceBackfillReport>(sourceBackfillPath);
const sublanePlan = readJson<SublanePlanReport>(sublanePlanPath);
assertReportOnlyInputs(sourceBackfill, sublanePlan);

const queryMatrix = buildQueryMatrix(sourceBackfill.backfillRows);

const freshnessLiveConstraints = [
  {
    rule: "Observation window",
    requirement: "Use only listings observed in a future dry-run within the last 72 hours for live active-row counts.",
    holdTrigger: "Hold the body model if all matching rows are stale, cached, or copied from previous snapshots.",
  },
  {
    rule: "Listing recency",
    requirement: "Prefer rows created or materially updated within 30 days; older rows can support recall review but not active threshold counts.",
    holdTrigger: "Hold if the model reaches threshold only through rows older than 30 days.",
  },
  {
    rule: "Active-market proof",
    requirement: "Each counted row must have an active saleStatus and a current listing URL/id observed during the dry-run.",
    holdTrigger: "Hold if saleStatus is missing, SOLD_OUT, deleted, hidden, or marketplace-unavailable.",
  },
  {
    rule: "Deduplication",
    requirement: "Count only one row per marketplace listing id and collapse obvious reposts by same seller/title/image group during manual review.",
    holdTrigger: "Hold if duplicates provide more than one active row for a body model.",
  },
];

const saleStatusHandling = [
  {
    saleStatusClass: "active/selling",
    observationUse: "active threshold candidate",
    handling: "Can count only after title-visible exact-model and body-only/no-lens proof pass.",
  },
  {
    saleStatusClass: "reserved/negotiating",
    observationUse: "manual calibration only",
    handling: "Do not count toward active threshold unless product policy explicitly treats it as live sellable inventory in a later owner decision.",
  },
  {
    saleStatusClass: "SOLD_OUT/sold/completed",
    observationUse: "hold calibration only",
    handling: "Do not count as live market evidence; use only to measure false positives and alias recall.",
  },
  {
    saleStatusClass: "missing/deleted/unknown",
    observationUse: "hard hold",
    handling: "Exclude from active counts and require manual status inspection before reuse.",
  },
];

const bodyOnlyNoLensProof = [
  {
    proofType: "exact body model",
    requirement: "Title must contain the exact source-backed body model or one accepted alias for that model.",
    rejectIf: "Only brand/family appears, generation suffix is missing, or a nearby different model is possible.",
  },
  {
    proofType: "body-only package",
    requirement: "Title must contain a body-only signal such as 바디, 바디만, body, body only, or 본체.",
    rejectIf: "Body-only evidence exists only in description, image, or inferred package context.",
  },
  {
    proofType: "no lens included",
    requirement: "Title must not contain lens, focal length, kit, bundle, double-zoom, or named lens model tokens.",
    rejectIf: "Any title-visible lens/kit/bundle token appears, even if a body token also appears.",
  },
  {
    proofType: "normal sale",
    requirement: "Listing must be a normal sell listing, not buying intent, sold-only archive, repair, damaged, or parts.",
    rejectIf: "삽니다, 구매, 판매완료, 고장, 수리필요, 부품용, 액정파손, or similar risk terms appear.",
  },
];

const holdBoundaries = [
  {
    boundary: "body+kit/lens bundle",
    handling: "Hold even when exact body model is present; this sublane observes body-only/no-lens only.",
    examplesOrSignals: ["렌즈", "렌즈킷", "kit", "번들", "세트", "24-105", "28-60", "15-45", "18-150"],
  },
  {
    boundary: "lens-only/accessory",
    handling: "Hard hold; mount compatibility is not camera body evidence.",
    examplesOrSignals: ["렌즈만", "마운트 어댑터", "배터리", "그립", "케이지", "스트랩", "가방"],
  },
  {
    boundary: "fixed-lens compact",
    handling: "Hard hold for separate taxonomy; do not mix with interchangeable body-only.",
    examplesOrSignals: ["G7X", "Cyber-shot", "RX100", "Ricoh GR", "X100", "X70"],
  },
  {
    boundary: "damaged/parts/repair",
    handling: "Hard hold; not normal live market comparable evidence.",
    examplesOrSignals: ["고장", "수리필요", "부품용", "파손", "침수", "먹통"],
  },
  {
    boundary: "buying/sold-only",
    handling: "Hard hold for active threshold; may be sampled only as negative calibration.",
    examplesOrSignals: ["삽니다", "구매합니다", "판매완료", "예약완료", "SOLD_OUT"],
  },
];

const falsePositiveMetrics = [
  {
    metric: "sampledFalsePositiveRate",
    target: "<= 5% on manually reviewed active candidates after query collection",
    stopOrHoldTrigger: "Stop if reviewed false positives exceed 5% overall or for any two body models.",
  },
  {
    metric: "kitOrLensLeakageRows",
    target: "0 counted rows with title-visible lens/kit/bundle tokens",
    stopOrHoldTrigger: "Stop immediately if any kit/lens bundle is counted as body-only.",
  },
  {
    metric: "soldOrInactiveLeakageRows",
    target: "0 SOLD_OUT/reserved/deleted rows counted toward active thresholds",
    stopOrHoldTrigger: "Stop if saleStatus handling cannot separate active vs inactive rows.",
  },
  {
    metric: "modelAmbiguityRows",
    target: "0 counted rows where generation/model suffix is ambiguous",
    stopOrHoldTrigger: "Stop if aliases cause confusion across R6/R6 Mark II, A7C/A7C II, EOS M/M6, X-T/X-T4, or Z/Z9.",
  },
  {
    metric: "minimumActiveRowsPerBodyModel",
    target: "target 3 active rows per body model; hard minimum 2 before model-level observation summary",
    stopOrHoldTrigger: "Hold individual body models below 2 active rows; hold the lane if fewer than 5 of 7 models meet hard minimum.",
  },
];

const stopConditions = [
  "Any requested change would edit runtime/src/lib, Supabase/schema, cron/lifecycle, candidate pool, pack UI, auth, public promotion, or 30일_실행계획.md.",
  "Any live-market execution path would write to DB, candidate pool, public promotion, or runtime catalogs.",
  "Any proposal asks for runtime parser/catalog patching before a separate owner decision.",
  "Fewer than 5 of 7 source-backed body models reach 2 active normal-sale body-only/no-lens rows in a future dry-run.",
  "Manual review finds sampled false-positive rate above 5% or any counted kit/lens leakage.",
  "saleStatus cannot reliably distinguish active listings from SOLD_OUT/reserved/deleted rows.",
  "Exact-model aliases collide with newer/older generations often enough to require model-family redesign.",
];

const metrics = {
  inputSourceBackfilledModels: sourceBackfill.metrics.sourceBackfilledModels ?? sourceBackfill.backfillRows.length,
  inputPositiveRows: sublanePlan.metrics.sourceBodyOnlyRows ?? sublanePlan.positiveRows.length,
  queryMatrixBodyModels: queryMatrix.length,
  plannedQueryRows: queryMatrix.reduce((sum, row) => sum + row.primaryQueries.length + row.aliasQueries.length, 0),
  targetActiveRowsPerBodyModel: 3,
  hardMinimumActiveRowsPerBodyModel: 2,
  laneTargetActiveRows: queryMatrix.length * 3,
  laneHardMinimumActiveRows: queryMatrix.length * 2,
  freshnessRules: freshnessLiveConstraints.length,
  saleStatusHandlingRules: saleStatusHandling.length,
  bodyOnlyNoLensProofRules: bodyOnlyNoLensProof.length,
  holdBoundaryGroups: holdBoundaries.length,
  falsePositiveMetrics: falsePositiveMetrics.length,
  stopConditions: stopConditions.length,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
  liveDbWriteRows: 0,
  runtimePatchProposalRows: 0,
};

const report: ObservationDesign = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  ownership: "camera_body_only_exact_model_internal_live_market_observation_design_only",
  category: "camera",
  lane: "body_only_exact_model",
  conclusion: "camera_body_only_live_market_observation_design_ready_report_only_no_runtime_or_db_mutation",
  runtimeCatalogApply: false,
  runtimeApply: false,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  liveDbWrites: false,
  liveFetchPerformed: false,
  runtimePatchProposal: false,
  metrics,
  inputReports: [sourceBackfillPath, sublanePlanPath],
  queryMatrix,
  freshnessLiveConstraints,
  saleStatusHandling,
  bodyOnlyNoLensProof,
  holdBoundaries,
  falsePositiveMetrics,
  stopConditions,
  internalObservationPlanningOnly: {
    ready: true,
    readyForRuntimeApplyNow: false,
    reason:
      "The design is ready for a future internal live-market observation dry-run only. It defines queries, active-row thresholds, saleStatus handling, false-positive metrics, and stop conditions without live writes or runtime patching.",
  },
};

assertClosedBoundaries(report);

const jsonPath = path.join(reportsDir, "camera-body-only-live-market-observation-design-latest.json");
const mdPath = path.join(reportsDir, "camera-body-only-live-market-observation-design-latest.md");

const markdown = [
  "# Camera Body-Only Exact Model Live-Market Observation Design",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- conclusion: ${report.conclusion}`,
  `- ownership: ${report.ownership}`,
  `- reportOnly: ${report.reportOnly}`,
  `- runtimeCatalogApply/runtimeApply/publicPromotion/candidatePoolPolicyWiring: ${report.runtimeCatalogApply}/${report.runtimeApply}/${report.publicPromotion}/${report.candidatePoolPolicyWiring}`,
  `- runtimeApproved/publicPromotion/candidatePool/runtimeApply rows: ${metrics.runtimeApprovedRows}/${metrics.publicPromotionRows}/${metrics.candidatePoolRows}/${metrics.runtimeApplyRows}`,
  `- liveDbWrites/liveFetchPerformed/runtimePatchProposal: ${report.liveDbWrites}/${report.liveFetchPerformed}/${report.runtimePatchProposal}`,
  "",
  "## Scope",
  "",
  "Report-only design for a future internal live-market observation dry-run of the interchangeable camera body-only exact-model sublane. This artifact does not perform live fetching, DB writes, runtime patching, candidate-pool wiring, or public promotion.",
  "",
  "## Inputs",
  "",
  report.inputReports.map((input) => `- ${input}`).join("\n"),
  "",
  "## Metrics",
  "",
  table(
    ["metric", "value"],
    Object.entries(metrics).map(([key, value]) => [key, value]),
  ),
  "",
  "## Target Query Matrix",
  "",
  table(
    ["bodyModel", "officialModelName", "target active", "hard minimum", "primary queries", "alias queries"],
    queryMatrix.map((row) => [
      row.bodyModel,
      row.officialModelName,
      row.targetActiveRows,
      row.hardMinimumActiveRows,
      row.primaryQueries.join("<br>"),
      row.aliasQueries.join("<br>"),
    ]),
  ),
  "",
  "## Freshness / Live Constraints",
  "",
  table(
    ["rule", "requirement", "hold trigger"],
    freshnessLiveConstraints.map((row) => [row.rule, row.requirement, row.holdTrigger]),
  ),
  "",
  "## saleStatus Handling",
  "",
  table(
    ["saleStatus class", "observation use", "handling"],
    saleStatusHandling.map((row) => [row.saleStatusClass, row.observationUse, row.handling]),
  ),
  "",
  "## Body-Only / No-Lens Proof",
  "",
  table(
    ["proof type", "requirement", "reject if"],
    bodyOnlyNoLensProof.map((row) => [row.proofType, row.requirement, row.rejectIf]),
  ),
  "",
  "## Hold Boundaries",
  "",
  table(
    ["boundary", "handling", "signals"],
    holdBoundaries.map((row) => [row.boundary, row.handling, row.examplesOrSignals.join(", ")]),
  ),
  "",
  "## False-Positive Metrics",
  "",
  table(
    ["metric", "target", "stop or hold trigger"],
    falsePositiveMetrics.map((row) => [row.metric, row.target, row.stopOrHoldTrigger]),
  ),
  "",
  "## Stop Conditions",
  "",
  stopConditions.map((condition) => `- ${condition}`).join("\n"),
  "",
  "## Internal Observation Planning Result",
  "",
  `- readyForInternalObservationPlanningOnly: ${report.internalObservationPlanningOnly.ready}`,
  `- readyForRuntimeApplyNow: ${report.internalObservationPlanningOnly.readyForRuntimeApplyNow}`,
  `- reason: ${report.internalObservationPlanningOnly.reason}`,
  "",
].join("\n");

fs.writeFileSync(jsonPath, `${JSON.stringify(report satisfies JsonValue, null, 2)}\n`);
fs.writeFileSync(mdPath, markdown);

console.log(
  JSON.stringify(
    {
      conclusion: report.conclusion,
      queryMatrixBodyModels: metrics.queryMatrixBodyModels,
      plannedQueryRows: metrics.plannedQueryRows,
      laneTargetActiveRows: metrics.laneTargetActiveRows,
      laneHardMinimumActiveRows: metrics.laneHardMinimumActiveRows,
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
