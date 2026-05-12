import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type CleanRow = {
  pid: number;
  title: string;
  price: number;
  query: string;
  sku: string | null;
  comparableKey: string | null;
  comparableKeyWithDetail?: string | null;
  detailSaleStatus: string | null;
};

type RehearsalReport = {
  generatedAt: string;
  activeCleanRows: CleanRow[];
  activeProblemRows: Array<{ sku: string | null }>;
  soldRows: Array<{ sku: string | null }>;
  metrics: {
    activeCleanRows: number;
    activeProblemRows: number;
    soldRows: number;
  };
};

const HELD_SKUS = new Set(["sony-wh-ch720n", "sony-wh-1000xm6"]);
const TARGET_WRITE_CAP = 20;
const PER_SKU_CAP = 5;

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function compact(text: unknown, limit = 74) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const rehearsal = await readJson<RehearsalReport>("reports/headphone-non-airpods-no-write-acquisition-rehearsal-latest.json");
  const problemSkus = new Set(rehearsal.activeProblemRows.map((row) => row.sku).filter((sku): sku is string => Boolean(sku)));
  const soldSkus = new Set(rehearsal.soldRows.map((row) => row.sku).filter((sku): sku is string => Boolean(sku)));
  const laneScores = Object.entries(countBy(rehearsal.activeCleanRows, (row) => row.sku ?? "unknown")).map(([sku, cleanCount]) => {
    const hasActiveProblem = problemSkus.has(sku);
    const hasSoldPressure = soldSkus.has(sku);
    const held = HELD_SKUS.has(sku);
    const tier = held || hasActiveProblem ? "hold" : hasSoldPressure ? "guarded" : "cleanest";
    return { sku, cleanCount, hasActiveProblem, hasSoldPressure, held, tier };
  });
  const selectableSkus = laneScores
    .filter((lane) => lane.tier === "cleanest" || (lane.tier === "guarded" && Number(lane.cleanCount) >= 8))
    .sort((a, b) => {
      const tierScore = (lane: { tier: string }) => (lane.tier === "cleanest" ? 0 : 1);
      return tierScore(a) - tierScore(b) || Number(b.cleanCount) - Number(a.cleanCount) || a.sku.localeCompare(b.sku);
    })
    .slice(0, 5)
    .map((lane) => lane.sku);
  const selectedRows: CleanRow[] = [];
  for (const sku of selectableSkus) {
    const rows = rehearsal.activeCleanRows.filter((row) => row.sku === sku).slice(0, PER_SKU_CAP);
    selectedRows.push(...rows);
    if (selectedRows.length >= TARGET_WRITE_CAP) break;
  }
  const cappedRows = selectedRows.slice(0, TARGET_WRITE_CAP);
  const normalizedCappedRows = cappedRows.map((row) => ({
    ...row,
    comparableKey: row.comparableKeyWithDetail ?? row.comparableKey,
  }));
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "headphone_discovered",
    sourceReport: "reports/headphone-non-airpods-no-write-acquisition-rehearsal-latest.json",
    metrics: {
      sourceActiveCleanRows: rehearsal.metrics.activeCleanRows,
      sourceActiveProblemRows: rehearsal.metrics.activeProblemRows,
      sourceSoldRows: rehearsal.metrics.soldRows,
      writeCap: TARGET_WRITE_CAP,
      perSkuCap: PER_SKU_CAP,
      selectedRows: normalizedCappedRows.length,
      selectedSkus: new Set(normalizedCappedRows.map((row) => row.sku)).size,
      plannedRawWrites: normalizedCappedRows.length,
      plannedParsedWrites: normalizedCappedRows.length,
      plannedCandidatePoolWrites: 0,
      plannedPublicPromotions: 0,
    },
    laneScores,
    selectedRows: normalizedCappedRows,
    selectedBySku: countBy(normalizedCappedRows, (row) => row.sku ?? "unknown"),
    writeBoundary: {
      allowed: ["mvp_raw_listings insert/upsert for selected clean active rows", "mvp_parsed_listings upsert for selected clean active rows"],
      forbidden: ["candidate_pool insert/update/delete", "public promotion", "market stats recalculation", "cron schedule changes"],
    },
    preApplyChecks: [
      "Re-read selected PIDs and confirm detail saleStatus is active.",
      "Confirm classifyListing(title, description, price) remains normal.",
      "Confirm parseListingOptions has comparableKey and needsReview=false.",
      "Abort if any selected PID already exists in candidate_pool.",
      "Abort if selected rows exceed writeCap.",
    ],
    decision: normalizedCappedRows.length >= 10 ? "non_airpods_headphone_tiny_db_acquisition_plan_ready" : "non_airpods_headphone_tiny_db_acquisition_plan_too_sparse",
    nextStep:
      "Build an apply script with dry-run/apply modes and hard aborts; run dry-run only before deciding whether to perform the tiny DB acquisition.",
  };
  await writeFile(
    path.join(reportsDir, "headphone-non-airpods-tiny-db-acquisition-plan-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const md = [
    "# Headphone Non-AirPods Tiny DB Acquisition Plan",
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
    `- sourceActiveCleanRows: ${report.metrics.sourceActiveCleanRows}`,
    `- sourceActiveProblemRows: ${report.metrics.sourceActiveProblemRows}`,
    `- sourceSoldRows: ${report.metrics.sourceSoldRows}`,
    `- writeCap: ${report.metrics.writeCap}`,
    `- perSkuCap: ${report.metrics.perSkuCap}`,
    `- selectedRows: ${report.metrics.selectedRows}`,
    `- selectedSkus: ${report.metrics.selectedSkus}`,
    `- plannedRawWrites: ${report.metrics.plannedRawWrites}`,
    `- plannedParsedWrites: ${report.metrics.plannedParsedWrites}`,
    `- plannedCandidatePoolWrites: ${report.metrics.plannedCandidatePoolWrites}`,
    "",
    "## Lane Scores",
    "",
    mdTable(
      ["sku", "clean", "activeProblem", "soldPressure", "held", "tier"],
      laneScores.map((lane) => [lane.sku, lane.cleanCount, lane.hasActiveProblem, lane.hasSoldPressure, lane.held, lane.tier]),
    ),
    "",
    "## Selected Rows",
    "",
    mdTable(
      ["pid", "title", "sku", "price", "status", "comparableKey"],
      normalizedCappedRows.map((row) => [row.pid, compact(row.title), row.sku ?? "", row.price, row.detailSaleStatus ?? "", row.comparableKey ?? ""]),
    ),
    "",
    "## Write Boundary",
    "",
    `- allowed: ${report.writeBoundary.allowed.join("; ")}`,
    `- forbidden: ${report.writeBoundary.forbidden.join("; ")}`,
    "",
    "## Pre-Apply Checks",
    "",
    ...report.preApplyChecks.map((check) => `- ${check}`),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-non-airpods-tiny-db-acquisition-plan-latest.md"), `${md}\n`);
  console.log(
    `headphone non-AirPods tiny acquisition plan: selected=${report.metrics.selectedRows}, skus=${report.metrics.selectedSkus}, candidatePoolWrites=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
