import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SourceBackfill = {
  reportOnly: boolean;
  runtimeCatalogApply: boolean;
  runtimeApply: boolean;
  publicPromotion: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  metrics: {
    sourceEvidenceRows: number;
    officialSourceRows: number;
    secondarySourceRows: number;
    marketplaceRiskRows: number;
    titleVisiblePolicyRows: number;
    descriptionOnlyRiskRows: number;
    bareGpuRiskRows: number;
    shopTemplateRiskRows: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
  sourceEvidence: Array<{
    id: string;
    axis: "cpu" | "gpu";
    observedTokens: string[];
    normalizedToken: string;
    sourceTier: string;
    releaseYear: number | null;
  }>;
  marketplaceRiskRows: Array<{
    caseId: string;
    sourceRisk: string;
    recommendedPolicy: string;
    ownerDecisionEvidenceQuality: "strong" | "medium" | "weak";
  }>;
  blockedRuntimePatchReasons: string[];
};

type OwnerPacket = {
  reportOnly: boolean;
  recommendedDecisions: {
    runtimeCategoryName: string;
    initialReadiness: string;
    publicPromotion: boolean;
    candidatePoolWiring: boolean;
    comparableKeyShape: string;
    descriptionBackedCpu: string;
    bareGpuTokens: string;
    monitorPeripheralBundle: string;
  };
  runtimeApproved: boolean;
  runtimeApply: boolean;
  runtimeCatalogApply: boolean;
  publicPromotion: boolean;
  candidatePool: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  futurePatchAllowedScope: string[];
  futurePatchForbiddenScope: string[];
};

type ReadinessCheck = {
  id: string;
  status: "pass" | "blocked";
  check: string;
  detail: string;
};

type BlockedOwnerDecision = {
  id: string;
  decision: string;
  currentRecommendation: string;
  neededBeforeExecutor: string;
  blockerSeverity: "must_decide" | "confirm_recommendation";
};

type ExecutorDraftEnvelope = {
  canDraftLater: boolean;
  canRunNow: false;
  runtimeApproval: false;
  recommendedFutureExecutorScope: string;
  requiredInputReports: string[];
  requiredFixtureClasses: Array<{
    class: "candidate_positive_only" | "manual_review_only" | "negative_hold_only";
    requiredEvidence: string;
  }>;
  forbiddenExecutorBehavior: string[];
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
  lane: "desktop_cpu_gpu_no_mutation_executor_readiness";
  inputFiles: string[];
  metrics: {
    sourceEvidenceRows: number;
    officialSourceRows: number;
    sourceBackfillRiskRows: number;
    readinessChecks: number;
    passedReadinessChecks: number;
    blockedReadinessChecks: number;
    blockedOwnerDecisions: number;
    runtimeApprovedRows: 0;
    publicPromotionRows: 0;
    candidatePoolRows: 0;
    runtimeApplyRows: 0;
  };
  readinessChecks: ReadinessCheck[];
  blockedOwnerDecisions: BlockedOwnerDecision[];
  executorDraftEnvelope: ExecutorDraftEnvelope;
  conclusion: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "desktop-cpu-gpu-no-mutation-executor-readiness-latest.json");
const outputMdPath = path.join(reportsDir, "desktop-cpu-gpu-no-mutation-executor-readiness-latest.md");

const inputFiles = [
  "reports/desktop-cpu-gpu-source-backfill-latest.json",
  "reports/desktop-owner-decision-packet-latest.json",
];

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as T;
}

function checkBoundary(source: SourceBackfill, owner: OwnerPacket): ReadinessCheck {
  const allClosed =
    source.reportOnly === true &&
    source.runtimeCatalogApply === false &&
    source.runtimeApply === false &&
    source.publicPromotion === false &&
    source.candidatePoolPolicyWiring === false &&
    source.productionDbMutation === false &&
    source.directThirtyDayPlanEdit === false &&
    owner.reportOnly === true &&
    owner.runtimeApproved === false &&
    owner.runtimeApply === false &&
    owner.runtimeCatalogApply === false &&
    owner.publicPromotion === false &&
    owner.candidatePool === false &&
    owner.candidatePoolPolicyWiring === false &&
    owner.productionDbMutation === false &&
    owner.directThirtyDayPlanEdit === false;
  return {
    id: "READINESS-01",
    status: allClosed ? "pass" : "blocked",
    check: "input reports preserve report-only closed boundaries",
    detail: allClosed
      ? "source backfill and owner packet keep runtime/public/candidate/DB/plan boundaries closed"
      : "one or more input boundary flags are not closed",
  };
}

