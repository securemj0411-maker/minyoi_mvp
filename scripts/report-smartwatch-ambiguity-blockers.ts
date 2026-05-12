import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type SmartwatchReport = {
  category: string;
  total: number;
  normal: number;
  normalWithSku: number;
  parserReadyRate: number;
  needsReviewRate: number;
  lowBatteryNormalRate: number;
  strapSuspect: number;
  gateCounts: CountRow[];
  skuCounts: CountRow[];
  sizeCounts: CountRow[];
  networkCounts: CountRow[];
  examples: Array<{ pid?: string; title?: string; price?: number; reason?: string }>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const watch = JSON.parse(await readFile(path.join(reportsDir, "smartwatch-parser-latest.json"), "utf8")) as SmartwatchReport;
  const unknownNetwork = watch.networkCounts.find((row) => row.key === "unknown")?.count ?? 0;
  const totalNetwork = watch.networkCounts.reduce((sum, row) => sum + row.count, 0);
  const unknownNetworkRate = totalNetwork === 0 ? 0 : Number(((unknownNetwork / totalNetwork) * 100).toFixed(1));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: watch.category,
    decision: "hold_report_only",
    whyHoldDespiteParserReady: [
      `parserReadyRate=${watch.parserReadyRate}% applies only to matched normal rows in report-only mode`,
      `strapSuspect=${watch.strapSuspect} rows still show accessory contamination pressure`,
      `unknownNetworkRate=${unknownNetworkRate}% blocks cellular/GPS comparable split`,
      "Apple Watch SE generation ambiguity remains review-heavy",
    ],
    currentMetrics: {
      total: watch.total,
      normal: watch.normal,
      normalWithSku: watch.normalWithSku,
      parserReadyRate: watch.parserReadyRate,
      needsReviewRate: watch.needsReviewRate,
      lowBatteryNormalRate: watch.lowBatteryNormalRate,
      strapSuspect: watch.strapSuspect,
      unknownNetworkRate,
      gateCounts: watch.gateCounts,
      skuCounts: watch.skuCounts,
      sizeCounts: watch.sizeCounts,
      networkCounts: watch.networkCounts,
    },
    ambiguityAxes: [
      {
        axis: "se_generation",
        requiredBeforeDraft: ["explicit SE 1/2/3 generation", "case size", "not inferred from price only"],
      },
      {
        axis: "network",
        requiredBeforeDraft: ["GPS vs cellular signal", "network unknown review gate", "carrier/eSIM wording handling"],
      },
      {
        axis: "strap_accessory",
        requiredBeforeDraft: ["watch body signal", "strap/accessory-only exclusion", "parts/damaged gate"],
      },
      {
        axis: "battery_health",
        requiredBeforeDraft: ["battery health threshold", "low battery hold", "repair/parts exclusion"],
      },
    ],
    reviewExamples: watch.examples,
    nextReportOnlyExperiments: [
      "produce Apple Watch SE generation ambiguity examples",
      "rank unknown network rows by SKU and size",
      "separate strap/accessory suspects from normal rows",
    ],
    doNotDo: [
      "Do not copy operating-map smartwatch ready status to smartwatch_discovered",
      "Do not promote smartwatch_discovered",
      "Do not approve strap/accessory rows",
      "Do not infer SE generation without explicit text",
      "Do not wire network-unknown rows into candidate pool",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-ambiguity-blockers-latest.json"), JSON.stringify(report, null, 2));

  const axisTable = [
    "| axis | required_before_draft |",
    "| --- | --- |",
    ...report.ambiguityAxes.map((row) => `| ${row.axis} | ${row.requiredBeforeDraft.map((item) => `- ${item}`).join("<br>")} |`),
  ].join("\n");

  const md = [
    "# Smartwatch Ambiguity Blockers",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only smartwatch ambiguity diagnosis. This is not runtime wiring and not public promotion.",
    "",
    "## Why Hold Despite Parser Ready",
    "",
    ...report.whyHoldDespiteParserReady.map((line) => `- ${line}`),
    "",
    "## Ambiguity Axes",
    "",
    axisTable,
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "smartwatch-ambiguity-blockers-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-ambiguity-blockers-latest.json");
  console.log("wrote reports/smartwatch-ambiguity-blockers-latest.md");
  console.log(`smartwatch blockers: parser_ready=${watch.parserReadyRate}%, strap_suspect=${watch.strapSuspect}, unknown_network=${unknownNetworkRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
