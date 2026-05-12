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

type Lane = {
  scope: string;
  rows: number;
  merchantLikeRows: number;
  nonMerchantRows: number;
  bundleRows: number;
  cellularConflictRows: number;
  cleanPersonalRows: number;
  samplePids: Array<string | number>;
  runtimeApproved: false;
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

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const defs = [
    {
      scope: "series10_titanium_context",
      match: (t: string) => /(series\s*10|시리즈\s*10|애플워치\s*10)/.test(t) && /(티타늄|titanium)/.test(t),
    },
    {
      scope: "series9_45mm_gps_battery90plus",
      match: (t: string) =>
        /(series\s*9|시리즈\s*9|애플워치\s*9)/.test(t) &&
        /\b45mm\b/.test(t) &&
        /\bgps\b/.test(t) &&
        /(배터리\s*9[0-9]%|배터리\s*100%|배터리\s*90)/.test(t),
    },
  ];

  const lanes: Lane[] = defs.map((def) => {
    const rows = samples.filter((sample) => {
      const t = textFor(sample);
      return !globalExclude.test(t) && def.match(t);
    });
    return {
      scope: def.scope,
      rows: rows.length,
      merchantLikeRows: rows.filter(merchantLike).length,
      nonMerchantRows: rows.filter((row) => !merchantLike(row)).length,
      bundleRows: rows.filter((row) => /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩|충전기|케이블|박스|풀박스)/.test(textFor(row))).length,
      cellularConflictRows: rows.filter((row) => /(cellular|셀룰러|lte)/.test(textFor(row))).length,
      cleanPersonalRows: rows.filter((row) =>
        !merchantLike(row) &&
        !/(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩|충전기|케이블|박스|풀박스)/.test(textFor(row)) &&
        !/(cellular|셀룰러|lte)/.test(textFor(row))
      ).length,
      samplePids: rows.slice(0, 10).map((row) => row.pid ?? "-"),
      runtimeApproved: false as const,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series10_vs_series9_positive_comparison_report_only",
    metrics: {
      series10Rows: lanes[0].rows,
      series9Rows: lanes[1].rows,
      series10NonMerchantRows: lanes[0].nonMerchantRows,
      series9NonMerchantRows: lanes[1].nonMerchantRows,
      series10CleanPersonalRows: lanes[0].cleanPersonalRows,
      series9CleanPersonalRows: lanes[1].cleanPersonalRows,
      runtimeApprovedRows: 0,
    },
    lanes,
    policyImplications: [
      "This packet compares the current clean Apple Watch positive candidates directly instead of assuming premium titanium is always the better next thickening target.",
      "If Series9 keeps more clean personal rows than Series10, it should be favored for the next report-only thickening wave.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "split the winning lane by size/condition only if clean personal density remains healthy",
      "keep SE3 overlap work as a guardrail rather than a positive thickening target",
    ],
    doNotDo: [
      "Do not promote either lane directly into runtime confidence from this packet",
      "Do not treat premium-sounding Series10 rows as healthier just because the ASP is higher",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series10-vs-series9-positive-comparison-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series10 vs Series9 Positive Comparison",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only side-by-side comparison of the current Apple Watch positive thickening candidates.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Lanes",
    "",
    "| scope | rows | merchant_like_rows | non_merchant_rows | bundle_rows | cellular_conflict_rows | clean_personal_rows | sample_pids |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...lanes.map((row) => `| ${row.scope} | ${row.rows} | ${row.merchantLikeRows} | ${row.nonMerchantRows} | ${row.bundleRows} | ${row.cellularConflictRows} | ${row.cleanPersonalRows} | ${row.samplePids.join(", ")} |`),
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series10-vs-series9-positive-comparison-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series10-vs-series9-positive-comparison-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series10-vs-series9-positive-comparison-latest.md");
  console.log(`applewatch s10 vs s9: s10=${lanes[0].rows}, s9=${lanes[1].rows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