function buildChecks(source: SourceBackfill, owner: OwnerPacket): ReadinessCheck[] {
  const sourceEvidencePass = source.metrics.sourceEvidenceRows >= 8 && source.metrics.officialSourceRows >= 6;
  const riskCoveragePass =
    source.metrics.descriptionOnlyRiskRows >= 1 &&
    source.metrics.bareGpuRiskRows >= 1 &&
    source.metrics.shopTemplateRiskRows >= 1;
  const keyShapePresent = owner.recommendedDecisions.comparableKeyShape.includes("cpu:<normalized_cpu>") &&
    owner.recommendedDecisions.comparableKeyShape.includes("gpu:<normalized_gpu>");
  const ownerStillPending = owner.runtimeApproved === false && owner.runtimeApply === false;

  return [
    checkBoundary(source, owner),
    {
      id: "READINESS-02",
      status: sourceEvidencePass ? "pass" : "blocked",
      check: "CPU/GPU source evidence is broad enough for executor draft planning",
      detail: `sourceEvidenceRows=${source.metrics.sourceEvidenceRows}, officialSourceRows=${source.metrics.officialSourceRows}`,
    },
    {
      id: "READINESS-03",
      status: riskCoveragePass ? "pass" : "blocked",
      check: "description-only, bare GPU, and shop-template risks are represented",
      detail: `descriptionOnly=${source.metrics.descriptionOnlyRiskRows}, bareGpu=${source.metrics.bareGpuRiskRows}, shopTemplate=${source.metrics.shopTemplateRiskRows}`,
    },
    {
      id: "READINESS-04",
      status: keyShapePresent ? "pass" : "blocked",
      check: "owner packet has a concrete comparable key shape",
      detail: owner.recommendedDecisions.comparableKeyShape,
    },
    {
      id: "READINESS-05",
      status: owner.recommendedDecisions.initialReadiness === "internal_only" ? "pass" : "blocked",
      check: "initial readiness recommendation stays internal_only",
      detail: `initialReadiness=${owner.recommendedDecisions.initialReadiness}`,
    },
    {
      id: "READINESS-06",
      status: ownerStillPending ? "blocked" : "pass",
      check: "owner approval is still pending before executor drafting",
      detail: ownerStillPending
        ? "owner packet is prepared but not applied; executor can be drafted later only after explicit owner go/no-go"
        : "owner packet indicates approval state changed",
    },
  ];
}

function buildBlockedOwnerDecisions(source: SourceBackfill, owner: OwnerPacket): BlockedOwnerDecision[] {
  const weakRows = source.marketplaceRiskRows.filter((row) => row.ownerDecisionEvidenceQuality === "weak").length;
  return [
    {
      id: "OWNER-DECISION-01",
      decision: "Approve whether a no-mutation executor should be drafted at all",
      currentRecommendation: "not yet approved",
      neededBeforeExecutor: "Main/owner explicitly requests a report-only executor draft using the source backfill and owner defaults.",
      blockerSeverity: "must_decide",
    },
    {
      id: "OWNER-DECISION-02",
      decision: "Confirm runtime category name",
      currentRecommendation: owner.recommendedDecisions.runtimeCategoryName,
      neededBeforeExecutor: "Choose desktop or desktop_pc so executor output can use one consistent category axis.",
      blockerSeverity: "confirm_recommendation",
    },
    {
      id: "OWNER-DECISION-03",
      decision: "Confirm comparable key shape",
      currentRecommendation: owner.recommendedDecisions.comparableKeyShape,
      neededBeforeExecutor: "Approve the exact key string shape, including private_used_body and fixed_one_off axes.",
      blockerSeverity: "confirm_recommendation",
    },
    {
      id: "OWNER-DECISION-04",
      decision: "Confirm title-visible CPU/GPU gate",
      currentRecommendation: `descriptionBackedCpu=${owner.recommendedDecisions.descriptionBackedCpu}; bareGpuTokens=${owner.recommendedDecisions.bareGpuTokens}`,
      neededBeforeExecutor: "Keep description-only CPU and bare 5080/9070xt GPU rows manual/hold unless owner changes policy.",
      blockerSeverity: "must_decide",
    },
    {
      id: "OWNER-DECISION-05",
      decision: "Confirm shop/configurable-template split",
      currentRecommendation: "exclude shop/configurable/new-build templates from private-used fixed one-off positives",
      neededBeforeExecutor: "Executor fixtures must hard-hold shop templates, upgrade-option menus, receipt/A-S rows, and configurable new-build listings.",
      blockerSeverity: "must_decide",
    },
    {
      id: "OWNER-DECISION-06",
      decision: "Confirm weak evidence rows remain manual",
      currentRecommendation: `${weakRows} weak source-risk rows remain manual/hold`,
      neededBeforeExecutor: "Do not let weak description-only or bare-token evidence become candidate positive executor rows.",
      blockerSeverity: "confirm_recommendation",
    },
    {
      id: "OWNER-DECISION-07",
      decision: "Confirm runtime/public/candidate-pool gates remain closed",
      currentRecommendation: "runtimeApproval=false, publicPromotion=false, candidatePool=false",
      neededBeforeExecutor: "Executor output must stay no-mutation and report-only with all approval rows at 0.",
      blockerSeverity: "must_decide",
    },
  ];
}

