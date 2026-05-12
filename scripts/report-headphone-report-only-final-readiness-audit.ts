import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonReport = {
  reportOnly?: boolean;
  publicPromotion?: boolean;
  runtimeCatalogApply?: boolean;
  candidatePoolPolicyWiring?: boolean;
  productionDbMutation?: boolean;
  directThirtyDayPlanEdit?: boolean;
  metrics?: Record<string, unknown>;
  decision?: string;
  nextStep?: string;
  [key: string]: unknown;
};

const reportsDir = path.join(process.cwd(), "reports");

const auditFiles = [
  "headphone-no-mutation-dry-run-result-latest.json",
  "headphone-no-mutation-dry-run-review-packet-latest.json",
  "headphone-repeat-dry-run-expanded-fixture-packet-latest.json",
  "headphone-repeat-dry-run-preflight-latest.json",
  "headphone-repeat-no-mutation-dry-run-result-latest.json",
  "headphone-repeat-dry-run-review-packet-latest.json",
  "headphone-broader-brand-sku-evidence-plan-latest.json",
  "headphone-broader-brand-sku-source-backfill-latest.json",
  "headphone-brand-sku-guardrail-fixture-plan-latest.json",
  "headphone-brand-sku-guardrail-dry-run-contract-latest.json",
  "headphone-brand-sku-guardrail-dry-run-result-latest.json",
  "headphone-report-only-status-rollup-latest.json",
  "headphone-report-only-owner-decision-brief-latest.json",
  "headphone-broader-sample-mining-targets-latest.json",
  "headphone-no-collection-query-matrix-latest.json",
];

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

function boolStatus(report: JsonReport, key: keyof JsonReport, expected: boolean): "pass" | "fail" | "missing" {
  if (!(key in report)) return "missing";
  return report[key] === expected ? "pass" : "fail";
}

function metricNumber(report: JsonReport, key: string): number {
  const value = report.metrics?.[key];
  return typeof value === "number" ? value : 0;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const rows = [];

  for (const file of auditFiles) {
    const report = await readJson<JsonReport>(file);
    const checks = {
      reportOnly: boolStatus(report, "reportOnly", true),
      publicPromotion: boolStatus(report, "publicPromotion", false),
      runtimeCatalogApply: boolStatus(report, "runtimeCatalogApply", false),
      candidatePoolPolicyWiring: boolStatus(report, "candidatePoolPolicyWiring", false),
      productionDbMutation: boolStatus(report, "productionDbMutation", false),
      directThirtyDayPlanEdit: boolStatus(report, "directThirtyDayPlanEdit", false),
    };
    const runtimeApprovedRows = metricNumber(report, "runtimeApprovedRows");
    const publicPromotionRows = metricNumber(report, "publicPromotionRows");
    const candidatePoolWiringRows = metricNumber(report, "candidatePoolWiringRows");
    const failedRows = metricNumber(report, "failedRows");
    const validationErrors = metricNumber(report, "validationErrors");
    const status =
      Object.values(checks).every((value) => value === "pass") &&
      runtimeApprovedRows === 0 &&
      publicPromotionRows === 0 &&
      candidatePoolWiringRows === 0 &&
      failedRows === 0 &&
      validationErrors === 0
        ? "pass"
        : "fail";

    rows.push({
      file: `reports/${file}`,
      status,
      checks,
      runtimeApprovedRows,
      publicPromotionRows,
      candidatePoolWiringRows,
      failedRows,
      validationErrors,
      decision: report.decision ?? null,
      nextStep: report.nextStep ?? null,
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
    category: "headphone_discovered",
    scope: "Final readiness audit for headphone report-only artifacts",
    metrics: {
      auditedFiles: rows.length,
      passFiles: rows.filter((row) => row.status === "pass").length,
      failFiles: rows.filter((row) => row.status === "fail").length,
      runtimeApprovedRowsTotal: rows.reduce((sum, row) => sum + row.runtimeApprovedRows, 0),
      publicPromotionRowsTotal: rows.reduce((sum, row) => sum + row.publicPromotionRows, 0),
      candidatePoolWiringRowsTotal: rows.reduce((sum, row) => sum + row.candidatePoolWiringRows, 0),
      failedRowsTotal: rows.reduce((sum, row) => sum + row.failedRows, 0),
      validationErrorsTotal: rows.reduce((sum, row) => sum + row.validationErrors, 0),
    },
    rows,
    conclusion:
      rows.every((row) => row.status === "pass")
        ? "headphone_report_only_chain_ready_for_owner_review_no_runtime_approval"
        : "headphone_report_only_chain_has_failures",
    allowedNextWithoutRuntimeApproval: [
      "keep report-only",
      "request explicit approval for live/report-only collection",
      "prepare but do not execute a runtime review request",
    ],
    forbiddenStill: [
      "runtime parser/catalog/category-readiness/candidate-pool edits",
      "public promotion",
      "production DB or Supabase writes",
      "cron/lifecycle/debug/pack UI changes",
      "30일_실행계획.md direct edits",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-report-only-final-readiness-audit-latest.json"), JSON.stringify(report, null, 2));

  const tableRows = rows.map((row) => {
    const checkSummary = Object.entries(row.checks).map(([key, value]) => `${key}:${value}`).join("<br>");
    return `| ${row.file} | ${row.status} | ${row.runtimeApprovedRows}/${row.publicPromotionRows}/${row.candidatePoolWiringRows} | ${row.failedRows} | ${row.validationErrors} | ${checkSummary} |`;
  });

  const md = [
    "# Headphone Report-Only Final Readiness Audit",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Final report-only readiness audit for headphone_discovered artifacts. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- audited files: ${report.metrics.auditedFiles}`,
    `- pass/fail files: ${report.metrics.passFiles}/${report.metrics.failFiles}`,
    `- runtime-approved/public/candidate-pool rows total: ${report.metrics.runtimeApprovedRowsTotal}/${report.metrics.publicPromotionRowsTotal}/${report.metrics.candidatePoolWiringRowsTotal}`,
    `- failed rows total: ${report.metrics.failedRowsTotal}`,
    `- validation errors total: ${report.metrics.validationErrorsTotal}`,
    "",
    "## Audit Rows",
    "",
    "| file | status | runtime/public/pool rows | failed_rows | validation_errors | checks |",
    "| --- | --- | --- | ---: | ---: | --- |",
    ...tableRows,
    "",
    "## Conclusion",
    "",
    report.conclusion,
    "",
    "## Allowed Next Without Runtime Approval",
    "",
    ...report.allowedNextWithoutRuntimeApproval.map((item) => `- ${item}`),
    "",
    "## Forbidden Still",
    "",
    ...report.forbiddenStill.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-report-only-final-readiness-audit-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-report-only-final-readiness-audit-latest.json");
  console.log("wrote reports/headphone-report-only-final-readiness-audit-latest.md");
  console.log(`headphone final readiness audit: pass=${report.metrics.passFiles}, fail=${report.metrics.failFiles}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
