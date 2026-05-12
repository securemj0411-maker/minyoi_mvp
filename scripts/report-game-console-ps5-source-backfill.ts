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
      modelCode: "playstation-5-disc",
      brandModel: "PlayStation 5 Console",
      sourceTier: "official_product",
      sourceConfidence: "high",
      sourceUrl: "https://www.playstation.com/ps5/",
      verifiedSpec: {
        productClass: "game_console_body",
        editionAxis: "disc_drive_console",
        media: "disc_and_digital",
      },
      parserImplication:
        "PS5 Disc console must not merge with Digital Edition or separate disc-drive accessory rows.",
    },
    {
      modelCode: "playstation-5-digital",
      brandModel: "PlayStation 5 Digital Edition",
      sourceTier: "official_product",
      sourceConfidence: "high",
      sourceUrl: "https://direct.playstation.com/en-us/buy-consoles/playstation5-digital-edition-console-825-gb",
      verifiedSpec: {
        productClass: "game_console_body",
        editionAxis: "digital_no_disc_drive",
        media: "digital_only",
      },
      parserImplication:
        "Digital Edition has no disc drive; rows mentioning disc drive as an accessory or add-on must stay outside body lane.",
    },
    {
      modelCode: "playstation-5-slim-family",
      brandModel: "PlayStation 5 slim model group",
      sourceTier: "official_product",
      sourceConfidence: "high",
      sourceUrl: "https://www.playstation.com/ps5/",
      verifiedSpec: {
        productClass: "game_console_body",
        modelGroup: "CFI-2000/CFI-2100 slim",
        accessoryAxis: "detachable_disc_drive_for_slim_digital",
      },
      parserImplication:
        "Slim Disc and Slim Digital are separate body lanes. Standalone disc drive is an accessory, not a console body.",
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
    category: "game_console_body_narrow",
    target: "playstation-5-body-family",
    rows,
    metrics: {
      sourceRows: rows.length,
      officialRows: rows.filter((row) => row.sourceTier.startsWith("official")).length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
    },
    conclusion: "game_console_ps5_source_backfill_ready_report_only",
    nextStep:
      "Use with PS5 live-read wave to decide whether Disc and Digital body lanes can enter owner-review after P0 stabilization.",
  };

  const jsonPath = path.join(reportsDir, "game-console-ps5-source-backfill-latest.json");
  const mdPath = path.join(reportsDir, "game-console-ps5-source-backfill-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Game Console PS5 Source Backfill",
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
