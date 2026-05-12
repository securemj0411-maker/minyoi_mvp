import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing, type ListingType } from "@/lib/pipeline";

type HeadphoneSample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
  price?: number;
  url?: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const samplesPath = path.join(appDir, "category-intelligence", "headphone_discovered", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function inc(map: Map<string, number>, key: string | null | undefined) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function rows(map: Map<string, number>, limit = 20) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function markdownTable(headers: string[], bodyRows: Array<Array<string | number>>) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...bodyRows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function sampleView(sample: HeadphoneSample, extra: Record<string, unknown>) {
  return {
    pid: sample.pid ?? null,
    title: sample.title ?? sample.name ?? "",
    price: sample.price ?? null,
    url: sample.url ?? (sample.pid ? `https://m.bunjang.co.kr/products/${sample.pid}` : null),
    ...extra,
  };
}

function looksLikeNonProductAirpodsMax(title: string, description: string, price: number) {
  const text = `${title}\n${description}`.normalize("NFKC").toLowerCase();
  return (
    price < 50_000 &&
    /에어팟\s*맥스|airpods\s*max|에어팟맥스/.test(text) &&
    /(포카|포토\s*카드|특전|케이스|case|커버|스티커|키링|거치대)/.test(text)
  );
}

async function main() {
  const samples = JSON.parse(await readFile(samplesPath, "utf-8")) as HeadphoneSample[];
  const gateCounts = new Map<ListingType, number>();
  const skuCounts = new Map<string, number>();
  const comparableKeyCounts = new Map<string, number>();
  const airpodsMaxGenerationCounts = new Map<string, number>();
  const airpodsMaxConnectorCounts = new Map<string, number>();

  let normal = 0;
  let normalWithSku = 0;
  let parserReady = 0;
  let needsReview = 0;
  let airpodsMax = 0;
  let airpodsMaxReady = 0;
  let airpodsMaxUnknownGeneration = 0;
  let airpodsMaxUnknownConnector = 0;
  let nonProductSuspect = 0;

  const unknownGenerationExamples: unknown[] = [];
  const unknownConnectorExamples: unknown[] = [];
  const nonProductSuspectExamples: unknown[] = [];
  const unknownSkuExamples: unknown[] = [];

  for (const sample of samples) {
    const title = sample.title ?? sample.name ?? "";
    const description = sample.description ?? "";
    const price = Number(sample.price ?? 0);
    const classified = classifyListing(title, description, price);
    inc(gateCounts, classified.listingType);

    if (classified.listingType === "normal") normal += 1;
    if (!classified.sku) {
      if (classified.listingType === "unknown" && unknownSkuExamples.length < 10) {
        unknownSkuExamples.push(sampleView(sample, { gate: classified.listingType }));
      }
      continue;
    }

    normalWithSku += 1;
    inc(skuCounts, classified.sku.id);
    const parsed = parseListingOptions({
      category: classified.sku.category,
      skuId: classified.sku.id,
      skuName: classified.sku.modelName,
      title,
      description,
    });
    inc(comparableKeyCounts, parsed.comparableKey);
    if (parsed.needsReview) needsReview += 1;
    else parserReady += 1;

    if (classified.sku.id === "airpods-max") {
      airpodsMax += 1;
      const generation = String(parsed.parsedJson.airpods_max_generation ?? "none");
      const connector = String(parsed.parsedJson.airpods_connector ?? "unknown_connector");
      inc(airpodsMaxGenerationCounts, generation);
      inc(airpodsMaxConnectorCounts, connector);
      if (!parsed.needsReview) airpodsMaxReady += 1;
      if (generation === "unknown_generation") {
        airpodsMaxUnknownGeneration += 1;
        if (unknownGenerationExamples.length < 10) {
          unknownGenerationExamples.push(sampleView(sample, {
            comparableKey: parsed.comparableKey,
            connector,
            generation,
          }));
        }
      }
      if (connector === "unknown_connector") {
        airpodsMaxUnknownConnector += 1;
        if (unknownConnectorExamples.length < 10) {
          unknownConnectorExamples.push(sampleView(sample, {
            comparableKey: parsed.comparableKey,
            connector,
            generation,
          }));
        }
      }
      if (looksLikeNonProductAirpodsMax(title, description, price)) {
        nonProductSuspect += 1;
        if (nonProductSuspectExamples.length < 10) {
          nonProductSuspectExamples.push(sampleView(sample, {
            comparableKey: parsed.comparableKey,
            connector,
            generation,
          }));
        }
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    category: "headphone_discovered",
    total: samples.length,
    normal,
    normalRate: pct(normal, samples.length),
    normalWithSku,
    normalWithSkuRate: pct(normalWithSku, samples.length),
    parserReady,
    parserReadyRate: pct(parserReady, normalWithSku),
    needsReview,
    needsReviewRate: pct(needsReview, normalWithSku),
    airpodsMax,
    airpodsMaxReady,
    airpodsMaxReadyRate: pct(airpodsMaxReady, airpodsMax),
    airpodsMaxUnknownGeneration,
    airpodsMaxUnknownGenerationRate: pct(airpodsMaxUnknownGeneration, airpodsMax),
    airpodsMaxUnknownConnector,
    airpodsMaxUnknownConnectorRate: pct(airpodsMaxUnknownConnector, airpodsMax),
    nonProductSuspect,
    gateCounts: rows(gateCounts),
    skuCounts: rows(skuCounts),
    topComparableKeys: rows(comparableKeyCounts),
    airpodsMaxGenerationCounts: rows(airpodsMaxGenerationCounts),
    airpodsMaxConnectorCounts: rows(airpodsMaxConnectorCounts),
    unknownGenerationExamples,
    unknownConnectorExamples,
    nonProductSuspectExamples,
    unknownSkuExamples,
    recommendation:
      pct(parserReady, normalWithSku) >= 85 && nonProductSuspect === 0
        ? "parser_candidate: matched headphone SKUs mostly ready, still approval-only for discovered category"
        : "hold_report_only: AirPods Max unknown/non-product suspects need review before any promotion",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-parser-latest.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# Headphone Parser Spot Check",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    markdownTable(
      ["metric", "value"],
      [
        ["total", summary.total],
        ["normal", `${summary.normalRate}% (${summary.normal})`],
        ["normal_with_sku", `${summary.normalWithSkuRate}% (${summary.normalWithSku})`],
        ["parser_ready_of_matched", `${summary.parserReadyRate}% (${summary.parserReady}/${summary.normalWithSku})`],
        ["needs_review_of_matched", `${summary.needsReviewRate}% (${summary.needsReview}/${summary.normalWithSku})`],
        ["airpods_max_ready", `${summary.airpodsMaxReadyRate}% (${summary.airpodsMaxReady}/${summary.airpodsMax})`],
        ["airpods_max_unknown_generation", `${summary.airpodsMaxUnknownGenerationRate}% (${summary.airpodsMaxUnknownGeneration}/${summary.airpodsMax})`],
        ["airpods_max_unknown_connector", `${summary.airpodsMaxUnknownConnectorRate}% (${summary.airpodsMaxUnknownConnector}/${summary.airpodsMax})`],
        ["non_product_suspect", summary.nonProductSuspect],
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
    "## AirPods Max Generation",
    "",
    markdownTable(["generation", "count"], summary.airpodsMaxGenerationCounts.map((row) => [row.key, row.count])),
    "",
    "## AirPods Max Connector",
    "",
    markdownTable(["connector", "count"], summary.airpodsMaxConnectorCounts.map((row) => [row.key, row.count])),
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-parser-latest.md"), `${md}\n`);

  console.log("wrote reports/headphone-parser-latest.json");
  console.log("wrote reports/headphone-parser-latest.md");
  console.log(
    `${summary.recommendation}; parser_ready=${summary.parserReadyRate}%, ` +
    `airpods_max_ready=${summary.airpodsMaxReadyRate}%, non_product_suspect=${summary.nonProductSuspect}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
