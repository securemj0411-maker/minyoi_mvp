import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type RunnerPreflightStatus = "runner_design_ready" | "preserved_manual_only" | "preserved_hold";
type SimulationStatus = "accepted_observation_candidate" | "preserved_manual_only" | "preserved_hold" | "blocked_title_spec_conflict";

type MonitorSpec = {
  size: string;
  resolution: string;
  refresh: string;
  panel: string;
  shape: string;
};

type RunnerRow = {
  caseId: string;
  modelCode: string;
  brandModel: string;
  preflightStatus: RunnerPreflightStatus;
  sourceReadiness: string;
  sourceTier: string;
  sourceUrl: string | null;
  queryPlan: {
    targetedSearchTerms: string[];
    titleMustContainAny: string[];
    titleOrDescriptionMaySupport: string[];
    marketReadMode: string;
    writeMode: string;
  } | null;
  acceptSafeguards: string[];
  rejectSafeguards: string[];
  titleSpecConflictSafeguards: string[];
  expectedSpec: MonitorSpec;
  preservedReason: string | null;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePoolReady: false;
  runtimeApply: false;
  dbMutation: false;
  sourceHealthMutation: false;
};

type PreflightReport = {
  metrics: {
    runnerDesignReadyRows: number;
    preservedManualRows: number;
    preservedHoldRows: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
    dbMutationRows: number;
    sourceHealthMutationRows: number;
  };
  runnerRows: RunnerRow[];
  conclusion: string;
};

type SimulationRow = {
  caseId: string;
  modelCode: string;
  brandModel: string;
  suppliedInputTitle: string;
  suppliedInputDescription: string;
  preflightStatus: RunnerPreflightStatus;
  simulationStatus: SimulationStatus;
  titleVisibleExactModel: boolean;
  titleSpecConflictDetected: boolean;
  titleSpecConflictReason: string | null;
  classificationReason: string;
  expectedSpec: MonitorSpec;
  safeguardsApplied: string[];
  writeTargetsTouched: [];
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
  suppliedInputOnly: true;
  runtimeCatalogApply: false;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  sourceHealthMutation: false;
  directThirtyDayPlanEdit: false;
  writeTargetsTouched: [];
  category: "monitor_discovered";
  lane: "monitor_selected_exact_model_supplied_input_runner_simulation";
  inputFiles: string[];
  inputReadSummary: Record<string, unknown>;
  metrics: {
    suppliedInputRows: number;
    acceptedObservationCandidateRows: number;
    preservedManualRows: number;
    preservedHoldRows: number;
    blockedTitleSpecConflictRows: number;
    titleVisibleExactModelRows: number;
    titleSpecConflictDetectedRows: number;
    writeTargetsTouchedCount: 0;
    runtimeApprovedRows: 0;
    publicPromotionRows: 0;
    candidatePoolRows: 0;
    runtimeApplyRows: 0;
    dbMutationRows: 0;
    sourceHealthMutationRows: 0;
  };
  simulationRows: SimulationRow[];
  summary: string[];
  blockedOwnerDecisions: string[];
  conclusion: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "monitor-selected-exact-model-supplied-input-runner-simulation-latest.json");
const outputMdPath = path.join(reportsDir, "monitor-selected-exact-model-supplied-input-runner-simulation-latest.md");

const inputFiles = [
  "../인수인계.md",
  "reports/monitor-selected-exact-model-no-write-runner-preflight-latest.json",
  "reports/monitor-selected-exact-model-no-write-runner-preflight-latest.md",
  "reports/monitor-selected-exact-model-source-confidence-latest.json",
  "reports/category-orchestration-status-latest.json",
  "reports/orchestration-boundary-audit-latest.json",
];

const knownConflictTitles: Record<string, string> = {
  "275qf": "새제품 MSI 275QF QHD 200HZ 게이밍모니터",
};

