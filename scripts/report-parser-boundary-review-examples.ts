import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type BoundarySource = {
  category: string;
  file: string;
  rowField: string;
  detailFields: string[];
  limit: number;
};

type BoundaryRow = Record<string, unknown>;

const reportsDir = path.join(process.cwd(), "reports");

const sources: BoundarySource[] = [
  {
    category: "monitor_discovered",
    file: "monitor-pending-model-spec-evidence-latest.json",
    rowField: "rows",
    detailFields: ["hint", "resolutionStatus", "refreshStatus"],
    limit: 4,
  },
  {
    category: "desktop_pc_discovered",
    file: "desktop-cpu-gpu-title-token-boundary-evidence-latest.json",
    rowField: "rows",
    detailFields: ["keyClass", "cpuTitleToken", "gpuTitleToken", "keyMismatchClass"],
    limit: 6,
  },
  {
    category: "game_console_body_narrow",
    file: "game-console-body-edition-boundary-evidence-latest.json",
    rowField: "boundaryRows",
    detailFields: ["boundaryClass", "reviewAction"],
    limit: 8,
  },
  {
    category: "camera_discovered",
    file: "camera-package-title-token-boundary-evidence-latest.json",
    rowField: "rows",
    detailFields: ["package_config", "titlePackageTokenClass", "tokenBoundaryDecision"],
    limit: 8,
  },
  {
    category: "smartwatch_discovered",
    file: "smartwatch-connectivity-model-boundary-evidence-latest.json",
    rowField: "modelRows",
    detailFields: ["model", "unknownConnectivityUnits", "unknownSizeUnits", "boundaryClass"],
    limit: 8,
  },
  {
    category: "speaker_audio_discovered",
    file: "speaker-portable-model-subset-boundary-evidence-latest.json",
    rowField: "rows",
    detailFields: ["family", "deviceClass", "subsetClass", "holdUnits"],
    limit: 8,
  },
  {
    category: "home_appliance_tech_discovered",
    file: "home-appliance-vacuum-model-subtype-boundary-evidence-latest.json",
    rowField: "rows",
    detailFields: ["key", "subtype", "subtypeBoundaryClass"],
    limit: 8,
  },
];

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as Record<string, unknown>;
}

function compactValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

function detailFor(row: BoundaryRow, fields: string[]): string {
  return fields.map((field) => `${field}=${compactValue(row[field])}`).join("; ");
}

async function main(): Promise<void> {
  const rows = [];

  for (const source of sources) {
    const report = await readJson(source.file);
    const sourceRows = Array.isArray(report[source.rowField]) ? (report[source.rowField] as BoundaryRow[]) : [];
    for (const row of sourceRows.slice(0, source.limit)) {
      rows.push({
        category: source.category,
        sourceReport: source.file.replace(/\.json$/, ".md"),
        pid: row.pid ?? null,
        title: row.title ?? row.comparableKey ?? row.family ?? row.model ?? row.key ?? "",
        detail: detailFor(row, source.detailFields),
        runtimeApproved: false,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    totalSources: sources.length,
    totalExamples: rows.length,
    rows,
    guardrails: [
      "Boundary examples are for manual/report-only inspection",
      "Do not convert boundary examples into runtime rules from this report",
      "Do not treat parser_candidate as public approval",
      "No public promotion",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-boundary-review-examples-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| category | source_report | pid | title_or_key | detail | runtime_approved |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => (
      `| ${row.category} | ${row.sourceReport} | ${row.pid ?? "-"} | ${String(row.title).replace(/\|/g, "/")} | ${row.detail.replace(/\|/g, "/")} | no |`
    )),
  ].join("\n");

  const md = [
    "# Parser Boundary Review Examples",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only examples from latest boundary evidence reports. This is not runtime wiring and not public promotion.",
    "",
    table,
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-boundary-review-examples-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-boundary-review-examples-latest.json");
  console.log("wrote reports/parser-boundary-review-examples-latest.md");
  console.log(`boundary review examples: sources=${sources.length}, examples=${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
