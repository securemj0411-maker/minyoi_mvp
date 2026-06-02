import { unstable_cache } from "next/cache";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const LANDING_SHOWCASE_LIMIT = 10;

export type LandingShowcase = {
  pid: number;
  name: string;
  imageUrl: string;
  buyPrice: number;
  marketPrice: number;
  expectedProfit: number;
  confidencePercent: number;
  skuLabel: string;
  sampleCount: number;
};

export type LandingKpis = {
  averageProfit: number;
  maxProfit: number;
  poolCount: number;
};

type LandingShowcaseRow = {
  pid: number;
  slot_index: number;
  name: string;
  image_url: string;
  buy_price: number;
  market_price: number;
  expected_profit: number;
  confidence_percent: number;
  sku_label: string | null;
  sample_count: number;
};

type CandidatePoolKpiRow = {
  expected_profit_min: number;
  expected_profit_max: number;
};

type ReadyPoolShowcaseRow = {
  pid: number;
  expected_profit_min: number;
  expected_profit_max: number;
  confidence: number | null;
  category: string | null;
  comparable_key: string | null;
};

type ReadyListingShowcaseRow = {
  pid: number;
  name: string;
  price: number;
  sku_median: number | null;
  thumbnail_url: string | null;
  sku_name: string | null;
};

type ReadyRawStateRow = {
  pid: number;
  listing_state: string | null;
};

type ShowcaseCandidate = LandingShowcase & {
  category: string;
  comparableKey: string;
  normalizedSku: string;
};

const FALLBACK_SHOWCASE: LandingShowcase = {
  pid: 398329344,
  name: "새상품 단순개봉 에어팟 맥스 퍼플",
  imageUrl: "/landing/airpods-max-purple.webp",
  buyPrice: 400_000,
  marketPrice: 452_000,
  expectedProfit: 74_000,
  confidencePercent: 70,
  skuLabel: "AirPods Max · USB-C · 전체 본품",
  sampleCount: 131,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeSkuLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[·,()[\]{}]/g, " ")
    .trim();
}

function toShowcase(row: LandingShowcaseRow): LandingShowcase {
  return {
    pid: Number(row.pid),
    name: row.name,
    imageUrl: row.image_url,
    buyPrice: Number(row.buy_price ?? 0),
    marketPrice: Number(row.market_price ?? 0),
    expectedProfit: Number(row.expected_profit ?? 0),
    confidencePercent: Number(row.confidence_percent ?? 0),
    skuLabel: row.sku_label?.trim() || "실거래 기준 상품",
    sampleCount: Number(row.sample_count ?? 0),
  };
}

function diversifyCandidates(candidates: ShowcaseCandidate[], limit: number): LandingShowcase[] {
  const groups = new Map<string, ShowcaseCandidate[]>();
  for (const candidate of candidates) {
    const key = candidate.category || "other";
    const bucket = groups.get(key) ?? [];
    bucket.push(candidate);
    groups.set(key, bucket);
  }

  for (const bucket of groups.values()) {
    bucket.sort((a, b) => b.expectedProfit - a.expectedProfit || b.marketPrice - a.marketPrice);
  }

  const orderedCategories = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([category]) => category);

  const picked: ShowcaseCandidate[] = [];
  const seenSku = new Set<string>();

  let advanced = true;
  while (picked.length < limit && advanced) {
    advanced = false;
    for (const category of orderedCategories) {
      const bucket = groups.get(category);
      if (!bucket?.length) continue;
      const nextUniqueIdx = bucket.findIndex((item) => !seenSku.has(item.normalizedSku));
      if (nextUniqueIdx === -1) continue;
      const [next] = bucket.splice(nextUniqueIdx, 1);
      picked.push(next);
      seenSku.add(next.normalizedSku);
      advanced = true;
      if (picked.length >= limit) break;
    }
  }

  if (picked.length < limit) {
    const remainder = [...groups.values()].flat();
    remainder.sort((a, b) => b.expectedProfit - a.expectedProfit || b.marketPrice - a.marketPrice);
    for (const candidate of remainder) {
      picked.push(candidate);
      if (picked.length >= limit) break;
    }
  }

  return picked.slice(0, limit).map((candidate) => ({
    pid: candidate.pid,
    name: candidate.name,
    imageUrl: candidate.imageUrl,
    buyPrice: candidate.buyPrice,
    marketPrice: candidate.marketPrice,
    expectedProfit: candidate.expectedProfit,
    confidencePercent: candidate.confidencePercent,
    skuLabel: candidate.skuLabel,
    sampleCount: candidate.sampleCount,
  }));
}

