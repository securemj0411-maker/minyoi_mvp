import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ImplementationCase = {
  caseId: string;
  category: string;
  inputTitle: string;
  expectedClass: "positive" | "hold" | "manual_review" | "split_only" | "ignore";
  blockerType: string;
  evidenceSource: string;
  externalEvidence?: Array<{ label: string; url: string; retrievedAt: string }>;
  confidence: "high" | "medium" | "low";
};

type PrepReport = {
  positiveTestCases?: ImplementationCase[];
  splitOnlyOrArchitectureCases?: ImplementationCase[];
  manualReviewTestCases?: ImplementationCase[];
  negativeHoldTestCases?: ImplementationCase[];
};

type SourceBackfill = {
  caseId: string;
  category: string;
  sources: Array<{ label: string; url: string; retrievedAt: string; note: string }>;
};

type SourceBackfillReport = {
  sourceBackfills: SourceBackfill[];
};

const reportsDir = path.join(process.cwd(), "reports");

const prepFiles = [
  "earphone-airpods-implementation-prep-latest.json",
  "headphone-matched-sku-implementation-prep-latest.json",
  "game-console-body-narrow-implementation-prep-latest.json",
  "monitor-model-code-implementation-prep-latest.json",
  "desktop-cpu-gpu-implementation-prep-latest.json",
  "smartwatch-ambiguity-split-prep-latest.json",
  "camera-package-split-prep-latest.json",
  "speaker-audio-device-class-split-prep-latest.json",
  "home-appliance-vacuum-subtype-split-prep-latest.json",
];

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function collectCases(report: PrepReport): ImplementationCase[] {
  return [
    ...(report.positiveTestCases ?? []),
    ...(report.splitOnlyOrArchitectureCases ?? []),
    ...(report.manualReviewTestCases ?? []),
    ...(report.negativeHoldTestCases ?? []),
  ];
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const cases: ImplementationCase[] = [];
  for (const file of prepFiles) {
    const report = await readJson<PrepReport>(path.join(reportsDir, file));
    cases.push(...collectCases(report));
  }

  const backfill = await readJson<SourceBackfillReport>(path.join(reportsDir, "subagent-implementation-prep-spec-source-backfill-latest.json"));
  const backfilledSourceByCaseId = new Map(backfill.sourceBackfills.map((row) => [row.caseId, row.sources]));

  const caseIds = cases.map((row) => row.caseId);
  const duplicateCaseIds = countBy(caseIds).filter((row) => row.count > 1);
  const classCounts = countBy(cases.map((row) => row.expectedClass));
  const categoryCounts = countBy(cases.map((row) => row.category));

  const positiveCases = cases.filter((row) => row.expectedClass === "positive");
  const positiveMissingEvidence = positiveCases.filter((row) => (row.externalEvidence?.length ?? 0) === 0 && !backfilledSourceByCaseId.has(row.caseId));
  const manualWithBackfilledSource = cases.filter((row) => row.expectedClass === "manual_review" && backfilledSourceByCaseId.has(row.caseId));
  const holdWithExternalEvidence = cases.filter((row) => row.expectedClass === "hold" && (row.externalEvidence?.length ?? 0) > 0);
  const highConfidenceManualOrHold = cases.filter((row) => row.expectedClass !== "positive" && row.confidence === "high");

  const auditFindings = [
    {
      id: "AUDIT-01",
      severity: duplicateCaseIds.length === 0 ? "ok" : "blocker",
      finding: duplicateCaseIds.length === 0 ? "No duplicate case IDs found." : "Duplicate case IDs found.",
      count: duplicateCaseIds.length,
    },
    {
      id: "AUDIT-02",
      severity: positiveMissingEvidence.length === 0 ? "ok" : "needs_backfill",
      finding: positiveMissingEvidence.length === 0 ? "All positive cases have inline or backfilled evidence pointers." : "Some positive cases still lack evidence pointers.",
      count: positiveMissingEvidence.length,
    },
    {
      id: "AUDIT-03",
      severity: manualWithBackfilledSource.length === 0 ? "ok" : "caution",
      finding: "Backfilled sources do not auto-promote manual-review cases.",
      count: manualWithBackfilledSource.length,
    },
    {
      id: "AUDIT-04",
      severity: holdWithExternalEvidence.length === 0 ? "ok" : "caution",
      finding: "Hold cases with evidence remain exclusion fixtures, not positive cases.",
      count: holdWithExternalEvidence.length,
    },
    {
      id: "AUDIT-05",
      severity: "caution",
      finding: "High-confidence manual/hold rows must remain non-positive despite confidence.",
      count: highConfidenceManualOrHold.length,
    },
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    scope: "No-mutation fixture consistency audit across implementation-prep reports",
    metrics: {
      totalCases: cases.length,
      duplicateCaseIds: duplicateCaseIds.length,
      positiveCases: positiveCases.length,
      positiveMissingEvidence: positiveMissingEvidence.length,
      manualWithBackfilledSource: manualWithBackfilledSource.length,
      holdWithExternalEvidence: holdWithExternalEvidence.length,
      highConfidenceManualOrHold: highConfidenceManualOrHold.length,
      runtimeApprovedRows: 0,
    },
    classCounts,
    categoryCounts,
    duplicateCaseIds,
    positiveMissingEvidence,
    manualWithBackfilledSource,
    holdWithExternalEvidence,
    highConfidenceManualOrHold,
    auditFindings,
    policy: [
      "A source pointer satisfies evidence tracking only; it does not approve runtime behavior.",
      "Manual-review and hold rows are intentionally non-positive, even when confidence is high.",
      "No-mutation fixture consistency audit is safe to rerun before main implementation review.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "subagent-implementation-prep-fixture-consistency-audit-latest.json"), JSON.stringify(report, null, 2));

  const findingRows = auditFindings.map((row) => `| ${row.id} | ${row.severity} | ${row.count} | ${row.finding} |`);
  const classRows = classCounts.map((row) => `| ${row.key} | ${row.count} |`);
  const categoryRows = categoryCounts.map((row) => `| ${row.key} | ${row.count} |`);

  const md = [
    "# Subagent Implementation Prep Fixture Consistency Audit",
    "",
    `Generated: ${generatedAt}`,
    "",
    "No-mutation audit across implementation-prep fixture cases. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- total cases: ${report.metrics.totalCases}`,
    `- duplicate case IDs: ${report.metrics.duplicateCaseIds}`,
    `- positive cases: ${report.metrics.positiveCases}`,
    `- positive missing evidence: ${report.metrics.positiveMissingEvidence}`,
    `- manual with backfilled source: ${report.metrics.manualWithBackfilledSource}`,
    `- hold with external evidence: ${report.metrics.holdWithExternalEvidence}`,
    `- high-confidence manual/hold: ${report.metrics.highConfidenceManualOrHold}`,
    `- runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    "",
    "## Audit Findings",
    "",
    "| id | severity | count | finding |",
    "| --- | --- | ---: | --- |",
    ...findingRows,
    "",
    "## Class Counts",
    "",
    "| expected_class | count |",
    "| --- | ---: |",
    ...classRows,
    "",
    "## Category Counts",
    "",
    "| category | count |",
    "| --- | ---: |",
    ...categoryRows,
    "",
    "## Policy",
    "",
    ...report.policy.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "subagent-implementation-prep-fixture-consistency-audit-latest.md"), `${md}\n`);
  console.log("wrote reports/subagent-implementation-prep-fixture-consistency-audit-latest.json");
  console.log("wrote reports/subagent-implementation-prep-fixture-consistency-audit-latest.md");
  console.log(`fixture consistency audit: cases=${cases.length}, duplicates=${duplicateCaseIds.length}, positive_missing=${positiveMissingEvidence.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
