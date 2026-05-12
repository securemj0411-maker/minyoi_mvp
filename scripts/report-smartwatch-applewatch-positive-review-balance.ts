import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type FullsetReport = {
  metrics: {
    explicitGenerationRows: number;
    strongFullsetRows: number;
    nearFullsetRows: number;
    accessoryRiskRows: number;
    missingConnectivityOrSizeRows: number;
  };
};

type ConnectivityReviewReport = {
  metrics: {
    cellularReadyRows: number;
    cellularWarningRows: number;
    pairingResetRows: number;
    gpsOnlyRows: number;
    bandFitRows: number;
    crossSizeCompatibilityRows: number;
  };
};

type PriorityPositiveReport = {
  metrics: {
    se3UnopenedRows: number;
    se3StarlightRows: number;
    se3Battery100Rows: number;
    series10TitaniumRows: number;
    series10Battery90plusRows: number;
    series7StainlessCellularRows: number;
    series7NikeRows: number;
    series9Battery90plusRows: number;
    series9UnopenedRows: number;
  };
};

type ConnectivitySizeReport = {
  metrics: {
    unknownConnectivityUnits: number;
    unknownSizeUnits: number;
    unknownConnectivityKeyRows: number;
    unknownSizeKeyRows: number;
  };
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const fullset = await readJson<FullsetReport>("smartwatch-applewatch-fullset-generation-positives-latest.json");
  const wording = await readJson<ConnectivityReviewReport>("smartwatch-applewatch-connectivity-review-evidence-latest.json");
  const priority = await readJson<PriorityPositiveReport>("smartwatch-applewatch-priority-positive-buckets-latest.json");
  const connectivity = await readJson<ConnectivitySizeReport>("smartwatch-connectivity-size-evidence-latest.json");

  const positiveUnits =
    fullset.metrics.strongFullsetRows +
    fullset.metrics.nearFullsetRows +
    priority.metrics.se3UnopenedRows +
    priority.metrics.se3StarlightRows +
    priority.metrics.se3Battery100Rows +
    priority.metrics.series10TitaniumRows +
    priority.metrics.series10Battery90plusRows +
    priority.metrics.series7StainlessCellularRows +
    priority.metrics.series7NikeRows +
    priority.metrics.series9Battery90plusRows +
    priority.metrics.series9UnopenedRows;

  const reviewPressureUnits =
    fullset.metrics.missingConnectivityOrSizeRows +
    fullset.metrics.accessoryRiskRows +
    wording.metrics.cellularWarningRows +
    connectivity.metrics.unknownConnectivityUnits +
    connectivity.metrics.unknownSizeUnits;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_positive_review_balance_report_only",
    metrics: {
      explicitPositiveBaseRows: fullset.metrics.strongFullsetRows + fullset.metrics.nearFullsetRows,
      priorityPositiveRows: positiveUnits - (fullset.metrics.strongFullsetRows + fullset.metrics.nearFullsetRows),
      positiveUnits,
      reviewPressureUnits,
      positiveToReviewRatio: reviewPressureUnits === 0 ? null : Number((positiveUnits / reviewPressureUnits).toFixed(2)),
      cellularReadyRows: wording.metrics.cellularReadyRows,
      pairingResetRows: wording.metrics.pairingResetRows,
      gpsOnlyRows: wording.metrics.gpsOnlyRows,
      unknownConnectivityUnits: connectivity.metrics.unknownConnectivityUnits,
      unknownSizeUnits: connectivity.metrics.unknownSizeUnits,
      runtimeApprovedRows: 0,
    },
    strongestPositiveSlices: [
      { scope: "se3_unopened_40_44mm", count: priority.metrics.se3UnopenedRows },
      { scope: "se3_40mm_gps_starlight", count: priority.metrics.se3StarlightRows },
      { scope: "series10_46mm_battery90plus", count: priority.metrics.series10Battery90plusRows },
      { scope: "series10_46mm_titanium", count: priority.metrics.series10TitaniumRows },
      { scope: "series7_45mm_stainless_cellular", count: priority.metrics.series7StainlessCellularRows },
      { scope: "series9_45mm_gps_battery90plus", count: priority.metrics.series9Battery90plusRows },
    ].filter((row) => row.count > 0),
    reviewPressureSlices: [
      { scope: "missing_connectivity_or_size", count: fullset.metrics.missingConnectivityOrSizeRows },
      { scope: "unknown_connectivity_units", count: connectivity.metrics.unknownConnectivityUnits },
      { scope: "unknown_size_units", count: connectivity.metrics.unknownSizeUnits },
      { scope: "gps_only_wording", count: wording.metrics.gpsOnlyRows },
      { scope: "cellular_warning_wording", count: wording.metrics.cellularWarningRows },
    ].filter((row) => row.count > 0),
    policyImplications: [
      "Apple Watch explicit positive opportunities are now visible as both broad full-set positives and narrower generation+attribute slices.",
      "Review pressure remains non-trivial because explicit generation alone still leaves many rows with missing size/connectivity or unknown key-level connectivity.",
      "Cellular-ready and pairing-reset wording raise confidence for user education, but they still do not equal runtime approval.",
      "This balance report is a report-only summary; it should steer backlog priority, not mutate parser behavior.",
    ],
    nextReportOnlyExperiments: [
      "increase positive density for SE3 / Series 10 / Series 7 / Series 9 without relying on one repeated seller/template cluster",
      "collect more explicit GPS-only and cellular-warning rows so the non-cellular contrast is thicker than isolated outliers",
      "add Galaxy Watch narrow positive buckets next so smartwatch family comparison is not Apple-Watch-only",
    ],
    doNotDo: [
      "Do not treat positive-to-review ratio as runtime approval threshold",
      "Do not wire candidate pool policy from this balance report",
      "Do not collapse wording-based confidence into structured connectivity certainty",
      "Do not treat narrow positive bucket counts as market-share or supply estimates",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-positive-review-balance-latest.json"), JSON.stringify(report, null, 2));

  const positives = report.strongestPositiveSlices
    .map((row) => `| ${row.scope} | ${row.count} |`)
    .join("\n");
  const review = report.reviewPressureSlices
    .map((row) => `| ${row.scope} | ${row.count} |`)
    .join("\n");

  const md = [
    "# Smartwatch Apple Watch Positive Review Balance",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only Apple Watch positive-vs-review balance summary. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- positive units: ${report.metrics.positiveUnits}`,
    `- review pressure units: ${report.metrics.reviewPressureUnits}`,
    `- positive/review ratio: ${report.metrics.positiveToReviewRatio ?? "n/a"}`,
    `- cellular-ready rows: ${report.metrics.cellularReadyRows}`,
    `- pairing-reset rows: ${report.metrics.pairingResetRows}`,
    `- gps-only rows: ${report.metrics.gpsOnlyRows}`,
    `- unknown connectivity units: ${report.metrics.unknownConnectivityUnits}`,
    `- unknown size units: ${report.metrics.unknownSizeUnits}`,
    "",
    "## Strongest Positive Slices",
    "",
    "| scope | count |",
    "| --- | ---: |",
    positives || "| - | 0 |",
    "",
    "## Review Pressure Slices",
    "",
    "| scope | count |",
    "| --- | ---: |",
    review || "| - | 0 |",
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

  await writeFile(path.join(reportsDir, "smartwatch-applewatch-positive-review-balance-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-positive-review-balance-latest.json");
  console.log("wrote reports/smartwatch-applewatch-positive-review-balance-latest.md");
  console.log(
    `applewatch positive review balance: positive_units=${report.metrics.positiveUnits}, review_pressure=${report.metrics.reviewPressureUnits}, ratio=${report.metrics.positiveToReviewRatio ?? "n/a"}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
