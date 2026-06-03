import { fetchDetail } from "@/lib/bunjang";
import { CATALOG } from "@/lib/catalog";
import { categoryFromComparableKey, loadCategoryReadinessMap } from "@/lib/category-readiness";
import { pickByConditionFallback } from "@/lib/condition-fallback";
import { mergeConditionDisplayChips } from "@/lib/condition-display";
import { fetchDaangnLiveState } from "@/lib/daangn";
import { resolveDaangnFullRegion } from "@/lib/daangn-region-resolver";
import { fetchJoongnaDetail } from "@/lib/joongna";
import {
  BUNJANG_SOURCE_ID,
  DAANGN_SOURCE_ID,
  JOONGNA_SOURCE_ID,
  isDaangnMarketplaceSource,
  isJoongnaMarketplaceSource,
  listingUrlForSource,
  marketplaceSourceLabel,
  normalizeMarketplaceSource,
  type KnownMarketplaceSource,
} from "@/lib/marketplace-source";
import {
  buildMarketplaceSafetyDisplay,
  inferMarketplaceTransaction,
  marketplaceFactsFromRawJson,
  marketplaceLocationCombinedWithRegion,
  type MarketplaceShippingAssumption,
  type MarketplaceTransactionMode,
} from "@/lib/marketplace-safety";
import {
  canPermanentlyInvalidateSoldOut,
  detectSoldOut,
  describeSignals,
  isSoldOut,
  soldOutTextHits,
  type SourceHealthStatus,
} from "@/lib/sold-out";
import {
  classifyListing,
  isSideOnlyEarbudListing,
  parseShippingFromDescription,
  parseShippingFromTrade,
} from "@/lib/pipeline";
import { expectedProfitFromMarketPrice } from "@/lib/profit";

const TIMEOUT_MS = 30_000;
const USER_REVEAL_DEDUPE_LIMIT = 1000;
const MAX_PACK_OPEN_NUM_COMMENT = 8;
const COMMENT_COUNT_REFRESH_MS = 6 * 60 * 60 * 1000;

export type PackBand = 1 | 2 | 3;

export type RevealCard = {
  pid: number;
  name: string;
  url: string;
  marketplaceSource?: string;
  marketplaceLabel?: string;
  price: number;
  skuId?: string | null;
  skuName: string;
  // 2026-05-16 (사용자 코멘트 #110 후속): 헷갈림 안내 (예: "Lightning vs USB-C 가격 동일").
  // catalog Sku.confusionNote 그대로. UI 에서 카드 하단 expandable 표시.
  confusionNote?: string | null;
  thumbnailUrl: string | null;
  // Wave 886 (2026-05-27): SKU 일반 이미지 (anti-leak). 있으면 카드 노출 시 우선 사용, 없으면 thumbnailUrl 폴백.
  genericImageUrl?: string | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  confidence: number;
  // 2026-05-17 (사용자 요청): 나의 상품 "상품 보기" 모달에 운영자풀과 동일 band chip 표시.
  band?: 1 | 2 | 3 | null;
  marketBasis: RevealMarketBasis;
  velocityBasis: RevealVelocityBasis | null;
  lastVerifiedAt: string;
  freshSeconds: number;
  // 2026-05-20: 셀러가 번개장터에 매물 올린 시점 추정 (first_seen_at).
  //   미뇨이 crawler가 처음 발견한 시점 = 실제 업로드 + 0~30분 lag (collect cadence 기준).
  //   사용자가 "검증 N분 전"과 "등록 N시간 전"을 구분할 수 있게 추가.
  //   nullable — 옛 reveal/일부 source에 first_seen_at 없을 수 있음.
  firstSeenAt?: string | null;
  // Wave 80: SKU별 일별 매물 유입량 (24h rolling + 7d 평균)
  // 사용자가 매물대 크기/회전성 직관 파악용.
  skuListingFlow?: {
    count24h: number;
    avgPerDay7d: number;
  } | null;
  savedDetail?: {
    descriptionPreview: string;
    favoriteCount: number | null;
    freeShipping: boolean;
    imageCount: number | null;
    sellerName: string | null;
    sellerReviewRating: number | null;
    sellerReviewCount: number;
    joongnaTrustScore?: number | null;
    joongnaSafeOrderSalesCount?: number | null;
    joongnaSafeOrderSalesText?: string | null;
    productTradeType?: number | null;
    parcelFeeYn?: number | null;
    tradeLabels?: string[];
    transactionMode?: MarketplaceTransactionMode;
    shippingAssumption?: MarketplaceShippingAssumption;
    directTradeLocation?: string | null;
    // Wave 758 (2026-05-26): 당근 매너온도 (0~99.9°C) + 리뷰 수. NULL = backfill 미완.
    daangnMannerTemperature?: number | null;
    daangnReviewCount?: number | null;
  };
  // Wave 182 Phase 3 (2026-05-17): base option fallback metadata.
  // null/[] 이면 옵션 명시 매물. 값 있으면 "기본 옵션 가정" UI badge 표시.
  optionBaseAssumed?: string[] | null;
  // Wave 714d (2026-05-23): 신발/의류 5-tier S/A/B/C/D 등급 + raw 표현 chips.
  //   pack-reveal-modal (쉬운모드) 등 UI 에서 ConditionTierChip + ConditionChipsList 표시.
  //   전자기기는 null → 기존 ConditionChip(conditionClass) 그대로.
  conditionTier?: string | null;
  conditionCluster?: string | null;
  conditionConfidence?: number | null;
  conditionFlags?: Record<string, unknown> | null;
  conditionChips?: string[] | null;
};

// Wave 394.7.ab: confidence "low" 도 통과 (UI 측 분기로 "참고용" 톤 표시).
export type RevealVelocityBasis = {
  comparableKey: string;
  conditionClass: string | null;
  conditionSpecific: boolean;
  confidence: "high" | "medium" | "low";
  observedSoldSampleCount: number;
  activeSampleCount: number;
  sold24hCount: number;
  sold7dCount: number;
  medianHoursToSold: number | null;
  p25HoursToSold: number | null;
  p75HoursToSold: number | null;
  clockBasis: string;
  computedAt: string | null;
};

export type RevealMarketBasis = {
  comparableKey: string | null;
  label: string;
  p25Price: number | null;
  medianPrice: number | null;
  p75Price: number | null;
  sampleCount: number;
  activeSampleCount: number;
  soldSampleCount: number;
  disappearedSampleCount: number;
  confidence: string | null;
  // Wave 207 (2026-05-18): UI source label must reflect the actual price anchor.
  // "reference" = Danawa/official new-product anchor, "market" = Bunjang market stats.
  // Wave 252.A real (2026-05-20): "v3_pending_rematch" = clothing v3 매물 (product_type 미박힘) +
  //   v7 sibling row 존재 → mixed-pool median 차단. UI 에서 "비교 기준 미확정 (재매칭 대기)" 표시.
  priceSource: "reference" | "market" | "source_market" | "v3_pending_rematch";
  marketplaceSource?: KnownMarketplaceSource | "mixed" | null;
  marketplaceLabel?: string | null;
  sourceSampleUsed?: boolean;
  sourceFallbackUsed?: boolean;
  // Wave 797b (2026-05-27): basis source UI 라벨 (당근 매물 표시용).
  //   다른 worktree 작업에서 explore-client / user-reveal-dashboard 가 사용 — type 누락 fix.
  basisSource?: string | null;
  basisSourceLabel?: string | null;
  sourceSampleCount?: number | null;
  resaleChannels?: ResaleChannelBasis[];
  computedAt: string | null;
  excludedExamples: string[];
  // Wave 130 (2026-05-16): condition별 시세 분리 — 사업 보고서 L2 retention.
  // 매물 condition에 매칭되는 시세 우선. fallback 시 fallbackUsed=true.
  conditionClass: string | null;
  conditionLabel: string | null;
  fallbackUsed: boolean;
  // 같은 SKU+옵션 매물의 다른 condition 시세 (UI에서 "내 condition vs 전체" 비교용).
  otherConditions: Array<{
    conditionClass: string;
    label: string;
    medianPrice: number | null;
    sampleCount: number;
  }>;
};

export type ResaleChannelBasis = {
  source: KnownMarketplaceSource;
  label: string;
  salePrice: number | null;
  sampleCount: number;
  activeSampleCount: number;
  soldSampleCount: number;
  disappearedSampleCount: number;
  confidence: string | null;
  priceBasis: "source" | "mixed" | "reference" | "unavailable";
  fallbackUsed: boolean;
};

export type RevealListingDetail = {
  pid: number;
  description: string;
  saleStatus: string;
  conditionLabel: string | null;
  thumbnailUrl: string | null;
  imageUrls: string[];
  metrics: {
    viewCount: number | null;
    favoriteCount: number | null;
    commentCount: number | null;
  };
  seller: {
    uid: string | null;
    name: string | null;
    reviewRating: number | null;
    reviewCount: number;
    followerCount: number;
    salesCount: number;
    proshop: boolean;
    officialSeller: boolean;
    joinDate: string | null;
  };
  shippingOptions: {
    kind: "free" | "general" | "half" | "unknown";
    amount: number;
  }[];
  shippingSummary: string;
  transactionMode?: MarketplaceTransactionMode;
  shippingAssumption?: MarketplaceShippingAssumption;
};

export type PackOpenInput = {
  band: PackBand;
  userRef: string;
  authUserId: string;
  isInfiniteCredits: boolean;
  tokensSpent: number;
  requestedCards?: number;
  consumeInventory?: boolean;
  // Wave 93b: freshness filter — 0 또는 undefined면 무제한.
  maxFreshHours?: number;
  // Wave 261: 실제 reveal 확정 경로에서도 사용자가 고른 조건을 hard-filter.
  // preview/token cost만 필터를 보던 상태에서 고가 매물이 섞이는 문제 방지.
  filters?: PackOpenFilters | null;
};

export type PackOpenFilters = {
  minProfitManwon: number;
  minConfidencePct: number;
  priceMaxManwon: number;
  categories?: string[];
  maxFreshHours?: number;
};

const MIN_ADVANCED_PRICE_MAX_MANWON = 15;

// Wave 182 (2026-05-17): loss_report 추가 — 사용자 손해 신고. 즉시 토큰 3개 보상 + 운영자 검수 큐 진입.
// Wave 182c (2026-05-17): inaccurate_report 추가 — 매수 전 "정보 오류" 즉시 신고 (임계값 낮춤, feedback polling).
//   loss_report 는 일단 보류 (UI 노출 X) — 운영 검수 + 사용자 행동 데이터 누적 후 재개 검토.
export type RevealFeedbackType =
  | "interested"
  | "bought"
  | "missed_sold"
  | "bad_pick"
  | "watching"
  | "contacted"
  | "passed"
  | "inspected"
  | "listed"
  | "resold"
  | "loss_report"
  | "inaccurate_report";

export type PackOpenSuccess = {
  result: "success";
  packOpenId: number;
  reveals: RevealCard[];
  attemptedCount: number;
  durationMs: number;
  tokensRemaining: number;
  infiniteCredits: boolean;
};

export type PackOpenRefunded = {
  result: "refunded";
  reason: string;
  attemptedCount: number;
  tokensRefunded: number;
  durationMs: number;
};

export type PackOpenUnavailable = {
  result: "unavailable";
  reason: string;
  durationMs: number;
};

export type PackOpenResult = PackOpenSuccess | PackOpenRefunded | PackOpenUnavailable;

type ReservedRow = {
  pid: number;
  profit_band: number;
  category?: string | null;
  expected_profit_min: number;
  expected_profit_max: number;
  score: number;
  confidence: number;
  comparable_key: string | null;
  // Wave 130 (2026-05-16): 매물 condition_class — pack open 시 condition별 시세 매칭에 사용.
  condition_class: string | null;
  exposure_count: number;
  max_exposure: number;
  last_verified_at: string;
  reserved_until: string;
};

type ListingMeta = {
  pid: number;
  name: string;
  url: string;
  price: number;
  sku_id: string | null;
  sku_name: string;
  thumbnail_url: string | null;
  marketplaceSource: string;
  marketplaceLabel: string;
  // Wave 82: raw listing 부가 데이터 (savedDetail용)
  _raw?: RawSkuMeta;
};

type RawSkuMeta = {
  pid: number;
  source: string | null;
  seller_source: string | null;
  url: string | null;
  sku_id: string | null;
  description_preview: string | null;
  num_faved: number | null;
  free_shipping: boolean | null;
  shop_review_rating: number | null;
  shop_review_count: number | null;
  image_count: number | null;
  num_comment: number | null;
  detail_enriched_at: string | null;
  raw_json: Record<string, unknown> | null;
  daangn_region_id: string | null;
  daangn_region_name: string | null;
  daangn_manner_temperature: number | null;
  daangn_review_count: number | null;
};

type UserRevealDedupe = {
  pids: Set<number>;
  comparableKeys: Set<string>;
  skuIds: Set<string>;
};

type SourceHealthRow = {
  status: SourceHealthStatus;
  checked_at: string;
};

type MarketPriceRow = {
  comparable_key: string;
  // Wave 130: condition_class — DB PK 일부. condition별 시세 분리.
  condition_class: string;
  // Wave 814 (2026-05-30): condition_tier 5-tier (S/A/B/C/D) — Wave 722/130 DB PK 일부.
  //   fashion (shoe/clothing) 시세 = tier 별 row, condition_class = "".
  //   non-fashion = cc 별 row, tier = "" or NULL.
  condition_tier?: string | null;
  active_median_price: number | null;
  sold_median_price: number | null;
  blended_median_price: number | null;
  p25_price: number | null;
  p75_price: number | null;
  active_sample_count: number;
  sold_sample_count: number;
  disappeared_sample_count: number;
  confidence: string | null;
  computed_at: string | null;
};

type MarketPriceRowWithSource = MarketPriceRow & { source: KnownMarketplaceSource | string };

type MarketVelocityRow = {
  comparable_key: string;
  condition_class: string;
  category: string | null;
  observed_sold_sample_count: number;
  active_sample_count: number;
  sold_24h_count: number;
  sold_7d_count: number;
  confidence: "high" | "medium" | "low";
  median_hours_to_sold: number | null;
  p25_hours_to_sold: number | null;
  p75_hours_to_sold: number | null;
  clock_basis: string;
  computed_at: string | null;
};

