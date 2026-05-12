import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ImplementationCase = {
  caseId: string;
  category: string;
  inputTitle: string;
  inputDescription?: string;
  expectedClass: "positive" | "hold" | "manual_review" | "split_only" | "ignore";
  blockerType: string;
  productIdentityTokens: string[];
  variantTokens: string[];
  conditionTokens: string[];
  sellerIntentTokens: string[];
  bundleOrQuantityTokens: string[];
  accessoryOrPartTokens: string[];
  evidenceSource: string;
  confidence: "high" | "medium" | "low";
  notes: string;
};

type CategoryGate = {
  phase: string;
  category: string;
  depth: "deep" | "lightweight";
  reviewLane: string;
  reviewScore: number;
  selectedCases: ImplementationCase[];
  counts: {
    totalCases: number;
    positive: number;
    splitOnly: number;
    hold: number;
    manualReview: number;
    runtimeApprovedRows: number;
  };
};

type NextGateReport = {
  topNarrowReviewCandidates: CategoryGate[];
};

type AuditReport = {
  metrics: {
    duplicateCaseIds: number;
    positiveMissingEvidence: number;
    runtimeApprovedRows: number;
  };
};

type SourceBackfillReport = {
  metrics: {
    stillMissingPositiveRows: number;
    runtimeApprovedRows: number;
  };
};

type DryRunCase = {
  caseId: string;
  inputTitle: string;
  expectedClass: ImplementationCase["expectedClass"];
  expectedDryRunDecision: "candidate_positive_only" | "manual_review_only" | "negative_hold_only";
  assertion: string;
  failureMeans: string;
};

