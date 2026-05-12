import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type DesktopReport = {
  category: string;
  total: number;
  normal: number;
  normalRate: number;
  parserReady: number;
  parserReadyRate: number;
  generic: number;
  genericRate: number;
  gateCounts: CountRow[];
  keyCounts: CountRow[];
  examples: Array<Record<string, unknown>>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const desktop = JSON.parse(await readFile(path.join(reportsDir, "desktop-parser-latest.json"), "utf8")) as DesktopReport;
  const nonNormal = desktop.total - desktop.normal;
  const nonNormalRate = Number(((nonNormal / desktop.total) * 100).toFixed(1));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: desktop.category,
    decision: "parser_candidate_report_only",
    whyCandidateIsLimited: [
      `normalRate=${desktop.normalRate}% means most rows are not full-unit candidate rows`,
      `nonNormalRate=${nonNormalRate}% includes accessory/multi/commercial/buying/unknown noise`,
      `parserReadyRate=${desktop.parserReadyRate}% is only among normal rows`,
      `genericRate=${desktop.genericRate}% still has unknown CPU/GPU or generic gaming desktop keys`,
    ],
    currentMetrics: {
      total: desktop.total,
      normal: desktop.normal,
      normalRate: desktop.normalRate,
      nonNormal,
      nonNormalRate,
      parserReady: desktop.parserReady,
      parserReadyRate: desktop.parserReadyRate,
      generic: desktop.generic,
      genericRate: desktop.genericRate,
      gateCounts: desktop.gateCounts,
      keyCounts: desktop.keyCounts,
    },
    candidateInternalOnly: [
      "complete desktop body rows",
      "CPU and GPU parsed rows",
      "Apple desktop model rows with concrete model evidence",
      "commercial/multi/full-set/component gates already excluded",
    ],
    mustHold: [
      "Windows/Office key rows",
      "component-only rows",
      "commercial shop templates",
      "PC-room/office bulk rows",
      "monitor/keyboard/mouse full-set bundle rows",
      "damaged/mining-risk rows",
      "unknown CPU/GPU and generic gaming desktop rows unless review-gated",
    ],
    requiredBeforeAnyMainReview: [
      "Windows key exclusion tests",
      "component-only exclusion tests",
      "commercial and PC-room bulk exclusion tests",
      "full-unit CPU/GPU positive tests",
      "RAM/SSD/warranty/newness follow-up field plan",
    ],
    reviewExamples: desktop.examples,
    doNotDo: [
      "Do not promote desktop_pc_discovered",
      "Do not wire CPU/GPU policy into candidate pool",
      "Do not compare configurable shop templates with one-off used PCs",
      "Do not treat unknown-cpu or unknown-gpu rows as ready",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "desktop-full-unit-blockers-latest.json"), JSON.stringify(report, null, 2));

  const metricRows = Object.entries(report.currentMetrics)
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n");

  const md = [
    "# Desktop Full-Unit Blockers",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only desktop full-unit diagnosis. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "desktop-full-unit-blockers-latest.md"), `${md}\n`);
  console.log("wrote reports/desktop-full-unit-blockers-latest.json");
  console.log("wrote reports/desktop-full-unit-blockers-latest.md");
  console.log(`desktop full-unit blockers: normal=${desktop.normalRate}%, parser_ready=${desktop.parserReadyRate}%, generic=${desktop.genericRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
