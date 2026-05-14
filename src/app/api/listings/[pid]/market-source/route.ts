// Wave 90 (2026-05-15): 시세 근거 디버그 API.
// 사용자 매물 (reveal 됐던 매물) 대상으로 시세 산정의 근거 매물 list + 통계 반환.
// 목적: 사용자가 매물 검증 시 "이 시세가 어떤 매물 기준으로 계산됐는지" 확인 가능하게.
// 보안: 사용자 본인 reveal 매물만 조회 가능 (mvp_pack_reveals 통한 권한 체크).

import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_COMPARABLES = 30;

type Comparable = {
  pid: number;
  name: string;
  price: number;
  thumbnailUrl: string | null;
  saleStatus: string | null;
  listingState: string | null;
  lastSeenAt: string | null;
  sourceQuery: string | null;
  bunjangUrl: string;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ pid: string }> },
) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { pid: pidStr } = await params;
  const pid = Number(pidStr);
  if (!Number.isFinite(pid)) return NextResponse.json({ error: "invalid pid" }, { status: 400 });

  const userRef = userRefForAuthUser(auth.user.id);

  try {
    // 1. 권한 체크 — 사용자가 이 매물을 reveal 받았는지 확인
    const revealRes = await restFetch(
      `${tableUrl("mvp_pack_reveals")}?select=pid,user_ref&pid=eq.${pid}&user_ref=eq.${encodeURIComponent(userRef)}&limit=1`,
      { headers: serviceHeaders() },
    );
    const revealRows = (await revealRes.json()) as Array<{ pid: number }>;
    if (revealRows.length === 0) {
      return NextResponse.json({ error: "not your reveal" }, { status: 403 });
    }

    // 2. 우리 매물 정보 + comparable_key
    const [listingRes, parsedRes, rawRes] = await Promise.all([
      restFetch(
        `${tableUrl("mvp_listings")}?select=pid,name,price,sku_id,sku_name,sku_median&pid=eq.${pid}`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,parse_confidence,needs_review&pid=eq.${pid}`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid,thumbnail_url,sale_status,listing_state,last_seen_at,source_query&pid=eq.${pid}`,
        { headers: serviceHeaders() },
      ),
    ]);
    const listing = ((await listingRes.json()) as Array<Record<string, unknown>>)[0];
    const parsed = ((await parsedRes.json()) as Array<Record<string, unknown>>)[0];
    const raw = ((await rawRes.json()) as Array<Record<string, unknown>>)[0];

    if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });

    const comparableKey = (parsed?.comparable_key as string | null) ?? null;
    const skuId = (listing.sku_id as string | null) ?? null;

    // 3. market_price_daily 시세 통계 (comparable_key 기준)
    let marketStats: Record<string, unknown> | null = null;
    if (comparableKey) {
      const statsRes = await restFetch(
        `${tableUrl("mvp_market_price_daily")}?select=comparable_key,blended_median_price,active_median_price,p25_price,p75_price,active_sample_count,sold_sample_count,disappeared_sample_count,confidence,computed_at&comparable_key=eq.${encodeURIComponent(comparableKey)}&order=computed_at.desc&limit=1`,
        { headers: serviceHeaders() },
      );
      const rows = (await statsRes.json()) as Array<Record<string, unknown>>;
      marketStats = rows[0] ?? null;
    }

    // 4. comparable 매물 list — 같은 comparable_key 또는 sku_id 기반 fetch
    // Strategy A: comparable_key 기준 (정확). listing_parsed에서 pid 가져와 raw_listings join.
    let comparables: Comparable[] = [];
    if (comparableKey) {
      const sameKeyPidsRes = await restFetch(
        `${tableUrl("mvp_listing_parsed")}?select=pid&comparable_key=eq.${encodeURIComponent(comparableKey)}&needs_review=eq.false&limit=${MAX_COMPARABLES + 5}`,
        { headers: serviceHeaders() },
      );
      const sameKeyPids = ((await sameKeyPidsRes.json()) as Array<{ pid: number }>)
        .map((r) => Number(r.pid))
        .filter((p) => Number.isFinite(p) && p !== pid)
        .slice(0, MAX_COMPARABLES);
      if (sameKeyPids.length > 0) {
        const rawListRes = await restFetch(
          `${tableUrl("mvp_raw_listings")}?select=pid,name,price,thumbnail_url,sale_status,listing_state,last_seen_at,source_query&pid=in.(${sameKeyPids.join(",")})&order=last_seen_at.desc`,
          { headers: serviceHeaders() },
        );
        const rawRows = (await rawListRes.json()) as Array<Record<string, unknown>>;
        comparables = rawRows.map((row) => ({
          pid: Number(row.pid),
          name: String(row.name ?? ""),
          price: Number(row.price ?? 0),
          thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
          saleStatus: (row.sale_status as string | null) ?? null,
          listingState: (row.listing_state as string | null) ?? null,
          lastSeenAt: (row.last_seen_at as string | null) ?? null,
          sourceQuery: (row.source_query as string | null) ?? null,
          bunjangUrl: `https://m.bunjang.co.kr/products/${Number(row.pid)}`,
        }));
      }
    }

    // 5. fallback — comparable_key 없거나 매물 0개면 sku_id 기준으로
    let comparableSource: "comparable_key" | "sku_id" | "none" = "comparable_key";
    if (comparables.length === 0 && skuId) {
      const skuRawRes = await restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid,name,price,thumbnail_url,sale_status,listing_state,last_seen_at,source_query&sku_id=eq.${encodeURIComponent(skuId)}&pid=not.eq.${pid}&order=last_seen_at.desc&limit=${MAX_COMPARABLES}`,
        { headers: serviceHeaders() },
      );
      const rows = (await skuRawRes.json()) as Array<Record<string, unknown>>;
      comparables = rows.map((row) => ({
        pid: Number(row.pid),
        name: String(row.name ?? ""),
        price: Number(row.price ?? 0),
        thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
        saleStatus: (row.sale_status as string | null) ?? null,
        listingState: (row.listing_state as string | null) ?? null,
        lastSeenAt: (row.last_seen_at as string | null) ?? null,
        sourceQuery: (row.source_query as string | null) ?? null,
        bunjangUrl: `https://m.bunjang.co.kr/products/${Number(row.pid)}`,
      }));
      comparableSource = "sku_id";
    }
    if (comparables.length === 0) comparableSource = "none";

    // 6. 실시간 통계 (현재 fetch한 active 매물 기준)
    const activePrices = comparables
      .filter((c) => c.listingState === "active" && c.price > 0)
      .map((c) => c.price)
      .sort((a, b) => a - b);
    const liveStats = activePrices.length > 0 ? {
      activeCount: activePrices.length,
      min: activePrices[0],
      p25: activePrices[Math.floor(activePrices.length * 0.25)],
      median: activePrices[Math.floor(activePrices.length * 0.5)],
      p75: activePrices[Math.floor(activePrices.length * 0.75)],
      max: activePrices[activePrices.length - 1],
      mean: Math.round(activePrices.reduce((s, p) => s + p, 0) / activePrices.length),
    } : null;

    return NextResponse.json({
      ourListing: {
        pid,
        name: (listing.name as string) ?? "",
        price: Number(listing.price ?? 0),
        skuId,
        skuName: (listing.sku_name as string | null) ?? null,
        skuMedian: Number(listing.sku_median ?? 0),
        comparableKey,
        parseConfidence: Number(parsed?.parse_confidence ?? 0) || null,
        needsReview: Boolean(parsed?.needs_review),
        thumbnailUrl: (raw?.thumbnail_url as string | null) ?? null,
        bunjangUrl: `https://m.bunjang.co.kr/products/${pid}`,
      },
      marketDailyStats: marketStats ? {
        blendedMedian: marketStats.blended_median_price ?? null,
        activeMedian: marketStats.active_median_price ?? null,
        p25: marketStats.p25_price ?? null,
        p75: marketStats.p75_price ?? null,
        activeCount: marketStats.active_sample_count ?? null,
        soldCount: marketStats.sold_sample_count ?? null,
        disappearedCount: marketStats.disappeared_sample_count ?? null,
        confidence: marketStats.confidence ?? null,
        computedAt: marketStats.computed_at ?? null,
      } : null,
      comparableSource,
      comparables,
      liveStats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
