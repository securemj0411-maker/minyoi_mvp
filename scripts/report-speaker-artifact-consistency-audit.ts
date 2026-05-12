import fs from "node:fs";
import path from "node:path";

const files = [
  "reports/speaker-model-family-device-class-fixture-packet-latest.json",
  "reports/speaker-model-family-device-class-fixture-packet-latest.md",
  "reports/speaker-device-class-review-latest.md",
  "reports/speaker-family-blockers-latest.md",
  "reports/speaker-no-mutation-runtime-dry-run-latest.json",
  "reports/speaker-no-mutation-runtime-dry-run-latest.md",
];

function read(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

const checks = files.map((file) => {
  const content = read(file);
  return {
    file,
    hasReportOnlyLanguage: /report[- ]only|reportOnly/i.test(content),
    publicPromotionTrue: /"publicPromotion"\s*:\s*true|publicPromotion:\s*true/i.test(content),
    runtimeApplyTrue: /"runtimeCatalogApply"\s*:\s*true|runtimeCatalogApply:\s*true/i.test(content),
    candidatePoolWiringTrue:
      /"candidatePoolPolicyWiring"\s*:\s*true|candidatePoolPolicyWiring:\s*true/i.test(content),
    productionDbMutationTrue: /"productionDbMutation"\s*:\s*true|productionDbMutation:\s*true/i.test(content),
    runtimeApprovedPositive: /runtime[-_ ]approved rows:\s*[1-9]\d*|"runtimeApprovedRows"\s*:\s*[1-9]\d*/i.test(
      content,
    ),
  };
});

const failures = checks.filter(
  (row) =>
    !row.hasReportOnlyLanguage ||
    row.publicPromotionTrue ||
    row.runtimeApplyTrue ||
    row.candidatePoolWiringTrue ||
    row.productionDbMutationTrue ||
    row.runtimeApprovedPositive,
);

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  category: "speaker_audio_discovered",
  scope: "speaker report-only artifact consistency audit",
  metrics: {
    filesChecked: checks.length,
    failures: failures.length,
  },
  checks,
  failures,
  conclusion:
    failures.length === 0
      ? "speaker_artifact_consistency_passed_report_only"
      : "speaker_artifact_consistency_failed_review_required",
  nextAction: "Continue to camera body/lens/package false-merge regression packet.",
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "speaker-artifact-consistency-audit-latest.json");
const mdPath = path.join(reportsDir, "speaker-artifact-consistency-audit-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Speaker Artifact Consistency Audit",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- category: ${report.category}`,
  `- conclusion: ${report.conclusion}`,
  "- reportOnly: true",
  "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
  "- productionDbMutation/directThirtyDayPlanEdit: false/false",
  "",
  "## Metrics",
  "",
  `- filesChecked: ${report.metrics.filesChecked}`,
  `- failures: ${report.metrics.failures}`,
  "",
  "## Checks",
  "",
  "| file | reportOnlyLanguage | publicPromotionTrue | runtimeApplyTrue | candidatePoolWiringTrue | productionDbMutationTrue | runtimeApprovedPositive |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...checks.map(
    (row) =>
      `| ${row.file} | ${row.hasReportOnlyLanguage ? "yes" : "no"} | ${row.publicPromotionTrue ? "yes" : "no"} | ${row.runtimeApplyTrue ? "yes" : "no"} | ${row.candidatePoolWiringTrue ? "yes" : "no"} | ${row.productionDbMutationTrue ? "yes" : "no"} | ${row.runtimeApprovedPositive ? "yes" : "no"} |`,
  ),
  "",
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(
  JSON.stringify(
    {
      category: report.category,
      conclusion: report.conclusion,
      filesChecked: report.metrics.filesChecked,
      failures: report.metrics.failures,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
