import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

type Sample = {
  pid?: string;
  title?: string;
  name?: string;
  description?: string;
  price?: number;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "earphone_discovered", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

function inc(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Number(((part / total) * 100).toFixed(1));
}

function rows(map: Map<string, number>): Array<{ key: string; count: number }> {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function markdownTable(headers: string[], rowsValue: Array<Array<string | number>>): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rowsValue.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function isNonAirpodsEarphone(title: string, description: string): boolean {
  return /(버즈|buds|qcy|톤프리|tone\s*free|hbs|비츠|beats|nctw|atf|이어폰)/i.test(`${title}\n${description}`) && !/(에어팟|airpods)/i.test(`${title}\n${description}`);
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const gateCounts = new Map<string, number>();
  const skuCounts = new Map<string, number>();
  const keyCounts = new Map<string, number>();
  const connectorCounts = new Map<string, number>();
  const examples: Array<Record<string, string | number | null>> = [];

  let normal = 0;
  let normalWithSku = 0;
  let parserReady = 0;
  let needsReview = 0;
  let nonAirpodsNormal = 0;
  let airpodsNormal = 0;

  for (const sample of samples) {
    const title = sample.title ?? sample.name ?? "";
    const description = sample.description ?? "";
    const price = sample.price ?? 0;
    const classified = classifyListing(title, description, price);
    inc(gateCounts, classified.listingType);
    if (classified.listingType !== "normal") continue;

    normal += 1;
    if (isNonAirpodsEarphone(title, description)) nonAirpodsNormal += 1;
    else airpodsNormal += 1;

    if (!classified.sku) {
      if (examples.length < 20) examples.push({ pid: sample.pid ?? null, title, price, reason: "no_sku" });
      continue;
    }

    normalWithSku += 1;
    inc(skuCounts, classified.sku.id);
    const parsed = parseListingOptions({
      category: classified.sku.category,
      skuId: classified.sku.id,
      title,
      description,
    });
    inc(keyCounts, parsed.comparableKey ?? "missing_comparable_key");
    inc(connectorCounts, String(parsed.parsedJson.airpods_connector ?? "none"));
    if (parsed.needsReview) {
      needsReview += 1;
      if (examples.length < 20) examples.push({ pid: sample.pid ?? null, title, price, reason: "needs_review" });
    } else {
      parserReady += 1;
    }
  }

  const summary = {
    category: "earphone_discovered",
    generatedAt: new Date().toISOString(),
    total: samples.length,
    normal,
    normalRate: pct(normal, samples.length),
    normalWithSku,
    normalWithSkuRate: pct(normalWithSku, normal),
    parserReady,
    parserReadyRate: pct(parserReady, normalWithSku),
    needsReview,
    needsReviewRate: pct(needsReview, normalWithSku),
    airpodsNormal,
    nonAirpodsNormal,
    nonAirpodsNormalRate: pct(nonAirpodsNormal, normal),
    gateCounts: rows(gateCounts),
    skuCounts: rows(skuCounts),
    keyCounts: rows(keyCounts),
    connectorCounts: rows(connectorCounts),
    examples,
    recommendation:
      pct(parserReady, normalWithSku) >= 80 && pct(nonAirpodsNormal, normal) <= 25
        ? "parser_candidate: AirPods-focused earphone parser usable, keep non-AirPods approval-only"
        : "hold_report_only: non-AirPods/generic earphone and parts-heavy samples need policy",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "earphone-parser-latest.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# Earphone Parser Spot Check",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    markdownTable(
      ["metric", "value"],
      [
        ["total", summary.total],
        ["normal", `${summary.normalRate}% (${summary.normal})`],
        ["normal_with_sku", `${summary.normalWithSkuRate}% (${summary.normalWithSku}/${summary.normal})`],
        ["parser_ready_of_matched", `${summary.parserReadyRate}% (${summary.parserReady}/${summary.normalWithSku})`],
        ["needs_review_of_matched", `${summary.needsReviewRate}% (${summary.needsReview}/${summary.normalWithSku})`],
        ["non_airpods_normal", `${summary.nonAirpodsNormalRate}% (${summary.nonAirpodsNormal}/${summary.normal})`],
        ["recommendation", summary.recommendation],
      ],
    ),
    "",
    "## Gate Counts",
    "",
    markdownTable(["type", "count"], summary.gateCounts.map((row) => [row.key, row.count])),
    "",
    "## SKU Counts",
    "",
    markdownTable(["sku", "count"], summary.skuCounts.map((row) => [row.key, row.count])),
    "",
    "## Connector Counts",
    "",
    markdownTable(["connector", "count"], summary.connectorCounts.map((row) => [row.key, row.count])),
    "",
    "## Review Examples",
    "",
    markdownTable(["pid", "title", "price", "reason"], summary.examples.map((row) => [row.pid ?? "", row.title ?? "", row.price ?? "", row.reason ?? ""])),
  ].join("\n");

  await writeFile(path.join(reportsDir, "earphone-parser-latest.md"), `${md}\n`);
  console.log("wrote reports/earphone-parser-latest.json");
  console.log("wrote reports/earphone-parser-latest.md");
  console.log(`${summary.recommendation}; parser_ready=${summary.parserReadyRate}%, non_airpods_normal=${summary.nonAirpodsNormalRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
