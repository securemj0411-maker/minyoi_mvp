import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type Checklist = {
  conclusion: string;
  metrics: {
    passChecks: number;
    warningChecks: number;
    failedChecks: number;
    allowedRows: number;
    maxFutureWriteCap: number;
  };
  allowedKeys: Array<{
    comparableKey: string;
    modelCode: string;
    rows: number;
  }>;
  deferredKeys: Array<{
    comparableKey: string;
    modelCode: string;
    rows: number;
  }>;
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf-8")) as T;
}

function bullet(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const checklist = await readJson<Checklist>("game-console-ps5-execution-readiness-checklist-latest.json");

  const requestedScope = [
    "Review game_console_body_narrow PS5 Disc/Digital body-only parser-candidate behavior.",
    "Allow only playstation-5-disc and playstation-5-digital comparable keys in the first narrow proposal.",
    "Fresh-refetch every candidate pid before any future runtime proposal.",
    "Keep Slim Disc, Slim Digital, Pro, limited edition, accessory drive, game bundle, account bundle, and buying rows outside positives.",
    "Cap any future first-pass write proposal at the checklist maxFutureWriteCap.",
  ];

  const explicitNonScope = [
    "public candidate-pack promotion",
    "candidate pool policy wiring",
    "runtime catalog apply",
    "Supabase schema or production DB writes",
    "cron/lifecycle/debug/pack UI changes",
    "broad game_console category approval",
    "PS5 Slim/Pro/limited edition approval",
    "standalone disc-drive accessory approval",
  ];

  const approvalChecklist = [
    "owner chooses PS5 Disc/Digital narrow runtime review after P0 stabilization",
    "owner confirms no public promotion in the same change",
    "owner confirms candidate-pool wiring remains closed",
    "owner confirms fresh-detail refetch is mandatory",
    "owner confirms Slim/Pro/accessory/game/account rows stay manual/hold",
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "game_console_body_narrow",
    target: "playstation-5-disc, playstation-5-digital",
    sourceReports: [
      "game-console-ps5-live-read-wave-latest.json",
      "game-console-ps5-source-backfill-latest.json",
      "game-console-ps5-owner-assessment-latest.json",
      "game-console-ps5-execution-readiness-checklist-latest.json",
    ],
    metrics: {
      passChecks: checklist.metrics.passChecks,
      warningChecks: checklist.metrics.warningChecks,
      failedChecks: checklist.metrics.failedChecks,
      allowedRows: checklist.metrics.allowedRows,
      maxFutureWriteCap: checklist.metrics.maxFutureWriteCap,
      allowedKeys: checklist.allowedKeys.length,
      deferredKeys: checklist.deferredKeys.length,
      requestedScopeItems: requestedScope.length,
      explicitNonScopeItems: explicitNonScope.length,
      approvalChecklistItems: approvalChecklist.length,
    },
    checklistConclusion: checklist.conclusion,
    allowedKeys: checklist.allowedKeys,
    deferredKeys: checklist.deferredKeys,
    requestedScope,
    explicitNonScope,
    approvalChecklist,
    requestText:
      "Request explicit owner/main-agent approval for a narrow PS5 Disc/Digital runtime review only after P0 stabilization. This draft does not grant approval.",
    nextStep:
      "Stop at report-only unless owner/main-agent explicitly approves the narrow runtime review; otherwise continue source-backed no-write collection for other tech categories.",
  };

  const jsonPath = path.join(reportsDir, "game-console-ps5-runtime-review-request-draft-latest.json");
  const mdPath = path.join(reportsDir, "game-console-ps5-runtime-review-request-draft-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Game Console PS5 Runtime Review Request Draft",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only draft for possible owner approval. This does not grant runtime approval.",
    "",
    "## Metrics",
    "",
    `- pass/warn/fail checks: ${report.metrics.passChecks}/${report.metrics.warningChecks}/${report.metrics.failedChecks}`,
    `- allowedRows: ${report.metrics.allowedRows}`,
    `- maxFutureWriteCap: ${report.metrics.maxFutureWriteCap}`,
    `- allowedKeys: ${report.metrics.allowedKeys}`,
    `- deferredKeys: ${report.metrics.deferredKeys}`,
    "",
    "## Request Text",
    "",
    report.requestText,
    "",
    "## Requested Scope",
    "",
    ...bullet(requestedScope),
    "",
    "## Explicit Non-Scope",
    "",
    ...bullet(explicitNonScope),
    "",
    "## Approval Checklist",
    "",
    ...bullet(approvalChecklist),
    "",
    "## Allowed Keys",
    "",
    ...checklist.allowedKeys.map((row) => `- ${row.modelCode}: ${row.rows} rows (${row.comparableKey})`),
    "",
    "## Deferred Keys",
    "",
    ...checklist.deferredKeys.map((row) => `- ${row.modelCode}: ${row.rows} rows (${row.comparableKey})`),
    "",
    "## Next Step",
    "",
    report.nextStep,
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: "game_console_ps5_runtime_review_request_draft_prepared_report_only",
    target: report.target,
    allowedRows: report.metrics.allowedRows,
    maxFutureWriteCap: report.metrics.maxFutureWriteCap,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
