import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type HintRow = {
  hint: string;
  count: number;
  reviewClass: string;
  action: string;
  examples: Array<{
    pid?: string;
    title?: string;
    price?: number;
    url?: string;
    comparableKey?: string;
    criticalUnknown?: string[];
    unknownParts?: string[];
  }>;
};

type MonitorHintReview = {
  category: string;
  rows: HintRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function testCandidateStatus(row: HintRow): string {
  if (row.action !== "manual_review_before_test_candidate") return "excluded_before_test_candidate";
  return "pending_manual_confirmation";
}

async function main(): Promise<void> {
  const review = JSON.parse(
    await readFile(path.join(reportsDir, "monitor-hint-false-positive-review-latest.json"), "utf8"),
  ) as MonitorHintReview;

  const rows = review.rows.map((row) => ({
    ...row,
    testCandidateStatus: testCandidateStatus(row),
    confirmedBySubagent: false,
  }));
  const pendingRows = rows.filter((row) => row.testCandidateStatus === "pending_manual_confirmation");
  const excludedRows = rows.filter((row) => row.testCandidateStatus === "excluded_before_test_candidate");
  const confirmedRows = rows.filter((row) => row.confirmedBySubagent);

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: review.category,
    decision: "hold_report_only_no_confirmed_test_candidates",
    sourceReports: ["monitor-hint-false-positive-review-latest.json", "monitor-model-code-deep-dive-latest.json"],
    metrics: {
      hintRows: rows.length,
      confirmedTestCandidates: confirmedRows.length,
      pendingManualConfirmation: pendingRows.length,
      excludedBeforeTestCandidate: excludedRows.length,
    },
    confirmedRows,
    pendingRows,
    excludedRows,
    policyImplications: [
      "No monitor hint is confirmed by this subagent as a test candidate.",
      "ct2210ips and u2412mb remain pending manual confirmation before any test-candidate-only list can be populated.",
      "camel and xp-142nw stay excluded from model-code policy candidate review.",
      "This report intentionally produces zero approved test candidates.",
    ],
    nextReportOnlyExperiments: [
      "after manual confirmation, move confirmed hint rows into a test-candidate-only report",
      "separate critical unknown fields for pending rows without runtime parser changes",
      "keep accessory/parts and multi/bundle rows in exclusion examples",
    ],
    doNotDo: [
      "Do not public-promote monitor_discovered",
      "Do not wire model-code policy into candidate pool",
      "Do not add monitor hints to runtime catalog",
      "Do not treat pending rows as confirmed test candidates",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "monitor-test-candidate-readiness-latest.json"), JSON.stringify(report, null, 2));

  const pendingTable = [
    "| hint | status | title |",
    "| --- | --- | --- |",
    ...pendingRows.map((row) => `| ${row.hint} | ${row.testCandidateStatus} | ${(row.examples[0]?.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const excludedTable = [
    "| hint | status | reason | title |",
    "| --- | --- | --- | --- |",
    ...excludedRows.map((row) => `| ${row.hint} | ${row.testCandidateStatus} | ${row.reviewClass} | ${(row.examples[0]?.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Monitor Test Candidate Readiness",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only monitor hint test-candidate readiness. This is not runtime wiring and not public promotion.",
    "",
    `Confirmed test candidates: ${report.metrics.confirmedTestCandidates}`,
    "",
    "## Pending Manual Confirmation",
    "",
    pendingTable,
    "",
    "## Excluded Before Test Candidate",
    "",
    excludedTable,
    "",
    "## Policy Implications",
    "",
    ...report.policyImplications.map((line) => `- ${line}`),
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "monitor-test-candidate-readiness-latest.md"), `${md}\n`);
  console.log("wrote reports/monitor-test-candidate-readiness-latest.json");
  console.log("wrote reports/monitor-test-candidate-readiness-latest.md");
  console.log(`monitor test-candidate readiness: confirmed=${confirmedRows.length}, pending=${pendingRows.length}, excluded=${excludedRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
