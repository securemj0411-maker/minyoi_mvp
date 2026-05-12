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
const activationFuture = /(가개통|6개월후|개통가능|개통 가능|유심|통신사|바로 개통 가능|개통하여 사용가능)/;
const chargerIncluded = /(충전기포함|충전기 포함|충전기까지|박스 안에 충전기|충전 케이블)/;
const cosmeticWear = /(긁힘|기스|스크레치|하자x|하자 x|눈에 띄는 하자x)/;
const personalStory = /(실사용|직거래|초기화 완료|상태 좋|풀충전)/;
const lteTitleOrBody = /(lte|셀룰러|자급제)/;
const merchantThreshold = 30;

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function merchantLike(sample: Sample): boolean {
  const s = sample.seller ?? {};
  return Boolean(s.proshop || s.is_official || Number(s.review_count ?? 0) >= merchantThreshold || Number(s.sales_count ?? 0) >= merchantThreshold);
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const rows = samples.filter((sample) => {
    const text = textFor(sample);
    const title = (sample.title ?? sample.name ?? "").toLowerCase();
    return /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(text) &&
      /\b44mm\b|44m\b/.test(text) &&
      !/(클래식|classic|울트라|ultra)/.test(text) &&
      !globalExclude.test(text) &&
      !accessoryOnlyTitle.test(title) &&
      !unopenedPressure.test(text) &&
      !merchantLike(sample) &&
      activationFuture.test(text);
  });

  const chargerRows = rows.filter((row) => chargerIncluded.test(textFor(row)));
  const cosmeticWearRows = rows.filter((row) => cosmeticWear.test(textFor(row)));
  const personalStoryRows = rows.filter((row) => personalStory.test(textFor(row)));
  const lteCarrierRows = rows.filter((row) => lteTitleOrBody.test(textFor(row)));
  const explicitProblemRows = rows.filter((row) => chargerIncluded.test(textFor(row)) && cosmeticWear.test(textFor(row)) && lteTitleOrBody.test(textFor(row)));
  const cleanActivationRows = rows.filter((row) => !chargerIncluded.test(textFor(row)) && !cosmeticWear.test(textFor(row)) && !lteTitleOrBody.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_44mm_nonmerchant_activation_row_semantics_report_only",
    metrics: {
      totalNonMerchantActivationRows: rows.length,
      chargerRows: chargerRows.length,
      cosmeticWearRows: cosmeticWearRows.length,
      personalStoryRows: personalStoryRows.length,
      lteCarrierRows: lteCarrierRows.length,
      explicitProblemRows: explicitProblemRows.length,
      cleanActivationRows: cleanActivationRows.length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      nonMerchantActivationPids: rows.map((row) => row.pid ?? "-"),
      chargerPids: chargerRows.map((row) => row.pid ?? "-"),
      cosmeticWearPids: cosmeticWearRows.map((row) => row.pid ?? "-"),
      personalStoryPids: personalStoryRows.map((row) => row.pid ?? "-"),
      lteCarrierPids: lteCarrierRows.map((row) => row.pid ?? "-"),
      explicitProblemPids: explicitProblemRows.map((row) => row.pid ?? "-"),
      cleanActivationPids: cleanActivationRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet checks whether the current non-merchant Watch8 activation row is a usable clean activation story or just a single row carrying charger/LTE/cosmetic baggage.",
      "If cleanActivationRows stays at zero, the non-merchant activation row remains a wording-pressure example, not a clean lane seed.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "track whether any later non-merchant activation row appears without charger/LTE/cosmetic baggage",
      "keep this row separate from merchant-like fullbox rows so non-merchant wording is not overclaimed",
    ],
    doNotDo: [
      "Do not treat a single non-merchant activation row as clean lane evidence when cleanActivationRows is zero",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-nonmerchant-activation-row-semantics-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Galaxy Watch8 44mm Non-Merchant Activation Row Semantics",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only packet for the current non-merchant Watch8 activation row.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Lane Samples",
    "",
    ...Object.entries(report.laneSamples).map(([k, v]) => `- ${k}: ${(v as Array<string | number>).join(', ') || '-'}`),
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
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-nonmerchant-activation-row-semantics-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-nonmerchant-activation-row-semantics-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-nonmerchant-activation-row-semantics-latest.md");
  console.log(`watch8 44mm nonmerchant activation semantics: total=${rows.length}, clean_activation=${cleanActivationRows.length}, explicit_problem=${explicitProblemRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
