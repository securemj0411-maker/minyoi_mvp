import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { loadV7SiblingPresence, type V7SiblingPresenceMap } from "@/lib/band-aware-median";
import { pickByConditionFallback } from "@/lib/condition-fallback";
import { createPoolAccessToken, decodePoolAccessToken, syntheticPidForPoolToken } from "@/lib/pool-access-token";
import { RESELL_SHIPPING_FEE, SAFETY_BUFFER, SELLING_FEE_RATE } from "@/lib/profit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

// Wave 338 (Phase 1a — Freemium /explore):
// 무료 사용자 매물 풀 browsing. 6h 이상 지난 매물만 노출 (유료는 즉시 — Phase 2).
//
// 정책:
// - 인증 필수 (로그인 사용자만)
// - 30개 매물 / 1 페이지 (limit)
// - 무료 "새 30개 받기" = 2h cooldown (mvp_user_credits.last_free_browse_at)
// - 크레딧 1개 이상 보유자는 피드 탐색 쿨다운 우회. 크레딧은 상세 분석 열람 때만 차감.
// - 정렬: profit_band desc, expected_profit_max desc (안정적 = 같은 사용자 같은 매물)
// - 무료 피드는 원본 pid/name/image/정확한 가격을 서버에서 마스킹
//
// 응답:
// {
//   items: [...30 매물...],
//   cooldown: { canRefresh: bool, remainingSec: number, nextAvailableAt: string }
// }
//
// 액션 (POST 또는 ?refresh=1):
//   cooldown 체크 → 통과 시 last_free_browse_at 갱신 + 새 매물 응답.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 30;
const READY_SLOTS = 25; // 살아있는 매물
const SOLD_OUT_SLOTS = 5; // 오늘 잡힌 매물 (FOMO)
// Wave 383: 30min → 2h. 6h 매물 lag 제거 (모든 신선 매물 노출) 대신 cooldown 4배 ↑.
// 초기 가치 체감 ↑ + 답답함으로 paywall 압박.
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2시간
// Wave 383: 6h lag 제거 (0으로). 신선도 차별 X → cooldown 차별화에 집중.
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
  price: number;
  sku_median: number | null;
  thumbnail_url: string | null;
};

type RawListingMeta = {
  pid: number;
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
};

type UserCreditsRow = {
  user_ref: string;
  balance: number | null;
  last_free_browse_at: string | null;
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
};

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

function lockedPreviewTitle(category: string | null, conditionClass: string | null) {
  const categoryLabel = LOCKED_CATEGORY_LABELS[category ?? ""] ?? "추천 매물";
  const conditionLabel = conditionClass ? (LOCKED_CONDITION_LABELS[conditionClass] ?? "상태 확인") : "상태 확인";
  return `${categoryLabel} · ${conditionLabel} 후보`;
}

