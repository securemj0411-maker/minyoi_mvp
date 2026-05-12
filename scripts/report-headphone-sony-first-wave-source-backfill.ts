import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const rows = [
    {
      skuId: "sony-wh-1000xm4",
      brandModel: "Sony WH-1000XM4",
      sourceTier: "official_support_specs",
      sourceConfidence: "high",
      sourceUrl: "https://www.sony.com/electronics/support/wireless-headphones-bluetooth-headphones/wh-1000xm4/specifications",
      verifiedSpec: {
        productClass: "wireless_noise_canceling_headphones",
        model: "WH-1000XM4",
        frequencyResponse: "4Hz-40000Hz",
        bluetoothBand: "2.4GHz",
      },
      parserImplication:
        "WH-1000XM4 is a full headphone body SKU; pads/cables/cases/accessories and damaged/parts rows must remain excluded.",
    },
    {
      skuId: "sony-wh-ch520",
      brandModel: "Sony WH-CH520",
      sourceTier: "official_help_guide_specs",
      sourceConfidence: "high",
      sourceUrl: "https://helpguide.sony.net/mdr/2958/v1/en/contents/TP1000783326.html",
      verifiedSpec: {
        productClass: "wireless_stereo_headset",
        model: "WH-CH520",
        type: "on_ear_wireless_headphones",
        supportPage: "Sony_help_guide",
      },
      parserImplication:
        "WH-CH520 is a full wireless headset/headphone SKU; accessory-only or buying/trade rows must not enter the same comparable key.",
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
    category: "headphone_discovered",
    target: "sony-wh-1000xm4, sony-wh-ch520",
    rows,
    metrics: {
      sourceRows: rows.length,
      highConfidenceRows: rows.filter((row) => row.sourceConfidence === "high").length,
      officialRows: rows.filter((row) => row.sourceTier.startsWith("official")).length,
      coveredSkus: rows.map((row) => row.skuId),
    },
    conclusion: "headphone_sony_first_wave_direct_source_backfill_ready_report_only",
    nextStep:
      "Regenerate headphone owner packet/checklist; keep execution dormant until P0 stability and owner approval.",
  };

  const jsonPath = path.join(reportsDir, "headphone-sony-first-wave-source-backfill-latest.json");
  const mdPath = path.join(reportsDir, "headphone-sony-first-wave-source-backfill-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Headphone Sony First Wave Source Backfill",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Target",
    "",
    `- category: ${report.category}`,
    `- target: ${report.target}`,
    "",
    "## Metrics",
    "",
    `- sourceRows: ${report.metrics.sourceRows}`,
    `- highConfidenceRows: ${report.metrics.highConfidenceRows}`,
    `- officialRows: ${report.metrics.officialRows}`,
    `- coveredSkus: ${report.metrics.coveredSkus.join(", ")}`,
    "",
    "## Evidence",
    "",
    mdTable(
      ["skuId", "brandModel", "tier", "confidence", "verifiedSpec", "source"],
      rows.map((row) => [
        row.skuId,
        row.brandModel,
        row.sourceTier,
        row.sourceConfidence,
        Object.entries(row.verifiedSpec).map(([key, value]) => `${key}:${value}`).join(", "),
        row.sourceUrl,
      ]),
    ),
    "",
    "## Parser Implication",
    "",
    ...rows.map((row) => `- ${row.parserImplication}`),
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
