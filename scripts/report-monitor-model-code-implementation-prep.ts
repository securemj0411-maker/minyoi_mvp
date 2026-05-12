import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  name?: string;
  title?: string;
  description?: string;
};

type Blockers = {
  currentMetrics: {
    total: number;
    hasModelCodeRate: number;
    genericKeyRate: number;
    parserReadyRate: number;
    criticalUnknownRate: number;
    eligibleTotal: number;
    eligibleHasModelCodeRate: number;
    eligibleParserReadyRate: number;
    eligibleCriticalUnknownRate: number;
    gateCounts: Array<{ key: string; count: number }>;
    unknownParts: Array<{ key: string; count: number }>;
    topComparableKeys: Array<{ key: string; count: number }>;
  };
  mustHold: string[];
  requiredBeforeAnyMainReview: string[];
  doNotDo: string[];
};

type SpecEvidence = {
  metrics: {
    pendingRows: number;
    rowsWithExternalSpecEvidence: number;
    externallyResolvedResolutionRows: number;
    externallyResolvedRefreshRows: number;
    refreshStillUnknownRows: number;
    officialSourceRows: number;
    marketplaceSourceRows: number;
    confirmedTestCandidates: number;
    runtimeApprovedRows: number;
  };
  rows: Array<{
    hint: string;
    pid: string;
    title: string;
    comparableKey: string;
    criticalUnknown: string[];
    specEvidence?: {
      sourceName: string;
      sourceType: string;
      sourceUrl: string;
      resolvedResolution: string | null;
      resolvedRefresh: string | null;
      evidenceConfidence: string;
      reportOnlyDecision: string;
    };
    confirmedTestCandidate: boolean;
  }>;
};

type ExclusionMatrix = {
  metrics: {
    matrixRows: number;
    hardExclusionRows: number;
    reviewGatedRows: number;
    confirmedTestCandidates: number;
    runtimeApprovedRows: number;
  };
  rows: Array<{
    pid: string;
    title: string;
    comparableKey: string;
    exclusionClass: string;
    action: string;
    evidenceClass: string;
    unknownTokens?: string[];
    criticalUnknown?: string[];
  }>;
};

