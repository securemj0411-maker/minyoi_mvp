import { execFile } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { compileChainArtifacts, registryPacketSuites } from "./lib/report-packet-registry";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const reportsDir = path.join(process.cwd(), "reports");
const projectRoot = path.resolve(process.cwd(), "..");
const registryArtifacts = compileChainArtifacts(registryPacketSuites);

const latestPhaseFiles = [
  "scripts/report-parser-policy-matrix.ts",
  "scripts/report-parser-policy-guardrails.ts",
  "scripts/report-parser-wiring-blockers.ts",
  "scripts/report-parser-hold-diagnosis.ts",
  "scripts/report-parser-hold-blockers-index.ts",
  "scripts/report-parser-report-manifest.ts",
  "scripts/report-parser-suite-status.ts",
  "scripts/report-parser-suite-coverage.ts",
  "scripts/report-parser-suite-usage.ts",
  "scripts/report-parser-next-work-queue.ts",
  "scripts/report-parser-review-examples-index.ts",
  "scripts/report-parser-review-top-examples.ts",
  "scripts/report-parser-boundary-review-examples.ts",
  "scripts/report-parser-boundary-example-coverage.ts",
  "scripts/report-parser-airpods-headphone-boundary-examples.ts",
  "scripts/report-parser-airpods-headphone-coverage.ts",
  "scripts/report-parser-review-coverage-summary.ts",
  "scripts/report-parser-category-evidence-ledger.ts",
  "scripts/report-parser-category-context-status.ts",
  "scripts/report-parser-registry-phase-tag-summary.ts",
  "scripts/report-parser-registry-metadata-status.ts",
  "scripts/report-parser-registry-compiler-candidate.ts",
  "scripts/report-parser-registry-backlog-signals.ts",
  "scripts/report-parser-manifest-audit.ts",
  ...registryArtifacts.latestPhaseFiles.filter((file) => file.startsWith("scripts/")),
  "scripts/report-parser-report-only-audit.ts",
  "scripts/report-parser-readiness-all.ts",
  "scripts/report-parser-readiness-summary.ts",
  "reports/parser-policy-conditions-matrix-latest.json",
  "reports/parser-policy-conditions-matrix-latest.md",
  "reports/parser-policy-guardrails-latest.json",
  "reports/parser-policy-guardrails-latest.md",
  "reports/parser-wiring-blockers-latest.json",
  "reports/parser-wiring-blockers-latest.md",
  "reports/parser-hold-diagnosis-latest.json",
  "reports/parser-hold-diagnosis-latest.md",
  "reports/parser-hold-blockers-index-latest.json",
  "reports/parser-hold-blockers-index-latest.md",
  "reports/parser-suite-status-latest.json",
  "reports/parser-suite-status-latest.md",
  "reports/parser-suite-coverage-latest.json",
  "reports/parser-suite-coverage-latest.md",
  "reports/parser-suite-usage-latest.json",
  "reports/parser-suite-usage-latest.md",
  "reports/parser-next-work-queue-latest.json",
  "reports/parser-next-work-queue-latest.md",
  "reports/parser-review-examples-index-latest.json",
  "reports/parser-review-examples-index-latest.md",
  "reports/parser-review-top-examples-latest.json",
  "reports/parser-review-top-examples-latest.md",
  "reports/parser-boundary-review-examples-latest.json",
  "reports/parser-boundary-review-examples-latest.md",
  "reports/parser-boundary-example-coverage-latest.json",
  "reports/parser-boundary-example-coverage-latest.md",
  "reports/parser-airpods-headphone-boundary-examples-latest.json",
  "reports/parser-airpods-headphone-boundary-examples-latest.md",
  "reports/parser-airpods-headphone-coverage-latest.json",
  "reports/parser-airpods-headphone-coverage-latest.md",
  "reports/parser-review-coverage-summary-latest.json",
  "reports/parser-review-coverage-summary-latest.md",
  "reports/parser-category-evidence-ledger-latest.json",
  "reports/parser-category-evidence-ledger-latest.md",
  "reports/parser-category-context-status-latest.json",
  "reports/parser-category-context-status-latest.md",
  "reports/parser-registry-phase-tag-summary-latest.json",
  "reports/parser-registry-phase-tag-summary-latest.md",
  "reports/parser-registry-metadata-status-latest.json",
  "reports/parser-registry-metadata-status-latest.md",
  "reports/parser-registry-compiler-candidate-latest.json",
  "reports/parser-registry-compiler-candidate-latest.md",
  "reports/parser-registry-backlog-signals-latest.json",
  "reports/parser-registry-backlog-signals-latest.md",
  "reports/parser-manifest-audit-latest.json",
  "reports/parser-manifest-audit-latest.md",
  "reports/parser-readiness-all-run-latest.json",
  "reports/parser-readiness-all-run-latest.md",
  "reports/parser-readiness-summary-latest.json",
  "reports/parser-readiness-summary-latest.md",
  "reports/parser-report-manifest-latest.json",
  "reports/parser-report-manifest-latest.md",
  "reports/parser-policy-drafts-index-latest.json",
  "reports/parser-policy-drafts-index-latest.md",
  ...registryArtifacts.latestPhaseFiles.filter((file) => file.startsWith("reports/")),
];

