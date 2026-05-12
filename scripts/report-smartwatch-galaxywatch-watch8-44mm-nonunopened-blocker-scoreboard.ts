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
const activationFuture = /(가개통|6개월후|개통가능|개통 가능|유심|통신사|바로 개통 가능|추후 개통|개통하여 사용가능)/;
const chargerIncluded = /(충전기포함|충전기 포함|충전기까지|박스 안에 충전기|충전 케이블)/;
const bundlePattern = /(스트랩|밴드|케이스|커버|필름|충전기|충전 케이블|액정커버|보호케이스|보호필름|풀박스)/;
const fullboxSignal = /(풀박스|풀박)/;
const ownerCarePattern = /(실사용|하자x|하자 x|눈에 띄는 하자x|초기화 완료|풀충전|상태|직거래)/;
const lteConflict = /(cellular|셀룰러|lte|유심|통신사|개통)/;

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
    const text = textFor(sample);
    const title = (sample.title ?? sample.name ?? "").toLowerCase();
    return /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(text) &&
      /\b44mm\b|44m\b/.test(text) &&
      !/(클래식|classic|울트라|ultra)/.test(text) &&
      !globalExclude.test(text) &&
      !accessoryOnlyTitle.test(title) &&
      !unopenedPressure.test(text);
  });

  const activationChargerNonMerchant = rows.filter((row) => activationFuture.test(textFor(row)) && chargerIncluded.test(textFor(row)) && !merchantLike(row));
  const merchantFullbox = rows.filter((row) => merchantLike(row) && fullboxSignal.test(textFor(row)));
  const cleanResidual = rows.filter((row) => !activationFuture.test(textFor(row)) && !bundlePattern.test(textFor(row)) && !merchantLike(row) && !lteConflict.test(textFor(row)));
  const connectivityConflicted = rows.filter((row) => lteConflict.test(textFor(row)));
  const accessoryBundle = rows.filter((row) => bundlePattern.test(textFor(row)));
  const ownerCare = rows.filter((row) => ownerCarePattern.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_44mm_nonunopened_blocker_scoreboard_report_only",
    metrics: {
      nonUnopenedRows: rows.length,
      activationChargerNonMerchantRows: activationChargerNonMerchant.length,
      merchantFullboxRows: merchantFullbox.length,
      cleanResidualRows: cleanResidual.length,
      connectivityConflictedRows: connectivityConflicted.length,
      accessoryBundleRows: accessoryBundle.length,
      ownerCareRows: ownerCare.length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      activationChargerNonMerchantPids: activationChargerNonMerchant.map((row) => row.pid ?? "-"),
      merchantFullboxPids: merchantFullbox.map((row) => row.pid ?? "-"),
      cleanResidualPids: cleanResidual.map((row) => row.pid ?? "-"),
      connectivityConflictedPids: connectivityConflicted.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This scoreboard keeps the Watch8 44mm non-unopened lane legible by separating the current blocker classes instead of treating the lane as one fuzzy maybe-positive.",
      "If cleanResidualRows stays at zero while activation/merchant/accessory classes absorb all rows, the lane remains a guardrail only.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "watch whether future non-unopened rows accumulate into clean residual instead of activation or merchant-fullbox classes",
      "keep connectivity-conflicted rows separate from accessory-only pressure",
    ],
    doNotDo: [
      "Do not treat this scoreboard as promotion evidence",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-nonunopened-blocker-scoreboard-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Galaxy Watch8 44mm Non-Unopened Blocker Scoreboard",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only scoreboard for Watch8 44mm non-unopened blocker classes.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Lane Samples",
    "",
    ...Object.entries(report.laneSamples).map(([k, v]) => `- ${k}: ${(v as Array<string | number>).join(", ") || "-"}`),
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
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-nonunopened-blocker-scoreboard-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-nonunopened-blocker-scoreboard-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-nonunopened-blocker-scoreboard-latest.md");
  console.log(`watch8 44mm nonunopened scoreboard: base=${rows.length}, activation_nonmerchant=${report.metrics.activationChargerNonMerchantRows}, merchant_fullbox=${report.metrics.merchantFullboxRows}, clean_residual=${report.metrics.cleanResidualRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
