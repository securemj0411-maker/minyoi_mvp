import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type AcquisitionPlan = {
  generatedAt: string;
  laneRows: Array<{
    sku: string;
    searchVolume: number;
    sampled: number;
    activeClean: number;
    sold: number;
    activeChanged: number;
    decision: string;
  }>;
};

const preferredQueriesBySku: Record<string, string[]> = {
  "sony-wh-1000xm5": ["소니 wh-1000xm5 헤드폰", "소니 xm5 헤드폰"],
  "sony-wh-1000xm4": ["소니 wh-1000xm4 헤드폰", "소니 xm4 헤드폰"],
  "sony-wh-1000xm3": ["소니 wh-1000xm3 헤드폰", "소니 xm3 헤드폰"],
  "sony-wh-ult900n": ["소니 wh-ult900n 헤드폰", "소니 ult wear 헤드폰"],
  "sony-wh-ch520": ["소니 wh-ch520 헤드폰", "소니 ch520 헤드폰"],
  "bose-qc-ultra": ["보스 qc 울트라 헤드폰", "bose qc ultra headphones"],
  "bose-qc45": ["보스 qc45 헤드폰", "bose qc45 headphones"],
  "beats-solo4": ["비츠 솔로4 헤드폰", "beats solo4 headphones"],
  "sennheiser-accentum": ["젠하이저 accentum 헤드폰", "sennheiser accentum headphones"],
  "sennheiser-hd569": ["젠하이저 hd569 헤드폰", "sennheiser hd569 headphones"],
};

const excludedUntilGuardReview = new Set(["sony-wh-ch720n"]);
const guardedUntilSoldRaceReview = new Set(["sony-wh-1000xm6"]);

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
  const plan = await readJson<AcquisitionPlan>("reports/headphone-non-airpods-acquisition-plan-latest.json");
  const acquireLanes = plan.laneRows.filter((row) => row.decision === "acquire_no_write_candidate" && !excludedUntilGuardReview.has(row.sku));
  const queryLanes = acquireLanes.map((row) => ({
    sku: row.sku,
    searchVolume: row.searchVolume,
    activeClean: row.activeClean,
    sampled: row.sampled,
    queries: preferredQueriesBySku[row.sku] ?? [],
    maxPagesPerQuery: row.searchVolume >= 80 ? 2 : 1,
    detailSampleLimitBeforeWrite: 10,
    writeMode: "none_until_owner_approves_db_acquisition",
    requiredGuards: [
      "detail live status must be active",
      "detail classification must remain normal",
      "candidate pool writes must remain disabled",
      "public promotion must remain disabled",
    ],
  }));
  const heldLanes = plan.laneRows
    .filter((row) => row.decision !== "acquire_no_write_candidate" || excludedUntilGuardReview.has(row.sku) || guardedUntilSoldRaceReview.has(row.sku))
    .map((row) => ({
      sku: row.sku,
      currentDecision: row.decision,
      reason: excludedUntilGuardReview.has(row.sku)
        ? "active accessory/callout contamination"
        : guardedUntilSoldRaceReview.has(row.sku)
          ? "sold-race sample pressure"
          : "not selected for acquisition",
      nextReview: excludedUntilGuardReview.has(row.sku)
        ? "Add guardrail/detail sample around CH720N accessory/callout wording."
        : guardedUntilSoldRaceReview.has(row.sku)
          ? "Resample active-only XM6 rows before DB acquisition."
          : "Keep report-only.",
    }));
  const report = {
    generatedAt,
    reportOnly: true,
    liveSearchNoWrite: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "headphone_discovered",
    sourceReport: "reports/headphone-non-airpods-acquisition-plan-latest.json",
    metrics: {
      queryLanes: queryLanes.length,
      queryCount: queryLanes.reduce((sum, lane) => sum + lane.queries.length, 0),
      heldLanes: heldLanes.length,
      estimatedMaxSearchPages: queryLanes.reduce((sum, lane) => sum + lane.queries.length * lane.maxPagesPerQuery, 0),
      requiredDetailSampleBeforeWrite: queryLanes.length * 10,
    },
    queryLanes,
    heldLanes,
    successCriteria: [
      ">= 80% of sampled active detail rows remain listingType=normal",
      "sold/inactive rows are excluded before any candidate-pool calculation",
      "candidate_pool insert/update/delete count remains 0",
      "pack-open quality remains unchanged after no-write run",
      "source health remains healthy after the no-write run",
    ],
    decision: "non_airpods_headphone_query_lanes_ready_for_no_write_acquisition_rehearsal",
    nextStep:
      "Run no-write acquisition rehearsal for these query lanes only; do not store raw rows or promote candidates until post-rehearsal metrics pass.",
  };
  await writeFile(path.join(reportsDir, "headphone-non-airpods-query-lane-plan-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Headphone Non-AirPods Query Lane Plan",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- liveSearchNoWrite: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Metrics",
    "",
    `- queryLanes: ${report.metrics.queryLanes}`,
    `- queryCount: ${report.metrics.queryCount}`,
    `- heldLanes: ${report.metrics.heldLanes}`,
    `- estimatedMaxSearchPages: ${report.metrics.estimatedMaxSearchPages}`,
    `- requiredDetailSampleBeforeWrite: ${report.metrics.requiredDetailSampleBeforeWrite}`,
    "",
    "## Query Lanes",
    "",
    mdTable(
      ["sku", "searchVolume", "activeClean/sample", "queries", "maxPages/query", "writeMode"],
      queryLanes.map((lane) => [
        lane.sku,
        lane.searchVolume,
        `${lane.activeClean}/${lane.sampled}`,
        lane.queries.join("<br>"),
        lane.maxPagesPerQuery,
        lane.writeMode,
      ]),
    ),
    "",
    "## Held Lanes",
    "",
    mdTable(
      ["sku", "decision", "reason", "nextReview"],
      heldLanes.map((lane) => [lane.sku, lane.currentDecision, lane.reason, lane.nextReview]),
    ),
    "",
    "## Success Criteria",
    "",
    ...report.successCriteria.map((criterion) => `- ${criterion}`),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-non-airpods-query-lane-plan-latest.md"), `${md}\n`);
  console.log(
    `headphone non-AirPods query lane plan: lanes=${report.metrics.queryLanes}, queries=${report.metrics.queryCount}, held=${report.metrics.heldLanes}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
