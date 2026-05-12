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
    return (
      /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(t) &&
      /\b44mm\b|44m\b/.test(t) &&
      /(블루투스|bluetooth|wifi)/.test(t) &&
      /(미개봉|새상품|새제품|미사용)/.test(t) &&
      !globalExclude.test(t)
    );
  });

  const lteConflictRows = rows.filter((row) => /(lte|셀룰러)/.test(textFor(row)));
  const activationConflictRows = rows.filter((row) => /(가개통|개통가능|개통 가능|통신사)/.test(textFor(row)));
  const wifiOnlyRows = rows.filter((row) => /(블루투스전용|wifi only|블루투스 모델)/.test(textFor(row)));
  const wifiOnlyNoConflictRows = wifiOnlyRows.filter((row) => !/(lte|셀룰러|가개통|개통가능|개통 가능|통신사)/.test(textFor(row)));
  const merchantConflictRows = rows.filter((row) => merchantLike(row) && /(lte|셀룰러|가개통|개통가능|개통 가능|통신사)/.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_44mm_connectivity_conflict_lanes_report_only",
    metrics: {
      baseRows: rows.length,
      lteConflictRows: lteConflictRows.length,
      activationConflictRows: activationConflictRows.length,
      wifiOnlyRows: wifiOnlyRows.length,
      wifiOnlyNoConflictRows: wifiOnlyNoConflictRows.length,
      merchantConflictRows: merchantConflictRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: rows.slice(0, 10).map((row) => row.pid ?? "-"),
    policyImplications: [
      "This packet isolates the connectivity conflict pressure inside the current Watch8 44mm unopened-heavy slice.",
      "If wifi-only wording still coexists with LTE/cellular or activation language, the lane remains useful only as a report-only backlog slice.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "separate wifi-only no-conflict rows from lte/activation conflict rows before any confidence discussion",
      "watch whether non-merchant no-conflict rows ever become dense enough to justify a future controlled parser experiment",
    ],
    doNotDo: [
      "Do not treat Bluetooth wording as trustworthy by itself when LTE/activation text is present",
      "Do not promote Watch8 family-level confidence from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-connectivity-conflict-lanes-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Galaxy Watch8 44mm Connectivity Conflict Lanes",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only connectivity conflict split for the current Watch8 44mm unopened-heavy lane.",
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
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-connectivity-conflict-lanes-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-connectivity-conflict-lanes-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-connectivity-conflict-lanes-latest.md");
  console.log(`watch8 44mm connectivity conflicts: base=${rows.length}, lte=${lteConflictRows.length}, wifi_only_no_conflict=${wifiOnlyNoConflictRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
