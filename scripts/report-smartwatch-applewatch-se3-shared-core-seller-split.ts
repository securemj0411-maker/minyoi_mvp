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
  batterySignalRows: number;
  starlightSignalRows: number;
  bundleRows: number;
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

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const sharedCore = samples.filter((sample) => {
    const text = textFor(sample);
    return (
      !globalExclude.test(text) &&
      /(se\s?3|애플워치\s*se\s*3|apple\s*watch\s*se\s*3)/.test(text) &&
      /\b40mm\b/.test(text) &&
      /\bgps\b/.test(text) &&
      /(스타라이트|starlight)/.test(text) &&
      /(배터리.*100%|100프로)/.test(text)
    );
  });

  const laneDefs = [
    {
      lane: "shared_core_personal_used",
      match: (sample: Sample) => !merchantLike(sample),
      reportOnlyAction: "use to see whether the shared core has real personal-used support or is mostly merchant carryover",
    },
    {
      lane: "shared_core_merchant_like",
      match: (sample: Sample) => merchantLike(sample),
      reportOnlyAction: "keep as merchant-like shared core; do not let this inflate independent SE3 density",
    },
  ];

  const lanes: Lane[] = laneDefs.map((def) => {
    const matched = sharedCore.filter(def.match);
    return {
      lane: def.lane,
      rows: matched.length,
      batterySignalRows: matched.filter((sample) => /(배터리.*100%|100프로)/.test(textFor(sample))).length,
      starlightSignalRows: matched.filter((sample) => /(스타라이트|starlight)/.test(textFor(sample))).length,
      bundleRows: matched.filter((sample) => /(풀박스|박스|정품\s*스트랩|밀레니즈|루프|스포츠밴드|충전기|케이블)/.test(textFor(sample))).length,
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
    decision: "applewatch_se3_shared_core_seller_split_report_only",
    metrics: {
      sharedCoreRows: sharedCore.length,
      personalUsedRows: lanes.find((lane) => lane.lane === "shared_core_personal_used")?.rows ?? 0,
      merchantLikeRows: lanes.find((lane) => lane.lane === "shared_core_merchant_like")?.rows ?? 0,
      runtimeApprovedRows: 0,
    },
    lanes,
    policyImplications: [
      "The SE3 shared core should be split by seller-type before any density interpretation gets stronger.",
      "If merchant-like rows dominate the shared core, the overlap is less trustworthy as organic demand/supply evidence.",
      "This packet is report-only and exists to keep SE3 overlap interpretation conservative.",
    ],
    nextReportOnlyExperiments: [
      "compare shared-core personal-used rows against starlight-only used rows",
      "look for warranty/full-box support only after seller split is stable",
    ],
    doNotDo: [
      "Do not treat shared-core rows as independent support for both starlight and battery100",
      "Do not runtime-wire SE3 from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-se3-shared-core-seller-split-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Smartwatch Apple Watch SE3 Shared Core Seller Split",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only seller-type split for the SE3 shared overlap core.",
    "",
    "## Metrics",
    "",
    `- shared core rows: ${report.metrics.sharedCoreRows}`,
    `- personal-used rows: ${report.metrics.personalUsedRows}`,
    `- merchant-like rows: ${report.metrics.merchantLikeRows}`,
    "",
    "## Lanes",
    "",
    "| lane | rows | battery_signal_rows | starlight_signal_rows | bundle_rows | report_only_action | sample_pids |",
    "| --- | ---: | ---: | ---: | ---: | --- | --- |",
    ...lanes.map((row) => `| ${row.lane} | ${row.rows} | ${row.batterySignalRows} | ${row.starlightSignalRows} | ${row.bundleRows} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} |`),
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

  await writeFile(path.join(reportsDir, "smartwatch-applewatch-se3-shared-core-seller-split-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-se3-shared-core-seller-split-latest.json");
  console.log("wrote reports/smartwatch-applewatch-se3-shared-core-seller-split-latest.md");
  console.log(`applewatch se3 shared core seller split: shared=${report.metrics.sharedCoreRows}, personal=${report.metrics.personalUsedRows}, merchant=${report.metrics.merchantLikeRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
