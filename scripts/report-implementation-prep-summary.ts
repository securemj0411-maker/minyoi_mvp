import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type PrepReport = {
  generatedAt?: string;
  scope?: string;
  reportOnly?: boolean;
  publicPromotion?: boolean;
  runtimeCatalogApply?: boolean;
  candidatePoolPolicyWiring?: boolean;
  metrics?: Record<string, number | string | boolean | null | undefined>;
  deferred?: string[];
  stopCondition?: string;
  [key: string]: unknown;
};

type PhaseSummary = {
  phase: string;
  category: string;
  depth: "foundation" | "deep" | "lightweight";
  reportFile: string;
  scriptFile: string;
  status: "done";
  scope: string;
  keyMetrics: Record<string, number | string | boolean | null | undefined>;
  caseCount: number;
  positiveCount: number;
  splitOnlyCount: number;
  holdCount: number;
  manualReviewCount: number;
  runtimeApprovedRows: number;
  deferred: string[];
};

const reportsDir = path.join(process.cwd(), "reports");

const phaseInputs = [
  {
    phase: "Phase 0-0.6",
    category: "foundation",
    depth: "foundation" as const,
    reportFile: "subagent-implementation-prep-queue-status-latest.json",
    scriptFile: "scripts/report-implementation-prep-foundation.ts",
    metrics: ["guardrailStatus", "guardrailFilesChecked", "reviewCoverageClosedCategories", "missingReviewEvidenceCategories"],
  },
  {
    phase: "Phase 1",
    category: "earphone_airpods_discovered",
    depth: "deep" as const,
    reportFile: "earphone-airpods-implementation-prep-latest.json",
    scriptFile: "scripts/report-earphone-airpods-implementation-prep.ts",
    metrics: ["total", "normal", "nonNormal", "partsRows", "parserReadyRate"],
  },
  {
    phase: "Phase 2",
    category: "headphone_discovered",
    depth: "deep" as const,
    reportFile: "headphone-matched-sku-implementation-prep-latest.json",
    scriptFile: "scripts/report-headphone-matched-sku-implementation-prep.ts",
    metrics: ["total", "normal", "parserReadyRate", "needsReviewRate", "runtimeApprovedRows"],
  },
  {
    phase: "Phase 3",
    category: "game_console_body_narrow",
    depth: "deep" as const,
    reportFile: "game-console-body-narrow-implementation-prep-latest.json",
    scriptFile: "scripts/report-game-console-body-narrow-implementation-prep.ts",
    metrics: ["total", "consoleCandidates", "knownModelCandidateRate", "strictParserReadyRate", "runtimeApprovedRows"],
  },
  {
    phase: "Phase 4",
    category: "monitor_discovered",
    depth: "deep" as const,
    reportFile: "monitor-model-code-implementation-prep-latest.json",
    scriptFile: "scripts/report-monitor-model-code-implementation-prep.ts",
    metrics: ["total", "hasModelCodeRate", "genericKeyRate", "parserReadyRate", "runtimeApprovedRows"],
  },
  {
    phase: "Phase 5",
    category: "desktop_discovered",
    depth: "deep" as const,
    reportFile: "desktop-cpu-gpu-implementation-prep-latest.json",
    scriptFile: "scripts/report-desktop-cpu-gpu-implementation-prep.ts",
    metrics: ["total", "normal", "parserReadyRate", "genericRate", "runtimeApprovedRows"],
  },
  {
    phase: "Phase 6",
    category: "smartwatch_discovered",
    depth: "lightweight" as const,
    reportFile: "smartwatch-ambiguity-split-prep-latest.json",
    scriptFile: "scripts/report-smartwatch-ambiguity-split-prep.ts",
    metrics: ["total", "normal", "normalWithSku", "parserReadyRate", "runtimeApprovedRows"],
  },
  {
    phase: "Phase 7",
    category: "camera_discovered",
    depth: "lightweight" as const,
    reportFile: "camera-package-split-prep-latest.json",
    scriptFile: "scripts/report-camera-package-split-prep.ts",
    metrics: ["total", "normal", "parserReadyRate", "modelMatchedRate", "runtimeApprovedRows"],
  },
  {
    phase: "Phase 8",
    category: "speaker_audio_discovered",
    depth: "lightweight" as const,
    reportFile: "speaker-audio-device-class-split-prep-latest.json",
    scriptFile: "scripts/report-speaker-audio-device-class-split-prep.ts",
    metrics: ["total", "normal", "modelMatchedRate", "genericFamilyRate", "runtimeApprovedRows"],
  },
  {
    phase: "Phase 9",
    category: "home_appliance_tech_discovered",
    depth: "lightweight" as const,
    reportFile: "home-appliance-vacuum-subtype-split-prep-latest.json",
    scriptFile: "scripts/report-home-appliance-vacuum-subtype-split-prep.ts",
    metrics: ["total", "normal", "modelReadyRate", "genericRate", "runtimeApprovedRows"],
  },
];

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function metricValue(report: PrepReport, key: string): number | string | boolean | null | undefined {
  const scoped = report.metrics?.[key];
  if (scoped !== undefined) return scoped;
  const root = report[key];
  if (typeof root === "number" || typeof root === "string" || typeof root === "boolean" || root === null) return root;
  return undefined;
}

