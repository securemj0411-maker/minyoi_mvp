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
const bundlePattern = /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩|충전기|케이블|박스|풀박스)/;
const cellularPattern = /(cellular|셀룰러|lte)/;
const unopenedPattern = /(미개봉|새상품|새제품|미사용|거의\s*새제품|실착\s*적음)/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function titleFor(sample: Sample): string {
  return normalize(sample.title ?? sample.name ?? "");
}

function descriptionFor(sample: Sample): string {
  return normalize(sample.description ?? "");
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

function hasDescriptionCarriedSignal(sample: Sample): boolean {
  const title = titleFor(sample);
  const description = descriptionFor(sample);
  return (
    (!batteryPattern.test(title) && batteryPattern.test(description)) ||
    (!gpsPattern.test(title) && gpsPattern.test(description))
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

  const coherentCoreRows = baseRows.filter((row) => coherentCore.has(String(row.pid ?? "")));
  const adjacentOwnerCareRows = baseRows.filter((row) =>
    !coherentCore.has(String(row.pid ?? "")) &&
    ownerCarePattern.test(textFor(row)) &&
    !merchantLike(row) &&
    !bundlePattern.test(textFor(row)) &&
    !cellularPattern.test(textFor(row)) &&
    !unopenedPattern.test(textFor(row)),
  );
  const adjacentDescriptionCarriedRows = baseRows.filter((row) =>
    !coherentCore.has(String(row.pid ?? "")) &&
    hasDescriptionCarriedSignal(row) &&
    !merchantLike(row) &&
    !bundlePattern.test(textFor(row)) &&
    !cellularPattern.test(textFor(row)) &&
    !unopenedPattern.test(textFor(row)),
  );
  const bundleAdjacentRows = baseRows.filter((row) =>
    !coherentCore.has(String(row.pid ?? "")) &&
    bundlePattern.test(textFor(row)),
  );
  const merchantLikeRows = baseRows.filter((row) =>
    !coherentCore.has(String(row.pid ?? "")) &&
    merchantLike(row),
  );
  const cellularConflictRows = baseRows.filter((row) =>
    !coherentCore.has(String(row.pid ?? "")) &&
    cellularPattern.test(textFor(row)),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_coherent_lane_thickening_report_only",
    metrics: {
      totalRows: baseRows.length,
      coherentCoreRows: coherentCoreRows.length,
      adjacentOwnerCareRows: adjacentOwnerCareRows.length,
      adjacentDescriptionCarriedRows: adjacentDescriptionCarriedRows.length,
      bundleAdjacentRows: bundleAdjacentRows.length,
      merchantLikeRows: merchantLikeRows.length,
      cellularConflictRows: cellularConflictRows.length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      coherentCorePids: coherentCoreRows.map((row) => row.pid ?? "-"),
      adjacentOwnerCarePids: adjacentOwnerCareRows.map((row) => row.pid ?? "-"),
      adjacentDescriptionCarriedPids: adjacentDescriptionCarriedRows.map((row) => row.pid ?? "-"),
      bundleAdjacentPids: bundleAdjacentRows.map((row) => row.pid ?? "-"),
      merchantLikePids: merchantLikeRows.map((row) => row.pid ?? "-"),
      cellularConflictPids: cellularConflictRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet checks whether the coherent Series9 clean row can be thickened by adjacent owner-care or description-carried rows without collapsing into bundle or cellular noise.",
      "If adjacent non-bundle non-cellular rows stay alive, Series9 can graduate from a singleton coherent story into a narrow but thickening lane.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "look for one more non-merchant adjacent row that shares the same quiet owner-care shape as the coherent core",
      "keep bundle-adjacent and cellular-conflict rows isolated so they do not inflate the coherent lane",
    ],
    doNotDo: [
      "Do not treat adjacency as runtime approval",
      "Do not merge bundle-adjacent rows into the coherent clean lane",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-coherent-lane-thickening-latest.json"),
    JSON.stringify(report, null, 2),
  );
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Coherent Lane Thickening",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only thickening packet for the coherent Series9 clean lane.",
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-coherent-lane-thickening-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-coherent-lane-thickening-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-coherent-lane-thickening-latest.md");
  console.log(`applewatch series9 coherent thickening: core=${coherentCoreRows.length}, adjacent_owner_care=${adjacentOwnerCareRows.length}, adjacent_description=${adjacentDescriptionCarriedRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
