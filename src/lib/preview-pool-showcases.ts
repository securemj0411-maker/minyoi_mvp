import { pickByConditionFallback } from "@/lib/condition-fallback";
import { teaserBudgetRangeLabel, teaserProfitLabel } from "@/lib/feed-price-display";
import { isDaangnMarketplaceSource, normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

// 2026-05-17: 비로그인 사용자용 마스킹 매물 preview API.
// 메인 페이지 / 진입 시 즉시 가치 인식 — "와 이게 돈 되는 거구나".
//
// 정책:
// - 카테고리 다양화 5개 (애플 편향 차단 — smartphone/watch/airpods/laptop/etc 1개씩)
// - 이미 지나간 샘플은 실제 제목/사진/매입/시세를 보여줘서 acquisition hook 을 살린다.
// - pid / source / 원본 링크 / 진행 중 매물 접근은 로그인 후로 유지한다.
// - 번개 API 검증 skip (비로그인 = 식별 X, 검증 비용 0)
// - Wave 1039: request-time 계산 금지. cron 이 mvp_preview_showcases 에 미리 구운 payload 만 공개 API가 읽는다.

const PREVIEW_POOL_CACHE_LIMIT = 5;
// 2026-05-17: 진입장벽 ↓ — 가격 tier 분리.
// tier A: 10만 이하 2개 (저렴한 hook — "와 진짜 싼 매물도 있네")
// tier B: 30만 이하 3개 (실제 매물 분위기)
// Wave launch-111 (2026-05-24): 사용자 정정 — 5개 다 15만원 이하로 (tier B 300k → 150k).
//   비로그인 신규 진입자 부담 ↓. 진짜 진입가 낮춤.
const TIER_A_MAX_KRW = 100_000;
const TIER_A_COUNT = 2;
const TIER_B_MAX_KRW = 150_000;
const TIER_B_COUNT = 3;
const PREVIEW_POOL_SCAN_LIMIT = 500;
const PREVIEW_MARKET_SCAN_LIMIT = 160;
const MIN_PREVIEW_MARKET_GAP = 10_000;
const HIGH_PROFIT_ELECTRONICS_ROI = 0.4;
const HIGH_PROFIT_WEAK_SIGNAL_ROI = 0.45;
const HIGH_PROFIT_DEFAULT_ROI = 0.6;
const HIGH_PROFIT_MARKETPLACE_VARIANCE_ROI = 0.7;
const HIGH_PROFIT_ELECTRONICS_CATEGORIES = new Set([
  "earphone",
  "smartwatch",
  "smartphone",
  "tablet",
  "laptop",
  "monitor",
  "speaker",
  "camera",
  "game_console",
  "desktop",
  "home_appliance",
  "small_appliance",
  "watch",
  "drone",
  "kickboard",
]);
const HIGH_PROFIT_MARKETPLACE_VARIANCE_CATEGORIES = new Set([
  "shoe",
  "bag",
  "clothing",
  "perfume",
  "sport_golf",
  "bike",
]);

// 2026-05-17: 매물명 마스킹 강화 — 사용자 보안 우려.
// Wave launch-111 (2026-05-24): 별표 *** 마스킹 폐기 → 카테고리 친화 라벨.
//   배경: "갤** S** 울**" 같은 별표 노출이 사용자한테 더러워 보임. 사용자 정정 ("이어폰/헤드폰
//   스마트폰" 같이 카테고리만 표시). 정확한 모델/제목은 가입 후만 노출 (가입 incentive 유지).
const CATEGORY_FRIENDLY_LABEL: Record<string, string> = {
  bag: "가방",
  bike: "자전거",
  both: "기타",
  camera: "카메라",
  clothing: "의류",
  desktop: "데스크탑",
  drone: "드론",
  earphone: "이어폰",
  game_console: "게임기",
  headphone: "헤드폰",
  home_appliance: "생활가전",
  kickboard: "킥보드",
  laptop: "노트북",
  lego: "레고",
  monitor: "모니터",
  perfume: "향수",
  shoe: "신발",
  smartphone: "스마트폰",
  smartwatch: "스마트워치",
  speaker: "스피커",
  sport_golf: "골프",
  tablet: "태블릿",
  watch: "시계",
};
function categoryFriendlyLabel(category: string | null): string {
  if (!category) return "중고 상품";
  return CATEGORY_FRIENDLY_LABEL[category] ?? "중고 상품";
}

function relativeDiscountLabel(price: number | null | undefined, marketPrice: number | null | undefined) {
  const buy = Number(price ?? 0);
  const market = Number(marketPrice ?? 0);
  if (!Number.isFinite(buy) || buy <= 0 || !Number.isFinite(market) || market <= 0 || buy >= market) {
    return "시세 비교 완료";
  }
  const discount = Math.max(1, Math.round(((market - buy) / market) * 100));
  const rounded = discount >= 10 ? Math.round(discount / 5) * 5 : discount;
  return `시세보다 약 ${rounded}% 낮음`;
}

type PoolRow = {
  pid: number;
  expected_profit_min: number;
  expected_profit_max: number;
  profit_band: number;
  confidence: number | null;
  category: string | null;
  condition_class: string | null;
  comparable_key: string | null;
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
  source: string | null;
  seller_source: string | null;
  listing_state: string | null;
  sku_id: string | null;
  free_shipping: boolean | null;
  last_seen_at: string | null;
  shop_review_rating: number | null;
  shop_review_count: number | null;
};

type ParsedRow = {
  pid: number;
  condition_class: string | null;
  condition_tier: string | null;
};

type MarketPriceRow = {
  comparable_key: string;
  condition_class: string | null;
  condition_tier: string | null;
  source?: string | null;
  blended_median_price: number | null;
  active_median_price: number | null;
  sold_median_price: number | null;
  active_sample_count: number | null;
  sold_sample_count: number | null;
  disappeared_sample_count: number | null;
  date: string;
  computed_at: string | null;
};

type VelocityRow = {
  comparable_key: string;
  observed_sold_sample_count: number | null;
  sold_7d_count: number | null;
  confidence: string | null;
  median_hours_to_sold: number | null;
  date: string;
  computed_at: string | null;
};

type VelocitySignal = {
  medianHoursToSold: number;
  observedSoldSampleCount: number;
  sold7dCount: number;
  confidence: string | null;
};

export type PreviewPoolItem = {
  slot: number;
  name: string;
  thumbnailUrl: string | null;
  previewTitle: string;
  profitLabel: string;
  budgetLabel: string;
  priceSignalLabel: string;
  maskedName: string;
  blurredImage: string | null;
  category: string;
  conditionClass: string | null;
  conditionTier: string | null;
  price: number;
  skuMedian: number | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  profitBand: number;
  confidence: "high" | "medium" | "low";
  freeShipping: boolean;
  isFresh: boolean;
  sellerReviewRating: number | null;
  sellerReviewCount: number | null;
  soldSampleCount: number | null;
  medianHoursToSold: number | null;
};

type PreviewShowcaseCacheRow = {
  slot_index: number;
  payload: PreviewPoolItem;
  updated_at: string | null;
};

function marketPriceFromRow(row: MarketPriceRow | undefined): number | null {
  if (!row) return null;
  const value = Number(row.blended_median_price ?? row.active_median_price ?? row.sold_median_price ?? 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function buildMarketByKeyCondition(rows: MarketPriceRow[]) {
  const byKey = new Map<string, Map<string, MarketPriceRow>>();
  for (const row of rows) {
    if (!row.comparable_key) continue;
    const condition = `${(row.condition_tier ?? "").trim()}|${(row.condition_class ?? "").trim()}`;
    const byCondition = byKey.get(row.comparable_key) ?? new Map<string, MarketPriceRow>();
    // Query is ordered newest first, so the first row per key/condition wins.
    if (!byCondition.has(condition)) byCondition.set(condition, row);
    byKey.set(row.comparable_key, byCondition);
  }
  return byKey;
}

function buildSourceMarketByKeyCondition(rows: MarketPriceRow[]) {
  const byKey = new Map<string, Map<string, Map<string, MarketPriceRow>>>();
  for (const row of rows) {
    if (!row.comparable_key || !row.source) continue;
    const source = normalizeMarketplaceSource(row.source);
    const bySource = byKey.get(row.comparable_key) ?? new Map<string, Map<string, MarketPriceRow>>();
    const byCondition = bySource.get(source) ?? new Map<string, MarketPriceRow>();
    const condition = `${(row.condition_tier ?? "").trim()}|${(row.condition_class ?? "").trim()}`;
    if (!byCondition.has(condition)) byCondition.set(condition, row);
    bySource.set(source, byCondition);
    byKey.set(row.comparable_key, bySource);
  }
  return byKey;
}

function marketPriceForPoolRow(
  row: PoolRow,
  raw: RawRow | undefined,
  meta: RawListingMeta | undefined,
  parsed: ParsedRow | undefined,
  marketByKeyCondition: Map<string, Map<string, MarketPriceRow>>,
  sourceMarketByKeyCondition: Map<string, Map<string, Map<string, MarketPriceRow>>>,
): number | null {
  const conditionClass = parsed?.condition_class ?? row.condition_class ?? "normal";
  const conditionTier = parsed?.condition_tier ?? null;
  const source = meta ? normalizeMarketplaceSource(meta.source ?? meta.seller_source) : null;
  if (row.comparable_key) {
    if (source) {
      const byCondition = sourceMarketByKeyCondition.get(row.comparable_key)?.get(source);
      const picked = pickByConditionFallback(
        byCondition,
        conditionClass,
        (r) => Number(r.active_sample_count ?? 0) + Number(r.sold_sample_count ?? 0),
        1,
        conditionTier,
      );
      const sourceSampleCount = picked.row
        ? Number(picked.row.active_sample_count ?? 0) + Number(picked.row.sold_sample_count ?? 0)
        : 0;
      if (picked.row && sourceSampleCount >= 3 && !(isDaangnMarketplaceSource(source) && picked.fallbackUsed)) {
        const price = marketPriceFromRow(picked.row);
        if (price != null) return price;
      }
      if (isDaangnMarketplaceSource(source)) return null;
    }
    const byCondition = marketByKeyCondition.get(row.comparable_key);
    if (byCondition) {
      const picked = pickByConditionFallback(
        byCondition,
        conditionClass,
        (r) => Number(r.active_sample_count ?? 0) + Number(r.sold_sample_count ?? 0) + Number(r.disappeared_sample_count ?? 0),
        1,
        conditionTier,
      );
      const price = marketPriceFromRow(picked.row);
      if (price != null) return price;
    }
  }

  const fallback = Number(raw?.sku_median ?? 0);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
}

function previewMarketGap(
  row: PoolRow,
  raw: RawRow | undefined,
  meta: RawListingMeta | undefined,
  parsed: ParsedRow | undefined,
  marketByKeyCondition: Map<string, Map<string, MarketPriceRow>>,
  sourceMarketByKeyCondition: Map<string, Map<string, Map<string, MarketPriceRow>>>,
): number | null {
  const buyPrice = Number(raw?.price ?? 0);
  const marketPrice = marketPriceForPoolRow(row, raw, meta, parsed, marketByKeyCondition, sourceMarketByKeyCondition);
  if (!Number.isFinite(buyPrice) || buyPrice <= 0 || marketPrice == null) return null;
  const gap = marketPrice - buyPrice;
  return Number.isFinite(gap) && gap > 0 ? gap : null;
}

function previewProfitRoi(
  row: PoolRow,
  raw: RawRow | undefined,
  meta: RawListingMeta | undefined,
  parsed: ParsedRow | undefined,
  marketByKeyCondition: Map<string, Map<string, MarketPriceRow>>,
  sourceMarketByKeyCondition: Map<string, Map<string, Map<string, MarketPriceRow>>>,
): number | null {
  const buyBase = Math.max(Number(raw?.price ?? 0), 1);
  const marketGap = previewMarketGap(row, raw, meta, parsed, marketByKeyCondition, sourceMarketByKeyCondition);
  if (!Number.isFinite(buyBase) || marketGap == null || marketGap <= 0) return null;
  const roi = marketGap / buyBase;
  return Number.isFinite(roi) ? roi : null;
}

function velocitySignalFromRow(row: VelocityRow | undefined): VelocitySignal | null {
  if (!row) return null;
  const medianHours = Number(row.median_hours_to_sold ?? 0);
  const sold7d = Number(row.sold_7d_count ?? 0);
  const soldSample = Number(row.observed_sold_sample_count ?? 0);
  if (!Number.isFinite(medianHours) || medianHours <= 0) return null;
  if (sold7d <= 0 || soldSample < 3) return null;
  return {
    medianHoursToSold: medianHours,
    observedSoldSampleCount: soldSample,
    sold7dCount: sold7d,
    confidence: typeof row.confidence === "string" ? row.confidence : null,
  };
}

function isPreviewHighProfitAnomaly(
  row: PoolRow,
  raw: RawRow | undefined,
  meta: RawListingMeta | undefined,
  parsed: ParsedRow | undefined,
  marketByKeyCondition: Map<string, Map<string, MarketPriceRow>>,
  sourceMarketByKeyCondition: Map<string, Map<string, Map<string, MarketPriceRow>>>,
): boolean {
  const roi = previewProfitRoi(row, raw, meta, parsed, marketByKeyCondition, sourceMarketByKeyCondition);
  if (roi == null || roi < HIGH_PROFIT_ELECTRONICS_ROI) return false;

  const category = row.category ?? "";
  if (HIGH_PROFIT_ELECTRONICS_CATEGORIES.has(category) && roi >= HIGH_PROFIT_ELECTRONICS_ROI) return true;

  const weakSignals =
    row.confidence == null ||
    Number(row.confidence) < 0.85 ||
    !row.condition_class ||
    row.comparable_key?.split("|").includes("unknown_condition");
  if (weakSignals && roi >= HIGH_PROFIT_WEAK_SIGNAL_ROI) return true;

  const threshold = HIGH_PROFIT_MARKETPLACE_VARIANCE_CATEGORIES.has(category)
    ? HIGH_PROFIT_MARKETPLACE_VARIANCE_ROI
    : HIGH_PROFIT_DEFAULT_ROI;
  return roi >= threshold;
}

export async function buildPreviewPoolItems(): Promise<PreviewPoolItem[]> {
  try {
    const headers = serviceHeaders();

    // Wave 1021 (2026-06-02): raw_listings sold_detected_at full scan avoidance.
    // Old flow scanned raw sold/disappeared rows first and timed out on PostgREST.
    // Start from recently invalidated positive-profit pool rows, then confirm sold state by pid.
    // Public samples remain non-live examples, but the expensive broad raw scan is gone.
    const sinceIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const poolRes = await restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min,expected_profit_max,profit_band,confidence,category,condition_class,comparable_key&status=eq.invalidated&expected_profit_max=gt.0&updated_at=gte.${encodeURIComponent(sinceIso)}&order=updated_at.desc,expected_profit_max.desc&limit=${PREVIEW_POOL_SCAN_LIMIT}`,
      { headers },
    );
    const pool = (await poolRes.json()) as PoolRow[];

    if (pool.length === 0) {
      return [];
    }

    // 매물 정보 fetch — 30만 이하 만 (tier B max). pool 전체 join.
    const poolPids = pool.map((r) => r.pid);
    const [rawRes, rawListingRes] = await Promise.all([
      restFetch(
        `${tableUrl("mvp_listings")}?select=pid,name,price,sku_median,thumbnail_url&pid=in.(${poolPids.join(",")})&price=lte.${TIER_B_MAX_KRW}`,
        { headers },
      ),
      restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid,source,seller_source,listing_state,sku_id,free_shipping,last_seen_at,shop_review_rating,shop_review_count&pid=in.(${poolPids.join(",")})&listing_state=in.(sold_confirmed,disappeared)`,
        { headers },
      ),
    ]);
    const raws = (await rawRes.json()) as RawRow[];
    const rawListings = (await rawListingRes.json()) as RawListingMeta[];
    const rawByPid = new Map<number, RawRow>(raws.map((r) => [r.pid, r]));
    const skuByPid = new Map<number, string | null>(rawListings.map((r) => [r.pid, r.sku_id]));
    const metaByPid = new Map<number, RawListingMeta>(rawListings.map((r) => [r.pid, r]));
    let candidateRows = pool
      .filter((row) => {
        const raw = rawByPid.get(row.pid);
        const soldMeta = metaByPid.get(row.pid);
        return Boolean(soldMeta && raw && raw.price > 0 && raw.price <= TIER_B_MAX_KRW);
      })
      .slice(0, PREVIEW_MARKET_SCAN_LIMIT);
    const candidateComparableKeys = [
      ...new Set(candidateRows.map((row) => row.comparable_key).filter((key): key is string => Boolean(key))),
    ];
    const velocityRows = candidateComparableKeys.length > 0
      ? await restFetch(
        `${tableUrl("mvp_market_velocity_daily")}?select=comparable_key,observed_sold_sample_count,sold_7d_count,confidence,median_hours_to_sold,date,computed_at&comparable_key=in.(${candidateComparableKeys.map(encodeURIComponent).join(",")})&condition_class=eq.all&order=date.desc,computed_at.desc,observed_sold_sample_count.desc&limit=${Math.max(100, candidateComparableKeys.length * 2)}`,
        { headers },
      ).then((res) => res.json() as Promise<VelocityRow[]>).catch(() => [])
      : [];
    const velocityByKey = new Map<string, VelocitySignal>();
    for (const row of velocityRows) {
      if (velocityByKey.has(row.comparable_key)) continue;
      const signal = velocitySignalFromRow(row);
      if (signal) velocityByKey.set(row.comparable_key, signal);
    }

    candidateRows = candidateRows.filter((row) => row.comparable_key ? velocityByKey.has(row.comparable_key) : false);
    const velocityCandidatePids = candidateRows.map((row) => row.pid);
    if (candidateRows.length === 0) {
      return [];
    }

    const [marketRows, sourceMarketRows, parsedRows] = candidateComparableKeys.length > 0
      ? await Promise.all([
        restFetch(
          `${tableUrl("mvp_market_price_daily")}?select=comparable_key,condition_class,condition_tier,blended_median_price,active_median_price,sold_median_price,sold_sample_count,active_sample_count,disappeared_sample_count,date,computed_at&comparable_key=in.(${candidateComparableKeys.map(encodeURIComponent).join(",")})&order=date.desc,computed_at.desc&limit=${Math.max(200, candidateComparableKeys.length * 12)}`,
          { headers },
        ).then((res) => res.json() as Promise<MarketPriceRow[]>),
        restFetch(
          `${tableUrl("mvp_market_price_daily_per_source")}?select=comparable_key,source,condition_class,condition_tier,blended_median_price,active_median_price,sold_median_price,sold_sample_count,active_sample_count,disappeared_sample_count,date,computed_at&comparable_key=in.(${candidateComparableKeys.map(encodeURIComponent).join(",")})&order=date.desc,computed_at.desc&limit=${Math.max(400, candidateComparableKeys.length * 36)}`,
          { headers },
        ).then((res) => res.json() as Promise<MarketPriceRow[]>),
        restFetch(
          `${tableUrl("mvp_listing_parsed")}?select=pid,condition_class,condition_tier&pid=in.(${velocityCandidatePids.join(",")})&limit=${velocityCandidatePids.length + 20}`,
          { headers },
        ).then((res) => res.json() as Promise<ParsedRow[]>),
      ])
      : [[], [], []] as [MarketPriceRow[], MarketPriceRow[], ParsedRow[]];
    const marketByKeyCondition = buildMarketByKeyCondition(marketRows);
    const sourceMarketByKeyCondition = buildSourceMarketByKeyCondition(sourceMarketRows);
    const parsedByPid = new Map<number, ParsedRow>(parsedRows.map((row) => [Number(row.pid), row]));

    // 2026-05-17: 가격 tier 분리 — 10만 이하 2개 + 10-30만 3개. SKU + category + condition_class 다양화.
    // pickFromTier 가 carry-over: cumulative usedSkus/categories/usedConditions.
    const usedSkus = new Set<string>();
    const usedCategories = new Set<string>();
    const usedConditions = new Set<string>();
    const selected: PoolRow[] = [];

    function pickFromTier(maxPriceKrw: number, target: number) {
      const tierPicked: PoolRow[] = [];
      // 1차 — sku + category + condition_class 다 dedup (가장 strict)
      for (const row of candidateRows) {
        if (tierPicked.length >= target) break;
        if (selected.some((s) => s.pid === row.pid)) continue;
        const raw = rawByPid.get(row.pid);
        if (!raw || raw.price > maxPriceKrw) continue;
        const currentGap = previewMarketGap(row, raw, metaByPid.get(row.pid), parsedByPid.get(row.pid), marketByKeyCondition, sourceMarketByKeyCondition);
        if (currentGap == null || currentGap < MIN_PREVIEW_MARKET_GAP) continue;
        if (isPreviewHighProfitAnomaly(row, raw, metaByPid.get(row.pid), parsedByPid.get(row.pid), marketByKeyCondition, sourceMarketByKeyCondition)) continue;
        const sku = skuByPid.get(row.pid);
        if (sku && usedSkus.has(sku)) continue;
        const cat = row.category ?? "other";
        if (usedCategories.has(cat)) continue;
        const cc = row.condition_class ?? "normal";
        if (usedConditions.has(cc)) continue;
        tierPicked.push(row);
        if (sku) usedSkus.add(sku);
        usedCategories.add(cat);
        usedConditions.add(cc);
      }
      // 2차 — condition_class 중복 허용 (sku/category 만 유지)
      if (tierPicked.length < target) {
        for (const row of candidateRows) {
          if (tierPicked.length >= target) break;
          if (selected.some((s) => s.pid === row.pid)) continue;
          if (tierPicked.some((s) => s.pid === row.pid)) continue;
          const raw = rawByPid.get(row.pid);
          if (!raw || raw.price > maxPriceKrw) continue;
          const currentGap = previewMarketGap(row, raw, metaByPid.get(row.pid), parsedByPid.get(row.pid), marketByKeyCondition, sourceMarketByKeyCondition);
          if (currentGap == null || currentGap < MIN_PREVIEW_MARKET_GAP) continue;
          if (isPreviewHighProfitAnomaly(row, raw, metaByPid.get(row.pid), parsedByPid.get(row.pid), marketByKeyCondition, sourceMarketByKeyCondition)) continue;
          const sku = skuByPid.get(row.pid);
          if (sku && usedSkus.has(sku)) continue;
          const cat = row.category ?? "other";
          if (usedCategories.has(cat)) continue;
          tierPicked.push(row);
          if (sku) usedSkus.add(sku);
          usedCategories.add(cat);
        }
      }
      // 3차 — sku 만 dedup (category 도 중복 허용, fallback)
      if (tierPicked.length < target) {
        for (const row of candidateRows) {
          if (tierPicked.length >= target) break;
          if (selected.some((s) => s.pid === row.pid)) continue;
          if (tierPicked.some((s) => s.pid === row.pid)) continue;
          const raw = rawByPid.get(row.pid);
          if (!raw || raw.price > maxPriceKrw) continue;
          const currentGap = previewMarketGap(row, raw, metaByPid.get(row.pid), parsedByPid.get(row.pid), marketByKeyCondition, sourceMarketByKeyCondition);
          if (currentGap == null || currentGap < MIN_PREVIEW_MARKET_GAP) continue;
          if (isPreviewHighProfitAnomaly(row, raw, metaByPid.get(row.pid), parsedByPid.get(row.pid), marketByKeyCondition, sourceMarketByKeyCondition)) continue;
          const sku = skuByPid.get(row.pid);
          if (sku && usedSkus.has(sku)) continue;
          tierPicked.push(row);
          if (sku) usedSkus.add(sku);
        }
      }
      selected.push(...tierPicked);
    }

    pickFromTier(TIER_A_MAX_KRW, TIER_A_COUNT);
    pickFromTier(TIER_B_MAX_KRW, TIER_B_COUNT);

    if (selected.length === 0) {
      return [];
    }

    // confidence: pool.confidence (0~1) → high (>=0.8) / medium (>=0.6) / low.
    function confLabel(c: number | null): "high" | "medium" | "low" {
      if (c == null || !Number.isFinite(c)) return "low";
      if (c >= 0.8) return "high";
      if (c >= 0.6) return "medium";
      return "low";
    }

    // fresh: last_seen_at 24시간 이내면 "신규".
    function isFresh(iso: string | null | undefined): boolean {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      if (!Number.isFinite(t)) return false;
      return Date.now() - t < 24 * 60 * 60 * 1000;
    }

    const comparableKeys = selected
      .map((r) => r.comparable_key)
      .filter((k): k is string => !!k);
    const demandByKey = new Map<string, number>();
    if (marketRows.length > 0) {
      const latestByKey = new Map<string, { date: string; total: number }>();
      for (const r of marketRows) {
        if (!comparableKeys.includes(r.comparable_key)) continue;
        const sample = (r.sold_sample_count ?? 0) + (r.active_sample_count ?? 0);
        if (sample <= 0) continue;
        const cur = latestByKey.get(r.comparable_key);
        if (!cur || r.date > cur.date) {
          latestByKey.set(r.comparable_key, { date: r.date, total: sample });
        } else if (r.date === cur.date) {
          cur.total += sample;
        }
      }
      for (const [k, v] of latestByKey) demandByKey.set(k, v.total);
    }
    const items = selected.map((row, idx) => {
      const raw = rawByPid.get(row.pid);
      const meta = metaByPid.get(row.pid);
      const parsed = parsedByPid.get(row.pid);
      const marketPrice = marketPriceForPoolRow(row, raw, meta, parsed, marketByKeyCondition, sourceMarketByKeyCondition);
      const marketGap = previewMarketGap(row, raw, meta, parsed, marketByKeyCondition, sourceMarketByKeyCondition) ?? 0;
      const fallbackTitle = categoryFriendlyLabel(row.category);
      return {
        slot: idx + 1,
        name: raw?.name ?? fallbackTitle,
        thumbnailUrl: raw?.thumbnail_url ?? null,
        previewTitle: raw?.name ?? fallbackTitle,
        profitLabel: teaserProfitLabel(marketGap),
        budgetLabel: teaserBudgetRangeLabel(raw?.price ?? null),
        priceSignalLabel: relativeDiscountLabel(raw?.price ?? null, marketPrice),
        // (deprecated) launch-111 호환성 — 클라이언트 fallback.
        maskedName: raw?.name ?? fallbackTitle,
        blurredImage: raw?.thumbnail_url ?? null,
        category: row.category ?? "other",
        conditionClass: row.condition_class,
        conditionTier: parsed?.condition_tier ?? null,
        price: raw?.price ?? 0,
        skuMedian: marketPrice,
        expectedProfitMin: marketGap,
        expectedProfitMax: marketGap,
        profitBand: row.profit_band,
        // 2026-05-17: 신뢰 시그널 chips (dashboard 패턴).
        confidence: confLabel(row.confidence),
        freeShipping: meta?.free_shipping ?? false,
        isFresh: isFresh(meta?.last_seen_at),
        sellerReviewRating: meta?.shop_review_rating == null ? null : Number(meta.shop_review_rating),
        sellerReviewCount: meta?.shop_review_count == null ? null : Number(meta.shop_review_count),
        // 2026-05-17 Phase 3: 근거 chip 데이터 (buildVerdicts input).
        soldSampleCount: row.comparable_key ? (velocityByKey.get(row.comparable_key)?.observedSoldSampleCount ?? demandByKey.get(row.comparable_key) ?? null) : null,
        medianHoursToSold: row.comparable_key ? (velocityByKey.get(row.comparable_key)?.medianHoursToSold ?? null) : null,
      };
    });

    return items;
  } catch (err) {
    console.error("[preview-pool] error", err);
    throw err;
  }
}

