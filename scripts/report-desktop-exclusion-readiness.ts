import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type DesktopHoldRow = {
  pid?: string;
  title?: string;
  price?: number;
  key?: string | null;
  keyClass: string;
  reviewClass: string;
  hasCpuToken: boolean;
  hasGpuToken: boolean;
  testCandidateStatus: string;
};

type DesktopReadiness = {
  category: string;
  holdRows: DesktopHoldRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function exclusionClass(row: DesktopHoldRow): string {
  if (row.reviewClass === "gpu_only_missing_cpu") return "gpu_only_missing_cpu_identity";
  if (row.reviewClass === "hold_commercial_or_mining_risk") return "commercial_or_mining_risk";
  return "desktop_hold_other";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const readiness = JSON.parse(
    await readFile(path.join(reportsDir, "desktop-test-candidate-readiness-latest.json"), "utf8"),
  ) as DesktopReadiness;

  const rows = readiness.holdRows.map((row) => ({
    ...row,
    exclusionClass: exclusionClass(row),
    action: "exclusion_test_candidate_only",
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: readiness.category,
    decision: "exclusion_candidate_only_report_no_wiring",
    sourceReports: ["desktop-test-candidate-readiness-latest.json", "desktop-token-review-latest.json"],
    metrics: {
      holdRows: rows.length,
      exclusionCandidateOnlyRows: rows.length,
      positiveCandidateRows: 0,
      runtimeApprovedRows: 0,
      exclusionClassCounts: countBy(rows.map((row) => row.exclusionClass)),
    },
    rows,
    policyImplications: [
      "GPU-only rows are exclusion-test candidates until CPU identity is present.",
      "Commercial/mining/위탁 rows must remain excluded from full-unit CPU/GPU candidate policy.",
      "This report adds no CPU/GPU parser rule and no candidate pool wiring.",
    ],
    nextReportOnlyExperiments: [
      "split desktop test-candidate-only rows by CPU family and GPU generation",
      "keep GPU-only rows as negative/exclusion examples for future tests",
      "keep RAM/SSD/warranty/newness runtime design out of scope",
    ],
    doNotDo: [
      "Do not promote desktop_pc_discovered",
      "Do not wire CPU/GPU policy into candidate pool",
      "Do not add CPU/GPU parser rules from this report",
      "Do not treat GPU-only rows as comparable keys",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "desktop-exclusion-readiness-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | exclusion_class | action | title |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.pid ?? "-"} | ${row.exclusionClass} | ${row.action} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Desktop Exclusion Readiness",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only desktop exclusion-candidate readiness. This is not runtime wiring and not public promotion.",
    "",
    table,
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

  await writeFile(path.join(reportsDir, "desktop-exclusion-readiness-latest.md"), `${md}\n`);
  console.log("wrote reports/desktop-exclusion-readiness-latest.json");
  console.log("wrote reports/desktop-exclusion-readiness-latest.md");
  console.log(`desktop exclusion readiness: exclusion_candidate_only=${rows.length}, positive_candidates=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
