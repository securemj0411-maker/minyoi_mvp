import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type AnyReport = Record<string, unknown>;

const reportsDir = path.join(process.cwd(), "reports");

const sources = [
  {
    category: "monitor_discovered",
    file: "monitor-model-code-blockers-latest.json",
    fields: ["genericExamples", "criticalExamples"],
  },
  {
    category: "desktop_pc_discovered",
    file: "desktop-full-unit-blockers-latest.json",
    fields: ["reviewExamples"],
  },
  {
    category: "game_console_body_narrow",
    file: "game-console-body-blockers-latest.json",
    fields: [],
  },
  {
    category: "game_console_discovered",
    file: "game-console-contamination-blockers-latest.json",
    fields: [],
  },
  {
    category: "camera_discovered",
    file: "camera-package-blockers-latest.json",
    fields: ["examplesByPackage"],
  },
  {
    category: "smartwatch_discovered",
    file: "smartwatch-ambiguity-blockers-latest.json",
    fields: ["reviewExamples"],
  },
  {
    category: "speaker_audio_discovered",
    file: "speaker-family-blockers-latest.json",
    fields: ["genericExamples"],
  },
  {
    category: "home_appliance_tech_discovered",
    file: "home-appliance-blockers-latest.json",
    fields: ["genericExamples"],
  },
  {
    category: "headphone_discovered",
    file: "headphone-matched-sku-blockers-latest.json",
    fields: ["unknownGenerationExamples", "unknownConnectorExamples", "unknownSkuExamples"],
  },
];

function countExamples(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).reduce<number>((sum, nested) => sum + countExamples(nested), 0);
  }
  return 0;
}

async function readJson(file: string): Promise<AnyReport> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as AnyReport;
}

async function main(): Promise<void> {
  const rows = [];

  for (const source of sources) {
    const report = await readJson(source.file);
    const fields = source.fields.map((field) => ({
      field,
      count: countExamples(report[field]),
    }));
    rows.push({
      category: source.category,
      sourceReport: source.file.replace(/\.json$/, ".md"),
      exampleFields: fields,
      totalExamples: fields.reduce((sum, field) => sum + field.count, 0),
      purpose:
        fields.length > 0
          ? "review examples available for report-only inspection"
          : "blocker report is metric/split focused; inspect source parser report examples",
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    totalSources: rows.length,
    rows,
    guardrails: [
      "Examples are for manual/report-only inspection",
      "Do not turn examples into runtime rules without main approval",
      "Do not treat example counts as readiness metrics",
      "No public promotion",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-review-examples-index-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| category | source_report | total_examples | fields | purpose |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((row) => {
      const fields = row.exampleFields.map((field) => `${field.field}=${field.count}`).join("<br>") || "-";
      return `| ${row.category} | ${row.sourceReport} | ${row.totalExamples} | ${fields} | ${row.purpose} |`;
    }),
  ].join("\n");

  const md = [
    "# Parser Review Examples Index",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only index for review/example fields across blocker reports. This is not runtime wiring and not public promotion.",
    "",
    table,
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-review-examples-index-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-review-examples-index-latest.json");
  console.log("wrote reports/parser-review-examples-index-latest.md");
  console.log(`review examples index: sources=${rows.length}, examples=${rows.reduce((sum, row) => sum + row.totalExamples, 0)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
