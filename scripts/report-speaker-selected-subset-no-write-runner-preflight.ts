import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type FixtureBackfill = {
  conclusion: string;
  boundary: Boundary;
  metrics: {
    selectedModels: number;
    positiveFixtureRows: number;
    holdFixtureRows: number;
    exclusionMatrixRows: number;
    publicGateClosed: boolean;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
  positiveFixtures: Array<{
    caseId: string;
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
  exclusionMatrix: Array<{
    boundaryClass: string;
    expectedRunnerDecision: "hold" | "manual_review";
    fixtureRows: number;
    titleSignals: string[];
    runnerAssertion: string;
  }>;
  publicGateClosedAudit: {
    publicGateClosed: boolean;
    hardFailFindings: number;
    forbiddenTrueFlags: number;
    forbiddenPositiveCounts: number;
    speakerAuditForbiddenTrueFlags: number;
    speakerAuditForbiddenPositiveCounts: number;
  };
};

type RunnerDesign = {
  conclusion: string;
  boundary: Boundary & { noLiveFetchImplementation: boolean };
  metrics: {
    selectedModels: number;
    queryMatrixRows: number;
    expectedMinimumActiveSellingRows: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
  queryMatrix: Array<{
    normalizedModel: string;
    expectedComparableKey: string;
    primaryQueries: string[];
    variantQueries: string[];
    protectedNegativeQueries: string[];
    minActiveSellingRows: number;
    seedPrice: number;
  }>;
  staleLiveInterpretation: string[];
  stopConditions: string[];
};

type CategoryOrchestration = {
  reportOnly: boolean;
  publicPromotion: boolean;
  runtimeCatalogApply: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  candidates: Array<{
    lane: string;
    status: string;
    blocker: string;
    nextAction: string;
  }>;
};

type BoundaryAudit = {
  auditStatus: string;
  metrics: {
    hardFailFindings: number;
    warningFindings: number;
    forbiddenTrueFlags: number;
    forbiddenPositiveCounts: number;
    directThirtyDayPlanRisks: number;
    boundaryGapWarnings: number;
  };
};

type Boundary = {
  reportOnly?: boolean;
  runtimeCatalogApply?: boolean;
  runtimeApply?: boolean;
  publicPromotion?: boolean;
  candidatePoolPolicyWiring?: boolean;
  productionDbMutation?: boolean;
  directThirtyDayPlanEdit?: boolean;
  runtimeApprovedRows: number;
  publicPromotionRows: number;
  candidatePoolRows: number;
  runtimeApplyRows: number;
};

type PreflightCheck = {
  id: string;
  status: "pass" | "fail";
  check: string;
  detail: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "speaker-selected-subset-no-write-runner-preflight-latest.json");
const outputMdPath = path.join(reportsDir, "speaker-selected-subset-no-write-runner-preflight-latest.md");

const inputFiles = {
  fixtureSourceBackfillJson: "reports/speaker-selected-subset-runner-fixture-source-backfill-latest.json",
  fixtureSourceBackfillMd: "reports/speaker-selected-subset-runner-fixture-source-backfill-latest.md",
  runnerDesignJson: "reports/speaker-selected-subset-no-write-live-market-dry-run-runner-design-latest.json",
  runnerDesignMd: "reports/speaker-selected-subset-no-write-live-market-dry-run-runner-design-latest.md",
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
          rows: Array.isArray(parsed.positiveFixtures)
            ? parsed.positiveFixtures.length
            : Array.isArray(parsed.queryMatrix)
              ? parsed.queryMatrix.length
              : null,
        },
      ] as const;
    }),
  );
  return Object.fromEntries(entries);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
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

