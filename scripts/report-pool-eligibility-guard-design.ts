import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    runtimePatchApplied: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    problem:
      "Internal acquisition rows stored as active normal raw/parsed rows can later be picked up by scoreStage/loadScorableRows and enter mvp_candidate_pool.",
    recommendedDesign: {
      column: "mvp_raw_listings.pool_eligible boolean not null default true",
      writeRule: "Normal production collection rows remain pool_eligible=true; internal acquisition / observation rows write pool_eligible=false.",
      poolRule: "Candidate-pool scoring loaders must require pool_eligible=eq.true.",
      marketStatsRule:
        "Market-stat loaders may continue to use active/sold/disappeared normal rows regardless of pool_eligible, so internal observations can help valuation without public leakage.",
    },
    rolloutOrder: [
      {
        step: 1,
        action: "Apply DB migration adding pool_eligible default true.",
        reason: "Runtime query must not reference a missing column.",
        rollback: "Column can stay unused; do not drop during incident.",
      },
      {
        step: 2,
        action: "Patch score/loadScorableRows to add pool_eligible=eq.true only after migration is confirmed.",
        reason: "Prevents future internal rows from becoming candidates.",
        rollback: "Remove query filter if migration unexpectedly fails, leaving existing behavior.",
      },
      {
        step: 3,
        action: "Patch internal acquisition writer to set pool_eligible=false.",
        reason: "Lets raw/parsed store internal market observations safely.",
        rollback: "Do not run internal acquisition; no public data path affected.",
      },
      {
        step: 4,
        action: "Dry-run a 20-row internal acquisition and verify candidate_pool writes remain 0 after a pool-warmer cycle.",
        reason: "Confirms boundary at runtime, not just in code.",
        rollback: "Delete/mark internal rows only if they were written with wrong eligibility.",
      },
    ],
    affectedFilesIfImplemented: [
      "supabase/schema.sql",
      "supabase/migrations/<timestamp>_add_pool_eligible_to_raw_listings.sql",
      "src/lib/tick-pipeline.ts",
      "scripts/apply-headphone-non-airpods-tiny-db-acquisition.ts",
      "scripts/report-headphone-non-airpods-acquisition-isolation-gap.ts",
    ],
    explicitNonGoals: [
      "Do not change category readiness.",
      "Do not promote headphone_discovered to public by this change alone.",
      "Do not let internal observation rows enter candidate_pool.",
      "Do not overload listing_state/listing_type to mean internal-only.",
    ],
    decision: "pool_eligible_guard_design_ready_for_migration_first_rollout",
    nextStep:
      "Create the migration draft and runtime patch in a migration-first order; do not deploy runtime filter until the DB column exists.",
  };
  await writeFile(path.join(reportsDir, "pool-eligibility-guard-design-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Pool Eligibility Guard Design",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- runtimePatchApplied: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Problem",
    "",
    `- ${report.problem}`,
    "",
    "## Recommended Design",
    "",
    `- column: ${report.recommendedDesign.column}`,
    `- writeRule: ${report.recommendedDesign.writeRule}`,
    `- poolRule: ${report.recommendedDesign.poolRule}`,
    `- marketStatsRule: ${report.recommendedDesign.marketStatsRule}`,
    "",
    "## Rollout Order",
    "",
    ...report.rolloutOrder.map((step) => [
      `### ${step.step}. ${step.action}`,
      "",
      `- reason: ${step.reason}`,
      `- rollback: ${step.rollback}`,
      "",
    ].join("\n")),
    "## Affected Files If Implemented",
    "",
    ...report.affectedFilesIfImplemented.map((file) => `- ${file}`),
    "",
    "## Explicit Non-Goals",
    "",
    ...report.explicitNonGoals.map((goal) => `- ${goal}`),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "pool-eligibility-guard-design-latest.md"), `${md}\n`);
  console.log("pool eligibility guard design: migration-first rollout required");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
