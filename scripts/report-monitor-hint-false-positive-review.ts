import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Example = {
  pid?: string;
  title?: string;
  price?: number;
  url?: string;
  comparableKey?: string;
  source?: string;
};

type HintRow = {
  hint: string;
  count: number;
  examples: Example[];
};

type MonitorDeepDive = {
  category: string;
  hintRows: HintRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function classify(row: HintRow): string {
  const title = row.examples.map((example) => example.title ?? "").join(" ");
  const comparableKey = row.examples.map((example) => example.comparableKey ?? "").join(" ");
  if (/부품|거치대|스탠드|모니터암|stand|arm/i.test(title)) return "false_positive_accessory_or_parts";
  if (/듀얼모니터|dual/i.test(title)) return "hold_multi_or_bundle_risk";
  if (/generic_monitor/.test(comparableKey)) return "hold_generic_key_risk";
  return "reviewable_model_code_hint";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const deepDive = JSON.parse(
    await readFile(path.join(reportsDir, "monitor-model-code-deep-dive-latest.json"), "utf8"),
  ) as MonitorDeepDive;

  const rows = deepDive.hintRows.map((row) => ({
    hint: row.hint,
    count: row.count,
    reviewClass: classify(row),
    action:
      classify(row) === "reviewable_model_code_hint"
        ? "manual_review_before_test_candidate"
        : "exclude_from_model_code_policy_candidate",
    examples: row.examples,
  }));
  const classCounts = countBy(rows.map((row) => row.reviewClass));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: deepDive.category,
    decision: "hold_report_only_review_list",
    sourceReports: ["monitor-model-code-deep-dive-latest.json", "monitor-model-code-blockers-latest.json"],
    metrics: {
      hintRows: rows.length,
      classCounts,
    },
    rows,
    policyImplications: [
      "Hint tokens are not approved model codes.",
      "Accessory/parts and multi/bundle risks must be excluded from any model-code candidate review.",
      "Reviewable hints can become test candidates only after manual confirmation outside this subagent scope.",
    ],
    nextReportOnlyExperiments: [
      "collect confirmed monitor model-code hints into a test-candidate-only report",
      "separate accessory/stand/parts rows from generic monitor denominator",
      "rank critical unknown fields for confirmed model-code hints",
    ],
    doNotDo: [
      "Do not public-promote monitor_discovered",
      "Do not wire model-code policy into candidate pool",
      "Do not add these hints to runtime catalog",
      "Do not treat hintRows as approved model codes",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "monitor-hint-false-positive-review-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| hint | review_class | action | example_title |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => {
      const title = row.examples[0]?.title?.replace(/\|/g, "\\|") ?? "-";
      return `| ${row.hint} | ${row.reviewClass} | ${row.action} | ${title} |`;
    }),
  ].join("\n");

  const md = [
    "# Monitor Hint False-Positive Review",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only monitor model-code hint review list. This is not runtime wiring and not public promotion.",
    "",
    "## Hint Rows",
    "",
    table,
    "",
    "## Policy Implications",
    "",
    ...report.policyImplications.map((line) => `- ${line}`),
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "monitor-hint-false-positive-review-latest.md"), `${md}\n`);
  console.log("wrote reports/monitor-hint-false-positive-review-latest.json");
  console.log("wrote reports/monitor-hint-false-positive-review-latest.md");
  console.log(`monitor hint false-positive review: hints=${rows.length}, classes=${classCounts.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
