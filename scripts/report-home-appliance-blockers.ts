import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type HomeReport = {
  category: string;
  total: number;
  normal: number;
  modelReadyRate: number;
  genericRate: number;
  gateCounts: CountRow[];
  keyCounts: CountRow[];
  examples: Array<{ pid?: string; title?: string; price?: number; key?: string }>;
};

const reportsDir = path.join(process.cwd(), "reports");

function subtypeFromKey(key: string): string {
  if (key.includes("robot-vacuum")) return "robot_vacuum";
  if (key.includes("vacuum")) return "vacuum";
  if (key.includes("washer") || key.includes("dryer")) return "laundry";
  if (key.includes("air") || key.includes("humidifier")) return "air_care";
  return "other_or_generic";
}

async function main(): Promise<void> {
  const home = JSON.parse(await readFile(path.join(reportsDir, "home-appliance-parser-latest.json"), "utf8")) as HomeReport;
  const subtypeCounts = new Map<string, number>();
  for (const row of home.keyCounts) subtypeCounts.set(subtypeFromKey(row.key), (subtypeCounts.get(subtypeFromKey(row.key)) ?? 0) + row.count);
  const subtypeRows = [...subtypeCounts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: home.category,
    decision: "hold_report_only",
    whyHold: [
      `modelReadyRate=${home.modelReadyRate}% is too low for candidate policy`,
      `genericRate=${home.genericRate}% dominates current normal rows`,
      "generic vacuum/appliance keys do not preserve comparable model identity",
      "bulky/logistics-risk appliance rows need separate handling before any policy review",
    ],
    currentMetrics: {
      total: home.total,
      normal: home.normal,
      modelReadyRate: home.modelReadyRate,
      genericRate: home.genericRate,
      gateCounts: home.gateCounts,
      topKeyCounts: home.keyCounts.slice(0, 20),
      subtypeRows,
    },
    splitAxes: [
      {
        axis: "robot_vacuum",
        requiredBeforeDraft: ["brand + model code", "dock/base station presence", "battery/consumable condition", "logistics risk"],
      },
      {
        axis: "stick_or_handheld_vacuum",
        requiredBeforeDraft: ["brand + model code", "battery state", "charger/accessory-only exclusion", "head/tool bundle clarity"],
      },
      {
        axis: "bedding_cleaner",
        requiredBeforeDraft: ["brand + model code", "not generic 침구청소기", "filter/consumable condition"],
      },
      {
        axis: "bulky_appliance",
        requiredBeforeDraft: ["pickup/delivery feasibility", "installation/removal risk", "model code", "commercial/bulk exclusion"],
      },
    ],
    genericExamples: home.examples.slice(0, 20),
    nextReportOnlyExperiments: [
      "split robot vacuum rows from generic vacuum rows",
      "rank model-coded appliance rows by subtype",
      "produce logistics-risk examples for future exclusion tests",
    ],
    doNotDo: [
      "Do not promote home_appliance_tech_discovered",
      "Do not use generic vacuum/appliance keys for candidate pool",
      "Do not ignore logistics risk for bulky appliances",
      "Do not wire subtype axes into runtime",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "home-appliance-blockers-latest.json"), JSON.stringify(report, null, 2));

  const splitTable = [
    "| axis | required_before_draft |",
    "| --- | --- |",
    ...report.splitAxes.map((row) => `| ${row.axis} | ${row.requiredBeforeDraft.map((item) => `- ${item}`).join("<br>")} |`),
  ].join("\n");

  const md = [
    "# Home Appliance Blockers",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only home appliance diagnosis. This is not runtime wiring and not public promotion.",
    "",
    "## Why Hold",
    "",
    ...report.whyHold.map((line) => `- ${line}`),
    "",
    "## Split Axes",
    "",
    splitTable,
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "home-appliance-blockers-latest.md"), `${md}\n`);
  console.log("wrote reports/home-appliance-blockers-latest.json");
  console.log("wrote reports/home-appliance-blockers-latest.md");
  console.log(`home appliance blockers: generic=${home.genericRate}%, model_ready=${home.modelReadyRate}%, subtypes=${subtypeRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
