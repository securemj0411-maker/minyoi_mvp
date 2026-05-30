// Wave 799 (2026-05-30): URL 입력 시세 조회 API.
//   사용자가 번장/중나/당근 매물 URL 입력 → DB 조회 → 시세/매입가/예상수익/비교매물/그래프 반환.
//   DB 안 매물만 조회 (live fetch X). 표본 부족하면 명시.

import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import {
  fetchLatestMarketStats,
  fetchLatestMarketStatsPerSource,
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
};

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

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const inputUrl = (body.url ?? "").trim();
  if (!inputUrl) {
    return NextResponse.json({ error: "no_url", message: "URL 을 입력해주세요." }, { status: 400 });
  }

  const parsed = parseListingUrl(inputUrl);
  if (!parsed) {
    return NextResponse.json(
      {
        error: "unsupported_url",
        message: "번개장터, 중고나라, 당근마켓 URL 만 지원해요.",
      },
      { status: 400 },
    );
  }

  // DB 매물 조회 — url 컬럼 ILIKE 검색
  // (크레딧 차감은 성공 응답 직전에 — 404/202 시 무료)
  const headers = serviceHeaders();
  const escapedKey = parsed.key.replace(/[%_]/g, "\\$&");
  const urlFilter = `url=ilike.*${encodeURIComponent(escapedKey)}*`;
  const rawRes = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid,source,url,name,price,sku_id,sku_name,thumbnail_url,shop_review_rating,shop_review_count,free_shipping,listing_state,sale_status,first_seen_at,daangn_region_id,daangn_region_name,raw_json,description_preview,image_count&${urlFilter}&limit=1`,
    { headers },
  );
  const rawRows = (await rawRes.json()) as RawListing[];
  if (!rawRes.ok || rawRows.length === 0) {
    return NextResponse.json(
      {
        error: "not_found",
        message: "미뇨이 DB 에서 이 매물을 찾을 수 없어요. 새 매물이거나 우리 풀에 안 들어온 매물이에요.",
        source: parsed.source,
        key: parsed.key,
      },
      { status: 404 },
    );
  }
  const raw = rawRows[0];
  const pid = raw.pid;

  // Parsed (comparable_key + condition_class)
  const parsedRes = await restFetch(
    `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,condition_class,category&pid=eq.${pid}&limit=1`,
    { headers },
  );
  const parsedRows = (await parsedRes.json()) as ParsedRow[];
  const parsedRow = parsedRows[0] ?? null;
  const comparableKey = parsedRow?.comparable_key ?? null;
  const conditionClass = parsedRow?.condition_class ?? null;

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

  // marketBasis + reference + v7
  const [marketStatsResult, marketStatsPerSourceResult, referencePricesResult, v7Result] = await Promise.all([
    fetchLatestMarketStats([comparableKey]),
    fetchLatestMarketStatsPerSource([comparableKey]),
    fetchReferencePrices([comparableKey]),
    fetchV7SiblingPresence([comparableKey]),
  ]);

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

  // 비교 매물 (같은 comparable_key + condition_class, top 12)
  let comparableFilter = `comparable_key=eq.${encodeURIComponent(comparableKey)}`;
  if (conditionClass) {
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
  }> = [];
  if (compPids.length > 0) {
    const compListRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,name,url,price,source,thumbnail_url,listing_state,first_seen_at&pid=in.(${compPids.join(",")})&listing_state=eq.active&order=first_seen_at.desc&limit=12`,
      { headers },
    );
    comparableListings = (await compListRes.json()) as typeof comparableListings;
  }

  // 시세 그래프 (mvp_market_price_daily 14일 추이)
  let priceDaily: Array<{
    date: string;
    active_median_price: number | null;
    sold_median_price: number | null;
    blended_median_price: number | null;
    p25_price: number | null;
    p75_price: number | null;
    active_sample_count: number;
  }> = [];
  const dailyFilter = conditionClass
    ? `comparable_key=eq.${encodeURIComponent(comparableKey)}&condition_class=eq.${encodeURIComponent(conditionClass)}`
    : `comparable_key=eq.${encodeURIComponent(comparableKey)}`;
  const dailyRes = await restFetch(
    `${tableUrl("mvp_market_price_daily")}?select=date,active_median_price,sold_median_price,blended_median_price,p25_price,p75_price,active_sample_count&${dailyFilter}&order=date.desc&limit=14`,
    { headers },
  );
  if (dailyRes.ok) {
    priceDaily = ((await dailyRes.json()) as typeof priceDaily).reverse();
  }

  // Wave 799b: 크레딧 차감 — 모든 데이터 fetch 성공 후 (404/202 시 무료)
  const charge = await chargeLookupCredit(auth.user, userRef);
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
    category: parsedRow?.category ?? null,
    marketBasis,
    profit,
    comparableListings,
    priceDaily,
  });
}
