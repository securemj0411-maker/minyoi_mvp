// 2026-05-15: 베타 페이지용 public read-only pool 조회.
// admin/pool-listings 미러. 단 auth 없음 + user feedback (note) 제외 + sku breakdown은 동일.
// URL obfuscated 페이지에서만 호출하기 위한 endpoint. 절대 검색엔진 노출 X (robots).

import { NextResponse, type NextRequest } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const PRICE_BUCKETS = [
  { key: "lte_15", label: "15만원 이하", min: null, max: 150_000 },
  { key: "15_30", label: "15~30만원", min: 150_000, max: 300_000 },
  { key: "30_50", label: "30~50만원", min: 300_000, max: 500_000 },
  { key: "50_80", label: "50~80만원", min: 500_000, max: 800_000 },
  { key: "80_150", label: "80~150만원", min: 800_000, max: 1_500_000 },
  { key: "gte_150", label: "150만원 이상", min: 1_500_000, max: null },
] as const;

type PoolRow = {
  pid: number;
  profit_band: number;
  status: string;
  category: string | null;
  comparable_key: string | null;
  expected_profit_min: number;
  expected_profit_max: number;
  confidence: number;
  exposure_count: number;
  max_exposure: number;
  last_verified_at: string;
};

type PriceBucketKey = (typeof PRICE_BUCKETS)[number]["key"];

function priceBucketFor(price: number): PriceBucketKey {
  for (const bucket of PRICE_BUCKETS) {
    if (bucket.min != null && price < bucket.min) continue;
    if (bucket.max != null && price > bucket.max) continue;
    return bucket.key;
  }
  return "gte_150";
}

