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

  const cleanBodyOnlyRows = rows.filter((row) => {
    const t = textFor(row);
    return !merchantLike(row)
      && /(구성품\)\s*본체|본체\s*단품|시계\s*단품)/.test(t)
      && !/(스트랩|밴드)/.test(t)
      && !/(박스|충전기|케이블|풀박스)/.test(t)
      && !/(cellular|셀룰러|lte)/.test(t);
  });

  const bodyOnlyWithBundleRows = rows.filter((row) => {
    const t = textFor(row);
    return !merchantLike(row)
      && /(구성품\)\s*본체|본체\s*단품|시계\s*단품)/.test(t)
      && /(스트랩|밴드|박스|충전기|케이블|풀박스)/.test(t);
  });

  const pureBodyOnlyNoBundleRows = cleanBodyOnlyRows.filter((row) => !/(사용감 없음|미개봉|새상품|새제품|미사용)/.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_bodyonly_purity_report_only",
    metrics: {
      totalRows: rows.length,
      cleanBodyOnlyRows: cleanBodyOnlyRows.length,
      bodyOnlyWithBundleRows: bodyOnlyWithBundleRows.length,
      pureBodyOnlyNoBundleRows: pureBodyOnlyNoBundleRows.length,
      merchantLikeRows: rows.filter(merchantLike).length,
      runtimeApprovedRows: 0,
    },
    samplePids: {
      cleanBodyOnly: cleanBodyOnlyRows.map((row) => row.pid ?? "-"),
      bodyOnlyWithBundle: bodyOnlyWithBundleRows.map((row) => row.pid ?? "-"),
      pureBodyOnlyNoBundle: pureBodyOnlyNoBundleRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet tests whether the quiet Series9 lane is really clean body-only used inventory or just body-only wording mixed with strap/box caveats.",
      "If pure body-only no-bundle rows survive, Series9 becomes a stronger personal-used thickening candidate.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "keep pairing body-only purity with battery90+ context before any confidence discussion",
      "look for one or two more non-merchant body-only Series9 rows before promotion talk",
    ],
    doNotDo: [
      "Do not treat all body-only rows as clean personal-used inventory",
      "Do not promote this packet into runtime confidence",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-bodyonly-purity-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series9 Body-Only Purity",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only body-only purity packet for Series9 45mm GPS battery90+ rows.",
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-bodyonly-purity-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series9-bodyonly-purity-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-bodyonly-purity-latest.md");
  console.log(`applewatch series9 bodyonly purity: total=${rows.length}, pure_bodyonly=${pureBodyOnlyNoBundleRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
