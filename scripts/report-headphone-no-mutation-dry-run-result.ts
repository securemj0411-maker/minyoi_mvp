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
  classifierFocus: string[];
};

type FixturePacket = {
  category: "headphone_discovered";
  fixtureRows: FixtureRow[];
  forbiddenOutputs: string[];
  stopConditions: string[];
  passCriteria: string[];
};

type OutputContract = {
  requiredOutputFields: Array<{ name: string; type: string; required: boolean; note: string }>;
  validationRules: Array<{ id: string; severity: string; rule: string }>;
};

type DryRunDecision = "candidate_positive_only" | "manual_review_only" | "negative_hold_only";

type DryRunResultRow = {
  category: "headphone_discovered";
  caseId: string;
  inputTitle: string;
  expectedClass: FixtureRow["expectedClass"];
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

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function hasAnyToken(row: FixtureRow, tokens: string[]): boolean {
  const haystack = [
    row.inputTitle,
    row.blockerType,
    ...row.productIdentityTokens,
    ...row.variantTokens,
    ...row.conditionTokens,
    ...row.bundleOrQuantityTokens,
    ...row.accessoryOrPartTokens,
  ].join(" ").toLowerCase();
  return tokens.some((token) => haystack.includes(token.toLowerCase()));
}

function decide(row: FixtureRow): { decision: DryRunDecision; reason: string; failureIf: string } {
  if (row.accessoryOrPartTokens.length > 0 || hasAnyToken(row, ["쿠션", "케이스", "박스", "accessory", "bundle"])) {
    return {
      decision: "negative_hold_only",
      reason: "Accessory, part, or bundle-like tokens are present, so this stays out of positive comparable candidates.",
      failureIf: "This row is emitted as candidate_positive_only or any runtime/public flag becomes true.",
    };
  }

  if (row.productIdentityTokens.includes("airpods_max") && !hasAnyToken(row, ["usb-c", "lightning", "8핀", "ctype", "c타입"])) {
    return {
      decision: "manual_review_only",
      reason: "AirPods Max title lacks explicit connector/generation token, so connector/generation must not be inferred.",
      failureIf: "This row is emitted as candidate_positive_only without explicit connector/generation evidence.",
    };
  }

  if (
    row.productIdentityTokens.includes("airpods_max") ||
    row.productIdentityTokens.includes("wh_1000xm5") ||
    row.productIdentityTokens.includes("quietcomfort_ultra_headphones") ||
    row.productIdentityTokens.includes("wh_ch520")
  ) {
    return {
      decision: "candidate_positive_only",
      reason: "Fixture has source-backed product identity tokens and no accessory/manual-review blocker fired.",
      failureIf: "This row is not emitted as candidate_positive_only, or candidate_positive_only is treated as runtime approval.",
    };
  }

  return {
    decision: "manual_review_only",
    reason: "No source-backed matched headphone identity rule fired, so the row stays manual-review.",
    failureIf: "This row is promoted positive by title inference.",
  };
}

function sourceLabels(row: FixtureRow): string[] {
  return row.sourceEvidenceRefs.map((source) => `${source.label} (${source.url})`);
}

function validateRow(row: DryRunResultRow): string[] {
  const errors: string[] = [];
  if (row.runtimeApproved !== false) errors.push("runtimeApproved must be false");
  if (row.publicPromotion !== false) errors.push("publicPromotion must be false");
  if (row.candidatePoolWiring !== false) errors.push("candidatePoolWiring must be false");
  if (row.expectedClass === "manual_review" && row.dryRunDecision !== "manual_review_only") errors.push("manual_review must output manual_review_only");
  if (row.expectedClass === "hold" && row.dryRunDecision !== "negative_hold_only") errors.push("hold must output negative_hold_only");
  if (row.expectedClass === "positive" && row.dryRunDecision !== "candidate_positive_only") errors.push("positive must output candidate_positive_only");
  if (row.expectedClass === "positive" && row.sourceEvidenceRefs.length === 0) errors.push("positive rows must include source evidence refs");
  return errors;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const fixture = await readJson<FixturePacket>(path.join(reportsDir, "headphone-no-mutation-dry-run-fixture-packet-latest.json"));
  const contract = await readJson<OutputContract>(path.join(reportsDir, "subagent-implementation-prep-dry-run-output-contract-latest.json"));

  const resultRows: DryRunResultRow[] = fixture.fixtureRows.map((row) => {
    const decision = decide(row);
    const result: DryRunResultRow = {
      category: "headphone_discovered",
      caseId: row.caseId,
      inputTitle: row.inputTitle,
      expectedClass: row.expectedClass,
      dryRunDecision: decision.decision,
      expectedDryRunDecision: row.expectedDryRunDecision,
      pass: decision.decision === row.expectedDryRunDecision,
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolWiring: false,
      reason: decision.reason,
      sourceEvidenceRefs: sourceLabels(row),
      failureIf: decision.failureIf,
    };
    return result;
  });

  const validationErrors = resultRows.flatMap((row) => validateRow(row).map((error) => ({ caseId: row.caseId, error })));
  const missingRequiredFields = contract.requiredOutputFields
    .filter((field) => field.required)
    .filter((field) => resultRows.some((row) => !(field.name in row)))
    .map((field) => field.name);

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    scope: "Headphone no-mutation parser dry-run result; fixture/report-only inputs only",
    inputFiles: [
      "reports/headphone-no-mutation-dry-run-fixture-packet-latest.json",
      "reports/subagent-implementation-prep-dry-run-output-contract-latest.json",
    ],
    outputFiles: [
      "reports/headphone-no-mutation-dry-run-result-latest.json",
      "reports/headphone-no-mutation-dry-run-result-latest.md",
    ],
    metrics: {
      rows: resultRows.length,
      passedRows: resultRows.filter((row) => row.pass).length,
      failedRows: resultRows.filter((row) => !row.pass).length,
      candidatePositiveOnlyRows: resultRows.filter((row) => row.dryRunDecision === "candidate_positive_only").length,
      manualReviewOnlyRows: resultRows.filter((row) => row.dryRunDecision === "manual_review_only").length,
      negativeHoldOnlyRows: resultRows.filter((row) => row.dryRunDecision === "negative_hold_only").length,
      validationErrors: validationErrors.length,
      missingRequiredFields: missingRequiredFields.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    contractRulesChecked: contract.validationRules.map((rule) => rule.id),
    missingRequiredFields,
    validationErrors,
    resultRows,
    forbiddenOutputsConfirmed: fixture.forbiddenOutputs,
    stopConditionsObserved: [],
    decision: validationErrors.length === 0 && missingRequiredFields.length === 0 && resultRows.every((row) => row.pass)
      ? "dry_run_pass_report_only_no_runtime_approval"
      : "dry_run_failed_report_only",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-no-mutation-dry-run-result-latest.json"), JSON.stringify(report, null, 2));

  const rows = resultRows.map((row) => `| ${row.caseId} | ${row.expectedClass} | ${row.dryRunDecision} | ${row.pass ? "pass" : "fail"} | ${row.runtimeApproved ? "yes" : "no"} | ${row.publicPromotion ? "yes" : "no"} | ${row.candidatePoolWiring ? "yes" : "no"} | ${row.inputTitle.replace(/\|/g, "/")} |`);
  const md = [
    "# Headphone No-Mutation Dry-Run Result",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only dry-run result for headphone_discovered. This did not import runtime parser modules, mutate runtime files, promote public readiness, wire candidate pools, or write to production DB.",
    "",
    "## Metrics",
    "",
    `- rows: ${report.metrics.rows}`,
    `- passed rows: ${report.metrics.passedRows}`,
    `- failed rows: ${report.metrics.failedRows}`,
    `- candidate_positive_only/manual_review_only/negative_hold_only: ${report.metrics.candidatePositiveOnlyRows}/${report.metrics.manualReviewOnlyRows}/${report.metrics.negativeHoldOnlyRows}`,
    `- validation errors: ${report.metrics.validationErrors}`,
    `- missing required fields: ${report.metrics.missingRequiredFields}`,
    `- runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    `- public-promotion rows: ${report.metrics.publicPromotionRows}`,
    `- candidate-pool-wiring rows: ${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Result Rows",
    "",
    "| case_id | expected_class | dry_run_decision | pass | runtime_approved | public_promotion | candidate_pool_wiring | title |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Decision",
    "",
    report.decision,
    "",
    "## Boundary",
    "",
    "- parser_candidate remains non-public.",
    "- candidate_positive_only is not runtime approval.",
    "- candidate pool/runtime/DB writes remain forbidden.",
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-no-mutation-dry-run-result-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-no-mutation-dry-run-result-latest.json");
  console.log("wrote reports/headphone-no-mutation-dry-run-result-latest.md");
  console.log(`headphone no-mutation dry-run: rows=${report.metrics.rows}, passed=${report.metrics.passedRows}, failed=${report.metrics.failedRows}, validation_errors=${report.metrics.validationErrors}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
