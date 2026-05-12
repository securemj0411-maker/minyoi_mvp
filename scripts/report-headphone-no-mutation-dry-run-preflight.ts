import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type FixturePacket = {
  metrics: {
    fixtureRows: number;
    positiveRows: number;
    manualReviewRows: number;
    holdRows: number;
    runtimeApprovedRows: number;
  };
  requiredInputs: string[];
  allowedOutputs: string[];
  forbiddenOutputs: string[];
  stopConditions: string[];
  passCriteria: string[];
  fixtureRows: Array<{
    caseId: string;
    expectedClass: string;
    expectedDryRunDecision: string;
    sourceEvidenceRefs: unknown[];
  }>;
};

type OutputContract = {
  validationRules: Array<{ id: string; severity: string; rule: string }>;
  requiredOutputFields: Array<{ name: string; type: string; required: boolean; note: string }>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const fixture = await readJson<FixturePacket>(path.join(reportsDir, "headphone-no-mutation-dry-run-fixture-packet-latest.json"));
  const contract = await readJson<OutputContract>(path.join(reportsDir, "subagent-implementation-prep-dry-run-output-contract-latest.json"));

  const preflightChecks = [
    {
      id: "PREFLIGHT-01",
      check: "fixture packet exists and has exactly 9 rows",
      status: fixture.metrics.fixtureRows === 9 ? "pass" : "fail",
      detail: `fixtureRows=${fixture.metrics.fixtureRows}`,
    },
    {
      id: "PREFLIGHT-02",
      check: "positive/manual/hold counts match expected 5/2/2",
      status: fixture.metrics.positiveRows === 5 && fixture.metrics.manualReviewRows === 2 && fixture.metrics.holdRows === 2 ? "pass" : "fail",
      detail: `${fixture.metrics.positiveRows}/${fixture.metrics.manualReviewRows}/${fixture.metrics.holdRows}`,
    },
    {
      id: "PREFLIGHT-03",
      check: "runtimeApprovedRows remains zero",
      status: fixture.metrics.runtimeApprovedRows === 0 ? "pass" : "fail",
      detail: `runtimeApprovedRows=${fixture.metrics.runtimeApprovedRows}`,
    },
    {
      id: "PREFLIGHT-04",
      check: "output contract has blocker validation rules",
      status: contract.validationRules.every((rule) => rule.severity === "blocker") ? "pass" : "fail",
      detail: `rules=${contract.validationRules.length}`,
    },
    {
      id: "PREFLIGHT-05",
      check: "required output fields include runtime/public/candidate-pool false flags",
      status: ["runtimeApproved", "publicPromotion", "candidatePoolWiring"].every((name) => contract.requiredOutputFields.some((field) => field.name === name)) ? "pass" : "fail",
      detail: "runtimeApproved/publicPromotion/candidatePoolWiring",
    },
  ];

  const forbiddenFiles = [
    "src/lib/catalog.ts",
    "src/lib/category-readiness.ts",
    "src/lib/option-parser.ts",
    "src/lib/pipeline.ts",
    "src/lib/tick-pipeline.ts",
    "src/lib/pack-open.ts",
    "src/lib/candidate-pool-builder.ts",
    "src/app/api/cron/*",
    "src/app/debug/*",
    "supabase/schema.sql",
    "30일_실행계획.md",
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope: "Headphone no-mutation dry-run preflight checklist",
    category: "headphone_discovered",
    readyForExecutorDesign: preflightChecks.every((row) => row.status === "pass"),
    preflightChecks,
    requiredInputs: fixture.requiredInputs,
    allowedOutputs: fixture.allowedOutputs,
    forbiddenOutputs: fixture.forbiddenOutputs,
    forbiddenFiles,
    stopConditions: fixture.stopConditions,
    passCriteria: fixture.passCriteria,
    executorDesignConstraint: "executor may only read fixture/report JSON and write a new report-only dry-run result; it must not import or edit runtime parser modules",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-no-mutation-dry-run-preflight-latest.json"), JSON.stringify(report, null, 2));

  const checkRows = preflightChecks.map((row) => `| ${row.id} | ${row.status} | ${row.check} | ${row.detail} |`);
  const forbiddenRows = forbiddenFiles.map((file) => `- ${file}`);

  const md = [
    "# Headphone No-Mutation Dry-Run Preflight",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only preflight checklist for a future headphone dry-run executor. This does not execute parser/runtime wiring.",
    "",
    `Ready for executor design: ${report.readyForExecutorDesign ? "yes" : "no"}`,
    "",
    "## Preflight Checks",
    "",
    "| id | status | check | detail |",
    "| --- | --- | --- | --- |",
    ...checkRows,
    "",
    "## Forbidden Files",
    "",
    ...forbiddenRows,
    "",
    "## Executor Design Constraint",
    "",
    report.executorDesignConstraint,
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-no-mutation-dry-run-preflight-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-no-mutation-dry-run-preflight-latest.json");
  console.log("wrote reports/headphone-no-mutation-dry-run-preflight-latest.md");
  console.log(`headphone preflight: ready=${report.readyForExecutorDesign ? "yes" : "no"}, checks=${preflightChecks.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
