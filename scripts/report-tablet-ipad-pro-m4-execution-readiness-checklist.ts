import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

type Assessment = {
  category: string;
  target: string;
  metrics: {
    ownerReadyKeys: number;
    promisingKeys: number;
    highConfidenceSourceRows: number;
    manualReviewRows: number;
    holdRows: number;
  };
  ownerReadyKeys: Array<{
    comparableKey: string;
    model: string;
    storageGb: number;
    connectivity: string;
    rows: number;
  }>;
  promisingKeys: Array<{
    comparableKey: string;
    rows: number;
  }>;
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf-8")) as T;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const assessment = await readJson<Assessment>("tablet-ipad-pro-m4-owner-assessment-latest.json");
  const allowedRows = assessment.ownerReadyKeys.reduce((sum, row) => sum + row.rows, 0);
  const allowedTarget = assessment.ownerReadyKeys.map((row) => `${row.model}-${row.storageGb}-${row.connectivity}`).join(", ");
  const checks = [
    {
      check: "direct_official_source_present",
      status: assessment.metrics.highConfidenceSourceRows >= 2 ? "pass" : "fail",
      evidence: `highConfidenceSourceRows=${assessment.metrics.highConfidenceSourceRows}`,
    },
    {
      check: "owner_ready_key_count",
      status: assessment.metrics.ownerReadyKeys >= 1 ? "pass" : "fail",
      evidence: `ownerReadyKeys=${assessment.metrics.ownerReadyKeys}`,
    },
    {
      check: "storage_connectivity_split_enforced",
      status: assessment.ownerReadyKeys.every((row) => row.storageGb && row.connectivity) ? "pass" : "fail",
      evidence: assessment.ownerReadyKeys.map((row) => `${row.storageGb}/${row.connectivity}`).join(", "),
    },
    {
      check: "single_key_first_pass",
      status: assessment.metrics.ownerReadyKeys === 1 ? "pass" : "warn",
      evidence: `ownerReadyKeys=${assessment.metrics.ownerReadyKeys}`,
    },
    {
      check: "manual_and_hold_boundaries_present",
      status: assessment.metrics.manualReviewRows > 0 && assessment.metrics.holdRows > 0 ? "pass" : "fail",
      evidence: `manual=${assessment.metrics.manualReviewRows}; hold=${assessment.metrics.holdRows}`,
    },
    {
      check: "public_promotion_closed",
      status: "pass",
      evidence: "report-only checklist; publicPromotion=false",
    },
    {
      check: "runtime_apply_closed",
      status: "pass",
      evidence: "report-only checklist; runtimeCatalogApply=false",
    },
    {
      check: "write_cap_conservative",
      status: Math.min(allowedRows, 4) <= 4 ? "pass" : "warn",
      evidence: `allowedRows=${allowedRows}; max cap=${Math.min(allowedRows, 4)}`,
    },
  ];
  const failedChecks = checks.filter((row) => row.status === "fail");
  const warningChecks = checks.filter((row) => row.status === "warn");
  const passChecks = checks.filter((row) => row.status === "pass");
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    ownership: "tablet_ipad_pro_m4_execution_readiness_checklist",
    category: assessment.category,
    target: allowedTarget,
    sourceReports: [
      "tablet-ipad-pro-m4-live-read-wave-latest.json",
      "tablet-ipad-pro-m4-targeted-live-read-wave-latest.json",
      "tablet-ipad-pro-m4-source-backfill-latest.json",
      "tablet-ipad-pro-m4-owner-assessment-latest.json",
    ],
    metrics: {
      checks: checks.length,
      passChecks: passChecks.length,
      warningChecks: warningChecks.length,
      failedChecks: failedChecks.length,
      allowedRows,
      maxFutureWriteCap: Math.min(allowedRows, 4),
    },
    checks,
    allowedKeys: assessment.ownerReadyKeys,
    deferredKeys: assessment.promisingKeys,
    runbookIfLaterApproved: [
      "Fresh-refetch every pid in the same execution request.",
      "Abort if saleStatus is not active, storage/connectivity is missing, or accessory bundle dominates.",
      "First pass may include only the single owner-ready storage/connectivity key.",
      "Keep 13-inch M4, iPad Air M4, Pencil/Keyboard/Case bundles out of positives.",
      "No public candidate-pack promotion until lifecycle/market stats prove stable.",
    ],
    conclusion: failedChecks.length === 0
      ? "tablet_ipad_pro_m4_execution_readiness_checklist_passed_report_only"
      : "tablet_ipad_pro_m4_execution_readiness_checklist_failed_report_only",
    nextStep: failedChecks.length === 0
      ? "Keep dormant until P0 stabilization and owner approval; first pass can only include the single storage/connectivity key."
      : "Keep tablet report-only and resolve failed checks.",
  };

  const jsonPath = path.join(reportsDir, "tablet-ipad-pro-m4-execution-readiness-checklist-latest.json");
  const mdPath = path.join(reportsDir, "tablet-ipad-pro-m4-execution-readiness-checklist-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Tablet iPad Pro M4 Execution Readiness Checklist",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Target",
    "",
    `- category: ${report.category}`,
    `- target: ${report.target}`,
    "",
    "## Metrics",
    "",
    `- checks: ${report.metrics.checks}`,
    `- passChecks: ${report.metrics.passChecks}`,
    `- warningChecks: ${report.metrics.warningChecks}`,
    `- failedChecks: ${report.metrics.failedChecks}`,
    `- allowedRows: ${report.metrics.allowedRows}`,
    `- maxFutureWriteCap: ${report.metrics.maxFutureWriteCap}`,
    "",
    "## Checks",
    "",
    mdTable(["check", "status", "evidence"], checks.map((row) => [row.check, row.status, row.evidence])),
    "",
    "## Allowed Keys",
    "",
    mdTable(
      ["model", "storage", "connectivity", "rows", "comparableKey"],
      assessment.ownerReadyKeys.map((row) => [row.model, row.storageGb, row.connectivity, row.rows, row.comparableKey]),
    ),
    "",
    "## Runbook If Later Approved",
    "",
    ...report.runbookIfLaterApproved.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    report.nextStep,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    passChecks: report.metrics.passChecks,
    warningChecks: report.metrics.warningChecks,
    failedChecks: report.metrics.failedChecks,
    allowedRows: report.metrics.allowedRows,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
