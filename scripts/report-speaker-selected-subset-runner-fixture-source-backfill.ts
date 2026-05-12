import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type RunnerDesign = {
  conclusion: string;
  boundary: {
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
  metrics: {
    selectedModels: number;
    queryMatrixRows: number;
    boundaryClasses: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
  queryMatrix: Array<{
    normalizedModel: string;
    expectedComparableKey: string;
    brand: string;
    primaryQueries: string[];
    variantQueries: string[];
    protectedNegativeQueries: string[];
    minActiveSellingRows: number;
    seedPrice: number;
  }>;
  boundaryContract: Array<{
    boundaryClass: string;
    decision: string;
    titleSignals: string[];
    reason: string;
  }>;
};

type SpeakerBackfill = {
  conclusion: string;
  boundary: {
    runtimeApprovedRows: number;
    runtimeApplyRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
  };
  metrics: {
    selectedPositiveMarketRows: number;
    selectedOfficialSpecRows: number;
    selectedModels: number;
    boundaryRows: number;
    boundaryClassCounts: CountRow[];
    runtimeApprovedRows: number;
    runtimeApplyRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
  };
  marketEvidenceRows: Array<{
    caseId: string;
    pid: string;
    brand: string;
    normalizedModel: string;
    expectedComparableKey: string;
    title: string;
    price: number;
    condition: string;
    listingUrl: string;
  }>;
  specEvidenceRows: Array<{
    caseId: string;
    brand: string;
    normalizedModel: string;
    sourceLabel: string;
    sourceType: string;
    url: string;
    confirms: string[];
  }>;
  boundaryRows: Array<{
    caseId: string;
    pid: string;
    boundaryClass: string;
    expectedDecision: string;
    reason: string;
    title: string;
    price: number;
    condition: string;
    saleStatus: string;
    listingUrl: string;
    evidenceSnippet: string;
  }>;
};

type CategoryOrchestration = {
  reportOnly: boolean;
  publicPromotion: boolean;
  runtimeCatalogApply: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  candidates: Array<{
    lane: string;
    status: string;
    blocker: string;
    nextAction: string;
    score: number;
  }>;
};

type BoundaryAudit = {
  reportOnly: boolean;
  runtimeCatalogApply: boolean;
  publicPromotion: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  auditStatus: string;
  metrics: {
    hardFailFindings: number;
    warningFindings: number;
    forbiddenTrueFlags: number;
    forbiddenPositiveCounts: number;
    directThirtyDayPlanRisks: number;
    boundaryGapWarnings: number;
  };
  records: Array<{
    group: string;
    file: string;
    reportOnly: boolean | null;
    forbiddenTrueFlags: string[];
    forbiddenPositiveCounts: string[];
    boundaryGaps: string[];
    contradictions: string[];
  }>;
};

type PositiveFixture = {
  caseId: string;
  fixtureClass: "positive_live_market_seed";
  brand: string;
  normalizedModel: string;
  expectedComparableKey: string;
  title: string;
  sourceCaseId: string;
  sourceType: string;
  sourceLabel: string;
  sourceUrl: string;
  confirms: string[];
  expectedDecision: "live_positive_if_sale_status_selling";
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
};

type HoldFixture = {
  caseId: string;
  fixtureClass: "hold_boundary_fixture";
  boundaryClass: string;
  expectedDecision: string;
  title: string;
  reason: string;
  listingUrl: string;
  saleStatus: string;
  expectedRunnerDecision: "hold" | "manual_review";
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
};

type ExclusionMatrixRow = {
  boundaryClass: string;
  expectedRunnerDecision: "hold" | "manual_review";
  fixtureRows: number;
  sampleTitles: string[];
  titleSignals: string[];
  runnerAssertion: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "speaker-selected-subset-runner-fixture-source-backfill-latest.json");
const outputMdPath = path.join(reportsDir, "speaker-selected-subset-runner-fixture-source-backfill-latest.md");

const inputFiles = {
  runnerDesignJson: "reports/speaker-selected-subset-no-write-live-market-dry-run-runner-design-latest.json",
  runnerDesignMd: "reports/speaker-selected-subset-no-write-live-market-dry-run-runner-design-latest.md",
  marketSpecBackfillJson: "reports/speaker-portable-exact-model-market-spec-backfill-latest.json",
  marketSpecBackfillMd: "reports/speaker-portable-exact-model-market-spec-backfill-latest.md",
  categoryOrchestrationJson: "reports/category-orchestration-status-latest.json",
  orchestrationBoundaryAuditJson: "reports/orchestration-boundary-audit-latest.json",
  handoffMd: "../인수인계.md",
};

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as T;
}

async function readText(relativePath: string): Promise<string> {
  return readFile(path.join(appDir, relativePath), "utf8");
}

async function readInputs(): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Object.entries(inputFiles).map(async ([key, file]) => {
      const raw = await readText(file);
      if (!file.endsWith(".json")) return [key, { path: file, bytes: raw.length, kind: "markdown" }] as const;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return [
        key,
        {
          path: file,
          bytes: raw.length,
          kind: "json",
          rows: Array.isArray(parsed.marketEvidenceRows)
            ? parsed.marketEvidenceRows.length
            : Array.isArray(parsed.queryMatrix)
              ? parsed.queryMatrix.length
              : Array.isArray(parsed.records)
                ? parsed.records.length
                : null,
        },
      ] as const;
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

function markdownEscape(value: string | number | boolean | null | undefined): string {
  return String(value ?? "null").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function buildPositiveFixtures(backfill: SpeakerBackfill): PositiveFixture[] {
  return backfill.marketEvidenceRows.map((marketRow) => {
    const source = backfill.specEvidenceRows.find((row) => row.normalizedModel === marketRow.normalizedModel);
    if (!source) {
      throw new Error(`missing spec evidence for ${marketRow.normalizedModel}`);
    }
    return {
      caseId: `SPEAKER-RUNNER-POS-${String(backfill.marketEvidenceRows.indexOf(marketRow) + 1).padStart(2, "0")}`,
      fixtureClass: "positive_live_market_seed",
      brand: marketRow.brand,
      normalizedModel: marketRow.normalizedModel,
      expectedComparableKey: marketRow.expectedComparableKey,
      title: marketRow.title,
      sourceCaseId: source.caseId,
      sourceType: source.sourceType,
      sourceLabel: source.sourceLabel,
      sourceUrl: source.url,
      confirms: source.confirms,
      expectedDecision: "live_positive_if_sale_status_selling",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    };
  });
}

function expectedRunnerDecision(boundaryClass: string): "hold" | "manual_review" {
  return boundaryClass.includes("manual") || boundaryClass === "home_tabletop_manual" || boundaryClass === "vendor_only_manual"
    ? "manual_review"
    : "hold";
}

function buildHoldFixtures(backfill: SpeakerBackfill): HoldFixture[] {
  return backfill.boundaryRows.map((row) => ({
    caseId: row.caseId,
    fixtureClass: "hold_boundary_fixture",
    boundaryClass: row.boundaryClass,
    expectedDecision: row.expectedDecision,
    title: row.title,
    reason: row.reason,
    listingUrl: row.listingUrl,
    saleStatus: row.saleStatus,
    expectedRunnerDecision: expectedRunnerDecision(row.boundaryClass),
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  }));
}

function buildExclusionMatrix(backfill: SpeakerBackfill, design: RunnerDesign): ExclusionMatrixRow[] {
  const holdFixtures = buildHoldFixtures(backfill);
  const designByClass = new Map(design.boundaryContract.map((row) => [row.boundaryClass, row]));
  const grouped = new Map<string, HoldFixture[]>();
  for (const fixture of holdFixtures) {
    grouped.set(fixture.boundaryClass, [...(grouped.get(fixture.boundaryClass) ?? []), fixture]);
  }
  return [...grouped.entries()].map(([boundaryClass, rows]) => {
    const designRow =
      designByClass.get(boundaryClass) ??
      designByClass.get(boundaryClass === "karaoke_pa" ? "karaoke_pa_partybox" : boundaryClass) ??
      designByClass.get(boundaryClass === "amp_receiver" ? "amp_receiver_passive_bundle" : boundaryClass) ??
      designByClass.get(boundaryClass === "buying_sold_only" ? "buying_sold_reserved_non_live" : boundaryClass) ??
      designByClass.get(boundaryClass === "damaged_or_mixed_bundle" ? "damaged_or_parts" : boundaryClass);
    const expected = expectedRunnerDecision(boundaryClass);
    return {
      boundaryClass,
      expectedRunnerDecision: expected,
      fixtureRows: rows.length,
      sampleTitles: rows.slice(0, 3).map((row) => row.title),
      titleSignals: designRow?.titleSignals ?? [boundaryClass],
      runnerAssertion:
        expected === "hold"
          ? "Must never emit selected portable exact-model positive."
          : "Must remain manual_review until source/device-class evidence is strengthened.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    };
  });
}

function publicGateAudit(orchestration: CategoryOrchestration, audit: BoundaryAudit): Record<string, unknown> {
  const speakerCandidate = orchestration.candidates.find((candidate) => candidate.lane === "speaker_portable_exact_model");
  const speakerAuditRecords = audit.records.filter((record) => record.group.includes("speaker"));
  return {
    orchestrationReportOnly: orchestration.reportOnly,
    orchestrationPublicPromotion: orchestration.publicPromotion,
    orchestrationRuntimeCatalogApply: orchestration.runtimeCatalogApply,
    orchestrationCandidatePoolPolicyWiring: orchestration.candidatePoolPolicyWiring,
    orchestrationProductionDbMutation: orchestration.productionDbMutation,
    speakerCandidateStatus: speakerCandidate?.status ?? "missing",
    speakerCandidateBlocker: speakerCandidate?.blocker ?? "missing",
    speakerCandidateNextAction: speakerCandidate?.nextAction ?? "missing",
    boundaryAuditStatus: audit.auditStatus,
    hardFailFindings: audit.metrics.hardFailFindings,
    warningFindings: audit.metrics.warningFindings,
    forbiddenTrueFlags: audit.metrics.forbiddenTrueFlags,
    forbiddenPositiveCounts: audit.metrics.forbiddenPositiveCounts,
    directThirtyDayPlanRisks: audit.metrics.directThirtyDayPlanRisks,
    boundaryGapWarnings: audit.metrics.boundaryGapWarnings,
    speakerAuditRecords: speakerAuditRecords.length,
    speakerAuditForbiddenTrueFlags: speakerAuditRecords.flatMap((record) => record.forbiddenTrueFlags).length,
    speakerAuditForbiddenPositiveCounts: speakerAuditRecords.flatMap((record) => record.forbiddenPositiveCounts).length,
    speakerAuditBoundaryGaps: speakerAuditRecords.flatMap((record) => record.boundaryGaps).length,
    publicGateClosed: orchestration.publicPromotion === false &&
      orchestration.candidatePoolPolicyWiring === false &&
      audit.metrics.forbiddenTrueFlags === 0 &&
      audit.metrics.forbiddenPositiveCounts === 0,
  };
}

function buildMarkdown(report: Record<string, unknown>): string {
  const boundary = report.boundary as Record<string, unknown>;
  const metrics = report.metrics as Record<string, unknown>;
  const positives = report.positiveFixtures as PositiveFixture[];
  const matrix = report.exclusionMatrix as ExclusionMatrixRow[];
  const gate = report.publicGateClosedAudit as Record<string, unknown>;

  return `${[
    "# Speaker Selected Subset Runner Fixture Source Backfill",
    "",
    `- generatedAt: ${report.generatedAt}`,
    "- category: speaker_audio_discovered",
    "- lane: speaker_selected_subset_runner_fixture_source_backfill",
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
    `- selectedModels: ${metrics.selectedModels}`,
    `- officialOrTrustedSourceRows: ${metrics.officialOrTrustedSourceRows}`,
    `- positiveFixtureRows: ${metrics.positiveFixtureRows}`,
    `- holdFixtureRows: ${metrics.holdFixtureRows}`,
    `- exclusionMatrixRows: ${metrics.exclusionMatrixRows}`,
    `- publicGateClosed: ${metrics.publicGateClosed}`,
    `- runtimeApprovedRows: ${metrics.runtimeApprovedRows}`,
    `- publicPromotionRows: ${metrics.publicPromotionRows}`,
    `- candidatePoolRows: ${metrics.candidatePoolRows}`,
    `- runtimeApplyRows: ${metrics.runtimeApplyRows}`,
    "",
    "## Positive Fixtures With Sources",
    "",
    "| caseId | model | key | sourceType | sourceLabel | expectedDecision |",
    "| --- | --- | --- | --- | --- | --- |",
    ...positives.map(
      (row) =>
        `| ${row.caseId} | ${row.normalizedModel} | ${markdownEscape(row.expectedComparableKey)} | ${row.sourceType} | ${markdownEscape(row.sourceLabel)} | ${row.expectedDecision} |`,
    ),
    "",
    "## Exclusion Matrix",
    "",
    "| boundaryClass | expectedRunnerDecision | fixtureRows | titleSignals | assertion |",
    "| --- | --- | ---: | --- | --- |",
    ...matrix.map(
      (row) =>
        `| ${row.boundaryClass} | ${row.expectedRunnerDecision} | ${row.fixtureRows} | ${markdownEscape(row.titleSignals.join(", "))} | ${markdownEscape(row.runnerAssertion)} |`,
    ),
    "",
    "## Public Gate Closed Audit",
    "",
    `- speakerCandidateStatus: ${gate.speakerCandidateStatus}`,
    `- speakerCandidateBlocker: ${gate.speakerCandidateBlocker}`,
    `- boundaryAuditStatus: ${gate.boundaryAuditStatus}`,
    `- hardFailFindings: ${gate.hardFailFindings}`,
    `- forbiddenTrueFlags: ${gate.forbiddenTrueFlags}`,
    `- forbiddenPositiveCounts: ${gate.forbiddenPositiveCounts}`,
    `- speakerAuditForbiddenTrueFlags: ${gate.speakerAuditForbiddenTrueFlags}`,
    `- speakerAuditForbiddenPositiveCounts: ${gate.speakerAuditForbiddenPositiveCounts}`,
    `- publicGateClosed: ${gate.publicGateClosed}`,
    "",
    "## Recommendation",
    "",
    "- Runner readiness is stronger for report-only/no-write validation.",
    "- Positive fixtures are source-backed selected JBL/LG exact portable models only.",
    "- Accessory, amp/receiver, soundbar, karaoke/PA, damaged/bundle, sold/buying, home-tabletop, and vendor-only rows remain hold/manual boundaries.",
    "- Public promotion, candidate pool wiring, runtime apply, runtime approval, and DB writes remain closed.",
    "",
  ].join("\n")}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const inputReadSummary = await readInputs();
  const [design, backfill, orchestration, audit, handoffText] = await Promise.all([
    readJson<RunnerDesign>(inputFiles.runnerDesignJson),
    readJson<SpeakerBackfill>(inputFiles.marketSpecBackfillJson),
    readJson<CategoryOrchestration>(inputFiles.categoryOrchestrationJson),
    readJson<BoundaryAudit>(inputFiles.orchestrationBoundaryAuditJson),
    readText(inputFiles.handoffMd),
  ]);
  const positives = buildPositiveFixtures(backfill);
  const holds = buildHoldFixtures(backfill);
  const exclusionMatrix = buildExclusionMatrix(backfill, design);
  const gateAudit = publicGateAudit(orchestration, audit);
  const runtimeApprovedRows =
    positives.filter((row) => row.runtimeApproved).length +
    holds.filter((row) => row.runtimeApproved).length +
    exclusionMatrix.filter((row) => row.runtimeApproved).length +
    backfill.metrics.runtimeApprovedRows +
    design.boundary.runtimeApprovedRows;
  const publicPromotionRows =
    positives.filter((row) => row.publicPromotion).length +
    holds.filter((row) => row.publicPromotion).length +
    exclusionMatrix.filter((row) => row.publicPromotion).length +
    backfill.metrics.publicPromotionRows +
    design.boundary.publicPromotionRows;
  const candidatePoolRows =
    positives.filter((row) => row.candidatePool).length +
    holds.filter((row) => row.candidatePool).length +
    exclusionMatrix.filter((row) => row.candidatePool).length +
    backfill.metrics.candidatePoolRows +
    design.boundary.candidatePoolRows;
  const runtimeApplyRows =
    positives.filter((row) => row.runtimeApply).length +
    holds.filter((row) => row.runtimeApply).length +
    exclusionMatrix.filter((row) => row.runtimeApply).length +
    backfill.metrics.runtimeApplyRows +
    design.boundary.runtimeApplyRows;

  const boundary = {
    reportOnly: true,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    runtimeApprovedRows,
    publicPromotionRows,
    candidatePoolRows,
    runtimeApplyRows,
  };
  const metrics = {
    selectedModels: backfill.metrics.selectedModels,
    officialOrTrustedSourceRows: backfill.metrics.selectedOfficialSpecRows,
    positiveFixtureRows: positives.length,
    holdFixtureRows: holds.length,
    exclusionMatrixRows: exclusionMatrix.length,
    exclusionFixtureCounts: countBy(holds.map((row) => row.boundaryClass)),
    sourceTypeCounts: countBy(positives.map((row) => row.sourceType)),
    publicGateClosed: gateAudit.publicGateClosed === true,
    handoffConfirmsReportOnly: handoffText.includes("public 승격이 아니라 internal/report 단계까지만"),
    runtimeApprovedRows,
    publicPromotionRows,
    candidatePoolRows,
    runtimeApplyRows,
  };
  const report = {
    generatedAt,
    reportOnly: true,
    ownership: "speaker_portable_exact_model_runner_fixture_source_backfill_only",
    category: "speaker_audio_discovered",
    lane: "speaker_selected_subset_runner_fixture_source_backfill",
    conclusion: "speaker_selected_subset_runner_fixture_source_backfill_ready_report_only_public_gate_closed",
    boundary,
    inputFiles,
    inputReadSummary,
    sourceConclusions: {
      runnerDesign: design.conclusion,
      marketSpecBackfill: backfill.conclusion,
    },
    metrics,
    positiveFixtures: positives,
    holdFixtures: holds,
    exclusionMatrix,
    publicGateClosedAudit: gateAudit,
    noMutationStatement:
      "This artifact strengthens fixture/source readiness only. It does not implement live fetch, runtime parser changes, Supabase/DB writes, cron/lifecycle, candidate pool, pack UI, auth, public promotion, or 30-day-plan edits.",
  };

  await mkdir(reportsDir, { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  JSON.parse(json);
  await writeFile(outputJsonPath, json);
  await writeFile(outputMdPath, buildMarkdown(report));

  console.log(`wrote ${path.relative(appDir, outputJsonPath)}`);
  console.log(`wrote ${path.relative(appDir, outputMdPath)}`);
  console.log(`speaker fixture/source backfill: positives=${positives.length}, holds=${holds.length}, public_gate_closed=${metrics.publicGateClosed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
