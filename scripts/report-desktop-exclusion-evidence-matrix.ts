import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type DesktopRow = {
  pid?: string;
  title?: string;
  price?: number;
  key?: string | null;
  keyClass: string;
  reviewClass: string;
  hasCpuToken: boolean;
  hasGpuToken: boolean;
  action: string;
  testCandidateStatus: string;
  exclusionClass: string;
};

type DesktopExclusionReadiness = {
  category: string;
  rows: DesktopRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function gpuTokens(title: string): string[] {
  return [...title.matchAll(/\b(?:rtx|gtx|rx)\s?-?\d{3,5}\s?(?:ti|xt)?\b/gi)].map((match) =>
    match[0].replace(/\s+/g, "").toLowerCase(),
  );
}

function evidenceClass(row: DesktopRow): string {
  if (row.exclusionClass === "commercial_or_mining_risk") return "commercial_or_mining_hard_exclusion";
  if (row.hasGpuToken && !row.hasCpuToken) return "gpu_token_without_cpu_identity";
  return "desktop_exclusion_other";
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
    await readFile(path.join(reportsDir, "desktop-exclusion-readiness-latest.json"), "utf8"),
  ) as DesktopExclusionReadiness;

  const rows = readiness.rows.map((row) => {
    const title = row.title ?? "";
    const extractedGpuTokens = gpuTokens(title);
    return {
      ...row,
      evidenceClass: evidenceClass(row),
      extractedGpuTokens,
      missingCpuIdentity: !row.hasCpuToken,
      runtimeApproved: false,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: readiness.category,
    decision: "desktop_exclusion_evidence_report_only",
    sourceReports: ["desktop-exclusion-readiness-latest.json", "desktop-test-candidate-readiness-latest.json"],
    metrics: {
      matrixRows: rows.length,
      gpuOnlyRows: rows.filter((row) => row.evidenceClass === "gpu_token_without_cpu_identity").length,
      commercialOrMiningRows: rows.filter((row) => row.evidenceClass === "commercial_or_mining_hard_exclusion").length,
      positiveCandidateRows: 0,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      evidenceClassCounts: countBy(rows.map((row) => row.evidenceClass)),
      extractedGpuTokenCounts: countBy(rows.flatMap((row) => row.extractedGpuTokens)),
    },
    rows,
    policyImplications: [
      "GPU-only rows are negative evidence until CPU identity is present.",
      "Commercial/mining/위탁 rows remain hard exclusions for full-unit CPU/GPU candidates.",
      "This matrix does not design RAM/SSD/warranty/newness keys.",
      "No desktop exclusion evidence row is runtime approved.",
    ],
    nextReportOnlyExperiments: [
      "keep GPU-only examples as regression evidence for future parser tests",
      "compare full CPU+GPU rows only after main/manual review",
      "do not convert extracted GPU tokens into standalone comparable keys",
    ],
    doNotDo: [
      "Do not promote desktop_pc_discovered",
      "Do not wire CPU/GPU policy into candidate pool",
      "Do not add CPU/GPU parser rules from this report",
      "Do not treat GPU-only rows as comparable keys",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "desktop-exclusion-evidence-matrix-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | evidence_class | gpu_tokens | missing_cpu_identity | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.pid ?? "-"} | ${row.evidenceClass} | ${row.extractedGpuTokens.join(", ") || "-"} | ${row.missingCpuIdentity ? "yes" : "no"} | ${row.runtimeApproved ? "yes" : "no"} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Desktop Exclusion Evidence Matrix",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only desktop exclusion evidence matrix. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "desktop-exclusion-evidence-matrix-latest.md"), `${md}\n`);
  console.log("wrote reports/desktop-exclusion-evidence-matrix-latest.json");
  console.log("wrote reports/desktop-exclusion-evidence-matrix-latest.md");
  console.log(`desktop exclusion evidence matrix: gpu_only=${report.metrics.gpuOnlyRows}, commercial=${report.metrics.commercialOrMiningRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
