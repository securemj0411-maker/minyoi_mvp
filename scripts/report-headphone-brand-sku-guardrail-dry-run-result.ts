import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type GuardrailFixture = {
  caseId: string;
  brandOrFamily: string;
  suspectedModelOrSeries: string;
  expectedDecision: "negative_hold_only" | "manual_review_only";
  sourceRefs: Array<{ label: string; url: string }>;
  guardrailPurpose: string;
  failureIf: string;
};

type GuardrailPlan = {
  guardrailFixtures: GuardrailFixture[];
};

type Contract = {
  validationRules: Array<{ id: string; severity: string; rule: string }>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function decide(row: GuardrailFixture): "negative_hold_only" | "manual_review_only" {
  if (row.expectedDecision === "manual_review_only") return "manual_review_only";
  return "negative_hold_only";
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const plan = await readJson<GuardrailPlan>(path.join(reportsDir, "headphone-brand-sku-guardrail-fixture-plan-latest.json"));
  const contract = await readJson<Contract>(path.join(reportsDir, "headphone-brand-sku-guardrail-dry-run-contract-latest.json"));

  const resultRows = plan.guardrailFixtures.map((row) => {
    const decision = decide(row);
    return {
      caseId: row.caseId,
      brandOrFamily: row.brandOrFamily,
      suspectedModelOrSeries: row.suspectedModelOrSeries,
      dryRunDecision: decision,
      expectedDecision: row.expectedDecision,
      pass: decision === row.expectedDecision,
      sourceRefs: row.sourceRefs,
      sourceRefsPromotedToPositive: false,
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolWiring: false,
      reason: row.guardrailPurpose,
      failureIf: row.failureIf,
    };
  });

  const validationErrors = resultRows.flatMap((row) => {
    const errors: Array<{ caseId: string; error: string }> = [];
    if (!row.pass) errors.push({ caseId: row.caseId, error: "decision mismatch" });
    if (row.dryRunDecision === "negative_hold_only" && row.sourceRefsPromotedToPositive) errors.push({ caseId: row.caseId, error: "source refs promoted row positive" });
    if (row.runtimeApproved) errors.push({ caseId: row.caseId, error: "runtimeApproved must be false" });
    if (row.publicPromotion) errors.push({ caseId: row.caseId, error: "publicPromotion must be false" });
    if (row.candidatePoolWiring) errors.push({ caseId: row.caseId, error: "candidatePoolWiring must be false" });
    return errors;
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
    scope: "Brand/SKU guardrail dry-run result for broader headphone evidence",
    inputFiles: [
      "reports/headphone-brand-sku-guardrail-fixture-plan-latest.json",
      "reports/headphone-brand-sku-guardrail-dry-run-contract-latest.json",
    ],
    metrics: {
      rows: resultRows.length,
      passedRows: resultRows.filter((row) => row.pass).length,
      failedRows: resultRows.filter((row) => !row.pass).length,
      negativeHoldOnlyRows: resultRows.filter((row) => row.dryRunDecision === "negative_hold_only").length,
      manualReviewOnlyRows: resultRows.filter((row) => row.dryRunDecision === "manual_review_only").length,
      sourceBackedRows: resultRows.filter((row) => row.sourceRefs.length > 0).length,
      validationErrors: validationErrors.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    contractRulesChecked: contract.validationRules.map((rule) => rule.id),
    validationErrors,
    resultRows,
    decision: validationErrors.length === 0 && resultRows.every((row) => row.pass)
      ? "brand_sku_guardrail_dry_run_pass_report_only"
      : "brand_sku_guardrail_dry_run_failed_report_only",
    nextStep: "Create a compact headphone report-only status rollup or request separate owner approval for any runtime review.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-brand-sku-guardrail-dry-run-result-latest.json"), JSON.stringify(report, null, 2));

  const rows = resultRows.map((row) => `| ${row.caseId} | ${row.brandOrFamily} | ${row.dryRunDecision} | ${row.pass ? "pass" : "fail"} | ${row.sourceRefs.length} | ${row.runtimeApproved ? "yes" : "no"} | ${row.publicPromotion ? "yes" : "no"} | ${row.candidatePoolWiring ? "yes" : "no"} |`);
  const md = [
    "# Headphone Brand/SKU Guardrail Dry-Run Result",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only brand/SKU guardrail dry-run result. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- rows: ${report.metrics.rows}`,
    `- passed/failed: ${report.metrics.passedRows}/${report.metrics.failedRows}`,
    `- negative/manual rows: ${report.metrics.negativeHoldOnlyRows}/${report.metrics.manualReviewOnlyRows}`,
    `- source-backed rows: ${report.metrics.sourceBackedRows}`,
    `- validation errors: ${report.metrics.validationErrors}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Result Rows",
    "",
    "| case_id | brand_or_family | decision | pass | source_refs | runtime_approved | public_promotion | candidate_pool_wiring |",
    "| --- | --- | --- | --- | ---: | --- | --- | --- |",
    ...rows,
    "",
    "## Decision",
    "",
    report.decision,
    "",
    "## Next Step",
    "",
    report.nextStep,
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-brand-sku-guardrail-dry-run-result-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-brand-sku-guardrail-dry-run-result-latest.json");
  console.log("wrote reports/headphone-brand-sku-guardrail-dry-run-result-latest.md");
  console.log(`headphone brand/SKU guardrail dry-run: rows=${resultRows.length}, pass=${report.metrics.passedRows}, fail=${report.metrics.failedRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
