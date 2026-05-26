// Wave 90 (2026-05-15): admin 전용 candidate_pool 페이지네이션 fetch.
// 운영자가 팩 결제 없이 풀 전체 매물 검증 가능.
// page-based pagination으로 DB I/O 최소화 (한 번에 20건만 조회).

import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { loadMarketBandsForKeys, loadV7SiblingPresence, resolveSkuMedianForDisplay } from "@/lib/band-aware-median";
import { isBetaTesterAuthId } from "@/lib/beta-tester";
import { listingUrlForSource, marketplaceSourceLabel, normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

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
  const priceBucketParam = url.searchParams.get("priceBucket");
  const priceBucket = PRICE_BUCKETS.some((item) => item.key === priceBucketParam) ? priceBucketParam : null;
  const skuFilter = url.searchParams.get("sku")?.trim() || null;
  const sourceFilter = url.searchParams.get("source")?.trim().toLowerCase() || null;
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

  if (sourceFilter) {
    const normalizedSource = normalizeMarketplaceSource(sourceFilter);
    // Wave 757 (2026-05-26): 풀은 작은데 (~700 ready) raw 는 클 수 있음 (daangn 43k+).
    //   기존: raw_listings where source=daangn LIMIT 5000 → 풀 pids 못 잡으면 결과 0.
    //   변경: 풀 ready pids 먼저 가져와서 그걸로 raw 좁힘 (pid=in.(...) + source=eq.X).
    const poolPidRes = await restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.${encodeURIComponent(statusFilter)}&limit=5000`,
      { headers: serviceHeaders() },
    );
    const poolPids = ((await poolPidRes.json()) as Array<{ pid: number }>).map((r) => Number(r.pid));
    if (poolPids.length === 0) {
      return NextResponse.json({ page, pageSize, total: 0, totalPages: 1, items: [], stats: null });
    }
    // chunk by 500 (URL length 안전) — 풀 ~700 이라 보통 2 chunk
    const sourcePids: number[] = [];
    for (let i = 0; i < poolPids.length; i += 500) {
      const chunk = poolPids.slice(i, i + 500);
      const sourceRes = await restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid&source=eq.${encodeURIComponent(normalizedSource)}&pid=in.(${chunk.join(",")})&limit=5000`,
        { headers: serviceHeaders() },
      );
      const chunkPids = ((await sourceRes.json()) as Array<{ pid: number }>).map((r) => Number(r.pid));
      sourcePids.push(...chunkPids);
    }
    if (sourcePids.length === 0) {
      return NextResponse.json({ page, pageSize, total: 0, totalPages: 1, items: [], stats: null });
    }
    applyPidScope(sourcePids);
  }

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
    applyPidScope(skuPids);
  }

  // Price bucket filtering is applied after loading the scoped candidate_pool rows.
  // A global mvp_listings price pre-scope can silently drop valid pool pids when
  // low-price listings exceed the REST limit.

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
    const scopedPidSet = scopedPids ? new Set(scopedPids) : null;
    const hasExternalFilters = Boolean(scopedPidSet || priceBucket || skuFilter || searchQuery);

    if (hasExternalFilters) {
      // price/SKU/search 필터는 외부 테이블을 보지만, total/page는 candidate_pool base row 기준으로 한 번에 계산한다.
      const scopedPoolRes = await restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=${cols}&${filter}&order=${order}&limit=5000`,
        { headers: serviceHeaders() },
      );
      const allBaseRows = (await scopedPoolRes.json()) as PoolRow[];
      const basePids = allBaseRows.map((row) => Number(row.pid));
      const listingMap = new Map<number, { name: string; sku_name: string | null; price: number | null }>();
      const rawSkuMap = new Map<number, string | null>();
      const parsedKeyMap = new Map<number, string | null>();
      for (let i = 0; i < basePids.length; i += 500) {
        const chunk = basePids.slice(i, i + 500);
        const pidsParam = chunk.join(",");
        const [listingRes, rawRes, parsedRes] = await Promise.all([
          priceBucket || searchQuery
            ? restFetch(`${tableUrl("mvp_listings")}?select=pid,name,sku_name,price&pid=in.(${pidsParam})`, { headers: serviceHeaders() })
            : null,
          skuFilter
            ? restFetch(`${tableUrl("mvp_raw_listings")}?select=pid,sku_id&pid=in.(${pidsParam})`, { headers: serviceHeaders() })
            : null,
          searchQuery
            ? restFetch(`${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key&pid=in.(${pidsParam})`, { headers: serviceHeaders() })
            : null,
        ]);
        if (listingRes) {
          const rows = (await listingRes.json()) as Array<{ pid: number; name: string | null; sku_name: string | null; price: number | null }>;
          for (const row of rows) listingMap.set(Number(row.pid), { name: row.name ?? "", sku_name: row.sku_name, price: row.price });
        }
        if (rawRes) {
          const rows = (await rawRes.json()) as Array<{ pid: number; sku_id: string | null }>;
          for (const row of rows) rawSkuMap.set(Number(row.pid), row.sku_id);
        }
        if (parsedRes) {
          const rows = (await parsedRes.json()) as Array<{ pid: number; comparable_key: string | null }>;
          for (const row of rows) parsedKeyMap.set(Number(row.pid), row.comparable_key);
        }
      }
      const query = searchQuery?.toLowerCase() ?? "";
      const exactPid = Number(searchQuery);
      const allFilteredRows = allBaseRows.filter((row) => {
        const pid = Number(row.pid);
        if (scopedPidSet && !scopedPidSet.has(pid)) return false;
        const listing = listingMap.get(pid);
        if (priceBucket) {
          const price = Number(listing?.price ?? 0);
          if (!Number.isFinite(price) || price <= 0 || priceBucketFor(price) !== priceBucket) return false;
        }
        if (skuFilter && rawSkuMap.get(pid) !== skuFilter) return false;
        if (searchQuery) {
          const name = listing?.name.toLowerCase() ?? "";
          const skuName = listing?.sku_name?.toLowerCase() ?? "";
          const comparableKey = parsedKeyMap.get(pid)?.toLowerCase() ?? "";
          const pidMatches = Number.isFinite(exactPid) && exactPid > 0 && pid === exactPid;
          if (!pidMatches && !name.includes(query) && !skuName.includes(query) && !comparableKey.includes(query)) return false;
        }
        return true;
      });
      total = allFilteredRows.length;
      poolRows = allFilteredRows.slice(offset, offset + pageSize);
    } else {
      // 1. Total count (Prefer: count=exact 헤더)
      const countRes = await restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=pid&${filter}&limit=1`,
        { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
      );
      const contentRange = countRes.headers.get("content-range") ?? "0-0/0";
      total = Number(contentRange.split("/")[1] ?? 0);

      // 2. Page fetch
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

    // 3. Join with listings + raw + parsed + analysis + user feedback (한 batch에 한꺼번에)
    // 2026-05-17 Phase 0 L4: RiskScoreBar 입력 — description_preview / shop_review_* / image_count / score_flags 추가.
    // Wave 190 (2026-05-17) FIX: score_flags 는 mvp_listing_parsed 에 없음 (mvp_listing_analysis 가 정식 location).
    // 이전 (Wave 184): parsed 에서 score_flags fetch 시도 → 항상 빈 배열 → RiskScoreBar fraud axis 일부 미작동.
    // Wave 199 (2026-05-18) FIX: shop_review_* / free_shipping / num_faved / num_comment 는
    // mvp_listings 에 없음 (Wave 184 박을 때 위치 잘못 추정). → mvp_raw_listings 로 이동.
    // description_preview / image_count 는 두 테이블 모두 있음 → listings 유지.
    const [listingsRes, rawRes, parsedRes, analysisRes, feedbackRes] = await Promise.all([
      restFetch(
        `${tableUrl("mvp_listings")}?select=pid,name,price,sku_name,sku_median,thumbnail_url,url,description_preview,image_count&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sale_status,listing_state,last_seen_at,query,seller_uid,shop_review_rating,shop_review_count,free_shipping,num_faved,num_comment,source,seller_source,url&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        // 2026-05-16 (사용자 코멘트 #120): condition_class 추가 — 운영자풀 시세 출처 표시 위해.
        // Wave 182 Phase 3 (2026-05-17): parsed_json 추가 — option_base_assumed UI 표시.
        // Wave 190: score_flags 제거 — mvp_listing_analysis 가 정식 location.
        // Wave 714d (2026-05-23): 신발/의류 5-tier grading column 추가 — admin pool 카드 등급 + chips.
        `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,parse_confidence,needs_review,condition_class,parsed_json,condition_tier,condition_cluster,condition_confidence,condition_flags&pid=in.(${pidsCsv})`,
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
    // Wave 201 (2026-05-18): reference_prices 도 fetch — unopened 매물 시 anchor 우선.
    // Wave 252.A (2026-05-20): (comparable_key, condition_class) band-aware sku_median fetch
    //   추가 — admin-pool-browser 화면의 raw mvp_listings.sku_median 이 v3 매물에서
    //   product_type 무분리로 hoodie+tee 혼합 → admin-pool-browser 차익 표시 mislead.
    //   /api/packs/pool (Wave 247.2) 와 동일 정책. additive only — DB 변경 X.
    const parsedRowsForKeys = (await parsedRes.clone().json()) as Array<{ pid: number; comparable_key: string | null; condition_class: string | null }>;
    const comparableKeys = Array.from(new Set(parsedRowsForKeys.map((r) => r.comparable_key).filter((k): k is string => !!k)));
    const velocityMap = new Map<string, { p25Hours: number | null; medianHours: number | null; p75Hours: number | null; soldSampleCount: number; date: string }>();
    const priceMap = new Map<string, { p25Price: number | null; medianPrice: number | null; p75Price: number | null; date: string }>();
    const refPriceMap = new Map<string, number>();
    // Wave 252.A: band-aware median map — (comparable_key, condition_class) → 최신 row.
    // Wave 252.A real (2026-05-20): v7 sibling presence — v3 clothing key mixed-pool 차단 가드.
    const [bandMap, v7SiblingPresence] = comparableKeys.length > 0
      ? await Promise.all([
          loadMarketBandsForKeys(serviceHeaders() as unknown as Record<string, string>, comparableKeys),
          loadV7SiblingPresence(serviceHeaders() as unknown as Record<string, string>, comparableKeys),
        ])
      : [new Map(), new Map()];
    if (comparableKeys.length > 0) {
      const keysCsv = comparableKeys.map((k) => `"${k}"`).join(",");
      const [velocityRes, priceRes, refRes] = await Promise.all([
        restFetch(
          `${tableUrl("mvp_market_velocity_daily")}?select=comparable_key,p25_hours_to_sold,median_hours_to_sold,p75_hours_to_sold,observed_sold_sample_count,date&comparable_key=in.(${keysCsv})&condition_class=eq.all&order=date.desc&limit=2000`,
          { headers: serviceHeaders() },
        ),
        restFetch(
          `${tableUrl("mvp_market_price_daily")}?select=comparable_key,p25_price,blended_median_price,p75_price,date&comparable_key=in.(${keysCsv})&order=date.desc&limit=2000`,
          { headers: serviceHeaders() },
        ),
        // Wave 201: reference_prices fetch — unopened anchor.
        restFetch(
          `${tableUrl("mvp_reference_prices")}?select=comparable_key,effective_price&comparable_key=in.(${keysCsv})&effective_price=not.is.null&limit=500`,
          { headers: serviceHeaders() },
        ),
      ]);
      const refRows = (await refRes.json()) as Array<{ comparable_key: string; effective_price: number }>;
      for (const row of refRows) {
        if (row.effective_price > 0) refPriceMap.set(row.comparable_key, Number(row.effective_price));
      }
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
      const conditionClass = (p.condition_class as string | null) ?? null;
      const marketplaceSource = normalizeMarketplaceSource((r.source as string | null | undefined) ?? (r.seller_source as string | null | undefined));
      const listingUrl = listingUrlForSource(
        pid,
        (r.url as string | null | undefined) ?? (l.url as string | null | undefined),
        marketplaceSource,
      );
      const velocity = comparableKey ? velocityMap.get(comparableKey) ?? null : null;
      const priceStats = comparableKey ? priceMap.get(comparableKey) ?? null : null;
      // Wave 252.A (2026-05-20): band-aware sku_median — (comparable_key, condition_class) 매칭
      //   row 우선, sample 부족 시 condition-fallback chain, 그래도 없으면 raw mvp_listings.sku_median.
      //   사용자 코멘트 id 201/202 (BAPE tee 후드/티 혼합) 근본 fix — admin-pool-browser 화면.
      // Wave 722 / Stage 5 (2026-05-23): shoe/clothing 매물 tier-aware 시세 — 같은 tier row 우선.
      //   D급 매물에 S/A 매물 평균 시세 부여하던 문제 해소.
      const conditionTier = (p.condition_tier as string | null) ?? null;
      const skuMedianFinal = resolveSkuMedianForDisplay(
        bandMap,
        comparableKey,
        conditionClass,
        l.sku_median as number | null | undefined,
        v7SiblingPresence,
        conditionTier,
      );
      return {
        hasComment: note.trim().length > 0,
        commentPreview: note.slice(0, 100),
        commentUpdatedAt: (fb?.updated_at as string | undefined) ?? null,
        pid,
        name: l.name as string ?? "",
        price: Number(l.price ?? 0),
        skuId: (r.sku_id as string | null) ?? null,
        skuName: (l.sku_name as string | null) ?? null,
        skuMedian: skuMedianFinal,
        thumbnailUrl: (l.thumbnail_url as string | null) ?? null,
        bunjangUrl: `https://m.bunjang.co.kr/products/${pid}`,
        listingUrl,
        marketplaceSource,
        marketplaceLabel: marketplaceSourceLabel(marketplaceSource),
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
        // Wave 199: shop_review_* / free_shipping / num_* 는 mvp_raw_listings 에서.
        sellerReviewRating: r.shop_review_rating != null ? Number(r.shop_review_rating) : null,
        sellerReviewCount: r.shop_review_count != null ? Number(r.shop_review_count) : null,
        imageCount: l.image_count != null ? Number(l.image_count) : null,
        freeShipping: Boolean(r.free_shipping),
        numFaved: r.num_faved != null ? Number(r.num_faved) : null,
        numComment: r.num_comment != null ? Number(r.num_comment) : null,
        // Wave 190 (2026-05-17) FIX: score_flags 는 mvp_listing_analysis 에서 (parsed 에 없는 컬럼).
        scoreFlags: Array.isArray(a.score_flags) ? a.score_flags as string[] : [],
        // Wave 182 Phase 3 (2026-05-17): base option fallback — UI "기본 옵션 가정" 표시.
        optionBaseAssumed: (() => {
          const pj = p.parsed_json as Record<string, unknown> | null | undefined;
          const arr = pj?.option_base_assumed;
          return Array.isArray(arr) ? arr as string[] : null;
        })(),
        // Wave 714d (2026-05-23): 신발/의류 5-tier grading + chips.
        conditionTier: (p.condition_tier as string | null) ?? null,
        conditionCluster: (p.condition_cluster as string | null) ?? null,
        conditionConfidence: (p.condition_confidence as number | null) ?? null,
        conditionFlags: (p.condition_flags as Record<string, unknown> | null) ?? null,
        conditionChips: (() => {
          const pj = p.parsed_json as Record<string, unknown> | null | undefined;
          const grade = pj?.condition_grade as { chips?: string[] } | null | undefined;
          return grade?.chips ?? null;
        })(),
        // Wave 187: L6 Liquidity 곡선 입력 — comparable_key 별 velocity + price 분포 (latest row).
        velocityP25Hours: velocity?.p25Hours ?? null,
        velocityMedianHours: velocity?.medianHours ?? null,
        velocityP75Hours: velocity?.p75Hours ?? null,
        velocitySoldSampleCount: velocity?.soldSampleCount ?? null,
        // Wave 201 (2026-05-18): unopened 매물 시 reference_prices anchor 우선 (다나와 새 가격).
        ...(p.condition_class === "unopened" && comparableKey && refPriceMap.has(comparableKey)
          ? { marketP25Price: null, marketMedianPrice: refPriceMap.get(comparableKey)!, marketP75Price: null }
          : { marketP25Price: priceStats?.p25Price ?? null, marketMedianPrice: priceStats?.medianPrice ?? null, marketP75Price: priceStats?.p75Price ?? null }),
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
      byPriceBucket: Array<{ key: string; label: string; ready_count: number }>;
      byCategory: Array<{ category: string; ready_count: number }>;
      bySource: Array<{ source: string; label: string; ready_count: number }>;
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
      const sourceCount = new Map<string, number>();
      if (readyPids.length > 0) {
        // chunk fetch
        const chunkSize = 500;
        for (let i = 0; i < readyPids.length; i += chunkSize) {
          const chunk = readyPids.slice(i, i + chunkSize);
          const [rawRes, listingRes] = await Promise.all([
            restFetch(
              `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,source,seller_source&pid=in.(${chunk.join(",")})`,
              { headers: serviceHeaders() },
            ),
            restFetch(
              `${tableUrl("mvp_listings")}?select=pid,price&pid=in.(${chunk.join(",")})`,
              { headers: serviceHeaders() },
            ),
          ]);
          const rows = (await rawRes.json()) as Array<{ sku_id: string | null; sku_name: string | null; source: string | null; seller_source: string | null }>;
          for (const r of rows) {
            const sku = r.sku_id ?? "(no_sku)";
            const entry = skuCount.get(sku) ?? { name: r.sku_name, count: 0 };
            entry.count += 1;
            if (!entry.name && r.sku_name) entry.name = r.sku_name;
            skuCount.set(sku, entry);
            const source = normalizeMarketplaceSource(r.source ?? r.seller_source);
            sourceCount.set(source, (sourceCount.get(source) ?? 0) + 1);
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
      const bySource = [...sourceCount.entries()]
        .map(([source, count]) => ({ source, label: marketplaceSourceLabel(source), ready_count: count }))
        .sort((a, b) => b.ready_count - a.ready_count);

      stats = { byBandStatus, totals, totalAll, bySku, byPriceBucket, byCategory, bySource };
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