const forbiddenPaths = [
  "src/app/api/cron",
  "src/lib/tick-pipeline.ts",
  "src/lib/supabase-rest.ts",
  "src/lib/pack-open.ts",
  "src/components/pack-reveal-modal.tsx",
  "supabase/schema.sql",
  "src/lib/option-parser.ts",
  "src/lib/catalog.ts",
  "src/lib/category-readiness.ts",
];

async function gitStatus(paths: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const target of paths) {
    const { stdout } = await execFileAsync("git", ["status", "--short", "--", target], {
      cwd: process.cwd(),
    });
    result[target] = stdout.trim() || "clean_or_untracked_absent";
  }
  return result;
}

async function main(): Promise<void> {
  const thirtyDayPlan = path.join(projectRoot, "30일_실행계획.md");
  const thirtyDayStat = await stat(thirtyDayPlan);
  const forbiddenStatus = await gitStatus(forbiddenPaths);
  const latestPhaseStatus = await gitStatus(latestPhaseFiles);
  const forbiddenDirty = Object.entries(forbiddenStatus).filter(([, value]) => value !== "clean_or_untracked_absent");
  const forbiddenDirtyInterpretation = forbiddenDirty.length > 0
    ? "workspace_forbidden_paths_dirty_owner_review_required_not_necessarily_this_report_phase"
    : "no_forbidden_path_dirty_detected";

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    thirtyDayPlan: {
      path: thirtyDayPlan,
      mtime: thirtyDayStat.mtime.toISOString(),
      note: "read-only in this subagent phase; results logged to 인수인계.md",
    },
    latestPhaseFiles,
    latestPhaseStatus,
    forbiddenPaths,
    forbiddenStatus,
    forbiddenDirtyCount: forbiddenDirty.length,
    forbiddenDirtyInterpretation,
    phaseBoundaryVerdict: "report_only_outputs_generated; inspect forbiddenDirtyInterpretation before treating dirty paths as phase violations",
    notes: [
      "Forbidden paths may already be dirty from main/other-agent work; this audit does not claim ownership of those changes.",
      "This subagent phase is limited to report scripts, reports, and 인수인계.md logging.",
      "Do not revert or edit forbidden dirty paths from this subagent scope.",
      "A nonzero forbiddenDirtyCount is a workspace condition that needs owner/main-agent review, not proof that the latest report-only script mutated runtime files.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-report-only-audit-latest.json"), JSON.stringify(report, null, 2));

  const forbiddenTable = [
    "| path | git_status |",
    "| --- | --- |",
    ...Object.entries(forbiddenStatus).map(([target, value]) => `| ${target} | ${value.replace(/\n/g, "<br>")} |`),
  ].join("\n");

  const phaseTable = [
    "| path | git_status |",
    "| --- | --- |",
    ...Object.entries(latestPhaseStatus).map(([target, value]) => `| ${target} | ${value.replace(/\n/g, "<br>")} |`),
  ].join("\n");

  const md = [
    "# Parser Report-Only Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only audit. No runtime catalog apply, no public promotion, and no candidate pool policy wiring.",
    "",
    "## 30-Day Plan",
    "",
    `- Path: ${report.thirtyDayPlan.path}`,
    `- mtime: ${report.thirtyDayPlan.mtime}`,
    `- Note: ${report.thirtyDayPlan.note}`,
    "",
    "## Latest Phase Files",
    "",
    phaseTable,
    "",
    "## Forbidden Path Status",
    "",
    `- forbiddenDirtyCount: ${report.forbiddenDirtyCount}`,
    `- interpretation: ${report.forbiddenDirtyInterpretation}`,
    `- phaseBoundaryVerdict: ${report.phaseBoundaryVerdict}`,
    "",
    forbiddenTable,
    "",
    "## Notes",
    "",
    ...report.notes.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-report-only-audit-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-report-only-audit-latest.json");
  console.log("wrote reports/parser-report-only-audit-latest.md");
  console.log(`forbidden_dirty=${report.forbiddenDirtyCount}; latest_phase_files=${latestPhaseFiles.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
