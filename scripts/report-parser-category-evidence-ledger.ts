import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { reportCategoryEvidenceSpecs } from "./lib/report-category-evidence-spec";
import { reportCategoryEditorialSpecs } from "./lib/report-category-editorial-spec";
import { compileCategoryStatusContexts, loadReadinessRows, readReportJson } from "./lib/report-category-status-context";

type EvidenceSpec = {
  file: string;
  role: string;
  metrics: string[];
};

type EvidenceSummary = {
  file: string;
  role: string;
  highlights: string[];
  runtimeApprovedRows: number;
};

const reportsDir = path.join(process.cwd(), "reports");

function getNestedMetric(report: Record<string, unknown>, key: string): unknown {
  const metrics = report.metrics as Record<string, unknown> | undefined;
  if (metrics && key in metrics) return metrics[key];
  return report[key];
}

function metricText(report: Record<string, unknown>, key: string): string | null {
  const value = getNestedMetric(report, key);
  if (typeof value === "number") return `${key}=${value}`;
  if (typeof value === "string") return `${key}=${value}`;
  return null;
}

async function evidenceSummary(spec: EvidenceSpec): Promise<EvidenceSummary> {
  const report = await readReportJson<Record<string, unknown>>(reportsDir, spec.file);
  const highlights = spec.metrics
    .map((metric) => metricText(report, metric))
    .filter((metric): metric is string => Boolean(metric));
  const runtimeApprovedRows = Number(getNestedMetric(report, "runtimeApprovedRows") ?? 0);
  return {
    file: spec.file,
    role: spec.role,
    highlights,
    runtimeApprovedRows: Number.isFinite(runtimeApprovedRows) ? runtimeApprovedRows : 0,
  };
}

async function main(): Promise<void> {
  const contexts = compileCategoryStatusContexts({
    readinessRows: await loadReadinessRows(reportsDir),
    evidenceSpecs: reportCategoryEvidenceSpecs,
    editorialSpecs: reportCategoryEditorialSpecs,
  });
  const rows = [];

  for (const context of contexts) {
    const evidence = await Promise.all(context.evidence.map(evidenceSummary));
    rows.push({
      category: context.category,
      lane: context.readiness?.status ?? context.editorial.laneFallback,
      readinessMetric: context.readiness?.primaryMetric ?? context.editorial.readinessMetricFallback,
      readinessCaveat: context.readiness?.caveat ?? "",
      evidenceReportCount: evidence.length,
      evidence,
      runtimeApprovedRows: evidence.reduce((sum, item) => sum + item.runtimeApprovedRows, 0),
      holdReasons: context.editorial.holdReasons,
      nextSafeReportOnlyTask: context.editorial.nextSafeReportOnlyTask,
      existingNextAction: context.readiness?.nextAction ?? "",
    });
  }

  const lanes = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.lane] = (acc[row.lane] ?? 0) + 1;
    return acc;
  }, {});
  const runtimeApprovedRows = rows.reduce((sum, row) => sum + row.runtimeApprovedRows, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    summary: {
      categories: rows.length,
      evidenceReportsUsed: rows.reduce((sum, row) => sum + row.evidenceReportCount, 0),
      lanes,
      runtimeApprovedRows,
      status: runtimeApprovedRows === 0 ? "report_only_no_runtime_rows" : "check_runtime_rows",
    },
    rows,
    guardrails: [
      "Report-only category evidence ledger",
      "No runtime catalog apply",
      "No public promotion",
      "No candidate pool policy wiring",
      "parser_candidate is not public approval",
      "Do not edit 30일_실행계획.md from this phase",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-category-evidence-ledger-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| category | lane | readiness | evidence_reports | runtime_rows | next_report_only_task |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => {
      const evidenceFiles = row.evidence.map((item) => item.file.replace("-latest.json", "")).join("<br>");
      return `| ${row.category} | ${row.lane} | ${row.readinessMetric} | ${evidenceFiles} | ${row.runtimeApprovedRows} | ${row.nextSafeReportOnlyTask} |`;
    }),
  ].join("\n");

  const detail = rows
    .map((row) => {
      const evidenceLines = row.evidence.flatMap((item) => [
        `- ${item.file}: ${item.role}`,
        `  - ${item.highlights.join("; ") || "no metrics"}`,
      ]);
      return [`## ${row.category}`, "", ...evidenceLines, "", "Hold/readiness notes:", ...row.holdReasons.map((reason) => `- ${reason}`)].join("\n");
    })
    .join("\n\n");

  const md = [
    "# Parser Category Evidence Ledger",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only category progress ledger. This does not approve public promotion, runtime catalog apply, or candidate pool policy wiring.",
    "",
    `Categories: ${report.summary.categories}`,
    `Evidence reports used: ${report.summary.evidenceReportsUsed}`,
    `Runtime-approved rows: ${report.summary.runtimeApprovedRows}`,
    "",
    table,
    "",
    detail,
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-category-evidence-ledger-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-category-evidence-ledger-latest.json");
  console.log("wrote reports/parser-category-evidence-ledger-latest.md");
  console.log(`category evidence ledger categories=${report.summary.categories}; evidence_reports=${report.summary.evidenceReportsUsed}; runtime_rows=${report.summary.runtimeApprovedRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
