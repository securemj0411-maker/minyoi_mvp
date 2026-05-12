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

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function merchantLike(sample: Sample): boolean {
  const s = sample.seller ?? {};
  return Boolean(s.proshop || s.is_official || Number(s.review_count ?? 0) >= 30 || Number(s.sales_count ?? 0) >= 30);
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const rows = samples.filter((sample) => {
    const t = textFor(sample);
    return !globalExclude.test(t) &&
      /(series\s*10|시리즈\s*10|애플워치\s*10)/.test(t) &&
      /(티타늄|titanium)/.test(t);
  });

  const bundleRows = rows.filter((row) => /(밀레니즈|루프|정품\s*스트랩|스포츠밴드|밴드|스트랩|충전기|케이블|박스|풀박스)/.test(textFor(row)));
  const fortyTwoRows = rows.filter((row) => /\b42mm\b/.test(textFor(row)));
  const fortySixRows = rows.filter((row) => /\b46mm\b/.test(textFor(row)));
  const gpsRows = rows.filter((row) => /\bgps\b/.test(textFor(row)));
  const cellularRows = rows.filter((row) => /(cellular|셀룰러)/.test(textFor(row)));
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series10_titanium_context_report_only",
    metrics: {
      totalRows: rows.length,
      merchantLikeRows: rows.filter(merchantLike).length,
      nonMerchantRows: rows.filter((row) => !merchantLike(row)).length,
      bundleRows: bundleRows.length,
      fortyTwoRows: fortyTwoRows.length,
      fortySixRows: fortySixRows.length,
      gpsRows: gpsRows.length,
      cellularRows: cellularRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: rows.slice(0, 10).map((row) => row.pid ?? "-"),
    sampleTitles: rows.slice(0, 10).map(cleanTitle),
    policyImplications: [
      "This packet tests whether Series10 titanium is a better thickening target than continuing to overfocus on SE3 overlap lanes.",
      "If the lane keeps non-merchant diversity with limited bundle contamination, it is a stronger explicit-generation positive slice than SE3 shared-core evidence.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "split Series10 titanium by 42mm vs 46mm only if density remains healthy",
      "add unopened/used context only after bundle contamination is understood",
    ],
    doNotDo: [
      "Do not infer all Series10 lanes are healthy from titanium alone",
      "Do not convert this packet into runtime trust without more explicit size/connectivity context",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series10-titanium-context-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series10 Titanium Context",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only context packet for Series10 titanium explicit-generation rows.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Sample PIDs",
    "",
    report.samplePids.map((pid) => `- ${pid}`).join("\n"),
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series10-titanium-context-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series10-titanium-context-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series10-titanium-context-latest.md");
  console.log(`applewatch series10 titanium context: total=${rows.length}, non_merchant=${report.metrics.nonMerchantRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
