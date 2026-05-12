import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { reportCategoryEvidenceSpecs } from "./lib/report-category-evidence-spec";
import { reportCategoryEditorialSpecs } from "./lib/report-category-editorial-spec";
import { compileCategoryStatusContexts, loadReadinessRows } from "./lib/report-category-status-context";

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const contexts = compileCategoryStatusContexts({
    readinessRows: await loadReadinessRows(reportsDir),
    evidenceSpecs: reportCategoryEvidenceSpecs,
    editorialSpecs: reportCategoryEditorialSpecs,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    scope: "category/evidence/editorial/readiness context status",
    summary: {
      categories: contexts.length,
      withReadiness: contexts.filter((context) => context.readiness !== null).length,
      withoutReadiness: contexts.filter((context) => context.readiness === null).length,
      evidenceReports: contexts.reduce((sum, context) => sum + context.evidence.length, 0),
      missingEditorial: 0,
    },
    rows: contexts.map((context) => ({
      category: context.category,
      lane: context.readiness?.status ?? context.editorial.laneFallback,
      readinessMetric: context.readiness?.primaryMetric ?? context.editorial.readinessMetricFallback,
      evidenceReports: context.evidence.length,
      holdReasons: context.editorial.holdReasons.length,
      hasReadiness: context.readiness !== null,
      nextSafeReportOnlyTask: context.editorial.nextSafeReportOnlyTask,
    })),
    guardrails: [
      "Structure-only validation report",
      "No runtime parser wiring",
      "No candidate pool policy wiring",
      "No public promotion",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-category-context-status-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Parser Category Context Status",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- categories: ${report.summary.categories}`,
    `- with readiness: ${report.summary.withReadiness}`,
    `- without readiness: ${report.summary.withoutReadiness}`,
    `- evidence reports: ${report.summary.evidenceReports}`,
    "",
    "| category | lane | readiness_metric | evidence_reports | hold_reasons | has_readiness |",
    "| --- | --- | --- | ---: | ---: | --- |",
    ...report.rows.map(
      (row) =>
        `| ${row.category} | ${row.lane} | ${row.readinessMetric} | ${row.evidenceReports} | ${row.holdReasons} | ${row.hasReadiness ? "yes" : "no"} |`,
    ),
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-category-context-status-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-category-context-status-latest.json");
  console.log("wrote reports/parser-category-context-status-latest.md");
  console.log(
    `category context status categories=${report.summary.categories}; with_readiness=${report.summary.withReadiness}; evidence_reports=${report.summary.evidenceReports}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
