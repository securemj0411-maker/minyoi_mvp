import fs from "node:fs";
import path from "node:path";

type OrchestrationCandidate = {
  lane: string;
  status: string;
  runtimeSurface?: string;
  evidence?: string;
  blocker?: string;
  nextAction?: string;
  score?: number;
};

type OrchestrationStatus = {
  generatedAt?: string;
  candidates?: OrchestrationCandidate[];
  recommendedNext?: OrchestrationCandidate | string;
};

type ExpansionRollup = {
  generatedAt?: string;
  metrics?: Record<string, unknown>;
  rows?: Array<{
    category: string;
    packetFile?: string;
    auditFile?: string;
    auditConclusion?: string;
    auditFailures?: number;
    runtimeApprovedRows?: number;
    candidatePositiveOnlyRows?: number;
    nextAction?: string;
  }>;
  ownerReviewItemsStillSeparate?: string[];
  nextQueue?: string[];
};

type RuntimePatchBatch = {
  generatedAt?: string;
  rollupTotals?: Record<string, unknown>;
  patchReviewQueue?: Array<{
    priority?: number;
    category: string;
    reason?: string;
    sourceReports?: string[];
    owner?: string;
  }>;
  patchItems?: Array<{
    priority?: number;
    category: string;
    status?: string;
    summary?: string;
  }>;
  ownerDecisionMatrix?: Array<Record<string, unknown>>;
};

type WorkItemType = "evidence-gathering" | "implementation-prep" | "owner-decision";

type WorkItem = {
  rank: number;
  workItemId: string;
  category: string;
  lane: string;
  type: WorkItemType;
  recommendation: string;
  whyNow: string;
  sourceSignals: string[];
  deliverable: string;
  excludedRuntimeMutation: true;
  runtimeApprovedRows: 0;
  publicPromotionRows: 0;
  candidatePoolRows: 0;
  runtimeApplyRows: 0;
};

