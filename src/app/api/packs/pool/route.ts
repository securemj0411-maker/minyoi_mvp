import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { loadV7SiblingPresence, type V7SiblingPresenceMap } from "@/lib/band-aware-median";
import { pickByConditionFallback } from "@/lib/condition-fallback";
import { inferMarketplaceTransaction, marketplaceFactsFromRawJson, marketplaceLocationCombined } from "@/lib/marketplace-safety";
import { listingUrlForSource, marketplaceSourceLabel, normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { createPoolAccessToken, decodePoolAccessToken, syntheticPidForPoolToken } from "@/lib/pool-access-token";
import { localizeProductLineLabel } from "@/lib/product-line-display";
import { RESELL_SHIPPING_FEE, SAFETY_BUFFER, SELLING_FEE_RATE } from "@/lib/profit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";
import { getDetailAccessSnapshot } from "@/lib/detail-access";
import { isBetaTesterAuthId } from "@/lib/beta-tester";

// Wave 338 (Phase 1a — Freemium /explore):
// 무료 사용자 매물 풀 browsing. 6h 이상 지난 매물만 노출 (유료는 즉시 — Phase 2).
//
// 정책:
// - 인증 필수 (로그인 사용자만)
// - 30개 매물 / 1 페이지 (limit)
// - 피드 탐색은 무료. 크레딧은 상세 분석/원문 공개 때만 차감.
// - 정렬: profit_band desc, expected_profit_max desc (안정적 = 같은 사용자 같은 매물)
// - 피드는 구매 실행 식별키(pid/name/정확가/source/link)를 서버에서 teaser로 치환
//
// 응답:
// {
//   items: [...30 매물...],
//   cooldown: { canRefresh: true, remainingSec: 0, nextAvailableAt: null }
// }
//
// 액션 (POST 또는 ?refresh=1):
//   새 teaser 매물 응답. 상세보기 진입 시에만 실시간 검증 + 차감.

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
// Wave 375 (2026-05-20): 200 → 500. Wave 387 잘못 진단 revert.
// 실제 원인 (Wave 388): 다양화가 budget filter 전에 적용됨 → 카테고리당 5개 = 30개가
// 비싼 매물로 채워짐 → budget 통과 < 5. ready 전체 400개라 overfetch는 충분.
const FETCH_POOL_OVERFETCH = 500;

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
  // Wave launch-4 (launch audit CRITICAL #4): listing_state 받아서 'active' 외 매물 사용자 풀에서 차단.
  // candidate_pool.status=ready 가드만으로는 lifecycle cron lag 시 sold_confirmed/disappeared 노출 가능.
  listing_state: string | null;
};

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

function roundDownTenThousand(value: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return value;
  return Math.max(0, Math.floor(Number(value) / 10000) * 10000);
}

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
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "가격대 확인";
  const manwon = Math.floor(n / 10000);
  if (manwon <= 0) return "1만원 미만";
  if (manwon < 10) return `${manwon}만원대`;
  const ten = Math.floor(manwon / 10) * 10;
  return `${ten}만원대`;
}

function relativeDiscountLabel(price: number, marketPrice: number | null | undefined) {
  const market = Number(marketPrice ?? 0);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(market) || market <= 0 || price >= market) return null;
  const discount = Math.max(1, Math.round(((market - price) / market) * 100));
  const rounded = discount >= 10 ? Math.round(discount / 5) * 5 : discount;
  return `시세보다 약 ${rounded}% 낮음`;
}

