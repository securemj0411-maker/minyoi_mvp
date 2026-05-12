import Link from "next/link";
import { redirect } from "next/navigation";
import { readFile } from "node:fs/promises";
import type { ReactNode } from "react";
import { DebugAdminGate } from "@/app/debug/debug-admin-gate";
import { DebugAutoRefresh } from "@/app/debug/debug-auto-refresh";
import { DebugResetPanel } from "@/app/debug/debug-reset-panel";
import {
  categoryFromComparableKey,
  categoryReadinessRows,
  evaluateCategoryReadiness,
  loadCategoryReadinessMap,
} from "@/lib/category-readiness";
import { loadCollectRuns, type CollectRun } from "@/lib/collect-logs";
import { getCronGuardSnapshot } from "@/lib/cron-guard";
import { requireDebugAdminFromCookies } from "@/lib/debug-admin";
import {
  bandFromProfit,
  computePoolConfidence,
  poolSkipReason,
} from "@/lib/pool-policy.mjs";
import { RESELL_SHIPPING_FEE, SAFETY_BUFFER, SELLING_FEE_RATE } from "@/lib/profit";
import type { Sku } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type DebugSearchParams = Record<string, string | string[] | undefined>;

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isDiagnosticsEnabled(params: DebugSearchParams) {
  const raw = firstSearchParam(params.diagnostics ?? params.full ?? params.heavy);
  return raw === "1" || raw === "true" || raw === "on";
}

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

function hoursLabel(value: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  const hours = Number(value);
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

function rate(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, part / total));
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

function withAdminGate(children: ReactNode) {
  return <DebugAdminGate>{children}</DebugAdminGate>;
}

type MarketPriceDebugRow = {
  comparable_key: string;
  active_sample_count: number;
  sold_sample_count: number;
  disappeared_sample_count: number;
  confidence: "high" | "medium" | "low";
  active_median_price: number | null;
  sold_median_price: number | null;
  blended_median_price: number | null;
};

type MarketVelocityDebugRow = {
  comparable_key: string;
  category: Sku["category"] | null;
  observed_sold_sample_count: number;
  active_sample_count: number;
  sold_24h_count: number;
  sold_7d_count: number;
  confidence: "high" | "medium" | "low";
  median_hours_to_sold: number | null;
  p25_hours_to_sold: number | null;
  p75_hours_to_sold: number | null;
  clock_basis: string;
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
  category: Sku["category"] | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
  parsed_json: Record<string, unknown> | null;
};

type PoolRow = {
  profit_band: 1 | 2 | 3;
  status: string;
  category: Sku["category"] | null;
  comparable_key: string | null;
};

type RevealFeedbackRow = {
  pid: number;
  feedback_type: "interested" | "bought" | "missed_sold" | "bad_pick" | "watching";
  note: string;
  updated_at: string;
};

type FeedbackRawRow = {
  pid: number;
  name: string;
  sku_name: string | null;
  price: number;
};

type FeedbackRevealRow = {
  pid: number;
  pack_open_id: number;
};

type FeedbackPackOpenRow = {
  id: number;
  band_requested: 1 | 2 | 3;
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

type ApprovalQueueReportRow = {
  category: string;
  key: string;
  kind: "sku" | "noise";
  id: string;
  modelName: string;
  brand: string;
  runtimeCategory: string;
  approved: boolean;
  rejected: boolean;
  status: "approved" | "pending" | "rejected";
  riskFlags: string[];
  aliasCount: number;
  sourceClusterIds: number[];
  note: string;
};

type ApprovalQueueSummary = {
  category: string;
  updatedAt: string | null;
  approved: number;
  pending: number;
  rejected: number;
  total: number;
  rows: ApprovalQueueReportRow[];
};

type ApprovalQueueReport = {
  generatedAt: string;
  totals: {
    approved: number;
    pending: number;
    rejected: number;
    total: number;
  };
  queues: ApprovalQueueSummary[];
};

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
  const url = `${base}/mvp_market_price_daily?select=comparable_key,active_sample_count,sold_sample_count,disappeared_sample_count,confidence,active_median_price,sold_median_price,blended_median_price&date=eq.${today}&order=active_sample_count.desc&limit=1000`;
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
    totalSamples: rows.reduce((sum, row) => (
      sum +
      Number(row.active_sample_count ?? 0) +
      Number(row.sold_sample_count ?? 0) +
      Number(row.disappeared_sample_count ?? 0)
    ), 0),
    top: rows.slice(0, 5),
  };
}

