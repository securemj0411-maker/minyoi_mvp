import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { loadV7SiblingPresence, type V7SiblingPresenceMap } from "@/lib/band-aware-median";
import { pickByConditionFallback } from "@/lib/condition-fallback";
import { inferMarketplaceTransaction, marketplaceFactsFromRawJson, marketplaceLocationCombinedWithRegion } from "@/lib/marketplace-safety";
import { resolveDaangnFullRegion } from "@/lib/daangn-region-resolver";
import { evaluateDaangnRegionDistance, nearbyDaangnRegionIds, type DaangnDistanceSignal } from "@/lib/daangn-region-distance";
import { loadUserHomeRegion } from "@/lib/user-home-region-loader";
import { loadSkuImageMap, resolveGenericImage } from "@/lib/sku-images";
import { safeThumbnailUrl } from "@/lib/thumbnail-utils";
import { mergeConditionDisplayChips } from "@/lib/condition-display";
import { isDaangnMarketplaceSource, listingUrlForSource, marketplaceSourceLabel, normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { decodePoolAccessToken } from "@/lib/pool-access-token";
import { localizeProductLineLabel } from "@/lib/product-line-display";
import { expectedProfitFromMarketPrice } from "@/lib/profit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";
import { getDetailAccessSnapshot } from "@/lib/detail-access";
import { getProStatus, hasMembershipAccess } from "@/lib/user-subscription";
import { teaserBudgetRangeLabel } from "@/lib/feed-price-display";
import { marketStatsConditionKey } from "@/lib/pack-open";

// Wave 338 (Phase 1a — Freemium /explore):
// 2026-06-04 멤버십 전환: /me 피드는 승인된 멤버만 접근하며 매입가/시세를 그대로 공개한다.
//
// 정책:
// - 인증 필수 (로그인 사용자만)
// - 30개 매물 / 1 페이지 (limit)
// - 인증 + 멤버십 필수
// - 정렬: profit_band desc, expected_profit_max desc (안정적 = 같은 사용자 같은 매물)
// - 피드에서 pid/name/매입가/시세/source 를 숨기지 않는다.
//
// 응답:
// {
//   items: [...30 매물...],
//   cooldown: { canRefresh: true, remainingSec: 0, nextAvailableAt: null }
// }
//
// 액션 (POST 또는 ?refresh=1):
//   새 teaser 매물 응답. 당근 생존 상태는 lifecycle worker가 DB에 반영하고,
//   피드 요청 경로는 외부 원문을 직접 검증하지 않는다.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 30;
const READY_SLOTS = 25; // 살아있는 매물
const SOLD_OUT_SLOTS = 5; // 오늘 잡힌 매물 (FOMO)
// Wave 383: 6h lag 제거 (0으로). 피드 신선도는 teaser에서도 동일하게 유지.
const FRESH_LAG_HOURS = 0;
// Wave 346: 카테고리 다양화 — 한 카테고리에 5개 이상 몰리지 않게.
// 이어폰 풀이 가장 커서 profit_band 정렬하면 다 이어폰. 다양화 필수.
const MAX_PER_CATEGORY = 5;
// Wave 895 (2026-05-28): 당근 편입 이후 ready pool 1k+ 구간.
// 피드는 전체 source 통계를 쓰지 않지만, 후보를 너무 얕게 보면 high-profit 번개 샘플 안에서만
// source quota가 동작한다. 1000-row PostgREST cap도 명시적 page-loop로 우회한다.
const FETCH_POOL_OVERFETCH = 1500;
const POOL_PAGE_SIZE = 1000;
const PID_LOOKUP_CHUNK_SIZE = 400;
const REFRESH_READY_CANDIDATE_LIMIT = 500;
const INITIAL_READY_OVERFETCH = intEnv("FEED_INITIAL_READY_OVERFETCH", 600, 100, FETCH_POOL_OVERFETCH);
const DAANGN_SOURCE_READY_OVERFETCH = intEnv("DAANGN_FEED_SOURCE_READY_OVERFETCH", 600, READY_SLOTS, FETCH_POOL_OVERFETCH);
const DAANGN_POOL_LIFECYCLE_FRESH_MS = intEnv(
  "DAANGN_POOL_LIFECYCLE_FRESH_MS",
  5 * 60_000,
  0,
  30 * 60_000,
);
const DAANGN_LIFECYCLE_FRESHNESS_CACHE_TTL_MS = intEnv("DAANGN_LIFECYCLE_FRESHNESS_CACHE_TTL_MS", 30_000, 0, 5 * 60_000);
const DAANGN_LIFECYCLE_WORKER_PATHS = [
  "/api/cron/lifecycle-worker",
  "/api/cron/lifecycle-worker-b",
  "/api/cron/lifecycle-worker-c",
];

function intEnv(name: string, fallback: number, min: number, max: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(raw)));
}

// Daangn is local-first. The profit-ordered pool query can miss nearby dong rows,
// so we prefetch ready candidates by nearby Daangn region ids before diversification.
const DAANGN_NEARBY_REGION_LIMIT = intEnv("DAANGN_NEARBY_FEED_REGION_LIMIT", 96, 20, 900);
const DAANGN_NEARBY_RADIUS_KM = intEnv("DAANGN_NEARBY_FEED_RADIUS_KM", 10, 1, 30);
const DAANGN_NEARBY_RAW_LOOKUP_LIMIT = intEnv("DAANGN_NEARBY_FEED_RAW_LOOKUP_LIMIT", 1200, 100, 6000);
const DAANGN_NEARBY_REGION_BATCH_SIZE = intEnv("DAANGN_NEARBY_FEED_REGION_BATCH_SIZE", 24, 8, 260);
const DAANGN_NEARBY_REGION_BATCH_RAW_LIMIT = intEnv("DAANGN_NEARBY_FEED_REGION_BATCH_RAW_LIMIT", 300, 100, 2000);
const DAANGN_NEARBY_POOL_LOOKUP_LIMIT = intEnv("DAANGN_NEARBY_FEED_POOL_LOOKUP_LIMIT", 250, 50, 2000);
const DAANGN_NEARBY_BOOST_LIMIT = intEnv("DAANGN_NEARBY_FEED_BOOST_LIMIT", 36, 10, 500);
const DAANGN_NEARBY_CACHE_TTL_MS = intEnv("DAANGN_NEARBY_FEED_CACHE_TTL_MS", 45_000, 0, 300_000);
const DAANGN_NEARBY_SLOW_LOG_MS = intEnv("DAANGN_NEARBY_FEED_SLOW_LOG_MS", 1_200, 100, 10_000);
const DAANGN_NEARBY_PREFETCH_BUDGET_MS = intEnv("DAANGN_NEARBY_FEED_PREFETCH_BUDGET_MS", 4_500, 500, 30_000);
const DAANGN_SOURCE_QUOTA = intEnv("DAANGN_FEED_SOURCE_QUOTA", 18, 0, READY_SLOTS);
const JOONGNA_SOURCE_QUOTA = intEnv("JOONGNA_FEED_SOURCE_QUOTA", 3, 0, READY_SLOTS);

type PoolRow = {
  pid: number;
  expected_profit_min: number;
  expected_profit_max: number;
  profit_band: number;
  confidence: number | null;
  category: string | null;
  condition_class: string | null;
  comparable_key: string | null;
  last_verified_at: string;
};

type VisiblePoolRow = PoolRow & { soldOut: boolean };

type RawRow = {
  pid: number;
  name: string;
  url: string | null;
  price: number;
  sku_median: number | null;
  thumbnail_url: string | null;
};

type RawListingMeta = {
  pid: number;
  source: string | null;
  seller_source: string | null;
  url: string | null;
  sku_id: string | null;
  sku_name: string | null;
  free_shipping: boolean | null;
  last_seen_at: string | null;
  // Wave 254.7 (2026-05-20): P0-Upload feature 가 first_seen_at access 하지만 type 누락 — Vercel build 실패 원인.
  //   SELECT 쿼리 (line 269) 는 이미 first_seen_at 포함. type 만 누락 → 5 deploys (4b10017, 2b41044, c47f40f, 8940f86, 59392a7) 모두 build 실패.
  //   fix: type 추가 (additive only).
  first_seen_at: string | null;
  shop_review_rating: number | null;
  shop_review_count: number | null;
  image_count: number | null;
  description_preview: string | null;
  raw_json: Record<string, unknown> | null;
  daangn_region_id: string | null;
  daangn_region_name: string | null;
  // Wave launch-4 (launch audit CRITICAL #4): listing_state 받아서 'active' 외 매물 사용자 풀에서 차단.
  // candidate_pool.status=ready 가드만으로는 lifecycle cron lag 시 sold_confirmed/disappeared 노출 가능.
  listing_state: string | null;
  detail_status: string | null;
};

type NearbyDaangnSourceRow = {
  pid: number;
  source: string | null;
  daangn_region_id: string | null;
  daangn_region_name: string | null;
  listing_state: string | null;
  last_seen_at: string | null;
};

type NearbyDaangnPrefetchStats = {
  enabled: boolean;
  cacheHit: boolean;
  elapsedMs: number;
  regionCount: number;
  regionBatches: number;
  rawRows: number;
  candidatePids: number;
  readyRows: number;
  returnedRows: number;
  targetReady: number;
  stoppedEarly: boolean;
  reason?: string;
};

type NearbyDaangnPrefetchResult = {
  rows: VisiblePoolRow[];
  stats: NearbyDaangnPrefetchStats;
};

const EMPTY_NEARBY_DAANGN_STATS: NearbyDaangnPrefetchStats = {
  enabled: false,
  cacheHit: false,
  elapsedMs: 0,
  regionCount: 0,
  regionBatches: 0,
  rawRows: 0,
  candidatePids: 0,
  readyRows: 0,
  returnedRows: 0,
  targetReady: 0,
  stoppedEarly: false,
};

const NEARBY_DAANGN_READY_CACHE = new Map<string, {
  expiresAt: number;
  rows: VisiblePoolRow[];
  stats: NearbyDaangnPrefetchStats;
}>();

