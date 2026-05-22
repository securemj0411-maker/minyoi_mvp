import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

// Wave 338 (Phase 1b — 사회적 증명 통계):
// /explore 페이지 상단 배너에 표시.
//
// "오늘 X건 잡힘" = 오늘 invalidated 된 매물 (다른 사용자가 채감, sold-out)
// freshLocked는 이전 "신선 매물 잠금" 정책의 legacy 필드.
// 현재 정책은 6h 신선 매물 차단이 아니라 무료 2h 쿨다운 vs 크레딧 보유자 무제한 피드다.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_SECONDS = 60;

export async function GET() {
  try {
    const headers = serviceHeaders();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();
    const last24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    function parseCount(res: Response): number {
      const range = res.headers.get("content-range") ?? "";
      const m = range.match(/\/(\d+)$/);
      return m ? Number(m[1]) : 0;
    }

    // Wave launch-32 (사용자 짚음): 빈 상태에 "왜 이게 전부인지" 신뢰 메시지.
    // 추적 중인 매물 / 오늘 거른 매물 / 24h 신선 매물 카운트 모두 fetch.
    const [caughtRes, trackedRes, scannedTodayRes, freshRes] = await Promise.all([
      restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.invalidated&updated_at=gte.${encodeURIComponent(todayIso)}`,
        { headers: { ...headers, Prefer: "count=exact" } },
      ),
      // 우리가 추적 중 (mvp_raw_listings 전체 — listing_state=active)
      restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid&listing_state=eq.active`,
        { headers: { ...headers, Prefer: "count=exact" } },
      ),
      // 오늘 우리 시스템이 분류한 매물 (mvp_listing_parsed 오늘 박힌 거)
      restFetch(
        `${tableUrl("mvp_listing_parsed")}?select=pid&parsed_at=gte.${encodeURIComponent(todayIso)}`,
        { headers: { ...headers, Prefer: "count=exact" } },
      ),
      // 최근 24h 신선 매물 (listing_state=active + last_seen 24h)
      restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid&listing_state=eq.active&last_seen_at=gte.${encodeURIComponent(last24hIso)}`,
        { headers: { ...headers, Prefer: "count=exact" } },
      ),
    ]);

    const caughtToday = parseCount(caughtRes);
    const totalTracked = parseCount(trackedRes);
    const scannedToday = parseCount(scannedTodayRes);
    const freshLast24h = parseCount(freshRes);

    return NextResponse.json({
      caughtToday,    // "오늘 N건 잡힘"
      totalTracked,   // 우리가 추적 중인 active 매물 총 수
      scannedToday,   // 오늘 분류된 매물 수 (AI parser 작동량)
      freshLast24h,   // 최근 24h 안 신선 매물
      freshLocked: 0, // legacy: 신선 매물 잠금 없음
      freshLagHours: 0,
    }, {
      headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` },
    });
  } catch (err) {
    console.error("stats/pool failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "stats_unavailable", caughtToday: 0, freshLocked: 0 }, { status: 500 });
  }
}
