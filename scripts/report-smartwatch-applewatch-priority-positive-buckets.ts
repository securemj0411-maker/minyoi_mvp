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
const samplesPath = path.join(appDir, "category-intelligence", "applewatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

const globalExclude = /(삽니다|구매|매입|교환|부품용|고장|파손|수리|케이스|보호필름|스트랩만|충전독|호환)/;

const bucketSpecs: BucketSpec[] = [
  {
    scope: "se3_unopened_40_44mm",
    summary: "SE3 + 40/44mm + unopened/new-like wording",
    patterns: [/(se\s?3|se3|애플워치\s*se\s*3)/, /\b(40|44)mm\b/, /(미개봉|새제품|새상품|미사용|시착만)/],
  },
  {
    scope: "se3_40mm_gps_starlight",
    summary: "SE3 + 40mm + GPS + starlight",
    patterns: [/(se\s?3|se3|애플워치\s*se\s*3)/, /\b40mm\b/, /\bgps\b/, /(스타라이트|starlight)/],
  },
  {
    scope: "se3_40mm_gps_battery100",
    summary: "SE3 + 40mm + GPS + battery 100%",
    patterns: [/(se\s?3|se3|애플워치\s*se\s*3)/, /\b40mm\b/, /\bgps\b/, /(배터리.*100%|100프로)/],
  },
  {
    scope: "series10_46mm_titanium",
    summary: "Series 10 + 46mm + titanium",
    patterns: [/(series\s?10|시리즈\s?10|애플워치\s?10)/, /\b46mm\b/, /(티타늄|titanium)/],
  },
  {
    scope: "series10_46mm_battery90plus",
    summary: "Series 10 + 46mm + battery 90%+",
    patterns: [/(series\s?10|시리즈\s?10|애플워치\s?10)/, /\b46mm\b/, /(배터리.*(9[0-9]|100)%|90퍼|100프로)/],
  },
  {
    scope: "series7_45mm_stainless_cellular",
    summary: "Series 7 + 45mm + stainless + cellular/LTE",
    patterns: [/(series\s?7|시리즈\s?7|애플워치\s?7)/, /\b45mm\b/, /(스테인리스|stainless)/, /(셀룰러|cellular|lte|와이파이\+셀룰러)/],
  },
  {
    scope: "series7_45mm_nike",
    summary: "Series 7 + 45mm + Nike edition",
    patterns: [/(series\s?7|시리즈\s?7|애플워치\s?7)/, /\b45mm\b/, /(나이키|nike)/],
  },
  {
    scope: "series9_45mm_gps_battery90plus",
    summary: "Series 9 + 45mm + GPS + battery 90%+",
    patterns: [/(series\s?9|시리즈\s?9|애플워치\s?9)/, /\b45mm\b/, /\bgps\b/, /(배터리.*(9[0-9]|100)%|90퍼|100프로)/],
  },
  {
    scope: "series9_45mm_gps_unopened_like_new",
    summary: "Series 9 + 45mm + GPS + unopened/like-new wording",
    patterns: [/(series\s?9|시리즈\s?9|애플워치\s?9)/, /\b45mm\b/, /\bgps\b/, /(미개봉|거의\s*새제품|3번도\s*착용\s*안|실착7번)/],
  },
];

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

function isAppleWatch(sample: Sample): boolean {
  return /(애플워치|apple\s*watch)/i.test(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
}

function matchesAll(text: string, patterns: RegExp[]): boolean {
  return patterns.every((pattern) => pattern.test(text));
}

function signalSummary(spec: BucketSpec, rows: Sample[]): string {
  const texts = rows.map(textFor);
  const unopenedSignals = texts.filter((text) => /(미개봉|새제품|새상품|미사용|시착만|거의\s*새제품)/.test(text)).length;
  const batterySignals = texts.filter((text) => /(배터리.*(9[0-9]|100)%|90퍼|100프로)/.test(text)).length;
  const cellularSignals = texts.filter((text) => /(셀룰러|cellular|lte|와이파이\+셀룰러)/.test(text)).length;
  return `${spec.summary}; unopened_like_new ${unopenedSignals}/${rows.length}, battery90plus ${batterySignals}/${rows.length}, cellular ${cellularSignals}/${rows.length}`;
}

function reportOnlyAction(scope: string): string {
  if (scope.includes("cellular")) return "use as premium cellular-positive reference only; keep runtime inference deferred";
  if (scope.includes("battery")) return "use as healthy-used positive reference only; still report-only";
  if (scope.includes("unopened")) return "use as unopened/like-new positive reference only; no runtime approval";
  return "use as narrow generation+attribute positive reference only; keep report-only";
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const appleWatchRows = samples.filter(isAppleWatch);

  const evidenceRows: EvidenceBucket[] = bucketSpecs
    .map((spec) => {
      const rows = appleWatchRows.filter((sample) => {
        const text = textFor(sample);
        return !globalExclude.test(text) && matchesAll(text, spec.patterns);
      });
      return {
        scope: spec.scope,
        count: rows.length,
        signalSummary: signalSummary(spec, rows),
        reportOnlyAction: reportOnlyAction(spec.scope),
        samplePids: rows.slice(0, 5).map((sample) => sample.pid ?? "-"),
        sampleTitles: rows.slice(0, 5).map(cleanTitle),
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
    family: "applewatch",
    decision: "applewatch_priority_positive_buckets_report_only",
    metrics: {
      appleWatchRows: appleWatchRows.length,
      se3UnopenedRows: metricFor("se3_unopened_40_44mm"),
      se3StarlightRows: metricFor("se3_40mm_gps_starlight"),
      se3Battery100Rows: metricFor("se3_40mm_gps_battery100"),
      series10TitaniumRows: metricFor("series10_46mm_titanium"),
      series10Battery90plusRows: metricFor("series10_46mm_battery90plus"),
      series7StainlessCellularRows: metricFor("series7_45mm_stainless_cellular"),
      series7NikeRows: metricFor("series7_45mm_nike"),
      series9Battery90plusRows: metricFor("series9_45mm_gps_battery90plus"),
      series9UnopenedRows: metricFor("series9_45mm_gps_unopened_like_new"),
      scopeCount: evidenceRows.length,
      runtimeApprovedRows: 0,
    },
    evidenceRows,
    policyImplications: [
      "Explicit Apple Watch generation evidence becomes more useful when narrowed into generation+attribute positive buckets instead of one flat family packet.",
      "SE3, Series 10, Series 7, and Series 9 each have small but concrete report-only positive slices that can guide future parser backlog work.",
      "These buckets are still report-only references and should not be treated as automatic runtime promotion criteria.",
      "Accessory, buying, repair, and compatibility pressure stays globally excluded before these positive buckets are counted.",
    ],
    nextReportOnlyExperiments: [
      "thicken SE3 unopened and healthy-used rows so SE family positivity is not carried by one wording cluster",
      "collect more Series 10 titanium and Series 7 stainless cellular rows to strengthen premium-watch positive slices",
      "pair these priority positive buckets with connectivity review evidence before any runtime generation/network discussion",
    ],
    doNotDo: [
      "Do not runtime-wire Apple Watch generation or connectivity rules from these buckets alone",
      "Do not treat these positive buckets as candidate-pool policy approval",
      "Do not count compatibility/accessory posts inside these positive buckets",
      "Do not assume similar wording generalizes across all Apple Watch generations",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-priority-positive-buckets-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| scope | count | signal_summary | report_only_action | sample_pids | sample_titles | runtime_approved |",
    "| --- | ---: | --- | --- | --- | --- | --- |",
    ...evidenceRows.map(
      (row) =>
        `| ${row.scope} | ${row.count} | ${row.signalSummary} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} | ${row.sampleTitles.join("<br>")} | no |`,
    ),
  ].join("\n");

  const md = [
    "# Smartwatch Apple Watch Priority Positive Buckets",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only Apple Watch priority positive buckets. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- apple watch rows scanned: ${report.metrics.appleWatchRows}`,
    `- SE3 unopened rows: ${report.metrics.se3UnopenedRows}`,
    `- SE3 starlight GPS rows: ${report.metrics.se3StarlightRows}`,
    `- SE3 battery 100 rows: ${report.metrics.se3Battery100Rows}`,
    `- Series 10 titanium rows: ${report.metrics.series10TitaniumRows}`,
    `- Series 10 battery 90+ rows: ${report.metrics.series10Battery90plusRows}`,
    `- Series 7 stainless cellular rows: ${report.metrics.series7StainlessCellularRows}`,
    `- Series 7 Nike rows: ${report.metrics.series7NikeRows}`,
    `- Series 9 battery 90+ rows: ${report.metrics.series9Battery90plusRows}`,
    `- Series 9 unopened/like-new rows: ${report.metrics.series9UnopenedRows}`,
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

  await writeFile(path.join(reportsDir, "smartwatch-applewatch-priority-positive-buckets-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-priority-positive-buckets-latest.json");
  console.log("wrote reports/smartwatch-applewatch-priority-positive-buckets-latest.md");
  console.log(
    `applewatch priority positive buckets: se3_unopened=${report.metrics.se3UnopenedRows}, series10_titanium=${report.metrics.series10TitaniumRows}, series7_stainless_cellular=${report.metrics.series7StainlessCellularRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
