import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type SourceSpec = {
  size: string;
  resolution: string;
  refresh: string;
  panel: string;
  shape: string;
};

type SourceRow = {
  caseId: string;
  modelCode: string;
  brandModel: string;
  titleExample: string;
  sourceTier: string;
  sourceUrl: string | null;
  sourceConfidence: string;
  sourceVerifiedSpec: SourceSpec;
  observationReadiness: "safe_internal_no_write_observation" | "manual_observation_only" | "hold_required";
  holdReason: string | null;
  noWriteObservationRule: string;
  runtimeApproved: boolean;
  publicPromotion: boolean;
  candidatePoolReady: boolean;
  runtimeApply: boolean;
};

type SourceConfidenceReport = {
  reportOnly: boolean;
  runtimeCatalogApply: boolean;
  runtimeApply: boolean;
  publicPromotion: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  rows: SourceRow[];
  conclusion: string;
};

type SimulationReport = {
  reportOnly: boolean;
  suppliedInputOnly: boolean;
  runtimeCatalogApply: boolean;
  runtimeApply: boolean;
  publicPromotion: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  sourceHealthMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  writeTargetsTouched: string[];
  metrics: {
    acceptedObservationCandidateRows: number;
    preservedManualRows: number;
    preservedHoldRows: number;
    blockedTitleSpecConflictRows: number;
    titleSpecConflictDetectedRows: number;
  };
  conclusion: string;
};

type QueryRow = {
  modelCode: string;
  brandModel: string;
  readiness: SourceRow["observationReadiness"];
  expectedStatus: "accept_internal_observation" | "manual_only" | "hold";
  exactQueries: string[];
  protectedNegativeQueries: string[];
  verifiedSpec: SourceSpec;
  sourceTier: string;
  sourceUrl: string | null;
  minActiveSellingRows: number;
  rule: string;
  holdReason: string | null;
};

type BoundaryRow = {
  className: string;
  decision: "exclude_hold" | "manual_review";
  titleSignals: string[];
  reason: string;
};

const repoRoot = process.cwd();
const reportsDir = path.join(repoRoot, "reports");
const sourcePath = "reports/monitor-selected-exact-model-source-confidence-latest.json";
const simulationPath = "reports/monitor-selected-exact-model-supplied-input-runner-simulation-latest.json";

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8")) as T;
}

function assertReportOnlyInputs(source: SourceConfidenceReport, simulation: SimulationReport) {
  const forbiddenFlags = [
    source.runtimeCatalogApply,
    source.runtimeApply,
    source.publicPromotion,
    source.candidatePoolPolicyWiring,
    source.productionDbMutation,
    source.directThirtyDayPlanEdit,
    simulation.runtimeCatalogApply,
    simulation.runtimeApply,
    simulation.publicPromotion,
    simulation.candidatePoolPolicyWiring,
    simulation.productionDbMutation,
    simulation.sourceHealthMutation,
    simulation.directThirtyDayPlanEdit,
  ];

  if (!source.reportOnly || !simulation.reportOnly || !simulation.suppliedInputOnly || forbiddenFlags.some(Boolean)) {
    throw new Error("Monitor observation design inputs must remain report-only and no-write.");
  }

  if (simulation.writeTargetsTouched.length !== 0) {
    throw new Error("Monitor supplied-input simulation must not touch write targets.");
  }
}

function queriesFor(row: SourceRow): string[] {
  const lowerModel = row.modelCode.toLowerCase();
  const modelUpper = row.modelCode.toUpperCase();
  const aliases: Record<string, string[]> = {
    xl2540k: ["BenQ XL2540K", "벤큐 XL2540K", "ZOWIE XL2540K", "조위 XL2540K"],
    "27us550": ["LG 27US550", "LG 27US550-W", "엘지 27US550", "27US550-W"],
    ls27f354fhk: ["Samsung LS27F354FHK", "삼성 LS27F354FHK", "S27F354FHK", "LS27F354FHKXKR"],
    "39gx900a": ["LG 39GX900A", "LG 39GX900A-B", "엘지 39GX900A", "39GX900A-B"],
    aw2525hm: ["Dell AW2525HM", "Alienware AW2525HM", "델 AW2525HM", "AW2525HM"],
    "27gl650f": ["LG 27GL650F", "LG 27GL650F-B", "엘지 27GL650F", "27GL650F-B"],
    u2412mb: ["Dell U2412M", "Dell U2412Mb", "델 U2412M", "U2412Mb"],
    "275qf": ["MSI MAG 275QF", "MSI 275QF", "275QF"],
    ct2210ips: ["Camel CT2210IPS", "카멜 CT2210IPS", "CT2210IPS"],
    "32rtx950": ["CrossOver 32RTX950", "크로스오버 32RTX950", "32RTX950"],
  };

  return aliases[lowerModel] ?? [modelUpper, lowerModel, row.brandModel];
}

