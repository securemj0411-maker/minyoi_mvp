import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type FamilyRow = {
  family: string;
  brand: string;
  deviceClass: string;
  familyCount: number;
  exactModelCount: number;
  unknownVariantCount: number;
  modelExamples: Array<{ key: string; count: number }>;
  subsetClass?: string;
  evidenceClass?: string;
};

type Blockers = {
  currentMetrics: {
    total: number;
    normal: number;
    modelMatchedRate: number;
    genericFamilyRate: number;
    gateCounts: Array<{ key: string; count: number }>;
    topFamilyCounts: Array<{ key: string; count: number }>;
    topModelCounts: Array<{ key: string; count: number }>;
  };
  doNotDo: string[];
};

type PortableSubset = {
  metrics: {
    familyRows: number;
    portableExactModelRows: number;
    portableExactModelUnits: number;
    unknownVariantRows: number;
    unknownVariantUnits: number;
    ampReceiverUnits: number;
    paSpeakerUnits: number;
    runtimeApprovedRows: number;
  };
  rows: FamilyRow[];
};

type GenericExclusion = {
  metrics: {
    genericExampleRows: number;
    positiveCandidateRows: number;
    exclusionCandidateOnlyRows: number;
  };
  rows: Array<{ pid: string; title: string; family: string; exclusionClass: string; action: string }>;
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
    phase: "Phase 8 - Speaker/Audio Device-Class Lightweight Split Prep",
    category: "speaker_audio_discovered",
    scope: "Speaker/audio device-class split prep only; no portable speaker runtime policy",
    laterRuntimeFiles: [
      "src/lib/option-parser.ts",
      "src/lib/pipeline.ts",
      "src/lib/category-readiness.ts",
      "src/lib/candidate-pool-builder.ts",
    ],
    ...input,
  };
}

