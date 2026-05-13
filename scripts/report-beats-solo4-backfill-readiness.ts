import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type LaneConfig = {
  lane_key: string;
  category: string;
  price_min_krw: number;
  price_max_krw: number;
  queries: string[];
  reject_rules: Array<{ label: string; pattern: string }>;
};

type SampleRow = {
  pid: string;
  name: string;
  price: number;
  query: string;
  sale_status: string;
  parse_ready: boolean;
  reject_reasons: string[];
};

type SearchRow = {
  pid: number;
  title: string;
  price: number;
  query: string;
  url: string;
  runtimeSkuId: string;
  ruleMatchSkuId: string;
  comparableKey: string;
  needsReview: boolean;
  decision: string;
};

type SearchReport = {
  generatedAt: string;
  metrics: Record<string, number>;
  candidateBySku: Record<string, number>;
  bySku: Record<string, number>;
  candidateRows: SearchRow[];
};

type DetailRow = SearchRow & {
  saleStatus: string;
  detailSkuId: string;
  detailComparableKey: string;
  decision: "still_candidate" | "downgraded_hold";
  holdSignal: string | null;
  descriptionPreview: string;
};

type DetailReport = {
  generatedAt: string;
  metrics: Record<string, number>;
  rows: DetailRow[];
  downgradedRows: DetailRow[];
};

type ClassifiedRow = {
  pid: string;
  title: string;
  price: number;
  source: string;
  status: "existing_parse_ready" | "detail_confirmed_new" | "search_scope_new" | "hold_or_leak_watch";
  reason: string;
};

const reportsDir = path.join(process.cwd(), "reports");
const laneDir = path.join(process.cwd(), "category-intelligence", "beats_solo_4");
const targetSku = "beats-solo4";
const targetComparableKey = "earphone|beats_solo_4";

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function readLooseJson<T>(file: string): Promise<T> {
  const raw = await readFile(file, "utf8");
  const sanitized = raw
    .replace(/\\uD[89AB][0-9A-F]{2}(?!\\uD[CDEF][0-9A-F]{2})/gi, "�")
    .replace(/(?<!\\uD[89AB][0-9A-F]{2})\\uD[CDEF][0-9A-F]{2}/gi, "�");
  return JSON.parse(sanitized) as T;
}

function mdTable(headers: string[], rows: Array<Array<unknown>>): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function uniqueByPid<T extends { pid: string | number }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of rows) {
    const pid = String(row.pid);
    if (!seen.has(pid)) {
      seen.add(pid);
      result.push(row);
    }
  }
  return result;
}

