import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountMetric = {
  key: string;
  count: number;
};

type BackfillReport = {
  category: string;
  lane: string;
  reportOnly: boolean;
  conclusion: string;
  backfillSufficientForSelectedSubset: boolean;
  sufficientForRuntimePatch: boolean;
  boundary: {
    runtimeApprovedRows: number;
    runtimeApplyRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
  };
  metrics: {
    selectedPositiveMarketRows: number;
    selectedOfficialSpecRows: number;
    selectedModels: number;
    vendorManualRows: number;
    boundaryRows: number;
    boundaryClassCounts: CountMetric[];
    failedChecks: number;
    runtimeApprovedRows: number;
    runtimeApplyRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
  };
  allowedModels: string[];
  marketEvidenceRows: Array<{
    caseId: string;
    pid: string;
    brand: string;
    normalizedModel: string;
    expectedComparableKey: string;
    title: string;
    price: number;
    condition: string;
    listingUrl: string;
  }>;
  specEvidenceRows: Array<{
    caseId: string;
    brand: string;
    normalizedModel: string;
    sourceType: string;
    url: string;
    confirms: string[];
  }>;
  boundaryRows: Array<{
    caseId: string;
    boundaryClass: string;
    expectedDecision: string;
    title: string;
    reason: string;
  }>;
  deviceClassRules: string[];
  sufficiencyStatement: string;
};

type OrchestrationReport = {
  reportOnly: boolean;
  publicPromotion: boolean;
  runtimeCatalogApply: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  recommendedNext:
    | string
    | {
      lane: string;
      status: string;
      nextAction: string;
    };
  runtimePatchReadyCandidates: number;
  sampleBackfillRequiredCandidates: number;
  candidates: Array<{
    lane: string;
    status: string;
    surface: string;
    evidence: string;
    score: number;
    blocker: string;
    nextAction: string;
  }>;
};

