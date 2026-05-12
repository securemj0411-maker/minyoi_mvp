import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type DesktopTokenRow = {
  pid?: string;
  title?: string;
  price?: number;
  key?: string | null;
  keyClass: string;
  reviewClass: string;
  hasCpuToken: boolean;
  hasGpuToken: boolean;
  action: string;
};

type DesktopTokenReview = {
  category: string;
  rows: DesktopTokenRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function candidateStatus(row: DesktopTokenRow): string {
  if (row.reviewClass === "reviewable_cpu_gpu_tokens") return "test_candidate_only_pending_main_review";
  if (row.reviewClass === "gpu_only_missing_cpu") return "hold_missing_cpu_identity";
  return "excluded_before_test_candidate";
}

async function main(): Promise<void> {
  const tokenReview = JSON.parse(
    await readFile(path.join(reportsDir, "desktop-token-review-latest.json"), "utf8"),
  ) as DesktopTokenReview;

  const rows = tokenReview.rows.map((row) => ({
    ...row,
    testCandidateStatus: candidateStatus(row),
  }));
  const testCandidateRows = rows.filter((row) => row.testCandidateStatus === "test_candidate_only_pending_main_review");
  const holdRows = rows.filter((row) => row.testCandidateStatus !== "test_candidate_only_pending_main_review");

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: tokenReview.category,
    decision: "test_candidate_only_report_no_wiring",
    sourceReports: ["desktop-token-review-latest.json", "desktop-full-unit-blockers-latest.json"],
    metrics: {
      reviewRows: rows.length,
      testCandidateOnlyRows: testCandidateRows.length,
      holdOrExcludedRows: holdRows.length,
      runtimeApprovedRows: 0,
    },
    testCandidateRows,
    holdRows,
    policyImplications: [
      "These rows are test-candidate-only and still require main/manual review before any parser or policy action.",
      "GPU-only rows remain hold-only because CPU identity is missing.",
      "Commercial/mining/ 위탁 rows remain excluded.",
      "RAM/SSD/warranty/newness runtime design remains out of scope.",
    ],
    nextReportOnlyExperiments: [
      "split test-candidate-only rows by CPU family and GPU generation",
      "prepare exclusion-test-only rows for GPU-only and commercial/mining risk",
      "do not add any runtime parser rule from this test-candidate-only list",
    ],
    doNotDo: [
      "Do not promote desktop_pc_discovered",
      "Do not wire CPU/GPU policy into candidate pool",
      "Do not add CPU/GPU parser rules from this report",
      "Do not design RAM/SSD/warranty runtime keys",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "desktop-test-candidate-readiness-latest.json"), JSON.stringify(report, null, 2));

  const candidateTable = [
    "| pid | key_class | status | title |",
    "| --- | --- | --- | --- |",
    ...testCandidateRows.map((row) => `| ${row.pid ?? "-"} | ${row.keyClass} | ${row.testCandidateStatus} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const holdTable = [
    "| pid | review_class | status | title |",
    "| --- | --- | --- | --- |",
    ...holdRows.map((row) => `| ${row.pid ?? "-"} | ${row.reviewClass} | ${row.testCandidateStatus} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Desktop Test Candidate Readiness",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only desktop CPU/GPU test-candidate readiness. This is not runtime wiring and not public promotion.",
    "",
    "## Test-Candidate-Only Rows",
    "",
    candidateTable,
    "",
    "## Hold Or Excluded Rows",
    "",
    holdTable,
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

  await writeFile(path.join(reportsDir, "desktop-test-candidate-readiness-latest.md"), `${md}\n`);
  console.log("wrote reports/desktop-test-candidate-readiness-latest.json");
  console.log("wrote reports/desktop-test-candidate-readiness-latest.md");
  console.log(`desktop test-candidate readiness: test_candidate_only=${testCandidateRows.length}, hold_or_excluded=${holdRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
