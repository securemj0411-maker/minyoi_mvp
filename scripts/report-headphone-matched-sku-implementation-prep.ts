import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  name?: string;
  title?: string;
  description?: string;
  price?: number;
};

type EvidenceMatrix = {
  metrics: {
    total: number;
    normal: number;
    normalRate: number;
    normalWithSku: number;
    parserReadyRate: number;
    needsReviewRate: number;
    airpodsMax: number;
    airpodsMaxReadyRate: number;
    airpodsMaxUnknownGenerationRate: number;
    airpodsMaxUnknownConnectorRate: number;
    reviewExampleRows: number;
    unknownSkuExampleRows: number;
    runtimeApprovedRows: number;
    topComparableKeys: Array<{ key: string; count: number }>;
  };
  examples: Array<{
    pid: string;
    title: string;
    comparableKey?: string;
    connector?: string;
    generation?: string;
    evidenceClass: string;
    runtimeApproved: boolean;
  }>;
};

type AirpodsMaxReview = {
  metrics: {
    reviewRows: number;
    unknownGenerationRows: number;
    unknownConnectorRows: number;
    explicitUsbcRows: number;
    explicitLightningRows: number;
    colorOnlyRows: number;
    runtimeApprovedRows: number;
  };
  evidenceRows: Array<{
    pid: string;
    title: string;
    comparableKey: string;
    connector: string;
    generation: string;
    reviewClass: string;
    evidenceClass: string;
    reportOnlyAction: string;
    runtimeApproved: boolean;
  }>;
};