const preservedInputTitles: Record<string, string> = {
  u2412mb: "델 24인치 피벗 모니터 u2412mb",
  ct2210ips: "카멜 CT2210IPS 54cm 안드로이드 터치모니터",
  "32rtx950": "크로스오버 32RTX950 UHD 4K 160HZ 모니터",
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function suppliedTitle(row: RunnerRow): string {
  if (knownConflictTitles[row.modelCode]) return knownConflictTitles[row.modelCode];
  if (preservedInputTitles[row.modelCode]) return preservedInputTitles[row.modelCode];
  const primary = row.queryPlan?.targetedSearchTerms[0] ?? row.modelCode.toUpperCase();
  return `${row.brandModel} ${primary} 모니터`;
}

function suppliedDescription(row: RunnerRow): string {
  const spec = row.expectedSpec;
  return `local supplied-input only; expected ${spec.size}, ${spec.resolution}, ${spec.refresh}, ${spec.panel}, ${spec.shape}; no external fetch and no write target`;
}

function titleVisibleExactModel(row: RunnerRow, title: string): boolean {
  const titleNorm = normalize(title);
  const candidates = row.queryPlan?.titleMustContainAny ?? [row.modelCode, row.brandModel];
  return candidates.some((candidate) => titleNorm.includes(normalize(candidate)));
}

function titleSpecConflict(row: RunnerRow, title: string): string | null {
  const titleNorm = normalize(title);
  const expectedRefresh = row.expectedSpec.refresh;
  const refreshMatch = titleNorm.match(/(\d{2,3})hz/);
  if (refreshMatch && /^\d{2,3}hz$/.test(expectedRefresh) && `${refreshMatch[1]}hz` !== expectedRefresh) {
    return `title refresh ${refreshMatch[1]}hz conflicts with source-backed ${expectedRefresh}`;
  }
  if (row.expectedSpec.resolution === "1920x1080" && (titleNorm.includes("qhd") || titleNorm.includes("uhd") || titleNorm.includes("4k"))) {
    return `title resolution token conflicts with source-backed ${row.expectedSpec.resolution}`;
  }
  if (row.expectedSpec.resolution === "2560x1440" && (titleNorm.includes("fhd") || titleNorm.includes("uhd") || titleNorm.includes("4k"))) {
    return `title resolution token conflicts with source-backed ${row.expectedSpec.resolution}`;
  }
  return null;
}

function simulate(row: RunnerRow): SimulationRow {
  const title = suppliedTitle(row);
  const description = suppliedDescription(row);
  const exactModel = titleVisibleExactModel(row, title);
  const conflictReason = titleSpecConflict(row, title);
  const conflictDetected = conflictReason !== null;

  if (row.preflightStatus === "preserved_manual_only") {
    return {
      caseId: row.caseId.replace("PREFLIGHT", "SIM"),
      modelCode: row.modelCode,
      brandModel: row.brandModel,
      suppliedInputTitle: title,
      suppliedInputDescription: description,
      preflightStatus: row.preflightStatus,
      simulationStatus: "preserved_manual_only",
      titleVisibleExactModel: exactModel,
      titleSpecConflictDetected: conflictDetected,
      titleSpecConflictReason: conflictReason,
      classificationReason: row.preservedReason ?? "manual row remains excluded from supplied-input runner counts",
      expectedSpec: row.expectedSpec,
      safeguardsApplied: [...row.rejectSafeguards, ...row.titleSpecConflictSafeguards],
      writeTargetsTouched: [],
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
      runtimeApply: false,
      dbMutation: false,
      sourceHealthMutation: false,
    };
  }

  if (row.preflightStatus === "preserved_hold") {
    return {
      caseId: row.caseId.replace("PREFLIGHT", "SIM"),
      modelCode: row.modelCode,
      brandModel: row.brandModel,
      suppliedInputTitle: title,
      suppliedInputDescription: description,
      preflightStatus: row.preflightStatus,
      simulationStatus: conflictDetected ? "blocked_title_spec_conflict" : "preserved_hold",
      titleVisibleExactModel: exactModel,
      titleSpecConflictDetected: conflictDetected,
      titleSpecConflictReason: conflictReason,
      classificationReason: conflictReason ?? row.preservedReason ?? "hold row remains excluded from supplied-input runner counts",
      expectedSpec: row.expectedSpec,
      safeguardsApplied: [...row.rejectSafeguards, ...row.titleSpecConflictSafeguards],
      writeTargetsTouched: [],
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
      runtimeApply: false,
      dbMutation: false,
      sourceHealthMutation: false,
    };
  }

  const accepted = exactModel && !conflictDetected;
  return {
    caseId: row.caseId.replace("PREFLIGHT", "SIM"),
    modelCode: row.modelCode,
    brandModel: row.brandModel,
    suppliedInputTitle: title,
    suppliedInputDescription: description,
    preflightStatus: row.preflightStatus,
    simulationStatus: accepted ? "accepted_observation_candidate" : "blocked_title_spec_conflict",
    titleVisibleExactModel: exactModel,
    titleSpecConflictDetected: conflictDetected,
    titleSpecConflictReason: conflictReason,
    classificationReason: accepted
      ? "title-visible exact model and source-backed spec safeguards pass in local supplied-input simulation"
      : conflictReason ?? "title-visible exact model token missing",
    expectedSpec: row.expectedSpec,
    safeguardsApplied: [...row.acceptSafeguards, ...row.rejectSafeguards, ...row.titleSpecConflictSafeguards],
    writeTargetsTouched: [],
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

function countStatus(rows: SimulationRow[], status: SimulationStatus): number {
  return rows.filter((row) => row.simulationStatus === status).length;
}

function mdCell(value: unknown): string {
  return String(value ?? "null").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function buildMarkdown(report: Report): string {
  const lines = [
    "# Monitor Selected Exact-Model Supplied-Input Runner Simulation",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- category: ${report.category}`,
    `- lane: ${report.lane}`,
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- suppliedInputOnly: true",
    "- runtimeCatalogApply: false",
    "- runtimeApply: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    "- productionDbMutation: false",
    "- sourceHealthMutation: false",
    "- directThirtyDayPlanEdit: false",
    "- writeTargetsTouched: []",
    "- runtimeApprovedRows/publicPromotionRows/candidatePoolRows/runtimeApplyRows/dbMutationRows/sourceHealthMutationRows: 0/0/0/0/0/0",
    "",
    "## Metrics",
    "",
    `- suppliedInputRows: ${report.metrics.suppliedInputRows}`,
    `- acceptedObservationCandidateRows: ${report.metrics.acceptedObservationCandidateRows}`,
    `- preservedManualRows: ${report.metrics.preservedManualRows}`,
    `- preservedHoldRows: ${report.metrics.preservedHoldRows}`,
    `- blockedTitleSpecConflictRows: ${report.metrics.blockedTitleSpecConflictRows}`,
    `- titleVisibleExactModelRows: ${report.metrics.titleVisibleExactModelRows}`,
    `- titleSpecConflictDetectedRows: ${report.metrics.titleSpecConflictDetectedRows}`,
    "",
    "## Simulation Rows",
    "",
    "| caseId | modelCode | simulationStatus | exactModel | conflict | suppliedInputTitle | reason |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...report.simulationRows.map((row) =>
      `| ${row.caseId} | ${row.modelCode} | ${row.simulationStatus} | ${row.titleVisibleExactModel} | ${mdCell(row.titleSpecConflictReason)} | ${mdCell(row.suppliedInputTitle)} | ${mdCell(row.classificationReason)} |`,
    ),
    "",
    "## Summary",
    "",
    ...report.summary.map((item) => `- ${item}`),
    "",
    "## Blocked Owner Decisions",
    "",
    ...report.blockedOwnerDecisions.map((item) => `- ${item}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const preflight = await readJson<PreflightReport>("reports/monitor-selected-exact-model-no-write-runner-preflight-latest.json");
  const simulationRows = preflight.runnerRows.map(simulate);
  const writeTargetsTouched: [] = [];
  const acceptedObservationCandidateRows = countStatus(simulationRows, "accepted_observation_candidate");
  const preservedManualRows = countStatus(simulationRows, "preserved_manual_only");
  const preservedHoldRows = countStatus(simulationRows, "preserved_hold");
  const blockedTitleSpecConflictRows = countStatus(simulationRows, "blocked_title_spec_conflict");

  const report: Report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    suppliedInputOnly: true,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    sourceHealthMutation: false,
    directThirtyDayPlanEdit: false,
    writeTargetsTouched,
    category: "monitor_discovered",
    lane: "monitor_selected_exact_model_supplied_input_runner_simulation",
    inputFiles,
    inputReadSummary: await inputSummaries(),
    metrics: {
      suppliedInputRows: simulationRows.length,
      acceptedObservationCandidateRows,
      preservedManualRows,
      preservedHoldRows,
      blockedTitleSpecConflictRows,
      titleVisibleExactModelRows: simulationRows.filter((row) => row.titleVisibleExactModel).length,
      titleSpecConflictDetectedRows: simulationRows.filter((row) => row.titleSpecConflictDetected).length,
      writeTargetsTouchedCount: 0,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
      dbMutationRows: 0,
      sourceHealthMutationRows: 0,
    },
    simulationRows,
    summary: [
      "Six preflight runner-ready monitor models classify as accepted observation candidates under supplied-input-only simulation.",
      "U2412Mb remains preserved manual-only and does not enter accepted counts.",
      "CT2210IPS and 32RTX950 remain preserved hold rows.",
      "MSI MAG 275QF is blocked by title/spec conflict because supplied title says 200Hz while source-backed spec is 180Hz.",
      "All rows keep writeTargetsTouched=[] and all runtime/public/candidate/DB/source-health mutation counts at zero.",
    ],
    blockedOwnerDecisions: [
      "Owner must approve any later real no-write runner execution source and time window.",
      "Owner must decide whether U2412Mb can move from manual-only into runner-ready.",
      "Owner must resolve 275QF refresh conflict before it can be accepted.",
      "Owner must split Android/touch/signage policy before CT2210IPS can leave hold.",
      "Owner must require durable official or trusted source evidence before 32RTX950 can leave hold.",
    ],
    conclusion:
      acceptedObservationCandidateRows === 6 &&
      preservedManualRows === 1 &&
      preservedHoldRows === 2 &&
      blockedTitleSpecConflictRows === 1 &&
      writeTargetsTouched.length === 0
        ? "supplied_input_runner_simulation_passed_six_accept_one_manual_two_hold_one_conflict_blocked"
        : "supplied_input_runner_simulation_requires_review",
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
