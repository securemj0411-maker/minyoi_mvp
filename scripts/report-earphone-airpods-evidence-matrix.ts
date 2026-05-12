import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type EarphoneBlockers = {
  category: string;
  currentMetrics: {
    total: number;
    normal: number;
    normalRate: number;
    nonNormal: number;
    nonNormalRate: number;
    parserReadyRate: number;
    needsReviewRate: number;
    airpodsNormal: number;
    nonAirpodsNormal: number;
    gateCounts: CountRow[];
    skuCounts: CountRow[];
    keyCounts: CountRow[];
    connectorCounts: CountRow[];
  };
};

const reportsDir = path.join(process.cwd(), "reports");

function evidenceClass(gate: string): string {
  if (gate === "normal") return "airpods_normal_parser_candidate_internal_only";
  if (gate === "parts") return "side_or_case_parts_exclusion_pressure";
  if (gate === "accessory") return "accessory_exclusion_pressure";
  if (gate === "damaged") return "damaged_exclusion_pressure";
  if (gate === "buying" || gate === "callout") return "non_listing_or_callout_exclusion_pressure";
  return "unknown_or_non_airpods_hold_pressure";
}

async function main(): Promise<void> {
  const blockers = JSON.parse(
    await readFile(path.join(reportsDir, "earphone-airpods-blockers-latest.json"), "utf8"),
  ) as EarphoneBlockers;

  const gateRows = blockers.currentMetrics.gateCounts.map((row) => ({
    gate: row.key,
    count: row.count,
    evidenceClass: evidenceClass(row.key),
    runtimeApproved: false,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: blockers.category,
    decision: "airpods_evidence_report_only",
    sourceReports: ["earphone-airpods-blockers-latest.json", "earphone-parser-latest.json"],
    metrics: {
      total: blockers.currentMetrics.total,
      normal: blockers.currentMetrics.normal,
      normalRate: blockers.currentMetrics.normalRate,
      nonNormal: blockers.currentMetrics.nonNormal,
      nonNormalRate: blockers.currentMetrics.nonNormalRate,
      parserReadyRate: blockers.currentMetrics.parserReadyRate,
      airpodsNormal: blockers.currentMetrics.airpodsNormal,
      nonAirpodsNormal: blockers.currentMetrics.nonAirpodsNormal,
      partsRows: blockers.currentMetrics.gateCounts.find((row) => row.key === "parts")?.count ?? 0,
      unknownRows: blockers.currentMetrics.gateCounts.find((row) => row.key === "unknown")?.count ?? 0,
      buyingOrCalloutRows: blockers.currentMetrics.gateCounts
        .filter((row) => row.key === "buying" || row.key === "callout")
        .reduce((sum, row) => sum + row.count, 0),
      runtimeApprovedRows: gateRows.filter((row) => row.runtimeApproved).length,
      skuCounts: blockers.currentMetrics.skuCounts,
      connectorCounts: blockers.currentMetrics.connectorCounts,
    },
    gateRows,
    policyImplications: [
      "AirPods parser readiness is scoped to normal matched AirPods rows only.",
      "Parts, unknown, buying, callout, damaged, and accessory rows dominate the whole category denominator.",
      "Non-AirPods coverage is absent in this sample and must remain approval-only.",
      "No AirPods policy or candidate pool wiring is approved here.",
    ],
    nextReportOnlyExperiments: [
      "split parts rows into side-only vs charging-case-only if source examples are exported",
      "keep AirPods Pro 2 connector and AirPods 4 ANC/no-ANC evidence separate",
      "do not expand to QCY/Tone Free/Beats/Buds without separate evidence",
    ],
    doNotDo: [
      "Do not promote whole earphone_discovered category",
      "Do not wire AirPods policy into candidate pool",
      "Do not expand to non-AirPods from this sample",
      "Do not loosen side-only/case-only gates for volume",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "earphone-airpods-evidence-matrix-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| gate | count | evidence_class | runtime_approved |",
    "| --- | ---: | --- | --- |",
    ...gateRows.map((row) => `| ${row.gate} | ${row.count} | ${row.evidenceClass} | ${row.runtimeApproved ? "yes" : "no"} |`),
  ].join("\n");

  const md = [
    "# Earphone AirPods Evidence Matrix",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only AirPods-focused evidence matrix. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "earphone-airpods-evidence-matrix-latest.md"), `${md}\n`);
  console.log("wrote reports/earphone-airpods-evidence-matrix-latest.json");
  console.log("wrote reports/earphone-airpods-evidence-matrix-latest.md");
  console.log(
    `earphone AirPods evidence matrix: normal=${report.metrics.normal}, non_normal=${report.metrics.nonNormal}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