type Blockers = {
  unknownSkuExamples: Array<{
    pid: string;
    title: string;
    gate: string;
    url?: string;
  }>;
  mustHold: string[];
  doNotDo: string[];
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

const externalSources = [
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

function findPositiveSample(samples: Sample[], pattern: RegExp, fallback: string): Sample | undefined {
  const unsafePositive = /(쿠션|케이스|패드|스탠드|커버|보호필름|단품|삽니다|매입|구매합니다|고장|파손|가품|레플|짝퉁)/i;
  return samples.find((sample) => {
    const title = sample.name ?? sample.title ?? "";
    const text = `${title}\n${sample.description ?? ""}`;
    return pattern.test(text) && !unsafePositive.test(title);
  }) ?? findSample(samples, pattern, fallback);
}

function makeCase(input: Omit<ImplementationCase, "phase" | "category" | "scope" | "laterRuntimeFiles">): ImplementationCase {
  return {
    phase: "Phase 2 - Headphone / Matched SKU Subset",
    category: "headphone_discovered",
    scope: "Known matched headphone SKUs only; AirPods Max connector/generation gates stay report-only",
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
  const samples = await readJson<Sample[]>(path.join(categoryDir, "headphone_discovered/samples.json"));
  const evidence = await readJson<EvidenceMatrix>(path.join(reportsDir, "headphone-matched-sku-evidence-matrix-latest.json"));
  const airpodsMaxReview = await readJson<AirpodsMaxReview>(path.join(reportsDir, "headphone-airpods-max-review-evidence-latest.json"));
  const blockers = await readJson<Blockers>(path.join(reportsDir, "headphone-matched-sku-blockers-latest.json"));

  const airpodsMaxUsbc = findPositiveSample(samples, /에어팟\s*맥스.*(usb-c|usbc|c타입|ctype|c type|씨타입)/i, "애플 에어팟 맥스 새제품 풀패키지 USB-C 단자");
  const airpodsMaxLightning = findPositiveSample(samples, /에어팟\s*맥스.*(8핀|라이트닝|lightning)/i, "에어팟 맥스 8핀 색상 스페이스 그레이 A급 헤드폰, 헤드셋");
  const sonyXm5 = findPositiveSample(samples, /(sony|소니).*(wh-?1000xm5|xm5)|(wh-?1000xm5|xm5).*(sony|소니)/i, "소니 wh1000xm5 플래티넘실버");
  const boseQcUltra = findPositiveSample(samples, /(bose|보스).*(qc\s*울트라|quietcomfort\s*ultra)|(qc\s*울트라|quietcomfort\s*ultra).*(bose|보스)/i, "보스 QC 울트라 헤드폰 화이트 1세대");
  const sonyCh520 = findPositiveSample(samples, /(sony|소니).*wh-?ch520|wh-?ch520.*(sony|소니)/i, "소니 WH-CH520 블루투스 무선 헤드폰");
  const colorOnlyAirpodsMax = airpodsMaxReview.evidenceRows.find((row) => row.reviewClass === "legacy_color_only_generation_hold");
  const unknownConnectorAirpodsMax = airpodsMaxReview.evidenceRows.find((row) => row.reviewClass === "unknown_connector_no_title_token");
  const explicitUsbcReview = airpodsMaxReview.evidenceRows.find((row) => row.reviewClass === "explicit_usbc_but_generation_review");
  const explicitLightningReview = airpodsMaxReview.evidenceRows.find((row) => row.reviewClass === "explicit_lightning_but_generation_review");
  const boseCushion = findSample(samples, /보스.*qc\s*울트라.*(쿠션|패드)|(쿠션|패드).*보스.*qc\s*울트라/i, "BOSE 보스 QC 울트라 헤드폰 이어 쿠션 블랙");
  const maxCase = findSample(samples, /에어팟\s*맥스.*케이스|airpods\s*max.*case/i, "에어팟 맥스1 소닉스x산리오 쿠로미 케이스 Airpods Max case");
  const damaged = findSample(samples, /(고장|파손).*에어팟\s*맥스|에어팟\s*맥스.*(고장|파손)/i, "(고장) 애플 에어팟 맥스1 그린 Apple Airpods Max 1");
  const genericWireless = findSample(samples, /베이지 헤드셋 헤드폰 판매합니다|무선 헤드셋|무선 헤드폰/i, "베이지 헤드셋 헤드폰 판매합니다");
  const unknownBranded = blockers.unknownSkuExamples.find((row) => /비츠|b&o|레이저|Dali|로지텍|커세어/i.test(row.title));

  const cases: ImplementationCase[] = [
    makeCase({
      caseId: "HEADPHONE-POS-01",
      inputTitle: titleOf(airpodsMaxUsbc, "애플 에어팟 맥스 USB-C"),
      inputDescription: descOf(airpodsMaxUsbc),
      expectedClass: "positive",
      blockerType: "airpods_max_usbc_full_product",
      productIdentityTokens: ["airpods", "airpods_max"],
      variantTokens: ["usb-c"],
      conditionTokens: ["full_product"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "headphone-matched-sku-evidence-matrix-latest.json:airpods|airpods_max|usbc",
      externalEvidence: externalSources,
      confidence: "medium",
      notes: "Positive fixture only after accessory/damage/buying gates pass; keep USB-C separate from Lightning.",
    }),
    makeCase({
      caseId: "HEADPHONE-POS-02",
      inputTitle: titleOf(airpodsMaxLightning, "에어팟 맥스 8핀"),
      inputDescription: descOf(airpodsMaxLightning),
      expectedClass: "positive",
      blockerType: "airpods_max_lightning_full_product",
      productIdentityTokens: ["airpods", "airpods_max"],
      variantTokens: ["lightning", "8핀"],
      conditionTokens: ["full_product"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "headphone-matched-sku-evidence-matrix-latest.json:airpods|airpods_max|lightning",
      externalEvidence: externalSources,
      confidence: "medium",
      notes: "Lightning/8-pin rows must not merge with USB-C rows even when color tokens overlap.",
    }),
    makeCase({
      caseId: "HEADPHONE-POS-03",
      inputTitle: titleOf(sonyXm5, "소니 WH-1000XM5"),
      inputDescription: descOf(sonyXm5),
      expectedClass: "positive",
      blockerType: "sony_wh_1000xm5_explicit_model",
      productIdentityTokens: ["sony", "wh_1000xm5"],
      variantTokens: [],
      conditionTokens: ["full_product"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "headphone-matched-sku-evidence-matrix-latest.json:earphone|sony_wh_1000xm5",
      externalEvidence: [],
      confidence: "medium",
      notes: "Model-code token is required; plain Sony headphone wording is not enough.",
    }),
    makeCase({
      caseId: "HEADPHONE-POS-04",
      inputTitle: titleOf(boseQcUltra, "보스 QC 울트라 헤드폰"),
      inputDescription: descOf(boseQcUltra),
      expectedClass: "positive",
      blockerType: "bose_quietcomfort_ultra_explicit_model",
      productIdentityTokens: ["bose", "quietcomfort_ultra_headphones"],
      variantTokens: [],
      conditionTokens: ["full_product"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "headphone-matched-sku-evidence-matrix-latest.json:earphone|bose_quietcomfort_ultra_headphones",
      externalEvidence: [],
      confidence: "medium",
      notes: "QC Ultra model wording is usable only after accessory-only rows are excluded.",
    }),
    makeCase({
      caseId: "HEADPHONE-POS-05",
      inputTitle: titleOf(sonyCh520, "소니 WH-CH520 블루투스 무선 헤드폰"),
      inputDescription: descOf(sonyCh520),
      expectedClass: "positive",
      blockerType: "sony_wh_ch520_explicit_model",
      productIdentityTokens: ["sony", "wh_ch520"],
      variantTokens: [],
      conditionTokens: ["full_product"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "headphone-matched-sku-evidence-matrix-latest.json:earphone|sony_wh_ch520",
      externalEvidence: [],
      confidence: "medium",
      notes: "Explicit WH-CH520 rows can become fixtures; generic wireless headphone rows cannot.",
    }),
    makeCase({
      caseId: "HEADPHONE-MANUAL-01",
      inputTitle: colorOnlyAirpodsMax?.title ?? "에어팟 맥스 스페이스 그레이",
      inputDescription: "",
      expectedClass: "manual_review",
      blockerType: "airpods_max_color_only_generation_hold",
      productIdentityTokens: ["airpods", "airpods_max"],
      variantTokens: ["color_only"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `headphone-airpods-max-review-evidence-latest.json:${colorOnlyAirpodsMax?.pid ?? "color_only"}`,
      externalEvidence: externalSources,
      confidence: "high",
      notes: "Color alone cannot infer connector or generation; keep out of positive automation.",
    }),
    makeCase({
      caseId: "HEADPHONE-MANUAL-02",
      inputTitle: unknownConnectorAirpodsMax?.title ?? "AirPods Max",
      inputDescription: "",
      expectedClass: "manual_review",
      blockerType: "airpods_max_unknown_connector_hold",
      productIdentityTokens: ["airpods", "airpods_max"],
      variantTokens: ["unknown_connector"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `headphone-airpods-max-review-evidence-latest.json:${unknownConnectorAirpodsMax?.pid ?? "unknown_connector"}`,
      externalEvidence: externalSources,
      confidence: "high",
      notes: "AirPods Max without connector token remains review-only even if full product wording exists.",
    }),
    makeCase({
      caseId: "HEADPHONE-MANUAL-03",
      inputTitle: explicitUsbcReview?.title ?? "에어팟 맥스 C타입 미개봉 새상품",
      inputDescription: "",
      expectedClass: "manual_review",
      blockerType: "airpods_max_explicit_usbc_generation_review",
      productIdentityTokens: ["airpods", "airpods_max"],
      variantTokens: ["usb-c"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `headphone-airpods-max-review-evidence-latest.json:${explicitUsbcReview?.pid ?? "explicit_usbc"}`,
      externalEvidence: externalSources,
      confidence: "medium",
      notes: "USB-C key may be kept separate in report, but this does not approve broader generation policy.",
    }),
    makeCase({
      caseId: "HEADPHONE-MANUAL-04",
      inputTitle: explicitLightningReview?.title ?? "에어팟 맥스 스페이스 그레이 8핀 판매",
      inputDescription: "",
      expectedClass: "manual_review",
      blockerType: "airpods_max_explicit_lightning_generation_review",
      productIdentityTokens: ["airpods", "airpods_max"],
      variantTokens: ["lightning", "8핀"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `headphone-airpods-max-review-evidence-latest.json:${explicitLightningReview?.pid ?? "explicit_lightning"}`,
      externalEvidence: externalSources,
      confidence: "medium",
      notes: "Lightning key may be kept separate in report, but do not infer legacy generation from color/purchase year.",
    }),
    makeCase({
      caseId: "HEADPHONE-HOLD-01",
      inputTitle: titleOf(boseCushion, "BOSE 보스 QC 울트라 헤드폰 이어 쿠션 블랙"),
      inputDescription: descOf(boseCushion),
      expectedClass: "hold",
      blockerType: "accessory_only_cushion_pad_hold",
      productIdentityTokens: ["bose", "quietcomfort_ultra_headphones"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: ["cushion", "pad"],
      evidenceSource: "category-intelligence/headphone_discovered/samples.json",
      externalEvidence: [],
      confidence: "high",
      notes: "Accessory-only signal dominates matched SKU tokens.",
    }),
    makeCase({
      caseId: "HEADPHONE-HOLD-02",
      inputTitle: titleOf(maxCase, "에어팟 맥스 케이스 Airpods Max case"),
      inputDescription: descOf(maxCase),
      expectedClass: "hold",
      blockerType: "accessory_only_case_hold",
      productIdentityTokens: ["airpods", "airpods_max"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: ["case"],
      evidenceSource: "category-intelligence/headphone_discovered/samples.json",
      externalEvidence: [],
      confidence: "high",
      notes: "Case/accessory rows must not become AirPods Max candidates.",
    }),
    makeCase({
      caseId: "HEADPHONE-HOLD-03",
      inputTitle: titleOf(damaged, "(고장) 애플 에어팟 맥스1 그린 Apple Airpods Max 1"),
      inputDescription: descOf(damaged),
      expectedClass: "hold",
      blockerType: "damaged_or_parts_repair_hold",
      productIdentityTokens: ["airpods", "airpods_max"],
      variantTokens: [],
      conditionTokens: ["damaged", "repair"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "headphone-matched-sku-blockers-latest.json:mustHold",
      externalEvidence: [],
      confidence: "high",
      notes: "Damage/repair signal must block candidate readiness even when model identity is clear.",
    }),
    makeCase({
      caseId: "HEADPHONE-HOLD-04",
      inputTitle: titleOf(genericWireless, "베이지 헤드셋 헤드폰 판매합니다"),
      inputDescription: descOf(genericWireless),
      expectedClass: "hold",
      blockerType: "generic_headphone_without_model_hold",
      productIdentityTokens: ["generic_headphone"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "headphone-matched-sku-blockers-latest.json:unknownSkuExamples",
      externalEvidence: [],
      confidence: "high",
      notes: "Brand/model family is required; broad headset/headphone wording is not enough.",
    }),
    makeCase({
      caseId: "HEADPHONE-HOLD-05",
      inputTitle: unknownBranded?.title ?? "정품 비츠 닥터드레 EP 온이어 헤드셋 이어폰 헤드폰 beats",
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "unknown_sku_branded_hold",
      productIdentityTokens: ["unknown_brand_sku"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `headphone-matched-sku-blockers-latest.json:${unknownBranded?.pid ?? "unknown_sku"}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Branded but unmapped SKUs need a later model catalog expansion, not automatic positive readiness.",
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
    scope: "Headphone matched-SKU implementation-prep only",
    nonScope: [
      "whole headphone_discovered public readiness",
      "new headphone runtime catalog entries",
      "candidate pool policy wiring",
      "runtime parser/catalog/pipeline edits",
      "approval of unknown branded SKUs",
    ],
    sourceReportsRead: [
      "headphone-matched-sku-evidence-matrix-latest.json",
      "headphone-airpods-max-review-evidence-latest.json",
      "headphone-matched-sku-blockers-latest.json",
      "category-intelligence/headphone_discovered/samples.json",
    ],
    metrics: {
      total: evidence.metrics.total,
      normal: evidence.metrics.normal,
      normalRate: evidence.metrics.normalRate,
      normalWithSku: evidence.metrics.normalWithSku,
      parserReadyRate: evidence.metrics.parserReadyRate,
      needsReviewRate: evidence.metrics.needsReviewRate,
      airpodsMax: evidence.metrics.airpodsMax,
      airpodsMaxReadyRate: evidence.metrics.airpodsMaxReadyRate,
      airpodsMaxUnknownGenerationRate: evidence.metrics.airpodsMaxUnknownGenerationRate,
      airpodsMaxUnknownConnectorRate: evidence.metrics.airpodsMaxUnknownConnectorRate,
      reviewExampleRows: evidence.metrics.reviewExampleRows,
      unknownSkuExampleRows: evidence.metrics.unknownSkuExampleRows,
      runtimeApprovedRows: evidence.metrics.runtimeApprovedRows,
      airpodsMaxReviewRows: airpodsMaxReview.metrics.reviewRows,
      testCaseCount: cases.length,
      positiveCount: positiveTestCases.length,
      holdCount: negativeHoldTestCases.length,
      manualReviewCount: manualReviewTestCases.length,
    },
    topComparableKeys: evidence.metrics.topComparableKeys,
    positiveTestCases,
    negativeHoldTestCases,
    manualReviewTestCases,
    splitOnlyOrArchitectureCases: [],
    blockerToTestMapping: [
      { blocker: "AirPods Max USB-C / Lightning split", caseIds: ["HEADPHONE-POS-01", "HEADPHONE-POS-02"] },
      { blocker: "AirPods Max connector or generation missing", caseIds: ["HEADPHONE-MANUAL-01", "HEADPHONE-MANUAL-02", "HEADPHONE-MANUAL-03", "HEADPHONE-MANUAL-04"] },
      { blocker: "Known Sony/Bose explicit model positives", caseIds: ["HEADPHONE-POS-03", "HEADPHONE-POS-04", "HEADPHONE-POS-05"] },
      { blocker: "Accessory-only cushion/case hold", caseIds: ["HEADPHONE-HOLD-01", "HEADPHONE-HOLD-02"] },
      { blocker: "Damaged/repair hold", caseIds: ["HEADPHONE-HOLD-03"] },
      { blocker: "Generic or unknown SKU hold", caseIds: ["HEADPHONE-HOLD-04", "HEADPHONE-HOLD-05"] },
    ],
    externalTaxonomyNotes: [
      "Apple Identify your AirPods is sufficient to confirm AirPods Max exists as a distinct family, but this report does not use it to infer runtime generation policy.",
      "Sony/Bose fixtures are based on local matched-SKU evidence and explicit model-code tokens; official model taxonomy should be added before runtime catalog work.",
      "Purchase year and color words are not connector/generation proof.",
    ],
    externalSources,
    proposedRuntimeFilesForLater: [
      "src/lib/option-parser.ts",
      "src/lib/pipeline.ts",
      "src/lib/category-readiness.ts",
      "src/lib/candidate-pool-builder.ts",
    ],
    dryRunStrategyForMainAgent: [
      "Replay fixture cases through parser/gate in a no-mutation test harness.",
      "Assert AirPods Max USB-C and Lightning keys never merge.",
      "Assert color-only/purchase-year-only AirPods Max rows remain manual-review.",
      "Assert cushion/case/damaged/generic/unknown branded rows stay out of candidate pool.",
      "Review official Sony/Bose model taxonomy before any runtime catalog apply.",
    ],
    stopCondition: "Stop before editing runtime parser/catalog/pipeline/candidate pool files.",
    nextQueueItem: "Phase 3 - Game Console / Body-Narrow Subset",
    deferred: [
      "Unknown branded headphone SKUs such as Beats/B&O/Razer/Dali/Logitech/Corsair need separate catalog expansion, not automatic approval.",
      "Official Sony/Bose product taxonomy should be collected before runtime implementation review.",
      "AirPods Max color/purchase-year heuristics remain manual-review because connector/generation inference is too risky.",
      "Whole headphone_discovered public readiness remains blocked until more than matched-SKU rows are covered.",
    ],
    inheritedDoNotDo: blockers.doNotDo,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-matched-sku-implementation-prep-latest.json"), JSON.stringify(report, null, 2));

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
    "# Headphone Matched-SKU Implementation-Prep",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Implementation-prep for known matched headphone SKU rows. This is not runtime wiring, candidate pool wiring, or public promotion.",
    "",
    "## Metrics",
    "",
    `- total samples: ${report.metrics.total}`,
    `- normal rows: ${report.metrics.normal} (${report.metrics.normalRate}%)`,
    `- normal with SKU: ${report.metrics.normalWithSku}`,
    `- matched-SKU parser-ready rate: ${report.metrics.parserReadyRate}%`,
    `- needs-review rate: ${report.metrics.needsReviewRate}%`,
    `- AirPods Max rows: ${report.metrics.airpodsMax}`,
    `- AirPods Max unknown generation/connector: ${report.metrics.airpodsMaxUnknownGenerationRate}%/${report.metrics.airpodsMaxUnknownConnectorRate}%`,
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
    "## Top Comparable Keys",
    "",
    ...report.topComparableKeys.map((row) => `- ${row.key}: ${row.count}`),
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

  await writeFile(path.join(reportsDir, "headphone-matched-sku-implementation-prep-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-matched-sku-implementation-prep-latest.json");
  console.log("wrote reports/headphone-matched-sku-implementation-prep-latest.md");
  console.log(`headphone matched-SKU implementation prep: cases=${cases.length}, positive=${positiveTestCases.length}, hold=${negativeHoldTestCases.length}, manual=${manualReviewTestCases.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
