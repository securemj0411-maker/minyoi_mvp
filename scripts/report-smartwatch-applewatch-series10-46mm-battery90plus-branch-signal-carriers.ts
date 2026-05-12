import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "applewatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

const globalExclude = /(삽니다|구매|매입|교환|부품용|고장|파손|수리|케이스만|보호필름|스트랩만|충전독|호환)/;
const battery90Pattern = /(배터리\s*(성능)?\s*(9\d|100)\s*%?|battery\s*(health)?\s*(9\d|100)\s*%?)/;
const carePattern = /(애플케어|애케플|케어플러스|보증기간|보증\s*잔여)/;
const bundlePattern = /(박스|풀박스|충전기|케이블|스트랩|밴드|루프|밀레니즈)/;
const titaniumPattern = /(티타늄)/;
const cellularPattern = /(gps\+?셀룰러|cellular|셀룰러|lte)/;
const gpsPattern = /(\bgps\b|블루투스|wifi|와이파이)/;

function titleFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function descriptionOnly(sample: Sample, pattern: RegExp): boolean {
  return !pattern.test(titleFor(sample)) && pattern.test(textFor(sample));
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];

  const baseRows = samples.filter((sample) => {
    const t = textFor(sample);
    return !globalExclude.test(t) &&
      /(series\s*10|시리즈\s*10|애플워치\s*10)/.test(t) &&
      (/\b46mm\b|46m\b/.test(t)) &&
      battery90Pattern.test(t);
  });

  const titleBatteryRows = baseRows.filter((row) => battery90Pattern.test(titleFor(row)));
  const descriptionOnlyBatteryRows = baseRows.filter((row) => descriptionOnly(row, battery90Pattern));
  const titleCareBranchRows = baseRows.filter((row) => carePattern.test(titleFor(row)));
  const descriptionOnlyCareBranchRows = baseRows.filter((row) => descriptionOnly(row, carePattern));
  const titleCellularPremiumRows = baseRows.filter((row) => cellularPattern.test(titleFor(row)) || titaniumPattern.test(titleFor(row)) || bundlePattern.test(titleFor(row)));
  const descriptionOnlyCellularPremiumRows = baseRows.filter((row) =>
    !titleCellularPremiumRows.includes(row) && (cellularPattern.test(textFor(row)) || titaniumPattern.test(textFor(row)) || bundlePattern.test(textFor(row))),
  );
  const titlePlainBranchRows = baseRows.filter((row) => {
    const title = titleFor(row);
    return !carePattern.test(title) && !cellularPattern.test(title) && !bundlePattern.test(title) && !titaniumPattern.test(title);
  });
  const descriptionOnlyGpsRows = baseRows.filter((row) => descriptionOnly(row, gpsPattern));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series10_46mm_battery90plus_branch_signal_carriers_report_only",
    metrics: {
      baseRows: baseRows.length,
      titleBatteryRows: titleBatteryRows.length,
      descriptionOnlyBatteryRows: descriptionOnlyBatteryRows.length,
      titlePlainBranchRows: titlePlainBranchRows.length,
      titleCareBranchRows: titleCareBranchRows.length,
      descriptionOnlyCareBranchRows: descriptionOnlyCareBranchRows.length,
      titleCellularPremiumRows: titleCellularPremiumRows.length,
      descriptionOnlyCellularPremiumRows: descriptionOnlyCellularPremiumRows.length,
      descriptionOnlyGpsRows: descriptionOnlyGpsRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: {
      titlePlainBranch: titlePlainBranchRows.map((row) => row.pid ?? "-"),
      descriptionOnlyCare: descriptionOnlyCareBranchRows.map((row) => row.pid ?? "-"),
      titleCellularPremium: titleCellularPremiumRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet checks whether the tiny Series10 46mm battery90+ branches are title-carried or only recoverable from descriptions.",
      "If the clean branch stays title-visible while care-backed or GPS details stay description-carried, parser hint work should prioritize description support without over-trusting the premium branch.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "watch whether future Series10 46mm rows surface battery and GPS context in titles rather than only description text",
      "keep the plain branch separate from care-backed and cellular-premium rows when turning guide hints into parser hints",
    ],
    doNotDo: [
      "Do not assume title-visible Series10 rows are automatically clean",
      "Do not collapse description-only care or GPS wording into the same confidence bucket as title-carried clean rows",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series10-46mm-battery90plus-branch-signal-carriers-latest.json"),
    JSON.stringify(report, null, 2),
  );

  const md = [
    "# Smartwatch Apple Watch Series10 46mm Battery90+ Branch Signal Carriers",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only signal-carrier split for the Series10 46mm battery90+ branches.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Sample PIDs",
    "",
    ...Object.entries(report.samplePids).map(([k, v]) => `- ${k}: ${(v as Array<string | number>).join(", ") || "-"}`),
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
    path.join(reportsDir, "smartwatch-applewatch-series10-46mm-battery90plus-branch-signal-carriers-latest.md"),
    `${md}\n`,
  );

  console.log("wrote reports/smartwatch-applewatch-series10-46mm-battery90plus-branch-signal-carriers-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series10-46mm-battery90plus-branch-signal-carriers-latest.md");
  console.log(
    `series10 46mm branch signal carriers: title_plain=${report.metrics.titlePlainBranchRows}, desc_only_care=${report.metrics.descriptionOnlyCareBranchRows}, title_cellular_premium=${report.metrics.titleCellularPremiumRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
