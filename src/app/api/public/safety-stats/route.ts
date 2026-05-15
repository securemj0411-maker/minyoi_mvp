// Wave 129 (2026-05-16): 위험 매물 차단 카운터 — L4 (사업 보고서).
// "이번 주 위험 매물 X건 차단됨" 사용자 dashboard 표시.
// retention killer — "내 50만원 잃을 뻔한 거 막아줬다" 감정.
import { NextResponse } from "next/server";
import { restFetch, serviceHeaders } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const URL_BASE = SUPABASE_URL.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";

function rpc(path: string, query: string) {
  return `${URL_BASE}/${path}?${query}`;
}

export async function GET() {
  try {
    const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    // Wave 139 (2026-05-16): 도매/사기 그룹 차단 카운터 추가 (Wave 132/137/138a/138b).
    // 사용자 retention: "와, 이 사이트 진짜 사기/업자도 걸러내는구나" UI 신뢰 시그널.
    // 2026-05-16 (사용자 코멘트 후속): 폰 치우침 → generalize + 차단 사유 더 보강 (차익 미달, 매물 사라짐, 시세 신뢰).
    // 2026-05-16 (2차 후속): listing_type/needs_review 추가 — 진짜 차단 source ~35K (지금 표시 ~2.4K의 15배).
    const [
      priceDummyRes, fakeLockRes, carrierRes, poolInvalidateRes,
      wholesalerCommentRes, wholesalerQtyRes, sellerMultiRes, multiIdFraudRes,
      profitLowRes, lifecycleGoneRes, thinMarketRes, statMissingRes, suspiciousPriceRes,
      // 수집 단계 차단 (listing_type)
      listingPartsRes, listingDamagedRes, listingAccessoryRes,
      listingCalloutRes, listingCommercialRes, listingBuyingRes, listingMultiRes,
      // 파싱 단계 차단 (needs_review)
      needsReviewRes,
    ] = await Promise.all([
      // 1) 가격 dummy (셀러 거래 거부 표시 매물)
      restFetch(
        rpc("mvp_raw_listings", `select=pid&price=gte.10000000&first_seen_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 2) 가품/잠금 keyword 매물
      restFetch(
        rpc("mvp_raw_listings", `select=pid&first_seen_at=gte.${since7d}&or=(name.ilike.*차이팟*,name.ilike.*짝퉁*,name.ilike.*레플리카*,name.ilike.*이미테이션*,name.ilike.*아이클라우드*,name.ilike.*잠김*,name.ilike.*분실폰*)`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 3) 통신사 약정/할부 매물 (자급제 lane reject)
      restFetch(
        rpc("mvp_raw_listings", `select=pid&first_seen_at=gte.${since7d}&or=(name.ilike.*kt%20약정*,name.ilike.*skt%20완납*,name.ilike.*할부%20잔여*,name.ilike.*개통폰*)`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 4) pool invalidate (lifecycle/profit/시세 confidence) — Wave 132/137/138 reason 모두 포함
      restFetch(
        rpc("mvp_candidate_pool", `select=pid&invalidated_reason=not.is.null&updated_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 5) Wave 132: 댓글 ≥ 8 차단 (호가-실거래 괴리 = 흥정 사기)
      restFetch(
        rpc("mvp_candidate_pool", `select=pid&invalidated_reason=like.num_comment_above*&updated_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 6) Wave 137: qty > 1 차단 (대량 판매업자)
      restFetch(
        rpc("mvp_candidate_pool", `select=pid&invalidated_reason=like.qty_above*&updated_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 7) Wave 138a: 같은 셀러 다수 매물 차단 (qty 위장 업자)
      restFetch(
        rpc("mvp_candidate_pool", `select=pid&invalidated_reason=like.seller_above*&updated_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 8) Wave 138b: 다중 ID 사기 그룹 차단 (같은 description + 다른 셀러)
      restFetch(
        rpc("mvp_candidate_pool", `select=pid&invalidated_reason=like.multi_id_fraud*&updated_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 9) 차익 미달 (profit_below_pack_band) — 가장 큰 카테고리. 모든 카테고리.
      restFetch(
        rpc("mvp_candidate_pool", `select=pid&invalidated_reason=eq.profit_below_pack_band&updated_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 10) 매물 사라짐/거래 종료 (lifecycle_* + pool_warmer_*_inactive). 모든 카테고리.
      restFetch(
        rpc("mvp_candidate_pool", `select=pid&or=(invalidated_reason.like.lifecycle_*,invalidated_reason.like.pool_warmer_*_inactive,invalidated_reason.like.pool_sweep_*_inactive)&updated_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 11) 시세 표본 부족 (wave99_thin_market + wave106_low_confidence_thin_sample)
      restFetch(
        rpc("mvp_candidate_pool", `select=pid&or=(invalidated_reason.eq.wave99_thin_market_n_lt_5,invalidated_reason.eq.wave106_low_confidence_thin_sample)&updated_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 12) 시세 신뢰 부족 (blocked_coarse_market_price + blocked_market_stat_missing)
      restFetch(
        rpc("mvp_candidate_pool", `select=pid&or=(invalidated_reason.eq.blocked_coarse_market_price,invalidated_reason.eq.blocked_market_stat_missing)&updated_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 13) 의심 가격 매물 (blocked_deep_discount + blocked_extreme_discount review)
      restFetch(
        rpc("mvp_candidate_pool", `select=pid&or=(invalidated_reason.eq.blocked_deep_discount_review,invalidated_reason.eq.blocked_extreme_discount_review)&updated_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 14) 수집 단계 차단 — listing_type=parts (부품만 매물)
      restFetch(
        rpc("mvp_raw_listings", `select=pid&listing_type=eq.parts&first_seen_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 15) listing_type=damaged (손상 매물)
      restFetch(
        rpc("mvp_raw_listings", `select=pid&listing_type=eq.damaged&first_seen_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 16) listing_type=accessory (액세서리/구성품만)
      restFetch(
        rpc("mvp_raw_listings", `select=pid&listing_type=eq.accessory&first_seen_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 17) listing_type=callout (광고/매크로/홍보)
      restFetch(
        rpc("mvp_raw_listings", `select=pid&listing_type=eq.callout&first_seen_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 18) listing_type=commercial (업자/상업 매물)
      restFetch(
        rpc("mvp_raw_listings", `select=pid&listing_type=eq.commercial&first_seen_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 19) listing_type=buying (매입 글)
      restFetch(
        rpc("mvp_raw_listings", `select=pid&listing_type=eq.buying&first_seen_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 20) listing_type=multi (다중 상품 묶음)
      restFetch(
        rpc("mvp_raw_listings", `select=pid&listing_type=eq.multi&first_seen_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 21) needs_review (파싱 단계 — 모델 식별 실패. listing_parsed JOIN)
      restFetch(
        rpc("mvp_listing_parsed", `select=pid&needs_review=eq.true&parsed_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
    ]);

    const parseCount = (res: Response): number => {
      const range = res.headers.get("content-range") ?? "";
      const totalStr = range.split("/")[1];
      return totalStr ? Number(totalStr) : 0;
    };

    const priceDummy = parseCount(priceDummyRes);
    const fakeLock = parseCount(fakeLockRes);
    const carrier = parseCount(carrierRes);
    const poolInvalidate = parseCount(poolInvalidateRes);
    // Wave 139: 도매/사기 그룹 4종
    const wholesalerComment = parseCount(wholesalerCommentRes);
    const wholesalerQty = parseCount(wholesalerQtyRes);
    const sellerMulti = parseCount(sellerMultiRes);
    const multiIdFraud = parseCount(multiIdFraudRes);
    const wholesalerTotal = wholesalerComment + wholesalerQty + sellerMulti + multiIdFraud;
    // 2026-05-16: generalize 항목 (모든 카테고리 적용)
    const profitLow = parseCount(profitLowRes);
    const lifecycleGone = parseCount(lifecycleGoneRes);
    const thinMarket = parseCount(thinMarketRes);
    const statMissing = parseCount(statMissingRes);
    const suspiciousPrice = parseCount(suspiciousPriceRes);
    // 2026-05-16 (2차): 수집 단계 차단 (listing_type)
    const listingParts = parseCount(listingPartsRes);
    const listingDamaged = parseCount(listingDamagedRes);
    const listingAccessory = parseCount(listingAccessoryRes);
    const listingCallout = parseCount(listingCalloutRes);
    const listingCommercial = parseCount(listingCommercialRes);
    const listingBuying = parseCount(listingBuyingRes);
    const listingMulti = parseCount(listingMultiRes);
    const collectionStageTotal = listingParts + listingDamaged + listingAccessory +
      listingCallout + listingCommercial + listingBuying + listingMulti;
    // 2026-05-16 (2차): 파싱 단계 차단
    const needsReview = parseCount(needsReviewRes);

    const safetyTotal = priceDummy + fakeLock + carrier;
    // 2026-05-16 (2차): 진짜 차단 total — 수집 + 파싱 + 풀 단계 모두 합산.
    // 사용자 코멘트: "invalidate도 차단이고, 진짜 차단 수 훨씬 큼".
    const totalBlocked7d = safetyTotal + collectionStageTotal + needsReview + poolInvalidate;

    return NextResponse.json({
      stats: {
        // 사용자 표시용 핵심 숫자 — 이번 주 차단 매물 총합
        total_blocked_7d: totalBlocked7d,
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
        // 메타
        period_start: since7d,
        period_end: new Date().toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 500 },
    );
  }
}
