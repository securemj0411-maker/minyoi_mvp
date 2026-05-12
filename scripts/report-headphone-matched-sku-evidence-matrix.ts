import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };
type ExampleRow = {
  pid?: string;
  title?: string;
  price?: number;
  url?: string;
  comparableKey?: string;
  connector?: string;
  generation?: string;
  gate?: string;
};

type HeadphoneBlockers = {
  category: string;
  currentMetrics: {
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
    gateCounts: CountRow[];
    skuCounts: CountRow[];
    topComparableKeys: CountRow[];
    airpodsMaxGenerationCounts: CountRow[];
    airpodsMaxConnectorCounts: CountRow[];
  };
  unknownGenerationExamples: ExampleRow[];
  unknownConnectorExamples: ExampleRow[];
  unknownSkuExamples: ExampleRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function exampleClass(row: ExampleRow): string {
  if (row.gate === "unknown") return "unknown_sku_hold_evidence";
  if (row.connector === "unknown_connector") return "airpods_max_unknown_connector_review_gate";
  if (row.generation === "unknown_generation") return "airpods_max_unknown_generation_review_gate";
  return "matched_sku_review_evidence";
}

function dedupeExamples(rows: ExampleRow[]): ExampleRow[] {
  const seen = new Set<string>();
  const result: ExampleRow[] = [];
  for (const row of rows) {
    const key = row.pid ?? `${row.title}-${row.comparableKey}-${row.gate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

async function main(): Promise<void> {
  const blockers = JSON.parse(
    await readFile(path.join(reportsDir, "headphone-matched-sku-blockers-latest.json"), "utf8"),
  ) as HeadphoneBlockers;

  const examples = dedupeExamples([
    ...blockers.unknownGenerationExamples,
    ...blockers.unknownConnectorExamples,
    ...blockers.unknownSkuExamples,
  ]).map((row) => ({
    ...row,
    evidenceClass: exampleClass(row),
    runtimeApproved: false,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: blockers.category,
    decision: "headphone_matched_sku_evidence_report_only",
    sourceReports: ["headphone-matched-sku-blockers-latest.json", "headphone-parser-latest.json"],
    metrics: {
      total: blockers.currentMetrics.total,
      normal: blockers.currentMetrics.normal,
      normalRate: blockers.currentMetrics.normalRate,
      normalWithSku: blockers.currentMetrics.normalWithSku,
      parserReadyRate: blockers.currentMetrics.parserReadyRate,
      needsReviewRate: blockers.currentMetrics.needsReviewRate,
      airpodsMax: blockers.currentMetrics.airpodsMax,
      airpodsMaxReadyRate: blockers.currentMetrics.airpodsMaxReadyRate,
      airpodsMaxUnknownGenerationRate: blockers.currentMetrics.airpodsMaxUnknownGenerationRate,
      airpodsMaxUnknownConnectorRate: blockers.currentMetrics.airpodsMaxUnknownConnectorRate,
      reviewExampleRows: examples.length,
      unknownSkuExampleRows: examples.filter((row) => row.evidenceClass === "unknown_sku_hold_evidence").length,
      runtimeApprovedRows: examples.filter((row) => row.runtimeApproved).length,
      airpodsMaxGenerationCounts: blockers.currentMetrics.airpodsMaxGenerationCounts,
      airpodsMaxConnectorCounts: blockers.currentMetrics.airpodsMaxConnectorCounts,
      topComparableKeys: blockers.currentMetrics.topComparableKeys.slice(0, 10),
    },
    examples,
    policyImplications: [
      "Matched headphone SKUs are useful internal evidence but not public approval.",
      "AirPods Max unknown generation and unknown connector rows remain review-gated.",
      "Broad unknown headphone rows remain hold-only without known SKU/model key.",
      "No matched-SKU policy or candidate pool wiring is approved here.",
    ],
    nextReportOnlyExperiments: [
      "split AirPods Max unknown connector examples by title token evidence",
      "separate unknown SKU examples into brand families if source volume increases",
      "keep Lightning and USB-C AirPods Max keys separate",
    ],
    doNotDo: [
      "Do not promote whole headphone_discovered category",
      "Do not wire matched-SKU policy into candidate pool",
      "Do not merge AirPods Max Lightning and USB-C",
      "Do not infer generation from purchase year alone",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-matched-sku-evidence-matrix-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | evidence_class | connector | generation | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- |",
    ...examples.map((row) => `| ${row.pid ?? "-"} | ${row.evidenceClass} | ${row.connector ?? "-"} | ${row.generation ?? "-"} | ${row.runtimeApproved ? "yes" : "no"} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Headphone Matched-SKU Evidence Matrix",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only headphone matched-SKU evidence matrix. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "headphone-matched-sku-evidence-matrix-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-matched-sku-evidence-matrix-latest.json");
  console.log("wrote reports/headphone-matched-sku-evidence-matrix-latest.md");
  console.log(
    `headphone matched-SKU evidence matrix: review_examples=${examples.length}, unknown_sku=${report.metrics.unknownSkuExampleRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
