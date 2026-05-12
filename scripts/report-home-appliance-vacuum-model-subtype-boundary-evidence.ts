import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ModelReadyRow = {
  key: string;
  count: number;
  subtype: string;
  status: string;
  testCandidateStatus: string;
};

type VacuumReadiness = {
  category: string;
  metrics: {
    modelReadyVacuumRows: number;
    logisticsRiskCount: number;
    runtimeApprovedRows: number;
  };
  testCandidateRows: ModelReadyRow[];
};

type ModelSubtypeRow = ModelReadyRow & {
  brand: string;
  modelToken: string;
  subtypeBoundaryClass: string;
  reportOnlyAction: string;
  runtimeApproved: false;
};

const reportsDir = path.join(process.cwd(), "reports");

function brandFromKey(key: string): string {
  return key.split("-")[0] ?? "unknown_brand";
}

function modelTokenFromKey(key: string): string {
  return key.split("-").slice(1).join("-") || "unknown_model";
}

function subtypeBoundaryClass(row: ModelReadyRow): string {
  if (row.subtype === "robot_vacuum") return "robot_vacuum_model_ready_separate_hold";
  if (row.subtype === "stick_or_handheld_vacuum") return "stick_or_handheld_model_ready_reference_only";
  return "unknown_vacuum_subtype_hold";
}

function actionFor(boundary: string): string {
  if (boundary === "robot_vacuum_model_ready_separate_hold") return "hold as separate robot vacuum axis; not stick/handheld parser";
  if (boundary === "stick_or_handheld_model_ready_reference_only") return "reference only; wait for main approval before parser design";
  return "hold report-only";
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
    await readFile(path.join(reportsDir, "home-appliance-vacuum-test-candidate-readiness-latest.json"), "utf8"),
  ) as VacuumReadiness;

  const rows: ModelSubtypeRow[] = readiness.testCandidateRows.map((row) => {
    const boundary = subtypeBoundaryClass(row);
    return {
      ...row,
      brand: brandFromKey(row.key),
      modelToken: modelTokenFromKey(row.key),
      subtypeBoundaryClass: boundary,
      reportOnlyAction: actionFor(boundary),
      runtimeApproved: false,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: readiness.category,
    decision: "vacuum_model_subtype_boundary_report_only",
    sourceReports: [
      "home-appliance-vacuum-test-candidate-readiness-latest.json",
      "home-appliance-vacuum-subtype-boundary-evidence-latest.json",
    ],
    metrics: {
      modelReadyRows: rows.length,
      stickOrHandheldRows: rows.filter((row) => row.subtype === "stick_or_handheld_vacuum").length,
      stickOrHandheldUnits: rows.filter((row) => row.subtype === "stick_or_handheld_vacuum").reduce((sum, row) => sum + row.count, 0),
      robotVacuumRows: rows.filter((row) => row.subtype === "robot_vacuum").length,
      robotVacuumUnits: rows.filter((row) => row.subtype === "robot_vacuum").reduce((sum, row) => sum + row.count, 0),
      logisticsRiskCount: readiness.metrics.logisticsRiskCount,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      subtypeBoundaryClassCounts: countBy(rows.map((row) => row.subtypeBoundaryClass)),
      brandCounts: countBy(rows.flatMap((row) => Array(row.count).fill(row.brand) as string[])),
    },
    rows,
    policyImplications: [
      "Model-ready vacuum rows are subtype-specific reference evidence only.",
      "Robot vacuum model-ready rows must not be merged into stick/handheld vacuum parser readiness.",
      "Logistics risk count remains a blocker for home appliance promotion.",
      "No vacuum subtype runtime wiring or candidate pool policy wiring is approved here.",
    ],
    nextReportOnlyExperiments: [
      "keep robot vacuum model-ready rows separate from stick/handheld rows",
      "add logistics row-level examples only when a source report exposes them",
      "compare model-ready rows against generic subtype exclusions in report form only",
    ],
    doNotDo: [
      "Do not promote home_appliance_tech_discovered",
      "Do not merge robot vacuum and stick/handheld vacuum parser axes",
      "Do not wire vacuum subtype policy into runtime",
      "Do not mutate production DB or Supabase schema",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "home-appliance-vacuum-model-subtype-boundary-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| key | count | subtype | subtype_boundary_class | runtime_approved |",
    "| --- | ---: | --- | --- | --- |",
    ...rows.map((row) => `| ${row.key} | ${row.count} | ${row.subtype} | ${row.subtypeBoundaryClass} | no |`),
  ].join("\n");

  const md = [
    "# Home Appliance Vacuum Model Subtype Boundary Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only model-ready vacuum subtype boundary evidence. This is not runtime wiring and not public promotion.",
    "",
    `Stick/handheld units: ${report.metrics.stickOrHandheldUnits}`,
    `Robot vacuum units: ${report.metrics.robotVacuumUnits}`,
    `Runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
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

  await writeFile(path.join(reportsDir, "home-appliance-vacuum-model-subtype-boundary-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/home-appliance-vacuum-model-subtype-boundary-evidence-latest.json");
  console.log("wrote reports/home-appliance-vacuum-model-subtype-boundary-evidence-latest.md");
  console.log(
    `home appliance vacuum model subtype boundary: stick_units=${report.metrics.stickOrHandheldUnits}, robot_units=${report.metrics.robotVacuumUnits}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
