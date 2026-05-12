import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type HomeExample = {
  pid?: string;
  title?: string;
  price?: number;
  key?: string;
};

type HomeDeepDive = {
  category: string;
  metrics: {
    logisticsRiskCount: number;
  };
  modelRowsBySubtype: Array<{ key: string; count: number; subtype: string; status: string }>;
  examplesByClass: Record<string, HomeExample[]>;
};

const reportsDir = path.join(process.cwd(), "reports");

function genericAction(classKey: string): string {
  if (classKey === "accessory_or_parts_risk") return "exclude_from_vacuum_candidate";
  if (classKey === "robot_vacuum_generic") return "keep_hold_until_brand_model_dock_confirmed";
  if (classKey === "bedding_cleaner_generic") return "keep_hold_separate_bedding_cleaner_boundary";
  return "keep_hold_until_model_key_confirmed";
}

function countRows(rows: Record<string, HomeExample[]>): Array<{ key: string; count: number }> {
  return Object.entries(rows)
    .map(([key, examples]) => ({ key, count: examples.length }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const deepDive = JSON.parse(
    await readFile(path.join(reportsDir, "home-appliance-deep-dive-latest.json"), "utf8"),
  ) as HomeDeepDive;

  const genericRows = Object.entries(deepDive.examplesByClass).flatMap(([classKey, examples]) =>
    examples.map((example) => ({
      ...example,
      genericClass: classKey,
      action: genericAction(classKey),
    })),
  );
  const modelReadyVacuumRows = deepDive.modelRowsBySubtype.filter((row) => row.subtype === "stick_or_handheld_vacuum" || row.subtype === "robot_vacuum");

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: deepDive.category,
    decision: "hold_report_only_review_list",
    sourceReports: ["home-appliance-deep-dive-latest.json", "home-appliance-blockers-latest.json"],
    metrics: {
      logisticsRiskCount: deepDive.metrics.logisticsRiskCount,
      logisticsRiskExamplesAvailable: 0,
      genericRows: genericRows.length,
      genericClassCounts: countRows(deepDive.examplesByClass),
      modelReadyVacuumRows: modelReadyVacuumRows.length,
    },
    modelReadyVacuumRows,
    genericRows,
    gaps: [
      "home-appliance-parser-latest.json exposes logistics_risk count but not row-level logistics examples",
      "row-level logistics examples need a future report-only source/export before exclusion-test candidates can be listed",
    ],
    policyImplications: [
      "Generic vacuum rows are useful review/exclusion examples, but they are not comparable candidate keys.",
      "Robot vacuum generic rows require brand/model/dock/base-station separation before any candidate review.",
      "Bedding cleaner rows need a separate boundary from stick/handheld vacuum.",
      "Accessory/parts rows such as charger adapters should be excluded from model-ready vacuum review.",
    ],
    nextReportOnlyExperiments: [
      "add a report-only logistics_risk examples export if source data exposes gate-level rows",
      "draft vacuum model-ready subset conditions from lg-codezero-a9/dyson/samsung-bespoke-jet rows without runtime apply",
      "turn accessory_or_parts_risk rows into future exclusion-test candidates only after main review",
    ],
    doNotDo: [
      "Do not promote home_appliance_tech_discovered",
      "Do not use generic vacuum/appliance keys for candidate pool",
      "Do not wire robot vacuum or vacuum subtype axes into runtime",
      "Do not mutate production DB or Supabase schema",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "home-appliance-logistics-generic-review-latest.json"), JSON.stringify(report, null, 2));

  const modelTable = [
    "| key | count | subtype | status |",
    "| --- | ---: | --- | --- |",
    ...modelReadyVacuumRows.map((row) => `| ${row.key} | ${row.count} | ${row.subtype} | ${row.status} |`),
  ].join("\n");

  const genericTable = [
    "| pid | generic_class | action | title |",
    "| --- | --- | --- | --- |",
    ...genericRows.map((row) => `| ${row.pid ?? "-"} | ${row.genericClass} | ${row.action} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Home Appliance Logistics Generic Review",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only home appliance logistics/generic subtype review. This is not runtime wiring and not public promotion.",
    "",
    "## Model-Ready Vacuum Rows",
    "",
    modelTable,
    "",
    "## Generic Rows",
    "",
    genericTable,
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

  await writeFile(path.join(reportsDir, "home-appliance-logistics-generic-review-latest.md"), `${md}\n`);
  console.log("wrote reports/home-appliance-logistics-generic-review-latest.json");
  console.log("wrote reports/home-appliance-logistics-generic-review-latest.md");
  console.log(`home appliance logistics/generic review: generic_rows=${genericRows.length}, logistics_examples=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
