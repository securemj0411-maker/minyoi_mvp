import { NextResponse } from "next/server";
import { isDaangnMarketplaceSource, marketplaceSourceLabel } from "@/lib/marketplace-source";
import { loadSkuImageMap, resolveGenericImage } from "@/lib/sku-images";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PoolSampleRow = {
  pid: number;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
  profit_band: number | null;
  confidence: number | null;
  category: string | null;
  condition_class: string | null;
  comparable_key: string | null;
  raw: {
    pid: number;
    source: string | null;
    name: string | null;
    price: number | null;
    sku_id: string | null;
    sku_name: string | null;
    thumbnail_url: string | null;
    listing_state: string | null;
    daangn_region_name: string | null;
    last_seen_at: string | null;
  } | null;
};

type ListingRow = {
  pid: number;
  sku_median: number | null;
  thumbnail_url: string | null;
  sku_name: string | null;
};

type VelocityRow = {
  comparable_key: string;
  observed_sold_sample_count: number | null;
  sold_7d_count: number | null;
  median_hours_to_sold: number | null;
  confidence: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function regionScore(row: PoolSampleRow, regionQuery: string) {
  const region = String(row.raw?.daangn_region_name ?? "").trim();
  if (!region || !regionQuery) return 0;
  if (region === regionQuery) return 40;
  if (region.includes(regionQuery) || regionQuery.includes(region)) return 26;
  const compactRegion = region.replace(/\s+/g, "");
  const compactQuery = regionQuery.replace(/\s+/g, "");
  if (compactRegion && compactQuery && (compactRegion.includes(compactQuery) || compactQuery.includes(compactRegion))) return 18;
  return 0;
}

function expectedProfit(row: PoolSampleRow) {
  const min = toNumber(row.expected_profit_min);
  const max = toNumber(row.expected_profit_max);
  if (min > 0 && max > 0) return Math.round((min + max) / 2);
  return Math.round(Math.max(min, max));
}

function marketPriceFor(rawPrice: number, listing: ListingRow | undefined, profit: number) {
  const median = toNumber(listing?.sku_median);
  if (median > rawPrice) return Math.round(median);
  return rawPrice + profit;
}

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const regionQuery = (url.searchParams.get("region") ?? "").trim();

  const poolRes = await restFetch(
    `${tableUrl("mvp_candidate_pool")}` +
      "?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key," +
      "raw:mvp_raw_listings!inner(pid,source,name,price,sku_id,sku_name,thumbnail_url,listing_state,daangn_region_name,last_seen_at)" +
      "&status=eq.ready&expected_profit_max=gt.0&raw.source=eq.daangn&raw.listing_state=eq.active" +
      "&order=expected_profit_max.desc&limit=120",
    { headers: serviceHeaders() },
  );
  const rows = ((await poolRes.json()) as PoolSampleRow[])
    .filter((row) => row.raw && isDaangnMarketplaceSource(row.raw.source) && row.raw.listing_state === "active")
    .filter((row) => toNumber(row.raw?.price) > 0 && expectedProfit(row) > 0);

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, item: null });
  }

  const pids = rows.map((row) => row.pid).join(",");
  const listingRes = await restFetch(
    `${tableUrl("mvp_listings")}?select=pid,sku_median,thumbnail_url,sku_name&pid=in.(${pids})`,
    { headers: serviceHeaders() },
  );
  const listings = (await listingRes.json()) as ListingRow[];
  const listingByPid = new Map(listings.map((row) => [Number(row.pid), row]));

  const keys = Array.from(new Set(rows.map((row) => row.comparable_key).filter(Boolean) as string[]));
  const velocityByKey = new Map<string, VelocityRow>();
  if (keys.length > 0) {
    const velocityRes = await restFetch(
      `${tableUrl("mvp_market_velocity_daily")}` +
        `?select=comparable_key,observed_sold_sample_count,sold_7d_count,median_hours_to_sold,confidence&comparable_key=in.(${keys.map(encodeURIComponent).join(",")})` +
        "&condition_class=eq.all&order=date.desc,computed_at.desc,observed_sold_sample_count.desc&limit=180",
      { headers: serviceHeaders() },
    );
    const velocityRows = (await velocityRes.json()) as VelocityRow[];
    for (const row of velocityRows) {
      if (!row.comparable_key || velocityByKey.has(row.comparable_key)) continue;
      velocityByKey.set(row.comparable_key, row);
    }
  }

  const skuImageMap = await loadSkuImageMap();
  const candidates = rows
    .map((row) => {
      const raw = row.raw;
      if (!raw) return null;
      const profit = expectedProfit(row);
      const buyPrice = toNumber(raw.price);
      const listing = listingByPid.get(row.pid);
      const marketPrice = marketPriceFor(buyPrice, listing, profit);
      if (buyPrice <= 0 || marketPrice <= buyPrice || profit <= 0) return null;
      const velocity = row.comparable_key ? velocityByKey.get(row.comparable_key) : undefined;
      const sold7d = toNumber(velocity?.sold_7d_count);
      const sampleCount = toNumber(velocity?.observed_sold_sample_count);
      const medianHours = toNumber(velocity?.median_hours_to_sold);
      return {
        row,
        raw,
        listing,
        velocity,
        score:
          regionScore(row, regionQuery) +
          clamp(profit / 10_000, 0, 18) +
          clamp(sold7d, 0, 14) +
          clamp(sampleCount / 2, 0, 10),
        item: {
          pid: row.pid,
          title: raw.name?.trim() || listing?.sku_name?.trim() || "당근마켓 추천 매물",
          sourceLabel: marketplaceSourceLabel(raw.source),
          regionName: raw.daangn_region_name?.trim() || null,
          buyPrice,
          marketPrice,
          expectedProfit: profit,
          medianDaysToSold: medianHours > 0 ? Math.max(1, Math.round((medianHours / 24) * 10) / 10) : null,
          sold7dCount: sold7d > 0 ? sold7d : null,
          sampleCount: sampleCount > 0 ? sampleCount : null,
          category: row.category?.trim() || "other",
          comparableKey: row.comparable_key,
          genericImageUrl: resolveGenericImage(skuImageMap, raw.sku_name ?? listing?.sku_name ?? null),
          thumbnailUrl: listing?.thumbnail_url ?? raw.thumbnail_url ?? null,
        },
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({
    ok: true,
    item: candidates[0]?.item ?? null,
  });
}
