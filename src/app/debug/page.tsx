import Link from "next/link";
import { DebugAutoRefresh } from "@/app/debug/debug-auto-refresh";
import { DebugResetPanel } from "@/app/debug/debug-reset-panel";
import { loadCollectRuns, type CollectRun } from "@/lib/collect-logs";

export const dynamic = "force-dynamic";

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatDuration(ms: number | null) {
  if (ms == null) return "진행 중";
  if (ms < 1000) return `${ms}ms`;
  return `${Math.round(ms / 100) / 10}초`;
}

function elapsedMs(run: CollectRun) {
  return Math.max(0, Date.now() - Date.parse(run.startedAt));
}

function isStaleRunning(run: CollectRun) {
  return run.status === "running" && elapsedMs(run) > 3 * 60 * 1000;
}

function statusLabel(run: CollectRun) {
  if (isStaleRunning(run)) return "멈춤 의심";
  const status = run.status;
  if (status === "succeeded") return "완료";
  if (status === "failed") return "실패";
  return "진행 중";
}

function statusClass(run: CollectRun) {
  if (isStaleRunning(run)) return "bg-red-100 text-red-800 ring-red-200";
  const status = run.status;
  if (status === "succeeded") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (status === "failed") return "bg-red-100 text-red-800 ring-red-200";
  return "bg-amber-100 text-amber-800 ring-amber-200";
}

function durationLabel(run: CollectRun) {
  if (run.durationMs != null) return formatDuration(run.durationMs);
  if (run.status === "running") {
    const elapsed = elapsedMs(run);
    if (elapsed >= 60 * 1000) return `${Math.floor(elapsed / 60000)}분 경과`;
    return `${Math.max(1, Math.floor(elapsed / 1000))}초 경과`;
  }
  return "-";
}

function num(value: number) {
  return value.toLocaleString("ko-KR");
}

