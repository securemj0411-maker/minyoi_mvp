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
  personalLikeRows: number;
  accessoryBundleRows: number;
  batterySignalRows: number;
  starlightSignalRows: number;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  reportOnlyAction: string;
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "applewatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

const globalExclude = /(삽니다|구매|매입|교환|부품용|고장|파손|수리|케이스|보호필름|스트랩만|충전독|호환)/;

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

function merchantLike(sample: Sample): boolean {
  const s = sample.seller ?? {};
  return Boolean(s.proshop || s.is_official || Number(s.review_count ?? 0) >= 30 || Number(s.sales_count ?? 0) >= 30);
}

function isTargetBase(text: string): boolean {
  return /(se\s?3|se3|애플워치\s*se\s*3)/.test(text) && /\b40mm\b/.test(text) && /\bgps\b/.test(text);
}

function hasStarlight(text: string): boolean {
  return /(스타라이트|starlight)/.test(text);
}

function hasBattery100(text: string): boolean {
  return /(배터리.*100%|100프로)/.test(text);
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const rows = samples.filter((sample) => {
    const text = textFor(sample);
    return !globalExclude.test(text) && isTargetBase(text);
  });

  const laneDefs = [
    {
      lane: "shared_core_starlight_battery100",
      match: (text: string) => hasStarlight(text) && hasBattery100(text),
      reportOnlyAction: "keep as shared overlap core; never count as independent support for both sibling scopes",
    },
    {
      lane: "starlight_only_unopened_or_like_new",
      match: (text: string) => hasStarlight(text) && !hasBattery100(text) && /(미개봉|새상품|새제품|실사용\s*거의\s*없|ss급|sss급|상태\s*좋음)/.test(text),
      reportOnlyAction: "use to measure whether starlight support is really unopened/like-new skew rather than a broad used lane",
    },
    {
      lane: "starlight_only_used_no_battery_signal",
      match: (text: string) => hasStarlight(text) && !hasBattery100(text) && !/(미개봉|새상품|새제품|실사용\s*거의\s*없|ss급|sss급|상태\s*좋음)/.test(text),
      reportOnlyAction: "use to thicken truly used starlight rows without borrowing battery100 or unopened support",
    },
    {
      lane: "battery100_only_non_starlight_used",
      match: (text: string) => hasBattery100(text) && !hasStarlight(text),
      reportOnlyAction: "use to test whether battery100 evidence survives as a non-starlight healthy-used lane",
    },
  ];

  const lanes: Lane[] = laneDefs.map((def) => {
    const matched = rows.filter((sample) => def.match(textFor(sample)));
    return {
      lane: def.lane,
      rows: matched.length,
      merchantLikeRows: matched.filter(merchantLike).length,
      personalLikeRows: matched.length - matched.filter(merchantLike).length,
      accessoryBundleRows: matched.filter((sample) => /(풀박스|박스|정품\s*스트랩|밀레니즈|루프|스포츠밴드|충전기|케이블)/.test(textFor(sample))).length,
      batterySignalRows: matched.filter((sample) => hasBattery100(textFor(sample))).length,
      starlightSignalRows: matched.filter((sample) => hasStarlight(textFor(sample))).length,
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
    family: "applewatch",
    decision: "applewatch_se3_overlap_lanes_report_only",
    metrics: {
      baseRows: rows.length,
      sharedCoreRows: lanes.find((lane) => lane.lane === "shared_core_starlight_battery100")?.rows ?? 0,
      starlightUnopenedRows: lanes.find((lane) => lane.lane === "starlight_only_unopened_or_like_new")?.rows ?? 0,
      starlightUsedRows: lanes.find((lane) => lane.lane === "starlight_only_used_no_battery_signal")?.rows ?? 0,
      batteryNonstarlightRows: lanes.find((lane) => lane.lane === "battery100_only_non_starlight_used")?.rows ?? 0,
      runtimeApprovedRows: 0,
    },
    lanes,
    policyImplications: [
      "The SE3 starlight and battery100 scopes should not be treated as separate density if most evidence sits in a shared overlap core.",
      "A small or empty battery-nonstarlight lane means battery100 wording is mostly piggybacking on the starlight slice.",
      "Separating unopened/like-new starlight rows from used starlight rows helps distinguish color overlap from condition skew.",
      "This packet is report-only and exists to stop double-counting, not to promote any SE3 lane into runtime trust.",
    ],
    nextReportOnlyExperiments: [
      "thicken personal-used non-overlap SE3 rows before trusting either sibling scope more strongly",
      "separate merchant-like shared-core rows from personal-used shared-core rows",
      "look for warranty/full-box/activation facets only after the overlap lanes are stable",
    ],
    doNotDo: [
      "Do not sum shared-core rows into both starlight and battery-positive support",
      "Do not runtime-wire any SE3 lane from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-se3-overlap-lanes-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| lane | rows | merchant_like_rows | personal_like_rows | accessory_bundle_rows | battery_signal_rows | starlight_signal_rows | report_only_action | sample_pids |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...lanes.map(
      (row) =>
        `| ${row.lane} | ${row.rows} | ${row.merchantLikeRows} | ${row.personalLikeRows} | ${row.accessoryBundleRows} | ${row.batterySignalRows} | ${row.starlightSignalRows} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} |`,
    ),
  ].join("\n");

  const md = [
    "# Smartwatch Apple Watch SE3 Overlap Lanes",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only lane split for the overlapping `SE3 40mm GPS starlight` and `battery100` scopes.",
    "",
    "## Metrics",
    "",
    `- base rows: ${report.metrics.baseRows}`,
    `- shared-core rows: ${report.metrics.sharedCoreRows}`,
    `- starlight unopened/like-new rows: ${report.metrics.starlightUnopenedRows}`,
    `- starlight used rows: ${report.metrics.starlightUsedRows}`,
    `- battery-nonstarlight rows: ${report.metrics.batteryNonstarlightRows}`,
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

  await writeFile(path.join(reportsDir, "smartwatch-applewatch-se3-overlap-lanes-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-se3-overlap-lanes-latest.json");
  console.log("wrote reports/smartwatch-applewatch-se3-overlap-lanes-latest.md");
  console.log(
    `applewatch se3 overlap lanes: shared=${report.metrics.sharedCoreRows}, starlight_unopened=${report.metrics.starlightUnopenedRows}, starlight_used=${report.metrics.starlightUsedRows}, battery_nonstarlight=${report.metrics.batteryNonstarlightRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
