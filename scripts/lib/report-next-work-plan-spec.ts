import {
  findRegistryGroupKeyForDiscoveredCategory,
  normalizeDiscoveredCategoryToRegistryCategory,
} from "./report-category-key-spec";
import { findRegistryPacketGroupByKey, type RegistryPacketPhase } from "./report-packet-registry";

export type NextWorkPlanEntry = {
  priority: number;
  workType: "candidate_precheck" | "hold_diagnosis" | "suite_integrity";
  nextReportOnlyTask: string;
  completedReport: string;
  followupReportOnlyTask: string;
  followupCompletedReport: string;
  nextAfterFollowupTask: string;
  readinessCompletedReport: string;
  nextAfterReadinessTask: string;
  postReadinessCompletedReport: string;
  nextAfterPostReadinessTask: string;
  evidenceCompletedReport?: string;
  nextAfterEvidenceTask?: string;
  stopCondition: string;
};

type NextWorkPlanStage = {
  task: string;
  completedReport: string;
  nextTask: string;
};

type NextWorkPlanBlueprint = {
  priority: number;
  workType: "candidate_precheck" | "hold_diagnosis" | "suite_integrity";
  initialTask: string;
  followup: NextWorkPlanStage;
  readiness: NextWorkPlanStage;
  postReadiness: NextWorkPlanStage;
  evidence?: NextWorkPlanStage;
  stopCondition: string;
};

type NextWorkPlanBuilderInput = Omit<NextWorkPlanBlueprint, "workType">;

export type ResolvedNextWorkPlanEntry = NextWorkPlanEntry & {
  category: string;
  registryCategory: string;
  registryGroupKey: string | null;
  registryFamily: string | null;
  registryPhase: RegistryPacketPhase | null;
  registryTags: string[];
};

function buildNextWorkPlanEntry(blueprint: NextWorkPlanBlueprint): NextWorkPlanEntry {
  return {
    priority: blueprint.priority,
    workType: blueprint.workType,
    nextReportOnlyTask: blueprint.initialTask,
    completedReport: blueprint.followup.completedReport,
    followupReportOnlyTask: blueprint.followup.task,
    followupCompletedReport: blueprint.followup.completedReport,
    nextAfterFollowupTask: blueprint.followup.nextTask,
    readinessCompletedReport: blueprint.readiness.completedReport,
    nextAfterReadinessTask: blueprint.readiness.nextTask,
    postReadinessCompletedReport: blueprint.postReadiness.completedReport,
    nextAfterPostReadinessTask: blueprint.postReadiness.nextTask,
    evidenceCompletedReport: blueprint.evidence?.completedReport,
    nextAfterEvidenceTask: blueprint.evidence?.nextTask,
    stopCondition: blueprint.stopCondition,
  };
}

function stage(task: string, completedReport: string, nextTask: string): NextWorkPlanStage {
  return { task, completedReport, nextTask };
}

function passiveStage(completedReport: string, nextTask: string): NextWorkPlanStage {
  return stage("", completedReport, nextTask);
}

function candidatePrecheckBlueprint(input: NextWorkPlanBuilderInput): NextWorkPlanBlueprint {
  return {
    ...input,
    workType: "candidate_precheck",
  };
}

function holdDiagnosisBlueprint(input: NextWorkPlanBuilderInput): NextWorkPlanBlueprint {
  return {
    ...input,
    workType: "hold_diagnosis",
  };
}

const stopConditions = {
  runtimeOrCandidatePool: "runtime catalog apply 또는 candidate pool wiring 필요 시 즉시 중단",
  desktopRuntimeKey: "RAM/SSD/warranty runtime key 설계가 필요해지면 중단",
  gameConsoleEdition: "Switch 2 또는 PS5 edition runtime rule 적용 필요 시 중단",
  cameraRuntimeCategory: "camera runtime category/parser 설계 필요 시 중단",
  speakerRuntimeSplit: "speaker/audio runtime category split 필요 시 중단",
  bulkyApplianceLogistics: "bulky appliance logistics policy wiring 필요 시 중단",
} as const;

