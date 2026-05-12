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
};

type ModelEvidence = {
  modelKey: string;
  brand: string;
  displayModel: string;
  robotClass: string;
  dockAxis: string;
  marketPids: string[];
  internalObservationStatus: string;
};

type SourceRow = {
  modelKey: string;
  brand: string;
  displayModel: string;
  robotClass: string;
  dockAxis: string;
  label: string;
  url: string;
  sourceType: string;
  supports: string[];
  statusNote: string;
};

type MarketRow = {
  modelKey: string;
  brand: string;
  displayModel: string;
  robotClass: string;
  dockAxis: string;
  pid: string;
  title: string;
  price: number;
  condition: string;
  saleStatus: string;
  url: string;
  evidenceSnippet: string;
};

type BoundaryRow = {
  caseId: string;
  pid: string;
  boundaryClass: string;
  expectedDecision: string;
  reason: string;
  title: string;
  price: number;
  condition: string;
  saleStatus: string;
  url: string;
  evidenceSnippet: string;
};

type SourceBackfill = {
  generatedAt: string;
  category: string;
  lane: string;
  reportOnly: boolean;
  conclusion: string;
  suitableForFutureInternalObservationPlanning: boolean;
  sufficientForRuntimePatch: boolean;
  boundary: Boundary;
  metrics: Record<string, number>;
  modelEvidence: ModelEvidence[];
  sourceRows: SourceRow[];
  marketRows: MarketRow[];
  boundaryRows: BoundaryRow[];
};

type ObservationDesign = {
  generatedAt: string;
  category: string;
  lane: string;
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
    seedMarketRows: number;
    queries: string[];
    positiveObservationRule: string;
  }>;
  minimumActiveRowsPolicy: string[];
  freshnessAndSaleStatusHandling: string[];
  boundaryRules: string[];
  requiredObservationSignals: string[];
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

type FixtureRow = {
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

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "home-appliance-robot-vacuum-no-write-runner-design-latest.json");
const outputMdPath = path.join(reportsDir, "home-appliance-robot-vacuum-no-write-runner-design-latest.md");

