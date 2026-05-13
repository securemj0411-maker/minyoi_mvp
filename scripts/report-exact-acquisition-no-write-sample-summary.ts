import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type SampleReport = {
  generatedAt: string;
  taskFilter: string;
  counts?: Record<string, number>;
  byTask?: Array<{
    taskId: string;
    category: string;
    queries: number;
    fetched: number;
    clean: number;
    aiL2OrManual: number;
    hold: number;
  }>;
  rows?: Array<{
    taskId: string;
    decision: string;
    pid: string;
    title: string;
    skuId: string | null;
    comparableKey: string | null;
    reasons: string[];
  }>;
};

const root = process.cwd();
const reportDir = path.join(root, "reports");

const inputs = [
  {
    label: "monitor_exact_model_code_wave1",
    file: "exact-acquisition-no-write-sample-monitor-latest.json",
    nextDecision: "Proceed to tiny no-write detail verification for exact model-code rows only; keep broad monitor blocked.",
  },
  {
    label: "lg_gram_17_2024_query_repair_wave1",
    file: "exact-acquisition-no-write-sample-lg_gram_17_2024_query_repair_wave1-latest.json",
    nextDecision: "Do not write DB yet. Treat exact LG Gram rows as parser/catalog or AI L2 candidates because search finds plausible rows but comparable keys are missing.",
  },
  {
    label: "ipad_pro_13_m2_exact_wifi_wave1",
    file: "exact-acquisition-no-write-sample-ipad_pro_13_m2_exact_wifi_wave1-latest.json",
    nextDecision: "Proceed only after query/generation guard refinement; 6th-gen/M2 rows exist but 4th/5th/cellular/Air pollution remains high.",
  },
];

function readJson<T>(relativeFile: string): T | null {
  const file = path.join(reportDir, relativeFile);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function percent(part: number, total: number) {
  if (total <= 0) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

const rows = inputs.map((input) => {
  const report = readJson<SampleReport>(input.file);
  const task = report?.byTask?.[0] ?? {
    taskId: input.label,
    category: "unknown",
    queries: 0,
    fetched: 0,
    clean: 0,
    aiL2OrManual: 0,
    hold: 0,
  };
  const topReasons = new Map<string, number>();
  for (const row of report?.rows ?? []) {
    for (const reason of row.reasons) topReasons.set(reason, (topReasons.get(reason) ?? 0) + 1);
  }
  return {
    label: input.label,
    sourceFile: `reports/${input.file}`,
    generatedAt: report?.generatedAt ?? null,
    taskId: task.taskId,
    category: task.category,
    queries: task.queries,
    fetched: task.fetched,
    clean: task.clean,
    cleanRate: percent(task.clean, task.fetched),
    aiL2OrManual: task.aiL2OrManual,
    aiL2OrManualRate: percent(task.aiL2OrManual, task.fetched),
    hold: task.hold,
    holdRate: percent(task.hold, task.fetched),
    topReasons: [...topReasons.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([reason, count]) => ({ reason, count })),
    nextDecision: input.nextDecision,
  };
});

const output = {
  generatedAt: new Date().toISOString(),
  scope: "report_only_no_write_sample_summary",
  runtimeMutation: false,
  supabaseMutation: false,
  publicPromotion: false,
  rows,
  conclusion:
    "Monitor exact model-code is the strongest next no-write detail lane. iPad Pro 13 M2 has usable clean rows but needs stricter generation/query filtering. LG Gram exact search finds plausible rows, but runtime/catalog parsing is not ready enough for acquisition.",
};

const md = [
  "# Exact Acquisition No-Write Sample Summary",
  "",
  `- generatedAt: ${output.generatedAt}`,
  `- scope: ${output.scope}`,
  "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
  "",
  "## Summary",
  "",
  "| lane | fetched | clean | AI/manual | hold | next |",
  "| --- | ---: | ---: | ---: | ---: | --- |",
  ...rows.map(
    (row) =>
      `| ${row.label} | ${row.fetched} | ${row.clean} (${row.cleanRate}) | ${row.aiL2OrManual} (${row.aiL2OrManualRate}) | ${row.hold} (${row.holdRate}) | ${row.nextDecision} |`,
  ),
  "",
  "## Top Reasons",
  "",
  ...rows.flatMap((row) => [
    `### ${row.label}`,
    "",
    ...row.topReasons.map((reason) => `- ${reason.reason}: ${reason.count}`),
    "",
  ]),
  "## Conclusion",
  "",
  `- ${output.conclusion}`,
  "",
].join("\n");

writeFileSync(path.join(reportDir, "exact-acquisition-no-write-sample-summary-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(path.join(reportDir, "exact-acquisition-no-write-sample-summary-latest.md"), md);

console.log("wrote reports/exact-acquisition-no-write-sample-summary-latest.json");
console.log("wrote reports/exact-acquisition-no-write-sample-summary-latest.md");
console.log(JSON.stringify({ rows: rows.length, conclusion: output.conclusion }));
