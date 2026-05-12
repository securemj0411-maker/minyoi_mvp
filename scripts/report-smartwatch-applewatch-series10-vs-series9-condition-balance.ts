import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ConditionSplitReport = {
  metrics?: Record<string, number>;
  laneSamples?: Record<string, Array<string | number>>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const series10 = await readJson<ConditionSplitReport>("smartwatch-applewatch-series10-titanium-condition-splits-latest.json");
  const series9 = await readJson<ConditionSplitReport>("smartwatch-applewatch-series9-45mm-gps-battery90plus-condition-splits-latest.json");

  const m10 = series10.metrics ?? {};
  const m9 = series9.metrics ?? {};

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series10_vs_series9_condition_balance_report_only",
    metrics: {
      series10TotalRows: Number(m10.totalRows ?? 0),
      series9TotalRows: Number(m9.totalRows ?? 0),
      series10CleanPersonalUsedRows: Number(m10.cleanPersonalUsedRows ?? 0),
      series9CleanPersonalUsedRows: Number(m9.cleanPersonalUsedRows ?? 0),
      series10MerchantLikeRows: Number(m10.merchantLikeRows ?? 0),
      series9MerchantLikeRows: Number(m9.merchantLikeRows ?? 0),
      series10UnopenedLikeRows: Number(m10.unopenedLikeRows ?? 0),
      series9UnopenedLikeRows: Number(m9.unopenedLikeRows ?? 0),
      series10HeavyBundleRows: Number(m10.heavyBundleRows ?? 0),
      series9HeavyBundleRows: Number(m9.heavyBundleRows ?? 0),
      runtimeApprovedRows: 0,
    },
    sampleSlices: {
      series10CleanPersonal: series10.laneSamples?.cleanPersonalUsedPids ?? [],
      series9CleanPersonal: series9.laneSamples?.cleanPersonalUsedPids ?? [],
    },
    policyImplications: [
      "This packet puts Series10 titanium and Series9 45mm GPS battery90+ on the same condition/bundle axes so the next thickening choice is based on clean-lane quality, not just row count.",
      "If Series9 keeps the only clean personal-used support while Series10 stays premium-heavy, Series9 should remain the healthier next Apple Watch thickening target.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "thicken Series9 clean personal-used density before considering any runtime-facing confidence change",
      "keep watching whether Series10 ever produces clean personal-used rows instead of only premium context density",
    ],
    doNotDo: [
      "Do not prefer Series10 just because it has more rows",
      "Do not treat this comparison as runtime approval for Series9 either; both lanes remain report-only",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series10-vs-series9-condition-balance-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series10 vs Series9 Condition Balance",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only condition/bundle balance comparison between Series10 titanium and Series9 45mm GPS battery90+.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Clean Personal Sample Slices",
    "",
    `- series10CleanPersonal: ${report.sampleSlices.series10CleanPersonal.join(", ") || "-"}`,
    `- series9CleanPersonal: ${report.sampleSlices.series9CleanPersonal.join(", ") || "-"}`,
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series10-vs-series9-condition-balance-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series10-vs-series9-condition-balance-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series10-vs-series9-condition-balance-latest.md");
  console.log(`applewatch s10 vs s9 condition balance: s10_clean=${report.metrics.series10CleanPersonalUsedRows}, s9_clean=${report.metrics.series9CleanPersonalUsedRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
