import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
};

type OverlapReport = {
  overlapPids?: Record<string, Array<string | number>>;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "applewatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");
const globalExclude = /(삽니다|구매|매입|교환|부품용|고장|파손|수리|케이스만|보호필름|스트랩만|충전독|호환)/;
const generationPattern = /(series\s*9|시리즈\s*9|애플워치\s*9)/;
const sizePattern = /\b45mm\b/;
const gpsPattern = /\bgps\b/;
const batteryPattern = /(배터리\s*(?:9[0-9]%|100%|90)|배터리.*(?:9[0-9]%|100%)|90퍼|100프로)/;
const boxPattern = /(박스|풀박스|설명서|충전기|케이블)/;
const strapPattern = /(밴드|스트랩|루프|밀레니즈)/;
const ownerCarePattern = /(사용 빈도수 줄어서|항상 케이스|기스 없음|스크래치 없음|관리 잘|깨끗하게 사용|실사용|사용감 있음|아껴서 사용|상태 좋|보관)/;
const cosmeticWearPattern = /(스크래치|긁힘|기스|찍힘)/;
const sellerPitchPattern = /(에눌가능|편하게 연락|궁금한거 있으시면|연락주세요|네고가능|쿨거시)/;
const cellularPattern = /(cellular|셀룰러|lte)/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function textFor(sample: Sample): string {
  return normalize(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
}

function classify(sample: Sample): string {
  const text = textFor(sample);
  const hasBox = boxPattern.test(text);
  const hasStrap = strapPattern.test(text);
  const hasOwner = ownerCarePattern.test(text);
  const hasPitch = sellerPitchPattern.test(text);
  const hasCosmetic = cosmeticWearPattern.test(text);
  const hasCellular = cellularPattern.test(text);

  if (hasBox && hasOwner && !hasStrap) return "box_ownercare";
  if (hasStrap && hasOwner) return "strap_ownercare";
  if (hasPitch) return "bundle_pitch";
  if (hasCosmetic && hasBox) return "box_cosmetic";
  if (hasCellular) return "bundle_cellular";
  return "other_bundle_neighbor";
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const overlap = JSON.parse(
    await readFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-clean-overlap-latest.json"), "utf8"),
  ) as OverlapReport;
  const coherentCore = new Set((overlap.overlapPids?.allThree ?? []).map((pid) => String(pid)));

  const baseRows = samples.filter((sample) => {
    const text = textFor(sample);
    return !globalExclude.test(text) &&
      generationPattern.test(text) &&
      sizePattern.test(text) &&
      gpsPattern.test(text) &&
      batteryPattern.test(text);
  });

  const adjacentRows = baseRows.filter((row) => !coherentCore.has(String(row.pid ?? "")));
  const classes = adjacentRows.reduce<Record<string, Array<string | number>>>((acc, row) => {
    const cls = classify(row);
    acc[cls] ??= [];
    acc[cls].push(row.pid ?? "-");
    return acc;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_adjacent_row_composition_report_only",
    metrics: {
      adjacentRows: adjacentRows.length,
      boxOwnerCareRows: (classes.box_ownercare ?? []).length,
      strapOwnerCareRows: (classes.strap_ownercare ?? []).length,
      bundlePitchRows: (classes.bundle_pitch ?? []).length,
      boxCosmeticRows: (classes.box_cosmetic ?? []).length,
      bundleCellularRows: (classes.bundle_cellular ?? []).length,
      otherBundleNeighborRows: (classes.other_bundle_neighbor ?? []).length,
      runtimeApprovedRows: 0,
    },
    laneSamples: classes,
    policyImplications: [
      "This packet turns the five Series9 adjacent rows into narrow composition classes so we stop talking about them as one generic noisy halo.",
      "If the composition stays concentrated in box/strap owner-care plus seller-pitch bundle rows, the lane remains explanatory only.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "watch whether any future adjacent row leaves the owner-care/pitch-heavy bundle classes",
      "keep box-led and strap-led owner-care lanes separate before discussing softer packaging evidence",
    ],
    doNotDo: [
      "Do not infer clean adjacency from these composition classes",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-row-composition-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Adjacent Row Composition",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only composition split for the five adjacent Series9 rows.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Lane Samples",
    "",
    ...Object.entries(report.laneSamples).map(([k, v]) => `- ${k}: ${(v as Array<string | number>).join(", ") || "-"}`),
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-row-composition-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-row-composition-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-row-composition-latest.md");
  console.log(`applewatch series9 adjacent row composition: adjacent=${adjacentRows.length}, box_ownercare=${report.metrics.boxOwnerCareRows}, strap_ownercare=${report.metrics.strapOwnerCareRows}, pitch=${report.metrics.bundlePitchRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