function buildChecks(input: {
  fixtureBackfill: FixtureBackfill;
  runnerDesign: RunnerDesign;
  orchestration: CategoryOrchestration;
  audit: BoundaryAudit;
  handoffMd: string;
}): PreflightCheck[] {
  const { fixtureBackfill, runnerDesign, orchestration, audit, handoffMd } = input;
  const speakerCandidate = orchestration.candidates.find((candidate) => candidate.lane === "speaker_portable_exact_model");
  const requiredHoldClasses = [
    "accessory_case_stand",
    "amp_receiver",
    "soundbar",
    "karaoke_pa",
    "buying_sold_only",
    "home_tabletop_manual",
    "vendor_only_manual",
  ];
  const holdClasses = unique(fixtureBackfill.holdFixtures.map((row) => row.boundaryClass));
  return [
    {
      id: "PREFLIGHT-01",
      status: fixtureBackfill.metrics.positiveFixtureRows === 5 && runnerDesign.metrics.selectedModels === 5 ? "pass" : "fail",
      check: "selected JBL/LG positive fixtures are present",
      detail: `${fixtureBackfill.metrics.positiveFixtureRows} positive fixtures / ${runnerDesign.metrics.selectedModels} selected models`,
    },
    {
      id: "PREFLIGHT-02",
      status: requiredHoldClasses.every((boundaryClass) => holdClasses.includes(boundaryClass)) ? "pass" : "fail",
      check: "required hold boundaries are preserved",
      detail: holdClasses.join(", "),
    },
    {
      id: "PREFLIGHT-03",
      status: runnerDesign.boundary.noLiveFetchImplementation ? "pass" : "fail",
      check: "preflight remains supplied-input only",
      detail: `noLiveFetchImplementation=${runnerDesign.boundary.noLiveFetchImplementation}`,
    },
    {
      id: "PREFLIGHT-04",
      status:
        fixtureBackfill.metrics.publicGateClosed &&
        orchestration.reportOnly &&
        !orchestration.publicPromotion &&
        !orchestration.runtimeCatalogApply &&
        !orchestration.candidatePoolPolicyWiring &&
        !orchestration.productionDbMutation
          ? "pass"
          : "fail",
      check: "public gate remains closed in orchestration",
      detail: [
        `speakerStatus=${speakerCandidate?.status ?? "missing speaker candidate"}`,
        `publicPromotion=${orchestration.publicPromotion}`,
        `candidatePoolPolicyWiring=${orchestration.candidatePoolPolicyWiring}`,
        `productionDbMutation=${orchestration.productionDbMutation}`,
      ].join("; "),
    },
    {
      id: "PREFLIGHT-05",
      status:
        audit.metrics.hardFailFindings === 0 &&
        audit.metrics.forbiddenTrueFlags === 0 &&
        audit.metrics.forbiddenPositiveCounts === 0
          ? "pass"
          : "fail",
      check: "boundary audit has no forbidden apply signals",
      detail: `audit=${audit.auditStatus}; forbiddenTrue=${audit.metrics.forbiddenTrueFlags}; forbiddenCounts=${audit.metrics.forbiddenPositiveCounts}`,
    },
    {
      id: "PREFLIGHT-06",
      status: zeroRuntimeCounts(fixtureBackfill.boundary, runnerDesign.boundary) ? "pass" : "fail",
      check: "runtime/public/candidate/runtimeApply rows are zero in inputs",
      detail: "fixtureSourceBackfill + runnerDesign row counts are 0/0/0/0",
    },
    {
      id: "PREFLIGHT-07",
      status: handoffMd.includes("public 승격이 아니라 internal/report 단계까지만") ? "pass" : "fail",
      check: "handoff confirms internal/report-only category posture",
      detail: "인수인계.md report-only/public-ban signal checked",
    },
  ];
}

