import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
  seller?: {
    review_count?: number | null;
    sales_count?: number | null;
    proshop?: boolean | null;
    is_official?: boolean | null;
  };
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "applewatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");
const globalExclude = /(삽니다|구매|매입|교환|부품용|고장|파손|수리|케이스만|보호필름|스트랩만|충전독|호환)/;
const generationPattern = /(series\s*9|시리즈\s*9|애플워치\s*9)/;
const sizePattern = /\b45mm\b/;
const gpsPattern = /\bgps\b/;
const batteryPattern = /(배터리\s*(?:9[0-9]%|100%|90)|배터리.*(?:9[0-9]%|100%)|90퍼|100프로)/;
const premiumBundlePattern = /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프)/;
const strapPattern = /(밴드|스트랩)/;
const boxOnlyPattern = /(박스|풀박스|충전기|케이블)/;
const ownerCarePattern = /(사용 빈도수 줄어서|항상 케이스|기스 없음|스크래치 없음|관리 잘|깨끗하게 사용|실사용|사용감 있음|아껴서 사용|상태 좋)/;
const bundlePattern = /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩|충전기|케이블|박스|풀박스)/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function textFor(sample: Sample): string {
  return normalize(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const rows = samples.filter((sample) => {
    const text = textFor(sample);
    return !globalExclude.test(text) &&
      generationPattern.test(text) &&
      sizePattern.test(text) &&
      gpsPattern.test(text) &&
      batteryPattern.test(text) &&
      bundlePattern.test(text);
  });

  const premiumBundleRows = rows.filter((row) => premiumBundlePattern.test(textFor(row)));
  const strapOnlyRows = rows.filter((row) => strapPattern.test(textFor(row)) && !premiumBundlePattern.test(textFor(row)) && !boxOnlyPattern.test(textFor(row)));
  const boxOnlyRows = rows.filter((row) => boxOnlyPattern.test(textFor(row)) && !premiumBundlePattern.test(textFor(row)) && !strapPattern.test(textFor(row)));
  const accessoryHeavyRows = rows.filter((row) => strapPattern.test(textFor(row)) && boxOnlyPattern.test(textFor(row)));
  const ownerCareBundleRows = rows.filter((row) => ownerCarePattern.test(textFor(row)) && bundlePattern.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_bundle_adjacent_lanes_report_only",
    metrics: {
      totalBundleAdjacentRows: rows.length,
      premiumBundleRows: premiumBundleRows.length,
      strapOnlyRows: strapOnlyRows.length,
      boxOnlyRows: boxOnlyRows.length,
      accessoryHeavyRows: accessoryHeavyRows.length,
      ownerCareBundleRows: ownerCareBundleRows.length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      premiumBundlePids: premiumBundleRows.map((row) => row.pid ?? "-"),
      strapOnlyPids: strapOnlyRows.map((row) => row.pid ?? "-"),
      boxOnlyPids: boxOnlyRows.map((row) => row.pid ?? "-"),
      accessoryHeavyPids: accessoryHeavyRows.map((row) => row.pid ?? "-"),
      ownerCareBundlePids: ownerCareBundleRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet decomposes the current Series9 bundle-adjacent rows so the nearby noise is not treated as one blob.",
      "If most adjacent rows are box-only rather than premium-bundle, the lane may be less toxic than it first looked, but still not clean evidence.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "compare box-only adjacent rows against the coherent core before deciding whether they deserve a softer penalty than premium bundle rows",
      "keep owner-care-plus-bundle rows separate so emotional seller context does not inflate the clean lane",
    ],
    doNotDo: [
      "Do not merge any bundle-adjacent lane into the coherent clean lane",
      "Do not treat box-only adjacency as runtime-safe evidence",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-bundle-adjacent-lanes-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Bundle Adjacent Lanes",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only decomposition of Series9 bundle-adjacent rows.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Lane Samples",
    "",
    ...Object.entries(report.laneSamples).map(([k, v]) => `- ${k}: ${(v as Array<string | number>).join(', ') || '-'}`),
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
  ].join('\n');
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-bundle-adjacent-lanes-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-bundle-adjacent-lanes-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-bundle-adjacent-lanes-latest.md");
  console.log(`applewatch series9 bundle adjacent: total=${rows.length}, premium=${premiumBundleRows.length}, box_only=${boxOnlyRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
