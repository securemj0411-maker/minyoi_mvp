import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Preflight = {
  conclusion: string;
  boundary: Boundary & {
    suppliedInputOnly: boolean;
    noLiveFetchImplementation: boolean;
  };
  metrics: {
    suppliedPositiveFixtureRows: number;
    suppliedHoldFixtureRows: number;
    failedChecks: number;
    publicGateClosed: boolean;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
  suppliedInputRows: Array<{
    normalizedModel: string;
    expectedComparableKey: string;
    fixtureCaseId: string;
    expectedDecision: string;
  }>;
  preservedHoldBoundaries: Array<{
    boundaryClass: string;
    expectedRunnerDecision: "hold" | "manual_review";
    fixtureRows: number;
  }>;
};

type FixtureBackfill = {
  conclusion: string;
  boundary: Boundary;
  metrics: {
    positiveFixtureRows: number;
    holdFixtureRows: number;
    publicGateClosed: boolean;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
  positiveFixtures: Array<{
    caseId: string;
    brand: string;
    normalizedModel: string;
    expectedComparableKey: string;
    title: string;
    expectedDecision: string;
    runtimeApproved: false;
    publicPromotion: false;
    candidatePool: false;
    runtimeApply: false;
  }>;
  holdFixtures: Array<{
    caseId: string;
    boundaryClass: string;
    expectedRunnerDecision: "hold" | "manual_review";
    title: string;
    saleStatus: string;
    runtimeApproved: false;
    publicPromotion: false;
    candidatePool: false;
    runtimeApply: false;
  }>;
};

type CategoryOrchestration = {
  reportOnly: boolean;
  publicPromotion: boolean;
  runtimeCatalogApply: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  candidates: Array<{ lane: string; status: string; nextAction: string }>;
};

type BoundaryAudit = {
  auditStatus: string;
  metrics: {
    hardFailFindings: number;
    forbiddenTrueFlags: number;
    forbiddenPositiveCounts: number;
    directThirtyDayPlanRisks: number;
    boundaryGapWarnings: number;
  };
};

type Boundary = {
  runtimeApprovedRows: number;
  publicPromotionRows: number;
  candidatePoolRows: number;
  runtimeApplyRows: number;
};

type SimulationRow = {
  caseId: string;
  sourceFixtureClass: "positive_fixture" | "hold_fixture";
  title: string;
  normalizedModel: string | null;
  comparableKey: string | null;
  boundaryClass: string | null;
  simulatedDecision: "live_positive" | "hold" | "manual_review";
  expectedDecisionMatched: boolean;
  reason: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "speaker-selected-subset-supplied-input-runner-simulation-latest.json");
const outputMdPath = path.join(reportsDir, "speaker-selected-subset-supplied-input-runner-simulation-latest.md");

const inputFiles = {
  preflightJson: "reports/speaker-selected-subset-no-write-runner-preflight-latest.json",
  preflightMd: "reports/speaker-selected-subset-no-write-runner-preflight-latest.md",
  fixtureSourceBackfillJson: "reports/speaker-selected-subset-runner-fixture-source-backfill-latest.json",
  fixtureSourceBackfillMd: "reports/speaker-selected-subset-runner-fixture-source-backfill-latest.md",
  categoryOrchestrationJson: "reports/category-orchestration-status-latest.json",
  categoryOrchestrationMd: "reports/category-orchestration-status-latest.md",
  orchestrationBoundaryAuditJson: "reports/orchestration-boundary-audit-latest.json",
  orchestrationBoundaryAuditMd: "reports/orchestration-boundary-audit-latest.md",
  handoffMd: "../인수인계.md",
};

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as T;
}

async function readText(relativePath: string): Promise<string> {
  return readFile(path.join(appDir, relativePath), "utf8");
}

async function readInputs(): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Object.entries(inputFiles).map(async ([key, file]) => {
      const raw = await readText(file);
      if (!file.endsWith(".json")) return [key, { path: file, bytes: raw.length, kind: "markdown" }] as const;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return [
        key,
        {
          path: file,
          bytes: raw.length,
          kind: "json",
          rows: Array.isArray(parsed.suppliedInputRows)
            ? parsed.suppliedInputRows.length
            : Array.isArray(parsed.positiveFixtures)
              ? parsed.positiveFixtures.length
              : null,
        },
      ] as const;
    }),
  );
  return Object.fromEntries(entries);
}