function expectedStatus(readiness: SourceRow["observationReadiness"]): QueryRow["expectedStatus"] {
  if (readiness === "safe_internal_no_write_observation") return "accept_internal_observation";
  if (readiness === "manual_observation_only") return "manual_only";
  return "hold";
}

function protectedNegativeQueries(row: SourceRow): string[] {
  const base = row.modelCode.toUpperCase();
  return [
    `${base} 어댑터`,
    `${base} 받침대`,
    `${base} 스탠드`,
    `${base} 부품`,
    `${base} 액정파손`,
    `${base} 판매완료`,
  ];
}

function boundaryRows(): BoundaryRow[] {
  return [
    {
      className: "accessory_stand_adapter",
      decision: "exclude_hold",
      titleSignals: ["스탠드", "받침대", "거치대", "어댑터", "케이블", "암", "부품"],
      reason: "Accessories and monitor parts must not emit selected exact-model monitor observation rows.",
    },
    {
      className: "damaged_or_panel_defect",
      decision: "exclude_hold",
      titleSignals: ["파손", "깨짐", "멍", "불량", "고장", "수리", "부품용", "화면나감"],
      reason: "Damaged panel/body rows cannot count as clean active market observations.",
    },
    {
      className: "buying_sold_reserved",
      decision: "exclude_hold",
      titleSignals: ["삽니다", "구매", "매입", "판매완료", "거래완료", "예약중"],
      reason: "Buying, sold-only, and non-active rows are excluded from live observation counts.",
    },
    {
      className: "title_spec_conflict",
      decision: "manual_review",
      titleSignals: ["공식 refresh/resolution과 제목 refresh/resolution 불일치"],
      reason: "Title spec tokens that contradict source-backed specs require manual review or hold.",
    },
    {
      className: "touch_signage_android",
      decision: "manual_review",
      titleSignals: ["터치", "안드로이드", "광고용", "사이니지", "키오스크"],
      reason: "Touch/signage/Android monitor rows need a separate device-class split before observation.",
    },
    {
      className: "source_unconfirmed",
      decision: "exclude_hold",
      titleSignals: ["official/support/manual/trusted source 없음"],
      reason: "Title-visible model tokens alone are insufficient when source confidence is low.",
    },
  ];
}

