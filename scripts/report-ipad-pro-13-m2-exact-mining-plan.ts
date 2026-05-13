import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const laneDir = path.join(appDir, "category-intelligence", "ipad_pro_13_m2_256_wifi");

type QueueRow = {
  lane: string;
  group: string;
  priority: number;
  total: number;
  sku: number;
  complete: number;
};

type LaneActionRow = {
  lane: string;
  total: number;
  skuMatchPct: string;
  laneMatchPct: string;
  parseReadyPct: string;
  comparableKeyCompletePct: string;
  action: string;
  actionReason: string;
};

type ParseSummary = {
  lane_key: string;
  generated_at: string;
  queries: string[];
  total_fetched: number;
  parse_ready_count: number;
  rejected_count: number;
  reject_breakdown: Array<{ reason: string; count: number }>;
};

type LaneConfig = {
  lane_key: string;
  queries: string[];
};

type SampleRow = {
  pid: string;
  name: string;
  price: number;
  query: string;
  description?: string;
  parse_ready?: boolean;
  reject_reasons?: string[];
};

type ParseReadyRow = {
  pid: string;
  name: string;
  price: number;
  query: string;
};

type ProposedQueryGroup = {
  group: string;
  goal: string;
  why: string;
  queries: string[];
};

type ExactEvidenceRow = {
  pid: string;
  title: string;
  query: string;
  price: number;
  explicitWifiInTitle: boolean;
  explicitWifiAnywhere: boolean;
  explicitCellularAnywhere: boolean;
  exactCoreInTitle: boolean;
  bundleSignals: string[];
  note: string;
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function compact(text: string, limit = 88) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = key(row);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function findQueueRow(markdown: string, lane: string): QueueRow | null {
  const lines = markdown.split("\n");
  for (const line of lines) {
    if (!line.startsWith(`| ${lane} | `)) continue;
    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 7) continue;
    return {
      lane: cells[0],
      group: cells[1],
      priority: Number(cells[2]),
      total: Number(cells[3]),
      sku: Number(cells[4]),
      complete: Number(cells[6]),
    };
  }
  return null;
}

const wifiRegex = /\bwifi\b|wifi모델|wifi\s*model|와이파이|와이파이\s*모델|wi-fi/i;
const cellularRegex = /셀룰러|cellular|\blte\b|\b5g\b|유심|sim\s*트레이|esim/i;
const exactCoreRegexes = {
  pro: /아이패드\s*프로|ipad\s*pro|아이패드프로|프로6|프로\s*6세대/i,
  size: /12\.9\s*인치|12\.9\s*형|\b12\.9\b|아이패드\s*프로\s*12\.9|ipad\s*pro\s*12\.9|13\s*인치|13\s*형/i,
  chipOrGen: /\bm2\b|m2\s*칩|\(m2\)|6\s*세대|6th\s*gen|프로6|프로\s*6세대/i,
  storage: /256\s*(?:gb|기가)?/i,
};
const bundleTerms = [
  "애플펜슬",
  "매직키보드",
  "키보드",
  "풀세트",
  "케이스",
  "필름",
  "팔찌",
];

function exactCoreInText(text: string) {
  return exactCoreRegexes.pro.test(text)
    && exactCoreRegexes.size.test(text)
    && exactCoreRegexes.chipOrGen.test(text)
    && exactCoreRegexes.storage.test(text);
}

function collectBundleSignals(text: string) {
  return bundleTerms.filter((term) => text.includes(term));
}

function explainEvidence(row: SampleRow): ExactEvidenceRow {
  const title = row.name;
  const description = row.description ?? "";
  const merged = `${title}\n${description}`;
  const explicitWifiInTitle = wifiRegex.test(title);
  const explicitWifiAnywhere = wifiRegex.test(merged);
  const explicitCellularAnywhere = cellularRegex.test(merged);
  const exactCoreInTitle = exactCoreInText(title);
  const bundleSignals = collectBundleSignals(merged);

  let note = "exact_core_but_connectivity_silent";
  if (explicitCellularAnywhere) note = "reject_cellular";
  else if (explicitWifiInTitle) note = "deterministic_exact_wifi_title";
  else if (explicitWifiAnywhere) note = "exact_core_with_desc_wifi_only";
  else if (!exactCoreInTitle) note = "core_signal_gap_in_title";

  return {
    pid: row.pid,
    title: row.name,
    query: row.query,
    price: row.price,
    explicitWifiInTitle,
    explicitWifiAnywhere,
    explicitCellularAnywhere,
    exactCoreInTitle,
    bundleSignals,
    note,
  };
}

