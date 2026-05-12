import fs from "node:fs";
import path from "node:path";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

type LaneStatus = "simulation_passed" | "preflight_ready" | "design_ready" | "pending" | "owner_blocked";

type Artifact = {
  role: "simulation" | "preflight" | "design";
  path: string;
  exists: boolean;
  reportOnly?: boolean;
  conclusion?: string;
  metrics?: JsonObject;
};

type LaneConfig = {
  lane: string;
  label: string;
  simulation: string;
  preflight: string;
  design: string;
};

type LaneRollup = {
  lane: string;
  label: string;
  status: LaneStatus;
  reason: string;
  artifacts: Artifact[];
  boundaryCounts: Record<string, number>;
  nextAction: string;
};

type GenericReport = {
  reportOnly?: boolean;
  conclusion?: string;
  metrics?: JsonObject;
};

type CategoryBoard = {
  reportOnly?: boolean;
  recommendedNext?: JsonValue;
  candidates?: Array<{ lane?: string; status?: string; blocker?: string; nextAction?: string; score?: number }>;
};

type BoundaryAudit = {
  reportOnly?: boolean;
  auditStatus?: string;
  conclusion?: string;
  metrics?: Record<string, number>;
};

type RollupReport = {
  generatedAt: string;
  reportOnly: true;
  ownership: "category_no_write_runner_rollup_skeleton";
  conclusion: string;
  runtimeCatalogApply: false;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  directThirtyDayPlanEdit: false;
  liveFetchImplementation: false;
  dbAccess: false;
  metrics: Record<string, number>;
  inputFilesRead: string[];
  missingFutureArtifacts: string[];
  lanes: LaneRollup[];
  boundaryAudit: Array<{ check: string; status: "pass" | "fail"; evidence: string }>;
};

const repoRoot = process.cwd();
const reportsDir = path.join(repoRoot, "reports");
const handoffPath = path.resolve(repoRoot, "..", "인수인계.md");

const laneConfigs: LaneConfig[] = [
  {
    lane: "camera_body_only_exact_model",
    label: "Camera body-only exact model",
    simulation: "reports/camera-body-only-supplied-input-runner-simulation-latest.json",
    preflight: "reports/camera-body-only-no-write-runner-preflight-latest.json",
    design: "reports/camera-body-only-no-write-live-market-dry-run-runner-design-latest.json",
  },
  {
    lane: "monitor_selected_exact_model",
    label: "Monitor selected exact model",
    simulation: "reports/monitor-selected-exact-model-supplied-input-runner-simulation-latest.json",
    preflight: "reports/monitor-selected-exact-model-no-write-runner-preflight-latest.json",
    design: "reports/monitor-selected-exact-model-no-write-observation-design-latest.json",
  },
  {
    lane: "speaker_selected_subset",
    label: "Speaker selected subset",
    simulation: "reports/speaker-selected-subset-supplied-input-runner-simulation-latest.json",
    preflight: "reports/speaker-selected-subset-no-write-runner-preflight-latest.json",
    design: "reports/speaker-selected-subset-no-write-live-market-dry-run-runner-design-latest.json",
  },
  {
    lane: "home_appliance_robot_vacuum_model_dock",
    label: "Robot vacuum model+dock",
    simulation: "reports/home-appliance-robot-vacuum-supplied-input-runner-simulation-latest.json",
    preflight: "reports/home-appliance-robot-vacuum-no-write-runner-preflight-latest.json",
    design: "reports/home-appliance-robot-vacuum-no-write-runner-design-latest.json",
  },
];

function readJsonIfExists<T extends GenericReport>(relativePath: string): T | undefined {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return undefined;
  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as T;
}

function readTextIfExists(absolutePath: string) {
  if (!fs.existsSync(absolutePath)) return "";
  return fs.readFileSync(absolutePath, "utf8");
}

function artifact(role: Artifact["role"], relativePath: string): Artifact {
  const report = readJsonIfExists(relativePath);
  return {
    role,
    path: relativePath,
    exists: Boolean(report),
    reportOnly: report?.reportOnly,
    conclusion: report?.conclusion,
    metrics: report?.metrics,
  };
}