export async function readPreviewPoolCache(): Promise<PreviewPoolItem[]> {
  try {
    const res = await restFetch(
      `${tableUrl("mvp_preview_showcases")}?select=slot_index,payload,updated_at&is_active=eq.true&order=slot_index.asc,updated_at.desc&limit=${PREVIEW_POOL_CACHE_LIMIT}`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as PreviewShowcaseCacheRow[];
    return rows
      .map((row) => row.payload)
      .filter((item): item is PreviewPoolItem => Boolean(item && Number.isFinite(Number(item.slot))))
      .slice(0, PREVIEW_POOL_CACHE_LIMIT);
  } catch (err) {
    console.error("[preview-pool-cache] read failed", err);
    return [];
  }
}

export async function refreshPreviewPoolCache() {
  const items = await buildPreviewPoolItems();
  if (items.length === 0) return { count: 0, preservedExistingCache: true };

  const now = new Date().toISOString();
  const payload = items.map((item, index) => ({
    slot_index: index + 1,
    payload: { ...item, slot: index + 1 },
    is_active: true,
    updated_at: now,
    source_snapshot: {
      name: item.name,
      category: item.category,
      price: item.price,
      skuMedian: item.skuMedian,
      medianHoursToSold: item.medianHoursToSold,
      soldSampleCount: item.soldSampleCount,
    },
  }));

  await restFetch(`${tableUrl("mvp_preview_showcases")}?id=gt.0`, {
    method: "DELETE",
    headers: serviceHeaders(),
  });

  await restFetch(`${tableUrl("mvp_preview_showcases")}`, {
    method: "POST",
    headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
    body: jsonBody(payload),
  });

  return { count: payload.length, preservedExistingCache: false };
}