const inputFiles = {
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

function hasForbiddenBoundary(boundary: Boundary): boolean {
  return (
    !boundary.reportOnly ||
    boundary.runtimeCatalogApply ||
    boundary.runtimeApply ||
    boundary.publicPromotion ||
    boundary.candidatePoolPolicyWiring ||
    boundary.productionDbMutation ||
    boundary.directThirtyDayPlanEdit ||
    boundary.runtimeApprovedRows !== 0 ||
    boundary.publicPromotionRows !== 0 ||
    boundary.candidatePoolRows !== 0 ||
    boundary.runtimeApplyRows !== 0
  );
}

function sourceTypesForModel(sourceRows: SourceRow[], modelKey: string): string[] {
  return Array.from(new Set(sourceRows.filter((row) => row.modelKey === modelKey).map((row) => row.sourceType)));
}

function isBoundaryPid(boundaryRows: BoundaryRow[], pid: string): boolean {
  return boundaryRows.some((row) => row.pid === pid && row.expectedDecision !== "positive_fixture");
}

function expectedDisposition(row: MarketRow, boundaryRows: BoundaryRow[], model: ModelEvidence): FixtureRow["expectedDisposition"] {
  const boundary = boundaryRows.find((candidate) => candidate.pid === row.pid);
  if (boundary) {
    return boundary.expectedDecision === "manual_hold" ? "manual_hold" : "negative_hold";
  }

  if (isBoundaryPid(boundaryRows, row.pid)) {
    return "negative_hold";
  }

  if (model.internalObservationStatus === "suitable_for_future_internal_observation" && row.saleStatus === "SELLING") {
    return "candidate_fixture";
  }

  return "manual_hold";
}

function fixtureReason(row: MarketRow, boundaryRows: BoundaryRow[], model: ModelEvidence): string {
  const boundary = boundaryRows.find((candidate) => candidate.pid === row.pid);
  if (boundary) {
    return boundary.reason;
  }
  if (model.internalObservationStatus === "suitable_for_future_internal_observation") {
    return "Source-backed robot body row may be used as a positive fixture only in a future no-write runner with fresh active verification.";
  }
  return "Model identity is source-backed, but dock/base axis is not yet clear enough for positive fixture use.";
}

function fixtureRows(source: SourceBackfill): FixtureRow[] {
  return source.marketRows.map((row, index) => {
    const model = source.modelEvidence.find((candidate) => candidate.modelKey === row.modelKey);
    if (!model) {
      throw new Error(`Missing model evidence for ${row.modelKey}`);
    }
    return {
      fixtureId: `ROBOT-RUNNER-FIXTURE-${String(index + 1).padStart(2, "0")}`,
      modelKey: row.modelKey,
      pid: row.pid,
      title: row.title,
      dockAxis: row.dockAxis,
      saleStatus: row.saleStatus,
      condition: row.condition,
      expectedDisposition: expectedDisposition(row, source.boundaryRows, model),
      reason: fixtureReason(row, source.boundaryRows, model),
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    };
  });
}

function excludedRows(source: SourceBackfill): FixtureRow[] {
  const fromBoundary = source.boundaryRows.map((row, index) => ({
    fixtureId: `ROBOT-RUNNER-EXCLUDED-${String(index + 1).padStart(2, "0")}`,
    modelKey: row.boundaryClass,
    pid: row.pid,
    title: row.title,
    dockAxis: row.boundaryClass,
    saleStatus: row.saleStatus,
    condition: row.condition,
    expectedDisposition: row.expectedDecision === "manual_hold" ? "manual_hold" : "negative_hold",
    reason: row.reason,
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  })) satisfies FixtureRow[];

  const syntheticGenericRows: FixtureRow[] = [
    {
      fixtureId: "ROBOT-RUNNER-EXCLUDED-GENERIC-01",
      modelKey: "generic_robot_vacuum_missing_model",
      pid: "synthetic-generic-robot-vacuum",
      title: "로봇청소기 풀세트 모델명 미기재",
      dockAxis: "generic_missing_model",
      saleStatus: "SELLING",
      condition: "UNKNOWN",
      expectedDisposition: "manual_hold",
      reason: "Generic robot-vacuum wording without exact model cannot form comparable model+dock evidence.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
    {
      fixtureId: "ROBOT-RUNNER-EXCLUDED-LOGISTICS-01",
      modelKey: "logistics_only_or_delivery_template",
      pid: "synthetic-logistics-template",
      title: "로봇청소기 직거래 택배 배송비 문의",
      dockAxis: "logistics_template",
      saleStatus: "SELLING",
      condition: "UNKNOWN",
      expectedDisposition: "negative_hold",
      reason: "Logistics or delivery-only wording is not product model evidence and must stay excluded.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
  ];

  return [...fromBoundary, ...syntheticGenericRows];
}

function classificationMatrix(source: SourceBackfill, observation: ObservationDesign): ExpectedClassification[] {
  return observation.queryMatrix.map((row) => ({
    modelKey: row.modelKey,
    robotClass: row.robotClass,
    dockAxis: row.dockAxis,
    sourceEvidenceTypes: sourceTypesForModel(source.sourceRows, row.modelKey),
    minimumFreshActiveRows: row.minimumActiveRows,
    expectedPositiveRule:
      "fresh active SELLING + exact model identity + robot body included + dock/base/mop station axis compatible + no damaged/accessory/buying/sold signal",
    expectedManualRule:
      "exact model identity present but dock/base axis, model token, completeness, condition, or freshness needs human review",
    expectedNegativeRule:
      "accessory-only, mop pad/filter/consumable, generic missing model, logistics-only, sold/reserved/buying, damaged parts-only, or non-robot vacuum",
    comparableKeyShape: `home_appliance|robot_vacuum|model:${row.modelKey}|dock:${row.dockAxis}|class:${row.robotClass}`,
  }));
}

function coverageBySourceType(sourceRows: SourceRow[]): Array<{ sourceType: string; rows: number; modelKeys: string[] }> {
  const grouped = new Map<string, Set<string>>();
  for (const row of sourceRows) {
    const group = grouped.get(row.sourceType) ?? new Set<string>();
    group.add(row.modelKey);
    grouped.set(row.sourceType, group);
  }
  return Array.from(grouped.entries()).map(([sourceType, modelKeys]) => ({
    sourceType,
    rows: sourceRows.filter((row) => row.sourceType === sourceType).length,
    modelKeys: Array.from(modelKeys),
  }));
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [source, observation, orchestration, boundaryAudit, sourceMd, observationMd, orchestrationMd, boundaryAuditMd, handoffMd] =
    await Promise.all([
      readJson<SourceBackfill>(inputFiles.sourceBackfillJson),
      readJson<ObservationDesign>(inputFiles.observationDesignJson),
      readJson<OrchestrationStatus>(inputFiles.orchestrationStatusJson),
      readJson<BoundaryAudit>(inputFiles.boundaryAuditJson),
      readText(inputFiles.sourceBackfillMd),
      readText(inputFiles.observationDesignMd),
      readText(inputFiles.orchestrationStatusMd),
      readText(inputFiles.boundaryAuditMd),
      readText(inputFiles.handoffMd),
    ]);

  const fixtures = fixtureRows(source);
  const exclusions = excludedRows(source);
  const matrix = classificationMatrix(source, observation);
  const evidenceCoverage = coverageBySourceType(source.sourceRows);
  const candidateFixtures = fixtures.filter((row) => row.expectedDisposition === "candidate_fixture");
  const manualFixtures = [...fixtures, ...exclusions].filter((row) => row.expectedDisposition === "manual_hold");
  const negativeFixtures = [...fixtures, ...exclusions].filter((row) => row.expectedDisposition === "negative_hold");
  const orchestrationHomeAppliance = orchestration.candidates.find((row) => row.lane === "home_appliance_stick_vacuum");

  const checks = [
    {
      id: "ROBOT-NO-WRITE-RUNNER-01",
      status:
        source.reportOnly &&
        observation.reportOnly &&
        orchestration.reportOnly &&
        boundaryAudit.reportOnly &&
        !hasForbiddenBoundary(source.boundary) &&
        !hasForbiddenBoundary(observation.boundary)
          ? "pass"
          : "fail",
      check: "all input artifacts are report-only with closed mutation boundaries",
      detail: "source/design/orchestration/audit inputs inspected",
    },
    {
      id: "ROBOT-NO-WRITE-RUNNER-02",
      status: source.suitableForFutureInternalObservationPlanning && observation.internalObservationDesignReady ? "pass" : "fail",
      check: "source evidence and internal observation design are ready for runner design only",
      detail: `${source.conclusion}; ${observation.conclusion}`,
    },
    {
      id: "ROBOT-NO-WRITE-RUNNER-03",
      status: source.sourceRows.length >= source.modelEvidence.length && evidenceCoverage.some((row) => row.sourceType === "official_product")
        ? "pass"
        : "fail",
      check: "official/trusted evidence covers selected model list",
      detail: evidenceCoverage.map((row) => `${row.sourceType}:${row.rows}`).join(", "),
    },
    {
      id: "ROBOT-NO-WRITE-RUNNER-04",
      status: candidateFixtures.length >= 3 && manualFixtures.length >= 3 && negativeFixtures.length >= 6 ? "pass" : "fail",
      check: "fixture, manual, and excluded rows are separated",
      detail: `candidate=${candidateFixtures.length}, manual=${manualFixtures.length}, negative=${negativeFixtures.length}`,
    },
    {
      id: "ROBOT-NO-WRITE-RUNNER-05",
      status:
        boundaryAudit.auditStatus === "pass" &&
        boundaryAudit.metrics.hardFailFindings === 0 &&
        boundaryAudit.metrics.forbiddenTrueFlags === 0 &&
        boundaryAudit.metrics.forbiddenPositiveCounts === 0
          ? "pass"
          : "fail",
      check: "latest orchestration boundary audit remains clean",
      detail: boundaryAudit.conclusion,
    },
    {
      id: "ROBOT-NO-WRITE-RUNNER-06",
      status:
        sourceMd.includes("accessory_only_dock_base") &&
        observationMd.includes("No live fetch") &&
        orchestrationMd.includes("Create no-write robot vacuum dry-run runner design only") &&
        boundaryAuditMd.includes("home_appliance_robot_vacuum_internal_observation_design") &&
        handoffMd.includes("robot vacuum") &&
        handoffMd.includes("future dry-run output")
          ? "pass"
          : "fail",
      check: "markdown and handoff guidance were used for boundary interpretation",
      detail: "robot vacuum separate axis and future dry-run zero-boundary requirements confirmed",
    },
  ];
  const failedChecks = checks.filter((check) => check.status === "fail");

  const report = {
    generatedAt,
    category: "home_appliance",
    lane: "robot_vacuum_model_dock_no_write_runner_design",
    ownership: "home_appliance_robot_vacuum_model_dock_no_write_runner_design_expansion_only",
    reportOnly: true,
    conclusion:
      failedChecks.length === 0
        ? "robot_vacuum_model_dock_no_write_runner_design_ready_for_future_report_only_executor_build"
        : "robot_vacuum_model_dock_no_write_runner_design_blocked",
    sufficientForRuntimePatch: false,
    suitableOnlyForFutureNoWriteRunnerImplementation: failedChecks.length === 0,
    noLiveFetchPerformed: true,
    noProductionDbMutation: true,
    noRuntimePatch: true,
    noPublicPromotion: true,
    noCandidatePoolWiring: true,
    boundary: closedBoundary,
    metrics: {
      models: source.modelEvidence.length,
      sourceRows: source.sourceRows.length,
      officialProductRows: source.sourceRows.filter((row) => row.sourceType === "official_product").length,
      officialSupportOrManualRows: source.sourceRows.filter((row) => row.sourceType === "official_support_pdf").length,
      reliableSecondaryRows: source.sourceRows.filter((row) => row.sourceType === "reliable_secondary").length,
      marketFixtureRows: fixtures.length,
      candidateFixtureRows: candidateFixtures.length,
      manualHoldRows: manualFixtures.length,
      negativeHoldRows: negativeFixtures.length,
      excludedFixtureRows: exclusions.length,
      expectedClassificationRows: matrix.length,
      minimumFreshActiveRowsTotal: observation.metrics.minimumActiveRowsTotal,
      checks: checks.length,
      failedChecks: failedChecks.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
    },
    inputFiles,
    upstreamSignals: {
      sourceBackfillConclusion: source.conclusion,
      observationDesignConclusion: observation.conclusion,
      categoryOrchestrationHomeApplianceStatus: orchestrationHomeAppliance?.status ?? "not_found",
      categoryOrchestrationHomeApplianceRecommendation: orchestrationHomeAppliance?.recommendation ?? "not_found",
      boundaryAuditConclusion: boundaryAudit.conclusion,
    },
    officialTrustedSourceCoverage: source.sourceRows.map((row) => ({
      modelKey: row.modelKey,
      displayModel: row.displayModel,
      sourceType: row.sourceType,
      label: row.label,
      url: row.url,
      supports: row.supports,
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    })),
    sourceTypeCoverage: evidenceCoverage,
    fixtureModelDockRows: fixtures,
    excludedLogisticsGenericAccessoryRows: exclusions,
    expectedClassificationMatrix: matrix,
    runnerInputContract: [
      "A future runner may accept caller-provided in-memory listing rows only; this packet defines no fetch implementation.",
      "Runner inputs must include listingId, title, saleStatus, observedAt, listingUpdatedAt if available, price, condition, url, query, modelKey, and source marketplace label.",
      "No DB connection, auth secret, fetch URL, runtime catalog writer, public promotion flag, candidate-pool writer, pack UI mutation, cron trigger, or Supabase mutation target is accepted.",
      "Fixture rows in this report are design fixtures, not production approvals.",
    ],
    runnerOutputContract: [
      "reportOnly must remain true.",
      "runtimeApprovedRows, publicPromotionRows, candidatePoolRows, and runtimeApplyRows must be 0.",
      "Each sampled row must emit active_candidate, manual_hold, or negative_hold; active_candidate is evidence for internal review only.",
      "Each model summary must show activeFreshRows, manualHoldRows, negativeHoldRows, dockAxisObserved, and minimumFreshActiveRowsMet.",
      "writeTargetsTouched must be empty.",
    ],
    gateBoundaries: [
      "Positive candidate fixture requires fresh active SELLING row, source-backed model key, robot body included, dock/base/mop station axis compatible, and no exclusion tokens.",
      "Manual hold includes source-backed model rows with unclear dock/base axis, damaged condition, incomplete set, stale timestamp, or uncertain product completeness.",
      "Negative hold includes accessory-only dock/base, mop pad/filter/water tank/dust bag/cloth/brush consumables, logistics-only, generic missing-model, sold/reserved/buying, damaged parts-only, and non-robot vacuum rows.",
      "No future runtime patch may be considered until a separate owner-approved no-write executor produces clean internal observations with zero false-positive boundary breaches.",
    ],
    stopConditions: [
      ...observation.stopConditions,
      "Any runner design change requires editing runtime/src/lib, Supabase/DB, cron/lifecycle, candidate pool, pack UI, auth, public promotion, or 30일_실행계획.md.",
      "Any output attempts to convert fixture rows into runtime approval, candidate-pool wiring, public promotion, or DB writes.",
      "Any dock-only or accessory/consumable row is counted as a positive robot-body fixture.",
      "Any generic/logistics row without exact model+dock evidence is counted as a positive fixture.",
    ],
    checks,
    failedChecks,
    nextAction:
      failedChecks.length === 0
        ? "Owner may separately approve a future no-write executor implementation that consumes external in-memory rows only; no runtime or DB patch is approved here."
        : "Resolve failed report-only checks before designing any no-write executor.",
  };

  if (failedChecks.length > 0) {
    throw new Error(`No-write runner design checks failed: ${failedChecks.map((check) => check.id).join(", ")}`);
  }

  await mkdir(reportsDir, { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const markdown = [
    "# Home Appliance Robot Vacuum No-Write Runner Design",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Summary",
    "",
    `- conclusion: ${report.conclusion}`,
    "- scope: robot vacuum model+dock no-write dry-run runner design only",
    "- runtime/src/lib, Supabase/DB, cron/lifecycle, candidate pool, pack UI, auth, public promotion, and 30일_실행계획.md: not touched",
    "- no live fetch, no production DB writes, no runtime patch, no public promotion, no candidate-pool wiring",
    "- runtimeApproved/publicPromotion/candidatePool/runtimeApply rows: 0/0/0/0",
    "",
    "## Metrics",
    "",
    table(
      ["metric", "value"],
      Object.entries(report.metrics).map(([key, value]) => [key, value]),
    ),
    "",
    "## Upstream Signals",
    "",
    table(
      ["signal", "value"],
      Object.entries(report.upstreamSignals).map(([key, value]) => [key, value]),
    ),
    "",
    "## Official / Trusted Source Coverage",
    "",
    table(
      ["modelKey", "model", "sourceType", "label", "supports"],
      report.officialTrustedSourceCoverage.map((row) => [
        row.modelKey,
        row.displayModel,
        row.sourceType,
        row.label,
        row.supports.join("; "),
      ]),
    ),
    "",
    "## Fixture Model+Dock Rows",
    "",
    table(
      ["fixtureId", "modelKey", "pid", "dockAxis", "saleStatus", "condition", "expectedDisposition", "reason"],
      report.fixtureModelDockRows.map((row) => [
        row.fixtureId,
        row.modelKey,
        row.pid,
        row.dockAxis,
        row.saleStatus,
        row.condition,
        row.expectedDisposition,
        row.reason,
      ]),
    ),
    "",
    "## Excluded Logistics / Generic / Accessory Rows",
    "",
    table(
      ["fixtureId", "class", "pid", "expectedDisposition", "title", "reason"],
      report.excludedLogisticsGenericAccessoryRows.map((row) => [
        row.fixtureId,
        row.modelKey,
        row.pid,
        row.expectedDisposition,
        row.title,
        row.reason,
      ]),
    ),
    "",
    "## Expected Classification Matrix",
    "",
    table(
      ["modelKey", "robotClass", "dockAxis", "minFreshActive", "sourceTypes", "comparableKeyShape"],
      report.expectedClassificationMatrix.map((row) => [
        row.modelKey,
        row.robotClass,
        row.dockAxis,
        row.minimumFreshActiveRows,
        row.sourceEvidenceTypes.join(", "),
        row.comparableKeyShape,
      ]),
    ),
    "",
    "## Gate Boundaries",
    "",
    ...report.gateBoundaries.map((rule) => `- ${rule}`),
    "",
    "## Runner Contracts",
    "",
    "### Input",
    "",
    ...report.runnerInputContract.map((rule) => `- ${rule}`),
    "",
    "### Output",
    "",
    ...report.runnerOutputContract.map((rule) => `- ${rule}`),
    "",
    "## Stop Conditions",
    "",
    ...report.stopConditions.map((condition) => `- ${condition}`),
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
