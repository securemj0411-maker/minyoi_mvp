import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type BlockerReport = {
  category: string;
  decision: string;
  whyHold?: string[];
  whyHoldDespiteParserReady?: string[];
  whyBroadIsNotReadySource?: string[];
  nextReportOnlyExperiments?: string[];
  doNotDo?: string[];
};

const reportsDir = path.join(process.cwd(), "reports");

const blockerFiles = [
  "camera-package-blockers-latest.json",
  "smartwatch-ambiguity-blockers-latest.json",
  "speaker-family-blockers-latest.json",
  "home-appliance-blockers-latest.json",
  "game-console-contamination-blockers-latest.json",
];

async function readBlocker(file: string): Promise<BlockerReport> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as BlockerReport;
}

async function main(): Promise<void> {
  const rows = [];
  for (const file of blockerFiles) {
    const report = await readBlocker(file);
    rows.push({
      category: report.category,
      blockerReport: file.replace(/\.json$/, ".md"),
      decision: report.decision,
      primaryReasons: report.whyHold ?? report.whyHoldDespiteParserReady ?? report.whyBroadIsNotReadySource ?? [],
      nextReportOnlyExperiments: report.nextReportOnlyExperiments ?? [],
      doNotDo: report.doNotDo ?? [],
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    totalBlockerReports: rows.length,
    rows,
    guardrails: [
      "Index only, not policy approval",
      "No public promotion",
      "No runtime catalog apply",
      "No candidate pool policy wiring",
      "Do not use hold blocker reports as readiness approval",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-hold-blockers-index-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| category | decision | blocker_report | primary_reasons | next_report_only_experiments | do_not_do |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) =>
      [
        row.category,
        row.decision,
        row.blockerReport,
        row.primaryReasons.map((item) => `- ${item}`).join("<br>"),
        row.nextReportOnlyExperiments.map((item) => `- ${item}`).join("<br>"),
        row.doNotDo.map((item) => `- ${item}`).join("<br>"),
      ].join(" | "),
    ).map((line) => `| ${line} |`),
  ].join("\n");

  const md = [
    "# Parser Hold Blockers Index",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only index for hold-only blocker reports. This is not public promotion and not runtime wiring.",
    "",
    table,
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-hold-blockers-index-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-hold-blockers-index-latest.json");
  console.log("wrote reports/parser-hold-blockers-index-latest.md");
  console.log(`hold blocker index rows=${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
