import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type SmartwatchParserReport = {
  category: string;
  total: number;
  normal: number;
  parserReadyRate: number;
  needsReviewRate: number;
  strapSuspect: number;
  keyCounts: CountRow[];
  sizeCounts: CountRow[];
  networkCounts: CountRow[];
};

type KeyEvidenceRow = {
  comparableKey: string;
  count: number;
  family: string;
  model: string;
  size: string;
  connectivity: string;
  evidenceClass: string;
  reportOnlyAction: string;
  runtimeApproved: false;
};

const reportsDir = path.join(process.cwd(), "reports");

function splitKey(row: CountRow): KeyEvidenceRow {
  const [family = "unknown_family", model = "unknown_model", size = "unknown_size", connectivity = "unknown_connectivity"] = row.key.split("|");
  const unknownSize = size === "unknown_size";
  const unknownConnectivity = connectivity === "unknown_connectivity";
  const evidenceClass = unknownSize && unknownConnectivity
    ? "unknown_size_and_connectivity_review_gate"
    : unknownConnectivity
      ? "unknown_connectivity_review_gate"
      : unknownSize
        ? "unknown_size_review_gate"
        : "resolved_size_connectivity_reference_only";

  return {
    comparableKey: row.key,
    count: row.count,
    family,
    model,
    size,
    connectivity,
    evidenceClass,
    reportOnlyAction:
      evidenceClass === "resolved_size_connectivity_reference_only"
        ? "reference only; not public approval"
        : "keep review-gated until explicit size/connectivity evidence is confirmed",
    runtimeApproved: false,
  };
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const parser = JSON.parse(await readFile(path.join(reportsDir, "smartwatch-parser-latest.json"), "utf8")) as SmartwatchParserReport;
  const keyRows = parser.keyCounts.map(splitKey);
  const unknownConnectivityRows = keyRows.filter((row) => row.connectivity === "unknown_connectivity");
  const unknownSizeRows = keyRows.filter((row) => row.size === "unknown_size");
  const unknownConnectivityUnits = unknownConnectivityRows.reduce((sum, row) => sum + row.count, 0);
  const unknownSizeUnits = unknownSizeRows.reduce((sum, row) => sum + row.count, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: parser.category,
    decision: "smartwatch_connectivity_size_evidence_report_only",
    sourceReports: ["smartwatch-parser-latest.json", "smartwatch-ambiguity-evidence-matrix-latest.json"],
    metrics: {
      normalRows: parser.normal,
      parserReadyRate: parser.parserReadyRate,
      needsReviewRate: parser.needsReviewRate,
      strapSuspectRows: parser.strapSuspect,
      keyRows: keyRows.length,
      unknownConnectivityKeyRows: unknownConnectivityRows.length,
      unknownConnectivityUnits,
      unknownSizeKeyRows: unknownSizeRows.length,
      unknownSizeUnits,
      runtimeApprovedRows: keyRows.filter((row) => row.runtimeApproved).length,
      evidenceClassCounts: countBy(keyRows.map((row) => row.evidenceClass)),
      modelCounts: countBy(keyRows.flatMap((row) => Array(row.count).fill(row.model) as string[])),
      connectivityCountsFromKeys: countBy(keyRows.flatMap((row) => Array(row.count).fill(row.connectivity) as string[])),
    },
    keyRows,
    policyImplications: [
      "Unknown connectivity in comparable keys remains review-gated and must not be candidate-pool wired.",
      "Unknown size rows remain separate from resolved size/connectivity references.",
      "Resolved key rows are reference evidence only, not public promotion.",
      "Strap/accessory pressure remains outside smartwatch body readiness.",
    ],
    nextReportOnlyExperiments: [
      "use unknown connectivity rows as review evidence before any GPS/cellular split",
      "keep SE generation review rows separate from connectivity evidence",
      "do not infer connectivity from price or family alone",
    ],
    doNotDo: [
      "Do not promote smartwatch_discovered",
      "Do not approve strap/accessory rows",
      "Do not infer connectivity without explicit text",
      "Do not wire unknown connectivity rows into candidate pool",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-connectivity-size-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| comparable_key | count | size | connectivity | evidence_class | runtime_approved |",
    "| --- | ---: | --- | --- | --- | --- |",
    ...keyRows.map((row) => `| ${row.comparableKey} | ${row.count} | ${row.size} | ${row.connectivity} | ${row.evidenceClass} | no |`),
  ].join("\n");

  const md = [
    "# Smartwatch Connectivity Size Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only smartwatch connectivity/size evidence. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- key rows: ${report.metrics.keyRows}`,
    `- unknown connectivity key rows: ${report.metrics.unknownConnectivityKeyRows}`,
    `- unknown connectivity units: ${report.metrics.unknownConnectivityUnits}`,
    `- unknown size units: ${report.metrics.unknownSizeUnits}`,
    "",
    "## Key Rows",
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

  await writeFile(path.join(reportsDir, "smartwatch-connectivity-size-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-connectivity-size-evidence-latest.json");
  console.log("wrote reports/smartwatch-connectivity-size-evidence-latest.md");
  console.log(`smartwatch connectivity size evidence: unknown_connectivity_units=${unknownConnectivityUnits}, unknown_size_units=${unknownSizeUnits}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
