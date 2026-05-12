import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const rows = [
    {
      modelCode: "apple-mac-mini-m2",
      brandModel: "Apple Mac mini with M2",
      sourceTier: "official_tech_specs",
      sourceConfidence: "high",
      sourceUrl: "https://support.apple.com/en-lamr/111837",
      verifiedSpec: {
        productClass: "desktop_computer",
        releaseYear: "2023",
        chip: "Apple M2",
        memoryOptions: "8GB,16GB,24GB",
        storageOptions: "256GB,512GB,1TB,2TB",
      },
      parserImplication:
        "Mac mini M2 must be split by chip, RAM, and SSD. M2 Pro rows must not merge into the base M2 lane.",
    },
    {
      modelCode: "apple-mac-mini-m2-pro",
      brandModel: "Apple Mac mini with M2 Pro",
      sourceTier: "official_tech_specs",
      sourceConfidence: "high",
      sourceUrl: "https://support.apple.com/en-lamr/111837",
      verifiedSpec: {
        productClass: "desktop_computer",
        releaseYear: "2023",
        chip: "Apple M2 Pro",
        memoryOptions: "16GB,32GB",
        storageOptions: "512GB,1TB,2TB,4TB,8TB",
      },
      parserImplication:
        "Mac mini M2 Pro is a separate model lane; comparable keys should include chip tier, RAM, and SSD.",
    },
    {
      modelCode: "apple-mac-mini-m2-family",
      brandModel: "Apple Mac mini M2 / M2 Pro family",
      sourceTier: "official_newsroom",
      sourceConfidence: "high",
      sourceUrl:
        "https://www.apple.com/gn/newsroom/2023/01/apple-introduces-new-mac-mini-with-m2-and-m2-pro-more-powerful-capable-and-versatile-than-ever/",
      verifiedSpec: {
        announcementDate: "2023-01-17",
        availabilityDate: "2023-01-24",
        baseM2StartingPriceUsd: "599",
        m2ProStartingPriceUsd: "1299",
      },
      parserImplication:
        "Official launch copy confirms M2 and M2 Pro are separate price/performance lanes; do not compare them as one SKU.",
    },
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "desktop_pc_discovered",
    target: "apple-mac-mini-m2-family",
    rows,
    metrics: {
      sourceRows: rows.length,
      officialRows: rows.filter((row) => row.sourceTier.startsWith("official")).length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
    },
    conclusion: "desktop_macmini_m2_source_backfill_ready_report_only",
    nextStep:
      "Use this source backfill with the Mac mini M2 live-read wave to decide whether M2 16/512 or M2 Pro 16/512 deserves a narrow owner packet.",
  };

  const jsonPath = path.join(reportsDir, "desktop-macmini-m2-source-backfill-latest.json");
  const mdPath = path.join(reportsDir, "desktop-macmini-m2-source-backfill-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Desktop Mac mini M2 Source Backfill",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Metrics",
    "",
    `- sourceRows: ${report.metrics.sourceRows}`,
    `- officialRows: ${report.metrics.officialRows}`,
    "",
    "## Rows",
    "",
    "| modelCode | brandModel | tier | confidence | source | parserImplication |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) =>
      `| ${row.modelCode} | ${row.brandModel} | ${row.sourceTier} | ${row.sourceConfidence} | ${row.sourceUrl} | ${row.parserImplication} |`,
    ),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    sourceRows: report.metrics.sourceRows,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
