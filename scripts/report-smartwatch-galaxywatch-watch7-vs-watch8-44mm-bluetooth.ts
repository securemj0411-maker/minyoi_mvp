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
  accessoryBundleRows: number;
  explicitLteMentions: number;
  sellerDiversity: number;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "galaxywatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");
const partsOrBuying = /(삽니다|구매|매입|부품용|고장|파손|케이스만|스트랩만|밴드만|충전기만|본체없음)/;

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
    { scope: "galaxywatch7_44mm_bluetooth_explicit", model: "7" },
    { scope: "galaxywatch8_44mm_bluetooth_explicit", model: "8" },
  ];

  const lanes: Lane[] = defs.map((def) => {
    const rows = samples.filter((sample) => {
      const text = textFor(sample);
      return (
        new RegExp(`(갤럭시\\s*워치\\s*${def.model}|갤럭시워치${def.model}|galaxy\\s*watch\\s*${def.model})`).test(text) &&
        /\b44mm\b|44m\b/.test(text) &&
        /(블루투스|bluetooth|wifi)/.test(text) &&
        !partsOrBuying.test(text)
      );
    });
    return {
      scope: def.scope,
      rows: rows.length,
      merchantLikeRows: rows.filter(merchantLike).length,
      nonMerchantRows: rows.filter((row) => !merchantLike(row)).length,
      accessoryBundleRows: rows.filter((row) => /(스트랩|밴드|충전기|케이스|필름|루프)/.test(textFor(row))).length,
      explicitLteMentions: rows.filter((row) => /(lte|셀룰러)/.test(textFor(row))).length,
      sellerDiversity: new Set(rows.map((row) => `${Boolean(row.seller?.proshop || row.seller?.is_official)}:${Number(row.seller?.review_count ?? 0)}:${Number(row.seller?.sales_count ?? 0)}`)).size,
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
    family: "galaxywatch",
    decision: "galaxywatch_watch7_vs_watch8_44mm_bluetooth_report_only",
    metrics: {
      watch7Rows: lanes[0].rows,
      watch8Rows: lanes[1].rows,
      watch7MerchantLikeRows: lanes[0].merchantLikeRows,
      watch8MerchantLikeRows: lanes[1].merchantLikeRows,
      watch7NonMerchantRows: lanes[0].nonMerchantRows,
      watch8NonMerchantRows: lanes[1].nonMerchantRows,
      runtimeApprovedRows: 0,
    },
    lanes,
    policyImplications: [
      "This packet compares the current 44mm Bluetooth lanes directly instead of assuming newer model means cleaner evidence.",
      "If Watch8 keeps better non-merchant purity than Watch7, it becomes the better thickening target despite smaller sample sizes.",
      "This packet is report-only and is only for backlog prioritization.",
    ],
    nextReportOnlyExperiments: [
      "thicken whichever 44mm lane keeps better non-merchant purity and lower LTE bleed",
      "pair the winning 44mm lane with unopened/accessory context before any promotion discussion",
    ],
    doNotDo: [
      "Do not infer runtime confidence from row count alone",
      "Do not merge Watch7 and Watch8 into one 44mm bluetooth positive story",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch7-vs-watch8-44mm-bluetooth-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Galaxy Watch7 vs Watch8 44mm Bluetooth",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only side-by-side comparison of Watch7 and Watch8 44mm explicit Bluetooth lanes.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Lanes",
    "",
    "| scope | rows | merchant_like_rows | non_merchant_rows | accessory_bundle_rows | explicit_lte_mentions | seller_diversity | sample_pids |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...lanes.map((row) => `| ${row.scope} | ${row.rows} | ${row.merchantLikeRows} | ${row.nonMerchantRows} | ${row.accessoryBundleRows} | ${row.explicitLteMentions} | ${row.sellerDiversity} | ${row.samplePids.join(", ")} |`),
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
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch7-vs-watch8-44mm-bluetooth-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch7-vs-watch8-44mm-bluetooth-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch7-vs-watch8-44mm-bluetooth-latest.md");
  console.log(`watch7 vs watch8 44mm bt: w7=${lanes[0].rows}, w8=${lanes[1].rows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
