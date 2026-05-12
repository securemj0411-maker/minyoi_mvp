import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Blockers = {
  currentMetrics: {
    total: number;
    normal: number;
    modelReadyRate: number;
    genericRate: number;
    gateCounts: Array<{ key: string; count: number }>;
    topKeyCounts: Array<{ key: string; count: number }>;
    subtypeRows: Array<{ key: string; count: number }>;
  };
  doNotDo: string[];
};

type ModelSubtypeRow = {
  key: string;
  count: number;
  subtype: string;
  status: string;
  testCandidateStatus: string;
  brand: string;
  modelToken: string;
  subtypeBoundaryClass: string;
  reportOnlyAction: string;
  runtimeApproved: false;
};

type ModelSubtype = {
  metrics: {
    modelReadyRows: number;
    stickOrHandheldRows: number;
    stickOrHandheldUnits: number;
    robotVacuumRows: number;
    robotVacuumUnits: number;
    logisticsRiskCount: number;
    runtimeApprovedRows: number;
  };
  rows: ModelSubtypeRow[];
};

type GenericVacuumRow = {
  pid?: string;
  title?: string;
  price?: number;
  key?: string;
  genericClass: string;
  action: string;
  exclusionCandidateOnly: true;
  runtimeApproved: false;
};

type GenericVacuum = {
  metrics: {
    expandedGenericVacuumRows: number;
    newlyRecoveredRows: number;
    modelReadyVacuumRows: number;
    logisticsRiskCount: number;
    logisticsRiskExamplesAvailable: number;
    exclusionCandidateOnlyRows: number;
    runtimeApprovedRows: number;
    genericClassCounts: Array<{ key: string; count: number }>;
  };
  rows: GenericVacuumRow[];
};

