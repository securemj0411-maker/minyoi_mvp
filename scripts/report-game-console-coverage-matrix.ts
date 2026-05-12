import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };
type GameConsoleParser = {
  category: string;
  parserReadyRate: number;
  normalParserReadyRate: number;
  topComparableKeys: CountRow[];
};
type GameConsoleExclusion = {
  metrics: {
    exclusionCandidateOnlyRows: number;
    bodyCandidateRows: number;
    statusCounts: CountRow[];
  };
};

const reportsDir = path.join(process.cwd(), "reports");

function rowClass(key: string): string {
  if (/unknown_edition|unknown_body|switch_2|playstation_5/.test(key)) return "review_gated_key";
  return "positive_key_report_only";
}

async function main(): Promise<void> {
  const parser = JSON.parse(await readFile(path.join(reportsDir, "game-console-parser-latest.json"), "utf8")) as GameConsoleParser;
  const exclusion = JSON.parse(
    await readFile(path.join(reportsDir, "game-console-exclusion-readiness-latest.json"), "utf8"),
  ) as GameConsoleExclusion;

  const coverageRows = parser.topComparableKeys.slice(0, 18).map((row) => ({
    ...row,
    coverageClass: rowClass(row.key),
  }));
  const positiveRows = coverageRows.filter((row) => row.coverageClass === "positive_key_report_only");
  const reviewGatedRows = coverageRows.filter((row) => row.coverageClass === "review_gated_key");

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: parser.category,
    decision: "coverage_matrix_report_only_no_wiring",
    sourceReports: ["game-console-parser-latest.json", "game-console-exclusion-readiness-latest.json"],
    metrics: {
      parserReadyRate: parser.parserReadyRate,
      normalParserReadyRate: parser.normalParserReadyRate,
      topComparableRows: coverageRows.length,
      positiveKeyRows: positiveRows.length,
      reviewGatedKeyRows: reviewGatedRows.length,
      exclusionCandidateOnlyRows: exclusion.metrics.exclusionCandidateOnlyRows,
      bodyCandidateRowsFromExclusionReport: exclusion.metrics.bodyCandidateRows,
    },
    coverageRows,
    exclusionStatusCounts: exclusion.metrics.statusCounts,
    policyImplications: [
      "Positive comparable keys are report-only coverage rows, not public promotion.",
      "Unknown edition/body, Switch 2, and PS5 rows remain review-gated.",
      "Exclusion-candidate-only rows remain outside body_narrow positive coverage.",
      "No candidate pool wiring or runtime edition rule is applied here.",
    ],
    nextReportOnlyExperiments: [
      "separate positive_key_report_only rows by model/body/full_set dimensions",
      "keep Switch 2 and PS5 edition rows review-gated until main-approved rules exist",
      "compare positive coverage rows against exclusion examples for false-merge risk",
    ],
    doNotDo: [
      "Do not public-promote game_console_body_narrow",
      "Do not apply Switch 2 runtime rules",
      "Do not apply PS5 edition runtime rules",
      "Do not wire candidate pool policy from this matrix",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "game-console-coverage-matrix-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| comparable_key | count | coverage_class |",
    "| --- | ---: | --- |",
    ...coverageRows.map((row) => `| ${row.key} | ${row.count} | ${row.coverageClass} |`),
  ].join("\n");

  const md = [
    "# Game Console Coverage Matrix",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only game console body_narrow coverage matrix. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "game-console-coverage-matrix-latest.md"), `${md}\n`);
  console.log("wrote reports/game-console-coverage-matrix-latest.json");
  console.log("wrote reports/game-console-coverage-matrix-latest.md");
  console.log(`game console coverage matrix: positive_keys=${positiveRows.length}, review_gated=${reviewGatedRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
