import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ExternalEvidence = {
  label: string;
  url: string;
  retrievedAt: string;
};

type ImplementationCase = {
  caseId: string;
  category: string;
  inputTitle: string;
  expectedClass: "positive" | "hold" | "manual_review" | "split_only" | "ignore";
  blockerType: string;
  productIdentityTokens: string[];
  variantTokens: string[];
  evidenceSource: string;
  externalEvidence: ExternalEvidence[];
  confidence: "high" | "medium" | "low";
  notes: string;
};

type PrepReport = {
  scope: string;
  positiveTestCases?: ImplementationCase[];
  manualReviewTestCases?: ImplementationCase[];
  negativeHoldTestCases?: ImplementationCase[];
};

type EvidenceGapRow = {
  category: string;
  caseId: string;
  expectedClass: ImplementationCase["expectedClass"];
  inputTitle: string;
  identity: string;
  variants: string;
  currentEvidenceCount: number;
  evidenceStatus: "has_official_or_named_source" | "missing_required_spec_source" | "manual_review_needs_source" | "hold_exclusion_fixture";
  requiredBeforeRuntime: boolean;
  recommendedEvidence: string[];
  existingEvidence: ExternalEvidence[];
  notes: string;
};

const reportsDir = path.join(process.cwd(), "reports");

const inputs = [
  {
    category: "headphone_discovered",
    reportFile: "headphone-matched-sku-implementation-prep-latest.json",
  },
  {
    category: "earphone_airpods_discovered",
    reportFile: "earphone-airpods-implementation-prep-latest.json",
  },
  {
    category: "game_console_body_narrow",
    reportFile: "game-console-body-narrow-implementation-prep-latest.json",
  },
];

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function sourceHint(row: ImplementationCase): string[] {
  const joined = [...row.productIdentityTokens, ...row.variantTokens, row.inputTitle].join(" ").toLowerCase();
  if (joined.includes("airpods") || joined.includes("apple")) return ["Apple support identify/spec page", "Apple technical specifications page"];
  if (joined.includes("sony") || joined.includes("wh_")) return ["Sony official product/spec page", "Sony support/manual page"];
  if (joined.includes("bose") || joined.includes("quietcomfort")) return ["Bose official product/spec page", "Bose support/manual page"];
  if (joined.includes("nintendo") || joined.includes("switch")) return ["Nintendo support/product specification page", "Nintendo official comparison/spec page"];
  if (joined.includes("playstation") || joined.includes("ps5") || joined.includes("플스")) return ["PlayStation official hardware/spec page", "Sony PlayStation support page"];
  return ["brand official product/spec page", "brand support/manual page"];
}

function evidenceStatus(row: ImplementationCase): EvidenceGapRow["evidenceStatus"] {
  if (row.expectedClass === "hold") return "hold_exclusion_fixture";
  if (row.expectedClass === "manual_review") return "manual_review_needs_source";
  if (row.externalEvidence.length > 0) return "has_official_or_named_source";
  return "missing_required_spec_source";
}