function categoryFromPool(row: { category?: string | null; comparable_key?: string | null }) {
  return categoryFromComparableKey(row.category) ?? categoryFromComparableKey(row.comparable_key);
}

function interleaveReservedByCategory(rows: ReservedRow[]) {
  const buckets = new Map<string, ReservedRow[]>();
  for (const row of rows) {
    const category = categoryFromPool(row) ?? "unknown";
    const bucket = buckets.get(category) ?? [];
    bucket.push(row);
    buckets.set(category, bucket);
  }
  const categories = Array.from(buckets.keys());
  const interleaved: ReservedRow[] = [];
  let remaining = rows.length;
  while (remaining > 0) {
    for (const category of categories) {
      const row = buckets.get(category)?.shift();
      if (!row) continue;
      interleaved.push(row);
      remaining -= 1;
    }
  }
  return interleaved;
}

type OpenFilterCriteria = {
  minProfitKrw: number;
  minConfidence: number;
  maxPriceKrw: number;
  categories: Set<string>;
};

function finiteNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function openFilterCriteria(filters: PackOpenFilters | null | undefined): OpenFilterCriteria {
  const categories = new Set<string>();
  for (const raw of filters?.categories ?? []) {
    if (typeof raw !== "string") continue;
    const normalized = categoryFromComparableKey(raw) ?? raw.trim().toLowerCase();
    if (normalized) categories.add(normalized);
  }
  const rawPriceMaxManwon = Math.max(0, finiteNumber(filters?.priceMaxManwon));
  return {
    minProfitKrw: Math.max(0, finiteNumber(filters?.minProfitManwon)) * 10_000,
    minConfidence: Math.max(0, Math.min(100, finiteNumber(filters?.minConfidencePct))) / 100,
    maxPriceKrw: (rawPriceMaxManwon > 0 ? Math.max(MIN_ADVANCED_PRICE_MAX_MANWON, rawPriceMaxManwon) : 0) * 10_000,
    categories,
  };
}

function hasOpenFilterCriteria(criteria: OpenFilterCriteria) {
  return criteria.minProfitKrw > 0 ||
    criteria.minConfidence > 0 ||
    criteria.maxPriceKrw > 0 ||
    criteria.categories.size > 0;
}

function candidateMatchesOpenFilters(
  candidate: ReservedRow,
  meta: ListingMeta,
  criteria: OpenFilterCriteria,
) {
  if (criteria.maxPriceKrw > 0 && finiteNumber(meta.price) > criteria.maxPriceKrw) return false;
  if (criteria.minProfitKrw > 0 && finiteNumber(candidate.expected_profit_min) < criteria.minProfitKrw) return false;
  if (criteria.minConfidence > 0 && finiteNumber(candidate.confidence) < criteria.minConfidence) return false;
  if (criteria.categories.size > 0) {
    const category = categoryFromComparableKey(candidate.category) ?? categoryFromComparableKey(candidate.comparable_key);
    if (!category || !criteria.categories.has(category)) return false;
  }
  return true;
}

function supabaseRest() {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!raw) throw new Error("SUPABASE_URL missing");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders(prefer?: string): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

async function callSupabase(path: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${supabaseRest()}${path}`, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`supabase ${init.method ?? "GET"} ${res.status}: ${body.slice(0, 300)}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function rpcReservePool(band: PackBand, userRef: string, limit: number, maxFreshSeconds: number): Promise<ReservedRow[]> {
  const res = await callSupabase("/rpc/reserve_mvp_pool_candidates", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      p_band: band,
      p_user_ref: userRef,
      p_limit: limit,
      p_lease_seconds: 300,
      p_max_fresh_seconds: maxFreshSeconds,
    }),
  });
  return (await res.json()) as ReservedRow[];
}

async function rpcCommitReveal(pid: number): Promise<boolean> {
  // P0-4: RPC가 boolean을 반환한다. status='reserved' AND reserved_until>now() 가 아니면 false.
  // false인 경우: reservation이 이미 만료/취소/이미 commit됨. 호출자가 관측 가능하게 결과 반환.
  const res = await callSupabase("/rpc/commit_mvp_pool_reveal", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ p_pid: pid }),
  });
  try {
    const body = (await res.json()) as boolean | null;
    return body === true;
  } catch {
    return false;
  }
}

async function rpcReleaseReservation(pid: number): Promise<void> {
  await callSupabase("/rpc/release_mvp_pool_reservation", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ p_pid: pid }),
  });
}

async function loadUserRevealDedupe(userRef: string): Promise<UserRevealDedupe> {
  const revealRes = await callSupabase(
    `/mvp_pack_reveals?select=pid&user_ref=eq.${encodeURIComponent(userRef)}&order=revealed_at.desc&limit=${USER_REVEAL_DEDUPE_LIMIT}`,
    { headers: authHeaders() },
  );
  const revealRows = (await revealRes.json()) as Array<{ pid: number }>;
  const pids = Array.from(new Set(revealRows.map((row) => Number(row.pid)).filter(Number.isFinite)));
  const dedupe: UserRevealDedupe = {
    pids: new Set(pids),
    comparableKeys: new Set(),
    skuIds: new Set(),
  };
  if (pids.length === 0) return dedupe;

  const pidList = pids.join(",");
  const [parsedRes, rawRes] = await Promise.all([
    callSupabase(`/mvp_listing_parsed?select=pid,comparable_key&pid=in.(${pidList})`, { headers: authHeaders() }),
    callSupabase(`/mvp_raw_listings?select=pid,sku_id&pid=in.(${pidList})`, { headers: authHeaders() }),
  ]);
  const parsedRows = (await parsedRes.json()) as Array<{ comparable_key: string | null }>;
  const rawRows = (await rawRes.json()) as Array<{ sku_id: string | null }>;
  for (const row of parsedRows) {
    if (row.comparable_key) dedupe.comparableKeys.add(row.comparable_key);
  }
  for (const row of rawRows) {
    if (row.sku_id) dedupe.skuIds.add(row.sku_id);
  }
  return dedupe;
}

function freshnessMsForBand(band: PackBand) {
  if (band === 3) return 0;
  if (band === 2) return 5 * 60 * 1000;
  return 15 * 60 * 1000;
}

async function rpcInvalidate(pid: number, reason: string): Promise<void> {
  await callSupabase("/rpc/invalidate_mvp_pool_entry", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ p_pid: pid, p_reason: reason.slice(0, 120) }),
  });
}

function isPackOpenCommentBlocked(value: number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n >= MAX_PACK_OPEN_NUM_COMMENT;
}

function hasRawCommentCount(value: number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n);
}

async function invalidateHighCommentCandidate(pid: number, commentCount: number, source: "raw_num_comment" | "detail_comment_count") {
  const reason = `num_comment_above_${MAX_PACK_OPEN_NUM_COMMENT}`;
  await Promise.allSettled([
    callSupabase(`/mvp_raw_listings?pid=eq.${pid}`, {
      method: "PATCH",
      headers: authHeaders("return=minimal"),
      body: JSON.stringify({
        num_comment: commentCount,
        pool_eligible: false,
        score_dirty: false,
        updated_at: new Date().toISOString(),
      }),
    }),
    rpcInvalidate(pid, `pack_open_${source}_${reason}`),
  ]);
}

async function patchRawCommentCount(pid: number, commentCount: number): Promise<void> {
  const now = new Date().toISOString();
  await callSupabase(`/mvp_raw_listings?pid=eq.${pid}`, {
    method: "PATCH",
    headers: authHeaders("return=minimal"),
    body: JSON.stringify({
      num_comment: commentCount,
      detail_enriched_at: now,
      updated_at: now,
    }),
  });
}

function hasStaleRawCommentCount(raw: RawSkuMeta | undefined, nowMs = Date.now()) {
  if (!hasRawCommentCount(raw?.num_comment ?? null)) return true;
  const enrichedAt = raw?.detail_enriched_at ? Date.parse(raw.detail_enriched_at) : Number.NaN;
  return !Number.isFinite(enrichedAt) || nowMs - enrichedAt > COMMENT_COUNT_REFRESH_MS;
}

async function loadLatestSourceHealth(): Promise<SourceHealthStatus> {
  try {
    const res = await callSupabase(
      "/mvp_source_health?select=status,checked_at&source=eq.bunjang&order=checked_at.desc&limit=1",
      { headers: authHeaders() },
    );
    const rows = (await res.json()) as SourceHealthRow[];
    return rows[0]?.status ?? "degraded";
  } catch {
    return "degraded";
  }
}

async function fetchListings(pids: number[]): Promise<Map<number, ListingMeta>> {
  if (pids.length === 0) return new Map();
  const pidFilter = pids.join(",");
  const listingCols = "pid,name,url,price,sku_name,thumbnail_url";
  const rawCols = "pid,source,seller_source,url,sku_id,description_preview,num_faved,free_shipping,shop_review_rating,shop_review_count,image_count,num_comment,detail_enriched_at,raw_json,daangn_region_id,daangn_region_name,daangn_manner_temperature,daangn_review_count";
  const [listingRes, rawRes] = await Promise.all([
    callSupabase(`/mvp_listings?select=${listingCols}&pid=in.(${pidFilter})`, { headers: authHeaders() }),
    callSupabase(`/mvp_raw_listings?select=${rawCols}&pid=in.(${pidFilter})`, { headers: authHeaders() }),
  ]);
  const rows = (await listingRes.json()) as Array<Pick<ListingMeta, "pid" | "name" | "url" | "price" | "sku_name" | "thumbnail_url">>;
  const rawRows = (await rawRes.json()) as RawSkuMeta[];
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  return new Map(rows.map((row) => {
    const raw = rawByPid.get(Number(row.pid));
    const marketplaceSource = normalizeMarketplaceSource(raw?.source ?? raw?.seller_source);
    return [Number(row.pid), {
      ...row,
      url: raw?.url || row.url,
      sku_id: raw?.sku_id ?? null,
      marketplaceSource,
      marketplaceLabel: marketplaceSourceLabel(marketplaceSource),
      _raw: raw,
    }];
  }));
}

async function assertRevealAccess(userRef: string, pid: number): Promise<void> {
  const res = await callSupabase(
    `/mvp_pack_reveals?select=pid&user_ref=eq.${encodeURIComponent(userRef)}&pid=eq.${pid}&limit=1`,
    { headers: authHeaders() },
  );
  const rows = (await res.json()) as { pid: number }[];
  if (rows.length === 0) throw new Error("reveal not found for user");
}

// Wave 130 (2026-05-16): condition별 시세 분리. Map 구조:
//   comparable_key → (condition_class → MarketPriceRow)
// 사업 보고서 L2: 같은 SKU+옵션 매물이라도 condition별 시세 spread 15~40% — 끼리 비교 retention.
//
// Wave 814+816 (2026-05-30): condition_tier composite key 박음.
//   기존 = Map<condition_class, row> — tier 차원 drop, fashion row 들이 cc="" 로 collision (non-deterministic).
//   새 = Map<`${tier}|${condition_class}`, row> — fashion/non-fashion 모두 정확 key.
//   fashion: cc="" + tier="B/A/S/..." → "B|", "A|" 등
//   non-fashion: cc="normal/clean/..." + tier="" → "|normal", "|clean" 등
//   marketBasisForCandidate 가 caller — fashion 이면 tier prefix 만, 아니면 cc suffix 만 박아 lookup.
export type MarketStatsByCondition = Map<string, MarketPriceRow>;

// Wave 816: composite key helper. tier 빈 값 = non-fashion, cc 빈 값 = fashion.
export function marketStatsConditionKey(conditionTier: string | null | undefined, conditionClass: string | null | undefined): string {
  return `${(conditionTier ?? "").trim()}|${(conditionClass ?? "").trim()}`;
}
export type MarketStatsMap = Map<string, MarketStatsByCondition>;
export type MarketStatsBySourceMap = Map<string, Map<KnownMarketplaceSource, MarketStatsByCondition>>;

type TtlEntry<T> = {
  value: T;
  expiresAt: number;
};

const MARKET_STATS_CACHE_TTL_MS = ttlFromEnv("PACK_MARKET_STATS_CACHE_TTL_MS", 5 * 60 * 1000);
const MARKET_VELOCITY_CACHE_TTL_MS = ttlFromEnv("PACK_MARKET_VELOCITY_CACHE_TTL_MS", 5 * 60 * 1000);
const REFERENCE_PRICE_CACHE_TTL_MS = ttlFromEnv("PACK_REFERENCE_PRICE_CACHE_TTL_MS", 10 * 60 * 1000);

const marketStatsCache = new Map<string, TtlEntry<MarketStatsByCondition>>();
const marketStatsPerSourceCache = new Map<string, TtlEntry<MarketStatsByCondition>>();
const marketVelocityCache = new Map<string, TtlEntry<MarketVelocityRow[] | null>>();
const referencePriceCache = new Map<string, TtlEntry<number | null>>();

function ttlFromEnv(name: string, fallbackMs: number) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallbackMs;
}

function readTtl<T>(cache: Map<string, TtlEntry<T>>, key: string, now: number): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function writeTtl<T>(cache: Map<string, TtlEntry<T>>, key: string, value: T, ttlMs: number, now: number) {
  cache.set(key, { value, expiresAt: now + ttlMs });
}

function normalizedVelocityCondition(conditionClass: string | null | undefined): string | null {
  const value = (conditionClass ?? "").trim();
  if (!value || value === "unknown" || value === "all") return null;
  return value;
}

function velocityStatsConditionKey(comparableKey: string, conditionClass: string | null | undefined): string {
  const condition = normalizedVelocityCondition(conditionClass);
  return condition ? `${comparableKey}::${condition}` : comparableKey;
}

function isUsableConditionVelocity(row: MarketVelocityRow | null | undefined): row is MarketVelocityRow {
  if (!row) return false;
  const soldSample = Number(row.observed_sold_sample_count ?? 0);
  const sold7d = Number(row.sold_7d_count ?? 0);
  const medianHours = Number(row.median_hours_to_sold ?? 0);
  return soldSample >= 3 && sold7d > 0 && Number.isFinite(medianHours) && medianHours > 0;
}

function velocityComputedMs(row: MarketVelocityRow) {
  const ms = row.computed_at ? Date.parse(row.computed_at) : Number.NaN;
  return Number.isFinite(ms) ? ms : 0;
}

