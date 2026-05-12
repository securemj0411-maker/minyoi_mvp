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

type EvidenceRow = {
  generationScope: string;
  count: number;
  gateMix: string;
  evidenceClass: string;
  reportOnlyAction: string;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "applewatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

function isAppleWatch(sample: Sample): boolean {
  return /(애플워치|apple\s*watch)/i.test(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
}

function detectGenerationToken(text: string): string | null {
  const normalizedText = text.replace(/\s+/g, " ");
  if (/\bse\s?3\b|se3|se\s?3세대|se 3세대/.test(normalizedText)) return "se3";
  if (/\bse\s?2\b|se2|se\s?2세대|se 2세대/.test(normalizedText)) return "se2";
  if (/\bse\s?1\b|se1|se\s?1세대|se 1세대/.test(normalizedText)) return "se1";
  if (/애플워치\s*시리즈\s*10|애플워치10|apple\s*watch\s*series\s*10|series10/.test(normalizedText)) return "series10";
  if (/애플워치\s*시리즈\s*9|애플워치9|apple\s*watch\s*series\s*9|series9/.test(normalizedText)) return "series9";
  if (/애플워치\s*시리즈\s*8|애플워치8|apple\s*watch\s*series\s*8|series8/.test(normalizedText)) return "series8";
  if (/애플워치\s*시리즈\s*7|애플워치7|apple\s*watch\s*series\s*7|series7/.test(normalizedText)) return "series7";
  if (/애플워치\s*시리즈\s*6|애플워치6|apple\s*watch\s*series\s*6|series6/.test(normalizedText)) return "series6";
  if (/애플워치\s*시리즈\s*5|애플워치5|apple\s*watch\s*series\s*5|series5/.test(normalizedText)) return "series5";
  if (/애플워치\s*시리즈\s*4|애플워치4|apple\s*watch\s*series\s*4|series4/.test(normalizedText)) return "series4";
  return null;
}

function classifyGenerationScope(sample: Sample): string {
  const title = (sample.title ?? sample.name ?? "").toLowerCase();
  const description = (sample.description ?? "").toLowerCase();
  const text = `${title}\n${description}`.replace(/\s+/g, " ");
  const titleToken = detectGenerationToken(title);
  const descriptionToken = detectGenerationToken(description);

  if (/se아님|se 아님/.test(text)) return "negative_disambiguation";
  if (titleToken && descriptionToken && titleToken !== descriptionToken) return "title_description_conflict";
  if (
    /애플워치.*(se1[,/ ]*se2[,/ ]*se3|se2[,/ ]*se3|se7891011|5~11|4,5,6,7,8,9,10,11)|apple\s*watch.*(se1|se2|se3).*(series|ultra)/.test(
      text,
    )
  ) {
    return "multi_generation_buying_or_rollup";
  }

  if (/\bse\s?3\b|se3|se\s?3세대|se 3세대/.test(text)) return "se3_explicit";
  if (/\bse\s?2\b|se2|se\s?2세대|se 2세대/.test(text)) return "se2_explicit";
  if (/\bse\s?1\b|se1|se\s?1세대|se 1세대/.test(text)) return "se1_explicit";
  if (/애플워치\s*se\b|apple\s*watch\s*se\b|\bwatch\s*se\b/.test(text)) return "se_generation_ambiguous";

  if (/애플워치\s*시리즈\s*10|애플워치10|apple\s*watch\s*series\s*10|series10/.test(text)) return "series10_explicit";
  if (/애플워치\s*시리즈\s*9|애플워치9|apple\s*watch\s*series\s*9|series9/.test(text)) return "series9_explicit";
  if (/애플워치\s*시리즈\s*8|애플워치8|apple\s*watch\s*series\s*8|series8/.test(text)) return "series8_explicit";
  if (/애플워치\s*시리즈\s*7|애플워치7|apple\s*watch\s*series\s*7|series7/.test(text)) return "series7_explicit";
  if (/애플워치\s*시리즈\s*6|애플워치6|apple\s*watch\s*series\s*6|series6/.test(text)) return "series6_explicit";
  if (/애플워치\s*시리즈\s*5|애플워치5|apple\s*watch\s*series\s*5|series5/.test(text)) return "series5_explicit";
  if (/애플워치\s*시리즈\s*4|애플워치4|apple\s*watch\s*series\s*4|series4/.test(text)) return "series4_explicit";
  if (/애플워치\s*시리즈|apple\s*watch\s*series/.test(text)) return "series_generation_ambiguous";

  return "other_applewatch";
}

function gateFor(sample: Sample): string {
  return classifyListing(sample.title ?? sample.name ?? "", sample.description ?? "", sample.price ?? 0).listingType;
}

function gateMix(gates: Set<string>): string {
  return [...gates].sort().join(", ") || "unknown";
}

function evidenceClass(scope: string, gates: Set<string>): string {
  if (scope === "multi_generation_buying_or_rollup") return "generation_rollup_or_buying_pressure";
  if (scope === "title_description_conflict") return "generation_title_description_conflict_hold";
  if (scope === "negative_disambiguation") return "generation_negative_disambiguation_reference";
  if (scope === "se_generation_ambiguous" || scope === "series_generation_ambiguous") return "generation_ambiguous_review_gate";
  if (gates.has("buying") || gates.has("callout")) return "generation_rollup_or_buying_pressure";
  if (gates.has("parts")) return "generation_explicit_but_parts_pressure";
  if (scope.endsWith("_explicit")) return "generation_explicit_reference_only";
  return "generation_other_hold";
}

function reportOnlyAction(scope: string): string {
  if (scope === "multi_generation_buying_or_rollup") return "exclude as buying/rollup generation evidence";
  if (scope === "title_description_conflict") return "hold until title/description generation conflict is resolved";
  if (scope === "negative_disambiguation") return "use as negative disambiguation reference only";
  if (scope === "se_generation_ambiguous" || scope === "series_generation_ambiguous") return "hold until explicit generation text exists";
  if (scope.endsWith("_explicit")) return "use as explicit generation reference only, not runtime approval";
  return "hold as non-actionable Apple Watch generation evidence";
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const applewatchSamples = samples.filter(isAppleWatch);

  const buckets = new Map<string, Sample[]>();
  const gatesByScope = new Map<string, Set<string>>();

  for (const sample of applewatchSamples) {
    const scope = classifyGenerationScope(sample);
    if (scope === "other_applewatch") continue;
    const rows = buckets.get(scope) ?? [];
    rows.push(sample);
    buckets.set(scope, rows);

    const gates = gatesByScope.get(scope) ?? new Set<string>();
    gates.add(gateFor(sample));
    gatesByScope.set(scope, gates);
  }

  const evidenceRows: EvidenceRow[] = [...buckets.entries()]
    .map(([scope, rows]) => {
      const gates = gatesByScope.get(scope) ?? new Set<string>();
      return {
        generationScope: scope,
        count: rows.length,
        gateMix: gateMix(gates),
        evidenceClass: evidenceClass(scope, gates),
        reportOnlyAction: reportOnlyAction(scope),
        samplePids: rows.slice(0, 5).map((sample) => sample.pid ?? "-"),
        sampleTitles: rows.slice(0, 5).map(cleanTitle),
        runtimeApproved: false as const,
      };
    })
    .sort((a, b) => b.count - a.count || a.generationScope.localeCompare(b.generationScope));

  const explicitRows = evidenceRows
    .filter((row) => row.generationScope.endsWith("_explicit"))
    .reduce((sum, row) => sum + row.count, 0);
  const ambiguousRows = evidenceRows
    .filter((row) => row.generationScope.includes("ambiguous") || row.generationScope === "title_description_conflict")
    .reduce((sum, row) => sum + row.count, 0);
  const rollupRows = evidenceRows.find((row) => row.generationScope === "multi_generation_buying_or_rollup")?.count ?? 0;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_generation_evidence_report_only",
    sourceReports: ["smartwatch-parser-latest.json", "smartwatch-ambiguity-blockers-latest.json", "category-intelligence/applewatch/normalized_samples.json"],
    metrics: {
      totalAppleWatchSamples: applewatchSamples.length,
      explicitGenerationRows: explicitRows,
      ambiguousGenerationRows: ambiguousRows,
      multiGenerationRollupRows: rollupRows,
      scopeCount: evidenceRows.length,
      runtimeApprovedRows: 0,
    },
    evidenceRows,
    policyImplications: [
      "Apple Watch generation is not one flat family axis; SE 1/2/3 and numbered Series must stay explicit when building comparable groups.",
      "SE-only titles without generation text remain review evidence, not positive parser approval.",
      "Buying/rollup rows that enumerate many generations are negative evidence for generation matching.",
      "This report establishes direct generation evidence only; it does not approve runtime candidate-pool wiring.",
    ],
    nextReportOnlyExperiments: [
      "collect more explicit SE2/SE3 full-set normal rows so generation reference is not dominated by review rows",
      "split explicit generation rows by size/connectivity once generation evidence is stable",
      "keep buying/rollup generation rows as negative tests only",
    ],
    doNotDo: [
      "Do not infer SE generation from price only",
      "Do not treat generic SE titles as resolved generation matches",
      "Do not count buying/rollup posts as positive generation evidence",
      "Do not runtime-apply Apple Watch generation rules from this report alone",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-generation-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| generation_scope | count | gate_mix | evidence_class | report_only_action | sample_pids | sample_titles | runtime_approved |",
    "| --- | ---: | --- | --- | --- | --- | --- | --- |",
    ...evidenceRows.map(
      (row) =>
        `| ${row.generationScope} | ${row.count} | ${row.gateMix} | ${row.evidenceClass} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} | ${row.sampleTitles.join("<br>")} | no |`,
    ),
  ].join("\n");

  const md = [
    "# Smartwatch Apple Watch Generation Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only Apple Watch generation evidence for smartwatch_discovered. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- Apple Watch sample rows: ${report.metrics.totalAppleWatchSamples}`,
    `- explicit generation rows: ${report.metrics.explicitGenerationRows}`,
    `- ambiguous generation rows: ${report.metrics.ambiguousGenerationRows}`,
    `- multi-generation rollup rows: ${report.metrics.multiGenerationRollupRows}`,
    `- distinct generation scopes: ${report.metrics.scopeCount}`,
    "",
    "## Evidence Rows",
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

  await writeFile(path.join(reportsDir, "smartwatch-applewatch-generation-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-generation-evidence-latest.json");
  console.log("wrote reports/smartwatch-applewatch-generation-evidence-latest.md");
  console.log(`smartwatch Apple Watch generation evidence: scopes=${evidenceRows.length}, explicit=${explicitRows}, ambiguous=${ambiguousRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
