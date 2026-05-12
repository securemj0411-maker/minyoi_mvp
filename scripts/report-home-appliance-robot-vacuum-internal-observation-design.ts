import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SourceBackfill = {
  category: string;
  lane: string;
  reportOnly: boolean;
  conclusion: string;
  suitableForFutureInternalObservationPlanning: boolean;
  sufficientForRuntimePatch: boolean;
  boundary: Boundary;
  metrics: {
    modelEvidenceRows: number;
    marketRows: number;
    sourceRows: number;
    boundaryRows: number;
    failedChecks: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
  modelEvidence: ModelEvidence[];
  boundaryRows: Array<{
    boundaryClass: string;
    expectedDecision: string;
    title: string;
    reason: string;
  }>;
  modelDockPolicy: string[];
  blockedHoldBoundaries: string[];
};

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

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const inputFile = "reports/home-appliance-robot-vacuum-model-dock-source-backfill-latest.json";

const outputBoundary = {
  reportOnly: true,
  runtimeCatalogApply: false,
  runtimeApply: false,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
};

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

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as T;
}

function queryVariants(model: ModelEvidence): string[] {
  const base = [
    `${model.brand} ${model.displayModel} 로봇청소기`,
    `${model.displayModel} 로봇청소기 풀세트`,
    `${model.displayModel} 충전 스테이션`,
  ];
  if (model.dockAxis.includes("mop") || model.robotClass.includes("mop")) {
    base.push(`${model.displayModel} 물걸레 스테이션`);
  }
  if (model.dockAxis.includes("auto_empty")) {
    base.push(`${model.displayModel} 클린베이스 자동먼지통`);
  }
  return base;
}

