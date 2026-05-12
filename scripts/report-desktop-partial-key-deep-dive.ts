import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Example = {
  pid?: string | number | null;
  title?: string;
  price?: number | null;
  key?: string | null;
};

type DesktopBlocker = {
  currentMetrics: {
    keyCounts: Array<{ key: string; count: number }>;
    gateCounts: Array<{ key: string; count: number }>;
  };
  reviewExamples: Example[];
};

const reportsDir = path.join(process.cwd(), "reports");

function classifyKey(key: string | null | undefined): string {
  if (!key) return "missing_key";
  if (key.includes("gaming-desktop-generic") || key.includes("office-desktop-generic")) return "generic_desktop";
  if (key.includes("unknown-cpu")) return "unknown_cpu";
  if (key.includes("unknown-gpu")) return "unknown_gpu";
  if (key.startsWith("apple-")) return "apple_desktop";
  return "complete_cpu_gpu";
}

async function main(): Promise<void> {
  const desktop = JSON.parse(await readFile(path.join(reportsDir, "desktop-full-unit-blockers-latest.json"), "utf8")) as DesktopBlocker;
  const keyClassCounts = new Map<string, number>();
  const exampleRows = desktop.reviewExamples.map((example) => {
    const keyClass = classifyKey(example.key);
    keyClassCounts.set(keyClass, (keyClassCounts.get(keyClass) ?? 0) + 1);
    return { ...example, keyClass };
  });

  const keyClassRows = [...keyClassCounts.entries()]
    .map(([keyClass, count]) => ({ keyClass, count }))
    .sort((a, b) => b.count - a.count || a.keyClass.localeCompare(b.keyClass));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "desktop_pc_discovered",
    purpose: "Break down desktop partial/generic keys without changing parser/runtime logic.",
    keyClassRows,
    exampleRows,
    sourceKeyCounts: desktop.currentMetrics.keyCounts,
    sourceGateCounts: desktop.currentMetrics.gateCounts,
    nextReportOnlyTasks: [
      "Confirm unknown-cpu rows have enough title text to propose parser tests later",
      "Keep unknown-gpu rows review-gated unless GPU is explicit",
      "Do not use generic gaming desktop as comparable key",
      "Separate commercial/multi/full-set gates before any main review",
    ],
    guardrails: [
      "No CPU/GPU parser change from this report",
      "No runtime catalog apply",
      "No candidate pool policy wiring",
      "No public promotion",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "desktop-partial-key-deep-dive-latest.json"), JSON.stringify(report, null, 2));

  const classTable = [
    "| key_class | count |",
    "| --- | --- |",
    ...keyClassRows.map((row) => `| ${row.keyClass} | ${row.count} |`),
  ].join("\n");

  const exampleTable = [
    "| key_class | pid | title | price | key |",
    "| --- | --- | --- | --- | --- |",
    ...exampleRows.map((row) =>
      `| ${row.keyClass} | ${row.pid ?? ""} | ${String(row.title ?? "").replace(/\|/g, "/")} | ${row.price ?? ""} | ${row.key ?? ""} |`,
    ),
  ].join("\n");

  const md = [
    "# Desktop Partial-Key Deep Dive",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only desktop partial/generic key diagnosis. This is not runtime wiring and not public promotion.",
    "",
    "## Key Classes",
    "",
    classTable,
    "",
    "## Examples",
    "",
    exampleTable,
    "",
    "## Next Report-Only Tasks",
    "",
    ...report.nextReportOnlyTasks.map((line) => `- ${line}`),
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "desktop-partial-key-deep-dive-latest.md"), `${md}\n`);
  console.log("wrote reports/desktop-partial-key-deep-dive-latest.json");
  console.log("wrote reports/desktop-partial-key-deep-dive-latest.md");
  console.log(`desktop partial-key deep dive: classes=${keyClassRows.length}, examples=${exampleRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