function computeCooldown(lastBrowseAt: string | null): {
  canRefresh: boolean;
  remainingSec: number;
  nextAvailableAt: string | null;
} {
  if (!lastBrowseAt) {
    return { canRefresh: true, remainingSec: 0, nextAvailableAt: null };
  }
  const lastMs = new Date(lastBrowseAt).getTime();
  if (!Number.isFinite(lastMs)) {
    return { canRefresh: true, remainingSec: 0, nextAvailableAt: null };
  }
  const nextMs = lastMs + COOLDOWN_MS;
  const remainingMs = Math.max(0, nextMs - Date.now());
  return {
    canRefresh: remainingMs <= 0,
    remainingSec: Math.ceil(remainingMs / 1000),
    nextAvailableAt: new Date(nextMs).toISOString(),
  };
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
    priceMax?: number | null;
    excludePids?: number[];
    readyCandidateLimit?: number;
  } = {},
): Promise<{ pool: (PoolRow & { soldOut: boolean })[]; raws: RawRow[]; metas: RawListingMeta[]; marketBands: Map<string, Map<string, MarketBandRow>>; v7SiblingPresence: V7SiblingPresenceMap }> {
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

  // Wave 388: fetch 순서 재정렬 — budget filter를 다양화 전에 적용.
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
      `${tableUrl("mvp_listings")}?select=pid,name,price,sku_median,thumbnail_url&pid=in.(${allCandidatePids.join(",")})&limit=${allCandidatePids.length + 100}`,
      { headers },
    );
    const rawAll = (await rawAllRes.json()) as RawRow[];
    for (const r of rawAll) rawByPid.set(r.pid, r);
  }

  // Wave 388: budget filter — priceMax 있으면 raw.price <= priceMax인 매물만.
  const budgetPass = (row: PoolRow & { soldOut: boolean }) => {
    if (options.priceMax == null) return true;
    const raw = rawByPid.get(row.pid);
    return raw != null && Number.isFinite(raw.price) && raw.price > 0 && raw.price <= options.priceMax;
  };
  const readyFiltered = readyRowsRaw.filter(budgetPass);
  const soldOutFiltered = soldOutRowsRaw.filter(budgetPass);

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
  if (pool.length === 0) return { pool: [], raws: [], metas: [], marketBands: new Map(), v7SiblingPresence: new Map() };

  const pids = pool.map((r) => r.pid);
  // raws는 이미 rawByPid에 있음 — pool pids만 추출.
  const raws = pids.map((pid) => rawByPid.get(pid)).filter((r): r is RawRow => r != null);

  // meta + marketBands fetch (pool pids만).
  const comparableKeys = [...new Set(pool.map((r) => r.comparable_key).filter((k): k is string => Boolean(k)))];
  const [metaRes, marketBands, v7SiblingPresence] = await Promise.all([
    restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,free_shipping,last_seen_at,first_seen_at,shop_review_rating,shop_review_count,image_count,description_preview&pid=in.(${pids.join(",")})`,
      { headers },
    ),
    loadMarketBandsForPool(headers, comparableKeys),
    loadV7SiblingPresence(headers, comparableKeys),
  ]);
  const metas = (await metaRes.json()) as RawListingMeta[];
  return { pool, raws, metas, marketBands, v7SiblingPresence };
}

function buildItems(
  pool: (PoolRow & { soldOut: boolean })[],
  raws: RawRow[],
  metas: RawListingMeta[],
  marketBands: Map<string, Map<string, MarketBandRow>>,
  v7SiblingPresence: V7SiblingPresenceMap,
) {
  const rawByPid = new Map(raws.map((r) => [r.pid, r]));
  const metaByPid = new Map(metas.map((m) => [m.pid, m]));
  return pool
    .map((row) => {
      const raw = rawByPid.get(row.pid);
      const meta = metaByPid.get(row.pid);
      if (!raw) return null;
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
      const ASSUMED_BUY_SHIPPING = 3500;
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
          skuMedianFinal - (raw.price + ASSUMED_BUY_SHIPPING) - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER,
        );
      }
      // Wave 368: 안전망 — 재계산 후 차익이 0이면 응답에서 제외 (사용자 화면 노출 차단).
      if (recomputedProfitMax <= 0) {
        return null;
      }
      return {
        pid: row.pid,
        name: raw.name,
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
        imageCount: meta?.image_count ?? null,
        descriptionPreview: meta?.description_preview ?? "",
        lastSeenAt: meta?.last_seen_at ?? null,
        soldOut: row.soldOut,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

function maskFreeFeedItems<T extends ReturnType<typeof buildItems>[number]>(items: T[]) {
  return items.map((item) => {
    const accessToken = createPoolAccessToken(item.pid);
    return {
      ...item,
      pid: syntheticPidForPoolToken(accessToken),
      accessToken,
      name: lockedPreviewTitle(item.category, item.conditionClass),
      price: roundDownTenThousand(item.price) ?? 0,
      skuMedian: roundDownTenThousand(item.skuMedian),
      thumbnailUrl: null,
      skuId: null,
      skuName: null,
      expectedProfitMin: roundDownTenThousand(item.expectedProfitMin) ?? 0,
      expectedProfitMax: roundDownTenThousand(item.expectedProfitMax) ?? 0,
      sellerReviewRating: null,
      sellerReviewCount: 0,
      descriptionPreview: "",
    };
  });
}

async function loadUserCredits(headers: Record<string, string>, userRef: string): Promise<UserCreditsRow | null> {
  const res = await restFetch(
    `${tableUrl("mvp_user_credits")}?select=user_ref,balance,last_free_browse_at&user_ref=eq.${encodeURIComponent(userRef)}&limit=1`,
    { headers },
  );
  const rows = (await res.json()) as UserCreditsRow[];
  return rows[0] ?? null;
}

async function upsertLastBrowse(headers: Record<string, string>, userRef: string, authUserId: string) {
  await restFetch(`${tableUrl("mvp_user_credits")}?on_conflict=user_ref`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_ref: userRef,
      auth_user_id: authUserId,
      last_free_browse_at: new Date().toISOString(),
    }),
  });
}

export async function GET(req: Request) {
  try {
    const auth = await requireSupabaseUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const userRef = userRefForAuthUser(auth.user.id);
    const authUserId = auth.user.id;
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
    const credits = await loadUserCredits(headers, userRef);
    const creditFeed = isAdminUser(auth.user) || Number(credits?.balance ?? 0) > 0;
    const cooldown = computeCooldown(credits?.last_free_browse_at ?? null);
    const effectiveCooldown = creditFeed
      ? { canRefresh: true, remainingSec: 0, nextAvailableAt: null }
      : cooldown;

    // refresh 요청인데 cooldown 안 끝났으면 거부
    if (refresh && !creditFeed && !cooldown.canRefresh) {
      return NextResponse.json({
        items: [],
        cooldown,
        feedMode: "free",
        creditFeed: false,
        message: `${Math.ceil(cooldown.remainingSec / 60)}분 후 새 30개 매물을 받을 수 있어요.`,
      }, { status: 200 });
    }

    // refresh 요청이고 무료 cooldown 통과면 last_free_browse_at 갱신.
    // 크레딧 보유자는 피드 탐색에는 과금/쿨다운을 걸지 않는다.
    if (refresh && !creditFeed && cooldown.canRefresh) {
      await upsertLastBrowse(headers, userRef, authUserId);
    }

    // Wave 388: budget filter를 loadPool 안으로 (다양화 전에). fallback chain은
    // loadPool 재호출 — 각 단계 priceMax로 fetch + filter + 다양화 다시.
    // Wave 389: threshold 5 → 1. budget 통과 매물 1개라도 있으면 그대로 보여줌
    // (사용자가 본 매물 = 자기 예산 안 매물). 진짜 0개일 때만 fallback.
    // 다양화 cap 풀기는 diversifyByCategory의 "부족분 채움" 로직에서 이미 처리.
    const FALLBACK_THRESHOLD = 1;
    const readyCandidateLimit = refresh ? FETCH_POOL_OVERFETCH : READY_SLOTS;
    const fallbackChain: { code: "150k" | "300k" | "500k" | "unlimited"; max: number | null }[] = [
      { code: "150k", max: 150000 },
      { code: "300k", max: 300000 },
      { code: "500k", max: 500000 },
      { code: "unlimited", max: null },
    ];
    let appliedBudget: "150k" | "300k" | "500k" | "unlimited" = "unlimited";
    let items: ReturnType<typeof buildItems> = [];

    if (priceMax != null) {
      const startIdx = fallbackChain.findIndex((c) => c.max === priceMax);
      const effectiveStart = startIdx >= 0 ? startIdx : 0;
      for (let i = effectiveStart; i < fallbackChain.length; i++) {
        const candidate = fallbackChain[i];
        const { pool, raws, metas, marketBands, v7SiblingPresence } = await loadPool(headers, {
          sort,
          priceMax: candidate.max,
          excludePids: excludeAllPids,
          readyCandidateLimit,
        });
        const candItems = buildItems(pool, raws, metas, marketBands, v7SiblingPresence);
        if (candItems.length >= FALLBACK_THRESHOLD || i === fallbackChain.length - 1) {
          items = candItems;
          appliedBudget = candidate.code;
          break;
        }
      }
    } else {
      // priceMax 없으면 unlimited 한 번만 fetch.
      const { pool, raws, metas, marketBands, v7SiblingPresence } = await loadPool(headers, {
        sort,
        excludePids: excludeAllPids,
        readyCandidateLimit,
      });
      items = buildItems(pool, raws, metas, marketBands, v7SiblingPresence);
      appliedBudget = "unlimited";
    }

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
    const responseItems = creditFeed ? items : maskFreeFeedItems(items);

    // refresh 후 새 cooldown 정보
    const nextCooldown = creditFeed
      ? effectiveCooldown
      : refresh && cooldown.canRefresh
      ? computeCooldown(new Date().toISOString())
      : cooldown;

    return NextResponse.json({
      items: responseItems,
      cooldown: nextCooldown,
      feedMode: creditFeed ? "credit" : "free",
      creditFeed,
      total: responseItems.length,
      pageSize: PAGE_SIZE,
      freshLagHours: FRESH_LAG_HOURS,
      // Wave 382: 사용자 예산이 fallback됐는지 (사용자 안내용).
      appliedBudget,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
