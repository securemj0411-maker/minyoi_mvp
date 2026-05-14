import { fetchDetail } from "@/lib/bunjang";
import { categoryFromComparableKey, loadCategoryReadinessMap } from "@/lib/category-readiness";
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
  thumbnailUrl: string | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  confidence: number;
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
  computedAt: string | null;
  excludedExamples: string[];
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
};

export type RevealFeedbackType = "interested" | "bought" | "missed_sold" | "bad_pick" | "watching";

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

async function rpcReservePool(band: PackBand, userRef: string, limit: number): Promise<ReservedRow[]> {
  const res = await callSupabase("/rpc/reserve_mvp_pool_candidates", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      p_band: band,
      p_user_ref: userRef,
      p_limit: limit,
      p_lease_seconds: 300,
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

export async function fetchLatestMarketStats(comparableKeys: (string | null)[]): Promise<Map<string, MarketPriceRow>> {
  const unique = [...new Set(comparableKeys.filter((key): key is string => Boolean(key)))];
  if (unique.length === 0) return new Map();
  const cols = [
    "comparable_key",
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
  const encoded = unique.map((key) => encodeURIComponent(key)).join(",");
  const res = await callSupabase(
    `/mvp_market_price_daily?select=${cols}&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc&limit=${Math.max(100, unique.length * 5)}`,
    { headers: authHeaders() },
  );
  const rows = (await res.json()) as MarketPriceRow[];
  const latest = new Map<string, MarketPriceRow>();
  for (const row of rows) {
    if (!latest.has(row.comparable_key)) latest.set(row.comparable_key, row);
  }
  return latest;
}

export async function fetchLatestMarketVelocity(comparableKeys: (string | null)[]): Promise<Map<string, MarketVelocityRow>> {
  const unique = [...new Set(comparableKeys.filter((key): key is string => Boolean(key)))];
  if (unique.length === 0) return new Map();
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
  const encoded = unique.map((key) => encodeURIComponent(key)).join(",");
  const res = await callSupabase(
    `/mvp_market_velocity_daily?select=${cols}&comparable_key=in.(${encoded})&confidence=in.(high,medium)&order=date.desc,computed_at.desc&limit=${Math.max(100, unique.length * 5)}`,
    { headers: authHeaders() },
  );
  const rows = (await res.json()) as MarketVelocityRow[];
  const latest = new Map<string, MarketVelocityRow>();
  for (const row of rows) {
    if (!latest.has(row.comparable_key)) latest.set(row.comparable_key, row);
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

export function marketBasisForCandidate(
  comparableKey: string | null,
  skuName: string,
  marketStats: Map<string, MarketPriceRow>,
): RevealMarketBasis {
  const stat = comparableKey ? marketStats.get(comparableKey) : undefined;
  const activeSampleCount = Number(stat?.active_sample_count ?? 0);
  const soldSampleCount = Number(stat?.sold_sample_count ?? 0);
  const disappearedSampleCount = Number(stat?.disappeared_sample_count ?? 0);
  return {
    comparableKey,
    label: marketBasisLabel(comparableKey, skuName),
    p25Price: stat?.p25_price ?? null,
    medianPrice: stat?.blended_median_price ?? stat?.active_median_price ?? null,
    p75Price: stat?.p75_price ?? null,
    sampleCount: activeSampleCount + soldSampleCount + disappearedSampleCount,
    activeSampleCount,
    soldSampleCount,
    disappearedSampleCount,
    confidence: stat?.confidence ?? null,
    computedAt: stat?.computed_at ?? null,
    excludedExamples: excludedExamplesForKey(comparableKey),
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
      note: input.note?.slice(0, 500) ?? "",
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

  const reserved = await rpcReservePool(input.band, input.userRef, reserveLimit);
  if (reserved.length === 0) {
    return {
      result: "unavailable",
      reason: "현재 이 등급의 후보가 부족해요. 잠시 뒤 다시 시도해주세요.",
      durationMs: Date.now() - startedAt,
    };
  }

  try {
    const [listingMap, marketStats, velocityStats, readinessMap] = await Promise.all([
      fetchListings(reserved.map((r) => r.pid)),
      fetchLatestMarketStats(reserved.map((r) => r.comparable_key)),
      fetchLatestMarketVelocity(reserved.map((r) => r.comparable_key)),
      loadCategoryReadinessMap(),
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
      reveals.push({
        pid: candidate.pid,
        name: meta.name,
        url: meta.url,
        price: meta.price,
        skuId: meta.sku_id,
        skuName: meta.sku_name,
        thumbnailUrl: meta.thumbnail_url,
        expectedProfitMin: candidate.expected_profit_min,
        expectedProfitMax: candidate.expected_profit_max,
        confidence: candidate.confidence,
        marketBasis: marketBasisForCandidate(candidate.comparable_key, meta.sku_name, marketStats),
        velocityBasis: velocityBasisForCandidate(candidate.comparable_key, velocityStats, readinessMap),
        lastVerifiedAt: liveVerifiedAt,
        freshSeconds,
        savedDetail,
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
  const res = await callSupabase(`/mvp_candidate_pool?select=${cols}`, { headers: authHeaders() });
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
      const category = categoryFromPool(row);
      const config = category ? readiness[category] : undefined;
      const categoryReady = category ? readyByCategory.get(category) ?? 0 : 0;
      const exposure = Number(row.exposure_count ?? 0);
      const maxExposure = Number(row.max_exposure ?? 0);
      const exposureAvailable = !Number.isFinite(maxExposure) || maxExposure <= 0 || exposure < maxExposure;
      if (config?.status === "ready" && categoryReady >= config.minReadyPool && exposureAvailable) {
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