function shouldReplaceVelocityRow(existing: MarketVelocityRow | undefined, candidate: MarketVelocityRow) {
  if (!existing) return true;
  const existingUsable = isUsableConditionVelocity(existing);
  const candidateUsable = isUsableConditionVelocity(candidate);
  if (existingUsable !== candidateUsable) return candidateUsable;

  const existingComputed = velocityComputedMs(existing);
  const candidateComputed = velocityComputedMs(candidate);
  if (existingComputed !== candidateComputed) return candidateComputed > existingComputed;

  const existingSold7d = Number(existing.sold_7d_count ?? 0);
  const candidateSold7d = Number(candidate.sold_7d_count ?? 0);
  if (existingSold7d !== candidateSold7d) return candidateSold7d > existingSold7d;

  return Number(candidate.observed_sold_sample_count ?? 0) > Number(existing.observed_sold_sample_count ?? 0);
}

function setBetterVelocityRow(target: Map<string, MarketVelocityRow>, key: string, row: MarketVelocityRow) {
  if (shouldReplaceVelocityRow(target.get(key), row)) target.set(key, row);
}

function addVelocityRowsToStatsMap(rows: MarketVelocityRow[], target: Map<string, MarketVelocityRow>) {
  for (const row of rows) {
    const condition = normalizedVelocityCondition(row.condition_class);
    if (condition) {
      if (!isUsableConditionVelocity(row)) continue;
      const conditionKey = velocityStatsConditionKey(row.comparable_key, condition);
      setBetterVelocityRow(target, conditionKey, row);
    } else {
      setBetterVelocityRow(target, row.comparable_key, row);
    }
  }
}

/**
 * Wave 130 (2026-05-16): mvp_candidate_pool에서 condition_class batch fetch.
 * RPC reserve_mvp_pool_candidates가 condition_class를 return하지 않으므로 별도 fetch.
 * (RPC 시그니처 변경은 race condition 5종 검증 필요 — CLAUDE.md 정책. 안전하게 별도 query.)
 */
// Wave 182 Phase 3 (2026-05-17): option_base_assumed by pid (mvp_listing_parsed.parsed_json).
// pack-reveal-modal + user-reveal-dashboard 에 "기본 옵션 가정" UI badge 표시.
export async function fetchOptionBaseAssumedByPids(pids: number[]): Promise<Map<number, string[]>> {
  if (pids.length === 0) return new Map();
  const unique = [...new Set(pids.filter((p) => Number.isFinite(p)))];
  if (unique.length === 0) return new Map();
  const map = new Map<number, string[]>();
  try {
    const res = await callSupabase(
      `/mvp_listing_parsed?select=pid,parsed_json&pid=in.(${unique.join(",")})`,
      { headers: authHeaders() },
    );
    const payload = await res.json().catch(() => null);
    const rows = Array.isArray(payload)
      ? (payload as Array<{ pid: number; parsed_json: Record<string, unknown> | null }>)
      : [];
    for (const row of rows) {
      const arr = row.parsed_json?.option_base_assumed;
      if (Array.isArray(arr) && arr.length > 0) map.set(Number(row.pid), arr as string[]);
    }
  } catch (err) {
    console.warn("fetchOptionBaseAssumedByPids failed (non-fatal)", err);
  }
  return map;
}

export async function fetchPoolConditionClassByPids(pids: number[]): Promise<Map<number, string>> {
  if (pids.length === 0) return new Map();
  const unique = [...new Set(pids.filter((p) => Number.isFinite(p)))];
  if (unique.length === 0) return new Map();
  const map = new Map<number, string>();
  try {
    const res = await callSupabase(
      `/mvp_candidate_pool?select=pid,condition_class&pid=in.(${unique.join(",")})`,
      { headers: authHeaders() },
    );
    const payload = await res.json().catch(() => null);
    const rows = Array.isArray(payload)
      ? (payload as Array<{ pid: number; condition_class: string | null }>)
      : [];
    for (const row of rows) map.set(Number(row.pid), row.condition_class ?? "normal");
  } catch (err) {
    // Wave 130: condition_class fetch 실패는 critical 아님 — 'normal' default로 fallback.
    // 시세 매칭 정확도만 살짝 떨어짐 (모든 매물 normal class로 표시).
    console.warn("fetchPoolConditionClassByPids failed (non-fatal, fallback to normal)", err);
  }
  return map;
}

// Wave 714d (2026-05-23): 신발/의류 5-tier grading + chips by pid — pack-reveal-modal (쉬운모드) 노출용.
export type GradingInfo = {
  tier: string | null;
  cluster: string | null;
  confidence: number | null;
  flags: Record<string, unknown> | null;
  chips: string[] | null;
};

export async function fetchGradingByPids(pids: number[]): Promise<Map<number, GradingInfo>> {
  if (pids.length === 0) return new Map();
  const unique = [...new Set(pids.filter((p) => Number.isFinite(p)))];
  if (unique.length === 0) return new Map();
  const map = new Map<number, GradingInfo>();
  try {
    const res = await callSupabase(
      `/mvp_listing_parsed?select=pid,condition_tier,condition_cluster,condition_confidence,condition_flags,condition_notes,parsed_json&pid=in.(${unique.join(",")})`,
      { headers: authHeaders() },
    );
    const payload = await res.json().catch(() => null);
    const rows = Array.isArray(payload)
      ? (payload as Array<{
          pid: number;
          condition_tier: string | null;
          condition_cluster: string | null;
          condition_confidence: number | null;
          condition_flags: Record<string, unknown> | null;
          condition_notes: string[] | null;
          parsed_json: Record<string, unknown> | null;
        }>)
      : [];
    for (const row of rows) {
      const grade = (row.parsed_json?.condition_grade as { chips?: string[] } | null) ?? null;
      const parsedJsonNotes = row.parsed_json?.condition_notes as string[] | undefined;
      map.set(Number(row.pid), {
        tier: row.condition_tier ?? null,
        cluster: row.condition_cluster ?? null,
        confidence: row.condition_confidence ?? null,
        flags: row.condition_flags ?? null,
        chips: mergeConditionDisplayChips(grade?.chips ?? null, row.condition_notes ?? parsedJsonNotes ?? null),
      });
    }
  } catch (err) {
    console.warn("fetchGradingByPids failed (non-fatal)", err);
  }
  return map;
}

export async function fetchLatestMarketStats(comparableKeys: (string | null)[]): Promise<MarketStatsMap> {
  const unique = [...new Set(comparableKeys.filter((key): key is string => Boolean(key)))];
  if (unique.length === 0) return new Map();
  const now = Date.now();
  const map: MarketStatsMap = new Map();
  const missing: string[] = [];
  for (const key of unique) {
    const cached = readTtl(marketStatsCache, key, now);
    if (cached) {
      map.set(key, cached);
    } else {
      missing.push(key);
    }
  }
  if (missing.length === 0) return map;

  const cols = [
    "comparable_key",
    "condition_class",
    "condition_tier",  // Wave 814+816: 5-tier (S/A/B/C/D) — fashion 시세 tier 별 row
    "active_median_price",
    "sold_median_price",
    "blended_median_price",
    "p25_price",
    "p75_price",
    "active_sample_count",
    "sold_sample_count",
    "disappeared_sample_count",
    "confidence",
    "computed_at",
  ].join(",");
  const encoded = missing.map((key) => encodeURIComponent(key)).join(",");
  // Wave 130: condition별 row 모두 fetch — comparable_key 당 최대 6 class (mint/clean/normal/worn/low_batt + 'all' legacy).
  // limit 늘려서 모든 condition 가져오게.
  const res = await callSupabase(
    `/mvp_market_price_daily?select=${cols}&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc&limit=${Math.max(200, missing.length * 12)}`,
    { headers: authHeaders() },
  );
  const rows = (await res.json()) as MarketPriceRow[];
  const fetched: MarketStatsMap = new Map();
  // Wave 814+816 (2026-05-30): composite key (tier|cc) — fashion tier/non-fashion cc 분리.
  //   기존 = cc 단일 key 라 fashion row (cc="") 다중 tier collision (non-deterministic).
  //   새 = `${tier}|${cc}` 박아 정확 매칭.
  for (const row of rows) {
    const byCondition = fetched.get(row.comparable_key) ?? new Map<string, MarketPriceRow>();
    const key = marketStatsConditionKey(row.condition_tier ?? "", row.condition_class);
    if (!byCondition.has(key)) {
      byCondition.set(key, row);
    }
    fetched.set(row.comparable_key, byCondition);
  }
  for (const key of missing) {
    const byCondition = fetched.get(key) ?? new Map<string, MarketPriceRow>();
    writeTtl(marketStatsCache, key, byCondition, MARKET_STATS_CACHE_TTL_MS, now);
    map.set(key, byCondition);
  }
  return map;
}

function marketStatsPerSourceCacheKey(source: KnownMarketplaceSource, comparableKey: string) {
  return `${source}:${comparableKey}`;
}

export async function fetchLatestMarketStatsPerSource(
  comparableKeys: (string | null)[],
  sources: KnownMarketplaceSource[] = [DAANGN_SOURCE_ID],
): Promise<MarketStatsBySourceMap> {
  const uniqueKeys = [...new Set(comparableKeys.filter((key): key is string => Boolean(key)))];
  const uniqueSources = [...new Set(sources.map((source) => normalizeMarketplaceSource(source)))];
  const map: MarketStatsBySourceMap = new Map();
  if (uniqueKeys.length === 0 || uniqueSources.length === 0) return map;

  const now = Date.now();
  const missingPairs: Array<{ source: KnownMarketplaceSource; key: string }> = [];
  for (const key of uniqueKeys) {
    const bySource = map.get(key) ?? new Map<KnownMarketplaceSource, MarketStatsByCondition>();
    for (const source of uniqueSources) {
      const cached = readTtl(marketStatsPerSourceCache, marketStatsPerSourceCacheKey(source, key), now);
      if (cached) {
        bySource.set(source, cached);
      } else {
        missingPairs.push({ source, key });
      }
    }
    if (bySource.size > 0) map.set(key, bySource);
  }
  if (missingPairs.length === 0) return map;

  const missingKeys = [...new Set(missingPairs.map((pair) => pair.key))];
  const missingSources = [...new Set(missingPairs.map((pair) => pair.source))];
  const cols = [
    "comparable_key",
    "condition_class",
    "condition_tier",  // Wave 814+816: 5-tier composite key
    "source",
    "active_median_price",
    "sold_median_price",
    "blended_median_price",
    "p25_price",
    "p75_price",
    "active_sample_count",
    "sold_sample_count",
    "disappeared_sample_count",
    "confidence",
    "computed_at",
  ].join(",");
  const encodedKeys = missingKeys.map((key) => encodeURIComponent(key)).join(",");
  const encodedSources = missingSources.map((source) => encodeURIComponent(source)).join(",");
  const res = await callSupabase(
    `/mvp_market_price_daily_per_source?select=${cols}&comparable_key=in.(${encodedKeys})&source=in.(${encodedSources})&order=date.desc,computed_at.desc&limit=${Math.max(400, missingKeys.length * missingSources.length * 12)}`,
    { headers: authHeaders() },
  );
  const rows = (await res.json()) as MarketPriceRowWithSource[];
  const fetched = new Map<string, MarketStatsByCondition>();
  // Wave 814+816: composite key (tier|cc) — fashion tier/non-fashion cc 분리.
  for (const row of rows) {
    const source = normalizeMarketplaceSource(row.source);
    const cacheKey = marketStatsPerSourceCacheKey(source, row.comparable_key);
    const byCondition = fetched.get(cacheKey) ?? new Map<string, MarketPriceRow>();
    const key = marketStatsConditionKey(row.condition_tier ?? "", row.condition_class);
    if (!byCondition.has(key)) byCondition.set(key, row);
    fetched.set(cacheKey, byCondition);
  }

  for (const pair of missingPairs) {
    const cacheKey = marketStatsPerSourceCacheKey(pair.source, pair.key);
    const byCondition = fetched.get(cacheKey) ?? new Map<string, MarketPriceRow>();
    writeTtl(marketStatsPerSourceCache, cacheKey, byCondition, MARKET_STATS_CACHE_TTL_MS, now);
    if (byCondition.size > 0) {
      const bySource = map.get(pair.key) ?? new Map<KnownMarketplaceSource, MarketStatsByCondition>();
      bySource.set(pair.source, byCondition);
      map.set(pair.key, bySource);
    }
  }
  return map;
}

// Wave 201 (2026-05-18): unopened 매물 시세 anchor — mvp_reference_prices.effective_price.
// 사용자: "새상품이면 다나와 시세를 보여줘야지 뭘 고민하는건데"
// 기존: unopened condition 도 mvp_market_price_daily 의 sold/active median 사용 → 번개 중고 미개봉 거래가.
// 새: unopened 시 reference_prices anchor (다나와/공식) 우선.
export async function fetchReferencePrices(comparableKeys: (string | null)[]): Promise<Map<string, number>> {
  const unique = [...new Set(comparableKeys.filter((k): k is string => Boolean(k)))];
  if (unique.length === 0) return new Map();
  const now = Date.now();
  const queryKeys = new Set(unique);
  // Wave 207: historical AirPods Pro 2 rows use the unified key, while the
  // reference scraper originally stored connector-specific keys only.
  if (queryKeys.has("airpods|airpods_pro_2")) {
    queryKeys.add("airpods|airpods_pro_2_usbc|usbc");
    queryKeys.add("airpods|airpods_pro_2_lightning|lightning");
  }
  const map = new Map<string, number>();
  const missing: string[] = [];
  for (const key of queryKeys) {
    const cached = readTtl(referencePriceCache, key, now);
    if (cached === undefined) {
      missing.push(key);
    } else if (cached != null && cached > 0) {
      map.set(key, cached);
    }
  }
  if (missing.length > 0) {
    const encoded = missing.map((k) => encodeURIComponent(k)).join(",");
    const res = await callSupabase(
      `/mvp_reference_prices?select=comparable_key,effective_price&comparable_key=in.(${encoded})&effective_price=not.is.null&limit=${Math.max(100, missing.length * 2)}`,
      { headers: authHeaders() },
    );
    const parsed = await res.json();
    const rows = Array.isArray(parsed) ? (parsed as Array<{ comparable_key: string; effective_price: number }>) : [];
    const fetched = new Map<string, number>();
    for (const row of rows) {
      if (row.effective_price > 0) {
        const price = Number(row.effective_price);
        fetched.set(row.comparable_key, price);
        map.set(row.comparable_key, price);
      }
    }
    for (const key of missing) {
      writeTtl(referencePriceCache, key, fetched.get(key) ?? null, REFERENCE_PRICE_CACHE_TTL_MS, now);
    }
  }
  if (!map.has("airpods|airpods_pro_2") && unique.includes("airpods|airpods_pro_2")) {
    const aliasPrice =
      map.get("airpods|airpods_pro_2_usbc|usbc") ??
      map.get("airpods|airpods_pro_2_lightning|lightning") ??
      null;
    if (aliasPrice != null && aliasPrice > 0) {
      map.set("airpods|airpods_pro_2", aliasPrice);
      writeTtl(referencePriceCache, "airpods|airpods_pro_2", aliasPrice, REFERENCE_PRICE_CACHE_TTL_MS, now);
    }
  }
  return map;
}

