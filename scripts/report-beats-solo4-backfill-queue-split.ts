import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

type ExistingRow = {
  pid: string;
  title: string;
  price: number;
  status: string;
  reason: string;
};

type CandidateRow = {
  pid: string;
  title: string;
  price: number;
  source: string;
  status: string;
  reason: string;
};

type ReadinessReport = {
  generatedAt: string;
  lane: string;
  metrics: {
    currentSampleRows: number;
    currentParseReadyRows: number;
    searchScopeBeatsCandidateRows: number;
    detailSampleBeatsRows: number;
    detailConfirmedCleanNewRows: number;
    searchScopeCleanNewRowsNeedingLeakWatch: number;
    totalCleanNewRowsAvailableNoWrite: number;
    cleanSellingNewRows: number;
    priceHighCleanNewRows: number;
    holdOrLeakWatchRows: number;
    projectedParseReadyWithDetailConfirmedOnly: number;
    projectedParseReadyWithSearchScopeBackfill: number;
    targetLowerBoundReachedBySearchScopeBackfill: boolean;
  };
  existingRows: ExistingRow[];
  detailConfirmedNewRows: CandidateRow[];
  searchScopeNewRows: CandidateRow[];
  holdOrLeakWatchRows: CandidateRow[];
};

type DetailRow = {
  pid: number;
  title: string;
  price: number;
  decision: string;
  saleStatus: string | null;
  detailListingType: string | null;
  runtimeSkuId?: string | null;
  detailSkuId?: string | null;
};

type DetailReport = {
  rows: DetailRow[];
};

type LaneSplitRow = {
  lane: string;
  total: number;
  skuMatchPct: string;
  laneMatchPct: string;
  parseReadyPct: string;
  action: string;
  actionReason: string;
};

