// Wave 799 (2026-05-30): URL 입력 시세 조회 API.
//   사용자가 번장/중나/당근 매물 URL 입력 → DB 조회 → 시세/매입가/예상수익/비교매물/그래프 반환.
//   DB 안 매물만 조회 (live fetch X). 표본 부족하면 명시.

import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import {
  fetchLatestMarketStats,
  fetchLatestMarketStatsPerSource,
  fetchLatestMarketVelocity,
  fetchReferencePrices,
  fetchV7SiblingPresence,
  marketBasisForCandidate,
} from "@/lib/pack-open";
import { expectedProfitFromMarketPrice } from "@/lib/profit";
import { normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { checkRateLimit } from "@/lib/rate-limit";
import { userRefForAuthUser } from "@/lib/user-ref";
import { spendUserCredits, getUserCreditsReadOnly } from "@/lib/user-credits";
import type { User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/auth-users";

const LOOKUPS_PER_CREDIT = 5; // Wave 799b: 1 lookup = 0.2 credit → 5 lookups = 1 credit

/**
 * Wave 799b (2026-05-30): 1 lookup = 0.2 credit paywall.
 *   DB balance integer 라 fractional 안 됨 → 5번 누적 후 1 credit 차감 패턴.
 *   1~4번째: 무료 + counter++
 *   5번째: 1 credit 차감 + counter reset
 *   admin: free pass.
 */
async function chargeLookupCredit(user: User, userRef: string): Promise<{
  ok: boolean;
  charged: boolean;
  balance: number | null;
  lookupsUsed: number;
  reason?: string;
}> {
  if (isAdminUser(user)) {
    return { ok: true, charged: false, balance: null, lookupsUsed: 0 };
  }

  // 현재 counter 조회
  const counterKey = `lookup-counter:${userRef}`;
  const counterRes = await restFetch(
    `${tableUrl("mvp_rate_limits")}?select=request_count&bucket_key=eq.${encodeURIComponent(counterKey)}&limit=1`,
    { headers: serviceHeaders() },
  );
  const rows = (await counterRes.json()) as Array<{ request_count: number }>;
  const currentCount = Math.max(0, Number(rows[0]?.request_count ?? 0));

  if (currentCount >= LOOKUPS_PER_CREDIT - 1) {
    // 5번째 — credit 1 spend + counter reset
    const spend = await spendUserCredits({
      user,
      userRef,
      amount: 1,
      metadata: { source: "lookup_5x" },
    });
    if (!spend.ok) {
      const balance = await getUserCreditsReadOnly(user, userRef);
      return {
        ok: false,
        charged: false,
        balance: Math.max(0, Number(balance?.tokens ?? 0)),
        lookupsUsed: currentCount,
        reason: "insufficient_credits",
      };
    }
    // counter reset
    await restFetch(
      `${tableUrl("mvp_rate_limits")}?bucket_key=eq.${encodeURIComponent(counterKey)}`,
      { method: "DELETE", headers: serviceHeaders() },
    );
    return { ok: true, charged: true, balance: spend.tokens, lookupsUsed: 0 };
  }

  // 1~4번째: counter++ (rate-limit RPC 활용 — 무제한 max_requests 로 카운터만 증가)
  await restFetch(rpcUrl("check_mvp_rate_limit"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({
      p_bucket_key: counterKey,
      p_max_requests: 99999,
      p_window_seconds: 31_536_000, // 1년 (사실상 무기한)
    }),
  });
  const balance = await getUserCreditsReadOnly(user, userRef);
  return {
    ok: true,
    charged: false,
    balance: Math.max(0, Number(balance?.tokens ?? 0)),
    lookupsUsed: currentCount + 1,
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RawListing = {
  pid: number;
  source: string | null;
  url: string;
  name: string;
  price: number;
  sku_id: string | null;
  sku_name: string | null;
  thumbnail_url: string | null;
  shop_review_rating: number | null;
  shop_review_count: number | null;
  free_shipping: boolean | null;
  listing_state: string;
  sale_status: string;
  first_seen_at: string;
  daangn_region_id: string | null;
  daangn_region_name: string | null;
  raw_json: Record<string, unknown> | null;
  description_preview: string | null;
  image_count: number | null;
};

type ParsedRow = {
  pid: number;
  comparable_key: string | null;
  condition_class: string | null;
  category: string | null;
  condition_tier: string | null;
  condition_cluster: string | null;
  condition_confidence: number | string | null;
  condition_chips: string[] | null;
  condition_flags: Record<string, unknown> | null;
};

type PoolStatusRow = {
  status: string;
  invalidated_reason: string | null;
  score: number | string | null;
};

/**
 * 입력 text 에서 첫 번째 http(s) URL 만 추출.
 *   당근 share button 으로 복사하면 "Check out this ... <URL>" 처럼 잡문 같이 붙음.
 *   사용자가 URL 만 찾을 필요 없게 자동 추출.
 */
function extractFirstUrl(text: string): string {
  const m = text.match(/https?:\/\/[^\s<>"'`)\]]+/i);
  return m ? m[0] : text.trim();
}

/**
 * URL 에서 source + key 추출.
 * 번장: https://m.bunjang.co.kr/products/{pid}
 * 중나: https://web.joongna.com/product/{joongna_pid}
 * 당근: https://www.daangn.com/kr/buy-sell/{slug-with-id}/ 또는 /articles/{id}
 */
function parseListingUrl(url: string): { source: string; key: string } | null {
  const cleaned = url.trim();
  if (!cleaned) return null;

  // 번장
  const bunjang = cleaned.match(/bunjang\.co\.kr\/products\/(\d+)/i);
  if (bunjang) return { source: "bunjang", key: bunjang[1] };

  // 중나
  const joongna = cleaned.match(/joongna\.com\/product\/(\d+)/i);
  if (joongna) return { source: "joongna", key: joongna[1] };

  // 당근 — slug 끝 ID 추출
  const daangn = cleaned.match(/daangn\.com\/(?:kr\/)?(?:articles|buy-sell)\/([^/?]+)/i);
  if (daangn) return { source: "daangn", key: daangn[1] };

  return null;
}

/**
 * Wave 799d (2026-05-30): Daangn 공유 URL (articles/{numeric}) → buy-sell/{slug} redirect 따라가서 slug 추출.
 *   당근 share button 은 articles/{numeric} 형식인데 DB 는 buy-sell/{slug} 형식 — 다른 ID 체계.
 *   redirect 따라가서 slug 의 끝 shortId 추출해야 DB 매칭 가능.
 *   timeout 5s, 실패하면 null 반환 (caller 가 원래 key 로 fallback).
 */
async function resolveDaangnArticleSlug(articleId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.daangn.com/articles/${articleId}`, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (loc) {
        const slugMatch = loc.match(/buy-sell\/([^/?]+)/i);
        if (slugMatch) {
          // slug 끝 shortId (예: 4qai2x6asn5z) 가 가장 안정적 — 한글 인코딩 vs 디코딩 충돌 회피.
          const shortIdMatch = slugMatch[1].match(/-([a-z0-9]{8,})\/?$/i);
          return shortIdMatch ? shortIdMatch[1] : slugMatch[1];
        }
      }
    }
  } catch {
    // timeout / network 실패 — null fallback.
  }
  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Rate limit — 분당 10회 / 사용자
  const userRef = userRefForAuthUser(auth.user.id);
  const rateResult = await checkRateLimit({
    bucketKey: `lookup-by-url:${userRef}`,
    maxRequests: 10,
    windowSeconds: 60,
  });
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "rate_limit", message: "너무 자주 조회했어요. 잠시 후 다시 시도해주세요." },
      { status: 429 },
    );
  }

  // Wave 799e: top-level try/catch — 어디서 throw 되든 사용자한테 빈 500 대신
  //   step + reason 명시한 JSON 응답. 디버그 효율 ↑.
  let currentStep = "init";
  try {
    return await runLookup(req, auth.user, userRef, (s) => { currentStep = s; });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[lookup-by-url] step=${currentStep} error=`, errorMessage, err instanceof Error ? err.stack : undefined);
    return NextResponse.json(
      {
        error: "internal",
        message: `처리 중 오류가 발생했어요 (${currentStep}). 잠시 후 다시 시도해주세요.`,
        step: currentStep,
        detail: errorMessage,
      },
      { status: 500 },
    );
  }
}

async function runLookup(
  req: NextRequest,
  user: User,
  userRef: string,
  setStep: (s: string) => void,
): Promise<NextResponse> {
  setStep("parse_body");
  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "bad_body", message: "잘못된 요청이에요." }, { status: 400 });
  }

  const rawInput = (body.url ?? "").trim();
  if (!rawInput) {
    return NextResponse.json({ error: "no_url", message: "URL 을 입력해주세요." }, { status: 400 });
  }

  // Wave 799d: 잡문 섞인 share text 에서 URL 만 추출.
  const inputUrl = extractFirstUrl(rawInput);

  const parsed = parseListingUrl(inputUrl);
  if (!parsed) {
    return NextResponse.json(
      {
        error: "unsupported_url",
        message: "번개장터, 중고나라, 당근마켓 URL 을 찾지 못했어요.",
      },
      { status: 400 },
    );
  }

  // Wave 799d: Daangn articles/{numeric} URL 은 buy-sell/{slug} 로 redirect → slug 추출 후 DB 검색.
  let searchKey = parsed.key;
  let resolvedSlug: string | null = null;
  if (parsed.source === "daangn" && /^\d+$/.test(parsed.key)) {
    setStep("daangn_redirect");
    resolvedSlug = await resolveDaangnArticleSlug(parsed.key);
    if (resolvedSlug) {
      searchKey = resolvedSlug;
    }
  }

  // DB 매물 조회 — url 컬럼 ILIKE 검색
  // (크레딧 차감은 성공 응답 직전에 — 404/202 시 무료)
  setStep("fetch_raw_listing");
  const headers = serviceHeaders();
  // Wave 886.14 (2026-05-27): bunjang/joongna 는 key=pid (numeric) → pid 인덱스 eq 사용.
  //   기존 ILIKE %key% 는 url 컬럼 full scan → 부하 시 57014 statement timeout 빈번.
  //   사용자 짚음: 모바일 vs PC 동일 URL 다른 결과 (PC 빠른 시점, 모바일 느린 시점).
  const isNumericKey = /^\d+$/.test(searchKey);
  const selectCols = "pid,source,url,name,price,sku_id,sku_name,thumbnail_url,shop_review_rating,shop_review_count,free_shipping,listing_state,sale_status,first_seen_at,daangn_region_id,daangn_region_name,raw_json,description_preview,image_count";
  const filter = (parsed.source === "bunjang" || parsed.source === "joongna") && isNumericKey
    ? `pid=eq.${searchKey}&source=eq.${parsed.source}`
    : (() => {
        const escapedKey = searchKey.replace(/[%_]/g, "\\$&");
        return `url=ilike.*${encodeURIComponent(escapedKey)}*`;
      })();
  const rawRes = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=${selectCols}&${filter}&limit=1`,
    { headers },
  );
  const rawRows = (await rawRes.json()) as RawListing[];
  if (!rawRes.ok || rawRows.length === 0) {
    const baseMsg = "미뇨이 DB 에서 이 매물을 찾을 수 없어요.";
    const hint =
      parsed.source === "daangn" && /^\d+$/.test(parsed.key) && !resolvedSlug
        ? " 당근 공유 URL 을 분석하지 못했어요 — 매물 상세 화면의 주소를 그대로 붙여넣어 보세요."
        : " 새 매물이거나 아직 우리 풀에 들어오지 않았어요.";
    return NextResponse.json(
      {
        error: "not_found",
        message: baseMsg + hint,
        source: parsed.source,
        key: parsed.key,
        resolvedSlug,
      },
      { status: 404 },
    );
  }
  const raw = rawRows[0];
  const pid = raw.pid;

  // Parsed (comparable_key + condition_class + tier/chips)
  setStep("fetch_parsed");
  const parsedRes = await restFetch(
    `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,condition_class,category,condition_tier,condition_cluster,condition_confidence,condition_chips,condition_flags&pid=eq.${pid}&limit=1`,
    { headers },
  );
  const parsedRows = (await parsedRes.json()) as ParsedRow[];
  const parsedRow = parsedRows[0] ?? null;
  const comparableKey = parsedRow?.comparable_key ?? null;
  const conditionClass = parsedRow?.condition_class ?? null;
  const conditionTier = parsedRow?.condition_tier ?? null;
  const conditionCluster = parsedRow?.condition_cluster ?? null;
  const conditionConfidence = parsedRow?.condition_confidence != null ? Number(parsedRow.condition_confidence) : null;
  const conditionChips = Array.isArray(parsedRow?.condition_chips) ? parsedRow.condition_chips : [];
  const conditionFlags = parsedRow?.condition_flags ?? null;

  if (!comparableKey) {
    return NextResponse.json(
      {
        error: "parse_pending",
        message: "이 매물은 분석 대기 중이에요 (1~2시간 뒤 다시 시도해주세요).",
        raw: {
          pid,
          source: raw.source,
          name: raw.name,
          price: raw.price,
          thumbnail_url: raw.thumbnail_url,
        },
      },
      { status: 202 },
    );
  }

  // marketBasis + reference + v7 + velocity (회전주기) + pool status
  setStep("fetch_market_stats");
  const [marketStatsResult, marketStatsPerSourceResult, referencePricesResult, v7Result, velocityResult, poolStatusRes] = await Promise.all([
    fetchLatestMarketStats([comparableKey]),
    fetchLatestMarketStatsPerSource([comparableKey]),
    fetchReferencePrices([comparableKey]),
    fetchV7SiblingPresence([comparableKey]),
    fetchLatestMarketVelocity([comparableKey]),
    restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=status,invalidated_reason,score&pid=eq.${pid}&limit=1`,
      { headers },
    ),
  ]);
  const velocityRow = velocityResult.get(comparableKey) ?? null;
  const poolStatusRows = (await poolStatusRes.json()) as PoolStatusRow[];
  const poolStatus = poolStatusRows[0] ?? null;

  setStep("compute_market_basis");
  const marketplaceSource = normalizeMarketplaceSource(raw.source ?? null);
  const marketBasis = marketBasisForCandidate(
    comparableKey,
    raw.sku_name ?? raw.name ?? "",
    marketStatsResult,
    conditionClass,
    referencePricesResult,
    v7Result,
    {
      listingSource: marketplaceSource,
      perSourceMarketStats: marketStatsPerSourceResult,
    },
  );

  // expected profit
  const profit = marketBasis.medianPrice
    ? expectedProfitFromMarketPrice({
        buyPrice: raw.price,
        marketPrice: marketBasis.medianPrice,
        buyShipping: raw.free_shipping ? 0 : 3500,
        marketplaceSource,
      })
    : null;

  // 비교 매물 (같은 comparable_key, top 12)
  // Wave 803h (2026-05-30 사용자 결정 Wave 763 정책 보정):
  //   shoe/clothing 박은 게 comparable_key 박은 게 tier 박힘 (|b_grade 등).
  //   condition_class (mint/clean/normal/worn) 박은 게 옛 layer — 박지 X 박아야 정상.
  //   사용자 비교: 피드 (market-source/route.ts:228) 박은 게 condition_class 박지 X (Wave 763 정확),
  //   시세 조회 (이 endpoint) 박은 게 condition_class=mint filter 박은 게 박은 게 박은 게 — 박지 X 박아야 정상.
  setStep("fetch_comparable_listings");
  const parsedCategory = parsedRow?.category ?? null;
  const isFashionLookup = parsedCategory === "shoe" || parsedCategory === "clothing";
  let comparableFilter = `comparable_key=eq.${encodeURIComponent(comparableKey)}`;
  if (conditionClass && !isFashionLookup) {
    comparableFilter += `&condition_class=eq.${encodeURIComponent(conditionClass)}`;
  }
  const compRes = await restFetch(
    `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,condition_class&${comparableFilter}&limit=200`,
    { headers },
  );
  const compRows = (await compRes.json()) as Array<{ pid: number }>;
  const compPids = compRows.map((r) => r.pid).filter((p) => p !== pid).slice(0, 50);
  let comparableListings: Array<{
    pid: number;
    name: string;
    url: string;
    price: number;
    source: string | null;
    thumbnail_url: string | null;
    listing_state: string;
    first_seen_at: string;
    last_seen_at: string | null;
  }> = [];
  if (compPids.length > 0) {
    // Wave 806 (2026-05-30): stale 차단 — last_seen_at 3일 이상이면 진짜 sold 가능성 ↑
    //   (daangn sweep cron throughput 부족으로 active 매물 49% 가 3~7일 stale).
    //   listing_state=active + last_seen_at > 3d 둘 다 박아 stale-leak 차단.
    // Wave 810a (2026-05-30): 정렬을 first_seen_at.desc → price.desc 로 변경.
    //   사용자 매물 가격 근처 + 더 비싼 매물이 위로 와야 시세 비교 직관적.
    //   기존: 등록 최신순 random → 사용자 입장 가격 뒤죽박죽 ("왜 ₩10K 부터?").
    const staleCutoffIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const compListRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,name,url,price,source,thumbnail_url,listing_state,first_seen_at,last_seen_at&pid=in.(${compPids.join(",")})&listing_state=eq.active&last_seen_at=gte.${encodeURIComponent(staleCutoffIso)}&order=price.desc&limit=12`,
      { headers },
    );
    comparableListings = (await compListRes.json()) as typeof comparableListings;
  }

  // 시세 그래프 (mvp_market_price_daily 14일 추이)
  setStep("fetch_price_daily");
  let priceDaily: Array<{
    date: string;
    active_median_price: number | null;
    sold_median_price: number | null;
    blended_median_price: number | null;
    p25_price: number | null;
    p75_price: number | null;
    active_sample_count: number;
  }> = [];
  // Wave 803h: fashion 박은 게 condition_class 박지 X (tier 단위 박힘, Wave 763 정책).
  const dailyFilter = conditionClass && !isFashionLookup
    ? `comparable_key=eq.${encodeURIComponent(comparableKey)}&condition_class=eq.${encodeURIComponent(conditionClass)}`
    : `comparable_key=eq.${encodeURIComponent(comparableKey)}`;
  const dailyRes = await restFetch(
    `${tableUrl("mvp_market_price_daily")}?select=date,active_median_price,sold_median_price,blended_median_price,p25_price,p75_price,active_sample_count&${dailyFilter}&order=date.desc&limit=14`,
    { headers },
  );
  if (dailyRes.ok) {
    priceDaily = ((await dailyRes.json()) as typeof priceDaily).reverse();
  }

  // Wave 802: pool 자동 등록 — 본 매물이 mvp_candidate_pool 에 없으면 ready 로 insert.
  //   기존 invalidated row 는 건드리지 않음 (cron 의 invalidation reason 존중).
  //   profit 양수일 때만 등록 (음수면 사용자한테도 비추천이므로 skip).
  setStep("register_to_pool");
  let registeredToPool = false;
  if (!poolStatus && profit && profit.min > 0 && marketBasis.medianPrice) {
    try {
      const insertRes = await restFetch(tableUrl("mvp_candidate_pool"), {
        method: "POST",
        headers: { ...serviceHeaders(), Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({
          pid,
          profit_band: 0,
          expected_profit_min: profit.min,
          expected_profit_max: profit.max,
          score: 0,
          confidence: 0.5,
          comparable_key: comparableKey,
          status: "ready",
          exposure_count: 0,
          max_exposure: 3,
          last_verified_at: new Date().toISOString(),
          added_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          category: parsedRow?.category ?? null,
          condition_class: conditionClass ?? "unknown",
        }),
      });
      if (insertRes.ok || insertRes.status === 201) registeredToPool = true;
    } catch (err) {
      // best-effort — pool insert 실패해도 lookup 결과는 그대로 반환.
      console.warn("[lookup] pool register failed:", err instanceof Error ? err.message : err);
    }
  }

  // Wave 799b: 크레딧 차감 — 모든 데이터 fetch 성공 후 (404/202 시 무료)
  setStep("charge_credit");
  const charge = await chargeLookupCredit(user, userRef);
  if (!charge.ok) {
    return NextResponse.json(
      {
        error: "insufficient_credits",
        message: "5번째 조회에서 1크레딧이 필요해요. 크레딧을 충전하면 계속 조회할 수 있어요.",
        balance: charge.balance,
        lookupsUsed: charge.lookupsUsed,
      },
      { status: 402 },
    );
  }

  return NextResponse.json({
    ok: true,
    creditInfo: {
      charged: charge.charged,
      balance: charge.balance,
      lookupsUsed: charge.lookupsUsed,
      lookupsPerCredit: LOOKUPS_PER_CREDIT,
    },
    raw: {
      pid,
      source: raw.source,
      url: raw.url,
      name: raw.name,
      price: raw.price,
      sku_id: raw.sku_id,
      sku_name: raw.sku_name,
      thumbnail_url: raw.thumbnail_url,
      shop_review_rating: raw.shop_review_rating,
      shop_review_count: raw.shop_review_count,
      free_shipping: raw.free_shipping,
      listing_state: raw.listing_state,
      sale_status: raw.sale_status,
      first_seen_at: raw.first_seen_at,
      daangn_region_name: raw.daangn_region_name,
      description_preview: raw.description_preview,
      image_count: raw.image_count,
    },
    comparableKey,
    conditionClass,
    conditionTier,
    conditionCluster,
    conditionConfidence,
    conditionChips,
    conditionFlags,
    category: parsedRow?.category ?? null,
    marketBasis,
    profit,
    comparableListings,
    priceDaily,
    velocity: velocityRow
      ? {
          confidence: velocityRow.confidence,
          observedSoldSampleCount: Number(velocityRow.observed_sold_sample_count ?? 0),
          activeSampleCount: Number(velocityRow.active_sample_count ?? 0),
          sold24hCount: Number(velocityRow.sold_24h_count ?? 0),
          sold7dCount: Number(velocityRow.sold_7d_count ?? 0),
          medianHoursToSold: velocityRow.median_hours_to_sold,
          p25HoursToSold: velocityRow.p25_hours_to_sold,
          p75HoursToSold: velocityRow.p75_hours_to_sold,
        }
      : null,
    poolStatus: poolStatus
      ? {
          status: poolStatus.status,
          invalidatedReason: poolStatus.invalidated_reason,
          score: poolStatus.score != null ? Number(poolStatus.score) : null,
          registeredJustNow: false,
        }
      : registeredToPool
        ? { status: "ready", invalidatedReason: null, score: null, registeredJustNow: true }
        : null,
  });
}
