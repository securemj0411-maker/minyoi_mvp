import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type SpeakerReport = {
  category: string;
  modelMatchedRate: number;
  genericFamilyRate: number;
  familyCounts: CountRow[];
  modelCounts: CountRow[];
};

const reportsDir = path.join(process.cwd(), "reports");
const targetBrands = ["marshall", "jbl", "britz", "marantz"];

function familyForModel(modelKey: string): string {
  if (modelKey.startsWith("marshall-acton")) return "marshall-acton";
  if (modelKey.startsWith("marshall-emberton")) return "marshall-emberton";
  if (modelKey.startsWith("marshall-stanmore")) return "marshall-stanmore";
  if (modelKey.startsWith("jbl-go")) return "jbl-go";
  if (modelKey.startsWith("jbl-authentics")) return "jbl-authentics";
  if (modelKey.startsWith("jbl-boombox")) return "jbl-boombox";
  if (modelKey.startsWith("jbl-eon")) return "jbl-eon";
  if (modelKey.startsWith("jbl-xtreme")) return "jbl-xtreme";
  if (modelKey.startsWith("britz-bz")) return "britz-bz";
  if (modelKey.startsWith("britz-ba")) return "britz-ba";
  if (modelKey.startsWith("britz-br")) return "britz-br";
  if (modelKey.startsWith("marantz-model")) return "marantz-model";
  if (modelKey.startsWith("marantz-sr")) return "marantz-sr";
  return "other";
}

function deviceClass(family: string): string {
  if (family.startsWith("marantz")) return "amp_receiver";
  if (family === "jbl-eon") return "pa_speaker";
  if (family.startsWith("jbl") || family.startsWith("marshall") || family.startsWith("britz")) return "speaker";
  return "unknown_audio";
}

function brandOf(key: string): string {
  return key.split("-")[0] ?? key;
}

function targetFamilyRows(familyCounts: CountRow[]): CountRow[] {
  return familyCounts.filter((row) => targetBrands.includes(brandOf(row.key)));
}

async function main(): Promise<void> {
  const speaker = JSON.parse(await readFile(path.join(reportsDir, "speaker-parser-latest.json"), "utf8")) as SpeakerReport;
  const modelByFamily = new Map<string, CountRow[]>();

  for (const row of speaker.modelCounts) {
    const family = familyForModel(row.key);
    if (family === "other") continue;
    const rows = modelByFamily.get(family) ?? [];
    rows.push(row);
    modelByFamily.set(family, rows);
  }

  const familyRows = targetFamilyRows(speaker.familyCounts);
  const deepDiveRows = familyRows.map((row) => {
    const models = modelByFamily.get(row.key) ?? [];
    const exactModelCount = models.filter((model) => !model.key.endsWith("-unknown")).reduce((sum, model) => sum + model.count, 0);
    const unknownVariantCount = models.filter((model) => model.key.endsWith("-unknown")).reduce((sum, model) => sum + model.count, 0);
    const representedCount = exactModelCount + unknownVariantCount;
    const familyOnlyRemainder = Math.max(row.count - representedCount, 0);
    const status =
      deviceClass(row.key) !== "speaker"
        ? "hold_device_class_split"
        : familyOnlyRemainder > 0 || unknownVariantCount > 0
          ? "hold_family_only_or_unknown_variant"
          : "report_only_model_coded_subset";

    return {
      family: row.key,
      brand: brandOf(row.key),
      deviceClass: deviceClass(row.key),
      familyCount: row.count,
      exactModelCount,
      unknownVariantCount,
      familyOnlyRemainder,
      status,
      modelExamples: models.slice(0, 8),
    };
  });

  const statusCounts = deepDiveRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: speaker.category,
    decision: "hold_report_only",
    sourceReports: ["speaker-parser-latest.json", "speaker-family-blockers-latest.json"],
    metrics: {
      modelMatchedRate: speaker.modelMatchedRate,
      genericFamilyRate: speaker.genericFamilyRate,
      targetBrands,
      targetFamilyCount: familyRows.length,
      statusCounts,
    },
    rows: deepDiveRows,
    policyImplications: [
      "Marshall/JBL/Britz rows include model-coded subsets, but family-only and unknown-variant rows still need review before any candidate policy.",
      "Marantz rows are amp/receiver class and must not be mixed into portable/bookshelf speaker candidate keys.",
      "JBL EON is PA speaker class; it needs a separate class boundary from JBL Go/Boombox/Authenics/Xtreme rows.",
      "This report can feed a future policy draft, but it is not runtime wiring and not public promotion.",
    ],
    nextReportOnlyExperiments: [
      "separate amp_receiver and pa_speaker rows from speaker target families",
      "build generic speaker hold examples for exclusion tests",
      "draft model-coded speaker subset conditions without candidate pool wiring",
    ],
    doNotDo: [
      "Do not promote speaker_audio_discovered",
      "Do not use speaker-generic family as comparable key",
      "Do not wire Marshall/JBL/Britz/Marantz rows into candidate pool",
      "Do not merge amp_receiver, PA speaker, and portable speaker rows",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "speaker-family-deep-dive-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| family | device_class | family_count | exact_model | unknown_variant | family_only | status |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    ...deepDiveRows.map((row) =>
      `| ${row.family} | ${row.deviceClass} | ${row.familyCount} | ${row.exactModelCount} | ${row.unknownVariantCount} | ${row.familyOnlyRemainder} | ${row.status} |`,
    ),
  ].join("\n");

  const md = [
    "# Speaker Family Deep Dive",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only Marshall/JBL/Britz/Marantz model-coded vs family-only split. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- modelMatchedRate: ${report.metrics.modelMatchedRate}%`,
    `- genericFamilyRate: ${report.metrics.genericFamilyRate}%`,
    `- targetFamilyCount: ${report.metrics.targetFamilyCount}`,
    "",
    "## Target Family Rows",
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

  await writeFile(path.join(reportsDir, "speaker-family-deep-dive-latest.md"), `${md}\n`);
  console.log("wrote reports/speaker-family-deep-dive-latest.json");
  console.log("wrote reports/speaker-family-deep-dive-latest.md");
  console.log(`speaker family deep dive: target_families=${deepDiveRows.length}, statuses=${Object.keys(statusCounts).length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