function sellerSignalLabel(item: {
  marketplaceSource?: string | null;
  sellerReviewRating?: number | null;
  sellerReviewCount?: number | null;
  joongnaTrustScore?: number | null;
  joongnaSafeOrderSalesCount?: number | null;
}) {
  const reviewCount = Number(item.sellerReviewCount ?? 0);
  if (item.marketplaceSource === "joongna") {
    const trust = Number(item.joongnaTrustScore ?? 0);
    const safeSales = Number(item.joongnaSafeOrderSalesCount ?? 0);
    if (trust >= 700 || reviewCount >= 10 || safeSales >= 3) return "판매자 신호 양호";
    if (trust >= 400 || reviewCount > 0 || safeSales > 0) return "판매자 이력 확인 가능";
    return "판매자 정보 상세 확인";
  }
  const rating = Number(item.sellerReviewRating ?? 0);
  if (rating >= 4.8 && reviewCount >= 30) return "후기 많은 셀러";
  if (rating >= 4.5 && reviewCount >= 5) return "판매자 신호 양호";
  if (reviewCount > 0) return "거래후기 확인 가능";
  return "판매자 정보 상세 확인";
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
  blended_median_price: number | null;
  active_median_price: number | null;
  active_sample_count: number | null;
  sold_sample_count: number | null;
  disappeared_sample_count: number | null;
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
    if (!byCondition.has(row.condition_class)) {
      byCondition.set(row.condition_class, row);
    }
    byKey.set(row.comparable_key, byCondition);
  }
  return byKey;
}

function bandAwareMedian(
  bandMap: Map<string, Map<string, MarketBandRow>>,
  comparableKey: string | null,
  conditionClass: string | null,
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
  );
  if (!row) return null;
  const price = row.blended_median_price ?? row.active_median_price ?? null;
  return price && price > 0 ? price : null;
}

