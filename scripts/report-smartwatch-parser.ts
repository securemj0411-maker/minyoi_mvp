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
const samplesPath = path.join(appDir, "category-intelligence", "smartwatch_discovered", "normalized_samples.json");
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

function looksLikeStrapOrBand(title: string, description: string, price: number): boolean {
  const text = `${title}\n${description}`.toLowerCase();
  return (
    /(스트랩|밴드|브레이슬릿|링크브레이슬릿|링크 브레이슬릿|오션밴드|트레일루프|스포츠루프|메탈스트랩|가죽스트랩|시계줄|버클)/.test(text) &&
    !/(본체|풀박스|풀박|미개봉\s*애플워치|시계\s*본체)/.test(text) &&
    price > 0 &&
    price < 90_000
  );
}

function hasLowBattery(title: string, description: string): boolean {
  const text = `${title}\n${description}`.toLowerCase().replace(/\s+/g, "");
  return /배터리(?:성능|효율)?(?:은|는|:)?[0-7][0-9](?:%|프로|퍼|입니다|사진|$)/.test(text) || /배터리(?:성능|효율)?80%미만/.test(text);
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const gateCounts = new Map<string, number>();
  const skuCounts = new Map<string, number>();
  const keyCounts = new Map<string, number>();
  const sizeCounts = new Map<string, number>();
  const networkCounts = new Map<string, number>();
  const examples: Array<Record<string, string | number | null>> = [];

  let normal = 0;
  let normalWithSku = 0;
  let parserReady = 0;
  let needsReview = 0;
  let lowBatteryNormal = 0;
  let strapSuspect = 0;

  for (const sample of samples) {
    const title = sample.title ?? sample.name ?? "";
    const description = sample.description ?? "";
    const price = sample.price ?? 0;
    const strap = looksLikeStrapOrBand(title, description, price);
    if (strap) strapSuspect += 1;

    const classified = classifyListing(title, description, price);
    inc(gateCounts, classified.listingType);
    if (classified.listingType !== "normal") continue;

    normal += 1;
    if (hasLowBattery(title, description)) lowBatteryNormal += 1;
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
    inc(sizeCounts, String(parsed.parsedJson.watch_size_mm ?? "unknown_size"));
    inc(networkCounts, String(parsed.parsedJson.network ?? "unknown_network"));
    if (parsed.needsReview) {
      needsReview += 1;
      if (examples.length < 20) {
        examples.push({ pid: sample.pid ?? null, title, price, reason: "needs_review" });
      }
    } else {
      parserReady += 1;
    }
  }

  const summary = {
    category: "smartwatch_discovered",
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
    lowBatteryNormal,
    lowBatteryNormalRate: pct(lowBatteryNormal, normal),
    strapSuspect,
    gateCounts: rows(gateCounts),
    skuCounts: rows(skuCounts),
    keyCounts: rows(keyCounts),
    sizeCounts: rows(sizeCounts),
    networkCounts: rows(networkCounts),
    examples,
    recommendation:
      pct(parserReady, normalWithSku) >= 75 && lowBatteryNormal === 0 && strapSuspect === 0
        ? "parser_candidate: smartwatch parser mostly ready but keep discovered category approval-only"
        : "hold_report_only: smartwatch strap/low-battery/unknown SKU cases need review before promotion",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-parser-latest.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# Smartwatch Parser Spot Check",
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
        ["low_battery_normal", `${summary.lowBatteryNormalRate}% (${summary.lowBatteryNormal}/${summary.normal})`],
        ["strap_suspect", summary.strapSuspect],
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
    "## Size Counts",
    "",
    markdownTable(["size", "count"], summary.sizeCounts.map((row) => [row.key, row.count])),
    "",
    "## Network Counts",
    "",
    markdownTable(["network", "count"], summary.networkCounts.map((row) => [row.key, row.count])),
    "",
    "## Review Examples",
    "",
    markdownTable(["pid", "title", "price", "reason"], summary.examples.map((row) => [row.pid ?? "", row.title ?? "", row.price ?? "", row.reason ?? ""])),
  ].join("\n");

  await writeFile(path.join(reportsDir, "smartwatch-parser-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-parser-latest.json");
  console.log("wrote reports/smartwatch-parser-latest.md");
  console.log(`${summary.recommendation}; parser_ready=${summary.parserReadyRate}%, low_battery_normal=${summary.lowBatteryNormal}, strap_suspect=${summary.strapSuspect}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
