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

const globalExclude = /(삽니다|구매|매입|부품용|고장|파손|케이스만|스트랩만|밴드만|충전기만|본체없음)/;
const accessoryBundle = /(스트랩|밴드|충전기|케이스|필름|루프)/;
const cleanOpenboxPattern = /(단순개봉|미개봉|새상품|깨끗|s급|사용감\s*적|실착\s*몇번)/;
const personalContextPattern = /(실사용|직거래|선물|초기화|상태\s*좋|기스|깨끗하게|몇번\s*착용)/;
const explicitBluetoothPattern = /(블루투스|bluetooth|wifi|와이파이)/;
const ltePattern = /(lte|셀룰러|개통|통신사)/;

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
    const text = textFor(sample);
    return /(갤럭시\s*워치\s*7|갤럭시워치7|galaxy\s*watch\s*7)/.test(text) &&
      /\b44mm\b|44m\b/.test(text) &&
      cleanOpenboxPattern.test(text) &&
      !globalExclude.test(text);
  });

  const nonMerchantRows = baseRows.filter((row) => !merchantLike(row));
  const personalContextRows = nonMerchantRows.filter((row) => personalContextPattern.test(textFor(row)));
  const explicitBluetoothRows = nonMerchantRows.filter((row) => explicitBluetoothPattern.test(textFor(row)));
  const lteConflictRows = nonMerchantRows.filter((row) => ltePattern.test(textFor(row)));
  const accessoryBundleRows = nonMerchantRows.filter((row) => accessoryBundle.test(textFor(row)));
  const cleanNoConflictRows = nonMerchantRows.filter((row) =>
    personalContextPattern.test(textFor(row)) &&
    !ltePattern.test(textFor(row)) &&
    !accessoryBundle.test(textFor(row)),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch7_44mm_clean_openbox_nonmerchant_thickening_report_only",
    metrics: {
      baseRows: baseRows.length,
      nonMerchantRows: nonMerchantRows.length,
      personalContextRows: personalContextRows.length,
      explicitBluetoothRows: explicitBluetoothRows.length,
      lteConflictRows: lteConflictRows.length,
      accessoryBundleRows: accessoryBundleRows.length,
      cleanNoConflictRows: cleanNoConflictRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: {
      base: baseRows.map((row) => row.pid ?? "-"),
      nonMerchant: nonMerchantRows.map((row) => row.pid ?? "-"),
      cleanNoConflict: cleanNoConflictRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet thickens the healthiest Galaxy Watch anchor lane instead of letting Watch8 unopened pressure dominate the family story.",
      "If Watch7 44mm non-merchant clean/open-box rows stay stable, they remain the best body-positive anchor for report-only Galaxy Watch evidence.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "compare Watch7 clean no-conflict density against Watch8 no-conflict density as the family anchor check",
      "keep LTE/accessory-conflicted rows isolated instead of letting them inflate the Watch7 anchor lane",
    ],
    doNotDo: [
      "Do not merge merchant-like or accessory rows into the anchor lane",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-galaxywatch-watch7-44mm-clean-openbox-nonmerchant-thickening-latest.json"),
    JSON.stringify(report, null, 2),
  );
  const md = [
    "# Smartwatch Galaxy Watch7 44mm Clean/Open-Box Non-Merchant Thickening",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only packet for thickening the current cleanest Galaxy Watch body-positive anchor lane.",
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
    path.join(reportsDir, "smartwatch-galaxywatch-watch7-44mm-clean-openbox-nonmerchant-thickening-latest.md"),
    `${md}\n`,
  );
  console.log("wrote reports/smartwatch-galaxywatch-watch7-44mm-clean-openbox-nonmerchant-thickening-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch7-44mm-clean-openbox-nonmerchant-thickening-latest.md");
  console.log(
    `watch7 44mm nonmerchant thickening: base=${report.metrics.baseRows}, clean_no_conflict=${report.metrics.cleanNoConflictRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
