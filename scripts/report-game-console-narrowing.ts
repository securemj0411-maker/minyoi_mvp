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

type Gate =
  | "console_candidate"
  | Exclude<GameConsoleListingType, "normal">;

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

function reportSlug(category: string) {
  if (category === "game_console_discovered") return "game-console-narrowing";
  return category.replace(/_/g, "-");
}

function inc(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function rows(map: Map<string, number>, limit = 12) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function sampleView(sample: Sample, extra: Record<string, unknown>) {
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
  const category = argValue("--category", "game_console_discovered");
  const samplesPath = path.join(appDir, "category-intelligence", category, "normalized_samples.json");
  const samples = JSON.parse(await readFile(samplesPath, "utf-8")) as Sample[];
  const gateCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();
  const examples: Partial<Record<Gate, unknown[]>> = {};
  let consoleCandidates = 0;
  let knownModelCandidates = 0;

  for (const sample of samples) {
    const title = sample.title ?? sample.name ?? "";
    const description = sample.description ?? "";
    const price = Number(sample.price ?? 0);
    const parsed = parseGameConsoleListing(title, description, price);
    const gate: Gate = parsed.listingType === "normal" ? "console_candidate" : parsed.listingType;
    const model = parsed.model;
    inc(gateCounts, gate);
    if (model) inc(modelCounts, model);
    if (!examples[gate]) examples[gate] = [];
    if ((examples[gate]?.length ?? 0) < 8) {
      examples[gate]?.push(sampleView(sample, {
        gate,
        model,
        comparableKey: parsed.comparableKey,
        needsReview: parsed.needsReview,
        reasons: parsed.reasons,
      }));
    }
    if (gate === "console_candidate") {
      consoleCandidates += 1;
      if (model && parsed.edition && !parsed.edition.startsWith("unknown_") && !parsed.edition.startsWith("mixed_")) {
        knownModelCandidates += 1;
      }
    }
  }

  const total = samples.length;
  const summary = {
    generatedAt: new Date().toISOString(),
    category,
    total,
    consoleCandidates,
    consoleCandidateRate: pct(consoleCandidates, total),
    knownModelCandidates,
    knownModelCandidateRate: pct(knownModelCandidates, consoleCandidates),
    gateCounts: rows(gateCounts),
    topModels: rows(modelCounts),
    examples,
    recommendation:
      pct(consoleCandidates, total) >= 60 && pct(knownModelCandidates, consoleCandidates) >= 70
        ? "parser_candidate: console 본체 후보만 별도 parser/gate 설계 가능"
        : "hold_or_split_narrower: 본체 후보 비율이 낮아 Switch/PS5 등으로 더 좁혀야 함",
  };

  await mkdir(reportsDir, { recursive: true });
  const slug = reportSlug(category);
  await writeFile(path.join(reportsDir, `${slug}-latest.json`), JSON.stringify(summary, null, 2));

  const md = [
    `# Game Console Narrowing Report: ${category}`,
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    markdownTable(
      ["metric", "value"],
      [
        ["total", total],
        ["console_candidate", `${summary.consoleCandidateRate}% (${consoleCandidates})`],
        ["known_model_candidate", `${summary.knownModelCandidateRate}% (${knownModelCandidates}/${consoleCandidates})`],
        ["recommendation", summary.recommendation],
      ],
    ),
    "",
    "## Gate Counts",
    "",
    markdownTable(["gate", "count"], summary.gateCounts.map((row) => [row.key, row.count])),
    "",
    "## Top Models",
    "",
    markdownTable(["model", "count"], summary.topModels.map((row) => [row.key, row.count])),
  ].join("\n");
  await writeFile(path.join(reportsDir, `${slug}-latest.md`), `${md}\n`);

  console.log(`wrote reports/${slug}-latest.json`);
  console.log(`wrote reports/${slug}-latest.md`);
  console.log(`${summary.recommendation}; console_candidate=${summary.consoleCandidateRate}%, known_model_candidate=${summary.knownModelCandidateRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
