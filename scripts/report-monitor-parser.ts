import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing, type ListingType } from "@/lib/pipeline";

type MonitorSample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
  price?: number;
  url?: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const samplesPath = path.join(appDir, "category-intelligence", "monitor_discovered", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

function inc(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function rows(map: Map<string, number>, limit = 12) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function sampleView(sample: MonitorSample, extra: Record<string, unknown>) {
  return {
    pid: sample.pid ?? null,
    title: sample.title ?? sample.name ?? "",
    price: sample.price ?? null,
    url: sample.url ?? (sample.pid ? `https://m.bunjang.co.kr/products/${sample.pid}` : null),
    ...extra,
  };
}

function markdownTable(headers: string[], bodyRows: Array<Array<string | number>>) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...bodyRows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

async function main() {
  const samples = JSON.parse(await readFile(samplesPath, "utf-8")) as MonitorSample[];
  const keyCounts = new Map<string, number>();
  const typeCounts = new Map<ListingType, number>();
  const unknownCounts = new Map<string, number>();

  let hasModelCode = 0;
  let genericKey = 0;
  let needsReview = 0;
  let criticalUnknown = 0;
  let parserReady = 0;
  let eligibleTotal = 0;
  let eligibleHasModelCode = 0;
  let eligibleGenericKey = 0;
  let eligibleNeedsReview = 0;
  let eligibleCriticalUnknown = 0;
  let eligibleParserReady = 0;

  const genericExamples: unknown[] = [];
  const criticalExamples: unknown[] = [];
  const gateExamples: unknown[] = [];

  for (const sample of samples) {
    const title = sample.title ?? sample.name ?? "";
    const description = sample.description ?? "";
    const price = Number(sample.price ?? 0);
    const parsed = parseListingOptions({
      category: "monitor",
      skuId: "monitor",
      title,
      description,
    });
    const gate = classifyListing(title, description, price).listingType;

    inc(typeCounts, gate);
    if (parsed.comparableKey) inc(keyCounts, parsed.comparableKey);
    for (const part of (parsed.parsedJson.unknown_parts as string[] | undefined) ?? []) inc(unknownCounts, part);

    if (parsed.parsedJson.monitor_model_code) hasModelCode += 1;
    if (parsed.model === "generic_monitor") {
      genericKey += 1;
      if (genericExamples.length < 8) genericExamples.push(sampleView(sample, {
        comparableKey: parsed.comparableKey,
        unknownParts: parsed.parsedJson.unknown_parts,
      }));
    }
    if (parsed.needsReview) needsReview += 1;
    else parserReady += 1;
    const criticalParts = (parsed.parsedJson.critical_unknown as string[] | undefined) ?? [];
    if (criticalParts.length > 0) {
      criticalUnknown += 1;
      if (criticalExamples.length < 8) criticalExamples.push(sampleView(sample, {
        comparableKey: parsed.comparableKey,
        criticalUnknown: parsed.parsedJson.critical_unknown,
      }));
    }
    if (gate !== "unknown") {
      if (gateExamples.length < 10) gateExamples.push(sampleView(sample, { gate }));
    } else {
      eligibleTotal += 1;
      if (parsed.parsedJson.monitor_model_code) eligibleHasModelCode += 1;
      if (parsed.model === "generic_monitor") eligibleGenericKey += 1;
      if (parsed.needsReview) eligibleNeedsReview += 1;
      else eligibleParserReady += 1;
      if (criticalParts.length > 0) eligibleCriticalUnknown += 1;
    }
  }

  const total = samples.length;
  const summary = {
    generatedAt: new Date().toISOString(),
    total,
    hasModelCode,
    hasModelCodeRate: pct(hasModelCode, total),
    genericKey,
    genericKeyRate: pct(genericKey, total),
    parserReady,
    parserReadyRate: pct(parserReady, total),
    needsReview,
    needsReviewRate: pct(needsReview, total),
    criticalUnknown,
    criticalUnknownRate: pct(criticalUnknown, total),
    eligibleTotal,
    eligibleHasModelCode,
    eligibleHasModelCodeRate: pct(eligibleHasModelCode, eligibleTotal),
    eligibleGenericKey,
    eligibleGenericKeyRate: pct(eligibleGenericKey, eligibleTotal),
    eligibleParserReady,
    eligibleParserReadyRate: pct(eligibleParserReady, eligibleTotal),
    eligibleNeedsReview,
    eligibleNeedsReviewRate: pct(eligibleNeedsReview, eligibleTotal),
    eligibleCriticalUnknown,
    eligibleCriticalUnknownRate: pct(eligibleCriticalUnknown, eligibleTotal),
    gateCounts: rows(typeCounts),
    topComparableKeys: rows(keyCounts),
    unknownParts: rows(unknownCounts),
    genericExamples,
    criticalExamples,
    gateExamples,
    recommendation:
      pct(eligibleParserReady, eligibleTotal) >= 60 && pct(eligibleGenericKey, eligibleTotal) <= 40
        ? "parser_candidate: model-code key 중심으로 pool policy 설계 가능"
        : "hold: generic/unknown 비율이 높아 public pool 설계 전 parser 보강 필요",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "monitor-parser-latest.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# Monitor Parser Spot Check",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    markdownTable(
      ["metric", "value"],
      [
        ["total", total],
        ["has_model_code", `${summary.hasModelCodeRate}% (${hasModelCode})`],
        ["generic_key", `${summary.genericKeyRate}% (${genericKey})`],
        ["parser_ready", `${summary.parserReadyRate}% (${parserReady})`],
        ["needs_review", `${summary.needsReviewRate}% (${needsReview})`],
        ["critical_unknown", `${summary.criticalUnknownRate}% (${criticalUnknown})`],
        ["eligible_total", eligibleTotal],
        ["eligible_has_model_code", `${summary.eligibleHasModelCodeRate}% (${eligibleHasModelCode})`],
        ["eligible_generic_key", `${summary.eligibleGenericKeyRate}% (${eligibleGenericKey})`],
        ["eligible_parser_ready", `${summary.eligibleParserReadyRate}% (${eligibleParserReady})`],
        ["eligible_needs_review", `${summary.eligibleNeedsReviewRate}% (${eligibleNeedsReview})`],
        ["eligible_critical_unknown", `${summary.eligibleCriticalUnknownRate}% (${eligibleCriticalUnknown})`],
        ["recommendation", summary.recommendation],
      ],
    ),
    "",
    "## Gate Counts",
    "",
    markdownTable(["type", "count"], summary.gateCounts.map((row) => [row.key, row.count])),
    "",
    "## Unknown Parts",
    "",
    markdownTable(["part", "count"], summary.unknownParts.map((row) => [row.key, row.count])),
    "",
    "## Top Comparable Keys",
    "",
    markdownTable(["key", "count"], summary.topComparableKeys.map((row) => [row.key, row.count])),
  ].join("\n");
  await writeFile(path.join(reportsDir, "monitor-parser-latest.md"), `${md}\n`);

  console.log(`wrote ${path.join("reports", "monitor-parser-latest.json")}`);
  console.log(`wrote ${path.join("reports", "monitor-parser-latest.md")}`);
  console.log(
    `${summary.recommendation}; eligible_model_code=${summary.eligibleHasModelCodeRate}%, ` +
    `eligible_parser_ready=${summary.eligibleParserReadyRate}%, eligible_generic=${summary.eligibleGenericKeyRate}%`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
