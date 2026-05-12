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
      modelCode: "jbl-flip-6",
      brandModel: "JBL Flip 6",
      sourceTier: "official_product",
      sourceConfidence: "high",
      sourceUrl: "https://www.jbl.com/bluetooth-speakers/FLIP-6-.html",
      verifiedSpec: {
        productClass: "portable_bluetooth_speaker",
        waterDustRating: "IP67",
        bluetoothVersion: "5.1",
        batteryPlayTime: "up_to_12_hours",
        chargingCable: "USB-C",
      },
      parserImplication:
        "JBL Flip 6 is a portable Bluetooth speaker body lane; accessory-only case/rental/mixed-bundle rows must remain excluded.",
    },
    {
      modelCode: "jbl-flip-6",
      brandModel: "JBL Flip 6",
      sourceTier: "official_spec_sheet",
      sourceConfidence: "high",
      sourceUrl: "https://support.jbl.com/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw08391c21/pdfs/JBL_Flip_6_SpecSheet_English.pdf",
      verifiedSpec: {
        modelNo: "JBL Flip 6",
        transducers: "45x80mm_woofer_16mm_tweeter",
        outputPower: "20W_RMS_woofer_10W_RMS_tweeter",
        frequencyResponse: "63Hz-20kHz",
        battery: "17.28Wh_3.6V_4800mAh",
        dimensions: "178x68x72mm",
        weight: "0.55kg",
      },
      parserImplication:
        "Spec sheet confirms exact model identity and body dimensions; use as direct evidence before any future internal-only acquisition rehearsal.",
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
    category: "speaker_audio_discovered",
    target: "jbl-flip-6",
    rows,
    metrics: {
      sourceRows: rows.length,
      highConfidenceRows: rows.filter((row) => row.sourceConfidence === "high").length,
      officialRows: rows.filter((row) => row.sourceTier.startsWith("official")).length,
    },
    conclusion: "speaker_jbl_flip6_direct_source_backfill_ready_report_only",
    nextStep:
      "Regenerate JBL Flip 6 owner packet/checklist; if still blocked, the blocker should be live-row thinness or owner approval, not missing source evidence.",
  };

  const jsonPath = path.join(reportsDir, "speaker-jbl-flip6-source-backfill-latest.json");
  const mdPath = path.join(reportsDir, "speaker-jbl-flip6-source-backfill-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Speaker JBL Flip 6 Source Backfill",
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
    "",
    "## Evidence",
    "",
    mdTable(
      ["modelCode", "brandModel", "tier", "confidence", "verifiedSpec", "source"],
      rows.map((row) => [
        row.modelCode,
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
