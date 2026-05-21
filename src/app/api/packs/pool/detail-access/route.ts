import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { consumeDetailAccess } from "@/lib/detail-access";
import { listingUrlForSource, marketplaceSourceLabel, normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { decodePoolAccessToken } from "@/lib/pool-access-token";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isReadyPoolPid(pid: number): Promise<boolean> {
  const rows = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid&pid=eq.${pid}&status=eq.ready&limit=1`,
    { headers: serviceHeaders() },
  ).then((res) => res.json() as Promise<Array<{ pid?: number }>>);
  return rows.length > 0;
}

async function loadExactPoolItem(pid: number) {
  const headers = serviceHeaders();
  const [poolRows, rawRows, metaRows] = await Promise.all([
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
      `${tableUrl("mvp_raw_listings")}?select=pid,source,seller_source,url,sku_id,sku_name,free_shipping,last_seen_at,first_seen_at,shop_review_rating,shop_review_count,image_count,description_preview&pid=eq.${pid}&limit=1`,
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
    }>>),
  ]);

  const pool = poolRows[0];
  const raw = rawRows[0];
  const meta = metaRows[0];
  if (!pool || !raw) return null;
  const marketplaceSource = normalizeMarketplaceSource(meta?.source ?? meta?.seller_source);
  return {
    pid,
    name: raw.name,
    price: raw.price,
    skuMedian: raw.sku_median,
    listingUrl: listingUrlForSource(pid, meta?.url ?? raw.url, marketplaceSource),
    marketplaceSource,
    marketplaceLabel: marketplaceSourceLabel(marketplaceSource),
    thumbnailUrl: raw.thumbnail_url,
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
    imageCount: meta?.image_count ?? null,
    descriptionPreview: meta?.description_preview ?? "",
    soldOut: false,
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

  if (!isAdminUser(auth.user) && !(await isReadyPoolPid(pid))) {
    return NextResponse.json(
      { error: "not_ready", message: "이 매물은 지금 상세보기 대상이 아니에요. 새로고침 후 다시 확인해주세요." },
      { status: 404 },
    );
  }

  const userRef = userRefForAuthUser(auth.user.id);
  const access = await consumeDetailAccess({ user: auth.user, userRef, pid });
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
    item: await loadExactPoolItem(pid),
  });
}
