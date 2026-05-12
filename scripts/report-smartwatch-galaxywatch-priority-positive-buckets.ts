import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
};

type BucketSpec = {
  scope: string;
  summary: string;
  patterns: RegExp[];
};

type EvidenceBucket = {
  scope: string;
  count: number;
  signalSummary: string;
  reportOnlyAction: string;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "smartwatch_discovered", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

const globalExclude = /(예약창|부품용|고장|파손|검은점|충전잭은\s*없고|호환|스트랩만|밴드만|케이스만|삽니다|매입|교환)/;

const bucketSpecs: BucketSpec[] = [
  {
    scope: "galaxywatch8_classic_46mm_bluetooth_new",
    summary: "Watch8 Classic 46mm Bluetooth new/unopened",
    patterns: [/(갤럭시\s*워치8|갤럭시워치8)/, /(클래식|classic)/, /\b46mm\b/, /(블루투스|bluetooth)/, /(미개봉|새상품|미사용|신품)/],
  },
  {
    scope: "galaxywatch8_40mm_bluetooth_only_new",
    summary: "Watch8 40mm Bluetooth-only new/unopened",
    patterns: [/(갤럭시\s*워치8|갤럭시워치8)/, /\b40mm\b/, /(블루투스|bluetooth|gps)/, /(미개봉|새상품|미사용|신품)/],
  },
  {
    scope: "galaxywatch7_44mm_clean_openbox",
    summary: "Watch7 44mm clean/open-box wording",
    patterns: [/(갤럭시\s*워치7|갤럭시워치7)/, /\b44mm\b/, /(아주\s*깨끗|새것처럼|하자\s*전혀\s*없|딱\s*하루\s*사용|몇번차고|스크래치.*없|찍힘.*없|상태좋)/],
  },
  {
    scope: "galaxywatch7_44mm_bluetooth_clean",
    summary: "Watch7 44mm Bluetooth clean wording",
    patterns: [/(갤럭시\s*워치7|갤럭시워치7)/, /\b44mm\b/, /(블루투스|통신사것\s*아님|블루투스용)/, /(아주\s*깨끗|하자\s*전혀\s*없|상태좋)/],
  },
  {
    scope: "galaxywatch6_classic_43mm_wifi_working",
    summary: "Watch6 Classic 43mm WiFi/Bluetooth working",
    patterns: [/(갤럭시\s*워치6|갤럭시워치6)/, /(클래식|classic)/, /\b43mm\b/, /(wifi|와이파이|블루투스전용)/, /(작동\s*이상없이|잘됩니다|기능은\s*문제없)/],
  },
];

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

function isGalaxyWatch(sample: Sample): boolean {
  return /(갤럭시\s*워치|갤럭시워치|galaxy\s*watch)/i.test(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
}

function matchesAll(text: string, patterns: RegExp[]): boolean {
  return patterns.every((pattern) => pattern.test(text));
}

function signalSummary(spec: BucketSpec, rows: Sample[]): string {
  const texts = rows.map(textFor);
  const unopened = texts.filter((text) => /(미개봉|새상품|미사용|신품)/.test(text)).length;
  const clean = texts.filter((text) => /(아주\s*깨끗|새것처럼|하자\s*전혀\s*없|상태좋)/.test(text)).length;
  const bluetooth = texts.filter((text) => /(블루투스|bluetooth|wifi|와이파이|통신사것\s*아님)/.test(text)).length;
  return `${spec.summary}; unopened ${unopened}/${rows.length}, clean ${clean}/${rows.length}, connectivity_wording ${bluetooth}/${rows.length}`;
}

function reportOnlyAction(scope: string): string {
  if (scope.includes("new")) return "use as narrow new/unopened Galaxy Watch positive reference only; keep report-only";
  if (scope.includes("wifi") || scope.includes("bluetooth")) return "use as narrow connectivity-positive reference only; runtime inference stays deferred";
  return "use as narrow clean/open-box positive reference only; do not promote runtime wiring";
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const rows = samples.filter(isGalaxyWatch);

  const evidenceRows: EvidenceBucket[] = bucketSpecs
    .map((spec) => {
      const matched = rows.filter((sample) => {
        const text = textFor(sample);
        return !globalExclude.test(text) && matchesAll(text, spec.patterns);
      });
      return {
        scope: spec.scope,
        count: matched.length,
        signalSummary: signalSummary(spec, matched),
        reportOnlyAction: reportOnlyAction(spec.scope),
        samplePids: matched.slice(0, 5).map((sample) => sample.pid ?? "-"),
        sampleTitles: matched.slice(0, 5).map(cleanTitle),
        runtimeApproved: false as const,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.scope.localeCompare(b.scope));

  const metricFor = (scope: string) => evidenceRows.find((row) => row.scope === scope)?.count ?? 0;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_priority_positive_buckets_report_only",
    metrics: {
      galaxyWatchRows: rows.length,
      watch8Classic46BluetoothNewRows: metricFor("galaxywatch8_classic_46mm_bluetooth_new"),
      watch840BluetoothOnlyNewRows: metricFor("galaxywatch8_40mm_bluetooth_only_new"),
      watch744CleanOpenboxRows: metricFor("galaxywatch7_44mm_clean_openbox"),
      watch744BluetoothCleanRows: metricFor("galaxywatch7_44mm_bluetooth_clean"),
      watch6Classic43WifiWorkingRows: metricFor("galaxywatch6_classic_43mm_wifi_working"),
      scopeCount: evidenceRows.length,
      runtimeApprovedRows: 0,
    },
    evidenceRows,
    policyImplications: [
      "Galaxy Watch narrow positives are present, but the family sample is still much thinner than Apple Watch.",
      "Watch8 Classic 46mm Bluetooth new, Watch8 40mm Bluetooth-only new, and Watch7 44mm clean/open-box are the strongest first report-only positive slices.",
      "Connectivity wording is helpful here, but still remains a report-only confidence signal rather than parser approval.",
      "This report isolates narrow positive Galaxy Watch slices only; it does not approve runtime or candidate-pool promotion.",
    ],
    nextReportOnlyExperiments: [
      "collect more Watch8 / Watch7 / Watch6 Classic rows so these positive slices are not one-off samples",
      "look for Galaxy Watch Ultra family rows separately because this sample has no usable Ultra positive packet",
      "pair Galaxy Watch positive slices with unknown connectivity review rows before any runtime split discussion",
    ],
    doNotDo: [
      "Do not infer Galaxy Watch connectivity or edition from family alone",
      "Do not treat these narrow positive buckets as runtime approval",
      "Do not count reservation placeholders or damaged/missing-accessory rows inside positive slices",
      "Do not assume Galaxy Watch Ultra has positive evidence just because Watch7/8 do",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-priority-positive-buckets-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| scope | count | signal_summary | report_only_action | sample_pids | sample_titles | runtime_approved |",
    "| --- | ---: | --- | --- | --- | --- | --- |",
    ...evidenceRows.map(
      (row) =>
        `| ${row.scope} | ${row.count} | ${row.signalSummary} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} | ${row.sampleTitles.join("<br>")} | no |`,
    ),
  ].join("\n");

  const md = [
    "# Smartwatch Galaxy Watch Priority Positive Buckets",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only Galaxy Watch priority positive buckets. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- galaxy watch rows scanned: ${report.metrics.galaxyWatchRows}`,
    `- Watch8 Classic 46 Bluetooth new rows: ${report.metrics.watch8Classic46BluetoothNewRows}`,
    `- Watch8 40 Bluetooth-only new rows: ${report.metrics.watch840BluetoothOnlyNewRows}`,
    `- Watch7 44 clean/open-box rows: ${report.metrics.watch744CleanOpenboxRows}`,
    `- Watch7 44 Bluetooth clean rows: ${report.metrics.watch744BluetoothCleanRows}`,
    `- Watch6 Classic 43 WiFi working rows: ${report.metrics.watch6Classic43WifiWorkingRows}`,
    "",
    "## Evidence Rows",
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

  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-priority-positive-buckets-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-priority-positive-buckets-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-priority-positive-buckets-latest.md");
  console.log(
    `galaxywatch priority positive buckets: watch8_classic46_new=${report.metrics.watch8Classic46BluetoothNewRows}, watch7_44_clean=${report.metrics.watch744CleanOpenboxRows}, watch6_classic43_wifi=${report.metrics.watch6Classic43WifiWorkingRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