type DryRunPlan = {
  category: string;
  phase: string;
  reviewScore: number;
  readinessForDryRun: "eligible_for_no_mutation_dry_run_design" | "blocked_before_dry_run";
  reason: string;
  caseCounts: CategoryGate["counts"];
  dryRunCases: DryRunCase[];
  requiredInputs: string[];
  allowedOutputs: string[];
  forbiddenOutputs: string[];
  stopConditions: string[];
  passCriteria: string[];
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function decisionFor(row: ImplementationCase): DryRunCase["expectedDryRunDecision"] {
  if (row.expectedClass === "positive") return "candidate_positive_only";
  if (row.expectedClass === "manual_review") return "manual_review_only";
  return "negative_hold_only";
}

function assertionFor(row: ImplementationCase): string {
  if (row.expectedClass === "positive") {
    return "Dry run may classify as parser-candidate positive, but must keep runtime/public approval false.";
  }
  if (row.expectedClass === "manual_review") {
    return "Dry run must keep this row manual-review and must not infer missing model/generation/variant from title alone.";
  }
  return "Dry run must keep this row out of positive comparable candidates.";
}

function failureFor(row: ImplementationCase): string {
  if (row.expectedClass === "positive") {
    return "A failure means positive parser-candidate logic is too weak or missing required source-backed identity tokens.";
  }
  if (row.expectedClass === "manual_review") {
    return "A failure means the parser is over-inferring uncertain title tokens.";
  }
  return "A failure means exclusion boundaries are too loose and would contaminate candidate comparables.";
}

function makeDryRunCases(gate: CategoryGate): DryRunCase[] {
  return gate.selectedCases.map((row) => ({
    caseId: row.caseId,
    inputTitle: row.inputTitle,
    expectedClass: row.expectedClass,
    expectedDryRunDecision: decisionFor(row),
    assertion: assertionFor(row),
    failureMeans: failureFor(row),
  }));
}

function categorySpecificInputs(category: string): string[] {
  const common = [
    "input title",
    "optional input description",
    "expected fixture class",
    "source/evidence pointer",
    "no production DB rows",
  ];
  if (category === "headphone_discovered") return [...common, "brand/model tokens", "connector/generation/color uncertainty tokens"];
  if (category === "earphone_airpods_discovered") return [...common, "AirPods generation tokens", "ANC/USB-C/Lightning/body-only tokens"];
  if (category === "game_console_body_narrow") return [...common, "console model tokens", "body/full-set/bundle/accessory/buying tokens"];
  return common;
}

function makePlan(gate: CategoryGate, blocked: boolean): DryRunPlan {
  return {
    category: gate.category,
    phase: gate.phase,
    reviewScore: gate.reviewScore,
    readinessForDryRun: blocked ? "blocked_before_dry_run" : "eligible_for_no_mutation_dry_run_design",
    reason: blocked
      ? "Fixture audit or source backfill still has blockers."
      : "Positive evidence pointers exist and fixture audit has no duplicate IDs or missing positive evidence.",
    caseCounts: gate.counts,
    dryRunCases: makeDryRunCases(gate),
    requiredInputs: categorySpecificInputs(gate.category),
    allowedOutputs: [
      "report-only parser_candidate classification",
      "manual_review classification",
      "negative_hold classification",
      "confidence and reason strings",
      "diff-free markdown/json report",
    ],
    forbiddenOutputs: [
      "runtime catalog mutation",
      "public promotion",
      "candidate pool policy wiring",
      "Supabase mutation",
      "cron/lifecycle/source-health/pack UI changes",
      "production DB writes",
    ],
    stopConditions: [
      "any runtime file edit would be required",
      "a title requires guessing model/generation/variant",
      "manual-review or hold case would be promoted positive",
      "candidate-pool wiring would be needed to test behavior",
    ],
    passCriteria: [
      "all positive cases stay candidate-positive-only with runtime approval false",
      "all manual-review cases remain manual-review",
      "all hold cases remain negative/hold",
      "report emits zero production mutations",
      "summary lists unresolved blockers for owner review",
    ],
  };
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const nextGate = await readJson<NextGateReport>(path.join(reportsDir, "subagent-implementation-prep-next-gate-latest.json"));
  const audit = await readJson<AuditReport>(path.join(reportsDir, "subagent-implementation-prep-fixture-consistency-audit-latest.json"));
  const sourceBackfill = await readJson<SourceBackfillReport>(path.join(reportsDir, "subagent-implementation-prep-spec-source-backfill-latest.json"));

  const blocked =
    audit.metrics.duplicateCaseIds > 0 ||
    audit.metrics.positiveMissingEvidence > 0 ||
    audit.metrics.runtimeApprovedRows > 0 ||
    sourceBackfill.metrics.stillMissingPositiveRows > 0 ||
    sourceBackfill.metrics.runtimeApprovedRows > 0;

  const dryRunPlans = nextGate.topNarrowReviewCandidates.map((gate) => makePlan(gate, blocked));

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope: "No-mutation parser dry-run design for top narrow review candidates",
    prerequisites: {
      duplicateCaseIds: audit.metrics.duplicateCaseIds,
      positiveMissingEvidence: audit.metrics.positiveMissingEvidence,
      stillMissingPositiveSourceRows: sourceBackfill.metrics.stillMissingPositiveRows,
      runtimeApprovedRows: audit.metrics.runtimeApprovedRows + sourceBackfill.metrics.runtimeApprovedRows,
      blocked,
    },
    dryRunPlans,
    recommendedOrder: dryRunPlans.map((plan) => plan.category),
    ownerDecisionNeededBeforeExecution: [
      "choose exactly one category for actual no-mutation dry-run execution",
      "confirm that parser_candidate remains non-public",
      "confirm no candidate-pool wiring or runtime catalog edits",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "subagent-implementation-prep-no-mutation-dry-run-plan-latest.json"), JSON.stringify(report, null, 2));

  const queueRows = dryRunPlans.map((plan) => {
    const counts = `${plan.caseCounts.positive}/${plan.caseCounts.manualReview}/${plan.caseCounts.hold}`;
    return `| ${plan.category} | ${plan.reviewScore} | ${plan.readinessForDryRun} | ${counts} | ${plan.reason} |`;
  });

  const caseRows = dryRunPlans.flatMap((plan) =>
    plan.dryRunCases.map((row) => `| ${plan.category} | ${row.caseId} | ${row.expectedClass} | ${row.expectedDryRunDecision} | ${row.inputTitle.replace(/\|/g, "/")} |`),
  );

  const md = [
    "# Subagent Implementation Prep No-Mutation Dry-Run Plan",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only dry-run design for top narrow review candidates. This does not execute runtime parser wiring.",
    "",
    "## Prerequisites",
    "",
    `- duplicate case IDs: ${report.prerequisites.duplicateCaseIds}`,
    `- positive missing evidence: ${report.prerequisites.positiveMissingEvidence}`,
    `- still missing positive source rows: ${report.prerequisites.stillMissingPositiveSourceRows}`,
    `- runtime-approved rows: ${report.prerequisites.runtimeApprovedRows}`,
    `- blocked: ${report.prerequisites.blocked ? "yes" : "no"}`,
    "",
    "## Dry-Run Queue",
    "",
    "| category | score | readiness | positive/manual/hold | reason |",
    "| --- | ---: | --- | --- | --- |",
    ...queueRows,
    "",
    "## Dry-Run Fixture Cases",
    "",
    "| category | case_id | expected_class | expected_dry_run_decision | title |",
    "| --- | --- | --- | --- | --- |",
    ...caseRows,
    "",
    "## Owner Decision Needed Before Execution",
    "",
    ...report.ownerDecisionNeededBeforeExecution.map((item) => `- ${item}`),
    "",
    "## Forbidden Outputs",
    "",
    ...dryRunPlans[0].forbiddenOutputs.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "subagent-implementation-prep-no-mutation-dry-run-plan-latest.md"), `${md}\n`);
  console.log("wrote reports/subagent-implementation-prep-no-mutation-dry-run-plan-latest.json");
  console.log("wrote reports/subagent-implementation-prep-no-mutation-dry-run-plan-latest.md");
  console.log(`no-mutation dry-run plan: categories=${dryRunPlans.length}, blocked=${blocked ? "yes" : "no"}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