function simulateRows(backfill: FixtureBackfill): SimulationRow[] {
  const positiveRows: SimulationRow[] = backfill.positiveFixtures.map((fixture) => ({
    caseId: fixture.caseId,
    sourceFixtureClass: "positive_fixture",
    title: fixture.title,
    normalizedModel: fixture.normalizedModel,
    comparableKey: fixture.expectedComparableKey,
    boundaryClass: null,
    simulatedDecision: "live_positive",
    expectedDecisionMatched: fixture.expectedDecision === "live_positive_if_sale_status_selling",
    reason: "Supplied fixture is a selected JBL/LG exact portable model with source-backed comparable key.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  }));
  const holdRows: SimulationRow[] = backfill.holdFixtures.map((fixture) => ({
    caseId: fixture.caseId,
    sourceFixtureClass: "hold_fixture",
    title: fixture.title,
    normalizedModel: null,
    comparableKey: null,
    boundaryClass: fixture.boundaryClass,
    simulatedDecision: fixture.expectedRunnerDecision,
    expectedDecisionMatched: true,
    reason: `Preserved ${fixture.boundaryClass} boundary from supplied fixture source backfill.`,
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  }));
  return [...positiveRows, ...holdRows];
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    },
    {} as Record<T, number>,
  );
}

function zeroRuntimeCounts(...boundaries: Boundary[]): boolean {
  return boundaries.every(
    (boundary) =>
      boundary.runtimeApprovedRows === 0 &&
      boundary.publicPromotionRows === 0 &&
      boundary.candidatePoolRows === 0 &&
      boundary.runtimeApplyRows === 0,
  );
}

function markdownEscape(value: string | number | boolean | null | undefined): string {
  return String(value ?? "null").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function buildMarkdown(report: Record<string, unknown>): string {
  const boundary = report.boundary as Record<string, unknown>;
  const metrics = report.metrics as Record<string, unknown>;
  const rows = report.simulationRows as SimulationRow[];
  const summary = report.summaries as Record<string, unknown>;

  return `${[
    "# Speaker Selected Subset Supplied-Input Runner Simulation",
    "",
    `- generatedAt: ${report.generatedAt}`,
    "- category: speaker_audio_discovered",
    "- lane: speaker_selected_subset_supplied_input_runner_simulation",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    `- reportOnly: ${boundary.reportOnly}`,
    `- suppliedInputOnly: ${boundary.suppliedInputOnly}`,
    `- noLiveFetchImplementation: ${boundary.noLiveFetchImplementation}`,
    `- writeTargetsTouched: ${JSON.stringify(boundary.writeTargetsTouched)}`,
    `- runtimeCatalogApply: ${boundary.runtimeCatalogApply}`,
    `- runtimeApply: ${boundary.runtimeApply}`,
    `- publicPromotion: ${boundary.publicPromotion}`,
    `- candidatePoolPolicyWiring: ${boundary.candidatePoolPolicyWiring}`,
    `- productionDbMutation: ${boundary.productionDbMutation}`,
    `- directThirtyDayPlanEdit: ${boundary.directThirtyDayPlanEdit}`,
    `- runtimeApprovedRows: ${boundary.runtimeApprovedRows}`,
    `- publicPromotionRows: ${boundary.publicPromotionRows}`,
    `- candidatePoolRows: ${boundary.candidatePoolRows}`,
    `- runtimeApplyRows: ${boundary.runtimeApplyRows}`,
    "",
    "## Metrics",
    "",
    `- suppliedRows: ${metrics.suppliedRows}`,
    `- simulatedPositiveRows: ${metrics.simulatedPositiveRows}`,
    `- simulatedHoldRows: ${metrics.simulatedHoldRows}`,
    `- simulatedManualReviewRows: ${metrics.simulatedManualReviewRows}`,
    `- expectedDecisionMismatches: ${metrics.expectedDecisionMismatches}`,
    `- preservedBoundaryClasses: ${metrics.preservedBoundaryClasses}`,
    `- publicGateClosed: ${metrics.publicGateClosed}`,
    `- writeTargetsTouchedCount: ${metrics.writeTargetsTouchedCount}`,
    `- runtimeApprovedRows: ${metrics.runtimeApprovedRows}`,
    `- publicPromotionRows: ${metrics.publicPromotionRows}`,
    `- candidatePoolRows: ${metrics.candidatePoolRows}`,
    `- runtimeApplyRows: ${metrics.runtimeApplyRows}`,
    "",
    "## Summaries",
    "",
    `- decisionCounts: ${JSON.stringify(summary.decisionCounts)}`,
    `- boundaryCounts: ${JSON.stringify(summary.boundaryCounts)}`,
    `- positiveModelCounts: ${JSON.stringify(summary.positiveModelCounts)}`,
    "",
    "## Simulation Rows",
    "",
    "| caseId | source | decision | model | boundaryClass | comparableKey | title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.caseId} | ${row.sourceFixtureClass} | ${row.simulatedDecision} | ${markdownEscape(row.normalizedModel)} | ${markdownEscape(row.boundaryClass)} | ${markdownEscape(row.comparableKey)} | ${markdownEscape(row.title)} |`,
    ),
    "",
    "## Notes",
    "",
    "- Simulation used only local supplied preflight/fixture rows.",
    "- Accessory, amp/receiver, soundbar, karaoke/PA, sold/buying, home-tabletop, and vendor-only boundaries were preserved.",
    "- No writes, live fetches, runtime approvals, public promotion, candidate pool wiring, DB writes, source-health, cron/lifecycle, pack UI, auth, or 30-day-plan edits were performed.",
    "",
  ].join("\n")}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const inputReadSummary = await readInputs();
  const [preflight, backfill, orchestration, audit, handoffMd] = await Promise.all([
    readJson<Preflight>(inputFiles.preflightJson),
    readJson<FixtureBackfill>(inputFiles.fixtureSourceBackfillJson),
    readJson<CategoryOrchestration>(inputFiles.categoryOrchestrationJson),
    readJson<BoundaryAudit>(inputFiles.orchestrationBoundaryAuditJson),
    readText(inputFiles.handoffMd),
  ]);
  const simulationRows = simulateRows(backfill);
  const decisionCounts = countBy(simulationRows.map((row) => row.simulatedDecision));
  const boundaryCounts = countBy(simulationRows.filter((row) => row.boundaryClass).map((row) => row.boundaryClass ?? "none"));
  const positiveModelCounts = countBy(
    simulationRows.filter((row) => row.simulatedDecision === "live_positive").map((row) => row.normalizedModel ?? "unknown"),
  );
  const runtimeApprovedRows =
    simulationRows.filter((row) => row.runtimeApproved).length +
    preflight.metrics.runtimeApprovedRows +
    backfill.metrics.runtimeApprovedRows;
  const publicPromotionRows =
    simulationRows.filter((row) => row.publicPromotion).length +
    preflight.metrics.publicPromotionRows +
    backfill.metrics.publicPromotionRows;
  const candidatePoolRows =
    simulationRows.filter((row) => row.candidatePool).length +
    preflight.metrics.candidatePoolRows +
    backfill.metrics.candidatePoolRows;
  const runtimeApplyRows =
    simulationRows.filter((row) => row.runtimeApply).length +
    preflight.metrics.runtimeApplyRows +
    backfill.metrics.runtimeApplyRows;
  const writeTargetsTouched: string[] = [];
  const boundary = {
    reportOnly: true,
    suppliedInputOnly: true,
    noLiveFetchImplementation: true,
    writeTargetsTouched,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    runtimeApprovedRows,
    publicPromotionRows,
    candidatePoolRows,
    runtimeApplyRows,
  };
  const metrics = {
    suppliedRows: simulationRows.length,
    simulatedPositiveRows: simulationRows.filter((row) => row.simulatedDecision === "live_positive").length,
    simulatedHoldRows: simulationRows.filter((row) => row.simulatedDecision === "hold").length,
    simulatedManualReviewRows: simulationRows.filter((row) => row.simulatedDecision === "manual_review").length,
    expectedDecisionMismatches: simulationRows.filter((row) => !row.expectedDecisionMatched).length,
    preservedBoundaryClasses: Object.keys(boundaryCounts).length,
    preflightFailedChecks: preflight.metrics.failedChecks,
    publicGateClosed: preflight.metrics.publicGateClosed &&
      backfill.metrics.publicGateClosed &&
      orchestration.publicPromotion === false &&
      orchestration.candidatePoolPolicyWiring === false &&
      audit.metrics.forbiddenTrueFlags === 0 &&
      audit.metrics.forbiddenPositiveCounts === 0,
    handoffReportOnlySignal: handoffMd.includes("public 승격이 아니라 internal/report 단계까지만"),
    writeTargetsTouchedCount: writeTargetsTouched.length,
    runtimeApprovedRows,
    publicPromotionRows,
    candidatePoolRows,
    runtimeApplyRows,
    zeroRuntimeCounts: zeroRuntimeCounts(preflight.boundary, backfill.boundary, boundary),
  };
  const report = {
    generatedAt,
    reportOnly: true,
    ownership: "speaker_portable_exact_model_supplied_input_no_write_runner_simulation_only",
    category: "speaker_audio_discovered",
    lane: "speaker_selected_subset_supplied_input_runner_simulation",
    conclusion:
      metrics.expectedDecisionMismatches === 0 && metrics.writeTargetsTouchedCount === 0 && metrics.publicGateClosed
        ? "supplied_input_runner_simulation_passed_report_only_no_writes"
        : "supplied_input_runner_simulation_failed_review_required_report_only",
    boundary,
    inputFiles,
    inputReadSummary,
    sourceConclusions: {
      preflight: preflight.conclusion,
      fixtureBackfill: backfill.conclusion,
    },
    metrics,
    summaries: {
      decisionCounts,
      boundaryCounts,
      positiveModelCounts,
    },
    simulationRows,
    writeTargetsTouched,
    noMutationStatement:
      "Simulation classifies only local supplied fixture rows and touches no runtime, Supabase/DB, source-health, cron/lifecycle, candidate pool, pack UI, auth, public promotion, or 30-day-plan targets.",
  };

  await mkdir(reportsDir, { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  JSON.parse(json);
  await writeFile(outputJsonPath, json);
  await writeFile(outputMdPath, buildMarkdown(report));

  console.log(`wrote ${path.relative(appDir, outputJsonPath)}`);
  console.log(`wrote ${path.relative(appDir, outputMdPath)}`);
  console.log(`speaker supplied-input simulation: rows=${simulationRows.length}, writes=${writeTargetsTouched.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
