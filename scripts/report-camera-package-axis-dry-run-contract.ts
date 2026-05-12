import fs from "node:fs";
import path from "node:path";

type FixtureRow = {
  caseId: string;
  taxonomyClass: string;
  decision: string;
  pid: string;
  title: string;
  dangerousPatterns: string[];
  comparableKeyRule: string;
  reason: string;
};

type RuntimePrepReport = {
  fixtureRows: FixtureRow[];
};

const sourcePath = "reports/camera-body-lens-split-runtime-prep-latest.json";
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as RuntimePrepReport;

const packageAxisByTaxonomy: Record<string, {
  packageAxis: string;
  lensAxis: string;
  candidateEligible: boolean;
  requiredFields: string[];
}> = {
  body_only: {
    packageAxis: "body_only",
    lensAxis: "no_lens",
    candidateEligible: true,
    requiredFields: ["family", "body_model", "package_axis"],
  },
  body_plus_kit_lens: {
    packageAxis: "kit_lens_single",
    lensAxis: "explicit_single_lens_required",
    candidateEligible: true,
    requiredFields: ["family", "body_model", "package_axis", "lens_axis"],
  },
  body_plus_multi_lens_kit: {
    packageAxis: "kit_lens_multi",
    lensAxis: "multi_lens_2plus",
    candidateEligible: false,
    requiredFields: ["family", "body_model", "package_axis", "lens_axis", "manual_review_reason"],
  },
  lens_only: {
    packageAxis: "lens_only",
    lensAxis: "lens_category_required",
    candidateEligible: false,
    requiredFields: ["lens_model_or_focal_range", "hold_reason"],
  },
  fixed_lens_compact: {
    packageAxis: "fixed_lens_compact",
    lensAxis: "built_in_lens",
    candidateEligible: false,
    requiredFields: ["family", "fixed_lens_model", "manual_review_reason"],
  },
  accessory_parts_damaged_buying: {
    packageAxis: "hard_exclusion",
    lensAxis: "none",
    candidateEligible: false,
    requiredFields: ["hold_reason"],
  },
};

const outputRows = source.fixtureRows.map((row) => {
  const contract = packageAxisByTaxonomy[row.taxonomyClass] ?? {
    packageAxis: "unknown",
    lensAxis: "unknown",
    candidateEligible: false,
    requiredFields: ["manual_review_reason"],
  };
  const expectedDecision =
    row.decision === "positive_fixture_reference_only" && contract.candidateEligible
      ? "future_positive_after_runtime_parser"
      : row.decision === "manual_review"
        ? "manual_review_only"
        : "hold_or_exclusion";
  const outputContract = {
    family: "string|null",
    body_model: "string|null",
    package_axis: contract.packageAxis,
    lens_axis: contract.lensAxis,
    comparable_key: contract.candidateEligible ? "camera|{family}|{body_model}|{package_axis}|{lens_axis}" : null,
    needs_review: !contract.candidateEligible || row.decision !== "positive_fixture_reference_only",
    hold_reason: contract.candidateEligible ? null : "required_before_runtime_candidate",
  };
  return {
    caseId: row.caseId,
    pid: row.pid,
    title: row.title,
    taxonomyClass: row.taxonomyClass,
    sourceDecision: row.decision,
    expectedDecision,
    candidateEligibleAfterParser: contract.candidateEligible && row.decision === "positive_fixture_reference_only",
    requiredFields: contract.requiredFields,
    dangerousPatterns: row.dangerousPatterns,
    outputContract,
    pass: contract.packageAxis !== "unknown",
  };
});

const failedRows = outputRows.filter((row) => !row.pass);
const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  category: "camera_discovered",
  scope: "camera package-axis no-mutation dry-run output contract",
  inputFiles: [
    sourcePath,
    "reports/camera-package-axis-schema-2026-05-12.md",
  ],
  metrics: {
    rows: outputRows.length,
    candidateEligibleAfterParserRows: outputRows.filter((row) => row.candidateEligibleAfterParser).length,
    manualReviewRows: outputRows.filter((row) => row.expectedDecision === "manual_review_only").length,
    holdRows: outputRows.filter((row) => row.expectedDecision === "hold_or_exclusion").length,
    failedRows: failedRows.length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  outputRows,
  failedRows,
  requiredRuntimeParserOutputs: [
    "family",
    "body_model",
    "package_axis",
    "lens_axis",
    "comparable_key",
    "needs_review",
    "hold_reason",
  ],
  conclusion: failedRows.length > 0
    ? "camera_package_axis_contract_needs_review"
    : "camera_package_axis_contract_ready_for_no_mutation_executor",
  nextAction: "Build a no-mutation executor against this contract before any camera runtime parser/catalog patch.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "camera-package-axis-dry-run-contract-latest.json");
const mdPath = path.join(reportsDir, "camera-package-axis-dry-run-contract-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Camera Package-Axis Dry-Run Contract",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- category: ${report.category}`,
  `- conclusion: ${report.conclusion}`,
  "",
  "## Boundary",
  "",
  "- reportOnly: true",
  "- publicPromotion: false",
  "- runtimeCatalogApply: false",
  "- candidatePoolPolicyWiring: false",
  "- productionDbMutation: false",
  "",
  "## Metrics",
  "",
  `- rows: ${report.metrics.rows}`,
  `- candidateEligibleAfterParserRows: ${report.metrics.candidateEligibleAfterParserRows}`,
  `- manualReviewRows: ${report.metrics.manualReviewRows}`,
  `- holdRows: ${report.metrics.holdRows}`,
  `- failedRows: ${report.metrics.failedRows}`,
  "",
  "## Required Runtime Parser Outputs",
  "",
  ...report.requiredRuntimeParserOutputs.map((field) => `- ${field}`),
  "",
  "## Rows",
  "",
  "| caseId | taxonomy | expectedDecision | package_axis | lens_axis | candidateAfterParser | pass | title |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...outputRows.map((row) => `| ${row.caseId} | ${row.taxonomyClass} | ${row.expectedDecision} | ${row.outputContract.package_axis} | ${row.outputContract.lens_axis} | ${row.candidateEligibleAfterParser ? "yes" : "no"} | ${row.pass ? "yes" : "no"} | ${row.title.replace(/\|/g, "\\|")} |`),
  "",
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(JSON.stringify({
  conclusion: report.conclusion,
  rows: report.metrics.rows,
  candidateEligibleAfterParserRows: report.metrics.candidateEligibleAfterParserRows,
  failedRows: report.metrics.failedRows,
  jsonPath,
  mdPath,
}, null, 2));
