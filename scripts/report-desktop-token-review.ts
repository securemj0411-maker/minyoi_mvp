import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ExampleRow = {
  pid?: string;
  title?: string;
  price?: number;
  key?: string | null;
  keyClass: string;
};

type DesktopPartialDeepDive = {
  category: string;
  exampleRows: ExampleRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function hasGpuToken(title: string): boolean {
  return (
    /\b(rtx|gtx|rx)\s?\d{3,4}\s?(ti|xt)?\b/i.test(title) ||
    /\b(30[56789]0|40[56789]0|50[6789]0|90[0-9]{2})\s?(ti|xt)?\b/i.test(title)
  );
}

function hasCpuToken(title: string): boolean {
  return /\b(ryzen|i[3579]|ultra\s?[3579]|7800x3d|9800x3d|270k|225f)\b/i.test(title);
}

function reviewClass(row: ExampleRow): string {
  const title = row.title ?? "";
  if (/위탁|월\s?\d+만|노드|채굴|임대/i.test(title)) return "hold_commercial_or_mining_risk";
  if (hasCpuToken(title) && hasGpuToken(title)) return "reviewable_cpu_gpu_tokens";
  if (!hasCpuToken(title) && hasGpuToken(title)) return "gpu_only_missing_cpu";
  if (hasCpuToken(title) && !hasGpuToken(title)) return "cpu_only_missing_gpu";
  if (row.keyClass === "generic_desktop") return "hold_generic_desktop";
  return "missing_cpu_gpu_tokens";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const deepDive = JSON.parse(
    await readFile(path.join(reportsDir, "desktop-partial-key-deep-dive-latest.json"), "utf8"),
  ) as DesktopPartialDeepDive;

  const rows = deepDive.exampleRows.map((row) => {
    const title = row.title ?? "";
    const klass = reviewClass(row);
    return {
      ...row,
      reviewClass: klass,
      hasCpuToken: hasCpuToken(title),
      hasGpuToken: hasGpuToken(title),
      action:
        klass === "reviewable_cpu_gpu_tokens"
          ? "manual_review_before_test_candidate"
          : klass.startsWith("hold_")
            ? "exclude_from_cpu_gpu_candidate"
            : "keep_review_gated_until_missing_side_resolved",
    };
  });
  const classCounts = countBy(rows.map((row) => row.reviewClass));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: deepDive.category,
    decision: "hold_report_only_review_list",
    sourceReports: ["desktop-partial-key-deep-dive-latest.json", "desktop-full-unit-blockers-latest.json"],
    metrics: {
      reviewRows: rows.length,
      classCounts,
    },
    rows,
    policyImplications: [
      "Rows with both CPU and GPU title tokens can only become test candidates after manual review.",
      "GPU-only rows must remain review-gated because comparable key lacks CPU identity.",
      "Commercial/mining/ 위탁 rows must not enter full-unit candidate policy.",
      "No RAM/SSD/warranty/newness runtime key is designed by this report.",
    ],
    nextReportOnlyExperiments: [
      "collect reviewable_cpu_gpu_tokens into a test-candidate-only list",
      "separate GPU-only 50-series rows from missing CPU examples",
      "produce exclusion examples for commercial/mining/ 위탁 desktop rows",
    ],
    doNotDo: [
      "Do not promote desktop_pc_discovered",
      "Do not wire CPU/GPU policy into candidate pool",
      "Do not add CPU/GPU parser rules from this report",
      "Do not treat GPU-only rows as comparable keys",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "desktop-token-review-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | key_class | cpu_token | gpu_token | review_class | action | title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => {
      const title = row.title?.replace(/\|/g, "\\|") ?? "-";
      return `| ${row.pid ?? "-"} | ${row.keyClass} | ${row.hasCpuToken ? "yes" : "no"} | ${row.hasGpuToken ? "yes" : "no"} | ${row.reviewClass} | ${row.action} | ${title} |`;
    }),
  ].join("\n");

  const md = [
    "# Desktop Token Review",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only desktop unknown CPU/GPU token review. This is not runtime wiring and not public promotion.",
    "",
    "## Rows",
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

  await writeFile(path.join(reportsDir, "desktop-token-review-latest.md"), `${md}\n`);
  console.log("wrote reports/desktop-token-review-latest.json");
  console.log("wrote reports/desktop-token-review-latest.md");
  console.log(`desktop token review: rows=${rows.length}, classes=${classCounts.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
