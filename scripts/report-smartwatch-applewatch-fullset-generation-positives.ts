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
  listingTypeMix: string;
  candidateClass: string;
  signalSummary: string;
  reportOnlyAction: string;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "applewatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function isAppleWatch(sample: Sample): boolean {
  return /(애플워치|apple\s*watch)/i.test(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
}

function detectGenerationToken(text: string): string | null {
  if (/\bse\s?3\b|se3|se\s?3세대|se 3세대/.test(text)) return "se3";
  if (/\bse\s?2\b|se2|se\s?2세대|se 2세대/.test(text)) return "se2";
  if (/\bse\s?1\b|se1|se\s?1세대|se 1세대/.test(text)) return "se1";
  if (/애플워치\s*시리즈\s*10|애플워치10|apple\s*watch\s*series\s*10|series10/.test(text)) return "series10";
  if (/애플워치\s*시리즈\s*9|애플워치9|apple\s*watch\s*series\s*9|series9/.test(text)) return "series9";
  if (/애플워치\s*시리즈\s*8|애플워치8|apple\s*watch\s*series\s*8|series8/.test(text)) return "series8";
  if (/애플워치\s*시리즈\s*7|애플워치7|apple\s*watch\s*series\s*7|series7/.test(text)) return "series7";
  if (/애플워치\s*시리즈\s*6|애플워치6|apple\s*watch\s*series\s*6|series6/.test(text)) return "series6";
  if (/애플워치\s*시리즈\s*5|애플워치5|apple\s*watch\s*series\s*5|series5/.test(text)) return "series5";
  if (/애플워치\s*시리즈\s*4|애플워치4|apple\s*watch\s*series\s*4|series4/.test(text)) return "series4";
  return null;
}

function generationScope(sample: Sample): string | null {
  const token = detectGenerationToken(textFor(sample));
  return token ? `${token}_explicit` : null;
}

function hasSize(text: string): boolean {
  return /\b(40|41|42|44|45|46|49)mm\b/.test(text);
}

function hasConnectivity(text: string): boolean {
  return /(gps\s*\+?\s*cellular|cellular|셀룰러|lte|\bgps\b)/.test(text);
}

function hasFullsetKeyword(text: string): boolean {
  return /(풀박스|풀박|풀세트|미개봉|새상품급|단순개봉급|박스|설명서)/.test(text);
}

function hasCoreAccessoryKeyword(text: string): boolean {
  return /(충전기|충전선|충전 케이블|케이블 포함|정품충전기|스트랩 포함|정품 스트랩|기본 스트랩|스포츠밴드|밴드 포함|s\/m|m\/l)/.test(text);
}

function hasBatteryHealth(text: string): boolean {
  return /(배터리\s*(성능|효율|최대치)|성능\s*100%|99%|100%)/.test(text);
}

function hasAccessoryDominance(text: string): boolean {
  return /(스트랩만|밴드만|시계줄만|케이스만|충전기만|거치대|충전 스탠드|충전독)/.test(text);
}

function hasBuyingOrRollup(text: string): boolean {
  return /(매입|삽니다|se1.*se2.*se3|series.*4.*5.*6.*7|최고가 매입)/.test(text);
}

function hasPartsOrDamagePressure(listingType: string, text: string): boolean {
  return listingType === "parts" || listingType === "damaged" || /(액정|파손|고장|수리|배터리\s*7[0-9]%|배터리\s*6[0-9]%)/.test(text);
}

function packageClass(text: string): "sealed_or_fullbox" | "core_bundle" | "loose_body_context" {
  if (hasFullsetKeyword(text)) return "sealed_or_fullbox";
  if (hasCoreAccessoryKeyword(text)) return "core_bundle";
  return "loose_body_context";
}

function candidateClass(sample: Sample): string {
  const text = textFor(sample);
  const listingType = classifyListing(sample.title ?? sample.name ?? "", sample.description ?? "", sample.price ?? 0).listingType;
  if (hasBuyingOrRollup(text)) return "explicit_but_buying_or_callout";
  if (hasAccessoryDominance(text)) return "explicit_but_accessory_risk";
  if (hasPartsOrDamagePressure(listingType, text)) return "explicit_but_parts_or_damaged";
  if (!hasSize(text) || !hasConnectivity(text)) return "explicit_but_missing_connectivity_or_size";
  const pkg = packageClass(text);
  if (pkg === "sealed_or_fullbox") return "strong_fullset_positive";
  if (pkg === "core_bundle" || hasBatteryHealth(text)) return "near_fullset_positive";
  return "explicit_but_loose_body_context";
}

function listingTypeMix(rows: Sample[]): string {
  return [...new Set(rows.map((row) => classifyListing(row.title ?? row.name ?? "", row.description ?? "", row.price ?? 0).listingType))].sort().join(", ");
}

function signalSummary(scope: string, rows: Sample[]): string {
  const texts = rows.map(textFor);
  const size = texts.filter(hasSize).length;
  const connectivity = texts.filter(hasConnectivity).length;
  const fullset = texts.filter(hasFullsetKeyword).length;
  const core = texts.filter(hasCoreAccessoryKeyword).length;
  return `size ${size}/${rows.length}, connectivity ${connectivity}/${rows.length}, fullset ${fullset}/${rows.length}, core_bundle ${core}/${rows.length}, scope ${scope}`;
}

