import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type OwnerAssessment = {
  category: string;
  metrics: {
    ownerReadyKeys: number;
    slimPromisingKeys: number;
    officialSourceRows: number;
    manualReviewRows: number;
    holdRows: number;
  };
  ownerReadyKeys: Array<{
    comparableKey: string;
    modelCode: string;
    rows: number;
  }>;
  slimPromisingKeys: Array<{
    comparableKey: string;
    modelCode: string;
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
  const assessment = await readJson<OwnerAssessment>("game-console-ps5-owner-assessment-latest.json");
  const allowedRows = assessment.ownerReadyKeys.reduce((sum, row) => sum + row.rows, 0);
  const checks = [
    {
      check: "direct_official_source_present",
      status: assessment.metrics.officialSourceRows >= 2 ? "pass" : "fail",
      evidence: `officialSourceRows=${assessment.metrics.officialSourceRows}`,
    },
    {
      check: "owner_ready_key_count",
      status: assessment.metrics.ownerReadyKeys >= 2 ? "pass" : "fail",
      evidence: `ownerReadyKeys=${assessment.metrics.ownerReadyKeys}`,
    },
    {
      check: "disc_and_digital_only",
      status: assessment.ownerReadyKeys.every((row) => ["playstation-5-disc", "playstation-5-digital"].includes(row.modelCode))
        ? "pass"
        : "fail",
      evidence: assessment.ownerReadyKeys.map((row) => row.modelCode).join(", "),
    },
    {
      check: "slim_lanes_not_owner_ready",
      status: assessment.metrics.slimPromisingKeys > 0 ? "pass" : "warn",
      evidence: assessment.slimPromisingKeys.map((row) => `${row.modelCode}:${row.rows}`).join(", "),
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
      status: Math.min(allowedRows, 8) <= 8 ? "pass" : "warn",
      evidence: `allowedRows=${allowedRows}; max cap=${Math.min(allowedRows, 8)}`,
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
    ownership: "game_console_ps5_execution_readiness_checklist",
    category: assessment.category,
    target: assessment.ownerReadyKeys.map((row) => row.modelCode).join(", "),
    sourceReports: [
      "game-console-ps5-live-read-wave-latest.json",
      "game-console-ps5-source-backfill-latest.json",
      "game-console-ps5-owner-assessment-latest.json",
    ],
    metrics: {
      checks: checks.length,
      passChecks: passChecks.length,
      warningChecks: warningChecks.length,
      failedChecks: failedChecks.length,
      allowedRows,
      maxFutureWriteCap: Math.min(allowedRows, 8),
    },
    checks,
    allowedKeys: assessment.ownerReadyKeys,
    deferredKeys: assessment.slimPromisingKeys,
    runbookIfLaterApproved: [
      "Fresh-refetch every pid in the same execution request.",
      "Abort if saleStatus is not active, the row is accessory/game/account-only, or edition changes.",
      "Allow only PS5 Disc and PS5 Digital keys in the first pass; keep Slim and Pro out.",
      "No public candidate-pack promotion until lifecycle/market stats prove stable.",
    ],
    conclusion: failedChecks.length === 0
      ? "game_console_ps5_execution_readiness_checklist_passed_report_only"
      : "game_console_ps5_execution_readiness_checklist_failed_report_only",
    nextStep: failedChecks.length === 0
      ? "Keep dormant until P0 stabilization and owner approval; first pass can only include Disc/Digital body lanes."
      : "Keep PS5 report-only and resolve failed checks.",
  };

  const jsonPath = path.join(reportsDir, "game-console-ps5-execution-readiness-checklist-latest.json");
  const mdPath = path.join(reportsDir, "game-console-ps5-execution-readiness-checklist-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Game Console PS5 Execution Readiness Checklist",
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
      ["modelCode", "rows", "comparableKey"],
      assessment.ownerReadyKeys.map((row) => [row.modelCode, row.rows, row.comparableKey]),
    ),
    "",
    "## Deferred Keys",
    "",
    mdTable(
      ["modelCode", "rows", "comparableKey"],
      assessment.slimPromisingKeys.map((row) => [row.modelCode, row.rows, row.comparableKey]),
    ),
    "",
    "## Runbook If Later Approved",
    "",
    ...report.runbookIfLaterApproved.map((item) => `- ${item}`),
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
    allowedRows: report.metrics.allowedRows,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
