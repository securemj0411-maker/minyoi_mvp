import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ObservationPlan = {
  generatedAt: string;
  category: string;
  lane: string;
  reportOnly: boolean;
  conclusion: string;
  boundary: {
    runtimeApprovedRows: number;
    runtimeApplyRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
  };
  metrics: {
    models: number;
    seedMarketRows: number;
    officialSpecRows: number;
    boundaryRows: number;
    guardrailClasses: number;
    runtimeApprovedRows: number;
    runtimeApplyRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
  };
  modelList: Array<{
    brand: "JBL" | "LG";
    normalizedModel: string;
    expectedComparableKey: string;
    seedCaseId: string;
    seedPid: string;
    seedPrice: number;
    seedCondition: string;
  }>;
  marketSampleNeeds: Array<{ need: string; rule: string }>;
  staleLiveConstraints: string[];
  falsePositiveGuardrails: string[];
  additionalGuardrails: string[];
  requiredFeedbackSignals: string[];
  stopConditions: string[];
};

type QueryMatrixRow = {
  normalizedModel: string;
  expectedComparableKey: string;
  brand: string;
  primaryQueries: string[];
  variantQueries: string[];
  protectedNegativeQueries: string[];
  minActiveSellingRows: number;
  seedPrice: number;
};

type BoundaryContractRow = {
  boundaryClass: string;
  decision: "exclude_hold" | "manual_review";
  titleSignals: string[];
  reason: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
};

const reportsDir = path.join(process.cwd(), "reports");
const outputJsonPath = path.join(
  reportsDir,
  "speaker-selected-subset-no-write-live-market-dry-run-runner-design-latest.json",
);
const outputMdPath = path.join(
  reportsDir,
  "speaker-selected-subset-no-write-live-market-dry-run-runner-design-latest.md",
);

const inputFiles = {
  observationPlanJson: "reports/speaker-selected-subset-internal-observation-plan-latest.json",
};

async function readObservationPlan(): Promise<ObservationPlan> {
  return JSON.parse(await readFile(path.join(process.cwd(), inputFiles.observationPlanJson), "utf8")) as ObservationPlan;
}

async function readInputs(): Promise<Record<string, unknown>> {
  const raw = await readFile(path.join(process.cwd(), inputFiles.observationPlanJson), "utf8");
  const parsed = JSON.parse(raw) as ObservationPlan;
  return {
    observationPlanJson: {
      path: inputFiles.observationPlanJson,
      bytes: raw.length,
      kind: "json",
      models: parsed.modelList.length,
      boundaryRows: parsed.metrics.boundaryRows,
    },
  };
}

function queryMatrix(plan: ObservationPlan): QueryMatrixRow[] {
  const queryMap: Record<string, Omit<QueryMatrixRow, "normalizedModel" | "expectedComparableKey" | "brand" | "seedPrice">> = {
    jbl_go_3: {
      primaryQueries: ["JBL GO 3", "JBL 고3", "JBL GO3"],
      variantQueries: ["제이비엘 GO 3 블루투스 스피커", "JBL GO 3 휴대용 스피커", "JBL GO3 스피커"],
      protectedNegativeQueries: ["JBL GO 3 케이스", "JBL GO 3 충전케이블", "JBL 사운드바"],
      minActiveSellingRows: 3,
    },
    jbl_go_4: {
      primaryQueries: ["JBL GO 4", "JBL 고4", "JBL GO4"],
      variantQueries: ["제이비엘 GO 4 블루투스 스피커", "JBL GO 4 휴대용 스피커", "JBL GO4 스피커"],
      protectedNegativeQueries: ["JBL GO 4 케이스", "JBL GO 4 파우치", "JBL 노래방 스피커"],
      minActiveSellingRows: 3,
    },
    jbl_boombox_2: {
      primaryQueries: ["JBL Boombox 2", "JBL 붐박스2", "JBL 붐박스 2"],
      variantQueries: ["제이비엘 붐박스2 블루투스 스피커", "JBL BOOMBOX2", "JBL Boombox 2 스피커"],
      protectedNegativeQueries: ["JBL Boombox 2 케이스", "JBL PartyBox", "JBL 사운드바"],
      minActiveSellingRows: 3,
    },
    lg_pk5: {
      primaryQueries: ["LG PK5", "엘지 PK5", "LG 엑스붐 PK5"],
      variantQueries: ["LG XBOOM PK5 블루투스 스피커", "엘지 엑스붐 PK5", "LG PK5 스피커"],
      protectedNegativeQueries: ["LG PK5 케이스", "LG 사운드바", "LG 노래방 스피커"],
      minActiveSellingRows: 3,
    },
    lg_pk7w: {
      primaryQueries: ["LG PK7W", "엘지 PK7W", "LG 엑스붐 PK7W"],
      variantQueries: ["LG XBOOM PK7W 블루투스 스피커", "엘지 엑스붐 PK7W", "LG PK7W 스피커"],
      protectedNegativeQueries: ["LG PK7W 케이스", "LG 사운드바", "LG 앰프 스피커"],
      minActiveSellingRows: 3,
    },
  };

  return plan.modelList.map((model) => ({
    normalizedModel: model.normalizedModel,
    expectedComparableKey: model.expectedComparableKey,
    brand: model.brand,
    seedPrice: model.seedPrice,
    ...queryMap[model.normalizedModel],
  }));
}

