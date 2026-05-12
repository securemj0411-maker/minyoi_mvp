import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type PrepCase = {
  caseId: string;
  inputTitle: string;
  expectedClass: "positive" | "manual_review" | "hold" | "split_only" | "ignore";
  blockerType: string;
  productIdentityTokens: string[];
  variantTokens: string[];
  confidence: "high" | "medium" | "low";
  notes: string;
};

type PrepReport = {
  metrics: Record<string, number>;
  manualReviewTestCases: PrepCase[];
  negativeHoldTestCases: PrepCase[];
};

type RepeatReview = {
  metrics: Record<string, number>;
  addedGuardrailSummary: Array<{ caseId: string; lane: string; blockerType: string; takeaway: string }>;
};

type EvidenceBacklogRow = {
  caseId: string;
  lane: "unknown_brand_sku_backlog" | "known_brand_model_backlog" | "airpods_max_ambiguity_backlog";
  title: string;
  currentClass: PrepCase["expectedClass"];
  blockerType: string;
  inferredBrandOrFamily: string;
  suspectedModelOrSeries: string;
  requiredEvidence: string[];
  whyNotRuntimeReady: string;
  proposedNextReportOnlyAction: string;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function classify(row: PrepCase): EvidenceBacklogRow {
  const title = row.inputTitle.toLowerCase();
  if (/레이저|razer|blackshark/.test(title)) {
    return {
      caseId: row.caseId,
      lane: "known_brand_model_backlog",
      title: row.inputTitle,
      currentClass: row.expectedClass,
      blockerType: row.blockerType,
      inferredBrandOrFamily: "Razer",
      suspectedModelOrSeries: "BlackShark V3 HyperSpeed",
      requiredEvidence: ["Razer official product/spec page", "Razer support page or model family page", "local sample count beyond one row"],
      whyNotRuntimeReady: "Known brand/model-looking title exists, but it is outside the matched-SKU subset and has no source-backed catalog entry in this run.",
      proposedNextReportOnlyAction: "Backfill official Razer BlackShark V3 HyperSpeed evidence and keep as hold until catalog expansion is approved.",
    };
  }

  if (/비츠|beats|닥터드레/.test(title)) {
    return {
      caseId: row.caseId,
      lane: "unknown_brand_sku_backlog",
      title: row.inputTitle,
      currentClass: row.expectedClass,
      blockerType: row.blockerType,
      inferredBrandOrFamily: "Beats",
      suspectedModelOrSeries: "Beats EP / unclear on-ear headset wording",
      requiredEvidence: ["Beats/Apple official product archive or support page", "model-specific spec/source evidence", "Korean title normalization for Beats EP vs generic Beats wording"],
      whyNotRuntimeReady: "Brand is known but SKU/model identity is unclear from title and should not become a comparable key.",
      proposedNextReportOnlyAction: "Backfill Beats EP source evidence and add separate unknown-SKU guardrails before any implementation review.",
    };
  }

  return {
    caseId: row.caseId,
    lane: "airpods_max_ambiguity_backlog",
    title: row.inputTitle,
    currentClass: row.expectedClass,
    blockerType: row.blockerType,
    inferredBrandOrFamily: "Apple AirPods Max",
    suspectedModelOrSeries: "AirPods Max connector/generation ambiguous",
    requiredEvidence: ["Apple Identify your AirPods support page", "explicit title token policy for USB-C/Lightning", "owner-approved generation/connector decision"],
    whyNotRuntimeReady: "AirPods Max wording is strong, but connector/generation inference remains risky without explicit policy.",
    proposedNextReportOnlyAction: "Keep manual-review and maintain connector/generation ambiguity lane.",
  };
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const prep = await readJson<PrepReport>(path.join(reportsDir, "headphone-matched-sku-implementation-prep-latest.json"));
  const repeatReview = await readJson<RepeatReview>(path.join(reportsDir, "headphone-repeat-dry-run-review-packet-latest.json"));

  const candidateRows = [...prep.negativeHoldTestCases, ...prep.manualReviewTestCases].filter((row) =>
    /unknown|generic|branded|sku|레이저|비츠|beats|blackshark|connector/i.test(
      [row.caseId, row.inputTitle, row.blockerType, ...row.productIdentityTokens, ...row.variantTokens].join(" "),
    ),
  );
  const backlogRows = candidateRows.map(classify);

  const laneCounts = backlogRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.lane] = (acc[row.lane] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    scope: "Broader headphone brand/SKU evidence backlog plan",
    inputFiles: [
      "reports/headphone-matched-sku-implementation-prep-latest.json",
      "reports/headphone-repeat-dry-run-review-packet-latest.json",
    ],
    metrics: {
      repeatDryRunRows: repeatReview.metrics.rows,
      repeatDryRunPassedRows: repeatReview.metrics.passedRows,
      backlogRows: backlogRows.length,
      knownBrandModelBacklogRows: laneCounts.known_brand_model_backlog ?? 0,
      unknownBrandSkuBacklogRows: laneCounts.unknown_brand_sku_backlog ?? 0,
      airpodsMaxAmbiguityBacklogRows: laneCounts.airpods_max_ambiguity_backlog ?? 0,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    backlogRows,
    recommendedOrder: [
      "Razer BlackShark V3 HyperSpeed official/source evidence backfill",
      "Beats EP / Beats on-ear model identity evidence backfill",
      "AirPods Max connector/generation ambiguity policy remains manual-review until owner decision",
    ],
    boundary: [
      "This plan does not add positive rows.",
      "Known brand is not enough; model/SKU identity and source evidence are required.",
      "No runtime catalog, parser, candidate-pool, or DB work is approved.",
    ],
    nextStep: "Create report-only source backfill for Razer/Beats official evidence if continuing without runtime changes.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-broader-brand-sku-evidence-plan-latest.json"), JSON.stringify(report, null, 2));

  const rows = backlogRows.map((row) => `| ${row.caseId} | ${row.lane} | ${row.inferredBrandOrFamily} | ${row.suspectedModelOrSeries} | ${row.currentClass} | ${row.blockerType} | ${row.proposedNextReportOnlyAction.replace(/\|/g, "/")} |`);
  const md = [
    "# Headphone Broader Brand/SKU Evidence Plan",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only evidence backlog plan for broader headphone brand/SKU rows. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- repeat dry-run rows/pass: ${report.metrics.repeatDryRunRows}/${report.metrics.repeatDryRunPassedRows}`,
    `- backlog rows: ${report.metrics.backlogRows}`,
    `- known-brand/unknown-SKU/AirPods-ambiguity rows: ${report.metrics.knownBrandModelBacklogRows}/${report.metrics.unknownBrandSkuBacklogRows}/${report.metrics.airpodsMaxAmbiguityBacklogRows}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Backlog Rows",
    "",
    "| case_id | lane | brand_or_family | suspected_model_or_series | current_class | blocker_type | next_report_only_action |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Recommended Order",
    "",
    ...report.recommendedOrder.map((item) => `- ${item}`),
    "",
    "## Boundary",
    "",
    ...report.boundary.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    report.nextStep,
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-broader-brand-sku-evidence-plan-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-broader-brand-sku-evidence-plan-latest.json");
  console.log("wrote reports/headphone-broader-brand-sku-evidence-plan-latest.md");
  console.log(`headphone broader brand/SKU evidence plan: backlog=${backlogRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
