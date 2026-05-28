// Wave 90 (2026-05-15): 시세 근거 디버그 API.
// 사용자 매물 (reveal 됐던 매물) 대상으로 시세 산정의 근거 매물 list + 통계 반환.
// 목적: 사용자가 매물 검증 시 "이 시세가 어떤 매물 기준으로 계산됐는지" 확인 가능하게.
//
// 2026-05-15 update: auth/권한 체크 제거. 베타 풀 페이지(/peek-pool-7f3kz9)에서도 호출 가능.
// pid 알면 누구나 접근. 의도된 변경 (시세 투명성).
// 2026-05-16: rate limit 추가. pid enumeration abuse 차단. IP 기반 60 req / 60s.

import { NextResponse } from "next/server";
import { fetchLatestMarketStats, fetchLatestMarketStatsPerSource, fetchReferencePrices, fetchV7SiblingPresence, marketBasisForCandidate } from "@/lib/pack-open";
import { listingUrlForSource, marketplaceSourceLabel, normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { checkRateLimit, clientIpKey } from "@/lib/rate-limit";
import { safeThumbnailUrl } from "@/lib/thumbnail-utils";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { COMPARABLE_EXCLUDE_NOTES } from "@/lib/condition-policy";
import { madTrim } from "@/lib/market-math";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 2026-05-16 (사용자 코멘트 #96 pid 407759980): 비교군 list 에 active 만 보이고 sold 안 보임.
// raw 에 sale_status/listing_state 있는데 limit 30 으로 잘림 → active 가 다 차지하면 sold 0건.
// limit 80 으로 늘려 active + sold + disappeared 다 표시. UI 가 saleStatus 표시 이미 있음.
const MAX_COMPARABLES = 80;

type Comparable = {
  pid: number;
  name: string;
  price: number;
  thumbnailUrl: string | null;
  saleStatus: string | null;
  listingState: string | null;
  lastSeenAt: string | null;
  sourceQuery: string | null;
  marketplaceSource: string;
  marketplaceLabel: string;
  listingUrl: string;
  bunjangUrl: string;
  // Wave 714d (2026-05-23): 신발/의류 5-tier grading + chips 노출.
  conditionTier?: string | null;
  conditionCluster?: string | null;
  conditionConfidence?: number | null;
  conditionFlags?: Record<string, unknown> | null;
  conditionChips?: string[] | null;
  conditionClass?: string | null;
};

function trimComparableOutlierRows(rows: Array<Record<string, unknown>>) {
  const prices = rows
    .map((row) => Number(row.price ?? 0))
    .filter((price) => Number.isFinite(price) && price > 0);
  const trimmed = madTrim(prices);
  if (trimmed.removed <= 0 || trimmed.values.length === 0) return rows;
  const minAllowed = Math.min(...trimmed.values);
  const maxAllowed = Math.max(...trimmed.values);
  return rows.filter((row) => {
    const price = Number(row.price ?? 0);
    return Number.isFinite(price) && price > 0 && price >= minAllowed && price <= maxAllowed;
  });
}

function trimComparableDisplayRows(
  rows: Array<Record<string, unknown>>,
  marketBasis: { p25Price: number | null; p75Price: number | null } | null,
) {
  const madRows = trimComparableOutlierRows(rows);
  const p25 = Number(marketBasis?.p25Price ?? 0);
  const p75 = Number(marketBasis?.p75Price ?? 0);
  if (!Number.isFinite(p25) || !Number.isFinite(p75) || p25 <= 0 || p75 <= 0 || p75 < p25) {
    return madRows;
  }

  // Display is for user trust, not for recomputing market price. If the daily market row already has
  // a trusted middle band, show that band first so stale/aspirational high asks do not look like
  // the basis of the estimate.
  const middleBandRows = madRows.filter((row) => {
    const price = Number(row.price ?? 0);
    return Number.isFinite(price) && price >= p25 && price <= p75;
  });
  if (middleBandRows.length >= Math.min(5, madRows.length)) return middleBandRows;

  const iqr = Math.max(1, p75 - p25);
  const lowFence = Math.max(1, p25 - iqr * 1.5);
  const highFence = p75 + iqr * 1.5;
  const fenceRows = madRows.filter((row) => {
    const price = Number(row.price ?? 0);
    return Number.isFinite(price) && price >= lowFence && price <= highFence;
  });
  return fenceRows.length >= Math.min(5, madRows.length) ? fenceRows : madRows;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ pid: string }> },
) {
  // 2026-05-15: auth/권한 체크 제거. 베타 풀 페이지(/peek-pool-7f3kz9)에서도
  // 시세 근거 보기 가능하도록 public read-only. pid 알면 누구나 접근.
  const { pid: pidStr } = await params;
  const pid = Number(pidStr);
  if (!Number.isFinite(pid)) return NextResponse.json({ error: "invalid pid" }, { status: 400 });

  // 2026-05-16: rate limit. pid enumeration abuse 차단 (시세 근거 fetch는 쿼리 무거움).
  const rate = await checkRateLimit({
    bucketKey: `market-source:${clientIpKey(req)}`,
    maxRequests: 60,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    // 우리 매물 정보 + comparable_key (sku_id는 mvp_raw_listings에만 존재)
    const [listingRes, parsedRes, rawRes] = await Promise.all([
      restFetch(
        `${tableUrl("mvp_listings")}?select=pid,name,price,sku_name,sku_median&pid=eq.${pid}`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        // Wave 130 (2026-05-16): condition_class 추가 — 시세 stats를 매칭 condition으로 조회.
        // Wave 251.4 (2026-05-19): parsed_json 추가 — clothing_product_type 비교군 필터용.
        // Wave 714d (2026-05-23): 신발/의류 5-tier grading column 추가 — UI chip 노출용.
        `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,parse_confidence,needs_review,condition_class,parsed_json,condition_tier,condition_cluster,condition_confidence,condition_flags&pid=eq.${pid}`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid,source,seller_source,url,sku_id,thumbnail_url,sale_status,listing_state,last_seen_at,query&pid=eq.${pid}`,
        { headers: serviceHeaders() },
      ),
    ]);
    const listing = ((await listingRes.json()) as Array<Record<string, unknown>>)[0];
    const parsed = ((await parsedRes.json()) as Array<Record<string, unknown>>)[0];
    const raw = ((await rawRes.json()) as Array<Record<string, unknown>>)[0];

    if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });

    const comparableKey = (parsed?.comparable_key as string | null) ?? null;
    const conditionClass = (parsed?.condition_class as string | null) ?? null;
    // Wave launch-78: 신발/의류 5-tier(S/A/B/C/D) — 옛 condition_class와 별개 axis.
    // 본 매물이 D급인데 비교군에 A급 매물 섞이면 시세 신뢰 박살 (사용자 보고).
    // → 신발/의류면 tier 같은 매물만 비교군 keep. tier 0/null 옛 매물은 보수 호환 (필터 skip).
    const conditionTier = (parsed?.condition_tier as string | null) ?? null;
    const isShoeOrClothingTarget = Boolean(
      comparableKey && (comparableKey.startsWith("shoe|") || comparableKey.startsWith("clothing|")),
    );
    const skuId = (raw?.sku_id as string | null) ?? null;
    // Wave 251.4 (2026-05-19): fashion sub-product 분리 — 본 매물 clothing_product_type 추출.
    //   사용자 frustration (id 201, 202, 203): BAPE tee 50+건 비교군에 tee/hoodie/crewneck/맨투맨 섞임.
    //     같은 sku_id (clothing-bape-tee) 안 product_type 별 가격 분포 다름 (tee ₩70k vs hoodie ₩300k).
    //   comparable_key 자체엔 clothing_product_type 안 박힘 — UI 노출 단계에서 필터 적용.
    //   본 매물 parsed_json.clothing_product_type 와 같은 type 만 표시. null/type_unknown 이면 필터 안 함 (보수).
    const targetParsedJson = (parsed?.parsed_json as Record<string, unknown> | null) ?? null;
    const targetProductType = (targetParsedJson?.clothing_product_type as string | null) ?? null;

    const ourMarketplaceSource = normalizeMarketplaceSource((raw?.source as string | null) ?? (raw?.seller_source as string | null));

    // 3. /me 카드와 동일한 marketBasis 산정. reference price(Danawa)까지 같은 함수로 맞춘다.
    let marketStats: Record<string, unknown> | null = null;
    let displayMarketBasis: ReturnType<typeof marketBasisForCandidate> | null = null;
    if (comparableKey) {
      const [basisStats, basisStatsPerSource, referencePrices, v7SiblingPresence] = await Promise.all([
        fetchLatestMarketStats([comparableKey]),
        fetchLatestMarketStatsPerSource([comparableKey]),
        fetchReferencePrices([comparableKey]),
        // Wave 252.A real (2026-05-20): v3 clothing key + v7 sibling 존재 시 mixed-pool median 차단.
        fetchV7SiblingPresence([comparableKey]),
      ]);
      displayMarketBasis = marketBasisForCandidate(
        comparableKey,
        (listing.sku_name as string | null) ?? "",
        basisStats,
        conditionClass,
        referencePrices,
        v7SiblingPresence,
        basisStatsPerSource,
        ourMarketplaceSource,
      );
      const matchedCondition = displayMarketBasis.conditionClass;
      const byCondition = basisStats.get(comparableKey);
      const matchedRow = matchedCondition ? byCondition?.get(matchedCondition) : null;
      marketStats = matchedRow ? {
        blended_median_price: matchedRow.blended_median_price,
        active_median_price: matchedRow.active_median_price,
        p25_price: matchedRow.p25_price,
        p75_price: matchedRow.p75_price,
        active_sample_count: matchedRow.active_sample_count,
        sold_sample_count: matchedRow.sold_sample_count,
        disappeared_sample_count: matchedRow.disappeared_sample_count,
        confidence: matchedRow.confidence,
        computed_at: matchedRow.computed_at,
      } : null;
    }

    // 4. comparable 매물 list — 같은 comparable_key 또는 sku_id 기반 fetch
    // Strategy A: comparable_key 기준 (정확). listing_parsed에서 pid 가져와 raw_listings join.
    let comparables: Comparable[] = [];
    if (comparableKey) {
      // listing_parsed limit 더 크게 — sold 매물도 비교군에 들어갈 자리 확보 (#96).
      const sameKeyPidsRes = await restFetch(
        `${tableUrl("mvp_listing_parsed")}?select=pid&comparable_key=eq.${encodeURIComponent(comparableKey)}&needs_review=eq.false&limit=${MAX_COMPARABLES * 6}`,
        { headers: serviceHeaders() },
      );
      const sameKeyPids = ((await sameKeyPidsRes.json()) as Array<{ pid: number }>)
        .map((r) => Number(r.pid))
        .filter((p) => Number.isFinite(p) && p !== pid)
        .slice(0, MAX_COMPARABLES * 6);
      if (sameKeyPids.length > 0) {
        // Wave 90: listing_type=normal + risk_hits=0 + 새상품 제외 필터.
        const [rawListRes, analysisRes, parsedRes2] = await Promise.all([
          restFetch(
            // Wave launch-31 (사용자 짚음): 같은 셀러 다중 가격 매물 dedup 위해 seller_uid 추가.
            `${tableUrl("mvp_raw_listings")}?select=pid,source,seller_source,url,name,price,thumbnail_url,sale_status,listing_state,last_seen_at,query,seller_uid&pid=in.(${sameKeyPids.join(",")})&listing_type=eq.normal&order=last_seen_at.desc`,
            { headers: serviceHeaders() },
          ),
          restFetch(
            `${tableUrl("mvp_listing_analysis")}?select=pid,risk_hits&pid=in.(${sameKeyPids.join(",")})`,
            { headers: serviceHeaders() },
          ),
          restFetch(
            // Wave 714d (2026-05-23): 비교군 sample 에도 5-tier grading + chips 노출.
            `${tableUrl("mvp_listing_parsed")}?select=pid,parsed_json,condition_class,condition_tier,condition_cluster,condition_confidence,condition_flags&pid=in.(${sameKeyPids.join(",")})`,
            { headers: serviceHeaders() },
          ),
        ]);
        const rawRows = (await rawListRes.json()) as Array<Record<string, unknown>>;
        const analysisRows = (await analysisRes.json()) as Array<{ pid: number; risk_hits: number }>;
        const parsedRowsForCond = (await parsedRes2.json()) as Array<{
          pid: number;
          parsed_json: Record<string, unknown> | null;
          condition_class: string | null;
          condition_tier?: string | null;
          condition_cluster?: string | null;
          condition_confidence?: number | null;
          condition_flags?: Record<string, unknown> | null;
        }>;
        // Wave 714d (2026-05-23): grading + chips lookup map.
        const gradingByPid = new Map<number, {
          tier: string | null;
          cluster: string | null;
          confidence: number | null;
          flags: Record<string, unknown> | null;
          chips: string[] | null;
        }>();
        for (const p of parsedRowsForCond) {
          const grade = (p.parsed_json?.condition_grade as { chips?: string[] } | null) ?? null;
          gradingByPid.set(Number(p.pid), {
            tier: p.condition_tier ?? null,
            cluster: p.condition_cluster ?? null,
            confidence: p.condition_confidence ?? null,
            flags: p.condition_flags ?? null,
            chips: grade?.chips ?? null,
          });
        }
        const riskByPid = new Map(analysisRows.map((r) => [Number(r.pid), Number(r.risk_hits ?? 0)]));
        const excludeByPid = new Map<number, boolean>();
        const strictConditionSampleCount = conditionClass == null
          ? 0
          : parsedRowsForCond.filter((p) => p.condition_class === conditionClass).length;
        const requireKnownCondition = conditionClass != null && strictConditionSampleCount >= 5;
        // 2026-05-17 v46 cleanup: COMPARABLE_EXCLUDE_NOTES condition-policy.ts 단일 source 로 옮김 (drift 차단).
        // 사용자 코멘트 #92 (pid 406610698) 가 정확히 이 drift 지적 — 시세 sample 제외 list 와 비교군 UI 제외 list 가 불일치.
        // 2026-05-16 (사용자 코멘트 #95 pid 406094154): 본 매물 = "사용감 많음" (worn) 인데 비교군에 mint 매물.
        // wave 130 condition_class 시세 분리는 작동하지만 비교군 UI 가 condition 무관 다 표시 = 사용자 헷갈림.
        // 본 매물 condition_class 와 같은 class 매물만 비교군 list 표시.
        // Wave 896: 같은 상태 표본이 5개 이상 있으면 condition_class null 옛 row도 제외한다.
        //   "SSS급" 같은 제목이 null로 남아 target worn 라벨을 달고 보이는 신뢰 손상을 막는다.
        for (const p of parsedRowsForCond) {
          const notes = (p.parsed_json?.condition_notes as string[] | undefined) ?? [];
          if (COMPARABLE_EXCLUDE_NOTES.some((n) => notes.includes(n))) {
            excludeByPid.set(Number(p.pid), true);
            continue;
          }
          // condition_class 분리: 본 매물 cc != null && 비교 매물 cc != 본 매물 cc → exclude.
          if (conditionClass != null) {
            if (p.condition_class == null && requireKnownCondition) {
              excludeByPid.set(Number(p.pid), true);
              continue;
            }
            if (p.condition_class != null && p.condition_class !== conditionClass) {
              excludeByPid.set(Number(p.pid), true);
              continue;
            }
          }
          // Wave launch-78: 신발/의류 5-tier 분리. 본 D급에 A급 매물 섞이는 문제 차단.
          //   본 매물 tier S/A/B/C/D 면 비교 매물도 같은 tier 만 keep.
          //   본 매물 tier UNKNOWN/null 이면 필터 skip (정보 부족 — 보수). 비교 매물 tier null 도 보수 통과.
          if (
            isShoeOrClothingTarget
            && conditionTier != null
            && conditionTier !== "UNKNOWN"
            && p.condition_tier != null
            && p.condition_tier !== "UNKNOWN"
            && p.condition_tier !== conditionTier
          ) {
            excludeByPid.set(Number(p.pid), true);
            continue;
          }
          // Wave 251.4 (2026-05-19): fashion clothing_product_type 분리.
          //   본 매물 product_type 박혀 있고 (tee/hoodie/crewneck/jacket/shirt 등) 비교 매물 박혀 있고 다르면 exclude.
          //   본 매물 또는 비교 매물 type 이 null/type_unknown 이면 필터 안 함 (보수 — 옛 데이터 호환).
          //   사용자 frustration (id 201/202/203): BAPE tee vs hoodie 가격 차 4배, Stussy crewneck vs 맨투맨 7배.
          const compareProductType = (p.parsed_json?.clothing_product_type as string | null) ?? null;
          if (
            targetProductType != null && targetProductType !== "type_unknown"
            && compareProductType != null && compareProductType !== "type_unknown"
            && targetProductType !== compareProductType
          ) {
            excludeByPid.set(Number(p.pid), true);
            continue;
          }
          excludeByPid.set(Number(p.pid), false);
        }
        const safeRows = rawRows.filter((r) => {
          const pid = Number(r.pid);
          if ((riskByPid.get(pid) ?? 0) > 0) return false;
          if (excludeByPid.get(pid) === true) return false;
          if (displayMarketBasis?.basisSource) {
            const source = normalizeMarketplaceSource((r.source as string | null) ?? (r.seller_source as string | null));
            if (source !== displayMarketBasis.basisSource) return false;
          }
          return true;
        });
        // Wave launch-31 (사용자 짚음): 같은 셀러 다수 매물 dedup.
        // 동일 셀러가 같은 상품 여러 가격으로 올린 경우 UI list 신뢰 박살.
        // → seller_uid 별 가장 낮은 가격 1개만 keep (사용자 best buy 톤).
        const dedupedBySeller = (() => {
          const bestPerSeller = new Map<string, Record<string, unknown>>();
          const noSellerRows: Array<Record<string, unknown>> = [];
          for (const row of safeRows) {
            const sellerUid = typeof row.seller_uid === "string" && row.seller_uid.trim() ? row.seller_uid.trim() : null;
            if (!sellerUid) {
              noSellerRows.push(row);
              continue;
            }
            const existing = bestPerSeller.get(sellerUid);
            const price = Number(row.price ?? 0);
            const existingPrice = existing ? Number(existing.price ?? 0) : Number.POSITIVE_INFINITY;
            if (!existing || (price > 0 && price < existingPrice)) {
              bestPerSeller.set(sellerUid, row);
            }
          }
          return [...bestPerSeller.values(), ...noSellerRows];
        })();
        const displayRows = trimComparableDisplayRows(dedupedBySeller, displayMarketBasis);
        const parsedByPid = new Map(parsedRowsForCond.map((row) => [Number(row.pid), row]));
        comparables = displayRows.map((row) => {
          const rowPid = Number(row.pid);
          const marketplaceSource = normalizeMarketplaceSource((row.source as string | null) ?? (row.seller_source as string | null));
          const listingUrl = listingUrlForSource(rowPid, row.url as string | null, marketplaceSource);
          const grading = gradingByPid.get(rowPid);
          const parsedRow = parsedByPid.get(rowPid);
          return {
            pid: rowPid,
            name: String(row.name ?? ""),
            price: Number(row.price ?? 0),
            thumbnailUrl: safeThumbnailUrl(row.thumbnail_url as string | null),
            saleStatus: (row.sale_status as string | null) ?? null,
            listingState: (row.listing_state as string | null) ?? null,
            lastSeenAt: (row.last_seen_at as string | null) ?? null,
            sourceQuery: (row.query as string | null) ?? null,
            marketplaceSource,
            marketplaceLabel: marketplaceSourceLabel(marketplaceSource),
            listingUrl,
            bunjangUrl: listingUrl,
            // Wave 714d: 신발/의류 grading + chips 부착.
            conditionTier: grading?.tier ?? null,
            conditionCluster: grading?.cluster ?? null,
            conditionConfidence: grading?.confidence ?? null,
            conditionFlags: grading?.flags ?? null,
            conditionChips: grading?.chips ?? null,
            conditionClass: parsedRow?.condition_class ?? null,
          };
        });
      }
    }

    // §12b 정확성 우선: sku_id fallback 제거 (broad SKU 풀 = 다른 세대/사이즈 섞임).
    // comparable_key 매물 0개면 "비교군 없음"으로 정직하게 표시.
    const comparableSource: "comparable_key" | "none" = comparables.length > 0 ? "comparable_key" : "none";

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

    const ourListingUrl = listingUrlForSource(pid, raw?.url as string | null, ourMarketplaceSource);

    // Wave 714d (2026-05-23): 본 매물 grading + chips (신발/의류).
    const ourGrade = (targetParsedJson?.condition_grade as { chips?: string[] } | null) ?? null;
    return NextResponse.json({
      ourListing: {
        pid,
        name: (listing.name as string) ?? "",
        price: Number(listing.price ?? 0),
        skuId,
        skuName: (listing.sku_name as string | null) ?? null,
        skuMedian: Number(listing.sku_median ?? 0),
        comparableKey,
        conditionClass,
        // Wave 714d: 신발/의류 5-tier S/A/B/C/D + chips. 전자기기는 null.
        conditionTier: (parsed?.condition_tier as string | null) ?? null,
        conditionCluster: (parsed?.condition_cluster as string | null) ?? null,
        conditionConfidence: (parsed?.condition_confidence as number | null) ?? null,
        conditionFlags: (parsed?.condition_flags as Record<string, unknown> | null) ?? null,
        conditionChips: ourGrade?.chips ?? null,
        displayMarketPrice: displayMarketBasis?.medianPrice ?? null,
        marketPriceSource: displayMarketBasis?.priceSource ?? "market",
        marketPriceLabel: displayMarketBasis?.priceSource === "reference"
          ? "새상품 기준 시세"
          : displayMarketBasis?.basisSourceLabel && displayMarketBasis?.conditionLabel
            ? `${displayMarketBasis.basisSourceLabel} ${displayMarketBasis.conditionLabel} 시세`
            : displayMarketBasis?.basisSourceLabel
              ? `${displayMarketBasis.basisSourceLabel} 중고 시세`
              : displayMarketBasis?.conditionLabel
                ? `통합 ${displayMarketBasis.conditionLabel} 시세`
                : "통합 중고 시세",
        marketPriceBasisSource: displayMarketBasis?.basisSource ?? null,
        marketPriceBasisSourceLabel: displayMarketBasis?.basisSourceLabel ?? null,
        marketPriceSourceFallbackUsed: displayMarketBasis?.sourceFallbackUsed ?? false,
        marketConditionLabel: displayMarketBasis?.conditionLabel ?? null,
        // Wave 251.4 (2026-05-19): 본 매물 clothing_product_type 노출 — 비교군 필터 투명성.
        productType: targetProductType,
        parseConfidence: Number(parsed?.parse_confidence ?? 0) || null,
        needsReview: Boolean(parsed?.needs_review),
        thumbnailUrl: safeThumbnailUrl(raw?.thumbnail_url as string | null),
        marketplaceSource: ourMarketplaceSource,
        marketplaceLabel: marketplaceSourceLabel(ourMarketplaceSource),
        listingUrl: ourListingUrl,
        bunjangUrl: ourListingUrl,
      },
      marketDailyStats: displayMarketBasis && displayMarketBasis.medianPrice != null ? {
        blendedMedian: displayMarketBasis.medianPrice,
        activeMedian: null,
        p25: displayMarketBasis.p25Price,
        p75: displayMarketBasis.p75Price,
        activeCount: displayMarketBasis.activeSampleCount,
        soldCount: displayMarketBasis.soldSampleCount,
        disappearedCount: displayMarketBasis.disappearedSampleCount,
        confidence: displayMarketBasis.confidence,
        computedAt: displayMarketBasis.computedAt,
      } : null,
      comparableSource,
      comparables,
      liveStats,
    });
  } catch (err) {
    // Wave 106: raw err.message 누출 차단.
    console.error("[market-source] error", err);
    return NextResponse.json(
      { error: "market_source_failed", message: "시세 정보를 불러오지 못했어요." },
      { status: 500 },
    );
  }
}
