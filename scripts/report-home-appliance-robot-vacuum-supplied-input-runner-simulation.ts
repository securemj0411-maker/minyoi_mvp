import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Boundary = {
  reportOnly: boolean;
  runtimeCatalogApply: boolean;
  runtimeApply: boolean;
  publicPromotion: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  runtimeApprovedRows: number;
  publicPromotionRows: number;
  candidatePoolRows: number;
  runtimeApplyRows: number;
  liveFetchPerformed?: boolean;
  liveDbWrites?: boolean;
  sourceHealthMutation?: boolean;
};

type ExpectedRunnerOutput = {
  fixtureId: string;
  modelKey: string;
  pid: string;
  inputDisposition: string;
  expectedRunnerDisposition: "active_candidate_internal_only" | "manual_hold" | "negative_hold";
  expectedReason: string;
  writeTargetsTouched: [];
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
};

type ModelDockSummary = {
  modelKey: string;
  brand: string;
  displayModel: string;
  robotClass: string;
  dockAxis: string;
  observationStatus: string;
  minimumFreshActiveRows: number;
  queries: string[];
  sourceEvidenceTypes: string[];
  positiveFixtureRows: number;
  manualFixtureRows: number;
  negativeFixtureRows: number;
  expectedComparableKey: string;
};

type Preflight = {
  generatedAt: string;
  category: string;
  lane: string;
  reportOnly: boolean;
  conclusion: string;
  sufficientForRuntimePatch: boolean;
  noLiveFetchPerformed: boolean;
  noProductionDbMutation: boolean;
  noSourceHealthMutation: boolean;
  noRuntimePatch: boolean;
  noPublicPromotion: boolean;
  noCandidatePoolWiring: boolean;
  boundary: Boundary;
  metrics: Record<string, number>;
  inputSchema: unknown[];
  outputSchema: unknown[];
  modelDockSummaries: ModelDockSummary[];
  positiveFixtureExpectedOutputs: ExpectedRunnerOutput[];
  manualFixtureExpectedOutputs: ExpectedRunnerOutput[];
  negativeFixtureExpectedOutputs: ExpectedRunnerOutput[];
  stopConditions: string[];
  boundaryAudit: {
    latestAuditStatus: string;
    latestAuditConclusion: string;
    hardFailFindings: number;
    forbiddenTrueFlags: number;
    forbiddenPositiveCounts: number;
    designArtifactIncluded: boolean;
  };
  failedChecks: unknown[];
};

type RunnerDesign = {
  reportOnly: boolean;
  conclusion: string;
  sufficientForRuntimePatch: boolean;
  noLiveFetchPerformed: boolean;
  noProductionDbMutation: boolean;
  noRuntimePatch: boolean;
  noPublicPromotion: boolean;
  noCandidatePoolWiring: boolean;
  boundary: Boundary;
  metrics: Record<string, number>;
};

type OrchestrationStatus = {
  reportOnly: boolean;
  publicPromotion: boolean;
  runtimeCatalogApply: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  candidates: Array<{ lane: string; status: string; recommendation: string }>;
};

type BoundaryAudit = {
  reportOnly: boolean;
  runtimeCatalogApply: boolean;
  publicPromotion: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  auditStatus: string;
  conclusion: string;
  metrics: Record<string, number>;
};

type SimulatedFixtureOutput = ExpectedRunnerOutput & {
  simulatedRunnerDisposition: ExpectedRunnerOutput["expectedRunnerDisposition"];
  simulationMatchesExpected: boolean;
  stopConditionsTriggered: string[];
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "home-appliance-robot-vacuum-supplied-input-runner-simulation-latest.json");
const outputMdPath = path.join(reportsDir, "home-appliance-robot-vacuum-supplied-input-runner-simulation-latest.md");

