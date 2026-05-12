import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ExampleRow = {
  pid?: string | number;
  title?: string;
  price?: number;
  url?: string;
  comparableKey?: string;
  criticalUnknown?: string[];
  unknownParts?: string[];
};

type PendingRow = {
  hint: string;
  count: number;
  reviewClass: string;
  action: string;
  examples: ExampleRow[];
  testCandidateStatus: string;
  confirmedBySubagent: boolean;
};

type MonitorReadiness = {
  category: string;
  metrics: {
    confirmedTestCandidates: number;
    pendingManualConfirmation: number;
    excludedBeforeTestCandidate: number;
  };
  pendingRows: PendingRow[];
  excludedRows: PendingRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function tokenClass(tokens: string[]): string {
  const hasResolution = tokens.includes("unknown_resolution");
  const hasRefresh = tokens.includes("unknown_refresh");
  const hasScreen = tokens.includes("unknown_screen");
  if (hasScreen && hasResolution && hasRefresh) return "screen_resolution_refresh_unknown";
  if (hasResolution && hasRefresh) return "resolution_refresh_unknown";
  if (hasResolution) return "resolution_unknown";
  if (hasRefresh) return "refresh_unknown";
  return "non_critical_unknown_or_complete";
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
    await readFile(path.join(reportsDir, "monitor-test-candidate-readiness-latest.json"), "utf8"),
  ) as MonitorReadiness;

  const rows = readiness.pendingRows.map((row) => {
    const example = row.examples[0] ?? {};
    const criticalUnknown = example.criticalUnknown ?? example.unknownParts ?? [];
    return {
      hint: row.hint,
      count: row.count,
      pid: example.pid ?? null,
      title: example.title ?? "",
      price: example.price ?? null,
      url: example.url ?? null,
      comparableKey: example.comparableKey ?? null,
      criticalUnknown,
      tokenClass: tokenClass(criticalUnknown),
      evidenceClass: "pending_model_code_critical_unknown_evidence",
      testCandidateStatus: row.testCandidateStatus,
      confirmedBySubagent: false,
      runtimeApproved: false,
      reportOnlyAction: "manual confirmation required before any test-candidate-only report",
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: readiness.category,
    decision: "pending_model_code_evidence_report_only",
    sourceReports: ["monitor-test-candidate-readiness-latest.json", "monitor-exclusion-evidence-matrix-latest.json"],
    metrics: {
      pendingRows: rows.length,
      confirmedTestCandidates: readiness.metrics.confirmedTestCandidates,
      excludedBeforeTestCandidate: readiness.metrics.excludedBeforeTestCandidate,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      criticalUnknownRows: rows.filter((row) => row.criticalUnknown.length > 0).length,
      tokenClassCounts: countBy(rows.map((row) => row.tokenClass)),
      criticalUnknownCounts: countBy(rows.flatMap((row) => row.criticalUnknown)),
    },
    rows,
    policyImplications: [
      "Pending model-code hints remain evidence rows only, not confirmed test candidates.",
      "ct2210ips and u2412mb both retain critical unknown fields that block automatic readiness.",
      "No monitor hint should be added to runtime catalog from this report.",
      "Confirmed monitor test candidates remain zero.",
    ],
    nextReportOnlyExperiments: [
      "collect manual/external confirmation before moving any pending hint into a test-candidate-only report",
      "keep unknown resolution and refresh fields visible in monitor review docs",
      "do not infer readiness from model-code-looking tokens alone",
    ],
    doNotDo: [
      "Do not public-promote monitor_discovered",
      "Do not wire model-code policy into candidate pool",
      "Do not add monitor hints to runtime catalog",
      "Do not treat pending rows as confirmed test candidates",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "monitor-pending-model-code-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| hint | pid | token_class | critical_unknown | status | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => (
      `| ${row.hint} | ${row.pid ?? "-"} | ${row.tokenClass} | ${row.criticalUnknown.join(", ") || "-"} | ${row.testCandidateStatus} | no | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`
    )),
  ].join("\n");

  const md = [
    "# Monitor Pending Model-Code Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only monitor pending model-code evidence. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- pending rows: ${report.metrics.pendingRows}`,
    `- confirmed test candidates: ${report.metrics.confirmedTestCandidates}`,
    `- critical unknown rows: ${report.metrics.criticalUnknownRows}`,
    "",
    "## Evidence Rows",
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

  await writeFile(path.join(reportsDir, "monitor-pending-model-code-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/monitor-pending-model-code-evidence-latest.json");
  console.log("wrote reports/monitor-pending-model-code-evidence-latest.md");
  console.log(`monitor pending model-code evidence: pending=${rows.length}, confirmed=0, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
