import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ConsoleParser = {
  parserReadyRate: number;
  normalParserReadyRate: number;
  reasonCounts: Array<{ key: string; count: number }>;
  examples: Record<string, Array<{
    pid?: string | number | null;
    title?: string;
    price?: number | null;
    listingType?: string;
    comparableKey?: string | null;
    needsReview?: boolean;
    reasons?: string[];
  }>>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const strict = JSON.parse(await readFile(path.join(reportsDir, "game-console-parser-latest.json"), "utf8")) as ConsoleParser;
  const examplesByReason = new Map<string, Array<Record<string, unknown>>>();

  for (const examples of Object.values(strict.examples)) {
    for (const example of examples) {
      for (const reason of example.reasons ?? []) {
        const rows = examplesByReason.get(reason) ?? [];
        if (rows.length < 5) rows.push(example);
        examplesByReason.set(reason, rows);
      }
    }
  }

  const reasonRows = strict.reasonCounts.map((row) => ({
    reason: row.key,
    count: row.count,
    exampleCount: examplesByReason.get(row.key)?.length ?? 0,
    examples: examplesByReason.get(row.key) ?? [],
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "game_console_body_narrow",
    purpose: "Explain strict parser blockers without changing game console parser/runtime logic.",
    parserReadyRate: strict.parserReadyRate,
    normalParserReadyRate: strict.normalParserReadyRate,
    reasonRows,
    nextReportOnlyTasks: [
      "Review bundle_risk examples before any stricter full-set/body rule",
      "Keep unknown_or_mixed_edition review-gated",
      "Keep Switch 2 leakage review-gated until separate policy exists",
      "Do not modify game-console parser from this report",
    ],
    guardrails: [
      "No game-console parser change",
      "No runtime catalog apply",
      "No candidate pool policy wiring",
      "No public promotion",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "game-console-strict-parser-deep-dive-latest.json"), JSON.stringify(report, null, 2));

  const reasonTable = [
    "| reason | count | example_count | example_titles |",
    "| --- | --- | --- | --- |",
    ...reasonRows.map((row) =>
      `| ${row.reason} | ${row.count} | ${row.exampleCount} | ${row.examples.map((example) => String(example.title ?? "").replace(/\|/g, "/")).join("<br>")} |`,
    ),
  ].join("\n");

  const md = [
    "# Game Console Strict Parser Deep Dive",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only strict parser diagnosis. This is not parser wiring and not public promotion.",
    "",
    `- parser_ready: ${strict.parserReadyRate}%`,
    `- normal_parser_ready: ${strict.normalParserReadyRate}%`,
    "",
    "## Reason Rows",
    "",
    reasonTable,
    "",
    "## Next Report-Only Tasks",
    "",
    ...report.nextReportOnlyTasks.map((line) => `- ${line}`),
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "game-console-strict-parser-deep-dive-latest.md"), `${md}\n`);
  console.log("wrote reports/game-console-strict-parser-deep-dive-latest.json");
  console.log("wrote reports/game-console-strict-parser-deep-dive-latest.md");
  console.log(`game console strict deep dive: reasons=${reasonRows.length}, parser_ready=${strict.parserReadyRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
