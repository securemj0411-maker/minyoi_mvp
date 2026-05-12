import fs from "node:fs";
import path from "node:path";

import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

type ExpectedClass = "manual_review" | "hold";
type DesktopCase = {
  caseId: string;
  inputTitle: string;
  inputDescription?: string;
  expectedClass: ExpectedClass;
  blockerType: string;
  confidence: string;
};
type PrepReport = {
  manualReviewTestCases: DesktopCase[];
  negativeHoldTestCases: DesktopCase[];
};

const prep = JSON.parse(fs.readFileSync("reports/desktop-cpu-gpu-implementation-prep-latest.json", "utf8")) as PrepReport;
const cases = [...prep.manualReviewTestCases, ...prep.negativeHoldTestCases];

const rows = cases.map((row) => {
  const description = row.inputDescription ?? "";
  const classified = classifyListing(row.inputTitle, description, 100_000);
  const parsed = parseListingOptions({
    title: row.inputTitle,
    description,
    category: "small_appliance",
    skuId: null,
    skuName: null,
  });
  const expectedDecision = row.expectedClass === "manual_review" ? "manual_review_only" : "negative_hold_only";
  const actualDecision = classified.listingType === "normal" && parsed.comparableKey && !parsed.needsReview
    ? "candidate_positive_only"
    : row.expectedClass === "manual_review"
      ? "manual_review_only"
      : "negative_hold_only";
  const pass = expectedDecision === actualDecision;
  return {
    caseId: row.caseId,
    inputTitle: row.inputTitle,
    expectedClass: row.expectedClass,
    expectedDecision,
    actualDecision,
    runtimeListingType: classified.listingType,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    parseConfidence: parsed.parseConfidence,
    blockerType: row.blockerType,
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
  category: "desktop_pc_discovered",
  scope: "no-mutation runtime dry-run over desktop CPU/GPU implementation-prep cases",
  inputFiles: ["reports/desktop-cpu-gpu-implementation-prep-latest.json"],
  metrics: {
    rows: rows.length,
    passedRows: rows.filter((row) => row.pass).length,
    failedRows: failedRows.length,
    manualReviewRows: rows.filter((row) => row.expectedClass === "manual_review").length,
    holdRows: rows.filter((row) => row.expectedClass === "hold").length,
    candidatePositiveOnlyRows: rows.filter((row) => row.actualDecision === "candidate_positive_only").length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  rows,
  failedRows,
  conclusion: failedRows.length > 0
    ? "desktop_runtime_dry_run_has_unexpected_candidate_rows"
    : "desktop_runtime_dry_run_confirms_runtime_unwired_and_no_candidate_leak",
  nextAction: "Desktop remains report-only; next queue item is speaker_audio_discovered unless main-agent asks for patch review batch first.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "desktop-no-mutation-runtime-dry-run-latest.json");
const mdPath = path.join(reportsDir, "desktop-no-mutation-runtime-dry-run-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Desktop No-Mutation Runtime Dry-Run",
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
  `- manual/hold: ${report.metrics.manualReviewRows}/${report.metrics.holdRows}`,
  `- candidatePositiveOnlyRows: ${report.metrics.candidatePositiveOnlyRows}`,
  "",
  "## Rows",
  "",
  "| caseId | expected | actual | listingType | comparableKey | needsReview | pass |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${row.caseId} | ${row.expectedDecision} | ${row.actualDecision} | ${row.runtimeListingType} | ${row.comparableKey ?? "null"} | ${row.needsReview} | ${row.pass ? "yes" : "no"} |`),
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
