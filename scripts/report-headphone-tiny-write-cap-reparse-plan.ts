import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type ReviewRow = {
  pid: number;
  title: string;
  currentListingType: string | null;
  nextListingType: string | null;
  nextSkuId: string | null;
  nextComparableKey: string | null;
  parseConfidence: number | null;
  needsReview: boolean | null;
  recommendedDecision: "allow_write_cap_reparse" | "hold_for_manual_review";
};

type ReviewPacket = {
  generatedAt: string;
  reviewRows: ReviewRow[];
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
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
  const review = await readJson<ReviewPacket>("reports/headphone-accessory-to-normal-review-packet-latest.json");
  const allowedRows = review.reviewRows.filter((row) => row.recommendedDecision === "allow_write_cap_reparse");
  const patchPlan = allowedRows.map((row) => ({
    pid: row.pid,
    title: row.title,
    maxWriteTables: ["mvp_raw_listings", "mvp_listing_parsed"],
    forbiddenTables: ["mvp_candidate_pool", "mvp_pack_reveals", "mvp_pack_opens", "mvp_market_price_daily", "mvp_market_velocity_daily"],
    rawPatch: {
      listing_type: row.nextListingType,
      sku_id: row.nextSkuId,
      sku_name: row.nextSkuId === "airpods-max" ? "AirPods Max" : null,
    },
    parsedPatchIntent: {
      comparable_key: row.nextComparableKey,
      parse_confidence: row.parseConfidence,
      needs_review: row.needsReview,
      category: "earphone",
      family: "airpods",
      model: "airpods_max",
    },
    rollbackIntent: {
      raw_listing_type: row.currentListingType,
      raw_sku_id: null,
      raw_sku_name: null,
      delete_or_restore_parsed_row: "restore snapshot captured immediately before apply",
    },
  }));

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    sourceReport: "reports/headphone-accessory-to-normal-review-packet-latest.json",
    sourceGeneratedAt: review.generatedAt,
    metrics: {
      inputRows: review.reviewRows.length,
      plannedWriteCapRows: patchPlan.length,
      maxWriteTables: 2,
      forbiddenRuntimeTables: 5,
    },
    patchPlan,
    safetyRails: [
      "Take raw and parsed snapshots for the 3 pids immediately before any apply.",
      "Patch only mvp_raw_listings and mvp_listing_parsed.",
      "Do not insert or update mvp_candidate_pool.",
      "Do not recompute market or public pack inventory in the same step.",
      "Run pack-open quality and runtime gap audit after apply if owner approves later.",
    ],
    decision: patchPlan.length === 3
      ? "tiny_write_cap_reparse_plan_ready_for_owner_apply_decision"
      : "tiny_write_cap_reparse_plan_not_ready",
    nextStep:
      "Stop before mutation. Owner/main-agent can later choose whether to run a separate apply script for exactly these 3 pids.",
  };

  await writeFile(path.join(reportsDir, "headphone-tiny-write-cap-reparse-plan-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Headphone Tiny Write-Cap Reparse Plan",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Metrics",
    "",
    `- inputRows: ${report.metrics.inputRows}`,
    `- plannedWriteCapRows: ${report.metrics.plannedWriteCapRows}`,
    `- maxWriteTables: ${report.metrics.maxWriteTables}`,
    `- forbiddenRuntimeTables: ${report.metrics.forbiddenRuntimeTables}`,
    "",
    "## Planned Rows",
    "",
    mdTable(
      ["pid", "title", "rawPatch", "parsedKey", "rollback"],
      patchPlan.map((row) => [
        row.pid,
        row.title,
        JSON.stringify(row.rawPatch),
        row.parsedPatchIntent.comparable_key,
        JSON.stringify(row.rollbackIntent),
      ]),
    ),
    "",
    "## Safety Rails",
    "",
    ...report.safetyRails.map((rail) => `- ${rail}`),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-tiny-write-cap-reparse-plan-latest.md"), `${md}\n`);
  console.log(`headphone tiny write-cap plan: rows=${patchPlan.length}, decision=${report.decision}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
