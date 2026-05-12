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
  personalLikeRows: number;
  bundleRows: number;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "applewatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");
const globalExclude = /(삽니다|구매|매입|교환|부품용|고장|파손|수리|케이스|보호필름|스트랩만|충전독|호환)/;

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
  const defs = [
    {
      scope: "se3_shared_core_personal_used",
      match: (t: string, s: Sample) =>
        /(se\s?3|애플워치\s*se\s*3|apple\s*watch\s*se\s*3)/.test(t) &&
        /\b40mm\b/.test(t) &&
        /\bgps\b/.test(t) &&
        /(스타라이트|starlight)/.test(t) &&
        /(배터리.*100%|100프로)/.test(t) &&
        !merchantLike(s),
    },
    {
      scope: "se3_starlight_used_no_battery",
      match: (t: string) =>
        /(se\s?3|애플워치\s*se\s*3|apple\s*watch\s*se\s*3)/.test(t) &&
        /\b40mm\b/.test(t) &&
        /\bgps\b/.test(t) &&
        /(스타라이트|starlight)/.test(t) &&
        !/(배터리.*100%|100프로)/.test(t) &&
        !/(미개봉|새상품|새제품|실사용\s*거의\s*없|ss급|sss급|상태\s*좋음)/.test(t),
    },
  ];

  const lanes: Lane[] = defs.map((def) => {
    const rows = samples.filter((sample) => {
      const t = textFor(sample);
      return !globalExclude.test(t) && def.match(t, sample);
    });
    return {
      scope: def.scope,
      rows: rows.length,
      merchantLikeRows: rows.filter(merchantLike).length,
      personalLikeRows: rows.filter((row) => !merchantLike(row)).length,
      bundleRows: rows.filter((row) => /(풀박스|박스|정품\s*스트랩|밀레니즈|루프|스포츠밴드|충전기|케이블)/.test(textFor(row))).length,
      samplePids: rows.slice(0, 8).map((row) => row.pid ?? "-"),
      sampleTitles: rows.slice(0, 8).map(cleanTitle),
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
    decision: "applewatch_se3_personal_used_vs_starlight_used_report_only",
    metrics: {
      sharedCorePersonalRows: lanes[0].rows,
      starlightUsedRows: lanes[1].rows,
      sharedCorePersonalMerchantLikeRows: lanes[0].merchantLikeRows,
      starlightUsedMerchantLikeRows: lanes[1].merchantLikeRows,
      runtimeApprovedRows: 0,
    },
    lanes,
    policyImplications: [
      "This packet tests whether the real used support for SE3 sits in the shared battery/starlight core or in starlight-used rows outside battery100 wording.",
      "If starlight-used stays thinner than shared-core personal-used, battery100 is still not an independent lane but overlap-centered evidence.",
      "This packet is report-only and only exists to keep SE3 backlog interpretation conservative.",
    ],
    nextReportOnlyExperiments: [
      "thicken non-merchant starlight-used rows before treating them as a stable used lane",
      "separate warranty/full-box support only after used-lane density improves",
    ],
    doNotDo: [
      "Do not promote either lane into runtime trust from this packet alone",
      "Do not treat shared-core personal-used rows as independent battery-positive evidence",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-se3-personal-vs-starlight-used-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch SE3 Personal Core vs Starlight Used",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only comparison between personal-used shared core rows and starlight-used non-battery rows.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Lanes",
    "",
    "| scope | rows | merchant_like_rows | personal_like_rows | bundle_rows | sample_pids |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    ...lanes.map((row) => `| ${row.scope} | ${row.rows} | ${row.merchantLikeRows} | ${row.personalLikeRows} | ${row.bundleRows} | ${row.samplePids.join(", ")} |`),
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-se3-personal-vs-starlight-used-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-se3-personal-vs-starlight-used-latest.json");
  console.log("wrote reports/smartwatch-applewatch-se3-personal-vs-starlight-used-latest.md");
  console.log(`applewatch se3 personal vs starlight used: core=${lanes[0].rows}, starlight_used=${lanes[1].rows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
