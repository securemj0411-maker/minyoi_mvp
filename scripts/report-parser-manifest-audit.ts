import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { compileChainArtifacts, registryPacketSuites } from "./lib/report-packet-registry";

type Manifest = {
  rows: Array<{ file: string; role: string; exists: boolean }>;
};

const reportsDir = path.join(process.cwd(), "reports");
const registryArtifacts = compileChainArtifacts(registryPacketSuites);

const mustInclude = [
  "parser-suite-status-latest.md",
  "parser-suite-coverage-latest.md",
  "parser-suite-usage-latest.md",
  "parser-next-work-queue-latest.md",
  "parser-review-examples-index-latest.md",
  "parser-review-top-examples-latest.md",
  "parser-boundary-review-examples-latest.md",
  "parser-boundary-example-coverage-latest.md",
  "parser-airpods-headphone-boundary-examples-latest.md",
  "parser-airpods-headphone-coverage-latest.md",
  "parser-review-coverage-summary-latest.md",
  "parser-policy-guardrails-latest.md",
  "parser-report-only-audit-latest.md",
  ...registryArtifacts.manifestFiles,
  "parser-hold-blockers-index-latest.md",
  "parser-category-evidence-ledger-latest.md",
  "parser-category-context-status-latest.md",
  "parser-registry-phase-tag-summary-latest.md",
  "parser-registry-metadata-status-latest.md",
  "parser-registry-compiler-candidate-latest.md",
  "parser-registry-backlog-signals-latest.md",
];

async function exists(file: string): Promise<boolean> {
  try {
    await access(path.join(reportsDir, file));
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const manifest = JSON.parse(await readFile(path.join(reportsDir, "parser-report-manifest-latest.json"), "utf8")) as Manifest;
  const manifestFiles = new Set(manifest.rows.map((row) => row.file));
  const rows = [];

  for (const file of mustInclude) {
    rows.push({
      file,
      exists: await exists(file),
      inManifest: manifestFiles.has(file),
    });
  }

  const missing = rows.filter((row) => !row.exists || !row.inManifest);
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    status: missing.length === 0 ? "ok" : "fail",
    totalChecked: rows.length,
    missingCount: missing.length,
    rows,
    guardrails: [
      "Manifest audit only",
      "No public promotion",
      "No runtime catalog apply",
      "No candidate pool policy wiring",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-manifest-audit-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| file | exists | in_manifest |",
    "| --- | --- | --- |",
    ...rows.map((row) => `| ${row.file} | ${row.exists ? "yes" : "no"} | ${row.inManifest ? "yes" : "no"} |`),
  ].join("\n");

  const md = [
    "# Parser Manifest Audit",
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

  await writeFile(path.join(reportsDir, "parser-manifest-audit-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-manifest-audit-latest.json");
  console.log("wrote reports/parser-manifest-audit-latest.md");
  console.log(`manifest audit status=${report.status}; checked=${rows.length}; missing=${missing.length}`);
  if (missing.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
