import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ReviewRow = {
  pid: string;
  title: string;
  price: number;
  key: string | null;
  keyClass: string;
  reviewClass: string;
  hasCpuToken: boolean;
  hasGpuToken: boolean;
  action: string;
  cpuTitleToken?: string;
  gpuTitleToken?: string;
  keyMismatchClass?: string;
};

type Blockers = {
  currentMetrics: {
    total: number;
    normal: number;
    normalRate: number;
    nonNormal: number;
    nonNormalRate: number;
    parserReady: number;
    parserReadyRate: number;
    generic: number;
    genericRate: number;
    gateCounts: Array<{ key: string; count: number }>;
    keyCounts: Array<{ key: string; count: number }>;
  };
  mustHold: string[];
  requiredBeforeAnyMainReview: string[];
  doNotDo: string[];
};

type TokenEvidence = {
  metrics: {
    testCandidateOnlyRows: number;
    holdOrExcludedRows: number;
    unresolvedCpuOrGpuRows: number;
    genericDesktopRows: number;
    runtimeApprovedRows: number;
  };
  rows: ReviewRow[];
};

type Readiness = {
  metrics: {
    reviewRows: number;
    testCandidateOnlyRows: number;
    holdOrExcludedRows: number;
    runtimeApprovedRows: number;
  };
};

type Exclusion = {
  metrics: {
    matrixRows: number;
    gpuOnlyRows: number;
    commercialOrMiningRows: number;
    positiveCandidateRows: number;
    runtimeApprovedRows: number;
  };
  rows: ReviewRow[];
};

type Boundary = {
  metrics: {
    titleRows: number;
    rowsWithBothTitleTokens: number;
    ambiguousCpuTokenRows: number;
    genericKeyDespiteTokensRows: number;
    unresolvedKeyDespiteTitleTokenRows: number;
    runtimeApprovedRows: number;
  };
  rows: ReviewRow[];
};

