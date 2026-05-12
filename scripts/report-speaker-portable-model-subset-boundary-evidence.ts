import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ModelExample = {
  key: string;
  count: number;
};

type FamilyRow = {
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
  rows: FamilyRow[];
};

type SubsetRow = FamilyRow & {
  subsetClass: string;
  modelIdentityUnits: number;
  holdUnits: number;
  reportOnlyAction: string;
  runtimeApproved: false;
};

const reportsDir = path.join(process.cwd(), "reports");

function subsetClass(row: FamilyRow): string {
  if (row.deviceClass === "amp_receiver") return "excluded_amp_receiver_device_class";
  if (row.deviceClass === "pa_speaker") return "hold_pa_speaker_device_class";
  if (row.unknownVariantCount > 0) return "hold_unknown_variant_within_speaker_family";
  if (row.deviceClass === "speaker" && row.exactModelCount > 0) return "portable_exact_model_reference_only";
  return "hold_family_without_exact_model";
}

function actionFor(row: SubsetRow): string {
  if (row.subsetClass === "portable_exact_model_reference_only") return "reference only; wait for main approval before parser policy draft";
  if (row.subsetClass === "hold_unknown_variant_within_speaker_family") return "hold until exact model variant is resolved";
  if (row.subsetClass === "excluded_amp_receiver_device_class") return "exclude from portable speaker subset";
  if (row.subsetClass === "hold_pa_speaker_device_class") return "hold as separate PA speaker class";
  return "hold report-only";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const deepDive = JSON.parse(await readFile(path.join(reportsDir, "speaker-family-deep-dive-latest.json"), "utf8")) as SpeakerDeepDive;

  const rows: SubsetRow[] = deepDive.rows.map((row) => {
    const base = {
      ...row,
      subsetClass: subsetClass(row),
      modelIdentityUnits: row.deviceClass === "speaker" ? row.exactModelCount : 0,
      holdUnits: row.deviceClass === "speaker" ? row.unknownVariantCount + row.familyOnlyRemainder : row.familyCount,
      reportOnlyAction: "",
      runtimeApproved: false as const,
    };
    return {
      ...base,
      reportOnlyAction: actionFor(base),
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: deepDive.category,
    decision: "speaker_portable_model_subset_boundary_report_only",
    sourceReports: ["speaker-family-deep-dive-latest.json", "speaker-device-class-boundary-evidence-latest.json"],
    metrics: {
      familyRows: rows.length,
      portableExactModelRows: rows.filter((row) => row.subsetClass === "portable_exact_model_reference_only").length,
      portableExactModelUnits: rows
        .filter((row) => row.subsetClass === "portable_exact_model_reference_only")
        .reduce((sum, row) => sum + row.modelIdentityUnits, 0),
      unknownVariantRows: rows.filter((row) => row.subsetClass === "hold_unknown_variant_within_speaker_family").length,
      unknownVariantUnits: rows.reduce((sum, row) => sum + row.unknownVariantCount, 0),
      ampReceiverUnits: rows.filter((row) => row.subsetClass === "excluded_amp_receiver_device_class").reduce((sum, row) => sum + row.familyCount, 0),
      paSpeakerUnits: rows.filter((row) => row.subsetClass === "hold_pa_speaker_device_class").reduce((sum, row) => sum + row.familyCount, 0),
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      subsetClassCounts: countBy(rows.map((row) => row.subsetClass)),
      brandCounts: countBy(rows.flatMap((row) => Array(row.familyCount).fill(row.brand) as string[])),
    },
    rows,
    policyImplications: [
      "Portable exact-model rows are reference-only and are not public promotion.",
      "Unknown variant rows block family-level promotion for Marshall Emberton and JBL Xtreme.",
      "Marantz amp/receiver and JBL EON PA speaker must stay outside portable speaker subset.",
      "No portable speaker candidate pool policy wiring is approved here.",
    ],
    nextReportOnlyExperiments: [
      "collect exact variant evidence for Emberton and Xtreme before any subset expansion",
      "keep amp_receiver and PA rows as negative tests for device-class boundaries",
      "use exact-model rows only as report-only examples until main agent allows wiring review",
    ],
    doNotDo: [
      "Do not promote speaker_audio_discovered",
      "Do not wire portable speaker subset policy",
      "Do not merge amp_receiver, PA speaker, and portable speaker rows",
      "Do not treat exact-model reference rows as public approval",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "speaker-portable-model-subset-boundary-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| family | brand | device_class | family_units | exact_model_units | hold_units | subset_class | runtime_approved |",
    "| --- | --- | --- | ---: | ---: | ---: | --- | --- |",
    ...rows.map((row) => `| ${row.family} | ${row.brand} | ${row.deviceClass} | ${row.familyCount} | ${row.exactModelCount} | ${row.holdUnits} | ${row.subsetClass} | no |`),
  ].join("\n");

  const md = [
    "# Speaker Portable Model Subset Boundary Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only portable speaker subset boundary evidence. This is not runtime wiring and not public promotion.",
    "",
    `Portable exact-model units: ${report.metrics.portableExactModelUnits}`,
    `Unknown variant units: ${report.metrics.unknownVariantUnits}`,
    `Runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
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

  await writeFile(path.join(reportsDir, "speaker-portable-model-subset-boundary-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/speaker-portable-model-subset-boundary-evidence-latest.json");
  console.log("wrote reports/speaker-portable-model-subset-boundary-evidence-latest.md");
  console.log(
    `speaker portable model subset boundary: exact_units=${report.metrics.portableExactModelUnits}, unknown_variant_units=${report.metrics.unknownVariantUnits}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