function numberMetric(report: PrepReport, key: string): number {
  const value = metricValue(report, key);
  return typeof value === "number" ? value : 0;
}

function pickMetrics(report: PrepReport, keys: string[]): Record<string, number | string | boolean | null | undefined> {
  const picked: Record<string, number | string | boolean | null | undefined> = {};
  for (const key of keys) picked[key] = metricValue(report, key) ?? null;
  return picked;
}

function phaseSummary(input: (typeof phaseInputs)[number], report: PrepReport): PhaseSummary {
  return {
    phase: input.phase,
    category: input.category,
    depth: input.depth,
    reportFile: `reports/${input.reportFile}`,
    scriptFile: input.scriptFile,
    status: "done",
    scope: report.scope ?? input.category,
    keyMetrics: pickMetrics(report, input.metrics),
    caseCount: numberMetric(report, "testCaseCount"),
    positiveCount: numberMetric(report, "positiveCount"),
    splitOnlyCount: numberMetric(report, "splitOnlyCount"),
    holdCount: numberMetric(report, "holdCount"),
    manualReviewCount: numberMetric(report, "manualReviewCount"),
    runtimeApprovedRows: numberMetric(report, "runtimeApprovedRows"),
    deferred: report.deferred ?? [],
  };
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const phases: PhaseSummary[] = [];

  for (const input of phaseInputs) {
    const report = await readJson<PrepReport>(path.join(reportsDir, input.reportFile));
    phases.push(phaseSummary(input, report));
  }

  const implementationPhases = phases.filter((phase) => phase.depth !== "foundation");
  const totalCaseCount = implementationPhases.reduce((sum, phase) => sum + phase.caseCount, 0);
  const totals = {
    phaseCount: phases.length,
    implementationCategoryCount: implementationPhases.length,
    deepCategoryCount: implementationPhases.filter((phase) => phase.depth === "deep").length,
    lightweightCategoryCount: implementationPhases.filter((phase) => phase.depth === "lightweight").length,
    totalCaseCount,
    positiveCount: implementationPhases.reduce((sum, phase) => sum + phase.positiveCount, 0),
    splitOnlyCount: implementationPhases.reduce((sum, phase) => sum + phase.splitOnlyCount, 0),
    holdCount: implementationPhases.reduce((sum, phase) => sum + phase.holdCount, 0),
    manualReviewCount: implementationPhases.reduce((sum, phase) => sum + phase.manualReviewCount, 0),
    runtimeApprovedRows: implementationPhases.reduce((sum, phase) => sum + phase.runtimeApprovedRows, 0),
  };

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope: "Subagent implementation-prep summary across Phase 0-9",
    totals,
    phases,
    whatWasDone: [
      "Converted selective category work into schema-first, coverage-first implementation prep.",
      "Produced foundation guardrails and fixture schema before category-specific drafts.",
      "Completed deep prep for AirPods, headphone matched-SKU, game console body, monitor model-code, and desktop CPU/GPU title tokens.",
      "Completed lightweight split prep for smartwatch, camera, speaker/audio, and home appliance/vacuum.",
      "Recorded positive, split-only, hold, and manual-review fixture candidates without approving runtime behavior.",
    ],
    importantFindings: [
      "The richer existing local data is concentrated in smartphone/laptop/AirPods/watch and selected tech categories; expansion categories are mostly 160-row representative samples.",
      "Home appliance/vacuum is intentionally low-confidence: model-ready rate is 12.3%, generic rate is 77.2%, and logistics risk lacks row-level examples.",
      "Monitor has many model-code hints but still needs official/spec-backed confirmation before positive parser cases.",
      "Game console and speaker/audio need device-class split discipline to avoid broad contamination.",
      "parser_candidate remains a review artifact, not public approval.",
    ],
    deferredRememberLater: [
      "Do not implement runtime wiring until main DB/worker stabilization and a narrow owner review are complete.",
      "Fetch/verify official or reliable model specs for any future positive parser rollout, especially older models absent from current official pages.",
      "Collect broader Bunjang/site samples or source-backed datasets before treating 160-row expansion reports as quality thresholds.",
      "Keep robot vacuum, bedding cleaner, appliance logistics, amp/receiver, PA speaker, monitor TV, accessory/parts, and bundle lanes separate.",
      "Revisit 30-day plan decision log only through the authorized main-agent process; this subagent did not edit it.",
    ],
    nextGateForMainAgent: [
      "Review generated fixture cases and decide which single narrow category is eligible for actual implementation.",
      "Run no-mutation dry run against parser/report behavior only.",
      "Only after explicit approval, consider runtime policy wiring in the named files.",
    ],
    forbiddenSurfacesNotEditedByThisReportOnlyRun: [
      "src/lib/catalog.ts",
      "src/lib/category-readiness.ts",
      "src/lib/option-parser.ts",
      "src/lib/pipeline.ts",
      "src/lib/tick-pipeline.ts",
      "src/lib/pack-open.ts",
      "src/lib/candidate-pool-builder.ts",
      "src/app/api/cron/*",
      "src/app/debug/*",
      "supabase/schema.sql",
      "pack UI components",
      "30일_실행계획.md",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "subagent-implementation-prep-summary-latest.json"), JSON.stringify(report, null, 2));

  const phaseRows = phases.map((phase) => {
    const metrics = Object.entries(phase.keyMetrics)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join("<br>");
    return `| ${phase.phase} | ${phase.category} | ${phase.depth} | ${phase.status} | ${phase.caseCount} | ${phase.positiveCount}/${phase.splitOnlyCount}/${phase.holdCount}/${phase.manualReviewCount} | ${phase.runtimeApprovedRows} | ${metrics} |`;
  });

  const md = [
    "# Subagent Implementation Prep Summary",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only summary for Phase 0-9. This is not runtime wiring, public promotion, candidate-pool policy wiring, or production DB mutation.",
    "",
    "## Totals",
    "",
    `- phases complete: ${totals.phaseCount}`,
    `- implementation categories complete: ${totals.implementationCategoryCount}`,
    `- deep/lightweight categories: ${totals.deepCategoryCount}/${totals.lightweightCategoryCount}`,
    `- total fixture/prep cases: ${totals.totalCaseCount}`,
    `- positive/split-only/hold/manual: ${totals.positiveCount}/${totals.splitOnlyCount}/${totals.holdCount}/${totals.manualReviewCount}`,
    `- runtime-approved rows: ${totals.runtimeApprovedRows}`,
    "",
    "## Phase Coverage",
    "",
    "| phase | category | depth | status | cases | positive/split/hold/manual | runtime approved | key metrics |",
    "| --- | --- | --- | --- | ---: | --- | ---: | --- |",
    ...phaseRows,
    "",
    "## What Was Done",
    "",
    ...report.whatWasDone.map((line) => `- ${line}`),
    "",
    "## Important Findings",
    "",
    ...report.importantFindings.map((line) => `- ${line}`),
    "",
    "## Deferred / Remember Later",
    "",
    ...report.deferredRememberLater.map((line) => `- ${line}`),
    "",
    "## Next Gate For Main Agent",
    "",
    ...report.nextGateForMainAgent.map((line) => `- ${line}`),
    "",
    "## Forbidden Surfaces Not Edited By This Report-Only Run",
    "",
    ...report.forbiddenSurfacesNotEditedByThisReportOnlyRun.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "subagent-implementation-prep-summary-latest.md"), `${md}\n`);
  console.log("wrote reports/subagent-implementation-prep-summary-latest.json");
  console.log("wrote reports/subagent-implementation-prep-summary-latest.md");
  console.log(`implementation prep summary: phases=${totals.phaseCount}, categories=${totals.implementationCategoryCount}, cases=${totals.totalCaseCount}, runtime_approved=${totals.runtimeApprovedRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