function rowTitle(row: FamilyRow): string {
  const example = row.modelExamples[0]?.key ?? row.family;
  return `${row.brand} ${example}`.trim();
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const blockers = await readJson<Blockers>(path.join(reportsDir, "speaker-family-blockers-latest.json"));
  const portable = await readJson<PortableSubset>(path.join(reportsDir, "speaker-portable-model-subset-boundary-evidence-latest.json"));
  const generic = await readJson<GenericExclusion>(path.join(reportsDir, "speaker-generic-exclusion-readiness-latest.json"));

  const portableRows = portable.rows.filter((row) => row.subsetClass === "portable_exact_model_reference_only").slice(0, 3);
  const amp = portable.rows.find((row) => row.subsetClass === "excluded_amp_receiver_device_class");
  const pa = portable.rows.find((row) => row.subsetClass === "hold_pa_speaker_device_class");
  const unknownVariant = portable.rows.find((row) => row.subsetClass === "hold_unknown_variant_within_speaker_family");
  const genericRows = generic.rows.slice(0, 3);

  const cases: ImplementationCase[] = [
    ...portableRows.map((row, index) => makeCase({
      caseId: `SPEAKER-SPLIT-${String(index + 1).padStart(2, "0")}`,
      inputTitle: rowTitle(row),
      inputDescription: "",
      expectedClass: "split_only",
      blockerType: "portable_exact_model_reference_only",
      productIdentityTokens: ["portable_speaker", row.brand, row.family],
      variantTokens: row.modelExamples.map((example) => example.key),
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `speaker-portable-model-subset-boundary-evidence-latest.json:${row.family}`,
      externalEvidence: [],
      confidence: row.familyCount >= 2 ? "medium" : "low",
      notes: "Exact-model portable speaker row is parser-candidate reference only, not runtime approval.",
    })),
    amp ? makeCase({
      caseId: "SPEAKER-HOLD-01",
      inputTitle: rowTitle(amp),
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "amp_receiver_device_class_hold",
      productIdentityTokens: ["amp_receiver", amp.brand, amp.family],
      variantTokens: amp.modelExamples.map((example) => example.key),
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `speaker-device-class-boundary-evidence-latest.json:${amp.family}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Amp/receiver rows must not merge with portable speaker comparable keys.",
    }) : undefined,
    pa ? makeCase({
      caseId: "SPEAKER-HOLD-02",
      inputTitle: rowTitle(pa),
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "pa_speaker_device_class_hold",
      productIdentityTokens: ["pa_speaker", pa.brand, pa.family],
      variantTokens: pa.modelExamples.map((example) => example.key),
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `speaker-device-class-boundary-evidence-latest.json:${pa.family}`,
      externalEvidence: [],
      confidence: "high",
      notes: "PA speaker rows need their own class boundary.",
    }) : undefined,
    unknownVariant ? makeCase({
      caseId: "SPEAKER-MANUAL-01",
      inputTitle: rowTitle(unknownVariant),
      inputDescription: "",
      expectedClass: "manual_review",
      blockerType: "portable_speaker_unknown_variant_hold",
      productIdentityTokens: ["portable_speaker", unknownVariant.brand, unknownVariant.family],
      variantTokens: ["unknown_variant"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `speaker-portable-model-subset-boundary-evidence-latest.json:${unknownVariant.family}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Family-level model is not enough; exact variant must be confirmed.",
    }) : undefined,
    ...genericRows.map((row, index) => makeCase({
      caseId: `SPEAKER-HOLD-${String(index + 3).padStart(2, "0")}`,
      inputTitle: row.title,
      inputDescription: "",
      expectedClass: "hold",
      blockerType: `speaker_generic_${row.exclusionClass}_hold`,
      productIdentityTokens: ["speaker_generic"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: row.exclusionClass.includes("bundle") ? ["bundle"] : [],
      accessoryOrPartTokens: row.exclusionClass.includes("accessory") ? ["accessory"] : [],
      evidenceSource: `speaker-generic-exclusion-readiness-latest.json:${row.pid}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Generic speaker rows are exclusion candidates only and must not become comparable keys.",
    })),
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
    scope: "Speaker/audio device-class split prep only",
    nonScope: [
      "whole speaker_audio_discovered public readiness",
      "portable speaker runtime policy",
      "amp/receiver or PA speaker comparable policy",
      "candidate pool policy wiring",
    ],
    sourceReportsRead: [
      "speaker-family-blockers-latest.json",
      "speaker-device-class-boundary-evidence-latest.json",
      "speaker-device-class-review-latest.json",
      "speaker-portable-model-subset-boundary-evidence-latest.json",
      "speaker-generic-exclusion-readiness-latest.json",
    ],
    metrics: {
      total: blockers.currentMetrics.total,
      normal: blockers.currentMetrics.normal,
      modelMatchedRate: blockers.currentMetrics.modelMatchedRate,
      genericFamilyRate: blockers.currentMetrics.genericFamilyRate,
      familyRows: portable.metrics.familyRows,
      portableExactModelRows: portable.metrics.portableExactModelRows,
      portableExactModelUnits: portable.metrics.portableExactModelUnits,
      unknownVariantRows: portable.metrics.unknownVariantRows,
      ampReceiverUnits: portable.metrics.ampReceiverUnits,
      paSpeakerUnits: portable.metrics.paSpeakerUnits,
      genericExampleRows: generic.metrics.genericExampleRows,
      runtimeApprovedRows: portable.metrics.runtimeApprovedRows,
      testCaseCount: cases.length,
      positiveCount: 0,
      splitOnlyCount: splitOnlyOrArchitectureCases.length,
      holdCount: negativeHoldTestCases.length,
      manualReviewCount: manualReviewTestCases.length,
    },
    gateCounts: blockers.currentMetrics.gateCounts,
    topFamilyCounts: blockers.currentMetrics.topFamilyCounts,
    topModelCounts: blockers.currentMetrics.topModelCounts,
    positiveTestCases: [],
    splitOnlyOrArchitectureCases,
    manualReviewTestCases,
    negativeHoldTestCases,
    blockerToTestMapping: [
      { blocker: "Portable exact-model reference only", caseIds: splitOnlyOrArchitectureCases.map((row) => row.caseId) },
      { blocker: "Unknown portable variant manual review", caseIds: manualReviewTestCases.map((row) => row.caseId) },
      { blocker: "Amp/receiver, PA, and generic exclusions", caseIds: negativeHoldTestCases.map((row) => row.caseId) },
    ],
    externalTaxonomyNotes: [
      "speaker-generic family must not be a comparable key.",
      "Amp/receiver and PA speaker rows need separate device-class lanes.",
      "Portable exact-model rows remain parser-candidate review references only.",
    ],
    externalSources: [],
    dryRunStrategyForMainAgent: [
      "Assert amp/receiver and PA rows never merge with portable speaker keys.",
      "Assert speaker-generic rows stay hold unless exact model identity exists.",
      "Use portable exact-model rows only after main-approved model subset policy.",
    ],
    stopCondition: "Stop before editing runtime parser/catalog/pipeline/candidate pool files.",
    nextQueueItem: "Phase 9 - Home Appliance/Vacuum Subtype Lightweight Split Prep",
    deferred: [
      "Portable speaker exact-model policy needs more examples and main approval.",
      "Amp/receiver and PA speaker lanes require separate device-class taxonomy.",
      "Generic/novelty/cross-device speaker rows remain exclusion-only.",
    ],
    inheritedDoNotDo: blockers.doNotDo,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "speaker-audio-device-class-split-prep-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Speaker Audio Device-Class Split Prep",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Lightweight split prep for speaker/audio device-class rows. This is not runtime wiring, candidate pool wiring, or public promotion.",
    "",
    "## Metrics",
    "",
    `- total samples: ${report.metrics.total}`,
    `- normal rows: ${report.metrics.normal}`,
    `- model-matched rate: ${report.metrics.modelMatchedRate}%`,
    `- generic family rate: ${report.metrics.genericFamilyRate}%`,
    `- portable exact-model rows/units: ${report.metrics.portableExactModelRows}/${report.metrics.portableExactModelUnits}`,
    `- unknown variant rows: ${report.metrics.unknownVariantRows}`,
    `- amp/receiver units: ${report.metrics.ampReceiverUnits}`,
    `- PA speaker units: ${report.metrics.paSpeakerUnits}`,
    `- generic example rows: ${report.metrics.genericExampleRows}`,
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

  await writeFile(path.join(reportsDir, "speaker-audio-device-class-split-prep-latest.md"), `${md}\n`);
  console.log("wrote reports/speaker-audio-device-class-split-prep-latest.json");
  console.log("wrote reports/speaker-audio-device-class-split-prep-latest.md");
  console.log(`speaker/audio split prep: cases=${cases.length}, split_only=${splitOnlyOrArchitectureCases.length}, hold=${negativeHoldTestCases.length}, manual=${manualReviewTestCases.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
