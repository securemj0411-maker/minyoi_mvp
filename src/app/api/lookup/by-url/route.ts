// Wave 799 (2026-05-30): URL 입력 시세 조회 API.
//   사용자가 번장/중나/당근 매물 URL 입력 → DB 조회 → 시세/매입가/예상수익/비교매물/그래프 반환.
//   DB 안 매물만 조회 (live fetch X). 표본 부족하면 명시.

import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { COMPARABLE_EXCLUDE_NOTES } from "@/lib/condition-policy";
import {
  fetchLatestMarketStats,
  fetchLatestMarketStatsPerSource,
  fetchLatestMarketVelocity,
  fetchReferencePrices,
  fetchV7SiblingPresence,
  marketBasisForCandidate,
  velocityBasisForCandidate,
} from "@/lib/pack-open";
import { loadCategoryReadinessMap } from "@/lib/category-readiness";
import { expectedProfitFromMarketPrice } from "@/lib/profit";
import { normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { checkRateLimit } from "@/lib/rate-limit";
import { userRefForAuthUser } from "@/lib/user-ref";
import { spendUserCredits, getUserCreditsReadOnly } from "@/lib/user-credits";
import type { User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/auth-users";
import { liveIngestFromParsedUrl, type LiveIngestSource } from "@/lib/live-ingest";

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
 * Wave 979 (2026-05-31): live-ingest 실패 사유별 사용자 메시지.
 */
function liveIngestFailureHint(
  reason: string,
  source: string,
  originalKey: string,
  resolvedSlug: string | null,
): string {
  if (reason === "blocked") return " 해당 사이트가 일시적으로 접근을 차단했어요. 잠시 후 다시 시도해주세요.";
  if (reason === "fetch_failed") return " 매물 페이지를 불러오지 못했어요. URL 이 올바른지 확인해주세요.";
  if (reason === "parse_failed") return " 매물 정보를 분석하지 못했어요. URL 이 올바른지 확인해주세요.";
  if (reason === "not_a_product") return " 매물 정보를 찾지 못했어요 (판매 종료/삭제됐을 수 있어요).";
  if (reason === "unsupported_source") return " 지원하지 않는 사이트예요.";
  if (reason === "upsert_failed") return " 매물을 등록하는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
  if (source === "daangn" && /^\d+$/.test(originalKey) && !resolvedSlug) {
    return " 당근 공유 URL 을 분석하지 못했어요 — 매물 상세 화면의 주소를 그대로 붙여넣어 보세요.";
  }
  return " 새 매물이거나 아직 우리 풀에 들어오지 않았어요.";
}

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

  // Wave 803j (2026-05-30): SSE streaming — 사용자 보고 "게이지바 100% 박은 후 5-10초 대기".
  //   Accept: text/event-stream 박은 게 박은 게 SSE 박은 게. 기존 JSON 응답 backward compat 그대로.
  //   server 박은 게 setStep 박은 게 박은 게 박은 게 client 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게.
  const wantsStream = (req.headers.get("accept") ?? "").includes("text/event-stream");

  if (!wantsStream) {
    // 기존 JSON 응답 — backward compat (mobile / old client / curl).
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

  // SSE streaming branch.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller 박은 게 박은 게 박은 게 박은 게 (client 박은 게 박은 게 박은 게 박은 게 등) — silent.
          closed = true;
        }
      };
      // heartbeat (15s 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게) — Vercel/Cloudflare 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`: ping\n\n`)); } catch { closed = true; }
      }, 15_000);

      let currentStep = "init";
      try {
        const response = await runLookup(req, auth.user, userRef, (s) => {
          currentStep = s;
          send("step", { step: s });
        });
        const status = response.status;
        const body = await response.json().catch(() => ({}));
        send("done", { status, body });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[lookup-by-url-stream] step=${currentStep} error=`, errorMessage, err instanceof Error ? err.stack : undefined);
        send("done", {
          status: 500,
          body: {
            error: "internal",
            message: `처리 중 오류가 발생했어요 (${currentStep}). 잠시 후 다시 시도해주세요.`,
            step: currentStep,
            detail: errorMessage,
          },
        });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try { controller.close(); } catch { /* ignore */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
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
  // Wave 803k (2026-05-30): daangn URL ILIKE 박은 게 박은 게 박은 게 statement timeout (11s) → 6ms.
  //   원인: mvp_raw_listings.url 박은 게 박은 게 박은 게 박은 게 박은 게 0개. 874K row × 2GB full scan.
  //   Fix (DB): partial trigram GIN index 박음 (WHERE source = 'daangn').
  //   Fix (코드): query 박은 게 박은 게 박은 게 source=eq.daangn 박은 게 박은 게 박은 게 partial index 박은 게.
  const filter = (parsed.source === "bunjang" || parsed.source === "joongna") && isNumericKey
    ? `pid=eq.${searchKey}&source=eq.${parsed.source}`
    : (() => {
        const escapedKey = searchKey.replace(/[%_]/g, "\\$&");
        // Wave 803k: source=eq.${source} 박은 게 박은 게 박은 게 박은 게 daangn partial index 박은 게.
        return `source=eq.${parsed.source}&url=ilike.*${encodeURIComponent(escapedKey)}*`;
      })();
  const rawRes = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=${selectCols}&${filter}&limit=1`,
    { headers },
  );
  let rawRows = (await rawRes.json()) as RawListing[];
  let freshlyIngested = false;
  if (!rawRes.ok || rawRows.length === 0) {
    // Wave 979 (2026-05-31): DB 미존재 → live fetch + ingest → 재조회.
    //   기존엔 404 로 끝났음. 사용자 입장에서 "DB 에 없는 매물은 시세도 못 봄" 불편.
    //   3 source (번장/중나/당근) 다 시도. 카탈로그 매칭 + parser 통과 → raw/parsed upsert.
    //   ingest 실패 (fetch_failed/blocked/parse_failed/not_a_product) 시 명확한 404 메시지.
    setStep("live_ingest");
    const ingest = await liveIngestFromParsedUrl({
      source: parsed.source as LiveIngestSource,
      key: searchKey,
    });
    if (!ingest.ok) {
      const baseMsg = "미뇨이 DB 에서 이 매물을 찾을 수 없어요.";
      const hint = liveIngestFailureHint(ingest.reason, parsed.source, parsed.key, resolvedSlug);
      return NextResponse.json(
        {
          error: "not_found",
          message: baseMsg + hint,
          source: parsed.source,
          key: parsed.key,
          resolvedSlug,
          liveIngestReason: ingest.reason,
        },
        { status: 404 },
      );
    }
    // 재조회 — ingest pid 로 정확히 가져오기.
    setStep("refetch_after_ingest");
    const refetchRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=${selectCols}&pid=eq.${ingest.pid}&limit=1`,
      { headers },
    );
    rawRows = (await refetchRes.json()) as RawListing[];
    if (!refetchRes.ok || rawRows.length === 0) {
      return NextResponse.json(
        {
          error: "ingest_race",
          message: "매물을 새로 등록했지만 다시 읽어오지 못했어요. 잠시 후 다시 시도해주세요.",
          source: parsed.source,
          key: parsed.key,
        },
        { status: 500 },
      );
    }
    freshlyIngested = true;
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
    // Wave 979: live-ingest 직후 매칭 실패 = catalog 에 모델 없음 (단순 대기 X). 메시지 분리.
    const message = freshlyIngested
      ? "이 매물은 카탈로그에 등록된 모델이 아니라 시세를 계산할 수 없어요. (지원 카테고리: 이어폰/스마트워치/태블릿/노트북/데스크탑/모니터/스피커/가전)"
      : "이 매물은 분석 대기 중이에요 (1~2시간 뒤 다시 시도해주세요).";
    return NextResponse.json(
      {
        error: freshlyIngested ? "not_in_catalog" : "parse_pending",
        message,
        freshlyIngested,
        raw: {
          pid,
          source: raw.source,
          name: raw.name,
          price: raw.price,
          thumbnail_url: raw.thumbnail_url,
        },
      },
      { status: freshlyIngested ? 422 : 202 },
    );
  }

  // marketBasis + reference + v7 + velocity (회전주기) + pool status
  setStep("fetch_market_stats");
  const [marketStatsResult, marketStatsPerSourceResult, referencePricesResult, v7Result, velocityResult, readinessMap, poolStatusRes] = await Promise.all([
    fetchLatestMarketStats([comparableKey]),
    fetchLatestMarketStatsPerSource([comparableKey]),
    fetchReferencePrices([comparableKey]),
    fetchV7SiblingPresence([comparableKey]),
    fetchLatestMarketVelocity([comparableKey]),
    loadCategoryReadinessMap(),
    restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=status,invalidated_reason,score&pid=eq.${pid}&limit=1`,
      { headers },
    ),
  ]);
  const velocityBasis = velocityBasisForCandidate(comparableKey, velocityResult, readinessMap, conditionClass);
  const poolStatusRows = (await poolStatusRes.json()) as PoolStatusRow[];
  const poolStatus = poolStatusRows[0] ?? null;

  setStep("compute_market_basis");
  const marketplaceSource = normalizeMarketplaceSource(raw.source ?? null);
  // Wave 817 (2026-05-30): tier 인자 직접 전달. fashion 임시 봉합 (cc="") 제거.
  //   pickByConditionFallback 가 tier 기반 정확 매칭 (fashion) 또는 cc fallback (non-fashion).
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
    conditionTier,
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

  // 비교 매물 — Wave 886.15 (2026-05-27): /api/listings/[pid]/market-source 와 동일 필터 적용 (통일).
  //   사용자 짚음: "같은 상품에 비교매물이 다른데?" — lookup 과 detail 모달이 다른 필터 → 다른 결과.
  //   변경: needs_review=false, COMPARABLE_EXCLUDE_NOTES, condition strict-with-fallback,
  //         shoe/clothing tier eq 필터 추가. listing_state=active + 3d 최신 유지 (lookup 만의 안전망).
  //   Wave 810a price.desc 정렬도 유지 (사용자 직관 우선).
  // Wave 818b revert (2026-05-30): detail_status 필터 시도했으나 컬럼이 mvp_raw_listings 에만 있고
  //   mvp_listing_parsed 에 없어서 PostgREST 400. raw_listings 쪽에서 filter 후 join 필요 — 별도 wave.
  setStep("fetch_comparable_listings");
  const sameKeyPidsRes = await restFetch(
    `${tableUrl("mvp_listing_parsed")}?select=pid,condition_class,condition_tier,condition_notes,parsed_json&comparable_key=eq.${encodeURIComponent(comparableKey)}&needs_review=eq.false&limit=480`,
    { headers },
  );
  const sameKeyParsedRows = (await sameKeyPidsRes.json()) as Array<{
    pid: number;
    condition_class: string | null;
    condition_tier: string | null;
    condition_notes: string[] | null;
    parsed_json: Record<string, unknown> | null;
  }>;
  const parsedCategory = parsedRow?.category ?? null;
  const isFashionLookup = parsedCategory === "shoe" || parsedCategory === "clothing";
  // condition strict-with-fallback: 같은 class 5+ 면 strict, 적으면 모두 표시 (Wave 896 정책).
  const strictConditionSampleCount = conditionClass == null
    ? 0
    : sameKeyParsedRows.filter((p) => p.condition_class === conditionClass).length;
  const requireKnownCondition = conditionClass != null && strictConditionSampleCount >= 5;
  const keepPids = new Set<number>();
  for (const p of sameKeyParsedRows) {
    if (Number(p.pid) === pid) continue;
    const parsedJsonNotes = (p.parsed_json?.condition_notes as string[] | undefined) ?? [];
    const notes = p.condition_notes ?? parsedJsonNotes;
    if (COMPARABLE_EXCLUDE_NOTES.some((n) => notes.includes(n))) continue;
    // condition_class strict-with-fallback (Wave 130/896 + market-source 동일).
    if (conditionClass != null) {
      if (p.condition_class == null && requireKnownCondition) continue;
      if (p.condition_class != null && p.condition_class !== conditionClass) continue;
    }
    // shoe/clothing 5-tier 분리 (market-source 동일 정책).
    if (
      isFashionLookup
      && conditionTier != null
      && conditionTier !== "UNKNOWN"
      && p.condition_tier != null
      && p.condition_tier !== "UNKNOWN"
      && p.condition_tier !== conditionTier
    ) continue;
    keepPids.add(Number(p.pid));
  }
  const compPids = Array.from(keepPids).slice(0, 80);
  let comparableListings: Array<{
    pid: number;
    name: string;
    url: string;
    price: number;
    source: string | null;
    thumbnail_url: string | null;
    listing_state: string;
    sold_detected_at: string | null;
    first_seen_at: string;
    last_seen_at: string | null;
  }> = [];
  if (compPids.length > 0) {
    // Wave 806 (2026-05-30): stale 차단 — listing_state=active + last_seen 3d.
    // Wave 810a (2026-05-30): price.desc 정렬 (사용자 직관 우선).
    // Wave 983 (2026-05-31): sold 매물 포함. "팔린 게 시세" 사용자 정책.
    //   active = 호가 (현재 3d 이내 fresh)
    //   sold = 실제 거래가 (14d 이내, sold_detected_at 기준 — 14일 지난 sold 는 시세 의미 약함)
    //   listing_state.in.(active,sold_confirmed) + 각각 fresh filter.
    const staleCutoffIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const soldCutoffIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const stateFilter = `or(and(listing_state.eq.active,last_seen_at.gte.${encodeURIComponent(staleCutoffIso)}),and(listing_state.eq.sold_confirmed,sold_detected_at.gte.${encodeURIComponent(soldCutoffIso)}))`;
    const compListRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,name,url,price,source,thumbnail_url,listing_state,sold_detected_at,first_seen_at,last_seen_at&pid=in.(${compPids.join(",")})&listing_type=eq.normal&and=(${stateFilter})&order=listing_state.asc,price.desc&limit=20`,
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
    freshlyIngested,
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
    velocity: velocityBasis
      ? {
          confidence: velocityBasis.confidence,
          conditionClass: velocityBasis.conditionClass,
          conditionSpecific: velocityBasis.conditionSpecific,
          observedSoldSampleCount: velocityBasis.observedSoldSampleCount,
          activeSampleCount: velocityBasis.activeSampleCount,
          sold24hCount: velocityBasis.sold24hCount,
          sold7dCount: velocityBasis.sold7dCount,
          medianHoursToSold: velocityBasis.medianHoursToSold,
          p25HoursToSold: velocityBasis.p25HoursToSold,
          p75HoursToSold: velocityBasis.p75HoursToSold,
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