async function loadFromLandingCacheTable(): Promise<LandingShowcase[]> {
  try {
    const res = await restFetch(
      `${tableUrl("mvp_landing_showcases")}?select=pid,slot_index,name,image_url,buy_price,market_price,expected_profit,confidence_percent,sku_label,sample_count&is_active=eq.true&order=slot_index.asc,updated_at.desc&limit=${LANDING_SHOWCASE_LIMIT}`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as LandingShowcaseRow[];
    return rows.map(toShowcase).filter((row) => row.imageUrl && row.expectedProfit > 0);
  } catch {
    return [];
  }
}

async function loadLiveSoldShowcases(limit: number): Promise<LandingShowcase[]> {
  const poolRes = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,confidence,category,comparable_key&status=eq.ready&expected_profit_max=gt.0&order=expected_profit_max.desc&limit=${Math.max(80, limit * 12)}`,
    { headers: serviceHeaders() },
  );
  const poolRows = (await poolRes.json()) as ReadyPoolShowcaseRow[];
  const pids = poolRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  if (pids.length === 0) return [FALLBACK_SHOWCASE];

  const encodedPids = pids.join(",");
  const [listingRes, rawStateRes] = await Promise.all([
    restFetch(
      `${tableUrl("mvp_listings")}?select=pid,name,price,sku_median,thumbnail_url,sku_name&pid=in.(${encodedPids})`,
      { headers: serviceHeaders() },
    ),
    restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,listing_state&pid=in.(${encodedPids})`,
      { headers: serviceHeaders() },
    ),
  ]);
  const listingRows = (await listingRes.json()) as ReadyListingShowcaseRow[];
  const rawStateRows = (await rawStateRes.json()) as ReadyRawStateRow[];
  const listingByPid = new Map(listingRows.map((row) => [Number(row.pid), row]));
  const stateByPid = new Map(rawStateRows.map((row) => [Number(row.pid), row.listing_state]));

  const showcases: ShowcaseCandidate[] = [];
  const seenKeys = new Set<string>();
  for (const pool of poolRows) {
    const pid = Number(pool.pid);
    if (stateByPid.get(pid) !== "active") continue;
    const listing = listingByPid.get(pid);
    if (!listing?.thumbnail_url) continue;
    const comparableKey = pool.comparable_key?.trim() || `pid:${pid}`;
    if (seenKeys.has(comparableKey)) continue;

    const buyPrice = Number(listing.price ?? 0);
    const expectedProfit = Math.round((Number(pool.expected_profit_min ?? 0) + Number(pool.expected_profit_max ?? 0)) / 2);
    const marketPrice = Number(listing.sku_median ?? 0) > 0 ? Number(listing.sku_median) : buyPrice + expectedProfit;
    if (marketPrice <= 0 || buyPrice <= 0 || expectedProfit < 10_000) continue;

    showcases.push({
      pid,
      name: listing.name,
      imageUrl: listing.thumbnail_url,
      buyPrice,
      marketPrice,
      expectedProfit,
      confidencePercent: clamp(Math.round(Number(pool.confidence ?? 0.6) * 100), 52, 92),
      skuLabel: listing.sku_name?.trim() || "현재 추천 풀 상품",
      sampleCount: 0,
      category: pool.category?.trim() || "other",
      comparableKey,
      normalizedSku: normalizeSkuLabel(listing.sku_name?.trim() || listing.name),
    });
    seenKeys.add(comparableKey);
  }

  const sorted = showcases.sort((a, b) => b.expectedProfit - a.expectedProfit || b.marketPrice - a.marketPrice);
  const diversified = diversifyCandidates(sorted, limit);

  return diversified.length ? diversified : [FALLBACK_SHOWCASE];
}

