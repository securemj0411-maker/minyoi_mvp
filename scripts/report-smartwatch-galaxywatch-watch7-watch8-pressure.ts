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

type Packet = {
  scope: string;
  rawRows: number;
  survivingRows: number;
  merchantLikeRows: number;
  accessoryBundleRows: number;
  explicitBluetoothRows: number;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  reportOnlyAction: string;
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "galaxywatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

const partsOrBuying = /(삽니다|구매|매입|부품용|고장|파손|케이스만|스트랩만|밴드만|충전기만|본체없음)/;
const accessoryBundle = /(스트랩|밴드|충전기|케이스|필름|루프)/;

const scopeDefs = [
  {
    scope: "galaxywatch7_44mm_clean_openbox",
    match: (text: string) => /(갤럭시\s*워치\s*7|갤럭시워치7|galaxy\s*watch\s*7)/.test(text) && /\b44mm\b/.test(text) && /(단순개봉|미개봉|새상품|깨끗|S급|사용감\s*적|실착\s*몇번)/.test(text),
  },
  {
    scope: "galaxywatch7_44mm_bluetooth_explicit",
    match: (text: string) => /(갤럭시\s*워치\s*7|갤럭시워치7|galaxy\s*watch\s*7)/.test(text) && /\b44mm\b/.test(text) && /(블루투스|bluetooth|wifi)/.test(text),
  },
  {
    scope: "galaxywatch6_classic_43mm_working",
    match: (text: string) => /(갤럭시\s*워치\s*6\s*클래식|갤럭시워치6클래식|galaxy\s*watch\s*6\s*classic)/.test(text) && /\b43mm\b/.test(text) && /(정상|작동|사용가능|상태\s*좋|깨끗)/.test(text),
  },
  {
    scope: "galaxywatch8_new_unopened_pressure",
    match: (text: string) => /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(text) && /(미개봉|새상품|새제품|미사용)/.test(text),
  },
];

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function merchantLike(sample: Sample): boolean {
  const s = sample.seller ?? {};
  return Boolean(s.proshop || s.is_official || Number(s.review_count ?? 0) >= 30 || Number(s.sales_count ?? 0) >= 30);
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const packets: Packet[] = scopeDefs.map((def) => {
    const raw = samples.filter((sample) => def.match(textFor(sample)));
    const surviving = raw.filter((sample) => !partsOrBuying.test(textFor(sample)));
    return {
      scope: def.scope,
      rawRows: raw.length,
      survivingRows: surviving.length,
      merchantLikeRows: raw.filter(merchantLike).length,
      accessoryBundleRows: raw.filter((sample) => accessoryBundle.test(textFor(sample))).length,
      explicitBluetoothRows: raw.filter((sample) => /(블루투스|bluetooth|wifi)/.test(textFor(sample))).length,
      samplePids: (surviving.length > 0 ? surviving : raw).slice(0, 5).map((row) => row.pid ?? "-"),
      sampleTitles: (surviving.length > 0 ? surviving : raw).slice(0, 5).map(cleanTitle),
      reportOnlyAction:
        def.scope === "galaxywatch8_new_unopened_pressure"
          ? "keep as pressure packet only; density exists but exact positive confidence is not ready"
          : "keep as narrow Galaxy Watch positive visibility packet only; no runtime promotion",
      runtimeApproved: false as const,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch7_watch8_pressure_report_only",
    metrics: {
      scopeCount: packets.length,
      watch7CleanSurvivingRows: packets.find((row) => row.scope === "galaxywatch7_44mm_clean_openbox")?.survivingRows ?? 0,
      watch7BluetoothSurvivingRows: packets.find((row) => row.scope === "galaxywatch7_44mm_bluetooth_explicit")?.survivingRows ?? 0,
      watch6ClassicWorkingSurvivingRows: packets.find((row) => row.scope === "galaxywatch6_classic_43mm_working")?.survivingRows ?? 0,
      watch8NewPressureRawRows: packets.find((row) => row.scope === "galaxywatch8_new_unopened_pressure")?.rawRows ?? 0,
      runtimeApprovedRows: 0,
    },
    packets,
    policyImplications: [
      "Galaxy Watch can support very narrow positive visibility packets, but sample density is still thin enough that each slice needs to stay separate.",
      "Watch8 new/unopened wording can look large at family level while still collapsing under stricter positive expectations.",
      "Accessory/bundle language should be measured alongside body-positive slices so we do not overblock plausible body rows or overtrust bundle-heavy rows.",
      "This packet is report-only and must not change runtime parser, candidate pool, or public promotion behavior.",
    ],
    nextReportOnlyExperiments: [
      "thicken Watch7 44mm clean/open-box rows with more explicit non-merchant examples",
      "split Watch8 new/unopened pressure into bluetooth-explicit vs ambiguous connectivity lanes",
      "pair Galaxy Watch body-positive packets with accessory-bundle context before discussing parser promotion",
    ],
    doNotDo: [
      "Do not treat Galaxy Watch family-level density as enough for runtime promotion",
      "Do not infer Bluetooth/LTE/WiFi from family alone",
      "Do not collapse Watch7, Watch8, and Watch6 Classic into one broad positive story",
      "Do not runtime-wire any scope from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch7-watch8-pressure-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| scope | raw_rows | surviving_rows | merchant_like_rows | accessory_bundle_rows | explicit_bluetooth_rows | report_only_action | sample_pids |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...packets.map(
      (row) =>
        `| ${row.scope} | ${row.rawRows} | ${row.survivingRows} | ${row.merchantLikeRows} | ${row.accessoryBundleRows} | ${row.explicitBluetoothRows} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} |`,
    ),
  ].join("\n");

  const md = [
    "# Smartwatch Galaxy Watch Watch7/Watch8 Pressure",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only Galaxy Watch narrow positive visibility and Watch8 pressure packet.",
    "",
    "## Metrics",
    "",
    `- scope count: ${report.metrics.scopeCount}`,
    `- Watch7 clean/open-box surviving rows: ${report.metrics.watch7CleanSurvivingRows}`,
    `- Watch7 bluetooth surviving rows: ${report.metrics.watch7BluetoothSurvivingRows}`,
    `- Watch6 Classic working surviving rows: ${report.metrics.watch6ClassicWorkingSurvivingRows}`,
    `- Watch8 new/unopened raw rows: ${report.metrics.watch8NewPressureRawRows}`,
    "",
    "## Packets",
    "",
    table,
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

  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch7-watch8-pressure-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch7-watch8-pressure-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch7-watch8-pressure-latest.md");
  console.log(
    `galaxywatch pressure packet: watch7_clean=${report.metrics.watch7CleanSurvivingRows}, watch7_bt=${report.metrics.watch7BluetoothSurvivingRows}, watch8_raw=${report.metrics.watch8NewPressureRawRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
