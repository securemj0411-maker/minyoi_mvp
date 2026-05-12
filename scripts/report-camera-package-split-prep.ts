import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Row = {
  pid: string;
  title: string;
  price?: number;
  model_key?: string | null;
  package_config?: string;
  boundaryClass?: string;
  evidenceClass?: string;
  reviewAction?: string;
  falseMergeRisk?: string;
};

type Blockers = {
  currentMetrics: {
    total: number;
    normal: number;
    parserReadyRate: number;
    modelMatchedRate: number;
    parserReadyOfMatchedRate: number;
    unknownPackageRate: number;
    gateCounts: Array<{ key: string; count: number }>;
    packageCounts: Array<{ key: string; count: number }>;
    topModelCounts: Array<{ key: string; count: number }>;
  };
  doNotDo: string[];
};

type Matrix = {
  metrics: {
    matrixRows: number;
    unknownPackageEvidenceRows: number;
    lensKitReferenceRows: number;
    bodyOnlyReferenceRows: number;
    runtimeApprovedRows: number;
  };
  rows: Row[];
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
    phase: "Phase 7 - Camera / Package-Body-Lens Lightweight Split Prep",
    category: "camera_discovered",
    scope: "Camera package/body/lens lightweight split prep only; no runtime package recovery",
    laterRuntimeFiles: [
      "src/lib/option-parser.ts",
      "src/lib/pipeline.ts",
      "src/lib/category-readiness.ts",
      "src/lib/candidate-pool-builder.ts",
    ],
    ...input,
  };
}

