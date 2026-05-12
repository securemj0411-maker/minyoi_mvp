import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type BoundaryReport = {
  metrics?: {
    switch2KeyRows?: number;
    switch2Units?: number;
    runtimeApprovedRows?: number;
    boundaryClassCounts?: CountRow[];
  };
  boundaryRows?: Array<{
    key: string;
    count: number;
    coverageClass: string;
    family?: string;
    edition?: string;
    bodyScope?: string;
    boundaryClass?: string;
    reviewAction?: string;
    runtimeApproved?: boolean;
  }>;
};

type SelectorReport = {
  selectedWorkItems?: Array<{
    category: string;
    lane: string;
    type: string;
    recommendation: string;
    deliverable: string;
  }>;
  metrics?: Record<string, number>;
};

type FixtureDecision =
  | "manual_review_switch_2_body_scope"
  | "manual_review_switch_2_bundle_scope"
  | "manual_review_switch_2_region_version"
  | "hold_accessory_controller_only"
  | "hold_game_software_only"
  | "hold_sold_only_or_title_sold"
  | "hold_buying_request"
  | "hold_damaged_or_parts";

type FixtureRow = {
  caseId: string;
  title: string;
  gate: string;
  proposedComparableKey: string | null;
  expectedDecision: FixtureDecision;
  ownerDecisionRequired: string;
  rationale: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
};

const reportsDir = path.join(process.cwd(), "reports");
const outputJsonPath = path.join(reportsDir, "game-console-switch-2-owner-decision-packet-latest.json");
const outputMdPath = path.join(reportsDir, "game-console-switch-2-owner-decision-packet-latest.md");

const inputFiles = {
  categoryNextWaveSelectorMd: "reports/category-next-wave-selector-latest.md",
  categoryNextWaveSelectorJson: "reports/category-next-wave-selector-latest.json",
  bodyEditionBoundaryEvidenceJson: "reports/game-console-body-edition-boundary-evidence-latest.json",
  bodyEditionBoundaryEvidenceMd: "reports/game-console-body-edition-boundary-evidence-latest.md",
  evidenceMatrixJson: "reports/game-console-evidence-matrix-latest.json",
  contaminationEvidenceMatrixJson: "reports/game-console-contamination-evidence-matrix-latest.json",
  exclusionReadinessJson: "reports/game-console-exclusion-readiness-latest.json",
  noMutationRuntimeDryRunJson: "reports/game-console-no-mutation-runtime-dry-run-latest.json",
};

