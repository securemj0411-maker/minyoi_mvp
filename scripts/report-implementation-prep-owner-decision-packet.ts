import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type DryRunPlan = {
  category: string;
  phase: string;
  reviewScore: number;
  readinessForDryRun: string;
  caseCounts: {
    totalCases: number;
    positive: number;
    splitOnly: number;
    hold: number;
    manualReview: number;
    runtimeApprovedRows: number;
  };
  dryRunCases: Array<{
    caseId: string;
    expectedClass: string;
    expectedDryRunDecision: string;
    inputTitle: string;
  }>;
  passCriteria: string[];
  stopConditions: string[];
};

type DryRunPlanReport = {
  prerequisites: {
    blocked: boolean;
    duplicateCaseIds: number;
    positiveMissingEvidence: number;
    stillMissingPositiveSourceRows: number;
    runtimeApprovedRows: number;
  };
  dryRunPlans: DryRunPlan[];
};

type NextGateReport = {
  deferredRegister: Array<{ category: string; item: string }>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function recommendation(category: string): { rank: number; label: string; rationale: string; mainRisk: string } {
  if (category === "headphone_discovered") {
    return {
      rank: 1,
      label: "Best first dry-run candidate",
      rationale: "Highest review score, five positive cases, source backfill complete, and matched-SKU scope is narrower than broad category promotion.",
      mainRisk: "AirPods Max connector/generation ambiguity and non-headphone accessory rows must stay manual/hold.",
    };
  }
  if (category === "earphone_airpods_discovered") {
    return {
      rank: 2,
      label: "Strong but already AirPods-specific",
      rationale: "Positive cases have strong Apple source pointers and clear generation/connector fixtures.",
      mainRisk: "Charging-case/body-only Korean wording around 본체 can contaminate full-unit positives.",
    };
  }
  return {
    rank: 3,
    label: "Useful but broader contamination risk",
    rationale: "Switch OLED/Lite/V2 body fixtures are useful and now source-backed, but broad game-console contamination remains high.",
    mainRisk: "Bundles, game titles, accessories, buying posts, PS5, Switch 2, and V2 low-sample coverage make runtime interpretation riskier.",
  };
}

function categoryDeferred(category: string, deferredRegister: NextGateReport["deferredRegister"]): string[] {
  return deferredRegister.filter((item) => item.category === category).map((item) => item.item);
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const plan = await readJson<DryRunPlanReport>(path.join(reportsDir, "subagent-implementation-prep-no-mutation-dry-run-plan-latest.json"));
  const nextGate = await readJson<NextGateReport>(path.join(reportsDir, "subagent-implementation-prep-next-gate-latest.json"));

  const candidates = plan.dryRunPlans
    .map((item) => {
      const rec = recommendation(item.category);
      return {
        ...item,
        ownerRank: rec.rank,
        recommendationLabel: rec.label,
        rationale: rec.rationale,
        mainRisk: rec.mainRisk,
        deferredCarryForward: categoryDeferred(item.category, nextGate.deferredRegister),
      };
    })
    .sort((a, b) => a.ownerRank - b.ownerRank);

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope: "Owner decision packet for choosing one no-mutation parser dry-run category",
    prerequisites: plan.prerequisites,
    candidates,
    recommendation: {
      chooseFirst: candidates[0]?.category ?? null,
      reason: candidates[0]?.rationale ?? null,
      stillRequiresOwnerApproval: true,
    },
    decisionRules: [
      "Choose exactly one category.",
      "Do not choose a category if runtime wiring is required to test it.",
      "Do not choose based on public promotion potential; choose based on no-mutation dry-run clarity.",
      "Keep parser_candidate non-public regardless of dry-run result.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "subagent-implementation-prep-owner-decision-packet-latest.json"), JSON.stringify(report, null, 2));

  const rows = candidates.map((item) => {
    const counts = `${item.caseCounts.positive}/${item.caseCounts.manualReview}/${item.caseCounts.hold}`;
    return `| ${item.ownerRank} | ${item.category} | ${item.reviewScore} | ${counts} | ${item.recommendationLabel} | ${item.mainRisk.replace(/\|/g, "/")} |`;
  });

  const detailRows = candidates.flatMap((item) => [
    `### ${item.ownerRank}. ${item.category}`,
    "",
    `- rationale: ${item.rationale}`,
    `- main risk: ${item.mainRisk}`,
    `- deferred carry-forward: ${item.deferredCarryForward.length}`,
    ...item.deferredCarryForward.map((entry) => `  - ${entry}`),
    "",
  ]);

  const md = [
    "# Subagent Implementation Prep Owner Decision Packet",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only decision packet for choosing one no-mutation parser dry-run category. This does not approve runtime wiring.",
    "",
    "## Recommendation",
    "",
    `- choose first: ${report.recommendation.chooseFirst}`,
    `- reason: ${report.recommendation.reason}`,
    `- still requires owner approval: ${report.recommendation.stillRequiresOwnerApproval ? "yes" : "no"}`,
    "",
    "## Candidate Comparison",
    "",
    "| rank | category | score | positive/manual/hold | label | main risk |",
    "| ---: | --- | ---: | --- | --- | --- |",
    ...rows,
    "",
    "## Candidate Details",
    "",
    ...detailRows,
    "## Decision Rules",
    "",
    ...report.decisionRules.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "subagent-implementation-prep-owner-decision-packet-latest.md"), `${md}\n`);
  console.log("wrote reports/subagent-implementation-prep-owner-decision-packet-latest.json");
  console.log("wrote reports/subagent-implementation-prep-owner-decision-packet-latest.md");
  console.log(`owner decision packet: candidates=${candidates.length}, recommended=${report.recommendation.chooseFirst}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
