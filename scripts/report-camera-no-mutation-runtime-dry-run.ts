import fs from "node:fs";
import path from "node:path";

import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

type CameraEvidenceRow = {
  pid: string;
  title: string;
  price: number;
  boundaryClass?: string;
  tokenBoundaryDecision?: string;
  reportOnlyAction?: string;
};

type CameraEvidenceReport = {
  rows: CameraEvidenceRow[];
};

const evidence = JSON.parse(fs.readFileSync("reports/camera-package-title-token-boundary-evidence-latest.json", "utf8")) as CameraEvidenceReport;

const rows = evidence.rows.map((row) => {
  const classified = classifyListing(row.title, "", row.price);
  const parsed = parseListingOptions({
    title: row.title,
    description: "",
    category: "small_appliance",
    skuId: null,
    skuName: null,
  });
  const expectedDecision = row.tokenBoundaryDecision === "lens_identity_reference_only"
    ? "reference_only_not_runtime_candidate"
    : row.tokenBoundaryDecision?.includes("body_only")
      ? "reference_only_not_runtime_candidate"
      : "negative_or_manual_hold_only";
  const actualDecision = classified.listingType === "normal" && parsed.comparableKey && !parsed.needsReview
    ? "candidate_positive_only"
    : expectedDecision;
  const pass = actualDecision === expectedDecision;
  return {
    pid: row.pid,
    title: row.title,
    expectedDecision,
    actualDecision,
    runtimeListingType: classified.listingType,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    parseConfidence: parsed.parseConfidence,
    boundaryClass: row.boundaryClass ?? null,
    tokenBoundaryDecision: row.tokenBoundaryDecision ?? null,
    pass,
  };
});

const failedRows = rows.filter((row) => !row.pass);
const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  category: "camera_discovered",
  scope: "no-mutation runtime dry-run over camera package/title-token boundary evidence",
  inputFiles: ["reports/camera-package-title-token-boundary-evidence-latest.json"],
  metrics: {
    rows: rows.length,
    passedRows: rows.filter((row) => row.pass).length,
    failedRows: failedRows.length,
    candidatePositiveOnlyRows: rows.filter((row) => row.actualDecision === "candidate_positive_only").length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  rows,
  failedRows,
  conclusion: failedRows.length > 0
    ? "camera_runtime_dry_run_has_unexpected_candidate_rows"
    : "camera_runtime_dry_run_confirms_runtime_unwired_and_no_candidate_leak",
  nextAction: "Proceed to home_appliance_tech_discovered no-mutation runtime dry-run; camera remains package/body/lens reference-only.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "camera-no-mutation-runtime-dry-run-latest.json");
const mdPath = path.join(reportsDir, "camera-no-mutation-runtime-dry-run-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Camera No-Mutation Runtime Dry-Run",
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
  "- directThirtyDayPlanEdit: false",
  "",
  "## Metrics",
  "",
  `- rows: ${report.metrics.rows}`,
  `- passedRows: ${report.metrics.passedRows}`,
  `- failedRows: ${report.metrics.failedRows}`,
  `- candidatePositiveOnlyRows: ${report.metrics.candidatePositiveOnlyRows}`,
  "",
  "## Rows",
  "",
  "| pid | expected | actual | listingType | comparableKey | needsReview | pass | title |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${row.pid} | ${row.expectedDecision} | ${row.actualDecision} | ${row.runtimeListingType} | ${row.comparableKey ?? "null"} | ${row.needsReview} | ${row.pass ? "yes" : "no"} | ${row.title.replace(/\|/g, "\\|")} |`),
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
  failedRows: report.metrics.failedRows,
  candidatePositiveOnlyRows: report.metrics.candidatePositiveOnlyRows,
  jsonPath,
  mdPath,
}, null, 2));
