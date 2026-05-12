import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type EarphoneReport = {
  category: string;
  total: number;
  normal: number;
  normalRate: number;
  normalWithSku: number;
  normalWithSkuRate: number;
  parserReadyRate: number;
  needsReviewRate: number;
  airpodsNormal: number;
  nonAirpodsNormal: number;
  nonAirpodsNormalRate: number;
  gateCounts: CountRow[];
  skuCounts: CountRow[];
  keyCounts: CountRow[];
  connectorCounts: CountRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const earphone = JSON.parse(await readFile(path.join(reportsDir, "earphone-parser-latest.json"), "utf8")) as EarphoneReport;
  const nonNormal = earphone.total - earphone.normal;
  const nonNormalRate = Number(((nonNormal / earphone.total) * 100).toFixed(1));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: earphone.category,
    decision: "parser_candidate_internal_only",
    whyCandidateIsLimited: [
      `parserReadyRate=${earphone.parserReadyRate}% only applies to AirPods matched rows`,
      `normalRate=${earphone.normalRate}% means most samples remain parts/unknown/buying/callout/damaged`,
      `nonAirpodsNormalRate=${earphone.nonAirpodsNormalRate}% in current sample does not mean non-AirPods are covered`,
      "QCY/Tone Free/Beats/Buds/generic earphones remain approval-only",
    ],
    currentMetrics: {
      total: earphone.total,
      normal: earphone.normal,
      normalRate: earphone.normalRate,
      nonNormal,
      nonNormalRate,
      normalWithSku: earphone.normalWithSku,
      normalWithSkuRate: earphone.normalWithSkuRate,
      parserReadyRate: earphone.parserReadyRate,
      needsReviewRate: earphone.needsReviewRate,
      airpodsNormal: earphone.airpodsNormal,
      nonAirpodsNormal: earphone.nonAirpodsNormal,
      nonAirpodsNormalRate: earphone.nonAirpodsNormalRate,
      gateCounts: earphone.gateCounts,
      skuCounts: earphone.skuCounts,
      keyCounts: earphone.keyCounts,
      connectorCounts: earphone.connectorCounts,
    },
    candidateInternalOnly: [
      "AirPods full product rows with scoped SKU",
      "AirPods Pro 2 connector split rows",
      "AirPods 4 ANC/no-ANC split rows",
      "normal rows after side-only/case-only/accessory/damaged/buying gates",
    ],
    mustHold: [
      "QCY/Tone Free/Beats/Buds/generic earphone rows",
      "left/right side-only rows",
      "charging case-only rows",
      "accessory-only rows",
      "counterfeit/damaged/buying/commercial rows",
      "AirPods Pro 3/4 wording until explicit future catalog exists",
    ],
    requiredBeforeAnyMainReview: [
      "side-only and case-only exclusion tests",
      "AirPods Pro 2 Lightning vs USB-C connector tests",
      "AirPods 4 ANC/no-ANC tests",
      "non-AirPods remain approval-only in reports",
    ],
    doNotDo: [
      "Do not promote whole earphone_discovered category",
      "Do not wire AirPods policy into candidate pool",
      "Do not expand to non-AirPods from this sample",
      "Do not loosen side-only/case-only gates for volume",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "earphone-airpods-blockers-latest.json"), JSON.stringify(report, null, 2));

  const metricRows = Object.entries(report.currentMetrics)
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n");

  const md = [
    "# Earphone AirPods Blockers",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only AirPods-focused diagnosis. This is not runtime wiring and not public promotion.",
    "",
    "## Why Candidate Is Limited",
    "",
    ...report.whyCandidateIsLimited.map((line) => `- ${line}`),
    "",
    "## Metrics",
    "",
    "| metric | value |",
    "| --- | --- |",
    metricRows,
    "",
    "## Candidate Internal Only",
    "",
    ...report.candidateInternalOnly.map((line) => `- ${line}`),
    "",
    "## Must Hold",
    "",
    ...report.mustHold.map((line) => `- ${line}`),
    "",
    "## Required Before Any Main Review",
    "",
    ...report.requiredBeforeAnyMainReview.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "earphone-airpods-blockers-latest.md"), `${md}\n`);
  console.log("wrote reports/earphone-airpods-blockers-latest.json");
  console.log("wrote reports/earphone-airpods-blockers-latest.md");
  console.log(`earphone AirPods blockers: parser_ready=${earphone.parserReadyRate}%, normal=${earphone.normalRate}%, non_airpods=${earphone.nonAirpodsNormalRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
