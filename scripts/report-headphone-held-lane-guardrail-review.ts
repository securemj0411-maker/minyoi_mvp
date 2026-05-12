import { mkdir, writeFile } from "node:fs/promises";
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

const HELD_LANES = [
  {
    sku: "sony-wh-ch720n",
    reason: "active accessory/callout contamination",
    queries: ["소니 wh-ch720n 헤드폰", "소니 wh-ch 720n 헤드폰", "소니 ch720n 헤드폰", "소니 ch-720n 헤드폰"],
  },
  {
    sku: "sony-wh-1000xm6",
    reason: "sold-race pressure",
    queries: ["소니 wh-1000xm6 헤드폰", "소니 wh 1000xm6 헤드폰", "소니 xm6 헤드폰"],
  },
];

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
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const laneReports = [];
  for (const lane of HELD_LANES) {
    const items = [...(await collectSearchItems(lane.queries, 2, 120)).values()];
    const searchRows = items.map((item) => {
      const classified = classifyListing(item.name, "", item.price);
      const matched = ruleMatch(item.name, "");
      const sku = classified.sku ?? matched;
      const parsed = parseListingOptions({
        title: item.name,
        description: "",
        category: "earphone",
        skuId: sku?.id ?? null,
        skuName: sku?.modelName ?? null,
      });
      return {
        pid: Number(item.pid),
        title: item.name,
        price: item.price,
        query: item.query,
        searchListingType: classified.listingType,
        sku: sku?.id ?? null,
        comparableKey: parsed.comparableKey,
        needsReview: parsed.needsReview,
      };
    });
    const targetRows = searchRows.filter((row) => row.sku === lane.sku).slice(0, 30);
    const detailRows = [];
    for (const row of targetRows) {
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
        saleStatus: detail?.saleStatus ?? null,
        sold,
        soldSignalSummary: describeSignals(soldSignals),
        detailListingType: classifiedWithDetail.listingType,
        detailComparableKey: parsedWithDetail.comparableKey,
        detailNeedsReview: parsedWithDetail.needsReview,
        activeClean:
          Boolean(detail) &&
          !sold &&
          classifiedWithDetail.listingType === "normal" &&
          Boolean(parsedWithDetail.comparableKey) &&
          !parsedWithDetail.needsReview,
      });
    }
    const activeRows = detailRows.filter((row) => !row.sold);
    const activeCleanRows = detailRows.filter((row) => row.activeClean);
    const activeProblemRows = activeRows.filter((row) => !row.activeClean);
    const soldRows = detailRows.filter((row) => row.sold);
    laneReports.push({
      sku: lane.sku,
      reason: lane.reason,
      queries: lane.queries,
      metrics: {
        fetchedUnique: searchRows.length,
        targetRows: targetRows.length,
        detailRows: detailRows.length,
        activeRows: activeRows.length,
        activeCleanRows: activeCleanRows.length,
        activeProblemRows: activeProblemRows.length,
        soldRows: soldRows.length,
        activeCleanRate: activeCleanRows.length / Math.max(1, activeRows.length),
      },
      bySearchType: countBy(searchRows, (row) => row.searchListingType),
      byDetailType: countBy(detailRows, (row) => row.detailListingType),
      soldByStatus: countBy(soldRows, (row) => row.saleStatus ?? "unknown"),
      activeCleanRows,
      activeProblemRows,
      soldRows,
      recommendation:
        activeCleanRows.length / Math.max(1, activeRows.length) >= 0.85 && activeProblemRows.length <= 3
          ? "can_move_to_guarded_acquisition_after_isolation"
          : "keep_hold_until_guardrail_or_live_verify_improves",
    });
  }
  const report = {
    generatedAt,
    reportOnly: true,
    liveSearchNoWrite: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "headphone_discovered",
    laneReports,
    decision:
      laneReports.every((lane) => lane.recommendation === "can_move_to_guarded_acquisition_after_isolation")
        ? "held_headphone_lanes_can_be_guarded_after_pool_isolation"
        : "held_headphone_lanes_require_selective_hold",
    nextStep:
      "Use these lane recommendations when pool isolation exists; do not include held lanes in tiny acquisition before then.",
  };
  await writeFile(path.join(reportsDir, "headphone-held-lane-guardrail-review-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Headphone Held Lane Guardrail Review",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- liveSearchNoWrite: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    ...laneReports.flatMap((lane) => [
      `## ${lane.sku}`,
      "",
      `- reason: ${lane.reason}`,
      `- recommendation: ${lane.recommendation}`,
      `- fetchedUnique: ${lane.metrics.fetchedUnique}`,
      `- targetRows: ${lane.metrics.targetRows}`,
      `- activeRows: ${lane.metrics.activeRows}`,
      `- activeCleanRows: ${lane.metrics.activeCleanRows}`,
      `- activeProblemRows: ${lane.metrics.activeProblemRows}`,
      `- soldRows: ${lane.metrics.soldRows}`,
      `- activeCleanRate: ${(lane.metrics.activeCleanRate * 100).toFixed(1)}%`,
      "",
      "### Active Problems",
      "",
      lane.activeProblemRows.length
        ? mdTable(
            ["pid", "title", "price", "detailType", "status", "needsReview"],
            lane.activeProblemRows.slice(0, 20).map((row) => [
              row.pid,
              compact(row.title),
              row.price,
              row.detailListingType,
              row.saleStatus ?? "",
              row.detailNeedsReview,
            ]),
          )
        : "- none",
      "",
      "### Sold Rows",
      "",
      lane.soldRows.length
        ? mdTable(
            ["pid", "title", "status", "signals"],
            lane.soldRows.slice(0, 20).map((row) => [
              row.pid,
              compact(row.title),
              row.saleStatus ?? "",
              compact(row.soldSignalSummary, 80),
            ]),
          )
        : "- none",
      "",
    ]),
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-held-lane-guardrail-review-latest.md"), `${md}\n`);
  console.log(
    `headphone held lane review: ${laneReports.map((lane) => `${lane.sku}:${lane.recommendation}`).join(", ")}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