function boundaryContract(): BoundaryContractRow[] {
  return [
    {
      boundaryClass: "accessory_case_stand",
      decision: "exclude_hold",
      titleSignals: ["케이스", "파우치", "스탠드", "거치대", "충전케이블", "부품"],
      reason: "Accessory-only rows do not represent portable speaker body listings.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
    {
      boundaryClass: "soundbar",
      decision: "exclude_hold",
      titleSignals: ["사운드바", "soundbar", "홈시어터"],
      reason: "Soundbars are a separate device class even when Bluetooth speaker wording appears.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
    {
      boundaryClass: "karaoke_pa_partybox",
      decision: "exclude_hold",
      titleSignals: ["노래방", "마이크", "PA", "PartyBox", "파티박스", "앰프내장"],
      reason: "Karaoke, PA, PartyBox, and microphone systems are not selected portable speaker body rows.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
    {
      boundaryClass: "amp_receiver_passive_bundle",
      decision: "exclude_hold",
      titleSignals: ["앰프", "리시버", "패시브", "오디오세트", "스피커 세트"],
      reason: "Amp/receiver/passive-speaker bundles are separate audio-system rows.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
    {
      boundaryClass: "mixed_bundle",
      decision: "manual_review",
      titleSignals: ["일괄", "세트", "묶음", "+", "덤", "케이블 포함"],
      reason: "Bundle contents can distort model-level portable speaker comparability.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
    {
      boundaryClass: "damaged_or_parts",
      decision: "exclude_hold",
      titleSignals: ["고장", "파손", "부품용", "수리", "작동불", "배터리불량"],
      reason: "Damaged/parts rows are not clean live market samples.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
    {
      boundaryClass: "buying_sold_reserved_non_live",
      decision: "exclude_hold",
      titleSignals: ["삽니다", "구매", "매입", "판매완료", "거래완료", "예약중"],
      reason: "Buying, sold-only, reserved, and non-active rows are not live positive samples.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePool: false,
      runtimeApply: false,
    },
  ];
}

function markdownEscape(value: string | number | boolean | null | undefined): string {
  return String(value ?? "null").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function buildMarkdown(report: Record<string, unknown>): string {
  const boundary = report.boundary as Record<string, unknown>;
  const metrics = report.metrics as Record<string, unknown>;
  const matrix = report.queryMatrix as QueryMatrixRow[];
  const boundaries = report.boundaryContract as BoundaryContractRow[];
  const stopConditions = report.stopConditions as string[];

  return `${[
    "# Speaker Selected Subset No-Write Live-Market Dry-Run Runner Design",
    "",
    `- generatedAt: ${report.generatedAt}`,
    "- category: speaker_audio_discovered",
    "- lane: speaker_selected_subset_no_write_live_market_dry_run_runner_design",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    `- reportOnly: ${boundary.reportOnly}`,
    `- noLiveFetchImplementation: ${boundary.noLiveFetchImplementation}`,
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
    `- queryMatrixRows: ${metrics.queryMatrixRows}`,
    `- primaryQueries: ${metrics.primaryQueries}`,
    `- variantQueries: ${metrics.variantQueries}`,
    `- protectedNegativeQueries: ${metrics.protectedNegativeQueries}`,
    `- boundaryClasses: ${metrics.boundaryClasses}`,
    `- expectedMinimumActiveSellingRows: ${metrics.expectedMinimumActiveSellingRows}`,
    `- runtimeApprovedRows: ${metrics.runtimeApprovedRows}`,
    `- publicPromotionRows: ${metrics.publicPromotionRows}`,
    `- candidatePoolRows: ${metrics.candidatePoolRows}`,
    `- runtimeApplyRows: ${metrics.runtimeApplyRows}`,
    "",
    "## Query Matrix",
    "",
    "| model | key | primaryQueries | variantQueries | protectedNegativeQueries | minActiveSellingRows |",
    "| --- | --- | --- | --- | --- | ---: |",
    ...matrix.map(
      (row) =>
        `| ${row.normalizedModel} | ${markdownEscape(row.expectedComparableKey)} | ${markdownEscape(row.primaryQueries.join(", "))} | ${markdownEscape(row.variantQueries.join(", "))} | ${markdownEscape(row.protectedNegativeQueries.join(", "))} | ${row.minActiveSellingRows} |`,
    ),
    "",
    "## Boundary Contract",
    "",
    "| boundaryClass | decision | titleSignals | reason |",
    "| --- | --- | --- | --- |",
    ...boundaries.map(
      (row) =>
        `| ${row.boundaryClass} | ${row.decision} | ${markdownEscape(row.titleSignals.join(", "))} | ${markdownEscape(row.reason)} |`,
    ),
    "",
    "## Input Schema",
    "",
    "```json",
    JSON.stringify(report.inputSchema, null, 2),
    "```",
    "",
    "## Output Schema",
    "",
    "```json",
    JSON.stringify(report.outputSchema, null, 2),
    "```",
    "",
    "## Stale / Live Interpretation",
    "",
    ...(report.staleLiveInterpretation as string[]).map((line) => `- ${line}`),
    "",
    "## Expected Metrics",
    "",
    ...(report.expectedRunnerMetrics as string[]).map((line) => `- ${line}`),
    "",
    "## Stop Conditions",
    "",
    ...stopConditions.map((line) => `- ${line}`),
    "",
  ].join("\n")}\n`;
}

async function main(): Promise<void> {
  const plan = await readObservationPlan();
  const inputReadSummary = await readInputs();
  const matrix = queryMatrix(plan);
  const boundaries = boundaryContract();
  const runtimeApprovedRows = boundaries.filter((row) => row.runtimeApproved).length;
  const publicPromotionRows = boundaries.filter((row) => row.publicPromotion).length;
  const candidatePoolRows = boundaries.filter((row) => row.candidatePool).length;
  const runtimeApplyRows = boundaries.filter((row) => row.runtimeApply).length;
  const boundary = {
    reportOnly: true,
    noLiveFetchImplementation: true,
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
    selectedModels: plan.modelList.length,
    queryMatrixRows: matrix.length,
    primaryQueries: matrix.reduce((sum, row) => sum + row.primaryQueries.length, 0),
    variantQueries: matrix.reduce((sum, row) => sum + row.variantQueries.length, 0),
    protectedNegativeQueries: matrix.reduce((sum, row) => sum + row.protectedNegativeQueries.length, 0),
    boundaryClasses: boundaries.length,
    expectedMinimumActiveSellingRows: matrix.reduce((sum, row) => sum + row.minActiveSellingRows, 0),
    runtimeApprovedRows,
    publicPromotionRows,
    candidatePoolRows,
    runtimeApplyRows,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    ownership: "speaker_selected_subset_no_write_live_market_dry_run_runner_design_only",
    category: "speaker_audio_discovered",
    lane: "speaker_selected_subset_no_write_live_market_dry_run_runner_design",
    conclusion: "runner_contract_design_ready_report_only_no_live_fetch_no_write",
    boundary,
    inputFiles,
    inputReadSummary,
    sourcePlanConclusion: plan.conclusion,
    metrics,
    queryMatrix: matrix,
    boundaryContract: boundaries,
    inputSchema: {
      runnerMode: "design_only_no_write_live_market_dry_run",
      observationWindow: { capturedAtIso: "string", staleAfterDays: 14 },
      selectedModels: ["normalizedModel", "expectedComparableKey", "querySet"],
      fetchBudget: { maxPagesPerQuery: "number", maxRowsPerModel: "number", noDbWrites: true },
      allowedSurfaces: ["public marketplace read only in a future runner", "local report output only"],
    },
    outputSchema: {
      generatedAt: "ISO timestamp",
      reportOnly: true,
      rows: [
        {
          pid: "string",
          title: "string",
          query: "string",
          normalizedModel: "string|null",
          decision: "live_positive|manual_review|hold",
          saleStatus: "SELLING|RESERVED|SOLD|UNKNOWN",
          staleState: "fresh_live|fresh_non_live|stale|unknown",
          boundaryClass: "string|null",
          comparableKey: "string|null",
          runtimeApproved: false,
          publicPromotion: false,
          candidatePool: false,
          runtimeApply: false,
        },
      ],
      metrics: ["activeMarketSampleCountByModel", "falsePositiveCountByBoundary", "staleOrNonLiveRows", "priceOutlierCount"],
    },
    staleLiveInterpretation: [
      "Only saleStatus=SELLING captured during the dry-run window counts as fresh_live.",
      "RESERVED, SOLD, 판매완료, buying/wanted, and unknown saleStatus rows cannot count as live positives.",
      "Rows older than 14 days without a fresh saleStatus check are stale and can only support historical context.",
      "Official/spec evidence remains durable; market availability and price evidence must refresh per dry-run.",
    ],
    expectedRunnerMetrics: [
      "activeMarketSampleCount by selected model, minimum 3 each.",
      "manualReviewCount for ambiguous device class, bundle, or model-token rows.",
      "holdCount by boundary class: accessory, soundbar, karaoke/PA, amp/receiver, bundle, damaged, buying/sold/non-live.",
      "falsePositiveCount by protected boundary class, expected 0.",
      "falseNegativeCount for selected exact models missed by title-token parsing.",
      "priceLowMedianHigh and priceOutlierCount by selected model using 0.5x-2.0x seed price sanity range.",
      "staleOrNonLiveRows filtered out per observation wave.",
    ],
    stopConditions: [
      ...plan.stopConditions,
      "Any future runner would need live fetch writes, DB writes, runtime/src/lib edits, cron/lifecycle edits, candidate pool wiring, pack UI, auth, public promotion, or 30-day-plan edits.",
      "Any protected boundary class is emitted as live_positive.",
      "Any output row has runtimeApproved/publicPromotion/candidatePool/runtimeApply true.",
    ],
    noLiveFetchImplementationNote:
      "This artifact designs the no-write runner contract only. It does not call Bunjang, OpenAI, Supabase, runtime code, cron, lifecycle, candidate pool, pack UI, auth, or public promotion surfaces.",
  };

  await mkdir(reportsDir, { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  JSON.parse(json);
  await writeFile(outputJsonPath, json);
  await writeFile(outputMdPath, buildMarkdown(report));

  console.log(`wrote ${path.relative(process.cwd(), outputJsonPath)}`);
  console.log(`wrote ${path.relative(process.cwd(), outputMdPath)}`);
  console.log(`speaker runner design: models=${metrics.selectedModels}, min_live_rows=${metrics.expectedMinimumActiveSellingRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
