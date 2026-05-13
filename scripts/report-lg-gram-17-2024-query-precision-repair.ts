import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type LaneConfig = {
  lane_key: string;
  category: string;
  queries: string[];
  accept_all: string[];
  accept_any_of: string[][];
  reject_rules: Array<{ label: string; pattern: string }>;
  price_min_krw: number;
  price_max_krw: number;
};

type ParseSummary = {
  total_fetched: number;
  parse_ready_count: number;
  rejected_count: number;
  target_reached: boolean;
  reject_breakdown: Array<{ reason: string; count: number }>;
};

type SampleRow = {
  pid: string;
  name: string;
  price: number;
  query: string;
  description?: string;
  sale_status: string;
  parse_ready: boolean;
  reject_reasons: string[];
};

type ReplayLane = {
  lane: string;
  total: number;
  skuMatchPct: string;
  laneMatchPct: string;
  parseReadyPct: string;
  needsReviewFalsePct: string;
  unknownPartsPct: string;
  comparableKeyCompletePct: string;
  grade: string;
  nextAction: string;
};

type ReplayReport = {
  lanes: ReplayLane[];
};

type QueryStats = {
  query: string;
  fetched: number;
  parseReady: number;
  rejected: number;
  topRejectReasons: Array<{ reason: string; count: number }>;
};

const reportsDir = path.join(process.cwd(), "reports");
const laneDir = path.join(process.cwd(), "category-intelligence", "lg_gram_17_2024");

