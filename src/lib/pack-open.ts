import { fetchDetail } from "@/lib/bunjang";
import { CATALOG } from "@/lib/catalog";
import { categoryFromComparableKey, loadCategoryReadinessMap } from "@/lib/category-readiness";
import { pickByConditionFallback } from "@/lib/condition-fallback";
import {
  canPermanentlyInvalidateSoldOut,
  detectSoldOut,
  describeSignals,
  isSoldOut,
  type SourceHealthStatus,
} from "@/lib/sold-out";
import {
  classifyListing,
  isSideOnlyEarbudListing,
  parseShippingFromDescription,
  parseShippingFromTrade,
} from "@/lib/pipeline";

const TIMEOUT_MS = 30_000;

export type PackBand = 1 | 2 | 3;

export type RevealCard = {
  pid: number;
  name: string;
  url: string;
  price: number;
  skuId?: string | null;
  skuName: string;
  // 2026-05-16 (사용자 코멘트 #110 후속): 헷갈림 안내 (예: "Lightning vs USB-C 가격 동일").
  // catalog Sku.confusionNote 그대로. UI 에서 카드 하단 expandable 표시.
  confusionNote?: string | null;
  thumbnailUrl: string | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  confidence: number;
  // 2026-05-17 (사용자 요청): 나의 상품 "상품 보기" 모달에 운영자풀과 동일 band chip 표시.
  band?: 1 | 2 | 3 | null;
  marketBasis: RevealMarketBasis;
  velocityBasis: RevealVelocityBasis | null;
  lastVerifiedAt: string;
  freshSeconds: number;
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
    sellerName: string | null;
    sellerReviewRating: number | null;
    sellerReviewCount: number;
  };
  // Wave 182 Phase 3 (2026-05-17): base option fallback metadata.
  // null/[] 이면 옵션 명시 매물. 값 있으면 "기본 옵션 가정" UI badge 표시.
  optionBaseAssumed?: string[] | null;
};

export type RevealVelocityBasis = {
  comparableKey: string;
  confidence: "high" | "medium";
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
  priceSource: "reference" | "market";
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
};

// Wave 182 (2026-05-17): loss_report 추가 — 사용자 손해 신고. 즉시 토큰 3개 보상 + 운영자 검수 큐 진입.
// Wave 182c (2026-05-17): inaccurate_report 추가 — 매수 전 "정보 오류" 즉시 신고 (임계값 낮춤, feedback polling).
//   loss_report 는 일단 보류 (UI 노출 X) — 운영 검수 + 사용자 행동 데이터 누적 후 재개 검토.
export type RevealFeedbackType = "interested" | "bought" | "missed_sold" | "bad_pick" | "watching" | "loss_report" | "inaccurate_report";

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
  // Wave 82: raw listing 부가 데이터 (savedDetail용)
  _raw?: RawSkuMeta;
};

type RawSkuMeta = {
  pid: number;
  sku_id: string | null;
  description_preview: string | null;
  num_faved: number | null;
  free_shipping: boolean | null;
  shop_review_rating: number | null;
  shop_review_count: number | null;
};

type SourceHealthRow = {
  status: SourceHealthStatus;
  checked_at: string;
};

