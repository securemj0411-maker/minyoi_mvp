import { resolveDaangnFullRegion, resolveDaangnShortRegion } from "@/lib/daangn-region-resolver";
import { isDaangnMarketplaceSource, marketplaceSourceLabel } from "@/lib/marketplace-source";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export type MembershipLocalSampleItem = {
  pid: number;
  title: string;
  sourceLabel: string;
  regionName: string | null;
  fullRegionName: string | null;
  districtName: string;
  buyPrice: number;
  marketPrice: number;
  expectedProfit: number;
  profitPct: number | null;
  medianDaysToSold: number | null;
  sold7dCount: number | null;
  sampleCount: number | null;
  category: string;
  comparableKey: string | null;
  genericImageUrl: string | null;
  thumbnailUrl: string | null;
  updatedAt: string;
};

type CacheRow = {
  payload: MembershipLocalSampleItem;
  updated_at: string;
};

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
    daangn_region_id: string | null;
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

const SAMPLE_TARGET_MAX_BUY_PRICE = 150_000;
const SAMPLE_TARGET_MIN_EXPECTED_PROFIT = 50_000;
const SAMPLE_FALLBACK_MAX_BUY_PRICE = 300_000;
const SAMPLE_FALLBACK_MIN_EXPECTED_PROFIT = 10_000;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
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

function districtFromFullRegion(fullRegion: string | null, fallback: string | null) {
  const parts = (fullRegion ?? "").split(/\s+/).filter(Boolean);
  const district = parts.find((part) => /(구|시|군)$/.test(part) && !/특별시|광역시|특례시/.test(part));
  return district ?? fallback?.trim() ?? "전국";
}

function regionKeyFromFullRegion(fullRegion: string | null) {
  const first = (fullRegion ?? "").split(/\s+/).filter(Boolean)[0] ?? "";
  if (first.includes("서울")) return "seoul";
  if (first.includes("경기")) return "gyeonggi";
  if (first.includes("인천")) return "incheon";
  if (first.includes("부산")) return "busan";
  if (first.includes("대구")) return "daegu";
  if (first.includes("대전")) return "daejeon";
  if (first.includes("광주")) return "gwangju";
  if (first.includes("울산")) return "ulsan";
  if (first.includes("세종")) return "sejong";
  if (first.includes("강원")) return "gangwon";
  if (first.includes("충청북") || first.includes("충북")) return "chungbuk";
  if (first.includes("충청남") || first.includes("충남")) return "chungnam";
  if (first.includes("전북") || first.includes("전라북")) return "jeonbuk";
  if (first.includes("전라남") || first.includes("전남")) return "jeonnam";
  if (first.includes("경상북") || first.includes("경북")) return "gyeongbuk";
  if (first.includes("경상남") || first.includes("경남")) return "gyeongnam";
  if (first.includes("제주")) return "jeju";
  return null;
}

function candidateScore(input: {
  profit: number;
  buyPrice: number;
  sold7d: number;
  sampleCount: number;
  medianDays: number | null;
  targetHit: boolean;
}) {
  const accessiblePriceBonus = input.buyPrice <= 100_000 ? 24 : input.buyPrice <= 150_000 ? 18 : 4;
  const velocityBonus = input.medianDays ? clamp(12 - input.medianDays, 0, 12) : 0;
  return (
    (input.targetHit ? 100 : 0) +
    clamp(input.profit / 10_000, 0, 24) +
    accessiblePriceBonus +
    clamp(input.sold7d, 0, 18) +
    clamp(input.sampleCount / 2, 0, 12) +
    velocityBonus
  );
}

export async function readMembershipLocalSample(districtName: string): Promise<MembershipLocalSampleItem | null> {
  const encoded = encodeURIComponent(districtName);
  const exactRes = await restFetch(
    `${tableUrl("mvp_membership_local_samples")}?select=payload,updated_at&is_active=eq.true&district_name=eq.${encoded}&order=slot_index.asc,updated_at.desc&limit=1`,
    { headers: serviceHeaders() },
  );
  const exactRows = (await exactRes.json()) as CacheRow[];
  if (exactRows[0]?.payload) return exactRows[0].payload;

  return null;
}

