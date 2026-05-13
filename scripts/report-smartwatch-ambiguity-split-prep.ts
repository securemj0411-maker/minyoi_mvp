import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = { pid?: string | number; name?: string; title?: string; description?: string };

type Blockers = {
  currentMetrics: {
    total: number;
    normal: number;
    normalWithSku: number;
    parserReadyRate: number;
    needsReviewRate: number;
    strapSuspect: number;
    gateCounts: Array<{ key: string; count: number }>;
    skuCounts: Array<{ key: string; count: number }>;
    sizeCounts: Array<{ key: string; count: number }>;
    networkCounts: Array<{ key: string; count: number }>;
  };
  doNotDo: string[];
};

type ConnectivitySize = {
  metrics: {
    normalRows: number;
    parserReadyRate: number;
    needsReviewRate: number;
    strapSuspectRows: number;
    keyRows: number;
    unknownConnectivityKeyRows: number;
    unknownConnectivityUnits: number;
    unknownSizeKeyRows: number;
    unknownSizeUnits: number;
    runtimeApprovedRows: number;
    modelCounts: Array<{ key: string; count: number }>;
    connectivityCountsFromKeys: Array<{ key: string; count: number }>;
  };
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
const categoryDir = path.join(process.cwd(), "category-intelligence");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function titleOf(sample: Sample | undefined, fallback: string): string {
  return sample?.name ?? sample?.title ?? fallback;
}

function descOf(sample: Sample | undefined): string {
  return sample?.description ?? "";
}

function findSample(samples: Sample[], pattern: RegExp, fallback: string): Sample | undefined {
  return samples.find((sample) => pattern.test(`${sample.name ?? sample.title ?? ""}\n${sample.description ?? ""}`))
    ?? samples.find((sample) => (sample.name ?? sample.title ?? "") === fallback);
}

function findTitleSample(samples: Sample[], pattern: RegExp, fallback: string): Sample | undefined {
  return samples.find((sample) => pattern.test(sample.name ?? sample.title ?? ""))
    ?? samples.find((sample) => (sample.name ?? sample.title ?? "") === fallback);
}

function makeCase(input: Omit<ImplementationCase, "phase" | "category" | "scope" | "laterRuntimeFiles">): ImplementationCase {
  return {
    phase: "Phase 6 - Smartwatch / Ambiguity Lightweight Split Prep",
    category: "smartwatch_discovered",
    scope: "Smartwatch ambiguity lightweight split prep only; no runtime/public promotion",
    laterRuntimeFiles: [
      "src/lib/option-parser.ts",
      "src/lib/pipeline.ts",
      "src/lib/category-readiness.ts",
      "src/lib/candidate-pool-builder.ts",
    ],
    ...input,
  };
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const samples = await readJson<Sample[]>(path.join(categoryDir, "smartwatch_discovered/samples.json"));
  const blockers = await readJson<Blockers>(path.join(reportsDir, "smartwatch-ambiguity-blockers-latest.json"));
  const sizeEvidence = await readJson<ConnectivitySize>(path.join(reportsDir, "smartwatch-connectivity-size-evidence-latest.json"));

  const appleResolved = findSample(samples, /애플워치.*(gps|셀룰러|cellular).*(40|42|44|45|46|49)mm|애플워치.*(40|42|44|45|46|49)mm.*(gps|셀룰러|cellular)/i, "애플워치9 스테인리스 스틸 45mm, 실버, GPS + Cellular");
  const galaxyResolved = findSample(samples, /갤럭시\s*워치.*(블루투스|wifi|lte).*(40|43|44|46)mm|갤럭시워치.*(40|43|44|46)mm/i, "갤럭시워치6 클래식 43mm wifi 블랙");
  const unknownConnectivity = findSample(samples, /애플워치se3\s*44mm|애플워치\s*40mm|갤럭시워치7\s*44mm/i, "애플워치se3 44mm 풀박스");
  const unknownSize = findSample(samples, /애플워치시리즈5|애플워치se2\(급처/i, "애플워치시리즈5");
  const strap = findTitleSample(samples, /애플워치\s*스트랩|밴드|스트랩/i, "애플워치 스트랩");
  const buying = findSample(samples, /구매합니다|삽니다|매입/i, "가민 피닉스7, 인스팅트2 구매합니다");
  const nonAppleGalaxy = findTitleSample(samples, /어메이즈핏|amazfit|garmin/i, "어메이즈핏 티렉스3 프로 48mm 블랙 미개봉");

  const cases: ImplementationCase[] = [
    makeCase({
      caseId: "SMARTWATCH-SPLIT-01",
      inputTitle: titleOf(appleResolved, "애플워치9 스테인리스 스틸 45mm, 실버, GPS + Cellular"),
      inputDescription: descOf(appleResolved),
      expectedClass: "split_only",
      blockerType: "resolved_size_connectivity_reference_only",
      productIdentityTokens: ["applewatch"],
      variantTokens: ["size_resolved", "connectivity_resolved"],
      conditionTokens: ["normal"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "smartwatch-connectivity-size-evidence-latest.json",
      externalEvidence: [],
      confidence: "medium",
      notes: "Resolved rows are reference evidence only; do not copy existing Apple Watch runtime readiness into discovered category.",
    }),
    makeCase({
      caseId: "SMARTWATCH-SPLIT-02",
      inputTitle: titleOf(galaxyResolved, "갤럭시워치6 클래식 43mm wifi 블랙"),
      inputDescription: descOf(galaxyResolved),
      expectedClass: "split_only",
      blockerType: "resolved_size_connectivity_reference_only",
      productIdentityTokens: ["galaxywatch"],
      variantTokens: ["size_resolved", "connectivity_resolved"],
      conditionTokens: ["normal"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "smartwatch-connectivity-size-evidence-latest.json",
      externalEvidence: [],
      confidence: "medium",
      notes: "Resolved Galaxy Watch row is split reference only, not public promotion.",
    }),
    makeCase({
      caseId: "SMARTWATCH-MANUAL-01",
      inputTitle: titleOf(unknownConnectivity, "애플워치se3 44mm 풀박스"),
      inputDescription: descOf(unknownConnectivity),
      expectedClass: "manual_review",
      blockerType: "unknown_connectivity_review_gate",
      productIdentityTokens: ["smartwatch"],
      variantTokens: ["unknown_connectivity"],
      conditionTokens: ["normal"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "smartwatch-connectivity-model-boundary-evidence-latest.json",
      externalEvidence: [],
      confidence: "high",
      notes: "Unknown connectivity rows must not be wired into candidate pool.",
    }),
    makeCase({
      caseId: "SMARTWATCH-MANUAL-02",
      inputTitle: titleOf(unknownSize, "애플워치시리즈5"),
      inputDescription: descOf(unknownSize),
      expectedClass: "manual_review",
      blockerType: "unknown_size_or_generation_review_gate",
      productIdentityTokens: ["smartwatch"],
      variantTokens: ["unknown_size"],
      conditionTokens: ["battery_or_wear_context"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "smartwatch-connectivity-size-evidence-latest.json",
      externalEvidence: [],
      confidence: "high",
      notes: "Size/generation ambiguity remains review-gated.",
    }),
    makeCase({
      caseId: "SMARTWATCH-MANUAL-03",
      inputTitle: titleOf(nonAppleGalaxy, "어메이즈핏 티렉스3 프로 48mm 블랙 미개봉"),
      inputDescription: descOf(nonAppleGalaxy),
      expectedClass: "manual_review",
      blockerType: "non_apple_galaxy_smartwatch_split_needed",
      productIdentityTokens: ["third_party_smartwatch"],
      variantTokens: ["amazfit_or_garmin"],
      conditionTokens: ["normal"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "category-intelligence/smartwatch_discovered/samples.json",
      externalEvidence: [],
      confidence: "medium",
      notes: "Third-party watch families need separate catalog split, not Apple/Galaxy inference.",
    }),
    makeCase({
      caseId: "SMARTWATCH-HOLD-01",
      inputTitle: titleOf(strap, "애플워치 스트랩"),
      inputDescription: descOf(strap),
      expectedClass: "hold",
      blockerType: "strap_accessory_hold",
      productIdentityTokens: ["watch_accessory"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: ["strap", "band"],
      evidenceSource: "smartwatch-ambiguity-blockers-latest.json:strapSuspect",
      externalEvidence: [],
      confidence: "high",
      notes: "Strap/accessory rows remain outside body candidates.",
    }),
    makeCase({
      caseId: "SMARTWATCH-HOLD-02",
      inputTitle: titleOf(buying, "가민 피닉스7, 인스팅트2 구매합니다"),
      inputDescription: descOf(buying),
      expectedClass: "hold",
      blockerType: "buying_or_wanted_hold",
      productIdentityTokens: ["smartwatch"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["buying", "wanted"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "smartwatch-ambiguity-blockers-latest.json:gateCounts",
      externalEvidence: [],
      confidence: "high",
      notes: "Buying posts are not sell-side body listings.",
    }),
  ];

  const splitOnlyOrArchitectureCases = cases.filter((row) => row.expectedClass === "split_only");
  const manualReviewTestCases = cases.filter((row) => row.expectedClass === "manual_review");
  const negativeHoldTestCases = cases.filter((row) => row.expectedClass === "hold");

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    decision: "smartwatch_ambiguity_split_prep_report_only",
    scope: "Smartwatch ambiguity lightweight split prep only",
    nonScope: [
      "whole smartwatch_discovered public readiness",
      "copying applewatch/galaxywatch runtime readiness",
      "network/connectivity inference rules",
      "candidate pool policy wiring",
      "runtime parser/catalog/pipeline edits",
    ],
    sourceReportsRead: [
      "smartwatch-ambiguity-blockers-latest.json",
      "smartwatch-ambiguity-evidence-matrix-latest.json",
      "smartwatch-connectivity-model-boundary-evidence-latest.json",
      "smartwatch-connectivity-size-evidence-latest.json",
      "category-intelligence/smartwatch_discovered/samples.json",
    ],
    metrics: {
      total: blockers.currentMetrics.total,
      normal: blockers.currentMetrics.normal,
      normalWithSku: blockers.currentMetrics.normalWithSku,
      parserReadyRate: blockers.currentMetrics.parserReadyRate,
      needsReviewRate: blockers.currentMetrics.needsReviewRate,
      strapSuspect: blockers.currentMetrics.strapSuspect,
      keyRows: sizeEvidence.metrics.keyRows,
      unknownConnectivityKeyRows: sizeEvidence.metrics.unknownConnectivityKeyRows,
      unknownConnectivityUnits: sizeEvidence.metrics.unknownConnectivityUnits,
      unknownSizeKeyRows: sizeEvidence.metrics.unknownSizeKeyRows,
      unknownSizeUnits: sizeEvidence.metrics.unknownSizeUnits,
      runtimeApprovedRows: sizeEvidence.metrics.runtimeApprovedRows,
      testCaseCount: cases.length,
      positiveCount: 0,
      splitOnlyCount: splitOnlyOrArchitectureCases.length,
      holdCount: negativeHoldTestCases.length,
      manualReviewCount: manualReviewTestCases.length,
    },
    gateCounts: blockers.currentMetrics.gateCounts,
    skuCounts: blockers.currentMetrics.skuCounts,
    sizeCounts: blockers.currentMetrics.sizeCounts,
    networkCounts: blockers.currentMetrics.networkCounts,
    positiveTestCases: [],
    splitOnlyOrArchitectureCases,
    manualReviewTestCases,
    negativeHoldTestCases,
    blockerToTestMapping: [
      { blocker: "Resolved size/connectivity reference only", caseIds: splitOnlyOrArchitectureCases.map((row) => row.caseId) },
      { blocker: "Unknown connectivity/size/third-party split", caseIds: manualReviewTestCases.map((row) => row.caseId) },
      { blocker: "Strap/accessory and buying hold", caseIds: negativeHoldTestCases.map((row) => row.caseId) },
    ],
    externalTaxonomyNotes: [
      "Apple Watch and Galaxy Watch prior readiness must not be copied into smartwatch_discovered.",
      "Connectivity must be explicit; do not infer GPS/cellular/wifi by family or model.",
      "Third-party families such as Amazfit/Garmin need a separate catalog split.",
    ],
    externalSources: [],
    dryRunStrategyForMainAgent: [
      "Use split-only rows to test size/connectivity extraction after explicit policy approval.",
      "Assert unknown connectivity and unknown size rows remain manual-review.",
      "Assert strap/accessory and buying rows never enter body candidate pool.",
    ],
    stopCondition: "Stop before editing runtime parser/catalog/pipeline/candidate pool files.",
    nextQueueItem: "Phase 7 - Camera / Package-Body-Lens Lightweight Split Prep",
    deferred: [
      "Third-party smartwatch families need separate mining and official/current model taxonomy.",
      "Connectivity inference by family/model is deferred and should stay blocked.",
      "Strap/accessory pressure remains high enough that smartwatch_discovered cannot be public-ready.",
    ],
    inheritedDoNotDo: blockers.doNotDo,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-ambiguity-split-prep-latest.json"), JSON.stringify(report, null, 2));

  const caseTable = [
    "| case_id | expected | blocker_type | title | confidence |",
    "| --- | --- | --- | --- | --- |",
    ...cases.map((row) => `| ${row.caseId} | ${row.expectedClass} | ${row.blockerType} | ${row.inputTitle.replace(/\|/g, "/")} | ${row.confidence} |`),
  ].join("\n");
  const md = [
    "# Smartwatch Ambiguity Split Prep",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Lightweight split prep for smartwatch discovered rows. This is not runtime wiring, candidate pool wiring, or public promotion.",
    "",
    "## Metrics",
    "",
    `- total samples: ${report.metrics.total}`,
    `- normal rows: ${report.metrics.normal}`,
    `- normal with SKU: ${report.metrics.normalWithSku}`,
    `- parser-ready rate: ${report.metrics.parserReadyRate}%`,
    `- needs-review rate: ${report.metrics.needsReviewRate}%`,
    `- strap suspect rows: ${report.metrics.strapSuspect}`,
    `- unknown connectivity key rows/units: ${report.metrics.unknownConnectivityKeyRows}/${report.metrics.unknownConnectivityUnits}`,
    `- unknown size key rows/units: ${report.metrics.unknownSizeKeyRows}/${report.metrics.unknownSizeUnits}`,
    `- runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    `- test cases: ${report.metrics.testCaseCount}`,
    `- positive/split-only/hold/manual: ${report.metrics.positiveCount}/${report.metrics.splitOnlyCount}/${report.metrics.holdCount}/${report.metrics.manualReviewCount}`,
    "",
    "## Scope",
    "",
    report.scope,
    "",
    "## Non-Scope",
    "",
    ...report.nonScope.map((line) => `- ${line}`),
    "",
    "## Test Cases",
    "",
    caseTable,
    "",
    "## Deferred / Remember Later",
    "",
    ...report.deferred.map((line) => `- ${line}`),
    "",
    "## Stop Condition",
    "",
    report.stopCondition,
  ].join("\n");

  await writeFile(path.join(reportsDir, "smartwatch-ambiguity-split-prep-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-ambiguity-split-prep-latest.json");
  console.log("wrote reports/smartwatch-ambiguity-split-prep-latest.md");
  console.log(`smartwatch split prep: cases=${cases.length}, split_only=${splitOnlyOrArchitectureCases.length}, hold=${negativeHoldTestCases.length}, manual=${manualReviewTestCases.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
