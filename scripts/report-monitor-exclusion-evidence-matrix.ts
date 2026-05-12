import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type MonitorRow = {
  pid?: string;
  title?: string;
  price?: number;
  url?: string;
  comparableKey?: string;
  unknownParts?: string[];
  criticalUnknown?: string[];
  exclusionClass: string;
  action: string;
};

type MonitorExclusionReadiness = {
  category: string;
  metrics: {
    confirmedTestCandidates: number;
  };
  rows: MonitorRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function evidenceClass(row: MonitorRow): string {
  if (row.exclusionClass === "accessory_stand_arm" || row.exclusionClass === "parts_or_damaged") return "hard_exclusion_evidence";
  if (row.exclusionClass === "generic_monitor_no_model_code") return "generic_no_model_evidence";
  if (row.exclusionClass === "multi_or_bundle") return "bundle_boundary_evidence";
  return "review_gated_critical_unknown_evidence";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const readiness = JSON.parse(
    await readFile(path.join(reportsDir, "monitor-exclusion-readiness-latest.json"), "utf8"),
  ) as MonitorExclusionReadiness;

  const rows = readiness.rows.map((row) => {
    const unknownTokens = row.unknownParts ?? row.criticalUnknown ?? [];
    return {
      ...row,
      evidenceClass: evidenceClass(row),
      unknownTokenCount: unknownTokens.length,
      unknownTokens,
      runtimeApproved: false,
    };
  });
  const hardExclusionRows = rows.filter((row) => row.evidenceClass === "hard_exclusion_evidence");
  const reviewGatedRows = rows.filter((row) => row.action === "keep_review_gated");

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: readiness.category,
    decision: "monitor_exclusion_evidence_report_only",
    sourceReports: ["monitor-exclusion-readiness-latest.json", "monitor-test-candidate-readiness-latest.json"],
    metrics: {
      matrixRows: rows.length,
      hardExclusionRows: hardExclusionRows.length,
      reviewGatedRows: reviewGatedRows.length,
      confirmedTestCandidates: readiness.metrics.confirmedTestCandidates,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      evidenceClassCounts: countBy(rows.map((row) => row.evidenceClass)),
      unknownTokenCounts: countBy(rows.flatMap((row) => row.unknownTokens)),
    },
    rows,
    policyImplications: [
      "Hard exclusion evidence covers monitor arms/stands and parts/damaged rows only.",
      "Generic no-model rows remain useful negative evidence but cannot become model-code candidates.",
      "Critical unknown model-code rows stay review-gated until manual confirmation.",
      "Confirmed monitor test candidates remain zero.",
    ],
    nextReportOnlyExperiments: [
      "reuse hard exclusion evidence in manual review docs only",
      "collect external/manual model confirmation before any positive monitor candidate report",
      "do not infer public readiness from generic no-model or critical-unknown evidence",
    ],
    doNotDo: [
      "Do not public-promote monitor_discovered",
      "Do not wire model-code policy into candidate pool",
      "Do not add monitor hints to runtime catalog",
      "Do not treat review-gated rows as confirmed test candidates",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "monitor-exclusion-evidence-matrix-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | exclusion_class | evidence_class | action | unknown_tokens | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.pid ?? "-"} | ${row.exclusionClass} | ${row.evidenceClass} | ${row.action} | ${row.unknownTokens.join(", ") || "-"} | ${row.runtimeApproved ? "yes" : "no"} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Monitor Exclusion Evidence Matrix",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only monitor exclusion evidence matrix. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "monitor-exclusion-evidence-matrix-latest.md"), `${md}\n`);
  console.log("wrote reports/monitor-exclusion-evidence-matrix-latest.json");
  console.log("wrote reports/monitor-exclusion-evidence-matrix-latest.md");
  console.log(`monitor exclusion evidence matrix: rows=${rows.length}, hard_exclusion=${hardExclusionRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
