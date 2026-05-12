import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  name?: string;
  title?: string;
  description?: string;
};

type BodyNarrowReport = {
  total: number;
  consoleCandidates: number;
  consoleCandidateRate: number;
  knownModelCandidates: number;
  knownModelCandidateRate: number;
  gateCounts: Array<{ key: string; count: number }>;
  topModels: Array<{ key: string; count: number }>;
  examples: Record<string, Array<{
    pid: string;
    title: string;
    gate: string;
    model: string;
    comparableKey: string | null;
    needsReview: boolean;
    reasons: string[];
  }>>;
};

type BodyBlockers = {
  currentMetrics: {
    total: number;
    bodyNarrowConsoleCandidateRate: number;
    bodyNarrowKnownModelCandidateRate: number;
    strictTotal: number;
    strictNormal: number;
    strictNormalRate: number;
    strictParserReady: number;
    strictParserReadyRate: number;
    strictNormalParserReadyRate: number;
    strictNeedsReviewRate: number;
    bodyGateCounts: Array<{ key: string; count: number }>;
    topComparableKeys: Array<{ key: string; count: number }>;
  };
  mustHold: string[];
  requiredBeforeAnyMainReview: string[];
  doNotDo: string[];
};

type BoundaryReport = {
  metrics: {
    keyRows: number;
    positiveKeyRows: number;
    reviewGatedKeyRows: number;
    positiveUnits: number;
    reviewGatedUnits: number;
    switch2KeyRows: number;
    switch2Units: number;
    ps5KeyRows: number;
    ps5Units: number;
    unknownEditionKeyRows: number;
    unknownEditionUnits: number;
    unknownBodyKeyRows: number;
    unknownBodyUnits: number;
    runtimeApprovedRows: number;
  };
  boundaryRows: Array<{
    key: string;
    count: number;
    coverageClass: string;
    family: string;
    edition: string;
    bodyScope: string;
    boundaryClass: string;
    reviewAction: string;
    runtimeApproved: boolean;
  }>;
};

type EvidenceMatrix = {
  metrics: {
    coverageRows: number;
    positiveCoverageRows: number;
    reviewGatedCoverageRows: number;
    exclusionRows: number;
    runtimeApprovedRows: number;
  };
  exclusionRows: Array<{
    pid: string;
    title: string;
    listingType: string;
    comparableKey: string | null;
    needsReview: boolean;
    reasons: string[];
    reviewClass: string;
    exclusionStatus: string;
  }>;
};

