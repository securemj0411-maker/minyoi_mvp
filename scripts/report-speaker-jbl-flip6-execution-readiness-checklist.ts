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
    directPositiveFixtureRows: number;
    directSourceRows: number;
    negativeFixtureRows: number;
    exactContractAlreadyAllowsTarget: boolean;
    exactContractBackfillStillNeeded: boolean;
    sourceBackfillRequired: boolean;
  };
  ownerDecision: {
    notApprovedHere: string[];
    reviewPrerequisites: string[];
  };
  allowedRows: Array<{
    pid: string;
    title: string;
    price: number;
    model: string;
    saleStatus: string;
  }>;
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
  const ownerPacket = await readJson<OwnerPacket>("speaker-jbl-flip6-owner-review-packet-latest.json");
  const hardHoldCoverage = ["accessory_only_title", "rental_text", "damaged_or_part_text"].every((needle) =>
    ownerPacket.excludedRows.some((row) => row.reason.includes(needle)),
  );

  const checks = [
    {
      check: "allowed_rows_minimum",
      status: ownerPacket.metrics.strictAllowedRows >= 3 ? "pass" : "fail",
      evidence: `strictAllowedRows=${ownerPacket.metrics.strictAllowedRows}`,
    },
    {
      check: "write_cap_conservative",
      status: ownerPacket.metrics.maxFutureWriteCap <= 3 ? "pass" : "fail",
      evidence: `maxFutureWriteCap=${ownerPacket.metrics.maxFutureWriteCap}`,
    },
    {
      check: "direct_positive_source_or_fixture",
      status: ownerPacket.metrics.sourceBackfillRequired ? "fail" : "pass",
      evidence:
        `directPositiveFixtureRows=${ownerPacket.metrics.directPositiveFixtureRows}; ` +
        `directSourceRows=${ownerPacket.metrics.directSourceRows}; ` +
        `exactContractAlreadyAllowsTarget=${ownerPacket.metrics.exactContractAlreadyAllowsTarget}`,
    },
    {
      check: "portable_exact_contract_backfill",
      status: ownerPacket.metrics.exactContractBackfillStillNeeded ? "warn" : "pass",
      evidence: `exactContractBackfillStillNeeded=${ownerPacket.metrics.exactContractBackfillStillNeeded}`,
    },
    {
      check: "hard_hold_examples_present",
      status: hardHoldCoverage ? "pass" : "fail",
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
    ownership: "speaker_jbl_flip6_execution_readiness_checklist",
    category: ownerPacket.category,
    target: ownerPacket.target,
    sourceReports: [
      "speaker-jbl-flip6-owner-review-packet-latest.json",
      "speaker-selected-subset-strict-contract-latest.json",
      "speaker-portable-exact-model-contract-latest.json",
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
      "Do not execute until direct JBL Flip 6 source/positive fixture backfill passes.",
      "If only direct source evidence exists, update the portable exact-model contract before runtime patching.",
      "Fresh-refetch every allowed pid in the same execution request.",
      "Abort if saleStatus is not SELLING, model code changes, or sold/buying/rental/damaged/accessory-only text appears.",
      "Write at most 3 rows if a future owner-approved internal-only executor exists.",
      "Keep public candidate-pack promotion closed until observed market stats and lifecycle checks stabilize.",
    ],
    rollbackTriggers: [
      "Any case-only, rental, mixed-bundle, or damaged speaker row enters the allowed set.",
      "Any public/candidate-pool row is created from this packet.",
      "JBL Flip 6 exact-model evidence remains missing after source backfill.",
      "Comparable key differs across fresh detail and contract.",
    ],
    conclusion: failedChecks.length === 0
      ? "speaker_jbl_flip6_execution_readiness_checklist_passed_with_warnings_report_only"
      : "speaker_jbl_flip6_execution_readiness_checklist_failed_source_backfill_required",
    nextStep: failedChecks.length === 0
      ? "Keep dormant until owner explicitly approves tiny internal-only no-public execution."
      : "Backfill direct JBL Flip 6 source/positive fixture evidence before any runtime or acquisition executor.",
  };

  const jsonPath = path.join(reportsDir, "speaker-jbl-flip6-execution-readiness-checklist-latest.json");
  const mdPath = path.join(reportsDir, "speaker-jbl-flip6-execution-readiness-checklist-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Speaker JBL Flip 6 Execution Readiness Checklist",
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
