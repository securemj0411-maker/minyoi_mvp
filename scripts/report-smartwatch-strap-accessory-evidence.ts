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
  strapScope: string;
  count: number;
  gateMix: string;
  evidenceClass: string;
  reportOnlyAction: string;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "smartwatch_discovered", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

function watchText(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function hasStrapSignal(text: string): boolean {
  return /(스트랩|밴드|브레이슬릿|밀레니즈|메탈스트랩|시계줄|오션밴드|트레일루프|스포츠루프|링크 브레이슬릿|링크브레이슬릿|가죽 밴드|가죽스트랩|루프|알파인|hermès|에르메스)/.test(text);
}

function hasChargerStandSignal(text: string): boolean {
  return /(충전기|충전 케이블|충전케이블|고속 충전기|충전 스탠드|거치대|맥세이프|도크)/.test(text);
}

function hasWatchBodySignal(text: string): boolean {
  return /(워치\d|시리즈\s?\d+|se\d?|ultra|본체|풀박|풀박스|미개봉|배터리|성능|정상작동|초기화|gps|cellular|lte|액정|페어링|충전기|충전선|충전 케이블)/.test(text);
}

function isAccessoryOnlyStrap(text: string, price: number): boolean {
  return (
    hasStrapSignal(text) &&
    !hasWatchBodySignal(text) &&
    !/(본체|미개봉|풀박|충전기)/.test(text) &&
    price > 0 &&
    price < 120_000
  );
}

function isCompatibilityOnly(text: string): boolean {
  return /(호환|42[,/ ]*44[,/ ]*45[,/ ]*49|49mm용|44mm용|41mm용|45mm용|se\/?se2\/?se3|시리즈\s*4\s*~\s*9|전용|스트랩만|밴드만|시계줄만)/.test(text);
}

function hasPremiumBandSignal(text: string): boolean {
  return /(밀레니즈|메탈스트랩|가죽 밴드|가죽스트랩|오션밴드|트레일루프|링크 브레이슬릿|링크브레이슬릿|브레이슬릿)/.test(text);
}

function hasBonusBandSignal(text: string): boolean {
  return /(추가.*스트랩|추가.*밴드|스트랩\s*[2-9]개|밴드\s*[2-9]개|랜덤 스트랩|서비스 스트랩|같이 드립니다|드려요)/.test(text);
}

function isCoreMissingBody(text: string): boolean {
  return /(워치만|본체만|단품|박스\s*x|박스x|충전기\s*x|충전기x|스트랩\s*x|스트랩x|밴드\s*x|밴드x)/.test(text);
}

function strapScopeFor(sample: Sample): string | null {
  const text = watchText(sample);
  const price = sample.price ?? 0;
  const accessorySignal = hasStrapSignal(text) || hasChargerStandSignal(text);
  if (!accessorySignal) return null;
  if ((hasStrapSignal(text) && isAccessoryOnlyStrap(text, price)) || (hasChargerStandSignal(text) && !hasWatchBodySignal(text) && price > 0 && price < 120_000)) {
    if (isCompatibilityOnly(text)) return "compatibility_rollup_accessory";
    if (hasChargerStandSignal(text) && !hasStrapSignal(text)) return "charger_stand_accessory_only";
    return "strap_accessory_only";
  }
  if (!hasWatchBodySignal(text)) return "strap_accessory_ambiguous_hold";
  if (isCoreMissingBody(text)) return "watch_body_missing_core_components";
  if (hasPremiumBandSignal(text)) return "watch_body_with_premium_band_bundle";
  if (hasBonusBandSignal(text)) return "watch_body_with_accessory_bundle";
  return "watch_body_with_default_band_context";
}

function gateMix(gates: Set<string>): string {
  return [...gates].sort().join(", ") || "unknown";
}

function evidenceClass(scope: string): string {
  switch (scope) {
    case "strap_accessory_only":
    case "charger_stand_accessory_only":
    case "compatibility_rollup_accessory":
    case "strap_accessory_ambiguous_hold":
      return "strap_accessory_hold";
    case "watch_body_missing_core_components":
      return "body_candidate_hold";
    case "watch_body_with_premium_band_bundle":
      return "body_with_premium_band_reference_only";
    case "watch_body_with_accessory_bundle":
      return "body_with_bonus_band_reference_only";
    default:
      return "body_with_band_context_reference_only";
  }
}

function reportOnlyAction(scope: string): string {
  switch (scope) {
    case "strap_accessory_only":
      return "keep outside body candidates; accessory-only strap evidence";
    case "charger_stand_accessory_only":
      return "treat as charger/stand accessory evidence only; never body candidate";
    case "compatibility_rollup_accessory":
      return "treat as compatibility/accessory evidence only; never body candidate";
    case "strap_accessory_ambiguous_hold":
      return "hold until body inclusion is explicit";
    case "watch_body_missing_core_components":
      return "keep review-gated; body listing exists but core components are missing or explicitly absent";
    case "watch_body_with_premium_band_bundle":
      return "use as body+premium-band reference; do not demote to accessory-only";
    case "watch_body_with_accessory_bundle":
      return "use as body+bonus-band reference; keep body candidate separate from accessory count";
    default:
      return "use as body listing with ordinary strap mention; strap token alone is not a hold";
  }
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];

  const buckets = new Map<string, Sample[]>();
  const gatesByScope = new Map<string, Set<string>>();

  for (const sample of samples) {
    const scope = strapScopeFor(sample);
    if (!scope) continue;
    const rows = buckets.get(scope) ?? [];
    rows.push(sample);
    buckets.set(scope, rows);

    const gates = gatesByScope.get(scope) ?? new Set<string>();
    gates.add(classifyListing(sample.title ?? sample.name ?? "", sample.description ?? "", sample.price ?? 0).listingType);
    gatesByScope.set(scope, gates);
  }

  const evidenceRows: EvidenceRow[] = [...buckets.entries()]
    .map(([scope, rows]) => ({
      strapScope: scope,
      count: rows.length,
      gateMix: gateMix(gatesByScope.get(scope) ?? new Set<string>()),
      evidenceClass: evidenceClass(scope),
      reportOnlyAction: reportOnlyAction(scope),
      samplePids: rows.slice(0, 5).map((sample) => sample.pid ?? "-"),
      sampleTitles: rows.slice(0, 5).map(cleanTitle),
      runtimeApproved: false as const,
    }))
    .sort((a, b) => b.count - a.count || a.strapScope.localeCompare(b.strapScope));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    decision: "smartwatch_strap_accessory_evidence_report_only",
    metrics: {
      totalStrapSignalRows: evidenceRows.reduce((sum, row) => sum + row.count, 0),
      strapAccessoryOnlyRows: evidenceRows.find((row) => row.strapScope === "strap_accessory_only")?.count ?? 0,
      chargerStandAccessoryOnlyRows: evidenceRows.find((row) => row.strapScope === "charger_stand_accessory_only")?.count ?? 0,
      compatibilityRollupRows: evidenceRows.find((row) => row.strapScope === "compatibility_rollup_accessory")?.count ?? 0,
      bodyWithDefaultBandRows: evidenceRows.find((row) => row.strapScope === "watch_body_with_default_band_context")?.count ?? 0,
      bodyWithAccessoryBundleRows: evidenceRows.find((row) => row.strapScope === "watch_body_with_accessory_bundle")?.count ?? 0,
      bodyMissingCoreComponentRows: evidenceRows.find((row) => row.strapScope === "watch_body_missing_core_components")?.count ?? 0,
      premiumBandBundleRows: evidenceRows.find((row) => row.strapScope === "watch_body_with_premium_band_bundle")?.count ?? 0,
      scopeCount: evidenceRows.length,
      runtimeApprovedRows: 0,
    },
    evidenceRows,
    policyImplications: [
      "Strap or band tokens do not all mean the same thing; accessory-only rows, compatibility-only rows, and body listings with included bands must stay separate.",
      "Accessory-only strap rows remain hold evidence and must stay outside smartwatch body candidates.",
      "Body listings that include default, bonus, or premium bands are still body-context references, not accessory-only holds.",
      "Body listings with missing core components should stay review-gated instead of being merged into clean full-set positives.",
      "This report thickens smartwatch strap/accessory evidence only; it does not approve runtime parser or candidate-pool wiring.",
    ],
    nextReportOnlyExperiments: [
      "collect more Apple Watch and Galaxy Watch body listings with explicit default-band context so strap mention stops looking like a universal hold",
      "separate accessory-only strap compatibility posts from full body listings with bonus bands or premium loops",
      "pair strap accessory evidence with unknown connectivity review rows before any runtime split discussion",
    ],
    doNotDo: [
      "Do not downgrade every strap mention into accessory-only hold",
      "Do not treat band compatibility posts as body candidates",
      "Do not approve smartwatch runtime wiring from strap evidence alone",
      "Do not infer body inclusion when the listing only advertises strap compatibility or loose bands",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-strap-accessory-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| strap_scope | count | gate_mix | evidence_class | report_only_action | sample_pids | sample_titles | runtime_approved |",
    "| --- | ---: | --- | --- | --- | --- | --- | --- |",
    ...evidenceRows.map(
      (row) =>
        `| ${row.strapScope} | ${row.count} | ${row.gateMix} | ${row.evidenceClass} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} | ${row.sampleTitles.join("<br>")} | no |`,
    ),
  ].join("\n");

  const md = [
    "# Smartwatch Strap Accessory Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only smartwatch strap/accessory evidence. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- strap signal rows: ${report.metrics.totalStrapSignalRows}`,
    `- accessory-only strap rows: ${report.metrics.strapAccessoryOnlyRows}`,
    `- charger/stand accessory-only rows: ${report.metrics.chargerStandAccessoryOnlyRows}`,
    `- compatibility-only accessory rows: ${report.metrics.compatibilityRollupRows}`,
    `- body rows with default band context: ${report.metrics.bodyWithDefaultBandRows}`,
    `- body rows with accessory bundle: ${report.metrics.bodyWithAccessoryBundleRows}`,
    `- body rows missing core components: ${report.metrics.bodyMissingCoreComponentRows}`,
    `- body rows with premium band bundle: ${report.metrics.premiumBandBundleRows}`,
    `- distinct strap scopes: ${report.metrics.scopeCount}`,
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

  await writeFile(path.join(reportsDir, "smartwatch-strap-accessory-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-strap-accessory-evidence-latest.json");
  console.log("wrote reports/smartwatch-strap-accessory-evidence-latest.md");
  console.log(`smartwatch strap accessory evidence: scopes=${evidenceRows.length}, total=${report.metrics.totalStrapSignalRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
