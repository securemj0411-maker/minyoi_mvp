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
const heavyBundle = /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩)/;
const lightBundle = /(충전기|케이블|박스|풀박스)/;
const unopenedLike = /(미개봉|새상품|새제품|미사용|거의\s*새제품|실착\s*적음)/;
const cellularConflict = /(cellular|셀룰러|lte)/;
const multiQty = /(2개|3개|세개|두개|개당)/;

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
    const t = textFor(sample);
    return !globalExclude.test(t) &&
      /(series\s*10|시리즈\s*10|애플워치\s*10)/.test(t) &&
      /(티타늄|titanium)/.test(t);
  });

  const cleanPersonalUsedRows = rows.filter((row) => {
    const t = textFor(row);
    return !merchantLike(row) && !heavyBundle.test(t) && !lightBundle.test(t) && !unopenedLike.test(t) && !cellularConflict.test(t) && !multiQty.test(t);
  });
  const lightBundleRows = rows.filter((row) => {
    const t = textFor(row);
    return !merchantLike(row) && lightBundle.test(t) && !heavyBundle.test(t) && !unopenedLike.test(t) && !cellularConflict.test(t);
  });
  const unopenedLikeRows = rows.filter((row) => unopenedLike.test(textFor(row)));
  const merchantLikeRows = rows.filter(merchantLike);
  const heavyBundleRows = rows.filter((row) => heavyBundle.test(textFor(row)));
  const cellularRows = rows.filter((row) => cellularConflict.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series10_titanium_condition_splits_report_only",
    metrics: {
      totalRows: rows.length,
      cleanPersonalUsedRows: cleanPersonalUsedRows.length,
      lightBundleRows: lightBundleRows.length,
      unopenedLikeRows: unopenedLikeRows.length,
      merchantLikeRows: merchantLikeRows.length,
      heavyBundleRows: heavyBundleRows.length,
      cellularRows: cellularRows.length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      cleanPersonalUsedPids: cleanPersonalUsedRows.slice(0, 10).map((row) => row.pid ?? "-"),
      lightBundlePids: lightBundleRows.slice(0, 10).map((row) => row.pid ?? "-"),
      unopenedLikePids: unopenedLikeRows.slice(0, 10).map((row) => row.pid ?? "-"),
      merchantLikePids: merchantLikeRows.slice(0, 10).map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet checks whether Series10 titanium density comes from genuinely clean personal-used rows or from premium bundle and unopened pressure.",
      "If heavy-bundle or unopened pressure dominates, Series10 should stay as a comparison lane rather than the default next Apple Watch positive thickening target.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "compare the Series10 split directly against the Series9 condition split before choosing the next Apple Watch thickening target",
      "keep explicit size/connectivity context packets alongside this split so premium titanium wording does not get over-trusted",
    ],
    doNotDo: [
      "Do not assume premium Series10 titanium rows are healthier than Series9 just because ASP is higher",
      "Do not treat bundle-heavy or unopened-heavy rows as clean personal-used evidence",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series10-titanium-condition-splits-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series10 Titanium Condition Splits",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only condition/bundle split for Series10 titanium rows.",
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series10-titanium-condition-splits-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series10-titanium-condition-splits-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series10-titanium-condition-splits-latest.md");
  console.log(`applewatch series10 condition splits: total=${rows.length}, clean_personal=${cleanPersonalUsedRows.length}, light_bundle=${lightBundleRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
