import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type HeadphoneReport = {
  category: string;
  total: number;
  normal: number;
  normalRate: number;
  normalWithSku: number;
  parserReadyRate: number;
  needsReviewRate: number;
  airpodsMax: number;
  airpodsMaxReadyRate: number;
  airpodsMaxUnknownGenerationRate: number;
  airpodsMaxUnknownConnectorRate: number;
  nonProductSuspect: number;
  gateCounts: CountRow[];
  skuCounts: CountRow[];
  topComparableKeys: CountRow[];
  airpodsMaxGenerationCounts: CountRow[];
  airpodsMaxConnectorCounts: CountRow[];
  unknownGenerationExamples: Array<Record<string, unknown>>;
  unknownConnectorExamples: Array<Record<string, unknown>>;
  unknownSkuExamples: Array<Record<string, unknown>>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const headphone = JSON.parse(await readFile(path.join(reportsDir, "headphone-parser-latest.json"), "utf8")) as HeadphoneReport;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: headphone.category,
    decision: "parser_candidate_internal_only",
    whyCandidateIsLimited: [
      `parserReadyRate=${headphone.parserReadyRate}% applies only to matched known-SKU rows`,
      `AirPods Max unknown generation=${headphone.airpodsMaxUnknownGenerationRate}% remains review-gated`,
      `AirPods Max unknown connector=${headphone.airpodsMaxUnknownConnectorRate}% remains review-gated`,
      "broad wireless headphone rows without known SKU/model key are excluded",
    ],
    currentMetrics: {
      total: headphone.total,
      normal: headphone.normal,
      normalRate: headphone.normalRate,
      normalWithSku: headphone.normalWithSku,
      parserReadyRate: headphone.parserReadyRate,
      needsReviewRate: headphone.needsReviewRate,
      airpodsMax: headphone.airpodsMax,
      airpodsMaxReadyRate: headphone.airpodsMaxReadyRate,
      airpodsMaxUnknownGenerationRate: headphone.airpodsMaxUnknownGenerationRate,
      airpodsMaxUnknownConnectorRate: headphone.airpodsMaxUnknownConnectorRate,
      nonProductSuspect: headphone.nonProductSuspect,
      gateCounts: headphone.gateCounts,
      skuCounts: headphone.skuCounts,
      topComparableKeys: headphone.topComparableKeys,
      airpodsMaxGenerationCounts: headphone.airpodsMaxGenerationCounts,
      airpodsMaxConnectorCounts: headphone.airpodsMaxConnectorCounts,
    },
    candidateInternalOnly: [
      "known matched headphone SKU rows",
      "AirPods Max with connector/generation resolved",
      "Sony WH/Bose QC/Beats/Sennheiser explicit known-model rows",
      "normal rows after merch/case/cushion/stand/damaged/counterfeit gates",
    ],
    mustHold: [
      "AirPods Max unknown connector/generation rows",
      "AirPods Max color/connector conflict rows",
      "purchase-year-only AirPods Max rows",
      "case/cushion/pad/stand/accessory-only rows",
      "broad wireless headphone rows without known SKU/model key",
      "counterfeit/damaged/buying/commercial rows",
    ],
    requiredBeforeAnyMainReview: [
      "AirPods Max Lightning vs USB-C key tests",
      "merch/photo-card exclusion tests",
      "case/cushion/stand-only exclusion tests",
      "unknown connector/generation review gate tests",
    ],
    unknownGenerationExamples: headphone.unknownGenerationExamples,
    unknownConnectorExamples: headphone.unknownConnectorExamples,
    unknownSkuExamples: headphone.unknownSkuExamples?.slice(0, 10) ?? [],
    doNotDo: [
      "Do not promote whole headphone_discovered category",
      "Do not wire matched-SKU policy into candidate pool",
      "Do not merge AirPods Max Lightning and USB-C",
      "Do not infer generation from purchase year alone",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-matched-sku-blockers-latest.json"), JSON.stringify(report, null, 2));

  const metricRows = Object.entries(report.currentMetrics)
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n");

  const md = [
    "# Headphone Matched-SKU Blockers",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only headphone matched-SKU diagnosis. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "headphone-matched-sku-blockers-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-matched-sku-blockers-latest.json");
  console.log("wrote reports/headphone-matched-sku-blockers-latest.md");
  console.log(`headphone matched-SKU blockers: parser_ready=${headphone.parserReadyRate}%, max_unknown_gen=${headphone.airpodsMaxUnknownGenerationRate}%, max_unknown_connector=${headphone.airpodsMaxUnknownConnectorRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
