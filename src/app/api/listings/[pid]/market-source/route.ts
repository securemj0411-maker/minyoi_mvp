// Wave 90 (2026-05-15): 시세 근거 디버그 API.
// 사용자 매물 (reveal 됐던 매물) 대상으로 시세 산정의 근거 매물 list + 통계 반환.
// 목적: 사용자가 매물 검증 시 "이 시세가 어떤 매물 기준으로 계산됐는지" 확인 가능하게.
//
// 2026-05-15 update: auth/권한 체크 제거. 베타 풀 페이지(/peek-pool-7f3kz9)에서도 호출 가능.
// pid 알면 누구나 접근. 의도된 변경 (시세 투명성).
// 2026-05-16: rate limit 추가. pid enumeration abuse 차단. IP 기반 60 req / 60s.

import { NextResponse } from "next/server";
import { checkRateLimit, clientIpKey } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 2026-05-16 (사용자 코멘트 #96 pid 407759980): 비교군 list 에 active 만 보이고 sold 안 보임.
// raw 에 sale_status/listing_state 있는데 limit 30 으로 잘림 → active 가 다 차지하면 sold 0건.
// limit 80 으로 늘려 active + sold + disappeared 다 표시. UI 가 saleStatus 표시 이미 있음.
const MAX_COMPARABLES = 80;

type Comparable = {
  pid: number;
  name: string;
  price: number;
  thumbnailUrl: string | null;
  saleStatus: string | null;
  listingState: string | null;
  lastSeenAt: string | null;
  sourceQuery: string | null;
  bunjangUrl: string;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ pid: string }> },
) {
  // 2026-05-15: auth/권한 체크 제거. 베타 풀 페이지(/peek-pool-7f3kz9)에서도
  // 시세 근거 보기 가능하도록 public read-only. pid 알면 누구나 접근.
  const { pid: pidStr } = await params;
  const pid = Number(pidStr);
  if (!Number.isFinite(pid)) return NextResponse.json({ error: "invalid pid" }, { status: 400 });

  // 2026-05-16: rate limit. pid enumeration abuse 차단 (시세 근거 fetch는 쿼리 무거움).
  const rate = await checkRateLimit({
    bucketKey: `market-source:${clientIpKey(req)}`,
    maxRequests: 60,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    // 우리 매물 정보 + comparable_key (sku_id는 mvp_raw_listings에만 존재)
    const [listingRes, parsedRes, rawRes] = await Promise.all([
      restFetch(
        `${tableUrl("mvp_listings")}?select=pid,name,price,sku_name,sku_median&pid=eq.${pid}`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        // Wave 130 (2026-05-16): condition_class 추가 — 시세 stats를 매칭 condition으로 조회.
        `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,parse_confidence,needs_review,condition_class&pid=eq.${pid}`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,thumbnail_url,sale_status,listing_state,last_seen_at,query&pid=eq.${pid}`,
        { headers: serviceHeaders() },
      ),
    ]);
    const listing = ((await listingRes.json()) as Array<Record<string, unknown>>)[0];
    const parsed = ((await parsedRes.json()) as Array<Record<string, unknown>>)[0];
    const raw = ((await rawRes.json()) as Array<Record<string, unknown>>)[0];

    if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });

    const comparableKey = (parsed?.comparable_key as string | null) ?? null;
    const conditionClass = (parsed?.condition_class as string | null) ?? null;
    const skuId = (raw?.sku_id as string | null) ?? null;

    // 3. market_price_daily 시세 통계 (comparable_key 기준)
    // Wave 130 (2026-05-16): condition_class별 시세 분리 — 매물 condition에 매칭되는 시세 우선.
    let marketStats: Record<string, unknown> | null = null;
    if (comparableKey) {
      // 모든 condition_class row 가져온 후 매물 condition 우선 매칭. fallback: normal → all → 아무거나.
      const statsRes = await restFetch(
        `${tableUrl("mvp_market_price_daily")}?select=comparable_key,condition_class,blended_median_price,active_median_price,p25_price,p75_price,active_sample_count,sold_sample_count,disappeared_sample_count,confidence,computed_at&comparable_key=eq.${encodeURIComponent(comparableKey)}&order=date.desc,computed_at.desc&limit=12`,
        { headers: serviceHeaders() },
      );
      const rows = (await statsRes.json()) as Array<Record<string, unknown>>;
      const target = conditionClass ?? "normal";
      const fallback = [target, "normal", "all", "clean", "worn", "mint"];
      for (const cls of fallback) {
        const candidate = rows.find((r) => r.condition_class === cls);
        if (candidate) {
          marketStats = candidate;
          break;
        }
      }
      // fallback 다 실패 시 첫 row (있다면)
      marketStats = marketStats ?? (rows[0] ?? null);
    }

    // 4. comparable 매물 list — 같은 comparable_key 또는 sku_id 기반 fetch
    // Strategy A: comparable_key 기준 (정확). listing_parsed에서 pid 가져와 raw_listings join.
    let comparables: Comparable[] = [];
    if (comparableKey) {
      // listing_parsed limit 더 크게 — sold 매물도 비교군에 들어갈 자리 확보 (#96).
      const sameKeyPidsRes = await restFetch(
        `${tableUrl("mvp_listing_parsed")}?select=pid&comparable_key=eq.${encodeURIComponent(comparableKey)}&needs_review=eq.false&limit=${MAX_COMPARABLES + 20}`,
        { headers: serviceHeaders() },
      );
      const sameKeyPids = ((await sameKeyPidsRes.json()) as Array<{ pid: number }>)
        .map((r) => Number(r.pid))
        .filter((p) => Number.isFinite(p) && p !== pid)
        .slice(0, MAX_COMPARABLES);
      if (sameKeyPids.length > 0) {
        // Wave 90: listing_type=normal + risk_hits=0 + 새상품 제외 필터.
        const [rawListRes, analysisRes, parsedRes2] = await Promise.all([
          restFetch(
            `${tableUrl("mvp_raw_listings")}?select=pid,name,price,thumbnail_url,sale_status,listing_state,last_seen_at,query&pid=in.(${sameKeyPids.join(",")})&listing_type=eq.normal&order=last_seen_at.desc`,
            { headers: serviceHeaders() },
          ),
          restFetch(
            `${tableUrl("mvp_listing_analysis")}?select=pid,risk_hits&pid=in.(${sameKeyPids.join(",")})`,
            { headers: serviceHeaders() },
          ),
          restFetch(
            `${tableUrl("mvp_listing_parsed")}?select=pid,parsed_json,condition_class&pid=in.(${sameKeyPids.join(",")})`,
            { headers: serviceHeaders() },
          ),
        ]);
        const rawRows = (await rawListRes.json()) as Array<Record<string, unknown>>;
        const analysisRows = (await analysisRes.json()) as Array<{ pid: number; risk_hits: number }>;
        const parsedRowsForCond = (await parsedRes2.json()) as Array<{ pid: number; parsed_json: Record<string, unknown> | null; condition_class: string | null }>;
        const riskByPid = new Map(analysisRows.map((r) => [Number(r.pid), Number(r.risk_hits ?? 0)]));
        const excludeByPid = new Map<number, boolean>();
        // 2026-05-16 (사용자 코멘트 #92 pid 406610698): 비교군 UI 제외 list 가 tick-pipeline 시세 sample
        // 제외 list 와 불일치 — 시세 계산은 정확한데 사용자 디버깅 화면에는 그 매물 그대로 표시 = 헷갈림.
        // tick-pipeline.ts:2469~2493 와 동기화 — 8가지 condition_notes 다 제외.
        const COMPARABLE_EXCLUDE_NOTES = [
          "new_or_open_box", "low_battery_health", "applecare_premium",
          "accessory_bundle", "full_set", "multi_device_bundle",
          "display_defect", "screen_replaced", "faceid_issue", "parts_only",
        ];
        // 2026-05-16 (사용자 코멘트 #95 pid 406094154): 본 매물 = "사용감 많음" (worn) 인데 비교군에 mint 매물.
        // wave 130 condition_class 시세 분리는 작동하지만 비교군 UI 가 condition 무관 다 표시 = 사용자 헷갈림.
        // 본 매물 condition_class 와 같은 class 매물만 비교군 list 표시. null 이면 필터 안 함 (옛 매물 호환).
        for (const p of parsedRowsForCond) {
          const notes = (p.parsed_json?.condition_notes as string[] | undefined) ?? [];
          if (COMPARABLE_EXCLUDE_NOTES.some((n) => notes.includes(n))) {
            excludeByPid.set(Number(p.pid), true);
            continue;
          }
          // condition_class 분리: 본 매물 cc != null && 비교 매물 cc != 본 매물 cc → exclude.
          if (conditionClass != null && p.condition_class != null && p.condition_class !== conditionClass) {
            excludeByPid.set(Number(p.pid), true);
            continue;
          }
          excludeByPid.set(Number(p.pid), false);
        }
        const safeRows = rawRows.filter((r) => {
          const pid = Number(r.pid);
          if ((riskByPid.get(pid) ?? 0) > 0) return false;
          if (excludeByPid.get(pid) === true) return false;
          return true;
        });
        comparables = safeRows.map((row) => ({
          pid: Number(row.pid),
          name: String(row.name ?? ""),
          price: Number(row.price ?? 0),
          thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
          saleStatus: (row.sale_status as string | null) ?? null,
          listingState: (row.listing_state as string | null) ?? null,
          lastSeenAt: (row.last_seen_at as string | null) ?? null,
          sourceQuery: (row.query as string | null) ?? null,
          bunjangUrl: `https://m.bunjang.co.kr/products/${Number(row.pid)}`,
        }));
      }
    }

    // §12b 정확성 우선: sku_id fallback 제거 (broad SKU 풀 = 다른 세대/사이즈 섞임).
    // comparable_key 매물 0개면 "비교군 없음"으로 정직하게 표시.
    const comparableSource: "comparable_key" | "none" = comparables.length > 0 ? "comparable_key" : "none";

    // 6. 실시간 통계 (현재 fetch한 active 매물 기준)
    const activePrices = comparables
      .filter((c) => c.listingState === "active" && c.price > 0)
      .map((c) => c.price)
      .sort((a, b) => a - b);
    const liveStats = activePrices.length > 0 ? {
      activeCount: activePrices.length,
      min: activePrices[0],
      p25: activePrices[Math.floor(activePrices.length * 0.25)],
      median: activePrices[Math.floor(activePrices.length * 0.5)],
      p75: activePrices[Math.floor(activePrices.length * 0.75)],
      max: activePrices[activePrices.length - 1],
      mean: Math.round(activePrices.reduce((s, p) => s + p, 0) / activePrices.length),
    } : null;

    return NextResponse.json({
      ourListing: {
        pid,
        name: (listing.name as string) ?? "",
        price: Number(listing.price ?? 0),
        skuId,
        skuName: (listing.sku_name as string | null) ?? null,
        skuMedian: Number(listing.sku_median ?? 0),
        comparableKey,
        parseConfidence: Number(parsed?.parse_confidence ?? 0) || null,
        needsReview: Boolean(parsed?.needs_review),
        thumbnailUrl: (raw?.thumbnail_url as string | null) ?? null,
        bunjangUrl: `https://m.bunjang.co.kr/products/${pid}`,
      },
      marketDailyStats: marketStats ? {
        blendedMedian: marketStats.blended_median_price ?? null,
        activeMedian: marketStats.active_median_price ?? null,
        p25: marketStats.p25_price ?? null,
        p75: marketStats.p75_price ?? null,
        activeCount: marketStats.active_sample_count ?? null,
        soldCount: marketStats.sold_sample_count ?? null,
        disappearedCount: marketStats.disappeared_sample_count ?? null,
        confidence: marketStats.confidence ?? null,
        computedAt: marketStats.computed_at ?? null,
      } : null,
      comparableSource,
      comparables,
      liveStats,
    });
  } catch (err) {
    // Wave 106: raw err.message 누출 차단.
    console.error("[market-source] error", err);
    return NextResponse.json(
      { error: "market_source_failed", message: "시세 정보를 불러오지 못했어요." },
      { status: 500 },
    );
  }
}
