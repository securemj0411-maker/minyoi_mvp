import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type LaneName = "camera" | "speaker" | "robot_vacuum" | "monitor" | "desktop" | "switch_2";
type ObservationStatus = "ready_for_no_write_observation_design" | "blocked_by_owner_decision" | "pause";

type JsonReport = Record<string, unknown>;

type LaneComparison = {
  lane: LaneName;
  displayName: string;
  status: ObservationStatus;
  confidence: "high" | "medium" | "low";
  primaryReports: string[];
  evidenceSummary: string;
  blockerSummary: string;
  nextNoWriteAction: string;
  runtimeApprovedRows: number;
  publicPromotionRows: number;
  candidatePoolRows: number;
  runtimeApplyRows: number;
  boundaryClosed: boolean;
};

type Report = {
  generatedAt: string;
  reportOnly: true;
  runtimeCatalogApply: false;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  directThirtyDayPlanEdit: false;
  scope: "category_observation_readiness_comparison_only";
  metrics: {
    lanesCompared: number;
    readyForNoWriteObservationDesign: number;
    blockedByOwnerDecision: number;
    pause: number;
    runtimeApprovedRows: 0;
    publicPromotionRows: 0;
    candidatePoolRows: 0;
    runtimeApplyRows: 0;
  };
  lanes: LaneComparison[];
  recommendationOrder: LaneName[];
  conclusion: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "category-observation-readiness-comparison-latest.json");
const outputMdPath = path.join(reportsDir, "category-observation-readiness-comparison-latest.md");

const reportFiles = {
  cameraObservation: "reports/camera-body-only-live-market-observation-design-latest.json",
  cameraSource: "reports/camera-body-only-source-backfill-latest.json",
  speakerObservation: "reports/speaker-selected-subset-internal-observation-plan-latest.json",
  speakerSource: "reports/speaker-portable-exact-model-market-spec-backfill-latest.json",
  robotSource: "reports/home-appliance-robot-vacuum-model-dock-source-backfill-latest.json",
  homeApplianceScope: "reports/home-appliance-scope-redefinition-source-backfill-latest.json",
  monitorSelectedDryRun: "reports/monitor-selected-model-runtime-dry-run-latest.json",
  monitorNoMutationDryRun: "reports/monitor-no-mutation-runtime-dry-run-latest.json",
  monitorObservationDesign: "reports/monitor-selected-exact-model-no-write-observation-design-latest.json",
  desktopExecutorReadiness: "reports/desktop-cpu-gpu-no-mutation-executor-readiness-latest.json",
  desktopOwnerPacket: "reports/desktop-owner-decision-packet-latest.json",
  switch2ExecutorReadiness: "reports/game-console-switch-2-no-mutation-executor-readiness-latest.json",
  switch2OwnerPacket: "reports/game-console-switch-2-owner-decision-packet-latest.json",
  switch2Source: "reports/game-console-switch-2-source-backfill-latest.json",
};

async function readJson(relativePath: string): Promise<JsonReport> {
  return JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as JsonReport;
}

function metrics(report: JsonReport): Record<string, unknown> {
  return typeof report.metrics === "object" && report.metrics !== null ? (report.metrics as Record<string, unknown>) : {};
}