function buildExecutorDraftEnvelope(source: SourceBackfill): ExecutorDraftEnvelope {
  const normalizedCpu = source.sourceEvidence.filter((row) => row.axis === "cpu").map((row) => row.normalizedToken);
  const normalizedGpu = source.sourceEvidence.filter((row) => row.axis === "gpu").map((row) => row.normalizedToken);
  return {
    canDraftLater: true,
    canRunNow: false,
    runtimeApproval: false,
    recommendedFutureExecutorScope:
      "Report-only dry-run executor over existing desktop fixture packets, emitting candidate_positive/manual_review/negative_hold decisions without parser/runtime mutation.",
    requiredInputReports: [
      ...inputFiles,
      "reports/desktop-private-used-no-mutation-preflight-latest.json",
      "reports/desktop-category-axis-no-mutation-dry-run-plan-latest.json",
      "reports/desktop-private-used-targeted-acquisition-latest.json",
      "reports/desktop-private-used-positive-backfill-latest.json",
    ],
    requiredFixtureClasses: [
      {
        class: "candidate_positive_only",
        requiredEvidence: `title-visible CPU in approved set (${normalizedCpu.join(", ")}) plus title-visible RTX/RX GPU in approved set (${normalizedGpu.join(", ")}) plus fixed one-off private-used body evidence`,
      },
      {
        class: "manual_review_only",
        requiredEvidence: "description-only CPU, bare GPU token, bare CPU shorthand, body-plus-monitor add-on, insufficient private-used wording, or unresolved source confidence",
      },
      {
        class: "negative_hold_only",
        requiredEvidence: "shop/configurable/new-build template, software/license/accessory, GPU-only missing CPU, commercial/mining, or public/candidate-pool risk row",
      },
    ],
    forbiddenExecutorBehavior: [
      "Do not import or call runtime/src/lib parser/catalog/pipeline modules.",
      "Do not mutate Supabase or production data.",
      "Do not mark runtime approval, public promotion, candidate-pool readiness, or runtime apply as true.",
      "Do not generate public promotion or candidate-pool wiring.",
      "Do not touch the main-agent-owned 30-day decision log.",
      "Do not accept description-only CPU or bare GPU tokens as positives without owner decision.",
    ],
  };
}

function mdCell(value: unknown): string {
  return String(value ?? "null").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function buildMarkdown(report: Report): string {
  const lines = [
    "# Desktop CPU/GPU No-Mutation Executor Readiness",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- lane: ${report.lane}`,
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
    "## Readiness Summary",
    "",
    `- canDraftLater: ${report.executorDraftEnvelope.canDraftLater}`,
    `- canRunNow: ${report.executorDraftEnvelope.canRunNow}`,
    `- runtimeApproval: ${report.executorDraftEnvelope.runtimeApproval}`,
    `- blockedOwnerDecisions: ${report.metrics.blockedOwnerDecisions}`,
    `- readinessChecks: ${report.metrics.passedReadinessChecks} pass / ${report.metrics.blockedReadinessChecks} blocked`,
    "",
    "## Readiness Checks",
    "",
    "| id | status | check | detail |",
    "| --- | --- | --- | --- |",
    ...report.readinessChecks.map((row) => `| ${row.id} | ${row.status} | ${mdCell(row.check)} | ${mdCell(row.detail)} |`),
    "",
    "## Blocked Owner Decisions",
    "",
    "| id | severity | decision | current recommendation | needed before executor |",
    "| --- | --- | --- | --- | --- |",
    ...report.blockedOwnerDecisions.map((row) =>
      `| ${row.id} | ${row.blockerSeverity} | ${mdCell(row.decision)} | ${mdCell(row.currentRecommendation)} | ${mdCell(row.neededBeforeExecutor)} |`,
    ),
    "",
    "## Future Executor Envelope",
    "",
    `- scope: ${report.executorDraftEnvelope.recommendedFutureExecutorScope}`,
    "",
    "Required fixture classes:",
    "",
    ...report.executorDraftEnvelope.requiredFixtureClasses.map((row) => `- ${row.class}: ${row.requiredEvidence}`),
    "",
    "Forbidden executor behavior:",
    "",
    ...report.executorDraftEnvelope.forbiddenExecutorBehavior.map((item) => `- ${item}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const source = await readJson<SourceBackfill>(inputFiles[0]);
  const owner = await readJson<OwnerPacket>(inputFiles[1]);
  const readinessChecks = buildChecks(source, owner);
  const blockedOwnerDecisions = buildBlockedOwnerDecisions(source, owner);
  const executorDraftEnvelope = buildExecutorDraftEnvelope(source);
  const blockedReadinessChecks = readinessChecks.filter((row) => row.status === "blocked").length;
  const report: Report = {
    generatedAt,
    reportOnly: true,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    lane: "desktop_cpu_gpu_no_mutation_executor_readiness",
    inputFiles,
    metrics: {
      sourceEvidenceRows: source.metrics.sourceEvidenceRows,
      officialSourceRows: source.metrics.officialSourceRows,
      sourceBackfillRiskRows: source.metrics.marketplaceRiskRows,
      readinessChecks: readinessChecks.length,
      passedReadinessChecks: readinessChecks.length - blockedReadinessChecks,
      blockedReadinessChecks,
      blockedOwnerDecisions: blockedOwnerDecisions.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
    },
    readinessChecks,
    blockedOwnerDecisions,
    executorDraftEnvelope,
    conclusion: "no_mutation_executor_can_be_drafted_later_after_owner_decisions_report_only",
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
