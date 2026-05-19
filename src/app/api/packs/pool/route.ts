import { NextResponse } from "next/server";
import { pickByConditionFallback } from "@/lib/condition-fallback";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

// Wave 338 (Phase 1a — Freemium /explore):
// 무료 사용자 매물 풀 browsing. 6h 이상 지난 매물만 노출 (유료는 즉시 — Phase 2).
//
// 정책:
// - 인증 필수 (로그인 사용자만)
// - 30개 매물 / 1 페이지 (limit)
// - "새 30개 받기" = 30min cooldown (mvp_user_credits.last_free_browse_at)
// - 정렬: profit_band desc, expected_profit_max desc (안정적 = 같은 사용자 같은 매물)
// - 마스킹 X (가입한 사용자는 다 봄)
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
const COOLDOWN_MS = 30 * 60 * 1000; // 30분
const FRESH_LAG_HOURS = 6; // 무료는 6h 이상 지난 매물만
// Wave 346: 카테고리 다양화 — 한 카테고리에 5개 이상 몰리지 않게.
// 이어폰 풀이 가장 커서 profit_band 정렬하면 다 이어폰. 다양화 필수.
const MAX_PER_CATEGORY = 5;
const FETCH_POOL_OVERFETCH = 200; // 다양화 위해 더 많이 fetch 후 client-side dedup

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
  shop_review_rating: number | null;
  shop_review_count: number | null;
  description_preview: string | null;
};

