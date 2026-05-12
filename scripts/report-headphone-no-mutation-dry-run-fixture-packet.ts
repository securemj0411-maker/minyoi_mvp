import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type DryRunPlan = {
  category: string;
  dryRunCases: Array<{
    caseId: string;
    inputTitle: string;
    expectedClass: "positive" | "hold" | "manual_review" | "split_only" | "ignore";
    expectedDryRunDecision: "candidate_positive_only" | "manual_review_only" | "negative_hold_only";
    assertion: string;
    failureMeans: string;
  }>;
  requiredInputs: string[];
  allowedOutputs: string[];
  forbiddenOutputs: string[];
  stopConditions: string[];
  passCriteria: string[];
};

type DryRunPlanReport = {
  dryRunPlans: DryRunPlan[];
};

type SourceBackfill = {
  category: string;
  caseId: string;
  sources: Array<{ label: string; url: string; retrievedAt: string; note: string }>;
};

type SourceBackfillReport = {
  sourceBackfills: SourceBackfill[];
};

type PrepCase = {
  caseId: string;
  inputTitle: string;
  expectedClass: string;
  blockerType: string;
  productIdentityTokens: string[];
  variantTokens: string[];
  conditionTokens: string[];
  sellerIntentTokens: string[];
  bundleOrQuantityTokens: string[];
  accessoryOrPartTokens: string[];
  evidenceSource: string;
  externalEvidence?: Array<{ label: string; url: string; retrievedAt: string }>;
  confidence: "high" | "medium" | "low";
  notes: string;
};

type PrepReport = {
  positiveTestCases: PrepCase[];
  manualReviewTestCases: PrepCase[];
  negativeHoldTestCases: PrepCase[];
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function allPrepCases(report: PrepReport): PrepCase[] {
  return [...report.positiveTestCases, ...report.manualReviewTestCases, ...report.negativeHoldTestCases];
}

function classifierFocus(row: PrepCase): string[] {
  const focus = ["full-unit-vs-accessory", "brand-model-identity"];
  if (row.productIdentityTokens.includes("airpods_max")) focus.push("airpods-max-connector-generation");
  if (row.variantTokens.includes("usb-c") || row.variantTokens.includes("lightning")) focus.push("connector-token");
  if (row.accessoryOrPartTokens.length > 0) focus.push("accessory-exclusion");
  if (row.bundleOrQuantityTokens.length > 0) focus.push("bundle-review");
  return [...new Set(focus)];
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const planReport = await readJson<DryRunPlanReport>(path.join(reportsDir, "subagent-implementation-prep-no-mutation-dry-run-plan-latest.json"));
  const sourceBackfill = await readJson<SourceBackfillReport>(path.join(reportsDir, "subagent-implementation-prep-spec-source-backfill-latest.json"));
  const prep = await readJson<PrepReport>(path.join(reportsDir, "headphone-matched-sku-implementation-prep-latest.json"));

  const plan = planReport.dryRunPlans.find((item) => item.category === "headphone_discovered");
  if (!plan) throw new Error("headphone_discovered dry-run plan not found");

  const prepByCaseId = new Map(allPrepCases(prep).map((row) => [row.caseId, row]));
  const sourceByCaseId = new Map(sourceBackfill.sourceBackfills.filter((row) => row.category === "headphone_discovered").map((row) => [row.caseId, row.sources]));

  const fixtureRows = plan.dryRunCases.map((row) => {
    const prepRow = prepByCaseId.get(row.caseId);
    if (!prepRow) throw new Error(`missing prep row for ${row.caseId}`);
    const inlineSources = prepRow.externalEvidence ?? [];
    const backfilledSources = sourceByCaseId.get(row.caseId) ?? [];
    return {
      ...row,
      blockerType: prepRow.blockerType,
      productIdentityTokens: prepRow.productIdentityTokens,
      variantTokens: prepRow.variantTokens,
      conditionTokens: prepRow.conditionTokens,
      sellerIntentTokens: prepRow.sellerIntentTokens,
      bundleOrQuantityTokens: prepRow.bundleOrQuantityTokens,
      accessoryOrPartTokens: prepRow.accessoryOrPartTokens,
      evidenceSource: prepRow.evidenceSource,
      sourceEvidenceRefs: [
        ...inlineSources.map((source) => ({ ...source, sourceType: "inline_prep" as const })),
        ...backfilledSources.map((source) => ({ ...source, sourceType: "backfilled_spec" as const })),
      ],
      confidence: prepRow.confidence,
      notes: prepRow.notes,
      classifierFocus: classifierFocus(prepRow),
    };
  });

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope: "Headphone no-mutation dry-run fixture packet",
    category: "headphone_discovered",
    metrics: {
      fixtureRows: fixtureRows.length,
      positiveRows: fixtureRows.filter((row) => row.expectedClass === "positive").length,
      manualReviewRows: fixtureRows.filter((row) => row.expectedClass === "manual_review").length,
      holdRows: fixtureRows.filter((row) => row.expectedClass === "hold").length,
      rowsWithSourceRefs: fixtureRows.filter((row) => row.sourceEvidenceRefs.length > 0).length,
      rowsWithoutSourceRefs: fixtureRows.filter((row) => row.sourceEvidenceRefs.length === 0).length,
      runtimeApprovedRows: 0,
    },
    requiredInputs: plan.requiredInputs,
    allowedOutputs: plan.allowedOutputs,
    forbiddenOutputs: plan.forbiddenOutputs,
    stopConditions: plan.stopConditions,
    passCriteria: plan.passCriteria,
    fixtureRows,
    deferred: [
      "AirPods Max connector/generation ambiguity remains manual-review unless explicit title tokens are present.",
      "Accessory and bundle rows must not become positive comparable candidates.",
      "Unknown branded headphone SKUs beyond the matched set need separate catalog expansion.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-no-mutation-dry-run-fixture-packet-latest.json"), JSON.stringify(report, null, 2));

  const rows = fixtureRows.map((row) => {
    const focus = row.classifierFocus.join(", ");
    return `| ${row.caseId} | ${row.expectedClass} | ${row.expectedDryRunDecision} | ${row.confidence} | ${row.sourceEvidenceRefs.length} | ${focus} | ${row.inputTitle.replace(/\|/g, "/")} |`;
  });

  const md = [
    "# Headphone No-Mutation Dry-Run Fixture Packet",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only fixture packet for a future headphone dry-run. This does not execute parser/runtime wiring.",
    "",
    "## Metrics",
    "",
    `- fixture rows: ${report.metrics.fixtureRows}`,
    `- positive/manual/hold: ${report.metrics.positiveRows}/${report.metrics.manualReviewRows}/${report.metrics.holdRows}`,
    `- rows with source refs: ${report.metrics.rowsWithSourceRefs}`,
    `- rows without source refs: ${report.metrics.rowsWithoutSourceRefs}`,
    `- runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    "",
    "## Fixture Rows",
    "",
    "| case_id | expected_class | expected_dry_run_decision | confidence | source_refs | classifier_focus | title |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
    ...rows,
    "",
    "## Stop Conditions",
    "",
    ...report.stopConditions.map((item) => `- ${item}`),
    "",
    "## Deferred",
    "",
    ...report.deferred.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-no-mutation-dry-run-fixture-packet-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-no-mutation-dry-run-fixture-packet-latest.json");
  console.log("wrote reports/headphone-no-mutation-dry-run-fixture-packet-latest.md");
  console.log(`headphone fixture packet: rows=${fixtureRows.length}, positive=${report.metrics.positiveRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