const loadFallbackShowcasesCached = unstable_cache(
  async () => loadLiveSoldShowcases(LANDING_SHOWCASE_LIMIT),
  ["landing-showcases-live-fallback"],
  { revalidate: 3600 },
);

const loadLandingKpisCached = unstable_cache(
  async (): Promise<LandingKpis> => {
    const res = await restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=expected_profit_min,expected_profit_max&status=eq.ready&order=expected_profit_max.desc&limit=5000`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as CandidatePoolKpiRow[];
    if (rows.length === 0) {
      return {
        averageProfit: FALLBACK_SHOWCASE.expectedProfit,
        maxProfit: FALLBACK_SHOWCASE.expectedProfit,
        poolCount: 0,
      };
    }

    // Wave 64: trimmed mean (상하 10% 절사) — outlier (한두 개 고가 카메라/GPU)가
    // 평균 왜곡시키는 문제 해결. 라벨은 "평균"으로 유지.
    const midpoints = rows
      .map((row) => (Number(row.expected_profit_min ?? 0) + Number(row.expected_profit_max ?? 0)) / 2)
      .sort((a, b) => a - b);
    const trimCount = Math.floor(midpoints.length * 0.1);
    const trimmed = midpoints.slice(trimCount, midpoints.length - trimCount);
    const averageProfit = trimmed.length > 0
      ? trimmed.reduce((sum, v) => sum + v, 0) / trimmed.length
      : midpoints.reduce((sum, v) => sum + v, 0) / midpoints.length;
    const maxProfit = rows.reduce((max, row) => Math.max(max, Number(row.expected_profit_max ?? 0)), 0);

    return {
      averageProfit,
      maxProfit,
      poolCount: rows.length,
    };
  },
  ["landing-kpis-ready-pool"],
  { revalidate: 10_800 },
);

export async function getLandingShowcases() {
  const cachedRows = await loadFromLandingCacheTable();
  if (cachedRows.length >= 3) return cachedRows.slice(0, LANDING_SHOWCASE_LIMIT);
  try {
    const liveRows = await loadFallbackShowcasesCached();
    return liveRows.slice(0, LANDING_SHOWCASE_LIMIT);
  } catch {
    return [FALLBACK_SHOWCASE];
  }
}

export async function getLandingKpis() {
  try {
    return await loadLandingKpisCached();
  } catch {
    return {
      averageProfit: FALLBACK_SHOWCASE.expectedProfit,
      maxProfit: FALLBACK_SHOWCASE.expectedProfit,
      poolCount: 0,
    };
  }
}

export async function refreshLandingShowcaseCache() {
  const rows = await loadLiveSoldShowcases(LANDING_SHOWCASE_LIMIT);
  const payload = rows.map((row, index) => ({
    pid: row.pid,
    slot_index: index + 1,
    name: row.name,
    image_url: row.imageUrl,
    buy_price: row.buyPrice,
    market_price: row.marketPrice,
    expected_profit: row.expectedProfit,
    confidence_percent: row.confidencePercent,
    sku_label: row.skuLabel,
    sample_count: row.sampleCount,
    is_active: true,
    updated_at: new Date().toISOString(),
    source_snapshot: {
      pid: row.pid,
      expectedProfit: row.expectedProfit,
      marketPrice: row.marketPrice,
      buyPrice: row.buyPrice,
    },
  }));

  await restFetch(`${tableUrl("mvp_landing_showcases")}?id=gt.0`, {
    method: "DELETE",
    headers: serviceHeaders(),
  });

  await restFetch(`${tableUrl("mvp_landing_showcases")}`, {
    method: "POST",
    headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
    body: jsonBody(payload),
  });

  return payload.length;
}