function escapeMd(value: unknown): string {
  return String(value ?? "null").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function buildMarkdown(report: {
  generatedAt: string;
  conclusion: string;
  metrics: Record<string, number>;
  queryMatrix: QueryRow[];
  boundaryContract: BoundaryRow[];
  stopConditions: string[];
  inputFilesRead: string[];
}) {
  const queryRows = report.queryMatrix
    .map(
      (row) =>
        `| ${escapeMd(row.modelCode)} | ${escapeMd(row.expectedStatus)} | ${escapeMd(row.sourceTier)} | ${escapeMd(
          `${row.verifiedSpec.size}, ${row.verifiedSpec.resolution}, ${row.verifiedSpec.refresh}, ${row.verifiedSpec.panel}, ${row.verifiedSpec.shape}`,
        )} | ${escapeMd(row.exactQueries.join("<br>"))} | ${escapeMd(row.protectedNegativeQueries.join("<br>"))} | ${escapeMd(
          row.rule,
        )} |`,
    )
    .join("\n");

  const boundaryTable = report.boundaryContract
    .map(
      (row) =>
        `| ${escapeMd(row.className)} | ${escapeMd(row.decision)} | ${escapeMd(row.titleSignals.join("<br>"))} | ${escapeMd(
          row.reason,
        )} |`,
    )
    .join("\n");

  return `${[
    "# Monitor Selected Exact-Model No-Write Observation Design",
    "",
    `- generatedAt: ${report.generatedAt}`,
    "- category: monitor_discovered",
    "- lane: monitor_selected_exact_model_no_write_observation_design",
    `- conclusion: ${report.conclusion}`,
    "- reportOnly: true",
    "- runtimeCatalogApply/runtimeApply/publicPromotion/candidatePoolPolicyWiring: false/false/false/false",
    "- productionDbMutation/directThirtyDayPlanEdit/sourceHealthMutation: false/false/false",
    "- runtimeApproved/publicPromotion/candidatePool/runtimeApply rows: 0/0/0/0",
    "",
    "## Metrics",
    "",
    `- selectedSafeModels: ${report.metrics.selectedSafeModels}`,
    `- manualOnlyModels: ${report.metrics.manualOnlyModels}`,
    `- holdModels: ${report.metrics.holdModels}`,
    `- queryMatrixRows: ${report.metrics.queryMatrixRows}`,
    `- primaryQueries: ${report.metrics.primaryQueries}`,
    `- protectedNegativeQueries: ${report.metrics.protectedNegativeQueries}`,
    `- boundaryClasses: ${report.metrics.boundaryClasses}`,
    `- minActiveSellingRowsTarget: ${report.metrics.minActiveSellingRowsTarget}`,
    "",
    "## Query Matrix",
    "",
    "| modelCode | expectedStatus | sourceTier | verifiedSpec | exactQueries | protectedNegativeQueries | rule |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    queryRows,
    "",
    "## Boundary Contract",
    "",
    "| class | decision | titleSignals | reason |",
    "| --- | --- | --- | --- |",
    boundaryTable,
    "",
    "## Stop Conditions",
    "",
    ...report.stopConditions.map((condition) => `- ${condition}`),
    "",
    "## Inputs Read",
    "",
    ...report.inputFilesRead.map((file) => `- ${file}`),
    "",
  ].join("\n")}\n`;
}

const source = readJson<SourceConfidenceReport>(sourcePath);
const simulation = readJson<SimulationReport>(simulationPath);
assertReportOnlyInputs(source, simulation);

const queryMatrix: QueryRow[] = source.rows.map((row) => ({
  modelCode: row.modelCode,
  brandModel: row.brandModel,
  readiness: row.observationReadiness,
  expectedStatus: expectedStatus(row.observationReadiness),
  exactQueries: queriesFor(row),
  protectedNegativeQueries: protectedNegativeQueries(row),
  verifiedSpec: row.sourceVerifiedSpec,
  sourceTier: row.sourceTier,
  sourceUrl: row.sourceUrl,
  minActiveSellingRows: row.observationReadiness === "safe_internal_no_write_observation" ? 3 : 0,
  rule: row.noWriteObservationRule,
  holdReason: row.holdReason,
}));

const safeRows = queryMatrix.filter((row) => row.expectedStatus === "accept_internal_observation");
const manualRows = queryMatrix.filter((row) => row.expectedStatus === "manual_only");
const holdRows = queryMatrix.filter((row) => row.expectedStatus === "hold");
const boundaries = boundaryRows();

const report = {
  generatedAt: new Date().toISOString(),
  category: "monitor_discovered",
  lane: "monitor_selected_exact_model_no_write_observation_design",
  conclusion: "monitor_selected_exact_model_no_write_observation_design_ready_report_only",
  reportOnly: true,
  runtimeCatalogApply: false,
  runtimeApply: false,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  sourceHealthMutation: false,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
  liveDbWriteRows: 0,
  dbAccessRows: 0,
  inputFilesRead: [sourcePath, simulationPath],
  upstreamConclusions: {
    sourceConfidence: source.conclusion,
    suppliedInputSimulation: simulation.conclusion,
  },
  metrics: {
    selectedSafeModels: safeRows.length,
    manualOnlyModels: manualRows.length,
    holdModels: holdRows.length,
    queryMatrixRows: queryMatrix.length,
    primaryQueries: queryMatrix.reduce((sum, row) => sum + row.exactQueries.length, 0),
    protectedNegativeQueries: queryMatrix.reduce((sum, row) => sum + row.protectedNegativeQueries.length, 0),
    boundaryClasses: boundaries.length,
    minActiveSellingRowsTarget: safeRows.reduce((sum, row) => sum + row.minActiveSellingRows, 0),
    acceptedObservationCandidateRows: simulation.metrics.acceptedObservationCandidateRows,
    preservedManualRows: simulation.metrics.preservedManualRows,
    preservedHoldRows: simulation.metrics.preservedHoldRows,
    blockedTitleSpecConflictRows: simulation.metrics.blockedTitleSpecConflictRows,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
    runtimeApplyRows: 0,
    liveDbWriteRows: 0,
    dbAccessRows: 0,
  },
  queryMatrix,
  boundaryContract: boundaries,
  observationRules: [
    "Count only active/selling rows with title-visible exact model code and monitor body context.",
    "Use source-backed spec as verification; title refresh/resolution conflicts become manual_review or hold.",
    "Do not use no-write observations for public promotion, candidate pool writes, runtime apply, or DB mutation.",
    "Manual-only and hold rows may calibrate boundaries but must not contribute to positive counts.",
  ],
  stopConditions: [
    "Stop if any accessory/stand/adapter row classifies as accepted observation.",
    "Stop if any damaged, buying, sold, reserved, or stale row contributes to positive counts.",
    "Stop if title spec conflicts are accepted without manual review.",
    "Stop if sourceConfidence=low rows become selected positives.",
    "Stop if writeTargetsTouched is non-empty in any downstream runner.",
  ],
};

mkdirSync(reportsDir, { recursive: true });
const jsonPath = path.join(reportsDir, "monitor-selected-exact-model-no-write-observation-design-latest.json");
const mdPath = path.join(reportsDir, "monitor-selected-exact-model-no-write-observation-design-latest.md");
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(mdPath, buildMarkdown(report));

console.log(
  JSON.stringify(
    {
      conclusion: report.conclusion,
      selectedSafeModels: report.metrics.selectedSafeModels,
      manualOnlyModels: report.metrics.manualOnlyModels,
      holdModels: report.metrics.holdModels,
      queryMatrixRows: report.metrics.queryMatrixRows,
      runtimeApprovedRows: report.runtimeApprovedRows,
      candidatePoolRows: report.candidatePoolRows,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