type UserCreditsRow = {
  user_ref: string;
  last_free_browse_at: string | null;
};

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
): number | null {
  if (!comparableKey) return null;
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
  options: { sort?: "profit_desc" | "latest" } = {},
): Promise<{ pool: (PoolRow & { soldOut: boolean })[]; raws: RawRow[]; metas: RawListingMeta[]; marketBands: Map<string, Map<string, MarketBandRow>> }> {
  const sixHoursAgo = new Date(Date.now() - FRESH_LAG_HOURS * 60 * 60 * 1000).toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  // Wave 340 (UX 개선): 정렬 옵션. Wave 353: 카테고리 필터 백엔드 제거 (클라이언트로 이동).
  const orderClause = options.sort === "latest"
    ? "order=last_verified_at.desc"
    : "order=profit_band.desc,expected_profit_max.desc";

  // Wave 339 (Phase 1b sold out 옵션 B): ready 25 + 오늘 invalidated 5 = 30개.
  // Wave 346: 카테고리 다양화 — overfetch 후 카테고리당 MAX_PER_CATEGORY 제한.
  // Wave 353: 항상 다양화 (전체 = 카테고리 합집합 기대값과 일관성 위해 카테고리 필터는 클라이언트로).
  const [readyRes, soldOutRes] = await Promise.all([
    restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key,last_verified_at&status=eq.ready&last_verified_at=lte.${encodeURIComponent(sixHoursAgo)}&${orderClause}&limit=${FETCH_POOL_OVERFETCH}`,
      { headers },
    ),
    restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key,last_verified_at&status=eq.invalidated&updated_at=gte.${encodeURIComponent(todayIso)}&order=updated_at.desc&limit=${SOLD_OUT_SLOTS * 4}`,
      { headers },
    ),
  ]);
  const readyRowsRaw = ((await readyRes.json()) as PoolRow[]).map((r) => ({ ...r, soldOut: false }));
  const soldOutRowsRaw = ((await soldOutRes.json()) as PoolRow[]).map((r) => ({ ...r, soldOut: true }));

  // Wave 346: 카테고리 다양화 (항상 적용 — Wave 353부터 카테고리 필터는 클라이언트로).
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
    // 만약 다양화 후 부족하면 (희귀 카테고리만 있는 경우) 부족분 채움
    if (out.length < maxRows) {
      for (const row of rows) {
        if (out.length >= maxRows) break;
        if (out.some((r) => r.pid === row.pid)) continue;
        out.push(row);
      }
    }
    return out;
  }

  const readyRows = diversifyByCategory(readyRowsRaw, READY_SLOTS);
  const soldOutRows = diversifyByCategory(soldOutRowsRaw, SOLD_OUT_SLOTS);

  // sold out grid 중간에 자연스럽게 (사용자가 발견하며 후회). 정렬 latest일 땐 안 섞음.
  const pool = options.sort === "latest"
    ? [...readyRows, ...soldOutRows]
    : [...readyRows, ...soldOutRows].sort(() => Math.random() - 0.5);
  if (pool.length === 0) return { pool: [], raws: [], metas: [], marketBands: new Map() };

  const pids = pool.map((r) => r.pid);
  // Wave 247.2: market band fetch 도 병렬화 — pool 의 comparable_key 만 lookup.
  const comparableKeys = [...new Set(pool.map((r) => r.comparable_key).filter((k): k is string => Boolean(k)))];
  const [rawRes, metaRes, marketBands] = await Promise.all([
    restFetch(
      `${tableUrl("mvp_listings")}?select=pid,name,price,sku_median,thumbnail_url&pid=in.(${pids.join(",")})`,
      { headers },
    ),
    restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,free_shipping,last_seen_at,shop_review_rating,shop_review_count,description_preview&pid=in.(${pids.join(",")})`,
      { headers },
    ),
    loadMarketBandsForPool(headers, comparableKeys),
  ]);
  const raws = (await rawRes.json()) as RawRow[];
  const metas = (await metaRes.json()) as RawListingMeta[];
  return { pool, raws, metas, marketBands };
}

function buildItems(
  pool: (PoolRow & { soldOut: boolean })[],
  raws: RawRow[],
  metas: RawListingMeta[],
  marketBands: Map<string, Map<string, MarketBandRow>>,
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
      const bandPrice = bandAwareMedian(marketBands, row.comparable_key, row.condition_class);
      const skuMedianFinal = bandPrice ?? raw.sku_median;
      // Wave 368 (2026-05-19): sanity check — expected_profit (옛날 시점 계산) vs
      // 현재 표시 시세 (wave 247.2 band-aware) inconsistency 차단.
      // 표시 시세가 매입가보다 낮은데 차익 +로 나오면 사용자 신뢰 깎임 (사기처럼 보임).
      // 시세가 매입가 미만이면 풀에서 제외 (data drift 시 silently 숨김).
      if (skuMedianFinal && skuMedianFinal > 0 && raw.price > skuMedianFinal) {
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
        expectedProfitMin: row.expected_profit_min,
        expectedProfitMax: row.expected_profit_max,
        profitBand: row.profit_band,
        confidence: row.confidence,
        category: row.category,
        conditionClass: row.condition_class,
        comparableKey: row.comparable_key,
        lastVerifiedAt: row.last_verified_at,
        freeShipping: meta?.free_shipping ?? false,
        sellerReviewRating: meta?.shop_review_rating ?? null,
        sellerReviewCount: meta?.shop_review_count ?? 0,
        descriptionPreview: meta?.description_preview ?? "",
        lastSeenAt: meta?.last_seen_at ?? null,
        soldOut: row.soldOut,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

async function loadUserCredits(headers: Record<string, string>, userRef: string): Promise<UserCreditsRow | null> {
  const res = await restFetch(
    `${tableUrl("mvp_user_credits")}?select=user_ref,last_free_browse_at&user_ref=eq.${encodeURIComponent(userRef)}&limit=1`,
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
    const sort: "profit_desc" | "latest" = sortParam === "latest" ? "latest" : "profit_desc";

    const headers = serviceHeaders();
    const credits = await loadUserCredits(headers, userRef);
    const cooldown = computeCooldown(credits?.last_free_browse_at ?? null);

    // refresh 요청인데 cooldown 안 끝났으면 거부
    if (refresh && !cooldown.canRefresh) {
      return NextResponse.json({
        items: [],
        cooldown,
        message: `${Math.ceil(cooldown.remainingSec / 60)}분 후 새 30개 매물을 받을 수 있어요.`,
      }, { status: 200 });
    }

    // refresh 요청이고 cooldown 통과면 last_free_browse_at 갱신
    if (refresh && cooldown.canRefresh) {
      await upsertLastBrowse(headers, userRef, authUserId);
    }

    const { pool, raws, metas, marketBands } = await loadPool(headers, { sort });
    const items = buildItems(pool, raws, metas, marketBands);

    // refresh 후 새 cooldown 정보
    const nextCooldown = refresh && cooldown.canRefresh
      ? computeCooldown(new Date().toISOString())
      : cooldown;

    return NextResponse.json({
      items,
      cooldown: nextCooldown,
      total: items.length,
      pageSize: PAGE_SIZE,
      freshLagHours: FRESH_LAG_HOURS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
