import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { classifyListing } from "@/lib/pipeline";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
  price?: number;
};

type ScopeEvidenceRow = {
  modelScope: string;
  count: number;
  gateMix: string;
  evidenceClass: string;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "earphone_discovered", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

function normalized(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase();
}

function isGalaxyBuds(sample: Sample): boolean {
  return /(갤럭시\s*버즈|galaxy\s*buds|버즈\s?(fe|2\s?프로|2pro|3|3\s?프로|3pro|프로1)|buds\s?(fe|2\s?pro|3|3\s?pro|pro1))/i.test(
    `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`,
  );
}

function modelScopeFor(sample: Sample): string {
  const text = normalized(sample).replace(/\s+/g, " ");
  if (/buds\s?3\s?pro|버즈\s?3\s?프로/.test(text)) return "buds3_pro";
  if (/buds\s?3\s?fe|버즈\s?3\s?fe/.test(text)) return "buds3_fe";
  if (/buds\s?3(?!\s?(pro|fe))|버즈\s?3(?!\s?(프로|fe))/.test(text)) return "buds3";
  if (/buds\s?2\s?pro|버즈\s?2\s?프로/.test(text)) return "buds2_pro";
  if (/buds\s?pro\s?1|버즈\s?프로\s?1|버즈프로1/.test(text)) return "buds_pro_1";
  if (/buds\s?fe|버즈\s?fe|갤럭시버즈fe/.test(text)) return "buds_fe";
  return "other_buds_family";
}

function gateLabelFor(sample: Sample): string {
  const title = sample.title ?? sample.name ?? "";
  const description = sample.description ?? "";
  const price = sample.price ?? 0;
  return classifyListing(title, description, price).listingType;
}

function evidenceClassFor(scope: string, gates: Set<string>): string {
  if (gates.has("buying") || gates.has("callout")) return "buying_or_callout_pressure";
  if (gates.has("parts")) return `${scope}_parts_pressure`;
  if (gates.has("normal")) return `${scope}_family_positive_boundary`;
  return `${scope}_family_hold_boundary`;
}

function gateMixFor(gates: Set<string>): string {
  return [...gates].sort().join(", ") || "unknown";
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const budsSamples = samples.filter(isGalaxyBuds);

  const buckets = new Map<string, Sample[]>();
  const gatesByScope = new Map<string, Set<string>>();

  for (const sample of budsSamples) {
    const scope = modelScopeFor(sample);
    const rows = buckets.get(scope) ?? [];
    rows.push(sample);
    buckets.set(scope, rows);

    const gates = gatesByScope.get(scope) ?? new Set<string>();
    gates.add(gateLabelFor(sample));
    gatesByScope.set(scope, gates);
  }

  const scopeRows: ScopeEvidenceRow[] = [...buckets.entries()]
    .map(([scope, rows]) => {
      const gates = gatesByScope.get(scope) ?? new Set<string>();
      return {
        modelScope: scope,
        count: rows.length,
        gateMix: gateMixFor(gates),
        evidenceClass: evidenceClassFor(scope, gates),
        samplePids: rows.slice(0, 5).map((sample) => sample.pid ?? "-"),
        sampleTitles: rows.slice(0, 5).map(cleanTitle),
        runtimeApproved: false as const,
      };
    })
    .sort((a, b) => b.count - a.count || a.modelScope.localeCompare(b.modelScope));

  const total = budsSamples.length;
  const normalRows = budsSamples.filter((sample) => gateLabelFor(sample) === "normal").length;
  const partsRows = budsSamples.filter((sample) => gateLabelFor(sample) === "parts").length;
  const buyingRows = budsSamples.filter((sample) => {
    const gate = gateLabelFor(sample);
    return gate === "buying" || gate === "callout";
  }).length;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "earphone_discovered",
    family: "galaxybuds",
    decision: "galaxybuds_family_evidence_report_only",
    sourceReports: ["earphone-parser-latest.json", "earphone-parts-exclusion-evidence-latest.json"],
    metrics: {
      totalGalaxyBudsRows: total,
      normalRows,
      partsRows,
      buyingOrCalloutRows: buyingRows,
      scopeCount: scopeRows.length,
      runtimeApprovedRows: 0,
    },
    scopeRows,
    policyImplications: [
      "Galaxy Buds family rows are not a single positive bucket; Buds3 Pro, Buds3, Buds FE, and older Pro lines split into different model scopes.",
      "Within the current sample, parts pressure is still large enough that family-only matching is unsafe without model-scope confirmation.",
      "Buying/callout rows and mixed parts rows remain negative evidence, not parser approval.",
      "This report establishes family-level separation evidence only; it does not approve runtime candidate-pool wiring.",
    ],
    nextReportOnlyExperiments: [
      "collect more full-set Galaxy Buds rows so family-positive evidence is not dominated by parts rows",
      "separate Buds3 Pro vs Buds3 FE vs Buds FE full-set examples into their own scope packets",
      "treat Galaxy Buds unit/case rows as negative tests only",
    ],
    doNotDo: [
      "Do not treat generic Galaxy Buds titles as a single matched family",
      "Do not promote Galaxy Buds parser policy into candidate pool from this report alone",
      "Do not mix Buds3 Pro with Buds3/Buds FE normal rows",
      "Do not count buying/callout rows as positive family evidence",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "earphone-galaxybuds-family-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| model_scope | count | gate_mix | evidence_class | sample_pids | sample_titles | runtime_approved |",
    "| --- | ---: | --- | --- | --- | --- | --- |",
    ...scopeRows.map(
      (row) =>
        `| ${row.modelScope} | ${row.count} | ${row.gateMix} | ${row.evidenceClass} | ${row.samplePids.join(", ")} | ${row.sampleTitles.join("<br>")} | no |`,
    ),
  ].join("\n");

  const md = [
    "# Earphone Galaxy Buds Family Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only Galaxy Buds family evidence for earphone_discovered. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- Galaxy Buds family rows: ${report.metrics.totalGalaxyBudsRows}`,
    `- normal rows: ${report.metrics.normalRows}`,
    `- parts rows: ${report.metrics.partsRows}`,
    `- buying/callout rows: ${report.metrics.buyingOrCalloutRows}`,
    `- distinct model scopes: ${report.metrics.scopeCount}`,
    "",
    "## Scope Rows",
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

  await writeFile(path.join(reportsDir, "earphone-galaxybuds-family-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/earphone-galaxybuds-family-evidence-latest.json");
  console.log("wrote reports/earphone-galaxybuds-family-evidence-latest.md");
  console.log(`earphone Galaxy Buds family evidence: rows=${total}, scopes=${scopeRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