function shortText(value: string | null, max = 42) {
  if (!value) return "-";
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function pct(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.max(0, Math.min(100, Math.round((part / total) * 100)))}%`;
}

function restUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
  };
}

function kstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
}

type MarketPriceDebugRow = {
  comparable_key: string;
  active_sample_count: number;
  confidence: "high" | "medium" | "low";
  active_median_price: number | null;
};

type BottleneckRawRow = {
  pid: number;
  name: string;
  price: number;
  sku_name: string | null;
  thumbnail_url: string | null;
};

type BottleneckListingRow = {
  pid: number;
  price: number;
  sku_median: number | null;
  shipping_fee: number | null;
  shipping_fee_general: number | null;
  estimated_buy_cost: number | null;
  thumbnail_url: string | null;
  name: string;
  sku_name: string | null;
};

type BottleneckAnalysisRow = {
  pid: number;
  risk_hits: number | null;
  score_flags: string[] | null;
};

type BottleneckParsedRow = {
  pid: number;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
  parsed_json: Record<string, unknown> | null;
};

type PoolRow = {
  profit_band: 1 | 2 | 3;
  status: string;
};

type SourceHealthDebugRow = {
  status: "healthy" | "degraded" | "unhealthy";
  previous_status: "healthy" | "degraded" | "unhealthy" | null;
  checked_at: string;
  window_minutes: number;
  detail_success_rate: number;
  detail_404_rate: number;
  detail_5xx_rate: number;
  sold_transition_rate: number;
  disappeared_transition_rate: number;
  search_result_count: number;
  baseline_json: Record<string, unknown> | null;
  hysteresis_json: Record<string, unknown> | null;
  reason: string;
};

type MarketInvalidationDebugRow = {
  comparable_key: string;
  status: "pending" | "processing" | "done" | "failed";
  reason: string;
  priority: number;
  event_count: number;
  last_event_at: string;
  last_recomputed_at: string | null;
};

const SELLING_FEE_RATE = 0.035;
const RESELL_SHIPPING_FEE = 3500;
const SAFETY_BUFFER = 5000;
const POOL_CONFIDENCE_FLOOR = 0.7;
const POOL_BLOCK_FLAGS = [
  "coarse_market_price",
  "market_confidence_low",
  "market_stat_missing",
  "option_parse_review",
  "option_needs_review",
  "ai_review_unavailable",
  "weak_description",
  "risk_keyword_review",
];

function bandFromProfit(profitMin: number, profitMax: number) {
  const avg = Math.round((profitMin + profitMax) / 2);
  if (avg >= 70_000) return 3;
  if (avg >= 40_000) return 2;
  if (avg >= 20_000) return 1;
  return null;
}

function poolConfidence(parseConfidence: number | null | undefined, flags: string[]) {
  let confidence = Math.max(0, Math.min(1, Number(parseConfidence ?? 0.5) || 0.5));
  if (flags.includes("ai_normal")) confidence = Math.min(1, confidence + 0.2);
  if (flags.includes("ai_review_unavailable")) confidence = Math.max(0, confidence - 0.1);
  if (flags.some((flag) => flag.endsWith("_low_confidence"))) confidence = Math.max(0, confidence - 0.15);
  return Math.round(confidence * 100) / 100;
}

function poolBlockFlag(flags: string[]) {
  return flags.some((flag) => (
    POOL_BLOCK_FLAGS.includes(flag) ||
    flag.endsWith("_low_confidence") ||
    (flag === "deep_discount_review" && !flags.includes("ai_normal"))
  ));
}

function increment(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function mapRows<T extends { pid: number }>(rows: T[]) {
  return new Map(rows.map((row) => [Number(row.pid), row]));
}

async function restJson<T>(path: string, fallback: T): Promise<T> {
  const base = restUrl();
  const headers = serviceHeaders();
  if (!base || !headers) return fallback;
  const res = await fetch(`${base}${path}`, { headers, cache: "no-store" });
  if (!res.ok) return fallback;
  return await res.json() as T;
}

async function loadPidChunked<T>(pids: number[], pathForChunk: (ids: string) => string): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < pids.length; i += 200) {
    const ids = pids.slice(i, i + 200).join(",");
    rows.push(...await restJson<T[]>(pathForChunk(ids), []));
  }
  return rows;
}

async function loadMarketPriceDebug() {
  const base = restUrl();
  const headers = serviceHeaders();
  if (!base || !headers) {
    return {
      date: kstDateString(),
      total: 0,
      high: 0,
      medium: 0,
      low: 0,
      totalSamples: 0,
      top: [] as MarketPriceDebugRow[],
    };
  }
  const today = kstDateString();
  const url = `${base}/mvp_market_price_daily?select=comparable_key,active_sample_count,confidence,active_median_price&date=eq.${today}&order=active_sample_count.desc&limit=1000`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    return {
      date: today,
      total: 0,
      high: 0,
      medium: 0,
      low: 0,
      totalSamples: 0,
      top: [] as MarketPriceDebugRow[],
    };
  }
  const rows = (await res.json()) as MarketPriceDebugRow[];
  return {
    date: today,
    total: rows.length,
    high: rows.filter((row) => row.confidence === "high").length,
    medium: rows.filter((row) => row.confidence === "medium").length,
    low: rows.filter((row) => row.confidence === "low").length,
    totalSamples: rows.reduce((sum, row) => sum + Number(row.active_sample_count ?? 0), 0),
    top: rows.slice(0, 5),
  };
}

async function loadSourceHealthDebug() {
  return (await restJson<SourceHealthDebugRow[]>(
    "/mvp_source_health?select=status,previous_status,checked_at,window_minutes,detail_success_rate,detail_404_rate,detail_5xx_rate,sold_transition_rate,disappeared_transition_rate,search_result_count,baseline_json,hysteresis_json,reason&source=eq.bunjang&order=checked_at.desc&limit=1",
    [],
  ))[0] ?? null;
}

async function loadMarketInvalidationDebug() {
  const rows = await restJson<MarketInvalidationDebugRow[]>(
    "/mvp_market_key_invalidation?select=comparable_key,status,reason,priority,event_count,last_event_at,last_recomputed_at&order=last_event_at.desc&limit=1000",
    [],
  );
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
  const recentlyClosed = rows.filter((row) => (
    row.status === "done" &&
    row.last_recomputed_at &&
    Date.parse(row.last_recomputed_at) >= thirtyMinutesAgo
  )).length;
  const reasonCounts = rows.reduce<Map<string, number>>((acc, row) => {
    acc.set(row.reason || "unknown", (acc.get(row.reason || "unknown") ?? 0) + Number(row.event_count ?? 1));
    return acc;
  }, new Map());
  const topReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([reason, count]) => ({ reason, count }));
  const pendingTop = rows
    .filter((row) => row.status === "pending")
    .sort((a, b) => b.priority - a.priority || Date.parse(a.last_event_at) - Date.parse(b.last_event_at))
    .slice(0, 6);
  return {
    total: rows.length,
    pending: counts.pending ?? 0,
    processing: counts.processing ?? 0,
    done: counts.done ?? 0,
    failed: counts.failed ?? 0,
    recentlyClosed,
    eventCount: rows.reduce((sum, row) => sum + Number(row.event_count ?? 0), 0),
    topReasons,
    pendingTop,
  };
}

async function loadBottleneckDebug() {
  const rawRows = await restJson<BottleneckRawRow[]>(
    "/mvp_raw_listings?select=pid,name,price,sku_name,thumbnail_url&detail_status=eq.done&listing_type=eq.normal&sku_id=not.is.null&order=last_seen_at.desc&limit=500",
    [],
  );
  const pids = rawRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  const [listingRows, analysisRows, parsedRows, poolRows] = await Promise.all([
    loadPidChunked<BottleneckListingRow>(pids, (ids) => `/mvp_listings?select=pid,price,sku_median,shipping_fee,shipping_fee_general,estimated_buy_cost,thumbnail_url,name,sku_name&pid=in.(${ids})`),
    loadPidChunked<BottleneckAnalysisRow>(pids, (ids) => `/mvp_listing_analysis?select=pid,risk_hits,score_flags&pid=in.(${ids})`),
    loadPidChunked<BottleneckParsedRow>(pids, (ids) => `/mvp_listing_parsed?select=pid,comparable_key,parse_confidence,needs_review,parsed_json&pid=in.(${ids})`),
    restJson<PoolRow[]>("/mvp_candidate_pool?select=profit_band,status&limit=5000", []),
  ]);

  const listingMap = mapRows(listingRows);
  const analysisMap = mapRows(analysisRows);
  const parsedMap = mapRows(parsedRows);
  const reasons = new Map<string, number>();
  const criticalUnknown = new Map<string, number>();
  let pass = 0;
  let mediumOrHighReady = 0;

  for (const row of poolRows) {
    if (row.status === "ready") mediumOrHighReady += 1;
  }

  for (const raw of rawRows) {
    const listing = listingMap.get(raw.pid);
    const analysis = analysisMap.get(raw.pid);
    const parsed = parsedMap.get(raw.pid);
    const flags = Array.isArray(analysis?.score_flags) ? analysis.score_flags : [];
    const parsedJson = parsed?.parsed_json ?? {};
    const critical = Array.isArray(parsedJson.critical_unknown) ? parsedJson.critical_unknown.map(String) : [];
    for (const item of critical) increment(criticalUnknown, item);

    if (!listing) {
      increment(reasons, "not_scored_yet");
      continue;
    }

    const skuMedian = Number(listing.sku_median ?? 0);
    const price = Number(listing.price ?? raw.price ?? 0);
    if (skuMedian <= 0 || price <= 0) {
      increment(reasons, "no_price_or_median");
      continue;
    }

    const shippingFee = Number(listing.shipping_fee ?? 0);
    const shippingFeeGeneral = listing.shipping_fee_general == null ? null : Number(listing.shipping_fee_general);
    const estimatedBuyCost = Number(listing.estimated_buy_cost ?? price);
    const sellFee = Math.round(skuMedian * SELLING_FEE_RATE);
    const profitMax = Math.max(0, skuMedian - estimatedBuyCost - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
    const profitMin = Math.max(0, skuMedian - (price + (shippingFeeGeneral ?? shippingFee)) - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
    const band = bandFromProfit(profitMin, profitMax);
    const confidence = poolConfidence(parsed?.parse_confidence, flags);

    if (band === null) increment(reasons, "profit_below_band");
    else if (profitMin <= 0) increment(reasons, "profit_min_zero");
    else if (price >= skuMedian) increment(reasons, "price_gte_median");
    else if (Number(analysis?.risk_hits ?? 0) > 0) increment(reasons, "risk_hits");
    else if (!listing.thumbnail_url && !raw.thumbnail_url) increment(reasons, "no_thumbnail");
    else if (!parsed?.comparable_key) increment(reasons, "no_comparable_key");
    else if (parsed.needs_review) increment(reasons, "parsed_needs_review");
    else if (confidence < POOL_CONFIDENCE_FLOOR) increment(reasons, "confidence_below_0_7");
    else if (poolBlockFlag(flags)) increment(reasons, "blocked_flag");
    else pass += 1;
  }

  const reasonRows = [...reasons.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));
  const criticalRows = [...criticalUnknown.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));
  const poolSummary = poolRows.reduce<Record<string, number>>((acc, row) => {
    const key = `band${row.profit_band}:${row.status}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    sampleSize: rawRows.length,
    scored: listingRows.length,
    parsed: parsedRows.length,
    pass,
    readyPool: mediumOrHighReady,
    reasonRows,
    criticalRows,
    poolSummary,
  };
}