const fixtures: FixtureRow[] = [
  {
    caseId: "SWITCH2-OWNER-001",
    title: "닌텐도 스위치2 본체 풀박스",
    gate: "body_only_vs_bundle",
    proposedComparableKey: "game_console|nintendo_switch|switch_2|full_set",
    expectedDecision: "manual_review_switch_2_body_scope",
    ownerDecisionRequired: "Decide whether Switch 2 full-set body rows may ever become a positive key, or must stay manual until stable market/version evidence exists.",
    rationale: "Existing dry-run fixture already treats Switch 2 full_set as manual_review_only despite high parse confidence.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    caseId: "SWITCH2-OWNER-002",
    title: "닌텐도 스위치2 본체만 판매",
    gate: "body_only_vs_bundle",
    proposedComparableKey: "game_console|nintendo_switch|switch_2|body_only",
    expectedDecision: "manual_review_switch_2_body_scope",
    ownerDecisionRequired: "Decide whether body_only and full_set should be distinct comparable keys for Switch 2, and whether box/dock/joy-con evidence is required.",
    rationale: "Boundary evidence has both switch_2 full_set and body_only review-gated keys.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    caseId: "SWITCH2-OWNER-003",
    title: "닌텐도 스위치2 마리오카트 월드 에디션 미개봉",
    gate: "bundle_or_edition",
    proposedComparableKey: null,
    expectedDecision: "manual_review_switch_2_bundle_scope",
    ownerDecisionRequired: "Decide whether named retail bundles such as Mario Kart World Edition are hardware bundle keys, software-contaminated holds, or separate edition keys.",
    rationale: "Current contamination evidence includes Switch 2 software/bundle-looking titles under unknown/body hold pressure.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    caseId: "SWITCH2-OWNER-004",
    title: "[일본판] 닌텐도 스위치2 본체 풀박스",
    gate: "region_version",
    proposedComparableKey: "game_console|nintendo_switch|switch_2|full_set",
    expectedDecision: "manual_review_switch_2_region_version",
    ownerDecisionRequired: "Decide whether Korea/Japan/US/Hong Kong region tokens affect comparable-key granularity or remain informational review notes.",
    rationale: "Region/version policy is not established for Switch 2 and could split market price comparability.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    caseId: "SWITCH2-OWNER-005",
    title: "닌텐도 스위치2 프로콘 컨트롤러 미개봉",
    gate: "accessory_controller_only",
    proposedComparableKey: null,
    expectedDecision: "hold_accessory_controller_only",
    ownerDecisionRequired: "Confirm controller-only, dock-only, case, grip, cable, and accessory rows stay outside Switch 2 body policy.",
    rationale: "Existing exclusion reports keep accessory/controller-only rows out of hardware body readiness.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    caseId: "SWITCH2-OWNER-006",
    title: "닌텐도 스위치2 마리오카트 월드 게임칩",
    gate: "game_software",
    proposedComparableKey: null,
    expectedDecision: "hold_game_software_only",
    ownerDecisionRequired: "Confirm game software, game card, code, and download-code rows are held as media/title contamination.",
    rationale: "Broad game console contamination is dominated by game title/media rows and must not feed body policy.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    caseId: "SWITCH2-OWNER-007",
    title: "판매완료 닌텐도 스위치2 본체 풀박스",
    gate: "sold_only_or_title_sold",
    proposedComparableKey: null,
    expectedDecision: "hold_sold_only_or_title_sold",
    ownerDecisionRequired: "Decide whether sold-only/title-sold rows may be used for offline price evidence, but confirm they do not enter live candidate flow.",
    rationale: "Sold-only rows can contaminate active listing acquisition and should remain out of runtime/candidate-pool surfaces.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    caseId: "SWITCH2-OWNER-008",
    title: "닌텐도 스위치2 삽니다 매입 구해요",
    gate: "buying",
    proposedComparableKey: null,
    expectedDecision: "hold_buying_request",
    ownerDecisionRequired: "Confirm buying/매입/삽니다 posts are excluded from seller-listing parser and owner review fixtures.",
    rationale: "Existing exclusion readiness keeps buying posts as hold/exclude contamination.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    caseId: "SWITCH2-OWNER-009",
    title: "닌텐도 스위치2 액정파손 부품용 본체",
    gate: "damaged_or_parts",
    proposedComparableKey: null,
    expectedDecision: "hold_damaged_or_parts",
    ownerDecisionRequired: "Confirm damaged, repair-needed, parts-only, ban/lock, missing-screen, or defect rows remain hold even with Switch 2 body tokens.",
    rationale: "Damaged/parts rows break clean body price comparability and need a separate salvage policy if ever used.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
];

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), file), "utf8")) as T;
  } catch {
    return null;
  }
}