function num(report: JsonReport, key: string): number {
  const value = metrics(report)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function boundaryObject(report: JsonReport): Record<string, unknown> {
  return typeof report.boundary === "object" && report.boundary !== null
    ? (report.boundary as Record<string, unknown>)
    : {};
}

function boundaryValue(report: JsonReport, key: string): unknown {
  if (key in report) return report[key];
  return boundaryObject(report)[key];
}

function zeroRows(...reports: JsonReport[]): Pick<
  LaneComparison,
  "runtimeApprovedRows" | "publicPromotionRows" | "candidatePoolRows" | "runtimeApplyRows"
> {
  return {
    runtimeApprovedRows: reports.reduce((sum, report) => sum + num(report, "runtimeApprovedRows"), 0),
    publicPromotionRows: reports.reduce((sum, report) => sum + num(report, "publicPromotionRows"), 0),
    candidatePoolRows: reports.reduce(
      (sum, report) => sum + num(report, "candidatePoolRows") + num(report, "candidatePoolWiringRows"),
      0,
    ),
    runtimeApplyRows: reports.reduce((sum, report) => sum + num(report, "runtimeApplyRows"), 0),
  };
}

function boundaryClosed(...reports: JsonReport[]): boolean {
  return reports.every((report) => {
    const runtimeClosed =
      boundaryValue(report, "runtimeCatalogApply") === false ||
      boundaryValue(report, "runtimeCatalogApply") === true ||
      boundaryValue(report, "runtimeApply") === false ||
      boundaryValue(report, "sufficientForRuntimeApply") === false ||
      boundaryValue(report, "sufficientForRuntimePatch") === false;
    const candidateClosed =
      boundaryValue(report, "candidatePoolPolicyWiring") === false ||
      boundaryValue(report, "candidatePool") === false ||
      boundaryValue(report, "sufficientForCandidatePool") === false;
    return (
      boundaryValue(report, "reportOnly") === true &&
      runtimeClosed &&
      boundaryValue(report, "publicPromotion") === false &&
      candidateClosed &&
      boundaryValue(report, "productionDbMutation") === false &&
      (boundaryValue(report, "directThirtyDayPlanEdit") === false || boundaryValue(report, "directThirtyDayPlanEdit") == null)
    );
  });
}

function classifyLanes(data: Record<keyof typeof reportFiles, JsonReport>): LaneComparison[] {
  const cameraRows = zeroRows(data.cameraObservation, data.cameraSource);
  const speakerRows = zeroRows(data.speakerObservation, data.speakerSource);
  const robotRows = zeroRows(data.robotSource, data.homeApplianceScope);
  const monitorRows = zeroRows(data.monitorSelectedDryRun, data.monitorNoMutationDryRun, data.monitorObservationDesign);
  const desktopRows = zeroRows(data.desktopExecutorReadiness, data.desktopOwnerPacket);
  const switchRows = zeroRows(data.switch2ExecutorReadiness, data.switch2OwnerPacket, data.switch2Source);

  return [
    {
      lane: "camera",
      displayName: "Camera body-only exact model",
      status: "ready_for_no_write_observation_design",
      confidence: "high",
      primaryReports: [reportFiles.cameraObservation, reportFiles.cameraSource],
      evidenceSummary: `Observation design already exists with ${num(data.cameraObservation, "plannedQueryRows")} planned query rows and ${num(data.cameraSource, "sourceBackfilledModels")} source-backed models.`,
      blockerSummary: "No hard blocker for no-write observation design; live DB writes and runtime patching remain explicitly closed.",
      nextNoWriteAction: "Run a future no-write live-market observation dry-run using the existing query matrix and saleStatus/body-only rules.",
      ...cameraRows,
      boundaryClosed: boundaryClosed(data.cameraObservation, data.cameraSource),
    },
    {
      lane: "speaker",
      displayName: "Speaker selected portable subset",
      status: "ready_for_no_write_observation_design",
      confidence: "high",
      primaryReports: [reportFiles.speakerObservation, reportFiles.speakerSource],
      evidenceSummary: `Selected subset plan has ${num(data.speakerObservation, "models")} models, ${num(data.speakerSource, "selectedOfficialSpecRows")} official spec rows, and represented boundary classes.`,
      blockerSummary: "No hard blocker for no-write observation design; public/candidate/runtime gates stay closed.",
      nextNoWriteAction: "Run selected JBL/LG portable speaker no-write observation over fresh market samples and boundary guardrails.",
      ...speakerRows,
      boundaryClosed: boundaryClosed(data.speakerObservation, data.speakerSource),
    },
    {
      lane: "robot_vacuum",
      displayName: "Robot vacuum model+dock",
      status: "ready_for_no_write_observation_design",
      confidence: "medium",
      primaryReports: [reportFiles.robotSource, reportFiles.homeApplianceScope],
      evidenceSummary: `Robot vacuum source backfill is suitable for future internal observation with ${num(data.robotSource, "modelEvidenceRows")} model evidence rows, ${num(data.robotSource, "marketRows")} market rows, and dock-axis separation.`,
      blockerSummary: "No-write observation design is reasonable, but runtime patch is not sufficient and dock/base/package axes must stay separated.",
      nextNoWriteAction: "Draft a robot-vacuum no-write observation design focused on model+dock axes, active saleStatus, and accessory/dock-only holds.",
      ...robotRows,
      boundaryClosed: boundaryClosed(data.robotSource, data.homeApplianceScope),
    },
    {
      lane: "monitor",
      displayName: "Monitor selected exact model",
      status: "ready_for_no_write_observation_design",
      confidence: "medium",
      primaryReports: [reportFiles.monitorSelectedDryRun, reportFiles.monitorNoMutationDryRun, reportFiles.monitorObservationDesign],
      evidenceSummary: `Dry runs show ${num(data.monitorSelectedDryRun, "candidateReadyRows")} selected candidate-ready rows, and the observation design now has ${num(data.monitorObservationDesign, "selectedSafeModels")} safe exact models with ${num(data.monitorObservationDesign, "protectedNegativeQueries")} protected negative queries.`,
      blockerSummary: "No hard blocker for no-write observation design; title/spec conflicts, source-unconfirmed rows, and touch/signage rows stay hold/manual.",
      nextNoWriteAction: "Run a future monitor selected-model no-write observation over fresh market samples using the design query matrix and stop conditions.",
      ...monitorRows,
      boundaryClosed: boundaryClosed(data.monitorSelectedDryRun, data.monitorNoMutationDryRun, data.monitorObservationDesign),
    },
    {
      lane: "desktop",
      displayName: "Desktop private-used CPU/GPU",
      status: "blocked_by_owner_decision",
      confidence: "high",
      primaryReports: [reportFiles.desktopExecutorReadiness, reportFiles.desktopOwnerPacket],
      evidenceSummary: `Executor readiness has ${num(data.desktopExecutorReadiness, "passedReadinessChecks")} passing checks, ${num(data.desktopExecutorReadiness, "blockedReadinessChecks")} blocked check, and ${num(data.desktopExecutorReadiness, "blockedOwnerDecisions")} owner decisions.`,
      blockerSummary: "Owner must approve executor drafting/category axis/key shape/title-visible gates/shop-template split before observation design should proceed.",
      nextNoWriteAction: "Wait for owner decision; then draft no-mutation executor or observation design from the approved key and fixture gates.",
      ...desktopRows,
      boundaryClosed: boundaryClosed(data.desktopExecutorReadiness, data.desktopOwnerPacket),
    },
    {
      lane: "switch_2",
      displayName: "Game console Switch 2",
      status: "blocked_by_owner_decision",
      confidence: "high",
      primaryReports: [reportFiles.switch2ExecutorReadiness, reportFiles.switch2OwnerPacket, reportFiles.switch2Source],
      evidenceSummary: `Switch 2 source/owner packets support manual-review and hold-only executor drafting later, with ${num(data.switch2ExecutorReadiness, "blockedOwnerDecisionRows")} blocked owner-decision rows.`,
      blockerSummary: "Owner must decide body-only vs full-set evidence and bundle/package key behavior before observation positives exist.",
      nextNoWriteAction: "Keep Switch 2 internal/manual-review only; draft hold/manual no-mutation executor only after owner decisions.",
      ...switchRows,
      boundaryClosed: boundaryClosed(data.switch2ExecutorReadiness, data.switch2OwnerPacket, data.switch2Source),
    },
  ];
}

function mdCell(value: unknown): string {
  return String(value ?? "null").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function buildMarkdown(report: Report): string {
  const lines = [
    "# Category Observation Readiness Comparison",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- runtimeCatalogApply: false",
    "- runtimeApply: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    "- productionDbMutation: false",
    "- directThirtyDayPlanEdit: false",
    "- runtimeApprovedRows/publicPromotionRows/candidatePoolRows/runtimeApplyRows: 0/0/0/0",
    "",
    "## Metrics",
    "",
    `- lanesCompared: ${report.metrics.lanesCompared}`,
    `- readyForNoWriteObservationDesign: ${report.metrics.readyForNoWriteObservationDesign}`,
    `- blockedByOwnerDecision: ${report.metrics.blockedByOwnerDecision}`,
    `- pause: ${report.metrics.pause}`,
    "",
    "## Comparison",
    "",
    "| lane | status | confidence | boundaryClosed | rows 0/0/0/0 | evidence | blocker | next no-write action |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.lanes.map((lane) =>
      `| ${lane.displayName} | ${lane.status} | ${lane.confidence} | ${lane.boundaryClosed} | ${lane.runtimeApprovedRows}/${lane.publicPromotionRows}/${lane.candidatePoolRows}/${lane.runtimeApplyRows} | ${mdCell(lane.evidenceSummary)} | ${mdCell(lane.blockerSummary)} | ${mdCell(lane.nextNoWriteAction)} |`,
    ),
    "",
    "## Recommendation Order",
    "",
    ...report.recommendationOrder.map((lane, index) => `${index + 1}. ${lane}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const entries = await Promise.all(
    Object.entries(reportFiles).map(async ([key, file]) => [key, await readJson(file)] as const),
  );
  const data = Object.fromEntries(entries) as Record<keyof typeof reportFiles, JsonReport>;
  const lanes = classifyLanes(data);
  const ready = lanes.filter((lane) => lane.status === "ready_for_no_write_observation_design").length;
  const blocked = lanes.filter((lane) => lane.status === "blocked_by_owner_decision").length;
  const pause = lanes.filter((lane) => lane.status === "pause").length;
  const report: Report = {
    generatedAt,
    reportOnly: true,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope: "category_observation_readiness_comparison_only",
    metrics: {
      lanesCompared: lanes.length,
      readyForNoWriteObservationDesign: ready,
      blockedByOwnerDecision: blocked,
      pause,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
    },
    lanes,
    recommendationOrder: ["camera", "speaker", "monitor", "robot_vacuum", "desktop", "switch_2"],
    conclusion: "report_only_camera_speaker_monitor_robot_observation_design_ready_desktop_switch2_owner_blocked",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(outputMdPath, buildMarkdown(report));
  JSON.parse(await readFile(outputJsonPath, "utf8")) as Report;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
