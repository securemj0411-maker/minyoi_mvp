import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseGameConsoleListing, type GameConsoleListingType } from "@/lib/game-console-parser";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
  price?: number;
  url?: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

function argValue(name: string, fallback: string) {
  const match = process.argv.find((arg) => arg === name || arg.startsWith(`${name}=`));
  if (!match) return fallback;
  if (match === name) {
    const index = process.argv.indexOf(match);
    return process.argv[index + 1] ?? fallback;
  }
  return match.slice(name.length + 1) || fallback;
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function inc(map: Map<string, number>, key: string | null) {
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

function sampleView(sample: Sample, parsed: ReturnType<typeof parseGameConsoleListing>) {
  return {
    pid: sample.pid ?? null,
    title: sample.title ?? sample.name ?? "",
    price: sample.price ?? null,
    url: sample.url ?? (sample.pid ? `https://m.bunjang.co.kr/products/${sample.pid}` : null),
    listingType: parsed.listingType,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    reasons: parsed.reasons,
  };
}

async function main() {
  const category = argValue("--category", "game_console_body_narrow");
  const samplesPath = path.join(appDir, "category-intelligence", category, "normalized_samples.json");
  const samples = JSON.parse(await readFile(samplesPath, "utf-8")) as Sample[];

  const listingTypeCounts = new Map<GameConsoleListingType, number>();
  const comparableKeyCounts = new Map<string, number>();
  const reasonCounts = new Map<string, number>();
  const examples: Record<string, unknown[]> = {};

  let normal = 0;
  let parserReady = 0;
  let needsReview = 0;

  for (const sample of samples) {
    const title = sample.title ?? sample.name ?? "";
    const description = sample.description ?? "";
    const price = Number(sample.price ?? 0);
    const parsed = parseGameConsoleListing(title, description, price);
    inc(listingTypeCounts, parsed.listingType);
    inc(comparableKeyCounts, parsed.comparableKey);
    for (const reason of parsed.reasons) inc(reasonCounts, reason);

    if (!examples[parsed.listingType]) examples[parsed.listingType] = [];
    if (examples[parsed.listingType].length < 8) {
      examples[parsed.listingType].push(sampleView(sample, parsed));
    }

    if (parsed.listingType === "normal") {
      normal += 1;
      if (!parsed.needsReview) parserReady += 1;
    }
    if (parsed.needsReview) needsReview += 1;
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    category,
    total: samples.length,
    normal,
    normalRate: pct(normal, samples.length),
    parserReady,
    parserReadyRate: pct(parserReady, samples.length),
    normalParserReadyRate: pct(parserReady, normal),
    needsReview,
    needsReviewRate: pct(needsReview, samples.length),
    listingTypeCounts: rows(listingTypeCounts),
    topComparableKeys: rows(comparableKeyCounts),
    reasonCounts: rows(reasonCounts),
    examples,
    decision:
      pct(parserReady, samples.length) >= 60
        ? "parser_skeleton_ready_for_internal_runtime_review"
        : "hold_parser_more_rules_needed",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "game-console-parser-latest.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# Game Console Parser Report",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    markdownTable(
      ["metric", "value"],
      [
        ["total", summary.total],
        ["normal", `${summary.normalRate}% (${summary.normal})`],
        ["parser_ready", `${summary.parserReadyRate}% (${summary.parserReady})`],
        ["normal_parser_ready", `${summary.normalParserReadyRate}% (${summary.parserReady}/${summary.normal})`],
        ["needs_review", `${summary.needsReviewRate}% (${summary.needsReview})`],
        ["decision", summary.decision],
      ],
    ),
    "",
    "## Listing Types",
    "",
    markdownTable(["type", "count"], summary.listingTypeCounts.map((row) => [row.key, row.count])),
    "",
    "## Top Comparable Keys",
    "",
    markdownTable(["key", "count"], summary.topComparableKeys.map((row) => [row.key, row.count])),
    "",
    "## Review Reasons",
    "",
    markdownTable(["reason", "count"], summary.reasonCounts.map((row) => [row.key, row.count])),
  ].join("\n");

  await writeFile(path.join(reportsDir, "game-console-parser-latest.md"), `${md}\n`);

  console.log("wrote reports/game-console-parser-latest.json");
  console.log("wrote reports/game-console-parser-latest.md");
  console.log(`${summary.decision}; parser_ready=${summary.parserReadyRate}%, normal_ready=${summary.normalParserReadyRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
