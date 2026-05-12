import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type MonitorReport = {
  total: number;
  hasModelCodeRate: number;
  genericKeyRate: number;
  parserReadyRate: number;
  criticalUnknownRate: number;
  eligibleTotal: number;
  eligibleHasModelCodeRate: number;
  eligibleGenericKeyRate: number;
  eligibleParserReadyRate: number;
  eligibleCriticalUnknownRate: number;
  gateCounts: CountRow[];
  topComparableKeys: CountRow[];
  unknownParts: CountRow[];
  genericExamples: Array<Record<string, unknown>>;
  criticalExamples: Array<Record<string, unknown>>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const monitor = JSON.parse(await readFile(path.join(reportsDir, "monitor-parser-latest.json"), "utf8")) as MonitorReport;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "monitor_discovered",
    decision: "parser_candidate_internal_only",
    whyCandidateIsLimited: [
      `eligibleParserReadyRate=${monitor.eligibleParserReadyRate}% only applies after non-unknown gates are excluded`,
      `all parserReadyRate=${monitor.parserReadyRate}% is not whole-category readiness`,
      `eligibleGenericKeyRate=${monitor.eligibleGenericKeyRate}% remains review/hold`,
      `eligibleCriticalUnknownRate=${monitor.eligibleCriticalUnknownRate}% still blocks model-code policy wiring`,
    ],
    currentMetrics: {
      total: monitor.total,
      hasModelCodeRate: monitor.hasModelCodeRate,
      genericKeyRate: monitor.genericKeyRate,
      parserReadyRate: monitor.parserReadyRate,
      criticalUnknownRate: monitor.criticalUnknownRate,
      eligibleTotal: monitor.eligibleTotal,
      eligibleHasModelCodeRate: monitor.eligibleHasModelCodeRate,
      eligibleGenericKeyRate: monitor.eligibleGenericKeyRate,
      eligibleParserReadyRate: monitor.eligibleParserReadyRate,
      eligibleCriticalUnknownRate: monitor.eligibleCriticalUnknownRate,
      gateCounts: monitor.gateCounts,
      unknownParts: monitor.unknownParts,
      topComparableKeys: monitor.topComparableKeys.slice(0, 12),
    },
    candidateInternalOnly: [
      "explicit model-code rows",
      "brand + known model-code rows",
      "high-confidence model-code hint rows where accessory/damaged/bundle gates are clear",
    ],
    mustHold: [
      "generic monitor rows without model code",
      "monitor arm/stand/cable/power accessory rows",
      "damaged panel rows",
      "PC bundle rows",
      "multi-unit rows",
      "size/resolution/Hz-only rows without model code",
    ],
    requiredBeforeAnyMainReview: [
      "generic examples remain review-gated",
      "critical unknown parts are reduced or explicitly review-gated",
      "model-code hints have tests before runtime consideration",
      "whole-category readiness is not inferred from eligible-only metric",
    ],
    genericExamples: monitor.genericExamples,
    criticalExamples: monitor.criticalExamples,
    doNotDo: [
      "Do not public-promote monitor_discovered",
      "Do not wire model-code policy into candidate pool",
      "Do not treat eligibleParserReadyRate as whole-category readiness",
      "Do not infer model code from size/resolution/Hz alone",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "monitor-model-code-blockers-latest.json"), JSON.stringify(report, null, 2));

  const metricRows = Object.entries(report.currentMetrics)
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n");

  const md = [
    "# Monitor Model-Code Blockers",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only monitor model-code diagnosis. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "monitor-model-code-blockers-latest.md"), `${md}\n`);
  console.log("wrote reports/monitor-model-code-blockers-latest.json");
  console.log("wrote reports/monitor-model-code-blockers-latest.md");
  console.log(`monitor model-code blockers: eligible_ready=${monitor.eligibleParserReadyRate}%, all_ready=${monitor.parserReadyRate}%, generic=${monitor.eligibleGenericKeyRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
