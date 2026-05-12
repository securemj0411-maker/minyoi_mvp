import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SourceTier = "official_product" | "official_support" | "official_manual" | "trusted_secondary" | "source_not_confirmed";
type SourceReadiness = "safe_internal_no_write_observation" | "manual_observation_only" | "hold_required";
type RunnerPreflightStatus = "runner_design_ready" | "preserved_manual_only" | "preserved_hold";

type SourceConfidenceRow = {
  caseId: string;
  modelCode: string;
  brandModel: string;
  titleExample: string | null;
  sourceTier: SourceTier;
  sourceUrl: string | null;
  sourceConfidence: "high" | "medium" | "low";
  sourceVerifiedSpec: {
    size: string;
    resolution: string;
    refresh: string;
    panel: string;
    shape: string;
  };
  existingReportBucket: string;
  observationReadiness: SourceReadiness;
  holdReason: string | null;
  noWriteObservationRule: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePoolReady: false;
  runtimeApply: false;
};

type SourceConfidenceReport = {
  metrics: {
    safeInternalNoWriteObservationRows: number;
    manualObservationOnlyRows: number;
    holdRequiredRows: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
  rows: SourceConfidenceRow[];
  conclusion: string;
};

type RunnerRow = {
  caseId: string;
  modelCode: string;
  brandModel: string;
  preflightStatus: RunnerPreflightStatus;
  sourceReadiness: SourceReadiness;
  sourceTier: SourceTier;
  sourceUrl: string | null;
  queryPlan: {
    targetedSearchTerms: string[];
    titleMustContainAny: string[];
    titleOrDescriptionMaySupport: string[];
    marketReadMode: "read_only_listing_observation_design";
    writeMode: "none";
  } | null;
  acceptSafeguards: string[];
  rejectSafeguards: string[];
  titleSpecConflictSafeguards: string[];
  expectedSpec: SourceConfidenceRow["sourceVerifiedSpec"];
  preservedReason: string | null;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePoolReady: false;
  runtimeApply: false;
  dbMutation: false;
  sourceHealthMutation: false;
};

type JsonReport = Record<string, unknown>;

type Report = {
  generatedAt: string;
  reportOnly: true;
  runtimeCatalogApply: false;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  sourceHealthMutation: false;
  directThirtyDayPlanEdit: false;
  category: "monitor_discovered";
  lane: "monitor_selected_exact_model_no_write_runner_preflight";
  inputFiles: string[];
  inputReadSummary: Record<string, unknown>;
  metrics: {
    sourceSafeRows: number;
    sourceManualRows: number;
    sourceHoldRows: number;
    runnerDesignReadyRows: number;
    preservedManualRows: number;
    preservedHoldRows: number;
    titleSpecConflictGuardRows: number;
    runtimeApprovedRows: 0;
    publicPromotionRows: 0;
    candidatePoolRows: 0;
    runtimeApplyRows: 0;
    dbMutationRows: 0;
    sourceHealthMutationRows: 0;
  };
  runnerRows: RunnerRow[];
  runnerContract: string[];
  blockedOwnerDecisions: string[];
  conclusion: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "monitor-selected-exact-model-no-write-runner-preflight-latest.json");
const outputMdPath = path.join(reportsDir, "monitor-selected-exact-model-no-write-runner-preflight-latest.md");

const inputFiles = [
  "../인수인계.md",
  "reports/monitor-selected-exact-model-source-confidence-latest.json",
  "reports/monitor-selected-exact-model-source-confidence-latest.md",
  "reports/monitor-selected-model-backfill-latest.json",
  "reports/monitor-model-code-spec-evidence-packet-latest.json",
  "reports/monitor-selected-model-runtime-dry-run-latest.json",
  "reports/monitor-no-mutation-runtime-dry-run-latest.json",
  "reports/category-orchestration-status-latest.json",
  "reports/orchestration-boundary-audit-latest.json",
];

const modelQueryAliases: Record<string, string[]> = {
  xl2540k: ["XL2540K", "벤큐 XL2540K", "ZOWIE XL2540K"],
  "27us550": ["27US550", "27US550-W", "LG 27US550"],
  ls27f354fhk: ["LS27F354FHK", "S27F354FHK", "LS27F354FHKXKR"],
  "39gx900a": ["39GX900A", "39GX900A-B", "LG 39GX900A"],
  aw2525hm: ["AW2525HM", "Alienware AW2525HM", "델 AW2525HM"],
  "27gl650f": ["27GL650F", "27GL650F-B", "LG 27GL650F"],
};

function titleMustContainAny(row: SourceConfidenceRow): string[] {
  return modelQueryAliases[row.modelCode] ?? [row.modelCode.toUpperCase()];
}

function titleOrDescriptionMaySupport(row: SourceConfidenceRow): string[] {
  const spec = row.sourceVerifiedSpec;
  return [spec.size, spec.resolution, spec.refresh, spec.panel, spec.shape].filter((value) => !value.startsWith("unknown"));
}

function baseAcceptSafeguards(row: SourceConfidenceRow): string[] {
  return [
    `Title-visible exact model token required: ${titleMustContainAny(row).join(" / ")}.`,
    "Listing must be an active monitor body sale, not sold/buying/repair-only/accessory-only.",
    "Description may support spec tokens, but cannot replace a missing title-visible exact model.",
    `Expected source-backed spec remains ${row.sourceVerifiedSpec.size}, ${row.sourceVerifiedSpec.resolution}, ${row.sourceVerifiedSpec.refresh}, ${row.sourceVerifiedSpec.panel}, ${row.sourceVerifiedSpec.shape}.`,
  ];
}

function baseRejectSafeguards(): string[] {
  return [
    "Reject monitor arms, stands, adapters, panels, parts, manuals, or boxed accessories.",
    "Reject portable/generic monitor rows when exact model token is absent.",
    "Reject TV-monitor hybrids, PC bundles/full-set rows, and shop/configurable-template rows.",
    "Reject rows whose title-visible model belongs to an adjacent model family or generation.",
  ];
}

function titleSpecConflictSafeguards(row: SourceConfidenceRow): string[] {
  return [
    "If title refresh/resolution/size conflicts with official source-backed spec, route to hold instead of count.",
    "If title contains a higher refresh token than the verified model spec, preserve the listing for manual review only.",
    "If title has exact model but description indicates another model code, route to hold as mixed-model evidence.",
    row.modelCode === "39gx900a"
      ? "Curved ultrawide/OLED shape must remain an explicit axis; do not compare with flat 39in or non-OLED rows."
      : "Shape/panel must remain literal unless owner later approves a broader panel-family mapping.",
  ];
}

function toRunnerRow(row: SourceConfidenceRow): RunnerRow {
  if (row.observationReadiness === "safe_internal_no_write_observation") {
    return {
      caseId: row.caseId.replace("SOURCE-CONF", "RUNNER-PREFLIGHT"),
      modelCode: row.modelCode,
      brandModel: row.brandModel,
      preflightStatus: "runner_design_ready",
      sourceReadiness: row.observationReadiness,
      sourceTier: row.sourceTier,
      sourceUrl: row.sourceUrl,
      queryPlan: {
        targetedSearchTerms: titleMustContainAny(row),
        titleMustContainAny: titleMustContainAny(row),
        titleOrDescriptionMaySupport: titleOrDescriptionMaySupport(row),
        marketReadMode: "read_only_listing_observation_design",
        writeMode: "none",
      },
      acceptSafeguards: baseAcceptSafeguards(row),
      rejectSafeguards: baseRejectSafeguards(),
      titleSpecConflictSafeguards: titleSpecConflictSafeguards(row),
      expectedSpec: row.sourceVerifiedSpec,
      preservedReason: null,
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
      runtimeApply: false,
      dbMutation: false,
      sourceHealthMutation: false,
    };
  }

  return {
    caseId: row.caseId.replace("SOURCE-CONF", "RUNNER-PREFLIGHT"),
    modelCode: row.modelCode,
    brandModel: row.brandModel,
    preflightStatus: row.observationReadiness === "manual_observation_only" ? "preserved_manual_only" : "preserved_hold",
    sourceReadiness: row.observationReadiness,
    sourceTier: row.sourceTier,
    sourceUrl: row.sourceUrl,
    queryPlan: null,
    acceptSafeguards: [],
    rejectSafeguards: baseRejectSafeguards(),
    titleSpecConflictSafeguards: titleSpecConflictSafeguards(row),
    expectedSpec: row.sourceVerifiedSpec,
    preservedReason: row.holdReason ?? row.noWriteObservationRule,
    runtimeApproved: false,
    publicPromotion: false,
    candidatePoolReady: false,
    runtimeApply: false,
    dbMutation: false,
    sourceHealthMutation: false,
  };
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

async function readSummary(file: string): Promise<Record<string, unknown>> {
  const raw = await readFile(path.join(appDir, file), "utf8");
  if (!file.endsWith(".json")) {
    return { path: file, kind: "markdown", bytes: raw.length };
  }
  const parsed = JSON.parse(raw) as JsonReport;
  return {
    path: file,
    kind: "json",
    bytes: raw.length,
    topLevelKeys: Object.keys(parsed),
    metrics: parsed.metrics ?? null,
    conclusion: parsed.conclusion ?? null,
  };
}

async function inputSummaries(): Promise<Record<string, unknown>> {
  const entries = await Promise.all(inputFiles.map(async (file) => [file, await readSummary(file)] as const));
  return Object.fromEntries(entries);
}

function countStatus(rows: RunnerRow[], status: RunnerPreflightStatus): number {
  return rows.filter((row) => row.preflightStatus === status).length;
}

function mdCell(value: unknown): string {
  return String(value ?? "null").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function buildMarkdown(report: Report): string {
  const lines = [
    "# Monitor Selected Exact-Model No-Write Runner Preflight",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- category: ${report.category}`,
    `- lane: ${report.lane}`,
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- runtimeCatalogApply: false",
    "- runtimeApply: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    "- productionDbMutation: false",
    "- sourceHealthMutation: false",
    "- directThirtyDayPlanEdit: false",
    "- runtimeApprovedRows/publicPromotionRows/candidatePoolRows/runtimeApplyRows/dbMutationRows/sourceHealthMutationRows: 0/0/0/0/0/0",
    "",
    "## Metrics",
    "",
    `- sourceSafeRows: ${report.metrics.sourceSafeRows}`,
    `- sourceManualRows: ${report.metrics.sourceManualRows}`,
    `- sourceHoldRows: ${report.metrics.sourceHoldRows}`,
    `- runnerDesignReadyRows: ${report.metrics.runnerDesignReadyRows}`,
    `- preservedManualRows: ${report.metrics.preservedManualRows}`,
    `- preservedHoldRows: ${report.metrics.preservedHoldRows}`,
    `- titleSpecConflictGuardRows: ${report.metrics.titleSpecConflictGuardRows}`,
    "",
    "## Runner Rows",
    "",
    "| caseId | modelCode | status | sourceReadiness | queryTerms | expectedSpec | preservedReason |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...report.runnerRows.map((row) =>
      `| ${row.caseId} | ${row.modelCode} | ${row.preflightStatus} | ${row.sourceReadiness} | ${mdCell(row.queryPlan?.targetedSearchTerms.join(", "))} | ${mdCell(`${row.expectedSpec.size}, ${row.expectedSpec.resolution}, ${row.expectedSpec.refresh}, ${row.expectedSpec.panel}, ${row.expectedSpec.shape}`)} | ${mdCell(row.preservedReason)} |`,
    ),
    "",
    "## Runner Contract",
    "",
    ...report.runnerContract.map((item) => `- ${item}`),
    "",
    "## Blocked Owner Decisions",
    "",
    ...report.blockedOwnerDecisions.map((item) => `- ${item}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const sourceConfidence = await readJson<SourceConfidenceReport>("reports/monitor-selected-exact-model-source-confidence-latest.json");
  const runnerRows = sourceConfidence.rows.map(toRunnerRow);
  const runnerDesignReadyRows = countStatus(runnerRows, "runner_design_ready");
  const preservedManualRows = countStatus(runnerRows, "preserved_manual_only");
  const preservedHoldRows = countStatus(runnerRows, "preserved_hold");

  const report: Report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    sourceHealthMutation: false,
    directThirtyDayPlanEdit: false,
    category: "monitor_discovered",
    lane: "monitor_selected_exact_model_no_write_runner_preflight",
    inputFiles,
    inputReadSummary: await inputSummaries(),
    metrics: {
      sourceSafeRows: sourceConfidence.metrics.safeInternalNoWriteObservationRows,
      sourceManualRows: sourceConfidence.metrics.manualObservationOnlyRows,
      sourceHoldRows: sourceConfidence.metrics.holdRequiredRows,
      runnerDesignReadyRows,
      preservedManualRows,
      preservedHoldRows,
      titleSpecConflictGuardRows: runnerRows.filter((row) => row.titleSpecConflictSafeguards.length > 0).length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
      dbMutationRows: 0,
      sourceHealthMutationRows: 0,
    },
    runnerRows,
    runnerContract: [
      "This packet is a no-write runner design/preflight only; it does not implement a runner or call marketplace, runtime, DB, source-health, public promotion, or candidate pool paths.",
      "A later no-write runner may target only the six runner_design_ready exact model rows from the source-confidence packet.",
      "The runner design requires title-visible exact model tokens; description-only model evidence is not sufficient.",
      "Spec tokens are secondary safeguards: conflicts between title-visible spec and official source-backed spec route to hold, not count.",
      "Manual and hold rows remain preserved as explicit non-runner rows so they cannot leak into observation counts.",
      "Observation output, if drafted later, must be local/report-only artifacts with zero runtime approval and zero production mutation.",
    ],
    blockedOwnerDecisions: [
      "Owner must approve any future no-write runner execution window and allowed read-only marketplace source before execution.",
      "Owner must decide whether U2412Mb can join selected exact-model observation or remains manual calibration only.",
      "Owner must resolve MSI MAG 275QF refresh conflict before it can become runner eligible.",
      "Owner must split Android/touch/signage monitor policy before CT2210IPS can leave hold.",
      "Owner must require durable evidence before 32RTX950 can enter observation.",
      "Runtime patch, catalog apply, source-health mutation, DB write, candidate pool, public promotion, and 30-day-plan edits stay closed.",
    ],
    conclusion:
      runnerDesignReadyRows === 6 && preservedManualRows === 1 && preservedHoldRows === 3
        ? "no_write_runner_design_preflight_ready_for_six_safe_monitor_exact_models"
        : "no_write_runner_design_preflight_blocked_by_input_count_mismatch",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(outputMdPath, buildMarkdown(report));
  JSON.parse(await readFile(outputJsonPath, "utf8")) as Report;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
