import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonObject = Record<string, unknown>;

type ArtifactGroup =
  | "desktop_runtime_review_packet"
  | "desktop_category_axis_dry_run_plan"
  | "desktop_owner_decision_packet"
  | "desktop_cpu_gpu_source_backfill"
  | "desktop_cpu_gpu_no_mutation_executor_readiness"
  | "home_appliance_wave1"
  | "home_appliance_wave2"
  | "home_appliance_wave3"
  | "home_appliance_scope_redefinition_source_backfill"
  | "home_appliance_robot_vacuum_model_dock_source_backfill"
  | "home_appliance_robot_vacuum_internal_observation_design"
  | "home_appliance_robot_vacuum_no_write_runner_design"
  | "home_appliance_robot_vacuum_no_write_runner_preflight"
  | "home_appliance_robot_vacuum_supplied_input_runner_simulation"
  | "camera_taxonomy_split"
  | "camera_body_only_internal_observation_plan"
  | "camera_body_only_source_backfill"
  | "camera_body_only_live_market_observation_design"
  | "camera_body_only_no_write_live_market_dry_run_runner_design"
  | "camera_body_only_no_write_runner_preflight"
  | "camera_body_only_supplied_input_runner_simulation"
  | "monitor_selected_exact_model_source_confidence"
  | "monitor_selected_exact_model_no_write_observation_design"
  | "monitor_selected_exact_model_no_write_runner_preflight"
  | "monitor_selected_exact_model_supplied_input_runner_simulation"
  | "speaker_market_spec_backfill"
  | "speaker_selected_subset_internal_observation_plan"
  | "speaker_selected_subset_no_write_live_market_dry_run_runner_design"
  | "speaker_selected_subset_runner_fixture_source_backfill"
  | "speaker_selected_subset_no_write_runner_preflight"
  | "speaker_selected_subset_supplied_input_runner_simulation"
  | "game_console_switch2_owner_decision"
  | "game_console_switch2_source_backfill"
  | "game_console_switch2_no_mutation_executor_readiness"
  | "category_next_wave_selector"
  | "category_observation_readiness_comparison"
  | "category_parallel_orchestration_control"
  | "category_no_write_runner_rollup"
  | "category_orchestration_board"
  | "live_read_ai_escalation_contract"
  | "runtime_patch_batch_review_packet";

type ArtifactRecord = {
  group: ArtifactGroup;
  file: string;
  exists: boolean;
  parseStatus: "json" | "markdown" | "missing" | "parse_error";
  reportOnly: boolean | null;
  forbiddenTrueFlags: string[];
  forbiddenPositiveCounts: Array<{ key: string; value: number }>;
  boundaryGaps: string[];
  directThirtyDayPlanRisk: boolean;
  statusSignals: string[];
  contradictions: string[];
};

type Finding = {
  severity: "fail" | "warn";
  group: ArtifactGroup;
  file: string;
  check: string;
  detail: string;
};

const reportsDir = path.join(process.cwd(), "reports");
const outputJsonPath = path.join(reportsDir, "orchestration-boundary-audit-latest.json");
const outputMdPath = path.join(reportsDir, "orchestration-boundary-audit-latest.md");

