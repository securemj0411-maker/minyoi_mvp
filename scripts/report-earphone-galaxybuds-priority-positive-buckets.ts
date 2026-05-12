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
  patterns: RegExp[];
};

type EvidenceBucket = {
  scope: string;
  survivingCount: number;
  rawMatchedCount: number;
  reportOnlyAction: string;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "earphone_discovered", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

const partsOrBuying = /(유닛|왼쪽|오른쪽|좌측|우측|케이스|충전케이스|본체|단품|낱개|삽니다|구매|매입)/;

const bucketSpecs: BucketSpec[] = [
  {
    scope: "galaxy_buds_fe_fullset_explicit",
    patterns: [/(갤럭시\s*버즈\s*fe|갤럭시버즈fe|galaxy\s*buds\s*fe|\bbuds\s*fe\b)/, /^(?!.*(버즈\s*3\s*fe|buds\s*3\s*fe)).*$/],
  },
  {
    scope: "galaxy_buds3_pro_fullset_explicit",
    patterns: [/(갤럭시\s*버즈\s*3\s*프로|버즈\s*3\s*프로|galaxy\s*buds\s*3\s*pro|\bbuds3?\s*pro\b)/],
  },
  {
    scope: "galaxy_buds3_fullset_explicit",
    patterns: [/(갤럭시\s*버즈\s*3|버즈\s*3|\bbuds\s*3\b|\bbuds3\b)/, /^(?!.*(프로|pro|fe)).*$/],
  },
  {
    scope: "galaxy_buds_pro1_fullset_explicit",
    patterns: [/(갤럭시\s*버즈\s*프로\s*1|버즈\s*프로\s*1|버즈프로1|galaxy\s*buds\s*pro\s*1|\bbuds\s*pro\s*1\b)/],
  },
];

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

function isGalaxyBuds(sample: Sample): boolean {
  return /(갤럭시\s*버즈|갤럭시버즈|galaxy\s*buds|\bbuds\b)/i.test(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
}

function matchesAll(text: string, patterns: RegExp[]): boolean {
  return patterns.every((pattern) => pattern.test(text));
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const rows = samples.filter(isGalaxyBuds);

  const evidenceRows: EvidenceBucket[] = bucketSpecs.map((spec) => {
    const rawMatched = rows.filter((sample) => matchesAll(textFor(sample), spec.patterns));
    const survived = rawMatched.filter((sample) => !partsOrBuying.test(textFor(sample)));
    return {
      scope: spec.scope,
      survivingCount: survived.length,
      rawMatchedCount: rawMatched.length,
      reportOnlyAction:
        survived.length > 0
          ? "use as very narrow Galaxy Buds positive reference only; keep report-only"
          : "keep as empty future-fill bucket; current rows are parts/buying pressure only",
      samplePids: (survived.length > 0 ? survived : rawMatched).slice(0, 5).map((row) => row.pid ?? "-"),
      sampleTitles: (survived.length > 0 ? survived : rawMatched).slice(0, 5).map(cleanTitle),
      runtimeApproved: false as const,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "earphone_discovered",
    family: "galaxybuds",
    decision: "galaxybuds_priority_positive_buckets_report_only",
    metrics: {
      galaxyBudsRows: rows.length,
      budsFeSurvivingRows: evidenceRows.find((row) => row.scope === "galaxy_buds_fe_fullset_explicit")?.survivingCount ?? 0,
      buds3ProSurvivingRows: evidenceRows.find((row) => row.scope === "galaxy_buds3_pro_fullset_explicit")?.survivingCount ?? 0,
      buds3SurvivingRows: evidenceRows.find((row) => row.scope === "galaxy_buds3_fullset_explicit")?.survivingCount ?? 0,
      budsPro1SurvivingRows: evidenceRows.find((row) => row.scope === "galaxy_buds_pro1_fullset_explicit")?.survivingCount ?? 0,
      scopeCount: evidenceRows.length,
      runtimeApprovedRows: 0,
    },
    evidenceRows,
    policyImplications: [
      "Galaxy Buds family currently remains dominated by parts pressure; narrow positive buckets are mostly empty except where full-set wording survives excludes.",
      "Buds FE currently has the only evidence-backed surviving positive bucket in this sample.",
      "Buds3 Pro / Buds3 / Buds Pro 1 wording exists, but current sample rows are almost entirely parts or buying pressure.",
      "This packet is report-only and must not be treated as runtime family approval.",
    ],
    nextReportOnlyExperiments: [
      "collect more true full-set Buds3 Pro and Buds3 rows so those scopes are not empty future-fill buckets",
      "keep model-explicit Buds FE / Buds3 Pro / Buds3 / Buds Pro 1 separated rather than reviving a generic Galaxy Buds family-positive bucket",
      "pair future positive buckets with the existing parts-exclusion evidence before any parser promotion discussion",
    ],
    doNotDo: [
      "Do not treat generic Galaxy Buds family wording as a positive bucket",
      "Do not count unit/case/buying rows as surviving positive evidence",
      "Do not runtime-wire earphone candidate policy from this report",
      "Do not merge Buds3 Pro, Buds3, and FE lines into one family-positive story",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "earphone-galaxybuds-priority-positive-buckets-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| scope | surviving_count | raw_matched_count | report_only_action | sample_pids | sample_titles | runtime_approved |",
    "| --- | ---: | ---: | --- | --- | --- | --- |",
    ...evidenceRows.map(
      (row) =>
        `| ${row.scope} | ${row.survivingCount} | ${row.rawMatchedCount} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} | ${row.sampleTitles.join("<br>")} | no |`,
    ),
  ].join("\n");

  const md = [
    "# Earphone Galaxy Buds Priority Positive Buckets",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only Galaxy Buds narrow positive bucket packet. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- galaxy buds rows scanned: ${report.metrics.galaxyBudsRows}`,
    `- Buds FE surviving rows: ${report.metrics.budsFeSurvivingRows}`,
    `- Buds3 Pro surviving rows: ${report.metrics.buds3ProSurvivingRows}`,
    `- Buds3 surviving rows: ${report.metrics.buds3SurvivingRows}`,
    `- Buds Pro 1 surviving rows: ${report.metrics.budsPro1SurvivingRows}`,
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

  await writeFile(path.join(reportsDir, "earphone-galaxybuds-priority-positive-buckets-latest.md"), `${md}\n`);
  console.log("wrote reports/earphone-galaxybuds-priority-positive-buckets-latest.json");
  console.log("wrote reports/earphone-galaxybuds-priority-positive-buckets-latest.md");
  console.log(
    `galaxybuds priority positive buckets: buds_fe=${report.metrics.budsFeSurvivingRows}, buds3_pro=${report.metrics.buds3ProSurvivingRows}, buds3=${report.metrics.buds3SurvivingRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