async function loadMarketVelocityDebug() {
  const today = kstDateString();
  const rows = await restJson<MarketVelocityDebugRow[]>(
    `/mvp_market_velocity_daily?select=comparable_key,category,observed_sold_sample_count,active_sample_count,sold_24h_count,sold_7d_count,confidence,median_hours_to_sold,p25_hours_to_sold,p75_hours_to_sold,clock_basis&date=eq.${today}&confidence=in.(high,medium)&order=observed_sold_sample_count.desc&limit=24`,
    [],
  );
  return {
    date: today,
    total: rows.length,
    high: rows.filter((row) => row.confidence === "high").length,
    medium: rows.filter((row) => row.confidence === "medium").length,
    observedSoldSamples: rows.reduce((sum, row) => sum + Number(row.observed_sold_sample_count ?? 0), 0),
    activeSamples: rows.reduce((sum, row) => sum + Number(row.active_sample_count ?? 0), 0),
    top: rows.slice(0, 8),
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

async function loadApprovalQueueDebug() {
  try {
    const raw = await readFile(`${process.cwd()}/reports/approval-queues-latest.json`, "utf-8");
    const report = JSON.parse(raw) as ApprovalQueueReport;
    const pendingRows = report.queues
      .flatMap((queue) => queue.rows.filter((row) => row.status === "pending"))
      .sort((a, b) => (b.riskFlags.length - a.riskFlags.length) || a.category.localeCompare(b.category, "ko"))
      .slice(0, 12);
    const riskRows = pendingRows.filter((row) => row.riskFlags.length > 0);
    return {
      ok: true,
      generatedAt: report.generatedAt,
      totals: report.totals,
      queues: report.queues,
      pendingRows,
      riskRows,
    };
  } catch {
    return {
      ok: false,
      generatedAt: null,
      totals: { approved: 0, pending: 0, rejected: 0, total: 0 },
      queues: [] as ApprovalQueueSummary[],
      pendingRows: [] as ApprovalQueueReportRow[],
      riskRows: [] as ApprovalQueueReportRow[],
    };
  }
}

async function loadBottleneckDebug() {
  const readinessMap = await loadCategoryReadinessMap();
  const rawRows = await restJson<BottleneckRawRow[]>(
    "/mvp_raw_listings?select=pid,name,price,sku_name,thumbnail_url&detail_status=eq.done&listing_type=eq.normal&sku_id=not.is.null&order=last_seen_at.desc&limit=500",
    [],
  );
  const pids = rawRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  const [listingRows, analysisRows, parsedRows, poolRows] = await Promise.all([
    loadPidChunked<BottleneckListingRow>(pids, (ids) => `/mvp_listings?select=pid,price,sku_median,shipping_fee,shipping_fee_general,estimated_buy_cost,thumbnail_url,name,sku_name&pid=in.(${ids})`),
    loadPidChunked<BottleneckAnalysisRow>(pids, (ids) => `/mvp_listing_analysis?select=pid,risk_hits,score_flags&pid=in.(${ids})`),
    loadPidChunked<BottleneckParsedRow>(pids, (ids) => `/mvp_listing_parsed?select=pid,category,comparable_key,parse_confidence,needs_review,parsed_json&pid=in.(${ids})`),
    restJson<PoolRow[]>("/mvp_candidate_pool?select=profit_band,status,category,comparable_key&limit=5000", []),
  ]);

  const listingMap = mapRows(listingRows);
  const analysisMap = mapRows(analysisRows);
  const parsedMap = mapRows(parsedRows);
  const reasons = new Map<string, number>();
  const criticalUnknown = new Map<string, number>();
  const categoryRows = new Map<string, { category: string; status: string; raw: number; pass: number; readyPool: number }>();
  let pass = 0;
  let mediumOrHighReady = 0;

  for (const row of poolRows) {
    if (row.status === "ready") mediumOrHighReady += 1;
    const poolCategory = row.category ?? categoryFromComparableKey(row.comparable_key);
    const readiness = evaluateCategoryReadiness(poolCategory, readinessMap);
    const categoryKey = poolCategory ?? "unknown";
    const current = categoryRows.get(categoryKey) ?? {
      category: categoryKey,
      status: readiness.status,
      raw: 0,
      pass: 0,
      readyPool: 0,
    };
    if (row.status === "ready") current.readyPool += 1;
    categoryRows.set(categoryKey, current);
  }

  for (const raw of rawRows) {
    const listing = listingMap.get(raw.pid);
    const analysis = analysisMap.get(raw.pid);
    const parsed = parsedMap.get(raw.pid);
    const flags = Array.isArray(analysis?.score_flags) ? analysis.score_flags : [];
    const parsedJson = parsed?.parsed_json ?? {};
    const readiness = evaluateCategoryReadiness(parsed?.category ?? null, readinessMap);
    const categoryKey = parsed?.category ?? "unknown";
    const categoryStat = categoryRows.get(categoryKey) ?? {
      category: categoryKey,
      status: readiness.status,
      raw: 0,
      pass: 0,
      readyPool: 0,
    };
    categoryStat.raw += 1;
    categoryRows.set(categoryKey, categoryStat);
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
    const confidence = computePoolConfidence(parsed?.parse_confidence, flags);
    const skipReason = poolSkipReason({
      profitMin,
      price,
      skuMedian,
      riskHits: Number(analysis?.risk_hits ?? 0),
      thumbnailUrl: listing.thumbnail_url ?? raw.thumbnail_url,
      categoryCanEnterPool: readiness.canEnterPool,
      categoryReason: readiness.reason,
      comparableKey: parsed?.comparable_key,
      needsReview: Boolean(parsed?.needs_review),
      confidence,
      scoreFlags: flags,
    });

    if (band === null) increment(reasons, "profit_below_band");
    else if (skipReason) increment(reasons, skipReason);
    else {
      pass += 1;
      categoryStat.pass += 1;
    }
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
    readinessRows: categoryReadinessRows(readinessMap),
    categoryRows: [...categoryRows.values()].sort((a, b) => b.raw - a.raw),
  };
}

async function loadFeedbackDebug() {
  const rows = await restJson<RevealFeedbackRow[]>(
    "/mvp_reveal_feedback?select=pid,feedback_type,note,updated_at&order=updated_at.desc&limit=500",
    [],
  );
  const pids = [...new Set(rows.map((row) => Number(row.pid)).filter(Number.isFinite))];
  const [rawRows, parsedRows, revealRows] = await Promise.all([
    loadPidChunked<FeedbackRawRow>(pids, (ids) => `/mvp_raw_listings?select=pid,name,sku_name,price&pid=in.(${ids})`),
    loadPidChunked<BottleneckParsedRow>(pids, (ids) => `/mvp_listing_parsed?select=pid,category,comparable_key,parse_confidence,needs_review,parsed_json&pid=in.(${ids})`),
    loadPidChunked<FeedbackRevealRow>(pids, (ids) => `/mvp_pack_reveals?select=pid,pack_open_id&pid=in.(${ids})`),
  ]);
  const packOpenIds = [...new Set(revealRows.map((row) => Number(row.pack_open_id)).filter(Number.isFinite))];
  const packOpenRows = await restJson<FeedbackPackOpenRow[]>(
    packOpenIds.length > 0
      ? `/mvp_pack_opens?select=id,band_requested&id=in.(${packOpenIds.join(",")})`
      : "/mvp_pack_opens?select=id,band_requested&limit=0",
    [],
  );
  const rawMap = mapRows(rawRows);
  const parsedMap = mapRows(parsedRows);
  const revealOpenByPid = new Map<number, number>();
  for (const row of revealRows) {
    if (!revealOpenByPid.has(row.pid)) revealOpenByPid.set(row.pid, row.pack_open_id);
  }
  const bandByOpenId = new Map(packOpenRows.map((row) => [Number(row.id), row.band_requested]));
  const counts = new Map<string, number>();
  const categoryCounts = new Map<string, { category: string; total: number; bought: number; missedSold: number; badPick: number; interested: number }>();
  const skuCounts = new Map<string, { skuName: string; category: string; total: number; bought: number; missedSold: number; badPick: number; interested: number }>();
  const bandCounts = new Map<number, { band: number; total: number; bought: number; missedSold: number; badPick: number; interested: number; watching: number }>();
  const pidCounts = new Map<number, { pid: number; name: string; skuName: string; category: string; badPick: number; missedSold: number; total: number; lastFeedbackAt: string }>();
  const termCounts = new Map<string, number>();
  const flagged = new Map<number, {
    pid: number;
    name: string;
    skuName: string;
    category: string;
    feedbackType: string;
    note: string;
    updatedAt: string;
  }>();
  const noted = new Map<number, {
    pid: number;
    name: string;
    skuName: string;
    category: string;
    feedbackType: string;
    note: string;
    updatedAt: string;
  }>();
  const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
  let recent24h = 0;
  const stopTerms = new Set(["이건", "너무", "그냥", "같음", "아님", "후보", "가격", "매물", "상세", "비교", "사진상"]);

  for (const row of rows) {
    const type = row.feedback_type;
    increment(counts, type);
    if (Date.parse(row.updated_at) >= recentCutoff) recent24h += 1;
    const raw = rawMap.get(row.pid);
    const parsed = parsedMap.get(row.pid);
    const category = parsed?.category ?? categoryFromComparableKey(parsed?.comparable_key) ?? "unknown";
    const skuName = raw?.sku_name ?? "-";
    const current = categoryCounts.get(category) ?? {
      category,
      total: 0,
      bought: 0,
      missedSold: 0,
      badPick: 0,
      interested: 0,
    };
    current.total += 1;
    if (type === "bought") current.bought += 1;
    if (type === "missed_sold") current.missedSold += 1;
    if (type === "bad_pick") current.badPick += 1;
    if (type === "interested") current.interested += 1;
    categoryCounts.set(category, current);

    const skuKey = `${category}:${skuName}`;
    const sku = skuCounts.get(skuKey) ?? {
      skuName,
      category,
      total: 0,
      bought: 0,
      missedSold: 0,
      badPick: 0,
      interested: 0,
    };
    sku.total += 1;
    if (type === "bought") sku.bought += 1;
    if (type === "missed_sold") sku.missedSold += 1;
    if (type === "bad_pick") sku.badPick += 1;
    if (type === "interested") sku.interested += 1;
    skuCounts.set(skuKey, sku);

    const band = bandByOpenId.get(revealOpenByPid.get(row.pid) ?? 0);
    if (band) {
      const bandRow = bandCounts.get(band) ?? {
        band,
        total: 0,
        bought: 0,
        missedSold: 0,
        badPick: 0,
        interested: 0,
        watching: 0,
      };
      bandRow.total += 1;
      if (type === "bought") bandRow.bought += 1;
      if (type === "missed_sold") bandRow.missedSold += 1;
      if (type === "bad_pick") bandRow.badPick += 1;
      if (type === "interested") bandRow.interested += 1;
      if (type === "watching") bandRow.watching += 1;
      bandCounts.set(band, bandRow);
    }

    if (type === "missed_sold" || type === "bad_pick") {
      const pidRow = pidCounts.get(row.pid) ?? {
        pid: row.pid,
        name: raw?.name ?? `pid ${row.pid}`,
        skuName,
        category,
        badPick: 0,
        missedSold: 0,
        total: 0,
        lastFeedbackAt: row.updated_at,
      };
      pidRow.total += 1;
      if (type === "missed_sold") pidRow.missedSold += 1;
      if (type === "bad_pick") pidRow.badPick += 1;
      if (Date.parse(row.updated_at) > Date.parse(pidRow.lastFeedbackAt)) pidRow.lastFeedbackAt = row.updated_at;
      pidCounts.set(row.pid, pidRow);
    }

    const note = row.note?.trim() ?? "";
    if (note) {
      for (const match of note.matchAll(/\[([^\]]{1,24})\]/g)) {
        increment(termCounts, match[1]);
      }
      const plain = note.replace(/\[[^\]]+\]/g, " ");
      for (const token of plain.split(/[\s,./|·:;!?()]+/).map((item) => item.trim()).filter(Boolean)) {
        if (token.length < 2 || stopTerms.has(token)) continue;
        increment(termCounts, token);
      }
    }

    if (type === "missed_sold" || type === "bad_pick") {
      flagged.set(row.pid, {
        pid: row.pid,
        name: raw?.name ?? `pid ${row.pid}`,
        skuName,
        category,
        feedbackType: type,
        note: row.note ?? "",
        updatedAt: row.updated_at,
      });
    }
    if (row.note?.trim()) {
      noted.set(row.pid, {
        pid: row.pid,
        name: raw?.name ?? `pid ${row.pid}`,
        skuName,
        category,
        feedbackType: type,
        note: row.note.trim(),
        updatedAt: row.updated_at,
      });
    }
  }

  return {
    total: rows.length,
    recent24h,
    counts: {
      interested: counts.get("interested") ?? 0,
      bought: counts.get("bought") ?? 0,
      missedSold: counts.get("missed_sold") ?? 0,
      badPick: counts.get("bad_pick") ?? 0,
      watching: counts.get("watching") ?? 0,
    },
    categoryRows: [...categoryCounts.values()].sort((a, b) => b.total - a.total),
    skuRows: [...skuCounts.values()]
      .map((row) => ({
        ...row,
        issueRate: rate(row.badPick + row.missedSold, row.total),
      }))
      .sort((a, b) => (b.issueRate - a.issueRate) || (b.total - a.total))
      .slice(0, 8),
    bandRows: [...bandCounts.values()]
      .map((row) => ({
        ...row,
        positive: row.bought + row.interested,
        negative: row.badPick + row.missedSold,
        satisfactionRate: rate(row.bought + row.interested, row.total),
        issueRate: rate(row.badPick + row.missedSold, row.total),
      }))
      .sort((a, b) => a.band - b.band),
    topProblemRows: [...pidCounts.values()]
      .sort((a, b) => (b.badPick + b.missedSold) - (a.badPick + a.missedSold) || Date.parse(b.lastFeedbackAt) - Date.parse(a.lastFeedbackAt))
      .slice(0, 8),
    termRows: [...termCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([term, count]) => ({ term, count })),
    flaggedRows: [...flagged.values()]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 8),
    notedRows: [...noted.values()]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 8),
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
  if (path.includes("/lifecycle-worker") && (path.includes("terminal-recheck") || path.includes("terminal_recheck"))) return "lifecycle_terminal_recheck";
  if (path.includes("/lifecycle-worker")) return "lifecycle_worker";
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
    lifecycle_worker: "Lifecycle",
    lifecycle_terminal_recheck: "Lifecycle terminal",
    market_worker: "Market",
    pool_warmer: "Warmer",
    housekeeper: "Housekeeper",
    legacy_collect: "Legacy",
    unknown: "Unknown",
  };
  return labels[mode] ?? mode;
}

function cronGuardReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    cooldown: "쿨다운",
    same_worker_running: "동일 worker 실행 중",
    source_health_unhealthy: "소스 헬스 unhealthy",
  };
  return labels[reason] ?? reason;
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
  if (mode === "lifecycle_worker" || mode === "lifecycle_terminal_recheck") {
    const lifecycle = stages?.detail && typeof stages.detail === "object" ? stages.detail as Record<string, unknown> : null;
    return { label: "최근 상태확인", value: `${num(stageValue(lifecycle, "claimed"))}건` };
  }
  if (mode === "market_worker") return { label: "최근 시세키", value: `${num(stageValue(market, "upserted"))}개` };
  if (mode === "pool_warmer") return { label: "최근 검증", value: `${num(run.enrichedCount)}건` };
  if (mode === "housekeeper") return { label: "최근 정리", value: `${num(run.upsertedCount)}건` };
  return { label: "최근 저장", value: `${num(run.upsertedCount)}건` };
}

function workerSummary(runs: CollectRun[]) {
  const modes = ["tick", "detail_worker", "deep_crawl", "lifecycle_worker", "lifecycle_terminal_recheck", "market_worker", "pool_warmer", "housekeeper"];
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

function workerAlerts(runs: CollectRun[]) {
  return workerSummary(runs)
    .map((item) => {
      const failureRate = item.runCount === 0 ? 0 : item.failureCount / item.runCount;
      const severity = item.runCount >= 3 && failureRate >= 0.2
        ? "critical"
        : item.runCount >= 3 && failureRate >= 0.05
          ? "warning"
          : null;
      if (!severity) return null;
      return {
        mode: item.mode,
        label: pipelineModeLabel(item.mode),
        severity: severity as "critical" | "warning",
        failureRate,
        runCount: item.runCount,
        failureCount: item.failureCount,
        lastFailure: item.lastFailure,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1 };
      return severityOrder[a.severity] - severityOrder[b.severity] || b.failureRate - a.failureRate;
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

function CronGuardPanel({ snapshot }: { snapshot: ReturnType<typeof getCronGuardSnapshot> }) {
  const topSkip = snapshot.skipCounters[0] ?? null;
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-950">Cron Guard Skip</div>
          <div className="mt-1 text-xs text-zinc-500">
            skip은 실패가 아니라 보호 동작입니다. DB에 매번 쓰지 않고 현재 프로세스 메모리 기준 최근 1시간만 보여줍니다.
          </div>
        </div>
        <span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
          snapshot.totalSkipsLastHour > 0
            ? "bg-sky-100 text-sky-800 ring-sky-200"
            : "bg-zinc-100 text-zinc-700 ring-zinc-200"
        }`}>
          {snapshot.totalSkipsLastHour > 0 ? `의도적 휴식 ${num(snapshot.totalSkipsLastHour)}건` : "skip 없음"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="최근 1시간 skip" value={`${num(snapshot.totalSkipsLastHour)}건`} sub="실패율에 포함하지 않음" />
        <MetricCard label="실행 중 lock" value={`${num(snapshot.running.length)}개`} sub="같은 worker 중복 방지" />
        <MetricCard
          label="최다 skip 사유"
          value={topSkip ? cronGuardReasonLabel(topSkip.reason) : "-"}
          sub={topSkip ? `${pipelineModeLabel(topSkip.mode)} · ${num(topSkip.count)}건` : "최근 skip 없음"}
        />
        <MetricCard
          label="최근 skip"
          value={snapshot.recentSkips[0] ? pipelineModeLabel(snapshot.recentSkips[0].mode) : "-"}
          sub={snapshot.recentSkips[0] ? `${cronGuardReasonLabel(snapshot.recentSkips[0].reason)} · ${formatTime(snapshot.recentSkips[0].ts)}` : "최근 skip 없음"}
        />
      </div>

      {snapshot.skipCounters.length > 0 ? (
        <div className="mt-4 rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
            Skip reason별 집계
          </div>
          <div className="divide-y divide-zinc-100">
            {snapshot.skipCounters.slice(0, 8).map((row) => (
              <div key={`${row.mode}:${row.reason}:${row.hourBucket}`} className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[120px_140px_minmax(0,1fr)_70px] sm:items-center">
                <div className="font-semibold text-zinc-800">{pipelineModeLabel(row.mode)}</div>
                <div className="text-zinc-600">{cronGuardReasonLabel(row.reason)}</div>
                <div className="text-zinc-500">
                  {formatTime(row.hourBucket)} bucket · 최근 갱신 {formatTime(row.updatedAt)}
                </div>
                <div className="font-semibold text-sky-800 sm:text-right">{num(row.count)}건</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-600">
          최근 1시간 동안 guard skip은 없습니다.
        </div>
      )}

      {snapshot.running.length > 0 ? (
        <div className="mt-4 rounded-md border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-600">
          <div className="font-semibold text-zinc-800">현재 실행 중 lock</div>
          <div className="mt-2 grid gap-1">
            {snapshot.running.map((row) => (
              <div key={row.mode}>
                {pipelineModeLabel(row.mode)} · 시작 {formatTime(row.startedAt)} · lease {formatTime(row.leaseUntil)}까지
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkerAlertPanel({ runs }: { runs: CollectRun[] }) {
  const alerts = workerAlerts(runs);
  return (
    <div className={`rounded-md border p-5 ${
      alerts.some((alert) => alert.severity === "critical")
        ? "border-red-200 bg-red-50"
        : alerts.length > 0
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-200 bg-emerald-50"
    }`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-950">운영 알림</div>
          <div className="mt-1 text-xs text-zinc-600">
            worker별 실패율이 최근 실행 window에서 5% 이상이면 경고, 20% 이상이면 긴급으로 봅니다. Guard skip은 아래 패널에서 별도로 봅니다.
          </div>
        </div>
        <span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
          alerts.some((alert) => alert.severity === "critical")
            ? "bg-red-100 text-red-800 ring-red-200"
            : alerts.length > 0
              ? "bg-amber-100 text-amber-800 ring-amber-200"
              : "bg-emerald-100 text-emerald-800 ring-emerald-200"
        }`}>
          {alerts.length === 0 ? "정상" : `${num(alerts.length)}개 알림`}
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="mt-4 rounded-md border border-emerald-100 bg-white/60 p-3 text-sm text-emerald-800">
          최근 worker 실패율 기준으로 즉시 조치할 알림은 없습니다.
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          {alerts.map((alert) => (
            <div key={alert.mode} className="grid gap-2 rounded-md border border-white/70 bg-white/70 p-3 text-sm sm:grid-cols-[110px_minmax(0,1fr)_110px] sm:items-center">
              <div className={alert.severity === "critical" ? "font-semibold text-red-800" : "font-semibold text-amber-800"}>
                {alert.severity === "critical" ? "긴급" : "경고"} · {alert.label}
              </div>
              <div className="text-zinc-700">
                최근 {num(alert.runCount)}회 중 실패 {num(alert.failureCount)}회 · 실패율 {Math.round(alert.failureRate * 100)}%
                {alert.lastFailure?.errorMessage ? ` · ${shortText(alert.lastFailure.errorMessage, 72)}` : ""}
              </div>
              <div className="text-xs text-zinc-500 sm:text-right">
                {alert.lastFailure ? formatTime(alert.lastFailure.startedAt) : "-"}
              </div>
            </div>
          ))}
        </div>
      )}
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
            <div className="text-zinc-500 sm:text-right">
              A{num(row.active_sample_count)} / S{num(row.sold_sample_count)} / D{num(row.disappeared_sample_count)}
            </div>
            <div className="font-semibold text-zinc-700 sm:text-right">{row.confidence}</div>
            <div className="text-zinc-700 sm:text-right">{num(Number(row.blended_median_price ?? row.active_median_price ?? 0))}원</div>
          </div>
        ))}
        {stats.top.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-zinc-500">아직 오늘 시세 통계가 없습니다.</div>
        ) : null}
      </div>
    </div>
  );
}

