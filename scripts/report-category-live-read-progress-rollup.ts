import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = Record<string, unknown>;

type ArtifactStatus = {
  role: string;
  path: string;
  exists: boolean;
  conclusion: string | null;
  metrics: unknown;
};

type Report = {
  generatedAt: string;
  reportOnly: true;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  conclusion: string;
  artifacts: ArtifactStatus[];
  currentState: Array<{ lane: string; state: string; nextAction: string }>;
  blockedDecisions: string[];
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "category-live-read-progress-rollup-latest.json");
const outputMdPath = path.join(reportsDir, "category-live-read-progress-rollup-latest.md");

const artifacts = [
  { role: "live_read", path: "reports/category-no-write-live-read-observation-latest.json" },
  { role: "owner_review_packet", path: "reports/category-live-read-owner-review-packet-latest.json" },
  { role: "fixture_candidates", path: "reports/live-read-regression-fixture-candidates-latest.json" },
  { role: "fixture_audit", path: "reports/live-read-regression-fixture-audit-latest.json" },
  { role: "robot_refinement", path: "reports/robot-vacuum-query-refinement-latest.json" },
  { role: "robot_refined_live_read", path: "reports/robot-vacuum-refined-live-read-latest.json" },
  { role: "boundary_audit", path: "reports/orchestration-boundary-audit-latest.json" },
];

async function readArtifact(role: string, relativePath: string): Promise<ArtifactStatus> {
  try {
    const json = JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as Json;
    return {
      role,
      path: relativePath,
      exists: true,
      conclusion: typeof json.conclusion === "string" ? json.conclusion : typeof json.auditStatus === "string" ? json.auditStatus : null,
      metrics: json.metrics ?? null,
    };
  } catch {
    return { role, path: relativePath, exists: false, conclusion: null, metrics: null };
  }
}

function renderMarkdown(report: Report) {
  return `${[
    "# Category Live-Read Progress Rollup",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- conclusion: ${report.conclusion}`,
    `- reportOnly: ${report.reportOnly}`,
    `- runtime/public/candidate/db mutation: ${report.runtimeApply}/${report.publicPromotion}/${report.candidatePoolPolicyWiring}/${report.productionDbMutation}`,
    "",
    "## Current State",
    "",
    "| lane | state | next action |",
    "|---|---|---|",
    ...report.currentState.map((row) => `| ${row.lane} | ${row.state} | ${row.nextAction} |`),
    "",
    "## Artifacts",
    "",
    "| role | exists | conclusion | path |",
    "|---|---|---|---|",
    ...report.artifacts.map((item) => `| ${item.role} | ${item.exists} | ${item.conclusion ?? "-"} | ${item.path} |`),
    "",
    "## Blocked Decisions",
    "",
    ...report.blockedDecisions.map((item) => `- ${item}`),
    "",
  ].join("\n")}\n`;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const statuses = await Promise.all(artifacts.map((item) => readArtifact(item.role, item.path)));
  const missing = statuses.filter((item) => !item.exists);
  const report: Report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    conclusion: missing.length === 0
      ? "live_read_progress_rollup_complete_waiting_owner_test_conversion_decision"
      : "live_read_progress_rollup_missing_artifacts",
    artifacts: statuses,
    currentState: [
      {
        lane: "camera_body_only_exact_model",
        state: "fixture_candidates_audited",
        nextAction: "Owner approval needed before converting to runtime parser tests.",
      },
      {
        lane: "monitor_selected_exact_model",
        state: "fixture_candidates_audited",
        nextAction: "Owner approval needed before converting to runtime parser tests.",
      },
      {
        lane: "speaker_selected_subset",
        state: "fixture_candidates_audited",
        nextAction: "Owner approval needed before converting to runtime parser tests.",
      },
      {
        lane: "home_appliance_robot_vacuum_model_dock",
        state: "manual_refinement_required",
        nextAction: "Do not runtime-review yet; collect cleaner full-unit signals first.",
      },
    ],
    blockedDecisions: [
      "Runtime parser test conversion for camera/monitor/speaker requires owner approval.",
      "Robot vacuum runtime review is blocked until clean fresh rows appear.",
      "Public promotion and candidate pool wiring remain blocked for all four lanes.",
    ],
  };

  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(outputMdPath, renderMarkdown(report), "utf8");
  console.log(`wrote ${path.relative(appDir, outputJsonPath)}`);
  console.log(`wrote ${path.relative(appDir, outputMdPath)}`);
  console.log(report.conclusion);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
