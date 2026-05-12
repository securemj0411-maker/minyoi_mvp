import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type SmartwatchBlockers = {
  category: string;
  currentMetrics: {
    parserReadyRate: number;
    needsReviewRate: number;
    strapSuspect: number;
    unknownNetworkRate: number;
    skuCounts: CountRow[];
    sizeCounts: CountRow[];
    networkCounts: CountRow[];
  };
  reviewExamples: Array<{ pid?: string; title?: string; price?: number; reason?: string }>;
};

const reportsDir = path.join(process.cwd(), "reports");

function ambiguityClass(title: string): string {
  const normalized = title.toLowerCase().replace(/\s+/g, "");
  if (/se(?:2|2세대|3|3세대)/i.test(normalized)) return "se_generation_explicit_but_review_gated";
  if (/se/.test(normalized)) return "se_generation_ambiguous";
  return "matched_sku_needs_review";
}

async function main(): Promise<void> {
  const blockers = JSON.parse(
    await readFile(path.join(reportsDir, "smartwatch-ambiguity-blockers-latest.json"), "utf8"),
  ) as SmartwatchBlockers;

  const reviewRows = blockers.reviewExamples.map((row) => ({
    ...row,
    evidenceClass: ambiguityClass(row.title ?? ""),
    runtimeApproved: false,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: blockers.category,
    decision: "smartwatch_ambiguity_evidence_report_only",
    sourceReports: ["smartwatch-ambiguity-blockers-latest.json", "smartwatch-parser-latest.json"],
    metrics: {
      parserReadyRate: blockers.currentMetrics.parserReadyRate,
      needsReviewRate: blockers.currentMetrics.needsReviewRate,
      reviewRows: reviewRows.length,
      strapSuspectRows: blockers.currentMetrics.strapSuspect,
      unknownNetworkRate: blockers.currentMetrics.unknownNetworkRate,
      runtimeApprovedRows: reviewRows.filter((row) => row.runtimeApproved).length,
      topSkuCounts: blockers.currentMetrics.skuCounts.slice(0, 8),
      sizeCounts: blockers.currentMetrics.sizeCounts,
      networkCounts: blockers.currentMetrics.networkCounts,
    },
    reviewRows,
    policyImplications: [
      "Smartwatch parser-ready rate is high only inside matched normal rows.",
      "SE generation, size, and network still need explicit evidence before promotion.",
      "Strap/accessory pressure remains high and must stay outside body candidates.",
      "No smartwatch runtime or candidate pool wiring is approved here.",
    ],
    nextReportOnlyExperiments: [
      "split strap/accessory suspects into exclusion-only evidence if source rows are available",
      "rank unknown connectivity keys by SKU and size",
      "keep SE generation explicitness as manual review evidence only",
    ],
    doNotDo: [
      "Do not promote smartwatch_discovered",
      "Do not approve strap/accessory rows",
      "Do not infer SE generation without explicit text",
      "Do not wire unknown connectivity rows into candidate pool",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-ambiguity-evidence-matrix-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | evidence_class | runtime_approved | title |",
    "| --- | --- | --- | --- |",
    ...reviewRows.map((row) => `| ${row.pid ?? "-"} | ${row.evidenceClass} | ${row.runtimeApproved ? "yes" : "no"} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Smartwatch Ambiguity Evidence Matrix",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only smartwatch ambiguity evidence matrix. This is not runtime wiring and not public promotion.",
    "",
    table,
    "",
    "## Policy Implications",
    "",
    ...report.policyImplications.map((line) => `- ${line}`),
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "smartwatch-ambiguity-evidence-matrix-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-ambiguity-evidence-matrix-latest.json");
  console.log("wrote reports/smartwatch-ambiguity-evidence-matrix-latest.md");
  console.log(
    `smartwatch ambiguity evidence matrix: review_rows=${reviewRows.length}, strap_suspect=${report.metrics.strapSuspectRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