function metricNumber(metrics: JsonObject | undefined, keys: string[]) {
  if (!metrics) return 0;
  return keys.reduce((sum, key) => {
    const value = metrics[key];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

function boundaryCounts(artifacts: Artifact[]) {
  const reports = artifacts.filter((item) => item.exists);
  return {
    runtimeApprovedRows: reports.reduce((sum, item) => sum + metricNumber(item.metrics, ["runtimeApprovedRows"]), 0),
    publicPromotionRows: reports.reduce((sum, item) => sum + metricNumber(item.metrics, ["publicPromotionRows"]), 0),
    candidatePoolRows: reports.reduce(
      (sum, item) => sum + metricNumber(item.metrics, ["candidatePoolRows", "candidatePoolWiringRows"]),
      0,
    ),
    runtimeApplyRows: reports.reduce((sum, item) => sum + metricNumber(item.metrics, ["runtimeApplyRows"]), 0),
    liveDbWriteRows: reports.reduce((sum, item) => sum + metricNumber(item.metrics, ["liveDbWriteRows"]), 0),
    dbAccessRows: reports.reduce((sum, item) => sum + metricNumber(item.metrics, ["dbAccessRows", "dbMutationRows"]), 0),
    runtimePatchProposalRows: reports.reduce(
      (sum, item) => sum + metricNumber(item.metrics, ["runtimePatchProposalRows"]),
      0,
    ),
  };
}

function hasFailureMetrics(item: Artifact) {
  const failKeys = [
    "failedChecks",
    "preflightAuditFails",
    "boundaryAuditFails",
    "expectationMismatches",
    "hardFailFindings",
    "failedRows",
  ];
  return metricNumber(item.metrics, failKeys) > 0;
}

function classifyLane(config: LaneConfig, board: CategoryBoard): LaneRollup {
  const artifacts = [
    artifact("simulation", config.simulation),
    artifact("preflight", config.preflight),
    artifact("design", config.design),
  ];
  const counts = boundaryCounts(artifacts);
  const existing = artifacts.filter((item) => item.exists);
  const boardCandidate = board.candidates?.find((candidate) => candidate.lane === config.lane);
  const hasBoundaryLeak = Object.values(counts).some((value) => value > 0);
  const hasFailure = existing.some(hasFailureMetrics);
  const hasNonReportOnly = existing.some((item) => item.reportOnly !== true);

  if (hasBoundaryLeak || hasFailure || hasNonReportOnly) {
    return {
      lane: config.lane,
      label: config.label,
      status: "owner_blocked",
      reason: `Boundary/failure gate tripped: leak=${hasBoundaryLeak}; failure=${hasFailure}; nonReportOnly=${hasNonReportOnly}`,
      artifacts,
      boundaryCounts: counts,
      nextAction: "Owner review required before any further no-write runner work.",
    };
  }

  const simulation = artifacts.find((item) => item.role === "simulation");
  if (simulation?.exists && simulation.conclusion?.includes("passed")) {
    return {
      lane: config.lane,
      label: config.label,
      status: "simulation_passed",
      reason: simulation.conclusion,
      artifacts,
      boundaryCounts: counts,
      nextAction: "Keep report-only. Owner can decide whether more supplied-input fixtures are useful before any implementation.",
    };
  }

  if (simulation?.exists) {
    return {
      lane: config.lane,
      label: config.label,
      status: "owner_blocked",
      reason: simulation.conclusion ?? "simulation artifact exists but did not pass",
      artifacts,
      boundaryCounts: counts,
      nextAction: "Owner review required for the existing supplied-input simulation before advancing this lane.",
    };
  }

  const preflight = artifacts.find((item) => item.role === "preflight");
  if (preflight?.exists && (preflight.conclusion?.includes("preflight") || preflight.conclusion?.includes("ready"))) {
    return {
      lane: config.lane,
      label: config.label,
      status: "preflight_ready",
      reason: preflight.conclusion ?? "preflight artifact present and report-only",
      artifacts,
      boundaryCounts: counts,
      nextAction: "Future supplied-input simulation can be created from local fixture rows; tolerate missing simulation until assigned.",
    };
  }

  const design = artifacts.find((item) => item.role === "design");
  if (design?.exists && (design.conclusion?.includes("design_ready") || design.conclusion?.includes("ready"))) {
    return {
      lane: config.lane,
      label: config.label,
      status: "design_ready",
      reason: design.conclusion ?? "design artifact present and report-only",
      artifacts,
      boundaryCounts: counts,
      nextAction: "Create no-write preflight before any supplied-input simulation.",
    };
  }

  return {
    lane: config.lane,
    label: config.label,
    status: "pending",
    reason: boardCandidate?.blocker ?? "No no-write runner design/preflight/simulation artifact available yet.",
    artifacts,
    boundaryCounts: counts,
    nextAction: boardCandidate?.nextAction ?? "No action until owner assigns this lane.",
  };
}

function table(headers: string[], rows: Array<Array<string | number>>) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replaceAll("\n", "<br>")).join(" | ")} |`),
  ].join("\n");
}

const categoryBoard = readJsonIfExists<CategoryBoard>("reports/category-orchestration-status-latest.json") ?? {};
const upstreamBoundaryAudit =
  readJsonIfExists<BoundaryAudit>("reports/orchestration-boundary-audit-latest.json") ?? {};
const handoffText = readTextIfExists(handoffPath);

const lanes = laneConfigs.map((config) => classifyLane(config, categoryBoard));
const missingFutureArtifacts = lanes.flatMap((lane) => {
  if (lane.status === "simulation_passed") return [];
  return lane.artifacts.filter((item) => !item.exists).map((item) => item.path);
});

const aggregateBoundaryCounts = lanes.reduce(
  (acc, lane) => {
    for (const [key, value] of Object.entries(lane.boundaryCounts)) {
      acc[key] = (acc[key] ?? 0) + value;
    }
    return acc;
  },
  {} as Record<string, number>,
);

const handoffReportOnly =
  handoffText.includes("public promotion은 하지 말고") && handoffText.includes("production DB 직접 mutation");

const boundaryAudit = [
  {
    check: "upstream_boundary_audit_passed",
    status:
      upstreamBoundaryAudit.reportOnly === true &&
      upstreamBoundaryAudit.auditStatus === "pass" &&
      (upstreamBoundaryAudit.metrics?.hardFailFindings ?? 1) === 0
        ? ("pass" as const)
        : ("fail" as const),
    evidence: `auditStatus=${upstreamBoundaryAudit.auditStatus}; hardFailFindings=${upstreamBoundaryAudit.metrics?.hardFailFindings ?? "missing"}`,
  },
  {
    check: "aggregate_boundary_counts_zero",
    status: Object.values(aggregateBoundaryCounts).every((value) => value === 0) ? ("pass" as const) : ("fail" as const),
    evidence: JSON.stringify(aggregateBoundaryCounts),
  },
  {
    check: "missing_future_simulations_tolerated",
    status: "pass" as const,
    evidence: `${missingFutureArtifacts.length} missing future artifacts recorded as non-fatal.`,
  },
  {
    check: "handoff_report_only_alignment",
    status: handoffReportOnly ? ("pass" as const) : ("fail" as const),
    evidence: "인수인계.md keeps subagent work away from production DB mutation and public promotion.",
  },
];

const statusCounts = {
  simulation_passed: lanes.filter((lane) => lane.status === "simulation_passed").length,
  preflight_ready: lanes.filter((lane) => lane.status === "preflight_ready").length,
  design_ready: lanes.filter((lane) => lane.status === "design_ready").length,
  pending: lanes.filter((lane) => lane.status === "pending").length,
  owner_blocked: lanes.filter((lane) => lane.status === "owner_blocked").length,
};

const metrics = {
  lanes: lanes.length,
  simulationPassedLanes: statusCounts.simulation_passed,
  preflightReadyLanes: statusCounts.preflight_ready,
  designReadyLanes: statusCounts.design_ready,
  pendingLanes: statusCounts.pending,
  ownerBlockedLanes: statusCounts.owner_blocked,
  artifactsExpected: lanes.flatMap((lane) =>
    lane.status === "simulation_passed" ? lane.artifacts.filter((item) => item.exists) : lane.artifacts,
  ).length,
  artifactsPresent: lanes.flatMap((lane) => lane.artifacts).filter((item) => item.exists).length,
  missingFutureArtifacts: missingFutureArtifacts.length,
  boundaryAuditChecks: boundaryAudit.length,
  boundaryAuditPasses: boundaryAudit.filter((item) => item.status === "pass").length,
  boundaryAuditFails: boundaryAudit.filter((item) => item.status === "fail").length,
  runtimeApprovedRows: aggregateBoundaryCounts.runtimeApprovedRows ?? 0,
  publicPromotionRows: aggregateBoundaryCounts.publicPromotionRows ?? 0,
  candidatePoolRows: aggregateBoundaryCounts.candidatePoolRows ?? 0,
  runtimeApplyRows: aggregateBoundaryCounts.runtimeApplyRows ?? 0,
  liveDbWriteRows: aggregateBoundaryCounts.liveDbWriteRows ?? 0,
  dbAccessRows: aggregateBoundaryCounts.dbAccessRows ?? 0,
  runtimePatchProposalRows: aggregateBoundaryCounts.runtimePatchProposalRows ?? 0,
};

const report: RollupReport = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  ownership: "category_no_write_runner_rollup_skeleton",
  conclusion:
    metrics.boundaryAuditFails === 0 && metrics.ownerBlockedLanes === 0
      ? "category_no_write_runner_rollup_passed_report_only"
      : "category_no_write_runner_rollup_owner_review_needed_report_only",
  runtimeCatalogApply: false,
  runtimeApply: false,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  liveFetchImplementation: false,
  dbAccess: false,
  metrics,
  inputFilesRead: [
    "reports/category-orchestration-status-latest.json",
    "reports/orchestration-boundary-audit-latest.json",
    path.relative(repoRoot, handoffPath),
    ...lanes.flatMap((lane) => lane.artifacts.filter((item) => item.exists).map((item) => item.path)),
  ],
  missingFutureArtifacts,
  lanes,
  boundaryAudit,
};

if (!report.reportOnly || report.boundaryAudit.some((item) => item.status === "fail")) {
  throw new Error("Rollup boundary audit failed.");
}

for (const metricName of [
  "runtimeApprovedRows",
  "publicPromotionRows",
  "candidatePoolRows",
  "runtimeApplyRows",
  "liveDbWriteRows",
  "dbAccessRows",
  "runtimePatchProposalRows",
]) {
  if (report.metrics[metricName] !== 0) {
    throw new Error(`${metricName} must remain 0.`);
  }
}

const jsonPath = path.join(reportsDir, "category-no-write-runner-rollup-latest.json");
const mdPath = path.join(reportsDir, "category-no-write-runner-rollup-latest.md");

const markdown = [
  "# Category No-Write Runner Rollup",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- conclusion: ${report.conclusion}`,
  `- ownership: ${report.ownership}`,
  `- reportOnly: ${report.reportOnly}`,
  `- runtimeCatalogApply/runtimeApply/publicPromotion/candidatePoolPolicyWiring: ${report.runtimeCatalogApply}/${report.runtimeApply}/${report.publicPromotion}/${report.candidatePoolPolicyWiring}`,
  `- runtimeApproved/publicPromotion/candidatePool/runtimeApply rows: ${metrics.runtimeApprovedRows}/${metrics.publicPromotionRows}/${metrics.candidatePoolRows}/${metrics.runtimeApplyRows}`,
  `- liveDbWriteRows/dbAccessRows/runtimePatchProposalRows: ${metrics.liveDbWriteRows}/${metrics.dbAccessRows}/${metrics.runtimePatchProposalRows}`,
  "",
  "## Scope",
  "",
  "Report-only meta rollup for no-write runner simulation/preflight/design artifacts. Missing future simulation files are tolerated and recorded as pending, not failures.",
  "",
  "## Metrics",
  "",
  table(
    ["metric", "value"],
    Object.entries(metrics).map(([key, value]) => [key, value]),
  ),
  "",
  "## Lane Rollup",
  "",
  table(
    ["lane", "status", "reason", "nextAction"],
    lanes.map((lane) => [lane.lane, lane.status, lane.reason, lane.nextAction]),
  ),
  "",
  "## Artifacts",
  "",
  table(
    ["lane", "role", "exists", "reportOnly", "path", "conclusion"],
    lanes.flatMap((lane) =>
      lane.artifacts.map((item) => [
        lane.lane,
        item.role,
        String(item.exists),
        String(item.reportOnly ?? "n/a"),
        item.path,
        item.conclusion ?? "missing",
      ]),
    ),
  ),
  "",
  "## Missing Future Artifacts",
  "",
  missingFutureArtifacts.length === 0
    ? "- none"
    : missingFutureArtifacts.map((item) => `- ${item}`).join("\n"),
  "",
  "## Boundary Audit",
  "",
  table(
    ["check", "status", "evidence"],
    boundaryAudit.map((item) => [item.check, item.status, item.evidence]),
  ),
  "",
].join("\n");

fs.writeFileSync(jsonPath, `${JSON.stringify(report satisfies JsonValue, null, 2)}\n`);
fs.writeFileSync(mdPath, markdown);

console.log(
  JSON.stringify(
    {
      conclusion: report.conclusion,
      statusCounts,
      artifactsPresent: metrics.artifactsPresent,
      missingFutureArtifacts: metrics.missingFutureArtifacts,
      runtimeApprovedRows: metrics.runtimeApprovedRows,
      publicPromotionRows: metrics.publicPromotionRows,
      candidatePoolRows: metrics.candidatePoolRows,
      runtimeApplyRows: metrics.runtimeApplyRows,
      liveDbWriteRows: metrics.liveDbWriteRows,
      dbAccessRows: metrics.dbAccessRows,
      runtimePatchProposalRows: metrics.runtimePatchProposalRows,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