type ContaminationReport = {
  metrics: {
    total: number;
    broadConsoleCandidateRows: number;
    broadConsoleCandidateRate: number;
    contaminationRows: number;
    contaminationRate: number;
    bodyNarrowConsoleCandidateRate: number;
    bodyNarrowKnownModelCandidateRate: number;
    strictParserReadyRate: number;
    strictNormalParserReadyRate: number;
    runtimeApprovedRows: number;
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

const externalSources = [
  {
    label: "Nintendo Support - Nintendo Switch OLED Model overview",
    url: "https://en-americas-support.nintendo.com/app/answers/detail/a_id/55834/",
    retrievedAt,
  },
  {
    label: "Nintendo Official Site - Nintendo Switch 2",
    url: "https://www.nintendo.com/us/gaming-systems/switch-2/",
    retrievedAt,
  },
  {
    label: "PlayStation - PS5 consoles",
    url: "https://www.playstation.com/en-us/ps5/",
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
  const unsafePositive = /(삽니다|매입|구매합니다|케이스|하우징|부품용|고장|파손|수리|타이틀|게임칩|칩\s|알칩|일괄)/i;
  return samples.find((sample) => {
    const title = sample.name ?? sample.title ?? "";
    const text = `${title}\n${sample.description ?? ""}`;
    return pattern.test(text) && !unsafePositive.test(title);
  }) ?? findSample(samples, pattern, fallback);
}

function sampleFromExample(report: BodyNarrowReport, gate: string, index = 0): Sample | undefined {
  const row = report.examples[gate]?.[index];
  if (!row) return undefined;
  return { pid: row.pid, name: row.title };
}

function makeCase(input: Omit<ImplementationCase, "phase" | "category" | "scope" | "laterRuntimeFiles">): ImplementationCase {
  return {
    phase: "Phase 3 - Game Console / Body-Narrow Subset",
    category: "game_console_body_narrow",
    scope: "Game console body-narrow implementation-prep only; broad game_console_discovered remains contamination evidence",
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
  const samples = await readJson<Sample[]>(path.join(categoryDir, "game_console_body_narrow/samples.json"));
  const body = await readJson<BodyNarrowReport>(path.join(reportsDir, "game-console-body-narrow-latest.json"));
  const blockers = await readJson<BodyBlockers>(path.join(reportsDir, "game-console-body-blockers-latest.json"));
  const boundary = await readJson<BoundaryReport>(path.join(reportsDir, "game-console-body-edition-boundary-evidence-latest.json"));
  const matrix = await readJson<EvidenceMatrix>(path.join(reportsDir, "game-console-evidence-matrix-latest.json"));
  const contamination = await readJson<ContaminationReport>(path.join(reportsDir, "game-console-contamination-evidence-matrix-latest.json"));

  const switchOledFull = findPositiveSample(samples, /닌텐도\s*스위치.*oled.*(풀박스|풀박|세트)/i, "닌텐도 스위치 OLED 화이트 본체 풀박스");
  const switchOledBody = findPositiveSample(samples, /닌텐도\s*스위치.*oled.*본체(만|단품|화면만)/i, "닌텐도 스위치 oled 본체만 판매");
  const switchLiteBody = findPositiveSample(samples, /닌텐도\s*스위치\s*라이트.*본체|switch\s*lite.*body/i, "닌텐도 스위치 라이트 본체");
  const switchV2Full = findPositiveSample(samples, /닌텐도\s*스위치(?!.*oled).*(v2|배터리\s*개선|개선판).*(본체|풀박스|풀박)/i, "닌텐도 스위치 배터리 개선판 본체 퍼플/오렌지 풀박스 s급");
  const ps5Disc = findPositiveSample(samples, /(ps5|플스5|플레이스테이션5).*(디스크|disc).*본체/i, "플레이스테이션5 PS5 본체 디스크버전");
  const ps5Digital = findPositiveSample(samples, /(ps5|플스5|플레이스테이션5).*(디지털|digital).*본체/i, "소니 플스5 디지털 에디션 본체 + 듀얼센스");
  const unknownEdition = findSample(samples, /닌텐도\s*스위치\s*본체.*풀\s*박|닌텐도\s*스위치\s*본체.*풀박스/i, "닌텐도 스위치 본체 풀박스");
  const unknownBody = sampleFromExample(body, "unknown");
  const switch2 = findSample(samples, /닌텐도\s*스위치\s*2.*본체.*풀박스/i, "닌텐도 스위치2 본체 풀박스");
  const buying = sampleFromExample(body, "buying");
  const accessory = sampleFromExample(body, "accessory");
  const bundle = sampleFromExample(body, "multi_bundle");
  const damaged = sampleFromExample(body, "damaged_or_modded", 1) ?? sampleFromExample(body, "damaged_or_modded");
  const broadTitle = findSample(samples, /닌텐도\s*스위치\s*OLED\s*본체\s*및\s*타이틀/i, "닌텐도 스위치 OLED 본체 및 타이틀 등");

  const cases: ImplementationCase[] = [
    makeCase({
      caseId: "GAME-CONSOLE-POS-01",
      inputTitle: titleOf(switchOledFull, "닌텐도 스위치 OLED 화이트 본체 풀박스"),
      inputDescription: descOf(switchOledFull),
      expectedClass: "positive",
      blockerType: "nintendo_switch_oled_full_set_known_body",
      productIdentityTokens: ["nintendo_switch"],
      variantTokens: ["oled", "full_set"],
      conditionTokens: ["normal"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: ["full_set"],
      accessoryOrPartTokens: [],
      evidenceSource: "game-console-body-narrow-latest.json:game_console|nintendo_switch|oled|full_set",
      externalEvidence: externalSources.filter((source) => source.label.includes("OLED")),
      confidence: "medium",
      notes: "Positive fixture is report-only; full-set is separate from body-only and accessory-only.",
    }),
    makeCase({
      caseId: "GAME-CONSOLE-POS-02",
      inputTitle: titleOf(switchOledBody, "닌텐도 스위치 oled 본체만 판매"),
      inputDescription: descOf(switchOledBody),
      expectedClass: "positive",
      blockerType: "nintendo_switch_oled_body_only_known_body",
      productIdentityTokens: ["nintendo_switch"],
      variantTokens: ["oled", "body_only"],
      conditionTokens: ["normal"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "game-console-body-narrow-latest.json:game_console|nintendo_switch|oled|body_only",
      externalEvidence: externalSources.filter((source) => source.label.includes("OLED")),
      confidence: "medium",
      notes: "Body-only fixture must not merge with full-set pricing.",
    }),
    makeCase({
      caseId: "GAME-CONSOLE-POS-03",
      inputTitle: titleOf(switchLiteBody, "닌텐도 스위치 라이트 본체"),
      inputDescription: descOf(switchLiteBody),
      expectedClass: "positive",
      blockerType: "nintendo_switch_lite_known_body",
      productIdentityTokens: ["nintendo_switch"],
      variantTokens: ["lite"],
      conditionTokens: ["normal"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "game-console-body-edition-boundary-evidence-latest.json:lite",
      externalEvidence: [],
      confidence: "medium",
      notes: "Lite is a known positive coverage key in report-only evidence, pending runtime review.",
    }),
    makeCase({
      caseId: "GAME-CONSOLE-POS-04",
      inputTitle: titleOf(switchV2Full, "닌텐도 스위치 v2 풀박스"),
      inputDescription: descOf(switchV2Full),
      expectedClass: "positive",
      blockerType: "nintendo_switch_v2_full_set_known_body",
      productIdentityTokens: ["nintendo_switch"],
      variantTokens: ["v2", "full_set"],
      conditionTokens: ["normal"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: ["full_set"],
      accessoryOrPartTokens: [],
      evidenceSource: "game-console-body-edition-boundary-evidence-latest.json:v2",
      externalEvidence: [],
      confidence: "low",
      notes: "Only one V2 coverage row exists; keep as low-confidence fixture until more samples are mined.",
    }),
    makeCase({
      caseId: "GAME-CONSOLE-MANUAL-01",
      inputTitle: titleOf(ps5Disc, "플레이스테이션5 PS5 본체 디스크버전"),
      inputDescription: descOf(ps5Disc),
      expectedClass: "manual_review",
      blockerType: "ps5_disc_edition_review_gate",
      productIdentityTokens: ["playstation_5"],
      variantTokens: ["disc"],
      conditionTokens: ["normal"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "game-console-body-edition-boundary-evidence-latest.json:playstation_5_disc",
      externalEvidence: externalSources.filter((source) => source.label.includes("PlayStation")),
      confidence: "medium",
      notes: "PS5 Disc is visible, but current evidence says PS5 edition/body remains review-gated.",
    }),
    makeCase({
      caseId: "GAME-CONSOLE-MANUAL-02",
      inputTitle: titleOf(ps5Digital, "소니 플스5 디지털 에디션 본체 + 듀얼센스"),
      inputDescription: descOf(ps5Digital),
      expectedClass: "manual_review",
      blockerType: "ps5_digital_edition_review_gate",
      productIdentityTokens: ["playstation_5"],
      variantTokens: ["digital"],
      conditionTokens: ["normal"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "game-console-body-edition-boundary-evidence-latest.json:playstation_5_digital",
      externalEvidence: externalSources.filter((source) => source.label.includes("PlayStation")),
      confidence: "medium",
      notes: "Digital/Disc split needs explicit runtime review before catalog wiring.",
    }),
    makeCase({
      caseId: "GAME-CONSOLE-MANUAL-03",
      inputTitle: titleOf(unknownEdition, "닌텐도 스위치 unknown edition full set"),
      inputDescription: "",
      expectedClass: "manual_review",
      blockerType: "unknown_or_mixed_edition_hold",
      productIdentityTokens: ["nintendo_switch"],
      variantTokens: ["unknown_edition"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: ["full_set"],
      accessoryOrPartTokens: [],
      evidenceSource: `category-intelligence/game_console_body_narrow/samples.json:${unknownEdition?.pid ?? "unknown_edition"}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Unknown or mixed edition rows cannot be normalized into OLED/Lite/V2.",
    }),
    makeCase({
      caseId: "GAME-CONSOLE-MANUAL-04",
      inputTitle: titleOf(unknownBody, "닌텐도 스위치 oled 풀 박스"),
      inputDescription: descOf(unknownBody),
      expectedClass: "manual_review",
      blockerType: "unknown_body_scope_hold",
      productIdentityTokens: ["nintendo_switch"],
      variantTokens: ["oled"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "game-console-body-narrow-latest.json:examples.unknown",
      externalEvidence: [],
      confidence: "high",
      notes: "When body/full-set scope is not explicit enough, keep review-gated.",
    }),
    makeCase({
      caseId: "GAME-CONSOLE-MANUAL-05",
      inputTitle: titleOf(switch2, "닌텐도 스위치2 마리오카트 월드 에디션 미개봉"),
      inputDescription: descOf(switch2),
      expectedClass: "manual_review",
      blockerType: "switch_2_future_or_separate_policy_gate",
      productIdentityTokens: ["nintendo_switch_2"],
      variantTokens: ["switch_2"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "game-console-body-edition-boundary-evidence-latest.json:switch_2",
      externalEvidence: externalSources.filter((source) => source.label.includes("Switch 2")),
      confidence: "medium",
      notes: "Switch 2 is an official current console, but current queue keeps it as separate policy review instead of automatic runtime wiring.",
    }),
    makeCase({
      caseId: "GAME-CONSOLE-HOLD-01",
      inputTitle: titleOf(buying, "[매입] 닌텐도 삽니다 스위치, ds, 3ds, wii"),
      inputDescription: descOf(buying),
      expectedClass: "hold",
      blockerType: "buying_post_exclusion",
      productIdentityTokens: ["nintendo_switch"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["buying", "wanted"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: "game-console-body-narrow-latest.json:examples.buying",
      externalEvidence: [],
      confidence: "high",
      notes: "Buying/wanted posts are not sell-side console listings.",
    }),
    makeCase({
      caseId: "GAME-CONSOLE-HOLD-02",
      inputTitle: titleOf(accessory, "(본체 케이스) 닌텐도 스위치 스칼렛 바이올렛 *OLED 전용"),
      inputDescription: descOf(accessory),
      expectedClass: "hold",
      blockerType: "accessory_or_housing_only_exclusion",
      productIdentityTokens: ["nintendo_switch"],
      variantTokens: ["oled"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: ["case", "housing"],
      evidenceSource: "game-console-body-narrow-latest.json:examples.accessory",
      externalEvidence: [],
      confidence: "high",
      notes: "Accessory/housing rows must not become console body candidates even with model tokens.",
    }),
    makeCase({
      caseId: "GAME-CONSOLE-HOLD-03",
      inputTitle: titleOf(bundle, "닌텐도 스위치 OLED 본체 및 타이틀 등"),
      inputDescription: descOf(bundle),
      expectedClass: "hold",
      blockerType: "multi_bundle_or_game_title_exclusion",
      productIdentityTokens: ["nintendo_switch"],
      variantTokens: ["oled"],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: ["bundle", "game_title"],
      accessoryOrPartTokens: [],
      evidenceSource: "game-console-body-narrow-latest.json:examples.multi_bundle",
      externalEvidence: [],
      confidence: "high",
      notes: "Bundles with titles/peripherals need separate package policy and should not set body-only/full-set price keys automatically.",
    }),
    makeCase({
      caseId: "GAME-CONSOLE-HOLD-04",
      inputTitle: titleOf(damaged, "닌텐도 스위치 oled 본체 부품용"),
      inputDescription: descOf(damaged),
      expectedClass: "hold",
      blockerType: "damaged_or_parts_exclusion",
      productIdentityTokens: ["nintendo_switch"],
      variantTokens: ["oled"],
      conditionTokens: ["damaged", "parts"],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: ["parts"],
      evidenceSource: "game-console-body-narrow-latest.json:examples.damaged_or_modded",
      externalEvidence: [],
      confidence: "high",
      notes: "Damaged/parts listings must not enter comparable ready rows.",
    }),
    makeCase({
      caseId: "GAME-CONSOLE-HOLD-05",
      inputTitle: titleOf(broadTitle, "닌텐도 스위치 OLED 본체 및 타이틀 등"),
      inputDescription: descOf(broadTitle),
      expectedClass: "hold",
      blockerType: "broad_game_console_contamination_hold",
      productIdentityTokens: ["game_console"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: ["game_title"],
      accessoryOrPartTokens: [],
      evidenceSource: "game-console-contamination-evidence-matrix-latest.json",
      externalEvidence: [],
      confidence: "high",
      notes: "Broad game_console_discovered remains a contamination map; do not use it as a ready source.",
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
    scope: "Game console body-narrow implementation-prep only",
    nonScope: [
      "whole game_console_discovered public readiness",
      "Switch 2 runtime policy",
      "PS5 edition runtime policy",
      "candidate pool policy wiring",
      "runtime parser/catalog/pipeline edits",
    ],
    sourceReportsRead: [
      "game-console-body-narrow-latest.json",
      "game-console-body-blockers-latest.json",
      "game-console-body-edition-boundary-evidence-latest.json",
      "game-console-evidence-matrix-latest.json",
      "game-console-contamination-evidence-matrix-latest.json",
      "category-intelligence/game_console_body_narrow/samples.json",
    ],
    metrics: {
      total: body.total,
      consoleCandidates: body.consoleCandidates,
      consoleCandidateRate: body.consoleCandidateRate,
      knownModelCandidates: body.knownModelCandidates,
      knownModelCandidateRate: body.knownModelCandidateRate,
      strictParserReady: blockers.currentMetrics.strictParserReady,
      strictParserReadyRate: blockers.currentMetrics.strictParserReadyRate,
      strictNormalParserReadyRate: blockers.currentMetrics.strictNormalParserReadyRate,
      strictNeedsReviewRate: blockers.currentMetrics.strictNeedsReviewRate,
      broadContaminationRate: contamination.metrics.contaminationRate,
      boundaryKeyRows: boundary.metrics.keyRows,
      positiveKeyRows: boundary.metrics.positiveKeyRows,
      reviewGatedKeyRows: boundary.metrics.reviewGatedKeyRows,
      runtimeApprovedRows: boundary.metrics.runtimeApprovedRows + matrix.metrics.runtimeApprovedRows + contamination.metrics.runtimeApprovedRows,
      testCaseCount: cases.length,
      positiveCount: positiveTestCases.length,
      holdCount: negativeHoldTestCases.length,
      manualReviewCount: manualReviewTestCases.length,
    },
    gateCounts: body.gateCounts,
    topModels: body.topModels,
    topComparableKeys: blockers.currentMetrics.topComparableKeys,
    boundaryRows: boundary.boundaryRows,
    positiveTestCases,
    negativeHoldTestCases,
    manualReviewTestCases,
    splitOnlyOrArchitectureCases: [],
    blockerToTestMapping: [
      { blocker: "Known Switch OLED/Lite/V2 body/full-set positives", caseIds: ["GAME-CONSOLE-POS-01", "GAME-CONSOLE-POS-02", "GAME-CONSOLE-POS-03", "GAME-CONSOLE-POS-04"] },
      { blocker: "PS5 edition review gate", caseIds: ["GAME-CONSOLE-MANUAL-01", "GAME-CONSOLE-MANUAL-02"] },
      { blocker: "Unknown edition/body review gate", caseIds: ["GAME-CONSOLE-MANUAL-03", "GAME-CONSOLE-MANUAL-04"] },
      { blocker: "Switch 2 separate policy review", caseIds: ["GAME-CONSOLE-MANUAL-05"] },
      { blocker: "Buying/accessory/bundle/damaged/broad contamination hold", caseIds: ["GAME-CONSOLE-HOLD-01", "GAME-CONSOLE-HOLD-02", "GAME-CONSOLE-HOLD-03", "GAME-CONSOLE-HOLD-04", "GAME-CONSOLE-HOLD-05"] },
    ],
    externalTaxonomyNotes: [
      "Nintendo Support confirms Nintendo Switch OLED as a distinct Switch model.",
      "Nintendo Official Site confirms Nintendo Switch 2 is a current official console, but local evidence keeps it as a separate policy gate.",
      "PlayStation official page separates PS5 console and PS5 Digital Edition, but local evidence still keeps PS5 edition/body rows manual-review.",
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
      "Assert Switch OLED full-set and body-only keys do not merge.",
      "Assert PS5 Disc/Digital and Switch 2 stay manual-review until explicit runtime review.",
      "Assert buying/accessory/housing/bundle/game-title/damaged rows stay out of candidate pool.",
      "Assert broad game_console_discovered rows are not treated as body-narrow ready source.",
    ],
    stopCondition: "Stop before editing runtime parser/catalog/pipeline/candidate pool files.",
    nextQueueItem: "Phase 4 - Monitor / Model-Code Rows",
    deferred: [
      "Switch 2 needs separate current-product policy review and should not inherit Switch OLED/Lite body rules.",
      "PS5 Disc/Digital/Slim needs deeper official model and local sample coverage before runtime catalog work.",
      "Game-title, bundle, accessory, and buying contamination remains high in broad game_console_discovered, so broad category stays blocked.",
      "V2 has only one positive coverage row; mine more rows before treating it as robust runtime-ready evidence.",
    ],
    inheritedMustHold: blockers.mustHold,
    inheritedDoNotDo: blockers.doNotDo,
    requiredBeforeAnyMainReview: blockers.requiredBeforeAnyMainReview,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "game-console-body-narrow-implementation-prep-latest.json"), JSON.stringify(report, null, 2));

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
    "# Game Console Body-Narrow Implementation-Prep",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Implementation-prep for game console body-narrow rows. This is not runtime wiring, candidate pool wiring, or public promotion.",
    "",
    "## Metrics",
    "",
    `- total samples: ${report.metrics.total}`,
    `- console candidates: ${report.metrics.consoleCandidates} (${report.metrics.consoleCandidateRate}%)`,
    `- known model candidates: ${report.metrics.knownModelCandidates} (${report.metrics.knownModelCandidateRate}%)`,
    `- strict parser-ready: ${report.metrics.strictParserReady} (${report.metrics.strictParserReadyRate}%)`,
    `- strict normal parser-ready rate: ${report.metrics.strictNormalParserReadyRate}%`,
    `- strict needs-review rate: ${report.metrics.strictNeedsReviewRate}%`,
    `- broad contamination rate: ${report.metrics.broadContaminationRate}%`,
    `- boundary positive/review-gated keys: ${report.metrics.positiveKeyRows}/${report.metrics.reviewGatedKeyRows}`,
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
    "## Top Models",
    "",
    ...report.topModels.map((row) => `- ${row.key}: ${row.count}`),
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

  await writeFile(path.join(reportsDir, "game-console-body-narrow-implementation-prep-latest.md"), `${md}\n`);
  console.log("wrote reports/game-console-body-narrow-implementation-prep-latest.json");
  console.log("wrote reports/game-console-body-narrow-implementation-prep-latest.md");
  console.log(`game console body-narrow implementation prep: cases=${cases.length}, positive=${positiveTestCases.length}, hold=${negativeHoldTestCases.length}, manual=${manualReviewTestCases.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
