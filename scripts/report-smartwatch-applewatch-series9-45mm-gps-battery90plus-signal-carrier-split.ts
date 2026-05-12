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
const modelPattern = /(series\s*9|시리즈\s*9|애플워치\s*9).*\b45mm\b|\b45mm\b.*(series\s*9|시리즈\s*9|애플워치\s*9)/;
const bundlePattern = /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩|충전기|케이블|박스|풀박스)/;
const unopenedOrCellularPattern = /(미개봉|새상품|새제품|미사용|거의\s*새제품|실착\s*적음|cellular|셀룰러|lte)/;

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

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const rows = samples.filter((sample) => {
    const t = textFor(sample);
    return !globalExclude.test(t) &&
      generationPattern.test(t) &&
      sizePattern.test(t) &&
      gpsPattern.test(t) &&
      batteryPattern.test(t);
  });

  const titleBatteryRows = rows.filter((row) => batteryPattern.test(titleFor(row)));
  const descriptionOnlyBatteryRows = rows.filter((row) => !batteryPattern.test(titleFor(row)) && batteryPattern.test(descriptionFor(row)));
  const titleGpsRows = rows.filter((row) => gpsPattern.test(titleFor(row)));
  const descriptionOnlyGpsRows = rows.filter((row) => !gpsPattern.test(titleFor(row)) && gpsPattern.test(descriptionFor(row)));
  const titleModelRows = rows.filter((row) => modelPattern.test(titleFor(row)));
  const descriptionOnlyModelRows = rows.filter((row) => !modelPattern.test(titleFor(row)) && modelPattern.test(descriptionFor(row)));
  const descriptionCarriedRows = rows.filter((row) =>
    (
      (!batteryPattern.test(titleFor(row)) && batteryPattern.test(descriptionFor(row))) ||
      (!gpsPattern.test(titleFor(row)) && gpsPattern.test(descriptionFor(row))) ||
      (!modelPattern.test(titleFor(row)) && modelPattern.test(descriptionFor(row)))
    ),
  );
  const descriptionCarriedCleanRows = descriptionCarriedRows.filter((row) =>
    !merchantLike(row) &&
    !bundlePattern.test(textFor(row)) &&
    !unopenedOrCellularPattern.test(textFor(row)),
  );
  const descriptionCarriedBundleRows = descriptionCarriedRows.filter((row) => bundlePattern.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_signal_carrier_split_report_only",
    metrics: {
      totalRows: rows.length,
      titleBatteryRows: titleBatteryRows.length,
      descriptionOnlyBatteryRows: descriptionOnlyBatteryRows.length,
      titleGpsRows: titleGpsRows.length,
      descriptionOnlyGpsRows: descriptionOnlyGpsRows.length,
      titleModelRows: titleModelRows.length,
      descriptionOnlyModelRows: descriptionOnlyModelRows.length,
      descriptionCarriedCleanRows: descriptionCarriedCleanRows.length,
      descriptionCarriedBundleRows: descriptionCarriedBundleRows.length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      titleBatteryPids: titleBatteryRows.slice(0, 10).map((row) => row.pid ?? "-"),
      descriptionOnlyBatteryPids: descriptionOnlyBatteryRows.slice(0, 10).map((row) => row.pid ?? "-"),
      titleGpsPids: titleGpsRows.slice(0, 10).map((row) => row.pid ?? "-"),
      descriptionOnlyGpsPids: descriptionOnlyGpsRows.slice(0, 10).map((row) => row.pid ?? "-"),
      titleModelPids: titleModelRows.slice(0, 10).map((row) => row.pid ?? "-"),
      descriptionOnlyModelPids: descriptionOnlyModelRows.slice(0, 10).map((row) => row.pid ?? "-"),
      descriptionCarriedCleanPids: descriptionCarriedCleanRows.slice(0, 10).map((row) => row.pid ?? "-"),
      descriptionCarriedBundlePids: descriptionCarriedBundleRows.slice(0, 10).map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet measures whether clean Series9 45mm GPS battery90+ evidence is expressed directly in titles or is mostly carried by descriptions.",
      "If description-only battery and GPS cues dominate while clean description-carried rows still survive, title-only narrowing would undercount the healthier Series9 lane.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "compare description-carried clean rows against owner-care and condition splits before any Series9 priority bump",
      "keep description-carried bundle rows separate so accessory payload does not masquerade as clean density",
    ],
    doNotDo: [
      "Do not infer title silence means missing signal when description-carried evidence is present",
      "Do not promote this packet into runtime confidence from carrier metrics alone",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-signal-carrier-split-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Signal Carrier Split",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only title-vs-description signal-carrier split for Series9 45mm GPS battery90+ rows.",
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-signal-carrier-split-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-signal-carrier-split-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-signal-carrier-split-latest.md");
  console.log(
    `applewatch series9 signal carrier split: total=${rows.length}, description_clean=${descriptionCarriedCleanRows.length}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
