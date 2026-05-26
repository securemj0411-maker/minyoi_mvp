import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { fetchDetail } from "@/lib/bunjang";
import { consumeDetailAccess } from "@/lib/detail-access";
import { isBetaTesterAuthId } from "@/lib/beta-tester";
import { fetchJoongnaDetail } from "@/lib/joongna";
import { isDaangnMarketplaceSource, isJoongnaMarketplaceSource, listingUrlForSource, marketplaceSourceLabel, normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { inferMarketplaceTransaction, marketplaceFactsFromRawJson, marketplaceLocationCombinedWithRegion } from "@/lib/marketplace-safety";
import { classifyListing } from "@/lib/pipeline";
import { decodePoolAccessToken } from "@/lib/pool-access-token";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { detectSoldOut, describeSignals, isSoldOut, soldOutTextHits } from "@/lib/sold-out";
import { safeThumbnailUrl } from "@/lib/thumbnail-utils";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DETAIL_ACCESS_NUM_COMMENT = 8;

async function isReadyPoolPid(pid: number): Promise<boolean> {
  const rows = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid&pid=eq.${pid}&status=eq.ready&limit=1`,
    { headers: serviceHeaders() },
  ).then((res) => res.json() as Promise<Array<{ pid?: number }>>);
  return rows.length > 0;
}

async function loadExactPoolItem(pid: number) {
  const headers = serviceHeaders();
  const [poolRows, rawRows, metaRows, parsedRows] = await Promise.all([
    restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key,last_verified_at&pid=eq.${pid}&status=eq.ready&limit=1`,
      { headers },
    ).then((res) => res.json() as Promise<Array<{
      pid: number;
      expected_profit_min: number;
      expected_profit_max: number;
      profit_band: number;
      confidence: number | null;
      category: string | null;
      condition_class: string | null;
      comparable_key: string | null;
      last_verified_at: string;
    }>>),
    restFetch(
      `${tableUrl("mvp_listings")}?select=pid,name,price,sku_median,thumbnail_url,url&pid=eq.${pid}&limit=1`,
      { headers },
    ).then((res) => res.json() as Promise<Array<{
      pid: number;
      name: string;
      price: number;
      sku_median: number | null;
      thumbnail_url: string | null;
      url: string | null;
    }>>),
    restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,source,seller_source,url,sku_id,sku_name,free_shipping,last_seen_at,first_seen_at,shop_review_rating,shop_review_count,image_count,description_preview,listing_state,sale_status,num_comment,raw_json,daangn_region_name&pid=eq.${pid}&limit=1`,
      { headers },
    ).then((res) => res.json() as Promise<Array<{
      pid: number;
      source: string | null;
      seller_source: string | null;
      url: string | null;
      sku_id: string | null;
      sku_name: string | null;
      free_shipping: boolean | null;
      last_seen_at: string | null;
      first_seen_at: string | null;
      shop_review_rating: number | null;
      shop_review_count: number | null;
      image_count: number | null;
      description_preview: string | null;
      listing_state: string | null;
      sale_status: string | null;
      num_comment: number | null;
      raw_json: Record<string, unknown> | null;
      daangn_region_name: string | null;
    }>>),
    // Wave 714n (2026-05-23): 신발/의류 5-tier grading + chips fetch — 매물 클릭 시 모달 path 의 진짜 source.
    restFetch(
      `${tableUrl("mvp_listing_parsed")}?select=pid,condition_tier,condition_cluster,condition_confidence,condition_flags,parsed_json&pid=eq.${pid}&limit=1`,
      { headers },
    ).then((res) => res.json() as Promise<Array<{
      pid: number;
      condition_tier: string | null;
      condition_cluster: string | null;
      condition_confidence: number | null;
      condition_flags: Record<string, unknown> | null;
      parsed_json: Record<string, unknown> | null;
    }>>),
  ]);

  const pool = poolRows[0];
  const raw = rawRows[0];
  const meta = metaRows[0];
  const parsed = parsedRows[0]; // Wave 714n: grading + chips
  if (!pool || !raw) return null;
  // Wave 714n: tier + chips 추출 — column 직접 + parsed_json.condition_grade fallback.
  const grade = (parsed?.parsed_json?.condition_grade as {
    tier?: string;
    cluster?: string;
    confidence?: number;
    flags?: Record<string, unknown>;
    chips?: string[];
  } | null) ?? null;
  const conditionTier = parsed?.condition_tier ?? grade?.tier ?? null;
  const conditionCluster = parsed?.condition_cluster ?? grade?.cluster ?? null;
  const conditionConfidence = parsed?.condition_confidence ?? grade?.confidence ?? null;
  const conditionFlags = parsed?.condition_flags ?? grade?.flags ?? null;
  const conditionChips = grade?.chips ?? null;
  const marketplaceSource = normalizeMarketplaceSource(meta?.source ?? meta?.seller_source);
  const facts = marketplaceFactsFromRawJson({
    marketplaceSource,
    marketplaceLabel: marketplaceSourceLabel(marketplaceSource),
    freeShipping: meta?.free_shipping ?? false,
    sellerReviewRating: meta?.shop_review_rating ?? null,
    sellerReviewCount: meta?.shop_review_count ?? 0,
    rawJson: meta?.raw_json,
  });
  const tx = inferMarketplaceTransaction(facts);
  return {
    pid,
    name: raw.name,
    price: raw.price,
    skuMedian: raw.sku_median,
    listingUrl: listingUrlForSource(pid, meta?.url ?? raw.url, marketplaceSource),
    marketplaceSource,
    marketplaceLabel: marketplaceSourceLabel(marketplaceSource),
    thumbnailUrl: safeThumbnailUrl(raw.thumbnail_url),
    skuId: meta?.sku_id ?? null,
    skuName: meta?.sku_name ?? null,
    expectedProfitMin: pool.expected_profit_min,
    expectedProfitMax: pool.expected_profit_max,
    profitBand: pool.profit_band,
    confidence: pool.confidence,
    category: pool.category,
    conditionClass: pool.condition_class,
    comparableKey: pool.comparable_key,
    lastVerifiedAt: pool.last_verified_at,
    firstSeenAt: meta?.first_seen_at ?? null,
    freeShipping: meta?.free_shipping ?? false,
    sellerReviewRating: meta?.shop_review_rating ?? null,
    sellerReviewCount: meta?.shop_review_count ?? 0,
    joongnaTrustScore: facts.joongnaTrustScore ?? null,
    joongnaSafeOrderSalesCount: facts.joongnaSafeOrderSalesCount ?? null,
    joongnaSafeOrderSalesText: facts.joongnaSafeOrderSalesText ?? null,
    productTradeType: facts.productTradeType ?? null,
    parcelFeeYn: facts.parcelFeeYn ?? null,
    tradeLabels: [...(facts.tradeLabels ?? [])],
    transactionMode: tx.transactionMode,
    shippingAssumption: tx.assumption,
    // Wave launch-37: raw_json 없으면 description 에서 "직거래는 안동 송하동" 같은 패턴 추출.
    directTradeLocation: marketplaceLocationCombinedWithRegion(meta?.raw_json, meta?.description_preview ?? null, meta?.daangn_region_name ?? null),
    imageCount: meta?.image_count ?? null,
    descriptionPreview: meta?.description_preview ?? "",
    listingState: meta?.listing_state ?? "unknown",
    saleStatus: meta?.sale_status ?? "",
    commentCount: meta?.num_comment == null ? null : Number(meta.num_comment),
    soldOut: false,
    // Wave launch-38: detail HTML 에서 추출한 위치 patch 시 기존 raw_json 보존용.
    rawJson: meta?.raw_json ?? null,
    tradeLocation: null as string | null,
    // Wave 714n (2026-05-23): 신발/의류 5-tier grading + chips — 매물 클릭 시 모달 path 의 진짜 source.
    //   loadExactPoolItem 가 listing_parsed query 안 했었음 → setSelectedCard 의 input PoolItem 에
    //   conditionTier 자체 없어서 모달 디버그 tier=null 표시. 이제 fetch + 박음.
    conditionTier,
    conditionCluster,
    conditionConfidence,
    conditionFlags,
    conditionChips,
  };
}

type ExactPoolItem = NonNullable<Awaited<ReturnType<typeof loadExactPoolItem>>>;

function isCommentBlocked(value: number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n >= MAX_DETAIL_ACCESS_NUM_COMMENT;
}

function normalizedTerminalSaleStatus(value: string | null | undefined) {
  const upper = String(value ?? "").toUpperCase();
  return upper === "SOLD" || upper === "SOLD_OUT" ? upper : "SOLD_OUT";
}

async function patchPoolVerified(pid: number) {
  const now = new Date().toISOString();
  await restFetch(`${tableUrl("mvp_candidate_pool")}?pid=eq.${pid}&status=eq.ready`, {
    method: "PATCH",
    headers: serviceHeaders("return=minimal"),
    body: JSON.stringify({
      last_verified_at: now,
      updated_at: now,
    }),
  });
}

async function patchRawCommentCount(pid: number, commentCount: number) {
  const now = new Date().toISOString();
  await restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${pid}`, {
    method: "PATCH",
    headers: serviceHeaders("return=minimal"),
    body: JSON.stringify({
      num_comment: commentCount,
      detail_enriched_at: now,
      updated_at: now,
    }),
  });
}