const nextWorkPriorityBlueprints: Record<string, NextWorkPlanBlueprint> = {
  monitor_discovered: candidatePrecheckBlueprint({
    priority: 1,
    initialTask: "model-code rows에서 generic/critical_unknown 원인을 더 쪼개고, model-code hint test 후보를 목록화",
    followup: stage(
      "model-code hint 후보의 false-positive review list를 report-only로 분리",
      "monitor-model-code-deep-dive-latest.md",
      "confirmed model-code hint가 생기면 test-candidate-only report 작성; wiring은 main approval 전 금지",
    ),
    readiness: passiveStage(
      "monitor-test-candidate-readiness-latest.md",
      "manual confirmation 없이는 monitor test candidate 0 유지; accessory/parts exclusion examples 확장만 가능",
    ),
    postReadiness: passiveStage(
      "monitor-exclusion-readiness-latest.md",
      "monitor는 manual confirmation 전 positive test candidate 0 유지; 추가 작업은 false-positive/exclusion evidence 보강만 가능",
    ),
    evidence: passiveStage(
      "monitor-pending-model-spec-evidence-latest.md",
      "monitor는 외부 스펙으로 resolution 2건/refresh 1건만 report-only 확인; confirmed test candidate 0 유지",
    ),
    stopCondition: stopConditions.runtimeOrCandidatePool,
  }),
  desktop_pc_discovered: candidatePrecheckBlueprint({
    priority: 2,
    initialTask: "CPU/GPU full-unit rows 중 unknown-cpu/unknown-gpu/generic gaming desktop examples를 별도 review list로 분리",
    followup: stage(
      "unknown CPU/GPU rows를 brand/series/token class별 review list로 더 세분화",
      "desktop-partial-key-deep-dive-latest.md",
      "reviewable CPU/GPU token rows를 test-candidate-only report로 묶되 RAM/SSD/warranty runtime 설계 금지",
    ),
    readiness: passiveStage(
      "desktop-test-candidate-readiness-latest.md",
      "desktop GPU-only/commercial exclusion-test candidates를 별도 report-only로 확장",
    ),
    postReadiness: passiveStage(
      "desktop-exclusion-readiness-latest.md",
      "desktop은 RAM/SSD/warranty/runtime key 설계 없이 exclusion evidence 보강만 가능",
    ),
    evidence: passiveStage(
      "desktop-cpu-gpu-title-token-boundary-evidence-latest.md",
      "desktop은 title token 4건 모두 current key unresolved/generic 상태 유지; parser 개선 후보 evidence만 유지",
    ),
    stopCondition: stopConditions.desktopRuntimeKey,
  }),
  game_console_body_narrow: candidatePrecheckBlueprint({
    priority: 3,
    initialTask: "strict parser_ready 57.5%를 막는 reasonCounts(bundle_risk/unknown edition/body)를 examples 중심으로 분리",
    followup: stage(
      "Switch/PS5 edition hold examples를 edition-token review list로 분리",
      "game-console-strict-parser-deep-dive-latest.md",
      "bundle/game-title/accessory exclusion examples를 body_narrow test-candidate-only report로 정리",
    ),
    readiness: passiveStage(
      "game-console-exclusion-readiness-latest.md",
      "body_narrow positive examples와 exclusion examples의 coverage matrix 작성",
    ),
    postReadiness: passiveStage(
      "game-console-coverage-matrix-latest.md",
      "game_console_body_narrow는 coverage matrix 유지; Switch 2/edition runtime rule이 필요하면 중단",
    ),
    evidence: passiveStage(
      "game-console-body-edition-boundary-evidence-latest.md",
      "game_console_body_narrow는 positive 86 units와 review-gated 28 units를 분리 유지; Switch2/PS5 runtime rule 금지",
    ),
    stopCondition: stopConditions.gameConsoleEdition,
  }),
  smartwatch_discovered: holdDiagnosisBlueprint({
    priority: 4,
    initialTask: "strap/accessory suspect rows를 normal rows와 더 분리하고 Apple Watch explicit generation full-set positives와 connectivity wording evidence를 함께 두껍게 확장",
    followup: stage(
      "Apple Watch SE/Series explicit generation positives와 generation ambiguity review rows를 report-only packet으로 더 분리",
      "smartwatch-ambiguity-evidence-matrix-latest.md",
      "unknown network/size rows를 SKU family별로 묶고 cellular-ready/gps-only/pairing-reset wording packet과 같이 normal-only review packet으로 재정리",
    ),
    readiness: passiveStage(
      "smartwatch-connectivity-size-evidence-latest.md",
      "connectivity/model boundary rows와 strap suspects를 합쳐 family-level review matrix 유지",
    ),
    postReadiness: passiveStage(
      "smartwatch-connectivity-model-boundary-evidence-latest.md",
      "smartwatch는 Apple Watch generation explicitness, narrow priority positive buckets, connectivity wording evidence, strap/accessory suspects, unknown connectivity review를 계속 보강하되 family 추정만으로 promotion 금지",
    ),
    evidence: passiveStage(
      "smartwatch-strap-accessory-evidence-latest.md",
      "smartwatch는 strap/accessory boundary와 explicit full-set positives packet을 유지한 채 Apple Watch connectivity wording packet과 narrow priority positive buckets, unknown connectivity review를 계속 두껍게 보강",
    ),
    stopCondition: stopConditions.runtimeOrCandidatePool,
  }),
  camera_discovered: holdDiagnosisBlueprint({
    priority: 5,
    initialTask: "unknown_package camera examples를 known model vs unknown model, fixed-lens vs interchangeable로 분리",
    followup: stage(
      "fixed-lens compact coverage 후보와 accessory contamination examples를 별도 report-only list로 분리",
      "camera-package-deep-dive-latest.md",
      "known_interchangeable_unknown_package rows의 body/kit/full-box signal review report 작성",
    ),
    readiness: passiveStage(
      "camera-interchangeable-package-review-latest.md",
      "camera full-box vs true lens-kit false-merge risk matrix 작성",
    ),
    postReadiness: passiveStage(
      "camera-false-merge-risk-matrix-latest.md",
      "camera는 package false-merge evidence 보강만 가능; runtime category/parser 설계는 main 이후",
    ),
    evidence: passiveStage(
      "camera-package-title-token-boundary-evidence-latest.md",
      "camera는 lens identity 1행/reference-only와 missing/full-box/accessory/body-only hold를 분리 유지; package recovery 금지",
    ),
    stopCondition: stopConditions.cameraRuntimeCategory,
  }),
  speaker_audio_discovered: holdDiagnosisBlueprint({
    priority: 6,
    initialTask: "Marshall/JBL/Britz/Marantz rows를 model-coded vs family-only로 분리하는 report-only subset 생성",
    followup: stage(
      "amp_receiver/pa_speaker rows를 portable speaker rows와 분리한 hold examples report 작성",
      "speaker-family-deep-dive-latest.md",
      "generic speaker hold examples를 exclusion-test-candidate-only report로 분리",
    ),
    readiness: passiveStage(
      "speaker-generic-exclusion-readiness-latest.md",
      "speaker portable model-coded subset conditions matrix 작성",
    ),
    postReadiness: passiveStage(
      "speaker-portable-conditions-matrix-latest.md",
      "speaker는 portable subset/generic exclusion overlap evidence 보강만 가능; category split wiring 금지",
    ),
    evidence: passiveStage(
      "speaker-portable-model-subset-boundary-evidence-latest.md",
      "speaker는 portable exact-model 16 units를 reference-only로 유지; unknown variant/amp/PA boundary 때문에 wiring 검토 금지",
    ),
    stopCondition: stopConditions.speakerRuntimeSplit,
  }),
  home_appliance_tech_discovered: holdDiagnosisBlueprint({
    priority: 7,
    initialTask: "robot vacuum model-coded subset과 generic vacuum/logistics-risk rows를 분리",
    followup: stage(
      "row-level logistics_risk examples와 generic vacuum subtype examples를 report-only로 추가 export",
      "home-appliance-deep-dive-latest.md",
      "source가 logistics row를 노출할 때 logistics_risk examples export; 그 전에는 model-ready vacuum subset test-candidate-only report",
    ),
    readiness: passiveStage(
      "home-appliance-vacuum-test-candidate-readiness-latest.md",
      "home appliance generic vacuum exclusion-test candidates 확장; logistics row-level은 source 노출 전 보류",
    ),
    postReadiness: passiveStage(
      "home-appliance-generic-vacuum-exclusion-readiness-latest.md",
      "home appliance는 generic vacuum exclusion evidence 유지; logistics row-level source가 없으면 logistics examples export 보류",
    ),
    evidence: passiveStage(
      "home-appliance-vacuum-model-subtype-boundary-evidence-latest.md",
      "home appliance는 stick/handheld 5 units와 robot 1 unit을 분리 유지; logistics row-level source 전까지 추가 export 보류",
    ),
    stopCondition: stopConditions.bulkyApplianceLogistics,
  }),
};

