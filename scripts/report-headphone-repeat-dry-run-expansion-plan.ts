import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type PrepCase = {
  caseId: string;
  inputTitle: string;
  expectedClass: "positive" | "manual_review" | "hold" | "split_only" | "ignore";
  blockerType: string;
  productIdentityTokens: string[];
  variantTokens: string[];
  accessoryOrPartTokens: string[];
  evidenceSource: string;
  externalEvidence?: Array<{ label: string; url: string; retrievedAt: string }>;
  confidence: "high" | "medium" | "low";
  notes: string;
};

type PrepReport = {
  metrics: Record<string, number>;
  positiveTestCases: PrepCase[];
  manualReviewTestCases: PrepCase[];
  negativeHoldTestCases: PrepCase[];
};

type FixturePacket = {
  fixtureRows: Array<{ caseId: string }>;
};

type ReviewPacket = {
  metrics: {
    rows: number;
    passedRows: number;
    failedRows: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolWiringRows: number;
  };
};

type ExpansionRow = {
  caseId: string;
  currentClass: PrepCase["expectedClass"];
  proposedRepeatDecision: "manual_review_only" | "negative_hold_only";
  inputTitle: string;
  blockerType: string;
  expansionReason: string;
  requiredGuardrail: string;
  sourceEvidenceCount: number;
  confidence: PrepCase["confidence"];
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function allPrepCases(report: PrepReport): PrepCase[] {
  return [...report.positiveTestCases, ...report.manualReviewTestCases, ...report.negativeHoldTestCases];
}

function repeatDecision(row: PrepCase): ExpansionRow["proposedRepeatDecision"] {
  return row.expectedClass === "manual_review" ? "manual_review_only" : "negative_hold_only";
}

function expansionReason(row: PrepCase): string {
  if (row.expectedClass === "manual_review") {
    return "Adds harder AirPods Max connector/generation review cases that should not be promoted by title token alone.";
  }
  if (row.accessoryOrPartTokens.length > 0 || /case|케이스|쿠션/i.test(row.inputTitle)) {
    return "Adds accessory/case contamination guardrail for headphone comparables.";
  }
  return "Adds unknown branded headphone/SKU guardrail that requires separate catalog expansion.";
}

function guardrail(row: PrepCase): string {
  if (row.expectedClass === "manual_review") return "Must remain manual_review_only unless owner approves explicit generation/connector policy.";
  if (row.accessoryOrPartTokens.length > 0 || /case|케이스|쿠션/i.test(row.inputTitle)) return "Must remain negative_hold_only as accessory or bundle contamination.";
  return "Must remain negative_hold_only until separate brand/SKU catalog evidence exists.";
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const prep = await readJson<PrepReport>(path.join(reportsDir, "headphone-matched-sku-implementation-prep-latest.json"));
  const fixture = await readJson<FixturePacket>(path.join(reportsDir, "headphone-no-mutation-dry-run-fixture-packet-latest.json"));
  const review = await readJson<ReviewPacket>(path.join(reportsDir, "headphone-no-mutation-dry-run-review-packet-latest.json"));

  const usedCaseIds = new Set(fixture.fixtureRows.map((row) => row.caseId));
  const expansionRows: ExpansionRow[] = allPrepCases(prep)
    .filter((row) => !usedCaseIds.has(row.caseId))
    .map((row) => ({
      caseId: row.caseId,
      currentClass: row.expectedClass,
      proposedRepeatDecision: repeatDecision(row),
      inputTitle: row.inputTitle,
      blockerType: row.blockerType,
      expansionReason: expansionReason(row),
      requiredGuardrail: guardrail(row),
      sourceEvidenceCount: row.externalEvidence?.length ?? 0,
      confidence: row.confidence,
    }));

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    scope: "Repeat no-mutation dry-run expansion plan for headphone_discovered",
    inputFiles: [
      "reports/headphone-matched-sku-implementation-prep-latest.json",
      "reports/headphone-no-mutation-dry-run-fixture-packet-latest.json",
      "reports/headphone-no-mutation-dry-run-review-packet-latest.json",
    ],
    metrics: {
      previousDryRunRows: review.metrics.rows,
      previousPassedRows: review.metrics.passedRows,
      previousFailedRows: review.metrics.failedRows,
      expansionRows: expansionRows.length,
      expansionManualReviewRows: expansionRows.filter((row) => row.proposedRepeatDecision === "manual_review_only").length,
      expansionNegativeHoldRows: expansionRows.filter((row) => row.proposedRepeatDecision === "negative_hold_only").length,
      expansionCandidatePositiveRows: 0,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    expansionRows,
    recommendation: expansionRows.length > 0
      ? "A repeat no-mutation dry-run may add these guardrail rows, but should not add new candidate-positive rows from them."
      : "No remaining headphone prep rows to add.",
    nextAllowedReportOnlyStep: "Build an expanded fixture packet only if owner wants a repeat no-mutation dry-run; runtime wiring remains forbidden.",
    boundary: [
      "No new positive runtime candidates are proposed here.",
      "Manual-review and hold rows remain non-positive.",
      "parser_candidate remains non-public.",
      "candidate-pool/runtime/DB writes remain forbidden.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-repeat-dry-run-expansion-plan-latest.json"), JSON.stringify(report, null, 2));

  const rows = expansionRows.map((row) => `| ${row.caseId} | ${row.currentClass} | ${row.proposedRepeatDecision} | ${row.confidence} | ${row.sourceEvidenceCount} | ${row.blockerType} | ${row.inputTitle.replace(/\|/g, "/")} |`);
  const md = [
    "# Headphone Repeat Dry-Run Expansion Plan",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only expansion plan for a possible repeat headphone no-mutation dry-run. This does not execute parser/runtime wiring.",
    "",
    "## Metrics",
    "",
    `- previous dry-run rows: ${report.metrics.previousDryRunRows}`,
    `- previous passed/failed rows: ${report.metrics.previousPassedRows}/${report.metrics.previousFailedRows}`,
    `- expansion rows: ${report.metrics.expansionRows}`,
    `- expansion manual/negative/candidate-positive rows: ${report.metrics.expansionManualReviewRows}/${report.metrics.expansionNegativeHoldRows}/${report.metrics.expansionCandidatePositiveRows}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Expansion Rows",
    "",
    "| case_id | current_class | proposed_repeat_decision | confidence | source_refs | blocker_type | title |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
    ...rows,
    "",
    "## Recommendation",
    "",
    report.recommendation,
    "",
    "## Boundary",
    "",
    ...report.boundary.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-repeat-dry-run-expansion-plan-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-repeat-dry-run-expansion-plan-latest.json");
  console.log("wrote reports/headphone-repeat-dry-run-expansion-plan-latest.md");
  console.log(`headphone repeat expansion plan: rows=${expansionRows.length}, manual=${report.metrics.expansionManualReviewRows}, negative=${report.metrics.expansionNegativeHoldRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
