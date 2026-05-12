import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type ConsoleReport = {
  category: string;
  total: number;
  consoleCandidateRate: number;
  knownModelCandidateRate: number;
  gateCounts: CountRow[];
  topModels: CountRow[];
  examples: Record<string, unknown>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const broad = JSON.parse(await readFile(path.join(reportsDir, "game-console-narrowing-latest.json"), "utf8")) as ConsoleReport;
  const body = JSON.parse(await readFile(path.join(reportsDir, "game-console-body-narrow-latest.json"), "utf8")) as ConsoleReport;
  const strict = JSON.parse(await readFile(path.join(reportsDir, "game-console-parser-latest.json"), "utf8")) as {
    parserReadyRate: number;
    normalParserReadyRate: number;
    recommendation: string;
  };

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: broad.category,
    decision: "hold_or_split_narrower",
    whyBroadIsNotReadySource: [
      `broad consoleCandidateRate=${broad.consoleCandidateRate}% is too low`,
      "broad sample is dominated by game title, buying, accessory, multi-bundle, and unknown rows",
      "knownModelCandidateRate can be high even for non-body rows, so it must not be treated as readiness",
      "body_narrow and strict parser reports are separate; broad metrics must not be merged into ready status",
    ],
    currentMetrics: {
      broad: {
        total: broad.total,
        consoleCandidateRate: broad.consoleCandidateRate,
        knownModelCandidateRate: broad.knownModelCandidateRate,
        gateCounts: broad.gateCounts,
        topModels: broad.topModels,
      },
      bodyNarrow: {
        total: body.total,
        consoleCandidateRate: body.consoleCandidateRate,
        knownModelCandidateRate: body.knownModelCandidateRate,
        gateCounts: body.gateCounts,
      },
      strictParser: {
        parserReadyRate: strict.parserReadyRate,
        normalParserReadyRate: strict.normalParserReadyRate,
        recommendation: strict.recommendation,
      },
    },
    splitPlanReportOnly: [
      {
        split: "game_title_media",
        gate: "game title/chip/card/CD",
        action: "exclude from hardware body policy",
      },
      {
        split: "buying_posts",
        gate: "buying",
        action: "exclude from selling-listing parser",
      },
      {
        split: "accessory_controller",
        gate: "accessory/controller-only/account/code",
        action: "hold outside console body parser",
      },
      {
        split: "body_narrow",
        gate: "console body/full-set with model/edition evidence",
        action: "keep separate report-only validation; no runtime wiring",
      },
    ],
    nextReportOnlyExperiments: [
      "keep game_console_discovered as contamination map",
      "validate body_narrow strict parser separately until parserReadyRate clears threshold",
      "add more split reports only if they do not imply public readiness",
    ],
    doNotDo: [
      "Do not use game_console_discovered as ready source",
      "Do not merge broad knownModelCandidateRate with body_narrow readiness",
      "Do not public-promote game console from broad report",
      "Do not wire body_narrow without main-agent approval",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "game-console-contamination-blockers-latest.json"), JSON.stringify(report, null, 2));

  const splitTable = [
    "| split | gate | action |",
    "| --- | --- | --- |",
    ...report.splitPlanReportOnly.map((row) => `| ${row.split} | ${row.gate} | ${row.action} |`),
  ].join("\n");

  const md = [
    "# Game Console Contamination Blockers",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only broad game console diagnosis. This is not runtime wiring and not public promotion.",
    "",
    "## Why Broad Is Not Ready Source",
    "",
    ...report.whyBroadIsNotReadySource.map((line) => `- ${line}`),
    "",
    "## Split Plan Report-Only",
    "",
    splitTable,
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "game-console-contamination-blockers-latest.md"), `${md}\n`);
  console.log("wrote reports/game-console-contamination-blockers-latest.json");
  console.log("wrote reports/game-console-contamination-blockers-latest.md");
  console.log(`game console contamination: broad_console=${broad.consoleCandidateRate}%, body_narrow=${body.consoleCandidateRate}%, strict_parser=${strict.parserReadyRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