function MarketVelocityPanel({ stats }: { stats: Awaited<ReturnType<typeof loadMarketVelocityDebug>> }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-950">관측 판매속도</div>
          <div className="mt-1 text-xs text-zinc-500">
            이미 계산된 daily high/medium summary만 읽습니다. raw 재집계는 하지 않습니다.
          </div>
        </div>
        <span className="w-fit rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          {stats.date}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="High" value={`${num(stats.high)}개`} sub="판매속도 표본 충분" />
        <MetricCard label="Medium" value={`${num(stats.medium)}개`} sub="관찰용 공개 가능" />
        <MetricCard label="판매 관측" value={`${num(stats.observedSoldSamples)}건`} sub="sold/disappeared sample" />
        <MetricCard label="활성 표본" value={`${num(stats.activeSamples)}건`} sub={`상위 ${num(stats.total)}개 key`} />
      </div>
      <div className="mt-4 divide-y divide-zinc-100 rounded-md border border-zinc-100">
        {stats.top.map((row) => (
          <div key={row.comparable_key} className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_76px_94px_86px_86px] sm:items-center">
            <div className="min-w-0">
              <div className="truncate font-mono text-zinc-700">{row.comparable_key}</div>
              <div className="mt-0.5 text-[10px] text-zinc-400">{row.category ?? "-"} · {row.clock_basis}</div>
            </div>
            <div className="font-semibold text-zinc-700 sm:text-right">{row.confidence}</div>
            <div className="text-zinc-500 sm:text-right">
              S{num(row.observed_sold_sample_count)} / A{num(row.active_sample_count)}
            </div>
            <div className="text-zinc-500 sm:text-right">7d {num(row.sold_7d_count)}</div>
            <div className="font-semibold text-zinc-800 sm:text-right">{hoursLabel(row.median_hours_to_sold)}</div>
          </div>
        ))}
        {stats.top.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-zinc-500">
            아직 오늘 판매속도 summary가 없습니다.
          </div>
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
        <div className="mt-1">
          proposed {String(hysteresis.proposedStatus ?? baseline.proposedStatus ?? "-")} → effective {health.status}
          {hysteresis.gateDecision ? ` · ${String(hysteresis.gateDecision)}` : ""}
        </div>
      </div>
    </div>
  );
}

