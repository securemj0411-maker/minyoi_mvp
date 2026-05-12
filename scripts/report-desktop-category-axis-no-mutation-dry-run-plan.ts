import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type RuntimeReviewPacket = {
  generatedAt: string;
  lane: string;
  status: string;
  recommendation: string;
  summary: string;
  evidence: {
    positiveFixtures: number;
    manualRows: number;
    holdRows: number;
    failedPreflightChecks: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    readyForRuntimeApplyNow: boolean;
  };
  runtimeGap: {
    catalogCategoryMissing: boolean;
    optionParserComparableKeyBranchMissing: boolean;
    categoryReadinessMissing: boolean;
    currentCategories: string[];
  };
  futurePatchSurface: string[];
  guardrails: string[];
  nextStep: string[];
  publicPromotion: false;
  candidatePoolWiring: false;
  productionDbMutation: false;
};

type PreflightRow = {
  caseId: string;
  pid: string;
  title: string;
  cpuIdentity?: string | null;
  gpuIdentity?: string | null;
  bucket?: string;
  reason?: string;
};

type PreflightPacket = {
  generatedAt: string;
  lane: string;
  conclusion: string;
  reportOnly: true;
  runtimePatchScope: {
    readyForFutureNarrowRuntimePatch: boolean;
    readyForRuntimeApplyNow: boolean;
    runtimeApply: false;
    runtimeApplyRows: number;
    runtimeApproved: false;
    runtimeApprovedRows: number;
    publicPromotion: false;
    publicPromotionRows: number;
    candidatePool: false;
    candidatePoolRows: number;
    candidatePoolPolicyWiring: false;
  };
  boundary: {
    runtimeApprovedRows: number;
    runtimeApplyRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    productionDbMutation: false;
    directThirtyDayPlanEdit: false;
  };
  metrics: {
    positiveFixtureRows: number;
    manualRows: number;
    holdRowCount: number;
    failedChecks: number;
  };
  positiveFixtures: PreflightRow[];
  manualExcludedRows: PreflightRow[];
  negativeHoldRows: PreflightRow[];
  riskEvaluations: Array<{
    id: string;
    status: string;
    runtimePatchImpact: string;
    evidenceRows: string[];
    decision: string;
  }>;
};

type Check = {
  id: string;
  status: "pass" | "fail";
  check: string;
  detail: string;
};