function caseFromRow(row: Row, caseId: string, expectedClass: ImplementationCase["expectedClass"], blockerType: string, notes: string): ImplementationCase {
  return makeCase({
    caseId,
    inputTitle: row.title,
    inputDescription: "",
    expectedClass,
    blockerType,
    productIdentityTokens: ["camera", row.model_key ?? "missing_model_key"].filter(Boolean),
    variantTokens: [row.package_config ?? "unknown_package"],
    conditionTokens: [],
    sellerIntentTokens: ["selling"],
    bundleOrQuantityTokens: row.package_config === "lens_kit" ? ["lens_kit"] : row.package_config === "body_only" ? ["body_only"] : [],
    accessoryOrPartTokens: blockerType.includes("accessory") ? ["accessory_bundle"] : [],
    evidenceSource: `camera-package-title-token-boundary-evidence-latest.json:${row.pid}`,
    externalEvidence: [],
    confidence: expectedClass === "hold" ? "high" : "medium",
    notes,
  });
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const blockers = await readJson<Blockers>(path.join(reportsDir, "camera-package-blockers-latest.json"));
  const matrix = await readJson<Matrix>(path.join(reportsDir, "camera-package-evidence-matrix-latest.json"));
  const titleBoundary = await readJson<Matrix>(path.join(reportsDir, "camera-package-title-token-boundary-evidence-latest.json"));
  const fixedLens = await readJson<{ metrics: { fixedLensRows: number; knownFixedLensRows: number; hintedFixedLensRows: number; accessoryRows: number } }>(path.join(reportsDir, "camera-fixed-lens-accessory-review-latest.json"));

  const bodyRows = titleBoundary.rows.filter((row) => row.package_config === "body_only").slice(0, 2);
  const lensKit = titleBoundary.rows.find((row) => row.package_config === "lens_kit");
  const fullBoxUnknown = titleBoundary.rows.find((row) => row.evidenceClass === "full_box_not_lens_kit");
  const accessoryBundle = titleBoundary.rows.find((row) => row.evidenceClass === "accessory_bundle_not_lens_kit");
  const missingSignal = titleBoundary.rows.find((row) => row.evidenceClass === "unknown_package_missing_signal_hold");

  const cases: ImplementationCase[] = [
    ...bodyRows.map((row, index) => caseFromRow(
      row,
      `CAMERA-SPLIT-${String(index + 1).padStart(2, "0")}`,
      "split_only",
      "body_only_reference_do_not_merge_with_lens_kit",
      "Body-only reference rows must stay separate from lens-kit and unknown-package rows.",
    )),
    lensKit ? caseFromRow(
      lensKit,
      "CAMERA-SPLIT-03",
      "split_only",
      "lens_kit_reference_only",
      "Lens-kit wording is reference evidence only and not runtime approval.",
    ) : undefined,
    fullBoxUnknown ? caseFromRow(
      fullBoxUnknown,
      "CAMERA-MANUAL-01",
      "manual_review",
      "full_box_not_lens_kit_manual_review",
      "Full-box does not prove lens identity and must not be recovered as lens-kit.",
    ) : undefined,
    accessoryBundle ? caseFromRow(
      accessoryBundle,
      "CAMERA-MANUAL-02",
      "manual_review",
      "accessory_bundle_not_lens_kit_manual_review",
      "Battery/SD/case/grip bundles are not lens-kit identity.",
    ) : undefined,
    missingSignal ? caseFromRow(
      missingSignal,
      "CAMERA-HOLD-01",
      "hold",
      "missing_package_signal_hold",
      "Interchangeable camera model with missing package signal stays hold-only.",
    ) : undefined,
    makeCase({
      caseId: "CAMERA-HOLD-02",
      inputTitle: "삼성 NX 20-50 부품용 렌즈",
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "lens_parts_or_damaged_hold",
      productIdentityTokens: ["camera_lens"],
      variantTokens: ["lens_only"],
      conditionTokens: ["parts", "damaged"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: ["lens"],
      evidenceSource: "category-intelligence/camera_discovered/samples.json",
      externalEvidence: [],
      confidence: "high",
      notes: "Lens-only parts rows must not enter camera body/package readiness.",
    }),
    makeCase({
      caseId: "CAMERA-HOLD-03",
      inputTitle: "마이크로포써드용 바디캡 + 렌즈 뒷캡",
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "camera_accessory_cap_hold",
      productIdentityTokens: ["camera_accessory"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: ["body_cap", "rear_lens_cap"],
      evidenceSource: "category-intelligence/camera_discovered/samples.json",
      externalEvidence: [],
      confidence: "high",
      notes: "Cap/accessory rows remain outside body/lens-kit package readiness.",
    }),
  ].filter(Boolean) as ImplementationCase[];

  const splitOnlyOrArchitectureCases = cases.filter((row) => row.expectedClass === "split_only");
  const manualReviewTestCases = cases.filter((row) => row.expectedClass === "manual_review");
  const negativeHoldTestCases = cases.filter((row) => row.expectedClass === "hold");

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    scope: "Camera package/body/lens lightweight split prep only",
    nonScope: [
      "whole camera_discovered public readiness",
      "runtime package_config recovery",
      "camera catalog/category-readiness/parser edits",
      "candidate pool policy wiring",
    ],
    sourceReportsRead: [
      "camera-package-blockers-latest.json",
      "camera-package-evidence-matrix-latest.json",
      "camera-package-title-token-boundary-evidence-latest.json",
      "camera-package-signal-boundary-evidence-latest.json",
      "camera-false-merge-risk-matrix-latest.json",
      "camera-fixed-lens-accessory-review-latest.json",
    ],
    metrics: {
      total: blockers.currentMetrics.total,
      normal: blockers.currentMetrics.normal,
      parserReadyRate: blockers.currentMetrics.parserReadyRate,
      modelMatchedRate: blockers.currentMetrics.modelMatchedRate,
      parserReadyOfMatchedRate: blockers.currentMetrics.parserReadyOfMatchedRate,
      unknownPackageRate: blockers.currentMetrics.unknownPackageRate,
      matrixRows: matrix.metrics.matrixRows,
      unknownPackageEvidenceRows: matrix.metrics.unknownPackageEvidenceRows,
      lensKitReferenceRows: matrix.metrics.lensKitReferenceRows,
      bodyOnlyReferenceRows: matrix.metrics.bodyOnlyReferenceRows,
      fixedLensRows: fixedLens.metrics.fixedLensRows,
      accessoryRows: fixedLens.metrics.accessoryRows,
      runtimeApprovedRows: matrix.metrics.runtimeApprovedRows,
      testCaseCount: cases.length,
      positiveCount: 0,
      splitOnlyCount: splitOnlyOrArchitectureCases.length,
      holdCount: negativeHoldTestCases.length,
      manualReviewCount: manualReviewTestCases.length,
    },
    gateCounts: blockers.currentMetrics.gateCounts,
    packageCounts: blockers.currentMetrics.packageCounts,
    topModelCounts: blockers.currentMetrics.topModelCounts,
    positiveTestCases: [],
    splitOnlyOrArchitectureCases,
    manualReviewTestCases,
    negativeHoldTestCases,
    blockerToTestMapping: [
      { blocker: "Body-only and lens-kit references must not merge", caseIds: splitOnlyOrArchitectureCases.map((row) => row.caseId) },
      { blocker: "Full-box/accessory bundle is not lens-kit identity", caseIds: manualReviewTestCases.map((row) => row.caseId) },
      { blocker: "Missing package signal, lens parts, and caps hold", caseIds: negativeHoldTestCases.map((row) => row.caseId) },
    ],
    externalTaxonomyNotes: [
      "Camera package policy must distinguish body-only, lens-kit, fixed-lens, lens-only, and accessory rows.",
      "Full-box/accessory-included words are not sufficient lens identity.",
      "Known fixed-lens rows can become candidates only after a separate fixed-lens review.",
    ],
    externalSources: [],
    dryRunStrategyForMainAgent: [
      "Assert body-only and lens-kit rows never share one comparable key.",
      "Assert full-box/accessory-bundle unknown packages remain manual-review.",
      "Assert lens-only parts and cap/accessory rows stay out of camera body package readiness.",
    ],
    stopCondition: "Stop before editing runtime parser/catalog/pipeline/candidate pool files.",
    nextQueueItem: "Phase 8 - Speaker/Audio Device-Class Lightweight Split Prep",
    deferred: [
      "Fixed-lens camera family support needs separate review and model taxonomy.",
      "Lens-only resale should be split from camera body/package readiness.",
      "Package_config recovery remains blocked until explicit body/kit/full-box policy is approved.",
    ],
    inheritedDoNotDo: blockers.doNotDo,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "camera-package-split-prep-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Camera Package Split Prep",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Lightweight split prep for camera body/package/lens rows. This is not runtime wiring, candidate pool wiring, or public promotion.",
    "",
    "## Metrics",
    "",
    `- total samples: ${report.metrics.total}`,
    `- normal rows: ${report.metrics.normal}`,
    `- parser-ready rate: ${report.metrics.parserReadyRate}%`,
    `- model-matched rate: ${report.metrics.modelMatchedRate}%`,
    `- unknown package rate: ${report.metrics.unknownPackageRate}%`,
    `- body-only/lens-kit reference rows: ${report.metrics.bodyOnlyReferenceRows}/${report.metrics.lensKitReferenceRows}`,
    `- fixed-lens/accessory rows: ${report.metrics.fixedLensRows}/${report.metrics.accessoryRows}`,
    `- runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    `- test cases: ${report.metrics.testCaseCount}`,
    `- positive/split-only/hold/manual: ${report.metrics.positiveCount}/${report.metrics.splitOnlyCount}/${report.metrics.holdCount}/${report.metrics.manualReviewCount}`,
    "",
    "## Test Cases",
    "",
    "| case_id | expected | blocker_type | title | confidence |",
    "| --- | --- | --- | --- | --- |",
    ...cases.map((row) => `| ${row.caseId} | ${row.expectedClass} | ${row.blockerType} | ${row.inputTitle.replace(/\|/g, "/")} | ${row.confidence} |`),
    "",
    "## Deferred / Remember Later",
    "",
    ...report.deferred.map((line) => `- ${line}`),
    "",
    "## Stop Condition",
    "",
    report.stopCondition,
  ].join("\n");

  await writeFile(path.join(reportsDir, "camera-package-split-prep-latest.md"), `${md}\n`);
  console.log("wrote reports/camera-package-split-prep-latest.json");
  console.log("wrote reports/camera-package-split-prep-latest.md");
  console.log(`camera package split prep: cases=${cases.length}, split_only=${splitOnlyOrArchitectureCases.length}, hold=${negativeHoldTestCases.length}, manual=${manualReviewTestCases.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
