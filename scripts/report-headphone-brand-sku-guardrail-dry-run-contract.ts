import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type GuardrailPlan = {
  guardrailFixtures: Array<{
    caseId: string;
    brandOrFamily: string;
    suspectedModelOrSeries: string;
    expectedDecision: "negative_hold_only" | "manual_review_only";
    sourceRefs: Array<{ label: string; url: string }>;
    guardrailPurpose: string;
    failureIf: string;
  }>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const plan = await readJson<GuardrailPlan>(path.join(reportsDir, "headphone-brand-sku-guardrail-fixture-plan-latest.json"));

  const contractRows = plan.guardrailFixtures.map((row) => ({
    caseId: row.caseId,
    expectedDecision: row.expectedDecision,
    mustStayNonPositive: true,
    hasOfficialOrSourceRefs: row.sourceRefs.length > 0,
    sourceRefsDoNotPromote: true,
    failureIf: row.failureIf,
  }));

  const validationRules = [
    {
      id: "BRAND-SKU-GUARDRAIL-01",
      rule: "Razer/Beats source-backed rows must remain negative_hold_only until exact SKU catalog expansion is approved.",
      severity: "blocker",
    },
    {
      id: "BRAND-SKU-GUARDRAIL-02",
      rule: "AirPods Max ambiguity row must remain manual_review_only unless owner-approved connector/generation policy exists.",
      severity: "blocker",
    },
    {
      id: "BRAND-SKU-GUARDRAIL-03",
      rule: "No guardrail fixture may emit candidate_positive_only.",
      severity: "blocker",
    },
    {
      id: "BRAND-SKU-GUARDRAIL-04",
      rule: "runtimeApproved/publicPromotion/candidatePoolWiring must remain false.",
      severity: "blocker",
    },
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    scope: "Dry-run contract for broader headphone brand/SKU guardrails",
    inputFiles: ["reports/headphone-brand-sku-guardrail-fixture-plan-latest.json"],
    metrics: {
      contractRows: contractRows.length,
      negativeHoldRows: contractRows.filter((row) => row.expectedDecision === "negative_hold_only").length,
      manualReviewRows: contractRows.filter((row) => row.expectedDecision === "manual_review_only").length,
      sourceBackedRows: contractRows.filter((row) => row.hasOfficialOrSourceRefs).length,
      validationRules: validationRules.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    contractRows,
    validationRules,
    nextStep: "Run a report-only guardrail dry-run result for these 3 rows if continuing without runtime changes.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-brand-sku-guardrail-dry-run-contract-latest.json"), JSON.stringify(report, null, 2));

  const rows = contractRows.map((row) => `| ${row.caseId} | ${row.expectedDecision} | ${row.mustStayNonPositive ? "yes" : "no"} | ${row.hasOfficialOrSourceRefs ? "yes" : "no"} | ${row.sourceRefsDoNotPromote ? "yes" : "no"} | ${row.failureIf.replace(/\|/g, "/")} |`);
  const ruleRows = validationRules.map((row) => `| ${row.id} | ${row.severity} | ${row.rule} |`);
  const md = [
    "# Headphone Brand/SKU Guardrail Dry-Run Contract",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only contract for broader headphone brand/SKU guardrail dry-run. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- contract rows: ${report.metrics.contractRows}`,
    `- negative/manual rows: ${report.metrics.negativeHoldRows}/${report.metrics.manualReviewRows}`,
    `- source-backed rows: ${report.metrics.sourceBackedRows}`,
    `- validation rules: ${report.metrics.validationRules}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Contract Rows",
    "",
    "| case_id | expected_decision | must_stay_non_positive | has_source_refs | source_refs_do_not_promote | failure_if |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Validation Rules",
    "",
    "| id | severity | rule |",
    "| --- | --- | --- |",
    ...ruleRows,
    "",
    "## Next Step",
    "",
    report.nextStep,
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-brand-sku-guardrail-dry-run-contract-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-brand-sku-guardrail-dry-run-contract-latest.json");
  console.log("wrote reports/headphone-brand-sku-guardrail-dry-run-contract-latest.md");
  console.log(`headphone brand/SKU guardrail contract: rows=${contractRows.length}, rules=${validationRules.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
