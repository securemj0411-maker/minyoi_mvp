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
const samplesPath = path.join(appDir, "category-intelligence", "galaxywatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");
const partsOrBuying = /(삽니다|구매|매입|부품용|고장|파손|케이스만|스트랩만|밴드만|충전기만|본체없음)/;

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

function merchantLike(sample: Sample): boolean {
  const s = sample.seller ?? {};
  return Boolean(s.proshop || s.is_official || Number(s.review_count ?? 0) >= 30 || Number(s.sales_count ?? 0) >= 30);
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];

  const rows = samples.filter((sample) => {
    const text = textFor(sample);
    return (
      /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(text) &&
      /\b40mm\b|40m\b/.test(text) &&
      /(미개봉|새상품|새제품|미사용)/.test(text) &&
      /(블루투스|bluetooth|wifi)/.test(text) &&
      !partsOrBuying.test(text)
    );
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch8_40mm_new_bluetooth_explicit_report_only",
    scope: "galaxywatch8_40mm_new_bluetooth_explicit",
    metrics: {
      rawRows: rows.length,
      survivingRows: rows.length,
      merchantLikeRows: rows.filter(merchantLike).length,
      nonMerchantRows: rows.filter((row) => !merchantLike(row)).length,
      accessoryBundleRows: rows.filter((row) => /(스트랩|밴드|충전기|케이스|필름|루프)/.test(textFor(row))).length,
      explicitLteMentions: rows.filter((row) => /(lte|셀룰러)/.test(textFor(row))).length,
      sellerDiversity: new Set(rows.map((row) => `${Boolean(row.seller?.proshop || row.seller?.is_official)}:${Number(row.seller?.review_count ?? 0)}:${Number(row.seller?.sales_count ?? 0)}`)).size,
      singleUnitWordingRows: rows.filter((row) => /(1대|한대|낱개|단품\s*판매|단독)/.test(textFor(row))).length,
      runtimeApprovedRows: 0,
    },
    samplePids: rows.slice(0, 10).map((row) => row.pid ?? "-"),
    sampleTitles: rows.slice(0, 10).map(cleanTitle),
    policyImplications: [
      "This is the noisier comparison lane for Watch8 explicit Bluetooth and should be read against the cleaner 44mm slice.",
      "Higher merchant/LTE pressure here means density alone is not enough to trust this lane more.",
      "This packet is report-only and exists as a comparison guardrail.",
    ],
    nextReportOnlyExperiments: [
      "compare merchant/LTE contamination directly against the 44mm lane",
      "split merchant-heavy 40mm rows from personal-used rows if density remains high",
    ],
    doNotDo: [
      "Do not promote this lane just because it is denser than 44mm",
      "Do not merge 40mm and 44mm into one Watch8 Bluetooth story",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-40mm-bluetooth-explicit-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Smartwatch Galaxy Watch8 40mm Bluetooth Explicit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only comparison packet for the noisier Watch8 40mm new/unopened explicit Bluetooth lane.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Sample PIDs",
    "",
    `- ${report.samplePids.join(", ")}`,
    "",
    "## Sample Titles",
    "",
    ...report.sampleTitles.map((line) => `- ${line}`),
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

  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-40mm-bluetooth-explicit-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-40mm-bluetooth-explicit-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-40mm-bluetooth-explicit-latest.md");
  console.log(`watch8 40mm explicit bluetooth: raw=${report.metrics.rawRows}, merchant=${report.metrics.merchantLikeRows}, non_merchant=${report.metrics.nonMerchantRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