type DaangnLifecycleFreshness = {
  fresh: boolean;
  newestFinishedAt: string | null;
};

let daangnLifecycleFreshnessCache: {
  expiresAt: number;
  value: DaangnLifecycleFreshness;
} | null = null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_timeout_${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function loadDaangnLifecycleFreshness(headers: Record<string, string>): Promise<DaangnLifecycleFreshness> {
  if (DAANGN_POOL_LIFECYCLE_FRESH_MS <= 0) {
    return { fresh: true, newestFinishedAt: null };
  }

  const now = Date.now();
  if (daangnLifecycleFreshnessCache && daangnLifecycleFreshnessCache.expiresAt > now) {
    return daangnLifecycleFreshnessCache.value;
  }

  const sinceIso = new Date(now - DAANGN_POOL_LIFECYCLE_FRESH_MS).toISOString();
  try {
    const rows = await Promise.all(
      DAANGN_LIFECYCLE_WORKER_PATHS.map(async (path) => {
        const requestPathFilter = encodeURIComponent(`like.${path}*`);
        const res = await restFetch(
          `${tableUrl("mvp_collect_runs")}?select=finished_at,started_at&request_path=${requestPathFilter}&status=eq.succeeded&started_at=gte.${encodeURIComponent(sinceIso)}&order=started_at.desc&limit=1`,
          { headers },
        );
        if (!res.ok) throw new Error(`collect_runs_${path}_${res.status}`);
        const body = (await res.json()) as Array<{ finished_at: string | null; started_at: string | null }>;
        return body[0] ?? null;
      }),
    );

    let newestFinishedAt: string | null = null;
    for (const row of rows) {
      const candidate = row?.finished_at ?? row?.started_at ?? null;
      if (!candidate) continue;
      if (!newestFinishedAt || Date.parse(candidate) > Date.parse(newestFinishedAt)) {
        newestFinishedAt = candidate;
      }
    }

    const fresh = newestFinishedAt != null && Date.parse(newestFinishedAt) >= now - DAANGN_POOL_LIFECYCLE_FRESH_MS;
    const value = { fresh, newestFinishedAt };
    daangnLifecycleFreshnessCache = {
      expiresAt: now + DAANGN_LIFECYCLE_FRESHNESS_CACHE_TTL_MS,
      value,
    };
    return value;
  } catch (err) {
    console.warn("[pool] daangn lifecycle freshness lookup failed (Daangn feed rows will be blocked)", err instanceof Error ? err.message : String(err));
    const value = { fresh: false, newestFinishedAt: null };
    daangnLifecycleFreshnessCache = {
      expiresAt: now + Math.min(10_000, DAANGN_LIFECYCLE_FRESHNESS_CACHE_TTL_MS),
      value,
    };
    return value;
  }
}

async function filterDaangnByLifecycleFreshness(
  pool: (PoolRow & { soldOut: boolean })[],
  raws: RawRow[],
  metas: RawListingMeta[],
  headers: Record<string, string>,
): Promise<{
  pool: (PoolRow & { soldOut: boolean })[];
  raws: RawRow[];
  metas: RawListingMeta[];
}> {
  const metaByPid = new Map(metas.map((m) => [m.pid, m]));
  const targets = pool
    .filter((row) => !row.soldOut)
    .map((row) => ({ row, meta: metaByPid.get(row.pid) }))
    .filter((entry): entry is { row: PoolRow & { soldOut: boolean }; meta: RawListingMeta } => (
      isDaangnMarketplaceSource(entry.meta?.source ?? entry.meta?.seller_source)
    ));
  if (targets.length === 0) return { pool, raws, metas };

  const lifecycleFreshness = await loadDaangnLifecycleFreshness(headers);
  if (lifecycleFreshness.fresh) return { pool, raws, metas };

  const blockedPids = new Set(targets.map((target) => target.row.pid));
  console.warn("[pool] daangn lifecycle-stale block", {
    blocked: blockedPids.size,
    newestFinishedAt: lifecycleFreshness.newestFinishedAt,
  });
  return {
    pool: pool.filter((r) => !blockedPids.has(r.pid)),
    raws: raws.filter((r) => !blockedPids.has(r.pid)),
    metas: metas.filter((m) => !blockedPids.has(m.pid)),
  };
}

const LOCKED_CATEGORY_LABELS: Record<string, string> = {
  earphone: "이어폰/헤드셋",
  smartphone: "휴대폰",
  tablet: "태블릿",
  smartwatch: "스마트워치",
  laptop: "노트북",
  shoe: "신발",
  bag: "가방",
  clothing: "의류",
  drone: "드론",
  speaker: "스피커",
  appliance: "가전",
  game_console: "게임기",
  sport_golf: "골프",
  desktop: "데스크탑",
  lego: "레고",
  camera: "카메라",
};

const LATEST_TIER_PREVIEW_CATEGORIES = new Set(["shoe", "clothing", "game_console", "sport_golf"]);

const LOCKED_CONDITION_LABELS: Record<string, string> = {
  unopened: "미개봉",
  mint: "S급",
  clean: "A급",
  normal: "상태 보통",
  worn: "사용감 있음",
  flawed: "하자 있음",
  low_batt: "배터리 약함",
};

function usesLatestTierPreviewCategory(category: string | null | undefined) {
  return LATEST_TIER_PREVIEW_CATEGORIES.has(category ?? "");
}

function lockedPreviewTitle(category: string | null, conditionClass: string | null) {
  const categoryLabel = LOCKED_CATEGORY_LABELS[category ?? ""] ?? "추천 매물";
  if (usesLatestTierPreviewCategory(category)) return `${categoryLabel} 후보`;
  const conditionLabel = conditionClass ? (LOCKED_CONDITION_LABELS[conditionClass] ?? "상태 확인") : "상태 확인";
  return `${categoryLabel} · ${conditionLabel} 후보`;
}

function compactProductLineLabel(value: string | null | undefined, category: string | null, conditionClass: string | null) {
  const raw = String(value ?? "").trim();
  const conditionLabel = conditionClass ? (LOCKED_CONDITION_LABELS[conditionClass] ?? "상태 확인") : "상태 확인";
  if (!raw) return lockedPreviewTitle(category, conditionClass);
  const cleaned = raw
    .replace(/\s*\((?:broad|narrow|basic|clean|normal|worn|mint|unopened|러닝|캔버스|데님|카코트|필드)[^)]*\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return lockedPreviewTitle(category, conditionClass);
  const localized = localizeProductLineLabel(cleaned);
  const suffix = /계열|후보|매물$/.test(localized) ? "" : " 계열";
  if (usesLatestTierPreviewCategory(category)) return `${localized}${suffix}`;
  return `${localized}${suffix} · ${conditionLabel}`;
}

function priceBandLabel(value: number | null | undefined) {
  return teaserBudgetRangeLabel(value);
}

function relativeDiscountLabel(price: number, marketPrice: number | null | undefined) {
  const market = Number(marketPrice ?? 0);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(market) || market <= 0 || price >= market) return null;
  const discount = Math.max(1, Math.round(((market - price) / market) * 100));
  const rounded = discount >= 10 ? Math.round(discount / 5) * 5 : discount;
  return `시세보다 약 ${rounded}% 낮음`;
}

function confidenceSignalLabel(confidence: number | null | undefined) {
  const value = Number(confidence ?? 0);
  if (value >= 95) return "시세 신뢰 높음";
  if (value >= 85) return "비교 기준 양호";
  if (value > 0) return "비교 기준 확인";
  return null;
}

// Wave 247.2 (2026-05-19): band-aware sku_median fallback.
//   pool API 가 raw mvp_listings.sku_median 직접 사용 → condition_class 무시.
//   사용자 풀의 16% 가 sku_median=0 으로 미스리딩 표시 (Wave 246 시세 0원 bug 측정).
//   기존 marketBasisForCandidate (pack-open.ts) 가 mvp_market_price_daily band-aware lookup
//   하는 패턴 그대로 도입. additive only — DB 변경 X, fetch logic 만.
type MarketBandRow = {
  comparable_key: string;
  condition_class: string;
  condition_tier?: string | null;
  blended_median_price: number | null;
  active_median_price: number | null;
  active_sample_count: number | null;
  sold_sample_count: number | null;
  disappeared_sample_count: number | null;
};

type SourceMarketBandRow = MarketBandRow & {
  source: string | null;
};

type MarketVelocityRow = {
  comparable_key: string;
  condition_class: string;
  observed_sold_sample_count: number | null;
  sold_7d_count: number | null;
  confidence: string | null;
  median_hours_to_sold: number | null;
  date: string | null;
  computed_at: string | null;
};

async function loadMarketBandsForPool(
  headers: Record<string, string>,
  comparableKeys: string[],
): Promise<Map<string, Map<string, MarketBandRow>>> {
  const unique = [...new Set(comparableKeys.filter((k): k is string => Boolean(k)))];
  if (unique.length === 0) return new Map();
  const cols = [
    "comparable_key",
    "condition_class",
    "condition_tier",
    "blended_median_price",
    "active_median_price",
    "active_sample_count",
    "sold_sample_count",
    "disappeared_sample_count",
  ].join(",");
  const encoded = unique.map((k) => encodeURIComponent(k)).join(",");
  // pack-open.ts 의 fetch 패턴 — comparable_key in (...) + order date desc + limit ample.
  //   각 (comparable_key, condition_class) 의 가장 최신 row 만 보존.
  const res = await restFetch(
    `${tableUrl("mvp_market_price_daily")}?select=${cols}&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc&limit=${Math.max(200, unique.length * 12)}`,
    { headers },
  );
  const rows = (await res.json()) as MarketBandRow[];
  const byKey = new Map<string, Map<string, MarketBandRow>>();
  for (const row of rows) {
    const byCondition = byKey.get(row.comparable_key) ?? new Map<string, MarketBandRow>();
    const conditionKey = marketStatsConditionKey(row.condition_tier ?? "", row.condition_class);
    if (!byCondition.has(conditionKey)) {
      byCondition.set(conditionKey, row);
    }
    byKey.set(row.comparable_key, byCondition);
  }
  return byKey;
}

async function loadSourceMarketBandsForPool(
  headers: Record<string, string>,
  comparableKeys: string[],
): Promise<Map<string, Map<string, Map<string, MarketBandRow>>>> {
  const unique = [...new Set(comparableKeys.filter((k): k is string => Boolean(k)))];
  if (unique.length === 0) return new Map();
  const cols = [
    "comparable_key",
    "source",
    "condition_class",
    "condition_tier",
    "blended_median_price",
    "active_median_price",
    "active_sample_count",
    "sold_sample_count",
    "disappeared_sample_count",
  ].join(",");
  const encoded = unique.map((k) => encodeURIComponent(k)).join(",");
  try {
    const res = await restFetch(
      `${tableUrl("mvp_market_price_daily_per_source")}?select=${cols}&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc&limit=${Math.max(400, unique.length * 36)}`,
      { headers },
    );
    const rows = (await res.json()) as SourceMarketBandRow[];
    const byKey = new Map<string, Map<string, Map<string, MarketBandRow>>>();
    for (const row of rows) {
      if (!row.source) continue;
      const source = normalizeMarketplaceSource(row.source);
      const bySource = byKey.get(row.comparable_key) ?? new Map<string, Map<string, MarketBandRow>>();
      const byCondition = bySource.get(source) ?? new Map<string, MarketBandRow>();
      const conditionKey = marketStatsConditionKey(row.condition_tier ?? "", row.condition_class);
      if (!byCondition.has(conditionKey)) {
        byCondition.set(conditionKey, row);
      }
      bySource.set(source, byCondition);
      byKey.set(row.comparable_key, bySource);
    }
    return byKey;
  } catch (err) {
    console.warn("[pool] source market bands fetch failed (non-fatal)", err instanceof Error ? err.message : String(err));
    return new Map();
  }
}

function velocitySignalLabel(row: MarketVelocityRow | null | undefined) {
  const medianHours = Number(row?.median_hours_to_sold ?? 0);
  const sold7d = Number(row?.sold_7d_count ?? 0);
  const soldSample = Number(row?.observed_sold_sample_count ?? 0);
  const confidence = typeof row?.confidence === "string" ? row.confidence : null;
  if (!Number.isFinite(medianHours) || medianHours <= 0) return null;
  if (sold7d <= 0 || soldSample < 3) return null;
  const prefix = confidence === "high" || confidence === "medium" ? "평균" : "참고";
  if (medianHours < 24) {
    return `${prefix} ${Math.max(1, Math.round(medianHours))}시간 회전`;
  }
  return `${prefix} ${Math.max(1, Math.round(medianHours / 24))}일 회전`;
}

function normalizedVelocityCondition(conditionClass: string | null | undefined): string | null {
  const value = (conditionClass ?? "").trim();
  if (!value || value === "unknown" || value === "all") return null;
  return value;
}

function velocitySignalKey(comparableKey: string, conditionClass: string | null | undefined): string {
  const condition = normalizedVelocityCondition(conditionClass);
  return condition ? `${comparableKey}::${condition}` : comparableKey;
}

function velocityComputedMs(row: MarketVelocityRow) {
  const ms = row.computed_at ? Date.parse(row.computed_at) : Number.NaN;
  return Number.isFinite(ms) ? ms : 0;
}

function isUsableVelocitySignal(row: MarketVelocityRow | null | undefined): row is MarketVelocityRow {
  return velocitySignalLabel(row) != null;
}

function shouldReplaceVelocitySignal(existing: MarketVelocityRow | undefined, candidate: MarketVelocityRow) {
  if (!existing) return true;
  const existingUsable = isUsableVelocitySignal(existing);
  const candidateUsable = isUsableVelocitySignal(candidate);
  if (existingUsable !== candidateUsable) return candidateUsable;

  const existingComputed = velocityComputedMs(existing);
  const candidateComputed = velocityComputedMs(candidate);
  if (existingComputed !== candidateComputed) return candidateComputed > existingComputed;

  const existingSold7d = Number(existing.sold_7d_count ?? 0);
  const candidateSold7d = Number(candidate.sold_7d_count ?? 0);
  if (existingSold7d !== candidateSold7d) return candidateSold7d > existingSold7d;

  return Number(candidate.observed_sold_sample_count ?? 0) > Number(existing.observed_sold_sample_count ?? 0);
}

async function loadVelocitySignalsForPool(
  headers: Record<string, string>,
  poolRows: PoolRow[],
): Promise<Map<number, string>> {
  const comparableKeys = poolRows.map((row) => row.comparable_key).filter((key): key is string => Boolean(key));
  const unique = [...new Set(comparableKeys.filter((k): k is string => Boolean(k)))];
  if (unique.length === 0) return new Map();
  const cols = [
    "comparable_key",
    "condition_class",
    "observed_sold_sample_count",
    "sold_7d_count",
    "confidence",
    "median_hours_to_sold",
    "date",
    "computed_at",
  ].join(",");
  const encoded = unique.map((k) => encodeURIComponent(k)).join(",");
  try {
    const res = await restFetch(
      `${tableUrl("mvp_market_velocity_daily")}?select=${cols}&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc,observed_sold_sample_count.desc&limit=${Math.max(200, unique.length * 10)}`,
      { headers },
    );
    const rows = (await res.json()) as MarketVelocityRow[];
    const rowsByKey = new Map<string, MarketVelocityRow>();
    for (const row of rows) {
      const key = velocitySignalKey(row.comparable_key, row.condition_class);
      const existing = rowsByKey.get(key);
      if (shouldReplaceVelocitySignal(existing, row)) rowsByKey.set(key, row);
    }

    const signals = new Map<number, string>();
    for (const poolRow of poolRows) {
      if (!poolRow.comparable_key) continue;
      const conditionRow = rowsByKey.get(velocitySignalKey(poolRow.comparable_key, poolRow.condition_class));
      const allRow = rowsByKey.get(poolRow.comparable_key);
      const label = velocitySignalLabel(conditionRow) ?? velocitySignalLabel(allRow);
      if (label) signals.set(poolRow.pid, label);
    }
    return signals;
  } catch (err) {
    console.warn("[pool] velocity signal fetch failed (non-fatal)", err instanceof Error ? err.message : String(err));
    return new Map();
  }
}

function bandAwareMedian(
  bandMap: Map<string, Map<string, MarketBandRow>>,
  comparableKey: string | null,
  conditionClass: string | null,
  conditionTier: string | null | undefined,
  // Wave 252.A real (2026-05-20): v3 clothing key + v7 sibling 존재 시 mixed-pool median 차단.
  v7SiblingPresence?: V7SiblingPresenceMap,
): number | null {
  if (!comparableKey) return null;
  if (v7SiblingPresence && v7SiblingPresence.get(comparableKey) === true) return null;
  const byCondition = bandMap.get(comparableKey);
  if (!byCondition) return null;
  const { row } = pickByConditionFallback(
    byCondition,
    conditionClass,
    (r) => Number(r.active_sample_count ?? 0) + Number(r.sold_sample_count ?? 0) + Number(r.disappeared_sample_count ?? 0),
    1,
    conditionTier,
  );
  if (!row) return null;
  const price = row.blended_median_price ?? row.active_median_price ?? null;
  return price && price > 0 ? price : null;
}

function sourceAwareMedian(
  sourceBandMap: Map<string, Map<string, Map<string, MarketBandRow>>>,
  comparableKey: string | null,
  conditionClass: string | null,
  conditionTier: string | null | undefined,
  marketplaceSource: string | null | undefined,
  v7SiblingPresence?: V7SiblingPresenceMap,
): number | null {
  if (!comparableKey || !marketplaceSource) return null;
  if (v7SiblingPresence && v7SiblingPresence.get(comparableKey) === true) return null;
  const source = normalizeMarketplaceSource(marketplaceSource);
  const byCondition = sourceBandMap.get(comparableKey)?.get(source);
  if (!byCondition) return null;
  const { row, fallbackUsed } = pickByConditionFallback(
    byCondition,
    conditionClass,
    (r) => Number(r.active_sample_count ?? 0) + Number(r.sold_sample_count ?? 0),
    1,
    conditionTier,
  );
  const sourceSampleCount = row
    ? Number(row.active_sample_count ?? 0) + Number(row.sold_sample_count ?? 0)
    : 0;
  // Wave 803e (2026-05-30): Wave 803c REVERT — 사용자 정책 위반.
  //   사용자 정책: MIN_SOURCE_SAMPLE_COUNT_FOR_CONFIDENCE = 3 (pack-open.ts:1191) + detail-access:253
  //   "당근 매물 sample < 3 → ready 차단 (expectedProfit 0)" — ready throughput 보호.
  //   Wave 803c 가 < 3 → < 2 박은 건 그 정책 우회. 원복.
  //   진짜 fix 는 fallback 박힐 때 UI 라벨 명시 (별도 wave) — "당근 표본 부족, 통합 시세 박힘".
  if (!row || sourceSampleCount < 3) return null;
  // Wave 1023 (2026-06-02): 당근은 fallback condition/tier row로 차익을 만들지 않는다.
  // source는 같아도 상태가 다르면 당근 가격 편차가 커서 "같은 상태끼리" 신뢰를 깨기 쉽다.
  if (isDaangnMarketplaceSource(source) && fallbackUsed) return null;
  const price = row.blended_median_price ?? row.active_median_price ?? null;
  return price && price > 0 ? price : null;
}

async function fetchPaginatedJson<T>(
  baseUrl: string,
  headers: Record<string, string>,
  maxRows: number,
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; out.length < maxRows; offset += POOL_PAGE_SIZE) {
    const limit = Math.min(POOL_PAGE_SIZE, maxRows - out.length);
    const joiner = baseUrl.includes("?") ? "&" : "?";
    const res = await restFetch(`${baseUrl}${joiner}limit=${limit}&offset=${offset}`, { headers });
    const rows = (await res.json()) as T[];
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    if (rows.length < limit) break;
  }
  return out;
}

