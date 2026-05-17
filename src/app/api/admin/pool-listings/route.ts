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
  // Wave 176 (2026-05-17): 검색어 — 매물명/SKU명/comparable_key/pid 통합 검색.
  // 운영자가 특정 매물/모델 찾을 때 (예: "327", "Gazelle", "shoe|nb_327").
  const searchQuery = url.searchParams.get("q")?.trim() || null;
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

  // Wave 176 (2026-05-17): 검색어 — listings(name/sku_name) + parsed(comparable_key) + 정확 pid 매칭.
  // ILIKE %query% 패턴. SKU filter와 함께 박힐 수 있어 intersect 처리.
  let searchPids: number[] | null = null;
  if (searchQuery) {
    const escaped = encodeURIComponent(`*${searchQuery}*`); // PostgREST ilike 와일드카드는 `*`
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
    // skuPids 와 intersect (둘 다 적용 시 AND 의미)
    if (skuPids) {
      const skuSet = new Set(skuPids);
      searchPids = searchPids.filter((p) => skuSet.has(p));
      if (searchPids.length === 0) {
        return NextResponse.json({ page, pageSize, total: 0, totalPages: 1, items: [], stats: null });
      }
      // 기존 skuPids in 필터를 덮어쓰지 않고 search 결과로 더 좁힘.
      // PostgREST는 같은 컬럼 중복 in 필터를 잘 못 처리 → filter 재구성.
      filter = filter.replace(/&pid=in\.\([^)]+\)/, "");
    }
    filter += `&pid=in.(${searchPids.join(",")})`;
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

    // 3. Join with listings + raw + parsed + analysis + user feedback (한 batch에 한꺼번에)
    // 2026-05-17 Phase 0 L4: RiskScoreBar 입력 — description_preview / shop_review_* / image_count / score_flags 추가.
    // Wave 190 (2026-05-17) FIX: score_flags 는 mvp_listing_parsed 에 없음 (mvp_listing_analysis 가 정식 location).
    // 이전 (Wave 184): parsed 에서 score_flags fetch 시도 → 항상 빈 배열 → RiskScoreBar fraud axis 일부 미작동.
    const [listingsRes, rawRes, parsedRes, analysisRes, feedbackRes] = await Promise.all([
      restFetch(
        `${tableUrl("mvp_listings")}?select=pid,name,price,sku_name,sku_median,thumbnail_url,url,description_preview,shop_review_rating,shop_review_count,image_count,free_shipping,num_faved,num_comment&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sale_status,listing_state,last_seen_at,query,seller_uid&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        // 2026-05-16 (사용자 코멘트 #120): condition_class 추가 — 운영자풀 시세 출처 표시 위해.
        // Wave 182 Phase 3 (2026-05-17): parsed_json 추가 — option_base_assumed UI 표시.
        // Wave 190: score_flags 제거 — mvp_listing_analysis 가 정식 location.
        `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,parse_confidence,needs_review,condition_class,parsed_json&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
      // Wave 190 (2026-05-17): score_flags 정식 fetch — mvp_listing_analysis 에서.
      // RiskScoreBar 의 ai_escrow_held / ai_escrow_pending / extreme_discount_review 등 신호 정확하게 잡힘.
      restFetch(
        `${tableUrl("mvp_listing_analysis")}?select=pid,score_flags,risk_hits&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_reveal_feedback")}?select=pid,note,feedback_type,updated_at&user_ref=eq.${encodeURIComponent(userRef)}&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
    ]);

    // Wave 187 (2026-05-17): L6 Liquidity 곡선 입력 — comparable_key 별 velocity + price 분포.
    // mvp_market_velocity_daily 는 condition='all' 만 박혀있음 → 일단 'all' fetch (Wave 183 한계 동일).
    // 가장 최근 row per comparable_key 만 사용 (client-side picking).
    const parsedRowsForKeys = (await parsedRes.clone().json()) as Array<{ pid: number; comparable_key: string | null }>;
    const comparableKeys = Array.from(new Set(parsedRowsForKeys.map((r) => r.comparable_key).filter((k): k is string => !!k)));
    const velocityMap = new Map<string, { p25Hours: number | null; medianHours: number | null; p75Hours: number | null; soldSampleCount: number; date: string }>();
    const priceMap = new Map<string, { p25Price: number | null; medianPrice: number | null; p75Price: number | null; date: string }>();
    if (comparableKeys.length > 0) {
      const keysCsv = comparableKeys.map((k) => `"${k}"`).join(",");
      const [velocityRes, priceRes] = await Promise.all([
        restFetch(
          `${tableUrl("mvp_market_velocity_daily")}?select=comparable_key,p25_hours_to_sold,median_hours_to_sold,p75_hours_to_sold,observed_sold_sample_count,date&comparable_key=in.(${keysCsv})&condition_class=eq.all&order=date.desc&limit=2000`,
          { headers: serviceHeaders() },
        ),
        restFetch(
          `${tableUrl("mvp_market_price_daily")}?select=comparable_key,p25_price,blended_median_price,p75_price,date&comparable_key=in.(${keysCsv})&order=date.desc&limit=2000`,
          { headers: serviceHeaders() },
        ),
      ]);
      const vRows = (await velocityRes.json()) as Array<{ comparable_key: string; p25_hours_to_sold: number | null; median_hours_to_sold: number | null; p75_hours_to_sold: number | null; observed_sold_sample_count: number; date: string }>;
      const pRows = (await priceRes.json()) as Array<{ comparable_key: string; p25_price: number | null; blended_median_price: number | null; p75_price: number | null; date: string }>;
      for (const r of vRows) {
        const existing = velocityMap.get(r.comparable_key);
        if (!existing || r.date > existing.date) {
          velocityMap.set(r.comparable_key, {
            p25Hours: r.p25_hours_to_sold != null ? Number(r.p25_hours_to_sold) : null,
            medianHours: r.median_hours_to_sold != null ? Number(r.median_hours_to_sold) : null,
            p75Hours: r.p75_hours_to_sold != null ? Number(r.p75_hours_to_sold) : null,
            soldSampleCount: Number(r.observed_sold_sample_count ?? 0),
            date: r.date,
          });
        }
      }
      for (const r of pRows) {
        const existing = priceMap.get(r.comparable_key);
        if (!existing || r.date > existing.date) {
          priceMap.set(r.comparable_key, {
            p25Price: r.p25_price != null ? Number(r.p25_price) : null,
            medianPrice: r.blended_median_price != null ? Number(r.blended_median_price) : null,
            p75Price: r.p75_price != null ? Number(r.p75_price) : null,
            date: r.date,
          });
        }
      }
    }

    const listingsMap = new Map<number, Record<string, unknown>>();
    const rawMap = new Map<number, Record<string, unknown>>();
    const parsedMap = new Map<number, Record<string, unknown>>();
    const analysisMap = new Map<number, Record<string, unknown>>();
    const feedbackMap = new Map<number, Record<string, unknown>>();
    for (const r of (await listingsRes.json()) as Array<Record<string, unknown>>) listingsMap.set(Number(r.pid), r);
    for (const r of (await rawRes.json()) as Array<Record<string, unknown>>) rawMap.set(Number(r.pid), r);
    for (const r of (await parsedRes.json()) as Array<Record<string, unknown>>) parsedMap.set(Number(r.pid), r);
    for (const r of (await analysisRes.json()) as Array<Record<string, unknown>>) analysisMap.set(Number(r.pid), r);
    for (const r of (await feedbackRes.json()) as Array<Record<string, unknown>>) feedbackMap.set(Number(r.pid), r);

    const items = poolRows.map((pool) => {
      const pid = Number(pool.pid);
      const l = listingsMap.get(pid) || {};
      const r = rawMap.get(pid) || {};
      const p = parsedMap.get(pid) || {};
      const a = analysisMap.get(pid) || {};
      const fb = feedbackMap.get(pid);
      const note = (fb?.note as string | undefined) ?? "";
      const comparableKey = (p.comparable_key as string | null) ?? null;
      const velocity = comparableKey ? velocityMap.get(comparableKey) ?? null : null;
      const priceStats = comparableKey ? priceMap.get(comparableKey) ?? null : null;
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
        conditionClass: (p.condition_class as string | null) ?? null,
        saleStatus: (r.sale_status as string | null) ?? null,
        listingState: (r.listing_state as string | null) ?? null,
        lastSeenAt: (r.last_seen_at as string | null) ?? null,
        query: (r.query as string | null) ?? null,
        sellerUid: (r.seller_uid as string | null) ?? null,
        // 2026-05-17 Phase 0 L4 — RiskScoreBar 입력.
        descriptionPreview: (l.description_preview as string | null) ?? null,
        sellerReviewRating: l.shop_review_rating != null ? Number(l.shop_review_rating) : null,
        sellerReviewCount: l.shop_review_count != null ? Number(l.shop_review_count) : null,
        imageCount: l.image_count != null ? Number(l.image_count) : null,
        freeShipping: Boolean(l.free_shipping),
        numFaved: l.num_faved != null ? Number(l.num_faved) : null,
        numComment: l.num_comment != null ? Number(l.num_comment) : null,
        // Wave 190 (2026-05-17) FIX: score_flags 는 mvp_listing_analysis 에서 (parsed 에 없는 컬럼).
        scoreFlags: Array.isArray(a.score_flags) ? a.score_flags as string[] : [],
        // Wave 182 Phase 3 (2026-05-17): base option fallback — UI "기본 옵션 가정" 표시.
        optionBaseAssumed: (() => {
          const pj = p.parsed_json as Record<string, unknown> | null | undefined;
          const arr = pj?.option_base_assumed;
          return Array.isArray(arr) ? arr as string[] : null;
        })(),
        // Wave 187: L6 Liquidity 곡선 입력 — comparable_key 별 velocity + price 분포 (latest row).
        velocityP25Hours: velocity?.p25Hours ?? null,
        velocityMedianHours: velocity?.medianHours ?? null,
        velocityP75Hours: velocity?.p75Hours ?? null,
        velocitySoldSampleCount: velocity?.soldSampleCount ?? null,
        marketP25Price: priceStats?.p25Price ?? null,
        marketMedianPrice: priceStats?.medianPrice ?? null,
        marketP75Price: priceStats?.p75Price ?? null,
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
