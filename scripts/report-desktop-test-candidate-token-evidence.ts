import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type DesktopCandidateRow = {
  pid?: string | number;
  title?: string;
  price?: number;
  key?: string | null;
  keyClass: string;
  reviewClass: string;
  hasCpuToken: boolean;
  hasGpuToken: boolean;
  action: string;
  testCandidateStatus: string;
};

type DesktopReadiness = {
  category: string;
  metrics: {
    reviewRows: number;
    testCandidateOnlyRows: number;
    holdOrExcludedRows: number;
    runtimeApprovedRows: number;
  };
  testCandidateRows: DesktopCandidateRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function tokenEvidenceClass(row: DesktopCandidateRow): string {
  if (row.keyClass === "unknown_cpu") return "gpu_known_cpu_unresolved_review_evidence";
  if (row.keyClass === "unknown_gpu") return "cpu_known_gpu_unresolved_review_evidence";
  if (row.keyClass === "generic_desktop") return "generic_desktop_review_evidence";
  return "cpu_gpu_token_review_evidence";
}

function cpuFamily(row: DesktopCandidateRow): string {
  const text = `${row.title ?? ""} ${row.key ?? ""}`.toLowerCase();
  if (/9800x3d|7800x3d|ryzen/.test(text)) return "ryzen_x3d_or_ryzen";
  if (/ultra|225f|270k|intel|i[3579]/.test(text)) return "intel_or_core_ultra";
  if (/unknown-cpu/.test(text)) return "unknown_cpu";
  return "generic_or_missing_cpu_family";
}

function gpuFamily(row: DesktopCandidateRow): string {
  const text = `${row.title ?? ""} ${row.key ?? ""}`.toLowerCase();
  if (/rtx[-\s]?50|5080|5070|5060/.test(text)) return "nvidia_rtx_50_series";
  if (/rtx[-\s]?30|3080|3060/.test(text)) return "nvidia_rtx_30_series";
  if (/rx\s?9|9070|rx5700|rx\s?5700/.test(text)) return "amd_radeon_rx";
  if (/unknown-gpu/.test(text)) return "unknown_gpu";
  return "generic_or_missing_gpu_family";
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
    await readFile(path.join(reportsDir, "desktop-test-candidate-readiness-latest.json"), "utf8"),
  ) as DesktopReadiness;

  const rows = readiness.testCandidateRows.map((row) => ({
    ...row,
    cpuFamily: cpuFamily(row),
    gpuFamily: gpuFamily(row),
    evidenceClass: tokenEvidenceClass(row),
    runtimeApproved: false,
    reportOnlyAction: "pending main/manual review before any parser or policy action",
  }));

  const unresolvedRows = rows.filter((row) => row.keyClass === "unknown_cpu" || row.keyClass === "unknown_gpu");

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: readiness.category,
    decision: "desktop_test_candidate_token_evidence_report_only",
    sourceReports: ["desktop-test-candidate-readiness-latest.json", "desktop-token-review-latest.json"],
    metrics: {
      testCandidateOnlyRows: readiness.metrics.testCandidateOnlyRows,
      holdOrExcludedRows: readiness.metrics.holdOrExcludedRows,
      evidenceRows: rows.length,
      unresolvedCpuOrGpuRows: unresolvedRows.length,
      genericDesktopRows: rows.filter((row) => row.keyClass === "generic_desktop").length,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      keyClassCounts: countBy(rows.map((row) => row.keyClass)),
      cpuFamilyCounts: countBy(rows.map((row) => row.cpuFamily)),
      gpuFamilyCounts: countBy(rows.map((row) => row.gpuFamily)),
      evidenceClassCounts: countBy(rows.map((row) => row.evidenceClass)),
    },
    rows,
    policyImplications: [
      "Desktop test-candidate rows remain pending main/manual review only.",
      "Unknown CPU and unknown GPU keys are review evidence, not ready comparable keys.",
      "Generic desktop rows must not become comparable keys without a concrete CPU/GPU identity.",
      "No CPU/GPU parser rule or candidate pool wiring is approved here.",
    ],
    nextReportOnlyExperiments: [
      "keep unresolved CPU/GPU examples as positive-test review inputs only",
      "separate RTX 50-series, Radeon RX, Ryzen X3D, and Intel/Core Ultra evidence without runtime changes",
      "do not design RAM/SSD/warranty/newness runtime keys from this report",
    ],
    doNotDo: [
      "Do not promote desktop_pc_discovered",
      "Do not wire CPU/GPU policy into candidate pool",
      "Do not add CPU/GPU parser rules from this report",
      "Do not treat unknown-cpu or unknown-gpu rows as ready",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "desktop-test-candidate-token-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | key_class | cpu_family | gpu_family | evidence_class | status | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => (
      `| ${row.pid ?? "-"} | ${row.keyClass} | ${row.cpuFamily} | ${row.gpuFamily} | ${row.evidenceClass} | ${row.testCandidateStatus} | no | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`
    )),
  ].join("\n");

  const md = [
    "# Desktop Test-Candidate Token Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only desktop test-candidate token evidence. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- evidence rows: ${report.metrics.evidenceRows}`,
    `- unresolved CPU/GPU rows: ${report.metrics.unresolvedCpuOrGpuRows}`,
    `- generic desktop rows: ${report.metrics.genericDesktopRows}`,
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

  await writeFile(path.join(reportsDir, "desktop-test-candidate-token-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/desktop-test-candidate-token-evidence-latest.json");
  console.log("wrote reports/desktop-test-candidate-token-evidence-latest.md");
  console.log(`desktop test-candidate token evidence: rows=${rows.length}, unresolved=${unresolvedRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