type FixtureExpectation = {
  class: "positive" | "manual" | "hold";
  requiredRows: number;
  dryRunDecision: "candidate_positive_only" | "manual_review_only" | "negative_hold_only";
  mustProve: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const inputFiles = [
  "reports/desktop-private-used-runtime-review-packet-latest.md",
  "reports/desktop-private-used-runtime-review-packet-latest.json",
  "reports/desktop-private-used-no-mutation-preflight-latest.md",
  "reports/desktop-private-used-no-mutation-preflight-latest.json",
];

const laterPatchFiles = [
  {
    file: "src/lib/catalog.ts",
    laterDecision: "Add one Desktop category axis, preferably desktop unless owner chooses desktop_pc.",
  },
  {
    file: "src/lib/option-parser.ts",
    laterDecision: "Add strict CPU/GPU extraction and Desktop comparable-key branch.",
  },
  {
    file: "src/lib/category-readiness.ts",
    laterDecision: "Add Desktop as internal_only or blocked; never ready on first patch.",
  },
  {
    file: "src/lib/pipeline.ts",
    laterDecision: "Add Desktop body/shop/template/accessory exclusions only if parser branch needs pipeline gating.",
  },
  {
    file: "tests/core-rules.test.ts",
    laterDecision: "Add positive/manual/hold regression rows before runtime patch approval.",
  },
  {
    file: "generated catalog inputs",
    laterDecision: "Add only narrow internal catalog rows and verify no broad Desktop public SKU generation.",
  },
];

const forbiddenNow = [
  "src/lib/*",
  "supabase/schema.sql",
  "src/app/api/cron/*",
  "src/app/api/**/lifecycle*",
  "src/lib/candidate-pool-builder.ts",
  "src/components/pack-shop.tsx",
  "src/components/pack-reveal-modal.tsx",
  "public promotion/readiness changes",
  "30일_실행계획.md",
];

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

async function readText(relativePath: string): Promise<string> {
  return readFile(path.join(appDir, relativePath), "utf8");
}

function boundaryRowsZero(runtimeReview: RuntimeReviewPacket, preflight: PreflightPacket): boolean {
  return (
    runtimeReview.evidence.runtimeApprovedRows === 0 &&
    runtimeReview.evidence.publicPromotionRows === 0 &&
    runtimeReview.evidence.candidatePoolRows === 0 &&
    preflight.boundary.runtimeApprovedRows === 0 &&
    preflight.boundary.runtimeApplyRows === 0 &&
    preflight.boundary.publicPromotionRows === 0 &&
    preflight.boundary.candidatePoolRows === 0
  );
}

function buildChecks(input: {
  runtimeReview: RuntimeReviewPacket;
  preflight: PreflightPacket;
  runtimeReviewMd: string;
  preflightMd: string;
}): Check[] {
  const { runtimeReview, preflight, runtimeReviewMd, preflightMd } = input;

  return [
    {
      id: "PLAN-01",
      status: runtimeReview.runtimeGap.catalogCategoryMissing ? "pass" : "fail",
      check: "runtime review identifies missing Desktop catalog category axis",
      detail: `currentCategories=${runtimeReview.runtimeGap.currentCategories.join(",")}`,
    },
    {
      id: "PLAN-02",
      status: runtimeReview.runtimeGap.optionParserComparableKeyBranchMissing ? "pass" : "fail",
      check: "runtime review identifies missing Desktop comparable-key branch",
      detail: "option-parser desktop branch missing=true",
    },
    {
      id: "PLAN-03",
      status: runtimeReview.runtimeGap.categoryReadinessMissing ? "pass" : "fail",
      check: "runtime review identifies missing Desktop readiness gate",
      detail: "category-readiness desktop entry missing=true",
    },
    {
      id: "PLAN-04",
      status: preflight.metrics.positiveFixtureRows === 10 &&
        preflight.metrics.manualRows >= 15 &&
        preflight.metrics.holdRowCount >= 14
        ? "pass"
        : "fail",
      check: "preflight has sufficient positive/manual/hold dry-run fixture pressure",
      detail: `positive/manual/hold=${preflight.metrics.positiveFixtureRows}/${preflight.metrics.manualRows}/${preflight.metrics.holdRowCount}`,
    },
    {
      id: "PLAN-05",
      status: runtimeReview.evidence.readyForRuntimeApplyNow === false &&
        preflight.runtimePatchScope.readyForRuntimeApplyNow === false
        ? "pass"
        : "fail",
      check: "both packets keep runtime apply blocked now",
      detail: "readyForRuntimeApplyNow=false/false",
    },
    {
      id: "PLAN-06",
      status: boundaryRowsZero(runtimeReview, preflight) ? "pass" : "fail",
      check: "runtimeApproved/publicPromotion/candidatePool/runtimeApply rows are all zero",
      detail: "runtimeApproved/publicPromotion/candidatePool/runtimeApply=0/0/0/0",
    },
    {
      id: "PLAN-07",
      status: runtimeReviewMd.includes("Prefer `desktop`") && runtimeReviewMd.includes("desktop_pc")
        ? "pass"
        : "fail",
      check: "category-name decision is explicitly desktop vs desktop_pc",
      detail: "default recommendation is desktop unless owner chooses desktop_pc",
    },
    {
      id: "PLAN-08",
      status: runtimeReviewMd.includes("internal_only") && runtimeReviewMd.includes("never `ready` initially")
        ? "pass"
        : "fail",
      check: "internal-only readiness requirement is explicit",
      detail: "Desktop readiness must start internal_only or blocked",
    },
    {
      id: "PLAN-09",
      status: preflight.riskEvaluations.length >= 5 && preflightMd.includes("Policy Risk Evaluation")
        ? "pass"
        : "fail",
      check: "unresolved policy risks remain represented in dry-run plan inputs",
      detail: `riskEvaluations=${preflight.riskEvaluations.length}`,
    },
  ];
}

function fixtureExpectations(preflight: PreflightPacket): FixtureExpectation[] {
  return [
    {
      class: "positive",
      requiredRows: preflight.metrics.positiveFixtureRows,
      dryRunDecision: "candidate_positive_only",
      mustProve:
        "Rows with title-visible CPU, title-visible RTX/RX GPU, fixed one-off private-used desktop body evidence produce the planned comparable key while all runtime/public/candidate flags stay false.",
    },
    {
      class: "manual",
      requiredRows: preflight.metrics.manualRows,
      dryRunDecision: "manual_review_only",
      mustProve:
        "Description-backed CPU, bare GPU tokens, peripheral/monitor bundles, body price plus monitor add-on, and insufficient private-used wording do not become positives.",
    },
    {
      class: "hold",
      requiredRows: preflight.metrics.holdRowCount,
      dryRunDecision: "negative_hold_only",
      mustProve:
        "Proshop, shop template, configurable/new-build, software/license/accessory, GPU-only, and commercial/mining rows remain hold/negative.",
    },
  ];
}

function sampleRows(rows: PreflightRow[], limit: number): PreflightRow[] {
  return rows.slice(0, limit).map((row) => ({
    caseId: row.caseId,
    pid: row.pid,
    title: row.title,
    cpuIdentity: row.cpuIdentity ?? null,
    gpuIdentity: row.gpuIdentity ?? null,
    bucket: row.bucket,
    reason: row.reason,
  }));
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [runtimeReview, preflight, runtimeReviewMd, preflightMd] = await Promise.all([
    readJson<RuntimeReviewPacket>("reports/desktop-private-used-runtime-review-packet-latest.json"),
    readJson<PreflightPacket>("reports/desktop-private-used-no-mutation-preflight-latest.json"),
    readText("reports/desktop-private-used-runtime-review-packet-latest.md"),
    readText("reports/desktop-private-used-no-mutation-preflight-latest.md"),
  ]);

  const checks = buildChecks({ runtimeReview, preflight, runtimeReviewMd, preflightMd });
  const failedChecks = checks.filter((check) => check.status === "fail");
  const categoryAxisDecision = {
    recommendedRuntimeCategory: "desktop",
    alternateRuntimeCategory: "desktop_pc",
    decisionNeeded: true,
    rationale:
      "Use desktop for the runtime category if adding a user-facing runtime axis; reserve desktop_pc for source/report naming compatibility only if owner requires it.",
  };
  const readinessPlan = {
    firstRuntimeReadiness: "internal_only_or_blocked",
    forbiddenInitialReadiness: "ready",
    dryRunMustProve:
      "Desktop rows can be evaluated internally without public promotion, candidate-pool wiring, DB writes, or broad catalog exposure.",
  };
  const comparableKeyPlan = {
    proposedShape:
      "desktop|private_used_body|cpu:<normalized_cpu>|gpu:<normalized_gpu>|listing:fixed_one_off",
    requiredParts: [
      "category axis: desktop or owner-approved desktop_pc",
      "lane axis: private_used_body",
      "normalized CPU preserving family, generation, tier, and suffix",
      "normalized RTX/RX GPU preserving family, generation, tier, Ti/Super suffix",
      "listing-type axis fixed_one_off",
    ],
    explicitlyDeferredParts: [
      "RAM",
      "SSD/storage",
      "warranty/newness",
      "case/aesthetic",
      "monitor/peripheral bundle treatment",
      "description-backed CPU",
      "bare GPU token normalization",
    ],
  };

  const report = {
    generatedAt,
    lane: runtimeReview.lane,
    reportOnly: true,
    scope: "Desktop category-axis no-mutation dry-run plan only; no executor implementation and no runtime patch.",
    conclusion: failedChecks.length === 0
      ? "desktop_category_axis_no_mutation_dry_run_plan_ready_for_owner_review"
      : "desktop_category_axis_no_mutation_dry_run_plan_blocked",
    dryRunPlanReady: failedChecks.length === 0,
    boundary: {
      reportOnly: true,
      runtimeApproved: false,
      runtimeApprovedRows: 0,
      runtimeApply: false,
      runtimeApplyRows: 0,
      publicPromotion: false,
      publicPromotionRows: 0,
      candidatePool: false,
      candidatePoolRows: 0,
      candidatePoolPolicyWiring: false,
      productionDbMutation: false,
      directThirtyDayPlanEdit: false,
    },
    metrics: {
      checks: checks.length,
      failedChecks: failedChecks.length,
      positiveFixtureRows: preflight.metrics.positiveFixtureRows,
      manualRows: preflight.metrics.manualRows,
      holdRows: preflight.metrics.holdRowCount,
      runtimeApprovedRows: 0,
      runtimeApplyRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      futurePatchFiles: laterPatchFiles.length,
      ownerDecisionsRequired: 8,
    },
    categoryAxisDecision,
    readinessPlan,
    comparableKeyPlan,
    fixtureExpectations: fixtureExpectations(preflight),
    dryRunExecutorMustProve: [
      "It reads only report/fixture inputs and writes only report-only dry-run outputs.",
      "It chooses one category axis name consistently after owner decision: desktop or desktop_pc.",
      "It keeps Desktop readiness internal_only or blocked and never reports ready.",
      "It emits the proposed comparable key only for strict positive private-used body rows.",
      "It keeps all manual rows manual-review-only and all hold rows negative/hold-only.",
      "It preserves runtimeApproved/publicPromotion/candidatePool/runtimeApply rows at 0.",
      "It lists every later runtime file that would need an approved patch before implementation.",
    ],
    positiveFixtureSample: sampleRows(preflight.positiveFixtures, 10),
    manualFixtureSample: sampleRows(preflight.manualExcludedRows, 8),
    holdFixtureSample: sampleRows(preflight.negativeHoldRows, 8),
    rollbackPlan: [
      "If a later runtime patch leaks broad Desktop rows, revert Desktop readiness to blocked.",
      "Remove Desktop generated/internal catalog rows added by that patch.",
      "Disable the Desktop comparable-key branch while keeping report-only fixtures.",
      "Confirm public promotion and candidate-pool wiring remain closed.",
      "Do not alter existing monitor/speaker/camera/headphone category paths during rollback.",
    ],
    laterPatchFiles,
    forbiddenNow,
    checks,
    failedChecks,
    inputFiles,
    ownerDecisionsStillRequired: [
      "Choose runtime category name: desktop or desktop_pc.",
      "Confirm initial readiness value: internal_only or blocked, never ready.",
      "Approve comparable key shape and whether private_used_body is a key axis.",
      "Approve exact CPU normalization table and suffix preservation.",
      "Approve exact RTX/RX GPU normalization table and Ti/Super suffix preservation.",
      "Decide whether description-backed CPU remains manual-only.",
      "Decide whether bare GPU tokens such as 5080/9070xt remain manual/hold.",
      "Decide whether monitor/peripheral bundles ever get a separate lane or stay excluded.",
    ],
    nextAction:
      "Owner review should decide category axis and comparable-key shape before any no-mutation executor or runtime patch is proposed.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "desktop-category-axis-no-mutation-dry-run-plan-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const md = [
    "# Desktop Category-Axis No-Mutation Dry-Run Plan",
    "",
    `- generatedAt: ${generatedAt}`,
    `- lane: ${report.lane}`,
    `- conclusion: ${report.conclusion}`,
    `- dryRunPlanReady: ${report.dryRunPlanReady}`,
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- runtimeApproved/runtimeApply/publicPromotion/candidatePool: false/false/false/false",
    "- runtimeApprovedRows/runtimeApplyRows/publicPromotionRows/candidatePoolRows: 0/0/0/0",
    "- productionDbMutation: false",
    "- directThirtyDayPlanEdit: false",
    "",
    "## Metrics",
    "",
    table(
      ["metric", "value"],
      [
        ["checks", report.metrics.checks],
        ["failedChecks", report.metrics.failedChecks],
        ["positiveFixtureRows", report.metrics.positiveFixtureRows],
        ["manualRows", report.metrics.manualRows],
        ["holdRows", report.metrics.holdRows],
        ["futurePatchFiles", report.metrics.futurePatchFiles],
        ["ownerDecisionsRequired", report.metrics.ownerDecisionsRequired],
      ],
    ),
    "",
    "## Category Axis Decision",
    "",
    table(
      ["field", "value"],
      [
        ["recommendedRuntimeCategory", categoryAxisDecision.recommendedRuntimeCategory],
        ["alternateRuntimeCategory", categoryAxisDecision.alternateRuntimeCategory],
        ["decisionNeeded", categoryAxisDecision.decisionNeeded],
        ["rationale", categoryAxisDecision.rationale],
      ],
    ),
    "",
    "## Readiness Plan",
    "",
    table(
      ["field", "value"],
      [
        ["firstRuntimeReadiness", readinessPlan.firstRuntimeReadiness],
        ["forbiddenInitialReadiness", readinessPlan.forbiddenInitialReadiness],
        ["dryRunMustProve", readinessPlan.dryRunMustProve],
      ],
    ),
    "",
    "## Comparable Key Shape",
    "",
    `Proposed: \`${comparableKeyPlan.proposedShape}\``,
    "",
    "Required parts:",
    "",
    ...comparableKeyPlan.requiredParts.map((part) => `- ${part}`),
    "",
    "Deferred parts:",
    "",
    ...comparableKeyPlan.explicitlyDeferredParts.map((part) => `- ${part}`),
    "",
    "## Fixture Expectations",
    "",
    table(
      ["class", "requiredRows", "dryRunDecision", "mustProve"],
      report.fixtureExpectations.map((row) => [
        row.class,
        row.requiredRows,
        row.dryRunDecision,
        row.mustProve,
      ]),
    ),
    "",
    "## Dry-Run Executor Must Prove",
    "",
    ...report.dryRunExecutorMustProve.map((item) => `- ${item}`),
    "",
    "## Checks",
    "",
    table(
      ["id", "status", "check", "detail"],
      checks.map((check) => [check.id, check.status, check.check, check.detail]),
    ),
    "",
    "## Later Patch Files If Approved",
    "",
    table(
      ["file", "required later decision"],
      laterPatchFiles.map((row) => [row.file, row.laterDecision]),
    ),
    "",
    "## Rollback Plan",
    "",
    ...report.rollbackPlan.map((item) => `- ${item}`),
    "",
    "## Owner Decisions Still Required",
    "",
    ...report.ownerDecisionsStillRequired.map((item) => `- ${item}`),
    "",
    "## Forbidden Now",
    "",
    ...forbiddenNow.map((item) => `- ${item}`),
    "",
    "## Inputs Read",
    "",
    ...inputFiles.map((item) => `- ${item}`),
    "",
    "## Next Action",
    "",
    report.nextAction,
    "",
  ].join("\n");

  await writeFile(path.join(reportsDir, "desktop-category-axis-no-mutation-dry-run-plan-latest.md"), md);

  console.log(JSON.stringify({
    report: "reports/desktop-category-axis-no-mutation-dry-run-plan-latest",
    conclusion: report.conclusion,
    dryRunPlanReady: report.dryRunPlanReady,
    failedChecks: report.metrics.failedChecks,
    positiveFixtureRows: report.metrics.positiveFixtureRows,
    manualRows: report.metrics.manualRows,
    holdRows: report.metrics.holdRows,
    runtimeApprovedRows: 0,
    runtimeApplyRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