async function fetchRowsByPidChunks<T>(
  table: string,
  select: string,
  pids: number[],
  headers: Record<string, string>,
): Promise<T[]> {
  const uniquePids = Array.from(new Set(pids)).filter((pid) => Number.isFinite(pid));
  if (uniquePids.length === 0) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < uniquePids.length; i += PID_LOOKUP_CHUNK_SIZE) {
    chunks.push(uniquePids.slice(i, i + PID_LOOKUP_CHUNK_SIZE));
  }
  const pages = await Promise.all(
    chunks.map(async (chunk) => {
      const res = await restFetch(
        `${tableUrl(table)}?select=${select}&pid=in.(${chunk.join(",")})&limit=${chunk.length + 100}`,
        { headers },
      );
      return (await res.json()) as T[];
    }),
  );
  return pages.flat();
}

async function fetchReadyPoolRowsByPidChunks(
  pids: number[],
  headers: Record<string, string>,
  stopAfterRows?: number,
): Promise<PoolRow[]> {
  const uniquePids = Array.from(new Set(pids)).filter((pid) => Number.isFinite(pid));
  if (uniquePids.length === 0) return [];
  const select = "pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key,last_verified_at";
  const chunks: number[][] = [];
  for (let i = 0; i < uniquePids.length; i += PID_LOOKUP_CHUNK_SIZE) {
    chunks.push(uniquePids.slice(i, i + PID_LOOKUP_CHUNK_SIZE));
  }
  if (stopAfterRows != null && stopAfterRows > 0) {
    const out: PoolRow[] = [];
    for (const chunk of chunks) {
      const res = await restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=${select}&status=eq.ready&pid=in.(${chunk.join(",")})&limit=${chunk.length + 50}`,
        { headers },
      );
      out.push(...((await res.json()) as PoolRow[]));
      if (out.length >= stopAfterRows) break;
    }
    return out;
  }
  const pages = await Promise.all(
    chunks.map(async (chunk) => {
      const res = await restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=${select}&status=eq.ready&pid=in.(${chunk.join(",")})&limit=${chunk.length + 50}`,
        { headers },
      );
      return (await res.json()) as PoolRow[];
    }),
  );
  return pages.flat();
}