function lastSucceeded(runs: CollectRun[]) {
  return runs.find((run) => run.status === "succeeded") ?? null;
}

function pipelineMode(run: CollectRun) {
  const value = run.requestMeta.pipelineMode;
  if (typeof value === "string" && value.trim()) return value.trim();
  const path = run.requestPath ?? "";
  if (path.includes("/detail-worker")) return "detail_worker";
  if (path.includes("/deep-crawl")) return "deep_crawl";
  if (path.includes("/pool-warmer")) return "pool_warmer";
  if (path.includes("/housekeeper")) return "housekeeper";
  if (path.includes("/market-worker")) return "market_worker";
  if (path.includes("/tick")) return "tick";
  if (path.includes("/collect")) return "legacy_collect";
  return "unknown";
}

function pipelineModeLabel(mode: string) {
  const labels: Record<string, string> = {
    tick: "Tick",
    detail_worker: "Detail",
    deep_crawl: "Deep crawl",
    market_worker: "Market",
    pool_warmer: "Warmer",
    housekeeper: "Housekeeper",
    legacy_collect: "Legacy",
    unknown: "Unknown",
  };
  return labels[mode] ?? mode;
}

function workerPrimaryMetric(run: CollectRun | null) {
  if (!run) return { label: "최근 처리", value: "-" };
  const mode = pipelineMode(run);
  const stages = run.stageStats.stages as Record<string, unknown> | undefined;
  const market = stages?.market_stats && typeof stages.market_stats === "object"
    ? stages.market_stats as Record<string, unknown>
    : null;
  if (mode === "tick" || mode === "deep_crawl") return { label: "최근 검색", value: `${num(run.collectedCount)}건` };
  if (mode === "detail_worker") return { label: "최근 상세", value: `${num(run.enrichedCount)}건` };
  if (mode === "market_worker") return { label: "최근 시세키", value: `${num(stageValue(market, "upserted"))}개` };
  if (mode === "pool_warmer") return { label: "최근 검증", value: `${num(run.enrichedCount)}건` };
  if (mode === "housekeeper") return { label: "최근 정리", value: `${num(run.upsertedCount)}건` };
  return { label: "최근 저장", value: `${num(run.upsertedCount)}건` };
}

