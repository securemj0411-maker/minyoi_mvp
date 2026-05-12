import fs from "node:fs";
import path from "node:path";

type ArtifactCheck = {
  file: string;
  exists: boolean;
  forbiddenTrueFlags: string[];
  runtimeApprovedCount: number;
  publicPromotionCount: number;
  candidatePoolWiringCount: number;
};

const artifactFiles = [
  "reports/runtime-patch-batch-review-packet-latest.json",
  "reports/runtime-patch-batch-review-packet-latest.md",
  "reports/headphone-runtime-patch-proposal-latest.json",
  "reports/headphone-runtime-patch-proposal-latest.md",
  "reports/game-console-runtime-patch-proposal-latest.json",
  "reports/game-console-runtime-patch-proposal-latest.md",
  "reports/no-mutation-runtime-dry-run-rollup-latest.json",
  "reports/no-mutation-runtime-dry-run-rollup-latest.md",
  "scripts/report-runtime-patch-batch-review-packet.ts",
];

const forbiddenTruePatterns = [
  /"publicPromotion"\s*:\s*true/g,
  /"runtimeCatalogApply"\s*:\s*true/g,
  /"candidatePoolPolicyWiring"\s*:\s*true/g,
  /"productionDbMutation"\s*:\s*true/g,
  /"directThirtyDayPlanEdit"\s*:\s*true/g,
  /runtimeApproved\s*:\s*true/g,
  /publicPromotion\s*:\s*true/g,
  /candidatePoolPolicyWiring\s*:\s*true/g,
  /productionDbMutation\s*:\s*true/g,
];

function countMatches(content: string, pattern: RegExp): number {
  return [...content.matchAll(pattern)].length;
}

function checkArtifact(file: string): ArtifactCheck {
  const fullPath = path.join(process.cwd(), file);
  const exists = fs.existsSync(fullPath);
  const content = exists ? fs.readFileSync(fullPath, "utf8") : "";
  const forbiddenTrueFlags = forbiddenTruePatterns
    .filter((pattern) => countMatches(content, pattern) > 0)
    .map((pattern) => pattern.source);

  return {
    file,
    exists,
    forbiddenTrueFlags,
    runtimeApprovedCount: countMatches(content, /runtimeApprovedRows"\s*:\s*[1-9]\d*/g),
    publicPromotionCount: countMatches(content, /publicPromotionRows"\s*:\s*[1-9]\d*/g),
    candidatePoolWiringCount: countMatches(content, /candidatePoolWiringRows"\s*:\s*[1-9]\d*/g),
  };
}

const artifactChecks = artifactFiles.map(checkArtifact);
const missingFiles = artifactChecks.filter((row) => !row.exists).map((row) => row.file);
const forbiddenFindings = artifactChecks.filter(
  (row) =>
    row.forbiddenTrueFlags.length > 0 ||
    row.runtimeApprovedCount > 0 ||
    row.publicPromotionCount > 0 ||
    row.candidatePoolWiringCount > 0,
);

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  scope: "artifact integrity audit for runtime patch batch review packet",
  metrics: {
    artifactsChecked: artifactChecks.length,
    missingFiles: missingFiles.length,
    forbiddenFindings: forbiddenFindings.length,
  },
  artifactChecks,
  missingFiles,
  forbiddenFindings,
  conclusion:
    missingFiles.length === 0 && forbiddenFindings.length === 0
      ? "artifact_integrity_passed_report_only_boundaries_intact"
      : "artifact_integrity_failed_review_required",
  nextAction:
    "Continue report-only readiness queue with owner-review handoff packet available; do not patch runtime until main-agent approval.",
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "runtime-patch-batch-artifact-audit-latest.json");
const mdPath = path.join(reportsDir, "runtime-patch-batch-artifact-audit-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Runtime Patch Batch Artifact Audit",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- conclusion: ${report.conclusion}`,
  "- reportOnly: true",
  "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
  "- productionDbMutation/directThirtyDayPlanEdit: false/false",
  "",
  "## Metrics",
  "",
  `- artifactsChecked: ${report.metrics.artifactsChecked}`,
  `- missingFiles: ${report.metrics.missingFiles}`,
  `- forbiddenFindings: ${report.metrics.forbiddenFindings}`,
  "",
  "## Artifact Checks",
  "",
  "| file | exists | forbiddenTrueFlags | runtimeApprovedRows>0 | publicPromotionRows>0 | candidatePoolWiringRows>0 |",
  "| --- | --- | ---: | ---: | ---: | ---: |",
  ...artifactChecks.map(
    (row) =>
      `| ${row.file} | ${row.exists ? "yes" : "no"} | ${row.forbiddenTrueFlags.length} | ${row.runtimeApprovedCount} | ${row.publicPromotionCount} | ${row.candidatePoolWiringCount} |`,
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
      conclusion: report.conclusion,
      artifactsChecked: report.metrics.artifactsChecked,
      missingFiles: report.metrics.missingFiles,
      forbiddenFindings: report.metrics.forbiddenFindings,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
