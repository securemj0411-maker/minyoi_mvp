import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type DryRunDecision = "candidate_positive_only" | "manual_review_only" | "negative_hold_only";

type ResultRow = {
  category: "headphone_discovered";
  caseId: string;
  inputTitle: string;
  expectedClass: "positive" | "manual_review" | "hold" | "split_only" | "ignore";
  dryRunDecision: DryRunDecision;
  expectedDryRunDecision: DryRunDecision;
  pass: boolean;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePoolWiring: false;
  reason: string;
  sourceEvidenceRefs: string[];
  failureIf: string;
};

type DryRunResult = {
  generatedAt: string;
  category: "headphone_discovered";
  metrics: {
    rows: number;
    passedRows: number;
    failedRows: number;
    candidatePositiveOnlyRows: number;
    manualReviewOnlyRows: number;
    negativeHoldOnlyRows: number;
    validationErrors: number;
    missingRequiredFields: number;
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
  productIdentityTokens: string[];
  variantTokens: string[];
  accessoryOrPartTokens: string[];
  bundleOrQuantityTokens: string[];
  classifierFocus: string[];
  confidence: "high" | "medium" | "low";
  notes: string;
};

type FixturePacket = {
  fixtureRows: FixtureRow[];
  deferred: string[];
};

type ReviewRow = {
  caseId: string;
  lane: "candidate_positive_review" | "manual_review_guardrail" | "negative_hold_guardrail";
  inputTitle: string;
  decision: DryRunDecision;
  pass: boolean;
  reviewerTakeaway: string;
  sourceEvidenceCount: number;
  blockerType: string;
  focus: string[];
  nextReviewAction: string;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function laneFor(row: ResultRow): ReviewRow["lane"] {
  if (row.dryRunDecision === "candidate_positive_only") return "candidate_positive_review";
  if (row.dryRunDecision === "manual_review_only") return "manual_review_guardrail";
  return "negative_hold_guardrail";
}

function takeaway(row: ResultRow): string {
  if (row.dryRunDecision === "candidate_positive_only") {
    return "Passed as parser-candidate only; this is still not runtime approval.";
  }
  if (row.dryRunDecision === "manual_review_only") {
    return "Correctly blocked from positive because title inference would be risky.";
  }
  return "Correctly excluded from positive comparables.";
}

function nextAction(row: ResultRow): string {
  if (row.dryRunDecision === "candidate_positive_only") {
    return "Owner may inspect source refs and decide whether this case belongs in a future narrow implementation review.";
  }
  if (row.dryRunDecision === "manual_review_only") {
    return "Keep as manual-review unless explicit connector/generation evidence is present.";
  }
  return "Keep as negative fixture for accessory/bundle contamination tests.";
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const dryRun = await readJson<DryRunResult>(path.join(reportsDir, "headphone-no-mutation-dry-run-result-latest.json"));
  const fixture = await readJson<FixturePacket>(path.join(reportsDir, "headphone-no-mutation-dry-run-fixture-packet-latest.json"));
  const fixtureByCaseId = new Map(fixture.fixtureRows.map((row) => [row.caseId, row]));

  const reviewRows: ReviewRow[] = dryRun.resultRows.map((row) => {
    const fixtureRow = fixtureByCaseId.get(row.caseId);
    if (!fixtureRow) throw new Error(`Missing fixture row for ${row.caseId}`);
    return {
      caseId: row.caseId,
      lane: laneFor(row),
      inputTitle: row.inputTitle,
      decision: row.dryRunDecision,
      pass: row.pass,
      reviewerTakeaway: takeaway(row),
      sourceEvidenceCount: row.sourceEvidenceRefs.length,
      blockerType: fixtureRow.blockerType,
      focus: fixtureRow.classifierFocus,
      nextReviewAction: nextAction(row),
    };
  });

  const laneCounts = {
    candidatePositiveReview: reviewRows.filter((row) => row.lane === "candidate_positive_review").length,
    manualReviewGuardrail: reviewRows.filter((row) => row.lane === "manual_review_guardrail").length,
    negativeHoldGuardrail: reviewRows.filter((row) => row.lane === "negative_hold_guardrail").length,
  };

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    scope: "Review packet for headphone no-mutation dry-run result",
    inputFiles: [
      "reports/headphone-no-mutation-dry-run-result-latest.json",
      "reports/headphone-no-mutation-dry-run-fixture-packet-latest.json",
    ],
    metrics: {
      rows: reviewRows.length,
      passedRows: dryRun.metrics.passedRows,
      failedRows: dryRun.metrics.failedRows,
      ...laneCounts,
      validationErrors: dryRun.metrics.validationErrors,
      runtimeApprovedRows: dryRun.metrics.runtimeApprovedRows,
      publicPromotionRows: dryRun.metrics.publicPromotionRows,
      candidatePoolWiringRows: dryRun.metrics.candidatePoolWiringRows,
    },
    reviewRows,
    ownerDecisionOptions: [
      {
        option: "keep_report_only",
        meaning: "Do not proceed beyond the dry-run result; keep this as evidence.",
      },
      {
        option: "repeat_no_mutation_dry_run",
        meaning: "Add more headphone fixtures, then rerun report-only dry-run.",
      },
      {
        option: "request_narrow_runtime_review",
        meaning: "Ask main/owner for a separate explicit approval to inspect runtime implementation. This packet does not grant that approval.",
      },
    ],
    deferred: fixture.deferred,
    boundary: [
      "candidate_positive_only is not runtime approval",
      "manual_review_only and negative_hold_only must not be promoted by this packet",
      "public promotion, candidate-pool wiring, runtime edits, and DB writes remain forbidden",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-no-mutation-dry-run-review-packet-latest.json"), JSON.stringify(report, null, 2));

  const rows = reviewRows.map((row) => {
    const focus = row.focus.join(", ");
    return `| ${row.caseId} | ${row.lane} | ${row.decision} | ${row.pass ? "pass" : "fail"} | ${row.sourceEvidenceCount} | ${focus} | ${row.nextReviewAction.replace(/\|/g, "/")} |`;
  });

  const md = [
    "# Headphone No-Mutation Dry-Run Review Packet",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only review packet for the headphone_discovered no-mutation dry-run result. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- rows: ${report.metrics.rows}`,
    `- passed/failed: ${report.metrics.passedRows}/${report.metrics.failedRows}`,
    `- candidate/manual/negative lanes: ${report.metrics.candidatePositiveReview}/${report.metrics.manualReviewGuardrail}/${report.metrics.negativeHoldGuardrail}`,
    `- validation errors: ${report.metrics.validationErrors}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Review Rows",
    "",
    "| case_id | lane | decision | pass | source_refs | focus | next_review_action |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
    ...rows,
    "",
    "## Owner Decision Options",
    "",
    ...report.ownerDecisionOptions.map((item) => `- ${item.option}: ${item.meaning}`),
    "",
    "## Boundary",
    "",
    ...report.boundary.map((item) => `- ${item}`),
    "",
    "## Deferred",
    "",
    ...report.deferred.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-no-mutation-dry-run-review-packet-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-no-mutation-dry-run-review-packet-latest.json");
  console.log("wrote reports/headphone-no-mutation-dry-run-review-packet-latest.md");
  console.log(`headphone review packet: rows=${reviewRows.length}, lanes=${laneCounts.candidatePositiveReview}/${laneCounts.manualReviewGuardrail}/${laneCounts.negativeHoldGuardrail}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
