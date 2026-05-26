import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { safeThumbnailUrl } from "@/lib/thumbnail-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PackRevealRow = {
  id: number;
  pid: number;
  user_ref: string;
  expected_profit_min: number;
  expected_profit_max: number;
  current_profit_min: number | null;
  current_profit_max: number | null;
  confidence: number | null;
  link_clicked_at: string | null;
  revealed_at: string;
  hidden_at: string | null;
};

type RawRow = {
  pid: number;
  source: string | null;
  seller_source: string | null;
  name: string | null;
  url: string | null;
  price: number | null;
  thumbnail_url: string | null;
  sku_id: string | null;
  sku_name: string | null;
  listing_state: string | null;
  sale_status: string | null;
};

type ListingRow = {
  pid: number;
  price: number | null;
  name: string | null;
  sku_name: string | null;
  thumbnail_url: string | null;
  url: string | null;
};

type ParsedRow = {
  pid: number;
  category: string | null;
  comparable_key: string | null;
  condition_class: string | null;
  model: string | null;
  family: string | null;
};

type PoolRow = {
  pid: number;
  category: string | null;
  comparable_key: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
};

type DetailEventRow = {
  id: number;
  pid: number;
  user_ref: string;
  event_type: string;
  session_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type AuthUser = {
  id: string;
  email: string | null;
  user_metadata?: { name?: string; full_name?: string; preferred_username?: string; nickname?: string };
  raw_user_meta_data?: { name?: string; full_name?: string; preferred_username?: string; nickname?: string };
};

type BucketRow = { key: string; label: string; count: number };

const MAX_REVEALS = 3000;
const MAX_EVENTS = 5000;

function intParam(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function cleanUserRef(value: string | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 96);
}

function sinceIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: serviceHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchByPid<T>(table: string, select: string, pids: number[]): Promise<T[]> {
  const unique = Array.from(new Set(pids.filter((pid) => Number.isFinite(pid) && pid > 0)));
  if (unique.length === 0) return [];
  const batches = await Promise.all(
    chunk(unique, 180).map((ids) => fetchJson<T[]>(`${tableUrl(table)}?select=${select}&pid=in.(${ids.join(",")})`)),
  );
  return batches.flat();
}

function nicknameOf(u: AuthUser): string {
  const meta = u.user_metadata ?? u.raw_user_meta_data ?? {};
  return meta.nickname || meta.name || meta.full_name || meta.preferred_username || "";
}

async function fetchAuthUsersMap(): Promise<Map<string, { email: string | null; nickname: string }>> {
  const base = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const map = new Map<string, { email: string | null; nickname: string }>();
  if (!base || !key) return map;
  for (let page = 1; page <= 20; page += 1) {
    const res = await fetch(`${base}/auth/v1/admin/users?per_page=200&page=${page}`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) break;
    const data = (await res.json()) as { users?: AuthUser[] };
    const users = data.users ?? [];
    for (const u of users) map.set(`auth:${u.id}`.slice(0, 64), { email: u.email, nickname: nicknameOf(u) });
    if (users.length < 200) break;
  }
  return map;
}

function priceBucket(price: number | null | undefined): BucketRow {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return { key: "unknown", label: "가격 없음", count: 0 };
  if (n < 150_000) return { key: "under_150k", label: "15만원 이하", count: 0 };
  if (n < 300_000) return { key: "150_300k", label: "15~30만원", count: 0 };
  if (n < 500_000) return { key: "300_500k", label: "30~50만원", count: 0 };
  if (n < 800_000) return { key: "500_800k", label: "50~80만원", count: 0 };
  if (n < 1_500_000) return { key: "800_1500k", label: "80~150만원", count: 0 };
  return { key: "over_1500k", label: "150만원 이상", count: 0 };
}

function profitBucket(profit: number | null | undefined): BucketRow {
  const n = Number(profit);
  if (!Number.isFinite(n)) return { key: "unknown", label: "수익 없음", count: 0 };
  if (n < 20_000) return { key: "under_20k", label: "2만원 미만", count: 0 };
  if (n < 50_000) return { key: "20_50k", label: "2~5만원", count: 0 };
  if (n < 100_000) return { key: "50_100k", label: "5~10만원", count: 0 };
  if (n < 200_000) return { key: "100_200k", label: "10~20만원", count: 0 };
  return { key: "over_200k", label: "20만원 이상", count: 0 };
}

function inc(map: Map<string, BucketRow>, bucket: BucketRow, amount = 1) {
  const prev = map.get(bucket.key) ?? bucket;
  map.set(bucket.key, { ...prev, count: prev.count + amount });
}

function topEntries(map: Map<string, number>, limit: number) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, label: key || "unknown", count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function sourceLabel(value: string | null | undefined) {
  if (value === "joongna") return "중고나라";
  if (value === "bunjang") return "번개장터";
  return value || "unknown";
}

function metadataNumber(metadata: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = metadata?.[key];
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  try {
  const url = new URL(req.url);
  const days = intParam(url.searchParams.get("days"), 30, 1, 365);
  const limit = intParam(url.searchParams.get("limit"), 500, 50, MAX_REVEALS);
  const userRef = cleanUserRef(url.searchParams.get("userRef"));
  const from = sinceIso(days);
  const userFilter = userRef ? `&user_ref=eq.${encodeURIComponent(userRef)}` : "";
  const detailOpenRows = await fetchJson<DetailEventRow[]>(
    `${tableUrl("mvp_detail_events")}?select=id,pid,user_ref,event_type,session_id,metadata,created_at&event_type=eq.detail_opened&created_at=gte.${encodeURIComponent(from)}${userFilter}&order=created_at.desc&limit=${limit}`,
  );

  const pids = detailOpenRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  const [rawRows, listingRows, parsedRows, poolRows, packRevealRows, eventRows, authMap] = await Promise.all([
    fetchByPid<RawRow>("mvp_raw_listings", "pid,source,seller_source,name,url,price,thumbnail_url,sku_id,sku_name,listing_state,sale_status", pids),
    fetchByPid<ListingRow>("mvp_listings", "pid,price,name,sku_name,thumbnail_url,url", pids),
    fetchByPid<ParsedRow>("mvp_listing_parsed", "pid,category,comparable_key,condition_class,model,family", pids),
    fetchByPid<PoolRow>("mvp_candidate_pool", "pid,category,comparable_key,expected_profit_min,expected_profit_max", pids),
    fetchByPid<PackRevealRow>("mvp_pack_reveals", "id,pid,user_ref,expected_profit_min,expected_profit_max,current_profit_min,current_profit_max,confidence,link_clicked_at,revealed_at,hidden_at", pids),
    pids.length > 0
      ? fetchJson<DetailEventRow[]>(
          `${tableUrl("mvp_detail_events")}?select=id,pid,user_ref,event_type,session_id,metadata,created_at&created_at=gte.${encodeURIComponent(from)}${userFilter}&order=created_at.desc&limit=${MAX_EVENTS}`,
        ).catch(() => [] as DetailEventRow[])
      : Promise.resolve([] as DetailEventRow[]),
    fetchAuthUsersMap(),
  ]);

  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const listingByPid = new Map(listingRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));
  const poolByPid = new Map(poolRows.map((row) => [Number(row.pid), row]));
  const packRevealByKey = new Map(packRevealRows.map((row) => [`${row.user_ref}:${Number(row.pid)}`, row]));
  const revealedPidSet = new Set(pids);
  const eventCountByRevealKey = new Map<string, Map<string, number>>();
  const originalClickAtByKey = new Map<string, string>();
  for (const event of eventRows) {
    const pid = Number(event.pid);
    if (!revealedPidSet.has(pid)) continue;
    const key = `${event.user_ref}:${pid}`;
    const byType = eventCountByRevealKey.get(key) ?? new Map<string, number>();
    byType.set(event.event_type, (byType.get(event.event_type) ?? 0) + 1);
    eventCountByRevealKey.set(key, byType);
    if (event.event_type === "original_clicked" && !originalClickAtByKey.has(key)) {
      originalClickAtByKey.set(key, event.created_at);
    }
  }

  const priceBuckets = new Map<string, BucketRow>();
  const profitBuckets = new Map<string, BucketRow>();
  const categoryCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const skuCounts = new Map<string, number>();
  const conditionCounts = new Map<string, number>();
  const userCounts = new Map<string, number>();
  let linkClicks = 0;
  let hidden = 0;

  const rows = detailOpenRows.map((open) => {
    const pid = Number(open.pid);
    const raw = rawByPid.get(pid);
    const listing = listingByPid.get(pid);
    const parsed = parsedByPid.get(pid);
    const pool = poolByPid.get(pid);
    const packReveal = packRevealByKey.get(`${open.user_ref}:${pid}`);
    const priceValue = metadataNumber(open.metadata, "price") ?? Number(raw?.price ?? listing?.price ?? 0);
    const price = Number.isFinite(priceValue) && priceValue > 0 ? priceValue : null;
    const source = metadataString(open.metadata, "source") ?? raw?.seller_source ?? raw?.source ?? "unknown";
    const category = metadataString(open.metadata, "category") ?? parsed?.category ?? pool?.category ?? "unknown";
    const sku = parsed?.comparable_key ?? pool?.comparable_key ?? raw?.sku_id ?? raw?.sku_name ?? listing?.sku_name ?? "unknown";
    const expectedProfit = metadataNumber(open.metadata, "expectedProfit")
      ?? (pool?.expected_profit_min != null && pool?.expected_profit_max != null
        ? Math.round((Number(pool.expected_profit_min) + Number(pool.expected_profit_max)) / 2)
        : packReveal
          ? Math.round((Number(packReveal.expected_profit_min) + Number(packReveal.expected_profit_max)) / 2)
          : 0);
    const currentProfit = packReveal?.current_profit_min == null || packReveal?.current_profit_max == null
      ? expectedProfit
      : Math.round((Number(packReveal.current_profit_min) + Number(packReveal.current_profit_max)) / 2);
    const user = authMap.get(open.user_ref);
    const events = eventCountByRevealKey.get(`${open.user_ref}:${pid}`) ?? new Map<string, number>();
    const linkClickedAt = originalClickAtByKey.get(`${open.user_ref}:${pid}`) ?? packReveal?.link_clicked_at ?? null;

    inc(priceBuckets, priceBucket(price));
    inc(profitBuckets, profitBucket(currentProfit));
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    sourceCounts.set(sourceLabel(source), (sourceCounts.get(sourceLabel(source)) ?? 0) + 1);
    skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);
    const condition = metadataString(open.metadata, "conditionClass") ?? parsed?.condition_class ?? "unknown";
    conditionCounts.set(condition, (conditionCounts.get(condition) ?? 0) + 1);
    userCounts.set(open.user_ref, (userCounts.get(open.user_ref) ?? 0) + 1);
    if (linkClickedAt) linkClicks += 1;
    if (packReveal?.hidden_at) hidden += 1;

    return {
      id: open.id,
      pid,
      userRef: open.user_ref,
      userEmail: user?.email ?? null,
      userNickname: user?.nickname ?? null,
      title: raw?.name ?? listing?.name ?? `PID ${pid}`,
      url: raw?.url ?? listing?.url ?? null,
      thumbnailUrl: safeThumbnailUrl(raw?.thumbnail_url ?? listing?.thumbnail_url),
      price,
      source,
      sourceLabel: sourceLabel(source),
      category,
      sku,
      condition,
      expectedProfit,
      currentProfit,
      confidence: packReveal?.confidence ?? null,
      revealedAt: open.created_at,
      linkClickedAt,
      hiddenAt: packReveal?.hidden_at ?? null,
      listingState: raw?.listing_state ?? null,
      saleStatus: raw?.sale_status ?? null,
      eventCounts: Object.fromEntries(events.entries()),
    };
  });

  const scopedEventRows = eventRows.filter((row) => revealedPidSet.has(Number(row.pid)));
  const originalClickedEvents = scopedEventRows.filter((row) => row.event_type === "original_clicked").length;
  const reportOpenedEvents = scopedEventRows.filter((row) => row.event_type === "detail_report_opened").length;
  const scrapSavedEvents = scopedEventRows.filter((row) => row.event_type === "scrap_saved").length;

  return NextResponse.json({
    params: { days, limit, userRef: userRef || null },
    summary: {
      reveals: detailOpenRows.length,
      uniqueUsers: new Set(detailOpenRows.map((row) => row.user_ref)).size,
      uniqueProducts: new Set(detailOpenRows.map((row) => row.pid)).size,
      linkClicks,
      linkClickRate: detailOpenRows.length > 0 ? linkClicks / detailOpenRows.length : 0,
      hidden,
      originalClickedEvents,
      reportOpenedEvents,
      scrapSavedEvents,
      computedAt: new Date().toISOString(),
    },
    breakdowns: {
      priceBuckets: Array.from(priceBuckets.values()),
      profitBuckets: Array.from(profitBuckets.values()),
      categories: topEntries(categoryCounts, 20),
      sources: topEntries(sourceCounts, 10),
      skus: topEntries(skuCounts, 30),
      conditions: topEntries(conditionCounts, 10),
      users: topEntries(userCounts, 30).map((row) => {
        const user = authMap.get(row.key);
        return { ...row, label: user?.nickname || user?.email || row.key };
      }),
    },
    rows,
  });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[admin-reveal-analytics] failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