async function invalidateReadyPoolItem(pid: number, reason: string, rawPatch: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  await Promise.allSettled([
    restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${pid}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: JSON.stringify({
        ...rawPatch,
        updated_at: now,
      }),
    }),
    restFetch(`${tableUrl("mvp_candidate_pool")}?pid=eq.${pid}&status=in.(ready,reserved)`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: JSON.stringify({
        status: "invalidated",
        invalidated_reason: reason.slice(0, 120),
        updated_at: now,
      }),
    }),
  ]);
}

async function markTerminalBeforeAccess(
  item: ExactPoolItem,
  state: "sold_confirmed" | "disappeared",
  saleStatus: string | null,
  reason: string,
) {
  const now = new Date().toISOString();
  const rawPatch: Record<string, unknown> = {
    listing_state: state,
  };
  if (saleStatus != null) rawPatch.sale_status = saleStatus;
  if (state === "sold_confirmed") rawPatch.sold_detected_at = now;
  if (state === "disappeared") {
    rawPatch.disappeared_at = now;
    rawPatch.last_missing_at = now;
  }
  await invalidateReadyPoolItem(item.pid, `detail_access_${reason}`, rawPatch);
}

type DetailAccessLiveVerifyResult =
  | { ok: true; item: ExactPoolItem }
  | { ok: false; status: number; error: string; message: string };

