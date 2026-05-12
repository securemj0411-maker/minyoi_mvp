import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type LedgerRow = {
  category: string;
  lane: string;
  evidenceReportCount: number;
};

type LedgerReport = {
  rows: LedgerRow[];
};

type BoundaryCoverageRow = {
  category: string;
  boundaryExampleCount: number;
  boundarySourceCount: number;
  status: string;
};

type BoundaryCoverageReport = {
  totalBoundaryExamples: number;
  rows: BoundaryCoverageRow[];
};

type AirpodsHeadphoneCoverageRow = {
  category: string;
  boundaryExampleCount: number;
  sourceCount: number;
  status: string;
};

type AirpodsHeadphoneCoverageReport = {
  totalExamples: number;
  rows: AirpodsHeadphoneCoverageRow[];
};

const reportsDir = path.join(process.cwd(), "reports");
const splitOnlyDocumentedCategories = new Set(["game_console_discovered"]);

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const ledger = await readJson<LedgerReport>("parser-category-evidence-ledger-latest.json");
  const boundaryCoverage = await readJson<BoundaryCoverageReport>("parser-boundary-example-coverage-latest.json");
  const airpodsCoverage = await readJson<AirpodsHeadphoneCoverageReport>("parser-airpods-headphone-coverage-latest.json");

  const boundaryByCategory = new Map(boundaryCoverage.rows.map((row) => [row.category, row]));
  const airpodsByCategory = new Map(airpodsCoverage.rows.map((row) => [row.category, row]));

  const rows = ledger.rows.map((row) => {
    const boundary = boundaryByCategory.get(row.category);
    const airpods = airpodsByCategory.get(row.category);
    const splitOnlyDocumented = splitOnlyDocumentedCategories.has(row.category);
    const reviewExampleCount = (boundary?.boundaryExampleCount ?? 0) + (airpods?.boundaryExampleCount ?? 0);
    const sourceCount = (boundary?.boundarySourceCount ?? 0) + (airpods?.sourceCount ?? 0);
    const status = reviewExampleCount > 0
      ? "covered_report_only"
      : splitOnlyDocumented
        ? "split_only_documented"
        : "missing_review_evidence";

    return {
      category: row.category,
      lane: row.lane,
      evidenceReportCount: row.evidenceReportCount,
      generalBoundaryExamples: boundary?.boundaryExampleCount ?? 0,
      airpodsHeadphoneExamples: airpods?.boundaryExampleCount ?? 0,
      reviewExampleCount,
      sourceCount,
      splitOnlyDocumented,
      status,
    };
  });

  const missing = rows.filter((row) => row.status === "missing_review_evidence");
  const coveredReportOnly = rows.filter((row) => row.status === "covered_report_only").length;
  const splitOnlyDocumented = rows.filter((row) => row.status === "split_only_documented").length;
  const reviewCoverageClosed = coveredReportOnly + splitOnlyDocumented;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    totalCategories: rows.length,
    coveredReportOnlyCategories: coveredReportOnly,
    splitOnlyDocumentedCategories: splitOnlyDocumented,
    reviewCoverageClosedCategories: reviewCoverageClosed,
    missingReviewEvidenceCategories: missing.length,
    generalBoundaryExamples: boundaryCoverage.totalBoundaryExamples,
    airpodsHeadphoneExamples: airpodsCoverage.totalExamples,
    totalReviewExamples: boundaryCoverage.totalBoundaryExamples + airpodsCoverage.totalExamples,
    rows,
    guardrails: [
      "Review coverage summary only",
      "No runtime catalog apply",
      "No public promotion",
      "No candidate pool policy wiring",
      "Split-only documented categories are not parser approval",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-review-coverage-summary-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| category | lane | evidence_reports | general_examples | airpods_headphone_examples | total_examples | sources | split_only | status |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...rows.map((row) => (
      `| ${row.category} | ${row.lane} | ${row.evidenceReportCount} | ${row.generalBoundaryExamples} | ${row.airpodsHeadphoneExamples} | ${row.reviewExampleCount} | ${row.sourceCount} | ${row.splitOnlyDocumented ? "yes" : "no"} | ${row.status} |`
    )),
  ].join("\n");

  const md = [
    "# Parser Review Coverage Summary",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only rollup for category review evidence coverage. This does not approve runtime wiring, public promotion, or candidate pool policy wiring.",
    "",
    `Total categories: ${report.totalCategories}`,
    `Covered report-only categories: ${report.coveredReportOnlyCategories}`,
    `Split-only documented categories: ${report.splitOnlyDocumentedCategories}`,
    `Review coverage closed categories: ${report.reviewCoverageClosedCategories}`,
    `Missing review evidence categories: ${report.missingReviewEvidenceCategories}`,
    `General boundary examples: ${report.generalBoundaryExamples}`,
    `AirPods/headphone examples: ${report.airpodsHeadphoneExamples}`,
    `Total review examples: ${report.totalReviewExamples}`,
    "",
    table,
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-review-coverage-summary-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-review-coverage-summary-latest.json");
  console.log("wrote reports/parser-review-coverage-summary-latest.md");
  console.log(`review coverage summary: closed=${report.reviewCoverageClosedCategories}/${report.totalCategories}, missing=${report.missingReviewEvidenceCategories}, examples=${report.totalReviewExamples}`);
  if (missing.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
