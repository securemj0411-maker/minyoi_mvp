// Wave 394.4 (외부 review #3 + 사용자 본인 강조 — USP 정면):
// "어떤 매물 비교했어요?" — 시세 근거 매물 N개 직접 보여주기.
// "/me 운영자풀처럼 시세근거 sample 직접 볼수있으면 진짜 좋을듯" — 사용자 직접 인용.
//
// 패턴: /api/market/history (route 옆) 와 동일. auth 없음. rate-limit.
//
// query:
//   ck (필수): comparable_key
//   cc (옵션): condition_class — fallback chain 적용 (정확 → 같은 그룹 → all)
//   strict=1: fallback 비활성
//   limit (옵션, default 8, max 16)
//   excludePid (옵션): 현재 매물 (모달이 그 자기 자신 보여주는 거 차단)
//
// response:
//   { comparableKey, conditionClass, strictCondition, listings: [...] }
//
// listings 항목:
//   { pid, name, url, thumbnailUrl, price, conditionClass, saleStatus, lastSeenAt }

import { NextResponse, type NextRequest } from "next/server";
import { conditionFallbackChain } from "@/lib/condition-fallback";
import { checkRateLimit, clientIpKey } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 16;
const VALID_CCS = new Set(["unopened", "mint", "clean", "normal", "worn", "low_batt", "flawed", "all"]);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ck = url.searchParams.get("ck")?.trim();
  if (!ck) return NextResponse.json({ error: "missing_ck" }, { status: 400 });
  const cc = url.searchParams.get("cc")?.trim();
  const ccFilter = cc && VALID_CCS.has(cc) ? cc : null;
  const strictCondition = url.searchParams.get("strict") === "1";
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT)) || DEFAULT_LIMIT));
  const excludePidRaw = url.searchParams.get("excludePid");
  const excludePid = excludePidRaw ? Number(excludePidRaw) : null;

  // Wave 394.4: comparable_key 알면 누구나 호출 가능 → /api/market/history 와 동일한 30 req/60s.
  const rate = await checkRateLimit({
    bucketKey: `market-comparable:${clientIpKey(req)}`,
    maxRequests: 30,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    // fallback chain — 정확 cc 우선, 점진적으로 같은 그룹 / all.
    // strict=1이면 정확 cc만.
    const fallbackChain = ccFilter ? (strictCondition ? [ccFilter] : conditionFallbackChain(ccFilter)) : null;

    // overfetch — fallback 각 단계 시도해서 limit 채울 때까지.
    // 한 번에 N×3 정도 가져와서 JS 에서 fallback 순서대로 채움.
    const overfetchLimit = Math.min(MAX_LIMIT * 3, 48);

    // active + sold 모두 — 시세 근거니까 둘 다 의미 있음.
    // sale_status IN ('ready', 'reserved', 'sold') — 'unverified' 제외 (검증 안 된 매물).
    const baseSelect = "pid,name,url,thumbnail_url,price,condition_class,sale_status,last_seen_at,sold_at";

    let queryUrl = `${tableUrl("mvp_listings")}?select=${baseSelect}&comparable_key=eq.${encodeURIComponent(ck)}&sale_status=in.(ready,reserved,sold)&price=gt.0&order=price.asc&limit=${overfetchLimit}`;
    if (excludePid && Number.isFinite(excludePid)) {
      queryUrl += `&pid=neq.${excludePid}`;
    }

    const res = await restFetch(queryUrl, { headers: serviceHeaders() });
    if (!res.ok) {
      console.error("[market/comparable-listings] fetch failed", res.status);
      return NextResponse.json({ error: "comparable_fetch_failed" }, { status: 500 });
    }

    const rows = (await res.json()) as Array<{
      pid: number;
      name: string | null;
      url: string | null;
      thumbnail_url: string | null;
      price: number | null;
      condition_class: string | null;
      sale_status: string | null;
      last_seen_at: string | null;
      sold_at: string | null;
    }>;

    // condition fallback — 정확 cc → 같은 그룹 → all.
    let picked: typeof rows = [];
    if (fallbackChain) {
      const seen = new Set<number>();
      for (const target of fallbackChain) {
        for (const r of rows) {
          if (seen.has(r.pid)) continue;
          if (r.condition_class === target) {
            picked.push(r);
            seen.add(r.pid);
            if (picked.length >= limit) break;
          }
        }
        if (picked.length >= limit) break;
      }
      // fallback chain 다 돌고도 부족하면 strict=0 일 때 남은 매물 추가.
      if (!strictCondition && picked.length < limit) {
        for (const r of rows) {
          if (seen.has(r.pid)) continue;
          picked.push(r);
          seen.add(r.pid);
          if (picked.length >= limit) break;
        }
      }
    } else {
      picked = rows.slice(0, limit);
    }

    return NextResponse.json({
      comparableKey: ck,
      conditionClass: ccFilter,
      strictCondition,
      listings: picked.map((r) => ({
        pid: r.pid,
        name: r.name,
        url: r.url,
        thumbnailUrl: r.thumbnail_url,
        price: r.price,
        conditionClass: r.condition_class,
        saleStatus: r.sale_status,
        lastSeenAt: r.last_seen_at,
        soldAt: r.sold_at,
      })),
    });
  } catch (err) {
    console.error("[market/comparable-listings] error", err);
    return NextResponse.json({ error: "comparable_fetch_failed" }, { status: 500 });
  }
}