async function loadPool(
  headers: Record<string, string>,
  options: {
    sort?: "profit_desc" | "latest" | "price_asc";
    source?: "bunjang" | "joongna" | null;
    priceMax?: number | null;
    excludePids?: number[];
    readyCandidateLimit?: number;
  } = {},
): Promise<{
  pool: (PoolRow & { soldOut: boolean })[];
  raws: RawRow[];
  metas: RawListingMeta[];
  marketBands: Map<string, Map<string, MarketBandRow>>;
  v7SiblingPresence: V7SiblingPresenceMap;
  parsedGradingRows: Array<{
    pid: number;
    condition_tier: string | null;
    condition_cluster: string | null;
    condition_confidence: number | null;
    condition_flags: Record<string, unknown> | null;
    parsed_json: Record<string, unknown> | null;
  }>;
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
  // DB 확인: joongna ready 55 / bunjang ready 280 / 총 ready 335. candidate_pool 풀이 작아서
  //   전체 다 가져와 application-level 에서 source filter 가 더 안전. mvp_candidate_pool 에
  //   source 컬럼 없어서 별도 raw_listings.source 짧은 fetch 로 mapping 만든다.
  const [readyRes, soldOutRes] = await Promise.all([
    restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key,last_verified_at&status=eq.ready${excludeClause}&${orderClause}&limit=${FETCH_POOL_OVERFETCH}`,
      { headers },
    ),
    restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key,last_verified_at&status=eq.invalidated&updated_at=gte.${encodeURIComponent(todayIso)}${excludeClause}&order=updated_at.desc&limit=${SOLD_OUT_SLOTS * 4}`,
      { headers },
    ),
  ]);
  const readyRowsRaw = ((await readyRes.json()) as PoolRow[]).map((r) => ({ ...r, soldOut: false }));
  const soldOutRowsRaw = ((await soldOutRes.json()) as PoolRow[]).map((r) => ({ ...r, soldOut: true }));

  // Wave 388: 모든 candidate pid의 raw mvp_listings fetch (다양화/budget filter 전).
  const allCandidatePids = Array.from(new Set([
    ...readyRowsRaw.map((r) => r.pid),
    ...soldOutRowsRaw.map((r) => r.pid),
  ]));
  const rawByPid = new Map<number, RawRow>();
  if (allCandidatePids.length > 0) {
    const rawAllRes = await restFetch(
      `${tableUrl("mvp_listings")}?select=pid,name,url,price,sku_median,thumbnail_url&pid=in.(${allCandidatePids.join(",")})&limit=${allCandidatePids.length + 100}`,
      { headers },
    );
    const rawAll = (await rawAllRes.json()) as RawRow[];
    for (const r of rawAll) rawByPid.set(r.pid, r);
  }

  // Wave launch-40: source 별도 mapping. allCandidatePids (≈335) 의 source 만 fetch.
  // URL 크기 ≈ 335 × 14 = 4.7KB 안전. options.source 있을 때만 fetch.
  const sourceByPid = new Map<number, string | null>();
  if (options.source && allCandidatePids.length > 0) {
    const sourceRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,source&pid=in.(${allCandidatePids.join(",")})&limit=${allCandidatePids.length + 100}`,
      { headers },
    );
    const sourceRows = (await sourceRes.json()) as Array<{ pid: number; source: string | null }>;
    for (const row of sourceRows) sourceByPid.set(Number(row.pid), row.source);
  }
  const sourcePass = (row: PoolRow & { soldOut: boolean }) => {
    if (!options.source) return true;
    return sourceByPid.get(row.pid) === options.source;
  };

  // Wave 388: budget filter — priceMax 있으면 raw.price <= priceMax인 매물만.
  const budgetPass = (row: PoolRow & { soldOut: boolean }) => {
    if (options.priceMax == null) return true;
    const raw = rawByPid.get(row.pid);
    return raw != null && Number.isFinite(raw.price) && raw.price > 0 && raw.price <= options.priceMax;
  };
  // Wave launch-40: source + budget 통합 필터. 다양화 전.
  const readyFiltered = readyRowsRaw.filter((r) => sourcePass(r) && budgetPass(r));
  const soldOutFiltered = soldOutRowsRaw.filter((r) => sourcePass(r) && budgetPass(r));

  // Wave 346: 카테고리 다양화 — budget filter 통과 매물 안에서만.
  function diversifyByCategory(rows: (PoolRow & { soldOut: boolean })[], maxRows: number) {
    const perCategory = new Map<string, number>();
    const out: (PoolRow & { soldOut: boolean })[] = [];
    for (const row of rows) {
      const cat = row.category ?? "unknown";
      const count = perCategory.get(cat) ?? 0;
      if (count >= MAX_PER_CATEGORY) continue;
      perCategory.set(cat, count + 1);
      out.push(row);
      if (out.length >= maxRows) break;
    }
    if (out.length < maxRows) {
      for (const row of rows) {
        if (out.length >= maxRows) break;
        if (out.some((r) => r.pid === row.pid)) continue;
        out.push(row);
      }
    }
    return out;
  }

  // Refresh/infinite feed에서는 앞쪽 25개 후보가 실시간 차익 재계산에서 탈락해도
  // 뒤에 남은 ready 후보를 계속 찾을 수 있게 더 넓게 훑는다.
  const readyRows = diversifyByCategory(readyFiltered, options.readyCandidateLimit ?? READY_SLOTS);
  const soldOutRows = diversifyByCategory(soldOutFiltered, SOLD_OUT_SLOTS);

  const pool = options.sort === "latest"
    ? [...readyRows, ...soldOutRows]
    : [...readyRows, ...soldOutRows].sort(() => Math.random() - 0.5);
  if (pool.length === 0) return { pool: [], raws: [], metas: [], marketBands: new Map(), v7SiblingPresence: new Map(), parsedGradingRows: [] };

  const pids = pool.map((r) => r.pid);
  // raws는 이미 rawByPid에 있음 — pool pids만 추출.
  const raws = pids.map((pid) => rawByPid.get(pid)).filter((r): r is RawRow => r != null);

  // meta + marketBands fetch (pool pids만).
  const comparableKeys = [...new Set(pool.map((r) => r.comparable_key).filter((k): k is string => Boolean(k)))];
  const [metaRes, marketBands, v7SiblingPresence, parsedGradingRes] = await Promise.all([
    restFetch(
      // Wave launch-4: listing_state 컬럼 추가 select. 응답 후 ready 였지만 active 아닌 row 차단.
      `${tableUrl("mvp_raw_listings")}?select=pid,source,seller_source,url,sku_id,sku_name,free_shipping,last_seen_at,first_seen_at,shop_review_rating,shop_review_count,image_count,description_preview,raw_json,listing_state&pid=in.(${pids.join(",")})`,
      { headers },
    ),
    loadMarketBandsForPool(headers, comparableKeys),
    loadV7SiblingPresence(headers, comparableKeys),
    // Wave 714k (2026-05-23): 신발/의류 5-tier grading + chips column fetch.
    restFetch(
      `${tableUrl("mvp_listing_parsed")}?select=pid,condition_tier,condition_cluster,condition_confidence,condition_flags,parsed_json&pid=in.(${pids.join(",")})`,
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
    parsed_json: Record<string, unknown> | null;
  }>;

  // Wave launch-4 (launch audit CRITICAL #4): ready 였지만 listing_state != 'active' 인 매물 사용자 풀 차단.
  // candidate_pool.status=ready 가드만으로는 lifecycle cron lag 시 sold_confirmed / disappeared /
  // missing_suspect 매물이 사용자 화면에 노출됨. 신뢰 박살 risk.
  // soldOut row (status=invalidated) 는 그대로 — 이미 sold_out 마스킹 디자인 적용됨.
  const metaByPidLocal = new Map(metas.map((m) => [m.pid, m]));
  const blockedPids = new Set<number>();
  for (const row of pool) {
    if (row.soldOut) continue; // sold_out 행은 의도적으로 살림
    const meta = metaByPidLocal.get(row.pid);
    const state = meta?.listing_state ?? null;
    // listing_state null 은 옛 데이터 — 의심스러우면 일단 차단 (보수)
    if (state !== "active") {
      blockedPids.add(row.pid);
    }
  }
  if (blockedPids.size > 0) {
    console.warn("[pool] listing_state stale block", {
      blocked: blockedPids.size,
      total_ready: pool.filter((r) => !r.soldOut).length,
    });
  }
  const filteredPool = pool.filter((r) => !blockedPids.has(r.pid));
  const filteredRaws = raws.filter((r) => !blockedPids.has(r.pid));
  const filteredMetas = metas.filter((m) => !blockedPids.has(m.pid));

  return { pool: filteredPool, raws: filteredRaws, metas: filteredMetas, marketBands, v7SiblingPresence, parsedGradingRows };
}

function buildItems(
  pool: (PoolRow & { soldOut: boolean })[],
  raws: RawRow[],
  metas: RawListingMeta[],
  marketBands: Map<string, Map<string, MarketBandRow>>,
  v7SiblingPresence: V7SiblingPresenceMap,
  parsedGradingRows: Array<{
    pid: number;
    condition_tier: string | null;
    condition_cluster: string | null;
    condition_confidence: number | null;
    condition_flags: Record<string, unknown> | null;
    parsed_json: Record<string, unknown> | null;
  }> = [],
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
    gradingByPid.set(Number(row.pid), {
      tier: row.condition_tier ?? grade?.tier ?? null,
      cluster: row.condition_cluster ?? grade?.cluster ?? null,
      confidence: row.condition_confidence ?? grade?.confidence ?? null,
      flags: row.condition_flags ?? grade?.flags ?? null,
      chips: grade?.chips ?? null,
    });
  }
  return pool
    .map((row) => {
      const raw = rawByPid.get(row.pid);
      const meta = metaByPid.get(row.pid);
      if (!raw) return null;
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
      // Wave 247.2 (2026-05-19): band-aware sku_median.
      //   기존: raw.sku_median (mvp_listings — condition_class 무시, 전체 median).
      //   사용자 풀의 16% (82/500) sku_median=0 → "시세 0원" 미스리딩.
      //   새: mvp_market_price_daily 의 (comparable_key, condition_class) band 우선 →
      //     매칭 band 없으면 fallback chain (mint → clean → normal → worn) →
      //     모든 band 없으면 raw.sku_median (전체 median).
      //   pack-open.ts 의 marketBasisForCandidate 와 동일 정책. additive only — DB 변경 X.
      // Wave 252.A real (2026-05-20): v3 clothing key + v7 sibling 존재 시 mixed-pool 차단.
      //   v3 매물은 raw.sku_median 도 mixed-pool 계산값 → 둘 다 신뢰 불가 → skuMedianFinal=0
      //   (Wave 249 sku_median_unavailable 가드 동일 결과).
      const v3Stale = row.comparable_key && v7SiblingPresence.get(row.comparable_key) === true;
      const bandPrice = bandAwareMedian(marketBands, row.comparable_key, row.condition_class, v7SiblingPresence);
      const skuMedianFinal = v3Stale ? 0 : (bandPrice ?? raw.sku_median);
      // Wave 369 (2026-05-19): expected_profit 재계산 — pool builder 공식과 같이,
      // 표시 시세 (band-aware) 기준으로 응답 시점에 다시 계산.
      // 이유: DB column expected_profit_min/max는 pool builder 시점 계산이라
      // wave 247.2 band-aware median 적용 후 동기화 안 됨. 같은 매물에 "시세 < 매입인데 차익 +"
      // 같은 모순 노출 (사용자 신뢰 손상).
      //
      // 공식 (candidate-pool-builder.ts line 398-402 와 동일):
      //   sellFee = skuMedian * 3.5%
      //   profitMax = max(0, skuMedian - price - sellFee - 3500(재배송) - 5000(buffer))
      //   profitMin = max(0, skuMedian - (price + 3500(매입배송 추정)) - sellFee - 3500 - 5000)
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
      if (skuMedianFinal && skuMedianFinal > 0 && Number.isFinite(raw.price) && raw.price > 0) {
        const sellFee = Math.round(skuMedianFinal * SELLING_FEE_RATE);
        recomputedProfitMax = Math.max(
          0,
          skuMedianFinal - raw.price - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER,
        );
        recomputedProfitMin = Math.max(
          0,
          skuMedianFinal - (raw.price + assumedBuyShipping) - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER,
        );
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
        thumbnailUrl: raw.thumbnail_url,
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
        productTradeType: facts.productTradeType ?? null,
        parcelFeeYn: facts.parcelFeeYn ?? null,
        tradeLabels: [...(facts.tradeLabels ?? [])],
        transactionMode: tx.transactionMode,
        shippingAssumption: tx.assumption,
        // Wave launch-37: raw_json 없으면 description 에서 "직거래는 안동 송하동" 같은 패턴 추출.
        directTradeLocation: marketplaceLocationCombined(meta?.raw_json, meta?.description_preview ?? null),
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
        sellerSignalLabel: sellerSignalLabel({
          marketplaceSource,
          sellerReviewRating: meta?.shop_review_rating ?? null,
          sellerReviewCount: meta?.shop_review_count ?? 0,
          joongnaTrustScore: facts.joongnaTrustScore ?? null,
          joongnaSafeOrderSalesCount: facts.joongnaSafeOrderSalesCount ?? null,
        }),
        marketSignalLabel: confidenceSignalLabel(row.confidence),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

function buildTeaserFeedItems<T extends ReturnType<typeof buildItems>[number]>(items: T[]) {
  return items.map((item) => {
    const accessToken = createPoolAccessToken(item.pid);
    const roundedPrice = roundDownTenThousand(item.price) ?? 0;
    const roundedMarketPrice = roundDownTenThousand(item.skuMedian);
    return {
      ...item,
      pid: syntheticPidForPoolToken(accessToken),
      accessToken,
      feedPreviewLocked: true,
      name: item.productLineLabel ?? lockedPreviewTitle(item.category, item.conditionClass),
      listingUrl: null,
      marketplaceSource: null,
      marketplaceLabel: null,
      price: roundedPrice,
      skuMedian: roundedMarketPrice,
      thumbnailUrl: item.thumbnailUrl,
      skuId: null,
      skuName: null,
      comparableKey: null,
      expectedProfitMin: roundDownTenThousand(item.expectedProfitMin) ?? 0,
      expectedProfitMax: roundDownTenThousand(item.expectedProfitMax) ?? 0,
      sellerReviewRating: null,
      sellerReviewCount: 0,
      joongnaTrustScore: null,
      joongnaSafeOrderSalesCount: null,
      joongnaSafeOrderSalesText: null,
      directTradeLocation: null,
      descriptionPreview: "",
      priceBandLabel: priceBandLabel(roundedPrice),
      marketPriceBandLabel: priceBandLabel(roundedMarketPrice),
      priceSignalLabel: item.priceSignalLabel,
      sellerSignalLabel: item.sellerSignalLabel,
      marketSignalLabel: item.marketSignalLabel,
    };
  });
}

export async function GET(req: Request) {
  try {
    const auth = await requireSupabaseUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const userRef = userRefForAuthUser(auth.user.id);
    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";
    // Wave 340: 정렬 옵션. Wave 353: 카테고리 필터는 클라이언트로 이동 (전체 vs 카테고리 일관성).
    const sortParam = url.searchParams.get("sort");
    const sort: "profit_desc" | "latest" | "price_asc" =
      sortParam === "latest" || sortParam === "price_asc" ? sortParam : "profit_desc";

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
    const source: "bunjang" | "joongna" | null =
      sourceParam === "bunjang" || sourceParam === "joongna"
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
    const unlimitedAccess = isAdminUser(auth.user) || (await isBetaTesterAuthId(auth.user.id));
    const detailAccess = await getDetailAccessSnapshot({ user: auth.user, userRef, unlimited: unlimitedAccess });
    const feedCooldown = { canRefresh: true, remainingSec: 0, nextAvailableAt: null };

    const readyCandidateLimit = refresh ? FETCH_POOL_OVERFETCH : READY_SLOTS;
    const appliedBudget: "150k" | "300k" | "500k" | "unlimited" =
      priceMax === 150000 ? "150k" :
      priceMax === 300000 ? "300k" :
      priceMax === 500000 ? "500k" :
      "unlimited";
    let items: ReturnType<typeof buildItems> = [];

    // 예산 필터가 있을 때 더 넓은 가격대로 조용히 fallback하지 않는다.
    // 15만원 이하를 보고 있는데 서버가 30/50만원 매물을 가져와도 프론트에서 다시 숨겨져
    // "새 매물 붙이는 중"만 길게 보이는 문제가 생긴다.
    const { pool, raws, metas, marketBands, v7SiblingPresence, parsedGradingRows } = await loadPool(headers, {
      sort,
      source,
      priceMax,
      excludePids: excludeAllPids,
      readyCandidateLimit,
    });
    items = buildItems(pool, raws, metas, marketBands, v7SiblingPresence, parsedGradingRows);

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
    items = items.slice(0, PAGE_SIZE);
    const responseItems = buildTeaserFeedItems(items);

    return NextResponse.json({
      items: responseItems,
      cooldown: feedCooldown,
      feedMode: "free",
      creditFeed: false,
      detailAccess,
      total: responseItems.length,
      pageSize: PAGE_SIZE,
      freshLagHours: FRESH_LAG_HOURS,
      // Wave 382: 사용자 예산이 fallback됐는지 (사용자 안내용).
      appliedBudget,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // Wave launch-23 (audit HIGH 잔존): raw err.message client 노출 차단. 상세는 server console.
    console.error("packs/pool failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "pool_load_failed" }, { status: 500 });
  }
}
