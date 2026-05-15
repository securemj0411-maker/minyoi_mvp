// Wave 129 (2026-05-16): 위험 매물 차단 카운터 — L4 (사업 보고서).
// "이번 주 위험 매물 X건 차단됨" 사용자 dashboard 표시.
// retention killer — "내 50만원 잃을 뻔한 거 막아줬다" 감정.
import { NextResponse } from "next/server";
import { restFetch, serviceHeaders } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const URL_BASE = SUPABASE_URL.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";

function rpc(path: string, query: string) {
  return `${URL_BASE}/${path}?${query}`;
}

export async function GET() {
  try {
    const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    // 4가지 위험 차단 source (각각 head=true count 사용 — body fetch X)
    const [priceDummyRes, fakeLockRes, carrierRes, poolInvalidateRes] = await Promise.all([
      // 1) 가격 dummy (셀러 거래 거부 표시 매물)
      restFetch(
        rpc("mvp_raw_listings", `select=pid&price=gte.10000000&first_seen_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 2) 가품/잠금 keyword 매물
      restFetch(
        rpc("mvp_raw_listings", `select=pid&first_seen_at=gte.${since7d}&or=(name.ilike.*차이팟*,name.ilike.*짝퉁*,name.ilike.*레플리카*,name.ilike.*이미테이션*,name.ilike.*아이클라우드*,name.ilike.*잠김*,name.ilike.*분실폰*)`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 3) 통신사 약정/할부 매물 (자급제 lane reject)
      restFetch(
        rpc("mvp_raw_listings", `select=pid&first_seen_at=gte.${since7d}&or=(name.ilike.*kt%20약정*,name.ilike.*skt%20완납*,name.ilike.*할부%20잔여*,name.ilike.*개통폰*)`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
      // 4) pool invalidate (lifecycle/profit/시세 confidence)
      restFetch(
        rpc("mvp_candidate_pool", `select=pid&invalidated_reason=not.is.null&updated_at=gte.${since7d}`),
        { headers: { ...serviceHeaders(), Prefer: "count=exact" }, method: "HEAD" },
      ),
    ]);

    // PostgREST count는 Content-Range header에 박혀있음. 형식: "0-X/total"
    const parseCount = (res: Response): number => {
      const range = res.headers.get("content-range") ?? "";
      const totalStr = range.split("/")[1];
      return totalStr ? Number(totalStr) : 0;
    };

    const priceDummy = parseCount(priceDummyRes);
    const fakeLock = parseCount(fakeLockRes);
    const carrier = parseCount(carrierRes);
    const poolInvalidate = parseCount(poolInvalidateRes);

    const safetyTotal = priceDummy + fakeLock + carrier;
    const totalBlocked7d = safetyTotal + poolInvalidate;

    return NextResponse.json({
      stats: {
        // 사용자 표시용 핵심 숫자 — 이번 주 차단 매물 총합
        total_blocked_7d: totalBlocked7d,
        // 카테고리별 breakdown
        price_dummy_7d: priceDummy,
        fake_or_lock_7d: fakeLock,
        carrier_mismatch_7d: carrier,
        pool_invalidated_7d: poolInvalidate,
        // 메타
        period_start: since7d,
        period_end: new Date().toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 500 },
    );
  }
}
