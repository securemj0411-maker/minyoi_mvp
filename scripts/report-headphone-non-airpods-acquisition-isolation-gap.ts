import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type DryRun = {
  generatedAt: string;
  decision: string;
  metrics: {
    validationPassedRows: number;
    plannedRawUpserts: number;
    plannedParsedUpserts: number;
    plannedCandidatePoolWrites: number;
  };
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const dryRun = await readJson<DryRun>("reports/headphone-non-airpods-tiny-db-acquisition-dry-run-latest.json");
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "headphone_discovered",
    sourceReport: "reports/headphone-non-airpods-tiny-db-acquisition-dry-run-latest.json",
    observedDryRun: {
      decision: dryRun.decision,
      validationPassedRows: dryRun.metrics.validationPassedRows,
      plannedRawUpserts: dryRun.metrics.plannedRawUpserts,
      plannedParsedUpserts: dryRun.metrics.plannedParsedUpserts,
      plannedCandidatePoolWrites: dryRun.metrics.plannedCandidatePoolWrites,
    },
    isolationGap: {
      exists: true,
      reason:
        "mvp raw/parsed active normal rows are later eligible for scoring/pool loaders because the loaders filter by detail_status=done, listing_type=normal, sku_id not null, listing_state=active and do not have an internal-only acquisition guard.",
      affectedPath: [
        "mvp_raw_listings",
        "mvp_listing_parsed",
        "loadScorableRows",
        "scoreStage",
        "mvp_candidate_pool",
      ],
    },
    safeOptions: [
      {
        option: "add_pool_eligibility_guard",
        summary: "Add an explicit pool_eligible/internal_observation flag and make pool loaders require pool_eligible=true.",
        pros: ["Keeps raw/parsed useful for internal market learning", "Clear future-proof boundary"],
        cons: ["Requires schema/code migration", "Needs backfill default and tests"],
      },
      {
        option: "separate_internal_observation_table",
        summary: "Store non-public acquisition samples outside mvp_raw_listings until promoted.",
        pros: ["No accidental candidate-pool leakage", "Cleanest ownership split"],
        cons: ["New table/report path", "More implementation work before market stats reuse"],
      },
      {
        option: "store_as_non_pool_state",
        summary: "Insert rows into mvp_raw_listings with a non-active or non-normal state so pool loaders skip them.",
        pros: ["No schema change"],
        cons: ["Pollutes lifecycle/state semantics", "Bad fit for market stats and sold velocity"],
      },
    ],
    decision: "non_airpods_headphone_db_acquisition_apply_blocked_until_pool_isolation_exists",
    nextStep:
      "Do not apply the 20-row DB acquisition yet. First choose/build a pool isolation boundary; recommended next design is a pool_eligible/internal_observation guard or separate internal observation table.",
  };
  await writeFile(
    path.join(reportsDir, "headphone-non-airpods-acquisition-isolation-gap-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const md = [
    "# Headphone Non-AirPods Acquisition Isolation Gap",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Why Apply Is Blocked",
    "",
    `- ${report.isolationGap.reason}`,
    `- affectedPath: ${report.isolationGap.affectedPath.join(" -> ")}`,
    "",
    "## Dry-Run State",
    "",
    `- dryRunDecision: ${report.observedDryRun.decision}`,
    `- validationPassedRows: ${report.observedDryRun.validationPassedRows}`,
    `- plannedRawUpserts: ${report.observedDryRun.plannedRawUpserts}`,
    `- plannedParsedUpserts: ${report.observedDryRun.plannedParsedUpserts}`,
    `- plannedCandidatePoolWrites: ${report.observedDryRun.plannedCandidatePoolWrites}`,
    "",
    "## Safe Options",
    "",
    ...report.safeOptions.flatMap((option) => [
      `### ${option.option}`,
      "",
      `- ${option.summary}`,
      `- pros: ${option.pros.join("; ")}`,
      `- cons: ${option.cons.join("; ")}`,
      "",
    ]),
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-non-airpods-acquisition-isolation-gap-latest.md"), `${md}\n`);
  console.log("headphone non-AirPods acquisition isolation gap: apply blocked until pool isolation exists");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