// Wave 252.A real (2026-05-20): v3 clothing comparable_key stale 가드.
//
//   문제: Wave 216 이전 clothing parser (v3) 는 comparable_key 에 product_type 미박힘.
//     예: `clothing|bape_tee|a_grade` (3 tokens). v7 parser 는 `clothing|bape_tee|tee|a_grade` (4 tokens).
//   v3 매물이 mvp_market_price_daily 의 v3 row (mixed-pool: tee + hoodie + crewneck 평균) 로 lookup →
//     사용자에게 잘못된 median 표시 (BAPE hoodie A-grade mint 매물에 78,200원 (tee 가격) 또는 mixed 119,600원).
//
//   해결: v3 매물의 comparable_key + sibling v7 row 존재 시 v3 row 차단 → medianPrice=null →
//     UI 에서 "비교 기준 미확정 (재매칭 대기)" 표시. Wave 252.B step 1 의 v3 재매칭 완료 후 자동 정상화.
//
//   비용: v7 sibling presence batch lookup 1회 추가 (LIKE prefix or 절). v3 매물 비율 약 13% (production
//     clothing 2,917 / 4,493).

type V7SiblingPresenceMap = Map<string, boolean>;

const CLOTHING_V3_CONDITION_TOKENS = new Set([
  "a_grade",
  "b_grade",
  "c_grade",
  "s_grade",
  "unknown_condition",
  "reject",
]);

function isClothingV3PackOpenKey(key: string | null | undefined): boolean {
  if (!key) return false;
  const parts = key.split("|");
  if (parts.length !== 3) return false;
  if (parts[0] !== "clothing") return false;
  return CLOTHING_V3_CONDITION_TOKENS.has(parts[2] ?? "");
}

const v7SiblingPresenceCache = new Map<string, TtlEntry<boolean>>();
const V7_SIBLING_PRESENCE_CACHE_TTL_MS = ttlFromEnv("PACK_V7_SIBLING_CACHE_TTL_MS", 10 * 60 * 1000);

export async function fetchV7SiblingPresence(
  comparableKeys: (string | null | undefined)[],
): Promise<V7SiblingPresenceMap> {
  const map: V7SiblingPresenceMap = new Map();
  const v3Candidates = [...new Set(comparableKeys.filter((k): k is string => isClothingV3PackOpenKey(k ?? null)))];
  if (v3Candidates.length === 0) return map;
  const now = Date.now();
  const missing: string[] = [];
  for (const key of v3Candidates) {
    const cached = readTtl(v7SiblingPresenceCache, key, now);
    if (cached === undefined) missing.push(key);
    else map.set(key, cached);
  }
  if (missing.length === 0) return map;

  const orClauses: string[] = [];
  for (const v3Key of missing) {
    const parts = v3Key.split("|");
    const prefix = `${parts[0]}|${parts[1]}|`;
    orClauses.push(`comparable_key.like.${encodeURIComponent(prefix + "*")}`);
  }
  if (orClauses.length === 0) return map;

  try {
    const limit = Math.max(200, missing.length * 50);
    const res = await callSupabase(
      `/mvp_market_price_daily?select=comparable_key&or=(${orClauses.join(",")})&order=date.desc&limit=${limit}`,
      { headers: authHeaders() },
    );
    const rows = (await res.json()) as Array<{ comparable_key: string }>;
    const v7Presence = new Set<string>();
    for (const row of rows) {
      const p = row.comparable_key.split("|");
      if (p.length === 4 && p[0] === "clothing") {
        // signature: clothing|<sku>|<condition_token>
        v7Presence.add(`${p[0]}|${p[1]}|${p[3]}`);
      }
    }
    for (const v3Key of missing) {
      const present = v7Presence.has(v3Key);
      map.set(v3Key, present);
      writeTtl(v7SiblingPresenceCache, v3Key, present, V7_SIBLING_PRESENCE_CACHE_TTL_MS, now);
    }
  } catch (err) {
    console.warn("fetchV7SiblingPresence failed (non-fatal)", err);
    // failure → no stale 가드 (기존 동작 그대로). additive only.
  }
  return map;
}

export async function fetchLatestMarketVelocity(comparableKeys: (string | null)[]): Promise<Map<string, MarketVelocityRow>> {
  const unique = [...new Set(comparableKeys.filter((key): key is string => Boolean(key)))];
  if (unique.length === 0) return new Map();
  const now = Date.now();
  const latest = new Map<string, MarketVelocityRow>();
  const missing: string[] = [];
  for (const key of unique) {
    const cached = readTtl(marketVelocityCache, key, now);
    if (cached === undefined) {
      missing.push(key);
    } else if (cached?.length) {
      addVelocityRowsToStatsMap(cached, latest);
    }
  }
  if (missing.length === 0) return latest;

  const cols = [
    "comparable_key",
    "condition_class",
    "category",
    "observed_sold_sample_count",
    "active_sample_count",
    "sold_24h_count",
    "sold_7d_count",
    "confidence",
    "median_hours_to_sold",
    "p25_hours_to_sold",
    "p75_hours_to_sold",
    "clock_basis",
    "computed_at",
  ].join(",");
  const encoded = missing.map((key) => encodeURIComponent(key)).join(",");
  const res = await callSupabase(
    // Wave 1025: all row + condition_class row를 같이 가져온다.
    // UI는 condition row가 충분한 표본일 때만 사용하고, 아니면 all aggregate로 fallback.
    `/mvp_market_velocity_daily?select=${cols}&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc,observed_sold_sample_count.desc&limit=${Math.max(100, missing.length * 10)}`,
    { headers: authHeaders() },
  );
  const rows = (await res.json()) as MarketVelocityRow[];
  const fetchedByKey = new Map<string, MarketVelocityRow[]>();
  for (const row of rows) {
    const bucket = fetchedByKey.get(row.comparable_key) ?? [];
    bucket.push(row);
    fetchedByKey.set(row.comparable_key, bucket);
  }
  for (const key of missing) {
    const bucket = fetchedByKey.get(key) ?? null;
    writeTtl(marketVelocityCache, key, bucket, MARKET_VELOCITY_CACHE_TTL_MS, now);
    if (bucket?.length) addVelocityRowsToStatsMap(bucket, latest);
  }
  return latest;
}

const MARKET_LABELS: Record<string, string> = {
  airpods: "AirPods",
  airpods_max: "AirPods Max",
  airpods_pro_2: "AirPods Pro 2",
  airpods_4: "AirPods 4",
  applewatch: "Apple Watch",
  galaxywatch: "Galaxy Watch",
  usbc: "USB-C",
  lightning: "Lightning",
  anc: "ANC",
  no_anc: "비ANC",
  gps: "GPS",
  cellular: "셀룰러",
  aluminum: "알루미늄",
  stainless: "스테인리스",
  ultra: "Ultra",
};

function marketBasisLabel(comparableKey: string | null, skuName: string) {
  if (!comparableKey) return `${skuName} 비교 기준 미확정`;
  const parts = comparableKey.split("|").filter(Boolean);
  const readable = parts.map((part) => MARKET_LABELS[part] ?? part.replaceAll("_", " ")).join(" · ");
  return `${readable} · 전체 본품`;
}

function excludedExamplesForKey(comparableKey: string | null) {
  const key = comparableKey ?? "";
  if (key.startsWith("airpods|") || key.includes("buds")) {
    return ["왼쪽/오른쪽 유닛", "본체만", "케이스만"];
  }
  if (key.startsWith("applewatch|") || key.startsWith("galaxywatch|")) {
    return ["스트랩/밴드 단품", "충전기만", "파손/부품용"];
  }
  return ["부품용", "구성품 일부", "다중상품/선택가"];
}

// Wave 130 (2026-05-16): condition_class 별 시세 표시. 사업 보고서 L2 — "끼리 비교" retention.
// 같은 SKU+옵션 매물의 condition별 시세 spread 15~40% (mint 550K vs worn 430K 등).
// 2026-05-16 (N4): unopened (박스 안 뜯음) vs mint (사용감 거의 없는 S급) 분리.
const CONDITION_LABEL: Record<string, string> = {
  unopened: "미개봉/새상품",
  mint: "S급 (사용감 거의 없음)",
  clean: "A급/풀세트",
  normal: "일반",
  worn: "사용감",
  low_batt: "배터리 저하",
  flawed: "손상",
  all: "전체",
};

const MIN_SAMPLE_COUNT_FOR_CONFIDENCE = 3;
const MIN_SOURCE_SAMPLE_COUNT_FOR_CONFIDENCE = 3;

// Wave 159h (2026-05-17): condition-fallback shared module 사용 (DRY).
// Wave 817 (2026-05-30): tier 인자 추가 — fashion 시세 tier 정확 lookup.
function selectMarketRowByCondition(
  byCondition: MarketStatsByCondition | undefined,
  targetConditionClass: string | null,
  targetConditionTier?: string | null,
): { row: MarketPriceRow | undefined; conditionClass: string | null; fallbackUsed: boolean } {
  return pickByConditionFallback(
    byCondition,
    targetConditionClass,
    (r) => Number(r.active_sample_count ?? 0) + Number(r.sold_sample_count ?? 0) + Number(r.disappeared_sample_count ?? 0),
    1,
    targetConditionTier,
  );
}

function marketRowSampleCount(row: MarketPriceRow | null | undefined) {
  return Number(row?.active_sample_count ?? 0)
    + Number(row?.sold_sample_count ?? 0)
    + Number(row?.disappeared_sample_count ?? 0);
}

function marketRowActiveSoldSampleCount(row: MarketPriceRow | null | undefined) {
  return Number(row?.active_sample_count ?? 0) + Number(row?.sold_sample_count ?? 0);
}

function marketSalePrice(row: MarketPriceRow | null | undefined) {
  return row?.blended_median_price ?? row?.active_median_price ?? null;
}

function resaleChannelBasis(
  source: KnownMarketplaceSource,
  label: string,
  row: MarketPriceRow | null | undefined,
  priceBasis: ResaleChannelBasis["priceBasis"],
  fallbackUsed: boolean,
): ResaleChannelBasis {
  return {
    source,
    label,
    salePrice: marketSalePrice(row),
    sampleCount: marketRowSampleCount(row),
    activeSampleCount: Number(row?.active_sample_count ?? 0),
    soldSampleCount: Number(row?.sold_sample_count ?? 0),
    disappearedSampleCount: Number(row?.disappeared_sample_count ?? 0),
    confidence: row?.confidence ?? null,
    priceBasis: row ? priceBasis : "unavailable",
    fallbackUsed,
  };
}

type MarketBasisSourceOptions = {
  listingSource?: string | null;
  perSourceMarketStats?: MarketStatsBySourceMap | null;
};

