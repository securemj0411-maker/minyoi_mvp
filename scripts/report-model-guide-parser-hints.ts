import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { MODEL_GUIDES } from "@/lib/model-guides";

const reportsDir = path.join(process.cwd(), "reports");

function markdownTable(headers: string[], rows: Array<Array<string | number>>): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

async function main(): Promise<void> {
  const rows = MODEL_GUIDES.map((guide) => ({
    guideKey: guide.guideKey,
    category: guide.category,
    family: guide.family,
    model: guide.model,
    variantScope: guide.variantScope ?? "family",
    title: guide.title,
    mustSplitAxes: guide.parserHints.mustSplitAxes,
    positiveSignals: guide.parserHints.positiveSignals,
    ambiguousSignals: guide.parserHints.ambiguousSignals,
    negativeSignals: guide.parserHints.negativeSignals,
    partsSignals: guide.parserHints.partsSignals,
    manualReviewSignals: guide.parserHints.manualReviewSignals,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    runtimeMutation: false,
    purpose: [
      "Model guide parser hints are reference-only inputs for future parser/report work.",
      "Do not wire these hints directly into runtime parser/pipeline/candidate-pool logic without main review.",
      "When adding parser rules, compare proposed regex/tokens against mustSplitAxes, negativeSignals, and manualReviewSignals first.",
    ],
    rows,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "model-guide-parser-hints-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Model Guide Parser Hints",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only reference extracted from `src/lib/model-guides.ts`.",
    "",
    "Use this before parser/report work involving supported public families (`earphone`, `smartwatch`).",
    "",
    "## Usage Rules",
    "",
    ...report.purpose.map((line) => `- ${line}`),
    "",
    "## Guide Summary",
    "",
    markdownTable(
      ["guide_key", "category", "family", "variant_scope", "must_split_axes", "manual_review_signals"],
      rows.map((row) => [
        row.guideKey,
        row.category,
        row.family,
        row.variantScope,
        row.mustSplitAxes.join(", "),
        row.manualReviewSignals.join(", "),
      ]),
    ),
    "",
    "## Detailed Hints",
    "",
    ...rows.flatMap((row) => [
      `### ${row.title}`,
      "",
      `- guide_key: \`${row.guideKey}\``,
      `- family/model: \`${row.family}\` / \`${row.model}\``,
      `- variant_scope: \`${row.variantScope}\``,
      `- must_split_axes: ${row.mustSplitAxes.join(", ") || "-"}`,
      `- positive_signals: ${row.positiveSignals.join(", ") || "-"}`,
      `- ambiguous_signals: ${row.ambiguousSignals.join(", ") || "-"}`,
      `- negative_signals: ${row.negativeSignals.join(", ") || "-"}`,
      `- parts_signals: ${row.partsSignals.join(", ") || "-"}`,
      `- manual_review_signals: ${row.manualReviewSignals.join(", ") || "-"}`,
      "",
    ]),
  ].join("\n");

  await writeFile(path.join(reportsDir, "model-guide-parser-hints-latest.md"), `${md}\n`);
  console.log("wrote reports/model-guide-parser-hints-latest.json");
  console.log("wrote reports/model-guide-parser-hints-latest.md");
  console.log(`model guide parser hints: guides=${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