async function verifyBeforeDetailAccess(item: ExactPoolItem): Promise<DetailAccessLiveVerifyResult> {
  if (isCommentBlocked(item.commentCount)) {
    await invalidateReadyPoolItem(item.pid, `num_comment_above_${MAX_DETAIL_ACCESS_NUM_COMMENT}`, {
      num_comment: item.commentCount,
      pool_eligible: false,
      score_dirty: false,
    });
    return {
      ok: false,
      status: 404,
      error: "not_ready",
      message: "댓글이 많이 몰린 매물이라 추천에서 내렸어요. 새로고침하면 다른 매물을 보여드릴게요.",
    };
  }

  if (isJoongnaMarketplaceSource(item.marketplaceSource)) {
    if (!item.listingUrl) {
      return { ok: false, status: 503, error: "live_verify_unavailable", message: "원본 매물을 확인하지 못했어요. 새로고침 후 다시 시도해주세요." };
    }
    const detail = await fetchJoongnaDetail(item.listingUrl, 8_000).catch((err) => {
      console.error("pool/detail-access joongna live verify failed", {
        pid: item.pid,
        err: err instanceof Error ? err.message : String(err),
      });
      return null;
    });
    if (!detail) {
      return { ok: false, status: 503, error: "live_verify_unavailable", message: "중고나라 원본 확인이 잠시 실패했어요. 크레딧은 사용하지 않았어요." };
    }
    if (!detail.ok) {
      if (detail.status === 404) {
        await markTerminalBeforeAccess(item, "disappeared", null, "joongna_detail_404");
        return { ok: false, status: 404, error: "not_ready", message: "원본 매물이 사라져 추천에서 내렸어요. 새로고침하면 다른 매물을 보여드릴게요." };
      }
      return { ok: false, status: 503, error: "live_verify_unavailable", message: "중고나라 원본 확인이 잠시 불안정해요. 크레딧은 사용하지 않았어요." };
    }

    const saleStatus = detail.productStatus == null ? item.saleStatus : `JOONGNA_STATUS_${detail.productStatus}`;
    const soldByStatus = detail.productStatus != null && detail.productStatus !== 0;
    const soldByText = soldOutTextHits(detail.title, detail.description, item.descriptionPreview).length > 0;
    if (soldByStatus || soldByText) {
      const reason = soldByStatus ? `joongna_product_status_${detail.productStatus}` : "joongna_text_traded";
      await markTerminalBeforeAccess(item, "sold_confirmed", saleStatus, reason);
      return { ok: false, status: 404, error: "not_ready", message: "이미 거래가 끝난 매물이라 추천에서 내렸어요. 새로고침하면 다른 매물을 보여드릴게요." };
    }

    const liveType = classifyListing(detail.title ?? item.name, detail.description ?? item.descriptionPreview, item.price).listingType;
    // Wave launch-13 (사용자 짚음 — LEGO 75331): "unknown" = SKU 카탈로그 외 매물.
    // 풀 진입은 comparable_key + AI audit 로 통과했는데 detail-verify 가 classifier 의 SKU rule match
    // 실패로 invalidate → 사용자 막힘. 풀에 카드 보였는데 클릭 시 에러 = 신뢰 박살.
    // unknown 만 통과 (multi/callout/part/batch 등 다른 분기는 그대로 invalidate).
    if (liveType !== "normal" && liveType !== "unknown") {
      await invalidateReadyPoolItem(item.pid, `detail_access_live_${liveType}`);
      return { ok: false, status: 404, error: "not_ready", message: "원본 확인 결과 추천 기준에서 벗어나 내려뒀어요. 새로고침하면 다른 매물을 보여드릴게요." };
    }

    // Wave launch-38: detail HTML 안 별도 button 영역 동네 추출 → raw_json.tradeLocation patch
    if (detail.tradeLocation) {
      await restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${item.pid}`, {
        method: "PATCH",
        headers: { ...serviceHeaders(), Prefer: "return=minimal" },
        body: JSON.stringify({ raw_json: { ...(typeof item.rawJson === "object" && item.rawJson != null ? (item.rawJson as Record<string, unknown>) : {}), tradeLocation: detail.tradeLocation } }),
      }).catch((err) => console.warn("[detail-access] tradeLocation patch failed", err instanceof Error ? err.message : String(err)));
    }

    await patchPoolVerified(item.pid);
    return {
      ok: true,
      item: {
        ...item,
        listingState: "active",
        saleStatus,
        tradeLocation: detail.tradeLocation,
        directTradeLocation: detail.tradeLocation ?? item.directTradeLocation,
      },
    };
  }

  if (isDaangnMarketplaceSource(item.marketplaceSource)) {
    await patchPoolVerified(item.pid);
    return {
      ok: true,
      item: {
        ...item,
        listingState: "active",
        saleStatus: item.saleStatus || "selling",
      },
    };
  }

  const detail = await fetchDetail(String(item.pid));
  if (!detail) {
    await markTerminalBeforeAccess(item, "disappeared", null, "detail_fetch_missing");
    return { ok: false, status: 404, error: "not_ready", message: "원본 매물이 사라져 추천에서 내렸어요. 새로고침하면 다른 매물을 보여드릴게요." };
  }

  if (isCommentBlocked(detail.commentCount)) {
    await invalidateReadyPoolItem(item.pid, `num_comment_above_${MAX_DETAIL_ACCESS_NUM_COMMENT}`, {
      num_comment: detail.commentCount,
      pool_eligible: false,
      score_dirty: false,
    });
    return {
      ok: false,
      status: 404,
      error: "not_ready",
      message: "댓글이 많이 몰린 매물이라 추천에서 내렸어요. 새로고침하면 다른 매물을 보여드릴게요.",
    };
  }

  const signals = detectSoldOut(detail, item.price, {
    title: item.name,
    description: item.descriptionPreview,
  });
  if (isSoldOut(signals)) {
    const saleStatus = normalizedTerminalSaleStatus(detail.saleStatus);
    await markTerminalBeforeAccess(item, "sold_confirmed", saleStatus, describeSignals(signals));
    return { ok: false, status: 404, error: "not_ready", message: "이미 거래가 끝난 매물이라 추천에서 내렸어요. 새로고침하면 다른 매물을 보여드릴게요." };
  }

  if (detail.commentCount != null) await patchRawCommentCount(item.pid, detail.commentCount);
  const liveType = classifyListing(item.name, detail.description ?? item.descriptionPreview, item.price).listingType;
  // Wave launch-13: unknown 통과 (위 joongna 분기와 동일 — bunjang 측도 동일 룰).
  if (liveType !== "normal" && liveType !== "unknown") {
    await invalidateReadyPoolItem(item.pid, `detail_access_live_${liveType}`);
    return { ok: false, status: 404, error: "not_ready", message: "원본 확인 결과 추천 기준에서 벗어나 내려뒀어요. 새로고침하면 다른 매물을 보여드릴게요." };
  }

  await patchPoolVerified(item.pid);
  return {
    ok: true,
    item: {
      ...item,
      listingState: "active",
      saleStatus: detail.saleStatus || item.saleStatus,
      commentCount: detail.commentCount ?? item.commentCount,
    },
  };
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const accessToken = typeof payload.accessToken === "string" ? payload.accessToken : null;
  const tokenPid = accessToken ? decodePoolAccessToken(accessToken) : null;
  const pid = tokenPid ?? Number(payload.pid);
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ error: "invalid_pid", message: "매물 정보가 올바르지 않아요." }, { status: 400 });
  }

  const unlimitedAccess = isAdminUser(auth.user) || (await isBetaTesterAuthId(auth.user.id));

  if (!unlimitedAccess && !(await isReadyPoolPid(pid))) {
    return NextResponse.json(
      { error: "not_ready", message: "이 매물은 지금 상세보기 대상이 아니에요. 새로고침 후 다시 확인해주세요." },
      { status: 404 },
    );
  }

  const item = await loadExactPoolItem(pid);
  if (!item) {
    return NextResponse.json(
      { error: "not_ready", message: "이 매물은 지금 상세보기 대상이 아니에요. 새로고침 후 다시 확인해주세요." },
      { status: 404 },
    );
  }

  const liveVerify = await verifyBeforeDetailAccess(item);
  if (!liveVerify.ok) {
    return NextResponse.json(
      { error: liveVerify.error, message: liveVerify.message },
      { status: liveVerify.status },
    );
  }

  // Wave launch-106 (2026-05-24): 차익 음수 가드.
  //   sold 가 아닌 active 매물이라도 시세 갱신으로 expected_profit_max 가 0 이하면
  //   사용자한테 손해 매물 노출 금지. invalidate → recovery-worker (매 1분) 가 시세 회복 시 자동 ready 복귀.
  //   사용자 frustration: "차익 마이너스인데 모달에 '판매완료' 헤더가 떠서 헷갈렸음".
  const verifiedItem = liveVerify.item;
  if (Number(verifiedItem.expectedProfitMax ?? 0) <= 0) {
    await invalidateReadyPoolItem(verifiedItem.pid, "profit_negative");
    return NextResponse.json(
      {
        error: "not_ready",
        reason: "profit_lost",
        message: "시세가 떨어져서 차익이 사라졌어요. 새로고침하면 다른 매물 보여드릴게요.",
      },
      { status: 404 },
    );
  }

  const userRef = userRefForAuthUser(auth.user.id);
  const access = await consumeDetailAccess({ user: auth.user, userRef, pid, unlimited: unlimitedAccess });
  if (!access.ok) {
    return NextResponse.json(
      {
        error: access.error,
        message: access.message,
        creditBalance: access.creditBalance,
        freeUsed: access.freeUsed,
        freeLimit: access.freeLimit,
      },
      { status: access.status },
    );
  }

  return NextResponse.json({
    ok: true,
    accessType: access.accessType,
    alreadyOpened: access.alreadyOpened,
    creditSpent: access.creditSpent,
    creditBalance: access.creditBalance,
    freeUsed: access.freeUsed,
    freeLimit: access.freeLimit,
    unlimited: access.unlimited ?? false,
    item: liveVerify.item,
  });
}
