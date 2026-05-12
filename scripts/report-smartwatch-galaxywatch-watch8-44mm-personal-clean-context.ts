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
const boxless = /(박스는 없|박스없|박스 없어요|박스는 없어|노박스)/;
const personalStory = /(선물|실사용|사용감|몇번|집에서만|깨끗|기스|스크레치|초기화|풀충전|직거래|하자x|하자 x|눈에 띄는 하자)/;
const explicitBluetooth = /(블루투스|불루투스|bluetooth|wifi|와이파이)/;
const lteNegative = /(lte모델x|lte 모델x|lte 미지원|셀룰러 사용은 불가|블루투스로만|통신사것 아님|통신사 것 아님|블루투스용)/;
const activationFuture = /(가개통|6개월후|개통가능|개통 가능|유심|통신사|바로 개통 가능|개통하여 사용가능)/;
const accessoryBundle = /(스트랩|밴드|케이스|커버|필름|충전기|충전 케이블|액정커버|보호케이스|보호필름|풀박스)/;

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
      (personalStory.test(text) || explicitBluetooth.test(text) || lteNegative.test(text) || activationFuture.test(text))
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
    decision: "galaxywatch_watch8_44mm_personal_clean_context_report_only",
    scope: "galaxywatch8_44mm_personal_clean_context",
    metrics: {
      totalRows: rows.length,
      nonMerchantRows: rows.filter((row) => !merchantLike(row)).length,
      boxlessRows: rows.filter((row) => boxless.test(textFor(row))).length,
      personalStoryRows: rows.filter((row) => personalStory.test(textFor(row))).length,
      explicitBluetoothRows: rows.filter((row) => explicitBluetooth.test(textFor(row))).length,
      lteNegativeRows: rows.filter((row) => lteNegative.test(textFor(row))).length,
      activationFutureRows: rows.filter((row) => activationFuture.test(textFor(row))).length,
      accessoryBundleRows: rows.filter((row) => accessoryBundle.test(textFor(row))).length,
      merchantLikeRows: rows.filter(merchantLike).length,
      cleanNoConflictRows: rows.filter((row) => {
        const text = textFor(row);
        return !lteNegative.test(text) && !activationFuture.test(text) && !accessoryBundle.test(text);
      }).length,
      runtimeApprovedRows: 0,
    },
    samplePids: rows.slice(0, 8).map((row) => row.pid ?? "-"),
    sampleTitles: rows.slice(0, 8).map(cleanTitle),
    policyImplications: [
      "This packet deepens the Watch8 44mm personal-clean lane using only non-unopened body rows so unopened-heavy resale pressure does not swamp the lane.",
      "If this context stays thin while activation-future or bundle pressure remains visible, Watch8 still needs targeted thickening rather than broader confidence claims.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "pair this packet with the Watch8 vs Watch7 44mm personal-clean comparison before broadening any Galaxy Watch body-positive lane",
      "separate activation-future body rows from clean no-conflict rows if more non-unopened Watch8 44mm samples arrive",
    ],
    doNotDo: [
      "Do not fold unopened-heavy Watch8 44mm rows back into this packet",
      "Do not infer runtime confidence from this context slice",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-personal-clean-context-latest.json"),
    JSON.stringify(report, null, 2),
  );

  const md = [
    "# Smartwatch Galaxy Watch8 44mm Personal Clean Context",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only context packet for the Watch8 44mm non-unopened personal-clean lane.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Sample PIDs",
    "",
    report.samplePids.map((pid) => `- ${pid}`).join("\n"),
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

  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-personal-clean-context-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-personal-clean-context-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-personal-clean-context-latest.md");
  console.log(`watch8 44mm personal clean context: total=${report.metrics.totalRows}, clean_no_conflict=${report.metrics.cleanNoConflictRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
