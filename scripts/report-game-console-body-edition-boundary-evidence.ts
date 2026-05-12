import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CoverageRow = {
  key: string;
  count: number;
  coverageClass: string;
};

type CoverageMatrix = {
  category: string;
  coverageRows: CoverageRow[];
  metrics: {
    positiveKeyRows: number;
    reviewGatedKeyRows: number;
  };
};

type BoundaryRow = CoverageRow & {
  family: string;
  edition: string;
  bodyScope: string;
  boundaryClass: string;
  reviewAction: string;
  runtimeApproved: false;
};

const reportsDir = path.join(process.cwd(), "reports");

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function tokenAt(key: string, index: number): string {
  return key.split("|")[index] ?? "unknown";
}

function boundaryClass(row: CoverageRow): string {
  if (row.coverageClass === "positive_key_report_only") return "positive_known_edition_body_report_only";
  if (/switch_2/.test(row.key)) return "hold_switch_2_review_gate";
  if (/playstation_5/.test(row.key) && /unknown_body/.test(row.key)) return "hold_ps5_unknown_body_review_gate";
  if (/playstation_5/.test(row.key)) return "hold_ps5_edition_review_gate";
  if (/unknown_edition/.test(row.key) && /unknown_body/.test(row.key)) return "hold_unknown_edition_and_body";
  if (/unknown_edition/.test(row.key)) return "hold_unknown_edition";
  if (/unknown_body/.test(row.key)) return "hold_unknown_body";
  return "hold_review_gate";
}

function reviewAction(row: CoverageRow): string {
  if (row.coverageClass === "positive_key_report_only") return "positive_coverage_reference_only";
  if (/switch_2/.test(row.key)) return "keep_manual_review_switch_2";
  if (/playstation_5/.test(row.key)) return "keep_manual_review_ps5_edition_body";
  return "keep_manual_review_unknown_edition_body";
}

function units(rows: BoundaryRow[], predicate: (row: BoundaryRow) => boolean): number {
  return rows.filter(predicate).reduce((sum, row) => sum + row.count, 0);
}

async function main(): Promise<void> {
  const coverage = JSON.parse(
    await readFile(path.join(reportsDir, "game-console-coverage-matrix-latest.json"), "utf8"),
  ) as CoverageMatrix;

  const boundaryRows: BoundaryRow[] = coverage.coverageRows.map((row) => ({
    ...row,
    family: tokenAt(row.key, 1),
    edition: tokenAt(row.key, 2),
    bodyScope: tokenAt(row.key, 3),
    boundaryClass: boundaryClass(row),
    reviewAction: reviewAction(row),
    runtimeApproved: false,
  }));

  const positiveRows = boundaryRows.filter((row) => row.coverageClass === "positive_key_report_only");
  const reviewRows = boundaryRows.filter((row) => row.coverageClass === "review_gated_key");

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: coverage.category,
    decision: "game_console_body_edition_boundary_report_only",
    sourceReports: ["game-console-coverage-matrix-latest.json", "game-console-evidence-matrix-latest.json"],
    metrics: {
      keyRows: boundaryRows.length,
      positiveKeyRows: positiveRows.length,
      reviewGatedKeyRows: reviewRows.length,
      positiveUnits: units(boundaryRows, (row) => row.coverageClass === "positive_key_report_only"),
      reviewGatedUnits: units(boundaryRows, (row) => row.coverageClass === "review_gated_key"),
      switch2KeyRows: boundaryRows.filter((row) => row.edition === "switch_2").length,
      switch2Units: units(boundaryRows, (row) => row.edition === "switch_2"),
      ps5KeyRows: boundaryRows.filter((row) => row.family === "playstation_5").length,
      ps5Units: units(boundaryRows, (row) => row.family === "playstation_5"),
      unknownEditionKeyRows: boundaryRows.filter((row) => row.edition === "unknown_edition").length,
      unknownEditionUnits: units(boundaryRows, (row) => row.edition === "unknown_edition"),
      unknownBodyKeyRows: boundaryRows.filter((row) => row.bodyScope === "unknown_body").length,
      unknownBodyUnits: units(boundaryRows, (row) => row.bodyScope === "unknown_body"),
      runtimeApprovedRows: boundaryRows.filter((row) => row.runtimeApproved).length,
      boundaryClassCounts: countBy(boundaryRows.map((row) => row.boundaryClass)),
      familyCounts: countBy(boundaryRows.flatMap((row) => Array.from({ length: row.count }, () => row.family))),
      reviewActionCounts: countBy(boundaryRows.map((row) => row.reviewAction)),
    },
    boundaryRows,
    policyImplications: [
      "Known Nintendo Switch OLED/Lite/V2 edition/body keys are positive coverage reference only.",
      "Switch 2, PS5, unknown_edition, and unknown_body keys remain manual-review evidence.",
      "Positive coverage rows do not approve public promotion or runtime catalog apply.",
      "Review-gated keys must not be merged into candidate pool wiring from this report.",
    ],
    nextReportOnlyExperiments: [
      "collect title-level examples for Switch 2 full_set/body_only separation",
      "separate PS5 disc/digital/slim rows by known body vs unknown body",
      "keep unknown_edition and unknown_body rows as hold evidence until main-approved runtime rules exist",
    ],
    doNotDo: [
      "Do not public-promote game_console_body_narrow",
      "Do not apply Switch 2 runtime rules",
      "Do not apply PS5 edition runtime rules",
      "Do not wire candidate pool policy from this boundary report",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "game-console-body-edition-boundary-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| comparable_key | count | boundary_class | review_action | runtime_approved |",
    "| --- | ---: | --- | --- | --- |",
    ...boundaryRows.map((row) => `| ${row.key} | ${row.count} | ${row.boundaryClass} | ${row.reviewAction} | no |`),
  ].join("\n");

  const md = [
    "# Game Console Body Edition Boundary Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only body_narrow edition/body boundary evidence. This is not runtime wiring and not public promotion.",
    "",
    `Positive units: ${report.metrics.positiveUnits}`,
    `Review-gated units: ${report.metrics.reviewGatedUnits}`,
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

  await writeFile(path.join(reportsDir, "game-console-body-edition-boundary-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/game-console-body-edition-boundary-evidence-latest.json");
  console.log("wrote reports/game-console-body-edition-boundary-evidence-latest.md");
  console.log(
    `game console body edition boundary: positive_units=${report.metrics.positiveUnits}, review_units=${report.metrics.reviewGatedUnits}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
