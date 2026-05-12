import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type SpeakerReport = {
  category: string;
  total: number;
  normal: number;
  modelMatchedRate: number;
  genericFamilyRate: number;
  gateCounts: CountRow[];
  modelCounts: CountRow[];
  familyCounts: CountRow[];
  examples: Array<{ pid?: string; title?: string; price?: number; family?: string }>;
};

const reportsDir = path.join(process.cwd(), "reports");

function candidateFamilies(families: CountRow[]): CountRow[] {
  return families.filter((row) => row.key !== "speaker-generic" && row.key !== "amp-receiver-generic" && row.key !== "unknown").slice(0, 12);
}

async function main(): Promise<void> {
  const speaker = JSON.parse(await readFile(path.join(reportsDir, "speaker-parser-latest.json"), "utf8")) as SpeakerReport;
  const narrowFamilies = candidateFamilies(speaker.familyCounts);
  const genericExamples = speaker.examples.filter((example) => example.family === "speaker-generic").slice(0, 12);

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: speaker.category,
    decision: "hold_report_only",
    whyHold: [
      `modelMatchedRate=${speaker.modelMatchedRate}% is below a safe narrow-family threshold`,
      `genericFamilyRate=${speaker.genericFamilyRate}% dominates the normal rows`,
      "speaker/audio mixes portable speakers, amps, receivers, soundbars, PA gear, and generic novelty speakers",
      "generic speaker family cannot be used as a comparable key",
    ],
    currentMetrics: {
      total: speaker.total,
      normal: speaker.normal,
      modelMatchedRate: speaker.modelMatchedRate,
      genericFamilyRate: speaker.genericFamilyRate,
      gateCounts: speaker.gateCounts,
      topFamilyCounts: speaker.familyCounts.slice(0, 20),
      topModelCounts: speaker.modelCounts.slice(0, 20),
    },
    possibleFutureNarrowFamilies: narrowFamilies.map((row) => ({
      family: row.key,
      count: row.count,
      status: "report_only_candidate_family_not_policy",
      requiredBeforeDraft: [
        "brand/model code confidence",
        "device class separation",
        "single unit vs bundle/set separation",
        "amp/receiver/speaker separation where relevant",
      ],
    })),
    genericExamples,
    nextReportOnlyExperiments: [
      "split Marshall/JBL/Britz/Marantz rows into model-coded vs family-only buckets",
      "separate amp/receiver rows from speaker rows",
      "produce generic speaker hold examples for future exclusion tests",
    ],
    doNotDo: [
      "Do not promote speaker_audio_discovered",
      "Do not use speaker-generic family as comparable key",
      "Do not mix amp/receiver/speaker rows in one candidate policy",
      "Do not wire narrowFamilies into candidate pool",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "speaker-family-blockers-latest.json"), JSON.stringify(report, null, 2));

  const familyTable = [
    "| family | count | status | required_before_draft |",
    "| --- | --- | --- | --- |",
    ...report.possibleFutureNarrowFamilies.map((row) =>
      `| ${row.family} | ${row.count} | ${row.status} | ${row.requiredBeforeDraft.map((item) => `- ${item}`).join("<br>")} |`,
    ),
  ].join("\n");

  const md = [
    "# Speaker Family Blockers",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only speaker/audio family diagnosis. This is not runtime wiring and not public promotion.",
    "",
    "## Why Hold",
    "",
    ...report.whyHold.map((line) => `- ${line}`),
    "",
    "## Possible Future Narrow Families",
    "",
    familyTable,
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "speaker-family-blockers-latest.md"), `${md}\n`);
  console.log("wrote reports/speaker-family-blockers-latest.json");
  console.log("wrote reports/speaker-family-blockers-latest.md");
  console.log(`speaker family blockers: generic=${speaker.genericFamilyRate}%, model_matched=${speaker.modelMatchedRate}%, narrow_families=${narrowFamilies.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
