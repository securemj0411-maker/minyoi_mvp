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

type Lane = {
  lane: string;
  rows: number;
  merchantLikeRows: number;
  classicRows: number;
  size40Rows: number;
  size44Rows: number;
  size46Rows: number;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  reportOnlyAction: string;
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "galaxywatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

const partsOrBuying = /(삽니다|구매|매입|부품용|고장|파손|케이스만|스트랩만|밴드만|충전기만|본체없음)/;

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
  const rows = samples.filter((sample) => /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(textFor(sample)) && !partsOrBuying.test(textFor(sample)));

  const laneDefs = [
    {
      lane: "watch8_bluetooth_explicit",
      match: (text: string) => /(블루투스|bluetooth|wifi)/.test(text) && !/(lte|셀룰러)/.test(text),
      reportOnlyAction: "use to measure explicit non-cellular density only; do not infer missing lanes from this",
    },
    {
      lane: "watch8_lte_explicit",
      match: (text: string) => /(lte|셀룰러)/.test(text),
      reportOnlyAction: "use to separate LTE pressure from Bluetooth rows before any positive interpretation",
    },
    {
      lane: "watch8_connectivity_unknown",
      match: (text: string) => !/(블루투스|bluetooth|wifi|lte|셀룰러)/.test(text),
      reportOnlyAction: "keep as unknown-connectivity pressure only; not a positive lane",
    },
  ];

  const lanes: Lane[] = laneDefs.map((def) => {
    const matched = rows.filter((sample) => def.match(textFor(sample)));
    return {
      lane: def.lane,
      rows: matched.length,
      merchantLikeRows: matched.filter(merchantLike).length,
      classicRows: matched.filter((sample) => /(클래식|classic)/.test(textFor(sample))).length,
      size40Rows: matched.filter((sample) => /\b40mm\b|40m\b/.test(textFor(sample))).length,
      size44Rows: matched.filter((sample) => /\b44mm\b|44m\b/.test(textFor(sample))).length,
      size46Rows: matched.filter((sample) => /\b46mm\b|46m\b/.test(textFor(sample))).length,
      samplePids: matched.slice(0, 5).map((row) => row.pid ?? "-"),
      sampleTitles: matched.slice(0, 5).map(cleanTitle),
      reportOnlyAction: def.reportOnlyAction,
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
    decision: "galaxywatch_watch8_connectivity_lanes_report_only",
    metrics: {
      baseRows: rows.length,
      bluetoothRows: lanes.find((lane) => lane.lane === "watch8_bluetooth_explicit")?.rows ?? 0,
      lteRows: lanes.find((lane) => lane.lane === "watch8_lte_explicit")?.rows ?? 0,
      unknownConnectivityRows: lanes.find((lane) => lane.lane === "watch8_connectivity_unknown")?.rows ?? 0,
      runtimeApprovedRows: 0,
    },
    lanes,
    policyImplications: [
      "Watch8 family pressure is large, but connectivity must be split before any positive confidence story is told.",
      "A high unknown-connectivity lane means the family still needs review pressure, not parser confidence.",
      "This packet is report-only and should help decide whether Watch8 density is actually Bluetooth/LTE-resolved or still mostly ambiguous.",
    ],
    nextReportOnlyExperiments: [
      "separate unopened merchant-heavy rows from personal-used rows inside the explicit Bluetooth and LTE lanes",
      "split Classic vs non-Classic after connectivity lanes are stable",
      "pair Watch8 connectivity lanes with accessory-bundle context before any promotion discussion",
    ],
    doNotDo: [
      "Do not infer connectivity from family alone",
      "Do not treat unknown-connectivity rows as positive support",
      "Do not runtime-wire Watch8 from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-connectivity-lanes-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| lane | rows | merchant_like_rows | classic_rows | size40_rows | size44_rows | size46_rows | report_only_action | sample_pids |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...lanes.map(
      (row) =>
        `| ${row.lane} | ${row.rows} | ${row.merchantLikeRows} | ${row.classicRows} | ${row.size40Rows} | ${row.size44Rows} | ${row.size46Rows} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} |`,
    ),
  ].join("\n");

  const md = [
    "# Smartwatch Galaxy Watch8 Connectivity Lanes",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only connectivity lane split for the Watch8 new/unopened pressure family.",
    "",
    "## Metrics",
    "",
    `- base rows: ${report.metrics.baseRows}`,
    `- bluetooth rows: ${report.metrics.bluetoothRows}`,
    `- lte rows: ${report.metrics.lteRows}`,
    `- unknown connectivity rows: ${report.metrics.unknownConnectivityRows}`,
    "",
    "## Lanes",
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

  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-connectivity-lanes-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-connectivity-lanes-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-connectivity-lanes-latest.md");
  console.log(
    `galaxywatch watch8 connectivity lanes: bluetooth=${report.metrics.bluetoothRows}, lte=${report.metrics.lteRows}, unknown=${report.metrics.unknownConnectivityRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
