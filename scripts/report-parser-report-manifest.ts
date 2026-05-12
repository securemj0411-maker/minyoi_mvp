import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { compileChainArtifacts, registryPacketSuites } from "./lib/report-packet-registry";

type ExistingManifest = {
  rows?: Array<{ file: string; role: string; exists?: boolean }>;
};

type ManifestRow = {
  file: string;
  role: string;
  exists: boolean;
};

const reportsDir = path.join(process.cwd(), "reports");
const registryArtifacts = compileChainArtifacts(registryPacketSuites);

const essentialRows: Array<{ file: string; role: string }> = [
  { file: "parser-suite-status-latest.md", role: "Parser suite status" },
  { file: "parser-suite-coverage-latest.md", role: "Parser suite coverage check" },
  { file: "parser-suite-usage-latest.md", role: "Parser suite usage notes" },
  { file: "parser-next-work-queue-latest.md", role: "Parser next work queue" },
  { file: "parser-review-examples-index-latest.md", role: "Parser review examples index" },
  { file: "parser-review-top-examples-latest.md", role: "Parser review top examples" },
  { file: "parser-boundary-review-examples-latest.md", role: "Parser boundary review examples" },
  { file: "parser-boundary-example-coverage-latest.md", role: "Parser boundary example coverage" },
  { file: "parser-airpods-headphone-boundary-examples-latest.md", role: "Parser AirPods/headphone boundary examples" },
  { file: "parser-airpods-headphone-coverage-latest.md", role: "Parser AirPods/headphone coverage" },
  { file: "parser-review-coverage-summary-latest.md", role: "Parser review coverage summary" },
  { file: "parser-policy-guardrails-latest.md", role: "Parser policy guardrails" },
  { file: "parser-report-only-audit-latest.md", role: "Parser report-only audit" },
  { file: "parser-hold-blockers-index-latest.md", role: "Parser hold blockers index" },
  { file: "parser-category-evidence-ledger-latest.md", role: "Parser category evidence ledger" },
  { file: "parser-category-context-status-latest.md", role: "Parser category context status" },
  { file: "parser-registry-phase-tag-summary-latest.md", role: "Parser registry phase and tag summary" },
  { file: "parser-registry-metadata-status-latest.md", role: "Parser registry metadata status" },
  { file: "parser-registry-compiler-candidate-latest.md", role: "Parser registry compiler candidate" },
  { file: "parser-registry-backlog-signals-latest.md", role: "Parser registry backlog signals" },
];

function fallbackRoleForFile(file: string): string {
  return file
    .replace(/-latest\.md$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(path.join(reportsDir, file));
    return true;
  } catch {
    return false;
  }
}

async function loadExistingRoles(): Promise<Map<string, string>> {
  try {
    const existing = JSON.parse(await readFile(path.join(reportsDir, "parser-report-manifest-latest.json"), "utf8")) as ExistingManifest;
    return new Map((existing.rows ?? []).map((row) => [row.file, row.role]));
  } catch {
    return new Map();
  }
}

async function main(): Promise<void> {
  const existingRoles = await loadExistingRoles();
  const registryRows = registryArtifacts.manifestFiles.map((file) => ({
    file,
    role: existingRoles.get(file) ?? fallbackRoleForFile(file),
  }));

  const combined = new Map<string, { file: string; role: string }>();
  for (const row of [...essentialRows, ...registryRows]) {
    combined.set(row.file, {
      file: row.file,
      role: existingRoles.get(row.file) ?? row.role,
    });
  }

  const rows: ManifestRow[] = [];
  for (const row of [...combined.values()].sort((a, b) => a.file.localeCompare(b.file))) {
    rows.push({
      ...row,
      exists: await fileExists(row.file),
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    rows,
    missingFiles: rows.filter((row) => !row.exists).map((row) => row.file),
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-report-manifest-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| file | role | exists |",
    "| --- | --- | --- |",
    ...rows.map((row) => `| ${row.file} | ${row.role} | ${row.exists ? "yes" : "no"} |`),
  ].join("\n");

  const md = [
    "# Parser Report Manifest",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    table,
    "",
    "## Guardrails",
    "",
    "- Report-only manifest",
    "- No runtime catalog apply",
    "- No public promotion",
    "- No candidate pool policy wiring",
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-report-manifest-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-report-manifest-latest.json");
  console.log("wrote reports/parser-report-manifest-latest.md");
  console.log(`report manifest rows=${rows.length}; missing=${report.missingFiles.length}`);
  if (report.missingFiles.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
