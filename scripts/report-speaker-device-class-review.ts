import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ModelExample = { key: string; count: number };
type SpeakerFamilyRow = {
  family: string;
  brand: string;
  deviceClass: string;
  familyCount: number;
  exactModelCount: number;
  unknownVariantCount: number;
  familyOnlyRemainder: number;
  status: string;
  modelExamples: ModelExample[];
};

type SpeakerDeepDive = {
  category: string;
  rows: SpeakerFamilyRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function actionFor(row: SpeakerFamilyRow): string {
  if (row.deviceClass === "amp_receiver") return "exclude_from_portable_speaker_candidate";
  if (row.deviceClass === "pa_speaker") return "hold_separate_pa_speaker_boundary";
  if (row.unknownVariantCount > 0 || row.familyOnlyRemainder > 0) return "keep_hold_until_variant_confirmed";
  return "manual_review_before_model_coded_subset_candidate";
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
    await readFile(path.join(reportsDir, "speaker-family-deep-dive-latest.json"), "utf8"),
  ) as SpeakerDeepDive;

  const rows = deepDive.rows.map((row) => ({
    ...row,
    action: actionFor(row),
  }));
  const deviceClassCounts = countBy(rows.map((row) => row.deviceClass));
  const actionCounts = countBy(rows.map((row) => row.action));
  const holdRows = rows.filter((row) => row.action !== "manual_review_before_model_coded_subset_candidate");
  const reviewableRows = rows.filter((row) => row.action === "manual_review_before_model_coded_subset_candidate");

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: deepDive.category,
    decision: "hold_report_only_review_list",
    sourceReports: ["speaker-family-deep-dive-latest.json", "speaker-family-blockers-latest.json"],
    metrics: {
      targetFamilyRows: rows.length,
      reviewablePortableSpeakerRows: reviewableRows.length,
      holdOrExcludeRows: holdRows.length,
      deviceClassCounts,
      actionCounts,
    },
    reviewableRows,
    holdRows,
    policyImplications: [
      "Portable speaker model-coded rows are manual-review candidates only, not approved policy.",
      "Marantz amp/receiver rows must be excluded from portable speaker candidate policy.",
      "JBL EON is PA speaker class and needs a separate boundary before any candidate review.",
      "Unknown variant rows such as Marshall Emberton unknown and JBL Xtreme unknown remain hold-only.",
    ],
    nextReportOnlyExperiments: [
      "build generic speaker hold examples for exclusion tests",
      "draft portable speaker model-coded subset conditions without candidate pool wiring",
      "separate amp_receiver examples from speaker_audio readiness denominator",
    ],
    doNotDo: [
      "Do not promote speaker_audio_discovered",
      "Do not use speaker-generic family as comparable key",
      "Do not wire Marshall/JBL/Britz rows into candidate pool",
      "Do not merge amp_receiver, PA speaker, and portable speaker rows",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "speaker-device-class-review-latest.json"), JSON.stringify(report, null, 2));

  const reviewableTable = [
    "| family | device_class | family_count | exact_model | action | model_examples |",
    "| --- | --- | ---: | ---: | --- | --- |",
    ...reviewableRows.map((row) =>
      `| ${row.family} | ${row.deviceClass} | ${row.familyCount} | ${row.exactModelCount} | ${row.action} | ${row.modelExamples.map((model) => model.key).join("<br>")} |`,
    ),
  ].join("\n");

  const holdTable = [
    "| family | device_class | family_count | unknown_variant | action | model_examples |",
    "| --- | --- | ---: | ---: | --- | --- |",
    ...holdRows.map((row) =>
      `| ${row.family} | ${row.deviceClass} | ${row.familyCount} | ${row.unknownVariantCount} | ${row.action} | ${row.modelExamples.map((model) => model.key).join("<br>")} |`,
    ),
  ].join("\n");

  const md = [
    "# Speaker Device Class Review",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only speaker device-class split. This is not runtime wiring and not public promotion.",
    "",
    "## Reviewable Portable Speaker Rows",
    "",
    reviewableTable,
    "",
    "## Hold Or Exclude Rows",
    "",
    holdTable,
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

  await writeFile(path.join(reportsDir, "speaker-device-class-review-latest.md"), `${md}\n`);
  console.log("wrote reports/speaker-device-class-review-latest.json");
  console.log("wrote reports/speaker-device-class-review-latest.md");
  console.log(`speaker device-class review: reviewable=${reviewableRows.length}, hold_or_exclude=${holdRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
