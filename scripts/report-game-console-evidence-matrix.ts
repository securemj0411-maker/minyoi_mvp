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
    bodyCandidateRowsFromExclusionReport: number;
  };
};

type ExclusionRow = {
  pid?: string;
  title?: string;
  listingType?: string;
  reviewClass: string;
  exclusionStatus: string;
  reasons: string[];
};

type ExclusionReadiness = {
  exclusionRows: ExclusionRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function evidenceClassForCoverage(row: CoverageRow): string {
  if (row.coverageClass === "positive_key_report_only") return "positive_coverage_report_only";
  if (/switch_2/.test(row.key)) return "review_gated_switch_2";
  if (/playstation_5/.test(row.key)) return "review_gated_ps5_edition";
  return "review_gated_unknown_edition_or_body";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const coverage = JSON.parse(
    await readFile(path.join(reportsDir, "game-console-coverage-matrix-latest.json"), "utf8"),
  ) as CoverageMatrix;
  const exclusion = JSON.parse(
    await readFile(path.join(reportsDir, "game-console-exclusion-readiness-latest.json"), "utf8"),
  ) as ExclusionReadiness;

  const coverageRows = coverage.coverageRows.map((row) => ({
    ...row,
    evidenceClass: evidenceClassForCoverage(row),
    runtimeApproved: false,
  }));
  const exclusionRows = exclusion.exclusionRows.map((row) => ({
    ...row,
    evidenceClass: "exclusion_candidate_only",
    runtimeApproved: false,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: coverage.category,
    decision: "game_console_evidence_report_only",
    sourceReports: ["game-console-coverage-matrix-latest.json", "game-console-exclusion-readiness-latest.json"],
    metrics: {
      coverageRows: coverageRows.length,
      positiveCoverageRows: coverage.metrics.positiveKeyRows,
      reviewGatedCoverageRows: coverage.metrics.reviewGatedKeyRows,
      exclusionRows: exclusionRows.length,
      bodyCandidateRowsFromExclusionReport: coverage.metrics.bodyCandidateRowsFromExclusionReport,
      runtimeApprovedRows: [...coverageRows, ...exclusionRows].filter((row) => row.runtimeApproved).length,
      coverageEvidenceClassCounts: countBy(coverageRows.map((row) => row.evidenceClass)),
      exclusionStatusCounts: countBy(exclusionRows.map((row) => row.exclusionStatus)),
      exclusionReasonCounts: countBy(exclusionRows.flatMap((row) => row.reasons)),
    },
    coverageRows,
    exclusionRows,
    policyImplications: [
      "Positive coverage rows remain report-only and are not public promotion.",
      "Switch 2, PS5 edition, unknown edition, and unknown body rows remain review-gated.",
      "Accessory/housing, bundle/game-title, and buying/mixed-generation rows remain exclusion-only.",
      "No runtime edition rule or candidate pool wiring is approved here.",
    ],
    nextReportOnlyExperiments: [
      "keep Switch 2 and PS5 rows as review evidence until main-approved runtime rules exist",
      "use exclusion rows as negative examples only",
      "do not merge exclusion examples into body_narrow positive coverage",
    ],
    doNotDo: [
      "Do not public-promote game_console_body_narrow",
      "Do not apply Switch 2 runtime rules",
      "Do not apply PS5 edition runtime rules",
      "Do not wire candidate pool policy from this matrix",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "game-console-evidence-matrix-latest.json"), JSON.stringify(report, null, 2));

  const coverageTable = [
    "| comparable_key | count | evidence_class | runtime_approved |",
    "| --- | ---: | --- | --- |",
    ...coverageRows.map((row) => `| ${row.key} | ${row.count} | ${row.evidenceClass} | ${row.runtimeApproved ? "yes" : "no"} |`),
  ].join("\n");

  const exclusionTable = [
    "| pid | exclusion_status | reasons | runtime_approved | title |",
    "| --- | --- | --- | --- | --- |",
    ...exclusionRows.map((row) => `| ${row.pid ?? "-"} | ${row.exclusionStatus} | ${row.reasons.join(", ") || "-"} | ${row.runtimeApproved ? "yes" : "no"} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Game Console Evidence Matrix",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only game console evidence matrix. This is not runtime wiring and not public promotion.",
    "",
    "## Coverage Rows",
    "",
    coverageTable,
    "",
    "## Exclusion Rows",
    "",
    exclusionTable,
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

  await writeFile(path.join(reportsDir, "game-console-evidence-matrix-latest.md"), `${md}\n`);
  console.log("wrote reports/game-console-evidence-matrix-latest.json");
  console.log("wrote reports/game-console-evidence-matrix-latest.md");
  console.log(`game console evidence matrix: positive=${report.metrics.positiveCoverageRows}, review_gated=${report.metrics.reviewGatedCoverageRows}, exclusion=${report.metrics.exclusionRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