function labelReason(key: string) {
  const labels: Record<string, string> = {
    profit_below_band: "순익 구간 미달",
    not_scored_yet: "아직 점수 미계산",
    pool_confidence_low: "신뢰도 0.7 미만",
    profit_not_positive: "보수 순익 0",
    price_gte_market: "매물가가 시세 이상",
    risk_keyword: "위험 키워드",
    missing_thumbnail: "이미지 없음",
    missing_comparable_key: "시세키 없음",
    option_needs_review: "옵션 정보 부족",
    no_price_or_median: "가격/시세 없음",
    category_unknown: "카테고리 미확정",
    category_internal_only_smartphone: "스마트폰 내부 학습 전용",
    category_internal_only_tablet: "태블릿 내부 학습 전용",
    category_internal_only_laptop: "랩탑 내부 학습 전용",
    category_blocked_small_appliance: "소형가전 보류",
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

      <div className="mt-4 rounded-md border border-zinc-100">
        <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
          카테고리 readiness gate
        </div>
        <div className="grid gap-0 divide-y divide-zinc-100 md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="divide-y divide-zinc-100">
            {stats.readinessRows.map((row) => (
              <div key={row.category} className="grid grid-cols-[120px_92px_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-xs">
                <div className="font-semibold text-zinc-800">{row.label}</div>
                <div className={
                  row.status === "ready"
                    ? "w-fit rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800"
                    : row.status === "internal_only"
                      ? "w-fit rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800"
                      : "w-fit rounded-full bg-zinc-100 px-2 py-1 font-semibold text-zinc-600"
                }>
                  {row.status}
                </div>
                <div className="truncate text-zinc-500">{row.note}</div>
              </div>
            ))}
          </div>
          <div className="divide-y divide-zinc-100">
            {stats.categoryRows.slice(0, 8).map((row) => (
              <div key={row.category} className="grid grid-cols-[110px_92px_repeat(3,1fr)] items-center gap-2 px-3 py-2 text-xs">
                <div className="font-mono text-zinc-700">{row.category}</div>
                <div className="text-zinc-500">{row.status}</div>
                <div><span className="text-zinc-400">raw</span> {num(row.raw)}</div>
                <div><span className="text-zinc-400">pass</span> {num(row.pass)}</div>
                <div><span className="text-zinc-400">pool</span> {num(row.readyPool)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function feedbackLabel(type: string) {
  const labels: Record<string, string> = {
    interested: "관심",
    bought: "매수함",
    missed_sold: "이미 팔림",
    bad_pick: "별로",
    watching: "관찰",
  };
  return labels[type] ?? type;
}

function FeedbackPanel({ stats }: { stats: Awaited<ReturnType<typeof loadFeedbackDebug>> }) {
  const negative = stats.counts.missedSold + stats.counts.badPick;
  const positive = stats.counts.bought + stats.counts.interested;
  const categoryRows = stats.categoryRows.slice(0, 6);

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-950">Reveal 피드백</div>
          <div className="mt-1 text-xs text-zinc-500">
            후보 공개 후 사용자가 남긴 실제 반응입니다. false positive와 sold race를 찾는 신호로 씁니다.
          </div>
        </div>
        <span className="w-fit rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          user ROI loop
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="전체 피드백" value={`${num(stats.total)}건`} sub={`최근 24h ${num(stats.recent24h)}건`} />
        <MetricCard label="긍정 신호" value={`${num(positive)}건`} sub={`관심 ${num(stats.counts.interested)} · 매수 ${num(stats.counts.bought)}`} />
        <MetricCard label="부정 신호" value={`${num(negative)}건`} sub={`팔림 ${num(stats.counts.missedSold)} · 별로 ${num(stats.counts.badPick)}`} />
        <MetricCard label="이미 팔림" value={`${num(stats.counts.missedSold)}건`} sub="live verify 이후 race 후보" />
        <MetricCard label="별로" value={`${num(stats.counts.badPick)}건`} sub="시세/옵션/노이즈 오탐" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
            후보팩 band별 만족도
          </div>
          <div className="divide-y divide-zinc-100">
            {stats.bandRows.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">아직 band 피드백 없음</div>
            ) : stats.bandRows.map((row) => (
              <div key={row.band} className="grid grid-cols-[70px_repeat(4,1fr)] items-center gap-2 px-3 py-2 text-xs">
                <div className="font-black text-zinc-800">Band {row.band}</div>
                <div><span className="text-zinc-400">총</span> {num(row.total)}</div>
                <div><span className="text-zinc-400">만족</span> {pct(row.positive, row.total)}</div>
                <div><span className="text-zinc-400">문제</span> {pct(row.negative, row.total)}</div>
                <div className="text-zinc-500">매수 {num(row.bought)} · 팔림 {num(row.missedSold)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
            코멘트 자주 나온 말
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            {stats.termRows.length === 0 ? (
              <div className="w-full py-4 text-center text-xs text-zinc-500">아직 태그/키워드 없음</div>
            ) : stats.termRows.map((row) => (
              <span key={row.term} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                {row.term} <span className="text-zinc-400">{num(row.count)}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
            SKU별 오탐률
          </div>
          <div className="divide-y divide-zinc-100">
            {stats.skuRows.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">아직 SKU 피드백 없음</div>
            ) : stats.skuRows.map((row) => (
              <div key={`${row.category}-${row.skuName}`} className="grid grid-cols-[minmax(0,1fr)_60px_70px] items-center gap-3 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-zinc-800">{row.skuName}</div>
                  <div className="font-mono text-[10px] text-zinc-400">{row.category} · 총 {num(row.total)} · 팔림 {num(row.missedSold)} · 별로 {num(row.badPick)}</div>
                </div>
                <div className="text-right font-black text-red-600">{pct(row.badPick + row.missedSold, row.total)}</div>
                <div className="text-right text-zinc-400">오탐률</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
            별로/이미 팔림 상위 후보
          </div>
          <div className="divide-y divide-zinc-100">
            {stats.topProblemRows.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">문제 후보 없음</div>
            ) : stats.topProblemRows.map((row) => (
              <div key={row.pid} className="grid grid-cols-[minmax(0,1fr)_92px] gap-3 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-800">{row.name}</div>
                  <div className="truncate font-mono text-[10px] text-zinc-400">{row.category} · {row.skuName}</div>
                </div>
                <div className="text-right text-zinc-500">
                  <div className="font-semibold text-red-700">별로 {num(row.badPick)}</div>
                  <div className="font-semibold text-amber-700">팔림 {num(row.missedSold)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
            카테고리별 반응
          </div>
          <div className="divide-y divide-zinc-100">
            {categoryRows.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">아직 피드백 없음</div>
            ) : categoryRows.map((row) => (
              <div key={row.category} className="grid grid-cols-[100px_repeat(4,1fr)] items-center gap-2 px-3 py-2 text-xs">
                <div className="font-mono font-semibold text-zinc-800">{row.category}</div>
                <div><span className="text-zinc-400">총</span> {num(row.total)}</div>
                <div><span className="text-zinc-400">매수</span> {num(row.bought)}</div>
                <div><span className="text-zinc-400">팔림</span> {num(row.missedSold)}</div>
                <div><span className="text-zinc-400">별로</span> {num(row.badPick)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
            최근 확인 필요한 피드백
          </div>
          <div className="divide-y divide-zinc-100">
            {stats.flaggedRows.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">부정 피드백 없음</div>
            ) : stats.flaggedRows.map((row) => (
              <div key={`${row.pid}-${row.feedbackType}`} className="grid grid-cols-[74px_minmax(0,1fr)_70px] items-center gap-3 px-3 py-2 text-xs">
                <div className={row.feedbackType === "missed_sold" ? "font-semibold text-amber-700" : "font-semibold text-red-700"}>
                  {feedbackLabel(row.feedbackType)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-800">{row.name}</div>
                  <div className="truncate font-mono text-[10px] text-zinc-400">{row.category} · {row.skuName}</div>
                  {row.note ? <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-500">{row.note}</div> : null}
                </div>
                <div className="text-right text-zinc-400">{formatTime(row.updatedAt)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-zinc-100">
        <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
          최근 테스트 코멘트
        </div>
        <div className="divide-y divide-zinc-100">
          {stats.notedRows.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-zinc-500">아직 코멘트 없음</div>
          ) : stats.notedRows.map((row) => (
            <div key={`${row.pid}-${row.updatedAt}`} className="grid grid-cols-[74px_minmax(0,1fr)_70px] gap-3 px-3 py-2 text-xs">
              <div className="font-semibold text-zinc-700">{feedbackLabel(row.feedbackType)}</div>
              <div className="min-w-0">
                <div className="truncate font-medium text-zinc-800">{row.name}</div>
                <div className="truncate font-mono text-[10px] text-zinc-400">{row.category} · {row.skuName}</div>
                <div className="mt-1 text-[11px] leading-4 text-zinc-600">{row.note}</div>
              </div>
              <div className="text-right text-zinc-400">{formatTime(row.updatedAt)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ApprovalQueuePanel({ stats }: { stats: Awaited<ReturnType<typeof loadApprovalQueueDebug>> }) {
  const riskyPending = stats.pendingRows.filter((row) => row.riskFlags.length > 0);
  const cleanPending = Math.max(0, stats.totals.pending - riskyPending.length);
  const topQueues = stats.queues
    .filter((queue) => queue.pending > 0 || queue.rejected > 0 || queue.approved > 0)
    .sort((a, b) => b.pending - a.pending || a.category.localeCompare(b.category, "ko"))
    .slice(0, 7);

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-950">Approval Queue</div>
          <div className="mt-1 text-xs text-zinc-500">
            마이닝 후보를 runtime catalog에 올리기 전 사람이 볼 대기열입니다. risk flag가 있으면 apply에서 스킵됩니다.
          </div>
        </div>
        <span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
          riskyPending.length > 0
            ? "bg-amber-100 text-amber-800 ring-amber-200"
            : stats.ok
              ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
              : "bg-red-100 text-red-800 ring-red-200"
        }`}>
          {stats.ok ? `갱신 ${formatTime(stats.generatedAt)}` : "리포트 없음"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="전체 항목" value={`${num(stats.totals.total)}개`} sub="approval queues" />
        <MetricCard label="대기" value={`${num(stats.totals.pending)}개`} sub={`clean ${num(cleanPending)} · risk ${num(riskyPending.length)}`} />
        <MetricCard label="승인" value={`${num(stats.totals.approved)}개`} sub="apply 대상" />
        <MetricCard label="반려" value={`${num(stats.totals.rejected)}개`} sub="재노출 차단" />
        <MetricCard label="큐" value={`${num(stats.queues.length)}개`} sub="category-intelligence" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
            큐별 상태
          </div>
          <div className="divide-y divide-zinc-100">
            {topQueues.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">approval queue 없음</div>
            ) : topQueues.map((queue) => (
              <div key={queue.category} className="grid grid-cols-[minmax(0,1fr)_repeat(3,42px)] items-center gap-2 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-mono font-semibold text-zinc-800">{queue.category}</div>
                  <div className="text-[10px] text-zinc-400">{queue.updatedAt ? formatTime(queue.updatedAt) : "-"}</div>
                </div>
                <div className="text-right text-amber-700">{num(queue.pending)}</div>
                <div className="text-right text-emerald-700">{num(queue.approved)}</div>
                <div className="text-right text-red-700">{num(queue.rejected)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-zinc-100">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
            승인 전 확인할 후보
          </div>
          <div className="divide-y divide-zinc-100">
            {stats.pendingRows.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">대기 후보 없음</div>
            ) : stats.pendingRows.map((row) => (
              <div key={`${row.category}-${row.key}`} className="grid gap-2 px-3 py-2 text-xs lg:grid-cols-[120px_minmax(0,1fr)_minmax(160px,0.55fr)] lg:items-center">
                <div className="font-mono text-zinc-500">{row.category}</div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-zinc-800">{row.id || row.modelName}</div>
                  <div className="truncate text-[10px] text-zinc-400">
                    {row.brand || "-"} · {row.runtimeCategory || "-"} · clusters {row.sourceClusterIds.join(", ") || "-"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 lg:justify-end">
                  {row.riskFlags.length === 0 ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                      clean pending
                    </span>
                  ) : row.riskFlags.map((flag) => (
                    <span key={flag} className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-100">
                      {flag}
                    </span>
                  ))}
                </div>
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
            QStash, 외부 스케줄러, 로컬 수동 호출 중 어디서 들어왔는지 확인하는 운영 메타입니다.
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
      <div className="font-semibold">동기 wait 실행 timeout 가능성이 큽니다.</div>
      <div className="mt-1 text-amber-900">
        QStash/외부 스케줄러/로컬 호출 모두 `wait=1`로 오래 기다리면 DB timeout이나 서버리스 timeout에 같이 걸릴 수 있어요.
        디버깅 기간에는 역할별 endpoint를 작게 호출하고, 전체 collect는 fallback으로만 쓰는 게 안전합니다.
      </div>
      <code className="mt-3 block overflow-x-auto rounded-md bg-white px-3 py-2 text-xs text-zinc-900">
        /api/cron/tick?wait=1 · /api/cron/detail-worker?wait=1
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
              <th className="px-4 py-3">판매자</th>
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
                <td className="px-4 py-3">{num(
                  ["search", "detail", "score", "market_stats", "source_health", "pool_warmer"].reduce((sum, stage) => {
                    const stats = stageStats(run, stage as "search" | "detail" | "score");
                    return sum + stageValue(stats, "sellerUpserted");
                  }, 0)
                )}</td>
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

function DiagnosticsLoadShedPanel() {
  return (
    <section className="rounded-md border border-amber-200 bg-amber-50 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-amber-950">무거운 진단은 기본 새로고침에서 제외됨</div>
          <div className="mt-1 text-sm leading-6 text-amber-900">
            후보팩 병목, 시세 재계산 큐, 시세 통계, 피드백, approval queue는 DB 집계를 많이 읽어서 필요할 때만 켭니다.
            기본 화면은 최근 실행, worker 상태, 이미 계산된 판매속도 summary만 60초마다 확인합니다.
          </div>
        </div>
        <Link
          href="/debug?diagnostics=1"
          className="w-fit rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 transition hover:border-amber-500"
        >
          무거운 진단 보기
        </Link>
      </div>
    </section>
  );
}

export default async function DebugPage({ searchParams }: { searchParams?: Promise<DebugSearchParams> }) {
  const admin = await requireDebugAdminFromCookies();
  if (!admin.ok) {
    redirect(admin.status === 403 ? "/" : "/login?next=/debug");
  }

  const params = searchParams ? await searchParams : {};
  const diagnosticsEnabled = isDiagnosticsEnabled(params);
  const guardSnapshot = getCronGuardSnapshot();
  const [runs, sourceHealth, marketVelocity] = await Promise.all([
    loadCollectRuns(30),
    loadSourceHealthDebug(),
    loadMarketVelocityDebug(),
  ]);
  const diagnostics = diagnosticsEnabled
    ? await Promise.all([
      loadMarketPriceDebug(),
      loadMarketInvalidationDebug(),
      loadBottleneckDebug(),
      loadFeedbackDebug(),
      loadApprovalQueueDebug(),
    ])
    : null;
  const latest = runs[0] ?? null;
  const latestOk = lastSucceeded(runs);
  const totalApiCalls = runs.reduce((sum, run) => sum + run.aiApiCalls, 0);
  const totalAiFiltered = runs.reduce((sum, run) => sum + run.aiFilteredCount, 0);

  return withAdminGate(
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">운영 로그</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              수집 파이프라인 상태
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="w-fit rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
            >
              후보 화면으로
            </Link>
            <Link
              href={diagnosticsEnabled ? "/debug" : "/debug?diagnostics=1"}
              className={`w-fit rounded-md border px-4 py-2 text-sm font-semibold transition ${
                diagnosticsEnabled
                  ? "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500"
                  : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
              }`}
            >
              {diagnosticsEnabled ? "가벼운 모드" : "무거운 진단"}
            </Link>
            <DebugAutoRefresh intervalSeconds={diagnosticsEnabled ? 120 : 60} defaultEnabled={false} />
          </div>
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

        <MarketVelocityPanel stats={marketVelocity} />

        <WorkerAlertPanel runs={runs} />

        {latest ? <CronTimeoutAdvice run={latest} /> : null}

        <WorkerStatusPanel runs={runs} />

        <CronGuardPanel snapshot={guardSnapshot} />

        {latest ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px_420px]">
            <FlowBar run={latest} />
            <AiPanel run={latest} />
            <RequestPanel run={latest} />
          </section>
        ) : null}

        {latest ? <StagePanel run={latest} /> : null}

        {diagnostics ? (
          <>
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <BottleneckPanel stats={diagnostics[2]} />
              <div className="grid gap-5">
                <SourceHealthPanel health={sourceHealth} />
                <MarketInvalidationPanel stats={diagnostics[1]} />
                <MarketStatsPanel stats={diagnostics[0]} />
              </div>
            </section>

            <FeedbackPanel stats={diagnostics[3]} />

            <ApprovalQueuePanel stats={diagnostics[4]} />
          </>
        ) : (
          <>
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <DiagnosticsLoadShedPanel />
              <SourceHealthPanel health={sourceHealth} />
            </section>
          </>
        )}

        <DebugResetPanel />

        <RunsTable runs={runs} />
      </div>
    </main>,
  );
}