export const nextWorkPriorityPlan: Record<string, NextWorkPlanEntry> = Object.fromEntries(
  Object.entries(nextWorkPriorityBlueprints).map(([category, blueprint]) => [category, buildNextWorkPlanEntry(blueprint)]),
) as Record<string, NextWorkPlanEntry>;

export function resolveNextWorkPlanEntryForCategory(category: string): ResolvedNextWorkPlanEntry | null {
  const plan = nextWorkPriorityPlan[category];
  if (!plan) return null;
  const registryGroupKey = findRegistryGroupKeyForDiscoveredCategory(category);
  const registryGroup = registryGroupKey ? findRegistryPacketGroupByKey(registryGroupKey) : null;
  return {
    category,
    registryCategory: normalizeDiscoveredCategoryToRegistryCategory(category),
    registryGroupKey,
    registryFamily: registryGroup?.family ?? null,
    registryPhase: registryGroup?.phase ?? null,
    registryTags: registryGroup?.tags ?? [],
    ...plan,
  };
}

export function compileNextWorkPlanEntries(): ResolvedNextWorkPlanEntry[] {
  return Object.keys(nextWorkPriorityPlan)
    .map((category) => resolveNextWorkPlanEntryForCategory(category))
    .filter((entry): entry is ResolvedNextWorkPlanEntry => entry !== null)
    .sort((a, b) => a.priority - b.priority);
}