function toRow(category: string, row: ImplementationCase): EvidenceGapRow {
  const status = evidenceStatus(row);
  return {
    category,
    caseId: row.caseId,
    expectedClass: row.expectedClass,
    inputTitle: row.inputTitle,
    identity: row.productIdentityTokens.join(", "),
    variants: row.variantTokens.join(", "),
    currentEvidenceCount: row.externalEvidence.length,
    evidenceStatus: status,
    requiredBeforeRuntime: status === "missing_required_spec_source" || status === "manual_review_needs_source",
    recommendedEvidence: status === "hold_exclusion_fixture" ? ["negative/exclusion fixture rationale is enough unless used for runtime positive policy"] : sourceHint(row),
    existingEvidence: row.externalEvidence,
    notes: row.notes,
  };
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const rows: EvidenceGapRow[] = [];

  for (const input of inputs) {
    const report = await readJson<PrepReport>(path.join(reportsDir, input.reportFile));
    for (const row of report.positiveTestCases ?? []) rows.push(toRow(input.category, row));
    for (const row of report.manualReviewTestCases ?? []) rows.push(toRow(input.category, row));
    for (const row of (report.negativeHoldTestCases ?? []).slice(0, 3)) rows.push(toRow(input.category, row));
  }

  const positiveRows = rows.filter((row) => row.expectedClass === "positive");
  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    scope: "Official/spec evidence gap report for top narrow review candidates",
    categories: inputs.map((input) => input.category),
    metrics: {
      rows: rows.length,
      positiveRows: positiveRows.length,
      positiveRowsWithEvidence: positiveRows.filter((row) => row.evidenceStatus === "has_official_or_named_source").length,
      positiveRowsMissingEvidence: positiveRows.filter((row) => row.evidenceStatus === "missing_required_spec_source").length,
      manualReviewRowsNeedingEvidence: rows.filter((row) => row.evidenceStatus === "manual_review_needs_source").length,
      holdRowsSampled: rows.filter((row) => row.evidenceStatus === "hold_exclusion_fixture").length,
      runtimeApprovedRows: 0,
    },
    rows,
    immediateEvidenceBackfillTargets: rows.filter((row) => row.requiredBeforeRuntime),
    policy: [
      "Existing externalEvidence in prep reports is treated as evidence pointer only, not runtime approval.",
      "Positive cases with missing spec evidence must be backfilled before any implementation review.",
      "Manual-review cases should not become positive cases without official/reliable spec confirmation.",
      "Hold cases stay negative/exclusion fixtures and are not evidence of public readiness.",
    ],
    doNotDo: [
      "Do not wire runtime parser/catalog policy from this report.",
      "Do not promote parser_candidate to public approval.",
      "Do not mutate Supabase, production DB, cron, lifecycle, source health, or pack UI.",
      "Do not edit 30일_실행계획.md from this subagent run.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "subagent-implementation-prep-spec-evidence-gap-latest.json"), JSON.stringify(report, null, 2));

  const tableRows = rows.map((row) => {
    const recommended = row.recommendedEvidence.join("; ");
    return `| ${row.category} | ${row.caseId} | ${row.expectedClass} | ${row.evidenceStatus} | ${row.currentEvidenceCount} | ${row.requiredBeforeRuntime ? "yes" : "no"} | ${recommended.replace(/\|/g, "/")} |`;
  });

  const missingRows = report.immediateEvidenceBackfillTargets.map((row) => `| ${row.category} | ${row.caseId} | ${row.inputTitle.replace(/\|/g, "/")} | ${row.recommendedEvidence.join("; ").replace(/\|/g, "/")} |`);

  const md = [
    "# Subagent Implementation Prep Spec Evidence Gap",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only official/spec evidence gap report for top narrow review candidates. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- rows: ${report.metrics.rows}`,
    `- positive rows: ${report.metrics.positiveRows}`,
    `- positive rows with evidence: ${report.metrics.positiveRowsWithEvidence}`,
    `- positive rows missing evidence: ${report.metrics.positiveRowsMissingEvidence}`,
    `- manual-review rows needing evidence: ${report.metrics.manualReviewRowsNeedingEvidence}`,
    `- hold rows sampled: ${report.metrics.holdRowsSampled}`,
    `- runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    "",
    "## Evidence Gap Table",
    "",
    "| category | case_id | expected | evidence_status | evidence_count | required_before_runtime | recommended_evidence |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
    ...tableRows,
    "",
    "## Immediate Evidence Backfill Targets",
    "",
    "| category | case_id | title | recommended evidence |",
    "| --- | --- | --- | --- |",
    ...missingRows,
    "",
    "## Policy",
    "",
    ...report.policy.map((item) => `- ${item}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "subagent-implementation-prep-spec-evidence-gap-latest.md"), `${md}\n`);
  console.log("wrote reports/subagent-implementation-prep-spec-evidence-gap-latest.json");
  console.log("wrote reports/subagent-implementation-prep-spec-evidence-gap-latest.md");
  console.log(`spec evidence gap: rows=${report.metrics.rows}, positive_missing=${report.metrics.positiveRowsMissingEvidence}, manual_needing=${report.metrics.manualReviewRowsNeedingEvidence}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
