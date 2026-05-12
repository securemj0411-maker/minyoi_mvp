import fs from "node:fs";
import path from "node:path";

type TaxonomyReport = {
  metrics?: {
    interchangeableBodyOnlyRows?: number;
    fixedLensCompactRows?: number;
    bodyKitLensBundleRows?: number;
    lensOnlyAccessoryRows?: number;
    damagedPartsRows?: number;
    buyingSoldOnlyRows?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
  recommendedSublane?: {
    lane: string;
    reason: string;
    futureRuntimeScope: string;
  };
  rows?: TaxonomyRow[];
};

type TaxonomyRow = {
  sublane: string;
  decision: string;
  pid: string;
  title: string;
  evidence: string;
  futureInternalOnlyRuntimeCandidate?: boolean;
};

type InternalRouteReport = {
  metrics?: {
    rows?: number;
    failedRows?: number;
    internalPositiveRows?: number;
    poolBlockedRows?: number;
  };
  rows?: InternalRouteRow[];
  conclusion?: string;
  lane?: string;
};

type InternalRouteRow = {
  caseId?: string;
  title?: string;
  expectedDecision?: string;
  comparableKey?: string | null;
  readinessStatus?: string;
  canEnterPool?: boolean;
  pass?: boolean;
};

type ExecutorReport = {
  metrics?: {
    rows?: number;
    positiveRows?: number;
    manualRows?: number;
    holdRows?: number;
    distinctPositiveFamilies?: number;
    failedRows?: number;
  };
  rows?: ExecutorRow[];
  contract?: Record<string, unknown>;
};

type ExecutorRow = {
  caseId?: string;
  pid?: string;
  title?: string;
  expectedDecision?: string;
  actualDecision?: string;
  actualComparableKey?: string | null;
  actualReason?: string;
  family?: string | null;
  bodyModel?: string | null;
  packageAxis?: string | null;
  lensAxis?: string | null;
  pass?: boolean;
};

type PlanSection = {
  id: string;
  title: string;
  requirements: string[];
};

type ObservationMetric = {
  metric: string;
  target: string;
  source: string;
  rollbackOrHoldTrigger: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const sourceFiles = [
  "reports/camera-fixed-lens-interchangeable-taxonomy-next-latest.md",
  "reports/camera-fixed-lens-interchangeable-taxonomy-next-latest.json",
  "reports/camera-internal-runtime-route-latest.md",
  "reports/camera-internal-runtime-route-latest.json",
  "reports/camera-body-only-exact-model-no-mutation-executor-latest.md",
  "reports/camera-body-only-exact-model-no-mutation-executor-latest.json",
  "reports/camera-body-only-runtime-impact-review-2026-05-12.md",
  "reports/camera-no-mutation-runtime-dry-run-latest.md",
  "reports/camera-no-mutation-runtime-dry-run-latest.json",
];

function readJson<T>(relativePath: string): T | null {
  const fullPath = path.join(appDir, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

function table(rows: string[][]): string {
  const [header, ...body] = rows;
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

const taxonomy = readJson<TaxonomyReport>("reports/camera-fixed-lens-interchangeable-taxonomy-next-latest.json") ?? {};
const internalRoute = readJson<InternalRouteReport>("reports/camera-internal-runtime-route-latest.json") ?? {};
const executor = readJson<ExecutorReport>("reports/camera-body-only-exact-model-no-mutation-executor-latest.json") ?? {};

const taxonomyRows = taxonomy.rows ?? [];
const bodyOnlyRows = taxonomyRows.filter((row) => row.sublane === "interchangeable_body_only_exact_model");
const boundaryRows = taxonomyRows.filter((row) => row.sublane !== "interchangeable_body_only_exact_model");
const executorRows = executor.rows ?? [];
const positiveExecutorRows = executorRows.filter((row) => asString(row.caseId).includes("POS"));
const manualExecutorRows = executorRows.filter((row) => asString(row.caseId).includes("MANUAL"));
const holdExecutorRows = executorRows.filter((row) => asString(row.caseId).includes("HOLD"));

const positiveFixtureRequirements: PlanSection[] = [
  {
    id: "positive-fixture-identity",
    title: "Exact body model identity",
    requirements: [
      "Require a recognized interchangeable camera family such as Canon, Sony, Nikon, or Fujifilm.",
      "Require a stable exact body model token, not a generic camera/family-only title.",
      "Preserve generation/model suffixes in the fixture key, for example eos_r6_mark_ii, a7c, a5100, eos_m6, z9, eos_6d, x_t4.",
    ],
  },
  {
    id: "positive-fixture-body-only-proof",
    title: "Body-only and no-lens proof",
    requirements: [
      "Require explicit body-only/body sale/body-only token in the title or fixture evidence.",
      "Emit only the report-only comparable key shape camera|{family}|{body_model}|body_only|no_lens in future no-mutation checks.",
      "Do not infer no_lens from full-box, full-set, camera-only, accessory inclusion, or missing package text.",
    ],
  },
  {
    id: "positive-fixture-threshold",
    title: "Minimum fixture threshold before any later internal-only observation",
    requirements: [
      "Keep at least 7 positive rows from the current executor set.",
      "Keep at least 4 distinct positive families.",
      "Retain manual and hold fixtures in the same packet so false-merge boundaries remain visible.",
    ],
  },
];

const heldBoundaries: PlanSection[] = [
  {
    id: "hold-fixed-lens",
    title: "Fixed-lens compact",
    requirements: [
      "Hold Canon G7X, Fujifilm X70, Sony Cyber-shot, Ricoh GR, and similar compact fixed-lens rows out of the body-only sublane.",
      "Treat fixed-lens compact as a separate future taxonomy, not a variant of interchangeable body-only.",
    ],
  },
  {
    id: "hold-body-kit-lens",
    title: "Body+kit and lens bundle",
    requirements: [
      "Hold body+렌즈, 16-50mm, 18-45mm, double-zoom kit, and multi-lens package rows.",
      "Require a separate package/lens identity policy before any future body+kit sublane exists.",
    ],
  },
  {
    id: "hold-lens-accessory",
    title: "Lens-only and accessory",
    requirements: [
      "Hard-hold lens-only, cap, case, bag, cage, strap, battery, grip-only, and accessory-only rows.",
      "Never promote accessory inclusion as lens-kit proof or camera body proof.",
    ],
  },
  {
    id: "hold-damaged-buying",
    title: "Damaged, parts, buying, and sold-only",
    requirements: [
      "Hard-hold damaged, repair-needed, parts-only, buying-intent, and sold-only rows.",
      "Do not use sold-only rows as live runtime/candidate-pool readiness evidence.",
    ],
  },
  {
    id: "hold-unknown-fullbox",
    title: "Unknown package and full-box manual",
    requirements: [
      "Manual/hold exact model rows when body-only/no-lens proof is absent.",
      "Full-box/full-set is packaging state only; it must not imply no-lens or kit-lens identity.",
    ],
  },
];

const observationMetrics: ObservationMetric[] = [
  {
    metric: "noMutationPositiveRows",
    target: ">= 7 retained positive body-only exact-model rows",
    source: "camera-body-only-exact-model-no-mutation-executor-latest",
    rollbackOrHoldTrigger: "Hold if any current positive loses exact model, body_only, or no_lens proof.",
  },
  {
    metric: "distinctPositiveFamilies",
    target: ">= 4 families retained",
    source: "camera-body-only-exact-model-no-mutation-executor-latest",
    rollbackOrHoldTrigger: "Hold if family coverage collapses to a single brand/family.",
  },
  {
    metric: "boundaryLeakRows",
    target: "0 fixed-lens/body+kit/lens-only/accessory/damaged/buying rows in body-only positives",
    source: "taxonomy boundary rows and future no-mutation dry-run",
    rollbackOrHoldTrigger: "Hold if any boundary row emits camera|...|body_only|no_lens.",
  },
  {
    metric: "internalObservationPoolEntryRows",
    target: "0",
    source: "future internal-only observation dry-run",
    rollbackOrHoldTrigger: "Hold if canEnterPool becomes true or public promotion appears.",
  },
  {
    metric: "runtimeApplyRows",
    target: "0 for this plan",
    source: "camera-body-only-internal-sublane-plan",
    rollbackOrHoldTrigger: "This plan must be regenerated if runtime mutation is requested.",
  },
  {
    metric: "publicPromotionRows",
    target: "0",
    source: "future observation report",
    rollbackOrHoldTrigger: "Hold if camera readiness appears public/ready.",
  },
  {
    metric: "packOpenQuality",
    target: "48/48 in any future runtime review",
    source: "future main-agent verification only",
    rollbackOrHoldTrigger: "Hold if pack-open quality drops below 48/48 after any future patch.",
  },
];

const metrics = {
  sourceTaxonomyRows: taxonomyRows.length,
  sourceBodyOnlyRows: bodyOnlyRows.length,
  sourceBoundaryRows: boundaryRows.length,
  executorRows: executor.metrics?.rows ?? executorRows.length,
  executorPositiveRows: executor.metrics?.positiveRows ?? positiveExecutorRows.length,
  executorManualRows: executor.metrics?.manualRows ?? manualExecutorRows.length,
  executorHoldRows: executor.metrics?.holdRows ?? holdExecutorRows.length,
  distinctPositiveFamilies: executor.metrics?.distinctPositiveFamilies ?? 0,
  internalRouteRows: internalRoute.metrics?.rows ?? 0,
  internalRoutePositiveRows: internalRoute.metrics?.internalPositiveRows ?? 0,
  internalRoutePoolBlockedRows: internalRoute.metrics?.poolBlockedRows ?? 0,
  planSections: positiveFixtureRequirements.length + heldBoundaries.length,
  observationMetrics: observationMetrics.length,
  readyForInternalObservationPlanningOnly: true,
  readyForRuntimeApplyNow: false,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
};

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  ownership: "camera_body_only_internal_sublane_plan_only",
  category: "camera_discovered",
  lane: "interchangeable_body_only_exact_model",
  conclusion: "camera_body_only_exact_model_ready_for_internal_observation_planning_only_report_only",
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  runtimeApply: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  metrics,
  recommendedStatus: {
    readyForInternalObservationPlanningOnly: true,
    readyForRuntimeApplyNow: false,
    reason: "The sublane has 7 positive exact body-only/no-lens fixtures across 4 families and explicit hold boundaries, but this artifact is only a no-mutation observation plan.",
  },
  positiveFixtureRequirements,
  heldBoundaries,
  observationMetrics,
  positiveRows: positiveExecutorRows.map((row) => ({
    caseId: row.caseId ?? "",
    pid: row.pid ?? "",
    title: row.title ?? "",
    family: row.family ?? "",
    bodyModel: row.bodyModel ?? "",
    packageAxis: row.packageAxis ?? "",
    lensAxis: row.lensAxis ?? "",
    comparableKey: row.actualComparableKey ?? "",
  })),
  heldBoundaryExamples: boundaryRows.map((row) => ({
    sublane: row.sublane,
    pid: row.pid,
    title: row.title,
    decision: row.decision,
    evidence: row.evidence,
  })),
  sourceFilesRead: sourceFiles.filter((file) => fs.existsSync(path.join(appDir, file))),
};

function renderMarkdown(): string {
  return [
    "# Camera Body-Only Internal Sublane Plan",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- conclusion: ${report.conclusion}`,
    "- ownership: camera_body_only_internal_sublane_plan_only",
    "- reportOnly: true",
    "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring/runtimeApply: false/false/false/false",
    "- runtimeApproved/public/candidatePool/runtimeApply rows: 0/0/0/0",
    "- productionDbMutation/directThirtyDayPlanEdit: false/false",
    "",
    "## Scope",
    "",
    "No-mutation plan for the interchangeable body-only exact-model camera sublane only. This defines fixture requirements, held boundaries, and future internal-only observation metrics without editing runtime/src/lib, Supabase, cron/lifecycle, candidate pool, pack UI, public promotion, or the 30-day plan.",
    "",
    "## Status",
    "",
    "- readyForInternalObservationPlanningOnly: true",
    "- readyForRuntimeApplyNow: false",
    "- recommended sublane: interchangeable_body_only_exact_model",
    "- comparable key shape for future no-mutation checks: `camera|{family}|{body_model}|body_only|no_lens`",
    "",
    "## Metrics",
    "",
    table([
      ["metric", "value"],
      ["sourceTaxonomyRows", String(metrics.sourceTaxonomyRows)],
      ["sourceBodyOnlyRows", String(metrics.sourceBodyOnlyRows)],
      ["sourceBoundaryRows", String(metrics.sourceBoundaryRows)],
      ["executorRows", String(metrics.executorRows)],
      ["executorPositiveRows", String(metrics.executorPositiveRows)],
      ["executorManualRows", String(metrics.executorManualRows)],
      ["executorHoldRows", String(metrics.executorHoldRows)],
      ["distinctPositiveFamilies", String(metrics.distinctPositiveFamilies)],
      ["internalRouteRows", String(metrics.internalRouteRows)],
      ["internalRoutePositiveRows", String(metrics.internalRoutePositiveRows)],
      ["internalRoutePoolBlockedRows", String(metrics.internalRoutePoolBlockedRows)],
      ["observationMetrics", String(metrics.observationMetrics)],
      ["runtimeApprovedRows", "0"],
      ["publicPromotionRows", "0"],
      ["candidatePoolRows", "0"],
      ["runtimeApplyRows", "0"],
    ]),
    "",
    "## Positive Fixture Requirements",
    "",
    ...positiveFixtureRequirements.flatMap((section) => [
      `### ${section.title}`,
      "",
      ...section.requirements.map((item) => `- ${item}`),
      "",
    ]),
    "## Body-Only Positive Fixtures",
    "",
    table([
      ["caseId", "pid", "family", "bodyModel", "package", "lens", "title", "key"],
      ...report.positiveRows.map((row) => [
        row.caseId,
        row.pid,
        row.family,
        row.bodyModel,
        row.packageAxis,
        row.lensAxis,
        row.title,
        row.comparableKey,
      ]),
    ]),
    "",
    "## Held Boundaries",
    "",
    ...heldBoundaries.flatMap((section) => [
      `### ${section.title}`,
      "",
      ...section.requirements.map((item) => `- ${item}`),
      "",
    ]),
    "## Boundary Examples",
    "",
    table([
      ["sublane", "pid", "decision", "title", "evidence"],
      ...report.heldBoundaryExamples.map((row) => [
        row.sublane,
        row.pid,
        row.decision,
        row.title,
        row.evidence,
      ]),
    ]),
    "",
    "## Future Internal-Only Observation Metrics",
    "",
    table([
      ["metric", "target", "source", "hold trigger"],
      ...observationMetrics.map((row) => [
        row.metric,
        row.target,
        row.source,
        row.rollbackOrHoldTrigger,
      ]),
    ]),
    "",
    "## Source Files Read",
    "",
    ...report.sourceFilesRead.map((file) => `- ${file}`),
    "",
  ].join("\n");
}

fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "camera-body-only-internal-sublane-plan-latest.json");
const mdPath = path.join(reportsDir, "camera-body-only-internal-sublane-plan-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(mdPath, renderMarkdown());

console.log(JSON.stringify({
  conclusion: report.conclusion,
  readyForInternalObservationPlanningOnly: true,
  readyForRuntimeApplyNow: false,
  executorPositiveRows: metrics.executorPositiveRows,
  distinctPositiveFamilies: metrics.distinctPositiveFamilies,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
  jsonPath,
  mdPath,
}, null, 2));
