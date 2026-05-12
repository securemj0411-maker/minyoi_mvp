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
const activationFuture = /(가개통|6개월후|개통가능|개통 가능|유심|통신사|바로 개통 가능|추후 개통)/;
const accessoryBundle = /(스트랩|밴드|케이스|커버|필름|충전기|충전 케이블|액정커버|보호케이스|보호필름|풀박스)/;
const personalStory = /(실사용|사용감|직거래|초기화 완료|상태 좋|기스|긁힘|눈에 띄는 하자x|하자x)/;

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
    return (
      /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(text) &&
      /\b44mm\b|44m\b/.test(text) &&
      !/(클래식|classic|울트라|ultra)/.test(text) &&
      !globalExclude.test(text) &&
      !accessoryOnlyTitle.test(title) &&
      !unopenedPressure.test(text)
    );
  });

  const merchantActivationAccessoryRows = rows.filter((row) => merchantLike(row) && activationFuture.test(textFor(row)) && accessoryBundle.test(textFor(row)));
  const personalAccessoryOnlyRows = rows.filter((row) => !merchantLike(row) && !activationFuture.test(textFor(row)) && accessoryBundle.test(textFor(row)));
  const personalAccessoryActivationRows = rows.filter((row) => !merchantLike(row) && activationFuture.test(textFor(row)) && accessoryBundle.test(textFor(row)));
  const personalStoryRows = rows.filter((row) => !merchantLike(row) && personalStory.test(textFor(row)));
  const cleanBodyRows = rows.filter((row) => !merchantLike(row) && !activationFuture.test(textFor(row)) && !accessoryBundle.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_44mm_pressure_row_classes_report_only",
    metrics: {
      totalRows: rows.length,
      merchantActivationAccessoryRows: merchantActivationAccessoryRows.length,
      personalAccessoryOnlyRows: personalAccessoryOnlyRows.length,
      personalAccessoryActivationRows: personalAccessoryActivationRows.length,
      personalStoryRows: personalStoryRows.length,
      cleanBodyRows: cleanBodyRows.length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      merchantActivationAccessoryPids: merchantActivationAccessoryRows.map((row) => row.pid ?? "-"),
      personalAccessoryOnlyPids: personalAccessoryOnlyRows.map((row) => row.pid ?? "-"),
      personalAccessoryActivationPids: personalAccessoryActivationRows.map((row) => row.pid ?? "-"),
      personalStoryPids: personalStoryRows.map((row) => row.pid ?? "-"),
      cleanBodyPids: cleanBodyRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet makes the tiny Watch8 44mm non-unopened lane readable row-by-row: merchant activation-plus-accessory pressure versus personal accessory-only pressure.",
      "If cleanBodyRows stay at zero, the lane remains a decomposition aid rather than a true personal-clean thickening candidate.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "track whether future Watch8 body rows land in personalAccessoryOnly first or whether a cleanBody row ever appears",
      "keep merchant activation-plus-accessory rows separated so they do not pollute the personal lane story",
    ],
    doNotDo: [
      "Do not treat personalAccessoryOnly as runtime-clean evidence",
      "Do not infer broad Watch8 confidence from this tiny row-class packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-pressure-row-classes-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Galaxy Watch8 44mm Pressure Row Classes",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only classification of the tiny Watch8 44mm non-unopened lane into row classes.",
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
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-pressure-row-classes-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-pressure-row-classes-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-pressure-row-classes-latest.md");
  console.log(`watch8 44mm pressure row classes: total=${rows.length}, merchant_activation_accessory=${merchantActivationAccessoryRows.length}, personal_accessory_only=${personalAccessoryOnlyRows.length}, clean_body=${cleanBodyRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