function proposedQueryGroups(): ProposedQueryGroup[] {
  return [
    {
      group: "primary_explicit_wifi",
      goal: "deterministic title-level exact Wi-Fi positives",
      why: "Current laneMatch is bottlenecked by missing explicit Wi-Fi wording, not by missing 12.9/M2/256 core rows.",
      queries: [
        "아이패드 프로 12.9 m2 256 wifi",
        "아이패드 프로 12.9 6세대 256 wifi",
        "아이패드 프로 12.9 m2 256 와이파이",
        "아이패드 프로 12.9 6세대 256 와이파이",
        "아이패드 프로 6세대 12.9 256 wifi모델",
        "아이패드 프로6 12.9 256 와이파이",
        "ipad pro 12.9 m2 256 wifi",
        "ipad pro 12.9 6th gen 256 wifi",
      ],
    },
    {
      group: "secondary_spacing_variants",
      goal: "catch compact/spacing variants already visible in positives",
      why: "Observed positives include compressed forms like 아이패드프로12.9 and wifi모델.",
      queries: [
        "아이패드프로12.9 m2 256 wifi",
        "아이패드프로 12.9 6세대 256 와이파이",
        "아이패드프로12.9 6세대 m2 256 wifi",
        "아이패드 프로12.9 m2 256 wifi",
        "아이패드 프로 12.9 6세대 m2 256 wifi모델",
      ],
    },
    {
      group: "strict_support_desc_wifi",
      goal: "report-only backfill candidates where title has exact core and description states Wi-Fi",
      why: "Four parse-ready rows already expose explicit Wi-Fi in title-or-description, but only one does so in title.",
      queries: [
        "아이패드 프로 m2 12.9 256 와이파이",
        "아이패드 프로 6세대 12.9 256 와이파이",
        "아이패드 프로 12.9 256 wifi 모델",
      ],
    },
    {
      group: "deprioritize_current_13_family",
      goal: "avoid Air 13 M2 contamination",
      why: "Bare 13 + M2 wording drifts toward iPad Air 13 M2 much more than iPad Pro 12.9 6세대.",
      queries: [
        "아이패드 프로 13 m2 256",
        "아이패드 프로 m2 13",
        "ipad pro 13 m2 256",
      ],
    },
  ];
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();

  const queueMarkdown = await readFile(path.join(reportsDir, "mining-query-repair-queue-latest.md"), "utf8");
  const laneSplit = await readJson<{ rows: LaneActionRow[] }>(path.join(reportsDir, "lane-next-action-split-latest.json"));
  const parseSummary = await readJson<ParseSummary>(path.join(laneDir, "parse_summary.json"));
  const parseReadyRows = await readJson<ParseReadyRow[]>(path.join(laneDir, "parse_ready_sample.json"));
  const samples = await readJson<SampleRow[]>(path.join(laneDir, "samples.json"));
  const laneConfig = await readJson<LaneConfig>(path.join(laneDir, "lane_config.json"));

  const queueRow = findQueueRow(queueMarkdown, "ipad_pro_13_m2_256_wifi");
  const laneActionRow = laneSplit.rows.find((row) => row.lane === "ipad_pro_13_m2_256_wifi") ?? null;
  const sampleByPid = new Map(samples.map((row) => [row.pid, row]));
  const exactEvidenceRows = parseReadyRows
    .map((row) => explainEvidence(sampleByPid.get(row.pid) ?? row))
    .sort((a, b) => Number(b.explicitWifiInTitle) - Number(a.explicitWifiInTitle) || a.pid.localeCompare(b.pid));

  const explicitWifiInTitleCount = exactEvidenceRows.filter((row) => row.explicitWifiInTitle).length;
  const explicitWifiAnywhereCount = exactEvidenceRows.filter((row) => row.explicitWifiAnywhere).length;
  const exactCoreSilentConnectivityCount = exactEvidenceRows.filter((row) => row.exactCoreInTitle && !row.explicitWifiAnywhere && !row.explicitCellularAnywhere).length;
  const queryBreakdown = countBy(samples.filter((row) => row.parse_ready), (row) => row.query);
  const rejectedByQuery = countBy(samples.filter((row) => !row.parse_ready), (row) => row.query);
  const topRejectReasons = parseSummary.reject_breakdown.slice(0, 8);
  const airRejectCount = parseSummary.reject_breakdown.find((row) => row.reason === "reject_ipad_air_or_mini")?.count ?? 0;
  const cellularRejectCount = parseSummary.reject_breakdown.find((row) => row.reason === "reject_cellular_variant")?.count ?? 0;
  const buyingRejectCount = parseSummary.reject_breakdown.find((row) => row.reason === "reject_buying_post")?.count ?? 0;
  const missingSizeCount = parseSummary.reject_breakdown.find((row) => row.reason.startsWith("missing_any_13"))?.count ?? 0;
  const missingChipCount = parseSummary.reject_breakdown.find((row) => row.reason.startsWith("missing_any__bm2"))?.count ?? 0;

  const report = {
    generatedAt,
    reportOnly: true,
    runtimeMutation: false,
    supabaseMutation: false,
    category: "tablet",
    lane: "ipad_pro_13_m2_256_wifi",
    sourceFiles: [
      "reports/mining-query-repair-queue-latest.md",
      "reports/lane-next-action-split-latest.json",
      "category-intelligence/ipad_pro_13_m2_256_wifi/parse_summary.json",
      "category-intelligence/ipad_pro_13_m2_256_wifi/parse_ready_sample.json",
      "category-intelligence/ipad_pro_13_m2_256_wifi/samples.json",
      "category-intelligence/ipad_pro_13_m2_256_wifi/lane_config.json",
      "scripts/lib/mine-narrow-lane.ts",
    ],
    currentState: {
      queueRow,
      laneActionRow,
      parseSummary: {
        generatedAt: parseSummary.generated_at,
        totalFetched: parseSummary.total_fetched,
        parseReadyCount: parseSummary.parse_ready_count,
        rejectedCount: parseSummary.rejected_count,
      },
      currentQueries: laneConfig.queries,
      queryBreakdown,
      rejectedByQuery: rejectedByQuery.slice(0, 6),
    },
    diagnosis: {
      whyTotal11LaneMatch9p1Completion72p7: [
        "현재 parse-ready 11개는 거의 전부 '아이패드 프로 m2 12.9 256' 한 쿼리에서만 나왔다.",
        "그 11개 중 title에 Wi-Fi가 명시된 row는 1개뿐이라 laneMatch가 1/11 = 9.1%로 눌린다.",
        "반면 exact Pro 12.9 + M2/6세대 + 256 코어 자체는 많이 잡혀서 completion은 8/11 = 72.7% 수준으로 유지된다.",
        "bare '13' 계열 쿼리는 iPad Air 13 M2, buying post, cellular 잡음을 과도하게 끌어와서 total은 늘리지만 exact Wi-Fi row를 거의 못 만든다.",
      ],
      metrics: {
        explicitWifiInTitleCount,
        explicitWifiAnywhereCount,
        exactCoreSilentConnectivityCount,
        airRejectCount,
        cellularRejectCount,
        buyingRejectCount,
        missingSizeCount,
        missingChipCount,
      },
      topRejectReasons,
    },
    exactEvidenceRows,
    proposedQueryGroups: proposedQueryGroups(),
    acceptRejectPlan: {
      deterministicAccept: [
        "title or description must contain 아이패드 프로 / ipad pro / 아이패드프로",
        "title or description must contain 12.9-inch or 13-inch exact-size wording, but for M2 wave prioritize 12.9 / 6세대 forms",
        "title or description must contain M2 or 6세대 / 6th gen evidence",
        "title or description must contain 256 / 256GB / 256기가",
        "Wi-Fi must be explicit: wifi / wi-fi / 와이파이 / wifi모델 / 와이파이 모델",
        "keep LTE / 5G / cellular / 셀룰러 explicit rows rejected",
        "do not infer Wi-Fi from silence",
      ],
      reviewHold: [
        "exact Pro 12.9 + M2/6세대 + 256 rows with Wi-Fi only in description are useful for report-only backfill review, but should not be treated as deterministic title-level lane wins yet",
        "tablet-plus-accessory bundles are acceptable if the tablet body is explicit; accessory-only listings stay rejected",
        "unrelated luxury add-ons that distort price bands should stay review-hold even when the tablet itself is exact",
      ],
      reject: [
        "아이패드 에어 / ipad air / 아이패드 미니 / ipad mini",
        "11-inch / 4세대 / M1 / M3 / M4",
        "셀룰러 / cellular / LTE / 5G / 유심 / eSIM",
        "512GB / 1TB / 2TB / 128GB",
        "매입 / 삽니다 / 구매합니다",
        "케이스만 / 펜슬만 / 키보드만 / 충전기만",
      ],
    },
    blockers: [
      "lane name has 13, but the natural M2 retail wording in market rows is overwhelmingly 12.9 / 6세대; bare 13 wording mostly leaks into iPad Air 13 M2.",
      "current mined positives prove core exactness, but not enough explicit Wi-Fi wording for deterministic exact lane closure.",
      "compact token forms like 'M2_256GB' show that spacing-sensitive query wording still matters even before any parser/runtime patch.",
      "no runtime patch is allowed in this task, so the only safe move now is stricter explicit-Wi-Fi query shaping plus report-only review criteria.",
    ],
    nextStep: [
      "Run a no-mutation acquisition wave with the primary_explicit_wifi and secondary_spacing_variants groups only.",
      "Keep the current bare 13-family queries out of the first exact repair wave.",
      "Review desc-only Wi-Fi rows separately; do not count them as deterministic lane success unless the future runtime path is intentionally widened.",
    ],
  };

  const jsonPath = path.join(reportsDir, "ipad-pro-13-m2-exact-mining-plan-latest.json");
  const mdPath = path.join(reportsDir, "ipad-pro-13-m2-exact-mining-plan-latest.md");

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const markdown = [
    "# iPad Pro 13 M2 Exact Mining Plan",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- runtimeMutation: false",
    "- supabaseMutation: false",
    "",
    "## Current State",
    "",
    `- queue total: ${queueRow?.total ?? "-"}`,
    `- queue sku: ${queueRow?.sku ?? "-"}`,
    `- queue complete: ${queueRow?.complete ?? "-"}`,
    `- laneMatchPct: ${laneActionRow?.laneMatchPct ?? "-"}`,
    `- parseReadyPct: ${laneActionRow?.parseReadyPct ?? "-"}`,
    `- comparableKeyCompletePct: ${laneActionRow?.comparableKeyCompletePct ?? "-"}`,
    `- parse_ready_count: ${parseSummary.parse_ready_count}`,
    `- total_fetched: ${parseSummary.total_fetched}`,
    "",
    "## Why 11 / 9.1% / 72.7%",
    "",
    ...report.diagnosis.whyTotal11LaneMatch9p1Completion72p7.map((item) => `- ${item}`),
    "",
    `- explicit Wi-Fi in title: ${explicitWifiInTitleCount}/${parseReadyRows.length}`,
    `- explicit Wi-Fi anywhere: ${explicitWifiAnywhereCount}/${parseReadyRows.length}`,
    `- exact core but connectivity silent: ${exactCoreSilentConnectivityCount}/${parseReadyRows.length}`,
    "",
    "## Current Query Yield",
    "",
    mdTable(
      ["query", "parseReady"],
      queryBreakdown.map(([query, count]) => [query, count]),
    ),
    "",
    "## Current Query Noise",
    "",
    mdTable(
      ["query", "rejected"],
      report.currentState.rejectedByQuery.map(([query, count]) => [query, count]),
    ),
    "",
    "## Top Reject Reasons",
    "",
    mdTable(
      ["reason", "count"],
      topRejectReasons.map((row) => [row.reason, row.count]),
    ),
    "",
    "## Exact Evidence Rows",
    "",
    mdTable(
      ["pid", "title", "wifi:title", "wifi:any", "bundle", "note"],
      exactEvidenceRows.map((row) => [
        row.pid,
        compact(row.title),
        row.explicitWifiInTitle ? "yes" : "no",
        row.explicitWifiAnywhere ? "yes" : "no",
        row.bundleSignals.join(", ") || "-",
        row.note,
      ]),
    ),
    "",
    "## Proposed Query Variants",
    "",
    ...report.proposedQueryGroups.flatMap((group) => [
      `### ${group.group}`,
      "",
      `- goal: ${group.goal}`,
      `- why: ${group.why}`,
      ...group.queries.map((query) => `- ${query}`),
      "",
    ]),
    "## Accept / Reject",
    "",
    "### Deterministic Accept",
    "",
    ...report.acceptRejectPlan.deterministicAccept.map((item) => `- ${item}`),
    "",
    "### Review Hold",
    "",
    ...report.acceptRejectPlan.reviewHold.map((item) => `- ${item}`),
    "",
    "### Reject",
    "",
    ...report.acceptRejectPlan.reject.map((item) => `- ${item}`),
    "",
    "## Blockers",
    "",
    ...report.blockers.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    ...report.nextStep.map((item) => `- ${item}`),
    "",
  ].join("\n");

  await writeFile(mdPath, `${markdown}\n`, "utf8");

  console.log(JSON.stringify({
    lane: report.lane,
    parseReadyCount: parseSummary.parse_ready_count,
    explicitWifiInTitleCount,
    explicitWifiAnywhereCount,
    primaryQueryCount: report.proposedQueryGroups[0]?.queries.length ?? 0,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
