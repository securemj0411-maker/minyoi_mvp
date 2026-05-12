import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Boundary = {
  reportOnly: boolean;
  runtimeCatalogApply: boolean;
  runtimeApply: boolean;
  publicPromotion: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  runtimeApprovedRows: number;
  publicPromotionRows: number;
  candidatePoolRows: number;
  runtimeApplyRows: number;
  liveFetchPerformed?: boolean;
  liveDbWrites?: boolean;
};

type DesignFixture = {
  fixtureId: string;
  modelKey: string;
  pid: string;
  title: string;
  dockAxis: string;
  saleStatus: string;
  condition: string;
  expectedDisposition: "candidate_fixture" | "manual_hold" | "negative_hold";
  reason: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
};

type ExpectedClassification = {
  modelKey: string;
  robotClass: string;
  dockAxis: string;
  sourceEvidenceTypes: string[];
  minimumFreshActiveRows: number;
  expectedPositiveRule: string;
  expectedManualRule: string;
  expectedNegativeRule: string;
  comparableKeyShape: string;
};

type RunnerDesign = {
  generatedAt: string;
  category: string;
  lane: string;
  ownership: string;
  reportOnly: boolean;
  conclusion: string;
  sufficientForRuntimePatch: boolean;
  suitableOnlyForFutureNoWriteRunnerImplementation: boolean;
  noLiveFetchPerformed: boolean;
  noProductionDbMutation: boolean;
  noRuntimePatch: boolean;
  noPublicPromotion: boolean;
  noCandidatePoolWiring: boolean;
  boundary: Boundary;
  metrics: Record<string, number>;
  officialTrustedSourceCoverage: Array<{
    modelKey: string;
    displayModel: string;
    sourceType: string;
    label: string;
    url: string;
    supports: string[];
  }>;
  fixtureModelDockRows: DesignFixture[];
  excludedLogisticsGenericAccessoryRows: DesignFixture[];
  expectedClassificationMatrix: ExpectedClassification[];
  runnerInputContract: string[];
  runnerOutputContract: string[];
  gateBoundaries: string[];
  stopConditions: string[];
  checks: Array<{ id: string; status: string; check: string; detail: string }>;
  failedChecks: unknown[];
};

type SourceBackfill = {
  reportOnly: boolean;
  conclusion: string;
  suitableForFutureInternalObservationPlanning: boolean;
  sufficientForRuntimePatch: boolean;
  boundary: Boundary;
  metrics: Record<string, number>;
  modelEvidence: Array<{
    modelKey: string;
    brand: string;
    displayModel: string;
    robotClass: string;
    dockAxis: string;
    internalObservationStatus: string;
  }>;
};

type ObservationDesign = {
  reportOnly: boolean;
  conclusion: string;
  internalObservationDesignReady: boolean;
  liveFetchPerformed: boolean;
  sufficientForRuntimePatch: boolean;
  boundary: Boundary;
  metrics: Record<string, number>;
  queryMatrix: Array<{
    modelKey: string;
    brand: string;
    displayModel: string;
    robotClass: string;
    dockAxis: string;
    observationStatus: string;
    minimumActiveRows: number;
    queries: string[];
  }>;
  stopConditions: string[];
};

type OrchestrationStatus = {
  reportOnly: boolean;
  publicPromotion: boolean;
  runtimeCatalogApply: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  candidates: Array<{ lane: string; status: string; recommendation: string }>;
};

type BoundaryAudit = {
  reportOnly: boolean;
  runtimeCatalogApply: boolean;
  publicPromotion: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  auditStatus: string;
  conclusion: string;
  metrics: Record<string, number>;
};

type ExpectedRunnerOutput = {
  fixtureId: string;
  modelKey: string;
  pid: string;
  inputDisposition: string;
  expectedRunnerDisposition: "active_candidate_internal_only" | "manual_hold" | "negative_hold";
  expectedReason: string;
  writeTargetsTouched: [];
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "home-appliance-robot-vacuum-no-write-runner-preflight-latest.json");
const outputMdPath = path.join(reportsDir, "home-appliance-robot-vacuum-no-write-runner-preflight-latest.md");

