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

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const overlap = JSON.parse(
    await readFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-clean-overlap-latest.json"), "utf8"),
  ) as OverlapReport;
  const coherentCore = new Set((overlap.overlapPids?.allThree ?? []).map((pid) => String(pid)));

  const adjacentRows = samples.filter((sample) => {
    const text = textFor(sample);
    return !coherentCore.has(String(sample.pid ?? "")) &&
      !globalExclude.test(text) &&
      generationPattern.test(text) &&
      sizePattern.test(text) &&
      gpsPattern.test(text) &&
      batteryPattern.test(text) &&
      ownerCarePattern.test(text);
  });

  const boxOwnerCare = adjacentRows.filter((row) => boxPattern.test(textFor(row)) && !strapPattern.test(textFor(row)));
  const strapOwnerCare = adjacentRows.filter((row) => strapPattern.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_ownercare_lane_purity_report_only",
    metrics: {
      ownerCareAdjacentRows: adjacentRows.length,
      boxOwnerCareRows: boxOwnerCare.length,
      strapOwnerCareRows: strapOwnerCare.length,
      boxOwnerCareWithCosmeticRows: boxOwnerCare.filter((row) => cosmeticWearPattern.test(textFor(row))).length,
      boxOwnerCareWithPitchRows: boxOwnerCare.filter((row) => sellerPitchPattern.test(textFor(row))).length,
      strapOwnerCareWithPitchRows: strapOwnerCare.filter((row) => sellerPitchPattern.test(textFor(row))).length,
      strapOwnerCareWithCellularRows: strapOwnerCare.filter((row) => cellularPattern.test(textFor(row))).length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      boxOwnerCarePids: boxOwnerCare.map((row) => row.pid ?? "-"),
      strapOwnerCarePids: strapOwnerCare.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet isolates the owner-care flavored adjacent rows so we can see whether box-led and strap-led lanes are getting cleaner or just carrying different baggage.",
      "If pitch/cellular/cosmetic baggage stays attached, owner-care alone is not enough to treat either lane as clean adjacent support.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "watch whether future box-owner-care rows lose cosmetic/pitch overlays",
      "watch whether future strap-owner-care rows lose cellular baggage",
    ],
    doNotDo: [
      "Do not treat owner-care wording as clean support by itself",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-ownercare-lane-purity-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Owner-Care Lane Purity",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only split for Series9 adjacent owner-care flavored rows.",
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-ownercare-lane-purity-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-ownercare-lane-purity-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-ownercare-lane-purity-latest.md");
  console.log(`applewatch series9 ownercare purity: ownercare=${adjacentRows.length}, box=${report.metrics.boxOwnerCareRows}, strap=${report.metrics.strapOwnerCareRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
