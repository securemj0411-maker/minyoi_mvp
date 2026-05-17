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

type RawListingRow = {
  pid: number;
  name: string;
  price: number;
  thumbnail_url: string | null;
  sku_name: string | null;
  sold_detected_at: string | null;
};

type ParsedRow = {
  pid: number;
  comparable_key: string | null;
  category: string | null;
  // Wave 130 (2026-05-16): condition_class 추가 — landing showcase 시세 매칭에 사용.
  condition_class: string | null;
};

type MarketPriceRow = {
  comparable_key: string;
  // Wave 130: condition_class — PK 일부.
  condition_class: string;
  blended_median_price: number | null;
  active_median_price: number | null;
  sold_median_price: number | null;
  active_sample_count: number;
  sold_sample_count: number;
  disappeared_sample_count: number;
  confidence: "high" | "medium" | "low" | null;
};

type CandidatePoolKpiRow = {
  expected_profit_min: number;
  expected_profit_max: number;
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

function buildConfidencePercent(row: MarketPriceRow) {
  const base =
    row.confidence === "high" ? 76 :
    row.confidence === "medium" ? 66 :
    58;
  const sampleCount =
    Number(row.active_sample_count ?? 0) +
    Number(row.sold_sample_count ?? 0) +
    Number(row.disappeared_sample_count ?? 0);
  const bonus = Math.min(12, Math.floor(sampleCount / 8));
  return clamp(base + bonus, 52, 92);
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
  const rawRes = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid,name,price,thumbnail_url,sku_name,sold_detected_at&listing_state=eq.sold_confirmed&detail_status=eq.done&listing_type=eq.normal&thumbnail_url=not.is.null&sku_name=not.is.null&order=sold_detected_at.desc.nullslast&limit=80`,
    { headers: serviceHeaders() },
  );
  const rawRows = (await rawRes.json()) as RawListingRow[];
  const pids = rawRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  if (pids.length === 0) return [FALLBACK_SHOWCASE];

  const parsedRes = await restFetch(
    // Wave 130 (2026-05-16): condition_class 컬럼 추가 — 매물 condition별 시세 매칭.
    `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,category,condition_class&pid=in.(${pids.join(",")})&comparable_key=not.is.null`,
    { headers: serviceHeaders() },
  );
  const parsedRows = (await parsedRes.json()) as ParsedRow[];
  const parsedByPid = new Map(
    parsedRows
      .filter((row) => row.comparable_key)
      .map((row) => [
        Number(row.pid),
        {
          comparableKey: String(row.comparable_key),
          category: row.category?.trim() || "other",
          // Wave 130 (2026-05-16): condition_class 박음 — landing showcase 시세 매칭에 사용.
          conditionClass: row.condition_class ?? "normal",
        },
      ]),
  );
  const comparableKeys = [...new Set(parsedRows.map((row) => row.comparable_key).filter(Boolean) as string[])];
  if (comparableKeys.length === 0) return [FALLBACK_SHOWCASE];

  const encodedKeys = comparableKeys.map((key) => encodeURIComponent(key)).join(",");
  const marketRes = await restFetch(
    // Wave 130 (2026-05-16): condition_class 별 시세 분리 fetch — 매물 condition에 매칭되는 시세 선택.
    `${tableUrl("mvp_market_price_daily")}?select=comparable_key,condition_class,blended_median_price,active_median_price,sold_median_price,active_sample_count,sold_sample_count,disappeared_sample_count,confidence&comparable_key=in.(${encodedKeys})&order=date.desc,computed_at.desc&limit=${Math.max(200, comparableKeys.length * 12)}`,
    { headers: serviceHeaders() },
  );
  const marketRows = (await marketRes.json()) as MarketPriceRow[];
  // Wave 130: (comparable_key, condition_class) 복합 키로 group.
  const marketByKeyCondition = new Map<string, Map<string, MarketPriceRow>>();
  for (const row of marketRows) {
    if (!row.comparable_key) continue;
    const byCond = marketByKeyCondition.get(row.comparable_key) ?? new Map<string, MarketPriceRow>();
    if (!byCond.has(row.condition_class)) byCond.set(row.condition_class, row);
    marketByKeyCondition.set(row.comparable_key, byCond);
  }

  const showcases: ShowcaseCandidate[] = [];
  const seenKeys = new Set<string>();
  for (const row of rawRows) {
    const parsed = parsedByPid.get(Number(row.pid));
    const comparableKey = parsed?.comparableKey;
    if (!comparableKey || seenKeys.has(comparableKey)) continue;
    // Wave 130: 매물 condition_class 매칭 우선, fallback chain (target → normal → all → first).
    const byCond = marketByKeyCondition.get(comparableKey);
    if (!byCond) continue;
    // Wave 130: 매물 condition_class — parsedByPid에서 lookup (O(1)).
    // Wave 159g (2026-05-17): mint 제거 — flawed/worn 매물이 mint 시세 잘못 잡아 차익 부풀려지는 사고 차단.
    // unopened도 너무 비싸서 fallback 금지 (다나와 새 가격 박힘 위험).
    const conditionClass = parsed?.conditionClass ?? "normal";
    const fallback = [conditionClass, "normal", "all", "clean", "worn"];
    let market: MarketPriceRow | undefined = undefined;
    for (const cls of fallback) {
      const cand = byCond.get(cls);
      if (cand) {
        market = cand;
        break;
      }
    }
    if (!market) continue;
    const marketPrice = Number(market.blended_median_price ?? market.active_median_price ?? market.sold_median_price ?? 0);
    const buyPrice = Number(row.price ?? 0);
    const expectedProfit = marketPrice - buyPrice;
    const sampleCount =
      Number(market.active_sample_count ?? 0) +
      Number(market.sold_sample_count ?? 0) +
      Number(market.disappeared_sample_count ?? 0);
    if (!row.thumbnail_url || marketPrice <= 0 || buyPrice <= 0 || expectedProfit < 10_000 || sampleCount < 8) continue;

    showcases.push({
      pid: Number(row.pid),
      name: row.name,
      imageUrl: row.thumbnail_url,
      buyPrice,
      marketPrice,
      expectedProfit,
      confidencePercent: buildConfidencePercent(market),
      skuLabel: row.sku_name?.trim() || "실거래 기준 상품",
      sampleCount,
      category: parsed?.category || "other",
      comparableKey,
      normalizedSku: normalizeSkuLabel(row.sku_name?.trim() || row.name),
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