const explicitArtifacts: Array<{ group: ArtifactGroup; file: string }> = [
  { group: "desktop_runtime_review_packet", file: "reports/desktop-private-used-runtime-review-packet-latest.json" },
  { group: "desktop_runtime_review_packet", file: "reports/desktop-private-used-runtime-review-packet-latest.md" },
  { group: "desktop_category_axis_dry_run_plan", file: "reports/desktop-category-axis-no-mutation-dry-run-plan-latest.json" },
  { group: "desktop_category_axis_dry_run_plan", file: "reports/desktop-category-axis-no-mutation-dry-run-plan-latest.md" },
  { group: "desktop_owner_decision_packet", file: "reports/desktop-owner-decision-packet-latest.json" },
  { group: "desktop_owner_decision_packet", file: "reports/desktop-owner-decision-packet-latest.md" },
  { group: "desktop_cpu_gpu_source_backfill", file: "reports/desktop-cpu-gpu-source-backfill-latest.json" },
  { group: "desktop_cpu_gpu_source_backfill", file: "reports/desktop-cpu-gpu-source-backfill-latest.md" },
  { group: "desktop_cpu_gpu_no_mutation_executor_readiness", file: "reports/desktop-cpu-gpu-no-mutation-executor-readiness-latest.json" },
  { group: "desktop_cpu_gpu_no_mutation_executor_readiness", file: "reports/desktop-cpu-gpu-no-mutation-executor-readiness-latest.md" },
  { group: "home_appliance_wave1", file: "reports/home-appliance-stick-vacuum-targeted-acquisition-latest.json" },
  { group: "home_appliance_wave1", file: "reports/home-appliance-stick-vacuum-targeted-acquisition-latest.md" },
  { group: "home_appliance_wave2", file: "reports/home-appliance-stick-vacuum-targeted-acquisition-wave2-latest.json" },
  { group: "home_appliance_wave2", file: "reports/home-appliance-stick-vacuum-targeted-acquisition-wave2-latest.md" },
  { group: "home_appliance_wave3", file: "reports/home-appliance-stick-vacuum-targeted-acquisition-wave3-latest.json" },
  { group: "home_appliance_wave3", file: "reports/home-appliance-stick-vacuum-targeted-acquisition-wave3-latest.md" },
  { group: "home_appliance_scope_redefinition_source_backfill", file: "reports/home-appliance-scope-redefinition-source-backfill-latest.json" },
  { group: "home_appliance_scope_redefinition_source_backfill", file: "reports/home-appliance-scope-redefinition-source-backfill-latest.md" },
  { group: "home_appliance_robot_vacuum_model_dock_source_backfill", file: "reports/home-appliance-robot-vacuum-model-dock-source-backfill-latest.json" },
  { group: "home_appliance_robot_vacuum_model_dock_source_backfill", file: "reports/home-appliance-robot-vacuum-model-dock-source-backfill-latest.md" },
  { group: "home_appliance_robot_vacuum_internal_observation_design", file: "reports/home-appliance-robot-vacuum-internal-observation-design-latest.json" },
  { group: "home_appliance_robot_vacuum_internal_observation_design", file: "reports/home-appliance-robot-vacuum-internal-observation-design-latest.md" },
  { group: "home_appliance_robot_vacuum_no_write_runner_design", file: "reports/home-appliance-robot-vacuum-no-write-runner-design-latest.json" },
  { group: "home_appliance_robot_vacuum_no_write_runner_design", file: "reports/home-appliance-robot-vacuum-no-write-runner-design-latest.md" },
  { group: "home_appliance_robot_vacuum_no_write_runner_preflight", file: "reports/home-appliance-robot-vacuum-no-write-runner-preflight-latest.json" },
  { group: "home_appliance_robot_vacuum_no_write_runner_preflight", file: "reports/home-appliance-robot-vacuum-no-write-runner-preflight-latest.md" },
  { group: "home_appliance_robot_vacuum_supplied_input_runner_simulation", file: "reports/home-appliance-robot-vacuum-supplied-input-runner-simulation-latest.json" },
  { group: "home_appliance_robot_vacuum_supplied_input_runner_simulation", file: "reports/home-appliance-robot-vacuum-supplied-input-runner-simulation-latest.md" },
  { group: "camera_taxonomy_split", file: "reports/camera-fixed-lens-interchangeable-taxonomy-next-latest.json" },
  { group: "camera_taxonomy_split", file: "reports/camera-fixed-lens-interchangeable-taxonomy-next-latest.md" },
  { group: "camera_body_only_internal_observation_plan", file: "reports/camera-body-only-internal-sublane-plan-latest.json" },
  { group: "camera_body_only_internal_observation_plan", file: "reports/camera-body-only-internal-sublane-plan-latest.md" },
  { group: "camera_body_only_source_backfill", file: "reports/camera-body-only-source-backfill-latest.json" },
  { group: "camera_body_only_source_backfill", file: "reports/camera-body-only-source-backfill-latest.md" },
  { group: "camera_body_only_live_market_observation_design", file: "reports/camera-body-only-live-market-observation-design-latest.json" },
  { group: "camera_body_only_live_market_observation_design", file: "reports/camera-body-only-live-market-observation-design-latest.md" },
  { group: "camera_body_only_no_write_live_market_dry_run_runner_design", file: "reports/camera-body-only-no-write-live-market-dry-run-runner-design-latest.json" },
  { group: "camera_body_only_no_write_live_market_dry_run_runner_design", file: "reports/camera-body-only-no-write-live-market-dry-run-runner-design-latest.md" },
  { group: "camera_body_only_no_write_runner_preflight", file: "reports/camera-body-only-no-write-runner-preflight-latest.json" },
  { group: "camera_body_only_no_write_runner_preflight", file: "reports/camera-body-only-no-write-runner-preflight-latest.md" },
  { group: "camera_body_only_supplied_input_runner_simulation", file: "reports/camera-body-only-supplied-input-runner-simulation-latest.json" },
  { group: "camera_body_only_supplied_input_runner_simulation", file: "reports/camera-body-only-supplied-input-runner-simulation-latest.md" },
  { group: "monitor_selected_exact_model_source_confidence", file: "reports/monitor-selected-exact-model-source-confidence-latest.json" },
  { group: "monitor_selected_exact_model_source_confidence", file: "reports/monitor-selected-exact-model-source-confidence-latest.md" },
  { group: "monitor_selected_exact_model_no_write_observation_design", file: "reports/monitor-selected-exact-model-no-write-observation-design-latest.json" },
  { group: "monitor_selected_exact_model_no_write_observation_design", file: "reports/monitor-selected-exact-model-no-write-observation-design-latest.md" },
  { group: "monitor_selected_exact_model_no_write_runner_preflight", file: "reports/monitor-selected-exact-model-no-write-runner-preflight-latest.json" },
  { group: "monitor_selected_exact_model_no_write_runner_preflight", file: "reports/monitor-selected-exact-model-no-write-runner-preflight-latest.md" },
  { group: "monitor_selected_exact_model_supplied_input_runner_simulation", file: "reports/monitor-selected-exact-model-supplied-input-runner-simulation-latest.json" },
  { group: "monitor_selected_exact_model_supplied_input_runner_simulation", file: "reports/monitor-selected-exact-model-supplied-input-runner-simulation-latest.md" },
  { group: "speaker_market_spec_backfill", file: "reports/speaker-portable-exact-model-market-spec-backfill-latest.json" },
  { group: "speaker_market_spec_backfill", file: "reports/speaker-portable-exact-model-market-spec-backfill-latest.md" },
  { group: "speaker_selected_subset_internal_observation_plan", file: "reports/speaker-selected-subset-internal-observation-plan-latest.json" },
  { group: "speaker_selected_subset_internal_observation_plan", file: "reports/speaker-selected-subset-internal-observation-plan-latest.md" },
  { group: "speaker_selected_subset_no_write_live_market_dry_run_runner_design", file: "reports/speaker-selected-subset-no-write-live-market-dry-run-runner-design-latest.json" },
  { group: "speaker_selected_subset_no_write_live_market_dry_run_runner_design", file: "reports/speaker-selected-subset-no-write-live-market-dry-run-runner-design-latest.md" },
  { group: "speaker_selected_subset_runner_fixture_source_backfill", file: "reports/speaker-selected-subset-runner-fixture-source-backfill-latest.json" },
  { group: "speaker_selected_subset_runner_fixture_source_backfill", file: "reports/speaker-selected-subset-runner-fixture-source-backfill-latest.md" },
  { group: "speaker_selected_subset_no_write_runner_preflight", file: "reports/speaker-selected-subset-no-write-runner-preflight-latest.json" },
  { group: "speaker_selected_subset_no_write_runner_preflight", file: "reports/speaker-selected-subset-no-write-runner-preflight-latest.md" },
  { group: "speaker_selected_subset_supplied_input_runner_simulation", file: "reports/speaker-selected-subset-supplied-input-runner-simulation-latest.json" },
  { group: "speaker_selected_subset_supplied_input_runner_simulation", file: "reports/speaker-selected-subset-supplied-input-runner-simulation-latest.md" },
  { group: "game_console_switch2_owner_decision", file: "reports/game-console-switch-2-owner-decision-packet-latest.json" },
  { group: "game_console_switch2_owner_decision", file: "reports/game-console-switch-2-owner-decision-packet-latest.md" },
  { group: "game_console_switch2_source_backfill", file: "reports/game-console-switch-2-source-backfill-latest.json" },
  { group: "game_console_switch2_source_backfill", file: "reports/game-console-switch-2-source-backfill-latest.md" },
  { group: "game_console_switch2_no_mutation_executor_readiness", file: "reports/game-console-switch-2-no-mutation-executor-readiness-latest.json" },
  { group: "game_console_switch2_no_mutation_executor_readiness", file: "reports/game-console-switch-2-no-mutation-executor-readiness-latest.md" },
  { group: "category_next_wave_selector", file: "reports/category-next-wave-selector-latest.json" },
  { group: "category_next_wave_selector", file: "reports/category-next-wave-selector-latest.md" },
  { group: "category_observation_readiness_comparison", file: "reports/category-observation-readiness-comparison-latest.json" },
  { group: "category_observation_readiness_comparison", file: "reports/category-observation-readiness-comparison-latest.md" },
  { group: "category_parallel_orchestration_control", file: "reports/category-parallel-orchestration-control-latest.json" },
  { group: "category_parallel_orchestration_control", file: "reports/category-parallel-orchestration-control-latest.md" },
  { group: "category_no_write_runner_rollup", file: "reports/category-no-write-runner-rollup-latest.json" },
  { group: "category_no_write_runner_rollup", file: "reports/category-no-write-runner-rollup-latest.md" },
  { group: "category_orchestration_board", file: "reports/category-orchestration-status-latest.json" },
  { group: "category_orchestration_board", file: "reports/category-orchestration-status-latest.md" },
  { group: "live_read_ai_escalation_contract", file: "reports/live-read-ai-escalation-contract-latest.json" },
  { group: "live_read_ai_escalation_contract", file: "reports/live-read-ai-escalation-contract-latest.md" },
  { group: "runtime_patch_batch_review_packet", file: "reports/runtime-patch-batch-review-packet-latest.json" },
  { group: "runtime_patch_batch_review_packet", file: "reports/runtime-patch-batch-review-packet-latest.md" },
];

