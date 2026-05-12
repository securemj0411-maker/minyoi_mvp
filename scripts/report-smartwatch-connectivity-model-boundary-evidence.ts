import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type KeyRow = {
  comparableKey: string;
  count: number;
  family: string;
  model: string;
  size: string;
  connectivity: string;
  evidenceClass: string;
};

type SmartwatchConnectivityEvidence = {
  category: string;
  keyRows: KeyRow[];
};

type ModelBoundaryRow = {
  family: string;
  model: string;
  totalUnits: number;
  unknownConnectivityUnits: number;
  unknownSizeUnits: number;
  resolvedUnits: number;
  unknownConnectivityRate: number;
  boundaryClass: string;
  runtimeApproved: false;
};

const reportsDir = path.join(process.cwd(), "reports");

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Number(((part / total) * 100).toFixed(1));
}

function boundaryClass(row: ModelBoundaryRow): string {
  if (row.unknownConnectivityUnits > 0 && row.unknownSizeUnits > 0) return "model_has_unknown_size_and_connectivity_hold";
  if (row.unknownConnectivityUnits > 0) return "model_has_unknown_connectivity_hold";
  return "model_resolved_reference_only";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const evidence = JSON.parse(
    await readFile(path.join(reportsDir, "smartwatch-connectivity-size-evidence-latest.json"), "utf8"),
  ) as SmartwatchConnectivityEvidence;

  const grouped = new Map<string, ModelBoundaryRow>();
  for (const row of evidence.keyRows) {
    const id = `${row.family}|${row.model}`;
    const current = grouped.get(id) ?? {
      family: row.family,
      model: row.model,
      totalUnits: 0,
      unknownConnectivityUnits: 0,
      unknownSizeUnits: 0,
      resolvedUnits: 0,
      unknownConnectivityRate: 0,
      boundaryClass: "",
      runtimeApproved: false as const,
    };
    current.totalUnits += row.count;
    if (row.connectivity === "unknown_connectivity") current.unknownConnectivityUnits += row.count;
    if (row.size === "unknown_size") current.unknownSizeUnits += row.count;
    if (row.connectivity !== "unknown_connectivity" && row.size !== "unknown_size") current.resolvedUnits += row.count;
    grouped.set(id, current);
  }

  const modelRows = [...grouped.values()]
    .map((row) => {
      const withRate = {
        ...row,
        unknownConnectivityRate: pct(row.unknownConnectivityUnits, row.totalUnits),
      };
      return {
        ...withRate,
        boundaryClass: boundaryClass(withRate),
      };
    })
    .sort((a, b) => b.unknownConnectivityUnits - a.unknownConnectivityUnits || b.totalUnits - a.totalUnits || a.model.localeCompare(b.model));

  const unknownRows = modelRows.filter((row) => row.unknownConnectivityUnits > 0 || row.unknownSizeUnits > 0);

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: evidence.category,
    decision: "smartwatch_connectivity_model_boundary_report_only",
    sourceReports: ["smartwatch-connectivity-size-evidence-latest.json", "smartwatch-ambiguity-evidence-matrix-latest.json"],
    metrics: {
      modelRows: modelRows.length,
      modelsWithUnknownConnectivity: modelRows.filter((row) => row.unknownConnectivityUnits > 0).length,
      modelsWithUnknownSize: modelRows.filter((row) => row.unknownSizeUnits > 0).length,
      unknownConnectivityUnits: modelRows.reduce((sum, row) => sum + row.unknownConnectivityUnits, 0),
      unknownSizeUnits: modelRows.reduce((sum, row) => sum + row.unknownSizeUnits, 0),
      resolvedUnits: modelRows.reduce((sum, row) => sum + row.resolvedUnits, 0),
      runtimeApprovedRows: modelRows.filter((row) => row.runtimeApproved).length,
      boundaryClassCounts: countBy(modelRows.map((row) => row.boundaryClass)),
      unknownModelCounts: countBy(unknownRows.map((row) => row.model)),
      familyCounts: countBy(modelRows.flatMap((row) => Array(row.totalUnits).fill(row.family) as string[])),
    },
    modelRows,
    policyImplications: [
      "Unknown connectivity is concentrated by model and must remain review-gated.",
      "SE2/SE3 unknown size or connectivity rows are not safe candidate-pool rows.",
      "Resolved model rows are reference evidence only, not public promotion.",
      "No GPS/cellular/wifi inference rule is approved by this report.",
    ],
    nextReportOnlyExperiments: [
      "collect title-level examples for models with unknown connectivity units",
      "separate SE generation review from connectivity review",
      "keep Galaxy Watch connectivity unknown rows out of parser candidates until explicit text exists",
    ],
    doNotDo: [
      "Do not promote smartwatch_discovered",
      "Do not infer connectivity by model family",
      "Do not wire unknown connectivity rows into candidate pool",
      "Do not runtime-apply smartwatch parser changes from this report",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-connectivity-model-boundary-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| family | model | total_units | unknown_connectivity | unknown_size | unknown_connectivity_rate | boundary_class | runtime_approved |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- | --- |",
    ...modelRows.map((row) => `| ${row.family} | ${row.model} | ${row.totalUnits} | ${row.unknownConnectivityUnits} | ${row.unknownSizeUnits} | ${row.unknownConnectivityRate}% | ${row.boundaryClass} | no |`),
  ].join("\n");

  const md = [
    "# Smartwatch Connectivity Model Boundary Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only smartwatch model-level connectivity boundary evidence. This is not runtime wiring and not public promotion.",
    "",
    `Models with unknown connectivity: ${report.metrics.modelsWithUnknownConnectivity}`,
    `Unknown connectivity units: ${report.metrics.unknownConnectivityUnits}`,
    `Runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
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

  await writeFile(path.join(reportsDir, "smartwatch-connectivity-model-boundary-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-connectivity-model-boundary-evidence-latest.json");
  console.log("wrote reports/smartwatch-connectivity-model-boundary-evidence-latest.md");
  console.log(
    `smartwatch connectivity model boundary: unknown_models=${report.metrics.modelsWithUnknownConnectivity}, unknown_units=${report.metrics.unknownConnectivityUnits}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