async function readInputs(): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Object.entries(inputFiles).map(async ([key, file]) => {
      const raw = await readFile(path.join(process.cwd(), file), "utf8");
      if (!file.endsWith(".json")) return [key, { path: file, bytes: raw.length, kind: "markdown" }] as const;
      const parsed: unknown = JSON.parse(raw);
      const rows =
        typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { rows?: unknown[] }).rows)
          ? (parsed as { rows: unknown[] }).rows.length
          : null;
      return [key, { path: file, bytes: raw.length, kind: "json", rows }] as const;
    }),
  );
  return Object.fromEntries(entries);
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
  const metrics = report.metrics as Record<string, unknown>;
  const boundary = report.boundary as Record<string, unknown>;
  const sourceSummary = report.sourceSummary as Record<string, unknown>;
  const ownerDecisions = report.ownerDecisionsRequired as string[];
  const rows = report.fixtures as FixtureRow[];
  const gateCounts = metrics.fixtureGateCounts as Record<string, number>;

  const lines = [
    "# Game Console Switch 2 Owner Decision Packet",
    "",
    `- generatedAt: ${report.generatedAt}`,
    "- category: game_console_body_narrow",
    "- lane: switch_2_manual_review_gate_owner_decision_packet",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    `- reportOnly: ${boundary.reportOnly}`,
    `- runtimeApprovedRows: ${boundary.runtimeApprovedRows}`,
    `- publicPromotionRows: ${boundary.publicPromotionRows}`,
    `- candidatePoolRows: ${boundary.candidatePoolRows}`,
    `- runtimeApplyRows: ${boundary.runtimeApplyRows}`,
    `- runtimeCatalogApply: ${boundary.runtimeCatalogApply}`,
    `- productionDbMutation: ${boundary.productionDbMutation}`,
    `- directThirtyDayPlanEdit: ${boundary.directThirtyDayPlanEdit}`,
    "",
    "## Source Summary",
    "",
    `- selectorRecommendation: ${sourceSummary.selectorRecommendation}`,
    `- existingSwitch2KeyRows: ${sourceSummary.existingSwitch2KeyRows}`,
    `- existingSwitch2Units: ${sourceSummary.existingSwitch2Units}`,
    `- existingRuntimeApprovedRows: ${sourceSummary.existingRuntimeApprovedRows}`,
    "",
    "## Metrics",
    "",
    `- fixtureRows: ${metrics.fixtureRows}`,
    `- ownerDecisionRows: ${metrics.ownerDecisionRows}`,
    `- policyFixtureRows: ${metrics.policyFixtureRows}`,
    `- runtimeApprovedRows: ${metrics.runtimeApprovedRows}`,
    `- publicPromotionRows: ${metrics.publicPromotionRows}`,
    `- candidatePoolRows: ${metrics.candidatePoolRows}`,
    `- runtimeApplyRows: ${metrics.runtimeApplyRows}`,
    "",
    "## Fixture Gate Counts",
    "",
    "| gate | rows |",
    "| --- | ---: |",
    ...Object.entries(gateCounts).map(([gate, count]) => `| ${gate} | ${count} |`),
    "",
    "## Owner Decisions Required",
    "",
    ...ownerDecisions.map((decision) => `- ${decision}`),
    "",
    "## Policy Fixtures",
    "",
    "| caseId | gate | expectedDecision | proposedComparableKey | title |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.caseId} | ${row.gate} | ${row.expectedDecision} | ${markdownEscape(row.proposedComparableKey)} | ${markdownEscape(row.title)} |`,
    ),
    "",
    "## Notes",
    "",
    "- This packet is for owner review only and must not be used as runtime readiness.",
    "- Switch 2 body-only/full-set keys remain manual-review gated until the owner decisions above are resolved.",
    "- Accessory/controller-only, software, sold-only, buying, and damaged/parts rows stay excluded from candidate/public flow.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const inputReadSummary = await readInputs();
  const selector = await readJson<SelectorReport>(inputFiles.categoryNextWaveSelectorJson);
  const boundaryEvidence = await readJson<BoundaryReport>(inputFiles.bodyEditionBoundaryEvidenceJson);
  const selectorRow = selector?.selectedWorkItems?.find((row) => row.lane === "switch_2_manual_review_gate_owner_decision_packet");
  const switch2BoundaryRows = boundaryEvidence?.boundaryRows?.filter((row) => row.key.includes("switch_2")) ?? [];

  const boundary = {
    reportOnly: true,
    runtimeApproved: false,
    runtimeApprovedRows: fixtures.filter((row) => row.runtimeApproved).length,
    publicPromotion: false,
    publicPromotionRows: fixtures.filter((row) => row.publicPromotion).length,
    candidatePool: false,
    candidatePoolRows: fixtures.filter((row) => row.candidatePool).length,
    runtimeApply: false,
    runtimeApplyRows: fixtures.filter((row) => row.runtimeApply).length,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
  };

  const ownerDecisionsRequired = [
    "Body-only vs full-set: decide whether Switch 2 body_only and full_set are separate comparable keys, and what evidence proves each.",
    "Bundle scope: decide whether named retail bundles and game-included listings are hardware bundle keys, software contamination, or separate edition keys.",
    "Region/version: decide whether Korea/Japan/US/Hong Kong/import tokens split comparable keys or remain manual notes.",
    "Accessory/controller-only: confirm controller, dock, case, grip, cable, and accessory rows remain hold/excluded.",
    "Game software: confirm game cards, titles, download codes, and software-only rows remain media contamination.",
    "Sold-only/title-sold: decide whether sold rows can be offline evidence only while staying out of live candidate/runtime flow.",
    "Buying: confirm buying/매입/삽니다 rows stay excluded from seller-listing parser behavior.",
    "Damaged/parts: confirm damaged, parts-only, locked/banned, or defect rows remain hold even with body tokens.",
  ];

  const metrics = {
    fixtureRows: fixtures.length,
    ownerDecisionRows: ownerDecisionsRequired.length,
    policyFixtureRows: fixtures.length,
    fixtureGateCounts: countBy(fixtures.map((row) => row.gate)),
    switch2BoundaryRows: switch2BoundaryRows.length,
    switch2BoundaryUnits: switch2BoundaryRows.reduce((sum, row) => sum + row.count, 0),
    runtimeApprovedRows: boundary.runtimeApprovedRows,
    publicPromotionRows: boundary.publicPromotionRows,
    candidatePoolRows: boundary.candidatePoolRows,
    runtimeApplyRows: boundary.runtimeApplyRows,
  };

  const report = {
    generatedAt,
    reportOnly: true,
    ownership: "game_console_switch_2_owner_decision_packet_only",
    category: "game_console_body_narrow",
    lane: "switch_2_manual_review_gate_owner_decision_packet",
    conclusion: "switch_2_owner_decision_packet_report_only_manual_review_gate_not_runtime_ready",
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    runtimeApply: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    boundary,
    inputFiles,
    inputReadSummary,
    sourceSummary: {
      selectorRecommendation: selectorRow?.recommendation ?? "not_found",
      selectorDeliverable: selectorRow?.deliverable ?? "not_found",
      existingSwitch2KeyRows: boundaryEvidence?.metrics?.switch2KeyRows ?? switch2BoundaryRows.length,
      existingSwitch2Units: boundaryEvidence?.metrics?.switch2Units ?? metrics.switch2BoundaryUnits,
      existingRuntimeApprovedRows: boundaryEvidence?.metrics?.runtimeApprovedRows ?? 0,
      switch2BoundaryRows,
    },
    metrics,
    ownerDecisionsRequired,
    fixtures,
    doNotDo: [
      "Do not edit runtime/src/lib from this packet.",
      "Do not edit Supabase, cron/lifecycle, candidate pool, pack UI, public promotion, or 30일_실행계획.md.",
      "Do not convert Switch 2 review fixtures into runtime positives without owner approval.",
      "Do not merge software/accessory/buying/sold/damaged rows into Switch 2 hardware body keys.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(outputMdPath, buildMarkdown(report));

  console.log(`wrote ${path.relative(process.cwd(), outputJsonPath)}`);
  console.log(`wrote ${path.relative(process.cwd(), outputMdPath)}`);
  console.log(`switch2 owner decisions=${ownerDecisionsRequired.length}, fixtures=${fixtures.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
