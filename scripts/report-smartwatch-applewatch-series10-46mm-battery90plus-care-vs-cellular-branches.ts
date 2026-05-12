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
const battery90Pattern = /(배터리\s*(성능)?\s*(9\d|100)\s*%?|battery\s*(health)?\s*(9\d|100)\s*%?)/;
const carePattern = /(애플케어|애케플|케어플러스|보증기간|보증\s*잔여)/;
const bundlePattern = /(박스|풀박스|충전기|케이블|스트랩|밴드|루프|밀레니즈)/;
const titaniumPattern = /(티타늄)/;
const cellularPattern = /(gps\+?셀룰러|cellular|셀룰러|lte)/;
const gpsPattern = /(\bgps\b|블루투스|wifi|와이파이)/;
const unopenedLike = /(미개봉|새상품|새제품|미사용)/;
const personalContextPattern = /(실사용|사용 기간|상태|기스|사용감|초기화|거의 새것|생활기스|배터리 성능)/;

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
      (/\b46mm\b|46m\b/.test(t)) &&
      battery90Pattern.test(t);
  });

  const nonMerchantRows = baseRows.filter((row) => !merchantLike(row));
  const personalRows = nonMerchantRows.filter((row) => personalContextPattern.test(textFor(row)));
  const gpsPersonalRows = personalRows.filter((row) => {
    const t = textFor(row);
    return gpsPattern.test(t) || !cellularPattern.test(t);
  });
  const careBackedGpsRows = gpsPersonalRows.filter((row) => carePattern.test(textFor(row)));
  const plainCleanPersonalRows = gpsPersonalRows.filter((row) => {
    const t = textFor(row);
    return !carePattern.test(t) && !bundlePattern.test(t) && !cellularPattern.test(t) && !unopenedLike.test(t);
  });
  const cellularPremiumRows = nonMerchantRows.filter((row) => {
    const t = textFor(row);
    return cellularPattern.test(t) && (bundlePattern.test(t) || titaniumPattern.test(t));
  });
  const bundleRows = baseRows.filter((row) => bundlePattern.test(textFor(row)));
  const careRows = baseRows.filter((row) => carePattern.test(textFor(row)));
  const cellularRows = baseRows.filter((row) => cellularPattern.test(textFor(row)));
  const titaniumRows = baseRows.filter((row) => titaniumPattern.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series10_46mm_battery90plus_care_vs_cellular_branches_report_only",
    metrics: {
      baseRows: baseRows.length,
      nonMerchantRows: nonMerchantRows.length,
      personalRows: personalRows.length,
      gpsPersonalRows: gpsPersonalRows.length,
      careBackedGpsRows: careBackedGpsRows.length,
      plainCleanPersonalRows: plainCleanPersonalRows.length,
      cellularPremiumRows: cellularPremiumRows.length,
      bundleRows: bundleRows.length,
      careRows: careRows.length,
      cellularRows: cellularRows.length,
      titaniumRows: titaniumRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: {
      plainCleanPersonal: plainCleanPersonalRows.map((row) => row.pid ?? "-"),
      careBackedGps: careBackedGpsRows.map((row) => row.pid ?? "-"),
      cellularPremium: cellularPremiumRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet splits the tiny Series10 46mm battery90+ lane into the specific branches that matter next: plain clean personal rows, care-backed GPS rows, and premium-looking cellular baggage rows.",
      "If plain clean personal rows remain present while care-backed GPS rows stay narrow and cellular premium rows do not take over, Series10 stays a valid next thickening target.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "check whether future Series10 46mm battery90+ rows expand the plain clean personal branch rather than only the care-backed or cellular-premium branch",
      "keep comparing Series10 46mm battery90+ against Series9 45mm battery90+ so the cleaner lane wins by actual branch quality, not only row count",
    ],
    doNotDo: [
      "Do not treat care-backed GPS rows as identical to plain clean personal evidence",
      "Do not let fullbox/cellular/titanium baggage inflate confidence for the Series10 lane",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series10-46mm-battery90plus-care-vs-cellular-branches-latest.json"),
    JSON.stringify(report, null, 2),
  );

  const md = [
    "# Smartwatch Apple Watch Series10 46mm Battery90+ Care vs Cellular Branches",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only branch split for the tiny Series10 46mm battery90+ lane.",
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
    path.join(reportsDir, "smartwatch-applewatch-series10-46mm-battery90plus-care-vs-cellular-branches-latest.md"),
    `${md}\n`,
  );

  console.log("wrote reports/smartwatch-applewatch-series10-46mm-battery90plus-care-vs-cellular-branches-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series10-46mm-battery90plus-care-vs-cellular-branches-latest.md");
  console.log(
    `series10 46mm care-vs-cellular branches: base=${report.metrics.baseRows}, plain_clean=${report.metrics.plainCleanPersonalRows}, care_backed=${report.metrics.careBackedGpsRows}, cellular_premium=${report.metrics.cellularPremiumRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