function priceBucketFilter(key: string | null) {
  const bucket = PRICE_BUCKETS.find((item) => item.key === key);
  if (!bucket) return "";
  const parts: string[] = [];
  if (bucket.min != null) parts.push(`price=gt.${bucket.min}`);
  if (bucket.max != null) parts.push(`price=lte.${bucket.max}`);
  return parts.join("&");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(url.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE));
  const statusFilter = (url.searchParams.get("status") ?? "ready").trim();
  const bandFilter = url.searchParams.get("band");
  const categoryFilter = url.searchParams.get("category");
  const priceBucket = url.searchParams.get("priceBucket");
  const skuFilter = url.searchParams.get("sku")?.trim() || null;
  // Wave 176 (2026-05-17): 검색어 — admin route와 동일 (peek-pool도 검색).
  const searchQuery = url.searchParams.get("q")?.trim() || null;
  const sort = url.searchParams.get("sort") ?? "profit_high";

  const orderClauseMap: Record<string, string> = {
    profit_high: "expected_profit_max.desc",
    profit_low: "expected_profit_max.asc",
    confidence_high: "confidence.desc",
    latest: "last_verified_at.desc",
    newest_added: "added_at.desc",
  };
  const order = orderClauseMap[sort] ?? "expected_profit_max.desc";

  let filter = `status=eq.${encodeURIComponent(statusFilter)}`;
  if (bandFilter) filter += `&profit_band=eq.${Number(bandFilter)}`;
  if (categoryFilter) filter += `&category=eq.${encodeURIComponent(categoryFilter)}`;

  let pidScope: Set<number> | null = null;
  const applyPidScope = (pids: number[]) => {
    if (pidScope) {
      const next = new Set<number>();
      for (const pid of pids) {
        if (pidScope.has(pid)) next.add(pid);
      }
      pidScope = next;
      return;
    }
    pidScope = new Set(pids);
  };

  let skuPids: number[] | null = null;
  if (skuFilter) {
    const skuRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid&sku_id=eq.${encodeURIComponent(skuFilter)}&limit=5000`,
      { headers: serviceHeaders() },
    );
    skuPids = ((await skuRes.json()) as Array<{ pid: number }>).map((r) => Number(r.pid));
    if (skuPids.length === 0) {
      return NextResponse.json({ page, pageSize, total: 0, totalPages: 1, items: [], stats: null });
    }
    applyPidScope(skuPids);
  }

  if (priceBucket) {
    const priceFilter = priceBucketFilter(priceBucket);
    if (priceFilter) {
      const priceRes = await restFetch(
        `${tableUrl("mvp_listings")}?select=pid&${priceFilter}&limit=5000`,
        { headers: serviceHeaders() },
      );
      const pricePids = ((await priceRes.json()) as Array<{ pid: number }>).map((r) => Number(r.pid));
      if (pricePids.length === 0) {
        return NextResponse.json({ page, pageSize, total: 0, totalPages: 1, items: [], stats: null });
      }
      applyPidScope(pricePids);
    }
  }

  // Wave 176: 검색어 ILIKE (name + sku_name + comparable_key) + pid 정확 매칭.
  let searchPids: number[] | null = null;
  if (searchQuery) {
    const escaped = encodeURIComponent(`*${searchQuery}*`);
    const [nameRes, parsedRes] = await Promise.all([
      restFetch(
        `${tableUrl("mvp_listings")}?select=pid&or=(name.ilike.${escaped},sku_name.ilike.${escaped})&limit=5000`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_listing_parsed")}?select=pid&comparable_key=ilike.${escaped}&limit=5000`,
        { headers: serviceHeaders() },
      ),
    ]);
    const pidsFromListings = ((await nameRes.json()) as Array<{ pid: number }>).map((r) => Number(r.pid));
    const pidsFromParsed = ((await parsedRes.json()) as Array<{ pid: number }>).map((r) => Number(r.pid));
    const pidExact = Number(searchQuery);
    const pidExactArr = Number.isFinite(pidExact) && pidExact > 0 ? [pidExact] : [];
    searchPids = Array.from(new Set([...pidsFromListings, ...pidsFromParsed, ...pidExactArr]));
    if (searchPids.length === 0) {
      return NextResponse.json({ page, pageSize, total: 0, totalPages: 1, items: [], stats: null });
    }
    applyPidScope(searchPids);
  }

  const scopedPids: number[] | null = pidScope ? Array.from(pidScope as Set<number>) : null;
  if (scopedPids && scopedPids.length === 0) {
    return NextResponse.json({ page, pageSize, total: 0, totalPages: 1, items: [], stats: null });
  }

  try {
    const offset = (page - 1) * pageSize;
    const cols = "pid,profit_band,status,category,comparable_key,expected_profit_min,expected_profit_max,confidence,exposure_count,max_exposure,last_verified_at";
    let total = 0;
    let poolRows: PoolRow[] = [];

    if (scopedPids) {
      const allowedPids = new Set<number>(scopedPids);
      const scopedPoolRes = await restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=${cols}&${filter}&order=${order}&limit=5000`,
        { headers: serviceHeaders() },
      );
      const allBaseRows = (await scopedPoolRes.json()) as PoolRow[];
      const allFilteredRows = allBaseRows.filter((row) => allowedPids.has(Number(row.pid)));
      total = allFilteredRows.length;
      poolRows = allFilteredRows.slice(offset, offset + pageSize);
    } else {
      const countRes = await restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=pid&${filter}&limit=1`,
        { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
      );
      const contentRange = countRes.headers.get("content-range") ?? "0-0/0";
      total = Number(contentRange.split("/")[1] ?? 0);

      const poolRes = await restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=${cols}&${filter}&order=${order}&limit=${pageSize}&offset=${offset}`,
        { headers: serviceHeaders() },
      );
      poolRows = (await poolRes.json()) as PoolRow[];
    }

    if (poolRows.length === 0) {
      return NextResponse.json({
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        items: [],
      });
    }

    const pids = poolRows.map((r) => Number(r.pid));
    const pidsCsv = pids.join(",");

    const [listingsRes, rawRes, parsedRes] = await Promise.all([
      restFetch(
        `${tableUrl("mvp_listings")}?select=pid,name,price,sku_name,sku_median,thumbnail_url,url&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sale_status,listing_state,last_seen_at,query,seller_uid&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,parse_confidence,needs_review&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
    ]);

    const listingsMap = new Map<number, Record<string, unknown>>();
    const rawMap = new Map<number, Record<string, unknown>>();
    const parsedMap = new Map<number, Record<string, unknown>>();
    for (const r of (await listingsRes.json()) as Array<Record<string, unknown>>) listingsMap.set(Number(r.pid), r);
    for (const r of (await rawRes.json()) as Array<Record<string, unknown>>) rawMap.set(Number(r.pid), r);
    for (const r of (await parsedRes.json()) as Array<Record<string, unknown>>) parsedMap.set(Number(r.pid), r);

    const items = poolRows.map((pool) => {
      const pid = Number(pool.pid);
      const l = listingsMap.get(pid) || {};
      const r = rawMap.get(pid) || {};
      const p = parsedMap.get(pid) || {};
      return {
        // user-specific feedback 필드는 public이라 omit
        hasComment: false,
        commentPreview: "",
        commentUpdatedAt: null,
        pid,
        name: (l.name as string) ?? "",
        price: Number(l.price ?? 0),
        skuId: (r.sku_id as string | null) ?? null,
        skuName: (l.sku_name as string | null) ?? null,
        skuMedian: Number(l.sku_median ?? 0),
        thumbnailUrl: (l.thumbnail_url as string | null) ?? null,
        bunjangUrl: `https://m.bunjang.co.kr/products/${pid}`,
        comparableKey: (p.comparable_key as string | null) ?? null,
        parseConfidence: p.parse_confidence != null ? Number(p.parse_confidence) : null,
        needsReview: Boolean(p.needs_review),
        saleStatus: (r.sale_status as string | null) ?? null,
        listingState: (r.listing_state as string | null) ?? null,
        lastSeenAt: (r.last_seen_at as string | null) ?? null,
        query: (r.query as string | null) ?? null,
        sellerUid: (r.seller_uid as string | null) ?? null,
        band: pool.profit_band,
        poolStatus: pool.status,
        category: pool.category,
        expectedProfitMin: pool.expected_profit_min,
        expectedProfitMax: pool.expected_profit_max,
        confidence: pool.confidence,
        exposureCount: pool.exposure_count,
        maxExposure: pool.max_exposure,
        lastVerifiedAt: pool.last_verified_at,
      };
    });

    // Stats (page=1만)
    let stats: {
      byBandStatus: Record<string, number>;
      totals: Record<string, number>;
      totalAll: number;
      bySku: Array<{ sku_id: string; sku_name: string | null; ready_count: number }>;
      byPriceBucket: Array<{ key: string; label: string; ready_count: number }>;
      byCategory: Array<{ category: string; ready_count: number }>;
    } | null = null;
    if (page === 1) {
      const bands = [1, 2, 3];
      const statuses = ["ready", "invalidated", "spent"];
      const requests = bands.flatMap((b) => statuses.map(async (s) => {
        const r = await restFetch(
          `${tableUrl("mvp_candidate_pool")}?select=pid&profit_band=eq.${b}&status=eq.${s}&limit=1`,
          { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
        );
        const cr = r.headers.get("content-range") ?? "0-0/0";
        return { band: b, status: s, count: Number(cr.split("/")[1] ?? 0) };
      }));
      const results = await Promise.all(requests);
      const byBandStatus: Record<string, number> = {};
      const totals: Record<string, number> = { ready: 0, invalidated: 0, spent: 0 };
      let totalAll = 0;
      for (const r of results) {
        byBandStatus[`band${r.band}_${r.status}`] = r.count;
        totals[r.status] = (totals[r.status] ?? 0) + r.count;
        totalAll += r.count;
      }
      const readyPoolRes = await restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=pid,category&status=eq.ready&limit=5000`,
        { headers: serviceHeaders() },
      );
      const readyPoolRows = (await readyPoolRes.json()) as Array<{ pid: number; category: string | null }>;
      const readyPids = readyPoolRows.map((r) => Number(r.pid));
      const categoryCount = new Map<string, number>();
      for (const row of readyPoolRows) {
        const category = row.category ?? "unknown";
        categoryCount.set(category, (categoryCount.get(category) ?? 0) + 1);
      }
      const skuCount = new Map<string, { name: string | null; count: number }>();
      const priceBucketCount = new Map<string, number>();
      if (readyPids.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < readyPids.length; i += chunkSize) {
          const chunk = readyPids.slice(i, i + chunkSize);
          const [rawRes, listingRes] = await Promise.all([
            restFetch(
              `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name&pid=in.(${chunk.join(",")})`,
              { headers: serviceHeaders() },
            ),
            restFetch(
              `${tableUrl("mvp_listings")}?select=pid,price&pid=in.(${chunk.join(",")})`,
              { headers: serviceHeaders() },
            ),
          ]);
          const rows = (await rawRes.json()) as Array<{ sku_id: string | null; sku_name: string | null }>;
          for (const r of rows) {
            const sku = r.sku_id ?? "(no_sku)";
            const entry = skuCount.get(sku) ?? { name: r.sku_name, count: 0 };
            entry.count += 1;
            if (!entry.name && r.sku_name) entry.name = r.sku_name;
            skuCount.set(sku, entry);
          }
          const listingRows = (await listingRes.json()) as Array<{ price: number | null }>;
          for (const row of listingRows) {
            const price = Number(row.price ?? 0);
            if (!Number.isFinite(price) || price <= 0) continue;
            const key = priceBucketFor(price);
            priceBucketCount.set(key, (priceBucketCount.get(key) ?? 0) + 1);
          }
        }
      }
      const bySku = [...skuCount.entries()]
        .map(([sku_id, { name, count }]) => ({ sku_id, sku_name: name, ready_count: count }))
        .sort((a, b) => b.ready_count - a.ready_count);
      const byPriceBucket = PRICE_BUCKETS.map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        ready_count: priceBucketCount.get(bucket.key) ?? 0,
      }));
      const byCategory = [...categoryCount.entries()]
        .map(([category, count]) => ({ category, ready_count: count }))
        .sort((a, b) => b.ready_count - a.ready_count);
      stats = { byBandStatus, totals, totalAll, bySku, byPriceBucket, byCategory };
    }

    return NextResponse.json({
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items,
      stats,
    });
  } catch (err) {
    console.error("[public/pool-listings] error", err);
    return NextResponse.json(
      { error: "pool_listings_failed", message: "풀 목록을 불러오지 못했어요." },
      { status: 500 },
    );
  }
}
