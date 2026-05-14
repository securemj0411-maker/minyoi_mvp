// Wave 90 (2026-05-15): admin 전용 candidate_pool 페이지네이션 fetch.
// 운영자가 팩 결제 없이 풀 전체 매물 검증 가능.
// page-based pagination으로 DB I/O 최소화 (한 번에 20건만 조회).

import { NextResponse, type NextRequest } from "next/server";
import { requireDebugAdmin } from "@/lib/debug-admin";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

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

export async function GET(req: NextRequest) {
  const adminCheck = await requireDebugAdmin(req);
  if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(url.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE));
  const statusFilter = (url.searchParams.get("status") ?? "ready").trim();
  const bandFilter = url.searchParams.get("band");
  const categoryFilter = url.searchParams.get("category");
  const sort = url.searchParams.get("sort") ?? "profit_high";

  // Sort options
  const orderClauseMap: Record<string, string> = {
    profit_high: "expected_profit_max.desc",
    profit_low: "expected_profit_max.asc",
    confidence_high: "confidence.desc",
    latest: "last_verified_at.desc",
  };
  const order = orderClauseMap[sort] ?? "expected_profit_max.desc";

  // Build base query
  let filter = `status=eq.${encodeURIComponent(statusFilter)}`;
  if (bandFilter) filter += `&profit_band=eq.${Number(bandFilter)}`;
  if (categoryFilter) filter += `&category=eq.${encodeURIComponent(categoryFilter)}`;

  try {
    // 1. Total count (Prefer: count=exact 헤더)
    const countRes = await restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid&${filter}&limit=1`,
      { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
    );
    const contentRange = countRes.headers.get("content-range") ?? "0-0/0";
    const total = Number(contentRange.split("/")[1] ?? 0);

    // 2. Page fetch
    const offset = (page - 1) * pageSize;
    const cols = "pid,profit_band,status,category,comparable_key,expected_profit_min,expected_profit_max,confidence,exposure_count,max_exposure,last_verified_at";
    const poolRes = await restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=${cols}&${filter}&order=${order}&limit=${pageSize}&offset=${offset}`,
      { headers: serviceHeaders() },
    );
    const poolRows = (await poolRes.json()) as PoolRow[];

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

    // 3. Join with listings + raw + parsed (한 batch에 한꺼번에)
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
        pid,
        name: l.name as string ?? "",
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
        // pool-specific
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

    // 4. Stats — band × status breakdown (page=1 호출 시만 계산해 DB I/O 절약)
    let stats: { byBandStatus: Record<string, number>; totals: Record<string, number>; totalAll: number } | null = null;
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
      stats = { byBandStatus, totals, totalAll };
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
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