const forbiddenBooleanKeys = [
  "runtimeCatalogApply",
  "runtimeApply",
  "runtimeApproved",
  "publicPromotion",
  "candidatePool",
  "candidatePoolPolicyWiring",
  "candidatePoolWiring",
  "productionDbMutation",
  "directThirtyDayPlanEdit",
  "forbiddenRuntimeFilesEdited",
];

const forbiddenCountKeys = [
  "runtimeApprovedRows",
  "publicPromotionRows",
  "candidatePoolRows",
  "candidatePoolWiringRows",
  "candidatePoolPolicyRows",
  "runtimeApplyRows",
  "runtimeCatalogApplyRows",
];

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function flattenJson(value: unknown, prefix = ""): Array<{ key: string; value: unknown }> {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => flattenJson(entry, `${prefix}[${index}]`));
  }
  if (isObject(value)) {
    return Object.entries(value).flatMap(([key, entry]) => flattenJson(entry, prefix ? `${prefix}.${key}` : key));
  }
  return [{ key: prefix, value }];
}

function mdBool(raw: string, key: string): boolean | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`${escaped}\\s*[:|]\\s*(true|false)`, "i"),
    new RegExp(`${escaped}[^\\n]*?\\b(true|false)\\b`, "i"),
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return match[1].toLowerCase() === "true";
  }
  return null;
}

