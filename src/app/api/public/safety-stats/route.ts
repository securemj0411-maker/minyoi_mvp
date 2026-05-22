// Wave 129 (2026-05-16): 위험 매물 차단 카운터 — L4 (사업 보고서).
// "이번 주 위험 매물 X건 차단됨" 사용자 dashboard 표시.
// retention killer — "내 50만원 잃을 뻔한 거 막아줬다" 감정.
import { NextResponse } from "next/server";
import { categoryFromComparableKey } from "@/lib/category-readiness";
import { restFetch, serviceHeaders } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SAFETY_STATS_CACHE_TTL_MS = 30 * 60 * 1000;
const SAFETY_STATS_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
};
const safetyStatsCache = new Map<string, { expiresAt: number; payload: unknown }>();

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const URL_BASE = SUPABASE_URL.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";

function rpc(path: string, query: string) {
  return `${URL_BASE}/${path}?${query}`;
}

type SafetyStatsScope = {
  skuId: string | null;
  comparableKey: string | null;
  category: string | null;
  level: "lane" | "sku" | "category" | "global";
};

function normalizeScopeValue(value: string | null) {
  const normalized = value?.trim() ?? "";
  if (!normalized || normalized.length > 180) return null;
  return /^[a-z0-9_.|\-]+$/i.test(normalized) ? normalized : null;
}

function safetyStatsScope(request: Request): SafetyStatsScope {
  const url = new URL(request.url);
  const skuId = normalizeScopeValue(url.searchParams.get("skuId"));
  const comparableKey = normalizeScopeValue(url.searchParams.get("comparableKey"));
  const categoryParam = normalizeScopeValue(url.searchParams.get("category"));
  const category = categoryFromComparableKey(categoryParam) ?? categoryFromComparableKey(comparableKey) ?? null;
  const level = comparableKey ? "lane" : skuId ? "sku" : category ? "category" : "global";
  return { skuId, comparableKey, category, level };
}

function eqFilter(column: string, value: string | null) {
  return value ? `&${column}=eq.${encodeURIComponent(value)}` : "";
}

function rawScopeFilter(scope: SafetyStatsScope) {
  if (scope.level === "global") return "";
  return scope.skuId ? eqFilter("sku_id", scope.skuId) : null;
}

function poolScopeFilter(scope: SafetyStatsScope) {
  if (scope.level === "global") return "";
  if (scope.comparableKey) return eqFilter("comparable_key", scope.comparableKey);
  if (scope.category) return eqFilter("category", scope.category);
  return null;
}

function parsedScopeFilter(scope: SafetyStatsScope) {
  if (scope.level === "global") return "";
  if (scope.comparableKey) return eqFilter("comparable_key", scope.comparableKey);
  if (scope.category) return eqFilter("category", scope.category);
  return null;
}

function parseCount(res: Response): number {
  const range = res.headers.get("content-range") ?? "";
  const totalStr = range.split("/")[1];
  return totalStr ? Number(totalStr) : 0;
}

function safetyStatsCacheKey(scope: SafetyStatsScope) {
  return [
    "v2",
    scope.level,
    scope.skuId ?? "",
    scope.comparableKey ?? "",
    scope.category ?? "",
  ].join(":");
}

function safetyStatsJson(payload: unknown, cache: "hit" | "miss") {
  return NextResponse.json(payload, {
    headers: {
      ...SAFETY_STATS_CACHE_HEADERS,
      "x-minyoi-safety-stats-cache": cache,
    },
  });
}

