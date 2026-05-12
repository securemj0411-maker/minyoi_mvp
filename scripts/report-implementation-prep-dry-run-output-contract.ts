import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type DryRunPlan = {
  category: string;
  dryRunCases: Array<{
    caseId: string;
    expectedClass: "positive" | "hold" | "manual_review" | "split_only" | "ignore";
    expectedDryRunDecision: "candidate_positive_only" | "manual_review_only" | "negative_hold_only";
  }>;
};

type PlanReport = {
  dryRunPlans: DryRunPlan[];
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const plan = await readJson<PlanReport>(path.join(reportsDir, "subagent-implementation-prep-no-mutation-dry-run-plan-latest.json"));

  const allowedDecisionValues = ["candidate_positive_only", "manual_review_only", "negative_hold_only"] as const;
  const requiredOutputFields = [
    { name: "category", type: "string", required: true, note: "must match selected dry-run category" },
    { name: "caseId", type: "string", required: true, note: "must match fixture case ID" },
    { name: "inputTitle", type: "string", required: true, note: "copied from fixture" },
    { name: "expectedClass", type: "enum", required: true, note: "positive | manual_review | hold | split_only | ignore" },
    { name: "dryRunDecision", type: "enum", required: true, note: allowedDecisionValues.join(" | ") },
    { name: "runtimeApproved", type: "boolean", required: true, note: "must always be false" },
    { name: "publicPromotion", type: "boolean", required: true, note: "must always be false" },
    { name: "candidatePoolWiring", type: "boolean", required: true, note: "must always be false" },
    { name: "reason", type: "string", required: true, note: "human-readable parser/report-only reason" },
    { name: "sourceEvidenceRefs", type: "string[]", required: true, note: "source pointers, not approval" },
    { name: "failureIf", type: "string", required: true, note: "what would make this dry-run case fail" },
  ];

  const validationRules = [
    {
      id: "CONTRACT-01",
      rule: "runtimeApproved must be false for every row",
      severity: "blocker",
    },
    {
      id: "CONTRACT-02",
      rule: "publicPromotion must be false for every row",
      severity: "blocker",
    },
    {
      id: "CONTRACT-03",
      rule: "candidatePoolWiring must be false for every row",
      severity: "blocker",
    },
    {
      id: "CONTRACT-04",
      rule: "manual_review fixture cases must output manual_review_only",
      severity: "blocker",
    },
    {
      id: "CONTRACT-05",
      rule: "hold fixture cases must output negative_hold_only",
      severity: "blocker",
    },
    {
      id: "CONTRACT-06",
      rule: "positive fixture cases may output candidate_positive_only only, never runtime approval",
      severity: "blocker",
    },
    {
      id: "CONTRACT-07",
      rule: "unknown fields that imply production mutation are forbidden",
      severity: "blocker",
    },
  ];

  const categoryContracts = plan.dryRunPlans.map((item) => ({
    category: item.category,
    caseCount: item.dryRunCases.length,
    expectedDecisionCounts: allowedDecisionValues.map((value) => ({
      decision: value,
      count: item.dryRunCases.filter((row) => row.expectedDryRunDecision === value).length,
    })),
    fixtureCases: item.dryRunCases.map((row) => ({
      caseId: row.caseId,
      expectedClass: row.expectedClass,
      requiredDecision: row.expectedDryRunDecision,
    })),
  }));

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope: "Output contract and validation checklist for future no-mutation parser dry-run",
    allowedDecisionValues,
    requiredOutputFields,
    validationRules,
    categoryContracts,
    nextSafeStep: "owner chooses one category, then a no-mutation dry-run executor may emit only this contract shape",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "subagent-implementation-prep-dry-run-output-contract-latest.json"), JSON.stringify(report, null, 2));

  const fieldRows = requiredOutputFields.map((field) => `| ${field.name} | ${field.type} | ${field.required ? "yes" : "no"} | ${field.note.replace(/\|/g, "/")} |`);
  const ruleRows = validationRules.map((rule) => `| ${rule.id} | ${rule.severity} | ${rule.rule} |`);
  const contractRows = categoryContracts.flatMap((contract) =>
    contract.expectedDecisionCounts.map((row) => `| ${contract.category} | ${contract.caseCount} | ${row.decision} | ${row.count} |`),
  );

  const md = [
    "# Subagent Implementation Prep Dry-Run Output Contract",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only output contract for a future no-mutation parser dry-run. This does not execute parser/runtime wiring.",
    "",
    "## Required Output Fields",
    "",
    "| field | type | required | note |",
    "| --- | --- | --- | --- |",
    ...fieldRows,
    "",
    "## Validation Rules",
    "",
    "| id | severity | rule |",
    "| --- | --- | --- |",
    ...ruleRows,
    "",
    "## Category Contracts",
    "",
    "| category | case_count | required_decision | count |",
    "| --- | ---: | --- | ---: |",
    ...contractRows,
    "",
    "## Next Safe Step",
    "",
    report.nextSafeStep,
  ].join("\n");

  await writeFile(path.join(reportsDir, "subagent-implementation-prep-dry-run-output-contract-latest.md"), `${md}\n`);
  console.log("wrote reports/subagent-implementation-prep-dry-run-output-contract-latest.json");
  console.log("wrote reports/subagent-implementation-prep-dry-run-output-contract-latest.md");
  console.log(`dry-run output contract: categories=${categoryContracts.length}, rules=${validationRules.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