type MarketPriceRow = {
  comparable_key: string;
  // Wave 130: condition_class — DB PK 일부. condition별 시세 분리.
  condition_class: string;
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

type MarketVelocityRow = {
  comparable_key: string;
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

function categoryFromPool(row: { category: string | null; comparable_key: string | null }) {
  return categoryFromComparableKey(row.category) ?? categoryFromComparableKey(row.comparable_key);
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
  const rawCols = "pid,sku_id,description_preview,num_faved,free_shipping,shop_review_rating,shop_review_count";
  const [listingRes, rawRes] = await Promise.all([
    callSupabase(`/mvp_listings?select=${listingCols}&pid=in.(${pidFilter})`, { headers: authHeaders() }),
    callSupabase(`/mvp_raw_listings?select=${rawCols}&pid=in.(${pidFilter})`, { headers: authHeaders() }),
  ]);
  const rows = (await listingRes.json()) as Omit<ListingMeta, "sku_id">[];
  const rawRows = (await rawRes.json()) as RawSkuMeta[];
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  return new Map(rows.map((row) => {
    const raw = rawByPid.get(Number(row.pid));
    return [Number(row.pid), { ...row, sku_id: raw?.sku_id ?? null, _raw: raw }];
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
export type MarketStatsByCondition = Map<string, MarketPriceRow>;
export type MarketStatsMap = Map<string, MarketStatsByCondition>;

type TtlEntry<T> = {
  value: T;
  expiresAt: number;
};

const MARKET_STATS_CACHE_TTL_MS = ttlFromEnv("PACK_MARKET_STATS_CACHE_TTL_MS", 5 * 60 * 1000);
const MARKET_VELOCITY_CACHE_TTL_MS = ttlFromEnv("PACK_MARKET_VELOCITY_CACHE_TTL_MS", 5 * 60 * 1000);
const REFERENCE_PRICE_CACHE_TTL_MS = ttlFromEnv("PACK_REFERENCE_PRICE_CACHE_TTL_MS", 10 * 60 * 1000);

const marketStatsCache = new Map<string, TtlEntry<MarketStatsByCondition>>();
const marketVelocityCache = new Map<string, TtlEntry<MarketVelocityRow | null>>();
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
  // 같은 comparable_key + condition_class 조합에서 가장 최신 row만 보존 (order by date desc).
  for (const row of rows) {
    const byCondition = fetched.get(row.comparable_key) ?? new Map<string, MarketPriceRow>();
    if (!byCondition.has(row.condition_class)) {
      byCondition.set(row.condition_class, row);
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
    } else if (cached) {
      latest.set(key, cached);
    }
  }
  if (missing.length === 0) return latest;

  const cols = [
    "comparable_key",
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
    `/mvp_market_velocity_daily?select=${cols}&comparable_key=in.(${encoded})&confidence=in.(high,medium)&order=date.desc,computed_at.desc&limit=${Math.max(100, missing.length * 5)}`,
    { headers: authHeaders() },
  );
  const rows = (await res.json()) as MarketVelocityRow[];
  const fetched = new Map<string, MarketVelocityRow>();
  for (const row of rows) {
    if (!fetched.has(row.comparable_key)) fetched.set(row.comparable_key, row);
  }
  for (const key of missing) {
    const row = fetched.get(key) ?? null;
    writeTtl(marketVelocityCache, key, row, MARKET_VELOCITY_CACHE_TTL_MS, now);
    if (row) latest.set(key, row);
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

// Wave 159h (2026-05-17): condition-fallback shared module 사용 (DRY).
function selectMarketRowByCondition(
  byCondition: MarketStatsByCondition | undefined,
  targetConditionClass: string | null,
): { row: MarketPriceRow | undefined; conditionClass: string | null; fallbackUsed: boolean } {
  return pickByConditionFallback(
    byCondition,
    targetConditionClass,
    (r) => Number(r.active_sample_count ?? 0) + Number(r.sold_sample_count ?? 0) + Number(r.disappeared_sample_count ?? 0),
  );
}

export function marketBasisForCandidate(
  comparableKey: string | null,
  skuName: string,
  marketStats: MarketStatsMap,
  conditionClass: string | null = null,
  // Wave 201 (2026-05-18): unopened 매물 anchor — reference_prices.effective_price 우선.
  referencePrices?: Map<string, number>,
): RevealMarketBasis {
  const byCondition = comparableKey ? marketStats.get(comparableKey) : undefined;
  const { row: stat, conditionClass: actualCondition, fallbackUsed } = selectMarketRowByCondition(
    byCondition,
    conditionClass,
  );
  const activeSampleCount = Number(stat?.active_sample_count ?? 0);
  const soldSampleCount = Number(stat?.sold_sample_count ?? 0);
  const disappearedSampleCount = Number(stat?.disappeared_sample_count ?? 0);

  // Wave 130: 다른 condition 시세 (UI에서 비교용 — "내 condition vs 전체" 표시).
  const otherConditions: RevealMarketBasis["otherConditions"] = [];
  if (byCondition && actualCondition) {
    for (const [cls, row] of byCondition.entries()) {
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
  const useRefAnchor = refPrice != null && refPrice > 0;
  const medianPriceFinal = useRefAnchor ? refPrice : (stat?.blended_median_price ?? stat?.active_median_price ?? null);

  return {
    comparableKey,
    label: marketBasisLabel(comparableKey, skuName),
    p25Price: useRefAnchor ? null : (stat?.p25_price ?? null),
    medianPrice: medianPriceFinal,
    p75Price: useRefAnchor ? null : (stat?.p75_price ?? null),
    sampleCount: activeSampleCount + soldSampleCount + disappearedSampleCount,
    activeSampleCount,
    soldSampleCount,
    disappearedSampleCount,
    // ref anchor 신뢰는 medium (단일 값이라 "high" 비호환).
    confidence: useRefAnchor ? "medium" : (stat?.confidence ?? null),
    priceSource: useRefAnchor ? "reference" : "market",
    computedAt: stat?.computed_at ?? null,
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
): RevealVelocityBasis | null {
  if (!comparableKey) return null;
  const category = categoryFromComparableKey(comparableKey);
  if (!category || readinessMap[category]?.status !== "ready") return null;
  const stat = velocityStats.get(comparableKey);
  if (!stat || (stat.confidence !== "high" && stat.confidence !== "medium")) return null;
  return {
    comparableKey,
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
        current_profit_min: card.marketBasis.medianPrice == null ? null : Math.round(card.marketBasis.medianPrice - card.price),
        current_profit_max: card.marketBasis.medianPrice == null ? null : Math.round(card.marketBasis.medianPrice - card.price),
        market_invalidated_at: card.marketBasis.medianPrice != null && card.marketBasis.medianPrice - card.price < 0
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
  await callSupabase("/mvp_reveal_feedback?on_conflict=user_ref,pid", {
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

export async function loadRevealListingDetail(input: {
  userRef: string;
  pid: number;
}): Promise<RevealListingDetail> {
  await assertRevealAccess(input.userRef, input.pid);
  const detail = await fetchDetail(String(input.pid));
  if (!detail) throw new Error("listing detail unavailable");

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
  const reserveLimit = Math.min(Math.max(targetCards * 4, 12), 160);
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
  const reserved = await rpcReservePool(input.band, input.userRef, reserveLimit, maxFreshSec);
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
    const reservedPids = reserved.map((r) => r.pid);
    // Wave 201 (2026-05-18): reference_prices fetch — unopened 매물 anchor (다나와 새 가격).
    const [listingMap, marketStats, velocityStats, readinessMap, poolConditionMap, optionBaseAssumedMap, referencePrices] = await Promise.all([
      fetchListings(reservedPids),
      fetchLatestMarketStats(reserved.map((r) => r.comparable_key)),
      fetchLatestMarketVelocity(reserved.map((r) => r.comparable_key)),
      loadCategoryReadinessMap(),
      fetchPoolConditionClassByPids(reservedPids),
      fetchOptionBaseAssumedByPids(reservedPids),
      fetchReferencePrices(reserved.map((r) => r.comparable_key)),
    ]);
    const sourceHealth = await loadLatestSourceHealth();
    const reveals: RevealCard[] = [];
    const attemptedPids: number[] = [];
    const releasePids: number[] = [];

    for (const candidate of reserved) {
      if (reveals.length >= targetCards) {
        releasePids.push(candidate.pid);
        continue;
      }
      attemptedPids.push(candidate.pid);
      const meta = listingMap.get(candidate.pid);
      if (!meta) {
        await rpcInvalidate(candidate.pid, "missing_listing_meta");
        continue;
      }
      if (isSideOnlyEarbudListing(meta.name)) {
        await rpcInvalidate(candidate.pid, "pack_open_side_only_earbud_title");
        continue;
      }

      const lastVerified = new Date(candidate.last_verified_at).getTime();
      const isFresh = Number.isFinite(lastVerified) && Date.now() - lastVerified < freshnessMs;

      let liveVerifiedAt = candidate.last_verified_at;
      if (!isFresh) {
        const { detail, signals } = await verifyAndCheckSold(candidate.pid, meta.price, meta.name);
        if (isSoldOut(signals)) {
          if (canPermanentlyInvalidateSoldOut(signals, sourceHealth)) {
            await rpcInvalidate(candidate.pid, `${sourceHealth}_${describeSignals(signals)}`);
          } else {
            releasePids.push(candidate.pid);
          }
          continue;
        }
        const liveType = classifyListing(meta.name, detail?.description ?? "", meta.price).listingType;
        if (liveType !== "normal") {
          await rpcInvalidate(candidate.pid, `pack_open_live_${liveType}`);
          continue;
        }
        await patchPoolVerified(candidate.pid);
        liveVerifiedAt = new Date().toISOString();
      }

      const verifiedAtMs = new Date(liveVerifiedAt).getTime();
      const freshSeconds = Math.max(0, Math.floor((Date.now() - verifiedAtMs) / 1000));

      // Wave 82: savedDetail 채움. mvp_raw_listings 컬럼에 이미 저장된 데이터
      // (description_preview / num_faved / free_shipping / shop_review_*).
      // 기존엔 type 선언만 있고 populate 안 돼서 verdict chip 다수 미발동.
      const rawMeta = meta._raw;
      const savedDetail = rawMeta
        ? {
            descriptionPreview: rawMeta.description_preview ?? "",
            favoriteCount: rawMeta.num_faved,
            freeShipping: Boolean(rawMeta.free_shipping),
            sellerName: null,
            sellerReviewRating: rawMeta.shop_review_rating,
            sellerReviewCount: rawMeta.shop_review_count ?? 0,
          }
        : undefined;
      // 2026-05-16: catalog confusionNote (헷갈림 안내) — UI 카드에 표시.
      const skuConfusionNote = meta.sku_id
        ? CATALOG.find((sku) => sku.id === meta.sku_id)?.confusionNote ?? null
        : null;
      reveals.push({
        pid: candidate.pid,
        name: meta.name,
        url: meta.url,
        price: meta.price,
        skuId: meta.sku_id,
        skuName: meta.sku_name,
        confusionNote: skuConfusionNote,
        thumbnailUrl: meta.thumbnail_url,
        expectedProfitMin: candidate.expected_profit_min,
        expectedProfitMax: candidate.expected_profit_max,
        confidence: candidate.confidence,
        // 2026-05-17 (사용자 요청): 모달 카드에 band chip 표시.
        band: (candidate.profit_band as 1 | 2 | 3) ?? null,
        // Wave 130 (2026-05-16): 매물 condition_class lookup → 매칭되는 condition별 시세 우선 표시.
        // Wave 201 (2026-05-18): unopened 매물 → reference_prices anchor 우선.
        marketBasis: marketBasisForCandidate(
          candidate.comparable_key,
          meta.sku_name,
          marketStats,
          poolConditionMap.get(candidate.pid) ?? null,
          referencePrices,
        ),
        velocityBasis: velocityBasisForCandidate(candidate.comparable_key, velocityStats, readinessMap),
        lastVerifiedAt: liveVerifiedAt,
        freshSeconds,
        savedDetail,
        // Wave 182 Phase 3 (2026-05-17): option_base_assumed — "기본 옵션 가정" UI badge.
        optionBaseAssumed: optionBaseAssumedMap.get(candidate.pid) ?? null,
      });
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
        const rows = (await res.json()) as Array<{ sku_id: string; created_at: string }>;
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
