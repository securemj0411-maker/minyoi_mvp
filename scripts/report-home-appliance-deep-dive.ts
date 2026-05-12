import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type HomeExample = {
  pid?: string;
  title?: string;
  price?: number;
  key?: string;
};

type HomeReport = {
  category: string;
  modelReadyRate: number;
  genericRate: number;
  gateCounts: CountRow[];
  keyCounts: CountRow[];
  examples: HomeExample[];
};

const reportsDir = path.join(process.cwd(), "reports");

function subtypeFromKey(key: string): string {
  if (key.includes("robot") || key === "clean-r9") return "robot_vacuum";
  if (key.includes("vacuum") || key.includes("codezero") || key.includes("dyson") || key.includes("bespoke-jet")) return "stick_or_handheld_vacuum";
  if (key.includes("coffee") || key.includes("dolce-gusto")) return "coffee_machine";
  if (key.includes("air-fryer")) return "air_fryer";
  if (key.includes("beauty")) return "beauty_device";
  return "other_or_generic";
}

function exampleClass(example: HomeExample): string {
  const key = example.key ?? "";
  const title = example.title ?? "";
  if (/충전기|어댑터|필터|소모품|부품/i.test(title)) return "accessory_or_parts_risk";
  if (key === "robot-vacuum-generic") return "robot_vacuum_generic";
  if (key === "vacuum-generic" && /침구/i.test(title)) return "bedding_cleaner_generic";
  if (key === "vacuum-generic") return "stick_or_handheld_vacuum_generic";
  return "other_generic";
}

function countBy<T extends string>(items: T[]): Array<{ key: T; count: number }> {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const home = JSON.parse(await readFile(path.join(reportsDir, "home-appliance-parser-latest.json"), "utf8")) as HomeReport;
  const modelReadyRows = home.keyCounts.filter((row) => !row.key.endsWith("-generic"));
  const genericExamples = home.examples.filter((example) => example.key?.endsWith("-generic"));
  const genericClassCounts = countBy(genericExamples.map(exampleClass));
  const logisticsRiskCount = home.gateCounts.find((row) => row.key === "logistics_risk")?.count ?? 0;

  const modelRowsBySubtype = modelReadyRows.map((row) => ({
    key: row.key,
    count: row.count,
    subtype: subtypeFromKey(row.key),
    status:
      subtypeFromKey(row.key) === "robot_vacuum" || subtypeFromKey(row.key) === "stick_or_handheld_vacuum"
        ? "report_only_model_ready_subset"
        : "hold_other_appliance_subtype",
  }));

  const subtypeCounts = countBy(modelRowsBySubtype.map((row) => row.subtype));

  const examplesByClass = genericExamples.reduce<Record<string, HomeExample[]>>((acc, example) => {
    const key = exampleClass(example);
    acc[key] = acc[key] ?? [];
    if (acc[key].length < 8) acc[key].push(example);
    return acc;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: home.category,
    decision: "hold_report_only",
    sourceReports: ["home-appliance-parser-latest.json", "home-appliance-blockers-latest.json"],
    metrics: {
      modelReadyRate: home.modelReadyRate,
      genericRate: home.genericRate,
      logisticsRiskCount,
      modelReadyRows: modelReadyRows.length,
      genericExamples: genericExamples.length,
      genericClassCounts,
      modelSubtypeCounts: subtypeCounts,
    },
    modelRowsBySubtype,
    examplesByClass,
    policyImplications: [
      "Robot vacuum rows are visible, but generic robot-vacuum titles still need brand/model/dock separation before candidate review.",
      "Stick/handheld vacuum has a small model-ready subset, but generic rows include accessory/parts and bedding-cleaner contamination.",
      "logistics_risk exists in gate counts, but this parser report does not yet expose row-level logistics examples for review.",
      "Generic appliance keys remain hold-only and must not become comparable candidate keys.",
    ],
    nextReportOnlyExperiments: [
      "export row-level logistics_risk examples in a report-only script",
      "split vacuum-generic into stick/handheld, bedding cleaner, and accessory/parts classes",
      "draft model-ready vacuum subset conditions without runtime apply or candidate pool wiring",
    ],
    doNotDo: [
      "Do not promote home_appliance_tech_discovered",
      "Do not use generic vacuum/appliance keys for candidate pool",
      "Do not wire robot vacuum or vacuum subtype axes into runtime",
      "Do not mutate production DB or Supabase schema",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "home-appliance-deep-dive-latest.json"), JSON.stringify(report, null, 2));

  const modelTable = [
    "| key | count | subtype | status |",
    "| --- | ---: | --- | --- |",
    ...modelRowsBySubtype.map((row) => `| ${row.key} | ${row.count} | ${row.subtype} | ${row.status} |`),
  ].join("\n");

  const genericTable = [
    "| generic_class | count |",
    "| --- | ---: |",
    ...genericClassCounts.map((row) => `| ${row.key} | ${row.count} |`),
  ].join("\n");

  const md = [
    "# Home Appliance Deep Dive",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only home appliance robot/generic/model-ready split. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- modelReadyRate: ${report.metrics.modelReadyRate}%`,
    `- genericRate: ${report.metrics.genericRate}%`,
    `- logisticsRiskCount: ${report.metrics.logisticsRiskCount}`,
    `- modelReadyRows: ${report.metrics.modelReadyRows}`,
    `- genericExamples: ${report.metrics.genericExamples}`,
    "",
    "## Model Rows By Subtype",
    "",
    modelTable,
    "",
    "## Generic Example Classes",
    "",
    genericTable,
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

  await writeFile(path.join(reportsDir, "home-appliance-deep-dive-latest.md"), `${md}\n`);
  console.log("wrote reports/home-appliance-deep-dive-latest.json");
  console.log("wrote reports/home-appliance-deep-dive-latest.md");
  console.log(`home appliance deep dive: model_rows=${modelReadyRows.length}, generic_classes=${genericClassCounts.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