type VacuumReadiness = {
  metrics: {
    modelReadyVacuumRows: number;
    totalRowCount: number;
    logisticsRiskCount: number;
    logisticsRiskExamplesAvailable: number;
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

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function makeCase(input: Omit<ImplementationCase, "phase" | "category" | "scope" | "laterRuntimeFiles">): ImplementationCase {
  return {
    phase: "Phase 9 - Home Appliance/Vacuum Subtype Lightweight Split Prep",
    category: "home_appliance_tech_discovered",
    scope: "Home appliance vacuum subtype split prep only; no home appliance runtime policy",
    laterRuntimeFiles: [
      "src/lib/option-parser.ts",
      "src/lib/pipeline.ts",
      "src/lib/category-readiness.ts",
      "src/lib/candidate-pool-builder.ts",
    ],
    ...input,
  };
}

function modelTitle(row: ModelSubtypeRow): string {
  const subtypeLabel = row.subtype === "robot_vacuum" ? "robot vacuum" : "stick/handheld vacuum";
  return `${row.brand} ${row.modelToken} ${subtypeLabel}`.replace(/-/g, " ");
}

function findGeneric(rows: GenericVacuumRow[], genericClass: string, preferredPattern?: RegExp): GenericVacuumRow | undefined {
  const classRows = rows.filter((row) => row.genericClass === genericClass);
  if (!preferredPattern) return classRows[0];
  return classRows.find((row) => preferredPattern.test(row.title ?? "")) ?? classRows[0];
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const blockers = await readJson<Blockers>(path.join(reportsDir, "home-appliance-blockers-latest.json"));
  const modelSubtype = await readJson<ModelSubtype>(path.join(reportsDir, "home-appliance-vacuum-model-subtype-boundary-evidence-latest.json"));
  const generic = await readJson<GenericVacuum>(path.join(reportsDir, "home-appliance-generic-vacuum-exclusion-readiness-latest.json"));
  const readiness = await readJson<VacuumReadiness>(path.join(reportsDir, "home-appliance-vacuum-test-candidate-readiness-latest.json"));

  const stickModelRows = modelSubtype.rows.filter((row) => row.subtypeBoundaryClass === "stick_or_handheld_model_ready_reference_only").slice(0, 3);
  const robotModelRow = modelSubtype.rows.find((row) => row.subtypeBoundaryClass === "robot_vacuum_model_ready_separate_hold");
  const beddingGeneric = findGeneric(generic.rows, "bedding_cleaner_generic");
  const brandOnlyStickGeneric = findGeneric(generic.rows, "stick_or_handheld_vacuum_generic", /다이슨|코드제로|LG|엘지/i);
  const robotGeneric = findGeneric(generic.rows, "robot_vacuum_generic", /샤오미|로봇청소기/i);
  const accessoryGeneric = findGeneric(generic.rows, "accessory_or_parts_risk");

  const cases: ImplementationCase[] = [
    ...stickModelRows.map((row, index) => makeCase({
      caseId: `APPLIANCE-SPLIT-${String(index + 1).padStart(2, "0")}`,
      inputTitle: modelTitle(row),
      inputDescription: "",
      expectedClass: "split_only",
      blockerType: "stick_or_handheld_model_ready_reference_only",
      productIdentityTokens: ["vacuum", "stick_or_handheld_vacuum", row.brand],
      variantTokens: [row.modelToken],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `home-appliance-vacuum-model-subtype-boundary-evidence-latest.json:${row.key}`,
      externalEvidence: [],
      confidence: row.count >= 2 ? "medium" : "low",
      notes: "Model-ready stick/handheld vacuum row is subtype reference only, not runtime approval.",
    })),
    robotModelRow ? makeCase({
      caseId: "APPLIANCE-MANUAL-01",
      inputTitle: modelTitle(robotModelRow),
      inputDescription: "",
      expectedClass: "manual_review",
      blockerType: "robot_vacuum_model_ready_separate_axis_hold",
      productIdentityTokens: ["vacuum", "robot_vacuum", robotModelRow.brand],
      variantTokens: [robotModelRow.modelToken],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `home-appliance-vacuum-model-subtype-boundary-evidence-latest.json:${robotModelRow.key}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Robot vacuum model-ready rows need a separate parser axis and must not merge into stick/handheld vacuum readiness.",
    }) : undefined,
    beddingGeneric ? makeCase({
      caseId: "APPLIANCE-HOLD-01",
      inputTitle: beddingGeneric.title ?? "bedding cleaner generic",
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "bedding_cleaner_boundary_exclusion",
      productIdentityTokens: ["bedding_cleaner"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `home-appliance-generic-vacuum-exclusion-readiness-latest.json:${beddingGeneric.pid ?? beddingGeneric.key}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Bedding cleaner rows are vacuum-adjacent but should not become stick/handheld vacuum comparable keys.",
    }) : undefined,
    brandOnlyStickGeneric ? makeCase({
      caseId: "APPLIANCE-HOLD-02",
      inputTitle: brandOnlyStickGeneric.title ?? "brand-only stick vacuum",
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "brand_only_stick_vacuum_model_missing_hold",
      productIdentityTokens: ["vacuum", "stick_or_handheld_vacuum"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `home-appliance-generic-vacuum-exclusion-readiness-latest.json:${brandOnlyStickGeneric.pid ?? brandOnlyStickGeneric.key}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Brand-only stick/handheld vacuum rows lack model identity and stay exclusion-candidate-only.",
    }) : undefined,
    robotGeneric ? makeCase({
      caseId: "APPLIANCE-HOLD-03",
      inputTitle: robotGeneric.title ?? "robot vacuum generic",
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "robot_vacuum_generic_boundary_hold",
      productIdentityTokens: ["vacuum", "robot_vacuum"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: [],
      evidenceSource: `home-appliance-generic-vacuum-exclusion-readiness-latest.json:${robotGeneric.pid ?? robotGeneric.key}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Robot vacuum generic rows need brand/model/dock/base-station separation before any policy work.",
    }) : undefined,
    accessoryGeneric ? makeCase({
      caseId: "APPLIANCE-HOLD-04",
      inputTitle: accessoryGeneric.title ?? "vacuum accessory parts",
      inputDescription: "",
      expectedClass: "hold",
      blockerType: "vacuum_accessory_parts_hard_exclusion",
      productIdentityTokens: ["vacuum_accessory"],
      variantTokens: [],
      conditionTokens: [],
      sellerIntentTokens: ["selling"],
      bundleOrQuantityTokens: [],
      accessoryOrPartTokens: ["charger", "adapter", "parts"],
      evidenceSource: `home-appliance-generic-vacuum-exclusion-readiness-latest.json:${accessoryGeneric.pid ?? accessoryGeneric.key}`,
      externalEvidence: [],
      confidence: "high",
      notes: "Accessory and parts rows must be hard exclusions for whole-unit vacuum comparables.",
    }) : undefined,
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
    scope: "Home appliance vacuum subtype split prep only",
    nonScope: [
      "whole home_appliance_tech_discovered public readiness",
      "vacuum runtime parser policy",
      "robot vacuum or stick/handheld candidate pool policy",
      "logistics risk runtime handling",
    ],
    sourceReportsRead: [
      "home-appliance-blockers-latest.json",
      "home-appliance-vacuum-subtype-boundary-evidence-latest.json",
      "home-appliance-vacuum-model-subtype-boundary-evidence-latest.json",
      "home-appliance-vacuum-test-candidate-readiness-latest.json",
      "home-appliance-generic-vacuum-exclusion-readiness-latest.json",
    ],
    metrics: {
      total: blockers.currentMetrics.total,
      normal: blockers.currentMetrics.normal,
      modelReadyRate: blockers.currentMetrics.modelReadyRate,
      genericRate: blockers.currentMetrics.genericRate,
      modelReadyVacuumRows: modelSubtype.metrics.modelReadyRows,
      stickOrHandheldRows: modelSubtype.metrics.stickOrHandheldRows,
      stickOrHandheldUnits: modelSubtype.metrics.stickOrHandheldUnits,
      robotVacuumRows: modelSubtype.metrics.robotVacuumRows,
      robotVacuumUnits: modelSubtype.metrics.robotVacuumUnits,
      expandedGenericVacuumRows: generic.metrics.expandedGenericVacuumRows,
      newlyRecoveredGenericRows: generic.metrics.newlyRecoveredRows,
      exclusionCandidateOnlyRows: generic.metrics.exclusionCandidateOnlyRows,
      logisticsRiskCount: readiness.metrics.logisticsRiskCount,
      logisticsRiskExamplesAvailable: readiness.metrics.logisticsRiskExamplesAvailable,
      runtimeApprovedRows: modelSubtype.metrics.runtimeApprovedRows + generic.metrics.runtimeApprovedRows,
      testCaseCount: cases.length,
      positiveCount: 0,
      splitOnlyCount: splitOnlyOrArchitectureCases.length,
      holdCount: negativeHoldTestCases.length,
      manualReviewCount: manualReviewTestCases.length,
    },
    gateCounts: blockers.currentMetrics.gateCounts,
    topKeyCounts: blockers.currentMetrics.topKeyCounts,
    subtypeRows: blockers.currentMetrics.subtypeRows,
    genericClassCounts: generic.metrics.genericClassCounts,
    positiveTestCases: [],
    splitOnlyOrArchitectureCases,
    manualReviewTestCases,
    negativeHoldTestCases,
    blockerToTestMapping: [
      { blocker: "Stick/handheld model-ready reference only", caseIds: splitOnlyOrArchitectureCases.map((row) => row.caseId) },
      { blocker: "Robot vacuum separate axis", caseIds: manualReviewTestCases.map((row) => row.caseId) },
      { blocker: "Generic, bedding, robot-generic, and accessory exclusions", caseIds: negativeHoldTestCases.map((row) => row.caseId) },
    ],
    dryRunStrategyForMainAgent: [
      "Assert stick/handheld vacuum rows do not accept brand-only generic titles.",
      "Assert robot vacuum rows never merge into stick/handheld vacuum parser readiness.",
      "Assert bedding cleaner and accessory/parts rows remain exclusions.",
      "Keep logistics risk blocked until row-level examples are available.",
    ],
    stopCondition: "Stop before editing runtime parser/catalog/pipeline/candidate pool files.",
    nextQueueItem: "Implementation prep summary report across Phase 0-9",
    deferred: [
      "Home appliance sample is thin: model-ready rate is low and generic rate is high.",
      "Logistics risk has count-only evidence; row-level examples are still missing.",
      "Robot vacuum needs a separate brand/model/dock/base-station axis before implementation.",
      "Bedding cleaner and accessory/parts exclusions should be carried into later fixture planning.",
    ],
    inheritedDoNotDo: blockers.doNotDo,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "home-appliance-vacuum-subtype-split-prep-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Home Appliance Vacuum Subtype Split Prep",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Lightweight split prep for home appliance vacuum subtype rows. This is not runtime wiring, candidate pool wiring, or public promotion.",
    "",
    "## Metrics",
    "",
    `- total samples: ${report.metrics.total}`,
    `- normal rows: ${report.metrics.normal}`,
    `- model-ready rate: ${report.metrics.modelReadyRate}%`,
    `- generic rate: ${report.metrics.genericRate}%`,
    `- model-ready vacuum rows: ${report.metrics.modelReadyVacuumRows}`,
    `- stick/handheld rows/units: ${report.metrics.stickOrHandheldRows}/${report.metrics.stickOrHandheldUnits}`,
    `- robot vacuum rows/units: ${report.metrics.robotVacuumRows}/${report.metrics.robotVacuumUnits}`,
    `- expanded generic vacuum rows: ${report.metrics.expandedGenericVacuumRows}`,
    `- logistics risk count/examples: ${report.metrics.logisticsRiskCount}/${report.metrics.logisticsRiskExamplesAvailable}`,
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

  await writeFile(path.join(reportsDir, "home-appliance-vacuum-subtype-split-prep-latest.md"), `${md}\n`);
  console.log("wrote reports/home-appliance-vacuum-subtype-split-prep-latest.json");
  console.log("wrote reports/home-appliance-vacuum-subtype-split-prep-latest.md");
  console.log(`home appliance vacuum split prep: cases=${cases.length}, split_only=${splitOnlyOrArchitectureCases.length}, hold=${negativeHoldTestCases.length}, manual=${manualReviewTestCases.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
