import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type OwnerPacket = {
  category: string;
  target: string;
  metrics: {
    allowedRows: number;
    allowedSkus: number;
    maxFutureWriteCap: number;
    sourceCoveredSkus: number;
    missingSourceSkus: string[];
    newOrUnopenedRows: number;
  };
  ownerDecision: {
    notApprovedHere: string[];
    reviewPrerequisites: string[];
  };
  allowedRows: Array<{
    pid: number;
    title: string;
    skuId: string;
    comparableKey: string;
    runtimeSkuId: string;
    runtimeComparableKey: string;
    runtimeNeedsReview: boolean;
  }>;
  excludedRows: Array<{
    pid: number;
    title: string;
    skuId: string;
    reason: string;
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
  const ownerPacket = await readJson<OwnerPacket>("headphone-sony-first-wave-owner-review-packet-latest.json");
  const sameSkuAndKey = ownerPacket.allowedRows.every(
    (row) => row.skuId === row.runtimeSkuId && row.comparableKey === row.runtimeComparableKey && !row.runtimeNeedsReview,
  );
  const excludedCoverage = ["accessory_only_text", "buying_or_trade_text", "damaged_or_parts_text"].every((needle) =>
    ownerPacket.excludedRows.some((row) => row.reason.includes(needle)),
  );
  const checks = [
    {
      check: "source_evidence_for_all_allowed_skus",
      status: ownerPacket.metrics.missingSourceSkus.length === 0 ? "pass" : "fail",
      evidence: `missingSourceSkus=${ownerPacket.metrics.missingSourceSkus.join(", ") || "none"}`,
    },
    {
      check: "allowed_rows_minimum",
      status: ownerPacket.metrics.allowedRows >= 7 ? "pass" : "fail",
      evidence: `allowedRows=${ownerPacket.metrics.allowedRows}`,
    },
    {
      check: "write_cap_conservative",
      status: ownerPacket.metrics.maxFutureWriteCap <= 7 ? "pass" : "fail",
      evidence: `maxFutureWriteCap=${ownerPacket.metrics.maxFutureWriteCap}`,
    },
    {
      check: "same_sku_and_key_after_detail",
      status: sameSkuAndKey ? "pass" : "fail",
      evidence: ownerPacket.allowedRows.map((row) => `${row.pid}:${row.skuId}/${row.runtimeSkuId}:${row.comparableKey}/${row.runtimeComparableKey}`).join(", "),
    },
    {
      check: "hard_hold_examples_present",
      status: excludedCoverage ? "pass" : "fail",
      evidence: ownerPacket.excludedRows.map((row) => `${row.pid}:${row.reason}`).join(", "),
    },
    {
      check: "public_promotion_closed",
      status: ownerPacket.ownerDecision.notApprovedHere.includes("public candidate pack promotion") ? "pass" : "fail",
      evidence: ownerPacket.ownerDecision.notApprovedHere.join(", "),
    },
    {
      check: "fresh_detail_required",
      status: ownerPacket.ownerDecision.reviewPrerequisites.includes("fresh_detail_refetch_within_same_request") ? "pass" : "fail",
      evidence: ownerPacket.ownerDecision.reviewPrerequisites.join(", "),
    },
    {
      check: "deferred_bose_qc45_not_included",
      status: ownerPacket.allowedRows.every((row) => row.skuId !== "bose-qc45") ? "pass" : "fail",
      evidence: ownerPacket.allowedRows.map((row) => `${row.pid}:${row.skuId}`).join(", "),
    },
  ];
  const failedChecks = checks.filter((row) => row.status === "fail");
  const passChecks = checks.filter((row) => row.status === "pass");
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    ownership: "headphone_sony_first_wave_execution_readiness_checklist",
    category: ownerPacket.category,
    target: ownerPacket.target,
    sourceReports: [
      "headphone-sony-first-wave-owner-review-packet-latest.json",
      "headphone-first-wave-strict-write-cap-contract-latest.json",
      "headphone-sony-first-wave-source-backfill-latest.json",
    ],
    metrics: {
      checks: checks.length,
      passChecks: passChecks.length,
      warningChecks: 0,
      failedChecks: failedChecks.length,
      allowedRows: ownerPacket.metrics.allowedRows,
      maxFutureWriteCap: ownerPacket.metrics.maxFutureWriteCap,
    },
    checks,
    runbookIfLaterApproved: [
      "Do not run while other main-agent P0 runtime/Supabase work is still active.",
      "Fresh-refetch every allowed pid in the same execution request.",
      "Abort if SKU/comparable key changes, needsReview becomes true, or sold/buying/damaged/accessory-only text appears.",
      "Write at most 7 rows if a future owner-approved internal-only executor exists.",
      "Keep public candidate-pack promotion closed until observed market stats and lifecycle checks stabilize.",
    ],
    rollbackTriggers: [
      "Any Bose QC45 or other deferred SKU enters the allowed set.",
      "Any accessory-only, pad/cable/parts, counterfeit/compatible, buying/trade, or damaged row enters the allowed set.",
      "Any public/candidate-pool row is created from this packet.",
      "Sony WH comparable key differs across fresh detail and contract.",
    ],
    conclusion: failedChecks.length === 0
      ? "headphone_sony_first_wave_execution_readiness_checklist_passed_report_only"
      : "headphone_sony_first_wave_execution_readiness_checklist_failed_review_required",
    nextStep: failedChecks.length === 0
      ? "Keep dormant until P0 stabilization is complete and owner explicitly approves tiny internal-only no-public execution."
      : "Fix failed checklist items before any runtime or acquisition executor.",
  };

  const jsonPath = path.join(reportsDir, "headphone-sony-first-wave-execution-readiness-checklist-latest.json");
  const mdPath = path.join(reportsDir, "headphone-sony-first-wave-execution-readiness-checklist-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Headphone Sony First Wave Execution Readiness Checklist",
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
    mdTable(
      ["check", "status", "evidence"],
      checks.map((row) => [row.check, row.status, row.evidence]),
    ),
    "",
    "## Runbook If Later Approved",
    "",
    ...report.runbookIfLaterApproved.map((item) => `- ${item}`),
    "",
    "## Rollback Triggers",
    "",
    ...report.rollbackTriggers.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    passChecks: report.metrics.passChecks,
    failedChecks: report.metrics.failedChecks,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
