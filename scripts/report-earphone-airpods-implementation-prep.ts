import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  name?: string;
  title?: string;
  description?: string;
};

type EvidenceMatrix = {
  metrics: {
    total: number;
    normal: number;
    normalRate: number;
    nonNormal: number;
    nonNormalRate: number;
    parserReadyRate: number;
    partsRows: number;
    unknownRows: number;
    buyingOrCalloutRows: number;
    skuCounts: Array<{ key: string; count: number }>;
    connectorCounts: Array<{ key: string; count: number }>;
  };
  policyImplications: string[];
  doNotDo: string[];
};

type PartsEvidence = {
  metrics: {
    partsRows: number;
    directExclusionRows: number;
    ambiguousPartsRows: number;
  };
  evidenceRows: Array<{
    partClass: string;
    count: number;
    evidenceClass: string;
    reportOnlyAction: string;
    samplePids: Array<string | number>;
    sampleTitles: string[];
  }>;
};

type BoundaryExamples = {
  rows: Array<{
    category: string;
    pid: string;
    title: string;
    boundaryClass: string;
    evidenceClass: string;
    sourceReport: string;
  }>;
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

const appleSources = [
  {
    label: "Apple Support - AirPods 4 tech specs",
    url: "https://support.apple.com/en-us/121203",
    retrievedAt,
  },
  {
    label: "Apple Support - AirPods 4 with Active Noise Cancellation tech specs",
    url: "https://support.apple.com/en-lamr/121204",
    retrievedAt,
  },
  {
    label: "Apple Support - AirPods Pro 2 with MagSafe Charging Case (USB-C) tech specs",
    url: "https://support.apple.com/en-me/111834",
    retrievedAt,
  },
  {
    label: "Apple Support - AirPods Pro 2 with MagSafe Charging Case (Lightning) tech specs",
    url: "https://support.apple.com/en-la/111851",
    retrievedAt,
  },
  {
    label: "Apple Support - Identify your AirPods",
    url: "https://support.apple.com/en-gb/HT209580",
    retrievedAt,
  },
];

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

function findPositiveSample(samples: Sample[], include: RegExp, fallback: string): Sample | undefined {
  const unsafePositive = /(본체|케이스|왼쪽|오른쪽|유닛|단품|낱개|한쪽|삽니다|매입|구매)/i;
  return samples.find((sample) => {
    const text = `${sample.name ?? sample.title ?? ""}\n${sample.description ?? ""}`;
    return include.test(text) && !unsafePositive.test(sample.name ?? sample.title ?? "");
  }) ?? findSample(samples, include, fallback);
}

function makeCase(input: Omit<ImplementationCase, "phase" | "category" | "scope" | "laterRuntimeFiles">): ImplementationCase {
  return {
    phase: "Phase 1 - Earphone / AirPods-Focused Subset",
    category: "earphone_discovered",
    scope: "AirPods-focused rows only; non-AirPods remains hold/approval-only",
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
  const samples = await readJson<Sample[]>(path.join(categoryDir, "earphone_discovered/samples.json"));
  const airpodsSamples = await readJson<Sample[]>(path.join(categoryDir, "airpods/samples.json"));
  const evidence = await readJson<EvidenceMatrix>(path.join(reportsDir, "earphone-airpods-evidence-matrix-latest.json"));
  const parts = await readJson<PartsEvidence>(path.join(reportsDir, "earphone-parts-exclusion-evidence-latest.json"));
  const boundaries = await readJson<BoundaryExamples>(path.join(reportsDir, "parser-airpods-headphone-boundary-examples-latest.json"));

  const allSamples = [...samples, ...airpodsSamples];
  const sample = (pattern: RegExp, fallback: string): Sample | undefined => findSample(allSamples, pattern, fallback);

  const pro2Usb = findPositiveSample(allSamples, /에어팟\s*프로\s*2.*(c타입|씨타입|usb-c|usbc)/i, "에어팟 프로 2세대 c타입");
  const pro2Lightning = findPositiveSample(allSamples, /에어팟\s*프로\s*2.*(8핀|라이트닝|lightning)/i, "에어팟 프로2 8핀");
  const airpods4Anc = findPositiveSample(allSamples, /에어팟\s*4.*(노캔|anc|노이즈)/i, "에어팟4세대 노캔 ANC");
  const airpods4NoAnc = findPositiveSample(allSamples, /에어팟\s*4.*(노캔 아닙니다|기본모델|비노캔|no anc)/i, "에어팟4(노캔 아닙니다)");
  const buying = sample(/매입|삽니다|구매중|구매합니다/i, "고가매입]아이폰,에어팟,에어팟맥스,애플펜슬,애플워치,아이패드,맥북");
  const fake = sample(/차이팟|가품|짝퉁|레플|이미테이션/i, "차이팟 에어팟1세대");
  const nonAirpods = sample(/qcy|톤프리|buds|버즈|beats/i, "QCY Buds 무선 이어폰 새상품");
  const pro3 = sample(/프로\s*3|프로3/i, "에어팟 프로 3세대 새상품 미개봉 판매합니다");

  const boundaryCases = boundaries.rows
    .filter((row) => row.category === "earphone_discovered")
    .slice(0, 8)
    .map((row, index): ImplementationCase => makeCase({
      caseId: `AIRPODS-HOLD-${String(index + 1).padStart(2, "0")}`,
      inputTitle: row.title,
      inputDescription: "",
      expectedClass: row.boundaryClass === "ambiguous_parts_hold" ? "manual_review" : "hold",
      blockerType: row.boundaryClass,
      productIdentityTokens: row.title.includes("에어팟") ? ["airpods"] : [],
      variantTokens: row.title.match(/프로2|4세대|4/) ? [row.title.match(/프로2|4세대|4/)?.[0] ?? ""] : [],
      conditionTokens: [],
      sellerIntentTokens: [],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [row.boundaryClass],
      evidenceSource: `${row.sourceReport}:${row.pid}`,
      externalEvidence: [],
      confidence: row.boundaryClass === "ambiguous_parts_hold" ? "medium" : "high",
      notes: `Boundary evidence class: ${row.evidenceClass}.`,
    }));

  const cases: ImplementationCase[] = [
    makeCase({
      caseId: "AIRPODS-POS-01",
      inputTitle: titleOf(pro2Usb, "Airpods Pro2"),
      inputDescription: descOf(pro2Usb),
      expectedClass: "positive",
      blockerType: "airpods_pro_2_usb_c_full_product",
      productIdentityTokens: ["airpods", "airpods_pro_2"],
      variantTokens: ["usb-c"],
      conditionTokens: ["full_product"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "earphone-airpods-evidence-matrix-latest.json",
      externalEvidence: appleSources.filter((source) => source.label.includes("USB-C")),
      confidence: "medium",
      notes: "Positive candidate only after side/case/accessory/buying gates pass; title alone may omit connector.",
    }),
    makeCase({
      caseId: "AIRPODS-POS-02",
      inputTitle: titleOf(pro2Lightning, "에어팟 프로2 8핀"),
      inputDescription: descOf(pro2Lightning),
      expectedClass: "positive",
      blockerType: "airpods_pro_2_lightning_full_product",
      productIdentityTokens: ["airpods", "airpods_pro_2"],
      variantTokens: ["lightning", "8핀"],
      conditionTokens: ["full_product"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "earphone-airpods-blockers-latest.json:keyCounts",
      externalEvidence: appleSources.filter((source) => source.label.includes("Lightning") || source.label.includes("Identify")),
      confidence: "medium",
      notes: "Positive only when not side-only/case-only. 8-pin/Lightning is a connector split, not a cosmetic token.",
    }),
    makeCase({
      caseId: "AIRPODS-POS-03",
      inputTitle: titleOf(airpods4Anc, "에어팟4세대 노캔 ANC"),
      inputDescription: descOf(airpods4Anc),
      expectedClass: "positive",
      blockerType: "airpods_4_anc_full_product",
      productIdentityTokens: ["airpods", "airpods_4"],
      variantTokens: ["anc"],
      conditionTokens: ["full_product"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "earphone-airpods-blockers-latest.json:keyCounts",
      externalEvidence: appleSources.filter((source) => source.label.includes("AirPods 4 with Active")),
      confidence: "medium",
      notes: "ANC is a required variant split. Keep separate from no-ANC AirPods 4.",
    }),
    makeCase({
      caseId: "AIRPODS-POS-04",
      inputTitle: titleOf(airpods4NoAnc, "에어팟4(노캔 아닙니다)"),
      inputDescription: descOf(airpods4NoAnc),
      expectedClass: "positive",
      blockerType: "airpods_4_no_anc_full_product",
      productIdentityTokens: ["airpods", "airpods_4"],
      variantTokens: ["no_anc"],
      conditionTokens: ["full_product"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "earphone-airpods-blockers-latest.json:keyCounts",
      externalEvidence: appleSources.filter((source) => source.label === "Apple Support - AirPods 4 tech specs"),
      confidence: "medium",
      notes: "No-ANC AirPods 4 must not merge with ANC rows.",
    }),
    ...boundaryCases,
    makeCase({
      caseId: "AIRPODS-HOLD-09",
      inputTitle: titleOf(nonAirpods, "QCY Buds 무선 이어폰 새상품"),
      inputDescription: descOf(nonAirpods),
      expectedClass: "hold",
      blockerType: "non_airpods_earphone_hold",
      productIdentityTokens: ["non_airpods"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "earphone-airpods-blockers-latest.json:mustHold",
      externalEvidence: [],
      confidence: "high",
      notes: "Current AirPods-focused evidence does not approve QCY/Tone Free/Beats/Buds/generic earphone rows.",
    }),
    makeCase({
      caseId: "AIRPODS-HOLD-10",
      inputTitle: titleOf(buying, "고가매입]아이폰,에어팟,에어팟맥스,애플펜슬,애플워치,아이패드,맥북"),
      inputDescription: descOf(buying),
      expectedClass: "hold",
      blockerType: "buying_or_wanted_hold",
      productIdentityTokens: ["airpods"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["buying", "wanted"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "earphone-airpods-evidence-matrix-latest.json:buyingOrCalloutRows",
      externalEvidence: [],
      confidence: "high",
      notes: "Buying/wanted posts are not sell-side product candidates.",
    }),
    makeCase({
      caseId: "AIRPODS-HOLD-11",
      inputTitle: titleOf(fake, "차이팟 에어팟1세대"),
      inputDescription: descOf(fake),
      expectedClass: "hold",
      blockerType: "fake_or_counterfeit_hold",
      productIdentityTokens: ["airpods"],
      variantTokens: [],
      conditionTokens: ["fake_or_counterfeit"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "earphone-airpods-blockers-latest.json:mustHold",
      externalEvidence: [],
      confidence: "medium",
      notes: "Fake/counterfeit signal must dominate over apparent AirPods tokens.",
    }),
    makeCase({
      caseId: "AIRPODS-MANUAL-01",
      inputTitle: titleOf(pro3, "에어팟 프로 3세대 새상품 미개봉 판매합니다"),
      inputDescription: descOf(pro3),
      expectedClass: "manual_review",
      blockerType: "future_or_unsupported_generation_wording",
      productIdentityTokens: ["airpods", "airpods_pro"],
      variantTokens: ["pro_3_claim"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "earphone-airpods-blockers-latest.json:mustHold",
      externalEvidence: appleSources,
      confidence: "low",
      notes: "Unsupported/future generation wording should not be guessed into Pro 2 or another known SKU.",
    }),
  ];

  const positiveTestCases = cases.filter((row) => row.expectedClass === "positive");
  const negativeHoldTestCases = cases.filter((row) => row.expectedClass === "hold");
  const manualReviewTestCases = cases.filter((row) => row.expectedClass === "manual_review");

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    scope: "AirPods-focused earphone_discovered implementation-prep only",
    nonScope: [
      "whole earphone_discovered public readiness",
      "non-AirPods earphone runtime policy",
      "candidate pool policy wiring",
      "runtime parser/catalog edits",
      "AirPods Max headphone runtime wiring",
    ],
    sourceReportsRead: [
      "earphone-airpods-evidence-matrix-latest.json",
      "earphone-parts-exclusion-evidence-latest.json",
      "earphone-airpods-blockers-latest.json",
      "parser-airpods-headphone-boundary-examples-latest.json",
      "category-intelligence/earphone_discovered/samples.json",
      "category-intelligence/airpods/samples.json",
    ],
    metrics: {
      total: evidence.metrics.total,
      normal: evidence.metrics.normal,
      normalRate: evidence.metrics.normalRate,
      nonNormal: evidence.metrics.nonNormal,
      nonNormalRate: evidence.metrics.nonNormalRate,
      parserReadyRate: evidence.metrics.parserReadyRate,
      partsRows: parts.metrics.partsRows,
      directExclusionRows: parts.metrics.directExclusionRows,
      ambiguousPartsRows: parts.metrics.ambiguousPartsRows,
      testCaseCount: cases.length,
      positiveCount: positiveTestCases.length,
      holdCount: negativeHoldTestCases.length,
      manualReviewCount: manualReviewTestCases.length,
    },
    positiveTestCases,
    negativeHoldTestCases,
    manualReviewTestCases,
    splitOnlyOrArchitectureCases: [],
    blockerToTestMapping: [
      { blocker: "side-only / left-only / right-only hold", caseIds: cases.filter((row) => row.blockerType.includes("side")).map((row) => row.caseId) },
      { blocker: "case-only / charging-case-only hold", caseIds: cases.filter((row) => row.blockerType.includes("charging_case")).map((row) => row.caseId) },
      { blocker: "unit/single-item context-dependent manual review", caseIds: cases.filter((row) => row.blockerType.includes("ambiguous")).map((row) => row.caseId) },
      { blocker: "fake/counterfeit hold", caseIds: ["AIRPODS-HOLD-11"] },
      { blocker: "buying/wanted hold", caseIds: ["AIRPODS-HOLD-10"] },
      { blocker: "non-AirPods earphone hold", caseIds: ["AIRPODS-HOLD-09"] },
      { blocker: "AirPods generation conflict/manual review", caseIds: ["AIRPODS-MANUAL-01"] },
      { blocker: "AirPods 4 ANC/no-ANC split", caseIds: ["AIRPODS-POS-03", "AIRPODS-POS-04"] },
      { blocker: "AirPods Pro 2 connector split", caseIds: ["AIRPODS-POS-01", "AIRPODS-POS-02"] },
    ],
    externalTaxonomyNotes: [
      "Apple Support separates AirPods 4 and AirPods 4 with Active Noise Cancellation.",
      "Apple Support has separate AirPods Pro 2 USB-C and Lightning charging case specifications.",
      "If official evidence for a claimed future generation is missing, keep the row manual-review/hold.",
    ],
    externalSources: appleSources,
    proposedRuntimeFilesForLater: [
      "src/lib/option-parser.ts",
      "src/lib/pipeline.ts",
      "src/lib/category-readiness.ts",
      "src/lib/candidate-pool-builder.ts",
    ],
    dryRunStrategyForMainAgent: [
      "Replay fixture cases through parser/gate in a no-mutation test harness.",
      "Assert positive AirPods Pro 2 USB-C and Lightning keys never merge.",
      "Assert AirPods 4 ANC/no-ANC keys never merge.",
      "Assert side-only/case-only/buying/fake/non-AirPods rows stay out of candidate pool.",
      "Review manual cases before any runtime policy change.",
    ],
    stopCondition: "Stop before editing runtime parser/catalog/pipeline/candidate pool files.",
    nextQueueItem: "Phase 2 - Headphone / Matched SKU Subset",
    deferred: [
      "Non-AirPods earphone support needs separate mining and must not be inferred from AirPods evidence.",
      "AirPods Pro 3 / unsupported future generation wording remains manual-review until official catalog evidence exists.",
      "Charging-case-only Korean '본체' wording is dangerous and must stay negative/manual unless full product context is clear.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "earphone-airpods-implementation-prep-latest.json"), JSON.stringify(report, null, 2));

  const caseTable = [
    "| case_id | expected | blocker_type | title | confidence |",
    "| --- | --- | --- | --- | --- |",
    ...cases.map((row) => `| ${row.caseId} | ${row.expectedClass} | ${row.blockerType} | ${row.inputTitle.replace(/\|/g, "/")} | ${row.confidence} |`),
  ].join("\n");
  const mappingTable = [
    "| blocker | case_ids |",
    "| --- | --- |",
    ...report.blockerToTestMapping.map((row) => `| ${row.blocker} | ${row.caseIds.join(", ") || "-"} |`),
  ].join("\n");
  const md = [
    "# Earphone AirPods Implementation-Prep",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Implementation-prep for AirPods-focused earphone rows. This is not runtime wiring, candidate pool wiring, or public promotion.",
    "",
    "## Metrics",
    "",
    `- total samples: ${report.metrics.total}`,
    `- normal AirPods rows: ${report.metrics.normal} (${report.metrics.normalRate}%)`,
    `- non-normal rows: ${report.metrics.nonNormal} (${report.metrics.nonNormalRate}%)`,
    `- parts rows: ${report.metrics.partsRows}`,
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

  await writeFile(path.join(reportsDir, "earphone-airpods-implementation-prep-latest.md"), `${md}\n`);
  console.log("wrote reports/earphone-airpods-implementation-prep-latest.json");
  console.log("wrote reports/earphone-airpods-implementation-prep-latest.md");
  console.log(`earphone AirPods implementation prep: cases=${cases.length}, positive=${positiveTestCases.length}, hold=${negativeHoldTestCases.length}, manual=${manualReviewTestCases.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