function countBy<T>(rows: T[], getKey: (row: T) => string): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = getKey(row);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function topCounts(counts: Record<string, number>, limit = 8): Array<{ reason: string; count: number }> {
  return Object.entries(counts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
    .slice(0, limit);
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function rowText(row: SampleRow): string {
  return `${row.name ?? ""} ${row.description ?? ""}`.toLowerCase();
}

function mdTable(headers: string[], rows: Array<Array<unknown>>): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function buildQueryStats(samples: SampleRow[]): QueryStats[] {
  const byQuery = new Map<string, SampleRow[]>();
  for (const row of samples) {
    const bucket = byQuery.get(row.query) ?? [];
    bucket.push(row);
    byQuery.set(row.query, bucket);
  }

  return Array.from(byQuery.entries())
    .map(([query, rows]) => {
      const rejectReasons = rows.flatMap((row) => row.reject_reasons ?? []);
      return {
        query,
        fetched: rows.length,
        parseReady: rows.filter((row) => row.parse_ready).length,
        rejected: rows.filter((row) => !row.parse_ready).length,
        topRejectReasons: topCounts(countBy(rejectReasons, (reason) => reason), 5),
      };
    })
    .sort((a, b) => b.fetched - a.fetched || a.query.localeCompare(b.query));
}

function isStrict2024Gram17Candidate(row: SampleRow): boolean {
  const text = rowText(row);
  const hasBrand = /lg\s*그램|엘지\s*그램|lg\s*gram|lg그램|lg전자\s*그램/i.test(text);
  const has17 = /17\s*인치|17\s*형|17["″]|\b17z|그램17|gram17/i.test(text);
  const has2024Model = /\b2024\b|17zd?90s(?![a-z0-9])|17zd90su/i.test(text);
  const hasHoldSignal =
    /그램\s*(?:프로|pro)|gram\s*pro|\bpro\b|매입|삽니다|구해요|구매합니다|대여|렌탈|임대|부품|액정|키보드|파우치|케이스\s*만|가방\s*만|14\s*인치|15\s*인치|16\s*인치|\b202[0-3]\b|\b202[5-9]\b|(?:8|9|10|11|12|13)\s*세대|rtx|32\s*(?:gb|기가)|1\s*tb|256\s*(?:gb|기가)|17z90r|17z90p|17z990|17zd90n|17z90t|17z90sp/i.test(text);
  return hasBrand && has17 && has2024Model && !hasHoldSignal && row.price >= 900000 && row.price <= 2200000;
}

function classifyHoldSignals(row: SampleRow): string[] {
  const text = rowText(row);
  const signals: Array<[string, RegExp]> = [
    ["wrong_generation_or_year", /\b202[0-3]\b|\b202[5-9]\b|(?:8|9|10|11|12|13)\s*세대|17z90r|17z90p|17z990|17zd90n|17z90t/i],
    ["gram_pro_or_rtx_variant", /그램\s*(?:프로|pro)|gram\s*pro|\bpro\b|rtx/i],
    ["wrong_size", /14\s*인치|15\s*인치|16\s*인치/i],
    ["wrong_ram_or_storage", /32\s*(?:gb|기가)|8\s*(?:gb|기가)|1\s*tb|256\s*(?:gb|기가)/i],
    ["buying_or_rental", /매입|삽니다|구해요|구매합니다|대여|렌탈|임대/i],
    ["parts_or_accessory", /부품|액정|키보드|파우치|케이스\s*만|가방\s*만/i],
  ];
  return signals.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [laneConfig, parseSummary, samples, replayReport, miningQueueMd] = await Promise.all([
    readJson<LaneConfig>(path.join(laneDir, "lane_config.json")),
    readJson<ParseSummary>(path.join(laneDir, "parse_summary.json")),
    readJson<SampleRow[]>(path.join(laneDir, "samples.json")),
    readJson<ReplayReport>(path.join(reportsDir, "lane-replay-readiness-latest.json")),
    readFile(path.join(reportsDir, "mining-query-repair-queue-latest.md"), "utf8"),
  ]);

  const replayLane = replayReport.lanes.find((lane) => lane.lane === "lg_gram_17_2024");
  const laptopReplayLane = replayReport.lanes.find((lane) => lane.lane === "laptop");
  const parseReadyRows = samples.filter((row) => row.parse_ready);
  const strict2024Rows = samples.filter(isStrict2024Gram17Candidate);
  const strict2024ParseReadyRows = parseReadyRows.filter(isStrict2024Gram17Candidate);
  const holdSignalRows = samples
    .map((row) => ({ row, signals: classifyHoldSignals(row) }))
    .filter(({ signals }) => signals.length > 0);
  const currentQueryStats = buildQueryStats(samples);
  const rejectReasonCounts = countBy(samples.flatMap((row) => row.reject_reasons ?? []), (reason) => reason);
  const miningQueueLine = miningQueueMd.split("\n").find((line) => line.startsWith("| lg_gram_17_2024 |")) ?? "";

  const proposedQueryVariants = [
    {
      query: "LG 그램 17 2024 노트북",
      rationale: "Brand + 17-inch + explicit 2024 + laptop context; replaces bare 엘지 그램 17.",
    },
    {
      query: "LG 그램 17인치 2024 코어 울트라5 노트북",
      rationale: "Targets 2024/Core Ultra generation while keeping full-unit laptop wording.",
    },
    {
      query: "LG 그램 17인치 2024 코어 울트라7 노트북",
      rationale: "Pairs the 17-inch lane with explicit Ultra 7 generation.",
    },
    {
      query: "LG gram 17 2024 ultra 5 laptop",
      rationale: "English variant for sellers using model-family wording.",
    },
    {
      query: "LG gram 17 2024 ultra 7 laptop",
      rationale: "English Ultra 7 variant; avoids RAM/storage-only recall.",
    },
    {
      query: "LG 그램 17Z90S 노트북",
      rationale: "Model-code oriented 2024 Gram 17 query; requires detail gate for storage/RAM.",
    },
    {
      query: "LG 그램 17ZD90S 노트북",
      rationale: "No-OS/model-code variant often omitted by broad year wording.",
    },
    {
      query: "LG 그램 17ZD90SU 노트북",
      rationale: "Observed 2024/Core Ultra model-code variant missed by current generation regex.",
    },
    {
      query: "17Z90S LG gram 17 laptop",
      rationale: "Reverse model-code query for mixed English/Korean listings.",
    },
  ];

  const cleanSignals = [
    "LG Gram/그램 brand token in title/detail.",
    "17-inch signal or 17Z90S/17ZD90S/17ZD90SU model-code signal.",
    "Explicit 2024, Core Ultra 5/7, or 17Z90S-family model-code context.",
    "Full laptop/노트북/body wording; accessory terms absent.",
    "No older-year, 13th-gen-only, Gram Pro, RTX, wrong-size, buying, rental, or parts signal.",
  ];

  const holdSignals = [
    "Bare 엘지 그램 17 without 2024/Core Ultra/model-code context.",
    "13세대/12세대/11세대 or 2020-2023 year wording.",
    "2025/2026/T-series wording when the lane is specifically 2024.",
    "Gram Pro/그램 프로/RTX or 32GB/1TB variants that imply a different sublane.",
    "14/15/16-inch rows, buying posts, rental posts, parts, panels, keyboard, pouch, or accessory-only rows.",
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    lane: laneConfig.lane_key,
    ownership: "LG Gram / laptop query repair only",
    inputFiles: [
      "reports/lane-replay-readiness-latest.json",
      "reports/mining-query-repair-queue-latest.md",
      "category-intelligence/lg_gram_17_2024/lane_config.json",
      "category-intelligence/lg_gram_17_2024/parse_summary.json",
      "category-intelligence/lg_gram_17_2024/samples.json",
    ],
    replay: {
      lgGram17: replayLane,
      laptop: laptopReplayLane,
    },
    miningQueueLine,
    currentConfig: {
      queries: laneConfig.queries,
      acceptAll: laneConfig.accept_all,
      acceptAnyOf: laneConfig.accept_any_of,
      priceMinKrw: laneConfig.price_min_krw,
      priceMaxKrw: laneConfig.price_max_krw,
    },
    metrics: {
      totalFetched: parseSummary.total_fetched,
      parseReadyCount: parseSummary.parse_ready_count,
      rejectedCount: parseSummary.rejected_count,
      targetReached: parseSummary.target_reached,
      replayGrade: replayLane?.grade ?? "unknown",
      replayNextAction: replayLane?.nextAction ?? "unknown",
      comparableKeyCompletePct: replayLane?.comparableKeyCompletePct ?? "unknown",
      strict2024CleanRowsInExistingSamples: strict2024Rows.length,
      strict2024ParseReadyRows: strict2024ParseReadyRows.length,
      parseReadyRowsWithHoldSignals: parseReadyRows.filter((row) => classifyHoldSignals(row).length > 0).length,
      holdSignalRowsInExistingSamples: holdSignalRows.length,
    },
    contaminationSummary: {
      topRejectReasons: parseSummary.reject_breakdown.slice(0, 12),
      reasonCounts: {
        missing2024OrUltraContext: rejectReasonCounts.missing_any_2024_13_s_세대_14_s_세대_ult ?? 0,
        priceTooLow: rejectReasonCounts.price_too_low ?? 0,
        wrongStorage256: rejectReasonCounts.reject_wrong_storage_256 ?? 0,
        wrongRam8gb: rejectReasonCounts.reject_wrong_ram_8gb ?? 0,
        missingBrand: rejectReasonCounts.missing_lg_s_그램_엘지_s_그램_lg_s_gra ?? 0,
        missing17Inch: rejectReasonCounts.missing_any_17_s_인치_17_s_형_17_17_ ?? 0,
        gramPro: rejectReasonCounts.reject_wrong_model_gram_pro ?? 0,
        buyingPost: rejectReasonCounts.reject_buying_post ?? 0,
        brokenOrParts: rejectReasonCounts.reject_broken_or_parts_only ?? 0,
      },
      whyCurrentQueryIsContaminated: [
        "The current query list includes bare broad variants such as 엘지 그램 17 and RAM/storage-only variants; those pull older 17-inch Gram rows, buying posts, wrong sizes, and non-laptop LG products.",
        "The accept rule allows 13세대 as generation context, which is not a precise 2024/Core Ultra signal and lets legacy 17Z90R-style rows become parse-ready.",
        "Current parsing rejects 268/305 rows for missing 2024/13세대/14세대/Ultra context and 177/305 for price_too_low, showing recall is mostly broad-query contamination rather than a parser/catalog gap.",
        "Only 1 of the 5 parse-ready rows satisfies the stricter 2024/17Z90S-family clean gate used in this report.",
      ],
    },
    currentQueryStats,
    proposedQueryVariants,
    cleanSignals,
    holdSignals,
    strict2024CleanSample: strict2024Rows.slice(0, 20).map((row) => ({
      pid: row.pid,
      name: row.name,
      price: row.price,
      query: row.query,
      parseReady: row.parse_ready,
      rejectReasons: row.reject_reasons,
    })),
    parseReadyRows: parseReadyRows.map((row) => ({
      pid: row.pid,
      name: row.name,
      price: row.price,
      query: row.query,
      saleStatus: row.sale_status,
      strict2024Clean: isStrict2024Gram17Candidate(row),
      holdSignals: classifyHoldSignals(row),
    })),
    decision: {
      nextStep: "more_mining_with_query_precision_repair",
      aiL2: "defer_until_after_no_write_exact_query_sample; use AI L2 only for residual generation/model-code ambiguity after cleaner mining",
      deterministicPatch: "not_recommended",
      rationale:
        "The failure mode is query contamination and sparse exact samples, not deterministic parser/catalog recall. Repair queries first, run no-write sample acquisition, then reassess.",
    },
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "lg-gram-17-2024-query-precision-repair-latest.json");
  const mdPath = path.join(reportsDir, "lg-gram-17-2024-query-precision-repair-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# LG Gram 17 2024 Query Precision Repair",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision.nextStep}`,
    "",
    "## Key Counts",
    "",
    `- totalFetched: ${report.metrics.totalFetched}`,
    `- parseReadyCount: ${report.metrics.parseReadyCount}`,
    `- rejectedCount: ${report.metrics.rejectedCount}`,
    `- replayGrade: ${report.metrics.replayGrade}`,
    `- comparableKeyCompletePct: ${report.metrics.comparableKeyCompletePct}`,
    `- strict2024CleanRowsInExistingSamples: ${report.metrics.strict2024CleanRowsInExistingSamples}`,
    `- strict2024ParseReadyRows: ${report.metrics.strict2024ParseReadyRows}`,
    `- parseReadyRowsWithHoldSignals: ${report.metrics.parseReadyRowsWithHoldSignals}`,
    "",
    "## Why Current Query Is Contaminated",
    "",
    ...report.contaminationSummary.whyCurrentQueryIsContaminated.map((item) => `- ${item}`),
    "",
    "## Top Reject Reasons",
    "",
    mdTable(
      ["reason", "count"],
      report.contaminationSummary.topRejectReasons.map((row) => [row.reason, row.count]),
    ),
    "",
    "## Current Query Stats",
    "",
    mdTable(
      ["query", "fetched", "parseReady", "rejected", "topRejectReasons"],
      currentQueryStats.map((row) => [
        row.query,
        row.fetched,
        row.parseReady,
        row.rejected,
        row.topRejectReasons.map((reason) => `${reason.reason}:${reason.count}`).join("<br>"),
      ]),
    ),
    "",
    "## Proposed Exact Query Variants",
    "",
    mdTable(
      ["query", "rationale"],
      proposedQueryVariants.map((row) => [row.query, row.rationale]),
    ),
    "",
    "## Clean Signals",
    "",
    ...cleanSignals.map((signal) => `- ${signal}`),
    "",
    "## Hold Signals",
    "",
    ...holdSignals.map((signal) => `- ${signal}`),
    "",
    "## Existing Parse-Ready Review",
    "",
    mdTable(
      ["pid", "name", "price", "query", "strict2024Clean", "holdSignals"],
      report.parseReadyRows.map((row) => [
        row.pid,
        row.name,
        row.price,
        row.query,
        row.strict2024Clean,
        row.holdSignals.join(", "),
      ]),
    ),
    "",
    "## Decision",
    "",
    `- nextStep: ${report.decision.nextStep}`,
    `- aiL2: ${report.decision.aiL2}`,
    `- deterministicPatch: ${report.decision.deterministicPatch}`,
    `- rationale: ${report.decision.rationale}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    decision: report.decision.nextStep,
    totalFetched: report.metrics.totalFetched,
    parseReadyCount: report.metrics.parseReadyCount,
    rejectedCount: report.metrics.rejectedCount,
    strict2024CleanRowsInExistingSamples: report.metrics.strict2024CleanRowsInExistingSamples,
    strict2024ParseReadyRows: report.metrics.strict2024ParseReadyRows,
    jsonPath,
    mdPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
