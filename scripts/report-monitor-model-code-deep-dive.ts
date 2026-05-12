import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Example = {
  pid?: string | number | null;
  title?: string;
  price?: number | null;
  comparableKey?: string;
  unknownParts?: string[];
  criticalUnknown?: string[];
};

type MonitorBlocker = {
  currentMetrics: {
    unknownParts: Array<{ key: string; count: number }>;
    topComparableKeys: Array<{ key: string; count: number }>;
  };
  genericExamples: Example[];
  criticalExamples: Example[];
};

const reportsDir = path.join(process.cwd(), "reports");

function reasonFor(example: Example): string {
  const title = example.title ?? "";
  if (/모니터암|거치대|스탠드|받침대|브라켓/i.test(title)) return "accessory_or_stand";
  if (/부품용|파손|고장|불량|줄|멍|번인/i.test(title)) return "damaged_or_parts";
  if (/듀얼|2대|일괄|세트/i.test(title)) return "multi_or_bundle";
  if (!example.comparableKey || example.comparableKey.includes("generic_monitor")) return "generic_no_model_code";
  if ((example.criticalUnknown ?? []).length > 0) return `critical_unknown:${example.criticalUnknown?.join("+")}`;
  return "review";
}

function hintCandidate(example: Example): string | null {
  const title = example.title ?? "";
  const match = title.match(/\b([A-Z]{1,4}[-\s]?[A-Z0-9]{2,8}[A-Z0-9])\b/i);
  if (!match) return null;
  const code = match[1].replace(/\s+/g, "").toLowerCase();
  if (/^(oled|uwqhd|qhd|fhd|uhd|ips|hdr|usb|hdmi|dp)$/i.test(code)) return null;
  return code;
}

async function main(): Promise<void> {
  const monitor = JSON.parse(await readFile(path.join(reportsDir, "monitor-model-code-blockers-latest.json"), "utf8")) as MonitorBlocker;
  const allExamples = [
    ...monitor.genericExamples.map((example) => ({ ...example, source: "genericExamples" })),
    ...monitor.criticalExamples.map((example) => ({ ...example, source: "criticalExamples" })),
  ];

  const reasonCounts = new Map<string, number>();
  const hintCandidates = new Map<string, { count: number; examples: Example[] }>();

  for (const example of allExamples) {
    const reason = reasonFor(example);
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    const hint = hintCandidate(example);
    if (hint) {
      const entry = hintCandidates.get(hint) ?? { count: 0, examples: [] };
      entry.count += 1;
      if (entry.examples.length < 3) entry.examples.push(example);
      hintCandidates.set(hint, entry);
    }
  }

  const hintRows = [...hintCandidates.entries()]
    .map(([hint, value]) => ({ hint, count: value.count, examples: value.examples }))
    .sort((a, b) => b.count - a.count || a.hint.localeCompare(b.hint));

  const reasonRows = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "monitor_discovered",
    purpose: "Break down model-code candidate blockers without adding runtime rules.",
    reasonRows,
    hintRows,
    unknownParts: monitor.currentMetrics.unknownParts,
    topComparableKeys: monitor.currentMetrics.topComparableKeys,
    nextReportOnlyTasks: [
      "Review hintRows manually before any parser/catalog change",
      "Keep accessory_or_stand and damaged_or_parts examples out of model-code policy",
      "Only propose tests after a hint is confirmed as a real model code",
    ],
    guardrails: [
      "No model hint is approved by this report",
      "No runtime catalog apply",
      "No candidate pool policy wiring",
      "No public promotion",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "monitor-model-code-deep-dive-latest.json"), JSON.stringify(report, null, 2));

  const reasonTable = [
    "| reason | count |",
    "| --- | --- |",
    ...reasonRows.map((row) => `| ${row.reason} | ${row.count} |`),
  ].join("\n");

  const hintTable = [
    "| hint_candidate | count | example_titles |",
    "| --- | --- | --- |",
    ...hintRows.map((row) => `| ${row.hint} | ${row.count} | ${row.examples.map((example) => String(example.title ?? "").replace(/\|/g, "/")).join("<br>")} |`),
  ].join("\n");

  const md = [
    "# Monitor Model-Code Deep Dive",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only deep dive. This does not approve model hints, runtime catalog changes, or pool wiring.",
    "",
    "## Reason Counts",
    "",
    reasonTable,
    "",
    "## Hint Candidates",
    "",
    hintTable,
    "",
    "## Next Report-Only Tasks",
    "",
    ...report.nextReportOnlyTasks.map((line) => `- ${line}`),
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "monitor-model-code-deep-dive-latest.md"), `${md}\n`);
  console.log("wrote reports/monitor-model-code-deep-dive-latest.json");
  console.log("wrote reports/monitor-model-code-deep-dive-latest.md");
  console.log(`monitor deep dive: reasons=${reasonRows.length}, hints=${hintRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
