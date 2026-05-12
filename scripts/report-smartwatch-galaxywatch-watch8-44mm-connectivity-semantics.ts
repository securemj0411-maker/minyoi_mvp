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
    const t = textFor(sample);
    return !globalExclude.test(t)
      && /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(t)
      && /\b44mm\b|44m\b/.test(t)
      && /(블루투스|bluetooth|wifi only|블루투스전용|블루투스 모델)/.test(t)
      && /(미개봉|새상품|새제품|미사용)/.test(t);
  });

  const bluetoothExplicitRows = rows.filter((row) => /(wifi only|블루투스전용|블루투스 모델|블루투스로만)/.test(textFor(row)));
  const lteNegativeDisclaimerRows = rows.filter((row) => /(lte모델\s*x|lte 모델\s*x|셀룰러\s*x|셀룰러x|블루투스로만|개통안됨|개통 불가|통신사 것 아님)/.test(textFor(row)));
  const ltePositiveCapabilityRows = rows.filter((row) => /(lte|셀룰러).*(가능|지원|버전|모델)/.test(textFor(row)) && !/(x|불가|아님)/.test(textFor(row)));
  const activationFutureRows = rows.filter((row) => /(가개통|개통가능|개통 가능|6개월뒤 개통|추후 개통)/.test(textFor(row)));
  const mixedSignalRows = rows.filter((row) => /(lte|셀룰러)/.test(textFor(row)) && /(블루투스|wifi only|블루투스전용|블루투스로만)/.test(textFor(row)));
  const nonMerchantRows = rows.filter((row) => !merchantLike(row));
  const singleUnitRows = rows.filter((row) => !/(2개|3개|세개|두개|개당)/.test(textFor(row)));
  const multiQtyRows = rows.filter((row) => /(2개|3개|세개|두개|개당)/.test(textFor(row)));
  const personalStoryRows = rows.filter((row) => /(판매합니다|연락주세요|필요하신 분|개인|실사용|사용하던)/.test(textFor(row)) && !merchantLike(row));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_44mm_connectivity_semantics_report_only",
    metrics: {
      baseRows: rows.length,
      bluetoothExplicitRows: bluetoothExplicitRows.length,
      lteNegativeDisclaimerRows: lteNegativeDisclaimerRows.length,
      ltePositiveCapabilityRows: ltePositiveCapabilityRows.length,
      activationFutureRows: activationFutureRows.length,
      mixedSignalRows: mixedSignalRows.length,
      nonMerchantRows: nonMerchantRows.length,
      singleUnitRows: singleUnitRows.length,
      multiQtyRows: multiQtyRows.length,
      personalStoryRows: personalStoryRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: rows.slice(0, 10).map((row) => row.pid ?? "-"),
    policyImplications: [
      "This packet separates LTE wording by meaning so Watch8 44mm Bluetooth lane is not judged only by raw LTE token presence.",
      "If LTE-negative disclaimers dominate while true activation-future or LTE-capability rows stay low, the current conflict pressure may be overstated.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "pair this packet with personal clean lane comparison against Watch7 44mm before any Watch8 confidence discussion",
      "keep singleton wifi-no-conflict row as a guardrail until single-unit non-conflicted rows grow",
    ],
    doNotDo: [
      "Do not assume all LTE mentions are positive conflict pressure",
      "Do not promote Watch8 44mm from this packet alone",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-connectivity-semantics-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Galaxy Watch8 44mm Connectivity Semantics",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only connectivity wording semantics packet for Watch8 44mm Bluetooth/New rows.",
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
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-connectivity-semantics-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-connectivity-semantics-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-connectivity-semantics-latest.md");
  console.log(`watch8 44mm connectivity semantics: base=${rows.length}, lte_negative=${lteNegativeDisclaimerRows.length}, activation_future=${activationFutureRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