export async function refreshMembershipLocalSampleCache() {
  const poolRes = await restFetch(
    `${tableUrl("mvp_candidate_pool")}` +
      "?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key," +
      "raw:mvp_raw_listings!inner(pid,source,name,price,sku_id,sku_name,thumbnail_url,listing_state,daangn_region_id,daangn_region_name,last_seen_at)" +
      `&status=eq.ready&expected_profit_max=gte.${SAMPLE_FALLBACK_MIN_EXPECTED_PROFIT}&raw.price=lte.${SAMPLE_FALLBACK_MAX_BUY_PRICE}&raw.source=eq.daangn&raw.listing_state=eq.active` +
      "&order=expected_profit_max.desc&limit=3000",
    { headers: serviceHeaders() },
  );
  const rows = ((await poolRes.json()) as PoolSampleRow[])
    .filter((row) => row.raw && isDaangnMarketplaceSource(row.raw.source) && row.raw.listing_state === "active")
    .filter((row) => toNumber(row.raw?.price) > 0 && expectedProfit(row) > 0);

  if (rows.length === 0) return { count: 0, districtCount: 0 };

  const listings: ListingRow[] = [];
  for (const pidChunk of chunks(rows.map((row) => row.pid), 180)) {
    const listingRes = await restFetch(
      `${tableUrl("mvp_listings")}?select=pid,sku_median,thumbnail_url,sku_name&pid=in.(${pidChunk.join(",")})`,
      { headers: serviceHeaders() },
    );
    listings.push(...((await listingRes.json()) as ListingRow[]));
  }
  const listingByPid = new Map(listings.map((row) => [Number(row.pid), row]));

  const keys = Array.from(new Set(rows.map((row) => row.comparable_key).filter(Boolean) as string[]));
  const velocityByKey = new Map<string, VelocityRow>();
  if (keys.length > 0) {
    for (const keyChunk of chunks(keys, 70)) {
      const velocityRes = await restFetch(
        `${tableUrl("mvp_market_velocity_daily")}` +
          `?select=comparable_key,observed_sold_sample_count,sold_7d_count,median_hours_to_sold,confidence&comparable_key=in.(${keyChunk.map(encodeURIComponent).join(",")})` +
          "&condition_class=eq.all&order=date.desc,computed_at.desc,observed_sold_sample_count.desc&limit=700",
        { headers: serviceHeaders() },
      );
      const velocityRows = (await velocityRes.json()) as VelocityRow[];
      for (const row of velocityRows) {
        if (!row.comparable_key || velocityByKey.has(row.comparable_key)) continue;
        velocityByKey.set(row.comparable_key, row);
      }
    }
  }

  const bestByDistrict = new Map<string, { score: number; regionKey: string | null; item: MembershipLocalSampleItem }>();
  const now = new Date().toISOString();
  for (const row of rows) {
    const raw = row.raw;
    if (!raw) continue;
    const buyPrice = toNumber(raw.price);
    const profit = expectedProfit(row);
    if (buyPrice > SAMPLE_FALLBACK_MAX_BUY_PRICE || profit < SAMPLE_FALLBACK_MIN_EXPECTED_PROFIT) continue;
    const targetHit = buyPrice <= SAMPLE_TARGET_MAX_BUY_PRICE && profit >= SAMPLE_TARGET_MIN_EXPECTED_PROFIT;
    const listing = listingByPid.get(row.pid);
    const marketPrice = marketPriceFor(buyPrice, listing, profit);
    if (buyPrice <= 0 || profit <= 0 || marketPrice <= buyPrice) continue;
    const velocity = row.comparable_key ? velocityByKey.get(row.comparable_key) : undefined;
    const sold7d = toNumber(velocity?.sold_7d_count);
    const sampleCount = toNumber(velocity?.observed_sold_sample_count);
    const medianHours = toNumber(velocity?.median_hours_to_sold);
    const medianDays = medianHours > 0 ? Math.max(1, Math.round((medianHours / 24) * 10) / 10) : null;
    const fullRegion = resolveDaangnFullRegion(raw.daangn_region_id, raw.daangn_region_name);
    const shortRegion = resolveDaangnShortRegion(raw.daangn_region_id, raw.daangn_region_name) ?? raw.daangn_region_name ?? null;
    const districtName = districtFromFullRegion(fullRegion, raw.daangn_region_name);
    const regionKey = regionKeyFromFullRegion(fullRegion);
    const score = candidateScore({ profit, buyPrice, sold7d, sampleCount, medianDays, targetHit });
    const previous = bestByDistrict.get(districtName);
    if (previous && previous.score >= score) continue;
    const item: MembershipLocalSampleItem = {
      pid: row.pid,
      title: raw.name?.trim() || listing?.sku_name?.trim() || "당근마켓 추천 매물",
      sourceLabel: marketplaceSourceLabel(raw.source),
      regionName: shortRegion,
      fullRegionName: fullRegion,
      districtName,
      buyPrice,
      marketPrice,
      expectedProfit: profit,
      profitPct: buyPrice > 0 ? Math.round((profit / buyPrice) * 100) : null,
      medianDaysToSold: medianDays,
      sold7dCount: sold7d > 0 ? sold7d : null,
      sampleCount: sampleCount > 0 ? sampleCount : null,
      category: row.category?.trim() || "other",
      comparableKey: row.comparable_key,
      genericImageUrl: null,
      thumbnailUrl: listing?.thumbnail_url ?? raw.thumbnail_url ?? null,
      updatedAt: now,
    };
    bestByDistrict.set(districtName, { score, regionKey, item });
  }

  const payload = Array.from(bestByDistrict.entries()).map(([districtName, value]) => ({
    district_name: districtName,
    region_key: value.regionKey,
    slot_index: 1,
    payload: value.item,
    is_active: true,
    updated_at: now,
    source_snapshot: {
      pid: value.item.pid,
      title: value.item.title,
      buyPrice: value.item.buyPrice,
      marketPrice: value.item.marketPrice,
      expectedProfit: value.item.expectedProfit,
      targetHit:
        value.item.buyPrice <= SAMPLE_TARGET_MAX_BUY_PRICE &&
        value.item.expectedProfit >= SAMPLE_TARGET_MIN_EXPECTED_PROFIT,
      fullRegionName: value.item.fullRegionName,
    },
  }));

  await restFetch(`${tableUrl("mvp_membership_local_samples")}?id=gt.0`, {
    method: "DELETE",
    headers: serviceHeaders(),
  });

  if (payload.length > 0) {
    await restFetch(`${tableUrl("mvp_membership_local_samples")}`, {
      method: "POST",
      headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
      body: jsonBody(payload),
    });
  }

  return { count: payload.length, districtCount: bestByDistrict.size };
}