export function marketBasisForCandidate(
  comparableKey: string | null,
  skuName: string,
  marketStats: MarketStatsMap,
  conditionClass: string | null = null,
  // Wave 201 (2026-05-18): unopened 매물 anchor — reference_prices.effective_price 우선.
  referencePrices?: Map<string, number>,
  // Wave 252.A real (2026-05-20): v3 stale 가드 — v7 sibling 존재 시 mixed-pool row 차단.
  v7SiblingPresence?: V7SiblingPresenceMap,
  sourceOptions?: MarketBasisSourceOptions,
  // Wave 817 (2026-05-30): tier 인자 — fashion (shoe/clothing) 시세 tier 정확 lookup.
  //   기존 effectiveConditionClass = isFashion ? "" : cc 임시 봉합 (Wave 803i/886.16)
  //   제거됨. caller 가 tier 직접 전달.
  conditionTier?: string | null,
): RevealMarketBasis {
  // Wave 252.A real: v3 clothing key + v7 sibling 존재 → mixed-pool 신뢰 불가 → "v3_pending_rematch" 표시.
  //   medianPrice=null 로 caller (currentNetProfitFromMarketPrice) 가 차익 계산 skip → 사용자에게 잘못된 가격 노출 X.
  //   Wave 252.B step 1 의 재매칭 완료 후 v3 매물의 comparable_key 가 v7 패턴으로 update → 자동 정상화.
  if (comparableKey && v7SiblingPresence?.get(comparableKey) === true) {
    return {
      comparableKey,
      label: marketBasisLabel(comparableKey, skuName),
      p25Price: null,
      medianPrice: null,
      p75Price: null,
      sampleCount: 0,
      activeSampleCount: 0,
      soldSampleCount: 0,
      disappearedSampleCount: 0,
      confidence: null,
      priceSource: "v3_pending_rematch",
      marketplaceSource: null,
      marketplaceLabel: null,
      sourceSampleUsed: false,
      sourceFallbackUsed: false,
      resaleChannels: [],
      computedAt: null,
      excludedExamples: excludedExamplesForKey(comparableKey),
      conditionClass: conditionClass ?? null,
      conditionLabel: conditionClass ? CONDITION_LABEL[conditionClass] ?? conditionClass : null,
      fallbackUsed: false,
      otherConditions: [],
    };
  }
  const byCondition = comparableKey ? marketStats.get(comparableKey) : undefined;
  // Wave 817 (2026-05-30): tier 기반 시세 lookup. fashion 의 effectiveConditionClass="" 임시 봉합 제거.
  //   - fashion (shoe/clothing): tier 박혀있어 tier 정확 매칭 (cc 무시)
  //   - non-fashion: cc fallback chain
  //   conditionTier 인자 caller 가 전달 (Wave 818 callsites).
  //   참고 (옛 정책): Wave 886.16b — isFashionKey ? "" : cc 임시 봉합. Wave 803i — `byCondition.get("")` hack.
  //   둘 다 tier 차원 drop → non-deterministic collision 발생. Wave 817 가 진짜 fix.
  const { row: mixedStat, conditionClass: mixedCondition, fallbackUsed: mixedFallbackUsed } = selectMarketRowByCondition(
    byCondition,
    conditionClass,
    conditionTier,
  );
  const listingSource = sourceOptions?.listingSource ? normalizeMarketplaceSource(sourceOptions.listingSource) : null;
  const sourceByCondition = comparableKey && listingSource
    ? sourceOptions?.perSourceMarketStats?.get(comparableKey)?.get(listingSource)
    : undefined;
  const {
    row: sourceStatCandidate,
    conditionClass: sourceCondition,
    fallbackUsed: sourceConditionFallbackUsed,
  } = selectMarketRowByCondition(sourceByCondition, conditionClass, conditionTier);
  const sourceMarketRequired = listingSource === DAANGN_SOURCE_ID;
  const sourceStatUsable = sourceStatCandidate != null
    && marketRowActiveSoldSampleCount(sourceStatCandidate) >= MIN_SOURCE_SAMPLE_COUNT_FOR_CONFIDENCE;
  // Wave 1022 (2026-06-02): 당근은 실행 시장 자체가 다르다.
  // source sample 이 부족하면 mixed/reference fallback 으로 상세/easy 기준 시세를 만들지 않는다.
  // UI/상세 접근은 "당근 표본 부족"으로 fail-closed 하고, 번개/중나만 mixed fallback 을 유지한다.
  // Wave 1023 (2026-06-02): 당근은 source뿐 아니라 condition/tier fallback도 fail-closed.
  // 같은 당근 row여도 worn → normal 같은 fallback으로 차익을 만들면 "같은 상태끼리" 원칙이 샌다.
  const useListingSourceStat = sourceMarketRequired && sourceStatUsable && !sourceConditionFallbackUsed;
  const stat = useListingSourceStat ? sourceStatCandidate : (sourceMarketRequired ? undefined : mixedStat);
  const sampleStat = useListingSourceStat ? sourceStatCandidate : (sourceMarketRequired ? sourceStatCandidate : stat);
  const actualCondition = useListingSourceStat ? sourceCondition : (sourceMarketRequired ? (sourceCondition ?? conditionClass) : mixedCondition);
  const fallbackUsed = useListingSourceStat ? sourceConditionFallbackUsed : (sourceMarketRequired ? sourceConditionFallbackUsed : mixedFallbackUsed);
  const activeSampleCount = Number(sampleStat?.active_sample_count ?? 0);
  const soldSampleCount = Number(sampleStat?.sold_sample_count ?? 0);
  const disappearedSampleCount = Number(sampleStat?.disappeared_sample_count ?? 0);

  // Wave 130: 다른 condition 시세 (UI에서 비교용 — "내 condition vs 전체" 표시).
  const otherConditions: RevealMarketBasis["otherConditions"] = [];
  const comparisonByCondition = useListingSourceStat ? sourceByCondition : (sourceMarketRequired ? undefined : byCondition);
  if (comparisonByCondition && actualCondition) {
    for (const [cls, row] of comparisonByCondition.entries()) {
      if (cls === actualCondition || cls === "flawed") continue;
      const samples =
        Number(row.active_sample_count ?? 0) +
        Number(row.sold_sample_count ?? 0) +
        Number(row.disappeared_sample_count ?? 0);
      if (samples < MIN_SAMPLE_COUNT_FOR_CONFIDENCE) continue;
      otherConditions.push({
        conditionClass: cls,
        label: CONDITION_LABEL[cls] ?? cls,
        medianPrice: row.blended_median_price ?? row.active_median_price ?? null,
        sampleCount: samples,
      });
    }
    // 가격 높은 순 정렬 (UI에서 mint→clean→normal→worn 자연 순서)
    otherConditions.sort((a, b) => (b.medianPrice ?? 0) - (a.medianPrice ?? 0));
  }

  // Wave 201 (2026-05-18): unopened 매물 시세 = reference_prices.effective_price (다나와/공식 anchor).
  // 사용자 정정: 미개봉 매물은 번개 중고 sold median이 아니라 다나와 새 가격 표시해야 함.
  const refPrice = (actualCondition === "unopened" && comparableKey && referencePrices?.get(comparableKey)) || null;
  const useRefAnchor = !sourceMarketRequired && !useListingSourceStat && refPrice != null && refPrice > 0;
  const medianPriceFinal = sourceMarketRequired && !useListingSourceStat
    ? null
    : useRefAnchor ? refPrice : marketSalePrice(stat);
  const daangnByCondition = comparableKey
    ? sourceOptions?.perSourceMarketStats?.get(comparableKey)?.get(DAANGN_SOURCE_ID)
    : undefined;
  const {
    row: daangnChannelStat,
    fallbackUsed: daangnChannelFallbackUsed,
  } = selectMarketRowByCondition(daangnByCondition, conditionClass, conditionTier);
  const daangnChannelUsable = daangnChannelStat != null
    && marketRowActiveSoldSampleCount(daangnChannelStat) >= MIN_SOURCE_SAMPLE_COUNT_FOR_CONFIDENCE;
  const resaleChannels: ResaleChannelBasis[] = [
    resaleChannelBasis(BUNJANG_SOURCE_ID, marketplaceSourceLabel(BUNJANG_SOURCE_ID), mixedStat, "mixed", mixedFallbackUsed),
    resaleChannelBasis(JOONGNA_SOURCE_ID, marketplaceSourceLabel(JOONGNA_SOURCE_ID), mixedStat, "mixed", mixedFallbackUsed),
    resaleChannelBasis(
      DAANGN_SOURCE_ID,
      marketplaceSourceLabel(DAANGN_SOURCE_ID),
      daangnChannelUsable ? daangnChannelStat : null,
      "source",
      daangnChannelFallbackUsed,
    ),
  ];

  return {
    comparableKey,
    label: marketBasisLabel(comparableKey, skuName),
    p25Price: useRefAnchor || (sourceMarketRequired && !useListingSourceStat) ? null : (stat?.p25_price ?? null),
    medianPrice: medianPriceFinal,
    p75Price: useRefAnchor || (sourceMarketRequired && !useListingSourceStat) ? null : (stat?.p75_price ?? null),
    sampleCount: activeSampleCount + soldSampleCount + disappearedSampleCount,
    activeSampleCount,
    soldSampleCount,
    disappearedSampleCount,
    // ref anchor 신뢰는 medium (단일 값이라 "high" 비호환).
    confidence: useRefAnchor ? "medium" : (sourceMarketRequired && !useListingSourceStat ? null : (stat?.confidence ?? null)),
    priceSource: useRefAnchor ? "reference" : (sourceMarketRequired || useListingSourceStat ? "source_market" : "market"),
    marketplaceSource: useListingSourceStat ? listingSource : (sourceMarketRequired ? listingSource : "mixed"),
    marketplaceLabel: useListingSourceStat ? marketplaceSourceLabel(listingSource) : (sourceMarketRequired ? marketplaceSourceLabel(listingSource) : "통합"),
    sourceSampleUsed: useListingSourceStat,
    sourceFallbackUsed: listingSource === DAANGN_SOURCE_ID && !useListingSourceStat,
    basisSource: useListingSourceStat ? listingSource : null,
    basisSourceLabel: useListingSourceStat ? marketplaceSourceLabel(listingSource) : null,
    sourceSampleCount: sourceMarketRequired || useListingSourceStat ? activeSampleCount + soldSampleCount : null,
    resaleChannels,
    computedAt: sampleStat?.computed_at ?? stat?.computed_at ?? null,
    excludedExamples: excludedExamplesForKey(comparableKey),
    conditionClass: actualCondition,
    conditionLabel: actualCondition ? CONDITION_LABEL[actualCondition] ?? actualCondition : null,
    fallbackUsed,
    otherConditions,
  };
}

export function velocityBasisForCandidate(
  comparableKey: string | null,
  velocityStats: Map<string, MarketVelocityRow>,
  readinessMap: Awaited<ReturnType<typeof loadCategoryReadinessMap>>,
  conditionClass?: string | null,
): RevealVelocityBasis | null {
  if (!comparableKey) return null;
  const category = categoryFromComparableKey(comparableKey);
  if (!category || readinessMap[category]?.status !== "ready") return null;
  const conditionStat = velocityStats.get(velocityStatsConditionKey(comparableKey, conditionClass));
  const allStat = velocityStats.get(comparableKey);
  const stat = isUsableConditionVelocity(conditionStat) ? conditionStat : allStat;
  // Wave 394.7.ab (사용자 짚음 — "에어팟맥스면 기록이 없을수가 없는데 수집 중만 뜸"):
  // 이전엔 confidence high/medium 만 통과 → low 인 케이스 데이터 있어도 전부 null 반환.
  // 사용자 입장 = "수집 중" 만 보임. "데이터 진짜 있긴 한 거?" 의심.
  // 이제 low 도 통과 — UI 측 (velocityGuideStep) 에서 confidence 별 분기로 정직 표시.
  if (!stat) return null;
  const conditionSpecific = Boolean(normalizedVelocityCondition(stat.condition_class));
  return {
    comparableKey,
    conditionClass: conditionSpecific ? stat.condition_class : null,
    conditionSpecific,
    confidence: stat.confidence,
    observedSoldSampleCount: Number(stat.observed_sold_sample_count ?? 0),
    activeSampleCount: Number(stat.active_sample_count ?? 0),
    sold24hCount: Number(stat.sold_24h_count ?? 0),
    sold7dCount: Number(stat.sold_7d_count ?? 0),
    medianHoursToSold: stat.median_hours_to_sold,
    p25HoursToSold: stat.p25_hours_to_sold,
    p75HoursToSold: stat.p75_hours_to_sold,
    clockBasis: stat.clock_basis,
    computedAt: stat.computed_at,
  };
}

async function patchPoolVerified(pid: number): Promise<void> {
  const nowIso = new Date().toISOString();
  await callSupabase(`/mvp_candidate_pool?pid=eq.${pid}`, {
    method: "PATCH",
    headers: authHeaders("return=minimal"),
    body: JSON.stringify({ last_verified_at: nowIso, updated_at: nowIso }),
  });
}

type SpendAndRecordResult = {
  packOpenId: number;
  ok: boolean;
  balance: number;
  message: string;
};

// 크레딧 차감과 pack_open 기록을 하나의 DB 트랜잭션으로 처리.
// isInfiniteCredits=true이면 amount=0으로 호출해 차감 없이 감사 기록만 남김.
async function rpcSpendAndRecord(input: {
  userRef: string;
  authUserId: string;
  amount: number;
  band: PackBand;
  tokensSpent: number;
  tokensRefunded: number;
  result: "success" | "refunded" | "failed";
  attemptedPids: number[];
  revealedPids: number[];
  durationMs: number;
}): Promise<SpendAndRecordResult> {
  const res = await callSupabase("/rpc/spend_and_record_pack_open", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      p_user_ref: input.userRef,
      p_auth_user_id: input.authUserId,
      p_amount: input.amount,
      p_band: input.band,
      p_tokens_spent: input.tokensSpent,
      p_tokens_refunded: input.tokensRefunded,
      p_result: input.result,
      p_attempted_pids: input.attemptedPids,
      p_revealed_pids: input.revealedPids,
      p_duration_ms: input.durationMs,
    }),
  });
  const rows = (await res.json()) as { pack_open_id: number; ok: boolean; balance: number; message: string }[];
  const row = rows[0];
  return {
    packOpenId: row?.pack_open_id ?? 0,
    ok: row?.ok ?? false,
    balance: row?.balance ?? 0,
    message: row?.message ?? "unknown",
  };
}

async function insertReveals(
  packOpenId: number,
  cards: RevealCard[],
  userRef: string,
): Promise<void> {
  if (cards.length === 0) return;
  await callSupabase("/mvp_pack_reveals", {
    method: "POST",
    headers: authHeaders("return=minimal"),
    body: JSON.stringify(
      cards.map((card) => ({
        pack_open_id: packOpenId,
        pid: card.pid,
        user_ref: userRef,
        expected_profit_min: card.expectedProfitMin,
        expected_profit_max: card.expectedProfitMax,
        // Wave 213: current_profit_* must be net expected profit, not raw market-price gap.
        // Reveal cards are created from mvp_candidate_pool, whose expected_profit_* already
        // includes buyer shipping, selling fee, resell shipping, and safety buffer.
        current_profit_min: Math.round(card.expectedProfitMin),
        current_profit_max: Math.round(card.expectedProfitMax),
        market_invalidated_at: card.expectedProfitMin < 0
          ? new Date().toISOString()
          : null,
        confidence: card.confidence,
      })),
    ),
  });
}

export async function markRevealClicked(input: { userRef: string; pid: number }): Promise<void> {
  await callSupabase(
    `/mvp_pack_reveals?user_ref=eq.${encodeURIComponent(input.userRef)}&pid=eq.${input.pid}`,
    {
      method: "PATCH",
      headers: authHeaders("return=minimal"),
      body: JSON.stringify({ link_clicked_at: new Date().toISOString() }),
    },
  );
}

export async function submitRevealFeedback(input: {
  userRef: string;
  pid: number;
  feedbackType: RevealFeedbackType;
  note?: string;
}): Promise<void> {
  await callSupabase("/mvp_reveal_feedback?on_conflict=user_ref,pid,feedback_type", {
    method: "POST",
    headers: authHeaders("resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify({
      user_ref: input.userRef,
      pid: input.pid,
      feedback_type: input.feedbackType,
      note: input.note?.slice(0, 5000) ?? "",
      source: "reveal_modal",
      updated_at: new Date().toISOString(),
    }),
  });
}

function shippingSummary(options: RevealListingDetail["shippingOptions"]) {
  if (options.length === 0) return "배송비 정보 없음";
  if (options.some((option) => option.kind === "free" && option.amount === 0)) return "무료배송";
  const labelByKind: Record<RevealListingDetail["shippingOptions"][number]["kind"], string> = {
    free: "무료",
    general: "일반",
    half: "반값",
    unknown: "배송",
  };
  return options
    .map((option) => `${labelByKind[option.kind]} ${option.amount.toLocaleString("ko-KR")}원`)
    .join(" · ");
}

