import fs from "node:fs";
import path from "node:path";

type Candidate = {
  lane: string;
  status: string;
  runtimeSurface: "small" | "medium" | "large";
  evidence: "strong" | "medium" | "weak";
  blocker: string;
  nextAction: string;
  score: number;
};

function exists(file: string) {
  return fs.existsSync(path.join(process.cwd(), file));
}

function readJson<T>(file: string): T | null {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

const homeApplianceBackfill = readJson<{
  metrics?: {
    positiveRows?: number;
    positiveFamilyGroups?: number;
    strictPositiveGoalMet?: boolean;
  };
}>("reports/home-appliance-stick-vacuum-positive-backfill-latest.json");

const homeApplianceBackfillFailed =
  homeApplianceBackfill?.metrics?.strictPositiveGoalMet === false;

const homeApplianceTargeted = readJson<{
  metrics?: {
    candidatePositiveContractOnlyRows?: number;
    positiveFamilyGroups?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolWiringRows?: number;
    strictGoalMet?: boolean;
  };
  conclusion?: string;
}>("reports/home-appliance-stick-vacuum-targeted-acquisition-latest.json");

const homeApplianceTargetedGoalMet =
  (homeApplianceTargeted?.metrics?.candidatePositiveContractOnlyRows ?? 0) >= 8 &&
  (homeApplianceTargeted?.metrics?.positiveFamilyGroups ?? 0) >= 3;

const homeApplianceTargetedWave2 = readJson<{
  metrics?: {
    candidatePositiveContractOnlyRows?: number;
    positiveFamilyGroups?: number;
    positiveModelKeys?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
    strictGoalMet?: boolean;
  };
  conclusion?: string;
}>("reports/home-appliance-stick-vacuum-targeted-acquisition-wave2-latest.json");

const homeApplianceCombinedPositiveRows =
  (homeApplianceTargeted?.metrics?.candidatePositiveContractOnlyRows ?? 0) +
  (homeApplianceTargetedWave2?.metrics?.candidatePositiveContractOnlyRows ?? 0);

const homeApplianceCombinedFamilyGroups =
  (homeApplianceTargeted?.metrics?.positiveFamilyGroups ?? 0) +
  (homeApplianceTargetedWave2?.metrics?.positiveFamilyGroups ?? 0);

const homeApplianceWave2GoalMet =
  homeApplianceCombinedPositiveRows >= 10 &&
  homeApplianceCombinedFamilyGroups >= 3 &&
  homeApplianceTargetedWave2?.metrics?.strictGoalMet === true;

const homeApplianceTargetedWave3 = readJson<{
  conclusion?: string;
  metrics?: {
    positiveRows?: number;
    manualRows?: number;
    holdRows?: number;
    positiveFamilyGroups?: number;
    modelKeys?: number;
    evidenceGoalMet?: boolean;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/home-appliance-stick-vacuum-targeted-acquisition-wave3-latest.json");

const homeApplianceWave3GoalMet =
  homeApplianceTargetedWave3?.metrics?.evidenceGoalMet === true &&
  (homeApplianceTargetedWave3?.metrics?.positiveRows ?? 0) >= 8 &&
  (homeApplianceTargetedWave3?.metrics?.positiveFamilyGroups ?? 0) >= 3;

const homeApplianceScopeRedefinitionSourceBackfill = readJson<{
  conclusion?: string;
  recommendedNextLane?: string;
  broadStickVacuumDecision?: string;
  metrics?: {
    sourceEvidenceRows?: number;
    officialProductSources?: number;
    officialManualOrPdfSources?: number;
    failedChecks?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/home-appliance-scope-redefinition-source-backfill-latest.json");

const homeApplianceScopeRedefinitionReady =
  homeApplianceScopeRedefinitionSourceBackfill?.broadStickVacuumDecision === "pause" &&
  homeApplianceScopeRedefinitionSourceBackfill?.recommendedNextLane === "robot_vacuum_model_dock_source_backfill" &&
  (homeApplianceScopeRedefinitionSourceBackfill?.metrics?.failedChecks ?? 1) === 0 &&
  (homeApplianceScopeRedefinitionSourceBackfill?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (homeApplianceScopeRedefinitionSourceBackfill?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (homeApplianceScopeRedefinitionSourceBackfill?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (homeApplianceScopeRedefinitionSourceBackfill?.metrics?.runtimeApplyRows ?? 1) === 0;

const homeApplianceRobotVacuumSourceBackfill = readJson<{
  conclusion?: string;
  suitableForFutureInternalObservationPlanning?: boolean;
  metrics?: {
    modelEvidenceRows?: number;
    sourceRows?: number;
    marketRows?: number;
    boundaryRows?: number;
    failedChecks?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/home-appliance-robot-vacuum-model-dock-source-backfill-latest.json");

const robotVacuumSourceBackfillReady =
  homeApplianceRobotVacuumSourceBackfill?.suitableForFutureInternalObservationPlanning === true &&
  (homeApplianceRobotVacuumSourceBackfill?.metrics?.failedChecks ?? 1) === 0 &&
  (homeApplianceRobotVacuumSourceBackfill?.metrics?.modelEvidenceRows ?? 0) >= 5 &&
  (homeApplianceRobotVacuumSourceBackfill?.metrics?.sourceRows ?? 0) >= 5 &&
  (homeApplianceRobotVacuumSourceBackfill?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (homeApplianceRobotVacuumSourceBackfill?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (homeApplianceRobotVacuumSourceBackfill?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (homeApplianceRobotVacuumSourceBackfill?.metrics?.runtimeApplyRows ?? 1) === 0;

const robotVacuumInternalObservationDesign = readJson<{
  conclusion?: string;
  internalObservationDesignReady?: boolean;
  liveFetchPerformed?: boolean;
  metrics?: {
    models?: number;
    totalQueryVariants?: number;
    minimumActiveRowsTotal?: number;
    failedChecks?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/home-appliance-robot-vacuum-internal-observation-design-latest.json");

const robotVacuumObservationDesignReady =
  robotVacuumInternalObservationDesign?.internalObservationDesignReady === true &&
  robotVacuumInternalObservationDesign?.liveFetchPerformed === false &&
  (robotVacuumInternalObservationDesign?.metrics?.failedChecks ?? 1) === 0 &&
  (robotVacuumInternalObservationDesign?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (robotVacuumInternalObservationDesign?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (robotVacuumInternalObservationDesign?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (robotVacuumInternalObservationDesign?.metrics?.runtimeApplyRows ?? 1) === 0;

const robotVacuumNoWriteRunnerDesign = readJson<{
  conclusion?: string;
  metrics?: {
    models?: number;
    sourceRows?: number;
    candidateFixtureRows?: number;
    manualHoldRows?: number;
    negativeHoldRows?: number;
    excludedFixtureRows?: number;
    minimumFreshActiveRowsTotal?: number;
    failedChecks?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/home-appliance-robot-vacuum-no-write-runner-design-latest.json");

const robotVacuumNoWriteRunnerDesignReady =
  robotVacuumNoWriteRunnerDesign?.conclusion?.includes("no_write_runner_design_ready") === true &&
  (robotVacuumNoWriteRunnerDesign?.metrics?.models ?? 0) >= 7 &&
  (robotVacuumNoWriteRunnerDesign?.metrics?.sourceRows ?? 0) >= 7 &&
  (robotVacuumNoWriteRunnerDesign?.metrics?.candidateFixtureRows ?? 0) >= 4 &&
  (robotVacuumNoWriteRunnerDesign?.metrics?.failedChecks ?? 1) === 0 &&
  (robotVacuumNoWriteRunnerDesign?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (robotVacuumNoWriteRunnerDesign?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (robotVacuumNoWriteRunnerDesign?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (robotVacuumNoWriteRunnerDesign?.metrics?.runtimeApplyRows ?? 1) === 0;

const robotVacuumNoWriteRunnerPreflight = readJson<{
  conclusion?: string;
  metrics?: {
    models?: number;
    suppliedFixtureRows?: number;
    positiveExpectedOutputs?: number;
    manualExpectedOutputs?: number;
    negativeExpectedOutputs?: number;
    sourceCoverageRows?: number;
    stopConditions?: number;
    failedChecks?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
    liveFetchRows?: number;
    productionDbMutationRows?: number;
    sourceHealthMutationRows?: number;
  };
}>("reports/home-appliance-robot-vacuum-no-write-runner-preflight-latest.json");

const robotVacuumNoWriteRunnerPreflightPassed =
  robotVacuumNoWriteRunnerPreflight?.conclusion?.includes("preflight_passed") === true &&
  (robotVacuumNoWriteRunnerPreflight?.metrics?.models ?? 0) >= 7 &&
  (robotVacuumNoWriteRunnerPreflight?.metrics?.suppliedFixtureRows ?? 0) >= 17 &&
  (robotVacuumNoWriteRunnerPreflight?.metrics?.positiveExpectedOutputs ?? 0) >= 4 &&
  (robotVacuumNoWriteRunnerPreflight?.metrics?.failedChecks ?? 1) === 0 &&
  (robotVacuumNoWriteRunnerPreflight?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (robotVacuumNoWriteRunnerPreflight?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (robotVacuumNoWriteRunnerPreflight?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (robotVacuumNoWriteRunnerPreflight?.metrics?.runtimeApplyRows ?? 1) === 0 &&
  (robotVacuumNoWriteRunnerPreflight?.metrics?.liveFetchRows ?? 1) === 0 &&
  (robotVacuumNoWriteRunnerPreflight?.metrics?.productionDbMutationRows ?? 1) === 0 &&
  (robotVacuumNoWriteRunnerPreflight?.metrics?.sourceHealthMutationRows ?? 1) === 0;

const robotVacuumSuppliedInputRunnerSimulation = readJson<{
  conclusion?: string;
  metrics?: {
    models?: number;
    suppliedFixtureRows?: number;
    activeCandidateInternalOnlyRows?: number;
    manualHoldRows?: number;
    negativeHoldRows?: number;
    mismatches?: number;
    stopConditionRows?: number;
    writeTargetRows?: number;
    failedChecks?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
    liveFetchRows?: number;
    productionDbMutationRows?: number;
    sourceHealthMutationRows?: number;
  };
}>("reports/home-appliance-robot-vacuum-supplied-input-runner-simulation-latest.json");

const robotVacuumSuppliedInputRunnerSimulationPassed =
  robotVacuumSuppliedInputRunnerSimulation?.conclusion?.includes("simulation_passed") === true &&
  (robotVacuumSuppliedInputRunnerSimulation?.metrics?.suppliedFixtureRows ?? 0) >= 17 &&
  (robotVacuumSuppliedInputRunnerSimulation?.metrics?.mismatches ?? 1) === 0 &&
  (robotVacuumSuppliedInputRunnerSimulation?.metrics?.stopConditionRows ?? 1) === 0 &&
  (robotVacuumSuppliedInputRunnerSimulation?.metrics?.writeTargetRows ?? 1) === 0 &&
  (robotVacuumSuppliedInputRunnerSimulation?.metrics?.failedChecks ?? 1) === 0 &&
  (robotVacuumSuppliedInputRunnerSimulation?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (robotVacuumSuppliedInputRunnerSimulation?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (robotVacuumSuppliedInputRunnerSimulation?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (robotVacuumSuppliedInputRunnerSimulation?.metrics?.runtimeApplyRows ?? 1) === 0 &&
  (robotVacuumSuppliedInputRunnerSimulation?.metrics?.liveFetchRows ?? 1) === 0 &&
  (robotVacuumSuppliedInputRunnerSimulation?.metrics?.productionDbMutationRows ?? 1) === 0 &&
  (robotVacuumSuppliedInputRunnerSimulation?.metrics?.sourceHealthMutationRows ?? 1) === 0;

const desktopBackfill = readJson<{
  metrics?: {
    positiveRows?: number;
    strictPositiveTargetMet?: boolean;
  };
}>("reports/desktop-private-used-positive-backfill-latest.json");

const desktopBackfillFailed =
  desktopBackfill?.metrics?.strictPositiveTargetMet === false;

const desktopTargeted = readJson<{
  metrics?: {
    combinedStrictPositiveRows?: number;
    targetedPositiveRows?: number;
    targetedManualRows?: number;
    targetedHoldRows?: number;
    strictPositiveTargetMet?: boolean;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
  };
}>("reports/desktop-private-used-targeted-acquisition-latest.json");

const desktopTargetedGoalMet =
  desktopTargeted?.metrics?.strictPositiveTargetMet === true &&
  (desktopTargeted.metrics.combinedStrictPositiveRows ?? 0) >= 10;

const desktopPreflight = readJson<{
  conclusion?: string;
  runtimePatchScope?: {
    readyForFutureNarrowRuntimePatch?: boolean;
    readyForRuntimeApplyNow?: boolean;
  };
  readyForFutureNarrowRuntimePatchReview?: boolean;
  readyForFutureNarrowRuntimePatch?: boolean;
  readyForRuntimeApplyNow?: boolean;
  metrics?: {
    failedChecks?: number;
    positiveFixtureRows?: number;
    manualRows?: number;
    holdRowCount?: number;
  };
  boundary?: {
    runtimeApply?: boolean;
    publicPromotion?: boolean;
    candidatePool?: boolean;
  };
}>("reports/desktop-private-used-no-mutation-preflight-latest.json");

const desktopPreflightPassed =
  (desktopPreflight?.readyForFutureNarrowRuntimePatchReview === true ||
    desktopPreflight?.readyForFutureNarrowRuntimePatch === true ||
    desktopPreflight?.runtimePatchScope?.readyForFutureNarrowRuntimePatch === true ||
    desktopPreflight?.conclusion?.includes("preflight_passed") === true) &&
  (desktopPreflight?.readyForRuntimeApplyNow === false ||
    desktopPreflight?.runtimePatchScope?.readyForRuntimeApplyNow === false) &&
  (desktopPreflight?.metrics?.failedChecks ?? 1) === 0;

const desktopRuntimeReview = readJson<{
  status?: string;
  recommendation?: string;
  runtimeGap?: {
    catalogCategoryMissing?: boolean;
    optionParserComparableKeyBranchMissing?: boolean;
    categoryReadinessMissing?: boolean;
  };
}>("reports/desktop-private-used-runtime-review-packet-latest.json");

const desktopRuntimeReviewRequiresCategoryAxisDecision =
  desktopRuntimeReview?.status === "review_required_before_runtime_patch" ||
  desktopRuntimeReview?.recommendation === "do_not_patch_runtime_until_category_axis_decision" ||
  desktopRuntimeReview?.runtimeGap?.catalogCategoryMissing === true;

const desktopCategoryAxisDryRunPlan = readJson<{
  conclusion?: string;
  dryRunPlanReady?: boolean;
  checks?: {
    failedChecks?: number;
  };
  metrics?: {
    failedChecks?: number;
    runtimeApprovedRows?: number;
    runtimeApplyRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
  };
}>("reports/desktop-category-axis-no-mutation-dry-run-plan-latest.json");

const desktopCategoryAxisPlanReady =
  desktopCategoryAxisDryRunPlan?.dryRunPlanReady === true ||
  desktopCategoryAxisDryRunPlan?.conclusion?.includes("dry_run_plan_ready") === true;

const desktopOwnerDecisionPacket = readJson<{
  status?: string;
  runtimeApproval?: boolean;
  recommendedDecisions?: {
    runtimeCategoryName?: string;
    initialReadiness?: string;
    publicPromotion?: boolean;
    candidatePoolWiring?: boolean;
  };
}>("reports/desktop-owner-decision-packet-latest.json");

const desktopOwnerDecisionPrepared =
  desktopOwnerDecisionPacket?.status === "owner_decision_packet_prepared" &&
  desktopOwnerDecisionPacket?.runtimeApproval === false;

const desktopCpuGpuSourceBackfill = readJson<{
  conclusion?: string;
  metrics?: {
    sourceEvidenceRows?: number;
    officialSourceRows?: number;
    secondarySourceRows?: number;
    marketplaceRiskRows?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/desktop-cpu-gpu-source-backfill-latest.json");

const desktopSourceBackfillReady =
  desktopCpuGpuSourceBackfill?.conclusion?.includes("source_backfill_complete") === true &&
  (desktopCpuGpuSourceBackfill?.metrics?.officialSourceRows ?? 0) >= 8 &&
  (desktopCpuGpuSourceBackfill?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (desktopCpuGpuSourceBackfill?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (desktopCpuGpuSourceBackfill?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (desktopCpuGpuSourceBackfill?.metrics?.runtimeApplyRows ?? 1) === 0;

const desktopNoMutationExecutorReadiness = readJson<{
  conclusion?: string;
  metrics?: {
    passedReadinessChecks?: number;
    blockedReadinessChecks?: number;
    blockedOwnerDecisions?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/desktop-cpu-gpu-no-mutation-executor-readiness-latest.json");

const desktopExecutorDraftableLater =
  desktopNoMutationExecutorReadiness?.conclusion?.includes("can_be_drafted_later") === true &&
  (desktopNoMutationExecutorReadiness?.metrics?.passedReadinessChecks ?? 0) >= 5 &&
  (desktopNoMutationExecutorReadiness?.metrics?.blockedOwnerDecisions ?? 0) >= 1 &&
  (desktopNoMutationExecutorReadiness?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (desktopNoMutationExecutorReadiness?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (desktopNoMutationExecutorReadiness?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (desktopNoMutationExecutorReadiness?.metrics?.runtimeApplyRows ?? 1) === 0;

const cameraTaxonomyNext = readJson<{
  conclusion?: string;
  metrics?: {
    interchangeableBodyOnlyRows?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
  recommendedSublane?: {
    lane?: string;
  };
}>("reports/camera-fixed-lens-interchangeable-taxonomy-next-latest.json");

const cameraTaxonomySplitReady =
  cameraTaxonomyNext?.conclusion?.includes("camera_taxonomy_split") === true ||
  (cameraTaxonomyNext?.metrics?.interchangeableBodyOnlyRows ?? 0) > 0;

const cameraBodyOnlyInternalObservationPlan = readJson<{
  conclusion?: string;
  metrics?: {
    executorPositiveRows?: number;
    distinctPositiveFamilies?: number;
    readyForInternalObservationPlanningOnly?: boolean;
    readyForRuntimeApplyNow?: boolean;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/camera-body-only-internal-sublane-plan-latest.json");

const cameraBodyOnlyObservationPlanReady =
  cameraBodyOnlyInternalObservationPlan?.metrics?.readyForInternalObservationPlanningOnly === true &&
  cameraBodyOnlyInternalObservationPlan?.metrics?.readyForRuntimeApplyNow === false &&
  (cameraBodyOnlyInternalObservationPlan?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (cameraBodyOnlyInternalObservationPlan?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (cameraBodyOnlyInternalObservationPlan?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (cameraBodyOnlyInternalObservationPlan?.metrics?.runtimeApplyRows ?? 1) === 0;

const cameraBodyOnlySourceBackfill = readJson<{
  conclusion?: string;
  metrics?: {
    sourceBackfilledModels?: number;
    officialSourceCount?: number;
    secondarySourceCount?: number;
    modelsMissingLaunchYear?: number;
    modelsWithStatusEvidence?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/camera-body-only-source-backfill-latest.json");

const cameraBodyOnlySourceBackfillReady =
  cameraBodyOnlySourceBackfill?.conclusion?.includes("official_evidence_complete") === true &&
  (cameraBodyOnlySourceBackfill?.metrics?.sourceBackfilledModels ?? 0) >= 7 &&
  (cameraBodyOnlySourceBackfill?.metrics?.officialSourceCount ?? 0) >= 7 &&
  (cameraBodyOnlySourceBackfill?.metrics?.modelsMissingLaunchYear ?? 1) === 0 &&
  (cameraBodyOnlySourceBackfill?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (cameraBodyOnlySourceBackfill?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (cameraBodyOnlySourceBackfill?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (cameraBodyOnlySourceBackfill?.metrics?.runtimeApplyRows ?? 1) === 0;

const cameraBodyOnlyLiveMarketObservationDesign = readJson<{
  conclusion?: string;
  internalObservationPlanningOnly?: {
    ready?: boolean;
    readyForRuntimeApplyNow?: boolean;
  };
  metrics?: {
    queryMatrixBodyModels?: number;
    plannedQueryRows?: number;
    laneTargetActiveRows?: number;
    laneHardMinimumActiveRows?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
    liveDbWriteRows?: number;
    runtimePatchProposalRows?: number;
  };
}>("reports/camera-body-only-live-market-observation-design-latest.json");

const cameraLiveObservationDesignReady =
  cameraBodyOnlyLiveMarketObservationDesign?.internalObservationPlanningOnly?.ready === true &&
  cameraBodyOnlyLiveMarketObservationDesign?.internalObservationPlanningOnly?.readyForRuntimeApplyNow === false &&
  (cameraBodyOnlyLiveMarketObservationDesign?.metrics?.plannedQueryRows ?? 0) >= 40 &&
  (cameraBodyOnlyLiveMarketObservationDesign?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (cameraBodyOnlyLiveMarketObservationDesign?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (cameraBodyOnlyLiveMarketObservationDesign?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (cameraBodyOnlyLiveMarketObservationDesign?.metrics?.runtimeApplyRows ?? 1) === 0 &&
  (cameraBodyOnlyLiveMarketObservationDesign?.metrics?.liveDbWriteRows ?? 1) === 0 &&
  (cameraBodyOnlyLiveMarketObservationDesign?.metrics?.runtimePatchProposalRows ?? 1) === 0;

const cameraNoWriteRunnerDesign = readJson<{
  conclusion?: string;
  metrics?: {
    inputPlannedQueryRows?: number;
    noWriteGuarantees?: number;
    liveDbWriteRows?: number;
    liveFetchImplementationRows?: number;
    runtimePatchProposalRows?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/camera-body-only-no-write-live-market-dry-run-runner-design-latest.json");

const cameraNoWriteRunnerDesignReady =
  cameraNoWriteRunnerDesign?.conclusion?.includes("runner_contract_ready") === true &&
  (cameraNoWriteRunnerDesign?.metrics?.inputPlannedQueryRows ?? 0) >= 40 &&
  (cameraNoWriteRunnerDesign?.metrics?.noWriteGuarantees ?? 0) >= 4 &&
  (cameraNoWriteRunnerDesign?.metrics?.liveDbWriteRows ?? 1) === 0 &&
  (cameraNoWriteRunnerDesign?.metrics?.liveFetchImplementationRows ?? 1) === 0 &&
  (cameraNoWriteRunnerDesign?.metrics?.runtimePatchProposalRows ?? 1) === 0 &&
  (cameraNoWriteRunnerDesign?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (cameraNoWriteRunnerDesign?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (cameraNoWriteRunnerDesign?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (cameraNoWriteRunnerDesign?.metrics?.runtimeApplyRows ?? 1) === 0;

const cameraNoWriteRunnerPreflight = readJson<{
  conclusion?: string;
  metrics?: {
    plannedQueryRows?: number;
    fixtureRows?: number;
    activeCandidateFixtures?: number;
    manualHoldFixtures?: number;
    hardHoldFixtures?: number;
    schemaErrorFixtures?: number;
    sourceBackfillNeededRows?: number;
    preflightAuditPasses?: number;
    preflightAuditFails?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
    liveDbWriteRows?: number;
    runtimePatchProposalRows?: number;
  };
}>("reports/camera-body-only-no-write-runner-preflight-latest.json");

const cameraNoWriteRunnerPreflightPassed =
  cameraNoWriteRunnerPreflight?.conclusion?.includes("preflight_passed") === true &&
  (cameraNoWriteRunnerPreflight?.metrics?.plannedQueryRows ?? 0) >= 40 &&
  (cameraNoWriteRunnerPreflight?.metrics?.fixtureRows ?? 0) >= 10 &&
  (cameraNoWriteRunnerPreflight?.metrics?.sourceBackfillNeededRows ?? 1) === 0 &&
  (cameraNoWriteRunnerPreflight?.metrics?.preflightAuditFails ?? 1) === 0 &&
  (cameraNoWriteRunnerPreflight?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (cameraNoWriteRunnerPreflight?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (cameraNoWriteRunnerPreflight?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (cameraNoWriteRunnerPreflight?.metrics?.runtimeApplyRows ?? 1) === 0 &&
  (cameraNoWriteRunnerPreflight?.metrics?.liveDbWriteRows ?? 1) === 0 &&
  (cameraNoWriteRunnerPreflight?.metrics?.runtimePatchProposalRows ?? 1) === 0;

const cameraSuppliedInputRunnerSimulation = readJson<{
  conclusion?: string;
  metrics?: {
    fixtureRowsConsumed?: number;
    bodyModelSummaries?: number;
    activeCandidateRows?: number;
    manualHoldRows?: number;
    hardHoldRows?: number;
    schemaErrorRows?: number;
    expectationMismatches?: number;
    stopConditionsTriggered?: number;
    writeTargetsTouched?: number;
    boundaryAuditFails?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
    liveDbWriteRows?: number;
    dbAccessRows?: number;
    runtimePatchProposalRows?: number;
  };
}>("reports/camera-body-only-supplied-input-runner-simulation-latest.json");

const cameraSuppliedInputRunnerSimulationPassed =
  cameraSuppliedInputRunnerSimulation?.conclusion?.includes("simulation_passed") === true &&
  (cameraSuppliedInputRunnerSimulation?.metrics?.fixtureRowsConsumed ?? 0) >= 14 &&
  (cameraSuppliedInputRunnerSimulation?.metrics?.expectationMismatches ?? 1) === 0 &&
  (cameraSuppliedInputRunnerSimulation?.metrics?.stopConditionsTriggered ?? 1) === 0 &&
  (cameraSuppliedInputRunnerSimulation?.metrics?.writeTargetsTouched ?? 1) === 0 &&
  (cameraSuppliedInputRunnerSimulation?.metrics?.boundaryAuditFails ?? 1) === 0 &&
  (cameraSuppliedInputRunnerSimulation?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (cameraSuppliedInputRunnerSimulation?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (cameraSuppliedInputRunnerSimulation?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (cameraSuppliedInputRunnerSimulation?.metrics?.runtimeApplyRows ?? 1) === 0 &&
  (cameraSuppliedInputRunnerSimulation?.metrics?.liveDbWriteRows ?? 1) === 0 &&
  (cameraSuppliedInputRunnerSimulation?.metrics?.dbAccessRows ?? 1) === 0 &&
  (cameraSuppliedInputRunnerSimulation?.metrics?.runtimePatchProposalRows ?? 1) === 0;

const monitorSelectedExactModelSourceConfidence = readJson<{
  conclusion?: string;
  metrics?: {
    modelRows?: number;
    safeInternalNoWriteObservationRows?: number;
    manualObservationOnlyRows?: number;
    holdRequiredRows?: number;
    sourceNotConfirmedRows?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/monitor-selected-exact-model-source-confidence-latest.json");

const monitorSourceConfidenceReady =
  monitorSelectedExactModelSourceConfidence?.conclusion?.includes("safe_for_internal_no_write_observation") === true &&
  (monitorSelectedExactModelSourceConfidence?.metrics?.safeInternalNoWriteObservationRows ?? 0) >= 5 &&
  (monitorSelectedExactModelSourceConfidence?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (monitorSelectedExactModelSourceConfidence?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (monitorSelectedExactModelSourceConfidence?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (monitorSelectedExactModelSourceConfidence?.metrics?.runtimeApplyRows ?? 1) === 0;

const monitorSelectedExactModelNoWriteRunnerPreflight = readJson<{
  conclusion?: string;
  metrics?: {
    sourceSafeRows?: number;
    sourceManualRows?: number;
    sourceHoldRows?: number;
    runnerDesignReadyRows?: number;
    preservedManualRows?: number;
    preservedHoldRows?: number;
    titleSpecConflictGuardRows?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
    dbMutationRows?: number;
    sourceHealthMutationRows?: number;
  };
}>("reports/monitor-selected-exact-model-no-write-runner-preflight-latest.json");

const monitorNoWriteRunnerPreflightReady =
  monitorSelectedExactModelNoWriteRunnerPreflight?.conclusion?.includes("preflight_ready") === true &&
  (monitorSelectedExactModelNoWriteRunnerPreflight?.metrics?.runnerDesignReadyRows ?? 0) >= 6 &&
  (monitorSelectedExactModelNoWriteRunnerPreflight?.metrics?.preservedHoldRows ?? 0) >= 3 &&
  (monitorSelectedExactModelNoWriteRunnerPreflight?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (monitorSelectedExactModelNoWriteRunnerPreflight?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (monitorSelectedExactModelNoWriteRunnerPreflight?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (monitorSelectedExactModelNoWriteRunnerPreflight?.metrics?.runtimeApplyRows ?? 1) === 0 &&
  (monitorSelectedExactModelNoWriteRunnerPreflight?.metrics?.dbMutationRows ?? 1) === 0 &&
  (monitorSelectedExactModelNoWriteRunnerPreflight?.metrics?.sourceHealthMutationRows ?? 1) === 0;

const monitorSuppliedInputRunnerSimulation = readJson<{
  conclusion?: string;
  metrics?: {
    suppliedInputRows?: number;
    acceptedObservationCandidateRows?: number;
    preservedManualRows?: number;
    preservedHoldRows?: number;
    blockedTitleSpecConflictRows?: number;
    writeTargetsTouchedCount?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
    dbMutationRows?: number;
    sourceHealthMutationRows?: number;
  };
}>("reports/monitor-selected-exact-model-supplied-input-runner-simulation-latest.json");

const monitorSuppliedInputRunnerSimulationPassed =
  monitorSuppliedInputRunnerSimulation?.conclusion?.includes("simulation_passed") === true &&
  (monitorSuppliedInputRunnerSimulation?.metrics?.acceptedObservationCandidateRows ?? 0) >= 6 &&
  (monitorSuppliedInputRunnerSimulation?.metrics?.writeTargetsTouchedCount ?? 1) === 0 &&
  (monitorSuppliedInputRunnerSimulation?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (monitorSuppliedInputRunnerSimulation?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (monitorSuppliedInputRunnerSimulation?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (monitorSuppliedInputRunnerSimulation?.metrics?.runtimeApplyRows ?? 1) === 0 &&
  (monitorSuppliedInputRunnerSimulation?.metrics?.dbMutationRows ?? 1) === 0 &&
  (monitorSuppliedInputRunnerSimulation?.metrics?.sourceHealthMutationRows ?? 1) === 0;

const speakerMarketSpecBackfill = readJson<{
  conclusion?: string;
  backfillSufficientForSelectedSubset?: boolean;
  sufficientForRuntimePatch?: boolean;
  metrics?: {
    selectedPositiveMarketRows?: number;
    selectedOfficialSpecRows?: number;
    failedChecks?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/speaker-portable-exact-model-market-spec-backfill-latest.json");

const speakerBackfillSufficient =
  speakerMarketSpecBackfill?.backfillSufficientForSelectedSubset === true ||
  speakerMarketSpecBackfill?.conclusion?.includes("backfill_sufficient") === true;

const speakerSelectedSubsetObservationPlan = readJson<{
  conclusion?: string;
  observationPlanSufficientForInternalOnly?: boolean;
  sufficientForPublicPromotion?: boolean;
  sufficientForCandidatePool?: boolean;
  sufficientForRuntimeApply?: boolean;
  metrics?: {
    models?: number;
    seedMarketRows?: number;
    officialSpecRows?: number;
    failedChecks?: number;
    runtimeApprovedRows?: number;
    runtimeApplyRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
  };
}>("reports/speaker-selected-subset-internal-observation-plan-latest.json");

const speakerObservationPlanReady =
  speakerSelectedSubsetObservationPlan?.observationPlanSufficientForInternalOnly === true &&
  speakerSelectedSubsetObservationPlan?.sufficientForPublicPromotion === false &&
  speakerSelectedSubsetObservationPlan?.sufficientForCandidatePool === false &&
  speakerSelectedSubsetObservationPlan?.sufficientForRuntimeApply === false &&
  (speakerSelectedSubsetObservationPlan?.metrics?.failedChecks ?? 1) === 0 &&
  (speakerSelectedSubsetObservationPlan?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (speakerSelectedSubsetObservationPlan?.metrics?.runtimeApplyRows ?? 1) === 0 &&
  (speakerSelectedSubsetObservationPlan?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (speakerSelectedSubsetObservationPlan?.metrics?.candidatePoolRows ?? 1) === 0;

const speakerNoWriteRunnerDesign = readJson<{
  conclusion?: string;
  metrics?: {
    selectedModels?: number;
    expectedMinimumActiveSellingRows?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/speaker-selected-subset-no-write-live-market-dry-run-runner-design-latest.json");

const speakerNoWriteRunnerDesignReady =
  speakerNoWriteRunnerDesign?.conclusion?.includes("runner_contract_design_ready") === true &&
  (speakerNoWriteRunnerDesign?.metrics?.selectedModels ?? 0) >= 5 &&
  (speakerNoWriteRunnerDesign?.metrics?.expectedMinimumActiveSellingRows ?? 0) >= 15 &&
  (speakerNoWriteRunnerDesign?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (speakerNoWriteRunnerDesign?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (speakerNoWriteRunnerDesign?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (speakerNoWriteRunnerDesign?.metrics?.runtimeApplyRows ?? 1) === 0;

const speakerRunnerFixtureSourceBackfill = readJson<{
  conclusion?: string;
  metrics?: {
    selectedModels?: number;
    officialOrTrustedSourceRows?: number;
    positiveFixtureRows?: number;
    holdFixtureRows?: number;
    exclusionMatrixRows?: number;
    publicGateClosed?: boolean;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/speaker-selected-subset-runner-fixture-source-backfill-latest.json");

const speakerRunnerFixtureSourceBackfillReady =
  speakerRunnerFixtureSourceBackfill?.conclusion?.includes("fixture_source_backfill_ready") === true &&
  (speakerRunnerFixtureSourceBackfill?.metrics?.selectedModels ?? 0) >= 5 &&
  (speakerRunnerFixtureSourceBackfill?.metrics?.officialOrTrustedSourceRows ?? 0) >= 5 &&
  (speakerRunnerFixtureSourceBackfill?.metrics?.positiveFixtureRows ?? 0) >= 5 &&
  (speakerRunnerFixtureSourceBackfill?.metrics?.holdFixtureRows ?? 0) >= 10 &&
  speakerRunnerFixtureSourceBackfill?.metrics?.publicGateClosed === true &&
  (speakerRunnerFixtureSourceBackfill?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (speakerRunnerFixtureSourceBackfill?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (speakerRunnerFixtureSourceBackfill?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (speakerRunnerFixtureSourceBackfill?.metrics?.runtimeApplyRows ?? 1) === 0;

const speakerNoWriteRunnerPreflight = readJson<{
  conclusion?: string;
  metrics?: {
    selectedModels?: number;
    suppliedPositiveFixtureRows?: number;
    suppliedHoldFixtureRows?: number;
    preservedHoldBoundaryClasses?: number;
    preflightChecks?: number;
    failedChecks?: number;
    publicGateClosed?: boolean;
    canRunSuppliedInputNoWriteRunnerLater?: boolean;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/speaker-selected-subset-no-write-runner-preflight-latest.json");

const speakerNoWriteRunnerPreflightPassed =
  speakerNoWriteRunnerPreflight?.conclusion?.includes("preflight_passed") === true &&
  (speakerNoWriteRunnerPreflight?.metrics?.selectedModels ?? 0) >= 5 &&
  (speakerNoWriteRunnerPreflight?.metrics?.suppliedPositiveFixtureRows ?? 0) >= 5 &&
  (speakerNoWriteRunnerPreflight?.metrics?.suppliedHoldFixtureRows ?? 0) >= 18 &&
  (speakerNoWriteRunnerPreflight?.metrics?.failedChecks ?? 1) === 0 &&
  speakerNoWriteRunnerPreflight?.metrics?.publicGateClosed === true &&
  speakerNoWriteRunnerPreflight?.metrics?.canRunSuppliedInputNoWriteRunnerLater === true &&
  (speakerNoWriteRunnerPreflight?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (speakerNoWriteRunnerPreflight?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (speakerNoWriteRunnerPreflight?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (speakerNoWriteRunnerPreflight?.metrics?.runtimeApplyRows ?? 1) === 0;

const speakerSuppliedInputRunnerSimulation = readJson<{
  conclusion?: string;
  metrics?: {
    suppliedRows?: number;
    simulatedPositiveRows?: number;
    simulatedHoldRows?: number;
    simulatedManualReviewRows?: number;
    expectedDecisionMismatches?: number;
    writeTargetsTouchedCount?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
    zeroRuntimeCounts?: boolean;
  };
}>("reports/speaker-selected-subset-supplied-input-runner-simulation-latest.json");

const speakerSuppliedInputRunnerSimulationPassed =
  speakerSuppliedInputRunnerSimulation?.conclusion?.includes("simulation_passed") === true &&
  (speakerSuppliedInputRunnerSimulation?.metrics?.suppliedRows ?? 0) >= 23 &&
  (speakerSuppliedInputRunnerSimulation?.metrics?.simulatedPositiveRows ?? 0) >= 5 &&
  (speakerSuppliedInputRunnerSimulation?.metrics?.expectedDecisionMismatches ?? 1) === 0 &&
  (speakerSuppliedInputRunnerSimulation?.metrics?.writeTargetsTouchedCount ?? 1) === 0 &&
  speakerSuppliedInputRunnerSimulation?.metrics?.zeroRuntimeCounts === true &&
  (speakerSuppliedInputRunnerSimulation?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (speakerSuppliedInputRunnerSimulation?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (speakerSuppliedInputRunnerSimulation?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (speakerSuppliedInputRunnerSimulation?.metrics?.runtimeApplyRows ?? 1) === 0;

const gameConsoleSwitch2OwnerDecision = readJson<{
  conclusion?: string;
  metrics?: {
    ownerDecisionRows?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/game-console-switch-2-owner-decision-packet-latest.json");

const switch2OwnerDecisionPrepared =
  gameConsoleSwitch2OwnerDecision?.conclusion?.includes("owner_decision_packet") === true;

const gameConsoleSwitch2SourceBackfill = readJson<{
  conclusion?: string;
  metrics?: {
    evidenceRows?: number;
    officialNintendoRows?: number;
    officialSupportRows?: number;
    internalPolicyFixtureRows?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/game-console-switch-2-source-backfill-latest.json");

const switch2SourceBackfillReady =
  gameConsoleSwitch2SourceBackfill?.conclusion?.includes("manual_review_internal_only") === true &&
  (gameConsoleSwitch2SourceBackfill?.metrics?.officialNintendoRows ?? 0) >= 5 &&
  (gameConsoleSwitch2SourceBackfill?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (gameConsoleSwitch2SourceBackfill?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (gameConsoleSwitch2SourceBackfill?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (gameConsoleSwitch2SourceBackfill?.metrics?.runtimeApplyRows ?? 1) === 0;

const switch2NoMutationExecutorReadiness = readJson<{
  conclusion?: string;
  metrics?: {
    canDraftNoMutationExecutorLater?: boolean;
    canRuntimeApprove?: boolean;
    draftableHoldOnlyRows?: number;
    blockedOwnerDecisionRows?: number;
    runtimeApprovedRows?: number;
    publicPromotionRows?: number;
    candidatePoolRows?: number;
    runtimeApplyRows?: number;
  };
}>("reports/game-console-switch-2-no-mutation-executor-readiness-latest.json");

const switch2ExecutorDraftableLater =
  switch2NoMutationExecutorReadiness?.metrics?.canDraftNoMutationExecutorLater === true &&
  switch2NoMutationExecutorReadiness?.metrics?.canRuntimeApprove === false &&
  (switch2NoMutationExecutorReadiness?.metrics?.draftableHoldOnlyRows ?? 0) >= 5 &&
  (switch2NoMutationExecutorReadiness?.metrics?.runtimeApprovedRows ?? 1) === 0 &&
  (switch2NoMutationExecutorReadiness?.metrics?.publicPromotionRows ?? 1) === 0 &&
  (switch2NoMutationExecutorReadiness?.metrics?.candidatePoolRows ?? 1) === 0 &&
  (switch2NoMutationExecutorReadiness?.metrics?.runtimeApplyRows ?? 1) === 0;

const candidates = ([
  {
    lane: "monitor_selected_exact_model",
    status: monitorSuppliedInputRunnerSimulationPassed
      ? "selected_exact_model_supplied_input_runner_simulation_passed"
      : monitorNoWriteRunnerPreflightReady
      ? "selected_exact_model_no_write_runner_preflight_ready"
      : monitorSourceConfidenceReady
      ? "selected_exact_model_source_confidence_ready_internal_no_write"
      : exists("reports/monitor-selected-model-runtime-dry-run-latest.json")
      ? "absorbed_internal_parser_no_public_gate_closed"
      : "missing_runtime_dry_run",
    runtimeSurface: "small",
    evidence: "strong",
    blocker: monitorSuppliedInputRunnerSimulationPassed
      ? `monitor supplied-input simulation accepted ${monitorSuppliedInputRunnerSimulation?.metrics?.acceptedObservationCandidateRows ?? 0} exact models, preserved ${monitorSuppliedInputRunnerSimulation?.metrics?.preservedManualRows ?? 0} manual and ${monitorSuppliedInputRunnerSimulation?.metrics?.preservedHoldRows ?? 0} hold rows, and blocked ${monitorSuppliedInputRunnerSimulation?.metrics?.blockedTitleSpecConflictRows ?? 0} title/spec conflict`
      : monitorNoWriteRunnerPreflightReady
      ? `${monitorSelectedExactModelNoWriteRunnerPreflight?.metrics?.runnerDesignReadyRows ?? 0} exact monitor rows are no-write runner design ready; ${monitorSelectedExactModelNoWriteRunnerPreflight?.metrics?.preservedManualRows ?? 0} manual and ${monitorSelectedExactModelNoWriteRunnerPreflight?.metrics?.preservedHoldRows ?? 0} hold rows preserved`
      : monitorSourceConfidenceReady
      ? `${monitorSelectedExactModelSourceConfidence?.metrics?.safeInternalNoWriteObservationRows ?? 0} exact monitor models are source-backed for internal no-write observation; ${monitorSelectedExactModelSourceConfidence?.metrics?.holdRequiredRows ?? 0} remain hold and public gate is closed`
      : "public/candidate-pool wiring intentionally disabled",
    nextAction: monitorSuppliedInputRunnerSimulationPassed
      ? "Monitor report-only supplied-input simulation is clean; keep generic/touch/signage and title/spec conflicts held before any real observation executor."
      : monitorNoWriteRunnerPreflightReady
      ? "Next step can be supplied-input no-write monitor runner simulation; keep generic monitors, DB writes, and public/candidate wiring closed."
      : monitorSourceConfidenceReady
      ? "Proceed only to selected exact-model internal no-write observation planning; keep generic monitor rows and public/candidate wiring closed."
      : "Observe; do not expand whole monitor category.",
    score: monitorSuppliedInputRunnerSimulationPassed ? 98 : monitorNoWriteRunnerPreflightReady ? 97 : monitorSourceConfidenceReady ? 96 : 95,
  },
  {
    lane: "camera_body_only_exact_model",
    status: cameraSuppliedInputRunnerSimulationPassed
      ? "supplied_input_no_write_runner_simulation_passed_report_only"
      : cameraNoWriteRunnerPreflightPassed
      ? "no_write_runner_preflight_passed_report_only"
      : cameraNoWriteRunnerDesignReady
      ? "no_write_live_market_dry_run_runner_contract_ready"
      : cameraLiveObservationDesignReady
      ? "live_market_observation_design_ready_no_db_or_runtime_mutation"
      : cameraBodyOnlySourceBackfillReady
      ? "source_backfill_official_evidence_complete_internal_observation_only"
      : cameraBodyOnlyObservationPlanReady
      ? "internal_observation_plan_ready_public_gate_closed"
      : cameraTaxonomySplitReady
      ? "taxonomy_split_recommends_body_only_internal_sublane"
      : exists("reports/camera-internal-runtime-route-latest.json")
      ? "internal_route_active_public_gate_closed"
      : exists("reports/camera-body-only-exact-model-no-mutation-executor-latest.json")
      ? "no_mutation_executor_passed_runtime_impact_review_next"
      : exists("reports/camera-smaller-exact-subset-latest.json")
      ? "wave3_smaller_lane_ready_for_no_mutation_executor"
      : exists("reports/camera-package-axis-no-mutation-executor-latest.json")
      ? "schema_contract_executor_ready_runtime_surface_large"
      : "schema_needed",
    runtimeSurface: cameraBodyOnlyObservationPlanReady || exists("reports/camera-smaller-exact-subset-latest.json") ? "medium" : "large",
    evidence: cameraBodyOnlySourceBackfillReady || cameraBodyOnlyObservationPlanReady || exists("reports/camera-smaller-exact-subset-latest.json") ? "strong" : "medium",
    blocker: cameraSuppliedInputRunnerSimulationPassed
      ? `supplied-input simulation passed with ${cameraSuppliedInputRunnerSimulation?.metrics?.fixtureRowsConsumed ?? 0} fixture rows, ${cameraSuppliedInputRunnerSimulation?.metrics?.activeCandidateRows ?? 0} active candidates, and ${cameraSuppliedInputRunnerSimulation?.metrics?.expectationMismatches ?? 0} mismatches`
      : cameraNoWriteRunnerPreflightPassed
      ? `no-write runner preflight passed with ${cameraNoWriteRunnerPreflight?.metrics?.fixtureRows ?? 0} fixtures, ${cameraNoWriteRunnerPreflight?.metrics?.activeCandidateFixtures ?? 0} active candidates, and ${cameraNoWriteRunnerPreflight?.metrics?.sourceBackfillNeededRows ?? 0} source gaps`
      : cameraNoWriteRunnerDesignReady
      ? `no-write runner contract ready with ${cameraNoWriteRunnerDesign?.metrics?.inputPlannedQueryRows ?? 0} planned query rows; live fetch/DB/runtime mutation remain zero`
      : cameraLiveObservationDesignReady
      ? `live-market observation design ready with ${cameraBodyOnlyLiveMarketObservationDesign?.metrics?.plannedQueryRows ?? 0} planned query rows and lane target ${cameraBodyOnlyLiveMarketObservationDesign?.metrics?.laneTargetActiveRows ?? 0} active rows; no DB/runtime mutation`
      : cameraBodyOnlySourceBackfillReady
      ? `official source backfill complete for ${cameraBodyOnlySourceBackfill?.metrics?.sourceBackfilledModels ?? 0} body-only models; runtime/public/candidate gates remain closed`
      : cameraBodyOnlyObservationPlanReady
      ? `body-only internal observation plan ready with ${cameraBodyOnlyInternalObservationPlan?.metrics?.executorPositiveRows ?? 0} positives across ${cameraBodyOnlyInternalObservationPlan?.metrics?.distinctPositiveFamilies ?? 0} families; runtime/public/candidate gates remain closed`
      : cameraTaxonomySplitReady
      ? "taxonomy split recommends body-only internal sublane; body+kit/lens/fixed-lens/accessory rows remain separate"
      : exists("reports/camera-internal-runtime-route-latest.json")
      ? "category is internal_only; needs internal market samples before readiness promotion"
      : exists("reports/camera-body-only-exact-model-no-mutation-executor-latest.json")
      ? "runtime impact review required before any camera parser/category branch"
      : exists("reports/camera-smaller-exact-subset-latest.json")
      ? "needs body-only exact-model no-mutation executor; broad camera runtime remains held"
      : "camera category union/catalog/parser/readiness/pack-open surface is broad",
    nextAction: cameraSuppliedInputRunnerSimulationPassed
      ? "Camera report-only supplied-input runner simulation is clean; next step is owner review of whether to keep collecting fixtures or design a no-live-fetch executor wrapper."
      : cameraNoWriteRunnerPreflightPassed
      ? "Next owner/main-agent step is still no-write only: implement or simulate a supplied-input runner contract if needed; no live fetch, DB write, runtime promotion, or candidate-pool wiring."
      : cameraNoWriteRunnerDesignReady
      ? "Owner/main-agent can review whether to implement a no-write dry-run runner; still no production DB writes or runtime promotion."
      : cameraLiveObservationDesignReady
      ? "Hold runtime; next step is a no-write live-market dry-run runner design or manual review of query matrix."
      : cameraBodyOnlySourceBackfillReady
      ? "Proceed only to internal live-market observation design; do not runtime-patch or public-promote camera."
      : cameraBodyOnlyObservationPlanReady
      ? "Use as internal observation plan only; collect live body-only exact-model market samples before any runtime/category patch."
      : cameraTaxonomySplitReady
      ? "Use body-only exact-model as the only future internal sublane; keep fixed-lens/body+kit/lens-only held."
      : exists("reports/camera-internal-runtime-route-latest.json")
      ? "Observe internal parsing and collect market samples; keep body+렌즈/fixed-lens/lens-only held."
      : exists("reports/camera-body-only-exact-model-no-mutation-executor-latest.json")
      ? "Create runtime impact review; do not patch camera runtime yet."
      : exists("reports/camera-smaller-exact-subset-latest.json")
      ? "Create report-only/no-mutation body-only exact-model executor before any runtime camera branch."
      : "Hold runtime patch; wait for smaller exact-model category or do camera parser impact patch separately.",
    score: cameraSuppliedInputRunnerSimulationPassed
      ? 99
      : cameraNoWriteRunnerPreflightPassed
      ? 98
      : cameraNoWriteRunnerDesignReady
      ? 97
      : cameraLiveObservationDesignReady
      ? 96
      : cameraBodyOnlySourceBackfillReady
      ? 94
      : cameraBodyOnlyObservationPlanReady
      ? 90
      : cameraTaxonomySplitReady
      ? 86
      : exists("reports/camera-internal-runtime-route-latest.json")
      ? 87
      : exists("reports/camera-body-only-exact-model-no-mutation-executor-latest.json")
      ? 86
      : exists("reports/camera-smaller-exact-subset-latest.json")
        ? 84
        : 55,
  },
  {
    lane: "speaker_portable_exact_model",
    status: speakerSuppliedInputRunnerSimulationPassed
      ? "selected_subset_supplied_input_runner_simulation_passed"
      : speakerNoWriteRunnerPreflightPassed
      ? "selected_subset_supplied_input_no_write_runner_preflight_passed"
      : speakerRunnerFixtureSourceBackfillReady
      ? "selected_subset_runner_fixture_source_backfill_ready_public_gate_closed"
      : speakerNoWriteRunnerDesignReady
      ? "selected_subset_no_write_runner_contract_ready_public_gate_closed"
      : speakerObservationPlanReady
      ? "selected_subset_internal_observation_plan_ready_public_gate_closed"
      : speakerBackfillSufficient
      ? "market_spec_backfill_sufficient_selected_subset_public_gate_closed"
      : exists("reports/speaker-internal-runtime-route-latest.json")
      ? "internal_route_active_public_gate_closed"
      : exists("reports/speaker-portable-exact-model-executor-latest.json")
      ? "contract_executor_ready_runtime_category_decision_needed"
      : exists("reports/speaker-portable-evidence-latest.json")
      ? "wave2_output_ready_for_review"
      : "wave2_running_or_pending",
    runtimeSurface: "medium",
    evidence: speakerObservationPlanReady || exists("reports/speaker-portable-evidence-latest.json") ? "medium" : "weak",
    blocker: speakerSuppliedInputRunnerSimulationPassed
      ? `speaker supplied-input simulation passed with ${speakerSuppliedInputRunnerSimulation?.metrics?.simulatedPositiveRows ?? 0} positives, ${speakerSuppliedInputRunnerSimulation?.metrics?.simulatedHoldRows ?? 0} holds, and ${speakerSuppliedInputRunnerSimulation?.metrics?.simulatedManualReviewRows ?? 0} manual-review rows`
      : speakerNoWriteRunnerPreflightPassed
      ? `speaker supplied-input no-write preflight passed with ${speakerNoWriteRunnerPreflight?.metrics?.suppliedPositiveFixtureRows ?? 0} positives and ${speakerNoWriteRunnerPreflight?.metrics?.suppliedHoldFixtureRows ?? 0} hold/manual fixtures`
      : speakerRunnerFixtureSourceBackfillReady
      ? `${speakerRunnerFixtureSourceBackfill?.metrics?.positiveFixtureRows ?? 0} source-backed positive speaker fixtures and ${speakerRunnerFixtureSourceBackfill?.metrics?.holdFixtureRows ?? 0} hold fixtures; accessory/amp/soundbar/karaoke/sold boundaries explicit`
      : speakerNoWriteRunnerDesignReady
      ? `selected JBL/LG no-write runner contract ready for ${speakerNoWriteRunnerDesign?.metrics?.selectedModels ?? 0} models; public/candidate/runtime gates remain closed`
      : speakerObservationPlanReady
      ? `selected JBL/LG subset has internal observation plan for ${speakerSelectedSubsetObservationPlan?.metrics?.models ?? 0} models with market/spec seeds; public/candidate/runtime gates remain closed`
      : speakerBackfillSufficient
      ? "selected JBL/LG portable exact-model market/spec backfill is sufficient for report-only subset; runtime/public/candidate gates remain closed"
      : exists("reports/speaker-internal-runtime-route-latest.json")
      ? "category is internal_only; needs market samples before readiness promotion"
      : exists("reports/speaker-portable-exact-model-executor-latest.json")
      ? "speaker category does not exist yet; runtime category decision required"
      : "need exact portable model evidence and non-portable exclusion",
    nextAction: speakerSuppliedInputRunnerSimulationPassed
      ? "Speaker report-only supplied-input simulation is clean; next step is rollup review, not runtime/public promotion."
      : speakerNoWriteRunnerPreflightPassed
      ? "Speaker can proceed only to supplied-input no-write runner simulation; public/runtime/candidate gates remain closed."
      : speakerRunnerFixtureSourceBackfillReady
      ? "Use as report-only runner fixture/source packet; next step can be no-write supplied-input runner preflight, not runtime/public promotion."
      : speakerNoWriteRunnerDesignReady
      ? "Owner/main-agent can review no-write dry-run runner implementation later; do not public-promote speaker."
      : speakerObservationPlanReady
      ? "Observe selected subset internally only; collect 3+ fresh live rows per model before any runtime/category decision."
      : speakerBackfillSufficient
      ? "Prepare selected-subset internal observation plan or keep as evidence; do not promote public packs."
      : exists("reports/speaker-internal-runtime-route-latest.json")
      ? "Observe internal parsing and collect market samples; keep public gate closed."
      : exists("reports/speaker-portable-exact-model-executor-latest.json")
      ? "Decide whether to add dedicated speaker category as internal_only; no public/candidate-pool wiring."
      : "Review wave2 speaker output when available.",
    score: speakerSuppliedInputRunnerSimulationPassed
      ? 96
      : speakerNoWriteRunnerPreflightPassed
      ? 95
      : speakerRunnerFixtureSourceBackfillReady
      ? 94
      : speakerNoWriteRunnerDesignReady
      ? 93
      : speakerObservationPlanReady
      ? 91
      : speakerBackfillSufficient
      ? 89
      : exists("reports/speaker-internal-runtime-route-latest.json")
      ? 88
      : exists("reports/speaker-portable-exact-model-executor-latest.json")
      ? 82
      : exists("reports/speaker-portable-evidence-latest.json")
        ? 75
        : 45,
  },
  {
    lane: "home_appliance_stick_vacuum",
    status: robotVacuumSuppliedInputRunnerSimulationPassed
      ? "robot_vacuum_model_dock_supplied_input_runner_simulation_passed"
      : robotVacuumNoWriteRunnerPreflightPassed
      ? "robot_vacuum_model_dock_supplied_input_no_write_runner_preflight_passed"
      : robotVacuumNoWriteRunnerDesignReady
      ? "robot_vacuum_model_dock_no_write_runner_design_ready"
      : robotVacuumObservationDesignReady
      ? "robot_vacuum_model_dock_internal_observation_design_ready"
      : robotVacuumSourceBackfillReady
      ? "robot_vacuum_model_dock_source_backfill_ready_internal_observation_only"
      : homeApplianceScopeRedefinitionReady
      ? "broad_stick_vacuum_paused_pivot_robot_vacuum_source_backfill_next"
      : homeApplianceTargetedWave3
      ? homeApplianceWave3GoalMet
        ? "targeted_wave3_goal_met_no_mutation_preflight_next"
        : "targeted_wave3_goal_missed_pause_or_redefine_scope"
      : homeApplianceTargetedWave2
      ? homeApplianceWave2GoalMet
        ? "targeted_wave2_goal_met_no_mutation_preflight_next"
        : "targeted_wave2_goal_not_met_continue_non_dyson_acquisition"
      : homeApplianceTargeted
      ? homeApplianceTargetedGoalMet
        ? "targeted_acquisition_goal_met_no_mutation_preflight_next"
        : "targeted_acquisition_goal_not_met_more_family_samples_required"
      : homeApplianceBackfillFailed
      ? "positive_backfill_goal_not_met_marketplace_samples_required"
      : exists("reports/home-appliance-stick-vacuum-runtime-impact-review-2026-05-12.md")
      ? "runtime_impact_review_hold_positive_backfill_required"
      : exists("reports/home-appliance-stick-vacuum-no-mutation-executor-latest.json")
      ? "no_mutation_executor_passed_positive_backfill_or_impact_review_next"
      : exists("reports/home-appliance-stick-vacuum-complete-set-contract-latest.json")
      ? "wave3_complete_set_contract_ready_owner_blocked"
      : exists("reports/home-appliance-stick-vacuum-evidence-latest.json")
      ? "wave2_output_ready_for_review"
      : "wave2_running_or_pending",
    runtimeSurface: "medium",
    evidence: exists("reports/home-appliance-stick-vacuum-no-mutation-executor-latest.json")
      ? "medium"
      : exists("reports/home-appliance-stick-vacuum-complete-set-contract-latest.json")
      ? "medium"
      : exists("reports/home-appliance-stick-vacuum-evidence-latest.json")
      ? "medium"
      : "weak",
    blocker: robotVacuumSuppliedInputRunnerSimulationPassed
      ? `robot vacuum supplied-input simulation passed with ${robotVacuumSuppliedInputRunnerSimulation?.metrics?.suppliedFixtureRows ?? 0} fixtures, ${robotVacuumSuppliedInputRunnerSimulation?.metrics?.activeCandidateInternalOnlyRows ?? 0} internal active candidates, and ${robotVacuumSuppliedInputRunnerSimulation?.metrics?.mismatches ?? 0} mismatches`
      : robotVacuumNoWriteRunnerPreflightPassed
      ? `robot vacuum supplied-input preflight passed with ${robotVacuumNoWriteRunnerPreflight?.metrics?.suppliedFixtureRows ?? 0} fixtures, ${robotVacuumNoWriteRunnerPreflight?.metrics?.positiveExpectedOutputs ?? 0} positives, and ${robotVacuumNoWriteRunnerPreflight?.metrics?.negativeExpectedOutputs ?? 0} negatives`
      : robotVacuumNoWriteRunnerDesignReady
      ? `robot vacuum model+dock no-write runner design ready for ${robotVacuumNoWriteRunnerDesign?.metrics?.models ?? 0} models with ${robotVacuumNoWriteRunnerDesign?.metrics?.candidateFixtureRows ?? 0} candidate fixtures and ${robotVacuumNoWriteRunnerDesign?.metrics?.negativeHoldRows ?? 0} negative holds`
      : robotVacuumObservationDesignReady
      ? `robot vacuum model+dock internal observation design ready for ${robotVacuumInternalObservationDesign?.metrics?.models ?? 0} models and ${robotVacuumInternalObservationDesign?.metrics?.totalQueryVariants ?? 0} query variants`
      : robotVacuumSourceBackfillReady
      ? `robot vacuum model+dock source backfill ready with ${homeApplianceRobotVacuumSourceBackfill?.metrics?.modelEvidenceRows ?? 0} model evidence rows and ${homeApplianceRobotVacuumSourceBackfill?.metrics?.boundaryRows ?? 0} boundary rows; broad stick-vacuum remains paused`
      : homeApplianceScopeRedefinitionReady
      ? `broad stick-vacuum paused after source review; next cleaner lane is ${homeApplianceScopeRedefinitionSourceBackfill?.recommendedNextLane} with ${homeApplianceScopeRedefinitionSourceBackfill?.metrics?.sourceEvidenceRows ?? 0} source rows`
      : homeApplianceTargetedWave3
      ? homeApplianceWave3GoalMet
        ? "wave3 met non-Dyson/non-LG target; still report-only and public gate closed"
        : `wave3 produced ${homeApplianceTargetedWave3.metrics?.positiveRows ?? 0} positives, ${homeApplianceTargetedWave3.metrics?.manualRows ?? 0} manual, ${homeApplianceTargetedWave3.metrics?.holdRows ?? 0} hold; robot/wet-dry/mop/sold-only contamination dominates`
      : homeApplianceTargetedWave2
      ? homeApplianceWave2GoalMet
        ? "wave2 plus prior acquisition met positive/family target; still report-only and public gate closed"
        : `wave2 still short: combined ${homeApplianceCombinedPositiveRows} positive rows, family score ${homeApplianceCombinedFamilyGroups}; Samsung/Dreame/Roborock evidence remains weak`
      : homeApplianceTargeted
      ? homeApplianceTargetedGoalMet
        ? "targeted acquisition met strict positive/family target; still report-only and public gate closed"
        : `targeted acquisition not enough: ${homeApplianceTargeted.metrics?.candidatePositiveContractOnlyRows ?? 0} positive rows across ${homeApplianceTargeted.metrics?.positiveFamilyGroups ?? 0} family groups`
      : homeApplianceBackfillFailed
      ? `strict positive backfill failed: ${homeApplianceBackfill?.metrics?.positiveRows ?? 0} positive rows across ${homeApplianceBackfill?.metrics?.positiveFamilyGroups ?? 0} family groups`
      : exists("reports/home-appliance-stick-vacuum-runtime-impact-review-2026-05-12.md")
      ? "impact review rejected runtime wiring for now; only 2 positive complete-set rows"
      : exists("reports/home-appliance-stick-vacuum-no-mutation-executor-latest.json")
      ? "executor passed but only 2 positive complete-set rows; LG A9/robot/logistics decisions remain"
      : exists("reports/home-appliance-stick-vacuum-complete-set-contract-latest.json")
      ? "only 2 positive complete-set rows; Dyson V10/V8 and LG A9/robot/logistics decisions remain"
      : "logistics, dock/base-station, robot/bedding/wet-dry split",
    nextAction: robotVacuumSuppliedInputRunnerSimulationPassed
      ? "Robot vacuum report-only supplied-input simulation is clean; broad stick-vacuum remains paused and next step is rollup review."
      : robotVacuumNoWriteRunnerPreflightPassed
      ? "Robot vacuum can proceed only to supplied-input no-write runner simulation; broad stick-vacuum remains paused and runtime/public/DB gates stay closed."
      : robotVacuumNoWriteRunnerDesignReady
      ? "Use as report-only no-write runner design; future executor must consume supplied rows only and keep broad stick-vacuum paused."
      : robotVacuumObservationDesignReady
      ? "Create no-write robot vacuum dry-run runner design only; keep broad stick-vacuum paused."
      : robotVacuumSourceBackfillReady
      ? "Create robot_vacuum_model_dock internal observation design only; do not reopen broad stick-vacuum."
      : homeApplianceScopeRedefinitionReady
      ? "Do not continue broad stick-vacuum; start robot_vacuum_model_dock source backfill as a separate report-only lane."
      : homeApplianceTargetedWave3
      ? homeApplianceWave3GoalMet
        ? "Create report-only no-mutation preflight; keep category internal_only and candidate-pool wiring closed."
        : "Pause broad stick-vacuum runtime path; create scope-redefinition packet or pivot to a cleaner device class."
      : homeApplianceTargetedWave2
      ? homeApplianceWave2GoalMet
        ? "Create report-only no-mutation preflight; keep category internal_only and candidate-pool wiring closed."
        : "Continue non-Dyson targeted acquisition, especially Samsung Bespoke Jet complete-set and Dreame/Roborock/Xiaomi handstick rows; keep robot/wet-dry/accessory rows held."
      : homeApplianceTargeted
      ? homeApplianceTargetedGoalMet
        ? "Create report-only no-mutation preflight; keep category internal_only and candidate-pool wiring closed."
        : "Continue targeted marketplace acquisition outside Dyson V10/V11; prioritize LG A9/A9S, Samsung Bespoke Jet, Dreame/Roborock handstick complete-set rows."
      : homeApplianceBackfillFailed
      ? "Do not runtime-patch; collect additional marketplace samples and decide LG A9/A9S + stand/dock complete-set semantics."
      : exists("reports/home-appliance-stick-vacuum-runtime-impact-review-2026-05-12.md")
      ? "Backfill 8-12 positive exact complete-set rows across 3+ model families before any runtime patch."
      : exists("reports/home-appliance-stick-vacuum-no-mutation-executor-latest.json")
      ? "Create runtime impact review only if keeping home appliance internal_only; otherwise backfill more exact complete-set positives first."
      : exists("reports/home-appliance-stick-vacuum-complete-set-contract-latest.json")
      ? "Backfill more positive complete-set rows or create no-mutation executor only if keeping category internal."
      : "Review wave2 vacuum output when available.",
    score: robotVacuumSuppliedInputRunnerSimulationPassed
      ? 95
      : robotVacuumNoWriteRunnerPreflightPassed
      ? 94
      : robotVacuumNoWriteRunnerDesignReady
      ? 92
      : robotVacuumObservationDesignReady
      ? 86
      : robotVacuumSourceBackfillReady
      ? 82
      : homeApplianceScopeRedefinitionReady
      ? 72
      : homeApplianceTargetedWave3
      ? homeApplianceWave3GoalMet
        ? 80
        : 34
      : homeApplianceTargetedWave2
      ? homeApplianceWave2GoalMet
        ? 79
        : 54
      : homeApplianceTargeted
      ? homeApplianceTargetedGoalMet
        ? 78
        : 46
      : homeApplianceBackfillFailed
      ? 41
      : exists("reports/home-appliance-stick-vacuum-runtime-impact-review-2026-05-12.md")
      ? 63
      : exists("reports/home-appliance-stick-vacuum-no-mutation-executor-latest.json")
      ? 76
      : exists("reports/home-appliance-stick-vacuum-complete-set-contract-latest.json")
      ? 72
      : exists("reports/home-appliance-stick-vacuum-evidence-latest.json")
        ? 70
        : 40,
  },
  {
    lane: "desktop_private_used_cpu_gpu",
    status: desktopExecutorDraftableLater
      ? "no_mutation_executor_draftable_later_owner_decisions_block_runtime"
      : desktopSourceBackfillReady
      ? "source_backfill_complete_owner_decision_evidence_runtime_approval_required"
      : desktopOwnerDecisionPrepared
      ? "owner_decision_packet_prepared_runtime_approval_required"
      : desktopCategoryAxisPlanReady
      ? "category_axis_dry_run_plan_ready_owner_decision"
      : desktopRuntimeReviewRequiresCategoryAxisDecision
      ? "runtime_review_blocked_category_axis_decision"
      : desktopPreflight
      ? desktopPreflightPassed
        ? "no_mutation_preflight_passed_future_narrow_runtime_review"
        : "no_mutation_preflight_failed_or_requires_review"
      : desktopTargeted
      ? desktopTargetedGoalMet
        ? "targeted_acquisition_goal_met_no_mutation_preflight_next"
        : "targeted_acquisition_goal_not_met_policy_samples_required"
      : desktopBackfillFailed
      ? "positive_backfill_goal_not_met_policy_samples_required"
      : exists("reports/desktop-private-used-runtime-impact-review-2026-05-12.md")
      ? "runtime_impact_review_hold_policy_backfill_required"
      : exists("reports/desktop-private-used-cpu-gpu-contract-latest.json")
      ? "wave3_private_used_contract_owner_decisions_blocked"
      : exists("reports/desktop-shop-template-split-latest.json")
      ? "wave2_shop_template_split_ready_for_review"
      : "wave2_running_or_pending",
    runtimeSurface: "large",
    evidence: exists("reports/desktop-private-used-cpu-gpu-contract-latest.json")
      ? "medium"
      : exists("reports/desktop-shop-template-split-latest.json")
      ? "medium"
      : "weak",
    blocker: desktopExecutorDraftableLater
      ? `executor draft is possible later, but ${desktopNoMutationExecutorReadiness?.metrics?.blockedOwnerDecisions ?? 0} owner decisions and ${desktopNoMutationExecutorReadiness?.metrics?.blockedReadinessChecks ?? 0} blocked readiness checks still prevent runtime approval`
      : desktopSourceBackfillReady
      ? `CPU/GPU source evidence complete with ${desktopCpuGpuSourceBackfill?.metrics?.officialSourceRows ?? 0} official rows and ${desktopCpuGpuSourceBackfill?.metrics?.secondarySourceRows ?? 0} secondary rows; runtime category approval still required`
      : desktopOwnerDecisionPrepared
      ? "owner decision defaults are prepared, but runtime approval and no-mutation executor are still required"
      : desktopCategoryAxisPlanReady
      ? "dry-run plan is ready, but owner decisions remain for category name, readiness, comparable key, CPU/GPU normalization, and bundle policy"
      : desktopRuntimeReviewRequiresCategoryAxisDecision
      ? "runtime has no desktop category axis yet; category name/readiness/comparable-key decision required before patch"
      : desktopPreflight
      ? desktopPreflightPassed
        ? `preflight passed with ${desktopPreflight.metrics?.positiveFixtureRows ?? 0} positives; runtime apply is still false and requires main-agent patch review`
        : `preflight did not pass cleanly: failed checks ${desktopPreflight.metrics?.failedChecks ?? "unknown"}`
      : desktopTargeted
      ? desktopTargetedGoalMet
        ? `targeted acquisition reached ${desktopTargeted.metrics?.combinedStrictPositiveRows ?? 0} cumulative strict positives; still report-only and no runtime/public wiring`
        : `targeted acquisition still below target: ${desktopTargeted.metrics?.combinedStrictPositiveRows ?? 0} cumulative strict positives`
      : desktopBackfillFailed
      ? `strict positive backfill failed: ${desktopBackfill?.metrics?.positiveRows ?? 0} positive rows; description-backed CPU and bare GPU policy unresolved`
      : exists("reports/desktop-private-used-runtime-impact-review-2026-05-12.md")
      ? "impact review rejected runtime wiring; CPU/GPU/listing-type owner decisions and positive backfill required"
      : exists("reports/desktop-private-used-cpu-gpu-contract-latest.json")
      ? "CPU normal forms, description-backed CPU, bare GPU tokens, shop/configurable lane decisions"
      : "shop/configurable templates must be split before CPU/GPU runtime",
    nextAction: desktopExecutorDraftableLater
      ? "If owner approves later, draft no-mutation executor only; keep desktop internal-only and no public/candidate wiring."
      : desktopSourceBackfillReady
      ? "Keep desktop internal-only; if approved later, create no-mutation executor before any runtime/category patch."
      : desktopOwnerDecisionPrepared
      ? "Do not runtime-patch until explicitly approved; if approved later, create no-mutation executor first."
      : desktopCategoryAxisPlanReady
      ? "Wait for owner/main-agent decision packet before runtime patch; keep public/candidate-pool wiring closed."
      : desktopRuntimeReviewRequiresCategoryAxisDecision
      ? "Do not patch runtime yet; decide desktop vs desktop_pc category axis and create no-mutation dry-run first."
      : desktopPreflight
      ? desktopPreflightPassed
        ? "Main-agent may review a narrow runtime patch proposal, but must keep public/candidate-pool wiring closed and preserve manual/hold exclusions."
        : "Review failed preflight before any runtime patch."
      : desktopTargeted
      ? desktopTargetedGoalMet
        ? "Create report-only no-mutation preflight for private-used title-visible CPU+RTX/RX desktop full-unit lane; keep public/candidate-pool wiring closed."
        : "Continue targeted CPU+RTX/RX private-used acquisition before executor."
      : desktopBackfillFailed
      ? "Do not runtime-patch; mine more private-used full-unit samples or decide whether a 5-row preflight is acceptable."
      : exists("reports/desktop-private-used-runtime-impact-review-2026-05-12.md")
      ? "Backfill 10-15 private-used positives and shop/GPU-only negatives before no-mutation executor."
      : exists("reports/desktop-private-used-cpu-gpu-contract-latest.json")
      ? "Hold runtime; backfill more private-used title-visible CPU+RTX/RX positives before executor."
      : "Review wave2 desktop output when available; do not runtime-patch CPU/GPU yet.",
    score: desktopExecutorDraftableLater
      ? 60
      : desktopSourceBackfillReady
      ? 57
      : desktopOwnerDecisionPrepared
      ? 51
      : desktopCategoryAxisPlanReady
      ? 53
      : desktopRuntimeReviewRequiresCategoryAxisDecision
      ? 52
      : desktopPreflight
      ? desktopPreflightPassed
        ? 89
        : 44
      : desktopTargeted
      ? desktopTargetedGoalMet
        ? 83
        : 43
      : desktopBackfillFailed
      ? 42
      : exists("reports/desktop-private-used-runtime-impact-review-2026-05-12.md")
      ? 48
      : exists("reports/desktop-private-used-cpu-gpu-contract-latest.json")
      ? 58
      : exists("reports/desktop-shop-template-split-latest.json")
        ? 60
        : 35,
  },
  {
    lane: "game_console_switch_2_manual_review_gate",
    status: switch2ExecutorDraftableLater
      ? "switch2_no_mutation_executor_draftable_later_manual_hold_only"
      : switch2SourceBackfillReady
      ? "switch2_source_backfill_complete_manual_review_internal_only"
      : switch2OwnerDecisionPrepared
      ? "switch2_owner_decision_packet_prepared_runtime_hold"
      : "owner_decision_packet_missing",
    runtimeSurface: "medium",
    evidence: "medium",
    blocker: switch2ExecutorDraftableLater
      ? `Switch 2 executor can be drafted later for ${switch2NoMutationExecutorReadiness?.metrics?.draftableHoldOnlyRows ?? 0} hold-only assertions, but body/full-set owner decisions still block runtime approval`
      : switch2SourceBackfillReady
      ? `Switch 2 official/support evidence backfilled with ${gameConsoleSwitch2SourceBackfill?.metrics?.evidenceRows ?? 0} evidence rows; marketplace sold/buying/damaged remain policy boundaries`
      : switch2OwnerDecisionPrepared
      ? `Switch 2 owner-decision packet prepared with ${gameConsoleSwitch2OwnerDecision?.metrics?.ownerDecisionRows ?? 0} owner decisions; runtime still held`
      : "Switch 2 manual-review gate still needs owner-decision packet",
    nextAction: switch2ExecutorDraftableLater
      ? "Do not runtime-approve; wait for owner decision on body/full-set before any positive executor."
      : switch2SourceBackfillReady
      ? "Keep Switch 2 internal/manual-review; do not runtime-patch until owner approves body/bundle/accessory policy."
      : switch2OwnerDecisionPrepared
      ? "Wait for owner decision before any game-console runtime patch; keep accessories/software/sold-only/buying/damaged rows held."
      : "Prepare Switch 2 owner-decision packet before runtime work.",
    score: switch2ExecutorDraftableLater ? 52 : switch2SourceBackfillReady ? 48 : switch2OwnerDecisionPrepared ? 43 : 31,
  },
  {
    lane: "headphone_airpods_max_owner_review",
    status: "known_policy_tension_backlog",
    runtimeSurface: "small",
    evidence: "medium",
    blocker: "AirPods Max color-only and 8-pin owner policy decision",
    nextAction: "Do not let this block broader category progress.",
    score: 30,
  },
] satisfies Candidate[]).sort((a, b) => b.score - a.score);

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  scope: "category orchestration status board",
  candidates,
  runtimePatchReadyCandidates: candidates.filter((row) =>
    row.status.includes("runtime_impact_review_next") ||
    row.status.includes("ready_for_no_mutation_executor"),
  ),
  sampleBackfillRequiredCandidates: candidates.filter((row) =>
    row.status.includes("backfill") ||
    row.status.includes("marketplace_samples_required"),
  ),
  recommendedNext:
    candidates.find((row) => row.status.includes("runtime_impact_review_next")) ??
    candidates.find((row) => row.status.includes("ready_for_no_mutation_executor")) ??
    candidates.find((row) => row.status.includes("marketplace_samples_required")) ??
    candidates.find((row) => !row.status.startsWith("absorbed") && !row.nextAction.toLowerCase().startsWith("observe")) ??
    candidates[0],
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "category-orchestration-status-latest.json");
const mdPath = path.join(reportsDir, "category-orchestration-status-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Category Orchestration Status",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- recommendedNext: ${report.recommendedNext.lane}`,
  `- runtimePatchReadyCandidates: ${report.runtimePatchReadyCandidates.length}`,
  `- sampleBackfillRequiredCandidates: ${report.sampleBackfillRequiredCandidates.length}`,
  "",
  "## Boundary",
  "",
  "- reportOnly: true",
  "- publicPromotion: false",
  "- runtimeCatalogApply: false",
  "- candidatePoolPolicyWiring: false",
  "- productionDbMutation: false",
  "",
  "## Candidates",
  "",
  "| lane | status | surface | evidence | score | blocker | nextAction |",
  "| --- | --- | --- | --- | ---: | --- | --- |",
  ...candidates.map((row) => `| ${row.lane} | ${row.status} | ${row.runtimeSurface} | ${row.evidence} | ${row.score} | ${row.blocker} | ${row.nextAction} |`),
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(JSON.stringify({
  recommendedNext: report.recommendedNext.lane,
  candidates: candidates.length,
  jsonPath,
  mdPath,
}, null, 2));