function mdNumber(raw: string, key: string): number | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*[:|]?\\s*(\\d+)`, "i");
  const match = raw.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function includesAny(raw: string, tokens: string[]): boolean {
  const lower = raw.toLowerCase();
  return tokens.some((token) => lower.includes(token.toLowerCase()));
}

function extractStatusSignals(raw: string, json: JsonObject | null): string[] {
  const signals = new Set<string>();
  const add = (value: unknown): void => {
    if (typeof value !== "string") return;
    if (/ready|blocked|internal_only|owner|review|required|missed|not_runtime|no_public|gate_closed/i.test(value)) {
      signals.add(value.slice(0, 160));
    }
  };

  if (json) {
    for (const { key, value } of flattenJson(json)) {
      if (/status|conclusion|recommendation|next|blocker|readiness/i.test(key)) add(value);
    }
  }

  for (const match of raw.matchAll(/(?:status|conclusion|recommendedNext|nextAction|readiness)[^:\n|]*[:|]\s*([^\n|]+)/gi)) {
    add(match[1].trim());
  }

  return [...signals].slice(0, 12);
}

function boundaryValue(json: JsonObject, key: string): unknown {
  if (key in json) return json[key];
  if (isObject(json.boundary) && key in json.boundary) return json.boundary[key];
  return undefined;
}

function hasFalseBoundary(json: JsonObject, ...keys: string[]): boolean {
  return keys.some((key) => boundaryValue(json, key) === false);
}

function auditJson(file: string, json: JsonObject): Pick<
  ArtifactRecord,
  "reportOnly" | "forbiddenTrueFlags" | "forbiddenPositiveCounts" | "boundaryGaps" | "directThirtyDayPlanRisk"
> {
  const flat = flattenJson(json);
  const forbiddenTrueFlags = flat
    .filter(({ key, value }) => forbiddenBooleanKeys.some((name) => key.endsWith(name)) && value === true)
    .map(({ key }) => key);
  const forbiddenPositiveCounts = flat
    .filter(({ key, value }) => forbiddenCountKeys.some((name) => key.endsWith(name)) && typeof value === "number" && value > 0)
    .map(({ key, value }) => ({ key, value: Number(value) }));

  const reportOnlyValue = boundaryValue(json, "reportOnly");
  const reportOnly = typeof reportOnlyValue === "boolean" ? reportOnlyValue : null;
  const boundaryGaps: string[] = [];
  if (reportOnly !== true && !file.includes("desktop-private-used-runtime-review-packet")) {
    boundaryGaps.push("top-level reportOnly is not true");
  }
  for (const key of ["publicPromotion", "productionDbMutation"]) {
    if (!hasFalseBoundary(json, key)) boundaryGaps.push(`${key} is not explicitly false`);
  }
  if (!hasFalseBoundary(json, "runtimeCatalogApply", "runtimeApply") && !file.includes("desktop-private-used-runtime-review-packet")) {
    boundaryGaps.push("runtimeCatalogApply/runtimeApply is not explicitly false");
  }
  if (
    !hasFalseBoundary(json, "candidatePoolPolicyWiring", "candidatePoolWiring", "candidatePool") &&
    !file.includes("desktop-private-used-runtime-review-packet")
  ) {
    boundaryGaps.push("candidate pool boundary is not explicitly false");
  }
  if (!hasFalseBoundary(json, "directThirtyDayPlanEdit") && !file.includes("category-orchestration-status")) {
    boundaryGaps.push("directThirtyDayPlanEdit is not explicitly false");
  }

  return {
    reportOnly,
    forbiddenTrueFlags,
    forbiddenPositiveCounts,
    boundaryGaps,
    directThirtyDayPlanRisk: flat.some(({ key, value }) => key.endsWith("directThirtyDayPlanEdit") && value === true),
  };
}

function auditMarkdown(raw: string): Pick<
  ArtifactRecord,
  "reportOnly" | "forbiddenTrueFlags" | "forbiddenPositiveCounts" | "boundaryGaps" | "directThirtyDayPlanRisk"
> {
  const forbiddenTrueFlags = forbiddenBooleanKeys.filter((key) => mdBool(raw, key) === true);
  const forbiddenPositiveCounts = forbiddenCountKeys
    .map((key) => ({ key, value: mdNumber(raw, key) }))
    .filter((entry): entry is { key: string; value: number } => typeof entry.value === "number" && entry.value > 0);
  const reportOnly = mdBool(raw, "reportOnly");
  const boundaryGaps: string[] = [];
  if (reportOnly !== true && !includesAny(raw, ["Report-only", "report only"])) {
    boundaryGaps.push("markdown lacks explicit report-only signal");
  }
  if (includesAny(raw, ["runtimeApproved/public/candidatePool rows: 0/0/0"])) {
    return { reportOnly, forbiddenTrueFlags, forbiddenPositiveCounts, boundaryGaps, directThirtyDayPlanRisk: false };
  }
  const directThirtyDayPlanRisk =
    mdBool(raw, "directThirtyDayPlanEdit") === true ||
    includesAny(raw, ["direct 30일_실행계획.md edits allowed", "edit 30일_실행계획.md"]);
  return { reportOnly, forbiddenTrueFlags, forbiddenPositiveCounts, boundaryGaps, directThirtyDayPlanRisk };
}

function contradictionSignals(group: ArtifactGroup, raw: string, json: JsonObject | null): string[] {
  const contradictions: string[] = [];
  const lower = raw.toLowerCase();
  const reportOnly =
    (json && json.reportOnly === true) ||
    lower.includes("report-only") ||
    lower.includes("report only") ||
    lower.includes("no-mutation");
  const publicClosed =
    lower.includes("publicpromotion: false") ||
    lower.includes('"publicpromotion": false') ||
    lower.includes('"publicpromotionrows": 0') ||
    lower.includes('"candidatepool": false') ||
    lower.includes("public promotion") ||
    lower.includes("public gate closed") ||
    lower.includes("no_public");
  const runtimeBlocked =
    lower.includes("readyforruntimeapplynow") ||
    lower.includes("ready for runtime apply now | false") ||
    lower.includes("review_required_before_runtime_patch") ||
    lower.includes("review required before runtime patch") ||
    lower.includes("runtime apply blocked");
  const readyLanguage =
    lower.includes("ready") ||
    lower.includes("runtime_route_ready") ||
    lower.includes("parser_ready") ||
    lower.includes("model-ready");
  const goalMissed =
    lower.includes("goal_missed") ||
    lower.includes("goal_not_met") ||
    lower.includes("not met") ||
    lower.includes("missed");

  if (group === "category_orchestration_board" && json) {
    const runtimePatchReady = Number(json.runtimePatchReadyCandidates ?? 0);
    const candidates = Array.isArray(json.candidates) ? json.candidates : [];
    const readyStatuses = candidates
      .filter((candidate): candidate is JsonObject => isObject(candidate))
      .filter((candidate) => typeof candidate.status === "string" && /runtime.*ready|parser_ready/i.test(candidate.status));
    if (runtimePatchReady === 0 && readyStatuses.length > 0) {
      contradictions.push(
        `runtimePatchReadyCandidates=0 while ${readyStatuses.length} candidate statuses contain ready/parser_ready language; mitigated only if interpreted as public-gate-closed/internal status.`,
      );
    }
  }

  if (reportOnly && readyLanguage && !publicClosed && !goalMissed && !runtimeBlocked) {
    contradictions.push("report-only artifact uses ready/model-ready language without an adjacent public-gate-closed or missed-goal qualifier.");
  }

  if (json && json.conclusion && typeof json.conclusion === "string") {
    if (/ready/i.test(json.conclusion) && /blocked|required|owner|review/i.test(json.conclusion) && !/report_only|no_mutation/i.test(json.conclusion)) {
      contradictions.push(`conclusion mixes ready and blocked/review language: ${json.conclusion}`);
    }
  }

  return contradictions;
}

async function auditArtifact(group: ArtifactGroup, file: string): Promise<ArtifactRecord> {
  const fullPath = path.join(process.cwd(), file);
  let raw = "";
  try {
    raw = await readFile(fullPath, "utf8");
  } catch {
    return {
      group,
      file,
      exists: false,
      parseStatus: "missing",
      reportOnly: null,
      forbiddenTrueFlags: [],
      forbiddenPositiveCounts: [],
      boundaryGaps: ["artifact missing"],
      directThirtyDayPlanRisk: false,
      statusSignals: [],
      contradictions: [],
    };
  }

  if (file.endsWith(".json")) {
    try {
      const parsed = JSON.parse(raw) as JsonObject;
      const audit = auditJson(file, parsed);
      return {
        group,
        file,
        exists: true,
        parseStatus: "json",
        ...audit,
        statusSignals: extractStatusSignals(raw, parsed),
        contradictions: contradictionSignals(group, raw, parsed),
      };
    } catch {
      return {
        group,
        file,
        exists: true,
        parseStatus: "parse_error",
        reportOnly: null,
        forbiddenTrueFlags: [],
        forbiddenPositiveCounts: [],
        boundaryGaps: ["json parse error"],
        directThirtyDayPlanRisk: false,
        statusSignals: [],
        contradictions: [],
      };
    }
  }

  const audit = auditMarkdown(raw);
  return {
    group,
    file,
    exists: true,
    parseStatus: "markdown",
    ...audit,
    statusSignals: extractStatusSignals(raw, null),
    contradictions: contradictionSignals(group, raw, null),
  };
}

function findingRows(records: ArtifactRecord[]): Finding[] {
  const findings: Finding[] = [];
  for (const record of records) {
    for (const key of record.forbiddenTrueFlags) {
      findings.push({ severity: "fail", group: record.group, file: record.file, check: "forbidden_true_flag", detail: key });
    }
    for (const count of record.forbiddenPositiveCounts) {
      findings.push({
        severity: "fail",
        group: record.group,
        file: record.file,
        check: "forbidden_positive_count",
        detail: `${count.key}=${count.value}`,
      });
    }
    if (record.directThirtyDayPlanRisk) {
      findings.push({
        severity: "fail",
        group: record.group,
        file: record.file,
        check: "direct_thirty_day_plan_edit",
        detail: "artifact indicates or permits direct 30-day plan editing",
      });
    }
    for (const gap of record.boundaryGaps) {
      findings.push({ severity: "warn", group: record.group, file: record.file, check: "boundary_gap", detail: gap });
    }
    for (const contradiction of record.contradictions) {
      findings.push({ severity: "warn", group: record.group, file: record.file, check: "contradictory_status", detail: contradiction });
    }
  }
  return findings;
}

function mdCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function buildMarkdown(report: JsonObject, records: ArtifactRecord[], findings: Finding[]): string {
  const metrics = report.metrics as JsonObject;
  const failFindings = findings.filter((finding) => finding.severity === "fail");
  const warnFindings = findings.filter((finding) => finding.severity === "warn");
  const lines = [
    "# Orchestration Boundary Audit",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- auditStatus: ${report.auditStatus}`,
    "- scope: artifact/boundary audit only",
    "- runtime/src/lib edits: false",
    "- Supabase/cron/lifecycle/candidate-pool/pack-UI/public-promotion edits: false",
    "- direct 30-day-plan edit: false",
    "",
    "## Metrics",
    "",
    `- artifactsAudited: ${metrics.artifactsAudited}`,
    `- hardFailFindings: ${metrics.hardFailFindings}`,
    `- warningFindings: ${metrics.warningFindings}`,
    `- forbiddenTrueFlags: ${metrics.forbiddenTrueFlags}`,
    `- forbiddenPositiveCounts: ${metrics.forbiddenPositiveCounts}`,
    `- directThirtyDayPlanRisks: ${metrics.directThirtyDayPlanRisks}`,
    "",
    "## Hard Fails",
    "",
    "| group | file | check | detail |",
    "| --- | --- | --- | --- |",
    ...(failFindings.length
      ? failFindings.map((finding) => `| ${finding.group} | ${mdCell(finding.file)} | ${finding.check} | ${mdCell(finding.detail)} |`)
      : ["| none | none | none | none |"]),
    "",
    "## Warnings And Contradictions",
    "",
    "| group | file | check | detail |",
    "| --- | --- | --- | --- |",
    ...(warnFindings.length
      ? warnFindings.map((finding) => `| ${finding.group} | ${mdCell(finding.file)} | ${finding.check} | ${mdCell(finding.detail)} |`)
      : ["| none | none | none | none |"]),
    "",
    "## Artifact Summary",
    "",
    "| group | file | parse | forbiddenFlags | positiveCounts | boundaryGaps | contradictions |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: |",
    ...records.map((record) =>
      `| ${record.group} | ${mdCell(record.file)} | ${record.parseStatus} | ${record.forbiddenTrueFlags.length} | ${record.forbiddenPositiveCounts.length} | ${record.boundaryGaps.length} | ${record.contradictions.length} |`,
    ),
    "",
    "## Boundary Decision",
    "",
    failFindings.length
      ? "Boundary audit failed: at least one artifact reports forbidden runtime/public/candidate-pool/Supabase/30-day-plan apply state."
      : "Boundary audit passed for hard gates: no forbidden true flags, no runtime/public/candidate-pool/runtime-apply positive rows, and no direct 30-day-plan edit signal were found in the audited artifacts.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const artifacts = explicitArtifacts;
  const uniqueArtifacts = [...new Map(artifacts.map((artifact) => [artifact.file, artifact])).values()];
  const records = await Promise.all(uniqueArtifacts.map((artifact) => auditArtifact(artifact.group, artifact.file)));
  const findings = findingRows(records);
  const hardFailFindings = findings.filter((finding) => finding.severity === "fail");
  const warningFindings = findings.filter((finding) => finding.severity === "warn");
  const metrics = {
    artifactsAudited: records.length,
    hardFailFindings: hardFailFindings.length,
    warningFindings: warningFindings.length,
    forbiddenTrueFlags: records.reduce((sum, record) => sum + record.forbiddenTrueFlags.length, 0),
    forbiddenPositiveCounts: records.reduce((sum, record) => sum + record.forbiddenPositiveCounts.length, 0),
    directThirtyDayPlanRisks: records.filter((record) => record.directThirtyDayPlanRisk).length,
    contradictionWarnings: records.reduce((sum, record) => sum + record.contradictions.length, 0),
    boundaryGapWarnings: records.reduce((sum, record) => sum + record.boundaryGaps.length, 0),
  };
  const report = {
    generatedAt,
    reportOnly: true,
    runtimeCatalogApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope: "artifact_boundary_audit_only",
    auditedGroups: [...new Set(records.map((record) => record.group))],
    auditStatus: hardFailFindings.length ? "fail" : warningFindings.length ? "pass_with_warnings" : "pass",
    metrics,
    records,
    findings,
    conclusion: hardFailFindings.length
      ? "boundary_audit_failed_forbidden_apply_signal_present"
      : "boundary_audit_passed_no_forbidden_apply_signal_found",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(outputMdPath, buildMarkdown(report, records, findings));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
