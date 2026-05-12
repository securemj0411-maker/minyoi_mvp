import fs from "node:fs";
import path from "node:path";

import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

type MonitorCase = {
  caseId: string;
  inputTitle: string;
  inputDescription?: string;
  expectedClass: "split_only" | "manual_review" | "hold";
  blockerType: string;
  confidence: string;
  notes?: string;
};

type PrepReport = {
  splitOnlyOrArchitectureCases: MonitorCase[];
  manualReviewTestCases: MonitorCase[];
  negativeHoldTestCases: MonitorCase[];
};

const prep = JSON.parse(fs.readFileSync("reports/monitor-model-code-implementation-prep-latest.json", "utf8")) as PrepReport;
const selectedBackfill = JSON.parse(fs.readFileSync("reports/monitor-selected-model-backfill-latest.json", "utf8")) as {
  selectedRows: Array<{ bucket: string; observedHint?: string }>;
};
const allowedSelectedModelCodes = new Set(
  selectedBackfill.selectedRows
    .filter((row) => row.bucket === "runtime_candidate_after_main_review")
    .map((row) => row.observedHint)
    .filter((value): value is string => Boolean(value)),
);
const cases = [
  ...prep.splitOnlyOrArchitectureCases,
  ...prep.manualReviewTestCases,
  ...prep.negativeHoldTestCases,
];

const rows = cases.map((row) => {
  const description = row.inputDescription ?? "";
  const classified = classifyListing(row.inputTitle, description, 100_000);
  const parsed = parseListingOptions({
    title: row.inputTitle,
    description,
    category: "monitor",
    skuId: null,
    skuName: null,
  });
  const monitorModelCode = String(parsed.parsedJson.monitor_model_code ?? "");
  const isAllowedSelectedModel = row.expectedClass === "split_only" && allowedSelectedModelCodes.has(monitorModelCode);
  const expectedRuntimeDecision =
    isAllowedSelectedModel ? "selected_exact_model_runtime_candidate"
      : row.expectedClass === "split_only" ? "split_only_not_runtime_candidate"
      : row.expectedClass === "manual_review" ? "manual_review_only"
        : "negative_hold_only";
  const actualRuntimeDecision =
    isAllowedSelectedModel && classified.listingType === "normal" && parsed.comparableKey && !parsed.needsReview
      ? "selected_exact_model_runtime_ready"
      : classified.listingType === "normal" ? "candidate_like_runtime_normal"
      : parsed.comparableKey && !parsed.needsReview && row.expectedClass === "split_only" ? "parser_ready_but_runtime_unwired"
        : parsed.needsReview ? "review_or_hold"
          : "hold_or_unknown";
  const pass =
    isAllowedSelectedModel
      ? classified.listingType === "normal" && Boolean(parsed.comparableKey) && !parsed.needsReview
      : row.expectedClass === "split_only"
      ? classified.listingType !== "normal"
      : row.expectedClass === "manual_review"
        ? classified.listingType !== "normal" && parsed.needsReview
        : classified.listingType !== "normal";
  return {
    caseId: row.caseId,
    inputTitle: row.inputTitle,
    expectedClass: row.expectedClass,
    expectedRuntimeDecision,
    actualRuntimeDecision,
    runtimeListingType: classified.listingType,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    parseConfidence: parsed.parseConfidence,
    selectedModelCode: isAllowedSelectedModel ? monitorModelCode : null,
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
  category: "monitor_discovered",
  scope: "no-mutation runtime dry-run over monitor implementation-prep cases",
  inputFiles: [
    "reports/monitor-model-code-implementation-prep-latest.json",
    "reports/monitor-selected-model-backfill-latest.json",
  ],
  metrics: {
    rows: rows.length,
    passedRows: rows.filter((row) => row.pass).length,
    failedRows: failedRows.length,
    splitOnlyRows: rows.filter((row) => row.expectedClass === "split_only").length,
    selectedExactModelRuntimeRows: rows.filter((row) => row.actualRuntimeDecision === "selected_exact_model_runtime_ready").length,
    manualReviewRows: rows.filter((row) => row.expectedClass === "manual_review").length,
    holdRows: rows.filter((row) => row.expectedClass === "hold").length,
    candidateLikeRuntimeNormalRows: rows.filter((row) => row.actualRuntimeDecision === "candidate_like_runtime_normal").length,
    parserReadyButRuntimeUnwiredRows: rows.filter((row) => row.actualRuntimeDecision === "parser_ready_but_runtime_unwired").length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  rows,
  failedRows,
  conclusion: failedRows.length > 0
    ? "monitor_runtime_dry_run_has_unexpected_candidate_like_rows"
    : "monitor_runtime_dry_run_confirms_selected_exact_model_only",
  nextAction: "Proceed to camera package-axis or speaker exact-model prep; monitor selected exact model-code subset is parser-ready but still not public-promoted.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "monitor-no-mutation-runtime-dry-run-latest.json");
const mdPath = path.join(reportsDir, "monitor-no-mutation-runtime-dry-run-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Monitor No-Mutation Runtime Dry-Run",
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
  `- split/manual/hold: ${report.metrics.splitOnlyRows}/${report.metrics.manualReviewRows}/${report.metrics.holdRows}`,
  `- selectedExactModelRuntimeRows: ${report.metrics.selectedExactModelRuntimeRows}`,
  `- candidateLikeRuntimeNormalRows: ${report.metrics.candidateLikeRuntimeNormalRows}`,
  `- parserReadyButRuntimeUnwiredRows: ${report.metrics.parserReadyButRuntimeUnwiredRows}`,
  "",
  "## Rows",
  "",
  "| caseId | expected | actualDecision | listingType | comparableKey | needsReview | pass |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${row.caseId} | ${row.expectedClass} | ${row.actualRuntimeDecision} | ${row.runtimeListingType} | ${row.comparableKey ?? "null"} | ${row.needsReview} | ${row.pass ? "yes" : "no"} |`),
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
  candidateLikeRuntimeNormalRows: report.metrics.candidateLikeRuntimeNormalRows,
  jsonPath,
  mdPath,
}, null, 2));