async function loadNearbyDaangnReadyRows(
  headers: Record<string, string>,
  options: {
    userHomeDaangnFullPath?: string | null;
    source?: "bunjang" | "joongna" | "daangn" | null;
    sort?: "profit_desc" | "latest" | "price_asc" | "distance";
    excludePids?: number[];
  },
): Promise<NearbyDaangnPrefetchResult> {
  const startedAt = Date.now();
  const disabledReason = !options.userHomeDaangnFullPath
    ? "no_home_region"
    : options.source && options.source !== "daangn"
      ? "non_daangn_source"
      : null;
  if (disabledReason) {
    return {
      rows: [],
      stats: { ...EMPTY_NEARBY_DAANGN_STATS, reason: disabledReason },
    };
  }

  const regionIds = nearbyDaangnRegionIds(
    options.userHomeDaangnFullPath,
    DAANGN_NEARBY_RADIUS_KM,
    DAANGN_NEARBY_REGION_LIMIT,
  );
  const targetReady = options.source === "daangn" || options.sort === "distance"
    ? PAGE_SIZE
    : Math.min(READY_SLOTS, Math.max(1, DAANGN_SOURCE_QUOTA));
  if (regionIds.length === 0) {
    return {
      rows: [],
      stats: {
        ...EMPTY_NEARBY_DAANGN_STATS,
        enabled: true,
        elapsedMs: Date.now() - startedAt,
        targetReady,
        reason: "no_nearby_regions",
      },
    };
  }

  const exclude = new Set(options.excludePids ?? []);
  const cacheKey = [
    options.userHomeDaangnFullPath,
    options.source ?? "all",
    options.sort ?? "profit_desc",
    DAANGN_NEARBY_RADIUS_KM,
    DAANGN_NEARBY_REGION_LIMIT,
    DAANGN_NEARBY_REGION_BATCH_SIZE,
  ].join("|");
  const canUseCache = exclude.size === 0 && DAANGN_NEARBY_CACHE_TTL_MS > 0;
  const cached = canUseCache ? NEARBY_DAANGN_READY_CACHE.get(cacheKey) : null;
  if (cached && cached.expiresAt > Date.now()) {
    const rows = cached.rows.slice(0, DAANGN_NEARBY_BOOST_LIMIT);
    return {
      rows,
      stats: {
        ...cached.stats,
        cacheHit: true,
        elapsedMs: Date.now() - startedAt,
        returnedRows: rows.length,
      },
    };
  }

  try {
    const regionBatches: string[][] = [];
    for (let i = 0; i < regionIds.length; i += DAANGN_NEARBY_REGION_BATCH_SIZE) {
      regionBatches.push(regionIds.slice(i, i + DAANGN_NEARBY_REGION_BATCH_SIZE));
    }
    const distanceByPid = new Map<number, DaangnDistanceSignal>();
    const lastSeenByPid = new Map<number, string | null>();
    const readyByPid = new Map<number, PoolRow>();
    const candidatePids = new Set<number>();
    let rawRows = 0;
    let usedBatches = 0;

    for (const batch of regionBatches) {
      if (Date.now() - startedAt >= DAANGN_NEARBY_PREFETCH_BUDGET_MS) break;
      if (rawRows >= DAANGN_NEARBY_RAW_LOOKUP_LIMIT) break;
      const regionCsv = batch.map((id) => encodeURIComponent(id)).join(",");
      const limit = Math.min(
        DAANGN_NEARBY_REGION_BATCH_RAW_LIMIT,
        DAANGN_NEARBY_RAW_LOOKUP_LIMIT - rawRows,
      );
      const sourceRes = await withTimeout(
        restFetch(
          `${tableUrl("mvp_raw_listings")}?select=pid,source,daangn_region_id,daangn_region_name,listing_state,last_seen_at&source=eq.daangn&listing_state=eq.active&detail_status=eq.done&daangn_region_id=in.(${regionCsv})&order=last_seen_at.desc&limit=${limit}`,
          { headers },
        ),
        Math.max(500, DAANGN_NEARBY_PREFETCH_BUDGET_MS - (Date.now() - startedAt)),
        "nearby_daangn_raw_fetch",
      );
      const sourceRows = (await sourceRes.json()) as NearbyDaangnSourceRow[];
      usedBatches += 1;
      rawRows += sourceRows.length;

      const poolLookupLimit = Math.min(
        DAANGN_NEARBY_POOL_LOOKUP_LIMIT,
        Math.max(targetReady, targetReady * 25),
      );
      const orderedPids = sourceRows
        .filter((row) => row.listing_state === "active" && !exclude.has(Number(row.pid)))
        .map((row) => {
          const pid = Number(row.pid);
          const distance = evaluateDaangnRegionDistance(
            options.userHomeDaangnFullPath ?? null,
            row.daangn_region_id,
            row.daangn_region_name,
          );
          distanceByPid.set(pid, distance);
          lastSeenByPid.set(pid, row.last_seen_at ?? null);
          return { pid, distance };
        })
        .filter((entry) => Number.isFinite(entry.pid) && entry.distance.actionable && !candidatePids.has(entry.pid))
        .sort((a, b) => {
          const rankDiff = (a.distance.rank ?? 4) - (b.distance.rank ?? 4);
          if (rankDiff !== 0) return rankDiff;
          const aDistance = a.distance.distanceKm ?? Number.POSITIVE_INFINITY;
          const bDistance = b.distance.distanceKm ?? Number.POSITIVE_INFINITY;
          if (aDistance !== bDistance) return aDistance - bDistance;
          const aSeen = lastSeenByPid.get(a.pid) ? Date.parse(String(lastSeenByPid.get(a.pid))) : 0;
          const bSeen = lastSeenByPid.get(b.pid) ? Date.parse(String(lastSeenByPid.get(b.pid))) : 0;
          return bSeen - aSeen;
        })
        .map((entry) => entry.pid)
        .slice(0, poolLookupLimit);

      for (const pid of orderedPids) candidatePids.add(pid);
      const poolRows = await withTimeout(
        fetchReadyPoolRowsByPidChunks(orderedPids, headers, targetReady - readyByPid.size),
        Math.max(500, DAANGN_NEARBY_PREFETCH_BUDGET_MS - (Date.now() - startedAt)),
        "nearby_daangn_pool_fetch",
      );
      for (const row of poolRows) readyByPid.set(row.pid, row);

      if (readyByPid.size >= targetReady) break;
      if (sourceRows.length < limit) continue;
    }

    const rows = Array.from(readyByPid.values())
      .sort((a, b) => {
        const aDistance = distanceByPid.get(a.pid);
        const bDistance = distanceByPid.get(b.pid);
        const rankDiff = (aDistance?.rank ?? 4) - (bDistance?.rank ?? 4);
        if (rankDiff !== 0) return rankDiff;
        const aKm = aDistance?.distanceKm ?? Number.POSITIVE_INFINITY;
        const bKm = bDistance?.distanceKm ?? Number.POSITIVE_INFINITY;
        if (aKm !== bKm) return aKm - bKm;
        return (b.expected_profit_max ?? 0) - (a.expected_profit_max ?? 0);
      })
      .slice(0, DAANGN_NEARBY_BOOST_LIMIT)
      .map((row) => ({ ...row, soldOut: false }));
    const stats: NearbyDaangnPrefetchStats = {
      enabled: true,
      cacheHit: false,
      elapsedMs: Date.now() - startedAt,
      regionCount: regionIds.length,
      regionBatches: usedBatches,
      rawRows,
      candidatePids: candidatePids.size,
      readyRows: readyByPid.size,
      returnedRows: rows.length,
      targetReady,
      stoppedEarly: readyByPid.size >= targetReady,
    };
    if (canUseCache) {
      NEARBY_DAANGN_READY_CACHE.set(cacheKey, {
        expiresAt: Date.now() + DAANGN_NEARBY_CACHE_TTL_MS,
        rows,
        stats,
      });
    }
    if (stats.elapsedMs >= DAANGN_NEARBY_SLOW_LOG_MS || process.env.FEED_DEBUG_LOG === "1") {
      console.info("[pool] nearby daangn prefetch", stats);
    }
    return { rows, stats };
  } catch (err) {
    console.warn("[pool] nearby daangn prefetch failed (non-fatal)", err instanceof Error ? err.message : String(err));
    return {
      rows: [],
      stats: {
        ...EMPTY_NEARBY_DAANGN_STATS,
        enabled: true,
        elapsedMs: Date.now() - startedAt,
        regionCount: regionIds.length,
        targetReady,
        reason: "failed",
      },
    };
  }
}

