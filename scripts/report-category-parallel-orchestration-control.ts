import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Assignment = {
  agent: string;
  lane: string;
  scope: string;
  expectedArtifacts: string[];
  sourcePolicy: string;
  forbiddenSurfaces: string[];
  successCriteria: string[];
};

const reportsDir = path.join(process.cwd(), "reports");
const outputJsonPath = path.join(reportsDir, "category-parallel-orchestration-control-latest.json");
const outputMdPath = path.join(reportsDir, "category-parallel-orchestration-control-latest.md");

const forbiddenSurfaces = [
  "runtime/src/lib",
  "Supabase schema or production DB",
  "cron/lifecycle/source-health workers",
  "candidate pool or public pack wiring",
  "pack UI/auth/payment surfaces",
  "30일_실행계획.md direct edits by subagents",
];

const assignments: Assignment[] = [
  {
    agent: "Chandrasekhar",
    lane: "camera_body_only_exact_model",
    scope: "no-write dry-run runner preflight from existing camera observation and source-backfill packets",
    expectedArtifacts: [
      "reports/camera-body-only-no-write-runner-preflight-latest.json",
      "reports/camera-body-only-no-write-runner-preflight-latest.md",
      "scripts/report-camera-body-only-no-write-runner-preflight.ts",
    ],
    sourcePolicy:
      "Use official camera manufacturer/support evidence already gathered; mark unavailable/discontinued models as source_backfill_needed rather than inferring.",
    forbiddenSurfaces,
    successCriteria: [
      "No live DB fetch and no production DB write.",
      "Input/output contract is explicit enough for a future owner-owned no-write runner.",
      "Positive, hold, and manual-review fixture rows are separated.",
      "Public/runtime/candidate-pool gates remain closed.",
    ],
  },
  {
    agent: "Russell",
    lane: "monitor_selected_exact_model",
    scope: "official/trusted source-confidence backfill and internal observation readiness for selected exact monitor codes",
    expectedArtifacts: [
      "reports/monitor-selected-exact-model-source-confidence-latest.json",
      "reports/monitor-selected-exact-model-source-confidence-latest.md",
      "scripts/report-monitor-selected-exact-model-source-confidence.ts",
    ],
    sourcePolicy:
      "Prefer official manufacturer/support pages. For discontinued or unavailable models, use clearly labelled trusted secondary sources and keep uncertain rows on hold.",
    forbiddenSurfaces,
    successCriteria: [
      "Each exact model row has source confidence or a hold reason.",
      "Generic inch/resolution/Hz-only monitor rows remain forbidden.",
      "No public promotion or candidate-pool wiring.",
    ],
  },
  {
    agent: "Tesla",
    lane: "home_appliance_robot_vacuum_model_dock",
    scope: "robot vacuum model+dock no-write runner design expansion",
    expectedArtifacts: [
      "reports/home-appliance-robot-vacuum-no-write-runner-design-latest.json",
      "reports/home-appliance-robot-vacuum-no-write-runner-design-latest.md",
      "scripts/report-home-appliance-robot-vacuum-no-write-runner-design.ts",
    ],
    sourcePolicy:
      "Use official product/support/manual sources when available; logistics, generic vacuum, accessory, and dock-only ambiguity must be explicit hold rows.",
    forbiddenSurfaces,
    successCriteria: [
      "Model+dock fixtures are separated from generic/logistics/accessory fixtures.",
      "No broad stick-vacuum revival.",
      "No runtime/public/DB mutation.",
    ],
  },
  {
    agent: "Kepler",
    lane: "speaker_portable_exact_model",
    scope: "selected speaker subset runner fixture and official/trusted source backfill",
    expectedArtifacts: [
      "reports/speaker-selected-subset-runner-fixture-source-backfill-latest.json",
      "reports/speaker-selected-subset-runner-fixture-source-backfill-latest.md",
      "scripts/report-speaker-selected-subset-runner-fixture-source-backfill.ts",
    ],
    sourcePolicy:
      "Prefer official speaker manufacturer/support pages; classify amp, receiver, soundbar, accessory, and generic novelty speaker rows as hold unless exact portable model evidence is present.",
    forbiddenSurfaces,
    successCriteria: [
      "Positive and hold fixture cases are separated.",
      "Accessory/amp/receiver/soundbar exclusions are explicit.",
      "Public/runtime/candidate-pool gates remain closed.",
    ],
  },
];

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  runtimeCatalogApply: false,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  orchestrationMode: "parallel_subagent_report_only",
  controllingPrinciple:
    "Subagents collect source-backed evidence and prepare no-write runner/fixture packets; main agent owns board/audit integration and any future runtime decision.",
  assignments,
  nextMainAgentAction:
    "Wait for assigned artifacts, then integrate them into category-orchestration-status and orchestration-boundary-audit before considering any implementation.",
  conclusion: "parallel_orchestration_control_created_report_only_no_runtime_or_db_write",
};

function renderMarkdown(): string {
  const lines = [
    "# Category Parallel Orchestration Control",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- reportOnly: ${report.reportOnly}`,
    "- runtimeCatalogApply/publicPromotion/candidatePoolPolicyWiring/productionDbMutation: false/false/false/false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Principle",
    "",
    report.controllingPrinciple,
    "",
    "## Assignments",
    "",
    "| agent | lane | scope | source policy | expected artifacts |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const assignment of assignments) {
    lines.push(
      `| ${assignment.agent} | ${assignment.lane} | ${assignment.scope} | ${assignment.sourcePolicy} | ${assignment.expectedArtifacts.join("<br>")} |`,
    );
  }

  lines.push(
    "",
    "## Shared Forbidden Surfaces",
    "",
    ...forbiddenSurfaces.map((surface) => `- ${surface}`),
    "",
    "## Main Agent Next Action",
    "",
    report.nextMainAgentAction,
  );

  return `${lines.join("\n")}\n`;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(outputMdPath, renderMarkdown());
  console.log(
    JSON.stringify(
      {
        assignments: assignments.length,
        jsonPath: outputJsonPath,
        mdPath: outputMdPath,
      },
      null,
      2,
    ),
  );
}

void main();
