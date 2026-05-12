import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type VacuumRow = {
  key: string;
  count: number;
  subtype: string;
  status: string;
};

type HomeLogisticsReview = {
  category: string;
  modelReadyVacuumRows: VacuumRow[];
  metrics: {
    logisticsRiskCount: number;
    logisticsRiskExamplesAvailable: number;
  };
};

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const review = JSON.parse(
    await readFile(path.join(reportsDir, "home-appliance-logistics-generic-review-latest.json"), "utf8"),
  ) as HomeLogisticsReview;

  const testCandidateRows = review.modelReadyVacuumRows.map((row) => ({
    ...row,
    testCandidateStatus: "test_candidate_only_pending_main_review",
  }));
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: review.category,
    decision: "test_candidate_only_report_no_wiring",
    sourceReports: ["home-appliance-logistics-generic-review-latest.json", "home-appliance-deep-dive-latest.json"],
    metrics: {
      modelReadyVacuumRows: testCandidateRows.length,
      totalRowCount: testCandidateRows.reduce((sum, row) => sum + row.count, 0),
      logisticsRiskCount: review.metrics.logisticsRiskCount,
      logisticsRiskExamplesAvailable: review.metrics.logisticsRiskExamplesAvailable,
      runtimeApprovedRows: 0,
    },
    testCandidateRows,
    gaps: [
      "logistics_risk row-level examples remain unavailable in current report sources",
      "battery/dock/accessory bundle condition is not modeled by this report",
      "bulky appliance logistics policy remains out of subagent scope",
    ],
    policyImplications: [
      "Model-ready vacuum rows are test-candidate-only and still require main/manual review.",
      "Robot vacuum and stick/handheld vacuum need separate subtype boundaries.",
      "Generic vacuum rows remain excluded from candidate policy.",
      "No runtime subtype wiring or logistics policy wiring is approved here.",
    ],
    nextReportOnlyExperiments: [
      "split model-ready vacuum rows by stick/handheld vs robot_vacuum test candidate class",
      "export row-level logistics examples only if a source report exposes them",
      "prepare generic vacuum exclusion-test candidates without runtime apply",
    ],
    doNotDo: [
      "Do not promote home_appliance_tech_discovered",
      "Do not use generic vacuum/appliance keys for candidate pool",
      "Do not wire robot vacuum or vacuum subtype axes into runtime",
      "Do not mutate production DB or Supabase schema",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "home-appliance-vacuum-test-candidate-readiness-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| key | count | subtype | status |",
    "| --- | ---: | --- | --- |",
    ...testCandidateRows.map((row) => `| ${row.key} | ${row.count} | ${row.subtype} | ${row.testCandidateStatus} |`),
  ].join("\n");

  const md = [
    "# Home Appliance Vacuum Test Candidate Readiness",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only home appliance vacuum test-candidate readiness. This is not runtime wiring and not public promotion.",
    "",
    table,
    "",
    "## Gaps",
    "",
    ...report.gaps.map((line) => `- ${line}`),
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

  await writeFile(path.join(reportsDir, "home-appliance-vacuum-test-candidate-readiness-latest.md"), `${md}\n`);
  console.log("wrote reports/home-appliance-vacuum-test-candidate-readiness-latest.json");
  console.log("wrote reports/home-appliance-vacuum-test-candidate-readiness-latest.md");
  console.log(`home appliance vacuum test-candidate readiness: rows=${testCandidateRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