function markdownEscape(value: string | number | boolean | null | undefined): string {
  return String(value ?? "null").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function buildMarkdown(report: Record<string, unknown>): string {
  const boundary = report.boundary as Record<string, unknown>;
  const metrics = report.metrics as Record<string, unknown>;
  const checks = report.preflightChecks as PreflightCheck[];
  const suppliedInputRows = report.suppliedInputRows as Array<Record<string, string>>;
  const holdPolicy = report.preservedHoldBoundaries as Array<Record<string, unknown>>;

  return `${[
    "# Speaker Selected Subset No-Write Runner Preflight",
    "",
    `- generatedAt: ${report.generatedAt}`,
    "- category: speaker_audio_discovered",
    "- lane: speaker_selected_subset_no_write_runner_preflight",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    `- reportOnly: ${boundary.reportOnly}`,
    `- suppliedInputOnly: ${boundary.suppliedInputOnly}`,
    `- noLiveFetchImplementation: ${boundary.noLiveFetchImplementation}`,
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
    `- selectedModels: ${metrics.selectedModels}`,
    `- suppliedPositiveFixtureRows: ${metrics.suppliedPositiveFixtureRows}`,
    `- suppliedHoldFixtureRows: ${metrics.suppliedHoldFixtureRows}`,
    `- preservedHoldBoundaryClasses: ${metrics.preservedHoldBoundaryClasses}`,
    `- preflightChecks: ${metrics.preflightChecks}`,
    `- failedChecks: ${metrics.failedChecks}`,
    `- publicGateClosed: ${metrics.publicGateClosed}`,
    `- canRunSuppliedInputNoWriteRunnerLater: ${metrics.canRunSuppliedInputNoWriteRunnerLater}`,
    `- runtimeApprovedRows: ${metrics.runtimeApprovedRows}`,
    `- publicPromotionRows: ${metrics.publicPromotionRows}`,
    `- candidatePoolRows: ${metrics.candidatePoolRows}`,
    `- runtimeApplyRows: ${metrics.runtimeApplyRows}`,
    "",
    "## Supplied Input Rows",
    "",
    "| model | expectedComparableKey | fixtureCaseId | expectedDecision |",
    "| --- | --- | --- | --- |",
    ...suppliedInputRows.map(
      (row) =>
        `| ${row.normalizedModel} | ${markdownEscape(row.expectedComparableKey)} | ${row.fixtureCaseId} | ${row.expectedDecision} |`,
    ),
    "",
    "## Preserved Hold Boundaries",
    "",
    "| boundaryClass | expectedRunnerDecision | fixtureRows |",
    "| --- | --- | ---: |",
    ...holdPolicy.map(
      (row) => `| ${row.boundaryClass} | ${row.expectedRunnerDecision} | ${row.fixtureRows} |`,
    ),
    "",
    "## Preflight Checks",
    "",
    "| id | status | check | detail |",
    "| --- | --- | --- | --- |",
    ...checks.map((row) => `| ${row.id} | ${row.status} | ${markdownEscape(row.check)} | ${markdownEscape(row.detail)} |`),
    "",
    "## Runner Guardrails",
    "",
    ...(report.runnerGuardrails as string[]).map((line) => `- ${line}`),
    "",
  ].join("\n")}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const inputReadSummary = await readInputs();
  const [fixtureBackfill, runnerDesign, orchestration, audit, handoffMd] = await Promise.all([
    readJson<FixtureBackfill>(inputFiles.fixtureSourceBackfillJson),
    readJson<RunnerDesign>(inputFiles.runnerDesignJson),
    readJson<CategoryOrchestration>(inputFiles.categoryOrchestrationJson),
    readJson<BoundaryAudit>(inputFiles.orchestrationBoundaryAuditJson),
    readText(inputFiles.handoffMd),
  ]);
  const checks = buildChecks({ fixtureBackfill, runnerDesign, orchestration, audit, handoffMd });
  const failedChecks = checks.filter((check) => check.status === "fail");
  const runtimeApprovedRows = fixtureBackfill.metrics.runtimeApprovedRows + runnerDesign.metrics.runtimeApprovedRows;
  const publicPromotionRows = fixtureBackfill.metrics.publicPromotionRows + runnerDesign.metrics.publicPromotionRows;
  const candidatePoolRows = fixtureBackfill.metrics.candidatePoolRows + runnerDesign.metrics.candidatePoolRows;
  const runtimeApplyRows = fixtureBackfill.metrics.runtimeApplyRows + runnerDesign.metrics.runtimeApplyRows;
  const holdClasses = unique(fixtureBackfill.holdFixtures.map((row) => row.boundaryClass));
  const boundary = {
    reportOnly: true,
    suppliedInputOnly: true,
    noLiveFetchImplementation: true,
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
  const suppliedInputRows = fixtureBackfill.positiveFixtures.map((fixture) => ({
    normalizedModel: fixture.normalizedModel,
    expectedComparableKey: fixture.expectedComparableKey,
    fixtureCaseId: fixture.caseId,
    expectedDecision: fixture.expectedDecision,
  }));
  const preservedHoldBoundaries = fixtureBackfill.exclusionMatrix.map((row) => ({
    boundaryClass: row.boundaryClass,
    expectedRunnerDecision: row.expectedRunnerDecision,
    fixtureRows: row.fixtureRows,
  }));
  const metrics = {
    selectedModels: runnerDesign.metrics.selectedModels,
    suppliedPositiveFixtureRows: fixtureBackfill.metrics.positiveFixtureRows,
    suppliedHoldFixtureRows: fixtureBackfill.metrics.holdFixtureRows,
    preservedHoldBoundaryClasses: holdClasses.length,
    queryMatrixRows: runnerDesign.metrics.queryMatrixRows,
    preflightChecks: checks.length,
    failedChecks: failedChecks.length,
    publicGateClosed: fixtureBackfill.metrics.publicGateClosed && fixtureBackfill.publicGateClosedAudit.publicGateClosed,
    canRunSuppliedInputNoWriteRunnerLater: failedChecks.length === 0,
    runtimeApprovedRows,
    publicPromotionRows,
    candidatePoolRows,
    runtimeApplyRows,
  };
  const report = {
    generatedAt,
    reportOnly: true,
    ownership: "speaker_portable_exact_model_supplied_input_no_write_runner_preflight_only",
    category: "speaker_audio_discovered",
    lane: "speaker_selected_subset_no_write_runner_preflight",
    conclusion:
      failedChecks.length === 0
        ? "supplied_input_no_write_runner_preflight_passed_report_only_public_gate_closed"
        : "supplied_input_no_write_runner_preflight_blocked_report_only",
    boundary,
    inputFiles,
    inputReadSummary,
    sourceConclusions: {
      fixtureSourceBackfill: fixtureBackfill.conclusion,
      runnerDesign: runnerDesign.conclusion,
    },
    metrics,
    suppliedInputSchema: {
      mode: "supplied_input_only_no_write",
      rows: [
        {
          fixtureCaseId: "string",
          title: "string",
          normalizedModel: "selected JBL/LG model or null",
          expectedComparableKey: "speaker|...|portable_bluetooth_speaker or null",
          expectedDecision: "live_positive_if_sale_status_selling|hold|manual_review",
          saleStatus: "supplied status only; no live lookup",
          boundaryClass: "string|null",
          runtimeApproved: false,
          publicPromotion: false,
          candidatePool: false,
          runtimeApply: false,
        },
      ],
    },
    suppliedInputRows,
    preservedHoldBoundaries,
    preflightChecks: checks,
    failedChecks,
    runnerGuardrails: [
      "Do not fetch live market data in this preflight packet.",
      "Do not write Supabase/DB or touch source-health/cron/lifecycle.",
      "Accept only supplied fixture rows for selected JBL/LG exact portable models.",
      "Preserve accessory, amp/receiver, soundbar, karaoke/PA, sold/buying, home-tabletop, and vendor-only holds.",
      "Keep public promotion, candidate pool, runtime apply, and runtime approval false/0.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  JSON.parse(json);
  await writeFile(outputJsonPath, json);
  await writeFile(outputMdPath, buildMarkdown(report));

  console.log(`wrote ${path.relative(appDir, outputJsonPath)}`);
  console.log(`wrote ${path.relative(appDir, outputMdPath)}`);
  console.log(`speaker supplied-input preflight: checks=${checks.length}, failed=${failedChecks.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
