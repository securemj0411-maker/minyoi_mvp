import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { fetchDetail } from "@/lib/bunjang";
import { loadCategoryReadinessMap } from "@/lib/category-readiness";
import {
  fetchReferencePrices,
  fetchLatestMarketStats,
  fetchLatestMarketVelocity,
  marketBasisForCandidate,
  velocityBasisForCandidate,
} from "@/lib/pack-open";
import type { RevealMarketBasis, RevealVelocityBasis } from "@/lib/pack-open";
import { checkRateLimit } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { detectSoldOut, describeSignals, isSoldOut } from "@/lib/sold-out";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

// Wave 205: /me에서는 terminal state도 응답에 남겨 "판매완료 상품" tombstone으로 표시한다.
const TERMINAL_STATES = new Set(["sold", "sold_confirmed", "disappeared"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_USER_REF = 64;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_REVEAL_SCAN = 500;
const LIVE_VERIFY_CONCURRENCY = 4;
const RATE_LIMIT_MAX = Math.max(1, Number(process.env.PACKS_ME_RATE_LIMIT_MAX ?? 10));
const RATE_LIMIT_WINDOW_SECONDS = Math.max(1, Number(process.env.PACKS_ME_RATE_LIMIT_WINDOW_SECONDS ?? 10));

type RevealSort = "latest" | "oldest" | "price_low" | "price_high" | "profit_low" | "profit_high";

type RevealRow = {
  pid: number;
  pack_open_id: number | null;
  source?: string | null;
  expected_profit_min: number;
  expected_profit_max: number;
  // Wave 190 (2026-05-18): 시세 갱신 시 자동 sync 되는 current profit + 무효화 timestamp.
  current_profit_min: number | null;
  current_profit_max: number | null;
  market_invalidated_at: string | null;
  confidence: number;
  link_clicked_at: string | null;
  revealed_at: string;
};

type PackOpenRow = {
  id: number;
  band_requested: number;
};

type RawRow = {
  pid: number;
  name: string;
  url: string;
  price: number;
  num_faved: number;
  free_shipping: boolean;
  description_preview: string;
  shop_review_rating: number | null;
  shop_review_count: number;
  sku_id: string | null;
  thumbnail_url: string | null;
  sku_name: string | null;
  listing_state: string;
  sale_status: string;
};

type ParsedRow = {
  pid: number;
  comparable_key: string | null;
};

type FeedbackRow = {
  pid: number;
  feedback_type: string;
  note: string;
};

type RevealItem = {
  pid: number;
  name: string;
  url: string;
  price: number;
  favoriteCount: number | null;
  freeShipping: boolean;
  descriptionPreview: string;
  sellerUid: string | null;
  sellerName: string | null;
  sellerReviewRating: number | null;
  sellerReviewCount: number;
  skuId: string | null;
  thumbnailUrl: string | null;
  skuName: string | null;
  comparableKey: string | null;
  listingState: string;
  saleStatus: string;
  expectedProfitMin: number;
  expectedProfitMax: number;
  confidence: number;
  band: number;
  revealedAt: string;
  linkClickedAt: string | null;
  feedbackType: string | null;
  feedbackNote: string | null;
  // Wave 89: 다시 보기 모달에도 시세/velocity/flow 보이게 추가.
  marketBasis: RevealMarketBasis | null;
  velocityBasis: RevealVelocityBasis | null;
  skuListingFlow: { count24h: number; avgPerDay7d: number } | null;
  // Wave 182 Phase 3 (2026-05-17): base option fallback metadata — "기본 옵션 가정" UI badge.
  optionBaseAssumed: string[] | null;
  // Wave 189 (2026-05-18): 실시간 시세 vs 매입가 차이 — reveal snapshot (expected_profit_*) 의
  //   stale 문제 표면 fix. marketBasis.medianPrice (실시간) - price (매입가) 단순 raw diff.
  //   음수 = "현재 시세 < 매입가 = 추천 무효 (시세 갱신)". UI 가 이 값으로 badge 분기.
  //   sellFee/shipping 차감 안 함 — 정확한 "기대 수익" 이 아니라 raw 시세 차이 신호.
  //   historical expected_profit (reveal 시점) 는 그대로 유지 — UI 분기 시 둘 다 활용 가능.
  marketGapKrw: number | null;
  marketStale: boolean;  // true = 현재 시세 < 매입가 (사용자 손해 위험 신호)
};

async function loadJson<T>(url: string): Promise<T> {
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as T;
}

function intParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function sortParam(value: string | null): RevealSort {
  if (
    value === "oldest" ||
    value === "price_low" ||
    value === "price_high" ||
    value === "profit_low" ||
    value === "profit_high"
  ) {
    return value;
  }
  return "latest";
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function matchesSearch(item: RevealItem, query: string) {
  if (!query) return true;
  const haystack = [
    item.name,
    item.skuName ?? "",
    item.skuId ?? "",
    item.comparableKey ?? "",
    item.pid.toString(),
    item.listingState,
    item.saleStatus,
    item.feedbackType ?? "",
    item.feedbackNote ?? "",
  ].join(" ").toLocaleLowerCase("ko-KR");
  return haystack.includes(query);
}

function compareItems(sort: RevealSort) {
  return (a: RevealItem, b: RevealItem) => {
    if (sort === "oldest") return Date.parse(a.revealedAt) - Date.parse(b.revealedAt);
    if (sort === "price_low") return a.price - b.price || Date.parse(b.revealedAt) - Date.parse(a.revealedAt);
    if (sort === "price_high") return b.price - a.price || Date.parse(b.revealedAt) - Date.parse(a.revealedAt);
    if (sort === "profit_low") return a.expectedProfitMin - b.expectedProfitMin || Date.parse(b.revealedAt) - Date.parse(a.revealedAt);
    if (sort === "profit_high") return b.expectedProfitMax - a.expectedProfitMax || Date.parse(b.revealedAt) - Date.parse(a.revealedAt);
    return Date.parse(b.revealedAt) - Date.parse(a.revealedAt);
  };
}

function isTerminalListingState(state: string | null | undefined) {
  return TERMINAL_STATES.has(String(state ?? "").toLowerCase());
}

async function patchLiveTerminalState(
  item: RevealItem,
  state: "sold_confirmed" | "disappeared",
  saleStatus: string | null,
  reason: string,
) {
  const now = new Date().toISOString();
  const rawPatch: Record<string, unknown> = {
    listing_state: state,
    updated_at: now,
  };
  if (saleStatus != null) rawPatch.sale_status = saleStatus;
  if (state === "sold_confirmed") rawPatch.sold_detected_at = now;
  if (state === "disappeared") {
    rawPatch.disappeared_at = now;
    rawPatch.last_missing_at = now;
  }

  await Promise.allSettled([
    restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${item.pid}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: JSON.stringify(rawPatch),
    }),
    restFetch(`${tableUrl("mvp_lifecycle_checks")}?pid=eq.${item.pid}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: JSON.stringify({
        status: state,
        last_checked_at: now,
        last_check_result: state === "sold_confirmed" ? "sold" : "missing",
        next_check_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        state_reason: `packs_me_live_${reason}`.slice(0, 240),
        locked_at: null,
        locked_until: null,
        updated_at: now,
      }),
    }),
    restFetch(`${tableUrl("mvp_candidate_pool")}?pid=eq.${item.pid}&status=in.(ready,reserved)`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: JSON.stringify({
        status: "invalidated",
        invalidated_reason: `packs_me_live_${reason}`.slice(0, 120),
        updated_at: now,
      }),
    }),
  ]);
}

async function liveVerifyVisibleItems(items: RevealItem[]): Promise<RevealItem[]> {
  const verified: Array<RevealItem | null> = new Array(items.length).fill(null);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (!item || isTerminalListingState(item.listingState)) {
        verified[index] = item ?? null;
        continue;
      }

      try {
        const detail = await fetchDetail(String(item.pid));
        if (!detail) {
          await patchLiveTerminalState(item, "disappeared", null, "detail_fetch_missing");
          verified[index] = {
            ...item,
            listingState: "sold_confirmed",
            saleStatus: "SOLD_OUT",
          };
          continue;
        }

        const signals = detectSoldOut(detail, item.price, {
          title: item.name,
          description: item.descriptionPreview,
        });
        if (isSoldOut(signals)) {
          const reason = describeSignals(signals);
          await patchLiveTerminalState(item, "sold_confirmed", detail.saleStatus, reason);
          verified[index] = {
            ...item,
            listingState: "sold_confirmed",
            saleStatus: detail.saleStatus || "SOLD_OUT",
          };
          continue;
        }

        verified[index] = {
          ...item,
          listingState: "active",
          saleStatus: detail.saleStatus || item.saleStatus,
        };
      } catch (err) {
        console.error("packs/me live verify failed (non-fatal)", {
          pid: item.pid,
          err: err instanceof Error ? err.message : String(err),
        });
        verified[index] = item;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(LIVE_VERIFY_CONCURRENCY, items.length) }, () => worker()));
  return verified.filter((item): item is RevealItem => item != null);
}

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const userRefRaw = req.headers.get("x-user-ref") ?? url.searchParams.get("userRef");
  const userRef = typeof userRefRaw === "string" ? userRefRaw.trim().slice(0, MAX_USER_REF) : "";
  if (!userRef) return NextResponse.json({ error: "missing user ref" }, { status: 400 });
  if (userRef !== userRefForAuthUser(auth.user.id)) {
    return NextResponse.json({ error: "user ref does not match session" }, { status: 403 });
  }

  if (!isAdminUser(auth.user)) {
    const rate = await checkRateLimit({
      bucketKey: `packs.me:user:${userRef}`,
      maxRequests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: rate.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
  }

  const page = intParam(url.searchParams.get("page"), 1, 1, 10_000);
  const pageSize = intParam(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const sort = sortParam(url.searchParams.get("sort"));
  const query = normalizeSearch(url.searchParams.get("q") ?? "");
  const encodedUserRef = encodeURIComponent(userRef);
  const reveals = await loadJson<RevealRow[]>(
    `${tableUrl("mvp_pack_reveals")}?select=pid,pack_open_id,source,expected_profit_min,expected_profit_max,current_profit_min,current_profit_max,market_invalidated_at,confidence,link_clicked_at,revealed_at&user_ref=eq.${encodedUserRef}&order=revealed_at.desc&limit=${MAX_REVEAL_SCAN}`,
  );
  const pids = [...new Set(reveals.map((row) => Number(row.pid)).filter(Number.isFinite))];
  const packOpenIds = [...new Set(reveals.map((row) => Number(row.pack_open_id)).filter(Number.isFinite))];
  if (pids.length === 0) {
    return NextResponse.json({
      userRef,
      reveals: [],
      page,
      pageSize,
      total: 0,
      totalPages: 1,
      sort,
      query,
    });
  }

  const pidList = pids.join(",");
  const packOpenList = packOpenIds.join(",");
  const [rawRows, feedbackRows, packOpenRows, parsedRows] = await Promise.all([
    loadJson<RawRow[]>(
      `${tableUrl("mvp_raw_listings")}?select=pid,name,url,price,num_faved,free_shipping,description_preview,shop_review_rating,shop_review_count,sku_id,thumbnail_url,sku_name,listing_state,sale_status&pid=in.(${pidList})`,
    ),
    loadJson<FeedbackRow[]>(
      `${tableUrl("mvp_reveal_feedback")}?select=pid,feedback_type,note&user_ref=eq.${encodedUserRef}&pid=in.(${pidList})`,
    ),
    packOpenIds.length > 0
      ? loadJson<PackOpenRow[]>(
          `${tableUrl("mvp_pack_opens")}?select=id,band_requested&id=in.(${packOpenList})`,
        )
      : Promise.resolve([] as PackOpenRow[]),
    loadJson<ParsedRow[]>(
      // Wave 130 (2026-05-16): condition_class 추가 — 매물별 condition에 맞는 시세 표시.
      // Wave 182 Phase 3 (2026-05-17): parsed_json 추가 — option_base_assumed UI badge 표시.
      `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,condition_class,parsed_json&pid=in.(${pidList})`,
    ),
  ]);

  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const feedbackByPid = new Map(feedbackRows.map((row) => [Number(row.pid), row]));
  const bandByOpenId = new Map(packOpenRows.map((row) => [Number(row.id), Number(row.band_requested)]));
  const comparableKeyByPid = new Map(parsedRows.map((row) => [Number(row.pid), row.comparable_key ?? null]));
  // Wave 130: 매물별 condition_class — marketBasisForCandidate에 전달해서 매칭 시세 우선 표시.
  const conditionClassByPid = new Map(
    parsedRows.map((row) => [Number(row.pid), (row as ParsedRow & { condition_class?: string | null }).condition_class ?? null]),
  );
  // Wave 182 Phase 3 (2026-05-17): option_base_assumed by pid — "기본 옵션 가정" UI badge.
  const optionBaseAssumedByPid = new Map<number, string[] | null>(
    parsedRows.map((row) => {
      const pj = (row as ParsedRow & { parsed_json?: Record<string, unknown> | null }).parsed_json;
      const arr = pj?.option_base_assumed;
      return [Number(row.pid), Array.isArray(arr) ? arr as string[] : null];
    }),
  );

  // Wave 104: 핫딜 reveal (source=hotdeal, pack_open_id=null)은 mvp_hotdeal_queue에서 band fetch.
  const hotdealPids = reveals.filter((r) => r.source === "hotdeal").map((r) => Number(r.pid));
  const bandByHotdealPid = new Map<number, number>();
  if (hotdealPids.length > 0) {
    try {
      const hotRows = await loadJson<Array<{ pid: number; band: number | null }>>(
        `${tableUrl("mvp_hotdeal_queue")}?select=pid,band&pid=in.(${hotdealPids.join(",")})`,
      );
      for (const row of hotRows) {
        const b = Number(row.band ?? 0);
        if (Number.isFinite(b) && b > 0) bandByHotdealPid.set(Number(row.pid), b);
      }
    } catch (err) {
      console.error("packs/me hotdeal band fetch failed (non-fatal)", { err: err instanceof Error ? err.message : String(err) });
    }
  }

  // Wave 89: 시세/velocity/skuListingFlow를 다시 보기 모달에도 표시.
  // comparable_key별로 market_price/velocity 한 번에 batch fetch.
  const comparableKeys = [...new Set(parsedRows.map((row) => row.comparable_key).filter((k): k is string => Boolean(k)))];
  const [marketStats, velocityStats, readinessMap, referencePrices] = await Promise.all([
    fetchLatestMarketStats(comparableKeys),
    fetchLatestMarketVelocity(comparableKeys),
    loadCategoryReadinessMap(),
    fetchReferencePrices(comparableKeys),
  ]);

  // skuListingFlow batch (7일 raw_listings count by sku_id)
  const skuIds = [...new Set(rawRows.map((row) => row.sku_id).filter((s): s is string => Boolean(s)))];
  const flowBySkuId = new Map<string, { count24h: number; avgPerDay7d: number }>();
  if (skuIds.length > 0) {
    try {
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const encoded = skuIds.map((s) => encodeURIComponent(s)).join(",");
      const flowRows = await loadJson<Array<{ sku_id: string; created_at: string }>>(
        `${tableUrl("mvp_raw_listings")}?select=sku_id,created_at&sku_id=in.(${encoded})&created_at=gte.${since7d}&limit=20000`,
      );
      const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
      const agg = new Map<string, { count24h: number; total7d: number }>();
      for (const row of flowRows) {
        const entry = agg.get(row.sku_id) ?? { count24h: 0, total7d: 0 };
        entry.total7d += 1;
        if (new Date(row.created_at).getTime() >= cutoff24h) entry.count24h += 1;
        agg.set(row.sku_id, entry);
      }
      for (const [skuId, { count24h, total7d }] of agg) {
        flowBySkuId.set(skuId, { count24h, avgPerDay7d: Math.round((total7d / 7) * 10) / 10 });
      }
    } catch (err) {
      console.error("packs/me skuListingFlow fetch failed (non-fatal)", { err: err instanceof Error ? err.message : String(err) });
    }
  }

  const items = reveals
    .map((reveal): RevealItem => {
      const raw = rawByPid.get(Number(reveal.pid));
      const feedback = feedbackByPid.get(Number(reveal.pid));
      const comparableKey = comparableKeyByPid.get(Number(reveal.pid)) ?? null;
      const skuName = raw?.sku_name ?? null;
      const skuId = raw?.sku_id ?? null;
      // Wave 189 (2026-05-18): 실시간 marketBasis 계산 후 marketGapKrw / marketStale 박음.
      // Wave 190 (2026-05-18): DB 의 current_profit_* / market_invalidated_at 우선 사용.
      //   market-worker 후 RPC `recompute_reveal_current_profits` 가 자동 갱신 (Wave 191).
      //   DB column null 이면 (옛 reveal / 아직 cron 미실행) marketBasis 실시간 계산 fallback.
      const computedMarketBasis = comparableKey
        ? marketBasisForCandidate(
            comparableKey,
            skuName ?? "",
            marketStats,
            conditionClassByPid.get(Number(reveal.pid)) ?? null,
            referencePrices,
          )
        : null;
      const priceNum = Number(raw?.price ?? 0);
      const dbCurrentProfit = reveal.current_profit_min ?? null;
      const dbMarketInvalidatedAt = reveal.market_invalidated_at ?? null;
      const fallbackMedian = computedMarketBasis?.medianPrice ?? null;
      const fallbackGap = fallbackMedian != null && priceNum > 0 ? fallbackMedian - priceNum : null;
      // Wave 203 (2026-05-18): unopened + reference price is the display source of truth.
      // current_profit RPC can lag or be based on market_price_daily, so avoid mixing a
      // Danawa/reference median with a Bunjang-derived current_profit on /me cards.
      const usesReferenceAnchor = Boolean(
        computedMarketBasis?.priceSource === "reference",
      );
      const marketGapKrw = usesReferenceAnchor
        ? fallbackGap
        : (dbCurrentProfit != null ? dbCurrentProfit : fallbackGap);
      const marketStale = usesReferenceAnchor
        ? (marketGapKrw != null && marketGapKrw < 0)
        : (dbMarketInvalidatedAt != null ? true : (marketGapKrw != null && marketGapKrw < 0));
      return {
        pid: Number(reveal.pid),
        name: raw?.name ?? `PID ${reveal.pid}`,
        url: raw?.url ?? `https://m.bunjang.co.kr/products/${reveal.pid}`,
        price: Number(raw?.price ?? 0),
        favoriteCount: raw ? Number(raw.num_faved ?? 0) : null,
        freeShipping: Boolean(raw?.free_shipping),
        descriptionPreview: raw?.description_preview ?? "",
        sellerUid: null,
        sellerName: null,
        sellerReviewRating: raw?.shop_review_rating == null ? null : Number(raw.shop_review_rating),
        sellerReviewCount: Number(raw?.shop_review_count ?? 0),
        skuId,
        thumbnailUrl: raw?.thumbnail_url ?? null,
        skuName,
        comparableKey,
        listingState: raw?.listing_state ?? "unknown",
        saleStatus: raw?.sale_status ?? "",
        expectedProfitMin: Number(reveal.expected_profit_min ?? 0),
        expectedProfitMax: Number(reveal.expected_profit_max ?? 0),
        confidence: Number(reveal.confidence ?? 0),
        band: reveal.source === "hotdeal"
          ? (bandByHotdealPid.get(Number(reveal.pid)) ?? 3)
          : (bandByOpenId.get(Number(reveal.pack_open_id)) ?? 2),
        revealedAt: reveal.revealed_at,
        linkClickedAt: reveal.link_clicked_at,
        feedbackType: feedback?.feedback_type ?? null,
        feedbackNote: feedback?.note ?? null,
        // Wave 130 (2026-05-16): 매물 condition_class 전달 → 매칭되는 시세 우선 표시 (사업 보고서 L2).
        marketBasis: computedMarketBasis,
        velocityBasis: velocityBasisForCandidate(comparableKey, velocityStats, readinessMap),
        skuListingFlow: skuId ? flowBySkuId.get(skuId) ?? null : null,
        // Wave 182 Phase 3 (2026-05-17): option_base_assumed — "기본 옵션 가정" UI badge.
        optionBaseAssumed: optionBaseAssumedByPid.get(Number(reveal.pid)) ?? null,
        // Wave 189 (2026-05-18): 실시간 시세 - 매입가.
        marketGapKrw,
        marketStale,
      };
    })
    .filter((item) => matchesSearch(item, query))
    .sort(compareItems(sort));

  const initialTotal = items.length;
  const totalPagesBeforeLive = Math.max(1, Math.ceil(initialTotal / pageSize));
  const safePageBeforeLive = Math.min(page, totalPagesBeforeLive);
  const start = (safePageBeforeLive - 1) * pageSize;
  const liveSlice = items.slice(start, start + pageSize);
  const liveVerified = await liveVerifyVisibleItems(liveSlice);

  const pageItems = liveVerified.slice(0, pageSize);
  const total = initialTotal;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  return NextResponse.json({
    userRef,
    reveals: pageItems,
    page: safePage,
    pageSize,
    total,
    totalPages,
    sort,
    query,
  });
}
