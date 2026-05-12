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
const boxPattern = /(박스|풀박스|설명서|충전기|케이블)/;
const strapPattern = /(밴드|스트랩|루프|밀레니즈)/;
const ownerCarePattern = /(사용 빈도수 줄어서|항상 케이스|기스 없음|스크래치 없음|관리 잘|깨끗하게 사용|실사용|사용감 있음|아껴서 사용|상태 좋)/;
const cellularPattern = /(cellular|셀룰러|lte)/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function textFor(sample: Sample): string {
  return normalize(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
}

function merchantLike(sample: Sample): boolean {
  const seller = sample.seller ?? {};
  return Boolean(
    seller.proshop ||
      seller.is_official ||
      Number(seller.review_count ?? 0) >= 30 ||
      Number(seller.sales_count ?? 0) >= 30,
  );
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
      (boxPattern.test(text) || strapPattern.test(text));
  });

  const boxOnlyRows = rows.filter((row) => boxPattern.test(textFor(row)) && !strapPattern.test(textFor(row)));
  const strapPresentRows = rows.filter((row) => strapPattern.test(textFor(row)));
  const boxAndStrapRows = rows.filter((row) => boxPattern.test(textFor(row)) && strapPattern.test(textFor(row)));
  const boxOwnerCareRows = rows.filter((row) => boxPattern.test(textFor(row)) && ownerCarePattern.test(textFor(row)));
  const strapOwnerCareRows = rows.filter((row) => strapPattern.test(textFor(row)) && ownerCarePattern.test(textFor(row)));
  const cellularContaminatedRows = rows.filter((row) => cellularPattern.test(textFor(row)));
  const merchantLikeRows = rows.filter(merchantLike);

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_box_vs_strap_adjacency_report_only",
    metrics: {
      totalAdjacentBundleRows: rows.length,
      boxOnlyRows: boxOnlyRows.length,
      strapPresentRows: strapPresentRows.length,
      boxAndStrapRows: boxAndStrapRows.length,
      boxOwnerCareRows: boxOwnerCareRows.length,
      strapOwnerCareRows: strapOwnerCareRows.length,
      cellularContaminatedRows: cellularContaminatedRows.length,
      merchantLikeRows: merchantLikeRows.length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      boxOnlyPids: boxOnlyRows.map((row) => row.pid ?? "-"),
      strapPresentPids: strapPresentRows.map((row) => row.pid ?? "-"),
      boxAndStrapPids: boxAndStrapRows.map((row) => row.pid ?? "-"),
      boxOwnerCarePids: boxOwnerCareRows.map((row) => row.pid ?? "-"),
      strapOwnerCarePids: strapOwnerCareRows.map((row) => row.pid ?? "-"),
      cellularContaminatedPids: cellularContaminatedRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet separates Series9 adjacent bundle pressure into box-led versus strap-led slices so we can see whether the nearby rows look like harmless packaging context or wider accessory drift.",
      "If strap-present rows dominate adjacency, the lane is still more accessory-shaped than core-body shaped even when owner-care language appears.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "compare box-only adjacency against the coherent core before deciding whether packaging context deserves a softer penalty than strap-led adjacency",
      "keep strap-present owner-care rows separate so emotional seller language does not inflate the clean lane",
    ],
    doNotDo: [
      "Do not merge box-led or strap-led adjacent rows into the coherent clean lane",
      "Do not use this packet as runtime confidence evidence",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-box-vs-strap-adjacency-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Box vs Strap Adjacency",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only decomposition of Series9 adjacent bundle rows into box-led and strap-led slices.",
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-box-vs-strap-adjacency-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-box-vs-strap-adjacency-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-box-vs-strap-adjacency-latest.md");
  console.log(`applewatch series9 box-vs-strap adjacency: total=${rows.length}, box_only=${boxOnlyRows.length}, strap_present=${strapPresentRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