function normalizedTerminalSaleStatus(value: string | null | undefined) {
  const upper = String(value ?? "").toUpperCase();
  return upper === "SOLD" || upper === "SOLD_OUT" ? upper : "SOLD_OUT";
}

type RevealTerminalMarketMeta = {
  raw: {
    name: string | null;
    price: number | null;
    num_faved: number | null;
    sale_status: string | null;
    sku_id: string | null;
    sku_name: string | null;
    seller_uid: string | null;
  } | null;
  parsed: {
    comparable_key: string | null;
    parse_confidence: number | null;
    parser_version: string | null;
  } | null;
};

type RevealDetailSourceMeta = {
  pid: number;
  source: string | null;
  seller_source: string | null;
  url: string | null;
  thumbnail_url: string | null;
  description_preview: string | null;
  num_faved: number | null;
  num_comment: number | null;
  image_count: number | null;
  free_shipping: boolean | null;
  shop_review_rating: number | null;
  shop_review_count: number | null;
  raw_json: Record<string, unknown> | null;
  daangn_region_id: string | null;
  daangn_region_name: string | null;
  daangn_manner_temperature: number | null;
  daangn_review_count: number | null;
};

async function loadRevealDetailSourceMeta(pid: number): Promise<RevealDetailSourceMeta | null> {
  const res = await callSupabase(
    `/mvp_raw_listings?select=pid,source,seller_source,url,thumbnail_url,description_preview,num_faved,num_comment,image_count,free_shipping,shop_review_rating,shop_review_count,raw_json,daangn_region_id,daangn_region_name,daangn_manner_temperature,daangn_review_count&pid=eq.${pid}&limit=1`,
    { headers: authHeaders() },
  );
  const rows = (await res.json()) as RevealDetailSourceMeta[];
  return rows[0] ?? null;
}

function shippingOptionsFromSafety(display: ReturnType<typeof buildMarketplaceSafetyDisplay>): RevealListingDetail["shippingOptions"] {
  if (display.shipping.assumption === "free_shipping" || display.shipping.assumption === "included") {
    return [{ kind: "free", amount: 0 }];
  }
  if (display.shipping.assumption === "separate" || display.shipping.assumption === "unknown") {
    return [{ kind: "unknown", amount: display.shipping.buyerShippingHigh }];
  }
  return [];
}

async function loadRevealTerminalMarketMeta(pid: number): Promise<RevealTerminalMarketMeta | null> {
  const [rawRes, parsedRes] = await Promise.all([
    callSupabase(
      `/mvp_raw_listings?select=name,price,num_faved,sale_status,sku_id,sku_name,seller_uid&pid=eq.${pid}&limit=1`,
      { headers: authHeaders() },
    ),
    callSupabase(
      `/mvp_listing_parsed?select=comparable_key,parse_confidence,parser_version&pid=eq.${pid}&limit=1`,
      { headers: authHeaders() },
    ),
  ]);
  const rawRows = (await rawRes.json()) as RevealTerminalMarketMeta["raw"][];
  const parsedRows = (await parsedRes.json()) as RevealTerminalMarketMeta["parsed"][];
  return {
    raw: rawRows[0] ?? null,
    parsed: parsedRows[0] ?? null,
  };
}

async function enqueueRevealTerminalMarketInvalidation(
  pid: number,
  meta: RevealTerminalMarketMeta | null,
  reason: string,
) {
  const comparableKey = meta?.parsed?.comparable_key?.trim();
  if (!comparableKey) return;
  await callSupabase("/rpc/enqueue_mvp_market_key_invalidation", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      p_comparable_key: comparableKey,
      p_reason: `reveal_detail_${reason}`.slice(0, 120),
      p_priority: 100,
      p_affected_pid: pid,
      p_old_comparable_key: comparableKey,
      p_new_comparable_key: comparableKey,
      p_parser_version: meta?.parsed?.parser_version ?? null,
    }),
  });
}

async function insertRevealTerminalObservation(
  pid: number,
  state: "sold_confirmed" | "disappeared",
  saleStatus: string | null,
  now: string,
  meta: RevealTerminalMarketMeta | null,
) {
  const raw = meta?.raw;
  if (!raw?.name) return;
  await callSupabase("/mvp_listing_observations", {
    method: "POST",
    headers: authHeaders("return=minimal"),
    body: JSON.stringify({
      pid,
      observed_at: now,
      event_type: "state_changed",
      listing_state: state,
      price: Number(raw.price ?? 0),
      num_faved: Number(raw.num_faved ?? 0),
      name: raw.name,
      sale_status: saleStatus ?? raw.sale_status ?? "",
      sku_id: raw.sku_id ?? null,
      sku_name: raw.sku_name ?? null,
      comparable_key: meta?.parsed?.comparable_key ?? null,
      parse_confidence: meta?.parsed?.parse_confidence ?? null,
      seller_uid: raw.seller_uid ?? null,
      source: "reveal_detail",
    }),
  });
}

async function patchRevealDetailTerminalState(
  pid: number,
  state: "sold_confirmed" | "disappeared",
  saleStatus: string | null,
  reason: string,
) {
  const now = new Date().toISOString();
  const meta = await loadRevealTerminalMarketMeta(pid).catch(() => null);
  const rawPatch: Record<string, unknown> = {
    listing_state: state,
    last_seen_at: now,
    updated_at: now,
  };
  if (saleStatus != null) rawPatch.sale_status = saleStatus;
  if (state === "sold_confirmed") rawPatch.sold_detected_at = now;
  if (state === "disappeared") {
    rawPatch.disappeared_at = now;
    rawPatch.last_missing_at = now;
  }

  await Promise.allSettled([
    callSupabase(`/mvp_raw_listings?pid=eq.${pid}`, {
      method: "PATCH",
      headers: authHeaders("return=minimal"),
      body: JSON.stringify(rawPatch),
    }),
    callSupabase(`/mvp_lifecycle_checks?pid=eq.${pid}`, {
      method: "PATCH",
      headers: authHeaders("return=minimal"),
      body: JSON.stringify({
        status: state,
        last_checked_at: now,
        last_check_result: state === "sold_confirmed" ? "sold" : "missing",
        next_check_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        state_reason: `reveal_detail_${reason}`.slice(0, 240),
        locked_at: null,
        locked_until: null,
        updated_at: now,
      }),
    }),
    callSupabase(`/mvp_candidate_pool?pid=eq.${pid}&status=in.(ready,reserved)`, {
      method: "PATCH",
      headers: authHeaders("return=minimal"),
      body: JSON.stringify({
        status: "invalidated",
        invalidated_reason: `reveal_detail_${reason}`.slice(0, 120),
        updated_at: now,
      }),
    }),
    enqueueRevealTerminalMarketInvalidation(pid, meta, reason),
    insertRevealTerminalObservation(pid, state, saleStatus, now, meta),
  ]);
}

function terminalRevealDetail(pid: number, saleStatus = "SOLD_OUT"): RevealListingDetail {
  return {
    pid,
    description: "추천 당시 매물이 현재 판매완료되어 더 이상 상세 정보를 확인할 수 없어요.",
    saleStatus,
    conditionLabel: null,
    thumbnailUrl: null,
    imageUrls: [],
    metrics: {
      viewCount: null,
      favoriteCount: null,
      commentCount: null,
    },
    seller: {
      uid: null,
      name: null,
      reviewRating: null,
      reviewCount: 0,
      followerCount: 0,
      salesCount: 0,
      proshop: false,
      officialSeller: false,
      joinDate: null,
    },
    shippingOptions: [],
    shippingSummary: "판매완료",
    transactionMode: "unknown",
    shippingAssumption: "unknown",
  };
}

