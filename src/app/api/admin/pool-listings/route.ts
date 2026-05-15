// Wave 90 (2026-05-15): admin 전용 candidate_pool 페이지네이션 fetch.
// 운영자가 팩 결제 없이 풀 전체 매물 검증 가능.
// page-based pagination으로 DB I/O 최소화 (한 번에 20건만 조회).

import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { isBetaTesterAuthId } from "@/lib/beta-tester";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

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
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  // 2026-05-15: 운영자 또는 베타 체험단으로 등록된 사용자 모두 접근 허용.
  const isAdmin = isAdminUser(auth.user);
  const isBeta = isAdmin ? false : await isBetaTesterAuthId(auth.user.id);
  if (!isAdmin && !isBeta) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const userRef = userRefForAuthUser(auth.user.id);

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(url.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE));
  const statusFilter = (url.searchParams.get("status") ?? "ready").trim();
  const bandFilter = url.searchParams.get("band");
  const categoryFilter = url.searchParams.get("category");
  const skuFilter = url.searchParams.get("sku")?.trim() || null;
  const sort = url.searchParams.get("sort") ?? "profit_high";

  // Sort options
  const orderClauseMap: Record<string, string> = {
    profit_high: "expected_profit_max.desc",
    profit_low: "expected_profit_max.asc",
    confidence_high: "confidence.desc",
    latest: "last_verified_at.desc",
    // Wave 100: 매물이 풀에 진입한 시점 기준 (added_at). 최신 매물부터.
    newest_added: "added_at.desc",
  };
  const order = orderClauseMap[sort] ?? "expected_profit_max.desc";

  // Build base query
  let filter = `status=eq.${encodeURIComponent(statusFilter)}`;
  if (bandFilter) filter += `&profit_band=eq.${Number(bandFilter)}`;
  if (categoryFilter) filter += `&category=eq.${encodeURIComponent(categoryFilter)}`;

  // SKU filter — mvp_candidate_pool에는 sku_id 컬럼 없음 → mvp_raw_listings에서 pid pre-filter
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
    // PostgREST in 필터 — 너무 많으면 URL 한계. 일단 5000 limit.
    filter += `&pid=in.(${skuPids.join(",")})`;
  }

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

    // 3. Join with listings + raw + parsed + user feedback (한 batch에 한꺼번에)
    const [listingsRes, rawRes, parsedRes, feedbackRes] = await Promise.all([
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
      restFetch(
        `${tableUrl("mvp_reveal_feedback")}?select=pid,note,feedback_type,updated_at&user_ref=eq.${encodeURIComponent(userRef)}&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
    ]);

    const listingsMap = new Map<number, Record<string, unknown>>();
    const rawMap = new Map<number, Record<string, unknown>>();
    const parsedMap = new Map<number, Record<string, unknown>>();
    const feedbackMap = new Map<number, Record<string, unknown>>();
    for (const r of (await listingsRes.json()) as Array<Record<string, unknown>>) listingsMap.set(Number(r.pid), r);
    for (const r of (await rawRes.json()) as Array<Record<string, unknown>>) rawMap.set(Number(r.pid), r);
    for (const r of (await parsedRes.json()) as Array<Record<string, unknown>>) parsedMap.set(Number(r.pid), r);
    for (const r of (await feedbackRes.json()) as Array<Record<string, unknown>>) feedbackMap.set(Number(r.pid), r);

    const items = poolRows.map((pool) => {
      const pid = Number(pool.pid);
      const l = listingsMap.get(pid) || {};
      const r = rawMap.get(pid) || {};
      const p = parsedMap.get(pid) || {};
      const fb = feedbackMap.get(pid);
      const note = (fb?.note as string | undefined) ?? "";
      return {
        hasComment: note.trim().length > 0,
        commentPreview: note.slice(0, 100),
        commentUpdatedAt: (fb?.updated_at as string | undefined) ?? null,
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

    // 4. Stats — band × status breakdown + bySku (page=1 호출 시만, sku filter 무관)
    let stats: {
      byBandStatus: Record<string, number>;
      totals: Record<string, number>;
      totalAll: number;
      bySku: Array<{ sku_id: string; sku_name: string | null; ready_count: number }>;
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

      // bySku breakdown — ready 매물만 (검토 대상)
      const readyPoolRes = await restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.ready&limit=5000`,
        { headers: serviceHeaders() },
      );
      const readyPids = ((await readyPoolRes.json()) as Array<{ pid: number }>).map((r) => Number(r.pid));
      const skuCount = new Map<string, { name: string | null; count: number }>();
      if (readyPids.length > 0) {
        // chunk fetch
        const chunkSize = 500;
        for (let i = 0; i < readyPids.length; i += chunkSize) {
          const chunk = readyPids.slice(i, i + chunkSize);
          const rawRes = await restFetch(
            `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name&pid=in.(${chunk.join(",")})`,
            { headers: serviceHeaders() },
          );
          const rows = (await rawRes.json()) as Array<{ sku_id: string | null; sku_name: string | null }>;
          for (const r of rows) {
            const sku = r.sku_id ?? "(no_sku)";
            const entry = skuCount.get(sku) ?? { name: r.sku_name, count: 0 };
            entry.count += 1;
            if (!entry.name && r.sku_name) entry.name = r.sku_name;
            skuCount.set(sku, entry);
          }
        }
      }
      const bySku = [...skuCount.entries()]
        .map(([sku_id, { name, count }]) => ({ sku_id, sku_name: name, ready_count: count }))
        .sort((a, b) => b.ready_count - a.ready_count);

      stats = { byBandStatus, totals, totalAll, bySku };
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
    // Wave 106: raw err.message 누출 차단 (admin 페이지지만 일관성).
    console.error("[admin/pool-listings] error", err);
    return NextResponse.json(
      { error: "pool_listings_failed", message: "풀 목록을 불러오지 못했어요." },
      { status: 500 },
    );
  }
}