export async function GET(request: Request) {
  try {
    // 2026-05-16 (사용자 코멘트): "이번 주 말고 오늘" — 24h window로 변경.
    // 24h 측정: listing_type 6.4K + needs_review 0.9K + pool invalidated 1.3K = ~8,600건 차단/일.
    // 사용자에게 "오늘만 N건 차단" 인상 강력 (예: "하루에 8천건을 어떻게 다 걸러내냐").
    const scope = safetyStatsScope(request);
    const cacheKey = safetyStatsCacheKey(scope);
    // Wave launch-62: warmer cron 의 cache bypass. _warmer param 또는 header 시 fresh count.
    const url = new URL(request.url);
    const bypassCache = url.searchParams.get("_warmer") != null || request.headers.get("x-minyoi-warmer") === "1";
    const cached = !bypassCache ? safetyStatsCache.get(cacheKey) : null;
    if (cached && cached.expiresAt > Date.now()) {
      return safetyStatsJson(cached.payload, "hit");
    }

    // Wave launch-62 (사용자 짚음 "cron 으로 캐싱해서 바로 보여줄 수 없냐"):
    //   DB snapshot table read 우선. cron 이 매 30분 채워둠.
    //   사용자 첫 visit (in-memory cache miss) 라도 DB row read 1번이면 즉시 응답.
    //   global scope (level=global) 만 DB cache — scoped query 는 user-specific 라 live 유지.
    if (scope.level === "global" && !bypassCache) {
      try {
        const snapRes = await restFetch(
          `${URL_BASE}/mvp_safety_stats_snapshot?select=payload,updated_at&scope_key=eq.${encodeURIComponent(cacheKey)}&limit=1`,
          { headers: serviceHeaders() },
        );
        const rows = (await snapRes.json()) as Array<{ payload: unknown; updated_at: string }>;
        if (rows[0]?.payload) {
          // in-memory cache 도 채워서 다음 호출 빠르게
          safetyStatsCache.set(cacheKey, {
            expiresAt: Date.now() + SAFETY_STATS_CACHE_TTL_MS,
            payload: rows[0].payload,
          });
          return safetyStatsJson(rows[0].payload, "hit");
        }
      } catch (err) {
        console.warn("[safety-stats] snapshot read failed, falling back to live", err instanceof Error ? err.message : err);
      }
    }

    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const rawFilter = rawScopeFilter(scope);
    const poolFilter = poolScopeFilter(scope);
    const parsedFilter = parsedScopeFilter(scope);
    const scoped = scope.level !== "global";
    // 첫 온보딩 global 통계는 정확한 과금/정산 숫자가 아니라 value hook이다.
    // global exact count 20+개가 느려지면 화면이 "확인 중"에 머무르므로 planned count로 낮춘다.
    const countPreference = scoped ? "count=exact" : "count=planned";
    const countHead = async (path: string, query: string | null) => {
      if (query == null) return 0;
      const res = await restFetch(
        rpc(path, query),
        { headers: { ...serviceHeaders(), Prefer: countPreference }, method: "HEAD" },
      );
      return parseCount(res);
    };
    const rawQuery = (query: string) => rawFilter == null ? null : `${query}${rawFilter}`;
    const poolQuery = (query: string) => poolFilter == null ? null : `${query}${poolFilter}`;
    const parsedQuery = (query: string) => parsedFilter == null ? null : `${query}${parsedFilter}`;

    // Wave 139 (2026-05-16): 도매/사기 그룹 차단 카운터 추가 (Wave 132/137/138a/138b).
    // 사용자 retention: "와, 이 사이트 진짜 사기/업자도 걸러내는구나" UI 신뢰 시그널.
    // 2026-05-16 (사용자 코멘트 후속): 폰 치우침 → generalize + 차단 사유 더 보강 (차익 미달, 매물 사라짐, 시세 신뢰).
    // 2026-05-16 (2차 후속): listing_type/needs_review 추가 — 진짜 차단 source ~35K (지금 표시 ~2.4K의 15배).
    const [
      priceDummy, fakeLock, carrier, poolInvalidate,
      wholesalerComment, wholesalerQty, sellerMulti, multiIdFraud,
      profitLow, lifecycleGone, thinMarket, statMissing, suspiciousPrice,
      // 수집 단계 차단 (listing_type)
      listingParts, listingDamaged, listingAccessory,
      listingCallout, listingCommercial, listingBuying, listingMulti,
      // 파싱 단계 차단 (needs_review)
      needsReview,
      // 전체 후보 모수: "전체 X건 중 Y건" 표시용. pool 기준 live/rejected 후보를 함께 본다.
      poolReviewed,
    ] = await Promise.all([
      // 1) 가격 dummy (셀러 거래 거부 표시 매물)
      countHead("mvp_raw_listings", rawQuery(`select=pid&price=gte.10000000&first_seen_at=gte.${since24h}`)),
      // 2) 가품/잠금 keyword 매물
      countHead("mvp_raw_listings", rawQuery(`select=pid&first_seen_at=gte.${since24h}&or=(name.ilike.*차이팟*,name.ilike.*짝퉁*,name.ilike.*레플리카*,name.ilike.*이미테이션*,name.ilike.*아이클라우드*,name.ilike.*잠김*,name.ilike.*분실폰*)`)),
      // 3) 통신사 약정/할부 매물 (자급제 lane reject)
      countHead("mvp_raw_listings", rawQuery(`select=pid&first_seen_at=gte.${since24h}&or=(name.ilike.*kt%20약정*,name.ilike.*skt%20완납*,name.ilike.*할부%20잔여*,name.ilike.*개통폰*)`)),
      // 4) pool invalidate (lifecycle/profit/시세 confidence) — Wave 132/137/138 reason 모두 포함
      countHead("mvp_candidate_pool", poolQuery(`select=pid&invalidated_reason=not.is.null&updated_at=gte.${since24h}`)),
      // 5) Wave 132: 댓글 ≥ 8 차단 (호가-실거래 괴리 = 흥정 사기)
      countHead("mvp_candidate_pool", poolQuery(`select=pid&invalidated_reason=like.num_comment_above*&updated_at=gte.${since24h}`)),
      // 6) Wave 137: qty > 1 차단 (대량 판매업자)
      countHead("mvp_candidate_pool", poolQuery(`select=pid&invalidated_reason=like.qty_above*&updated_at=gte.${since24h}`)),
      // 7) Wave 138a: 같은 셀러 다수 매물 차단 (qty 위장 업자)
      countHead("mvp_candidate_pool", poolQuery(`select=pid&invalidated_reason=like.seller_above*&updated_at=gte.${since24h}`)),
      // 8) Wave 138b: 다중 ID 사기 그룹 차단 (같은 description + 다른 셀러)
      countHead("mvp_candidate_pool", poolQuery(`select=pid&invalidated_reason=like.multi_id_fraud*&updated_at=gte.${since24h}`)),
      // 9) 차익 미달 (profit_below_pack_band) — 가장 큰 카테고리. 모든 카테고리.
      countHead("mvp_candidate_pool", poolQuery(`select=pid&invalidated_reason=eq.profit_below_pack_band&updated_at=gte.${since24h}`)),
      // 10) 매물 사라짐/거래 종료 (lifecycle_* + pool_warmer_*_inactive). 모든 카테고리.
      countHead("mvp_candidate_pool", poolQuery(`select=pid&or=(invalidated_reason.like.lifecycle_*,invalidated_reason.like.pool_warmer_*_inactive,invalidated_reason.like.pool_sweep_*_inactive)&updated_at=gte.${since24h}`)),
      // 11) 시세 표본 부족 (wave99_thin_market + wave106_low_confidence_thin_sample)
      countHead("mvp_candidate_pool", poolQuery(`select=pid&or=(invalidated_reason.eq.wave99_thin_market_n_lt_5,invalidated_reason.eq.wave106_low_confidence_thin_sample)&updated_at=gte.${since24h}`)),
      // 12) 시세 신뢰 부족 (blocked_coarse_market_price + blocked_market_stat_missing)
      countHead("mvp_candidate_pool", poolQuery(`select=pid&or=(invalidated_reason.eq.blocked_coarse_market_price,invalidated_reason.eq.blocked_market_stat_missing)&updated_at=gte.${since24h}`)),
      // 13) 의심 가격 매물 (blocked_deep_discount + blocked_extreme_discount review)
      countHead("mvp_candidate_pool", poolQuery(`select=pid&or=(invalidated_reason.eq.blocked_deep_discount_review,invalidated_reason.eq.blocked_extreme_discount_review)&updated_at=gte.${since24h}`)),
      // 14) 수집 단계 차단 — listing_type=parts (부품만 매물)
      countHead("mvp_raw_listings", rawQuery(`select=pid&listing_type=eq.parts&first_seen_at=gte.${since24h}`)),
      // 15) listing_type=damaged (손상 매물)
      countHead("mvp_raw_listings", rawQuery(`select=pid&listing_type=eq.damaged&first_seen_at=gte.${since24h}`)),
      // 16) listing_type=accessory (액세서리/구성품만)
      countHead("mvp_raw_listings", rawQuery(`select=pid&listing_type=eq.accessory&first_seen_at=gte.${since24h}`)),
      // 17) listing_type=callout (광고/매크로/홍보)
      countHead("mvp_raw_listings", rawQuery(`select=pid&listing_type=eq.callout&first_seen_at=gte.${since24h}`)),
      // 18) listing_type=commercial (업자/상업 매물)
      countHead("mvp_raw_listings", rawQuery(`select=pid&listing_type=eq.commercial&first_seen_at=gte.${since24h}`)),
      // 19) listing_type=buying (매입 글)
      countHead("mvp_raw_listings", rawQuery(`select=pid&listing_type=eq.buying&first_seen_at=gte.${since24h}`)),
      // 20) listing_type=multi (다중 상품 묶음)
      countHead("mvp_raw_listings", rawQuery(`select=pid&listing_type=eq.multi&first_seen_at=gte.${since24h}`)),
      // 21) needs_review (파싱 단계 — 모델 식별 실패. listing_parsed JOIN)
      countHead("mvp_listing_parsed", parsedQuery(`select=pid&needs_review=eq.true&parsed_at=gte.${since24h}`)),
      // 22) 추천 후보 pool 전체 모수 (표시용 denominator)
      countHead("mvp_candidate_pool", poolQuery(`select=pid&updated_at=gte.${since24h}`)),
    ]);

    const wholesalerTotal = wholesalerComment + wholesalerQty + sellerMulti + multiIdFraud;
    const collectionStageTotal = listingParts + listingDamaged + listingAccessory +
      listingCallout + listingCommercial + listingBuying + listingMulti;

    const safetyTotal = priceDummy + fakeLock + carrier;
    // 2026-05-16 (2차): 진짜 차단 total — 수집 + 파싱 + 풀 단계 모두 합산.
    // 사용자 코멘트: "invalidate도 차단이고, 진짜 차단 수 훨씬 큼".
    const totalBlocked7d = safetyTotal + collectionStageTotal + needsReview + poolInvalidate;
    const totalReviewed7d = Math.max(poolReviewed + safetyTotal + collectionStageTotal + needsReview, totalBlocked7d);

    const payload = {
      stats: {
        // 사용자 표시용 핵심 숫자 — 이번 주 차단 매물 총합
        total_blocked_7d: totalBlocked7d,
        total_reviewed_7d: totalReviewed7d,
        // 카테고리별 breakdown
        price_dummy_7d: priceDummy,
        fake_or_lock_7d: fakeLock,
        carrier_mismatch_7d: carrier,
        pool_invalidated_7d: poolInvalidate,
        // Wave 139 (2026-05-16): 도매 업자/사기 그룹 breakdown
        wholesaler_total_7d: wholesalerTotal,
        wholesaler_comment_7d: wholesalerComment,
        wholesaler_qty_7d: wholesalerQty,
        seller_multi_listings_7d: sellerMulti,
        multi_id_fraud_group_7d: multiIdFraud,
        // 2026-05-16: generalize breakdown (모든 카테고리)
        profit_low_7d: profitLow,
        lifecycle_gone_7d: lifecycleGone,
        thin_market_7d: thinMarket,
        stat_missing_7d: statMissing,
        suspicious_price_7d: suspiciousPrice,
        // 2026-05-16 (2차): 수집 단계 + 파싱 단계 차단 (진짜 큰 카테고리)
        collection_stage_total_7d: collectionStageTotal,
        listing_parts_7d: listingParts,
        listing_damaged_7d: listingDamaged,
        listing_accessory_7d: listingAccessory,
        listing_callout_7d: listingCallout,
        listing_commercial_7d: listingCommercial,
        listing_buying_7d: listingBuying,
        listing_multi_7d: listingMulti,
        needs_review_7d: needsReview,
        scope: scoped
          ? {
              level: scope.level,
              sku_id: scope.skuId,
              comparable_key: scope.comparableKey,
              category: scope.category,
              raw_scoped: rawFilter != null,
              pool_scoped: poolFilter != null,
              parsed_scoped: parsedFilter != null,
            }
          : null,
        // 메타
        period_start: since24h,
        period_end: new Date().toISOString(),
      },
    };
    safetyStatsCache.set(cacheKey, {
      expiresAt: Date.now() + SAFETY_STATS_CACHE_TTL_MS,
      payload,
    });
    return safetyStatsJson(payload, "miss");
  } catch (err) {
    // Wave 184 (2026-05-17): public endpoint — err.message 노출 차단.
    // 이전: err.message 가 response 에 직접 박혀 DB schema / internal path leak 가능.
    console.error("[public/safety-stats] failed", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "safety_stats_failed", message: "안전 지표를 불러오지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