type ImplementationCase = {
  caseId: string;
  phase: string;
  category: string;
  scope: string;
  inputTitle: string;
  inputDescription: string;
  expectedClass: "positive" | "hold" | "manual_review" | "split_only" | "ignore";
  blockerType: string;
  productIdentityTokens: string[];
  variantTokens: string[];
  conditionTokens: string[];
  sellerIntentTokens: string[];
  bundleOrQuantityTokens: string[];
  accessoryOrPartTokens: string[];
  evidenceSource: string;
  externalEvidence: Array<{ label: string; url: string; retrievedAt: string }>;
  laterRuntimeFiles: string[];
  confidence: "high" | "medium" | "low";
  notes: string;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function makeCase(input: Omit<ImplementationCase, "phase" | "category" | "scope" | "laterRuntimeFiles">): ImplementationCase {
  return {
    phase: "Phase 5 - Desktop / Complete CPU-GPU Body Rows",
    category: "desktop_pc_discovered",
    scope: "Desktop full-unit CPU/GPU implementation-prep only; test-candidate-only report, no wiring",
    laterRuntimeFiles: [
      "src/lib/option-parser.ts",
      "src/lib/pipeline.ts",
      "src/lib/category-readiness.ts",
      "src/lib/candidate-pool-builder.ts",
    ],
    ...input,
  };
}

function rowCase(row: ReviewRow, caseId: string): ImplementationCase {
  const title = row.title;
  const lower = title.toLowerCase();
  const cpuTokens = [row.cpuTitleToken, lower.match(/9800x3d|7800x3d|울트라5\s*225f|270k/)?.[0]].filter(Boolean) as string[];
  const gpuTokens = [row.gpuTitleToken, lower.match(/5080|9070xt|rx5700|3080ti/)?.[0]].filter(Boolean) as string[];
  const unknownSide = row.keyClass === "unknown_gpu" ? "unknown_gpu" : row.keyClass === "unknown_cpu" ? "unknown_cpu" : row.keyClass;
  return makeCase({
    caseId,
    inputTitle: title,
    inputDescription: "",
    expectedClass: "manual_review",
    blockerType: `cpu_gpu_title_token_${unknownSide}_manual_review`,
    productIdentityTokens: ["desktop_pc", "full_unit_candidate"],
    variantTokens: [...cpuTokens, ...gpuTokens],
    conditionTokens: [],
    sellerIntentTokens: ["selling"],
    bundleOrQuantityTokens: [],
    accessoryOrPartTokens: [],
    evidenceSource: `desktop-cpu-gpu-title-token-boundary-evidence-latest.json:${row.pid}`,
    externalEvidence: [],
    confidence: row.keyClass === "generic_desktop" || row.keyClass.includes("unknown") ? "medium" : "low",
    notes: `Title has CPU/GPU tokens but key class is ${row.keyClass}; ${row.keyMismatchClass ?? "manual review required"}.`,
  });
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const blockers = await readJson<Blockers>(path.join(reportsDir, "desktop-full-unit-blockers-latest.json"));
  const tokenEvidence = await readJson<TokenEvidence>(path.join(reportsDir, "desktop-test-candidate-token-evidence-latest.json"));
  const readiness = await readJson<Readiness>(path.join(reportsDir, "desktop-test-candidate-readiness-latest.json"));
  const exclusion = await readJson<Exclusion>(path.join(reportsDir, "desktop-exclusion-evidence-matrix-latest.json"));
  const boundary = await readJson<Boundary>(path.join(reportsDir, "desktop-cpu-gpu-title-token-boundary-evidence-latest.json"));

  const tokenCases = boundary.rows.map((row, index) => rowCase(row, `DESKTOP-MANUAL-${String(index + 1).padStart(2, "0")}`));
  const gpuOnlyRows = exclusion.rows.filter((row) => row.reviewClass === "gpu_only_missing_cpu");
  const commercial = exclusion.rows.find((row) => row.reviewClass === "hold_commercial_or_mining_risk");

  const holdCases: ImplementationCase[] = [
    ...gpuOnlyRows.slice(0, 3).map((row, index) => makeCase({
      caseId: `DESKTOP-HOLD-${String(index + 1).padStart(2, "0")}`,
      inputTitle: row.title,
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "gpu_only_missing_cpu_identity_hold",
      productIdentityTokens: ["desktop_pc"],
      variantTokens: [row.title.match(/rtx\s*5080|rtx\s*3080ti|5080/i)?.[0] ?? "gpu_only"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `desktop-exclusion-evidence-matrix-latest.json:${row.pid}`,
      externalEvidence: [],
      confidence: "high",
      notes: "GPU-only rows are not comparable full-unit CPU/GPU keys until CPU identity is present.",
    })),
    makeCase({
      caseId: "DESKTOP-HOLD-04",
      inputTitle: commercial?.title ?? "파이 노드 컴퓨터 위탁 월 4만원 최저가",
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "commercial_or_mining_risk_hold",
      productIdentityTokens: ["desktop_pc"],
      variantTokens: [],
      conditionTokens: ["commercial", "mining_or_node_risk"],
      sellerIntentTokens: ["service_or_rental"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `desktop-exclusion-evidence-matrix-latest.json:${commercial?.pid ?? "commercial"}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Commercial/mining/위탁 rows are hard exclusions for full-unit used-PC comparison.",
    }),
    makeCase({
      caseId: "DESKTOP-HOLD-05",
      inputTitle: "윈도우11 / 윈도우10 프로 홈 정품키 오피스2021",
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "software_key_not_desktop_body_hold",
      productIdentityTokens: ["software_key"],
      variantTokens: ["windows", "office"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: ["software_license"],
      evidenceSource: "desktop-full-unit-blockers-latest.json:mustHold",
      externalEvidence: [],
      confidence: "high",
      notes: "Windows/Office key rows are explicitly must-hold and are not desktop body listings.",
    }),
  ];

  const cases = [...tokenCases, ...holdCases];
  const manualReviewTestCases = cases.filter((row) => row.expectedClass === "manual_review");
  const negativeHoldTestCases = cases.filter((row) => row.expectedClass === "hold");

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    scope: "Desktop full-unit CPU/GPU implementation-prep only",
    nonScope: [
      "whole desktop_pc_discovered public readiness",
      "CPU/GPU runtime parser rules",
      "candidate pool policy wiring",
      "RAM/SSD/warranty/newness runtime design",
      "commercial shop template comparison",
    ],
    sourceReportsRead: [
      "desktop-full-unit-blockers-latest.json",
      "desktop-test-candidate-token-evidence-latest.json",
      "desktop-test-candidate-readiness-latest.json",
      "desktop-cpu-gpu-title-token-boundary-evidence-latest.json",
      "desktop-exclusion-evidence-matrix-latest.json",
    ],
    metrics: {
      total: blockers.currentMetrics.total,
      normal: blockers.currentMetrics.normal,
      normalRate: blockers.currentMetrics.normalRate,
      nonNormal: blockers.currentMetrics.nonNormal,
      nonNormalRate: blockers.currentMetrics.nonNormalRate,
      parserReady: blockers.currentMetrics.parserReady,
      parserReadyRate: blockers.currentMetrics.parserReadyRate,
      generic: blockers.currentMetrics.generic,
      genericRate: blockers.currentMetrics.genericRate,
      reviewRows: readiness.metrics.reviewRows,
      testCandidateOnlyRows: readiness.metrics.testCandidateOnlyRows,
      holdOrExcludedRows: readiness.metrics.holdOrExcludedRows,
      unresolvedCpuOrGpuRows: tokenEvidence.metrics.unresolvedCpuOrGpuRows,
      genericDesktopRows: tokenEvidence.metrics.genericDesktopRows,
      gpuOnlyRows: exclusion.metrics.gpuOnlyRows,
      commercialOrMiningRows: exclusion.metrics.commercialOrMiningRows,
      rowsWithBothTitleTokens: boundary.metrics.rowsWithBothTitleTokens,
      runtimeApprovedRows: readiness.metrics.runtimeApprovedRows + tokenEvidence.metrics.runtimeApprovedRows + exclusion.metrics.runtimeApprovedRows + boundary.metrics.runtimeApprovedRows,
      testCaseCount: cases.length,
      positiveCount: 0,
      holdCount: negativeHoldTestCases.length,
      manualReviewCount: manualReviewTestCases.length,
    },
    gateCounts: blockers.currentMetrics.gateCounts,
    keyCounts: blockers.currentMetrics.keyCounts,
    positiveTestCases: [],
    negativeHoldTestCases,
    manualReviewTestCases,
    splitOnlyOrArchitectureCases: [],
    blockerToTestMapping: [
      { blocker: "CPU+GPU title-token rows pending main/manual review", caseIds: manualReviewTestCases.map((row) => row.caseId) },
      { blocker: "GPU-only missing CPU identity", caseIds: negativeHoldTestCases.filter((row) => row.blockerType.includes("gpu_only")).map((row) => row.caseId) },
      { blocker: "Commercial/mining/software-key hard exclusions", caseIds: negativeHoldTestCases.filter((row) => !row.blockerType.includes("gpu_only")).map((row) => row.caseId) },
    ],
    externalTaxonomyNotes: [
      "No official CPU/GPU model taxonomy is applied here; title tokens remain report-only evidence.",
      "RTX 5080/RX 9070 XT/RX5700/Ryzen X3D/Core Ultra tokens show parser surface, not runtime approval.",
      "Unknown CPU/GPU sides must be resolved before comparable keys are allowed.",
    ],
    externalSources: [],
    proposedRuntimeFilesForLater: [
      "src/lib/option-parser.ts",
      "src/lib/pipeline.ts",
      "src/lib/category-readiness.ts",
      "src/lib/candidate-pool-builder.ts",
    ],
    dryRunStrategyForMainAgent: [
      "Replay manual-review CPU/GPU token fixtures after main selects a narrow CPU/GPU normalization policy.",
      "Assert GPU-only rows remain hold until CPU identity exists.",
      "Assert commercial/mining/software-key rows never enter full-unit candidate pool.",
      "Keep RAM/SSD/warranty/newness as follow-up fields, not comparable runtime keys in this phase.",
    ],
    stopCondition: "Stop before editing runtime parser/catalog/pipeline/candidate pool files.",
    nextQueueItem: "Phase 6 - Smartwatch / Ambiguity Lightweight Split Prep",
    deferred: [
      "CPU/GPU title-token normalization needs main/manual review before parser work.",
      "RTX 50/RX 9000 and ambiguous Intel 270K-style tokens need explicit normalization policy.",
      "RAM/SSD/warranty/newness fields are important but intentionally deferred from runtime key design.",
      "Commercial shop templates and one-off used PCs should not be compared until a separate seller/listing-type policy exists.",
    ],
    inheritedMustHold: blockers.mustHold,
    inheritedDoNotDo: blockers.doNotDo,
    requiredBeforeAnyMainReview: blockers.requiredBeforeAnyMainReview,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "desktop-cpu-gpu-implementation-prep-latest.json"), JSON.stringify(report, null, 2));

  const caseTable = [
    "| case_id | expected | blocker_type | title | confidence |",
    "| --- | --- | --- | --- | --- |",
    ...cases.map((row) => `| ${row.caseId} | ${row.expectedClass} | ${row.blockerType} | ${row.inputTitle.replace(/\|/g, "/")} | ${row.confidence} |`),
  ].join("\n");
  const md = [
    "# Desktop CPU-GPU Implementation-Prep",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Implementation-prep for desktop full-unit CPU/GPU rows. This is not runtime wiring, candidate pool wiring, or public promotion.",
    "",
    "## Metrics",
    "",
    `- total samples: ${report.metrics.total}`,
    `- normal rows: ${report.metrics.normal} (${report.metrics.normalRate}%)`,
    `- non-normal rows: ${report.metrics.nonNormal} (${report.metrics.nonNormalRate}%)`,
    `- parser-ready: ${report.metrics.parserReady} (${report.metrics.parserReadyRate}%)`,
    `- generic rows: ${report.metrics.generic} (${report.metrics.genericRate}%)`,
    `- test-candidate-only rows: ${report.metrics.testCandidateOnlyRows}`,
    `- hold/excluded rows: ${report.metrics.holdOrExcludedRows}`,
    `- runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    `- test cases: ${report.metrics.testCaseCount}`,
    `- positive/hold/manual: ${report.metrics.positiveCount}/${report.metrics.holdCount}/${report.metrics.manualReviewCount}`,
    "",
    "## Scope",
    "",
    report.scope,
    "",
    "## Non-Scope",
    "",
    ...report.nonScope.map((line) => `- ${line}`),
    "",
    "## Gate Counts",
    "",
    ...report.gateCounts.map((row) => `- ${row.key}: ${row.count}`),
    "",
    "## Test Cases",
    "",
    caseTable,
    "",
    "## Blocker To Test Mapping",
    "",
    "| blocker | case_ids |",
    "| --- | --- |",
    ...report.blockerToTestMapping.map((row) => `| ${row.blocker} | ${row.caseIds.join(", ")} |`),
    "",
    "## External Taxonomy Notes",
    "",
    ...report.externalTaxonomyNotes.map((line) => `- ${line}`),
    "",
    "## Dry-Run Strategy For Main Agent",
    "",
    ...report.dryRunStrategyForMainAgent.map((line) => `- ${line}`),
    "",
    "## Deferred / Remember Later",
    "",
    ...report.deferred.map((line) => `- ${line}`),
    "",
    "## Stop Condition",
    "",
    report.stopCondition,
  ].join("\n");

  await writeFile(path.join(reportsDir, "desktop-cpu-gpu-implementation-prep-latest.md"), `${md}\n`);
  console.log("wrote reports/desktop-cpu-gpu-implementation-prep-latest.json");
  console.log("wrote reports/desktop-cpu-gpu-implementation-prep-latest.md");
  console.log(`desktop CPU/GPU implementation prep: cases=${cases.length}, hold=${negativeHoldTestCases.length}, manual=${manualReviewTestCases.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
