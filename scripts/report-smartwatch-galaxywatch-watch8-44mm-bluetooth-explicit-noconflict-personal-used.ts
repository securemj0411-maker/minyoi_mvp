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
const bluetoothPattern = /(블루투스|bluetooth|wifi|와이파이)/;
const personalContextPattern = /(실사용|직거래|선물|초기화|상태\s*좋|깨끗|기스|몇번\s*착용|사용감\s*적)/;
const lteConflictPattern = /(lte|셀룰러|개통|통신사|가개통)/;
const unopenedPattern = /(미개봉|새상품|새제품|미사용)/;
const accessoryPattern = /(스트랩|밴드|충전기|케이스|필름|루프)/;

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function merchantLike(sample: Sample): boolean {
  const s = sample.seller ?? {};
  return Boolean(s.proshop || s.is_official || Number(s.review_count ?? 0) >= 30 || Number(s.sales_count ?? 0) >= 30);
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];

  const baseRows = samples.filter((sample) => {
    const text = textFor(sample);
    return /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(text) &&
      /\b44mm\b|44m\b/.test(text) &&
      bluetoothPattern.test(text) &&
      !globalExclude.test(text);
  });

  const noConflictRows = baseRows.filter((row) => !lteConflictPattern.test(textFor(row)));
  const nonMerchantRows = noConflictRows.filter((row) => !merchantLike(row));
  const personalUsedRows = nonMerchantRows.filter((row) => personalContextPattern.test(textFor(row)));
  const unopenedRows = personalUsedRows.filter((row) => unopenedPattern.test(textFor(row)));
  const accessoryRows = personalUsedRows.filter((row) => accessoryPattern.test(textFor(row)));
  const cleanNoConflictPersonalRows = personalUsedRows.filter((row) =>
    !unopenedPattern.test(textFor(row)) &&
    !accessoryPattern.test(textFor(row)),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_44mm_bluetooth_explicit_noconflict_personal_used_report_only",
    metrics: {
      baseRows: baseRows.length,
      noConflictRows: noConflictRows.length,
      nonMerchantRows: nonMerchantRows.length,
      personalUsedRows: personalUsedRows.length,
      unopenedRows: unopenedRows.length,
      accessoryRows: accessoryRows.length,
      cleanNoConflictPersonalRows: cleanNoConflictPersonalRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: {
      base: baseRows.map((row) => row.pid ?? "-"),
      noConflict: noConflictRows.map((row) => row.pid ?? "-"),
      cleanNoConflictPersonal: cleanNoConflictPersonalRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet isolates the best-case Watch8 44mm Bluetooth explicit slice by removing LTE/activation conflict before asking whether any personal-used body rows remain.",
      "If clean no-conflict personal-used rows stay near zero, Watch8 remains a pressure lane, not a trustworthy positive lane.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "compare clean no-conflict personal-used Watch8 rows against the Watch7 44mm anchor lane",
      "keep unopened and accessory context visible so the no-conflict slice is not overstated",
    ],
    doNotDo: [
      "Do not treat Bluetooth wording alone as approval",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-bluetooth-explicit-noconflict-personal-used-latest.json"),
    JSON.stringify(report, null, 2),
  );
  const md = [
    "# Smartwatch Galaxy Watch8 44mm Bluetooth Explicit No-Conflict Personal-Used",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only packet for the best-case Watch8 44mm Bluetooth explicit slice after removing LTE/activation conflict.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Sample PIDs",
    "",
    ...Object.entries(report.samplePids).map(([k, v]) => `- ${k}: ${(v as Array<string | number>).join(", ") || "-"}`),
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
  await writeFile(
    path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-bluetooth-explicit-noconflict-personal-used-latest.md"),
    `${md}\n`,
  );
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-bluetooth-explicit-noconflict-personal-used-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-bluetooth-explicit-noconflict-personal-used-latest.md");
  console.log(
    `watch8 44mm no-conflict personal-used: base=${report.metrics.baseRows}, clean=${report.metrics.cleanNoConflictPersonalRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
