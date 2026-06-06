// Wave 979 (2026-05-31): URL lookup 시 DB 미존재 → 실시간 fetch + parse + upsert.
//   기존 lookup-by-url 은 mvp_raw_listings 조회 0건이면 404. 사용자 불편 해소.
//   3 source (bunjang/joongna/daangn) 지원. classifyListing + parseListingOptions 기존 모듈 재사용.
//   pool_eligible:true 박힘 → ready 카테고리면 candidate-pool-builder 가 pool 진입.
//   internal_only/blocked 카테고리도 raw/parsed 는 박음 (시세 학습 가치, 노출은 builder 가 거름).
//   live ingest 후 호출자는 정상 lookup 흐름 재개 (raw/parsed/market 조회 그대로).

import { fetchDetail as fetchBunjangDetail } from "@/lib/bunjang";
import {
  fetchJoongnaDetail,
  JOONGNA_SOURCE_ID,
  parseJoongnaProductExternalId,
} from "@/lib/joongna";
import {
  DAANGN_SOURCE_ID,
  daangnInternalPid,
  fetchDaangnLiveState,
  parseDaangnExternalId,
} from "@/lib/daangn";
import { classifyListing } from "@/lib/pipeline";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export type LiveIngestSource = "bunjang" | typeof JOONGNA_SOURCE_ID | typeof DAANGN_SOURCE_ID;

export type LiveIngestInput = { source: LiveIngestSource; key: string };

export type LiveIngestSuccess = {
  ok: true;
  pid: number;
  source: LiveIngestSource;
  listingType: string;
  matchedSku: boolean;
  comparableKey: string | null;
};

export type LiveIngestFailureReason =
  | "fetch_failed"
  | "blocked"
  | "parse_failed"
  | "not_a_product"
  | "unsupported_source"
  | "upsert_failed";

export type LiveIngestFailure = {
  ok: false;
  reason: LiveIngestFailureReason;
  detail?: string;
};

export type LiveIngestResult = LiveIngestSuccess | LiveIngestFailure;

export async function liveIngestFromParsedUrl(input: LiveIngestInput): Promise<LiveIngestResult> {
  if (input.source === "bunjang") return ingestBunjang(input.key);
  if (input.source === JOONGNA_SOURCE_ID) return ingestJoongna(input.key);
  if (input.source === DAANGN_SOURCE_ID) return ingestDaangn(input.key);
  return { ok: false, reason: "unsupported_source" };
}

