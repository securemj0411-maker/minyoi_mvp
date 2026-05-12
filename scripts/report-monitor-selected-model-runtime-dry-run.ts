import fs from "node:fs";
import path from "node:path";

import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

type MonitorSelectedRow = {
  caseId: string;
  title: string;
  bucket: "runtime_candidate_after_main_review" | "manual_review_needed" | "hold_or_exclusion";
  evidenceStatus?: string;
  sourceUrl?: string;
};

type BackfillReport = {
  selectedRows: MonitorSelectedRow[];
  holdRows: MonitorSelectedRow[];
};

const inputPath = "reports/monitor-selected-model-backfill-latest.json";
const input = JSON.parse(fs.readFileSync(inputPath, "utf8")) as BackfillReport;
const rows = [...input.selectedRows, ...input.holdRows].map((row) => {
  const classified = classifyListing(row.title, "", 100_000);
  const parsed = parseListingOptions({
    title: row.title,
    description: "",
    category: "monitor",
    skuId: "monitor",
    skuName: "모니터",
  });
  const parserReady = classified.listingType === "normal" && Boolean(parsed.comparableKey) && !parsed.needsReview;
  const expected =
    row.bucket === "runtime_candidate_after_main_review" ? "selected_parser_ready"
      : row.bucket === "manual_review_needed" ? "manual_review_not_auto_ready"
        : "hold_not_auto_ready";
  const pass =
    row.bucket === "runtime_candidate_after_main_review"
      ? parserReady
      : row.bucket === "manual_review_needed"
        ? !parserReady
        : !parserReady;

  return {
    caseId: row.caseId,
    title: row.title,
    bucket: row.bucket,
    expected,
    runtimeListingType: classified.listingType,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    parseConfidence: parsed.parseConfidence,
    parserReady,
    evidenceStatus: row.evidenceStatus ?? null,
    sourceUrl: row.sourceUrl ?? null,
    pass,
  };
});

const failedRows = rows.filter((row) => !row.pass);
const manualAutoReadyRows = rows.filter((row) => row.bucket === "manual_review_needed" && row.parserReady);
const holdLeakRows = rows.filter((row) => row.bucket === "hold_or_exclusion" && row.parserReady);
const candidateRows = rows.filter((row) => row.bucket === "runtime_candidate_after_main_review");
const candidateReadyRows = candidateRows.filter((row) => row.parserReady);

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  category: "monitor_discovered",
  scope: "selected official model-code runtime parser dry-run; no catalog or public promotion",
  inputFiles: [inputPath],
  metrics: {
    rows: rows.length,
    candidateRows: candidateRows.length,
    candidateReadyRows: candidateReadyRows.length,
    manualReviewRows: rows.filter((row) => row.bucket === "manual_review_needed").length,
    manualAutoReadyRows: manualAutoReadyRows.length,
    holdRows: rows.filter((row) => row.bucket === "hold_or_exclusion").length,
    holdLeakRows: holdLeakRows.length,
    failedRows: failedRows.length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  rows,
  failedRows,
  manualAutoReadyRows,
  holdLeakRows,
  conclusion: candidateReadyRows.length === candidateRows.length && holdLeakRows.length === 0
    ? "monitor_selected_model_parser_ready_without_public_wiring"
    : "monitor_selected_model_parser_dry_run_needs_review",
  nextAction: "Owner/main agent may review the 6 selected exact model-code rows as the first narrow monitor runtime patch; manual rows stay excluded until separate policy review.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "monitor-selected-model-runtime-dry-run-latest.json");
const mdPath = path.join(reportsDir, "monitor-selected-model-runtime-dry-run-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Monitor Selected Model Runtime Dry-Run",
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
  `- candidateReadyRows: ${report.metrics.candidateReadyRows}/${report.metrics.candidateRows}`,
  `- manualAutoReadyRows: ${report.metrics.manualAutoReadyRows}`,
  `- holdLeakRows: ${report.metrics.holdLeakRows}`,
  `- failedRows: ${report.metrics.failedRows}`,
  "",
  "## Rows",
  "",
  "| caseId | bucket | listingType | comparableKey | needsReview | parserReady | pass |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${row.caseId} | ${row.bucket} | ${row.runtimeListingType} | ${row.comparableKey ?? "null"} | ${row.needsReview} | ${row.parserReady ? "yes" : "no"} | ${row.pass ? "yes" : "no"} |`),
  "",
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(JSON.stringify({
  conclusion: report.conclusion,
  candidateReadyRows: report.metrics.candidateReadyRows,
  candidateRows: report.metrics.candidateRows,
  manualAutoReadyRows: report.metrics.manualAutoReadyRows,
  holdLeakRows: report.metrics.holdLeakRows,
  failedRows: report.metrics.failedRows,
  jsonPath,
  mdPath,
}, null, 2));
