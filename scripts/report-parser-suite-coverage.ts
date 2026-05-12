import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SuiteStatus = {
  candidateRows: Array<{ category: string; blockerReport: string }>;
  holdRows: Array<{ category: string; blockerReport: string }>;
};

type ManifestAudit = {
  status: string;
  missingCount: number;
};

type Guardrails = {
  status: string;
  failedCount: number;
};

const reportsDir = path.join(process.cwd(), "reports");

const expectedTrackedCategories = [
  "earphone_discovered",
  "headphone_discovered",
  "monitor_discovered",
  "desktop_pc_discovered",
  "game_console_body_narrow",
  "camera_discovered",
  "smartwatch_discovered",
  "speaker_audio_discovered",
  "home_appliance_tech_discovered",
  "game_console_discovered",
];

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

function missing(expected: string[], actual: string[]): string[] {
  const actualSet = new Set(actual);
  return expected.filter((item) => !actualSet.has(item));
}

async function main(): Promise<void> {
  const suite = await readJson<SuiteStatus>("parser-suite-status-latest.json");
  const manifest = await readJson<ManifestAudit>("parser-manifest-audit-latest.json");
  const guardrails = await readJson<Guardrails>("parser-policy-guardrails-latest.json");

  const candidateCategories = suite.candidateRows.map((row) => row.category);
  const holdCategories = suite.holdRows.map((row) => row.category);
  const trackedCategories = [...candidateCategories, ...holdCategories];
  const trackedMissing = missing(expectedTrackedCategories, trackedCategories);
  const candidateMissingBlockers = suite.candidateRows.filter((row) => !row.blockerReport || row.blockerReport === "n/a").map((row) => row.category);
  const holdMissingBlockers = suite.holdRows.filter((row) => !row.blockerReport || row.blockerReport === "n/a").map((row) => row.category);

  const checks = [
    { name: "tracked categories covered", ok: trackedMissing.length === 0, detail: trackedMissing.join(", ") || "ok" },
    { name: "candidate blocker links covered", ok: candidateMissingBlockers.length === 0, detail: candidateMissingBlockers.join(", ") || "ok" },
    { name: "hold blocker links covered", ok: holdMissingBlockers.length === 0, detail: holdMissingBlockers.join(", ") || "ok" },
    { name: "manifest audit ok", ok: manifest.status === "ok" && manifest.missingCount === 0, detail: `${manifest.status}; missing=${manifest.missingCount}` },
    { name: "policy guardrails ok", ok: guardrails.status === "ok" && guardrails.failedCount === 0, detail: `${guardrails.status}; failed=${guardrails.failedCount}` },
  ];

  const failed = checks.filter((check) => !check.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    status: failed.length === 0 ? "ok" : "fail",
    checks,
    expectedTrackedCategories,
    guardrails: [
      "Coverage report only",
      "No public promotion",
      "No runtime catalog apply",
      "No candidate pool policy wiring",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-suite-coverage-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| check | status | detail |",
    "| --- | --- | --- |",
    ...checks.map((check) => `| ${check.name} | ${check.ok ? "ok" : "fail"} | ${check.detail} |`),
  ].join("\n");

  const md = [
    "# Parser Suite Coverage",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Status: ${report.status}`,
    "",
    table,
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-suite-coverage-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-suite-coverage-latest.json");
  console.log("wrote reports/parser-suite-coverage-latest.md");
  console.log(`suite coverage status=${report.status}; checks=${checks.length}; failed=${failed.length}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
