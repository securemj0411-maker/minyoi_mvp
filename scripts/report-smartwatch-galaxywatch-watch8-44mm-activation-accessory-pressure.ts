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

  const activationFutureRows = rows.filter((row) => activationFuture.test(textFor(row)));
  const accessoryBundleRows = rows.filter((row) => accessoryBundle.test(textFor(row)));
  const activationAndAccessoryRows = rows.filter((row) => activationFuture.test(textFor(row)) && accessoryBundle.test(textFor(row)));
  const activationOnlyRows = rows.filter((row) => activationFuture.test(textFor(row)) && !accessoryBundle.test(textFor(row)));
  const accessoryOnlyRows = rows.filter((row) => !activationFuture.test(textFor(row)) && accessoryBundle.test(textFor(row)));
  const merchantLikeRows = rows.filter(merchantLike);
  const nonMerchantRows = rows.filter((row) => !merchantLike(row));
  const cleanResidualRows = rows.filter((row) => !activationFuture.test(textFor(row)) && !accessoryBundle.test(textFor(row)) && !merchantLike(row));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_44mm_activation_accessory_pressure_report_only",
    metrics: {
      baseRows: rows.length,
      activationFutureRows: activationFutureRows.length,
      accessoryBundleRows: accessoryBundleRows.length,
      activationAndAccessoryRows: activationAndAccessoryRows.length,
      activationOnlyRows: activationOnlyRows.length,
      accessoryOnlyRows: accessoryOnlyRows.length,
      merchantLikeRows: merchantLikeRows.length,
      nonMerchantRows: nonMerchantRows.length,
      cleanResidualRows: cleanResidualRows.length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      activationFuturePids: activationFutureRows.map((row) => row.pid ?? "-"),
      accessoryBundlePids: accessoryBundleRows.map((row) => row.pid ?? "-"),
      activationAndAccessoryPids: activationAndAccessoryRows.map((row) => row.pid ?? "-"),
      activationOnlyPids: activationOnlyRows.map((row) => row.pid ?? "-"),
      accessoryOnlyPids: accessoryOnlyRows.map((row) => row.pid ?? "-"),
      cleanResidualPids: cleanResidualRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet separates Watch8 44mm pressure into activation-related and accessory-related slices so we can see which pressure dominates the non-unopened lane.",
      "If clean residual rows stay at zero while activation/accessory overlap dominates, Watch8 remains a visibility-only lane rather than a thickening candidate.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "look for a non-merchant clean residual row before discussing any Watch8 broadening",
      "keep activation-only and accessory-only slices separate so different types of pressure do not collapse into one score",
    ],
    doNotDo: [
      "Do not merge activation-heavy rows into a clean body-positive story",
      "Do not infer runtime confidence from this pressure packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-activation-accessory-pressure-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Galaxy Watch8 44mm Activation Accessory Pressure",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only pressure split for Watch8 44mm non-unopened rows.",
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
  ].join('\n');
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-activation-accessory-pressure-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-activation-accessory-pressure-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-activation-accessory-pressure-latest.md");
  console.log(`watch8 44mm pressure: base=${rows.length}, activation=${activationFutureRows.length}, accessory=${accessoryBundleRows.length}, clean_residual=${cleanResidualRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
