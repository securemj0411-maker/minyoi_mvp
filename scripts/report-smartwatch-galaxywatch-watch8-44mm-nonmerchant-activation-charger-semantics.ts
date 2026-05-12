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
const explicitBluetooth = /(블루투스|불루투스|bluetooth|wifi|와이파이)/;
const lteNegative = /(lte모델x|lte 모델x|lte 미지원|셀룰러 사용은 불가|블루투스로만|통신사것 아님|통신사 것 아님|블루투스용)/;
const activationFuture = /(가개통|6개월후|개통가능|개통 가능|유심|통신사|바로 개통 가능|개통하여 사용가능)/;
const accessoryBundle = /(스트랩|밴드|케이스|커버|필름|충전기|충전 케이블|액정커버|보호케이스|보호필름|풀박스)/;
const chargerIncluded = /(충전기포함|충전기 포함|충전기까지|박스 안에 충전기|충전 케이블)/;
const ltePositive = /(lte|셀룰러)/;
const selfContained = /(자급제)/;
const immediateActivation = /(바로 개통 가능|개통가능|개통 가능|개통하여 사용가능)/;
const cosmeticWear = /(긁힘|기스|스크레치)/;
const directDeal = /(직거래)/;
const productionDate = /(20\d{2}년\s*\d{1,2}월\s*생산)/;

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
      !merchantLike(sample) &&
      accessoryBundle.test(text) &&
      activationFuture.test(text) &&
      chargerIncluded.test(text) &&
      (personalStory.test(text) || explicitBluetooth.test(text) || lteNegative.test(text) || activationFuture.test(text))
    );
  });

  const ltePositiveRows = rows.filter((row) => ltePositive.test(textFor(row)));
  const selfContainedRows = rows.filter((row) => selfContained.test(textFor(row)));
  const immediateActivationRows = rows.filter((row) => immediateActivation.test(textFor(row)));
  const chargerIncludedRows = rows.filter((row) => chargerIncluded.test(textFor(row)));
  const cosmeticWearRows = rows.filter((row) => cosmeticWear.test(textFor(row)));
  const directDealRows = rows.filter((row) => directDeal.test(textFor(row)));
  const productionDateRows = rows.filter((row) => productionDate.test(textFor(row)));
  const noBluetoothExplicitRows = rows.filter((row) => !explicitBluetooth.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_44mm_nonmerchant_activation_charger_semantics_report_only",
    scope: "galaxywatch8_44mm_nonmerchant_activation_charger_overlap",
    metrics: {
      baseRows: rows.length,
      ltePositiveRows: ltePositiveRows.length,
      selfContainedRows: selfContainedRows.length,
      immediateActivationRows: immediateActivationRows.length,
      chargerIncludedRows: chargerIncludedRows.length,
      cosmeticWearRows: cosmeticWearRows.length,
      directDealRows: directDealRows.length,
      productionDateRows: productionDateRows.length,
      noBluetoothExplicitRows: noBluetoothExplicitRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: rows.map((row) => row.pid ?? "-"),
    sampleTitles: rows.map(cleanTitle),
    policyImplications: [
      "The surviving non-merchant overlap row is still activation pressure, not a clean Bluetooth body row: LTE/self-contained/immediate-activation wording all remain present alongside charger-in-box language.",
      "Cosmetic-wear and direct-deal phrasing make the row readable as a real personal listing, but they do not neutralize the activation semantics.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "watch for a future non-merchant accessory row that keeps charger or box context but drops LTE/immediate-activation wording",
      "compare any new non-merchant Watch8 44mm row against this semantics template before broadening personal-clean claims",
    ],
    doNotDo: [
      "Do not treat charger-in-box phrasing as a clean accessory-neutral signal when immediate activation wording is present",
      "Do not promote Watch8 44mm non-merchant confidence from this packet alone",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-nonmerchant-activation-charger-semantics-latest.json"),
    JSON.stringify(report, null, 2),
  );

  const md = [
    "# Smartwatch Galaxy Watch8 44mm Nonmerchant Activation Charger Semantics",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only semantics packet for the surviving non-merchant Watch8 44mm activation-plus-charger overlap row.",
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

  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-nonmerchant-activation-charger-semantics-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-nonmerchant-activation-charger-semantics-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-nonmerchant-activation-charger-semantics-latest.md");
  console.log(
    `watch8 44mm nonmerchant activation charger semantics: base=${report.metrics.baseRows}, lte_positive=${report.metrics.ltePositiveRows}, immediate_activation=${report.metrics.immediateActivationRows}, charger=${report.metrics.chargerIncludedRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