type TestCandidateReadiness = {
  metrics: {
    hintRows: number;
    confirmedTestCandidates: number;
    pendingManualConfirmation: number;
    excludedBeforeTestCandidate: number;
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
const retrievedAt = "2026-05-11";

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

function findCleanModelSample(samples: Sample[], pattern: RegExp, fallback: string): Sample | undefined {
  const unsafe = /(거치대|모니터암|스탠드|케이블|어댑터|부품용|파손|깨져|고장|삽니다|매입|구매합니다|TV|티비)/i;
  return samples.find((sample) => {
    const title = sample.name ?? sample.title ?? "";
    return pattern.test(`${title}\n${sample.description ?? ""}`) && !unsafe.test(title);
  }) ?? findSample(samples, pattern, fallback);
}

function makeCase(input: Omit<ImplementationCase, "phase" | "category" | "scope" | "laterRuntimeFiles">): ImplementationCase {
  return {
    phase: "Phase 4 - Monitor / Model-Code Rows",
    category: "monitor_discovered",
    scope: "Monitor model-code implementation-prep only; no confirmed runtime test candidates",
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
  const samples = await readJson<Sample[]>(path.join(categoryDir, "monitor_discovered/samples.json"));
  const blockers = await readJson<Blockers>(path.join(reportsDir, "monitor-model-code-blockers-latest.json"));
  const specEvidence = await readJson<SpecEvidence>(path.join(reportsDir, "monitor-pending-model-spec-evidence-latest.json"));
  const exclusion = await readJson<ExclusionMatrix>(path.join(reportsDir, "monitor-exclusion-evidence-matrix-latest.json"));
  const readiness = await readJson<TestCandidateReadiness>(path.join(reportsDir, "monitor-test-candidate-readiness-latest.json"));

  const xl2540k = findCleanModelSample(samples, /XL2540K/i, "벤큐 XL2540K 240hz 게이밍 모니터");
  const lg27us550 = findCleanModelSample(samples, /27US550/i, "LG전자 27US550 판매합니다");
  const samsungLs27 = findCleanModelSample(samples, /LS27F354FHK/i, "(미개봉)삼성전자 27인치 모니터 LS27F354FHK");
  const crossover32 = findCleanModelSample(samples, /32RTX950/i, "크로스오버 32RTX950 UHD 4K 160HZ 모니터");
  const generic = exclusion.rows.find((row) => row.exclusionClass === "generic_monitor_no_model_code");
  const accessory = exclusion.rows.find((row) => row.exclusionClass === "accessory_stand_arm");
  const damaged = exclusion.rows.find((row) => row.exclusionClass === "parts_or_damaged");
  const bundle = exclusion.rows.find((row) => row.exclusionClass === "multi_or_bundle");
  const tv = findSample(samples, /티비\s*모니터|스마트\s*TV|TV\s*\d+인치/i, "LG 28인치 티비 모니터");
  const u2412 = specEvidence.rows.find((row) => row.hint === "u2412mb");
  const ct2210 = specEvidence.rows.find((row) => row.hint === "ct2210ips");

  const cases: ImplementationCase[] = [
    makeCase({
      caseId: "MONITOR-SPLIT-01",
      inputTitle: titleOf(xl2540k, "벤큐 XL2540K 240hz 게이밍 모니터"),
      inputDescription: descOf(xl2540k),
      expectedClass: "split_only",
      blockerType: "explicit_model_code_row_not_confirmed_candidate",
      productIdentityTokens: ["monitor", "benq", "xl2540k"],
      variantTokens: ["240hz"],
      conditionTokens: ["normal"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "category-intelligence/monitor_discovered/samples.json",
      externalEvidence: [],
      confidence: "medium",
      notes: "Explicit model-code row is useful for fixture shape, but confirmed monitor test candidates remain zero.",
    }),
    makeCase({
      caseId: "MONITOR-SPLIT-02",
      inputTitle: titleOf(lg27us550, "LG전자 27US550 판매합니다"),
      inputDescription: descOf(lg27us550),
      expectedClass: "split_only",
      blockerType: "explicit_model_code_row_not_confirmed_candidate",
      productIdentityTokens: ["monitor", "lg", "27us550"],
      variantTokens: [],
      conditionTokens: ["normal"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "category-intelligence/monitor_discovered/samples.json",
      externalEvidence: [],
      confidence: "medium",
      notes: "Model-code token should be preserved, not inferred from size/spec-only rows.",
    }),
    makeCase({
      caseId: "MONITOR-SPLIT-03",
      inputTitle: titleOf(samsungLs27, "(미개봉)삼성전자 27인치 모니터 LS27F354FHK"),
      inputDescription: descOf(samsungLs27),
      expectedClass: "split_only",
      blockerType: "explicit_model_code_row_not_confirmed_candidate",
      productIdentityTokens: ["monitor", "samsung", "ls27f354fhk"],
      variantTokens: ["27in"],
      conditionTokens: ["sealed_or_new_claim"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "category-intelligence/monitor_discovered/samples.json",
      externalEvidence: [],
      confidence: "medium",
      notes: "Explicit Samsung model-code row is a later dry-run fixture only.",
    }),
    makeCase({
      caseId: "MONITOR-SPLIT-04",
      inputTitle: titleOf(crossover32, "크로스오버 32RTX950 UHD 4K 160HZ 모니터"),
      inputDescription: descOf(crossover32),
      expectedClass: "split_only",
      blockerType: "explicit_model_code_with_spec_tokens_not_confirmed_candidate",
      productIdentityTokens: ["monitor", "crossover", "32rtx950"],
      variantTokens: ["32in", "uhd_4k", "160hz"],
      conditionTokens: ["normal"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "category-intelligence/monitor_discovered/samples.json",
      externalEvidence: [],
      confidence: "medium",
      notes: "Spec tokens are useful but still not runtime approval.",
    }),
    makeCase({
      caseId: "MONITOR-MANUAL-01",
      inputTitle: u2412?.title ?? "델 24인치 피벗 모니터 u2412mb",
      inputDescription: "",
      expectedClass: "manual_review",
      blockerType: "pending_model_code_with_official_spec_evidence",
      productIdentityTokens: ["monitor", "dell", "u2412mb"],
      variantTokens: ["24in", "1920x1200", "60hz"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `monitor-pending-model-spec-evidence-latest.json:${u2412?.pid ?? "u2412mb"}`,
      externalEvidence: u2412?.specEvidence ? [{ label: u2412.specEvidence.sourceName, url: u2412.specEvidence.sourceUrl, retrievedAt }] : [],
      confidence: "high",
      notes: "Official spec resolves resolution/refresh, but report still says confirmedTestCandidates=0.",
    }),
    makeCase({
      caseId: "MONITOR-MANUAL-02",
      inputTitle: ct2210?.title ?? "카멜 CT2210IPS 54cm 안드로이드 터치모니터",
      inputDescription: "",
      expectedClass: "manual_review",
      blockerType: "pending_model_code_marketplace_spec_refresh_unknown",
      productIdentityTokens: ["monitor", "camel", "ct2210ips"],
      variantTokens: ["21_5in", "touch", "android"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `monitor-pending-model-spec-evidence-latest.json:${ct2210?.pid ?? "ct2210ips"}`,
      externalEvidence: ct2210?.specEvidence ? [{ label: ct2210.specEvidence.sourceName, url: ct2210.specEvidence.sourceUrl, retrievedAt }] : [],
      confidence: "medium",
      notes: "Resolution is externally reduced, but refresh/product-class ambiguity keeps it manual-review.",
    }),
    makeCase({
      caseId: "MONITOR-HOLD-01",
      inputTitle: generic?.title ?? "27인치 FHD 커브드 게이밍 모니터",
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "generic_monitor_no_model_code_hold",
      productIdentityTokens: ["monitor", "generic_monitor"],
      variantTokens: ["size_or_spec_only"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `monitor-exclusion-evidence-matrix-latest.json:${generic?.pid ?? "generic"}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Size/resolution/Hz-only rows must not become model-code candidates.",
    }),
    makeCase({
      caseId: "MONITOR-HOLD-02",
      inputTitle: accessory?.title ?? "카멜 PMA-2 고중량 모니터 거치대",
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "monitor_arm_stand_accessory_hold",
      productIdentityTokens: ["monitor_accessory"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: ["stand", "arm", "mount"],
      evidenceSource: `monitor-exclusion-evidence-matrix-latest.json:${accessory?.pid ?? "accessory"}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Accessory-only rows are hard exclusions.",
    }),
    makeCase({
      caseId: "MONITOR-HOLD-03",
      inputTitle: damaged?.title ?? "부품용)camel 27인치 모니터",
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "parts_or_damaged_monitor_hold",
      productIdentityTokens: ["monitor"],
      variantTokens: [],
      conditionTokens: ["damaged", "parts"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: ["parts"],
      evidenceSource: `monitor-exclusion-evidence-matrix-latest.json:${damaged?.pid ?? "damaged"}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Damaged/parts rows must stay out of comparable ready rows.",
    }),
    makeCase({
      caseId: "MONITOR-HOLD-04",
      inputTitle: bundle?.title ?? "이홈웨이 듀얼모니터 XP-142NW",
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "multi_or_bundle_monitor_hold",
      productIdentityTokens: ["monitor"],
      variantTokens: ["dual_or_bundle"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: ["multi", "bundle"],
      accessoryOrPartTokens: [],
      evidenceSource: `monitor-exclusion-evidence-matrix-latest.json:${bundle?.pid ?? "bundle"}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Multi/bundle monitor rows require separate package policy.",
    }),
    makeCase({
      caseId: "MONITOR-HOLD-05",
      inputTitle: titleOf(tv, "LG 28인치 티비 모니터"),
      inputDescription: descOf(tv),
      expectedClass: "hold",
      blockerType: "tv_monitor_boundary_hold",
      productIdentityTokens: ["tv_monitor_boundary"],
      variantTokens: ["tv"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "category-intelligence/monitor_discovered/samples.json",
      externalEvidence: [],
      confidence: "medium",
      notes: "TV/monitor hybrid rows need a separate device-class split before monitor model-code readiness.",
    }),
  ];

  const splitOnlyCases = cases.filter((row) => row.expectedClass === "split_only");
  const negativeHoldTestCases = cases.filter((row) => row.expectedClass === "hold");
  const manualReviewTestCases = cases.filter((row) => row.expectedClass === "manual_review");

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    scope: "Monitor model-code implementation-prep only",
    nonScope: [
      "whole monitor_discovered public readiness",
      "adding monitor hints to runtime catalog",
      "candidate pool policy wiring",
      "runtime parser/catalog/pipeline edits",
      "treating eligible-only metrics as whole-category readiness",
    ],
    sourceReportsRead: [
      "monitor-model-code-blockers-latest.json",
      "monitor-pending-model-spec-evidence-latest.json",
      "monitor-exclusion-evidence-matrix-latest.json",
      "monitor-test-candidate-readiness-latest.json",
      "category-intelligence/monitor_discovered/samples.json",
    ],
    metrics: {
      total: blockers.currentMetrics.total,
      hasModelCodeRate: blockers.currentMetrics.hasModelCodeRate,
      genericKeyRate: blockers.currentMetrics.genericKeyRate,
      parserReadyRate: blockers.currentMetrics.parserReadyRate,
      criticalUnknownRate: blockers.currentMetrics.criticalUnknownRate,
      eligibleTotal: blockers.currentMetrics.eligibleTotal,
      eligibleParserReadyRate: blockers.currentMetrics.eligibleParserReadyRate,
      eligibleCriticalUnknownRate: blockers.currentMetrics.eligibleCriticalUnknownRate,
      confirmedTestCandidates: readiness.metrics.confirmedTestCandidates,
      pendingManualConfirmation: readiness.metrics.pendingManualConfirmation,
      excludedBeforeTestCandidate: readiness.metrics.excludedBeforeTestCandidate,
      externalSpecRows: specEvidence.metrics.rowsWithExternalSpecEvidence,
      officialSourceRows: specEvidence.metrics.officialSourceRows,
      runtimeApprovedRows: specEvidence.metrics.runtimeApprovedRows + exclusion.metrics.runtimeApprovedRows,
      testCaseCount: cases.length,
      positiveCount: 0,
      splitOnlyCount: splitOnlyCases.length,
      holdCount: negativeHoldTestCases.length,
      manualReviewCount: manualReviewTestCases.length,
    },
    gateCounts: blockers.currentMetrics.gateCounts,
    unknownParts: blockers.currentMetrics.unknownParts,
    topComparableKeys: blockers.currentMetrics.topComparableKeys,
    splitOnlyOrArchitectureCases: splitOnlyCases,
    positiveTestCases: [],
    negativeHoldTestCases,
    manualReviewTestCases,
    blockerToTestMapping: [
      { blocker: "Explicit model-code rows preserved as split-only fixtures", caseIds: splitOnlyCases.map((row) => row.caseId) },
      { blocker: "Pending model-code rows with external spec evidence", caseIds: manualReviewTestCases.map((row) => row.caseId) },
      { blocker: "Generic/accessory/damaged/bundle/TV boundary holds", caseIds: negativeHoldTestCases.map((row) => row.caseId) },
    ],
    externalTaxonomyNotes: [
      "Dell U2412M/U2412Mb official manual evidence is report-only and does not create a runtime candidate.",
      "CT2210IPS marketplace spec evidence resolves resolution only; refresh and product-class ambiguity remain.",
      "No monitor row is confirmed as a test candidate in current readiness reports.",
    ],
    externalSources: [
      ...manualReviewTestCases.flatMap((row) => row.externalEvidence),
    ],
    dryRunStrategyForMainAgent: [
      "Replay split-only fixtures through parser/gate in a no-mutation test harness after manual candidate confirmation exists.",
      "Assert generic size/resolution/Hz-only rows remain hold without model code.",
      "Assert monitor arm/stand/damaged/bundle/TV-boundary rows stay out of candidate pool.",
      "Assert external spec evidence reduces ambiguity only in reports and never writes runtime catalog entries.",
    ],
    stopCondition: "Stop before editing runtime parser/catalog/pipeline/candidate pool files.",
    nextQueueItem: "Phase 5 - Desktop / Complete CPU-GPU Body Rows",
    deferred: [
      "Monitor confirmed test candidates remain zero; main/owner review must choose specific model codes before runtime work.",
      "Official/brand specs should be collected for each selected model-code row, not inferred from title specs alone.",
      "TV/monitor hybrids and Android touch/signage monitors need a device-class split before readiness.",
      "Eligible-only parser readiness must not be treated as whole-category public readiness.",
    ],
    inheritedMustHold: blockers.mustHold,
    inheritedDoNotDo: blockers.doNotDo,
    requiredBeforeAnyMainReview: blockers.requiredBeforeAnyMainReview,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "monitor-model-code-implementation-prep-latest.json"), JSON.stringify(report, null, 2));

  const caseTable = [
    "| case_id | expected | blocker_type | title | confidence |",
    "| --- | --- | --- | --- | --- |",
    ...cases.map((row) => `| ${row.caseId} | ${row.expectedClass} | ${row.blockerType} | ${row.inputTitle.replace(/\|/g, "/")} | ${row.confidence} |`),
  ].join("\n");
  const mappingTable = [
    "| blocker | case_ids |",
    "| --- | --- |",
    ...report.blockerToTestMapping.map((row) => `| ${row.blocker} | ${row.caseIds.join(", ")} |`),
  ].join("\n");
  const md = [
    "# Monitor Model-Code Implementation-Prep",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Implementation-prep for monitor model-code rows. This is not runtime wiring, candidate pool wiring, or public promotion.",
    "",
    "## Metrics",
    "",
    `- total samples: ${report.metrics.total}`,
    `- has model-code rate: ${report.metrics.hasModelCodeRate}%`,
    `- generic key rate: ${report.metrics.genericKeyRate}%`,
    `- parser-ready rate: ${report.metrics.parserReadyRate}%`,
    `- critical unknown rate: ${report.metrics.criticalUnknownRate}%`,
    `- eligible total: ${report.metrics.eligibleTotal}`,
    `- eligible parser-ready rate: ${report.metrics.eligibleParserReadyRate}%`,
    `- confirmed test candidates: ${report.metrics.confirmedTestCandidates}`,
    `- pending manual confirmation: ${report.metrics.pendingManualConfirmation}`,
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
    mappingTable,
    "",
    "## External Taxonomy Notes",
    "",
    ...report.externalTaxonomyNotes.map((line) => `- ${line}`),
    "",
    "## External Sources",
    "",
    ...report.externalSources.map((source) => `- ${source.label}: ${source.url} (retrieved ${source.retrievedAt})`),
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

  await writeFile(path.join(reportsDir, "monitor-model-code-implementation-prep-latest.md"), `${md}\n`);
  console.log("wrote reports/monitor-model-code-implementation-prep-latest.json");
  console.log("wrote reports/monitor-model-code-implementation-prep-latest.md");
  console.log(`monitor model-code implementation prep: cases=${cases.length}, split_only=${splitOnlyCases.length}, hold=${negativeHoldTestCases.length}, manual=${manualReviewTestCases.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
