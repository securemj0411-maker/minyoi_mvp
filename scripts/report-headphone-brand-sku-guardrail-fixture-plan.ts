import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SourceRow = {
  caseId: string;
  brandOrFamily: string;
  suspectedModelOrSeries: string;
  sourceStatus: string;
  sources: Array<{ label: string; url: string; retrievedAt: string; note: string }>;
  reasonStillBlocked: string;
};

type SourceBackfill = {
  sourceRows: SourceRow[];
  stillNoSourceRows: Array<{
    caseId: string;
    lane: string;
    inferredBrandOrFamily: string;
    suspectedModelOrSeries: string;
  }>;
};

type GuardrailFixture = {
  caseId: string;
  brandOrFamily: string;
  suspectedModelOrSeries: string;
  expectedDecision: "negative_hold_only" | "manual_review_only";
  sourceRefs: Array<{ label: string; url: string }>;
  guardrailPurpose: string;
  failureIf: string;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const sourceBackfill = await readJson<SourceBackfill>(path.join(reportsDir, "headphone-broader-brand-sku-source-backfill-latest.json"));

  const guardrailFixtures: GuardrailFixture[] = [
    ...sourceBackfill.sourceRows.map((row) => ({
      caseId: row.caseId,
      brandOrFamily: row.brandOrFamily,
      suspectedModelOrSeries: row.suspectedModelOrSeries,
      expectedDecision: "negative_hold_only" as const,
      sourceRefs: row.sources.map((source) => ({ label: source.label, url: source.url })),
      guardrailPurpose: "Official source exists, but exact local title-to-SKU normalization and catalog expansion are not approved.",
      failureIf: "The row becomes candidate_positive_only solely because an official source exists.",
    })),
    ...sourceBackfill.stillNoSourceRows.map((row) => ({
      caseId: row.caseId,
      brandOrFamily: row.inferredBrandOrFamily,
      suspectedModelOrSeries: row.suspectedModelOrSeries,
      expectedDecision: "manual_review_only" as const,
      sourceRefs: [],
      guardrailPurpose: "AirPods Max ambiguity remains connector/generation manual-review, not broader brand/SKU approval.",
      failureIf: "The row becomes candidate_positive_only by inferring connector/generation from incomplete title context.",
    })),
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    scope: "Brand/SKU guardrail fixture plan for broader headphone evidence",
    inputFiles: ["reports/headphone-broader-brand-sku-source-backfill-latest.json"],
    metrics: {
      guardrailFixtures: guardrailFixtures.length,
      negativeHoldFixtures: guardrailFixtures.filter((row) => row.expectedDecision === "negative_hold_only").length,
      manualReviewFixtures: guardrailFixtures.filter((row) => row.expectedDecision === "manual_review_only").length,
      fixturesWithSourceRefs: guardrailFixtures.filter((row) => row.sourceRefs.length > 0).length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    guardrailFixtures,
    policy: [
      "Source-backed Razer/Beats rows remain guardrails, not positives.",
      "A known brand page is not enough to create a comparable key.",
      "Exact SKU normalization and catalog expansion require separate approval.",
    ],
    nextStep: "If continuing report-only, create a brand/SKU guardrail dry-run contract or stop and request owner review.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-brand-sku-guardrail-fixture-plan-latest.json"), JSON.stringify(report, null, 2));

  const rows = guardrailFixtures.map((row) => {
    const links = row.sourceRefs.map((source) => `[${source.label}](${source.url})`).join("<br>");
    return `| ${row.caseId} | ${row.brandOrFamily} | ${row.suspectedModelOrSeries} | ${row.expectedDecision} | ${row.sourceRefs.length} | ${links || "-"} | ${row.failureIf.replace(/\|/g, "/")} |`;
  });

  const md = [
    "# Headphone Brand/SKU Guardrail Fixture Plan",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only guardrail fixture plan for broader headphone brand/SKU evidence. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- guardrail fixtures: ${report.metrics.guardrailFixtures}`,
    `- negative/manual fixtures: ${report.metrics.negativeHoldFixtures}/${report.metrics.manualReviewFixtures}`,
    `- fixtures with source refs: ${report.metrics.fixturesWithSourceRefs}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Guardrail Fixtures",
    "",
    "| case_id | brand_or_family | suspected_model_or_series | expected_decision | source_refs | sources | failure_if |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
    ...rows,
    "",
    "## Policy",
    "",
    ...report.policy.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    report.nextStep,
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-brand-sku-guardrail-fixture-plan-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-brand-sku-guardrail-fixture-plan-latest.json");
  console.log("wrote reports/headphone-brand-sku-guardrail-fixture-plan-latest.md");
  console.log(`headphone brand/SKU guardrail plan: fixtures=${guardrailFixtures.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
