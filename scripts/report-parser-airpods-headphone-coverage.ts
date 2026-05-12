import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ExampleRow = {
  category: string;
  sourceReport: string;
};

type ExamplesReport = {
  rows: ExampleRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

const expectedCategories = ["earphone_discovered", "headphone_discovered"];

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const examples = await readJson<ExamplesReport>("parser-airpods-headphone-boundary-examples-latest.json");

  const rows = expectedCategories.map((category) => {
    const categoryRows = examples.rows.filter((row) => row.category === category);
    return {
      category,
      boundaryExampleCount: categoryRows.length,
      sourceCount: new Set(categoryRows.map((row) => row.sourceReport)).size,
      status: categoryRows.length > 0 ? "covered_report_only" : "missing_boundary_examples",
    };
  });

  const missing = rows.filter((row) => row.status === "missing_boundary_examples");
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    expectedCategories: expectedCategories.length,
    coveredCategories: rows.filter((row) => row.status === "covered_report_only").length,
    missingCategories: missing.length,
    totalExamples: examples.rows.length,
    rows,
    guardrails: [
      "Coverage check only",
      "No runtime catalog apply",
      "No public promotion",
      "No candidate pool policy wiring",
      "AirPods/headphone boundary coverage does not approve parser promotion",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-airpods-headphone-coverage-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| category | boundary_examples | source_count | status |",
    "| --- | ---: | ---: | --- |",
    ...rows.map((row) => `| ${row.category} | ${row.boundaryExampleCount} | ${row.sourceCount} | ${row.status} |`),
  ].join("\n");

  const md = [
    "# Parser AirPods Headphone Coverage",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only coverage check for AirPods/headphone boundary examples. This is not runtime wiring and not public promotion.",
    "",
    `Covered categories: ${report.coveredCategories}/${report.expectedCategories}`,
    `Missing categories: ${report.missingCategories}`,
    `Total examples: ${report.totalExamples}`,
    "",
    table,
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-airpods-headphone-coverage-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-airpods-headphone-coverage-latest.json");
  console.log("wrote reports/parser-airpods-headphone-coverage-latest.md");
  console.log(`airpods/headphone coverage: covered=${report.coveredCategories}/${report.expectedCategories}, missing=${report.missingCategories}`);
  if (missing.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
