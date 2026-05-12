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
    const text = textFor(sample);
    return (
      /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(text) &&
      /\b44mm\b|44m\b/.test(text) &&
      /(블루투스|bluetooth|wifi)/.test(text) &&
      !partsOrBuying.test(text)
    );
  });

  const unopenedRows = rows.filter((row) => /(미개봉|새제품|새상품|미사용)/.test(textFor(row)));
  const openboxRows = rows.filter((row) => /(오픈박스|실사용\s*거의\s*없|(?<!미)개봉|ss급|s급)/.test(textFor(row)));
  const accessoryBundleRows = rows.filter((row) => /(스트랩|밴드|충전기|케이스|필름|루프)/.test(textFor(row)));
  const cleanUnopenedRows = rows.filter((row) => /(미개봉|새제품|새상품|미사용)/.test(textFor(row)) && !/(스트랩|밴드|충전기|케이스|필름|루프)/.test(textFor(row)));
  const merchantLikeRows = rows.filter(merchantLike);
  const nonMerchantRows = rows.filter((row) => !merchantLike(row));
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_44mm_unopened_context_report_only",
    metrics: {
      totalRows: rows.length,
      unopenedRows: unopenedRows.length,
      openboxRows: openboxRows.length,
      accessoryBundleRows: accessoryBundleRows.length,
      cleanUnopenedRows: cleanUnopenedRows.length,
      merchantLikeRows: merchantLikeRows.length,
      nonMerchantRows: nonMerchantRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: rows.slice(0, 10).map((row) => row.pid ?? "-"),
    sampleTitles: rows.slice(0, 10).map(cleanTitle),
    policyImplications: [
      "This packet tests whether the current Watch8 44mm Bluetooth lane is really an unopened-heavy opportunity slice or only looks clean because it is small.",
      "If unopened rows dominate and merchant pressure stays low, this lane is a better thickening target than broad Watch8 family pressure.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "pair unopened-heavy Watch8 44mm rows with accessory/strap contamination checks before any confidence discussion",
      "compare unopened-heavy Watch8 44mm context against Watch7 44mm context before broadening the lane",
    ],
    doNotDo: [
      "Do not promote Watch8 family-wide confidence from this packet",
      "Do not treat unopened-heavy rows as proof that used/open-box lanes are also clean",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-unopened-context-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Galaxy Watch8 44mm Unopened Context",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only context packet for the current Watch8 44mm explicit Bluetooth lane.",
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
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-unopened-context-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-unopened-context-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-unopened-context-latest.md");
  console.log(`watch8 44mm unopened context: total=${rows.length}, unopened=${unopenedRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
