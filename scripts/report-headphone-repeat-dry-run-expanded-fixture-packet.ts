import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SourceEvidenceRef = {
  label: string;
  url: string;
  retrievedAt: string;
  note?: string;
  sourceType?: "inline_prep" | "backfilled_spec";
};

type FixtureRow = {
  caseId: string;
  inputTitle: string;
  expectedClass: "positive" | "manual_review" | "hold" | "split_only" | "ignore";
  expectedDryRunDecision: "candidate_positive_only" | "manual_review_only" | "negative_hold_only";
  blockerType: string;
  productIdentityTokens: string[];
  variantTokens: string[];
  conditionTokens: string[];
  sellerIntentTokens: string[];
  bundleOrQuantityTokens: string[];
  accessoryOrPartTokens: string[];
  evidenceSource: string;
  sourceEvidenceRefs: SourceEvidenceRef[];
  confidence: "high" | "medium" | "low";
  notes: string;
  classifierFocus: string[];
};

type CurrentFixturePacket = {
  requiredInputs: string[];
  allowedOutputs: string[];
  forbiddenOutputs: string[];
  stopConditions: string[];
  passCriteria: string[];
  fixtureRows: FixtureRow[];
};

type PrepCase = Omit<FixtureRow, "expectedDryRunDecision" | "sourceEvidenceRefs" | "classifierFocus"> & {
  externalEvidence?: Array<{ label: string; url: string; retrievedAt: string }>;
};

type PrepReport = {
  positiveTestCases: PrepCase[];
  manualReviewTestCases: PrepCase[];
  negativeHoldTestCases: PrepCase[];
};

type ExpansionPlan = {
  expansionRows: Array<{
    caseId: string;
    proposedRepeatDecision: "manual_review_only" | "negative_hold_only";
  }>;
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
  if (row.accessoryOrPartTokens.length > 0 || /case|케이스|쿠션/i.test(row.inputTitle)) focus.push("accessory-exclusion");
  if (row.bundleOrQuantityTokens.length > 0) focus.push("bundle-review");
  if (/레이저|비츠|beats|blackshark/i.test(row.inputTitle)) focus.push("unknown-brand-sku-expansion");
  return [...new Set(focus)];
}