const inputFiles = {
  runnerDesignJson: "reports/home-appliance-robot-vacuum-no-write-runner-design-latest.json",
  runnerDesignMd: "reports/home-appliance-robot-vacuum-no-write-runner-design-latest.md",
  sourceBackfillJson: "reports/home-appliance-robot-vacuum-model-dock-source-backfill-latest.json",
  sourceBackfillMd: "reports/home-appliance-robot-vacuum-model-dock-source-backfill-latest.md",
  observationDesignJson: "reports/home-appliance-robot-vacuum-internal-observation-design-latest.json",
  observationDesignMd: "reports/home-appliance-robot-vacuum-internal-observation-design-latest.md",
  orchestrationStatusJson: "reports/category-orchestration-status-latest.json",
  orchestrationStatusMd: "reports/category-orchestration-status-latest.md",
  boundaryAuditJson: "reports/orchestration-boundary-audit-latest.json",
  boundaryAuditMd: "reports/orchestration-boundary-audit-latest.md",
  handoffMd: "../인수인계.md",
};

const closedBoundary = {
  reportOnly: true,
  runtimeCatalogApply: false,
  runtimeApply: false,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  liveFetchPerformed: false,
  liveDbWrites: false,
  sourceHealthMutation: false,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
};

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as T;
}

async function readText(relativePath: string): Promise<string> {
  return readFile(path.join(appDir, relativePath), "utf8");
}