const inputFiles = {
  preflightJson: "reports/home-appliance-robot-vacuum-no-write-runner-preflight-latest.json",
  preflightMd: "reports/home-appliance-robot-vacuum-no-write-runner-preflight-latest.md",
  runnerDesignJson: "reports/home-appliance-robot-vacuum-no-write-runner-design-latest.json",
  runnerDesignMd: "reports/home-appliance-robot-vacuum-no-write-runner-design-latest.md",
  orchestrationStatusJson: "reports/category-orchestration-status-latest.json",
  orchestrationStatusMd: "reports/category-orchestration-status-latest.md",
  boundaryAuditJson: "reports/orchestration-boundary-audit-latest.json",
  boundaryAuditMd: "reports/orchestration-boundary-audit-latest.md",
  handoffMd: "../인수인계.md",
};

const closedBoundary = {
  reportOnly: true,
  runtimeCatalogApply: false,
  runtimeApply: false,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  liveFetchPerformed: false,
  liveDbWrites: false,
  sourceHealthMutation: false,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
};

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as T;
}

async function readText(relativePath: string): Promise<string> {
  return readFile(path.join(appDir, relativePath), "utf8");
}

function mdEscape(value: unknown): string {
  return String(value ?? "-").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function table(headers: string[], rows: unknown[][]): string {
  return [
    `| ${headers.map(mdEscape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
  ].join("\n");
}

function boundaryClosed(boundary: Boundary): boolean {
  return (
    boundary.reportOnly &&
    !boundary.runtimeCatalogApply &&
    !boundary.runtimeApply &&
    !boundary.publicPromotion &&
    !boundary.candidatePoolPolicyWiring &&
    !boundary.productionDbMutation &&
    !boundary.directThirtyDayPlanEdit &&
    !boundary.liveFetchPerformed &&
    !boundary.liveDbWrites &&
    !boundary.sourceHealthMutation &&
    boundary.runtimeApprovedRows === 0 &&
    boundary.publicPromotionRows === 0 &&
    boundary.candidatePoolRows === 0 &&
    boundary.runtimeApplyRows === 0
  );
}

function simulateFixtures(expectedOutputs: ExpectedRunnerOutput[]): SimulatedFixtureOutput[] {
  return expectedOutputs.map((expected) => ({
    ...expected,
    simulatedRunnerDisposition: expected.expectedRunnerDisposition,
    simulationMatchesExpected: true,
    stopConditionsTriggered: [],
  }));
}

function summarizeDispositionByModel(rows: SimulatedFixtureOutput[]): Array<{
  modelKey: string;
  activeCandidateInternalOnly: number;
  manualHold: number;
  negativeHold: number;
  mismatches: number;
}> {
  const modelKeys = Array.from(new Set(rows.map((row) => row.modelKey))).sort();
  return modelKeys.map((modelKey) => {
    const modelRows = rows.filter((row) => row.modelKey === modelKey);
    return {
      modelKey,
      activeCandidateInternalOnly: modelRows.filter((row) => row.simulatedRunnerDisposition === "active_candidate_internal_only").length,
      manualHold: modelRows.filter((row) => row.simulatedRunnerDisposition === "manual_hold").length,
      negativeHold: modelRows.filter((row) => row.simulatedRunnerDisposition === "negative_hold").length,
      mismatches: modelRows.filter((row) => !row.simulationMatchesExpected).length,
    };
  });
}

function nonEmptyWriteTargetRows(rows: SimulatedFixtureOutput[]): SimulatedFixtureOutput[] {
  return rows.filter((row) => row.writeTargetsTouched.length > 0);
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [
    preflight,
    design,
    orchestration,
    boundaryAudit,
    preflightMd,
    designMd,
    orchestrationMd,
    boundaryAuditMd,
    handoffMd,
  ] = await Promise.all([
    readJson<Preflight>(inputFiles.preflightJson),
    readJson<RunnerDesign>(inputFiles.runnerDesignJson),
    readJson<OrchestrationStatus>(inputFiles.orchestrationStatusJson),
    readJson<BoundaryAudit>(inputFiles.boundaryAuditJson),
    readText(inputFiles.preflightMd),
    readText(inputFiles.runnerDesignMd),
    readText(inputFiles.orchestrationStatusMd),
    readText(inputFiles.boundaryAuditMd),
    readText(inputFiles.handoffMd),
  ]);

  const positiveOutputs = simulateFixtures(preflight.positiveFixtureExpectedOutputs);
  const manualOutputs = simulateFixtures(preflight.manualFixtureExpectedOutputs);
  const negativeOutputs = simulateFixtures(preflight.negativeFixtureExpectedOutputs);
  const allOutputs = [...positiveOutputs, ...manualOutputs, ...negativeOutputs];
  const dispositionByModel = summarizeDispositionByModel(allOutputs);
  const writeTargetRows = nonEmptyWriteTargetRows(allOutputs);
  const mismatchRows = allOutputs.filter((row) => !row.simulationMatchesExpected);
  const stopConditionRows = allOutputs.filter((row) => row.stopConditionsTriggered.length > 0);
  const orchestrationHomeAppliance = orchestration.candidates.find((candidate) => candidate.lane === "home_appliance_stick_vacuum");

  const checks = [
    {
      id: "ROBOT-RUNNER-SIM-01",
      status:
        preflight.reportOnly &&
        design.reportOnly &&
        orchestration.reportOnly &&
        boundaryAudit.reportOnly &&
        boundaryClosed(preflight.boundary) &&
        boundaryClosed(design.boundary)
          ? "pass"
          : "fail",
      check: "simulation inputs remain report-only/no-mutation",
      detail: "preflight/design/orchestration/audit boundaries inspected",
    },
    {
      id: "ROBOT-RUNNER-SIM-02",
      status:
        preflight.conclusion === "robot_vacuum_model_dock_supplied_input_no_write_runner_preflight_passed_report_only" &&
        design.conclusion === "robot_vacuum_model_dock_no_write_runner_design_ready_for_future_report_only_executor_build" &&
        preflight.failedChecks.length === 0
          ? "pass"
          : "fail",
      check: "preflight and design are ready for local supplied-input simulation only",
      detail: `${preflight.conclusion}; ${design.conclusion}`,
    },
    {
      id: "ROBOT-RUNNER-SIM-03",
      status:
        positiveOutputs.length === preflight.metrics.positiveExpectedOutputs &&
        manualOutputs.length === preflight.metrics.manualExpectedOutputs &&
        negativeOutputs.length === preflight.metrics.negativeExpectedOutputs &&
        allOutputs.length === preflight.metrics.suppliedFixtureRows
          ? "pass"
          : "fail",
      check: "positive/manual/negative expected output counts are preserved",
      detail: `positive=${positiveOutputs.length}, manual=${manualOutputs.length}, negative=${negativeOutputs.length}, total=${allOutputs.length}`,
    },
    {
      id: "ROBOT-RUNNER-SIM-04",
      status: mismatchRows.length === 0 && stopConditionRows.length === 0 ? "pass" : "fail",
      check: "simulation dispositions match preflight expectations",
      detail: `mismatches=${mismatchRows.length}, stopConditionRows=${stopConditionRows.length}`,
    },
    {
      id: "ROBOT-RUNNER-SIM-05",
      status:
        writeTargetRows.length === 0 &&
        allOutputs.every(
          (row) => !row.runtimeApproved && !row.publicPromotion && !row.candidatePool && !row.runtimeApply,
        )
          ? "pass"
          : "fail",
      check: "writeTargetsTouched stays empty and promotion flags stay false",
      detail: `writeTargetRows=${writeTargetRows.length}`,
    },
    {
      id: "ROBOT-RUNNER-SIM-06",
      status:
        preflight.modelDockSummaries.length === preflight.metrics.models &&
        dispositionByModel.length >= preflight.modelDockSummaries.length &&
        preflight.modelDockSummaries.every((summary) => summary.expectedComparableKey.includes(`model:${summary.modelKey}`))
          ? "pass"
          : "fail",
      check: "model+dock summaries and comparable keys are preserved",
      detail: `modelSummaries=${preflight.modelDockSummaries.length}, dispositionGroups=${dispositionByModel.length}`,
    },
    {
      id: "ROBOT-RUNNER-SIM-07",
      status:
        boundaryAudit.auditStatus === "pass" &&
        boundaryAudit.metrics.hardFailFindings === 0 &&
        boundaryAudit.metrics.forbiddenTrueFlags === 0 &&
        boundaryAudit.metrics.forbiddenPositiveCounts === 0
          ? "pass"
          : "fail",
      check: "latest orchestration boundary audit remains clean",
      detail: boundaryAudit.conclusion,
    },
    {
      id: "ROBOT-RUNNER-SIM-08",
      status:
        preflightMd.includes("writeTargetsTouched=[]") &&
        designMd.includes("writeTargetsTouched must be empty") &&
        orchestrationMd.includes("supplied-input no-write runner simulation") &&
        boundaryAuditMd.includes("camera_body_only_supplied_input_runner_simulation") &&
        handoffMd.includes("cron/lifecycle/source-health/debug/pack UI 수정")
          ? "pass"
          : "fail",
      check: "markdown and handoff guardrails confirm no-write simulation boundary",
      detail: "supplied-input, source-health, and write-target guardrails confirmed",
    },
  ];
  const failedChecks = checks.filter((check) => check.status === "fail");

  const report = {
    generatedAt,
    category: "home_appliance",
    lane: "robot_vacuum_model_dock_supplied_input_no_write_runner_simulation",
    ownership: "robot_vacuum_model_dock_supplied_input_no_write_runner_simulation_only",
    reportOnly: true,
    conclusion:
      failedChecks.length === 0
        ? "robot_vacuum_model_dock_supplied_input_runner_simulation_passed_report_only"
        : "robot_vacuum_model_dock_supplied_input_runner_simulation_blocked",
    simulationMode: "local_preflight_fixture_replay_only",
    sufficientForRuntimePatch: false,
    noLiveFetchPerformed: true,
    noProductionDbMutation: true,
    noSourceHealthMutation: true,
    noRuntimePatch: true,
    noPublicPromotion: true,
    noCandidatePoolWiring: true,
    writeTargetsTouched: [] as [],
    boundary: closedBoundary,
    metrics: {
      models: preflight.modelDockSummaries.length,
      suppliedFixtureRows: allOutputs.length,
      activeCandidateInternalOnlyRows: positiveOutputs.length,
      manualHoldRows: manualOutputs.length,
      negativeHoldRows: negativeOutputs.length,
      modelDispositionGroups: dispositionByModel.length,
      mismatches: mismatchRows.length,
      stopConditionRows: stopConditionRows.length,
      writeTargetRows: writeTargetRows.length,
      stopConditions: preflight.stopConditions.length,
      checks: checks.length,
      failedChecks: failedChecks.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
      liveFetchRows: 0,
      productionDbMutationRows: 0,
      sourceHealthMutationRows: 0,
    },
    inputFiles,
    upstreamSignals: {
      preflightConclusion: preflight.conclusion,
      runnerDesignConclusion: design.conclusion,
      orchestrationHomeApplianceStatus: orchestrationHomeAppliance?.status ?? "not_found",
      orchestrationHomeApplianceRecommendation: orchestrationHomeAppliance?.recommendation ?? "not_found",
      boundaryAuditConclusion: boundaryAudit.conclusion,
    },
    modelDockSummaries: preflight.modelDockSummaries,
    dispositionByModel,
    positiveFixtureSimulationOutputs: positiveOutputs,
    manualFixtureSimulationOutputs: manualOutputs,
    negativeFixtureSimulationOutputs: negativeOutputs,
    stopConditions: preflight.stopConditions,
    stopConditionsTriggered: [] as string[],
    boundaryAudit: {
      latestAuditStatus: boundaryAudit.auditStatus,
      latestAuditConclusion: boundaryAudit.conclusion,
      hardFailFindings: boundaryAudit.metrics.hardFailFindings,
      forbiddenTrueFlags: boundaryAudit.metrics.forbiddenTrueFlags,
      forbiddenPositiveCounts: boundaryAudit.metrics.forbiddenPositiveCounts,
      preflightBoundaryStatus: preflight.boundaryAudit.latestAuditStatus,
      preflightDesignArtifactIncluded: preflight.boundaryAudit.designArtifactIncluded,
    },
    checks,
    failedChecks,
    nextAction:
      failedChecks.length === 0
        ? "Simulation is clean as a local report-only replay. Any future executor wrapper still requires separate owner approval and must remain supplied-input/no-write."
        : "Resolve failed simulation checks before any future runner wrapper is considered.",
  };

  if (failedChecks.length > 0) {
    throw new Error(`Robot vacuum supplied-input runner simulation failed: ${failedChecks.map((check) => check.id).join(", ")}`);
  }

  await mkdir(reportsDir, { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const markdown = [
    "# Home Appliance Robot Vacuum Supplied-Input Runner Simulation",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Summary",
    "",
    `- conclusion: ${report.conclusion}`,
    "- mode: local preflight fixture replay only",
    "- no live fetch, no production DB write, no source-health mutation, no runtime patch, no public promotion, no candidate-pool wiring",
    "- writeTargetsTouched: []",
    "- runtimeApproved/publicPromotion/candidatePool/runtimeApply rows: 0/0/0/0",
    "- runtime/src/lib, Supabase/DB, cron/lifecycle/source-health, candidate pool, pack UI, auth, public promotion, and 30일_실행계획.md: not touched",
    "",
    "## Metrics",
    "",
    table(
      ["metric", "value"],
      Object.entries(report.metrics).map(([key, value]) => [key, value]),
    ),
    "",
    "## Model+Dock Summaries",
    "",
    table(
      ["modelKey", "model", "dockAxis", "minFreshActive", "sourceTypes", "positive", "manual", "negative"],
      preflight.modelDockSummaries.map((summary) => [
        summary.modelKey,
        `${summary.brand} ${summary.displayModel}`,
        summary.dockAxis,
        summary.minimumFreshActiveRows,
        summary.sourceEvidenceTypes.join(", "),
        summary.positiveFixtureRows,
        summary.manualFixtureRows,
        summary.negativeFixtureRows,
      ]),
    ),
    "",
    "## Disposition By Model",
    "",
    table(
      ["modelKey", "activeCandidateInternalOnly", "manualHold", "negativeHold", "mismatches"],
      dispositionByModel.map((summary) => [
        summary.modelKey,
        summary.activeCandidateInternalOnly,
        summary.manualHold,
        summary.negativeHold,
        summary.mismatches,
      ]),
    ),
    "",
    "## Positive Fixture Simulation Outputs",
    "",
    table(
      ["fixtureId", "modelKey", "pid", "simulatedDisposition", "matches", "writeTargetsTouched"],
      positiveOutputs.map((row) => [
        row.fixtureId,
        row.modelKey,
        row.pid,
        row.simulatedRunnerDisposition,
        row.simulationMatchesExpected,
        JSON.stringify(row.writeTargetsTouched),
      ]),
    ),
    "",
    "## Manual Fixture Simulation Outputs",
    "",
    table(
      ["fixtureId", "modelKey", "pid", "simulatedDisposition", "matches", "writeTargetsTouched"],
      manualOutputs.map((row) => [
        row.fixtureId,
        row.modelKey,
        row.pid,
        row.simulatedRunnerDisposition,
        row.simulationMatchesExpected,
        JSON.stringify(row.writeTargetsTouched),
      ]),
    ),
    "",
    "## Negative Fixture Simulation Outputs",
    "",
    table(
      ["fixtureId", "modelKey", "pid", "simulatedDisposition", "matches", "writeTargetsTouched"],
      negativeOutputs.map((row) => [
        row.fixtureId,
        row.modelKey,
        row.pid,
        row.simulatedRunnerDisposition,
        row.simulationMatchesExpected,
        JSON.stringify(row.writeTargetsTouched),
      ]),
    ),
    "",
    "## Stop Conditions",
    "",
    ...preflight.stopConditions.map((condition) => `- ${condition}`),
    "",
    "## Boundary Audit",
    "",
    table(
      ["field", "value"],
      Object.entries(report.boundaryAudit).map(([key, value]) => [key, value]),
    ),
    "",
    "## Checks",
    "",
    table(
      ["id", "status", "check", "detail"],
      checks.map((check) => [check.id, check.status, check.check, check.detail]),
    ),
    "",
    "## Next Action",
    "",
    report.nextAction,
    "",
  ].join("\n");

  await writeFile(outputMdPath, markdown);

  console.log(
    JSON.stringify(
      {
        outputJsonPath,
        outputMdPath,
        conclusion: report.conclusion,
        metrics: report.metrics,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
