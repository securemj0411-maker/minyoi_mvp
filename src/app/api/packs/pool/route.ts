import { NextResponse } from "next/server";
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

async function loadPool(headers: Record<string, string>): Promise<{ pool: (PoolRow & { soldOut: boolean })[]; raws: RawRow[]; metas: RawListingMeta[] }> {
  const sixHoursAgo = new Date(Date.now() - FRESH_LAG_HOURS * 60 * 60 * 1000).toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  // Wave 339 (Phase 1b sold out 옵션 B): ready 25 + 오늘 invalidated 5 = 30개.
  // sold out 매물도 카드 그대로 + "🔴 다른 사용자가 잡음" 오버레이 → FOMO 강화.
  const [readyRes, soldOutRes] = await Promise.all([
    restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key,last_verified_at&status=eq.ready&last_verified_at=lte.${encodeURIComponent(sixHoursAgo)}&order=profit_band.desc,expected_profit_max.desc&limit=${READY_SLOTS}`,
      { headers },
    ),
    restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key,last_verified_at&status=eq.invalidated&updated_at=gte.${encodeURIComponent(todayIso)}&order=updated_at.desc&limit=${SOLD_OUT_SLOTS}`,
      { headers },
    ),
  ]);
  const readyRows = ((await readyRes.json()) as PoolRow[]).map((r) => ({ ...r, soldOut: false }));
  const soldOutRows = ((await soldOutRes.json()) as PoolRow[]).map((r) => ({ ...r, soldOut: true }));

  // 무작위 섞기 — sold out 매물이 자연스럽게 grid 중간에 (사용자가 발견하며 후회)
  const pool = [...readyRows, ...soldOutRows].sort(() => Math.random() - 0.5);
  if (pool.length === 0) return { pool: [], raws: [], metas: [] };

  const pids = pool.map((r) => r.pid);
  const [rawRes, metaRes] = await Promise.all([
    restFetch(
      `${tableUrl("mvp_listings")}?select=pid,name,price,sku_median,thumbnail_url&pid=in.(${pids.join(",")})`,
      { headers },
    ),
    restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,free_shipping,last_seen_at,shop_review_rating,shop_review_count,description_preview&pid=in.(${pids.join(",")})`,
      { headers },
    ),
  ]);
  const raws = (await rawRes.json()) as RawRow[];
  const metas = (await metaRes.json()) as RawListingMeta[];
  return { pool, raws, metas };
}

function buildItems(pool: (PoolRow & { soldOut: boolean })[], raws: RawRow[], metas: RawListingMeta[]) {
  const rawByPid = new Map(raws.map((r) => [r.pid, r]));
  const metaByPid = new Map(metas.map((m) => [m.pid, m]));
  return pool
    .map((row) => {
      const raw = rawByPid.get(row.pid);
      const meta = metaByPid.get(row.pid);
      if (!raw) return null;
      return {
        pid: row.pid,
        name: raw.name,
        price: raw.price,
        skuMedian: raw.sku_median,
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

    const { pool, raws, metas } = await loadPool(headers);
    const items = buildItems(pool, raws, metas);

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
