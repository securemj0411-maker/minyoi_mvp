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

    const caughtRes = await restFetch(
      `${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.invalidated&updated_at=gte.${encodeURIComponent(todayIso)}`,
      { headers: { ...headers, Prefer: "count=exact" } },
    );

    // Supabase REST: Content-Range header에 total count
    function parseCount(res: Response): number {
      const range = res.headers.get("content-range") ?? "";
      const m = range.match(/\/(\d+)$/);
      return m ? Number(m[1]) : 0;
    }

    const caughtToday = parseCount(caughtRes);

    return NextResponse.json({
      caughtToday,    // "오늘 N건 잡힘"
      freshLocked: 0, // legacy: 신선 매물 잠금 없음
      freshLagHours: 0,
    }, {
      headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` },
    });
  } catch (err) {
    // Wave launch-15 (audit HIGH): public endpoint 인데 raw err.message 그대로 client 반환했던 거 fix.
    // DB schema / PostgREST 에러 누출 차단. 상세 로그는 서버 console 만.
    console.error("stats/pool failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "stats_unavailable", caughtToday: 0, freshLocked: 0 }, { status: 500 });
  }
}
