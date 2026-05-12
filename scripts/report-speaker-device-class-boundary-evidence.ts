import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ModelExample = {
  key: string;
  count: number;
};

type HoldRow = {
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
  metrics: {
    targetFamilyRows: number;
    reviewablePortableSpeakerRows: number;
    holdOrExcludeRows: number;
  };
  holdRows: HoldRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function evidenceClass(row: HoldRow): string {
  if (row.deviceClass === "amp_receiver") return "amp_receiver_boundary_exclusion";
  if (row.deviceClass === "pa_speaker") return "pa_speaker_boundary_hold";
  if (row.unknownVariantCount > 0) return "unknown_variant_family_hold";
  return "speaker_device_class_boundary_hold";
}

function actionFor(row: HoldRow): string {
  if (row.deviceClass === "amp_receiver") return "exclude from portable speaker candidate subset";
  if (row.deviceClass === "pa_speaker") return "hold separate PA speaker boundary";
  if (row.unknownVariantCount > 0) return "hold until exact model variant is confirmed";
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
  const review = JSON.parse(
    await readFile(path.join(reportsDir, "speaker-device-class-review-latest.json"), "utf8"),
  ) as DeviceClassReview;

  const rows = review.holdRows.map((row) => ({
    ...row,
    evidenceClass: evidenceClass(row),
    reportOnlyAction: actionFor(row),
    runtimeApproved: false,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: review.category,
    decision: "speaker_device_class_boundary_evidence_report_only",
    sourceReports: ["speaker-device-class-review-latest.json", "speaker-portable-conditions-matrix-latest.json"],
    metrics: {
      targetFamilyRows: review.metrics.targetFamilyRows,
      reviewablePortableSpeakerRows: review.metrics.reviewablePortableSpeakerRows,
      holdOrExcludeRows: review.metrics.holdOrExcludeRows,
      boundaryRows: rows.length,
      ampReceiverRows: rows.filter((row) => row.deviceClass === "amp_receiver").length,
      paSpeakerRows: rows.filter((row) => row.deviceClass === "pa_speaker").length,
      unknownVariantRows: rows.filter((row) => row.unknownVariantCount > 0).length,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      evidenceClassCounts: countBy(rows.map((row) => row.evidenceClass)),
      deviceClassCounts: countBy(rows.map((row) => row.deviceClass)),
      brandCounts: countBy(rows.map((row) => row.brand)),
    },
    rows,
    policyImplications: [
      "Amp/receiver and PA speaker rows must remain outside portable speaker comparable-key policy.",
      "Unknown variant families are hold evidence, not model-coded candidate approval.",
      "Portable exact-model rows remain parser_candidate review inputs only.",
      "No speaker runtime wiring or candidate pool policy wiring is approved here.",
    ],
    nextReportOnlyExperiments: [
      "keep amp_receiver and pa_speaker examples as negative boundary tests",
      "collect more exact variant evidence before any family-level candidate subset",
      "compare generic speaker exclusions against model-coded portable rows only in reports",
    ],
    doNotDo: [
      "Do not promote speaker_audio_discovered",
      "Do not wire portable speaker subset conditions into runtime",
      "Do not merge amp_receiver, PA speaker, and portable speaker rows",
      "Do not treat parser_candidate rows as public approval",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "speaker-device-class-boundary-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| family | device_class | evidence_class | action | examples | runtime_approved |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => {
      const examples = row.modelExamples.map((example) => `${example.key}(${example.count})`).join("<br>");
      return `| ${row.family} | ${row.deviceClass} | ${row.evidenceClass} | ${row.reportOnlyAction} | ${examples || "-"} | no |`;
    }),
  ].join("\n");

  const md = [
    "# Speaker Device-Class Boundary Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only speaker device-class boundary evidence. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- boundary rows: ${report.metrics.boundaryRows}`,
    `- amp/receiver rows: ${report.metrics.ampReceiverRows}`,
    `- PA speaker rows: ${report.metrics.paSpeakerRows}`,
    `- unknown variant rows: ${report.metrics.unknownVariantRows}`,
    "",
    "## Evidence Rows",
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

  await writeFile(path.join(reportsDir, "speaker-device-class-boundary-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/speaker-device-class-boundary-evidence-latest.json");
  console.log("wrote reports/speaker-device-class-boundary-evidence-latest.md");
  console.log(`speaker device-class boundary evidence: boundary=${rows.length}, amp_receiver=${report.metrics.ampReceiverRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