function mdEscape(value: unknown): string {
  return String(value ?? "-").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function table(headers: string[], rows: unknown[][]): string {
  return [
    `| ${headers.map(mdEscape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
  ].join("\n");
}

function boundaryClosed(boundary: Boundary): boolean {
  return (
    boundary.reportOnly &&
    !boundary.runtimeCatalogApply &&
    !boundary.runtimeApply &&
    !boundary.publicPromotion &&
    !boundary.candidatePoolPolicyWiring &&
    !boundary.productionDbMutation &&
    !boundary.directThirtyDayPlanEdit &&
    !boundary.liveFetchPerformed &&
    !boundary.liveDbWrites &&
    boundary.runtimeApprovedRows === 0 &&
    boundary.publicPromotionRows === 0 &&
    boundary.candidatePoolRows === 0 &&
    boundary.runtimeApplyRows === 0
  );
}

function expectedRunnerDisposition(disposition: DesignFixture["expectedDisposition"]): ExpectedRunnerOutput["expectedRunnerDisposition"] {
  if (disposition === "candidate_fixture") {
    return "active_candidate_internal_only";
  }
  return disposition;
}

function expectedRunnerOutputs(fixtures: DesignFixture[]): ExpectedRunnerOutput[] {
  return fixtures.map((fixture) => ({
    fixtureId: fixture.fixtureId,
    modelKey: fixture.modelKey,
    pid: fixture.pid,
    inputDisposition: fixture.expectedDisposition,
    expectedRunnerDisposition: expectedRunnerDisposition(fixture.expectedDisposition),
    expectedReason:
      fixture.expectedDisposition === "candidate_fixture"
        ? "Supplied input may be counted only as internal active_candidate evidence after schema/freshness gates; it is never runtime approval."
        : fixture.reason,
    writeTargetsTouched: [],
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  }));
}

function summarizeModels(design: RunnerDesign, source: SourceBackfill, observation: ObservationDesign) {
  return design.expectedClassificationMatrix.map((row) => {
    const sourceModel = source.modelEvidence.find((model) => model.modelKey === row.modelKey);
    const queryRow = observation.queryMatrix.find((query) => query.modelKey === row.modelKey);
    const fixtureRows = design.fixtureModelDockRows.filter((fixture) => fixture.modelKey === row.modelKey);
    const positiveFixtures = fixtureRows.filter((fixture) => fixture.expectedDisposition === "candidate_fixture");
    const manualFixtures = fixtureRows.filter((fixture) => fixture.expectedDisposition === "manual_hold");
    const negativeFixtures = fixtureRows.filter((fixture) => fixture.expectedDisposition === "negative_hold");

    return {
      modelKey: row.modelKey,
      brand: sourceModel?.brand ?? queryRow?.brand ?? "unknown",
      displayModel: sourceModel?.displayModel ?? queryRow?.displayModel ?? row.modelKey,
      robotClass: row.robotClass,
      dockAxis: row.dockAxis,
      observationStatus: sourceModel?.internalObservationStatus ?? queryRow?.observationStatus ?? "unknown",
      minimumFreshActiveRows: row.minimumFreshActiveRows,
      queries: queryRow?.queries ?? [],
      sourceEvidenceTypes: row.sourceEvidenceTypes,
      positiveFixtureRows: positiveFixtures.length,
      manualFixtureRows: manualFixtures.length,
      negativeFixtureRows: negativeFixtures.length,
      expectedComparableKey: row.comparableKeyShape,
    };
  });
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [
    design,
    source,
    observation,
    orchestration,
    boundaryAudit,
    designMd,
    sourceMd,
    observationMd,
    orchestrationMd,
    boundaryAuditMd,
    handoffMd,
  ] = await Promise.all([
    readJson<RunnerDesign>(inputFiles.runnerDesignJson),
    readJson<SourceBackfill>(inputFiles.sourceBackfillJson),
    readJson<ObservationDesign>(inputFiles.observationDesignJson),
    readJson<OrchestrationStatus>(inputFiles.orchestrationStatusJson),
    readJson<BoundaryAudit>(inputFiles.boundaryAuditJson),
    readText(inputFiles.runnerDesignMd),
    readText(inputFiles.sourceBackfillMd),
    readText(inputFiles.observationDesignMd),
    readText(inputFiles.orchestrationStatusMd),
    readText(inputFiles.boundaryAuditMd),
    readText(inputFiles.handoffMd),
  ]);

  const suppliedFixtures = [...design.fixtureModelDockRows, ...design.excludedLogisticsGenericAccessoryRows];
  const modelDockSummaries = summarizeModels(design, source, observation);
  const positiveExpectedOutputs = expectedRunnerOutputs(
    suppliedFixtures.filter((fixture) => fixture.expectedDisposition === "candidate_fixture"),
  );
  const manualExpectedOutputs = expectedRunnerOutputs(
    suppliedFixtures.filter((fixture) => fixture.expectedDisposition === "manual_hold"),
  );
  const negativeExpectedOutputs = expectedRunnerOutputs(
    suppliedFixtures.filter((fixture) => fixture.expectedDisposition === "negative_hold"),
  );
  const orchestrationHomeAppliance = orchestration.candidates.find((candidate) => candidate.lane === "home_appliance_stick_vacuum");

  const inputSchema = [
    {
      name: "SuppliedRunnerConfig",
      requiredFields: [
        "runId",
        "mode=no_write_supplied_input_preflight",
        "generatedAt",
        "evaluationNow",
        "modelDockSummaries",
        "fixtureRows",
      ],
      forbiddenFields: ["fetchUrl", "dbUrl", "serviceRoleKey", "runtimeWriter", "candidatePoolWriter", "publicPromotionTarget"],
      rule: "A future runner receives already-supplied in-memory rows only; it must not fetch, persist, promote, or write source-health.",
    },
    {
      name: "SuppliedListingFixture",
      requiredFields: [
        "fixtureId",
        "listingId/pid",
        "modelKey",
        "title",
        "dockAxis",
        "saleStatus",
        "condition",
        "observedAt",
        "expectedDisposition",
      ],
      forbiddenFields: [
        "runtime approval flag enabled",
        "public promotion flag enabled",
        "candidate pool flag enabled",
        "runtime apply flag enabled",
      ],
      rule: "Fixtures are replay inputs for classification only; stale/fresh interpretation is report-only until a separate no-write executor exists.",
    },
    {
      name: "ModelDockSummaryInput",
      requiredFields: ["modelKey", "robotClass", "dockAxis", "minimumFreshActiveRows", "sourceEvidenceTypes", "expectedComparableKey"],
      forbiddenFields: ["runtimeCategoryPatch", "catalogMutation", "packUiMutation"],
      rule: "Each model+dock axis must stay separable from generic stick/handheld/bedding/wet-dry vacuum lanes.",
    },
  ];

  const outputSchema = [
    {
      name: "SuppliedRunnerPreflightResult",
      requiredFields: [
        "reportOnly=true",
        "runId",
        "modelSummaries",
        "positiveExpectedOutputs",
        "manualExpectedOutputs",
        "negativeExpectedOutputs",
        "stopConditionsTriggered",
        "writeTargetsTouched=[]",
      ],
      zeroFields: ["runtimeApprovedRows", "publicPromotionRows", "candidatePoolRows", "runtimeApplyRows", "liveFetchRows", "sourceHealthMutationRows"],
      rule: "Output can prove only whether supplied fixtures are classifiable by the contract; it cannot approve runtime or public use.",
    },
    {
      name: "SuppliedFixtureDisposition",
      requiredFields: ["fixtureId", "modelKey", "pid", "expectedRunnerDisposition", "expectedReason", "writeTargetsTouched"],
      allowedDispositions: ["active_candidate_internal_only", "manual_hold", "negative_hold"],
      rule: "active_candidate_internal_only is not runtimeApproved and is not eligible for public/candidate-pool promotion.",
    },
  ];

  const boundaryAuditSummary = {
    latestAuditStatus: boundaryAudit.auditStatus,
    latestAuditConclusion: boundaryAudit.conclusion,
    hardFailFindings: boundaryAudit.metrics.hardFailFindings,
    forbiddenTrueFlags: boundaryAudit.metrics.forbiddenTrueFlags,
    forbiddenPositiveCounts: boundaryAudit.metrics.forbiddenPositiveCounts,
    designArtifactIncluded:
      boundaryAuditMd.includes("home_appliance_robot_vacuum_no_write_runner_design") &&
      boundaryAuditMd.includes("reports/home-appliance-robot-vacuum-no-write-runner-design-latest.json"),
  };

  const checks = [
    {
      id: "ROBOT-RUNNER-PREFLIGHT-01",
      status:
        design.reportOnly &&
        source.reportOnly &&
        observation.reportOnly &&
        orchestration.reportOnly &&
        boundaryAudit.reportOnly &&
        boundaryClosed(design.boundary) &&
        boundaryClosed(source.boundary) &&
        boundaryClosed(observation.boundary)
          ? "pass"
          : "fail",
      check: "all inputs remain report-only/no-mutation",
      detail: "design/source/observation/orchestration/audit boundaries inspected",
    },
    {
      id: "ROBOT-RUNNER-PREFLIGHT-02",
      status:
        design.suitableOnlyForFutureNoWriteRunnerImplementation &&
        source.suitableForFutureInternalObservationPlanning &&
        observation.internalObservationDesignReady &&
        !design.sufficientForRuntimePatch &&
        !source.sufficientForRuntimePatch &&
        !observation.sufficientForRuntimePatch
          ? "pass"
          : "fail",
      check: "preflight is suitable only for future supplied-input no-write runner work",
      detail: `${design.conclusion}; ${source.conclusion}; ${observation.conclusion}`,
    },
    {
      id: "ROBOT-RUNNER-PREFLIGHT-03",
      status:
        positiveExpectedOutputs.length === design.metrics.candidateFixtureRows &&
        manualExpectedOutputs.length === design.metrics.manualHoldRows &&
        negativeExpectedOutputs.length === design.metrics.negativeHoldRows
          ? "pass"
          : "fail",
      check: "positive/manual/negative expected outputs match design fixture counts",
      detail: `positive=${positiveExpectedOutputs.length}, manual=${manualExpectedOutputs.length}, negative=${negativeExpectedOutputs.length}`,
    },
    {
      id: "ROBOT-RUNNER-PREFLIGHT-04",
      status:
        modelDockSummaries.length === design.metrics.expectedClassificationRows &&
        modelDockSummaries.every((summary) => summary.minimumFreshActiveRows >= 2 && summary.sourceEvidenceTypes.length > 0)
          ? "pass"
          : "fail",
      check: "model+dock summaries preserve source evidence and minimum active-row gates",
      detail: `modelDockSummaries=${modelDockSummaries.length}`,
    },
    {
      id: "ROBOT-RUNNER-PREFLIGHT-05",
      status:
        boundaryAudit.auditStatus === "pass" &&
        boundaryAudit.metrics.hardFailFindings === 0 &&
        boundaryAudit.metrics.forbiddenTrueFlags === 0 &&
        boundaryAudit.metrics.forbiddenPositiveCounts === 0 &&
        boundaryAuditSummary.designArtifactIncluded
          ? "pass"
          : "fail",
      check: "latest boundary audit is clean and includes runner design artifact",
      detail: boundaryAudit.conclusion,
    },
    {
      id: "ROBOT-RUNNER-PREFLIGHT-06",
      status:
        designMd.includes("writeTargetsTouched must be empty") &&
        sourceMd.includes("accessory_only_dock_base") &&
        observationMd.includes("No live fetch") &&
        orchestrationMd.includes("robot_vacuum_model_dock") &&
        handoffMd.includes("source-health") &&
        handoffMd.includes("runtimeApprovedRows")
          ? "pass"
          : "fail",
      check: "markdown and handoff constraints confirm supplied-input/no-write boundary",
      detail: "source-health and runtime approval guardrails confirmed",
    },
  ];
  const failedChecks = checks.filter((check) => check.status === "fail");

  const report = {
    generatedAt,
    category: "home_appliance",
    lane: "robot_vacuum_model_dock_supplied_input_no_write_runner_preflight",
    ownership: "robot_vacuum_model_dock_supplied_input_no_write_runner_preflight_only",
    reportOnly: true,
    conclusion:
      failedChecks.length === 0
        ? "robot_vacuum_model_dock_supplied_input_no_write_runner_preflight_passed_report_only"
        : "robot_vacuum_model_dock_supplied_input_no_write_runner_preflight_blocked",
    sufficientForRuntimePatch: false,
    noLiveFetchPerformed: true,
    noProductionDbMutation: true,
    noSourceHealthMutation: true,
    noRuntimePatch: true,
    noPublicPromotion: true,
    noCandidatePoolWiring: true,
    boundary: closedBoundary,
    metrics: {
      models: modelDockSummaries.length,
      suppliedFixtureRows: suppliedFixtures.length,
      positiveExpectedOutputs: positiveExpectedOutputs.length,
      manualExpectedOutputs: manualExpectedOutputs.length,
      negativeExpectedOutputs: negativeExpectedOutputs.length,
      sourceCoverageRows: design.officialTrustedSourceCoverage.length,
      inputSchemaSections: inputSchema.length,
      outputSchemaSections: outputSchema.length,
      stopConditions: design.stopConditions.length + 5,
      checks: checks.length,
      failedChecks: failedChecks.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
      liveFetchRows: 0,
      productionDbMutationRows: 0,
      sourceHealthMutationRows: 0,
    },
    inputFiles,
    upstreamSignals: {
      runnerDesignConclusion: design.conclusion,
      sourceBackfillConclusion: source.conclusion,
      observationDesignConclusion: observation.conclusion,
      orchestrationHomeApplianceStatus: orchestrationHomeAppliance?.status ?? "not_found",
      orchestrationHomeApplianceRecommendation: orchestrationHomeAppliance?.recommendation ?? "not_found",
      boundaryAuditConclusion: boundaryAudit.conclusion,
    },
    inputSchema,
    outputSchema,
    modelDockSummaries,
    positiveFixtureExpectedOutputs: positiveExpectedOutputs,
    manualFixtureExpectedOutputs: manualExpectedOutputs,
    negativeFixtureExpectedOutputs: negativeExpectedOutputs,
    stopConditions: [
      ...design.stopConditions,
      "Any supplied-input runner preflight needs a live fetch implementation, DB write, source-health mutation, runtime patch, candidate-pool wiring, public promotion, pack UI change, auth change, cron/lifecycle change, Supabase/DB edit, or 30일_실행계획.md edit.",
      "Any positive fixture output enables runtime approval, public promotion, candidate-pool wiring, or runtime apply.",
      "Any accessory-only, generic, logistics-only, sold/buying, damaged, consumable, or non-robot vacuum fixture is emitted as active_candidate_internal_only.",
      "Any model+dock summary merges robot vacuum with stick/handheld/bedding/wet-dry vacuum or generic appliance lanes.",
      "Any writeTargetsTouched array is non-empty.",
    ],
    boundaryAudit: boundaryAuditSummary,
    checks,
    failedChecks,
    nextAction:
      failedChecks.length === 0
        ? "A future owner may implement a supplied-input, in-memory no-write runner simulation from this preflight; runtime/DB/source-health/public/candidate-pool changes remain unapproved."
        : "Resolve failed preflight checks before any supplied-input runner simulation is considered.",
  };

  if (failedChecks.length > 0) {
    throw new Error(`Robot vacuum supplied-input runner preflight failed: ${failedChecks.map((check) => check.id).join(", ")}`);
  }

  await mkdir(reportsDir, { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const markdown = [
    "# Home Appliance Robot Vacuum No-Write Runner Preflight",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Summary",
    "",
    `- conclusion: ${report.conclusion}`,
    "- scope: supplied-input no-write runner preflight only",
    "- no live fetch, no production DB write, no source-health mutation, no runtime patch, no public promotion, no candidate-pool wiring",
    "- runtimeApproved/publicPromotion/candidatePool/runtimeApply rows: 0/0/0/0",
    "- runtime/src/lib, Supabase/DB, cron/lifecycle/source-health, candidate pool, pack UI, auth, public promotion, and 30일_실행계획.md: not touched",
    "",
    "## Metrics",
    "",
    table(
      ["metric", "value"],
      Object.entries(report.metrics).map(([key, value]) => [key, value]),
    ),
    "",
    "## Input Schema",
    "",
    table(
      ["name", "requiredFields", "forbiddenFields", "rule"],
      inputSchema.map((schema) => [
        schema.name,
        schema.requiredFields.join("; "),
        schema.forbiddenFields.join("; "),
        schema.rule,
      ]),
    ),
    "",
    "## Output Schema",
    "",
    table(
      ["name", "requiredFields", "zero/allowed fields", "rule"],
      outputSchema.map((schema) => [
        schema.name,
        schema.requiredFields.join("; "),
        (schema.zeroFields ?? schema.allowedDispositions ?? []).join("; "),
        schema.rule,
      ]),
    ),
    "",
    "## Model+Dock Summaries",
    "",
    table(
      ["modelKey", "model", "dockAxis", "minFreshActive", "sourceTypes", "positive", "manual", "negative"],
      modelDockSummaries.map((summary) => [
        summary.modelKey,
        `${summary.brand} ${summary.displayModel}`,
        summary.dockAxis,
        summary.minimumFreshActiveRows,
        summary.sourceEvidenceTypes.join(", "),
        summary.positiveFixtureRows,
        summary.manualFixtureRows,
        summary.negativeFixtureRows,
      ]),
    ),
    "",
    "## Positive Fixture Expected Outputs",
    "",
    table(
      ["fixtureId", "modelKey", "pid", "expectedRunnerDisposition", "expectedReason"],
      positiveExpectedOutputs.map((row) => [row.fixtureId, row.modelKey, row.pid, row.expectedRunnerDisposition, row.expectedReason]),
    ),
    "",
    "## Manual Fixture Expected Outputs",
    "",
    table(
      ["fixtureId", "modelKey", "pid", "expectedRunnerDisposition", "expectedReason"],
      manualExpectedOutputs.map((row) => [row.fixtureId, row.modelKey, row.pid, row.expectedRunnerDisposition, row.expectedReason]),
    ),
    "",
    "## Negative Fixture Expected Outputs",
    "",
    table(
      ["fixtureId", "modelKey", "pid", "expectedRunnerDisposition", "expectedReason"],
      negativeExpectedOutputs.map((row) => [row.fixtureId, row.modelKey, row.pid, row.expectedRunnerDisposition, row.expectedReason]),
    ),
    "",
    "## Stop Conditions",
    "",
    ...report.stopConditions.map((condition) => `- ${condition}`),
    "",
    "## Boundary Audit",
    "",
    table(
      ["field", "value"],
      Object.entries(boundaryAuditSummary).map(([key, value]) => [key, value]),
    ),
    "",
    "## Checks",
    "",
    table(
      ["id", "status", "check", "detail"],
      checks.map((check) => [check.id, check.status, check.check, check.detail]),
    ),
    "",
    "## Next Action",
    "",
    report.nextAction,
    "",
  ].join("\n");

  await writeFile(outputMdPath, markdown);

  console.log(
    JSON.stringify(
      {
        outputJsonPath,
        outputMdPath,
        conclusion: report.conclusion,
        metrics: report.metrics,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
