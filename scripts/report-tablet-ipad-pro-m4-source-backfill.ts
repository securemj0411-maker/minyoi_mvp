import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const rows = [
    {
      family: "Apple iPad Pro",
      modelCode: "apple-ipad-pro-11-m4",
      displaySize: "11-inch",
      chip: "M4",
      storagesGb: [256, 512, 1000, 2000],
      connectivity: ["wifi", "cellular"],
      sourceConfidence: "high",
      sourceUrl: "https://support.apple.com/en-gb/119892",
      sourceNote: "Apple Support tech specs for iPad Pro 11-inch (M4).",
    },
    {
      family: "Apple iPad Pro",
      modelCode: "apple-ipad-pro-11-m4",
      displaySize: "11-inch",
      chip: "M4",
      storagesGb: [256, 512, 1000, 2000],
      connectivity: ["wifi", "cellular"],
      sourceConfidence: "high",
      sourceUrl: "https://www.apple.com/newsroom/2024/05/apple-unveils-stunning-new-ipad-pro-with-the-worlds-most-advanced-display-m4-chip-and-apple-pencil-pro/",
      sourceNote: "Apple announcement confirms M4 iPad Pro family and 11-inch model context.",
    },
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    supabaseRead: false,
    supabaseWrite: false,
    runtimeCatalogApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "tablet_discovered",
    lane: "apple_ipad_pro_11_m4_source_backfill",
    metrics: {
      rows: rows.length,
      highConfidenceRows: rows.filter((row) => row.sourceConfidence === "high").length,
      modelCodes: [...new Set(rows.map((row) => row.modelCode))].length,
    },
    rows,
    conclusion: "tablet_ipad_pro_11_m4_source_backfill_prepared_report_only",
    nextStep: "Join with live-read comparable-key density before any owner-ready claim.",
  };

  const jsonPath = path.join(reportsDir, "tablet-ipad-pro-m4-source-backfill-latest.json");
  const mdPath = path.join(reportsDir, "tablet-ipad-pro-m4-source-backfill-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(
    mdPath,
    [
      "# Tablet iPad Pro M4 Source Backfill",
      "",
      `- generatedAt: ${generatedAt}`,
      "- reportOnly: true",
      "- productionDbMutation: false",
      "- runtime/public/candidate wiring: false/false/false",
      `- conclusion: ${report.conclusion}`,
      "",
      "## Sources",
      "",
      ...rows.map((row) => `- ${row.modelCode}: ${row.sourceUrl} (${row.sourceNote})`),
      "",
      "## Next Step",
      "",
      report.nextStep,
      "",
    ].join("\n"),
  );

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    rows: report.metrics.rows,
    highConfidenceRows: report.metrics.highConfidenceRows,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
