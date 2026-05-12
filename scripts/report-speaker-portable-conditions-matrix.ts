import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ModelExample = {
  key: string;
  count: number;
};

type ReviewableRow = {
  family: string;
  brand: string;
  deviceClass: string;
  familyCount: number;
  exactModelCount: number;
  unknownVariantCount: number;
  familyOnlyRemainder: number;
  status: string;
  modelExamples: ModelExample[];
  action: string;
};

type DeviceClassReview = {
  category: string;
  reviewableRows: ReviewableRow[];
};

type GenericExclusionReadiness = {
  metrics: {
    exclusionCandidateOnlyRows: number;
  };
};

const reportsDir = path.join(process.cwd(), "reports");

function conditionClass(row: ReviewableRow): string {
  if (row.exactModelCount > 0 && row.unknownVariantCount === 0 && row.familyOnlyRemainder === 0) {
    return "exact_model_coded_portable_subset";
  }
  if (row.exactModelCount > 0 && row.unknownVariantCount > 0) return "mixed_exact_and_unknown_variant_hold";
  if (row.familyOnlyRemainder > 0) return "family_only_remainder_hold";
  return "insufficient_model_signal_hold";
}

function conditionNotes(row: ReviewableRow): string[] {
  const notes = [
    "portable speaker device class must remain separate from amp_receiver and pa_speaker",
    "model-coded subset is parser_candidate review input only, not runtime approval",
  ];
  if (row.unknownVariantCount > 0) notes.push("unknown variants require manual review before any candidate subset");
  if (row.familyOnlyRemainder > 0) notes.push("family-only remainder cannot be used as comparable key");
  if (row.modelExamples.length === 1) notes.push("single exact model family still needs enough examples before policy wiring");
  return notes;
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const deviceReview = JSON.parse(
    await readFile(path.join(reportsDir, "speaker-device-class-review-latest.json"), "utf8"),
  ) as DeviceClassReview;
  const genericReadiness = JSON.parse(
    await readFile(path.join(reportsDir, "speaker-generic-exclusion-readiness-latest.json"), "utf8"),
  ) as GenericExclusionReadiness;

  const rows = deviceReview.reviewableRows.map((row) => ({
    family: row.family,
    brand: row.brand,
    deviceClass: row.deviceClass,
    familyCount: row.familyCount,
    exactModelCount: row.exactModelCount,
    unknownVariantCount: row.unknownVariantCount,
    familyOnlyRemainder: row.familyOnlyRemainder,
    modelExamples: row.modelExamples,
    conditionClass: conditionClass(row),
    candidateScope: "parser_candidate_review_only",
    runtimeApproved: false,
    requiredConditions: conditionNotes(row),
  }));
  const positiveConditionRows = rows.filter((row) => row.conditionClass === "exact_model_coded_portable_subset");
  const blockedConditionRows = rows.filter((row) => row.conditionClass !== "exact_model_coded_portable_subset");

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: deviceReview.category,
    decision: "portable_conditions_matrix_report_only_no_wiring",
    sourceReports: ["speaker-device-class-review-latest.json", "speaker-generic-exclusion-readiness-latest.json"],
    metrics: {
      matrixRows: rows.length,
      positiveConditionRows: positiveConditionRows.length,
      blockedConditionRows: blockedConditionRows.length,
      genericExclusionCandidateOnlyRows: genericReadiness.metrics.exclusionCandidateOnlyRows,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      conditionClassCounts: countBy(rows.map((row) => row.conditionClass)),
    },
    rows,
    policyImplications: [
      "Portable speaker families with exact model codes can be reviewed as parser_candidate subsets only.",
      "speaker-generic exclusion rows remain outside comparable-key review.",
      "No speaker family in this matrix is approved for runtime wiring or public promotion.",
    ],
    nextReportOnlyExperiments: [
      "compare portable model-coded families against generic exclusion examples for false-positive overlap",
      "prepare evidence checklist for model-code token coverage without candidate pool policy wiring",
      "keep amp_receiver and pa_speaker rows out of portable speaker subset conditions",
    ],
    doNotDo: [
      "Do not promote speaker_audio_discovered",
      "Do not wire portable speaker subset conditions into runtime",
      "Do not treat parser_candidate rows as public approval",
      "Do not merge speaker-generic rows into model-coded comparable keys",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "speaker-portable-conditions-matrix-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| family | brand | condition_class | exact_models | unknown_variants | runtime_approved | examples |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => {
      const examples = row.modelExamples.map((example) => `${example.key}(${example.count})`).join("<br>");
      return `| ${row.family} | ${row.brand} | ${row.conditionClass} | ${row.exactModelCount} | ${row.unknownVariantCount} | ${row.runtimeApproved ? "yes" : "no"} | ${examples || "-"} |`;
    }),
  ].join("\n");

  const md = [
    "# Speaker Portable Conditions Matrix",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only portable speaker model-coded subset conditions matrix. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "speaker-portable-conditions-matrix-latest.md"), `${md}\n`);
  console.log("wrote reports/speaker-portable-conditions-matrix-latest.json");
  console.log("wrote reports/speaker-portable-conditions-matrix-latest.md");
  console.log(`speaker portable conditions matrix: rows=${rows.length}, runtime_approved=${report.metrics.runtimeApprovedRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