function mergePoolRowsPreferFirst(...groups: VisiblePoolRow[][]): VisiblePoolRow[] {
  const out: VisiblePoolRow[] = [];
  const seen = new Set<number>();
  for (const group of groups) {
    for (const row of group) {
      if (seen.has(row.pid)) continue;
      out.push(row);
      seen.add(row.pid);
    }
  }
  return out;
}

function readyPoolOverfetchLimit(options: {
  sort?: "profit_desc" | "latest" | "price_asc" | "distance";
  source?: "bunjang" | "joongna" | "daangn" | null;
  priceMax?: number | null;
  readyCandidateLimit?: number;
  userHomeDaangnFullPath?: string | null;
}) {
  const candidateTarget = options.readyCandidateLimit ?? READY_SLOTS;
  const nearbyDaangnSortPriority = Boolean(options.userHomeDaangnFullPath) && options.sort === "distance";
  if (nearbyDaangnSortPriority) {
    return Math.min(FETCH_POOL_OVERFETCH, Math.max(READY_SLOTS * 4, candidateTarget));
  }
  // Budget filtering needs mvp_listings.price, so keep the wider scan until
  // candidate_pool has a denormalized buy-price column or a DB-side feed RPC.
  if (options.priceMax != null) return FETCH_POOL_OVERFETCH;
  if (options.source === "daangn") {
    return Math.min(FETCH_POOL_OVERFETCH, Math.max(DAANGN_SOURCE_READY_OVERFETCH, candidateTarget));
  }
  if (options.source) return FETCH_POOL_OVERFETCH;
  if (candidateTarget <= READY_SLOTS) {
    return Math.min(FETCH_POOL_OVERFETCH, Math.max(INITIAL_READY_OVERFETCH, candidateTarget));
  }
  return Math.min(FETCH_POOL_OVERFETCH, Math.max(INITIAL_READY_OVERFETCH, candidateTarget));
}