function parseOutOfScopeBeatsRows(markdown: string): ClassifiedRow[] {
  const rows: ClassifiedRow[] = [];
  let inOutOfScope = false;

  for (const line of markdown.split("\n")) {
    if (line.startsWith("## Out-of-Scope Sample")) {
      inOutOfScope = true;
      continue;
    }
    if (inOutOfScope && line.startsWith("## ")) {
      break;
    }
    if (!inOutOfScope || !line.startsWith("| ") || line.includes("---") || line.includes("pid |")) {
      continue;
    }

    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    const [pid, title, price, query, listingType] = cells;
    const haystack = `${title} ${query}`.toLowerCase();
    if (!/(비츠|beats|솔로\s*4|솔로4|solo\s*4|solo4)/i.test(haystack)) {
      continue;
    }

    const reason = listingType === "buying"
      ? "buying/accessory intent in search-scope out-of-scope sample"
      : /box|박스|case|케이스|pouch|파우치/i.test(haystack)
        ? "case/box/pouch/accessory-only risk in search-scope out-of-scope sample"
        : /sweatshirt|의류|맨투맨/i.test(haystack)
          ? "unrelated apparel title collision"
          : "out-of-scope search-scope row; require detail before any backfill";

    rows.push({
      pid,
      title,
      price: Number(price),
      source: "search_scope_markdown_out_of_scope",
      status: "hold_or_leak_watch",
      reason,
    });
  }

  return rows;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [laneConfig, samples, searchReport, detailReport, searchMarkdown] = await Promise.all([
    readJson<LaneConfig>(path.join(laneDir, "lane_config.json")),
    readJson<SampleRow[]>(path.join(laneDir, "samples.json")),
    readJson<SearchReport>(path.join(reportsDir, "headphone-non-airpods-live-search-scope-latest.json")),
    readLooseJson<DetailReport>(path.join(reportsDir, "headphone-non-airpods-live-detail-sample-latest.json")),
    readFile(path.join(reportsDir, "headphone-non-airpods-live-search-scope-latest.md"), "utf8"),
  ]);

  const existingParseReady = samples.filter((row) => row.parse_ready);
  const existingParseReadyPids = new Set(existingParseReady.map((row) => String(row.pid)));
  const detailByPid = new Map(
    detailReport.rows
      .filter((row) => row.ruleMatchSkuId === targetSku || row.runtimeSkuId === targetSku || row.detailSkuId === targetSku)
      .map((row) => [String(row.pid), row]),
  );

  const searchBeatsRows = uniqueByPid(
    searchReport.candidateRows.filter(
      (row) => row.ruleMatchSkuId === targetSku || row.runtimeSkuId === targetSku || row.comparableKey === targetComparableKey,
    ),
  );

  const existingRows: ClassifiedRow[] = existingParseReady.map((row) => ({
    pid: String(row.pid),
    title: row.name,
    price: row.price,
    source: "category_intelligence_samples",
    status: "existing_parse_ready",
    reason: `parse_ready=true; sale_status=${row.sale_status}`,
  }));

  const detailConfirmedNewRows: ClassifiedRow[] = [];
  const searchScopeNewRows: ClassifiedRow[] = [];
  const holdRows: ClassifiedRow[] = [];

  for (const row of searchBeatsRows) {
    const pid = String(row.pid);
    if (existingParseReadyPids.has(pid)) {
      continue;
    }

    const detail = detailByPid.get(pid);
    if (detail?.decision === "downgraded_hold") {
      holdRows.push({
        pid,
        title: row.title,
        price: row.price,
        source: "detail_sample",
        status: "hold_or_leak_watch",
        reason: detail.holdSignal ?? "detail downgraded hold",
      });
      continue;
    }

    if (detail?.decision === "still_candidate") {
      detailConfirmedNewRows.push({
        pid,
        title: row.title,
        price: row.price,
        source: "detail_sample",
        status: "detail_confirmed_new",
        reason: `SELLING detail still-candidate; current sample reject=${samples.find((sample) => String(sample.pid) === pid)?.reject_reasons.join(",") ?? "not_in_samples"}`,
      });
      continue;
    }

    searchScopeNewRows.push({
      pid,
      title: row.title,
      price: row.price,
      source: "search_scope_candidate",
      status: "search_scope_new",
      reason: `search-scope candidate; current sample reject=${samples.find((sample) => String(sample.pid) === pid)?.reject_reasons.join(",") ?? "not_in_samples"}`,
    });
  }

  const markdownHoldRows = parseOutOfScopeBeatsRows(searchMarkdown);
  const allHoldRows = uniqueByPid([...holdRows, ...markdownHoldRows]);
  const cleanBackfillRows = [...detailConfirmedNewRows, ...searchScopeNewRows];
  const projectedWithDetailConfirmed = existingRows.length + detailConfirmedNewRows.length;
  const projectedWithSearchScope = existingRows.length + cleanBackfillRows.length;
  const cleanSellingRows = cleanBackfillRows.filter((row) => !/RESERVED|SOLD_OUT/.test(row.reason));
  const priceHighRows = cleanBackfillRows.filter((row) => row.reason.includes("price_too_high"));

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    lane: laneConfig.lane_key,
    category: laneConfig.category,
    inputFiles: [
      "reports/mining-query-repair-queue-latest.md",
      "reports/headphone-non-airpods-live-search-scope-latest.md",
      "reports/headphone-non-airpods-live-search-scope-latest.json",
      "reports/headphone-non-airpods-live-detail-sample-latest.md",
      "reports/headphone-non-airpods-live-detail-sample-latest.json",
      "category-intelligence/beats_solo_4/samples.json",
      "category-intelligence/beats_solo_4/lane_config.json",
    ],
    laneConfigSnapshot: {
      priceMinKrw: laneConfig.price_min_krw,
      priceMaxKrw: laneConfig.price_max_krw,
      queryCount: laneConfig.queries.length,
      rejectRuleLabels: laneConfig.reject_rules.map((rule) => rule.label),
    },
    metrics: {
      currentSampleRows: samples.length,
      currentParseReadyRows: existingRows.length,
      searchScopeBeatsCandidateRows: searchBeatsRows.length,
      detailSampleBeatsRows: detailByPid.size,
      detailConfirmedCleanNewRows: detailConfirmedNewRows.length,
      searchScopeCleanNewRowsNeedingLeakWatch: searchScopeNewRows.length,
      totalCleanNewRowsAvailableNoWrite: cleanBackfillRows.length,
      cleanSellingNewRows: cleanSellingRows.length,
      priceHighCleanNewRows: priceHighRows.length,
      holdOrLeakWatchRows: allHoldRows.length,
      projectedParseReadyWithDetailConfirmedOnly: projectedWithDetailConfirmed,
      projectedParseReadyWithSearchScopeBackfill: projectedWithSearchScope,
      targetLowerBoundReachedBySearchScopeBackfill: projectedWithSearchScope >= 30,
      targetUpperBoundReachedByExistingArtifacts: projectedWithSearchScope >= 50,
    },
    existingRows,
    detailConfirmedNewRows,
    searchScopeNewRows,
    holdOrLeakWatchRows: allHoldRows,
    blockers: [
      "Existing artifacts can support the 30-row lower bound only if search-scope candidates are accepted under leak-watch; detail-confirmed rows alone move 15 to 18.",
      "Many clean-looking Solo4 Jennie edition rows are blocked in samples by price_too_high, so price policy/backfill policy is the blocker, not parser recall.",
      "One detail row must remain held for counterfeit_or_compatible_signal; search-scope markdown also shows buying/box and unrelated apparel collision rows.",
      "Existing artifacts do not contain enough validated clean rows to reach 50 without another no-write detail pass.",
    ],
    conclusion:
      "backfill_leak_watch_only_existing_reports_can_move_15_to_30_but_not_50_no_parser_or_catalog_patch_recommended",
    nextStep:
      "Use the 3 detail-confirmed new rows first, then the 12 search-scope clean full-unit rows only behind leak-watch/detail-gate review; keep counterfeit/compatible, buying box, and apparel rows excluded.",
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "beats-solo4-backfill-readiness-latest.json");
  const mdPath = path.join(reportsDir, "beats-solo4-backfill-readiness-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Beats Solo4 Backfill Readiness",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Metrics",
    "",
    `- currentParseReadyRows: ${report.metrics.currentParseReadyRows}`,
    `- searchScopeBeatsCandidateRows: ${report.metrics.searchScopeBeatsCandidateRows}`,
    `- detailConfirmedCleanNewRows: ${report.metrics.detailConfirmedCleanNewRows}`,
    `- searchScopeCleanNewRowsNeedingLeakWatch: ${report.metrics.searchScopeCleanNewRowsNeedingLeakWatch}`,
    `- totalCleanNewRowsAvailableNoWrite: ${report.metrics.totalCleanNewRowsAvailableNoWrite}`,
    `- projectedParseReadyWithDetailConfirmedOnly: ${report.metrics.projectedParseReadyWithDetailConfirmedOnly}`,
    `- projectedParseReadyWithSearchScopeBackfill: ${report.metrics.projectedParseReadyWithSearchScopeBackfill}`,
    `- holdOrLeakWatchRows: ${report.metrics.holdOrLeakWatchRows}`,
    "",
    "## Clean Full-Unit Rows",
    "",
    mdTable(
      ["pid", "title", "price", "source", "status", "reason"],
      cleanBackfillRows.map((row) => [row.pid, row.title, row.price, row.source, row.status, row.reason]),
    ),
    "",
    "## Hold / Leak-Watch Rows",
    "",
    mdTable(
      ["pid", "title", "price", "source", "reason"],
      allHoldRows.map((row) => [row.pid, row.title, row.price, row.source, row.reason]),
    ),
    "",
    "## Blockers",
    "",
    ...report.blockers.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    currentParseReadyRows: report.metrics.currentParseReadyRows,
    totalCleanNewRowsAvailableNoWrite: report.metrics.totalCleanNewRowsAvailableNoWrite,
    projectedParseReadyWithSearchScopeBackfill: report.metrics.projectedParseReadyWithSearchScopeBackfill,
    holdOrLeakWatchRows: report.metrics.holdOrLeakWatchRows,
    jsonPath,
    mdPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
