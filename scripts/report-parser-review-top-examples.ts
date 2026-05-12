import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Example = {
  pid?: string | number | null;
  title?: string;
  price?: number | null;
  reason?: string;
  key?: string | null;
  family?: string;
  comparableKey?: string | null;
  connector?: string;
  generation?: string;
  package_config?: string | null;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

function exampleRow(category: string, source: string, type: string, example: Example) {
  return {
    category,
    source,
    type,
    pid: example.pid ?? null,
    title: example.title ?? "",
    price: example.price ?? null,
    detail: example.reason ?? example.key ?? example.family ?? example.comparableKey ?? example.connector ?? example.generation ?? example.package_config ?? "",
  };
}

async function main(): Promise<void> {
  const monitor = await readJson<{ genericExamples: Example[]; criticalExamples: Example[] }>("monitor-model-code-blockers-latest.json");
  const desktop = await readJson<{ reviewExamples: Example[] }>("desktop-full-unit-blockers-latest.json");
  const camera = await readJson<{ examplesByPackage: Record<string, Example[]> }>("camera-package-blockers-latest.json");
  const smartwatch = await readJson<{ reviewExamples: Example[] }>("smartwatch-ambiguity-blockers-latest.json");
  const speaker = await readJson<{ genericExamples: Example[] }>("speaker-family-blockers-latest.json");
  const home = await readJson<{ genericExamples: Example[] }>("home-appliance-blockers-latest.json");
  const headphone = await readJson<{
    unknownGenerationExamples: Example[];
    unknownConnectorExamples: Example[];
    unknownSkuExamples: Example[];
  }>("headphone-matched-sku-blockers-latest.json");

  const rows = [
    ...monitor.genericExamples.slice(0, 5).map((example) => exampleRow("monitor_discovered", "monitor-model-code-blockers", "generic_monitor", example)),
    ...monitor.criticalExamples.slice(0, 5).map((example) => exampleRow("monitor_discovered", "monitor-model-code-blockers", "critical_unknown", example)),
    ...desktop.reviewExamples.slice(0, 8).map((example) => exampleRow("desktop_pc_discovered", "desktop-full-unit-blockers", "generic_or_partial", example)),
    ...Object.entries(camera.examplesByPackage).flatMap(([type, examples]) =>
      examples.slice(0, 3).map((example) => exampleRow("camera_discovered", "camera-package-blockers", type, example)),
    ),
    ...smartwatch.reviewExamples.slice(0, 8).map((example) => exampleRow("smartwatch_discovered", "smartwatch-ambiguity-blockers", "review", example)),
    ...speaker.genericExamples.slice(0, 8).map((example) => exampleRow("speaker_audio_discovered", "speaker-family-blockers", "generic_speaker", example)),
    ...home.genericExamples.slice(0, 8).map((example) => exampleRow("home_appliance_tech_discovered", "home-appliance-blockers", "generic_appliance", example)),
    ...headphone.unknownGenerationExamples.slice(0, 5).map((example) => exampleRow("headphone_discovered", "headphone-matched-sku-blockers", "airpods_max_unknown_generation", example)),
    ...headphone.unknownConnectorExamples.slice(0, 5).map((example) => exampleRow("headphone_discovered", "headphone-matched-sku-blockers", "airpods_max_unknown_connector", example)),
    ...headphone.unknownSkuExamples.slice(0, 5).map((example) => exampleRow("headphone_discovered", "headphone-matched-sku-blockers", "unknown_sku", example)),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    totalExamples: rows.length,
    rows,
    guardrails: [
      "Examples are for manual/report-only inspection",
      "Do not convert examples into runtime rules from this report",
      "Do not treat examples as approval or readiness evidence",
      "No public promotion",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-review-top-examples-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| category | type | pid | title | price | detail |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) =>
      `| ${row.category} | ${row.type} | ${row.pid ?? ""} | ${String(row.title).replace(/\|/g, "/")} | ${row.price ?? ""} | ${String(row.detail).replace(/\|/g, "/")} |`,
    ),
  ].join("\n");

  const md = [
    "# Parser Review Top Examples",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only examples for manual review. This is not runtime wiring and not public promotion.",
    "",
    table,
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-review-top-examples-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-review-top-examples-latest.json");
  console.log("wrote reports/parser-review-top-examples-latest.md");
  console.log(`review top examples: examples=${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