type LaneSplitReport = {
  rows: LaneSplitRow[];
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

function priceBand(price: number) {
  if (price >= 650_000) return "extreme";
  if (price >= 400_000) return "premium";
  return "near_policy";
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();

  const readiness = await readJson<ReadinessReport>(path.join(reportsDir, "beats-solo4-backfill-readiness-latest.json"));
  const detail = await readJson<DetailReport>(path.join(reportsDir, "headphone-non-airpods-live-detail-sample-latest.json"));
  const laneSplit = await readJson<LaneSplitReport>(path.join(reportsDir, "lane-next-action-split-latest.json"));

  const laneRow = laneSplit.rows.find((row) => row.lane === "beats_solo_4") ?? null;
  const beatsDetailRows = detail.rows.filter(
    (row) => row.runtimeSkuId === "beats-solo4" || row.detailSkuId === "beats-solo4",
  );

  const existingReadyCount = readiness.metrics.currentParseReadyRows;
  const detailConfirmedCount = readiness.detailConfirmedNewRows.length;
  const leakWatchCount = readiness.searchScopeNewRows.length;
  const holdRejectCount = readiness.holdOrLeakWatchRows.length;
  const projectedThirty = existingReadyCount + detailConfirmedCount + leakWatchCount;

  const detailConfirmedBands = countBy(readiness.detailConfirmedNewRows, (row) => priceBand(row.price));
  const leakWatchBands = countBy(readiness.searchScopeNewRows, (row) => priceBand(row.price));
  const holdBands = countBy(readiness.holdOrLeakWatchRows, (row) => priceBand(row.price));

  const allCleanRowsBlockedOnlyByPrice =
    readiness.metrics.priceHighCleanNewRows === readiness.metrics.totalCleanNewRowsAvailableNoWrite
    && readiness.metrics.totalCleanNewRowsAvailableNoWrite > 0
    && readiness.detailConfirmedNewRows.every((row) => row.reason.includes("price_too_high"))
    && readiness.searchScopeNewRows.every((row) => row.reason.includes("price_too_high"));

  const detailConfirmedRowsStayNormal =
    readiness.detailConfirmedNewRows.every((row) => row.reason.includes("still-candidate"))
    && beatsDetailRows
      .filter((row) =>
        readiness.detailConfirmedNewRows.some((candidate) => candidate.pid === String(row.pid)),
      )
      .every((row) => row.decision === "still_candidate" && row.detailListingType === "normal");

  const priceTooHighIsPolicyBlocker = allCleanRowsBlockedOnlyByPrice && detailConfirmedRowsStayNormal;

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    lane: "beats_solo_4",
    sourceReports: [
      "reports/beats-solo4-backfill-readiness-latest.json",
      "reports/headphone-non-airpods-live-detail-sample-latest.json",
      "reports/headphone-non-airpods-acquisition-plan-latest.json",
      "reports/lane-next-action-split-latest.json",
    ],
    laneStatus: laneRow,
    queueSplit: {
      existingParseReadyRows: existingReadyCount,
      detailConfirmedClean: detailConfirmedCount,
      searchScopeLeakWatch: leakWatchCount,
      holdReject: holdRejectCount,
      projectedParseReadyTotal: projectedThirty,
    },
    priceBands: {
      detailConfirmed: detailConfirmedBands,
      leakWatch: leakWatchBands,
      holdReject: holdBands,
    },
    priceTooHighDecision: {
      classification: priceTooHighIsPolicyBlocker ? "policy_blocker" : "parser_blocker_or_mixed",
      because: priceTooHighIsPolicyBlocker
        ? [
            "All 15 clean new rows are rejected for price_too_high in the lane artifact.",
            "Detail-confirmed Beats Solo4 rows remain normal/still-candidate rather than changing class in the detail sample artifact.",
            "This means the rows are already parsed as the right SKU and listing type; the blocker is the current lane max price 280000.",
          ]
        : [
            "Not every clean new row is consistently blocked by price policy, or detail confirmation changed class.",
          ],
    },
    detailConfirmedRows: readiness.detailConfirmedNewRows.map((row) => ({
      pid: row.pid,
      title: row.title,
      price: row.price,
      priceBand: priceBand(row.price),
      source: row.source,
      reason: row.reason,
    })),
    leakWatchRows: readiness.searchScopeNewRows.map((row) => ({
      pid: row.pid,
      title: row.title,
      price: row.price,
      priceBand: priceBand(row.price),
      source: row.source,
      reason: row.reason,
    })),
    holdRejectRows: readiness.holdOrLeakWatchRows.map((row) => ({
      pid: row.pid,
      title: row.title,
      price: row.price,
      priceBand: priceBand(row.price),
      source: row.source,
      reason: row.reason,
    })),
    nextAction: [
      "Backfill detail-confirmed clean rows first.",
      "Queue search-scope rows behind leak-watch because they are clean in search scope but not detail-confirmed in this packet.",
      "Keep hold/reject rows out of backfill until leak-watch/manual review clears them.",
      "Treat price_too_high as a lane price policy blocker, not a parser blocker, in this report-only phase.",
    ],
  };

  const jsonPath = path.join(reportsDir, "beats-solo4-backfill-queue-split-latest.json");
  const mdPath = path.join(reportsDir, "beats-solo4-backfill-queue-split-latest.md");

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const md = [
    "# Beats Solo4 Backfill Queue Split",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- priceTooHighDecision: ${report.priceTooHighDecision.classification}`,
    "",
    "## Queue Split",
    "",
    `- existingParseReadyRows: ${existingReadyCount}`,
    `- detailConfirmedClean: ${detailConfirmedCount}`,
    `- searchScopeLeakWatch: ${leakWatchCount}`,
    `- holdReject: ${holdRejectCount}`,
    `- projectedParseReadyTotal: ${projectedThirty}`,
    "",
    "## Price Bands",
    "",
    mdTable(
      ["bucket", "detailConfirmed", "searchScopeLeakWatch", "holdReject"],
      ["extreme", "premium", "near_policy"].map((bucket) => [
        bucket,
        Object.fromEntries(detailConfirmedBands)[bucket] ?? 0,
        Object.fromEntries(leakWatchBands)[bucket] ?? 0,
        Object.fromEntries(holdBands)[bucket] ?? 0,
      ]),
    ),
    "",
    "## Detail-Confirmed Clean",
    "",
    mdTable(
      ["pid", "price", "band", "title"],
      report.detailConfirmedRows.map((row) => [row.pid, row.price, row.priceBand, compact(row.title)]),
    ),
    "",
    "## Search-Scope Leak-Watch",
    "",
    mdTable(
      ["pid", "price", "band", "title"],
      report.leakWatchRows.map((row) => [row.pid, row.price, row.priceBand, compact(row.title)]),
    ),
    "",
    "## Hold / Reject",
    "",
    mdTable(
      ["pid", "price", "band", "title"],
      report.holdRejectRows.map((row) => [row.pid, row.price, row.priceBand, compact(row.title)]),
    ),
    "",
    "## Why price_too_high is policy-side",
    "",
    ...report.priceTooHighDecision.because.map((item) => `- ${item}`),
    "",
    "## Next Action",
    "",
    ...report.nextAction.map((item) => `- ${item}`),
    "",
  ].join("\n");

  await writeFile(mdPath, `${md}\n`, "utf8");

  console.log(JSON.stringify({
    projectedParseReadyTotal: projectedThirty,
    detailConfirmedClean: detailConfirmedCount,
    searchScopeLeakWatch: leakWatchCount,
    holdReject: holdRejectCount,
    priceTooHighDecision: report.priceTooHighDecision.classification,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