async function loadPool(
  headers: Record<string, string>,
  options: {
    sort?: "profit_desc" | "latest" | "price_asc" | "distance";
    source?: "bunjang" | "joongna" | "daangn" | null;
    priceMax?: number | null;
    excludePids?: number[];
    readyCandidateLimit?: number;
    userHomeDaangnFullPath?: string | null;
  } = {},
): Promise<{
  pool: (PoolRow & { soldOut: boolean })[];
  raws: RawRow[];
  metas: RawListingMeta[];
  marketBands: Map<string, Map<string, MarketBandRow>>;
  sourceMarketBands: Map<string, Map<string, Map<string, MarketBandRow>>>;
  v7SiblingPresence: V7SiblingPresenceMap;
  velocitySignals: Map<number, string>;
  parsedGradingRows: Array<{
    pid: number;
    condition_tier: string | null;
    condition_cluster: string | null;
    condition_confidence: number | null;
    condition_flags: Record<string, unknown> | null;
    condition_notes: string[] | null;
    parsed_json: Record<string, unknown> | null;
  }>;
  nearbyDaangnStats: NearbyDaangnPrefetchStats;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  // Wave 340 (UX 개선): 정렬 옵션. Wave 353: 카테고리 필터 백엔드 제거 (클라이언트로 이동).
  const orderClause = options.sort === "latest"
    ? "order=last_verified_at.desc"
    : "order=profit_band.desc,expected_profit_max.desc";

  // Wave 391: excludePids — 이미 본 매물 제외 (PostgREST not.in.(...))
  const excludeClause = options.excludePids && options.excludePids.length > 0
    ? `&pid=not.in.(${options.excludePids.join(",")})`
    : "";

  // Wave launch-40 (사용자 짚음 "joongna 풀 있는데 안 나옴"):
  // 이전 방식 = raw_listings 에서 source=joongna pid 2000개 fetch → candidate_pool 의
  //   `pid=in.(P1,...,P2000)` 절에 박음. pid 가 13자리 × 2000 ≈ 28KB → PostgREST URL too long
  //   (414) → restFetch throw → /api/packs/pool 500 → 사용자 화면 "매물을 잠시 못 가져왔어요".
  // Wave 895: pool 이 1k+ 로 커졌으므로 ready 후보 자체도 page-loop 로 읽는다.
  //   limit=1500 하나만 박으면 PostgREST 1000 cap 에 조용히 잘릴 수 있다.
  const readyBaseUrl =
    `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key,last_verified_at&status=eq.ready${excludeClause}&${orderClause}`;
  // Wave 1026 (2026-06-02): feed hot path trim.
  // Budgeted requests still need a wider scan because candidate_pool has no buy-price column.
  // Unbudgeted first feed can be much lighter: nearby Daangn prefetch preserves local-first
  // ordering, while the normal ready page only needs enough rows for category/source diversity.
  const readyOverfetchLimit = readyPoolOverfetchLimit(options);
  const [readyRowsPage, nearbyDaangnResult, soldOutRes] = await Promise.all([
    fetchPaginatedJson<PoolRow>(readyBaseUrl, headers, readyOverfetchLimit),
    withTimeout(
      loadNearbyDaangnReadyRows(headers, {
        userHomeDaangnFullPath: options.userHomeDaangnFullPath,
        source: options.source,
        sort: options.sort,
        excludePids: options.excludePids,
      }),
      DAANGN_NEARBY_PREFETCH_BUDGET_MS + 500,
      "nearby_daangn_prefetch",
    ).catch((err): NearbyDaangnPrefetchResult => {
      console.warn("[pool] nearby daangn prefetch fallback", err instanceof Error ? err.message : String(err));
      return {
        rows: [],
        stats: {
          ...EMPTY_NEARBY_DAANGN_STATS,
          enabled: true,
          elapsedMs: DAANGN_NEARBY_PREFETCH_BUDGET_MS,
          reason: "timeout_fallback",
        },
      };
    }),
    restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key,last_verified_at&status=eq.invalidated&updated_at=gte.${encodeURIComponent(todayIso)}${excludeClause}&order=updated_at.desc&limit=${SOLD_OUT_SLOTS * 4}`,
      { headers },
    ),
  ]);
  const readyRowsRaw = mergePoolRowsPreferFirst(
    nearbyDaangnResult.rows,
    readyRowsPage.map((r) => ({ ...r, soldOut: false })),
  );
  const soldOutRowsRaw = ((await soldOutRes.json()) as PoolRow[]).map((r) => ({ ...r, soldOut: true }));

  // Wave 388: 모든 candidate pid의 raw mvp_listings fetch (다양화/budget filter 전).
  const allCandidatePids = Array.from(new Set([
    ...readyRowsRaw.map((r) => r.pid),
    ...soldOutRowsRaw.map((r) => r.pid),
  ]));

  // Wave 388: 모든 candidate pid의 raw mvp_listings fetch (다양화/budget filter 전).
  // Wave 895: 후보 1.5k 구간에서도 pid=in URL 이 길어지지 않게 chunk fetch.
  // Wave 886.3 (2026-05-27): source filter 안 켜져 있어도 다양화에 필요 — 항상 fetch.
  // Wave 795 (2026-05-27): listing_state 추가 fetch — "방금 거래" 표시 진짜 sold 만 (active 73% leak fix).
  const sourceByPid = new Map<number, string | null>();
  const listingStateByPid = new Map<number, string | null>();
  const daangnActionableByPid = new Map<number, boolean>();
  // Wave 797 (2026-05-27): 거리 우선 정렬용 — 당근 매물 distanceKm 저장.
  const daangnDistanceKmByPid = new Map<number, number>();
  const rawByPid = new Map<number, RawRow>();
  const [rawAll, sourceRows] = await Promise.all([
    fetchRowsByPidChunks<RawRow>(
      "mvp_listings",
      "pid,name,url,price,sku_median,thumbnail_url",
      allCandidatePids,
      headers,
    ),
    fetchRowsByPidChunks<{
      pid: number;
      source: string | null;
      daangn_region_id: string | null;
      daangn_region_name: string | null;
      listing_state: string | null;
    }>(
      "mvp_raw_listings",
      "pid,source,daangn_region_id,daangn_region_name,listing_state",
      allCandidatePids,
      headers,
    ),
  ]);
  for (const r of rawAll) rawByPid.set(r.pid, r);
  for (const row of sourceRows) {
    const normalizedSource = row.source ? normalizeMarketplaceSource(row.source) : null;
    sourceByPid.set(Number(row.pid), normalizedSource);
    listingStateByPid.set(Number(row.pid), row.listing_state);
    if (normalizedSource === "daangn" && options.userHomeDaangnFullPath) {
      const distance = evaluateDaangnRegionDistance(
        options.userHomeDaangnFullPath,
        row.daangn_region_id,
        row.daangn_region_name,
      );
      daangnActionableByPid.set(Number(row.pid), distance.actionable);
      // Wave 797: distanceKm 저장 (정렬용). null 이면 Infinity 로 (가장 멀게 처리).
      if (distance.distanceKm != null && Number.isFinite(distance.distanceKm)) {
        daangnDistanceKmByPid.set(Number(row.pid), distance.distanceKm);
      }
    }
  }
  const sourcePass = (row: PoolRow & { soldOut: boolean }) => {
    if (!options.source) return true;
    return sourceByPid.get(row.pid) === options.source;
  };
  const daangnDistancePass = (row: PoolRow & { soldOut: boolean }) => {
    if (!options.userHomeDaangnFullPath || sourceByPid.get(row.pid) !== "daangn") return true;
    return daangnActionableByPid.get(row.pid) !== false;
  };

  // Wave 388: budget filter — priceMax 있으면 raw.price <= priceMax인 매물만.
  const budgetPass = (row: PoolRow & { soldOut: boolean }) => {
    if (options.priceMax == null) return true;
    const raw = rawByPid.get(row.pid);
    return raw != null && Number.isFinite(raw.price) && raw.price > 0 && raw.price <= options.priceMax;
  };
  // Wave 795 (2026-05-27): sold_out 필터 추가 — invalidated 매물 중 진짜 sold 만 keep.
  //   DB sweep 발견: invalidated 1,073건 중 73.5% (789건) 가 active+SELLING 매물 (catalog 변경/시세 변동/AI reject 등 invalidation 사유).
  //   "방금 거래된 상품" 라벨이 73% 거짓 정보 → 사용자 신뢰 직격.
  //   listing_state IN ('sold_confirmed', 'disappeared') 만 진짜 sold 로 표시.
  const realSoldPass = (row: PoolRow & { soldOut: boolean }) => {
    const state = listingStateByPid.get(row.pid);
    return state === 'sold_confirmed' || state === 'disappeared';
  };
  // Wave launch-40: source + budget 통합 필터. 다양화 전.
  // Wave 895 (당근 거리 필터) + Wave 795 (진짜 sold 만) 통합.
  const readyFiltered = readyRowsRaw.filter((r) => sourcePass(r) && budgetPass(r) && daangnDistancePass(r));
  const soldOutFiltered = soldOutRowsRaw.filter((r) => sourcePass(r) && budgetPass(r) && daangnDistancePass(r) && realSoldPass(r));

  // Wave 346: 카테고리 다양화 — budget filter 통과 매물 안에서만.
  // Wave 886.3 (2026-05-27): source 다양화 추가.
  // Wave 953 (2026-05-30): 당근은 위치가 핵심이라 첫 화면 대부분을 근거리 후보로 보호한다.
  //   카테고리 다양화보다 "내 동네에서 살 수 있음"이 먼저인 source.
  const SOURCE_QUOTA: Record<string, number> = { daangn: DAANGN_SOURCE_QUOTA, joongna: JOONGNA_SOURCE_QUOTA };
  function diversifyByCategory(rows: (PoolRow & { soldOut: boolean })[], maxRows: number) {
    const perCategory = new Map<string, number>();
    const perSource = new Map<string, number>();
    const picked = new Set<number>();
    const out: (PoolRow & { soldOut: boolean })[] = [];

    const tryAdd = (row: PoolRow & { soldOut: boolean }, addOptions: { ignoreCategoryCap?: boolean } = {}): boolean => {
      if (picked.has(row.pid)) return false;
      const cat = row.category ?? "unknown";
      if (!addOptions.ignoreCategoryCap && (perCategory.get(cat) ?? 0) >= MAX_PER_CATEGORY) return false;
      out.push(row);
      picked.add(row.pid);
      perCategory.set(cat, (perCategory.get(cat) ?? 0) + 1);
      const src = sourceByPid.get(row.pid) ?? "unknown";
      perSource.set(src, (perSource.get(src) ?? 0) + 1);
      return true;
    };

    // Phase 1: protected source quota (당근/중나 최소 슬롯 보장)
    // options.source 가 지정돼 있으면 quota skip — 사용자가 단일 source 선택했을 때 무관한 source 강제 X.
    // Wave 797 (2026-05-27): 당근 매물 distance ASC 정렬 — 가까운 동네 우선.
    //   user home region 등록된 경우만 효과. tie-break: 차익 DESC.
    if (!options.source) {
      for (const [src, quota] of Object.entries(SOURCE_QUOTA)) {
        const candidateRows = (src === 'daangn' && options.userHomeDaangnFullPath)
          ? [...rows].sort((a, b) => {
              const aDist = daangnDistanceKmByPid.get(a.pid) ?? Number.POSITIVE_INFINITY;
              const bDist = daangnDistanceKmByPid.get(b.pid) ?? Number.POSITIVE_INFINITY;
              if (aDist !== bDist) return aDist - bDist;
              // Tie-break: 차익 DESC (expected_profit_max)
              return (b.expected_profit_max ?? 0) - (a.expected_profit_max ?? 0);
            })
          : rows;
        for (const row of candidateRows) {
          if (out.length >= maxRows) break;
          if ((perSource.get(src) ?? 0) >= quota) break;
          if ((sourceByPid.get(row.pid) ?? null) !== src) continue;
          tryAdd(row, { ignoreCategoryCap: src === "daangn" && Boolean(options.userHomeDaangnFullPath) });
        }
      }
    }

    // Phase 2: 나머지를 차익순으로 채움 (이미 picked + 카테고리 cap 존중)
    for (const row of rows) {
      if (out.length >= maxRows) break;
      tryAdd(row);
    }

    // Phase 3: 슬롯 부족 시 카테고리 cap 무시하고 추가 (기존 fallback 유지)
    if (out.length < maxRows) {
      for (const row of rows) {
        if (out.length >= maxRows) break;
        if (picked.has(row.pid)) continue;
        out.push(row);
        picked.add(row.pid);
      }
    }
    return out;
  }

  // Refresh/infinite feed에서는 앞쪽 25개 후보가 실시간 차익 재계산에서 탈락해도
  // 뒤에 남은 ready 후보를 계속 찾을 수 있게 더 넓게 훑는다.
  const readyRows = diversifyByCategory(readyFiltered, options.readyCandidateLimit ?? READY_SLOTS);
  const soldOutRows = diversifyByCategory(soldOutFiltered, SOLD_OUT_SLOTS);

  // Wave 798 (2026-05-27): random shuffle 제거 — diversifyByCategory 내부 거리 정렬 효과 보존.
  //   기존: shuffle 으로 거리 ASC 정렬 (line 714-732, Wave 797) 결과 뒤집힘 → 사용자 피드 10km > 1km 보임.
  //   변경: diversifyByCategory 결과 순서 그대로 유지 (category quota + source quota + 거리 정렬 모두 처리됨).
  const pool = [...readyRows, ...soldOutRows];
  if (pool.length === 0) return { pool: [], raws: [], metas: [], marketBands: new Map(), sourceMarketBands: new Map(), v7SiblingPresence: new Map(), velocitySignals: new Map(), parsedGradingRows: [], nearbyDaangnStats: nearbyDaangnResult.stats };

  const pids = pool.map((r) => r.pid);
  // raws는 이미 rawByPid에 있음 — pool pids만 추출.
  const raws = pids.map((pid) => rawByPid.get(pid)).filter((r): r is RawRow => r != null);

  // meta + marketBands fetch (pool pids만).
  const comparableKeys = [...new Set(pool.map((r) => r.comparable_key).filter((k): k is string => Boolean(k)))];
  const [metaRes, marketBands, sourceMarketBands, v7SiblingPresence, velocitySignals, parsedGradingRes] = await Promise.all([
    restFetch(
      // Wave launch-4: listing_state 컬럼 추가 select. 응답 후 ready 였지만 active 아닌 row 차단.
      `${tableUrl("mvp_raw_listings")}?select=pid,source,seller_source,url,sku_id,sku_name,free_shipping,last_seen_at,first_seen_at,shop_review_rating,shop_review_count,image_count,description_preview,raw_json,daangn_region_id,daangn_region_name,daangn_manner_temperature,daangn_review_count,listing_state,detail_status&pid=in.(${pids.join(",")})`,
      { headers },
    ),
    loadMarketBandsForPool(headers, comparableKeys),
    loadSourceMarketBandsForPool(headers, comparableKeys),
    loadV7SiblingPresence(headers, comparableKeys),
    loadVelocitySignalsForPool(headers, pool),
    // Wave 714k (2026-05-23): 신발/의류 5-tier grading + chips column fetch.
    restFetch(
      `${tableUrl("mvp_listing_parsed")}?select=pid,condition_tier,condition_cluster,condition_confidence,condition_flags,condition_notes,parsed_json&pid=in.(${pids.join(",")})`,
      { headers },
    ),
  ]);
  const metas = (await metaRes.json()) as RawListingMeta[];
  // Wave 714k: gradingByPid Map — 메인 feed 카드 + 모달에 전달.
  const parsedGradingRows = (await parsedGradingRes.json().catch(() => [])) as Array<{
    pid: number;
    condition_tier: string | null;
    condition_cluster: string | null;
    condition_confidence: number | null;
    condition_flags: Record<string, unknown> | null;
    condition_notes: string[] | null;
    parsed_json: Record<string, unknown> | null;
  }>;

  // Wave launch-4 (launch audit CRITICAL #4): ready 였지만 listing_state != 'active' 인 매물 사용자 풀 차단.
  // Wave 799 (2026-05-27): raw detail/SKU가 stale 하게 search 상태로 되돌아간 ready residue도 차단.
  //   운영 audit: ready 1306개 중 detail_status=pending 133개, sku_id NULL 48개 발견.
  //   teaser라도 이런 row가 새면 상세 진입 때 크레딧/신뢰가 깨진다.
  // candidate_pool.status=ready 가드만으로는 lifecycle cron lag 시 sold_confirmed / disappeared /
  // missing_suspect 매물이 사용자 화면에 노출됨. 신뢰 박살 risk.
  // soldOut row (status=invalidated) 는 그대로 — 이미 sold_out 마스킹 디자인 적용됨.
  const metaByPidLocal = new Map(metas.map((m) => [m.pid, m]));
  const blockedPids = new Set<number>();
  for (const row of pool) {
    if (row.soldOut) continue; // sold_out 행은 의도적으로 살림
    const meta = metaByPidLocal.get(row.pid);
    const state = meta?.listing_state ?? null;
    // listing_state/detail_status null 은 옛 데이터 — 의심스러우면 일단 차단 (보수)
    if (state !== "active" || meta?.detail_status !== "done" || !meta?.sku_id) {
      blockedPids.add(row.pid);
    }
  }
  if (blockedPids.size > 0) {
    console.warn("[pool] raw stale block", {
      blocked: blockedPids.size,
      total_ready: pool.filter((r) => !r.soldOut).length,
    });
  }
  const filteredPool = pool.filter((r) => !blockedPids.has(r.pid));
  const filteredRaws = raws.filter((r) => !blockedPids.has(r.pid));
  const filteredMetas = metas.filter((m) => !blockedPids.has(m.pid));
  const lifecycleFiltered = await filterDaangnByLifecycleFreshness(filteredPool, filteredRaws, filteredMetas, headers);

  return { pool: lifecycleFiltered.pool, raws: lifecycleFiltered.raws, metas: lifecycleFiltered.metas, marketBands, sourceMarketBands, v7SiblingPresence, velocitySignals, parsedGradingRows, nearbyDaangnStats: nearbyDaangnResult.stats };
}

function buildItems(
  pool: (PoolRow & { soldOut: boolean })[],
  raws: RawRow[],
  metas: RawListingMeta[],
  marketBands: Map<string, Map<string, MarketBandRow>>,
  sourceMarketBands: Map<string, Map<string, Map<string, MarketBandRow>>>,
  v7SiblingPresence: V7SiblingPresenceMap,
  velocitySignals: Map<number, string>,
  userHomeRegion: { daangn_full_path: string | null } | null,
  parsedGradingRows: Array<{
    pid: number;
    condition_tier: string | null;
    condition_cluster: string | null;
    condition_confidence: number | null;
    condition_flags: Record<string, unknown> | null;
    condition_notes: string[] | null;
    parsed_json: Record<string, unknown> | null;
  }> = [],
  skuImageMap: Map<string, string> = new Map(),
) {
  const rawByPid = new Map(raws.map((r) => [r.pid, r]));
  const metaByPid = new Map(metas.map((m) => [m.pid, m]));
  // Wave 714k (2026-05-23): pid → grading + chips map.
  const gradingByPid = new Map<number, { tier: string | null; cluster: string | null; confidence: number | null; flags: Record<string, unknown> | null; chips: string[] | null }>();
  for (const row of parsedGradingRows) {
    // Wave 714k+ (2026-05-23): PostgREST schema cache 문제 시 column 못 잡을 수 있음.
    //   fallback — parsed_json.condition_grade 안에서 추출 (parser 가 거기 박은 데이터).
    const grade = (row.parsed_json?.condition_grade as {
      tier?: string;
      cluster?: string;
      confidence?: number;
      flags?: Record<string, unknown>;
      chips?: string[];
    } | null) ?? null;
    const parsedJsonNotes = row.parsed_json?.condition_notes as string[] | undefined;
    gradingByPid.set(Number(row.pid), {
      tier: row.condition_tier ?? grade?.tier ?? null,
      cluster: row.condition_cluster ?? grade?.cluster ?? null,
      confidence: row.condition_confidence ?? grade?.confidence ?? null,
      flags: row.condition_flags ?? grade?.flags ?? null,
      chips: mergeConditionDisplayChips(grade?.chips ?? null, row.condition_notes ?? parsedJsonNotes ?? null),
    });
  }
  return pool
    .map((row) => {
      const raw = rawByPid.get(row.pid);
      const meta = metaByPid.get(row.pid);
      if (!raw) return null;
      const marketplaceSource = normalizeMarketplaceSource(meta?.source ?? meta?.seller_source);
      let daangnDistance: DaangnDistanceSignal | null = null;
      // Wave 888 (2026-05-27): 시/도 broad filter → centroid 거리 기반 실행성 필터.
      //   상도1동 사용자가 서초/금천 생활권 매물은 볼 수 있지만, 서울 끝/타권역 매물은 후순위 또는 차단.
      if (marketplaceSource === "daangn") {
        daangnDistance = evaluateDaangnRegionDistance(
          userHomeRegion?.daangn_full_path ?? null,
          meta?.daangn_region_id ?? null,
          meta?.daangn_region_name ?? null,
        );
        if (userHomeRegion?.daangn_full_path && !daangnDistance.actionable) {
          return null;
        }
      }
      const facts = marketplaceFactsFromRawJson({
        marketplaceSource,
        marketplaceLabel: marketplaceSourceLabel(marketplaceSource),
        freeShipping: meta?.free_shipping ?? false,
        sellerReviewRating: meta?.shop_review_rating ?? null,
        sellerReviewCount: meta?.shop_review_count ?? 0,
        rawJson: meta?.raw_json,
        // Wave 758 (2026-05-26): 당근 매너온도 — DB column 박힌 값 전달.
        daangnMannerTemperature: (meta as { daangn_manner_temperature?: number | null } | undefined)?.daangn_manner_temperature ?? null,
        daangnReviewCount: (meta as { daangn_review_count?: number | null } | undefined)?.daangn_review_count ?? null,
      });
      const tx = inferMarketplaceTransaction(facts);
      // Wave 247.2 (2026-05-19): band-aware sku_median.
      // Wave 898 (2026-05-28): Daangn feed must use Daangn market stats, not mixed market median.
      //   당근은 local execution market 이라 source median 없으면 피드에서 제외한다.
      //   번개/중나는 source median 있으면 우선, 부족하면 기존 mixed fallback 유지.
      // Wave 252.A real (2026-05-20): v3 clothing key + v7 sibling 존재 시 mixed-pool 차단.
      //   v3 매물은 raw.sku_median 도 mixed-pool 계산값 → 둘 다 신뢰 불가 → skuMedianFinal=0
      //   (Wave 249 sku_median_unavailable 가드 동일 결과).
      const v3Stale = row.comparable_key && v7SiblingPresence.get(row.comparable_key) === true;
      const grading = gradingByPid.get(row.pid);
      const sourceBandPrice = sourceAwareMedian(sourceMarketBands, row.comparable_key, row.condition_class, grading?.tier ?? null, marketplaceSource, v7SiblingPresence);
      const bandPrice = bandAwareMedian(marketBands, row.comparable_key, row.condition_class, grading?.tier ?? null, v7SiblingPresence);
      const skuMedianFinal = v3Stale
        ? 0
        : marketplaceSource === "daangn"
          ? (sourceBandPrice ?? 0)
          : (sourceBandPrice ?? bandPrice ?? raw.sku_median);
      // Wave 369 (2026-05-19): expected_profit 재계산 — pool builder 공식과 같이,
      // 표시 시세 (band-aware) 기준으로 응답 시점에 다시 계산.
      // 이유: DB column expected_profit_min/max는 pool builder 시점 계산이라
      // wave 247.2 band-aware median 적용 후 동기화 안 됨. 같은 매물에 "시세 < 매입인데 차익 +"
      // 같은 모순 노출 (사용자 신뢰 손상).
      //
      // 공식:
      //   번개/중나 = 안전결제 수수료 + 재배송비 + 버퍼.
      //   당근 = source 시세 기준 직거래 재판매 가정 → 판매 수수료/재배송비 0원 + 버퍼.
      //
      // 정확한 buyer_shipping/estimated_buy_cost는 raw mvp_listings에 없어서 단순 가정.
      // 더 정확한 값 필요 시 mvp_listings join 추가 (별도 wave).
      const assumedBuyShipping =
        tx.transactionMode === "direct_only" ||
        tx.assumption === "included" ||
        tx.assumption === "free_shipping" ||
        meta?.free_shipping === true
          ? 0
          : 3500;
      let recomputedProfitMin = row.expected_profit_min;
      let recomputedProfitMax = row.expected_profit_max;
      if (!skuMedianFinal || skuMedianFinal <= 0) {
        recomputedProfitMin = 0;
        recomputedProfitMax = 0;
      } else if (Number.isFinite(raw.price) && raw.price > 0) {
        const profit = expectedProfitFromMarketPrice({
          buyPrice: raw.price,
          marketPrice: skuMedianFinal,
          buyShipping: assumedBuyShipping,
          marketplaceSource,
          conditionChips: grading?.chips ?? null,
          conditionClass: row.condition_class ?? null,
          conditionTier: grading?.tier ?? null,
        });
        recomputedProfitMax = profit?.max ?? recomputedProfitMax;
        recomputedProfitMin = profit?.min ?? recomputedProfitMin;
      }
      // Wave 368: 안전망 — 재계산 후 차익이 0이면 응답에서 제외 (사용자 화면 노출 차단).
      if (recomputedProfitMax <= 0) {
        return null;
      }
      return {
        pid: row.pid,
        name: raw.name,
        listingUrl: listingUrlForSource(row.pid, meta?.url ?? raw.url, marketplaceSource),
        marketplaceSource,
        marketplaceLabel: marketplaceSourceLabel(marketplaceSource),
        price: raw.price,
        skuMedian: skuMedianFinal,
        // Wave 759 (2026-05-26): video URL (.mp4 등) 차단 — broken image 방지, CategoryWatermark fallback 으로.
        thumbnailUrl: safeThumbnailUrl(raw.thumbnail_url),
        genericImageUrl: resolveGenericImage(skuImageMap, meta?.sku_name ?? null),
        skuId: meta?.sku_id ?? null,
        skuName: meta?.sku_name ?? null,
        expectedProfitMin: recomputedProfitMin,
        expectedProfitMax: recomputedProfitMax,
        profitBand: row.profit_band,
        confidence: row.confidence,
        category: row.category,
        conditionClass: row.condition_class,
        comparableKey: row.comparable_key,
        lastVerifiedAt: row.last_verified_at,
        // 2026-05-20 P0-Upload: 셀러 업로드 시점 (first_seen_at). UI 모달 "등록 N시간 전" 표시.
        firstSeenAt: meta?.first_seen_at ?? null,
        freeShipping: meta?.free_shipping ?? false,
        sellerReviewRating: meta?.shop_review_rating ?? null,
        sellerReviewCount: meta?.shop_review_count ?? 0,
        joongnaTrustScore: facts.joongnaTrustScore ?? null,
        joongnaSafeOrderSalesCount: facts.joongnaSafeOrderSalesCount ?? null,
        joongnaSafeOrderSalesText: facts.joongnaSafeOrderSalesText ?? null,
        daangnMannerTemperature: facts.daangnMannerTemperature ?? null,
        daangnReviewCount: facts.daangnReviewCount ?? null,
        productTradeType: facts.productTradeType ?? null,
        parcelFeeYn: facts.parcelFeeYn ?? null,
        tradeLabels: [...(facts.tradeLabels ?? [])],
        transactionMode: tx.transactionMode,
        shippingAssumption: tx.assumption,
        // Wave launch-37: raw_json 없으면 description 에서 "직거래는 안동 송하동" 같은 패턴 추출.
        directTradeLocation: marketplaceLocationCombinedWithRegion(meta?.raw_json, meta?.description_preview ?? null, resolveDaangnFullRegion(meta?.daangn_region_id ?? null, meta?.daangn_region_name ?? null)),
        daangnDistanceKm: daangnDistance?.distanceKm ?? null,
        daangnDistanceLabel: daangnDistance?.label ?? null,
        daangnDistanceRank: daangnDistance?.rank ?? null,
        imageCount: meta?.image_count ?? null,
        descriptionPreview: meta?.description_preview ?? "",
        lastSeenAt: meta?.last_seen_at ?? null,
        soldOut: row.soldOut,
        // Wave 714k (2026-05-23): 신발/의류 5-tier grading + chips — 메인 feed 카드 + 상세 모달.
        conditionTier: gradingByPid.get(row.pid)?.tier ?? null,
        conditionCluster: gradingByPid.get(row.pid)?.cluster ?? null,
        conditionConfidence: gradingByPid.get(row.pid)?.confidence ?? null,
        conditionFlags: gradingByPid.get(row.pid)?.flags ?? null,
        conditionChips: gradingByPid.get(row.pid)?.chips ?? null,
        feedPreviewLocked: false,
        productLineLabel: compactProductLineLabel(meta?.sku_name ?? null, row.category, row.condition_class),
        priceBandLabel: priceBandLabel(raw.price),
        marketPriceBandLabel: priceBandLabel(skuMedianFinal),
        priceSignalLabel: relativeDiscountLabel(raw.price, skuMedianFinal),
        marketSignalLabel: confidenceSignalLabel(row.confidence),
        velocitySignalLabel: velocitySignals.get(row.pid) ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

function sortDaangnItemsByDistance<T extends ReturnType<typeof buildItems>[number]>(items: T[]) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aDaangn = a.item.marketplaceSource === "daangn";
      const bDaangn = b.item.marketplaceSource === "daangn";
      if (aDaangn && bDaangn) {
        const rankDiff = (a.item.daangnDistanceRank ?? 4) - (b.item.daangnDistanceRank ?? 4);
        if (rankDiff !== 0) return rankDiff;
        const aDistance = a.item.daangnDistanceKm ?? Number.POSITIVE_INFINITY;
        const bDistance = b.item.daangnDistanceKm ?? Number.POSITIVE_INFINITY;
        if (aDistance !== bDistance) return aDistance - bDistance;
      }
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export async function GET(req: Request) {
  try {
    const auth = await requireSupabaseUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const userRef = userRefForAuthUser(auth.user.id);
    // Wave 773 (2026-05-27): 사용자 거주 동네 로드 — Daangn 매물 거리 필터링용.
    //   set X → redirect to /onboarding/home-region (강제). API는 데이터 그대로 반환하되 클라이언트 측에서 redirect.
    const userHomeRegion = await loadUserHomeRegion(auth.user.id);
    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";
    // Wave 340: 정렬 옵션. Wave 353: 카테고리 필터는 클라이언트로 이동 (전체 vs 카테고리 일관성).
    const sortParam = url.searchParams.get("sort");
    const sort: "profit_desc" | "latest" | "price_asc" | "distance" =
      sortParam === "latest" || sortParam === "price_asc" || sortParam === "distance" ? sortParam : "profit_desc";

    // Wave 373: personalization 필터 — 예산(가격 상한) + 성향(정렬/필터 우선순위).
    const budgetParam = url.searchParams.get("budget");
    const priceMax =
      budgetParam === "150k" ? 150000 :
      budgetParam === "100k" ? 100000 : // Wave 381 backward-compat (frontend는 150k로 migration됨)
      budgetParam === "300k" ? 300000 :
      budgetParam === "500k" ? 500000 :
      null; // unlimited / 미지정

    const preferenceParam = url.searchParams.get("preference");
    const preference: "safe" | "balanced" | "aggressive" =
      preferenceParam === "safe" ? "safe" :
      preferenceParam === "aggressive" ? "aggressive" :
      "balanced";
    const sourceParam = url.searchParams.get("source")?.trim().toLowerCase();
    const source: "bunjang" | "joongna" | "daangn" | null =
      sourceParam === "bunjang" || sourceParam === "joongna" || sourceParam === "daangn"
        ? normalizeMarketplaceSource(sourceParam)
        : null;

    // Wave 391: 클라이언트가 이미 본 pids 제외 — refresh 시 새 매물 보장.
    const excludePidsParam = url.searchParams.get("excludePids");
    const excludePids: number[] = excludePidsParam
      ? excludePidsParam.split(",").map((s) => Number(s)).filter((n) => Number.isFinite(n))
      : [];
    const excludeTokensParam = url.searchParams.get("excludeTokens");
    const excludeTokenPids: number[] = excludeTokensParam
      ? excludeTokensParam
          .split(",")
          .map((s) => decodePoolAccessToken(s))
          .filter((n): n is number => Number.isFinite(Number(n)) && Number(n) > 0)
      : [];
    const excludeAllPids = [...new Set([...excludePids, ...excludeTokenPids])];

    const headers = serviceHeaders();
    const membership = await getProStatus(auth.user, userRef);
    if (!hasMembershipAccess(membership)) {
      return NextResponse.json(
        { error: "membership_required", redirectTo: "/plans?from=feed" },
        { status: 403 },
      );
    }
    const unlimitedAccess = true;
    const detailAccess = await getDetailAccessSnapshot({ user: auth.user, userRef, unlimited: unlimitedAccess });
    const feedCooldown = { canRefresh: true, remainingSec: 0, nextAvailableAt: null };

    const readyCandidateLimit = refresh ? REFRESH_READY_CANDIDATE_LIMIT : READY_SLOTS;
    const appliedBudget: "150k" | "300k" | "500k" | "unlimited" =
      priceMax === 150000 ? "150k" :
      priceMax === 300000 ? "300k" :
      priceMax === 500000 ? "500k" :
      "unlimited";
    let items: ReturnType<typeof buildItems> = [];

    // 예산 필터가 있을 때 더 넓은 가격대로 조용히 fallback하지 않는다.
    // 15만원 이하를 보고 있는데 서버가 30/50만원 매물을 가져와도 프론트에서 다시 숨겨져
    // "새 매물 붙이는 중"만 길게 보이는 문제가 생긴다.
    const { pool, raws, metas, marketBands, sourceMarketBands, v7SiblingPresence, velocitySignals, parsedGradingRows, nearbyDaangnStats } = await loadPool(headers, {
      sort,
      source,
      priceMax,
      excludePids: excludeAllPids,
      readyCandidateLimit,
      userHomeDaangnFullPath: userHomeRegion?.daangn_full_path ?? null,
    });
    const skuImageMap = await loadSkuImageMap();
    items = buildItems(pool, raws, metas, marketBands, sourceMarketBands, v7SiblingPresence, velocitySignals, userHomeRegion, parsedGradingRows, skuImageMap);

    // Wave 373: 성향 정렬 — preference 따라 우선순위 재정렬.
    //   safe: 우수 셀러 (평점 4.5+ & 후기 10+) 우선
    //   aggressive: 차익 큰 매물 우선 (expected_profit_max desc)
    //   balanced: loadPool의 기존 정렬 유지 (profit_band desc + random shuffle)
    if (sort === "price_asc") {
      items = [...items].sort((a, b) => {
        if (a.price !== b.price) return a.price - b.price;
        return b.expectedProfitMax - a.expectedProfitMax;
      });
    } else if (preference === "safe") {
      const isPremium = (it: (typeof items)[number]) =>
        (it.sellerReviewRating ?? 0) >= 4.5 && it.sellerReviewCount >= 10;
      items = [...items].sort((a, b) => {
        const aP = isPremium(a) ? 1 : 0;
        const bP = isPremium(b) ? 1 : 0;
        if (aP !== bP) return bP - aP;
        // tie-breaker: 셀러 평점 desc
        return (b.sellerReviewRating ?? 0) - (a.sellerReviewRating ?? 0);
      });
    } else if (preference === "aggressive") {
      items = [...items].sort((a, b) => b.expectedProfitMax - a.expectedProfitMax);
    }
    // Wave 799 (2026-05-27): "가까운 순" 정렬 옵션 — daangn 매물 모두 위로 + 거리 ASC, non-daangn 아래로 차익순.
    if (sort === "distance") {
      items = [...items].sort((a, b) => {
        const aDaangn = a.marketplaceSource === "daangn";
        const bDaangn = b.marketplaceSource === "daangn";
        if (aDaangn !== bDaangn) return aDaangn ? -1 : 1;
        if (aDaangn && bDaangn) {
          const aDist = a.daangnDistanceKm ?? Number.POSITIVE_INFINITY;
          const bDist = b.daangnDistanceKm ?? Number.POSITIVE_INFINITY;
          if (aDist !== bDist) return aDist - bDist;
        }
        return (b.expectedProfitMax ?? 0) - (a.expectedProfitMax ?? 0);
      });
    }
    items = sortDaangnItemsByDistance(items);
    items = items.slice(0, PAGE_SIZE);
    const responseItems = items;

    return NextResponse.json({
      items: responseItems,
      cooldown: feedCooldown,
      feedMode: "membership",
      creditFeed: false,
      detailAccess,
      total: responseItems.length,
      pageSize: PAGE_SIZE,
      freshLagHours: FRESH_LAG_HOURS,
      debug: isAdminUser(auth.user) ? { nearbyDaangn: nearbyDaangnStats } : undefined,
      // Wave 382: 사용자 예산이 fallback됐는지 (사용자 안내용).
      appliedBudget,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // Wave launch-23 (audit HIGH 잔존): raw err.message client 노출 차단. 상세는 server console.
    console.error("packs/pool failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "pool_load_failed" }, { status: 500 });
  }
}