export async function loadRevealListingDetail(input: {
  userRef: string;
  pid: number;
}): Promise<RevealListingDetail> {
  await assertRevealAccess(input.userRef, input.pid);
  const meta = await loadRevealDetailSourceMeta(input.pid);
  const marketplaceSource = normalizeMarketplaceSource(meta?.source ?? meta?.seller_source);

  if (isJoongnaMarketplaceSource(marketplaceSource)) {
    const listingUrl = listingUrlForSource(input.pid, meta?.url, marketplaceSource);
    if (!listingUrl) {
      throw new Error("joongna detail url missing");
    }
    const detail = await fetchJoongnaDetail(listingUrl, 10_000);
    if (!detail.ok) {
      throw new Error(`joongna detail fetch failed: ${detail.status}`);
    }

    // Wave launch-73: isSoldOutPage 도 신호 — productStatus 자체 없는 sold/disappeared 페이지.
    const soldByPage = detail.isSoldOutPage === true;
    const soldByStatus = detail.productStatus != null && detail.productStatus !== 0;
    const soldByText = soldOutTextHits(detail.title, detail.description, null).length > 0;
    if (soldByPage || soldByStatus || soldByText) {
      const saleStatus = soldByPage ? "JOONGNA_SOLD_PAGE" : soldByStatus ? `JOONGNA_STATUS_${detail.productStatus}` : "SOLD_OUT";
      const reason = soldByPage ? "joongna_sold_page" : soldByStatus ? `joongna_product_status_${detail.productStatus}` : "joongna_text_traded";
      await patchRevealDetailTerminalState(input.pid, "sold_confirmed", saleStatus, reason);
      return {
        ...terminalRevealDetail(input.pid, saleStatus),
        description: detail.description || "추천 당시 매물이 현재 판매완료되어 더 이상 상세 정보를 확인할 수 없어요.",
        thumbnailUrl: detail.thumbnailUrl,
        imageUrls: detail.imageUrls,
        metrics: {
          viewCount: detail.viewCount,
          favoriteCount: null,
          commentCount: detail.commentCount,
        },
      };
    }

    const baseFacts = marketplaceFactsFromRawJson({
      marketplaceSource,
      marketplaceLabel: marketplaceSourceLabel(marketplaceSource),
      freeShipping: detail.parcelFeeYn === 1 || meta?.free_shipping === true,
      sellerReviewRating: meta?.shop_review_rating ?? null,
      sellerReviewCount: meta?.shop_review_count ?? 0,
      rawJson: meta?.raw_json,
    });
    const facts = {
      ...baseFacts,
      productTradeType: detail.productTradeType ?? baseFacts.productTradeType ?? null,
      parcelFeeYn: detail.parcelFeeYn ?? baseFacts.parcelFeeYn ?? null,
      tradeLabels: detail.labels.length > 0 ? detail.labels : baseFacts.tradeLabels,
    };
    const safety = buildMarketplaceSafetyDisplay(facts);

    return {
      pid: input.pid,
      description: detail.description ?? "",
      saleStatus: detail.productStatus === 0 ? "SELLING" : `JOONGNA_STATUS_${detail.productStatus ?? "UNKNOWN"}`,
      conditionLabel: null,
      thumbnailUrl: detail.thumbnailUrl,
      imageUrls: detail.imageUrls,
      metrics: {
        viewCount: detail.viewCount,
        favoriteCount: null,
        commentCount: detail.commentCount,
      },
      seller: {
        uid: detail.storeSeq ? `joongna:${detail.storeSeq}` : null,
        name: detail.nickName,
        reviewRating: meta?.shop_review_rating ?? null,
        reviewCount: safety.sellerTrust.reviewCount,
        followerCount: 0,
        salesCount: facts.joongnaSafeOrderSalesCount ?? 0,
        proshop: false,
        officialSeller: false,
        joinDate: null,
      },
      shippingOptions: shippingOptionsFromSafety(safety),
      shippingSummary: safety.shipping.label,
      transactionMode: safety.shipping.transactionMode,
      shippingAssumption: safety.shipping.assumption,
    };
  }

  if (isDaangnMarketplaceSource(marketplaceSource)) {
    const listingUrl = listingUrlForSource(input.pid, meta?.url, marketplaceSource);
    const live = listingUrl
      ? await fetchDaangnLiveState(listingUrl, 10_000).catch((err) => {
          console.warn("[reveal_detail] daangn live detail failed", {
            pid: input.pid,
            err: err instanceof Error ? err.message : String(err),
          });
          return null;
        })
      : null;
    if (live?.ok && live.listingState !== "active") {
      await patchRevealDetailTerminalState(input.pid, live.listingState, live.saleStatus, `daangn_${live.reason}`);
      return {
        ...terminalRevealDetail(input.pid, live.saleStatus),
        description: live.article.content || "추천 당시 매물이 현재 판매완료되어 더 이상 상세 정보를 확인할 수 없어요.",
        thumbnailUrl: live.article.thumbnail,
        imageUrls: live.article.images,
        metrics: {
          viewCount: live.article.viewCount,
          favoriteCount: live.article.favoriteCount,
          commentCount: live.article.commentCount,
        },
      };
    }
    const liveArticle = live?.ok ? live.article : null;
    if (liveArticle) {
      const imageCount = liveArticle.images.length;
      await callSupabase(`/mvp_raw_listings?pid=eq.${input.pid}`, {
        method: "PATCH",
        headers: authHeaders("return=minimal"),
        body: JSON.stringify({
          description_preview: (liveArticle.content ?? meta?.description_preview ?? "").slice(0, 500),
          num_faved: liveArticle.favoriteCount ?? meta?.num_faved ?? 0,
          num_comment: liveArticle.commentCount ?? liveArticle.chatCount ?? meta?.num_comment ?? 0,
          image_count: imageCount,
          daangn_manner_temperature: liveArticle.user.score ?? meta?.daangn_manner_temperature ?? null,
          daangn_review_count: liveArticle.user.reviewCount ?? meta?.daangn_review_count ?? null,
          raw_json: {
            ...(meta?.raw_json ?? {}),
            viewCount: liveArticle.viewCount,
            imageCount,
            region: liveArticle.region,
          },
          updated_at: new Date().toISOString(),
        }),
      }).catch((err) => {
        console.warn("[reveal_detail] daangn live patch failed", {
          pid: input.pid,
          err: err instanceof Error ? err.message : String(err),
        });
      });
    }
    const facts = marketplaceFactsFromRawJson({
      marketplaceSource,
      marketplaceLabel: marketplaceSourceLabel(marketplaceSource),
      freeShipping: meta?.free_shipping ?? false,
      sellerReviewRating: meta?.shop_review_rating ?? null,
      sellerReviewCount: meta?.shop_review_count ?? 0,
      rawJson: liveArticle
        ? {
            ...(meta?.raw_json ?? {}),
            viewCount: liveArticle.viewCount,
            imageCount: liveArticle.images.length,
            region: liveArticle.region,
          }
        : meta?.raw_json,
      // Wave 758 (2026-05-26): 매너온도 + 리뷰 수 — daangn-only 분기에서 사용.
      daangnMannerTemperature: liveArticle?.user.score ?? meta?.daangn_manner_temperature ?? null,
      daangnReviewCount: liveArticle?.user.reviewCount ?? meta?.daangn_review_count ?? null,
    });
    const safety = buildMarketplaceSafetyDisplay(facts);
    return {
      pid: input.pid,
      description: liveArticle?.content ?? meta?.description_preview ?? "",
      saleStatus: "selling",
      conditionLabel: null,
      thumbnailUrl: liveArticle?.thumbnail ?? meta?.thumbnail_url ?? null,
      imageUrls: liveArticle?.images ?? (meta?.thumbnail_url ? [meta.thumbnail_url] : []),
      metrics: {
        viewCount: liveArticle?.viewCount ?? (typeof meta?.raw_json?.viewCount === "number" ? meta.raw_json.viewCount : null),
        favoriteCount: liveArticle?.favoriteCount ?? meta?.num_faved ?? null,
        commentCount: liveArticle?.commentCount ?? meta?.num_comment ?? null,
      },
      seller: {
        uid: liveArticle?.user.dbId ?? null,
        name: liveArticle?.user.nickname ?? null,
        reviewRating: meta?.shop_review_rating ?? null,
        reviewCount: safety.sellerTrust.reviewCount,
        followerCount: 0,
        salesCount: 0,
        proshop: false,
        officialSeller: false,
        joinDate: null,
      },
      shippingOptions: shippingOptionsFromSafety(safety),
      shippingSummary: safety.shipping.label,
      transactionMode: safety.shipping.transactionMode,
      shippingAssumption: safety.shipping.assumption,
    };
  }

  const detail = await fetchDetail(String(input.pid));
  if (!detail) {
    await patchRevealDetailTerminalState(input.pid, "disappeared", "SOLD_OUT", "detail_fetch_missing");
    return terminalRevealDetail(input.pid);
  }

  const soldSignals = detectSoldOut(detail, null);
  if (isSoldOut(soldSignals)) {
    const saleStatus = normalizedTerminalSaleStatus(detail.saleStatus);
    await patchRevealDetailTerminalState(input.pid, "sold_confirmed", saleStatus, describeSignals(soldSignals));
    return {
      ...terminalRevealDetail(input.pid, saleStatus),
      description: detail.description || "추천 당시 매물이 현재 판매완료되어 더 이상 상세 정보를 확인할 수 없어요.",
      conditionLabel: detail.conditionLabel,
      thumbnailUrl: detail.thumbnailUrl,
      imageUrls: detail.imageUrls,
      metrics: {
        viewCount: detail.viewCount,
        favoriteCount: detail.favoriteCount,
        commentCount: detail.commentCount,
      },
    };
  }

  const apiParsed = parseShippingFromTrade(detail.tradeData, detail.tradesData);
  const descParsed = parseShippingFromDescription(detail.description);
  const mergedOptions = [...apiParsed.options, ...descParsed.options];
  const seen = new Set<string>();
  const shippingOptions = mergedOptions.filter((option) => {
    const key = `${option.kind}:${option.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    pid: input.pid,
    description: detail.description,
    saleStatus: detail.saleStatus,
    conditionLabel: detail.conditionLabel,
    thumbnailUrl: detail.thumbnailUrl,
    imageUrls: detail.imageUrls,
    metrics: {
      viewCount: detail.viewCount,
      favoriteCount: detail.favoriteCount,
      commentCount: detail.commentCount,
    },
    seller: {
      uid: detail.shopUid,
      name: null,
      reviewRating: detail.shopReviewRating,
      reviewCount: detail.shopReviewCount,
      followerCount: detail.shopFollowerCount,
      salesCount: detail.shopSalesCount,
      proshop: detail.shopProshop,
      officialSeller: detail.shopOfficialSeller,
      joinDate: detail.shopJoinDate,
    },
    shippingOptions,
    shippingSummary: shippingSummary(shippingOptions),
    transactionMode: "unknown",
    shippingAssumption: shippingOptions.some((option) => option.kind === "free" && option.amount === 0)
      ? "free_shipping"
      : "unknown",
  };
}

async function verifyAndCheckSold(pid: number, currentPrice: number | null, title?: string | null) {
  const detail = await fetchDetail(String(pid));
  const signals = detectSoldOut(detail, currentPrice, { title });
  return { detail, signals };
}

export async function openPack(input: PackOpenInput): Promise<PackOpenResult> {
  const startedAt = Date.now();
  const consumeInventory = input.consumeInventory ?? true;
  const targetCardsRaw = Math.max(2, Math.min(input.requestedCards ?? 2, 30));
  const targetCards = targetCardsRaw % 2 === 0 ? targetCardsRaw : targetCardsRaw - 1;
  const criteria = openFilterCriteria(input.filters);
  const hasStrictOpenFilters = hasOpenFilterCriteria(criteria);
  const reserveLimit = Math.min(
    Math.max(targetCards * (hasStrictOpenFilters ? 8 : 4), hasStrictOpenFilters ? 24 : 12),
    160,
  );
  const freshnessMs = freshnessMsForBand(input.band);
  const inventory = await loadInventory().catch(() => []);
  const bandInventory = inventory.find((row) => row.band === input.band);
  if (bandInventory && bandInventory.usableReady < targetCards) {
    return {
      result: "unavailable",
      reason: `지금은 이 수익 구간에서 ${targetCards}건을 보여드릴 만큼 재고가 부족해요. 수량을 줄여 다시 시도해주세요.`,
      durationMs: Date.now() - startedAt,
    };
  }

  const maxFreshSec = input.maxFreshHours && input.maxFreshHours > 0
    ? Math.round(input.maxFreshHours * 3600)
    : 0;
  const [reserved, userDedupe] = await Promise.all([
    rpcReservePool(input.band, input.userRef, reserveLimit, maxFreshSec),
    loadUserRevealDedupe(input.userRef).catch((err) => {
      console.error("pack_open user dedupe load failed (non-fatal)", {
        userRef: input.userRef,
        err: err instanceof Error ? err.message : String(err),
      });
      return { pids: new Set<number>(), comparableKeys: new Set<string>(), skuIds: new Set<string>() };
    }),
  ]);
  if (reserved.length === 0) {
    return {
      result: "unavailable",
      reason: "현재 이 등급의 후보가 부족해요. 잠시 뒤 다시 시도해주세요.",
      durationMs: Date.now() - startedAt,
    };
  }

  try {
    // Wave 130 (2026-05-16): reserve RPC가 condition_class를 return하지 않음 (RPC 변경 시 race
    // condition 5종 검증 필요 — CLAUDE.md 정책). 안전하게 별도 batch fetch로 pool entry의
    // condition_class lookup map만 만든다. Reserved 상태라 다음 query 시점까지 안정 (TTL 5분).
    const orderedReserved = interleaveReservedByCategory(reserved);
    const reservedPids = orderedReserved.map((r) => r.pid);
    // Wave 201 (2026-05-18): reference_prices fetch — unopened 매물 anchor (다나와 새 가격).
    // Wave 252.A real (2026-05-20): v7 sibling presence — v3 clothing key mixed-pool 차단 가드.
    const [listingMap, marketStats, marketStatsPerSource, velocityStats, readinessMap, poolConditionMap, optionBaseAssumedMap, referencePrices, v7SiblingPresence, gradingMap] = await Promise.all([
      fetchListings(reservedPids),
      fetchLatestMarketStats(orderedReserved.map((r) => r.comparable_key)),
      fetchLatestMarketStatsPerSource(orderedReserved.map((r) => r.comparable_key), [DAANGN_SOURCE_ID]),
      fetchLatestMarketVelocity(orderedReserved.map((r) => r.comparable_key)),
      loadCategoryReadinessMap(),
      fetchPoolConditionClassByPids(reservedPids),
      fetchOptionBaseAssumedByPids(reservedPids),
      fetchReferencePrices(orderedReserved.map((r) => r.comparable_key)),
      fetchV7SiblingPresence(orderedReserved.map((r) => r.comparable_key)),
      // Wave 714d (2026-05-23): 신발/의류 5-tier grading + chips for pack-reveal-modal.
      fetchGradingByPids(reservedPids),
    ]);
    const sourceHealth = await loadLatestSourceHealth();
    const reveals: RevealCard[] = [];
    const attemptedPids: number[] = [];
    const releasePids: number[] = [];
    const seenComparableKeys = new Set(userDedupe.comparableKeys);
    const seenSkuIds = new Set(userDedupe.skuIds);

    for (const candidate of orderedReserved) {
      if (reveals.length >= targetCards) {
        releasePids.push(candidate.pid);
        continue;
      }
      if (userDedupe.pids.has(candidate.pid)) {
        releasePids.push(candidate.pid);
        continue;
      }
      if (candidate.comparable_key && seenComparableKeys.has(candidate.comparable_key)) {
        releasePids.push(candidate.pid);
        continue;
      }
      const meta = listingMap.get(candidate.pid);
      if (!meta) {
        await rpcInvalidate(candidate.pid, "missing_listing_meta");
        continue;
      }
      const rawCommentCount = meta._raw?.num_comment ?? null;
      if (isPackOpenCommentBlocked(rawCommentCount)) {
        await invalidateHighCommentCandidate(candidate.pid, Number(rawCommentCount), "raw_num_comment");
        continue;
      }
      if (!candidateMatchesOpenFilters(candidate, meta, criteria)) {
        releasePids.push(candidate.pid);
        continue;
      }
      if (!candidate.comparable_key && meta.sku_id && seenSkuIds.has(meta.sku_id)) {
        releasePids.push(candidate.pid);
        continue;
      }
      attemptedPids.push(candidate.pid);
      if (isSideOnlyEarbudListing(meta.name)) {
        await rpcInvalidate(candidate.pid, "pack_open_side_only_earbud_title");
        continue;
      }

      const lastVerified = new Date(candidate.last_verified_at).getTime();
      const isFresh = Number.isFinite(lastVerified) && Date.now() - lastVerified < freshnessMs;

      let liveVerifiedAt = candidate.last_verified_at;
      const shouldLiveVerify = !isFresh || hasStaleRawCommentCount(meta._raw);
      if (shouldLiveVerify) {
        if (isJoongnaMarketplaceSource(meta.marketplaceSource)) {
          const detail = await fetchJoongnaDetail(meta.url, 8_000).catch((err) => {
            console.error("pack_open joongna live verify failed", {
              pid: candidate.pid,
              err: err instanceof Error ? err.message : String(err),
            });
            return null;
          });
          if (!detail?.ok) {
            releasePids.push(candidate.pid);
            continue;
          }
          // Wave launch-73: isSoldOutPage 도 신호 (joongna sold/disappeared 페이지).
          const soldByPage = detail.isSoldOutPage === true;
          const soldByStatus = detail.productStatus != null && detail.productStatus !== 0;
          const soldByText = soldOutTextHits(detail.title, detail.description, meta.name).length > 0;
          if (soldByPage || soldByStatus || soldByText) {
            const reason = soldByPage ? "joongna_sold_page" : soldByStatus ? `joongna_product_status_${detail.productStatus}` : "joongna_text_traded";
            await rpcInvalidate(candidate.pid, reason);
            continue;
          }
          const liveType = classifyListing(meta.name, detail.description ?? "", meta.price).listingType;
          if (liveType !== "normal") {
            await rpcInvalidate(candidate.pid, `pack_open_live_${liveType}`);
            continue;
          }
          await patchPoolVerified(candidate.pid);
          liveVerifiedAt = new Date().toISOString();
        } else if (isDaangnMarketplaceSource(meta.marketplaceSource)) {
          await patchPoolVerified(candidate.pid);
          liveVerifiedAt = new Date().toISOString();
        } else {
          const { detail, signals } = await verifyAndCheckSold(candidate.pid, meta.price, meta.name);
          if (isSoldOut(signals)) {
            if (canPermanentlyInvalidateSoldOut(signals, sourceHealth)) {
              await rpcInvalidate(candidate.pid, `${sourceHealth}_${describeSignals(signals)}`);
            } else {
              releasePids.push(candidate.pid);
            }
            continue;
          }
          if (isPackOpenCommentBlocked(detail?.commentCount ?? null)) {
            await invalidateHighCommentCandidate(candidate.pid, Number(detail?.commentCount), "detail_comment_count");
            continue;
          }
          if (detail?.commentCount != null) {
            await patchRawCommentCount(candidate.pid, detail.commentCount);
          }
          const liveType = classifyListing(meta.name, detail?.description ?? "", meta.price).listingType;
          if (liveType !== "normal") {
            await rpcInvalidate(candidate.pid, `pack_open_live_${liveType}`);
            continue;
          }
          await patchPoolVerified(candidate.pid);
          liveVerifiedAt = new Date().toISOString();
        }
      }

      const verifiedAtMs = new Date(liveVerifiedAt).getTime();
      const freshSeconds = Math.max(0, Math.floor((Date.now() - verifiedAtMs) / 1000));

      // Wave 82: savedDetail 채움. mvp_raw_listings 컬럼에 이미 저장된 데이터
      // (description_preview / num_faved / free_shipping / shop_review_*).
      // 기존엔 type 선언만 있고 populate 안 돼서 verdict chip 다수 미발동.
      const rawMeta = meta._raw;
      const savedDetail = rawMeta
        ? (() => {
          const facts = marketplaceFactsFromRawJson({
            marketplaceSource: meta.marketplaceSource,
            marketplaceLabel: meta.marketplaceLabel,
            freeShipping: rawMeta.free_shipping,
            sellerReviewRating: rawMeta.shop_review_rating,
            sellerReviewCount: rawMeta.shop_review_count ?? 0,
            rawJson: rawMeta.raw_json,
            // Wave 758 (2026-05-26): 매너온도 + 리뷰 수 — daangn savedDetail 의 sellerTrust 에 사용.
            daangnMannerTemperature: rawMeta.daangn_manner_temperature ?? null,
            daangnReviewCount: rawMeta.daangn_review_count ?? null,
          });
          const tx = inferMarketplaceTransaction(facts);
          return {
            descriptionPreview: rawMeta.description_preview ?? "",
            favoriteCount: rawMeta.num_faved,
            freeShipping: Boolean(rawMeta.free_shipping),
            imageCount: rawMeta.image_count,
            sellerName: null,
            sellerReviewRating: rawMeta.shop_review_rating,
            sellerReviewCount: rawMeta.shop_review_count ?? 0,
            joongnaTrustScore: facts.joongnaTrustScore ?? null,
            joongnaSafeOrderSalesCount: facts.joongnaSafeOrderSalesCount ?? null,
            joongnaSafeOrderSalesText: facts.joongnaSafeOrderSalesText ?? null,
            productTradeType: facts.productTradeType ?? null,
            parcelFeeYn: facts.parcelFeeYn ?? null,
            tradeLabels: [...(facts.tradeLabels ?? [])],
            transactionMode: tx.transactionMode,
            shippingAssumption: tx.assumption,
            directTradeLocation: marketplaceLocationCombinedWithRegion(
              rawMeta.raw_json,
              rawMeta.description_preview,
              // Wave 886.12 (2026-05-27): full path (시/도 + 시군구 + 동) 로 통일.
              //   기존엔 dong name 만 ("관양동") 전달 → 모달 "거래 가능 지역" row 가 시/도 없이 박혀 무의미.
              //   /api/packs/me/route.ts:956 도 resolveDaangnFullRegion 사용 — 동일 패턴.
              resolveDaangnFullRegion(rawMeta.daangn_region_id, rawMeta.daangn_region_name),
            ),
            // Wave 758 (2026-05-26): RevealCard.savedDetail 에 박음 — UI 가 sellerTrust display 재계산 시 사용.
            daangnMannerTemperature: rawMeta.daangn_manner_temperature ?? null,
            daangnReviewCount: rawMeta.daangn_review_count ?? null,
          };
        })()
        : undefined;
      // 2026-05-16: catalog confusionNote (헷갈림 안내) — UI 카드에 표시.
      const skuConfusionNote = meta.sku_id
        ? CATALOG.find((sku) => sku.id === meta.sku_id)?.confusionNote ?? null
        : null;
      const conditionGrading = gradingMap.get(candidate.pid);
      const marketBasis = marketBasisForCandidate(
        candidate.comparable_key,
        meta.sku_name,
        marketStats,
        poolConditionMap.get(candidate.pid) ?? null,
        referencePrices,
        v7SiblingPresence,
        {
          listingSource: meta.marketplaceSource,
          perSourceMarketStats: marketStatsPerSource,
        },
        conditionGrading?.tier ?? null,  // Wave 817: tier 인자 직접 전달 — fashion (shoe/clothing) lookup
      );
      const sourceAwareProfit = expectedProfitFromMarketPrice({
        buyPrice: meta.price,
        marketPrice: marketBasis.medianPrice,
        buyShipping: savedDetail?.freeShipping ? 0 : 3500,
        marketplaceSource: meta.marketplaceSource,
        conditionChips: conditionGrading?.chips ?? null,
        conditionClass: poolConditionMap.get(candidate.pid) ?? null,
        conditionTier: conditionGrading?.tier ?? null,
      });
      const daangnMarketBasisMissing = isDaangnMarketplaceSource(meta.marketplaceSource)
        && (
          !marketBasis.medianPrice
          || !marketBasis.sourceSampleUsed
          || Number(marketBasis.sourceSampleCount ?? marketBasis.sampleCount ?? 0) < MIN_SOURCE_SAMPLE_COUNT_FOR_CONFIDENCE
        );
      if (daangnMarketBasisMissing) {
        await rpcInvalidate(candidate.pid, "daangn_market_basis_missing");
        continue;
      }
      if (isDaangnMarketplaceSource(meta.marketplaceSource) && (!sourceAwareProfit || sourceAwareProfit.max <= 0)) {
        await rpcInvalidate(candidate.pid, "profit_negative");
        continue;
      }
      reveals.push({
        pid: candidate.pid,
        name: meta.name,
        url: meta.url,
        marketplaceSource: meta.marketplaceSource,
        marketplaceLabel: meta.marketplaceLabel,
        price: meta.price,
        skuId: meta.sku_id,
        skuName: meta.sku_name,
        confusionNote: skuConfusionNote,
        thumbnailUrl: meta.thumbnail_url,
        expectedProfitMin: sourceAwareProfit?.min ?? candidate.expected_profit_min,
        expectedProfitMax: sourceAwareProfit?.max ?? candidate.expected_profit_max,
        confidence: candidate.confidence,
        // 2026-05-17 (사용자 요청): 모달 카드에 band chip 표시.
        band: (candidate.profit_band as 1 | 2 | 3) ?? null,
        // Wave 130 (2026-05-16): 매물 condition_class lookup → 매칭되는 condition별 시세 우선 표시.
        // Wave 201 (2026-05-18): unopened 매물 → reference_prices anchor 우선.
        marketBasis,
        velocityBasis: velocityBasisForCandidate(
          candidate.comparable_key,
          velocityStats,
          readinessMap,
          poolConditionMap.get(candidate.pid) ?? null,
        ),
        lastVerifiedAt: liveVerifiedAt,
        freshSeconds,
        savedDetail,
        // Wave 182 Phase 3 (2026-05-17): option_base_assumed — "기본 옵션 가정" UI badge.
        optionBaseAssumed: optionBaseAssumedMap.get(candidate.pid) ?? null,
        // Wave 714d (2026-05-23): 신발/의류 5-tier grading + chips (쉬운모드 LastVerifiedAtBadge).
        conditionTier: conditionGrading?.tier ?? null,
        conditionCluster: conditionGrading?.cluster ?? null,
        conditionConfidence: conditionGrading?.confidence ?? null,
        conditionFlags: conditionGrading?.flags ?? null,
        conditionChips: conditionGrading?.chips ?? null,
      });
      if (candidate.comparable_key) seenComparableKeys.add(candidate.comparable_key);
      if (meta.sku_id) seenSkuIds.add(meta.sku_id);
    }

    for (const pid of releasePids) {
      await rpcReleaseReservation(pid).catch(() => undefined);
    }

    // Wave 80: reveal 카드별 SKU 일별 매물 유입량 (24h + 7d 평균) batch 계산.
    // PostgREST의 group by + filter 패턴 미지원 → RPC 또는 raw SQL이 필요.
    // 여기선 PostgREST의 count=exact + sku 별 2회 호출이 깔끔하지 않아 직접 raw RPC
    // 패턴 회피하고, in.(sku_ids) 로 7d row 받아 클라이언트에서 집계.
    try {
      const skuIds = Array.from(
        new Set(reveals.map((r) => r.skuId).filter((s): s is string => Boolean(s))),
      );
      if (skuIds.length > 0) {
        const encoded = skuIds.map((s) => encodeURIComponent(s)).join(",");
        const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const res = await callSupabase(
          `/mvp_raw_listings?select=sku_id,created_at&sku_id=in.(${encoded})&created_at=gte.${since7d}&limit=20000`,
          { headers: authHeaders() },
        );
        const parsed = await res.json().catch(() => null);
        const rows = Array.isArray(parsed) ? (parsed as Array<{ sku_id: string; created_at: string }>) : [];
        const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
        const flow = new Map<string, { count24h: number; total7d: number }>();
        for (const row of rows) {
          const entry = flow.get(row.sku_id) ?? { count24h: 0, total7d: 0 };
          entry.total7d += 1;
          if (new Date(row.created_at).getTime() >= cutoff24h) entry.count24h += 1;
          flow.set(row.sku_id, entry);
        }
        for (const reveal of reveals) {
          if (!reveal.skuId) continue;
          const f = flow.get(reveal.skuId);
          if (!f) continue;
          reveal.skuListingFlow = {
            count24h: f.count24h,
            avgPerDay7d: Math.round((f.total7d / 7) * 10) / 10,
          };
        }
      }
    } catch (err) {
      console.error("skuListingFlow batch fetch failed (non-fatal)", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    if (reveals.length < targetCards) {
      for (const reveal of reveals) {
        await rpcReleaseReservation(reveal.pid).catch(() => undefined);
      }
      const durationMs = Date.now() - startedAt;
      // amount=0: 크레딧 차감 없이 감사 기록만 (못 채웠으니 청구 안 함)
      await rpcSpendAndRecord({
        userRef: input.userRef,
        authUserId: input.authUserId,
        amount: 0,
        band: input.band,
        tokensSpent: 0,
        tokensRefunded: 0,
        result: "refunded",
        attemptedPids,
        revealedPids: [],
        durationMs,
      }).catch((err) => {
        console.error("pack_open audit insert failed (refunded path)", {
          userRef: input.userRef,
          band: input.band,
          attemptedCount: attemptedPids.length,
          err: err instanceof Error ? err.message : String(err),
        });
      });
      return {
        result: "refunded",
        reason: "약속한 추천 수만큼 검증된 매물이 부족해 크레딧을 돌려드렸어요.",
        attemptedCount: attemptedPids.length,
        tokensRefunded: 0,
        durationMs,
      };
    }

    const durationMs = Date.now() - startedAt;
    // 크레딧 차감 + pack_open 기록 원자적 처리
    const spendResult = await rpcSpendAndRecord({
      userRef: input.userRef,
      authUserId: input.authUserId,
      amount: input.isInfiniteCredits ? 0 : input.tokensSpent,
      band: input.band,
      tokensSpent: input.tokensSpent,
      tokensRefunded: 0,
      result: "success",
      attemptedPids,
      revealedPids: reveals.map((r) => r.pid),
      durationMs,
    });
    if (!spendResult.ok) {
      // 크레딧 부족 (매우 드문 race condition: 팩 처리 도중 다른 세션이 크레딧 소진)
      await Promise.allSettled(reveals.map((r) => rpcReleaseReservation(r.pid)));
      throw new Error(`pack_open spend failed: ${spendResult.message}`);
    }
    const packOpenId = spendResult.packOpenId;

    await insertReveals(packOpenId, reveals, input.userRef);
    if (consumeInventory) {
      for (const reveal of reveals) {
        // P0-4: commit RPC가 false 반환 시(reservation 만료/이중 commit) 로그.
        // 실패한다고 reveal을 무효화하지는 않는다(이미 사용자에게 카드를 보여줬다).
        const committed = await rpcCommitReveal(reveal.pid).catch((err) => {
          console.error("pool reveal commit threw", { pid: reveal.pid, packOpenId, err });
          return false;
        });
        if (!committed) {
          console.error("pool reveal commit returned false (reservation expired or stale)", {
            pid: reveal.pid,
            packOpenId,
            userRef: input.userRef,
          });
        }
      }
    } else {
      for (const reveal of reveals) {
        await rpcReleaseReservation(reveal.pid).catch(() => undefined);
      }
    }

    return {
      result: "success",
      packOpenId,
      reveals,
      attemptedCount: attemptedPids.length,
      durationMs,
      tokensRemaining: spendResult.balance,
      infiniteCredits: input.isInfiniteCredits,
    };
  } catch (err) {
    await Promise.allSettled(reserved.map((row) => rpcReleaseReservation(row.pid)));
    throw err;
  }
}

export type InventorySnapshot = {
  band: PackBand;
  ready: number;
  usableReady: number;
  reserved: number;
  spent: number;
  invalidated: number;
  freshUnder2h: number;
};

export async function loadInventory(): Promise<InventorySnapshot[]> {
  const cols = "profit_band,status,last_verified_at,category,comparable_key,exposure_count,max_exposure";
  // PostgREST default limit=1000. mvp_candidate_pool 1,600+ rows (invalidated 포함) 라
  // 일부 ready 매물 누락됨 → 화면 inventory 카운트가 절반으로 나옴. limit 명시 + status
  // filter로 active 매물만 가져옴 (invalidated 제외해서 query 가벼움).
  const res = await callSupabase(
    `/mvp_candidate_pool?select=${cols}&status=in.(ready,reserved,spent)&limit=5000`,
    { headers: authHeaders() },
  );
  const rows = (await res.json()) as {
    profit_band: number;
    status: string;
    last_verified_at: string;
    category: string | null;
    comparable_key: string | null;
    exposure_count: number | null;
    max_exposure: number | null;
  }[];
  const readiness = await loadCategoryReadinessMap();
  const readyByCategory = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== "ready") continue;
    const category = categoryFromPool(row);
    if (!category) continue;
    const config = readiness[category];
    if (!config || config.status !== "ready") continue;
    readyByCategory.set(category, (readyByCategory.get(category) ?? 0) + 1);
  }
  const buckets = new Map<PackBand, InventorySnapshot>();
  for (const band of [1, 2, 3] as PackBand[]) {
    buckets.set(band, {
      band,
      ready: 0,
      usableReady: 0,
      reserved: 0,
      spent: 0,
      invalidated: 0,
      freshUnder2h: 0,
    });
  }
  const now = Date.now();
  for (const row of rows) {
    const band = (row.profit_band as PackBand) ?? null;
    if (!band || !buckets.has(band)) continue;
    const bucket = buckets.get(band)!;
    if (row.status === "ready") bucket.ready += 1;
    else if (row.status === "reserved") bucket.reserved += 1;
    else if (row.status === "spent") bucket.spent += 1;
    else if (row.status === "invalidated") bucket.invalidated += 1;
    if (row.status === "ready") {
      // 2026-05-15: 카테고리 readiness 게이트 제거.
      // pool 진입 자체가 evaluatePoolGate() 통과 (lane readiness 우선) 후 OK,
      // 여기서 다시 카테고리 게이트 보면 narrow lane 매물 (LANE_READINESS=ready
      // 이지만 카테고리는 internal_only) 198건이 inventory에서 누락됨.
      // pool ready = 사용자 노출 가능 매물. exposure 한도만 추가 확인.
      const exposure = Number(row.exposure_count ?? 0);
      const maxExposure = Number(row.max_exposure ?? 0);
      const exposureAvailable = !Number.isFinite(maxExposure) || maxExposure <= 0 || exposure < maxExposure;
      if (exposureAvailable) {
        bucket.usableReady += 1;
      }
      const verified = new Date(row.last_verified_at).getTime();
      if (Number.isFinite(verified) && now - verified < freshnessMsForBand(band)) {
        bucket.freshUnder2h += 1;
      }
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.band - b.band);
}
