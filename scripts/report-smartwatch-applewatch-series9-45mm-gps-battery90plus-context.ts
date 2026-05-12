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

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const rows = samples.filter((sample) => {
    const t = textFor(sample);
    return !globalExclude.test(t) &&
      /(series\s*9|시리즈\s*9|애플워치\s*9)/.test(t) &&
      /\b45mm\b/.test(t) &&
      /\bgps\b/.test(t) &&
      /(배터리\s*9[0-9]%|배터리\s*100%|배터리\s*90)/.test(t);
  });

  const cellularConflictRows = rows.filter((row) => /(cellular|셀룰러|lte)/.test(textFor(row)));
  const unopenedLikeRows = rows.filter((row) => /(미개봉|새상품|새제품|미사용|거의\s*새제품|실착\s*적음)/.test(textFor(row)));
  const bundleRows = rows.filter((row) => /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩|충전기|케이블|박스|풀박스)/.test(textFor(row)));
  const cleanPersonalUsedRows = rows.filter((row) =>
    !merchantLike(row) &&
    !/(2개|3개|세개|두개|개당)/.test(textFor(row)) &&
    !/(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩|충전기|케이블|박스|풀박스)/.test(textFor(row)) &&
    !/(미개봉|새상품|새제품|미사용|거의\s*새제품|실착\s*적음)/.test(textFor(row))
  );

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_context_report_only",
    metrics: {
      totalRows: rows.length,
      merchantLikeRows: rows.filter(merchantLike).length,
      nonMerchantRows: rows.filter((row) => !merchantLike(row)).length,
      cellularConflictRows: cellularConflictRows.length,
      unopenedLikeRows: unopenedLikeRows.length,
      bundleRows: bundleRows.length,
      cleanPersonalUsedRows: cleanPersonalUsedRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: rows.slice(0, 10).map((row) => row.pid ?? "-"),
    policyImplications: [
      "This packet tests whether Series9 45mm GPS battery90+ is a healthier personal-used lane than louder premium slices like Series7 stainless cellular.",
      "If non-merchant density stays high and cellular conflict stays low, this becomes a better next Apple Watch thickening target than SE3 overlap work.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "separate clean personal-used rows from cellular-conflict and unopened-like overlap rows before any confidence discussion",
      "compare this lane directly against Series7 stainless cellular merchant pressure before choosing the next Apple Watch thickening priority",
    ],
    doNotDo: [
      "Do not infer all Series9 battery-related rows are healthy from this packet alone",
      "Do not promote this packet into runtime confidence without more context density",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-context-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Context",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only context packet for Series9 45mm GPS battery90+ rows.",
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-context-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-context-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-context-latest.md");
  console.log(`applewatch series9 45mm gps battery90+: total=${rows.length}, non_merchant=${report.metrics.nonMerchantRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
