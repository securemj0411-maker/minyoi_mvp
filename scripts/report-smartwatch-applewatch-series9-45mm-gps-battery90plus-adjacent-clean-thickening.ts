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
const ownerCarePattern = /(사용 빈도수 줄어서|항상 케이스|기스 없음|스크래치 없음|관리 잘|깨끗하게 사용|실사용|사용감 있음|아껴서 사용|상태 좋)/;
const bundlePattern = /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩|충전기|케이블|박스|풀박스|설명서)/;
const cellularPattern = /(cellular|셀룰러|lte)/;
const unopenedPattern = /(미개봉|새상품|새제품|미사용|실착\s*적음|거의\s*새제품)/;
const personalReasonPattern = /(직거래|선물받|사용을\s*잘\s*안해|사용을\s*못해|자금|정리|처분)/;

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
  const adjacentCleanRows = adjacentRows.filter((row) =>
    !merchantLike(row) &&
    !bundlePattern.test(textFor(row)) &&
    !cellularPattern.test(textFor(row)) &&
    !unopenedPattern.test(textFor(row)),
  );
  const adjacentOwnerCareRows = adjacentCleanRows.filter((row) => ownerCarePattern.test(textFor(row)));
  const adjacentPersonalReasonRows = adjacentCleanRows.filter((row) => personalReasonPattern.test(textFor(row)));
  const adjacentSignalCarrierRows = adjacentCleanRows.filter((row) => batteryPattern.test(textFor(row)) && gpsPattern.test(textFor(row)));
  const adjacentBundleRows = adjacentRows.filter((row) => bundlePattern.test(textFor(row)));
  const adjacentCellularRows = adjacentRows.filter((row) => cellularPattern.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_adjacent_clean_thickening_report_only",
    metrics: {
      baseRows: baseRows.length,
      coherentCoreRows: baseRows.filter((row) => coherentCore.has(String(row.pid ?? ""))).length,
      adjacentRows: adjacentRows.length,
      adjacentCleanRows: adjacentCleanRows.length,
      adjacentOwnerCareRows: adjacentOwnerCareRows.length,
      adjacentPersonalReasonRows: adjacentPersonalReasonRows.length,
      adjacentSignalCarrierRows: adjacentSignalCarrierRows.length,
      adjacentBundleRows: adjacentBundleRows.length,
      adjacentCellularRows: adjacentCellularRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: {
      coherentCore: baseRows.filter((row) => coherentCore.has(String(row.pid ?? ""))).map((row) => row.pid ?? "-"),
      adjacentClean: adjacentCleanRows.map((row) => row.pid ?? "-"),
      adjacentOwnerCare: adjacentOwnerCareRows.map((row) => row.pid ?? "-"),
      adjacentPersonalReason: adjacentPersonalReasonRows.map((row) => row.pid ?? "-"),
      adjacentBundle: adjacentBundleRows.map((row) => row.pid ?? "-"),
      adjacentCellular: adjacentCellularRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet checks whether the current Series9 coherent core can grow into a real adjacent clean lane without relying on bundle or cellular baggage.",
      "If adjacent clean rows stay at zero while owner-care/personal-reason rows remain trapped inside noisy carriers, the lane stays a singleton story.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "look for one more non-bundle non-cellular adjacent row that preserves owner-care or personal-reason context",
      "keep bundle-adjacent and cellular-adjacent rows isolated so they do not inflate the clean lane story",
    ],
    doNotDo: [
      "Do not treat owner-care wording inside noisy rows as clean thickening",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-thickening-latest.json"),
    JSON.stringify(report, null, 2),
  );
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Adjacent Clean Thickening",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only packet for testing whether the current Series9 coherent core can gain true adjacent clean density.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Sample PIDs",
    "",
    ...Object.entries(report.samplePids).map(([k, v]) => `- ${k}: ${(v as Array<string | number>).join(", ") || "-"}`),
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
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-thickening-latest.md"),
    `${md}\n`,
  );
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-thickening-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-thickening-latest.md");
  console.log(
    `applewatch series9 adjacent clean thickening: coherent=${report.metrics.coherentCoreRows}, clean=${report.metrics.adjacentCleanRows}, bundle=${report.metrics.adjacentBundleRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
