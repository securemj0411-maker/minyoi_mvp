import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ResultRow = {
  caseId: string;
  inputTitle: string;
  expectedClass: "positive" | "manual_review" | "hold" | "split_only" | "ignore";
  dryRunDecision: "candidate_positive_only" | "manual_review_only" | "negative_hold_only";
  pass: boolean;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePoolWiring: false;
  sourceEvidenceRefs: string[];
  reason: string;
};

type ResultReport = {
  metrics: {
    rows: number;
    passedRows: number;
    failedRows: number;
    validationErrors: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolWiringRows: number;
  };
  resultRows: ResultRow[];
  decision: string;
};

type FixtureRow = {
  caseId: string;
  blockerType: string;
  classifierFocus: string[];
  confidence: "high" | "medium" | "low";
};

type ExpandedFixture = {
  metrics: {
    previousFixtureRows: number;
    addedFixtureRows: number;
    totalFixtureRows: number;
  };
  fixtureRows: FixtureRow[];
  addedRows: FixtureRow[];
  boundary: string[];
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function lane(row: ResultRow): "candidate_positive_review" | "manual_review_guardrail" | "negative_hold_guardrail" {
  if (row.dryRunDecision === "candidate_positive_only") return "candidate_positive_review";
  if (row.dryRunDecision === "manual_review_only") return "manual_review_guardrail";
  return "negative_hold_guardrail";
}

function takeaway(row: ResultRow, added: boolean): string {
  const prefix = added ? "Added guardrail: " : "Baseline fixture: ";
  if (row.dryRunDecision === "candidate_positive_only") return `${prefix}source-backed parser-candidate only, not runtime approval.`;
  if (row.dryRunDecision === "manual_review_only") return `${prefix}keeps uncertain connector/generation wording from becoming positive.`;
  return `${prefix}keeps accessory, case, unknown brand/SKU, or contamination row out of positive comparables.`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const result = await readJson<ResultReport>(path.join(reportsDir, "headphone-repeat-no-mutation-dry-run-result-latest.json"));
  const fixture = await readJson<ExpandedFixture>(path.join(reportsDir, "headphone-repeat-dry-run-expanded-fixture-packet-latest.json"));
  const fixtureByCaseId = new Map(fixture.fixtureRows.map((row) => [row.caseId, row]));
  const addedIds = new Set(fixture.addedRows.map((row) => row.caseId));

  const reviewRows = result.resultRows.map((row) => {
    const fixtureRow = fixtureByCaseId.get(row.caseId);
    if (!fixtureRow) throw new Error(`missing fixture row ${row.caseId}`);
    const added = addedIds.has(row.caseId);
    return {
      caseId: row.caseId,
      added,
      lane: lane(row),
      decision: row.dryRunDecision,
      pass: row.pass,
      inputTitle: row.inputTitle,
      sourceEvidenceCount: row.sourceEvidenceRefs.length,
      blockerType: fixtureRow.blockerType,
      focus: fixtureRow.classifierFocus,
      confidence: fixtureRow.confidence,
      reviewerTakeaway: takeaway(row, added),
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
    category: "headphone_discovered",
    scope: "Review packet for repeat headphone no-mutation dry-run result",
    inputFiles: [
      "reports/headphone-repeat-no-mutation-dry-run-result-latest.json",
      "reports/headphone-repeat-dry-run-expanded-fixture-packet-latest.json",
    ],
    metrics: {
      rows: reviewRows.length,
      addedRows: reviewRows.filter((row) => row.added).length,
      passedRows: result.metrics.passedRows,
      failedRows: result.metrics.failedRows,
      candidatePositiveReview: reviewRows.filter((row) => row.lane === "candidate_positive_review").length,
      manualReviewGuardrail: reviewRows.filter((row) => row.lane === "manual_review_guardrail").length,
      negativeHoldGuardrail: reviewRows.filter((row) => row.lane === "negative_hold_guardrail").length,
      validationErrors: result.metrics.validationErrors,
      runtimeApprovedRows: result.metrics.runtimeApprovedRows,
      publicPromotionRows: result.metrics.publicPromotionRows,
      candidatePoolWiringRows: result.metrics.candidatePoolWiringRows,
    },
    reviewRows,
    addedGuardrailSummary: reviewRows
      .filter((row) => row.added)
      .map((row) => ({
        caseId: row.caseId,
        lane: row.lane,
        blockerType: row.blockerType,
        takeaway: row.reviewerTakeaway,
      })),
    decision: result.decision,
    boundary: fixture.boundary,
    nextStep: "Decide whether to keep report-only, add broader headphone brand/SKU evidence, or request separate narrow runtime review approval.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-repeat-dry-run-review-packet-latest.json"), JSON.stringify(report, null, 2));

  const rows = reviewRows.map((row) => {
    const focus = row.focus.join(", ");
    return `| ${row.caseId} | ${row.added ? "yes" : "no"} | ${row.lane} | ${row.decision} | ${row.pass ? "pass" : "fail"} | ${row.sourceEvidenceCount} | ${focus} | ${row.inputTitle.replace(/\|/g, "/")} |`;
  });

  const addedRows = report.addedGuardrailSummary.map((row) => `| ${row.caseId} | ${row.lane} | ${row.blockerType} | ${row.takeaway.replace(/\|/g, "/")} |`);

  const md = [
    "# Headphone Repeat Dry-Run Review Packet",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only review packet for the repeat headphone_discovered no-mutation dry-run result. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- rows: ${report.metrics.rows}`,
    `- added rows: ${report.metrics.addedRows}`,
    `- passed/failed: ${report.metrics.passedRows}/${report.metrics.failedRows}`,
    `- candidate/manual/negative lanes: ${report.metrics.candidatePositiveReview}/${report.metrics.manualReviewGuardrail}/${report.metrics.negativeHoldGuardrail}`,
    `- validation errors: ${report.metrics.validationErrors}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Review Rows",
    "",
    "| case_id | added | lane | decision | pass | source_refs | focus | title |",
    "| --- | --- | --- | --- | --- | ---: | --- | --- |",
    ...rows,
    "",
    "## Added Guardrail Summary",
    "",
    "| case_id | lane | blocker_type | takeaway |",
    "| --- | --- | --- | --- |",
    ...addedRows,
    "",
    "## Decision",
    "",
    report.decision,
    "",
    "## Next Step",
    "",
    report.nextStep,
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-repeat-dry-run-review-packet-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-repeat-dry-run-review-packet-latest.json");
  console.log("wrote reports/headphone-repeat-dry-run-review-packet-latest.md");
  console.log(`headphone repeat review packet: rows=${reviewRows.length}, added=${report.metrics.addedRows}, lanes=${report.metrics.candidatePositiveReview}/${report.metrics.manualReviewGuardrail}/${report.metrics.negativeHoldGuardrail}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