type Check = {
  id: string;
  status: "pass" | "fail";
  check: string;
  detail: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const inputFiles = [
  "reports/speaker-portable-exact-model-market-spec-backfill-latest.md",
  "reports/speaker-portable-exact-model-market-spec-backfill-latest.json",
  "reports/category-orchestration-status-latest.md",
  "reports/category-orchestration-status-latest.json",
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

function boundaryRowsZero(backfill: BackfillReport): boolean {
  return (
    backfill.boundary.runtimeApprovedRows === 0 &&
    backfill.boundary.runtimeApplyRows === 0 &&
    backfill.boundary.publicPromotionRows === 0 &&
    backfill.boundary.candidatePoolRows === 0 &&
    backfill.metrics.runtimeApprovedRows === 0 &&
    backfill.metrics.runtimeApplyRows === 0 &&
    backfill.metrics.publicPromotionRows === 0 &&
    backfill.metrics.candidatePoolRows === 0
  );
}

function buildChecks(input: {
  backfill: BackfillReport;
  orchestration: OrchestrationReport;
  backfillMd: string;
  orchestrationMd: string;
}): Check[] {
  const { backfill, orchestration, backfillMd, orchestrationMd } = input;
  const speakerCandidate = orchestration.candidates.find((candidate) => candidate.lane === "speaker_portable_exact_model");
  const requiredBoundaryClasses = [
    "soundbar",
    "karaoke_pa",
    "amp_receiver",
    "accessory_case_stand",
    "damaged_or_mixed_bundle",
    "buying_sold_only",
    "home_tabletop_manual",
    "vendor_only_manual",
  ];

  return [
    {
      id: "OBSERVE-01",
      status: backfill.backfillSufficientForSelectedSubset && !backfill.sufficientForRuntimePatch ? "pass" : "fail",
      check: "backfill is sufficient only for selected-subset report evidence",
      detail: backfill.conclusion,
    },
    {
      id: "OBSERVE-02",
      status: backfill.allowedModels.length === 5 && backfill.metrics.selectedPositiveMarketRows === 5 ? "pass" : "fail",
      check: "selected JBL/LG model list has five market evidence rows",
      detail: backfill.allowedModels.join(", "),
    },
    {
      id: "OBSERVE-03",
      status: backfill.metrics.selectedOfficialSpecRows >= 5 ? "pass" : "fail",
      check: "selected models have official spec/product evidence",
      detail: `officialSpecRows=${backfill.metrics.selectedOfficialSpecRows}`,
    },
    {
      id: "OBSERVE-04",
      status: requiredBoundaryClasses.every((key) =>
        backfill.metrics.boundaryClassCounts.some((row) => row.key === key && row.count > 0),
      )
        ? "pass"
        : "fail",
      check: "false-positive boundary classes are represented",
      detail: backfill.metrics.boundaryClassCounts.map((row) => `${row.key}:${row.count}`).join(", "),
    },
    {
      id: "OBSERVE-05",
      status: boundaryRowsZero(backfill) ? "pass" : "fail",
      check: "runtimeApproved/publicPromotion/candidatePool/runtimeApply rows are all zero",
      detail: "runtimeApproved/publicPromotion/candidatePool/runtimeApply=0/0/0/0",
    },
    {
      id: "OBSERVE-06",
      status: (typeof orchestration.recommendedNext === "string"
        ? orchestration.recommendedNext === "speaker_portable_exact_model"
        : orchestration.recommendedNext.lane === "speaker_portable_exact_model") &&
        speakerCandidate?.status === "market_spec_backfill_sufficient_selected_subset_public_gate_closed"
        ? "pass"
        : "fail",
      check: "orchestration recommends speaker selected-subset observation with public gate closed",
      detail: speakerCandidate?.nextAction ?? "missing speaker candidate",
    },
    {
      id: "OBSERVE-07",
      status: backfillMd.includes("Sufficiency") && orchestrationMd.includes("Prepare selected-subset internal observation plan")
        ? "pass"
        : "fail",
      check: "markdown inputs support observation-plan handoff",
      detail: "backfill sufficiency + orchestration next action present",
    },
  ];
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [backfill, orchestration, backfillMd, orchestrationMd] = await Promise.all([
    readJson<BackfillReport>("reports/speaker-portable-exact-model-market-spec-backfill-latest.json"),
    readJson<OrchestrationReport>("reports/category-orchestration-status-latest.json"),
    readText("reports/speaker-portable-exact-model-market-spec-backfill-latest.md"),
    readText("reports/category-orchestration-status-latest.md"),
  ]);

  const checks = buildChecks({ backfill, orchestration, backfillMd, orchestrationMd });
  const failedChecks = checks.filter((check) => check.status === "fail");
  const modelList = backfill.marketEvidenceRows.map((row) => ({
    brand: row.brand,
    normalizedModel: row.normalizedModel,
    expectedComparableKey: row.expectedComparableKey,
    seedCaseId: row.caseId,
    seedPid: row.pid,
    seedPrice: row.price,
    seedCondition: row.condition,
  }));
  const observationPlanSufficientForInternalOnly = failedChecks.length === 0;

  const report = {
    generatedAt,
    category: backfill.category,
    lane: "speaker_selected_subset_internal_observation_plan",
    sourceLane: backfill.lane,
    reportOnly: true,
    conclusion: observationPlanSufficientForInternalOnly
      ? "speaker_selected_subset_internal_observation_plan_sufficient_report_only_public_gate_closed"
      : "speaker_selected_subset_internal_observation_plan_blocked",
    observationPlanSufficientForInternalOnly,
    sufficientForPublicPromotion: false,
    sufficientForCandidatePool: false,
    sufficientForRuntimeApply: false,
    boundary: {
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
      models: modelList.length,
      seedMarketRows: backfill.metrics.selectedPositiveMarketRows,
      officialSpecRows: backfill.metrics.selectedOfficialSpecRows,
      boundaryRows: backfill.metrics.boundaryRows,
      guardrailClasses: backfill.metrics.boundaryClassCounts.length,
      checks: checks.length,
      failedChecks: failedChecks.length,
      runtimeApprovedRows: 0,
      runtimeApplyRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
    },
    modelList,
    marketSampleNeeds: [
      {
        need: "fresh live market samples",
        rule: "Collect at least 3 active SELLING listings per selected model before any future runtime decision.",
      },
      {
        need: "condition spread",
        rule: "Track NEW, LIKE_NEW, LIGHTLY_USED, and HEAVILY_USED separately; do not collapse condition into comparable key yet.",
      },
      {
        need: "price sanity",
        rule: "For each model, record low/median/high observed prices and flag rows outside 0.5x-2.0x of seed price for manual review.",
      },
      {
        need: "duplicate and bundle pressure",
        rule: "For each model, include at least one bundle-like or accessory-adjacent negative if it appears in live results.",
      },
      {
        need: "brand/model token variants",
        rule: "Observe spacing/case/Korean transliteration variants such as GO3/GO 3, GO4/GO 4, 붐박스2/Boombox 2, PK5, and PK7W.",
      },
    ],
    staleLiveConstraints: [
      "Observation rows must be tagged as live only when saleStatus is SELLING at capture time.",
      "Reserved, sold-only, 판매완료, buying/wanted, and partial inventory rows are not live positive market samples.",
      "Rows older than 14 days without a fresh saleStatus check are stale and can only support historical context.",
      "Official spec URLs can be durable evidence, but market price/availability evidence must be refreshed per observation wave.",
      "Do not infer public readiness from stale or single-source market rows.",
    ],
    falsePositiveGuardrails: backfill.deviceClassRules,
    additionalGuardrails: [
      "Do not promote Britz/vendor-only rows until official manufacturer/support evidence exists.",
      "Do not merge home/tabletop speakers such as JBL Authentics or Marshall Acton/Stanmore/Woburn into portable battery-speaker keys.",
      "Do not emit selected-subset comparable keys for soundbars, karaoke/PA systems, amp/receiver rows, cases, stands, damaged bundles, or non-active listings.",
      "Do not use internal observation results for pack exposure, public readiness, or candidate pool expansion.",
    ],
    requiredFeedbackSignals: [
      "falsePositiveCount by guardrail class",
      "falseNegativeCount for exact selected models missed by model token parsing",
      "manualReviewCount for ambiguous model/device-class rows",
      "activeMarketSampleCount per selected model",
      "staleOrNonLiveRows filtered per observation wave",
      "priceOutlierCount per selected model",
      "user/internal reviewer notes for bundle/accessory/device-class confusion",
    ],
    stopConditions: [
      "Any publicPromotion, candidatePool, runtimeApply, runtimeApproved, DB, or pack UI change would be required.",
      "Any soundbar/karaoke/PA/amp/receiver/accessory/damaged/non-active row would be classified as selected portable positive.",
      "Any selected JBL/LG exact model lacks at least 3 fresh active market samples in the observation window.",
      "False-positive rate exceeds 0 for protected boundary classes during dry observation.",
      "Model token logic cannot distinguish GO 3 vs GO 4, Boombox 2, PK5, and PK7W without guessing.",
      "Observation requires editing runtime/src/lib, Supabase, cron/lifecycle, candidate pool, pack UI, public promotion, or 30일_실행계획.md.",
    ],
    checks,
    failedChecks,
    inputFiles,
    nextAction:
      "Run only report-only internal observation over fresh market samples; keep public promotion, candidate pool, and runtime apply closed.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "speaker-selected-subset-internal-observation-plan-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const md = [
    "# Speaker Selected-Subset Internal Observation Plan",
    "",
    `- generatedAt: ${generatedAt}`,
    `- category: ${report.category}`,
    `- lane: ${report.lane}`,
    `- conclusion: ${report.conclusion}`,
    `- observationPlanSufficientForInternalOnly: ${report.observationPlanSufficientForInternalOnly}`,
    "- sufficientForPublicPromotion/CandidatePool/RuntimeApply: false/false/false",
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
        ["models", report.metrics.models],
        ["seedMarketRows", report.metrics.seedMarketRows],
        ["officialSpecRows", report.metrics.officialSpecRows],
        ["boundaryRows", report.metrics.boundaryRows],
        ["guardrailClasses", report.metrics.guardrailClasses],
        ["checks", report.metrics.checks],
        ["failedChecks", report.metrics.failedChecks],
      ],
    ),
    "",
    "## Model List",
    "",
    table(
      ["brand", "model", "expectedComparableKey", "seedCaseId", "seedPid", "seedPrice", "seedCondition"],
      modelList.map((row) => [
        row.brand,
        row.normalizedModel,
        row.expectedComparableKey,
        row.seedCaseId,
        row.seedPid,
        row.seedPrice,
        row.seedCondition,
      ]),
    ),
    "",
    "## Market Sample Needs",
    "",
    table(
      ["need", "rule"],
      report.marketSampleNeeds.map((row) => [row.need, row.rule]),
    ),
    "",
    "## Stale / Live Constraints",
    "",
    ...report.staleLiveConstraints.map((item) => `- ${item}`),
    "",
    "## False-Positive Guardrails",
    "",
    ...report.falsePositiveGuardrails.map((item) => `- ${item}`),
    ...report.additionalGuardrails.map((item) => `- ${item}`),
    "",
    "## Required Feedback Signals",
    "",
    ...report.requiredFeedbackSignals.map((item) => `- ${item}`),
    "",
    "## Stop Conditions",
    "",
    ...report.stopConditions.map((item) => `- ${item}`),
    "",
    "## Checks",
    "",
    table(
      ["id", "status", "check", "detail"],
      checks.map((row) => [row.id, row.status, row.check, row.detail]),
    ),
    "",
    "## Inputs Read",
    "",
    ...inputFiles.map((file) => `- ${file}`),
    "",
    "## Next Action",
    "",
    report.nextAction,
    "",
  ].join("\n");

  await writeFile(path.join(reportsDir, "speaker-selected-subset-internal-observation-plan-latest.md"), md);

  console.log(JSON.stringify({
    report: "reports/speaker-selected-subset-internal-observation-plan-latest",
    conclusion: report.conclusion,
    observationPlanSufficientForInternalOnly,
    models: report.metrics.models,
    seedMarketRows: report.metrics.seedMarketRows,
    officialSpecRows: report.metrics.officialSpecRows,
    boundaryRows: report.metrics.boundaryRows,
    failedChecks: report.metrics.failedChecks,
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
