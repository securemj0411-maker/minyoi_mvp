import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type BodyNarrowReport = {
  total: number;
  consoleCandidateRate: number;
  knownModelCandidateRate: number;
  gateCounts: CountRow[];
  topModels: CountRow[];
};

type StrictParserReport = {
  total: number;
  normal: number;
  normalRate: number;
  parserReady: number;
  parserReadyRate: number;
  normalParserReadyRate: number;
  needsReviewRate: number;
  listingTypeCounts: CountRow[];
  topComparableKeys: CountRow[];
  reasonCounts: CountRow[];
  decision: string;
};

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const body = JSON.parse(await readFile(path.join(reportsDir, "game-console-body-narrow-latest.json"), "utf8")) as BodyNarrowReport;
  const strict = JSON.parse(await readFile(path.join(reportsDir, "game-console-parser-latest.json"), "utf8")) as StrictParserReport;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "game_console_body_narrow",
    decision: "parser_candidate_internal_only",
    whyCandidateIsLimited: [
      `bodyNarrowConsoleCandidateRate=${body.consoleCandidateRate}% shows useful narrowing, not public readiness`,
      `strictParserReadyRate=${strict.parserReadyRate}% remains below the internal review threshold`,
      `normalParserReadyRate=${strict.normalParserReadyRate}% is only inside normal rows`,
      "Switch 2 leakage and PS5/Switch edition/body ambiguity must remain review-gated",
    ],
    currentMetrics: {
      total: body.total,
      bodyNarrowConsoleCandidateRate: body.consoleCandidateRate,
      bodyNarrowKnownModelCandidateRate: body.knownModelCandidateRate,
      strictTotal: strict.total,
      strictNormal: strict.normal,
      strictNormalRate: strict.normalRate,
      strictParserReady: strict.parserReady,
      strictParserReadyRate: strict.parserReadyRate,
      strictNormalParserReadyRate: strict.normalParserReadyRate,
      strictNeedsReviewRate: strict.needsReviewRate,
      bodyGateCounts: body.gateCounts,
      topModels: body.topModels,
      strictListingTypeCounts: strict.listingTypeCounts,
      strictReasonCounts: strict.reasonCounts,
      topComparableKeys: strict.topComparableKeys,
    },
    candidateInternalOnly: [
      "Switch OLED/Lite/base body rows with clear body/full-set config",
      "PS5 rows with disc/digital/slim edition clear",
      "body_narrow sample set only",
      "rows passing buying/accessory/title/damaged/multi gates",
    ],
    mustHold: [
      "broad game_console_discovered rows",
      "game title/chip/card/CD rows",
      "controller/accessory-only rows",
      "buying posts",
      "multi-bundle rows",
      "Switch 2 rows until separate future policy",
      "PS5 unknown edition or Switch unknown body rows unless review-gated",
    ],
    requiredBeforeAnyMainReview: [
      "strict parser_ready above threshold without public promotion",
      "PS5 disc/digital/slim positive and review tests",
      "Switch OLED/Lite/base body/full-set tests",
      "Switch 2 review-gate tests",
      "broad game_console_discovered remains excluded",
    ],
    doNotDo: [
      "Do not public-promote game_console_body_narrow",
      "Do not wire body_narrow policy into candidate pool",
      "Do not use broad game_console_discovered as ready source",
      "Do not merge strict parser and narrowing metrics as approval",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "game-console-body-blockers-latest.json"), JSON.stringify(report, null, 2));

  const metricRows = Object.entries(report.currentMetrics)
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n");

  const md = [
    "# Game Console Body Blockers",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only game console body_narrow diagnosis. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "game-console-body-blockers-latest.md"), `${md}\n`);
  console.log("wrote reports/game-console-body-blockers-latest.json");
  console.log("wrote reports/game-console-body-blockers-latest.md");
  console.log(`game console body blockers: body_candidate=${body.consoleCandidateRate}%, strict_ready=${strict.parserReadyRate}%, normal_ready=${strict.normalParserReadyRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