function sourceRefs(row: PrepCase): SourceEvidenceRef[] {
  return (row.externalEvidence ?? []).map((source) => ({ ...source, sourceType: "inline_prep" as const }));
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const current = await readJson<CurrentFixturePacket>(path.join(reportsDir, "headphone-no-mutation-dry-run-fixture-packet-latest.json"));
  const prep = await readJson<PrepReport>(path.join(reportsDir, "headphone-matched-sku-implementation-prep-latest.json"));
  const expansion = await readJson<ExpansionPlan>(path.join(reportsDir, "headphone-repeat-dry-run-expansion-plan-latest.json"));

  const prepByCaseId = new Map(allPrepCases(prep).map((row) => [row.caseId, row]));
  const existingIds = new Set(current.fixtureRows.map((row) => row.caseId));
  const expansionRows: FixtureRow[] = expansion.expansionRows.map((row) => {
    const prepRow = prepByCaseId.get(row.caseId);
    if (!prepRow) throw new Error(`missing prep case ${row.caseId}`);
    if (existingIds.has(row.caseId)) throw new Error(`duplicate expansion case ${row.caseId}`);
    return {
      caseId: prepRow.caseId,
      inputTitle: prepRow.inputTitle,
      expectedClass: prepRow.expectedClass,
      expectedDryRunDecision: row.proposedRepeatDecision,
      blockerType: prepRow.blockerType,
      productIdentityTokens: prepRow.productIdentityTokens,
      variantTokens: prepRow.variantTokens,
      conditionTokens: prepRow.conditionTokens,
      sellerIntentTokens: prepRow.sellerIntentTokens,
      bundleOrQuantityTokens: prepRow.bundleOrQuantityTokens,
      accessoryOrPartTokens: prepRow.accessoryOrPartTokens,
      evidenceSource: prepRow.evidenceSource,
      sourceEvidenceRefs: sourceRefs(prepRow),
      confidence: prepRow.confidence,
      notes: prepRow.notes,
      classifierFocus: classifierFocus(prepRow),
    };
  });

  const fixtureRows = [...current.fixtureRows, ...expansionRows];
  const duplicateIds = fixtureRows
    .map((row) => row.caseId)
    .filter((caseId, index, arr) => arr.indexOf(caseId) !== index);

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    scope: "Expanded fixture packet for repeat headphone no-mutation dry-run",
    inputFiles: [
      "reports/headphone-no-mutation-dry-run-fixture-packet-latest.json",
      "reports/headphone-matched-sku-implementation-prep-latest.json",
      "reports/headphone-repeat-dry-run-expansion-plan-latest.json",
    ],
    metrics: {
      previousFixtureRows: current.fixtureRows.length,
      addedFixtureRows: expansionRows.length,
      totalFixtureRows: fixtureRows.length,
      positiveRows: fixtureRows.filter((row) => row.expectedClass === "positive").length,
      manualReviewRows: fixtureRows.filter((row) => row.expectedClass === "manual_review").length,
      holdRows: fixtureRows.filter((row) => row.expectedClass === "hold").length,
      candidatePositiveOnlyRows: fixtureRows.filter((row) => row.expectedDryRunDecision === "candidate_positive_only").length,
      manualReviewOnlyRows: fixtureRows.filter((row) => row.expectedDryRunDecision === "manual_review_only").length,
      negativeHoldOnlyRows: fixtureRows.filter((row) => row.expectedDryRunDecision === "negative_hold_only").length,
      duplicateCaseIds: duplicateIds.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    requiredInputs: current.requiredInputs,
    allowedOutputs: current.allowedOutputs,
    forbiddenOutputs: current.forbiddenOutputs,
    stopConditions: current.stopConditions,
    passCriteria: current.passCriteria,
    fixtureRows,
    addedRows: expansionRows,
    duplicateIds,
    boundary: [
      "Expanded rows add guardrails only and no new candidate-positive cases.",
      "Manual-review and hold rows must remain non-positive.",
      "parser_candidate remains non-public.",
      "candidate-pool/runtime/DB writes remain forbidden.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-repeat-dry-run-expanded-fixture-packet-latest.json"), JSON.stringify(report, null, 2));

  const rows = fixtureRows.map((row) => {
    const added = expansionRows.some((item) => item.caseId === row.caseId) ? "yes" : "no";
    return `| ${row.caseId} | ${added} | ${row.expectedClass} | ${row.expectedDryRunDecision} | ${row.confidence} | ${row.sourceEvidenceRefs.length} | ${row.inputTitle.replace(/\|/g, "/")} |`;
  });

  const md = [
    "# Headphone Repeat Dry-Run Expanded Fixture Packet",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only expanded fixture packet for a possible repeat headphone no-mutation dry-run. This does not execute parser/runtime wiring.",
    "",
    "## Metrics",
    "",
    `- previous fixture rows: ${report.metrics.previousFixtureRows}`,
    `- added fixture rows: ${report.metrics.addedFixtureRows}`,
    `- total fixture rows: ${report.metrics.totalFixtureRows}`,
    `- positive/manual/hold rows: ${report.metrics.positiveRows}/${report.metrics.manualReviewRows}/${report.metrics.holdRows}`,
    `- candidate/manual/negative decisions: ${report.metrics.candidatePositiveOnlyRows}/${report.metrics.manualReviewOnlyRows}/${report.metrics.negativeHoldOnlyRows}`,
    `- duplicate case IDs: ${report.metrics.duplicateCaseIds}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Fixture Rows",
    "",
    "| case_id | added | expected_class | expected_dry_run_decision | confidence | source_refs | title |",
    "| --- | --- | --- | --- | --- | ---: | --- |",
    ...rows,
    "",
    "## Boundary",
    "",
    ...report.boundary.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-repeat-dry-run-expanded-fixture-packet-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-repeat-dry-run-expanded-fixture-packet-latest.json");
  console.log("wrote reports/headphone-repeat-dry-run-expanded-fixture-packet-latest.md");
  console.log(`headphone expanded fixture: total=${fixtureRows.length}, added=${expansionRows.length}, duplicates=${duplicateIds.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
