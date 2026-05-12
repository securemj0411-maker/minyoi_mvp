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
      modelCode: "sony-a7m3",
      brandModel: "Sony Alpha 7 III / ILCE-7M3",
      sourceTier: "official_product",
      sourceConfidence: "high",
      sourceUrl: "https://www.sony.jp/ichigan/products/ILCE-7M3/",
      verifiedSpec: {
        officialModel: "ILCE-7M3",
        lensMount: "Sony_E_mount",
        sensorClass: "35mm_full_frame",
        imageSize3x2: "6000x4000_24M",
        productClass: "interchangeable_lens_digital_camera",
      },
      parserImplication:
        "A7M3/ILCE-7M3 is an interchangeable full-frame Sony E-mount body; body-only rows must not merge with lens-kit or full-box rows without explicit no-lens/body evidence.",
    },
    {
      modelCode: "sony-a7m3",
      brandModel: "Sony Alpha 7 III / ILCE-7M3",
      sourceTier: "official_help_guide",
      sourceConfidence: "high",
      sourceUrl: "https://helpguide.sony.net/ilc/1720/v1/en/contents/TP0001667693.html",
      verifiedSpec: {
        officialModel: "ILCE-7M3 α7III",
        cameraType: "interchangeable_lens_digital_camera",
        lensCompatibility: "Sony_E_mount_lens",
        sensor: "35.6x23.8mm_CMOS_full_frame",
      },
      parserImplication:
        "Use ILCE-7M3 and A7III aliases as direct model evidence, but require body/no-lens context before comparing prices.",
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
    category: "camera_discovered",
    target: "sony-a7m3",
    rows,
    metrics: {
      sourceRows: rows.length,
      highConfidenceRows: rows.filter((row) => row.sourceConfidence === "high").length,
      officialRows: rows.filter((row) => row.sourceTier.startsWith("official")).length,
    },
    conclusion: "camera_sony_a7m3_direct_source_backfill_ready_report_only",
    nextStep:
      "Regenerate A7M3 owner packet/checklist; keep execution blocked until second live-read wave increases confidence.",
  };

  const jsonPath = path.join(reportsDir, "camera-sony-a7m3-source-backfill-latest.json");
  const mdPath = path.join(reportsDir, "camera-sony-a7m3-source-backfill-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Camera Sony A7M3 Source Backfill",
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
