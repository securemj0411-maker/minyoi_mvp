import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type MonitorExample = {
  pid?: string;
  title?: string;
  price?: number;
  url?: string;
  comparableKey?: string;
};

type MonitorBlockers = {
  category: string;
  genericExamples: MonitorExample[];
  criticalExamples: MonitorExample[];
};

const reportsDir = path.join(process.cwd(), "reports");

function exclusionClass(example: MonitorExample): string {
  const title = example.title ?? "";
  if (/거치대|모니터암|스탠드|마운트/i.test(title)) return "accessory_stand_arm";
  if (/부품용|부품/i.test(title)) return "parts_or_damaged";
  if (/듀얼/i.test(title)) return "multi_or_bundle";
  if (/generic_monitor/.test(example.comparableKey ?? "")) return "generic_monitor_no_model_code";
  return "critical_unknown_model_code_row";
}

function dedupe(rows: MonitorExample[]): MonitorExample[] {
  const seen = new Set<string>();
  const result: MonitorExample[] = [];
  for (const row of rows) {
    const key = row.pid ?? `${row.title}-${row.comparableKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const blockers = JSON.parse(
    await readFile(path.join(reportsDir, "monitor-model-code-blockers-latest.json"), "utf8"),
  ) as MonitorBlockers;

  const sourceRows = dedupe([...blockers.genericExamples, ...blockers.criticalExamples]);
  const rows = sourceRows.map((row) => ({
    ...row,
    exclusionClass: exclusionClass(row),
    action: exclusionClass(row) === "critical_unknown_model_code_row" ? "keep_review_gated" : "exclusion_test_candidate_only",
  }));
  const exclusionRows = rows.filter((row) => row.action === "exclusion_test_candidate_only");

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: blockers.category,
    decision: "exclusion_candidate_only_report_no_wiring",
    sourceReports: ["monitor-model-code-blockers-latest.json", "monitor-test-candidate-readiness-latest.json"],
    metrics: {
      sourceRows: rows.length,
      exclusionCandidateOnlyRows: exclusionRows.length,
      reviewGatedRows: rows.length - exclusionRows.length,
      confirmedTestCandidates: 0,
      exclusionClassCounts: countBy(rows.map((row) => row.exclusionClass)),
    },
    rows,
    policyImplications: [
      "Accessory/stand/arm and parts rows are exclusion-test candidates only.",
      "Generic monitor rows without model code remain outside model-code candidate policy.",
      "Critical unknown model-code rows stay review-gated unless manually confirmed.",
      "Monitor confirmed test candidates remain zero in this subagent scope.",
    ],
    nextReportOnlyExperiments: [
      "expand monitor exclusion rows from gateExamples if needed",
      "wait for manual confirmation before creating positive monitor test candidates",
      "do not add model-code runtime rules from this report",
    ],
    doNotDo: [
      "Do not public-promote monitor_discovered",
      "Do not wire model-code policy into candidate pool",
      "Do not add monitor hints to runtime catalog",
      "Do not treat exclusion rows as positive candidates",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "monitor-exclusion-readiness-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | exclusion_class | action | title |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.pid ?? "-"} | ${row.exclusionClass} | ${row.action} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Monitor Exclusion Readiness",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only monitor exclusion readiness. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "monitor-exclusion-readiness-latest.md"), `${md}\n`);
  console.log("wrote reports/monitor-exclusion-readiness-latest.json");
  console.log("wrote reports/monitor-exclusion-readiness-latest.md");
  console.log(`monitor exclusion readiness: exclusion_candidate_only=${exclusionRows.length}, confirmed_test_candidates=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
