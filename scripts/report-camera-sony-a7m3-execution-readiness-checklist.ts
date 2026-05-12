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
    directSourceRows: number;
    packageBoundaryEvidenceRows: number;
    secondWaveRequired: boolean;
  };
  ownerDecision: {
    notApprovedHere: string[];
    reviewPrerequisites: string[];
  };
  excludedRows: Array<{
    pid: string;
    title: string;
    model: string;
    disposition: string;
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
  const ownerPacket = await readJson<OwnerPacket>("camera-sony-a7m3-owner-review-packet-latest.json");
  const notSellingHold = ownerPacket.excludedRows.some((row) => row.reason.includes("not_selling"));
  const buyingHold = ownerPacket.excludedRows.some((row) => row.reason.includes("buying_text"));
  const checks = [
    {
      check: "direct_official_source_present",
      status: ownerPacket.metrics.directSourceRows >= 1 ? "pass" : "fail",
      evidence: `directSourceRows=${ownerPacket.metrics.directSourceRows}`,
    },
    {
      check: "allowed_rows_minimum",
      status: ownerPacket.metrics.strictAllowedRows >= 4 ? "pass" : "warn",
      evidence: `strictAllowedRows=${ownerPacket.metrics.strictAllowedRows}; target minimum before execution is 4`,
    },
    {
      check: "second_live_wave_clean_row_threshold",
      status: ownerPacket.metrics.secondWaveRequired ? "fail" : "pass",
      evidence: `secondWaveRequired=${ownerPacket.metrics.secondWaveRequired}; requires at least 4 unique clean body-only rows`,
    },
    {
      check: "write_cap_conservative",
      status: ownerPacket.metrics.maxFutureWriteCap <= 2 ? "pass" : "fail",
      evidence: `maxFutureWriteCap=${ownerPacket.metrics.maxFutureWriteCap}`,
    },
    {
      check: "hard_hold_examples_present",
      status: notSellingHold && buyingHold ? "pass" : "fail",
      evidence: ownerPacket.excludedRows.map((row) => `${row.pid}:${row.reason}`).join(", "),
    },
    {
      check: "public_promotion_closed",
      status: ownerPacket.ownerDecision.notApprovedHere.includes("public candidate pack promotion") ? "pass" : "fail",
      evidence: ownerPacket.ownerDecision.notApprovedHere.join(", "),
    },
    {
      check: "body_only_context_required",
      status: ownerPacket.ownerDecision.reviewPrerequisites.includes("body_only_context_present") ? "pass" : "fail",
      evidence: ownerPacket.ownerDecision.reviewPrerequisites.join(", "),
    },
    {
      check: "same_model_after_detail_required",
      status: ownerPacket.ownerDecision.reviewPrerequisites.includes("same_model_code_after_detail") ? "pass" : "fail",
      evidence: ownerPacket.ownerDecision.reviewPrerequisites.join(", "),
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
    ownership: "camera_sony_a7m3_execution_readiness_checklist",
    category: ownerPacket.category,
    target: ownerPacket.target,
    sourceReports: [
      "camera-sony-a7m3-owner-review-packet-latest.json",
      "camera-body-only-strict-contract-latest.json",
      "camera-sony-a7m3-source-backfill-latest.json",
      "camera-a7m3-second-live-read-wave-latest.json",
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
      "Do not execute until a second no-write live-read wave raises body-only confidence.",
      "Fresh-refetch every allowed pid in the same execution request.",
      "Abort if saleStatus is not SELLING, body-only/no-lens context disappears, or model changes away from A7M3/ILCE-7M3.",
      "Write at most 2 rows if a future owner-approved internal-only executor exists.",
      "Keep public candidate-pack promotion closed until observed market stats and lifecycle checks stabilize.",
    ],
    rollbackTriggers: [
      "Any lens kit, full-box unknown-package, accessory-only, buying, or reserved row enters the allowed set.",
      "Any public/candidate-pool row is created from this packet.",
      "A7M3 comparable key differs across fresh detail and contract.",
      "Second live-read wave remains under 4 clean body-only rows.",
    ],
    conclusion: failedChecks.length === 0
      ? "camera_sony_a7m3_execution_readiness_checklist_passed_report_only"
      : "camera_sony_a7m3_execution_readiness_checklist_blocked_second_wave_still_thin",
    nextStep: failedChecks.length === 0
      ? "Keep dormant until owner explicitly approves tiny internal-only no-public execution."
      : "Keep blocked; second no-write camera live-read wave still has fewer than 4 clean body-only rows.",
  };

  const jsonPath = path.join(reportsDir, "camera-sony-a7m3-execution-readiness-checklist-latest.json");
  const mdPath = path.join(reportsDir, "camera-sony-a7m3-execution-readiness-checklist-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Camera Sony A7M3 Execution Readiness Checklist",
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
