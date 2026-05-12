import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchDetail } from "@/lib/bunjang";
import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";
import { describeSignals, detectSoldOut, isSoldOut } from "@/lib/sold-out";
import { serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type Plan = {
  decision: string;
  selectedRows: Array<{
    pid: number;
    title: string;
    price: number;
    query: string;
    sku: string | null;
    comparableKey: string | null;
  }>;
};

type RawSnapshot = {
  pid: number;
  name: string | null;
  price: number | null;
  listing_type: string | null;
  sku_id: string | null;
  detail_status: string | null;
  listing_state: string | null;
  sale_status: string | null;
};

type PoolSnapshot = {
  pid: number;
  status: string | null;
  comparable_key: string | null;
};

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional env file
  }
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

async function restJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`${url} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const plan = await readJson<Plan>("reports/headphone-non-airpods-tiny-db-acquisition-plan-latest.json");
  if (plan.decision !== "non_airpods_headphone_tiny_db_acquisition_plan_ready") {
    throw new Error(`Plan not ready: ${plan.decision}`);
  }
  if (plan.selectedRows.length > 20) throw new Error(`write cap exceeded: ${plan.selectedRows.length}`);
  const pids = plan.selectedRows.map((row) => row.pid);
  const pidFilter = pids.join(",");
  const [rawRows, poolRows] = await Promise.all([
    restJson<RawSnapshot[]>(
      `${tableUrl("mvp_raw_listings")}?select=pid,name,price,listing_type,sku_id,detail_status,listing_state,sale_status&pid=in.(${pidFilter})&limit=20`,
    ),
    restJson<PoolSnapshot[]>(`${tableUrl("mvp_candidate_pool")}?select=pid,status,comparable_key&pid=in.(${pidFilter})&limit=20`),
  ]);
  const rawByPid = new Map(rawRows.map((row) => [row.pid, row]));
  const poolByPid = new Map(poolRows.map((row) => [row.pid, row]));
  const checkedRows = [];
  for (const row of plan.selectedRows) {
    await sleep(100);
    const detail = await fetchDetail(String(row.pid));
    const description = detail?.description ?? "";
    const classified = classifyListing(row.title, description, row.price);
    const parsed = parseListingOptions({
      title: row.title,
      description,
      category: "earphone",
      skuId: row.sku,
      skuName: row.sku,
    });
    const soldSignals = detectSoldOut(detail, row.price, { title: row.title });
    const sold = isSoldOut(soldSignals);
    const existingRaw = rawByPid.get(row.pid) ?? null;
    const existingPool = poolByPid.get(row.pid) ?? null;
    const validationErrors = [
      !detail ? "detail_missing" : null,
      sold ? `sold_or_inactive:${detail?.saleStatus ?? "unknown"}` : null,
      classified.listingType !== "normal" ? `listing_type_not_normal:${classified.listingType}` : null,
      parsed.comparableKey !== row.comparableKey ? `comparable_key_changed:${parsed.comparableKey}` : null,
      parsed.needsReview ? "needs_review_true" : null,
      existingPool ? `candidate_pool_row_exists:${existingPool.status}` : null,
    ].filter((value): value is string => Boolean(value));
    checkedRows.push({
      ...row,
      detailFetched: Boolean(detail),
      saleStatus: detail?.saleStatus ?? null,
      sold,
      soldSignals: describeSignals(soldSignals),
      listingTypeWithDetail: classified.listingType,
      comparableKeyWithDetail: parsed.comparableKey,
      needsReviewWithDetail: parsed.needsReview,
      existingRaw,
      existingPool,
      plannedRawOperation: existingRaw ? "update_existing_raw" : "insert_raw",
      plannedParsedOperation: "upsert_parsed",
      validationErrors,
    });
  }
  const failedRows = checkedRows.filter((row) => row.validationErrors.length > 0);
  const passedRows = checkedRows.filter((row) => row.validationErrors.length === 0);
  const report = {
    generatedAt,
    mode: "dry_run",
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    sourcePlan: "reports/headphone-non-airpods-tiny-db-acquisition-plan-latest.json",
    metrics: {
      selectedRows: checkedRows.length,
      validationPassedRows: passedRows.length,
      validationFailedRows: failedRows.length,
      existingRawRows: rawRows.length,
      existingCandidatePoolRows: poolRows.length,
      plannedRawUpserts: passedRows.length,
      plannedParsedUpserts: passedRows.length,
      plannedCandidatePoolWrites: 0,
    },
    bySku: countBy(checkedRows, (row) => row.sku ?? "unknown"),
    failedByReason: countBy(failedRows.flatMap((row) => row.validationErrors), (reason) => reason),
    rows: checkedRows,
    failedRows,
    decision:
      failedRows.length === 0
        ? "non_airpods_headphone_tiny_db_acquisition_dry_run_passed"
        : "non_airpods_headphone_tiny_db_acquisition_dry_run_failed",
    nextStep:
      failedRows.length === 0
        ? "Owner/main-agent may decide whether to run apply with the same write cap; public promotion remains disabled."
        : "Remove failed rows or refine guards before any apply.",
  };
  await writeFile(
    path.join(reportsDir, "headphone-non-airpods-tiny-db-acquisition-dry-run-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const md = [
    "# Headphone Non-AirPods Tiny DB Acquisition Dry-Run",
    "",
    `- generatedAt: ${generatedAt}`,
    "- mode: dry_run",
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Metrics",
    "",
    `- selectedRows: ${report.metrics.selectedRows}`,
    `- validationPassedRows: ${report.metrics.validationPassedRows}`,
    `- validationFailedRows: ${report.metrics.validationFailedRows}`,
    `- existingRawRows: ${report.metrics.existingRawRows}`,
    `- existingCandidatePoolRows: ${report.metrics.existingCandidatePoolRows}`,
    `- plannedRawUpserts: ${report.metrics.plannedRawUpserts}`,
    `- plannedParsedUpserts: ${report.metrics.plannedParsedUpserts}`,
    `- plannedCandidatePoolWrites: ${report.metrics.plannedCandidatePoolWrites}`,
    "",
    "## Failed Reasons",
    "",
    mdTable(["reason", "count"], Object.entries(report.failedByReason)),
    "",
    "## Rows",
    "",
    mdTable(
      ["pid", "title", "sku", "status", "operation", "errors"],
      checkedRows.map((row) => [
        row.pid,
        compact(row.title),
        row.sku ?? "",
        row.saleStatus ?? "",
        `${row.plannedRawOperation}+${row.plannedParsedOperation}`,
        row.validationErrors.join("<br>") || "-",
      ]),
    ),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-non-airpods-tiny-db-acquisition-dry-run-latest.md"), `${md}\n`);
  console.log(
    `headphone non-AirPods tiny acquisition dry-run: passed=${passedRows.length}, failed=${failedRows.length}, rawExisting=${rawRows.length}, poolExisting=${poolRows.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
