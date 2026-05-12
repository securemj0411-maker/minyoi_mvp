import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type BoundaryExample = {
  category: string;
  sourceReport: string;
};

type BoundaryExamplesReport = {
  rows: BoundaryExample[];
};

type LedgerRow = {
  category: string;
  lane: string;
  evidenceReportCount: number;
};

type LedgerReport = {
  rows: LedgerRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

const excludedFromBoundaryExamples = new Set([
  "earphone_discovered",
  "headphone_discovered",
  "game_console_discovered",
]);

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const examples = await readJson<BoundaryExamplesReport>("parser-boundary-review-examples-latest.json");
  const ledger = await readJson<LedgerReport>("parser-category-evidence-ledger-latest.json");
  const exampleCounts = new Map<string, number>();
  const sourceCounts = new Map<string, Set<string>>();

  for (const row of examples.rows) {
    exampleCounts.set(row.category, (exampleCounts.get(row.category) ?? 0) + 1);
    const sources = sourceCounts.get(row.category) ?? new Set<string>();
    sources.add(row.sourceReport);
    sourceCounts.set(row.category, sources);
  }

  const rows = ledger.rows.map((row) => {
    const expectedBoundaryCoverage = !excludedFromBoundaryExamples.has(row.category);
    const boundaryExampleCount = exampleCounts.get(row.category) ?? 0;
    const boundarySourceCount = sourceCounts.get(row.category)?.size ?? 0;
    const status = !expectedBoundaryCoverage
      ? "not_expected_in_boundary_examples"
      : boundaryExampleCount > 0
        ? "covered_report_only"
        : "missing_boundary_examples";
    return {
      category: row.category,
      lane: row.lane,
      evidenceReportCount: row.evidenceReportCount,
      expectedBoundaryCoverage,
      boundaryExampleCount,
      boundarySourceCount,
      status,
    };
  });

  const missing = rows.filter((row) => row.status === "missing_boundary_examples");
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    totalCategories: rows.length,
    expectedCoveredCategories: rows.filter((row) => row.expectedBoundaryCoverage).length,
    coveredCategories: rows.filter((row) => row.status === "covered_report_only").length,
    missingBoundaryExampleCategories: missing.length,
    totalBoundaryExamples: examples.rows.length,
    rows,
    exampleCountByCategory: countBy(examples.rows.map((row) => row.category)),
    guardrails: [
      "Coverage check only",
      "No runtime catalog apply",
      "No public promotion",
      "No candidate pool policy wiring",
      "Missing examples do not imply approval or failure; they only indicate report-only follow-up work",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-boundary-example-coverage-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| category | lane | evidence_reports | expected | boundary_examples | boundary_sources | status |",
    "| --- | --- | ---: | --- | ---: | ---: | --- |",
    ...rows.map((row) => (
      `| ${row.category} | ${row.lane} | ${row.evidenceReportCount} | ${row.expectedBoundaryCoverage ? "yes" : "no"} | ${row.boundaryExampleCount} | ${row.boundarySourceCount} | ${row.status} |`
    )),
  ].join("\n");

  const md = [
    "# Parser Boundary Example Coverage",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only coverage check for boundary review examples. This is not runtime wiring and not public promotion.",
    "",
    `Expected covered categories: ${report.expectedCoveredCategories}`,
    `Covered categories: ${report.coveredCategories}`,
    `Missing boundary example categories: ${report.missingBoundaryExampleCategories}`,
    `Total boundary examples: ${report.totalBoundaryExamples}`,
    "",
    table,
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-boundary-example-coverage-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-boundary-example-coverage-latest.json");
  console.log("wrote reports/parser-boundary-example-coverage-latest.md");
  console.log(`boundary example coverage: covered=${report.coveredCategories}/${report.expectedCoveredCategories}, missing=${report.missingBoundaryExampleCategories}`);
  if (missing.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
