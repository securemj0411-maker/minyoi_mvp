import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ExpandedFixture = {
  metrics: {
    previousFixtureRows: number;
    addedFixtureRows: number;
    totalFixtureRows: number;
    positiveRows: number;
    manualReviewRows: number;
    holdRows: number;
    candidatePositiveOnlyRows: number;
    manualReviewOnlyRows: number;
    negativeHoldOnlyRows: number;
    duplicateCaseIds: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolWiringRows: number;
  };
  forbiddenOutputs: string[];
  stopConditions: string[];
  fixtureRows: Array<{
    caseId: string;
    expectedClass: string;
    expectedDryRunDecision: string;
    sourceEvidenceRefs: unknown[];
  }>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const fixture = await readJson<ExpandedFixture>(path.join(reportsDir, "headphone-repeat-dry-run-expanded-fixture-packet-latest.json"));

  const checks = [
    {
      id: "REPEAT-PREFLIGHT-01",
      status: fixture.metrics.totalFixtureRows === 14 ? "pass" : "fail",
      check: "expanded fixture has exactly 14 rows",
      detail: `total=${fixture.metrics.totalFixtureRows}`,
    },
    {
      id: "REPEAT-PREFLIGHT-02",
      status: fixture.metrics.addedFixtureRows === 5 ? "pass" : "fail",
      check: "expanded fixture adds exactly 5 guardrail rows",
      detail: `added=${fixture.metrics.addedFixtureRows}`,
    },
    {
      id: "REPEAT-PREFLIGHT-03",
      status: fixture.metrics.positiveRows === 5 && fixture.metrics.manualReviewRows === 4 && fixture.metrics.holdRows === 5 ? "pass" : "fail",
      check: "positive/manual/hold counts are 5/4/5",
      detail: `${fixture.metrics.positiveRows}/${fixture.metrics.manualReviewRows}/${fixture.metrics.holdRows}`,
    },
    {
      id: "REPEAT-PREFLIGHT-04",
      status: fixture.metrics.duplicateCaseIds === 0 ? "pass" : "fail",
      check: "no duplicate case IDs",
      detail: `duplicates=${fixture.metrics.duplicateCaseIds}`,
    },
    {
      id: "REPEAT-PREFLIGHT-05",
      status: fixture.metrics.runtimeApprovedRows === 0 && fixture.metrics.publicPromotionRows === 0 && fixture.metrics.candidatePoolWiringRows === 0 ? "pass" : "fail",
      check: "runtime/public/candidate-pool rows remain zero",
      detail: `${fixture.metrics.runtimeApprovedRows}/${fixture.metrics.publicPromotionRows}/${fixture.metrics.candidatePoolWiringRows}`,
    },
    {
      id: "REPEAT-PREFLIGHT-06",
      status: fixture.fixtureRows.filter((row) => row.expectedClass === "positive").every((row) => row.sourceEvidenceRefs.length > 0) ? "pass" : "fail",
      check: "all positive rows have source refs",
      detail: `positive=${fixture.metrics.positiveRows}`,
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
    scope: "Repeat headphone no-mutation dry-run preflight",
    readyForRepeatDryRunExecutor: checks.every((row) => row.status === "pass"),
    metrics: {
      checks: checks.length,
      passChecks: checks.filter((row) => row.status === "pass").length,
      failChecks: checks.filter((row) => row.status === "fail").length,
      totalFixtureRows: fixture.metrics.totalFixtureRows,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    checks,
    forbiddenOutputs: fixture.forbiddenOutputs,
    stopConditions: fixture.stopConditions,
    boundary: [
      "Repeat dry-run may only read expanded fixture/report JSON.",
      "Repeat dry-run may only write report-only result files.",
      "No runtime parser imports or source edits are allowed.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-repeat-dry-run-preflight-latest.json"), JSON.stringify(report, null, 2));

  const rows = checks.map((row) => `| ${row.id} | ${row.status} | ${row.check} | ${row.detail} |`);
  const md = [
    "# Headphone Repeat Dry-Run Preflight",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only preflight for a possible repeat headphone no-mutation dry-run. This does not execute parser/runtime wiring.",
    "",
    `Ready for repeat dry-run executor: ${report.readyForRepeatDryRunExecutor ? "yes" : "no"}`,
    "",
    "## Metrics",
    "",
    `- checks: ${report.metrics.checks}`,
    `- pass/fail checks: ${report.metrics.passChecks}/${report.metrics.failChecks}`,
    `- total fixture rows: ${report.metrics.totalFixtureRows}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Checks",
    "",
    "| id | status | check | detail |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    "## Boundary",
    "",
    ...report.boundary.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-repeat-dry-run-preflight-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-repeat-dry-run-preflight-latest.json");
  console.log("wrote reports/headphone-repeat-dry-run-preflight-latest.md");
  console.log(`headphone repeat preflight: ready=${report.readyForRepeatDryRunExecutor ? "yes" : "no"}, pass=${report.metrics.passChecks}, fail=${report.metrics.failChecks}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