// ──────────────────────────────────────────────────────────────────────────
// Bunjang — pid 직접 (numeric).
// ──────────────────────────────────────────────────────────────────────────
async function ingestBunjang(pidStr: string): Promise<LiveIngestResult> {
  if (!/^\d+$/.test(pidStr)) return { ok: false, reason: "not_a_product" };
  const pid = Number(pidStr);
  const detail = await fetchBunjangDetail(pidStr);
  if (!detail) return { ok: false, reason: "fetch_failed" };
  if (!detail.name || detail.price == null || detail.price <= 0) {
    return { ok: false, reason: "not_a_product" };
  }
  const url = `https://m.bunjang.co.kr/products/${pidStr}`;
  const description = detail.description ?? "";
  const { listingType, sku } = classifyListing(detail.name, description, detail.price);
  const parsed = listingType === "normal" && sku
    ? parseListingOptions({
        title: detail.name,
        description,
        skuId: sku.id,
        skuName: sku.modelName,
        category: sku.category,
        bunjangConditionLabel: detail.conditionLabel ?? null,
        defaultProductType: sku.defaultProductType ?? null,
      })
    : null;
  const now = new Date().toISOString();
  const matchedSku = Boolean(parsed && !parsed.needsReview && sku);
  const sourceUpdatedAt = detail.updateTime
    ? new Date(detail.updateTime * 1000).toISOString()
    : null;

  const rawRow: Record<string, unknown> = {
    pid,
    url,
    name: detail.name,
    price: detail.price,
    num_faved: detail.favoriteCount ?? 0,
    free_shipping: Boolean(detail.freeShipping),
    query: "live_lookup",
    source: "bunjang",
    description_preview: description.slice(0, 1500),
    sale_status: detail.saleStatus || "selling",
    seller_source: "bunjang",
    shop_review_rating: detail.shopReviewRating,
    shop_review_count: detail.shopReviewCount,
    seller_uid: detail.shopUid,
    trade_data: detail.tradeData,
    trades_data: detail.tradesData,
    image_url_template: detail.imageUrlTemplate,
    image_count: detail.imageCount,
    thumbnail_url: detail.thumbnailUrl,
    listing_type: listingType,
    sku_id: matchedSku ? sku!.id : null,
    sku_name: matchedSku ? sku!.modelName : null,
    detail_status: "done",
    detail_enriched_at: now,
    detail_error: null,
    listing_state: detail.saleStatus === "sold_out" ? "sold_confirmed" : "active",
    missing_count: 0,
    num_comment: detail.commentCount ?? null,
    qty: detail.qty ?? null,
    bunjang_condition_label: detail.conditionLabel ?? null,
    source_updated_at: sourceUpdatedAt,
    pool_eligible: listingType === "normal" && matchedSku,
    score_dirty: true,
    last_seen_at: now,
    last_changed_at: now,
    updated_at: now,
    first_seen_at: now,
    raw_json: {
      source: "live_lookup",
      shop: detail.shopData,
      metrics: detail.metricsData,
    },
  };

  return persistRow({
    pid,
    source: "bunjang",
    rawRow,
    parsed,
    listingType,
    matchedSku,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Joongna — URL or external numeric id.
// ──────────────────────────────────────────────────────────────────────────
async function ingestJoongna(externalIdOrKey: string): Promise<LiveIngestResult> {
  const externalId = /^\d+$/.test(externalIdOrKey)
    ? externalIdOrKey
    : parseJoongnaProductExternalId(externalIdOrKey);
  if (!externalId) return { ok: false, reason: "not_a_product" };
  const url = `https://web.joongna.com/product/${externalId}`;
  // Wave 1207 (2026-06-06, audit P0): fetchJoongnaDetail이 timeout/네트워크 시 throw → 404 대신 500으로 샜음.
  //   번개(bunjang try/catch)·당근(daangn .catch(null))은 null 반환인데 중나만 누락 → .catch(null)로 동일 계약.
  const detail = await fetchJoongnaDetail(url).catch(() => null);
  if (!detail) {
    return { ok: false, reason: "fetch_failed" };
  }
  if (!detail.ok) {
    if (detail.blockSignal.blocked) {
      return { ok: false, reason: "blocked", detail: detail.blockSignal.reason ?? undefined };
    }
    return { ok: false, reason: "fetch_failed" };
  }
  if (!detail.title || detail.price == null || detail.price <= 0) {
    return { ok: false, reason: "not_a_product" };
  }
  const pid = detail.internalPid;
  const title = detail.title;
  const description = detail.description ?? "";
  const { listingType, sku } = classifyListing(title, description, detail.price);
  const parsed = listingType === "normal" && sku
    ? parseListingOptions({
        title,
        description,
        skuId: sku.id,
        skuName: sku.modelName,
        category: sku.category,
      })
    : null;
  const now = new Date().toISOString();
  const matchedSku = Boolean(parsed && !parsed.needsReview && sku);
  const listingState = detail.isSoldOutPage
    ? "sold_confirmed"
    : detail.productStatus === 0
      ? "active"
      : "disappeared";
  const saleStatus = detail.isSoldOutPage ? "sold_out" : "selling";

  const rawRow: Record<string, unknown> = {
    pid,
    url: detail.url,
    name: title,
    price: detail.price,
    num_faved: 0,
    free_shipping: detail.parcelFeeYn === 1,
    query: "live_lookup",
    source: JOONGNA_SOURCE_ID,
    description_preview: description.slice(0, 1500),
    sale_status: saleStatus,
    seller_source: JOONGNA_SOURCE_ID,
    image_url_template: detail.thumbnailUrl,
    image_count: detail.imageCount,
    thumbnail_url: detail.thumbnailUrl,
    listing_type: listingType,
    sku_id: matchedSku ? sku!.id : null,
    sku_name: matchedSku ? sku!.modelName : null,
    detail_status: "done",
    detail_enriched_at: now,
    detail_error: null,
    listing_state: listingState,
    missing_count: 0,
    num_comment: detail.commentCount,
    source_uploaded_at: detail.sourceUpdatedAt,
    source_updated_at: detail.sourceUpdatedAt,
    pool_eligible: listingType === "normal" && matchedSku,
    score_dirty: true,
    last_seen_at: now,
    last_changed_at: now,
    updated_at: now,
    first_seen_at: now,
    raw_json: {
      source: "live_lookup",
      sourceExternalId: externalId,
      categoryName: detail.categoryName,
      categorySeq: detail.categorySeq,
    },
  };

  return persistRow({
    pid,
    source: JOONGNA_SOURCE_ID,
    rawRow,
    parsed,
    listingType,
    matchedSku,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Daangn — slug or shortId (lookup route 가 articles/{numeric} 은 redirect 로 미리 해석).
// ──────────────────────────────────────────────────────────────────────────
async function ingestDaangn(slugOrShortId: string): Promise<LiveIngestResult> {
  const url = `https://www.daangn.com/kr/buy-sell/${encodeURIComponent(slugOrShortId)}`;
  const state = await fetchDaangnLiveState(url);
  if (!state.ok) {
    if (state.reason === "blocked") {
      return { ok: false, reason: "blocked", detail: state.blockReason ?? undefined };
    }
    if (state.reason === "parse_failed") return { ok: false, reason: "parse_failed" };
    return { ok: false, reason: "fetch_failed" };
  }
  const article = state.article;
  const externalId = parseDaangnExternalId(article.href) ?? article.id;
  if (!externalId) return { ok: false, reason: "not_a_product" };
  const priceNum = Number(article.price);
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    return { ok: false, reason: "not_a_product" };
  }
  const pid = daangnInternalPid(externalId);
  const title = article.title ?? "";
  const description = article.content ?? "";
  const { listingType, sku } = classifyListing(title, description, priceNum);
  const parsed = listingType === "normal" && sku
    ? parseListingOptions({
        title,
        description,
        skuId: sku.id,
        skuName: sku.modelName,
        category: sku.category,
      })
    : null;
  const now = new Date().toISOString();
  const matchedSku = Boolean(parsed && !parsed.needsReview && sku);
  const imageCount = Array.isArray(article.images) ? article.images.length : 0;

  const rawRow: Record<string, unknown> = {
    pid,
    url: article.href || url,
    name: title || "(no title)",
    price: Math.max(0, Math.round(priceNum)),
    num_faved: article.favoriteCount ?? 0,
    free_shipping: false,
    query: "live_lookup",
    source: DAANGN_SOURCE_ID,
    description_preview: description.slice(0, 500),
    sale_status: state.saleStatus,
    seller_source: DAANGN_SOURCE_ID,
    image_url_template: article.thumbnail,
    image_count: imageCount,
    thumbnail_url: article.thumbnail,
    listing_type: listingType,
    sku_id: matchedSku ? sku!.id : null,
    sku_name: matchedSku ? sku!.modelName : null,
    detail_status: "done",
    detail_enriched_at: now,
    detail_error: null,
    listing_state: state.listingState,
    missing_count: 0,
    num_comment: article.chatCount ?? 0,
    source_updated_at: article.boostedAt ?? article.createdAt ?? null,
    daangn_region_id: article.region?.dbId ?? null,
    daangn_region_name: article.region?.name ?? null,
    daangn_boosted_at: article.boostedAt ?? null,
    daangn_web_crawl_allowed: !article.user?.webCrawlNotAllowed,
    daangn_manner_temperature: article.user?.score ?? null,
    daangn_review_count: article.user?.reviewCount ?? null,
    pool_eligible: listingType === "normal" && matchedSku,
    score_dirty: true,
    last_seen_at: now,
    last_changed_at: now,
    updated_at: now,
    first_seen_at: now,
    raw_json: {
      source: "live_lookup",
      externalId,
      viewCount: article.viewCount,
      imageCount,
      region: article.region,
    },
  };

  return persistRow({
    pid,
    source: DAANGN_SOURCE_ID,
    rawRow,
    parsed,
    listingType,
    matchedSku,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Common upsert. PostgREST POST + Prefer:resolution=merge-duplicates 로 upsert.
//   raw 성공 + parsed 실패 → raw 는 살리고 best-effort log.
//   호출자는 다음 fetch 에서 parse_pending 으로 응답 (사용자한테 다시 시도 안내).
// ──────────────────────────────────────────────────────────────────────────
async function persistRow(input: {
  pid: number;
  source: LiveIngestSource;
  rawRow: Record<string, unknown>;
  parsed: ReturnType<typeof parseListingOptions> | null;
  listingType: string;
  matchedSku: boolean;
}): Promise<LiveIngestResult> {
  const headers = { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" };

  const rawRes = await restFetch(`${tableUrl("mvp_raw_listings")}?on_conflict=pid`, {
    method: "POST",
    headers,
    body: JSON.stringify(input.rawRow),
  });
  if (!rawRes.ok && rawRes.status !== 201) {
    const detail = await rawRes.text().catch(() => "");
    return {
      ok: false,
      reason: "upsert_failed",
      detail: `raw:${rawRes.status} ${detail.slice(0, 200)}`,
    };
  }

  let comparableKey: string | null = null;
  if (input.parsed) {
    comparableKey = input.parsed.comparableKey ?? null;
    const parsedRow = toParsedListingRow(input.pid, input.parsed);
    const parsedRes = await restFetch(`${tableUrl("mvp_listing_parsed")}?on_conflict=pid`, {
      method: "POST",
      headers,
      body: JSON.stringify(parsedRow),
    });
    if (!parsedRes.ok && parsedRes.status !== 201) {
      const detail = await parsedRes.text().catch(() => "");
      console.warn(
        `[live-ingest] parsed upsert failed pid=${input.pid}: ${parsedRes.status} ${detail.slice(0, 200)}`,
      );
    }
  }

  return {
    ok: true,
    pid: input.pid,
    source: input.source,
    listingType: input.listingType,
    matchedSku: input.matchedSku,
    comparableKey,
  };
}