function activeRowMinimum(model: ModelEvidence): number {
  return model.internalObservationStatus === "suitable_for_future_internal_observation" ? 3 : 2;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const source = await readJson<SourceBackfill>(inputFile);

  const queryMatrix = source.modelEvidence.map((model) => ({
    modelKey: model.modelKey,
    brand: model.brand,
    displayModel: model.displayModel,
    robotClass: model.robotClass,
    dockAxis: model.dockAxis,
    observationStatus: model.internalObservationStatus,
    minimumActiveRows: activeRowMinimum(model),
    seedMarketRows: model.marketPids.length,
    queries: queryVariants(model),
    positiveObservationRule:
      "Active SELLING row must show robot body model identity and compatible dock/base/mop-station package axis; accessory-only and damaged rows stay hold.",
  }));

  const checks = [
    {
      id: "ROBOT-OBS-DESIGN-01",
      status: source.suitableForFutureInternalObservationPlanning && !source.sufficientForRuntimePatch ? "pass" : "fail",
      check: "source backfill is suitable only for future internal observation planning",
      detail: source.conclusion,
    },
    {
      id: "ROBOT-OBS-DESIGN-02",
      status: source.modelEvidence.length >= 5 && queryMatrix.every((row) => row.queries.length >= 3) ? "pass" : "fail",
      check: "query matrix covers model+dock rows",
      detail: `models=${source.modelEvidence.length}`,
    },
    {
      id: "ROBOT-OBS-DESIGN-03",
      status: ["accessory_only_dock_base", "mop_pad_filter_consumable", "sold_only_or_non_active", "buying_request", "damaged_or_parts", "non_robot_vacuum"].every((boundaryClass) =>
        source.boundaryRows.some((row) => row.boundaryClass === boundaryClass),
      )
        ? "pass"
        : "fail",
      check: "required false-positive boundary classes are present",
      detail: Array.from(new Set(source.boundaryRows.map((row) => row.boundaryClass))).join(", "),
    },
    {
      id: "ROBOT-OBS-DESIGN-04",
      status: source.boundary.runtimeApprovedRows === 0 &&
        source.boundary.publicPromotionRows === 0 &&
        source.boundary.candidatePoolRows === 0 &&
        source.boundary.runtimeApplyRows === 0
        ? "pass"
        : "fail",
      check: "source boundary rows are closed",
      detail: "runtime/public/candidate/runtimeApply=0/0/0/0",
    },
  ];
  const failedChecks = checks.filter((check) => check.status === "fail");
  const internalObservationDesignReady = failedChecks.length === 0;

  const report = {
    generatedAt,
    category: source.category,
    lane: "robot_vacuum_model_dock_internal_observation_design",
    sourceLane: source.lane,
    reportOnly: true,
    conclusion: internalObservationDesignReady
      ? "robot_vacuum_model_dock_internal_observation_design_ready_report_only_no_live_fetch"
      : "robot_vacuum_model_dock_internal_observation_design_blocked",
    internalObservationDesignReady,
    liveFetchPerformed: false,
    sufficientForRuntimePatch: false,
    boundary: outputBoundary,
    metrics: {
      models: source.modelEvidence.length,
      queryRows: queryMatrix.length,
      totalQueryVariants: queryMatrix.reduce((sum, row) => sum + row.queries.length, 0),
      minimumActiveRowsTotal: queryMatrix.reduce((sum, row) => sum + row.minimumActiveRows, 0),
      boundaryRows: source.boundaryRows.length,
      checks: checks.length,
      failedChecks: failedChecks.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
    },
    modelDockAxes: source.modelEvidence.map((model) => ({
      modelKey: model.modelKey,
      brand: model.brand,
      displayModel: model.displayModel,
      robotClass: model.robotClass,
      dockAxis: model.dockAxis,
      comparableObservationShape: `robot_vacuum|${model.modelKey}|dock:${model.dockAxis}|class:${model.robotClass}`,
      seedMarketRows: model.marketPids.length,
      minimumActiveRows: activeRowMinimum(model),
    })),
    queryMatrix,
    minimumActiveRowsPolicy: [
      "Models already marked suitable require at least 3 fresh active SELLING rows before any internal observation executor review.",
      "Models marked manual_until_dock_axis_clear require at least 2 fresh active SELLING rows plus explicit dock/base evidence before promotion to suitable observation.",
      "Dock/base-only rows do not count toward active model rows unless robot body is included.",
      "Damaged/parts rows do not count toward active model rows even when model identity is visible.",
    ],
    freshnessAndSaleStatusHandling: [
      "No live fetch is performed by this design packet.",
      "A future observation executor must stamp fetchedAt and source URL for each market row.",
      "Only saleStatus=SELLING rows can count as active positive observation samples.",
      "RESERVED, SOLD, 판매완료, completed, hidden, buying/wanted, and partial inventory rows are stale or hold-only.",
      "Rows older than 14 days without a fresh saleStatus check are stale and cannot satisfy minimum active row counts.",
      "Official source evidence may be durable; market price and saleStatus evidence must be refreshed per observation wave.",
    ],
    boundaryRules: [
      "Accessory-only dock/base station rows are negative hold.",
      "Mop pad, filter, water tank, dust bag, cloth, brush, and consumable rows are negative hold.",
      "Sold-only, non-active, reserved, and buying/wanted rows are negative hold.",
      "Damaged, parts-only, missing charger, and unknown-condition rows are hold/manual even with visible model identity.",
      "Non-robot vacuum rows, including stick, handheld, bedding, wet-dry, and unrelated appliances, are negative hold.",
      "Robot body and dock/base/mop station package axes must stay separate.",
    ],
    requiredObservationSignals: [
      "activeRowsPerModel",
      "freshRowsPerModel",
      "dockAxisObservedPerModel",
      "falsePositiveBoundaryCount",
      "damagedOrPartsHoldCount",
      "accessoryOnlyHoldCount",
      "staleOrNonActiveFilteredCount",
      "manualUntilDockAxisClearCount",
      "priceLowMedianHighByModel",
    ],
    stopConditions: [
      "Any live fetch, DB write, runtime patch, public promotion, candidate-pool wiring, pack UI change, auth change, Supabase/schema edit, cron/lifecycle edit, or 30일_실행계획.md edit would be required.",
      "Any accessory-only dock/base, mop-pad/filter, sold/buying, damaged, or non-robot row would be counted as positive.",
      "Any suitable model has fewer than 3 fresh active SELLING rows.",
      "Any manual_until_dock_axis_clear model lacks explicit dock/base package evidence.",
      "Model+dock axes cannot distinguish charging station, auto-empty clean base, mop-wash base, and steam mop station.",
      "False-positive boundary count exceeds 0 in a future observation executor.",
    ],
    checks,
    failedChecks,
    inputFiles: [inputFile],
    nextAction:
      "Use this design only to build a future no-live-mutation observation executor; do not fetch live data, write DB rows, or patch runtime from this packet.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "home-appliance-robot-vacuum-internal-observation-design-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const md = [
    "# Home Appliance Robot Vacuum Internal Observation Design",
    "",
    `- generatedAt: ${generatedAt}`,
    `- category: ${report.category}`,
    `- lane: ${report.lane}`,
    `- conclusion: ${report.conclusion}`,
    `- internalObservationDesignReady: ${report.internalObservationDesignReady}`,
    "- liveFetchPerformed: false",
    "- sufficientForRuntimePatch: false",
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- runtimeCatalogApply/runtimeApply/publicPromotion/candidatePoolPolicyWiring: false/false/false/false",
    "- runtimeApproved/publicPromotion/candidatePool/runtimeApply rows: 0/0/0/0",
    "- productionDbMutation: false",
    "- directThirtyDayPlanEdit: false",
    "",
    "## Metrics",
    "",
    table(
      ["metric", "value"],
      [
        ["models", report.metrics.models],
        ["queryRows", report.metrics.queryRows],
        ["totalQueryVariants", report.metrics.totalQueryVariants],
        ["minimumActiveRowsTotal", report.metrics.minimumActiveRowsTotal],
        ["boundaryRows", report.metrics.boundaryRows],
        ["checks", report.metrics.checks],
        ["failedChecks", report.metrics.failedChecks],
      ],
    ),
    "",
    "## Model + Dock Axes",
    "",
    table(
      ["modelKey", "brand", "model", "robotClass", "dockAxis", "minimumActiveRows", "shape"],
      report.modelDockAxes.map((row) => [
        row.modelKey,
        row.brand,
        row.displayModel,
        row.robotClass,
        row.dockAxis,
        row.minimumActiveRows,
        row.comparableObservationShape,
      ]),
    ),
    "",
    "## Query Matrix",
    "",
    table(
      ["modelKey", "minimumActiveRows", "seedMarketRows", "queries"],
      queryMatrix.map((row) => [
        row.modelKey,
        row.minimumActiveRows,
        row.seedMarketRows,
        row.queries.join("; "),
      ]),
    ),
    "",
    "## Minimum Active Rows Policy",
    "",
    ...report.minimumActiveRowsPolicy.map((item) => `- ${item}`),
    "",
    "## Freshness / SaleStatus Handling",
    "",
    ...report.freshnessAndSaleStatusHandling.map((item) => `- ${item}`),
    "",
    "## Boundaries",
    "",
    ...report.boundaryRules.map((item) => `- ${item}`),
    "",
    "## Required Observation Signals",
    "",
    ...report.requiredObservationSignals.map((item) => `- ${item}`),
    "",
    "## Stop Conditions",
    "",
    ...report.stopConditions.map((item) => `- ${item}`),
    "",
    "## Checks",
    "",
    table(
      ["id", "status", "check", "detail"],
      checks.map((check) => [check.id, check.status, check.check, check.detail]),
    ),
    "",
    "## Inputs Read",
    "",
    ...report.inputFiles.map((file) => `- ${file}`),
    "",
    "## Next Action",
    "",
    report.nextAction,
    "",
  ].join("\n");

  await writeFile(path.join(reportsDir, "home-appliance-robot-vacuum-internal-observation-design-latest.md"), md);

  console.log(JSON.stringify({
    report: "reports/home-appliance-robot-vacuum-internal-observation-design-latest",
    conclusion: report.conclusion,
    internalObservationDesignReady,
    liveFetchPerformed: false,
    models: report.metrics.models,
    totalQueryVariants: report.metrics.totalQueryVariants,
    minimumActiveRowsTotal: report.metrics.minimumActiveRowsTotal,
    boundaryRows: report.metrics.boundaryRows,
    failedChecks: report.metrics.failedChecks,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
    runtimeApplyRows: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
