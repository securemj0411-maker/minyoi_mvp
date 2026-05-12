import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ReportMetrics = Record<string, number>;
type ReportFile = {
  metrics: ReportMetrics;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const series10 = await readJson<ReportFile>("smartwatch-applewatch-series10-46mm-battery90plus-clean-personal-used-split-latest.json");
  const series9 = await readJson<ReportFile>("smartwatch-applewatch-series9-45mm-gps-battery90plus-condition-splits-latest.json");

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series10_46mm_vs_series9_45mm_battery90plus_cleanliness_report_only",
    metrics: {
      series10BaseRows: series10.metrics.baseRows ?? 0,
      series10CleanPersonalUsedRows: series10.metrics.cleanPersonalUsedRows ?? 0,
      series10BundleRows: series10.metrics.bundleRows ?? 0,
      series10CellularRows: series10.metrics.cellularRows ?? 0,
      series9BaseRows: series9.metrics.totalRows ?? 0,
      series9CleanPersonalUsedRows: series9.metrics.cleanPersonalUsedRows ?? 0,
      series9LightBundleRows: series9.metrics.lightBundleRows ?? 0,
      series9CellularConflictRows: series9.metrics.cellularConflictRows ?? 0,
      runtimeApprovedRows: 0,
    },
    policyImplications: [
      "This packet compares the newest clean Series10 battery90+ slice against the older Series9 battery90+ lane on the exact question we care about: clean personal-used density versus baggage.",
      "If Series10 keeps more clean personal-used rows than Series9 at similar tiny scale, it becomes the better next Apple Watch thickening candidate.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "thicken whichever lane keeps the better clean-to-baggage ratio without premium or connectivity drift",
      "keep both lanes narrow until density rises beyond singleton-style evidence",
    ],
    doNotDo: [
      "Do not treat this comparison as runtime approval",
      "Do not public-promote either lane from this packet alone",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series10-46mm-vs-series9-45mm-battery90plus-cleanliness-latest.json"),
    JSON.stringify(report, null, 2),
  );
  const md = [
    "# Smartwatch Apple Watch Series10 46mm vs Series9 45mm Battery90+ Cleanliness",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only direct comparison of the newest Series10 clean slice against the existing Series9 battery90+ lane.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
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
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series10-46mm-vs-series9-45mm-battery90plus-cleanliness-latest.md"),
    `${md}\n`,
  );
  console.log("wrote reports/smartwatch-applewatch-series10-46mm-vs-series9-45mm-battery90plus-cleanliness-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series10-46mm-vs-series9-45mm-battery90plus-cleanliness-latest.md");
  console.log(
    `series10 vs series9 cleanliness: series10_clean=${report.metrics.series10CleanPersonalUsedRows}, series9_clean=${report.metrics.series9CleanPersonalUsedRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