function workerSummary(runs: CollectRun[]) {
  const modes = ["tick", "detail_worker", "deep_crawl", "market_worker", "pool_warmer", "housekeeper"];
  return modes.map((mode) => {
    const scoped = runs.filter((run) => pipelineMode(run) === mode);
    const latest = scoped[0] ?? null;
    const lastSuccess = scoped.find((run) => run.status === "succeeded") ?? null;
    const lastFailure = scoped.find((run) => run.status === "failed") ?? null;
    const completed = scoped.filter((run) => run.durationMs != null);
    const avgDurationMs = completed.length === 0
      ? null
      : Math.round(completed.reduce((sum, run) => sum + Number(run.durationMs ?? 0), 0) / completed.length);
    return {
      mode,
      latest,
      lastSuccess,
      lastFailure,
      avgDurationMs,
      primary: workerPrimaryMetric(latest),
      failureCount: scoped.filter((run) => run.status === "failed").length,
      runCount: scoped.length,
    };
  });
}

function stageStats(run: CollectRun, stage: "search" | "detail" | "score") {
  const stages = run.stageStats.stages;
  if (!stages || typeof stages !== "object") return null;
  const value = (stages as Record<string, unknown>)[stage];
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function stageDuration(run: CollectRun, stage: "search" | "detail" | "score") {
  const durations = run.stageStats.stageDurationsMs;
  if (!durations || typeof durations !== "object") return null;
  const value = (durations as Record<string, unknown>)[stage];
  return typeof value === "number" ? value : null;
}

function stageValue(stats: Record<string, unknown> | null, key: string) {
  const value = stats?.[key];
  return typeof value === "number" ? value : 0;
}

function stageTimedOut(stats: Record<string, unknown> | null) {
  return stats?.timedOut === true;
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-950">{value}</div>
      {sub ? <div className="mt-1 text-xs text-zinc-500">{sub}</div> : null}
    </div>
  );
}

