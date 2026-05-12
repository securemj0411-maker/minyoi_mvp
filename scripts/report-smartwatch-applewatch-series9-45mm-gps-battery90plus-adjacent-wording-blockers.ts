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
const bundlePattern = /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩|충전기|케이블|박스|풀박스|설명서)/;
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

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_adjacent_wording_blockers_report_only",
    metrics: {
      adjacentRows: adjacentRows.length,
      bundleRows: adjacentRows.filter((row) => bundlePattern.test(textFor(row))).length,
      boxRows: adjacentRows.filter((row) => boxPattern.test(textFor(row))).length,
      strapRows: adjacentRows.filter((row) => strapPattern.test(textFor(row))).length,
      ownerCareRows: adjacentRows.filter((row) => ownerCarePattern.test(textFor(row))).length,
      cosmeticWearRows: adjacentRows.filter((row) => cosmeticWearPattern.test(textFor(row))).length,
      sellerPitchRows: adjacentRows.filter((row) => sellerPitchPattern.test(textFor(row))).length,
      cellularRows: adjacentRows.filter((row) => cellularPattern.test(textFor(row))).length,
      boxAndOwnerCareRows: adjacentRows.filter((row) => boxPattern.test(textFor(row)) && ownerCarePattern.test(textFor(row))).length,
      strapAndOwnerCareRows: adjacentRows.filter((row) => strapPattern.test(textFor(row)) && ownerCarePattern.test(textFor(row))).length,
      bundleAndPitchRows: adjacentRows.filter((row) => bundlePattern.test(textFor(row)) && sellerPitchPattern.test(textFor(row))).length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      adjacentPids: adjacentRows.map((row) => row.pid ?? "-"),
      boxAndOwnerCarePids: adjacentRows.filter((row) => boxPattern.test(textFor(row)) && ownerCarePattern.test(textFor(row))).map((row) => row.pid ?? "-"),
      strapAndOwnerCarePids: adjacentRows.filter((row) => strapPattern.test(textFor(row)) && ownerCarePattern.test(textFor(row))).map((row) => row.pid ?? "-"),
      bundleAndPitchPids: adjacentRows.filter((row) => bundlePattern.test(textFor(row)) && sellerPitchPattern.test(textFor(row))).map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet counts which wording blockers dominate the five Series9 adjacent rows, so we stop treating the surrounding noise as one generic bundle blob.",
      "If box/strap/owner-care/cosmetic/pitch signals all stay high together, the adjacent lane is still explanatory noise rather than a clean thickening lane.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "watch whether any future adjacent row drops both bundle tokens and seller-state wording together",
      "keep box-led and strap-led blockers separate before any softer packaging interpretation is discussed",
    ],
    doNotDo: [
      "Do not infer clean adjacency from residual wording alone",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-wording-blockers-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Adjacent Wording Blockers",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only blocker count for the five adjacent Series9 rows.",
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
  ].join("\n");
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-wording-blockers-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-wording-blockers-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-wording-blockers-latest.md");
  console.log(`applewatch series9 adjacent wording blockers: adjacent=${adjacentRows.length}, bundle=${report.metrics.bundleRows}, ownercare=${report.metrics.ownerCareRows}, pitch=${report.metrics.sellerPitchRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
