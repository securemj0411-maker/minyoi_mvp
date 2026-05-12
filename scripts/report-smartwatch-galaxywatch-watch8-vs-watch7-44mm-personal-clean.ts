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
  nonMerchantRows: number;
  personalUsedRows: number;
  boxlessRows: number;
  explicitBluetoothRows: number;
  lteNegativeRows: number;
  accessoryBundleRows: number;
  merchantLikeRows: number;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "galaxywatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

const globalExclude = /(삽니다|구매|매입|부품용|고장|파손|케이스만|스트랩만|밴드만|충전기만|본체없음)/;
const accessoryOnlyTitle = /(케이스|스트랩|밴드|커버|필름)/;
const unopenedPressure = /(미개봉|새상품|새제품|미사용)/;
const personalOrClean = /(선물|실사용|사용감|몇번|집에서만|깨끗|기스|스크레치|박스는 없|박스없|풀박스|초기화|풀충전|직거래)/;
const boxless = /(박스는 없|박스없|박스 없어요|박스는 없어|노박스)/;
const explicitBluetooth = /(블루투스|불루투스|bluetooth|wifi|와이파이)/;
const lteNegative = /(lte모델x|lte 모델x|lte 미지원|셀룰러 사용은 불가|블루투스로만|통신사것 아님|통신사 것 아님|블루투스용)/;
const accessoryBundle = /(스트랩|밴드|케이스|커버|필름|충전기|충전 케이블|액정커버|보호케이스|보호필름)/;

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

function laneRows(samples: Sample[], model: "7" | "8"): Sample[] {
  return samples.filter((sample) => {
    const text = textFor(sample);
    const title = (sample.title ?? sample.name ?? "").toLowerCase();
    return (
      new RegExp(`(갤럭시\\s*워치\\s*${model}|갤럭시워치${model}|galaxy\\s*watch\\s*${model})`).test(text) &&
      /\b44mm\b|44m\b/.test(text) &&
      !/(클래식|classic|울트라|ultra)/.test(text) &&
      !globalExclude.test(text) &&
      !accessoryOnlyTitle.test(title) &&
      !unopenedPressure.test(text) &&
      personalOrClean.test(text)
    );
  });
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const defs = [
    { scope: "galaxywatch7_44mm_personal_clean", model: "7" as const },
    { scope: "galaxywatch8_44mm_personal_clean", model: "8" as const },
  ];

  const lanes: Lane[] = defs.map((def) => {
    const rows = laneRows(samples, def.model);
    return {
      scope: def.scope,
      rows: rows.length,
      nonMerchantRows: rows.filter((row) => !merchantLike(row)).length,
      personalUsedRows: rows.filter((row) => personalOrClean.test(textFor(row))).length,
      boxlessRows: rows.filter((row) => boxless.test(textFor(row))).length,
      explicitBluetoothRows: rows.filter((row) => explicitBluetooth.test(textFor(row))).length,
      lteNegativeRows: rows.filter((row) => lteNegative.test(textFor(row))).length,
      accessoryBundleRows: rows.filter((row) => accessoryBundle.test(textFor(row))).length,
      merchantLikeRows: rows.filter(merchantLike).length,
      samplePids: rows.slice(0, 8).map((row) => row.pid ?? "-"),
      sampleTitles: rows.slice(0, 8).map(cleanTitle),
      runtimeApproved: false as const,
    };
  });

  const [watch7Lane, watch8Lane] = lanes;
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_vs_watch7_44mm_personal_clean_report_only",
    metrics: {
      watch7Rows: watch7Lane.rows,
      watch8Rows: watch8Lane.rows,
      watch7NonMerchantRows: watch7Lane.nonMerchantRows,
      watch8NonMerchantRows: watch8Lane.nonMerchantRows,
      watch7PersonalUsedRows: watch7Lane.personalUsedRows,
      watch8PersonalUsedRows: watch8Lane.personalUsedRows,
      watch7BoxlessRows: watch7Lane.boxlessRows,
      watch8BoxlessRows: watch8Lane.boxlessRows,
      watch7ExplicitBluetoothRows: watch7Lane.explicitBluetoothRows,
      watch8ExplicitBluetoothRows: watch8Lane.explicitBluetoothRows,
      watch7LteNegativeRows: watch7Lane.lteNegativeRows,
      watch8LteNegativeRows: watch8Lane.lteNegativeRows,
      watch7AccessoryBundleRows: watch7Lane.accessoryBundleRows,
      watch8AccessoryBundleRows: watch8Lane.accessoryBundleRows,
      watch7MerchantLikeRows: watch7Lane.merchantLikeRows,
      watch8MerchantLikeRows: watch8Lane.merchantLikeRows,
      runtimeApprovedRows: 0,
    },
    lanes,
    policyImplications: [
      "This packet compares narrow 44mm personal-clean lanes for Watch7 and Watch8 instead of letting unopened resale pressure dominate the story.",
      "If Watch8 personal-clean rows stay thinner than Watch7, Watch7 remains the better anchor for Galaxy Watch body-positive evidence while Watch8 stays in backlog-thickening mode.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "thicken Watch8 44mm personal-clean rows before revisiting any broader Watch8 confidence discussion",
      "pair this personal-clean comparison with the 44mm connectivity-semantics packet so LTE-negative wording is not over-penalized",
    ],
    doNotDo: [
      "Do not merge personal-clean rows back into unopened merchant-heavy lanes",
      "Do not infer runtime confidence from this comparison packet",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-galaxywatch-watch8-vs-watch7-44mm-personal-clean-latest.json"),
    JSON.stringify(report, null, 2),
  );

  const md = [
    "# Smartwatch Galaxy Watch8 vs Watch7 44mm Personal Clean",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only side-by-side comparison of Watch8 and Watch7 44mm narrow personal-clean lanes.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Lanes",
    "",
    "| scope | rows | non_merchant_rows | personal_used_rows | boxless_rows | explicit_bluetooth_rows | lte_negative_rows | accessory_bundle_rows | merchant_like_rows | sample_pids |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...lanes.map(
      (row) =>
        `| ${row.scope} | ${row.rows} | ${row.nonMerchantRows} | ${row.personalUsedRows} | ${row.boxlessRows} | ${row.explicitBluetoothRows} | ${row.lteNegativeRows} | ${row.accessoryBundleRows} | ${row.merchantLikeRows} | ${row.samplePids.join(", ")} |`,
    ),
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

  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-vs-watch7-44mm-personal-clean-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-vs-watch7-44mm-personal-clean-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-vs-watch7-44mm-personal-clean-latest.md");
  console.log(`watch8 vs watch7 44mm personal clean: w8=${watch8Lane.rows}, w7=${watch7Lane.rows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