function StagePanel({ run }: { run: CollectRun }) {
  const rows = [
    {
      key: "search" as const,
      label: "검색",
      primary: "수집",
      primaryKey: "collected",
      secondary: "큐 적재",
      secondaryKey: "queued",
    },
    {
      key: "detail" as const,
      label: "상세",
      primary: "claim",
      primaryKey: "claimed",
      secondary: "enrich",
      secondaryKey: "enriched",
    },
    {
      key: "score" as const,
      label: "점수",
      primary: "계산",
      primaryKey: "scored",
      secondary: "저장",
      secondaryKey: "upserted",
    },
  ];

  if (!run.stageStats.stages) return null;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="text-sm font-semibold text-zinc-950">Stage 예산</div>
      <div className="mt-1 text-xs text-zinc-500">
        tick이 search/detail/score를 시간 예산 안에서 어디까지 처리했는지 봅니다.
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {rows.map((row) => {
          const stats = stageStats(run, row.key);
          const duration = stageDuration(run, row.key);
          return (
            <div key={row.key} className="rounded-md border border-zinc-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-zinc-950">{row.label}</div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                  stageTimedOut(stats)
                    ? "bg-amber-100 text-amber-800 ring-amber-200"
                    : "bg-emerald-100 text-emerald-800 ring-emerald-200"
                }`}>
                  {stageTimedOut(stats) ? "budget stop" : "완료"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MetricCard label={row.primary} value={`${num(stageValue(stats, row.primaryKey))}건`} />
                <MetricCard label={row.secondary} value={`${num(stageValue(stats, row.secondaryKey))}건`} />
              </div>
              <div className="mt-3 text-xs text-zinc-500">
                소요 {duration == null ? "-" : formatDuration(duration)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkerStatusPanel({ runs }: { runs: CollectRun[] }) {
  const summaries = workerSummary(runs);
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-950">Worker별 실행 상태</div>
          <div className="mt-1 text-xs text-zinc-500">
            tick/detail/market 등이 한 표에 섞여 보이는 문제를 분리해서 봅니다.
          </div>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
          최근 {num(runs.length)}회 기준
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {summaries.map((item) => {
          const latest = item.latest;
          const badgeClass = !latest
            ? "bg-zinc-100 text-zinc-600 ring-zinc-200"
            : latest.status === "failed"
              ? "bg-red-100 text-red-800 ring-red-200"
              : latest.status === "running"
                ? "bg-amber-100 text-amber-800 ring-amber-200"
                : "bg-emerald-100 text-emerald-800 ring-emerald-200";
          return (
            <div key={item.mode} className="rounded-md border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-950">{pipelineModeLabel(item.mode)}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {latest ? `최근 ${formatTime(latest.startedAt)}` : "최근 실행 없음"}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${badgeClass}`}>
                  {latest ? statusLabel(latest) : "없음"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MetricCard label={item.primary.label} value={item.primary.value} />
                <MetricCard label="평균 소요" value={item.avgDurationMs == null ? "-" : formatDuration(item.avgDurationMs)} />
              </div>
              <div className="mt-3 grid gap-1 text-xs text-zinc-500">
                <div>최근 성공: {item.lastSuccess ? formatTime(item.lastSuccess.startedAt) : "-"}</div>
                <div>최근 {item.runCount}회 중 실패: {num(item.failureCount)}회</div>
                <div className={item.lastFailure ? "text-red-700" : ""}>
                  최근 실패: {item.lastFailure ? `${formatTime(item.lastFailure.startedAt)} · ${shortText(item.lastFailure.errorMessage, 54)}` : "-"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlowBar({ run }: { run: CollectRun }) {
  const steps = [
    { label: "검색 수집", value: run.collectedCount, total: run.collectedCount },
    { label: "제목 룰 통과", value: run.titleNormalCount, total: run.collectedCount },
    { label: "상세 enrich", value: run.enrichedCount, total: run.titleNormalCount },
    { label: "점수 계산", value: run.scoredCount, total: Math.max(run.scoredCount, run.enrichedCount) },
    { label: "최종 upsert", value: run.upsertedCount, total: run.scoredCount },
  ];

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-950">최근 수집 흐름</div>
          <div className="text-xs text-zinc-500">{formatTime(run.startedAt)} 시작 · {durationLabel(run)}</div>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClass(run)}`}>
          {statusLabel(run)}
        </span>
      </div>
      <div className="mt-5 grid gap-3">
        {steps.map((step) => (
          <div key={step.label} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_90px] sm:items-center">
            <div className="text-sm font-medium text-zinc-700">{step.label}</div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-zinc-950"
                style={{ width: pct(step.value, Math.max(1, step.total)) }}
              />
            </div>
            <div className="text-sm text-zinc-600 sm:text-right">
              {num(step.value)}건
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiPanel({ run }: { run: CollectRun }) {
  const skippedByCondition = Math.max(0, run.scoredCount - run.aiReviewRequested);
  const aiHandled = run.aiCacheHits + run.aiApiCalls;
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="text-sm font-semibold text-zinc-950">OpenAI 검토</div>
      <div className="mt-1 text-xs text-zinc-500">
        룰로 충분한 후보는 AI 비용 없이 패스하고, 상위권 애매 후보만 확인합니다.
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard label="조건 패스" value={`${num(skippedByCondition)}건`} sub="AI 호출 없이 통과" />
        <MetricCard label="AI 검토 대상" value={`${num(run.aiReviewRequested)}건`} sub={`점수 계산 ${num(run.scoredCount)}건 중`} />
        <MetricCard label="실제 API 호출" value={`${num(run.aiApiCalls)}건`} sub={`캐시 ${num(run.aiCacheHits)}건`} />
        <MetricCard label="AI가 제외" value={`${num(run.aiFilteredCount)}건`} sub={`처리됨 ${num(aiHandled)}건 중`} />
      </div>
      {run.aiUnavailableCount > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          AI 검토 불가 {num(run.aiUnavailableCount)}건. Vercel `OPENAI_API_KEY` 또는 API timeout을 확인해야 합니다.
        </div>
      ) : null}
    </div>
  );
}

function MarketStatsPanel({ stats }: { stats: Awaited<ReturnType<typeof loadMarketPriceDebug>> }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="text-sm font-semibold text-zinc-950">시세 통계 품질</div>
      <div className="mt-1 text-xs text-zinc-500">
        후보팩은 comparable_key 시세가 medium/high인 매물만 통과시킵니다.
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="오늘 시세키" value={`${num(stats.total)}개`} sub={stats.date} />
        <MetricCard label="High" value={`${num(stats.high)}개`} sub="표본 20건+" />
        <MetricCard label="Medium" value={`${num(stats.medium)}개`} sub="표본 8건+" />
        <MetricCard label="Low" value={`${num(stats.low)}개`} sub={`총 표본 ${num(stats.totalSamples)}건`} />
      </div>
      <div className="mt-4 divide-y divide-zinc-100 rounded-md border border-zinc-100">
        {stats.top.map((row) => (
          <div key={row.comparable_key} className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_80px_80px_80px] sm:items-center">
            <div className="truncate font-mono text-zinc-700">{row.comparable_key}</div>
            <div className="text-zinc-500 sm:text-right">{num(row.active_sample_count)}건</div>
            <div className="font-semibold text-zinc-700 sm:text-right">{row.confidence}</div>
            <div className="text-zinc-700 sm:text-right">{num(Number(row.active_median_price ?? 0))}원</div>
          </div>
        ))}
        {stats.top.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-zinc-500">아직 오늘 시세 통계가 없습니다.</div>
        ) : null}
      </div>
    </div>
  );
}

function MarketInvalidationPanel({ stats }: { stats: Awaited<ReturnType<typeof loadMarketInvalidationDebug>> }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-950">시세 재계산 큐</div>
          <div className="mt-1 text-xs text-zinc-500">
            가격/제목/파서 변경으로 다시 계산해야 하는 comparable_key dedup set입니다.
          </div>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
          stats.failed > 0
            ? "bg-red-100 text-red-800 ring-red-200"
            : stats.pending > 0
              ? "bg-amber-100 text-amber-800 ring-amber-200"
              : "bg-emerald-100 text-emerald-800 ring-emerald-200"
        }`}>
          {stats.failed > 0 ? "확인 필요" : stats.pending > 0 ? "대기 있음" : "정상"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard label="Pending" value={`${num(stats.pending)}개`} sub="재계산 대기 key" />
        <MetricCard label="최근 완료" value={`${num(stats.recentlyClosed)}개`} sub="최근 30분 done" />
        <MetricCard label="Failed" value={`${num(stats.failed)}개`} sub={`전체 ${num(stats.total)}개 중`} />
        <MetricCard label="이벤트" value={`${num(stats.eventCount)}회`} sub="중복 key 병합 후 합산" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">Reason TOP</div>
          <div className="divide-y divide-zinc-100">
            {stats.topReasons.map((row) => (
              <div key={row.reason} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <div className="font-mono text-zinc-700">{row.reason}</div>
                <div className="font-semibold text-zinc-900">{num(row.count)}회</div>
              </div>
            ))}
            {stats.topReasons.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">아직 재계산 이벤트가 없습니다.</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">우선 처리 Pending</div>
          <div className="divide-y divide-zinc-100">
            {stats.pendingTop.map((row) => (
              <div key={row.comparable_key} className="px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate font-mono text-zinc-700">{row.comparable_key}</div>
                  <div className="shrink-0 font-semibold text-zinc-900">P{num(row.priority)}</div>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-zinc-500">
                  <span>{row.reason}</span>
                  <span>{formatTime(row.last_event_at)}</span>
                </div>
              </div>
            ))}
            {stats.pendingTop.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">대기 중인 key가 없습니다.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function sourceHealthClass(status: string) {
  if (status === "healthy") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (status === "degraded") return "bg-amber-100 text-amber-800 ring-amber-200";
  return "bg-red-100 text-red-800 ring-red-200";
}

function SourceHealthPanel({ health }: { health: Awaited<ReturnType<typeof loadSourceHealthDebug>> }) {
  const baseline = health?.baseline_json ?? {};
  const hysteresis = health?.hysteresis_json ?? {};
  const workerBreakdown = baseline.workerBreakdown && typeof baseline.workerBreakdown === "object" && !Array.isArray(baseline.workerBreakdown)
    ? Object.entries(baseline.workerBreakdown as Record<string, unknown>).map(([mode, raw]) => {
      const item = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
      return {
        mode,
        total: Number(item.total ?? 0),
        failed: Number(item.failed ?? 0),
        collected: Number(item.collected ?? 0),
        enriched: Number(item.enriched ?? 0),
      };
    }).sort((a, b) => b.total - a.total)
    : [];
  if (!health) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold text-zinc-950">소스 헬스 게이트</div>
        <div className="mt-2 text-sm text-zinc-500">
          아직 source health snapshot이 없습니다. `/api/cron/market-worker`가 한 번 돌면 표시됩니다.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-950">소스 헬스 게이트</div>
          <div className="mt-1 text-xs text-zinc-500">
            아직 상태 전이를 막지는 않고, API/worker를 믿어도 되는지 advisory로 기록합니다.
          </div>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${sourceHealthClass(health.status)}`}>
          {health.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard label="Detail 성공률" value={`${Math.round(Number(health.detail_success_rate) * 100)}%`} sub={`${health.window_minutes}분 window`} />
        <MetricCard label="검색 수집" value={`${num(Number(health.search_result_count))}건`} sub="최근 window 합산" />
        <MetricCard label="실행 수" value={`${num(Number(baseline.runCount ?? 0))}회`} sub={`실패 ${num(Number(baseline.failedRuns ?? 0))}회`} />
        <MetricCard label="Detail 시도" value={`${num(Number(baseline.detailAttempts ?? 0))}건`} sub={`실패 ${num(Number(baseline.detailFailed ?? 0))}건`} />
        <MetricCard
          label="검색 API"
          value={`${num(Number(baseline.searchSucceeded ?? 0))}/${num(Number(baseline.searchAttemptCount ?? 0))}`}
          sub={`실패 ${num(Number(baseline.searchFailed ?? 0))}건 · partial ${Math.round(Number(baseline.searchFailureRate ?? 0) * 100)}%`}
        />
      </div>

      {workerBreakdown.length > 0 ? (
        <div className="mt-4 rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
            Worker별 헬스 기여도
          </div>
          <div className="divide-y divide-zinc-100">
            {workerBreakdown.map((row) => (
              <div key={row.mode} className="grid grid-cols-[110px_1fr_70px] items-center gap-3 px-3 py-2 text-xs">
                <div className="font-semibold text-zinc-800">{pipelineModeLabel(row.mode)}</div>
                <div className="text-zinc-500">
                  실행 {num(row.total)}회 · 검색 {num(row.collected)}건 · 상세 {num(row.enriched)}건
                </div>
                <div className={row.failed > 0 ? "text-right font-semibold text-red-700" : "text-right font-semibold text-emerald-700"}>
                  실패 {num(row.failed)}
                </div>
              </div>
            ))}
          </div>
          {Number(baseline.ignoredInternalWorkerFailures ?? 0) > 0 ? (
            <div className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500">
              내부 worker 실패 {num(Number(baseline.ignoredInternalWorkerFailures ?? 0))}회는 source health 판정에서 제외됨
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 rounded-md border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-600">
        <div className="font-semibold text-zinc-800">판정 근거: {health.reason || "-"}</div>
        <div className="mt-1">
          이전 상태 {health.previous_status ?? "-"} · 확인 {formatTime(health.checked_at)}
        </div>
        <div className="mt-1">
          hysteresis: {String(hysteresis.note ?? "future gate")} · changed={String(hysteresis.changed ?? false)}
        </div>
      </div>
    </div>
  );
}

function labelReason(key: string) {
  const labels: Record<string, string> = {
    profit_below_band: "순익 구간 미달",
    not_scored_yet: "아직 점수 미계산",
    blocked_flag: "시세/AI/설명 플래그 차단",
    parsed_needs_review: "옵션 정보 부족",
    risk_hits: "위험 키워드",
    no_comparable_key: "시세키 없음",
    no_thumbnail: "이미지 없음",
    confidence_below_0_7: "신뢰도 0.7 미만",
    price_gte_median: "매물가가 시세 이상",
    profit_min_zero: "보수 순익 0",
    no_price_or_median: "가격/시세 없음",
  };
  return labels[key] ?? key;
}

function BottleneckPanel({ stats }: { stats: Awaited<ReturnType<typeof loadBottleneckDebug>> }) {
  const topReasons = stats.reasonRows.slice(0, 6);
  const topCritical = stats.criticalRows.slice(0, 6);
  const readyByBand = ["band3:ready", "band2:ready", "band1:ready"].map((key) => ({
    key,
    label: key.replace("band", "팩 ").replace(":ready", ""),
    count: stats.poolSummary[key] ?? 0,
  }));

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-950">후보팩 병목 진단</div>
          <div className="mt-1 text-xs text-zinc-500">
            최근 정상 상세 매물 500개가 후보팩까지 가는 길에서 어디서 막히는지 봅니다.
          </div>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
          구조 진단
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="표본" value={`${num(stats.sampleSize)}건`} sub="정상 상세 raw" />
        <MetricCard label="점수 계산됨" value={`${num(stats.scored)}건`} sub="mvp_listings 존재" />
        <MetricCard label="옵션 파싱됨" value={`${num(stats.parsed)}건`} sub="parsed row 존재" />
        <MetricCard label="후보팩 통과 가능" value={`${num(stats.pass)}건`} sub="시뮬레이션" />
        <MetricCard label="현재 ready pool" value={`${num(stats.readyPool)}건`} sub="사용자 공개 가능" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px_260px]">
        <div className="rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">탈락 이유 Top</div>
          <div className="divide-y divide-zinc-100">
            {topReasons.map((row) => (
              <div key={row.key} className="grid grid-cols-[150px_minmax(0,1fr)_64px] items-center gap-3 px-3 py-2 text-xs">
                <div className="font-medium text-zinc-700">{labelReason(row.key)}</div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-zinc-950"
                    style={{ width: pct(row.count, Math.max(1, stats.sampleSize)) }}
                  />
                </div>
                <div className="text-right font-mono text-zinc-600">{num(row.count)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">치명 옵션 누락</div>
          <div className="divide-y divide-zinc-100">
            {topCritical.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <div className="font-mono text-zinc-700">{row.key}</div>
                <div className="font-semibold text-zinc-900">{num(row.count)}건</div>
              </div>
            ))}
            {topCritical.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">치명 옵션 누락 없음</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">팩별 ready</div>
          <div className="divide-y divide-zinc-100">
            {readyByBand.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <div className="font-medium text-zinc-700">{row.label}</div>
                <div className="font-semibold text-zinc-900">{num(row.count)}건</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestPanel({ run }: { run: CollectRun }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-950">요청 출발 정보</div>
          <div className="mt-1 text-xs text-zinc-500">
            cron-job.org/Vercel 경유 여부를 확인하기 위한 운영 메타입니다.
          </div>
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
          {run.responseMode === "sync_wait" ? "동기 실행" : "백그라운드"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <div className="text-zinc-500">출발</div>
          <div className="font-medium text-zinc-950">{shortText(run.triggerSource, 88)}</div>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <div className="text-zinc-500">IP</div>
          <div className="font-mono text-xs text-zinc-800">{run.requestIp ?? "-"}</div>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <div className="text-zinc-500">Host</div>
          <div className="font-mono text-xs text-zinc-800">{run.requestHost ?? "-"}</div>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <div className="text-zinc-500">Path</div>
          <div className="font-mono text-xs text-zinc-800">{run.requestPath ?? "-"}</div>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <div className="text-zinc-500">Vercel</div>
          <div className="font-mono text-xs text-zinc-800">{shortText(run.requestVercelId, 80)}</div>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <div className="text-zinc-500">인증</div>
          <div className={run.authOk ? "text-emerald-700" : "text-red-700"}>
            {run.authOk ? "통과" : "실패"} · {run.authReason ?? "-"}
          </div>
        </div>
      </div>
    </div>
  );
}

function CronTimeoutAdvice({ run }: { run: CollectRun }) {
  if (!run.waitMode || run.status !== "running") return null;
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="font-semibold">cron-job.org 30초 timeout 가능성이 큽니다.</div>
      <div className="mt-1 text-amber-900">
        `wait=1` 전체 수집은 상세 enrich sleep만으로도 30초를 넘을 수 있어요. 디버깅 기간에는 아래처럼 가볍게 호출하는 게 안전합니다.
      </div>
      <code className="mt-3 block overflow-x-auto rounded-md bg-white px-3 py-2 text-xs text-zinc-900">
        /api/cron/collect?wait=1&amp;pages=1&amp;detailLimit=30&amp;aiTopN=0
      </code>
    </div>
  );
}

function RunsTable({ runs }: { runs: CollectRun[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 py-4">
        <div className="text-sm font-semibold text-zinc-950">최근 실행 내역</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold text-zinc-500">
            <tr>
              <th className="px-4 py-3">시각</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">작업</th>
              <th className="px-4 py-3">출발</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">모드</th>
              <th className="px-4 py-3">소요</th>
              <th className="px-4 py-3">검색</th>
              <th className="px-4 py-3">제목 통과</th>
              <th className="px-4 py-3">상세</th>
              <th className="px-4 py-3">AI 대상</th>
              <th className="px-4 py-3">API</th>
              <th className="px-4 py-3">캐시</th>
              <th className="px-4 py-3">AI 제외</th>
              <th className="px-4 py-3">저장</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {runs.map((run) => (
              <tr key={run.id} className="align-top">
                <td className="px-4 py-3 font-mono text-xs text-zinc-700">{formatTime(run.startedAt)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClass(run)}`}>
                    {statusLabel(run)}
                  </span>
                  {run.errorMessage ? <div className="mt-1 max-w-64 text-xs text-red-700">{run.errorMessage}</div> : null}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                    {pipelineModeLabel(pipelineMode(run))}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-56 text-xs text-zinc-700">{shortText(run.triggerSource, 48)}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">{run.requestIp ?? "-"}</td>
                <td className="px-4 py-3 text-xs text-zinc-700">
                  {run.responseMode === "sync_wait" ? "동기" : "백그라운드"}
                  {run.waitMode ? <div className="text-zinc-400">wait=1</div> : null}
                </td>
                <td className="px-4 py-3 text-zinc-700">{durationLabel(run)}</td>
                <td className="px-4 py-3">{num(run.collectedCount)}</td>
                <td className="px-4 py-3">{num(run.titleNormalCount)}</td>
                <td className="px-4 py-3">{num(run.enrichedCount)}</td>
                <td className="px-4 py-3">{num(run.aiReviewRequested)}</td>
                <td className="px-4 py-3">{num(run.aiApiCalls)}</td>
                <td className="px-4 py-3">{num(run.aiCacheHits)}</td>
                <td className="px-4 py-3">{num(run.aiFilteredCount)}</td>
                <td className="px-4 py-3 font-semibold">{num(run.upsertedCount)}</td>
              </tr>
            ))}
            {runs.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-4 py-10 text-center text-zinc-500">
                  아직 수집 실행 기록이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function DebugPage() {
  const [runs, marketStats, marketInvalidations, bottleneckStats, sourceHealth] = await Promise.all([
    loadCollectRuns(30),
    loadMarketPriceDebug(),
    loadMarketInvalidationDebug(),
    loadBottleneckDebug(),
    loadSourceHealthDebug(),
  ]);
  const latest = runs[0] ?? null;
  const latestOk = lastSucceeded(runs);
  const totalApiCalls = runs.reduce((sum, run) => sum + run.aiApiCalls, 0);
  const totalAiFiltered = runs.reduce((sum, run) => sum + run.aiFilteredCount, 0);

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">운영 로그</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              수집 파이프라인 상태
            </h1>
          </div>
          <Link
            href="/"
            className="w-fit rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
          >
            후보 화면으로
          </Link>
          <DebugAutoRefresh intervalSeconds={10} />
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="마지막 실행"
            value={latest ? formatTime(latest.startedAt) : "-"}
            sub={latest ? statusLabel(latest) : "기록 없음"}
          />
          <MetricCard
            label="마지막 성공"
            value={latestOk ? formatTime(latestOk.startedAt) : "-"}
            sub={latestOk ? `${num(latestOk.upsertedCount)}건 저장` : "성공 기록 없음"}
          />
          <MetricCard label="최근 AI API 호출" value={`${num(totalApiCalls)}건`} sub="최근 30회 합산" />
          <MetricCard label="AI 제외 누적" value={`${num(totalAiFiltered)}건`} sub="최근 30회 합산" />
        </section>

        {latest ? <CronTimeoutAdvice run={latest} /> : null}

        <WorkerStatusPanel runs={runs} />

        {latest ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px_420px]">
            <FlowBar run={latest} />
            <AiPanel run={latest} />
            <RequestPanel run={latest} />
          </section>
        ) : null}

        {latest ? <StagePanel run={latest} /> : null}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <BottleneckPanel stats={bottleneckStats} />
          <div className="grid gap-5">
            <SourceHealthPanel health={sourceHealth} />
            <MarketInvalidationPanel stats={marketInvalidations} />
            <MarketStatsPanel stats={marketStats} />
          </div>
        </section>

        <DebugResetPanel />

        <RunsTable runs={runs} />
      </div>
    </main>
  );
}