type ExcludedItem = {
  lane: string;
  reason: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const sourceFiles = [
  "reports/category-orchestration-status-latest.md",
  "reports/category-orchestration-status-latest.json",
  "reports/pass-category-expansion-rollup-latest.md",
  "reports/pass-category-expansion-rollup-latest.json",
  "reports/runtime-patch-batch-review-packet-latest.md",
  "reports/runtime-patch-batch-review-packet-latest.json",
  "reports/camera-fixed-lens-interchangeable-taxonomy-next-latest.md",
  "reports/camera-fixed-lens-interchangeable-taxonomy-next-latest.json",
  "reports/speaker-portable-exact-model-market-spec-backfill-latest.md",
  "reports/speaker-portable-exact-model-market-spec-backfill-latest.json",
  "reports/current-work-queue-2026-05-12.md",
];

function readText(relativePath: string): string {
  const fullPath = path.join(appDir, relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function readJson<T>(relativePath: string): T | null {
  const fullPath = path.join(appDir, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

function table(rows: string[][]): string {
  const [header, ...body] = rows;
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}

function findCandidate(candidates: OrchestrationCandidate[], lane: string): OrchestrationCandidate | null {
  return candidates.find((candidate) => candidate.lane === lane) ?? null;
}

function includesAny(value: string, needles: string[]): boolean {
  const haystack = value.toLowerCase();
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

const orchestration = readJson<OrchestrationStatus>("reports/category-orchestration-status-latest.json") ?? {};
const expansion = readJson<ExpansionRollup>("reports/pass-category-expansion-rollup-latest.json") ?? {};
const runtimeBatch = readJson<RuntimePatchBatch>("reports/runtime-patch-batch-review-packet-latest.json") ?? {};
const cameraTaxonomyNext = readJson<{ conclusion?: string }>("reports/camera-fixed-lens-interchangeable-taxonomy-next-latest.json");
const speakerBackfillNext = readJson<{ conclusion?: string }>("reports/speaker-portable-exact-model-market-spec-backfill-latest.json");
const currentWorkQueue = readText("reports/current-work-queue-2026-05-12.md");

const orchestrationCandidates = orchestration.candidates ?? [];
const expansionNextQueue = expansion.nextQueue ?? [];
const ownerReviewItems = expansion.ownerReviewItemsStillSeparate ?? [];
const runtimePatchReviewQueue = runtimeBatch.patchReviewQueue ?? [];

const desktopCandidate = findCandidate(orchestrationCandidates, "desktop_private_used_cpu_gpu");
const homeCandidate = findCandidate(orchestrationCandidates, "home_appliance_stick_vacuum");
const headphoneCandidate = findCandidate(orchestrationCandidates, "headphone_airpods_max_owner_review");
const speakerCandidate = findCandidate(orchestrationCandidates, "speaker_portable_exact_model");
const cameraCandidate = findCandidate(orchestrationCandidates, "camera_body_only_exact_model");
const monitorCandidate = findCandidate(orchestrationCandidates, "monitor_selected_exact_model");

const excludedItems: ExcludedItem[] = [
  {
    lane: "desktop_private_used_cpu_gpu",
    reason: desktopCandidate?.blocker ?? "Desktop category axis and runtime decisions remain blocked; user requested next wave after Desktop.",
  },
  {
    lane: "home_appliance_stick_vacuum",
    reason: homeCandidate?.blocker ?? "Home Appliance stick vacuum is paused/blocked; user requested next wave after Home Appliance.",
  },
  {
    lane: "headphone_airpods_max_owner_review",
    reason: headphoneCandidate?.blocker ?? "AirPods-only policy repetition is excluded unless reframed as a cross-category rule.",
  },
];

const hasCameraTaxonomySignal =
  expansionNextQueue.some((item) => includesAny(item, ["camera fixed-lens", "interchangeable body", "taxonomy split"])) ||
  currentWorkQueue.includes("camera_body_only_exact_model");

const hasSpeakerEvidenceSignal =
  expansionNextQueue.some((item) => includesAny(item, ["official spec source backfill", "speaker"])) ||
  currentWorkQueue.includes("speaker_portable_exact_model");

const hasGameConsoleOwnerSignal =
  ownerReviewItems.some((item) => includesAny(item, ["game_console", "Switch 2"])) ||
  runtimePatchReviewQueue.some((item) => includesAny(item.category, ["game_console"]));

const hasMonitorFallbackSignal =
  expansionNextQueue.some((item) => includesAny(item, ["official spec source backfill", "monitor"])) ||
  Boolean(monitorCandidate);

const cameraTaxonomyAlreadySatisfied =
  cameraTaxonomyNext?.conclusion === "camera_taxonomy_next_wave_satisfied_by_body_lens_split_packet_report_only";
const speakerBackfillAlreadySatisfied =
  speakerBackfillNext?.conclusion === "speaker_portable_exact_model_market_spec_backfill_satisfied_report_only";

let selectedWorkItems: WorkItem[] = [
  {
    rank: 1,
    workItemId: "CATEGORY-NEXT-WAVE-01",
    category: "camera_discovered",
    lane: "camera_fixed_lens_interchangeable_body_kit_taxonomy_split",
    type: "implementation-prep",
    recommendation: "Produce a report-only taxonomy split packet for fixed-lens, interchangeable body-only, body+kit, and lens-only camera rows.",
    whyNow: hasCameraTaxonomySignal
      ? "The expansion rollup explicitly queues camera fixed-lens and interchangeable body/kit taxonomy split, while orchestration says camera body-only exact model is already internal-route-ready with public gate closed."
      : "Camera has strong body-only evidence and still needs package-axis boundaries before any broader category movement.",
    sourceSignals: [
      `orchestration: ${cameraCandidate?.status ?? "camera candidate not found"}`,
      `rollup nextQueue: ${expansionNextQueue.find((item) => includesAny(item, ["camera fixed-lens", "interchangeable body"])) ?? "camera taxonomy split not present"}`,
      "current-work-queue: monitor/speaker/camera exact lanes are observe/internal-route only; no public wiring",
    ],
    deliverable: "reports/camera-fixed-lens-interchangeable-taxonomy-next-latest.md/json or an equivalent report-only split packet.",
    excludedRuntimeMutation: true,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
    runtimeApplyRows: 0,
  },
  {
    rank: 2,
    workItemId: "CATEGORY-NEXT-WAVE-02",
    category: "speaker_audio_discovered",
    lane: "speaker_portable_exact_model_market_and_spec_backfill",
    type: "evidence-gathering",
    recommendation: "Backfill portable-speaker exact-model market/spec evidence, focusing on model-family/device-class boundaries rather than runtime wiring.",
    whyNow: hasSpeakerEvidenceSignal
      ? "The rollup queues official spec source backfill for selected speaker subsets, and orchestration says speaker portable exact-model is internal-route-ready but needs market samples before any readiness promotion."
      : "Speaker portable exact-model has medium evidence and a closed public gate, making it a safe report-only evidence lane.",
    sourceSignals: [
      `orchestration: ${speakerCandidate?.status ?? "speaker candidate not found"}`,
      `blocker: ${speakerCandidate?.blocker ?? "speaker market evidence required"}`,
      `rollup nextQueue: ${expansionNextQueue.find((item) => includesAny(item, ["official spec source backfill", "speaker"])) ?? "official spec backfill signal not present"}`,
    ],
    deliverable: "reports/speaker-portable-exact-model-market-spec-backfill-latest.md/json.",
    excludedRuntimeMutation: true,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
    runtimeApplyRows: 0,
  },
  {
    rank: 3,
    workItemId: "CATEGORY-NEXT-WAVE-03",
    category: "game_console_body_narrow",
    lane: "switch_2_manual_review_gate_owner_decision_packet",
    type: "owner-decision",
    recommendation: "Prepare an owner-decision packet for the Switch 2 manual-review gate, limited to policy framing and fixtures.",
    whyNow: hasGameConsoleOwnerSignal
      ? "The expansion rollup keeps game-console owner review separate, and this avoids repeating the AirPods-only headphone policy backlog."
      : "Game console has an isolated owner-policy gate that can be clarified without touching runtime or public/candidate-pool wiring.",
    sourceSignals: [
      `ownerReviewItems: ${ownerReviewItems.find((item) => includesAny(item, ["game_console", "Switch 2"])) ?? "game-console owner item not present"}`,
      `runtimePatchReviewQueue: ${runtimePatchReviewQueue.find((item) => includesAny(item.category, ["game_console"]))?.reason ?? "no current game-console runtime patch queue row"}`,
      "scope: owner-decision only; no runtime patch implementation",
    ],
    deliverable: "reports/game-console-switch-2-owner-decision-packet-latest.md/json.",
    excludedRuntimeMutation: true,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
    runtimeApplyRows: 0,
  },
];

const fallbackWorkItem: WorkItem = {
  rank: 4,
  workItemId: "CATEGORY-NEXT-WAVE-FALLBACK-04",
  category: "monitor_discovered",
  lane: "monitor_selected_exact_model_official_spec_backfill",
  type: "evidence-gathering",
  recommendation: "If owner-decision work is not desired, use monitor selected exact-model official spec backfill as the safe evidence fallback.",
  whyNow: hasMonitorFallbackSignal
    ? "Monitor is already absorbed/parser-ready with public and candidate-pool gates intentionally disabled, and the rollup queues official spec backfill for selected monitor subsets."
    : "Monitor is the lowest surface fallback because it remains narrow and public-gated.",
  sourceSignals: [
    `orchestration: ${monitorCandidate?.status ?? "monitor candidate not found"}`,
    `blocker: ${monitorCandidate?.blocker ?? "public/candidate gate closed"}`,
  ],
  deliverable: "reports/monitor-selected-model-official-spec-backfill-latest.md/json.",
  excludedRuntimeMutation: true,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
};

if (cameraTaxonomyAlreadySatisfied) {
  selectedWorkItems = selectedWorkItems.filter(
    (item) => item.lane !== "camera_fixed_lens_interchangeable_body_kit_taxonomy_split",
  );
  excludedItems.push({
    lane: "camera_fixed_lens_interchangeable_body_kit_taxonomy_split",
    reason: "Completed as report-only taxonomy packet; see reports/camera-fixed-lens-interchangeable-taxonomy-next-latest.md.",
  });
  selectedWorkItems.push({
    ...fallbackWorkItem,
    workItemId: "CATEGORY-NEXT-WAVE-03B",
    rank: selectedWorkItems.length + 1,
  });
}

if (speakerBackfillAlreadySatisfied) {
  selectedWorkItems = selectedWorkItems.filter(
    (item) => item.lane !== "speaker_portable_exact_model_market_and_spec_backfill",
  );
  excludedItems.push({
    lane: "speaker_portable_exact_model_market_and_spec_backfill",
    reason: "Completed as report-only selected JBL/LG market/spec backfill; see reports/speaker-portable-exact-model-market-spec-backfill-latest.md.",
  });
}

selectedWorkItems = selectedWorkItems.map((item, index) => ({ ...item, rank: index + 1 }));

const metrics = {
  selectedWorkItems: selectedWorkItems.length,
  evidenceGatheringRows: selectedWorkItems.filter((item) => item.type === "evidence-gathering").length,
  implementationPrepRows: selectedWorkItems.filter((item) => item.type === "implementation-prep").length,
  ownerDecisionRows: selectedWorkItems.filter((item) => item.type === "owner-decision").length,
  excludedBlockedOrPausedRows: excludedItems.length,
  fallbackRows: 1,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
};

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  ownership: "category_next_wave_selector_only",
  conclusion: "next_wave_selected_report_only_no_runtime_public_candidate_pool_rows",
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  runtimeApply: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  metrics,
  selectedWorkItems,
  fallbackWorkItem,
  excludedItems,
  sourceFilesRead: sourceFiles.filter((file) => fs.existsSync(path.join(appDir, file))),
};

function renderMarkdown(): string {
  return [
    "# Category Next-Wave Selector",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- conclusion: ${report.conclusion}`,
    "- ownership: category_next_wave_selector_only",
    "- reportOnly: true",
    "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring/runtimeApply: false/false/false/false",
    "- runtimeApproved/public/candidatePool/runtimeApply rows: 0/0/0/0",
    "- productionDbMutation/directThirtyDayPlanEdit: false/false",
    "",
    "## Scope",
    "",
    "Report-only selector for the next category work wave after Desktop and Home Appliance are blocked or paused. This does not edit runtime/src/lib, Supabase, cron/lifecycle, candidate pool, pack UI, public promotion, or the 30-day plan.",
    "",
    "## Metrics",
    "",
    table([
      ["metric", "value"],
      ["selectedWorkItems", String(metrics.selectedWorkItems)],
      ["evidenceGatheringRows", String(metrics.evidenceGatheringRows)],
      ["implementationPrepRows", String(metrics.implementationPrepRows)],
      ["ownerDecisionRows", String(metrics.ownerDecisionRows)],
      ["excludedBlockedOrPausedRows", String(metrics.excludedBlockedOrPausedRows)],
      ["runtimeApprovedRows", "0"],
      ["publicPromotionRows", "0"],
      ["candidatePoolRows", "0"],
      ["runtimeApplyRows", "0"],
    ]),
    "",
    "## Recommended Next Wave",
    "",
    table([
      ["rank", "category", "lane", "type", "recommendation", "deliverable"],
      ...selectedWorkItems.map((item) => [
        String(item.rank),
        item.category,
        item.lane,
        item.type,
        item.recommendation,
        item.deliverable,
      ]),
    ]),
    "",
    "## Why These Three",
    "",
    ...selectedWorkItems.flatMap((item) => [
      `### ${item.workItemId}: ${item.lane}`,
      "",
      `- type: ${item.type}`,
      `- whyNow: ${item.whyNow}`,
      `- sourceSignals: ${item.sourceSignals.join(" / ")}`,
      "- runtimeApproved/public/candidatePool/runtimeApply rows: 0/0/0/0",
      "",
    ]),
    "## Explicit Exclusions",
    "",
    table([
      ["lane", "reason"],
      ...excludedItems.map((item) => [item.lane, item.reason]),
    ]),
    "",
    "## Fallback",
    "",
    `- ${fallbackWorkItem.lane}: ${fallbackWorkItem.recommendation}`,
    "",
    "## Source Files Read",
    "",
    ...report.sourceFilesRead.map((file) => `- ${file}`),
    "",
  ].join("\n");
}

fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "category-next-wave-selector-latest.json");
const mdPath = path.join(reportsDir, "category-next-wave-selector-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(mdPath, renderMarkdown());

console.log(JSON.stringify({
  conclusion: report.conclusion,
  selectedWorkItems: metrics.selectedWorkItems,
  evidenceGatheringRows: metrics.evidenceGatheringRows,
  implementationPrepRows: metrics.implementationPrepRows,
  ownerDecisionRows: metrics.ownerDecisionRows,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
  jsonPath,
  mdPath,
}, null, 2));
