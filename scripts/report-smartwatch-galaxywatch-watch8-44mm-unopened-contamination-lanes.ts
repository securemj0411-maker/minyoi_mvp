import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
  content_hash?: string | null;
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

function normalizedTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const rows = samples.filter((sample) => {
    const t = textFor(sample);
    return (
      /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(t) &&
      /\b44mm\b|44m\b/.test(t) &&
      /(블루투스|bluetooth|wifi)/.test(t) &&
      /(미개봉|새상품|새제품|미사용)/.test(t) &&
      !globalExclude.test(t)
    );
  });

  const accessoryBundleRows = rows.filter((row) => /(스트랩|밴드|충전기|케이스|필름|루프|사은품|추가)/.test(textFor(row)));
  const merchantLikeRows = rows.filter(merchantLike);
  const multiQtyRows = rows.filter((row) => /(2개|3개|세개|두개|개당)/.test(textFor(row)));
  const completedMarkerRows = rows.filter((row) => /(\[완료\]|판매완료|\b완료\b)/.test(textFor(row)));
  const connectivityConflictRows = rows.filter((row) => /(lte|셀룰러|가개통|개통가능)/.test(textFor(row)));

  const titleCounts = new Map<string, number>();
  const hashCounts = new Map<string, number>();
  for (const row of rows) {
    const title = normalizedTitle(row);
    if (title) titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
    if (row.content_hash) hashCounts.set(row.content_hash, (hashCounts.get(row.content_hash) ?? 0) + 1);
  }
  const repeatedTitleRows = rows.filter((row) => {
    const title = normalizedTitle(row);
    return title ? (titleCounts.get(title) ?? 0) > 1 : false;
  });
  const repeatedContentHashRows = rows.filter((row) => row.content_hash ? (hashCounts.get(row.content_hash) ?? 0) > 1 : false);

  const cleanUnopenedRows = rows.filter((row) =>
    !/(스트랩|밴드|충전기|케이스|필름|루프|사은품|추가)/.test(textFor(row)) &&
    !merchantLike(row) &&
    !/(2개|3개|세개|두개|개당)/.test(textFor(row)) &&
    !/(\[완료\]|판매완료|\b완료\b)/.test(textFor(row))
  );
  const cleanUnopenedNoConnectivityConflictRows = cleanUnopenedRows.filter((row) => !/(lte|셀룰러|가개통|개통가능)/.test(textFor(row)));
  const cleanUnopenedWithConnectivityConflictRows = cleanUnopenedRows.filter((row) => /(lte|셀룰러|가개통|개통가능)/.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_44mm_unopened_contamination_lanes_report_only",
    metrics: {
      baseRows: rows.length,
      accessoryBundleRows: accessoryBundleRows.length,
      merchantLikeRows: merchantLikeRows.length,
      multiQtyRows: multiQtyRows.length,
      completedMarkerRows: completedMarkerRows.length,
      connectivityConflictRows: connectivityConflictRows.length,
      repeatedTitleRows: repeatedTitleRows.length,
      repeatedContentHashRows: repeatedContentHashRows.length,
      cleanUnopenedRows: cleanUnopenedRows.length,
      cleanUnopenedNoConnectivityConflictRows: cleanUnopenedNoConnectivityConflictRows.length,
      cleanUnopenedWithConnectivityConflictRows: cleanUnopenedWithConnectivityConflictRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: rows.slice(0, 10).map((row) => row.pid ?? "-"),
    policyImplications: [
      "This packet decomposes the current Watch8 44mm unopened-heavy slice into contamination lanes instead of treating it as one clean unopened story.",
      "If connectivity-conflict rows dominate the remaining clean-unopened slice, the lane is still useful for backlog visibility but not for broad confidence claims.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "separate clean-unopened rows from connectivity-conflicted rows before any confidence discussion",
      "track whether accessory bundle and merchant-like pressure shrink as more Watch8 44mm rows accumulate",
    ],
    doNotDo: [
      "Do not treat unopened-heavy rows as a generic positive lane without contamination checks",
      "Do not promote Watch8 family-level confidence from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-unopened-contamination-lanes-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Galaxy Watch8 44mm Unopened Contamination Lanes",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only contamination decomposition for the current Watch8 44mm unopened-heavy lane.",
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
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-unopened-contamination-lanes-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-unopened-contamination-lanes-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-unopened-contamination-lanes-latest.md");
  console.log(`watch8 44mm contamination lanes: base=${rows.length}, clean=${cleanUnopenedRows.length}, no_conflict=${cleanUnopenedNoConnectivityConflictRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
