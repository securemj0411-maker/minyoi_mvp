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
const accessoryBundle = /(스트랩|밴드|충전기|케이스|필름|루프|풀박스|박스)/;
const personalContextPattern = /(실사용|직거래|선물|초기화|상태\s*좋|기스|깨끗|몇번\s*착용|사용감)/;
const explicitBluetoothPattern = /(블루투스|bluetooth|wifi|와이파이)/;
const ltePattern = /(lte|셀룰러|개통|통신사|가개통)/;
const chargerPattern = /(충전기|케이블|충전독)/;

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
    return /(갤럭시\s*워치\s*7|갤럭시워치7|galaxy\s*watch\s*7)/.test(text) &&
      /\b44mm\b|44m\b/.test(text) &&
      explicitBluetoothPattern.test(text) &&
      !globalExclude.test(text);
  });

  const noConflictRows = baseRows.filter((row) => !ltePattern.test(textFor(row)));
  const nonMerchantRows = noConflictRows.filter((row) => !merchantLike(row));
  const personalUsedRows = nonMerchantRows.filter((row) => personalContextPattern.test(textFor(row)));
  const accessoryRows = personalUsedRows.filter((row) => accessoryBundle.test(textFor(row)));
  const chargerRows = personalUsedRows.filter((row) => chargerPattern.test(textFor(row)));
  const cleanRows = personalUsedRows.filter((row) => {
    const t = textFor(row);
    return !accessoryBundle.test(t) && !chargerPattern.test(t);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch7_44mm_bluetooth_explicit_noconflict_nonmerchant_personal_used_thickening_report_only",
    metrics: {
      baseRows: baseRows.length,
      noConflictRows: noConflictRows.length,
      nonMerchantRows: nonMerchantRows.length,
      personalUsedRows: personalUsedRows.length,
      accessoryRows: accessoryRows.length,
      chargerRows: chargerRows.length,
      cleanRows: cleanRows.length,
      runtimeApprovedRows: 0,
    },
    samplePids: {
      base: baseRows.map((row) => row.pid ?? "-"),
      clean: cleanRows.map((row) => row.pid ?? "-"),
      accessory: accessoryRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet thickens the cleanest believable Galaxy Watch anchor lane by forcing explicit Bluetooth wording, no LTE conflict, non-merchant sellers, and personal-used context.",
      "If cleanRows stays thin even here, Galaxy Watch remains mostly a guardrail family rather than a real positive-density family.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "compare this Watch7 clean anchor directly against Watch8 44mm no-conflict personal-used slices",
      "keep charger/fullbox/accessory baggage visible so the anchor is not overclaimed",
    ],
    doNotDo: [
      "Do not merge accessory or charger-heavy rows back into the anchor lane",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-galaxywatch-watch7-44mm-bluetooth-explicit-noconflict-nonmerchant-personal-used-thickening-latest.json"),
    JSON.stringify(report, null, 2),
  );
  const md = [
    "# Smartwatch Galaxy Watch7 44mm Bluetooth Explicit No-Conflict Non-Merchant Personal-Used Thickening",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only packet for thickening the narrowest clean Galaxy Watch7 44mm Bluetooth explicit anchor lane.",
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
    path.join(reportsDir, "smartwatch-galaxywatch-watch7-44mm-bluetooth-explicit-noconflict-nonmerchant-personal-used-thickening-latest.md"),
    `${md}\n`,
  );
  console.log("wrote reports/smartwatch-galaxywatch-watch7-44mm-bluetooth-explicit-noconflict-nonmerchant-personal-used-thickening-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch7-44mm-bluetooth-explicit-noconflict-nonmerchant-personal-used-thickening-latest.md");
  console.log(
    `watch7 44mm bluetooth explicit nonmerchant personal-used: base=${report.metrics.baseRows}, clean=${report.metrics.cleanRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
