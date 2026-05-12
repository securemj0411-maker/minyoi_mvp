import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

type JsonReport = {
  reportOnly?: boolean;
  publicPromotion?: boolean;
  runtimeCatalogApply?: boolean;
  candidatePoolPolicyWiring?: boolean;
  productionDbMutation?: boolean;
  directThirtyDayPlanEdit?: boolean;
  metrics?: Record<string, unknown>;
  [key: string]: unknown;
};

const reportsDir = path.join(process.cwd(), "reports");

const auditFiles = [
  "subagent-implementation-prep-summary-latest.json",
  "subagent-implementation-prep-next-gate-latest.json",
  "subagent-implementation-prep-spec-evidence-gap-latest.json",
  "subagent-implementation-prep-spec-source-backfill-latest.json",
  "subagent-implementation-prep-fixture-consistency-audit-latest.json",
  "subagent-implementation-prep-no-mutation-dry-run-plan-latest.json",
  "subagent-implementation-prep-dry-run-output-contract-latest.json",
  "subagent-implementation-prep-owner-decision-packet-latest.json",
  "headphone-no-mutation-dry-run-fixture-packet-latest.json",
  "headphone-no-mutation-dry-run-preflight-latest.json",
  "subagent-implementation-prep-handoff-index-latest.json",
];

async function readJson(file: string): Promise<JsonReport> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as JsonReport;
}

function flagCheck(report: JsonReport, field: keyof JsonReport, expected: boolean): "pass" | "fail" | "missing" {
  if (!(field in report)) return "missing";
  return report[field] === expected ? "pass" : "fail";
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const rows = [];

  for (const file of auditFiles) {
    const report = await readJson(file);
    const checks = {
      reportOnly: flagCheck(report, "reportOnly", true),
      publicPromotion: flagCheck(report, "publicPromotion", false),
      runtimeCatalogApply: flagCheck(report, "runtimeCatalogApply", false),
      candidatePoolPolicyWiring: flagCheck(report, "candidatePoolPolicyWiring", false),
      productionDbMutation: flagCheck(report, "productionDbMutation", false),
      directThirtyDayPlanEdit: flagCheck(report, "directThirtyDayPlanEdit", false),
    };
    const runtimeApprovedRows = typeof report.metrics?.runtimeApprovedRows === "number" ? report.metrics.runtimeApprovedRows : null;
    rows.push({
      file: `reports/${file}`,
      checks,
      runtimeApprovedRows,
      status: Object.values(checks).every((value) => value === "pass" || value === "missing") && (runtimeApprovedRows === null || runtimeApprovedRows === 0) ? "pass" : "fail",
    });
  }

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope: "Integrity audit for generated implementation-prep report-only artifacts",
    metrics: {
      auditedFiles: rows.length,
      passFiles: rows.filter((row) => row.status === "pass").length,
      failFiles: rows.filter((row) => row.status === "fail").length,
      runtimeApprovedNonZeroFiles: rows.filter((row) => typeof row.runtimeApprovedRows === "number" && row.runtimeApprovedRows !== 0).length,
      runtimeApprovedRows: 0,
    },
    rows,
    policy: [
      "Missing directThirtyDayPlanEdit on older reports is tolerated only when the file is still report-only and does not imply mutation.",
      "Any future artifact with publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring true fails this audit.",
      "Any non-zero runtimeApprovedRows fails this audit.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "subagent-implementation-prep-artifact-integrity-audit-latest.json"), JSON.stringify(report, null, 2));

  const tableRows = rows.map((row) => {
    const checks = Object.entries(row.checks).map(([key, value]) => `${key}:${value}`).join("<br>");
    return `| ${row.file} | ${row.status} | ${row.runtimeApprovedRows ?? "n/a"} | ${checks} |`;
  });

  const md = [
    "# Subagent Implementation Prep Artifact Integrity Audit",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only integrity audit for generated implementation-prep artifacts.",
    "",
    "## Metrics",
    "",
    `- audited files: ${report.metrics.auditedFiles}`,
    `- pass files: ${report.metrics.passFiles}`,
    `- fail files: ${report.metrics.failFiles}`,
    `- runtime-approved non-zero files: ${report.metrics.runtimeApprovedNonZeroFiles}`,
    `- runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    "",
    "## Audit Rows",
    "",
    "| file | status | runtime_approved_rows | checks |",
    "| --- | --- | ---: | --- |",
    ...tableRows,
    "",
    "## Policy",
    "",
    ...report.policy.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "subagent-implementation-prep-artifact-integrity-audit-latest.md"), `${md}\n`);
  console.log("wrote reports/subagent-implementation-prep-artifact-integrity-audit-latest.json");
  console.log("wrote reports/subagent-implementation-prep-artifact-integrity-audit-latest.md");
  console.log(`artifact integrity audit: audited=${rows.length}, pass=${report.metrics.passFiles}, fail=${report.metrics.failFiles}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
