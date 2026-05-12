import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SourceBackfill = {
  conclusion: string;
  boundary: Record<string, boolean | number>;
  metrics: {
    evidenceRows: number;
    officialNintendoRows: number;
    officialSupportRows: number;
    internalPolicyFixtureRows: number;
    boundaryRows: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
  evidenceRows: Array<{
    id: string;
    kind: string;
    title: string;
    sourceTier: string;
    comparableKeyImplication: string;
    manualReviewBoundary: string;
  }>;
  boundaryRows: Array<{
    gate: string;
    classification: "manual_review" | "hold";
    decision: string;
  }>;
};

type OwnerPacket = {
  conclusion: string;
  boundary: Record<string, boolean | number>;
  metrics: {
    fixtureRows: number;
    ownerDecisionRows: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
  ownerDecisionsRequired: string[];
  fixtures: Array<{
    caseId: string;
    title: string;
    gate: string;
    proposedComparableKey: string | null;
    expectedDecision: string;
    ownerDecisionRequired: string;
    runtimeApproved: false;
    publicPromotion: false;
    candidatePool: false;
    runtimeApply: false;
  }>;
};

type ReadinessRow = {
  gate: string;
  readiness: "draftable_manual_review_only" | "draftable_hold_only" | "blocked_owner_decision_required";
  executorExpectation: string;
  fixtureCaseIds: string[];
  sourceEvidenceKinds: string[];
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
};

const reportsDir = path.join(process.cwd(), "reports");
const outputJsonPath = path.join(reportsDir, "game-console-switch-2-no-mutation-executor-readiness-latest.json");
const outputMdPath = path.join(reportsDir, "game-console-switch-2-no-mutation-executor-readiness-latest.md");

const inputFiles = {
  governingWorkOrder: "reports/subagent-source-backfill-wave-2026-05-12.md",
  sourceBackfillJson: "reports/game-console-switch-2-source-backfill-latest.json",
  ownerDecisionPacketJson: "reports/game-console-switch-2-owner-decision-packet-latest.json",
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(process.cwd(), file), "utf8")) as T;
}

async function readInputs(): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Object.entries(inputFiles).map(async ([key, file]) => {
      const raw = await readFile(path.join(process.cwd(), file), "utf8");
      if (!file.endsWith(".json")) return [key, { path: file, bytes: raw.length, kind: "markdown" }] as const;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return [
        key,
        {
          path: file,
          bytes: raw.length,
          kind: "json",
          rows: Array.isArray(parsed.fixtures)
            ? parsed.fixtures.length
            : Array.isArray(parsed.evidenceRows)
              ? parsed.evidenceRows.length
              : null,
        },
      ] as const;
    }),
  );
  return Object.fromEntries(entries);
}

function fixtureIds(ownerPacket: OwnerPacket, gate: string): string[] {
  return ownerPacket.fixtures.filter((fixture) => fixture.gate === gate).map((fixture) => fixture.caseId);
}

function sourceKinds(sourceBackfill: SourceBackfill, gates: string[]): string[] {
  const matchingEvidenceIds = new Set(
    sourceBackfill.boundaryRows.filter((row) => gates.includes(row.gate)).flatMap((row) => {
      if (row.gate === "console_body") return ["console_body", "release_current_status"];
      if (row.gate === "bundle_package") return ["bundle_package", "game_software"];
      if (row.gate === "accessory_controller_only") return ["accessory"];
      if (row.gate === "game_software") return ["game_software", "bundle_package"];
      if (row.gate === "sold_only_buying_damaged") return ["marketplace_boundary"];
      return [];
    }),
  );
  return [...matchingEvidenceIds];
}

