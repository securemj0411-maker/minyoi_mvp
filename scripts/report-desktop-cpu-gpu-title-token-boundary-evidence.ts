import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type DesktopCandidateRow = {
  pid?: string | number;
  title?: string;
  price?: number;
  key?: string | null;
  keyClass: string;
  testCandidateStatus: string;
};

type DesktopEvidence = {
  category: string;
  rows: DesktopCandidateRow[];
};

type TokenRow = DesktopCandidateRow & {
  cpuTitleToken: string | null;
  gpuTitleToken: string | null;
  cpuTokenClass: string;
  gpuTokenClass: string;
  keyMismatchClass: string;
  runtimeApproved: false;
};

const reportsDir = path.join(process.cwd(), "reports");

function cpuTitleToken(title: string): string | null {
  const patterns = [
    /\b(9800x3d|7800x3d)\b/i,
    /(울트라\s?5\s?225f|ultra\s?5\s?225f)/i,
    /\b(ultra\s?7\s?270k)\b/i,
    /\b(270k)\b/i,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return match[1].toLowerCase().replace(/\s+/g, "");
  }
  return null;
}

function gpuTitleToken(title: string): string | null {
  const patterns = [/\b(rtx\s?5080)\b/i, /\b(9070\s?xt)\b/i, /\b(rx\s?5700)\b/i, /\b(5080)\b/i];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return match[1].toLowerCase().replace(/\s+/g, "");
  }
  return null;
}

function cpuTokenClass(token: string | null): string {
  if (!token) return "missing_cpu_title_token";
  if (/9800x3d|7800x3d/.test(token)) return "known_ryzen_x3d_title_token";
  if (/울트라5225f|ultra5225f/.test(token)) return "known_core_ultra_5_title_token";
  if (token === "270k") return "ambiguous_intel_270k_title_token";
  if (/ultra7270k/.test(token)) return "known_core_ultra_7_title_token";
  return "unknown_cpu_title_token";
}

function gpuTokenClass(token: string | null): string {
  if (!token) return "missing_gpu_title_token";
  if (/rtx5080|5080/.test(token)) return "nvidia_rtx_5080_title_token";
  if (/9070xt/.test(token)) return "amd_radeon_9070xt_title_token";
  if (/rx5700/.test(token)) return "amd_radeon_rx5700_title_token";
  return "unknown_gpu_title_token";
}

function keyMismatchClass(row: DesktopCandidateRow, cpuToken: string | null, gpuToken: string | null): string {
  const key = row.key ?? "";
  if (row.keyClass === "generic_desktop" && cpuToken && gpuToken) return "generic_key_despite_cpu_gpu_title_tokens";
  if (row.keyClass === "unknown_gpu" && gpuToken) return "gpu_title_token_not_normalized_in_key";
  if (row.keyClass === "unknown_cpu" && cpuToken) return "cpu_title_token_not_normalized_in_key";
  if (row.keyClass === "unknown_cpu" && !cpuToken) return "gpu_only_key_missing_cpu_title_token";
  if (/unknown-gpu/.test(key) && gpuToken) return "unknown_gpu_key_with_gpu_title_token";
  if (/unknown-cpu/.test(key) && cpuToken) return "unknown_cpu_key_with_cpu_title_token";
  return "no_title_key_mismatch_detected";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const evidence = JSON.parse(
    await readFile(path.join(reportsDir, "desktop-test-candidate-token-evidence-latest.json"), "utf8"),
  ) as DesktopEvidence;

  const rows: TokenRow[] = evidence.rows.map((row) => {
    const title = row.title ?? "";
    const cpuToken = cpuTitleToken(title);
    const gpuToken = gpuTitleToken(title);
    return {
      ...row,
      cpuTitleToken: cpuToken,
      gpuTitleToken: gpuToken,
      cpuTokenClass: cpuTokenClass(cpuToken),
      gpuTokenClass: gpuTokenClass(gpuToken),
      keyMismatchClass: keyMismatchClass(row, cpuToken, gpuToken),
      runtimeApproved: false,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: evidence.category,
    decision: "desktop_cpu_gpu_title_token_boundary_report_only",
    sourceReports: ["desktop-test-candidate-token-evidence-latest.json", "desktop-test-candidate-readiness-latest.json"],
    metrics: {
      titleRows: rows.length,
      rowsWithCpuTitleToken: rows.filter((row) => row.cpuTitleToken).length,
      rowsWithGpuTitleToken: rows.filter((row) => row.gpuTitleToken).length,
      rowsWithBothTitleTokens: rows.filter((row) => row.cpuTitleToken && row.gpuTitleToken).length,
      ambiguousCpuTokenRows: rows.filter((row) => row.cpuTokenClass === "ambiguous_intel_270k_title_token").length,
      genericKeyDespiteTokensRows: rows.filter((row) => row.keyMismatchClass === "generic_key_despite_cpu_gpu_title_tokens").length,
      unresolvedKeyDespiteTitleTokenRows: rows.filter((row) => row.keyMismatchClass !== "no_title_key_mismatch_detected").length,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      cpuTokenClassCounts: countBy(rows.map((row) => row.cpuTokenClass)),
      gpuTokenClassCounts: countBy(rows.map((row) => row.gpuTokenClass)),
      keyMismatchClassCounts: countBy(rows.map((row) => row.keyMismatchClass)),
    },
    rows,
    policyImplications: [
      "Title tokens show potential parser improvement surface, not runtime approval.",
      "RTX 5080, RX 9070 XT, RX5700, Ryzen X3D, and Core Ultra title tokens remain report-only evidence.",
      "270K is ambiguous without an explicit Ultra/i7 prefix and must stay review-gated.",
      "generic_desktop with visible CPU/GPU tokens needs parser review, not candidate pool wiring.",
    ],
    nextReportOnlyExperiments: [
      "collect additional title-token examples for RTX 50-series and Radeon RX 9000-series",
      "separate ambiguous CPU shorthand such as 270K from explicit Core Ultra 7 270K",
      "compare title-token extraction against current comparable key generation without changing runtime parser",
    ],
    doNotDo: [
      "Do not promote desktop_pc_discovered",
      "Do not add CPU/GPU parser rules from this report",
      "Do not wire candidate pool policy from this report",
      "Do not treat title-token evidence as a ready comparable key",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "desktop-cpu-gpu-title-token-boundary-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | key_class | cpu_title_token | gpu_title_token | key_mismatch_class | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.pid ?? "-"} | ${row.keyClass} | ${row.cpuTitleToken ?? "-"} | ${row.gpuTitleToken ?? "-"} | ${row.keyMismatchClass} | no | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Desktop CPU/GPU Title Token Boundary Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only title-token boundary evidence for desktop CPU/GPU candidates. This is not runtime wiring and not public promotion.",
    "",
    `Rows with both title tokens: ${report.metrics.rowsWithBothTitleTokens}`,
    `Unresolved key despite title token rows: ${report.metrics.unresolvedKeyDespiteTitleTokenRows}`,
    `Runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
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

  await writeFile(path.join(reportsDir, "desktop-cpu-gpu-title-token-boundary-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/desktop-cpu-gpu-title-token-boundary-evidence-latest.json");
  console.log("wrote reports/desktop-cpu-gpu-title-token-boundary-evidence-latest.md");
  console.log(
    `desktop CPU/GPU title token boundary: both_tokens=${report.metrics.rowsWithBothTitleTokens}, unresolved_key=${report.metrics.unresolvedKeyDespiteTitleTokenRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
