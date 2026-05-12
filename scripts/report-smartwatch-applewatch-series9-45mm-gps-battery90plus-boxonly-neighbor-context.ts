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
const ownerCarePattern = /(항상 케이스|기스 없음|스크래치 없음|관리 잘|깨끗하게 사용|상태 좋|보관)/;
const cosmeticWearPattern = /(스크래치|긁힘|기스|찍힘)/;
const pitchPattern = /(에눌가능|편하게 연락|궁금한거 있으시면|연락주세요|네고가능)/;
const cellularPattern = /(cellular|셀룰러|lte)/;

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function merchantLike(sample: Sample): boolean {
  const s = sample.seller ?? {};
  return Boolean(s.proshop || s.is_official || Number(s.review_count ?? 0) >= 30 || Number(s.sales_count ?? 0) >= 30);
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
      boxPattern.test(text) &&
      !strapPattern.test(text);
  });

  const ownerCareRows = rows.filter((row) => ownerCarePattern.test(textFor(row)));
  const cosmeticWearRows = rows.filter((row) => cosmeticWearPattern.test(textFor(row)));
  const sellerPitchRows = rows.filter((row) => pitchPattern.test(textFor(row)));
  const cellularRows = rows.filter((row) => cellularPattern.test(textFor(row)));
  const nonMerchantRows = rows.filter((row) => !merchantLike(row));
  const cleanBoxPackagingRows = rows.filter((row) =>
    !ownerCarePattern.test(textFor(row)) &&
    !cosmeticWearPattern.test(textFor(row)) &&
    !pitchPattern.test(textFor(row)) &&
    !cellularPattern.test(textFor(row)) &&
    !merchantLike(row),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_boxonly_neighbor_context_report_only",
    metrics: {
      totalBoxOnlyRows: rows.length,
      ownerCareRows: ownerCareRows.length,
      cosmeticWearRows: cosmeticWearRows.length,
      sellerPitchRows: sellerPitchRows.length,
      cellularRows: cellularRows.length,
      nonMerchantRows: nonMerchantRows.length,
      cleanBoxPackagingRows: cleanBoxPackagingRows.length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      boxOnlyPids: rows.map((row) => row.pid ?? "-"),
      ownerCarePids: ownerCareRows.map((row) => row.pid ?? "-"),
      cosmeticWearPids: cosmeticWearRows.map((row) => row.pid ?? "-"),
      sellerPitchPids: sellerPitchRows.map((row) => row.pid ?? "-"),
      cleanBoxPackagingPids: cleanBoxPackagingRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet checks whether the two Series9 box-only adjacent rows are harmless packaging context or still carry enough cosmetic/seller-state wording to remain noisy neighbors.",
      "If cleanBoxPackagingRows stays at zero, even box-only adjacency should stay out of the coherent lane story.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "watch whether future box-only rows arrive without owner-care/cosmetic/seller-pitch overlays",
      "keep box-only neighbors separate from strap-present neighbors so packaging context is not overclaimed",
    ],
    doNotDo: [
      "Do not treat box-only adjacency as clean lane support when cleanBoxPackagingRows is zero",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-boxonly-neighbor-context-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Box-Only Neighbor Context",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only packet for the two box-only adjacent Series9 rows.",
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-boxonly-neighbor-context-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-boxonly-neighbor-context-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-boxonly-neighbor-context-latest.md");
  console.log(`applewatch series9 boxonly neighbor context: total=${rows.length}, clean_box_packaging=${cleanBoxPackagingRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
