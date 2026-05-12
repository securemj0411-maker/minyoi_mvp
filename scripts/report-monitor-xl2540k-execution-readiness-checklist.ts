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
    strictAllowedRows: number;
    maxFutureWriteCap: number;
    optionalRows: number;
    excludedRows: number;
    falseHoldRecoveredRows: number;
  };
  ownerDecision: {
    recommendedDecision: string;
    notApprovedHere: string[];
    executionPrerequisites: string[];
  };
  riskNotes: string[];
  allowedRows: Array<{
    pid: string;
    title: string;
    price: number;
    modelCode: string;
    saleStatus: string;
    accessoryFalseHoldRecovery?: boolean;
  }>;
  optionalRows: Array<{
    pid: string;
    title: string;
    modelCode: string;
    saleStatus: string;
  }>;
  excludedRows: Array<{
    pid: string;
    title: string;
    modelCode: string;
    disposition: string;
    reason: string;
  }>;
};

type SourceConfidence = {
  rows: Array<{
    modelCode: string;
    sourceTier: string;
    sourceConfidence: string;
    observationReadiness: string;
    sourceVerifiedSpec: Record<string, string>;
    sourceUrl: string | null;
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
  const ownerPacket = await readJson<OwnerPacket>("monitor-xl2540k-owner-review-packet-latest.json");
  const sourceConfidence = await readJson<SourceConfidence>("monitor-selected-exact-model-source-confidence-latest.json");
  const sourceRow = sourceConfidence.rows.find((row) => row.modelCode === "xl2540k") ?? null;

  const checks = [
    {
      check: "official_source_confidence",
      status: sourceRow?.sourceTier === "official_product" && sourceRow.sourceConfidence === "high" ? "pass" : "fail",
      evidence: sourceRow
        ? `${sourceRow.sourceTier}/${sourceRow.sourceConfidence}; ${Object.entries(sourceRow.sourceVerifiedSpec).map(([key, value]) => `${key}:${value}`).join(", ")}; ${sourceRow.sourceUrl ?? "-"}`
        : "missing",
    },
    {
      check: "allowed_rows_minimum",
      status: ownerPacket.metrics.strictAllowedRows >= 5 ? "pass" : "fail",
      evidence: `strictAllowedRows=${ownerPacket.metrics.strictAllowedRows}`,
    },
    {
      check: "write_cap_conservative",
      status: ownerPacket.metrics.maxFutureWriteCap <= 5 ? "pass" : "fail",
      evidence: `maxFutureWriteCap=${ownerPacket.metrics.maxFutureWriteCap}`,
    },
    {
      check: "public_promotion_closed",
      status: ownerPacket.ownerDecision.notApprovedHere.includes("public candidate pack promotion") ? "pass" : "fail",
      evidence: ownerPacket.ownerDecision.notApprovedHere.join(", "),
    },
    {
      check: "fresh_detail_required",
      status: ownerPacket.ownerDecision.executionPrerequisites.includes("fresh_detail_refetch_within_same_request") ? "pass" : "fail",
      evidence: ownerPacket.ownerDecision.executionPrerequisites.join(", "),
    },
    {
      check: "false_hold_recovery_documented",
      status: ownerPacket.metrics.falseHoldRecoveredRows >= 1 ? "pass" : "warn",
      evidence: `falseHoldRecoveredRows=${ownerPacket.metrics.falseHoldRecoveredRows}`,
    },
    {
      check: "optional_aw2525hm_not_in_first_lane",
      status: ownerPacket.optionalRows.every((row) => row.modelCode === "alienware-aw2525hm") ? "pass" : "fail",
      evidence: ownerPacket.optionalRows.map((row) => `${row.pid}:${row.modelCode}:${row.saleStatus}`).join(", ") || "none",
    },
    {
      check: "sold_aw2525hm_excluded",
      status: ownerPacket.excludedRows.some((row) => row.modelCode === "alienware-aw2525hm" && row.reason === "not_selling") ? "pass" : "fail",
      evidence: ownerPacket.excludedRows.map((row) => `${row.pid}:${row.modelCode}:${row.reason}`).join(", "),
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
    ownership: "monitor_xl2540k_execution_readiness_checklist",
    category: ownerPacket.category,
    target: ownerPacket.target,
    sourceReports: [
      "monitor-xl2540k-owner-review-packet-latest.json",
      "monitor-selected-exact-model-source-confidence-latest.json",
      "monitor-model-code-spec-evidence-packet-latest.json",
    ],
    metrics: {
      checks: checks.length,
      passChecks: passChecks.length,
      warningChecks: warningChecks.length,
      failedChecks: failedChecks.length,
      allowedRows: ownerPacket.metrics.strictAllowedRows,
      maxFutureWriteCap: ownerPacket.metrics.maxFutureWriteCap,
    },
    checks,
    runbookIfLaterApproved: [
      "Do not run while other main-agent P0 runtime/Supabase work is still active.",
      "Fresh-refetch each allowed pid inside the same execution request.",
      "Abort if any row is not SELLING, model code changes, or sold/buying/damaged/accessory-only text appears.",
      "Write at most 5 rows if a future owner-approved internal-only executor exists.",
      "Keep public candidate-pack promotion closed until observed market stats and lifecycle checks stabilize.",
    ],
    rollbackTriggers: [
      "Any false positive accessory-only or monitor-arm-only row enters allowed set.",
      "Any public/candidate-pool row is created from this packet.",
      "Source health degrades during or immediately after a future tiny execution.",
      "XL2540K comparable key differs across fresh detail and contract.",
    ],
    conclusion: failedChecks.length === 0
      ? "monitor_xl2540k_execution_readiness_checklist_passed_report_only"
      : "monitor_xl2540k_execution_readiness_checklist_failed_review_required",
    nextStep:
      "Keep this checklist dormant until P0 stabilization is complete and owner explicitly approves a tiny internal-only no-public executor.",
  };

  const jsonPath = path.join(reportsDir, "monitor-xl2540k-execution-readiness-checklist-latest.json");
  const mdPath = path.join(reportsDir, "monitor-xl2540k-execution-readiness-checklist-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Monitor XL2540K Execution Readiness Checklist",
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
    warningChecks: report.metrics.warningChecks,
    failedChecks: report.metrics.failedChecks,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
