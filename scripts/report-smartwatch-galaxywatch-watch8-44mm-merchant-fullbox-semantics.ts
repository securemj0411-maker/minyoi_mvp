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
const accessoryOnlyTitle = /(케이스|스트랩|밴드|커버|필름)/;
const unopenedPressure = /(미개봉|새상품|새제품|미사용)/;
const personalStory = /(선물|실사용|사용감|몇번|집에서만|깨끗|기스|스크레치|초기화|풀충전|직거래|하자x|하자 x|눈에 띄는 하자)/;
const _explicitBluetooth = /(블루투스|불루투스|bluetooth|wifi|와이파이)/;
const _lteNegative = /(lte모델x|lte 모델x|lte 미지원|셀룰러 사용은 불가|블루투스로만|통신사것 아님|통신사 것 아님|블루투스용)/;
const activationFuture = /(가개통|6개월후|개통가능|개통 가능|유심|통신사|바로 개통 가능|개통하여 사용가능)/;
const accessoryBundle = /(스트랩|밴드|케이스|커버|필름|충전기|충전 케이블|액정커버|보호케이스|보호필름|풀박스)/;
const chargerIncluded = /(충전기포함|충전기 포함|충전기까지|박스 안에 충전기|충전 케이블)/;
const fullboxSignal = /(풀박스|풀박)/;
const ownerCare = /(실사용|눈에 띄는 하자x|하자x|초기화 완료|풀충전 상태)/;
const negotiationSignal = /(네고가능|네고 가능)/;
const bundleLogistics = /(합배송 가능|합배송 가능합니다|다른 상품들과 합배송)/;
const alternateTradeMode = /(다른 방식의 거래시)/;
const noActivationRows = /(가개통|개통가능|개통 가능|유심|통신사|바로 개통 가능|개통하여 사용가능)/;

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
    const title = (sample.title ?? sample.name ?? "").toLowerCase();
    return (
      /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(text) &&
      /\b44mm\b|44m\b/.test(text) &&
      !/(클래식|classic|울트라|ultra)/.test(text) &&
      !globalExclude.test(text) &&
      !accessoryOnlyTitle.test(title) &&
      !unopenedPressure.test(text) &&
      merchantLike(sample) &&
      accessoryBundle.test(text) &&
      fullboxSignal.test(text) &&
      personalStory.test(text) &&
      !activationFuture.test(text)
    );
  });

  const merchantLikeRows = rows.filter(merchantLike);
  const ownerCareRows = rows.filter((row) => ownerCare.test(textFor(row)));
  const fullboxRows = rows.filter((row) => fullboxSignal.test(textFor(row)));
  const chargerIncludedRows = rows.filter((row) => chargerIncluded.test(textFor(row)));
  const initializedRows = rows.filter((row) => /초기화 완료/.test(textFor(row)));
  const fullChargeRows = rows.filter((row) => /풀충전 상태/.test(textFor(row)));
  const negotiationRows = rows.filter((row) => negotiationSignal.test(textFor(row)));
  const bundleLogisticsRows = rows.filter((row) => bundleLogistics.test(textFor(row)));
  const alternateTradeModeRows = rows.filter((row) => alternateTradeMode.test(textFor(row)));
  const noActivationRowsCount = rows.filter((row) => !noActivationRows.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_44mm_merchant_fullbox_semantics_report_only",
    scope: "galaxywatch8_44mm_merchant_fullbox_overlap",
    metrics: {
      baseRows: rows.length,
      merchantLikeRows: merchantLikeRows.length,
      ownerCareRows: ownerCareRows.length,
      fullboxRows: fullboxRows.length,
      chargerIncludedRows: chargerIncludedRows.length,
      initializedRows: initializedRows.length,
      fullChargeRows: fullChargeRows.length,
      negotiationRows: negotiationRows.length,
      bundleLogisticsRows: bundleLogisticsRows.length,
      alternateTradeModeRows: alternateTradeModeRows.length,
      noActivationRows: noActivationRowsCount.length,
      runtimeApprovedRows: 0,
    },
    samplePids: rows.map((row) => row.pid ?? "-"),
    sampleTitles: rows.map(cleanTitle),
    policyImplications: [
      "The surviving merchant-like overlap row looks owner-care on the surface, but negotiation and bundle-logistics wording keep it in merchant-style throughput territory.",
      "Fullbox, charger, initialization, and full-charge signals make the row descriptively rich, but they do not offset the seller-scale and resale-flow signals.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "watch for a future merchant-like Watch8 44mm row that keeps owner-care/fullbox language but drops bundle-logistics and alternate-trade wording",
      "if merchant-like fullbox rows accumulate, split them by repeated logistics template versus one-off rich description rows",
    ],
    doNotDo: [
      "Do not treat merchant-like fullbox rows as clean personal-clean support just because activation wording is absent",
      "Do not merge negotiation or combined-shipping language into neutral accessory context",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-merchant-fullbox-semantics-latest.json"),
    JSON.stringify(report, null, 2),
  );

  const md = [
    "# Smartwatch Galaxy Watch8 44mm Merchant Fullbox Semantics",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only semantics packet for the surviving merchant-like Watch8 44mm owner-care plus fullbox overlap row.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Sample PIDs",
    "",
    report.samplePids.length > 0 ? report.samplePids.map((pid) => `- ${pid}`).join("\n") : "- none",
    "",
    "## Sample Titles",
    "",
    report.sampleTitles.length > 0 ? report.sampleTitles.map((title) => `- ${title}`).join("\n") : "- none",
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

  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-merchant-fullbox-semantics-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-merchant-fullbox-semantics-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-merchant-fullbox-semantics-latest.md");
  console.log(
    `watch8 44mm merchant fullbox semantics: base=${report.metrics.baseRows}, owner_care=${report.metrics.ownerCareRows}, negotiation=${report.metrics.negotiationRows}, bundle_logistics=${report.metrics.bundleLogisticsRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