function buildReadinessRows(sourceBackfill: SourceBackfill, ownerPacket: OwnerPacket): ReadinessRow[] {
  return [
    {
      gate: "body_only_vs_full_set",
      readiness: "blocked_owner_decision_required",
      executorExpectation:
        "A later no-mutation executor can assert Switch 2 body/full-set rows stay manual_review_only, but cannot approve body_only/full_set positives until owner defines evidence requirements.",
      fixtureCaseIds: [...fixtureIds(ownerPacket, "body_only_vs_bundle"), ...fixtureIds(ownerPacket, "region_version")],
      sourceEvidenceKinds: sourceKinds(sourceBackfill, ["console_body"]),
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
    {
      gate: "bundle_package",
      readiness: "blocked_owner_decision_required",
      executorExpectation:
        "Executor can preserve official Mario Kart World bundle rows as manual_review_only and verify they do not collapse into plain full_set without owner decision.",
      fixtureCaseIds: fixtureIds(ownerPacket, "bundle_or_edition"),
      sourceEvidenceKinds: sourceKinds(sourceBackfill, ["bundle_package"]),
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
    {
      gate: "accessory_controller_only",
      readiness: "draftable_hold_only",
      executorExpectation:
        "Executor can assert controller, dock, case, grip, cable, camera, amiibo, storage, and accessory-only rows hold/exclude and never emit Switch 2 body keys.",
      fixtureCaseIds: fixtureIds(ownerPacket, "accessory_controller_only"),
      sourceEvidenceKinds: sourceKinds(sourceBackfill, ["accessory_controller_only"]),
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
    {
      gate: "game_software",
      readiness: "draftable_hold_only",
      executorExpectation:
        "Executor can assert game cards, packages, download codes, and software-only rows hold as media/software contamination.",
      fixtureCaseIds: fixtureIds(ownerPacket, "game_software"),
      sourceEvidenceKinds: sourceKinds(sourceBackfill, ["game_software"]),
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
    {
      gate: "sold_only_title_sold",
      readiness: "draftable_hold_only",
      executorExpectation:
        "Executor can assert sold-only/title-sold rows do not enter live runtime/public/candidate flow; any offline evidence use remains owner-only.",
      fixtureCaseIds: fixtureIds(ownerPacket, "sold_only_or_title_sold"),
      sourceEvidenceKinds: sourceKinds(sourceBackfill, ["sold_only_buying_damaged"]),
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
    {
      gate: "buying",
      readiness: "draftable_hold_only",
      executorExpectation:
        "Executor can assert buying/매입/삽니다 rows stay hold/excluded from seller-listing validation.",
      fixtureCaseIds: fixtureIds(ownerPacket, "buying"),
      sourceEvidenceKinds: sourceKinds(sourceBackfill, ["sold_only_buying_damaged"]),
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
    {
      gate: "damaged_parts",
      readiness: "draftable_hold_only",
      executorExpectation:
        "Executor can assert damaged, repair, locked, banned, parts-only, or defect rows stay hold even with Switch 2 body tokens.",
      fixtureCaseIds: fixtureIds(ownerPacket, "damaged_or_parts"),
      sourceEvidenceKinds: sourceKinds(sourceBackfill, ["sold_only_buying_damaged"]),
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
  ];
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    },
    {} as Record<T, number>,
  );
}

function markdownEscape(value: string | null): string {
  return (value ?? "null").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function buildMarkdown(report: Record<string, unknown>): string {
  const boundary = report.boundary as Record<string, unknown>;
  const metrics = report.metrics as Record<string, unknown>;
  const rows = report.readinessRows as ReadinessRow[];
  const blockers = report.blockersBeforeExecutorDraft as string[];

  const lines = [
    "# Game Console Switch 2 No-Mutation Executor Readiness",
    "",
    `- generatedAt: ${report.generatedAt}`,
    "- category: game_console_body_narrow",
    "- lane: switch_2_manual_review_no_mutation_executor_readiness",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    `- reportOnly: ${boundary.reportOnly}`,
    `- runtimeCatalogApply: ${boundary.runtimeCatalogApply}`,
    `- runtimeApply: ${boundary.runtimeApply}`,
    `- publicPromotion: ${boundary.publicPromotion}`,
    `- candidatePoolPolicyWiring: ${boundary.candidatePoolPolicyWiring}`,
    `- productionDbMutation: ${boundary.productionDbMutation}`,
    `- directThirtyDayPlanEdit: ${boundary.directThirtyDayPlanEdit}`,
    `- runtimeApprovedRows: ${boundary.runtimeApprovedRows}`,
    `- publicPromotionRows: ${boundary.publicPromotionRows}`,
    `- candidatePoolRows: ${boundary.candidatePoolRows}`,
    `- runtimeApplyRows: ${boundary.runtimeApplyRows}`,
    "",
    "## Metrics",
    "",
    `- inputEvidenceRows: ${metrics.inputEvidenceRows}`,
    `- inputOwnerFixtures: ${metrics.inputOwnerFixtures}`,
    `- readinessRows: ${metrics.readinessRows}`,
    `- draftableHoldOnlyRows: ${metrics.draftableHoldOnlyRows}`,
    `- blockedOwnerDecisionRows: ${metrics.blockedOwnerDecisionRows}`,
    `- canDraftNoMutationExecutorLater: ${metrics.canDraftNoMutationExecutorLater}`,
    `- canRuntimeApprove: ${metrics.canRuntimeApprove}`,
    `- runtimeApprovedRows: ${metrics.runtimeApprovedRows}`,
    `- publicPromotionRows: ${metrics.publicPromotionRows}`,
    `- candidatePoolRows: ${metrics.candidatePoolRows}`,
    `- runtimeApplyRows: ${metrics.runtimeApplyRows}`,
    "",
    "## Readiness Rows",
    "",
    "| gate | readiness | fixtures | expectation |",
    "| --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.gate} | ${row.readiness} | ${row.fixtureCaseIds.join(", ")} | ${markdownEscape(row.executorExpectation)} |`,
    ),
    "",
    "## Blockers Before Executor Draft",
    "",
    ...blockers.map((blocker) => `- ${blocker}`),
    "",
    "## Recommendation",
    "",
    "- A future no-mutation executor can be drafted for internal/manual-review validation only.",
    "- It should assert manual/hold outcomes and closed boundaries, not runtime positives.",
    "- Body vs bundle remains owner-blocked; accessory/software/sold/buying/damaged boundaries are draftable as hold-only assertions.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const inputReadSummary = await readInputs();
  const sourceBackfill = await readJson<SourceBackfill>(inputFiles.sourceBackfillJson);
  const ownerPacket = await readJson<OwnerPacket>(inputFiles.ownerDecisionPacketJson);
  const readinessRows = buildReadinessRows(sourceBackfill, ownerPacket);
  const runtimeApprovedRows =
    readinessRows.filter((row) => row.runtimeApproved).length +
    sourceBackfill.metrics.runtimeApprovedRows +
    ownerPacket.metrics.runtimeApprovedRows;
  const publicPromotionRows =
    readinessRows.filter((row) => row.publicPromotion).length +
    sourceBackfill.metrics.publicPromotionRows +
    ownerPacket.metrics.publicPromotionRows;
  const candidatePoolRows =
    readinessRows.filter((row) => row.candidatePool).length +
    sourceBackfill.metrics.candidatePoolRows +
    ownerPacket.metrics.candidatePoolRows;
  const runtimeApplyRows =
    readinessRows.filter((row) => row.runtimeApply).length +
    sourceBackfill.metrics.runtimeApplyRows +
    ownerPacket.metrics.runtimeApplyRows;

  const boundary = {
    reportOnly: true,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    runtimeApproved: false,
    runtimeApprovedRows,
    publicPromotionRows,
    candidatePoolRows,
    runtimeApplyRows,
  };

  const blockedOwnerDecisionRows = readinessRows.filter((row) => row.readiness === "blocked_owner_decision_required").length;
  const metrics = {
    inputEvidenceRows: sourceBackfill.metrics.evidenceRows,
    inputBoundaryRows: sourceBackfill.metrics.boundaryRows,
    inputOwnerFixtures: ownerPacket.metrics.fixtureRows,
    inputOwnerDecisionRows: ownerPacket.metrics.ownerDecisionRows,
    readinessRows: readinessRows.length,
    readinessCounts: countBy(readinessRows.map((row) => row.readiness)),
    draftableHoldOnlyRows: readinessRows.filter((row) => row.readiness === "draftable_hold_only").length,
    blockedOwnerDecisionRows,
    canDraftNoMutationExecutorLater: true,
    canRuntimeApprove: false,
    runtimeApprovedRows,
    publicPromotionRows,
    candidatePoolRows,
    runtimeApplyRows,
  };

  const report = {
    generatedAt,
    reportOnly: true,
    ownership: "game_console_switch_2_no_mutation_executor_readiness_only",
    category: "game_console_body_narrow",
    lane: "switch_2_manual_review_no_mutation_executor_readiness",
    conclusion: "no_mutation_executor_draftable_later_for_internal_manual_review_only_no_runtime_approval",
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    boundary,
    inputFiles,
    inputReadSummary,
    sourceBackfillConclusion: sourceBackfill.conclusion,
    ownerPacketConclusion: ownerPacket.conclusion,
    metrics,
    readinessRows,
    preservedBoundaries: [
      "body_only_vs_full_set remains manual-review and owner-blocked",
      "official Mario Kart World bundle remains manual-review and owner-blocked",
      "accessory/controller-only rows remain hold-only",
      "game/software rows remain hold-only",
      "sold-only/title-sold rows remain hold-only for live flow",
      "buying rows remain hold-only",
      "damaged/parts rows remain hold-only",
    ],
    blockersBeforeExecutorDraft: [
      "Owner must decide Switch 2 body_only vs full_set evidence requirements.",
      "Owner must decide official bundle/package key behavior before any positive fixture expectation.",
      "Executor draft should be no-mutation and assert manual_review_only/hold_only outcomes only.",
      "Executor draft must keep runtimeApproved/publicPromotion/candidatePool/runtimeApply at false/0.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  JSON.parse(json);
  await writeFile(outputJsonPath, json);
  await writeFile(outputMdPath, buildMarkdown(report));

  console.log(`wrote ${path.relative(process.cwd(), outputJsonPath)}`);
  console.log(`wrote ${path.relative(process.cwd(), outputMdPath)}`);
  console.log(`switch2 executor readiness: draftable_later=${metrics.canDraftNoMutationExecutorLater}, runtime_approve=${metrics.canRuntimeApprove}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
