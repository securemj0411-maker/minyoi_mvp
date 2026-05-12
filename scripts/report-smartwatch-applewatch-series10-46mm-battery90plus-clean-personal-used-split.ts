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
const bundlePattern = /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩|충전기|케이블|박스|풀박스)/;
const premiumPitchPattern = /(애케플|케어플러스|프리미엄|특가|급처|최상급)/;
const unopenedLike = /(미개봉|새상품|새제품|미사용|거의\s*새제품)/;
const cellularConflict = /(cellular|셀룰러|lte)/;
const gpsCleanPattern = /(gps|블루투스|wifi|와이파이)/;
const personalContextPattern = /(실사용|직거래|초기화|상태\s*좋|깨끗|기스|사용감|몇번\s*착용|배터리\s*성능|배터리\s*\d{2,3}%)/;
const battery90Pattern = /(배터리\s*(성능)?\s*(9\d|100)\s*%?|battery\s*(health)?\s*(9\d|100)\s*%?)/;

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function merchantLike(sample: Sample): boolean {
  const s = sample.seller ?? {};
  return Boolean(s.proshop || s.is_official || Number(s.review_count ?? 0) >= 30 || Number(s.sales_count ?? 0) >= 30);
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];

  const baseRows = samples.filter((sample) => {
    const t = textFor(sample);
    return !globalExclude.test(t) &&
      /(series\s*10|시리즈\s*10|애플워치\s*10)/.test(t) &&
      /\b46mm\b|46m\b/.test(t) &&
      battery90Pattern.test(t);
  });

  const nonMerchantRows = baseRows.filter((row) => !merchantLike(row));
  const personalUsedRows = nonMerchantRows.filter((row) => personalContextPattern.test(textFor(row)));
  const explicitGpsOrCleanConnectivityRows = personalUsedRows.filter((row) => gpsCleanPattern.test(textFor(row)) || !cellularConflict.test(textFor(row)));
  const bundleRows = explicitGpsOrCleanConnectivityRows.filter((row) => bundlePattern.test(textFor(row)));
  const premiumPitchRows = explicitGpsOrCleanConnectivityRows.filter((row) => premiumPitchPattern.test(textFor(row)));
  const unopenedRows = explicitGpsOrCleanConnectivityRows.filter((row) => unopenedLike.test(textFor(row)));
  const cellularRows = explicitGpsOrCleanConnectivityRows.filter((row) => cellularConflict.test(textFor(row)));
  const cleanPersonalUsedRows = explicitGpsOrCleanConnectivityRows.filter((row) => {
    const t = textFor(row);
    return !bundlePattern.test(t) && !premiumPitchPattern.test(t) && !unopenedLike.test(t) && !cellularConflict.test(t);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series10_46mm_battery90plus_clean_personal_used_split_report_only",
    metrics: {
      baseRows: baseRows.length,
      nonMerchantRows: nonMerchantRows.length,
      personalUsedRows: personalUsedRows.length,
      explicitGpsOrCleanConnectivityRows: explicitGpsOrCleanConnectivityRows.length,
      bundleRows: bundleRows.length,
      premiumPitchRows: premiumPitchRows.length,
      unopenedRows: unopenedRows.length,
      cellularRows: cellularRows.length,
      cleanPersonalUsedRows: cleanPersonalUsedRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: {
      base: baseRows.map((row) => row.pid ?? "-"),
      cleanPersonalUsed: cleanPersonalUsedRows.map((row) => row.pid ?? "-"),
      bundle: bundleRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet asks whether Series10 46mm battery90+ can produce any real clean personal-used lane instead of staying a premium or bundle-heavy comparison slice.",
      "If cleanPersonalUsedRows stays at zero while bundle, premium, or unopened pressure dominates, Series10 remains comparison-only evidence.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "compare Series10 46mm clean personal-used density directly against the existing Series9 45mm battery90+ clean core",
      "keep battery wording and connectivity wording separate so premium Series10 rows are not over-trusted",
    ],
    doNotDo: [
      "Do not treat premium or unopened-heavy rows as clean personal-used evidence",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series10-46mm-battery90plus-clean-personal-used-split-latest.json"),
    JSON.stringify(report, null, 2),
  );

  const md = [
    "# Smartwatch Apple Watch Series10 46mm Battery90+ Clean Personal-Used Split",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only packet for checking whether Series10 46mm battery90+ rows can form a genuinely clean personal-used lane.",
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
    path.join(reportsDir, "smartwatch-applewatch-series10-46mm-battery90plus-clean-personal-used-split-latest.md"),
    `${md}\n`,
  );
  console.log("wrote reports/smartwatch-applewatch-series10-46mm-battery90plus-clean-personal-used-split-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series10-46mm-battery90plus-clean-personal-used-split-latest.md");
  console.log(
    `series10 46mm battery90 clean split: base=${report.metrics.baseRows}, clean_personal=${report.metrics.cleanPersonalUsedRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
