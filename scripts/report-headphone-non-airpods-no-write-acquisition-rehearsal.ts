import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectSearchItems, fetchDetail } from "@/lib/bunjang";
import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";
import { describeSignals, detectSoldOut, isSoldOut } from "@/lib/sold-out";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type QueryLanePlan = {
  queryLanes: Array<{
    sku: string;
    queries: string[];
    maxPagesPerQuery: number;
    detailSampleLimitBeforeWrite: number;
  }>;
};

type CandidateRow = {
  pid: number;
  title: string;
  price: number;
  query: string;
  sku: string | null;
  comparableKey: string | null;
  needsReview: boolean;
  listingType: string;
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 74) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function classifySearchRow(title: string, price: number, query: string): CandidateRow {
  const classified = classifyListing(title, "", price);
  const matchedSku = ruleMatch(title, "");
  const sku = classified.sku ?? matchedSku;
  const parsed = parseListingOptions({
    title,
    description: "",
    category: "earphone",
    skuId: sku?.id ?? null,
    skuName: sku?.modelName ?? null,
  });
  return {
    pid: 0,
    title,
    price,
    query,
    sku: sku?.id ?? null,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    listingType: classified.listingType,
  };
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const plan = await readJson<QueryLanePlan>("reports/headphone-non-airpods-query-lane-plan-latest.json");
  const rows: CandidateRow[] = [];
  const targetSkuSet = new Set(plan.queryLanes.map((lane) => lane.sku));
  for (const lane of plan.queryLanes) {
    const items = [...(await collectSearchItems(lane.queries, lane.maxPagesPerQuery, 120)).values()];
    for (const item of items) {
      const row = classifySearchRow(item.name, item.price, item.query);
      row.pid = Number(item.pid);
      if (row.sku === lane.sku && targetSkuSet.has(row.sku)) rows.push(row);
    }
  }
  const deduped = [...new Map(rows.map((row) => [row.pid, row])).values()];
  const positiveRows = deduped.filter((row) => row.listingType === "normal" && row.comparableKey && !row.needsReview);
  const bySku = new Map<string, CandidateRow[]>();
  for (const row of positiveRows) {
    if (!row.sku) continue;
    bySku.set(row.sku, [...(bySku.get(row.sku) ?? []), row]);
  }
  const detailSampleRows = [...bySku.values()].flatMap((skuRows) => skuRows.slice(0, 10));
  const detailRows = [];
  for (const row of detailSampleRows) {
    await sleep(100);
    const detail = await fetchDetail(String(row.pid));
    const description = detail?.description ?? "";
    const classifiedWithDetail = classifyListing(row.title, description, row.price);
    const parsedWithDetail = parseListingOptions({
      title: row.title,
      description,
      category: "earphone",
      skuId: row.sku,
      skuName: row.sku,
    });
    const soldSignals = detectSoldOut(detail, row.price, { title: row.title });
    const sold = isSoldOut(soldSignals);
    detailRows.push({
      ...row,
      detailFetched: Boolean(detail),
      detailSaleStatus: detail?.saleStatus ?? null,
      sold,
      soldSignalSummary: describeSignals(soldSignals),
      listingTypeWithDetail: classifiedWithDetail.listingType,
      comparableKeyWithDetail: parsedWithDetail.comparableKey,
      needsReviewWithDetail: parsedWithDetail.needsReview,
      activeClean:
        Boolean(detail) &&
        !sold &&
        classifiedWithDetail.listingType === "normal" &&
        Boolean(parsedWithDetail.comparableKey) &&
        !parsedWithDetail.needsReview,
    });
  }
  const activeDetailRows = detailRows.filter((row) => !row.sold);
  const activeCleanRows = detailRows.filter((row) => row.activeClean);
  const activeProblemRows = detailRows.filter((row) => !row.sold && !row.activeClean);
  const soldRows = detailRows.filter((row) => row.sold);
  const report = {
    generatedAt,
    reportOnly: true,
    liveSearchNoWrite: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "headphone_discovered",
    sourceReport: "reports/headphone-non-airpods-query-lane-plan-latest.json",
    metrics: {
      queryLanes: plan.queryLanes.length,
      fetchedAfterSkuFilter: deduped.length,
      positiveRows: positiveRows.length,
      detailSampleRows: detailRows.length,
      activeDetailRows: activeDetailRows.length,
      activeCleanRows: activeCleanRows.length,
      activeProblemRows: activeProblemRows.length,
      soldRows: soldRows.length,
      activeCleanRate: activeCleanRows.length / Math.max(1, activeDetailRows.length),
      candidatePoolWrites: 0,
      rawWrites: 0,
      parsedWrites: 0,
    },
    positiveBySku: countBy(positiveRows, (row) => row.sku ?? "unknown"),
    detailCleanBySku: countBy(activeCleanRows, (row) => row.sku ?? "unknown"),
    activeProblemByType: countBy(activeProblemRows, (row) => row.listingTypeWithDetail),
    soldByStatus: countBy(soldRows, (row) => row.detailSaleStatus ?? "unknown"),
    activeProblemRows,
    activeCleanRows,
    soldRows,
    decision:
      activeCleanRows.length / Math.max(1, activeDetailRows.length) >= 0.8 && activeProblemRows.length <= 8
        ? "non_airpods_headphone_no_write_rehearsal_passed"
        : "non_airpods_headphone_no_write_rehearsal_needs_more_guards",
    nextStep:
      "If pack/source health remains stable, prepare a tiny DB acquisition write-cap plan for the cleanest lanes only; keep public promotion disabled.",
  };
  await writeFile(
    path.join(reportsDir, "headphone-non-airpods-no-write-acquisition-rehearsal-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const md = [
    "# Headphone Non-AirPods No-Write Acquisition Rehearsal",
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
    `- fetchedAfterSkuFilter: ${report.metrics.fetchedAfterSkuFilter}`,
    `- positiveRows: ${report.metrics.positiveRows}`,
    `- detailSampleRows: ${report.metrics.detailSampleRows}`,
    `- activeDetailRows: ${report.metrics.activeDetailRows}`,
    `- activeCleanRows: ${report.metrics.activeCleanRows}`,
    `- activeProblemRows: ${report.metrics.activeProblemRows}`,
    `- soldRows: ${report.metrics.soldRows}`,
    `- activeCleanRate: ${(report.metrics.activeCleanRate * 100).toFixed(1)}%`,
    `- candidatePoolWrites: ${report.metrics.candidatePoolWrites}`,
    `- rawWrites: ${report.metrics.rawWrites}`,
    `- parsedWrites: ${report.metrics.parsedWrites}`,
    "",
    "## Positive by SKU",
    "",
    mdTable(["sku", "count"], Object.entries(report.positiveBySku)),
    "",
    "## Active Clean by SKU",
    "",
    mdTable(["sku", "count"], Object.entries(report.detailCleanBySku)),
    "",
    "## Active Problem by Type",
    "",
    mdTable(["type", "count"], Object.entries(report.activeProblemByType)),
    "",
    "## Active Problem Rows",
    "",
    activeProblemRows.length
      ? mdTable(
          ["pid", "title", "sku", "detailType", "status", "needsReview"],
          activeProblemRows.map((row) => [
            row.pid,
            compact(row.title),
            row.sku ?? "",
            row.listingTypeWithDetail,
            row.detailSaleStatus ?? "",
            row.needsReviewWithDetail,
          ]),
        )
      : "- none",
    "",
    "## Sold Rows",
    "",
    soldRows.length
      ? mdTable(
          ["pid", "title", "sku", "status", "signals"],
          soldRows.slice(0, 20).map((row) => [
            row.pid,
            compact(row.title),
            row.sku ?? "",
            row.detailSaleStatus ?? "",
            compact(row.soldSignalSummary, 80),
          ]),
        )
      : "- none",
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-non-airpods-no-write-acquisition-rehearsal-latest.md"), `${md}\n`);
  console.log(
    `headphone non-AirPods no-write rehearsal: positive=${positiveRows.length}, sample=${detailRows.length}, activeCleanRate=${(report.metrics.activeCleanRate * 100).toFixed(1)}%, problems=${activeProblemRows.length}, sold=${soldRows.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
