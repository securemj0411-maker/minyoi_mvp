import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

async function readText(relativePath: string) {
  return readFile(path.join(appDir, relativePath), "utf8");
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readText(relativePath)) as T;
}

type ProdPreflight = {
  conclusion: string;
  probe: {
    columnExists: boolean;
    status: number;
    errorCode: string | null;
  };
  localChecks: Record<string, boolean>;
};

type ResolutionPlan = {
  decision: string;
  metrics: {
    proposedRows: number;
    schemaBlocked: boolean;
    migrationReady: boolean;
    runtimeFilterAlreadyApplied: boolean;
    candidatePoolConflictRows: number;
    keyMismatchRows: number;
  };
};

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const poolMigrationPath = "supabase/migrations/202605121231_add_pool_eligible_to_raw_listings.sql";
  const scoreMigrationPath = "supabase/migrations/20260512143000_add_score_dirty_to_raw_listings.sql";
  const [poolMigrationSql, scoreMigrationSql, preflight, resolution] = await Promise.all([
    readText(poolMigrationPath),
    readText(scoreMigrationPath),
    readJson<ProdPreflight>("reports/pool-eligibility-prod-preflight-latest.json"),
    readJson<ResolutionPlan>("reports/internal-acquisition-resolution-plan-latest.json"),
  ]);

  const combinedSql = `${poolMigrationSql.trim()}\n\n${scoreMigrationSql.trim()}\n`;
  const report = {
    generatedAt,
    scope: "pool_eligibility_migration_owner_packet",
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    currentState: {
      prodColumnExists: preflight.probe.columnExists,
      prodProbeStatus: preflight.probe.status,
      prodProbeErrorCode: preflight.probe.errorCode,
      preflightConclusion: preflight.conclusion,
      resolutionDecision: resolution.decision,
      proposedInternalRowsBlocked: resolution.metrics.proposedRows,
      candidatePoolConflictRows: resolution.metrics.candidatePoolConflictRows,
      keyMismatchRows: resolution.metrics.keyMismatchRows,
    },
    migrationFiles: [
      {
        path: poolMigrationPath,
        purpose: "Add mvp_raw_listings.pool_eligible so internal acquisition rows can be written with public-pool exclusion.",
      },
      {
        path: scoreMigrationPath,
        purpose: "Add mvp_raw_listings.score_dirty and index so score recomputation stays event-driven.",
      },
    ],
    recommendedApplySql: combinedSql,
    ownerApprovalRequired: true,
    applyWindow: "low-traffic window; migration is ADD COLUMN IF NOT EXISTS with defaults plus one partial index",
    verificationSequence: [
      "Run report:pool-eligibility-prod-preflight and require prodColumnExists=true.",
      "Only after preflight passes, patch runtime loader to include pool_eligible semantics if still needed.",
      "Run report:internal-acquisition-leak-check again.",
      "Resolve candidate_pool invalidated 5 rows separately; do not let migration imply public release.",
      "Run apply:internal-acquisition-executor in dry-run again.",
      "Actual apply still requires explicit owner approval plus --apply=1 --fresh-refetch=1 and INTERNAL_ACQUISITION_WRITE_APPROVED=1.",
    ],
    rollbackPlan: [
      "If runtime code is not wired yet, rollback is simply not applying executor writes.",
      "If a schema rollback is required, drop the partial score_dirty index first, then drop score_dirty/pool_eligible columns only after confirming no runtime code references them.",
      "Do not rollback by deleting raw/parsed rows in the same action; row cleanup is a separate decision.",
    ],
    decision: preflight.probe.columnExists
      ? "migration_already_applied_verify_next"
      : "owner_can_review_pool_eligibility_and_score_dirty_migration",
  };

  await writeFile(path.join(reportsDir, "pool-eligibility-migration-owner-packet-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Pool Eligibility Migration Owner Packet",
    "",
    `- generatedAt: ${generatedAt}`,
    `- decision: ${report.decision}`,
    "- reportOnly/productionDbMutation/publicPromotion/candidatePoolPolicyWiring: true/false/false/false",
    "",
    "## Current State",
    "",
    `- prodColumnExists: ${report.currentState.prodColumnExists}`,
    `- prodProbeStatus: ${report.currentState.prodProbeStatus}`,
    `- prodProbeErrorCode: ${report.currentState.prodProbeErrorCode}`,
    `- preflightConclusion: ${report.currentState.preflightConclusion}`,
    `- proposedInternalRowsBlocked: ${report.currentState.proposedInternalRowsBlocked}`,
    `- candidatePoolConflictRows: ${report.currentState.candidatePoolConflictRows}`,
    `- keyMismatchRows: ${report.currentState.keyMismatchRows}`,
    "",
    "## Migration Files",
    "",
    ...report.migrationFiles.map((item) => `- \`${item.path}\`: ${item.purpose}`),
    "",
    "## Recommended Apply SQL",
    "",
    "```sql",
    report.recommendedApplySql.trim(),
    "```",
    "",
    "## Verification Sequence",
    "",
    ...report.verificationSequence.map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Rollback Plan",
    "",
    ...report.rollbackPlan.map((item) => `- ${item}`),
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "pool-eligibility-migration-owner-packet-latest.md"), md);
  console.log(JSON.stringify({
    decision: report.decision,
    prodColumnExists: report.currentState.prodColumnExists,
    proposedInternalRowsBlocked: report.currentState.proposedInternalRowsBlocked,
  }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
