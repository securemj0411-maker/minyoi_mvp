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
    return !globalExclude.test(t) &&
      /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(t) &&
      /\b44mm\b|44m\b/.test(t) &&
      /(블루투스전용|wifi only|블루투스 모델)/.test(t) &&
      /(미개봉|새상품|새제품|미사용)/.test(t) &&
      !/(lte|셀룰러|가개통|개통가능|개통 가능|통신사)/.test(t);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_44mm_wifi_noconflict_report_only",
    metrics: {
      totalRows: rows.length,
      merchantLikeRows: rows.filter(merchantLike).length,
      nonMerchantRows: rows.filter((row) => !merchantLike(row)).length,
      accessoryBundleRows: rows.filter((row) => /(스트랩|밴드|충전기|케이스|필름|루프|사은품|추가)/.test(textFor(row))).length,
      multiQtyRows: rows.filter((row) => /(2개|3개|세개|두개|개당)/.test(textFor(row))).length,
      completedMarkerRows: rows.filter((row) => /(\[완료\]|판매완료|\b완료\b)/.test(textFor(row))).length,
      runtimeApprovedRows: 0,
    },
    samplePids: rows.slice(0, 10).map((row) => row.pid ?? "-"),
    policyImplications: [
      "This packet isolates the tiny wifi-only no-conflict slice inside the broader Watch8 44mm unopened-heavy lane.",
      "If this slice stays tiny, Watch8 remains a backlog visibility story rather than a runtime-worthy clean Bluetooth lane.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "watch whether wifi-only no-conflict rows grow beyond singleton status before any confidence discussion",
      "keep comparing this slice against the broader conflict-heavy unopened lane",
    ],
    doNotDo: [
      "Do not generalize one wifi-only no-conflict row into family-wide cleanliness",
      "Do not promote this packet into runtime confidence",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-wifi-noconflict-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Galaxy Watch8 44mm WiFi/BT No-Conflict",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only tiny slice for Watch8 44mm rows that say wifi/bluetooth-only without LTE/activation conflict wording.",
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
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-wifi-noconflict-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-wifi-noconflict-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-wifi-noconflict-latest.md");
  console.log(`watch8 44mm wifi no-conflict: total=${rows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
