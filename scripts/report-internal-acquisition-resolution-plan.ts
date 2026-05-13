import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type LeakCheck = {
  decision: string;
  metrics: {
    proposedRows: number;
    existingRawRows: number;
    existingParsedRows: number;
    existingCandidatePoolRows: number;
    poolEligibleSelectable: boolean;
    scoreDirtySelectable: boolean;
    hardIssueRows: number;
    softIssueRows: number;
  };
  findingsByReason: Record<string, number>;
  hardIssues: Array<{
    lane: string;
    pid: number;
    title: string;
    findings: string[];
  }>;
  rows: Array<{
    lane: string;
    pid: number;
    title: string;
    findings: string[];
  }>;
};

type PoolPreflight = {
  conclusion: string;
  columnExists: boolean;
  migrationReady?: boolean;
  runtimeFilterAlreadyApplied?: boolean;
  localChecks?: {
    migrationFileExists?: boolean;
    schemaContainsPoolEligible?: boolean;
    migrationContainsAddColumn?: boolean;
    runtimeFilterAlreadyApplied?: boolean;
  };
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 90) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function mdTable(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "_none_";
  const headers = Object.keys(rows[0]);
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((header) => String(row[header] ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const leak = await readJson<LeakCheck>("reports/internal-acquisition-leak-check-latest.json");
  const pool = await readJson<PoolPreflight>("reports/pool-eligibility-prod-preflight-latest.json");

  const schemaBlocked = !pool.columnExists || !leak.metrics.poolEligibleSelectable || !leak.metrics.scoreDirtySelectable;
  const migrationReady = pool.migrationReady ?? Boolean(
    pool.localChecks?.migrationFileExists &&
    pool.localChecks?.schemaContainsPoolEligible &&
    pool.localChecks?.migrationContainsAddColumn,
  );
  const runtimeFilterAlreadyApplied = pool.runtimeFilterAlreadyApplied ?? Boolean(pool.localChecks?.runtimeFilterAlreadyApplied);
  const candidatePoolConflicts = leak.hardIssues.filter((row) => row.findings.some((finding) => finding.startsWith("candidate_pool_row_exists")));
  const keyMismatchRows = leak.rows.filter((row) => row.findings.some((finding) => /sku_mismatch|parsed_key_mismatch/.test(finding)));
  const report = {
    generatedAt,
    scope: "internal_acquisition_resolution_plan",
    reportOnly: true,
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    inputs: {
      leakDecision: leak.decision,
      poolPreflightConclusion: pool.conclusion,
    },
    metrics: {
      proposedRows: leak.metrics.proposedRows,
      schemaBlocked,
      migrationReady,
      runtimeFilterAlreadyApplied,
      candidatePoolConflictRows: candidatePoolConflicts.length,
      keyMismatchRows: keyMismatchRows.length,
    },
    conflictsByLane: countBy(leak.rows.filter((row) => row.findings.length > 0), (row) => row.lane),
    findingsByReason: leak.findingsByReason,
    recommendedOrder: [
      "Do not apply internal acquisition yet.",
      "Apply pool eligibility migration first only after owner approval.",
      "Rerun report:pool-eligibility-prod-preflight and require columnExists=true before runtime wiring or executor apply.",
      "Keep candidate-pool public release disabled; internal executor must write raw/parsed only with pool_eligible=false and score_dirty=false.",
      "For existing candidate_pool invalidated rows, do not mutate during internal acquisition. Treat them as historical public-pool artifacts and handle with a separate candidate-pool cleanup/rebuild decision.",
      "For AirPods Max old-key mismatch rows, allow raw/parsed refresh only after fresh detail validation; do not backfill candidate_pool from those rows until lane has a separate public readiness decision.",
    ],
    blockedActions: [
      "internal acquisition apply",
      "runtime loadScorableRows pool_eligible filter",
      "candidate-pool rebuild/release",
      "public promotion for owner-ready lanes",
    ],
    candidatePoolConflicts: candidatePoolConflicts.map((row) => ({
      lane: row.lane,
      pid: row.pid,
      title: row.title,
      findings: row.findings,
    })),
    decision: schemaBlocked
      ? "hold_until_pool_eligibility_migration_owner_approved_and_verified"
      : candidatePoolConflicts.length > 0
        ? "hold_until_candidate_pool_conflicts_are_handled_separately"
        : "ready_for_owner_approved_fresh_refetch_apply",
  };

  await writeFile(path.join(reportsDir, "internal-acquisition-resolution-plan-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Internal Acquisition Resolution Plan",
    "",
    `- generatedAt: ${generatedAt}`,
    `- decision: ${report.decision}`,
    "- reportOnly/runtimeMutation/supabaseMutation/publicPromotion: true/false/false/false",
    "",
    "## Metrics",
    "",
    `- proposedRows: ${report.metrics.proposedRows}`,
    `- schemaBlocked: ${report.metrics.schemaBlocked}`,
    `- migrationReady: ${report.metrics.migrationReady}`,
    `- runtimeFilterAlreadyApplied: ${report.metrics.runtimeFilterAlreadyApplied}`,
    `- candidatePoolConflictRows: ${report.metrics.candidatePoolConflictRows}`,
    `- keyMismatchRows: ${report.metrics.keyMismatchRows}`,
    "",
    "## Recommended Order",
    "",
    ...report.recommendedOrder.map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Blocked Actions",
    "",
    ...report.blockedActions.map((item) => `- ${item}`),
    "",
    "## Findings By Reason",
    "",
    "```json",
    JSON.stringify(report.findingsByReason, null, 2),
    "```",
    "",
    "## Candidate Pool Conflicts",
    "",
    mdTable(report.candidatePoolConflicts.map((row) => ({
      lane: row.lane,
      pid: row.pid,
      findings: row.findings.join("; "),
      title: compact(row.title),
    }))),
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "internal-acquisition-resolution-plan-latest.md"), md);
  console.log(JSON.stringify(report.metrics));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