function reportOnlyAction(candidateClassName: string): string {
  switch (candidateClassName) {
    case "strong_fullset_positive":
      return "use as explicit generation full-set positive reference only; do not runtime approve";
    case "near_fullset_positive":
      return "use as near-full-set positive reference only; still review-gated";
    case "explicit_but_missing_connectivity_or_size":
      return "keep as explicit generation reference, but review-gate until size/connectivity are explicit";
    case "explicit_but_accessory_risk":
      return "keep generation explicit evidence but do not treat accessory-dominant listing as full-set positive";
    case "explicit_but_parts_or_damaged":
      return "keep as generation evidence only; exclude from positive full-set packet";
    case "explicit_but_buying_or_callout":
      return "exclude from positive packet; buying/callout pressure only";
    default:
      return "keep as loose body-context generation evidence only";
  }
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const rows = samples.filter(isAppleWatch).filter((sample) => generationScope(sample) !== null);

  const buckets = new Map<string, Sample[]>();
  for (const sample of rows) {
    const scope = generationScope(sample)!;
    const klass = candidateClass(sample);
    const key = `${scope}::${klass}`;
    const list = buckets.get(key) ?? [];
    list.push(sample);
    buckets.set(key, list);
  }

  const evidenceRows: EvidenceRow[] = [...buckets.entries()]
    .map(([key, rowsForKey]) => {
      const [scope, klass] = key.split("::");
      return {
        generationScope: scope,
        count: rowsForKey.length,
        listingTypeMix: listingTypeMix(rowsForKey),
        candidateClass: klass,
        signalSummary: signalSummary(scope, rowsForKey),
        reportOnlyAction: reportOnlyAction(klass),
        samplePids: rowsForKey.slice(0, 5).map((sample) => sample.pid ?? "-"),
        sampleTitles: rowsForKey.slice(0, 5).map(cleanTitle),
        runtimeApproved: false as const,
      };
    })
    .sort((a, b) => b.count - a.count || a.generationScope.localeCompare(b.generationScope) || a.candidateClass.localeCompare(b.candidateClass));

  const strongFullsetRows = evidenceRows.filter((row) => row.candidateClass === "strong_fullset_positive").reduce((sum, row) => sum + row.count, 0);
  const nearFullsetRows = evidenceRows.filter((row) => row.candidateClass === "near_fullset_positive").reduce((sum, row) => sum + row.count, 0);
  const accessoryRiskRows = evidenceRows.filter((row) => row.candidateClass === "explicit_but_accessory_risk").reduce((sum, row) => sum + row.count, 0);
  const missingConnectivityOrSizeRows = evidenceRows.filter((row) => row.candidateClass === "explicit_but_missing_connectivity_or_size").reduce((sum, row) => sum + row.count, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_explicit_fullset_positive_report_only",
    metrics: {
      explicitGenerationRows: rows.length,
      strongFullsetRows,
      nearFullsetRows,
      accessoryRiskRows,
      missingConnectivityOrSizeRows,
      generationScopeCount: [...new Set(rows.map((sample) => generationScope(sample)!))].length,
      runtimeApprovedRows: 0,
    },
    evidenceRows,
    policyImplications: [
      "Explicit generation text is only the first filter; size, connectivity, and package signals still decide whether a row looks like a strong or near full-set positive.",
      "SE3, Series 10, Series 7, and Series 9 are the best first positive buckets, but they remain report-only references here.",
      "Accessory-dominant or buying/callout rows should stay outside positive full-set packets even when generation is explicit.",
      "This report thickens explicit-generation full-set opportunities only; it does not approve runtime candidate-pool wiring.",
    ],
    nextReportOnlyExperiments: [
      "thicken SE3 and Series 10 strong full-set positives first, then widen to Series 7 / Series 9",
      "pair explicit generation positives with unknown connectivity review rows so positive density and review pressure are visible together",
      "keep Series 6 and older scopes conservative until accessory contamination is better separated",
    ],
    doNotDo: [
      "Do not runtime-approve Apple Watch generation rules from this report alone",
      "Do not treat accessory-dominant rows as full-set positives",
      "Do not infer connectivity or size when the listing leaves them implicit",
      "Do not count buying/rollup rows as positive explicit generation evidence",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-fullset-generation-positives-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| generation_scope | count | listing_type_mix | candidate_class | signal_summary | report_only_action | sample_pids | sample_titles | runtime_approved |",
    "| --- | ---: | --- | --- | --- | --- | --- | --- | --- |",
    ...evidenceRows.map(
      (row) =>
        `| ${row.generationScope} | ${row.count} | ${row.listingTypeMix} | ${row.candidateClass} | ${row.signalSummary} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} | ${row.sampleTitles.join("<br>")} | no |`,
    ),
  ].join("\n");

  const md = [
    "# Smartwatch Apple Watch Fullset Generation Positives",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only Apple Watch explicit-generation full-set positive evidence. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- explicit generation rows: ${report.metrics.explicitGenerationRows}`,
    `- strong full-set positive rows: ${report.metrics.strongFullsetRows}`,
    `- near full-set positive rows: ${report.metrics.nearFullsetRows}`,
    `- accessory-risk rows: ${report.metrics.accessoryRiskRows}`,
    `- missing connectivity/size rows: ${report.metrics.missingConnectivityOrSizeRows}`,
    `- explicit generation scopes: ${report.metrics.generationScopeCount}`,
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

  await writeFile(path.join(reportsDir, "smartwatch-applewatch-fullset-generation-positives-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-fullset-generation-positives-latest.json");
  console.log("wrote reports/smartwatch-applewatch-fullset-generation-positives-latest.md");
  console.log(`smartwatch Apple Watch explicit fullset positives: strong=${strongFullsetRows}, near=${nearFullsetRows}, scopes=${report.metrics.generationScopeCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
