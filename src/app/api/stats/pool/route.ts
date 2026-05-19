import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

// Wave 338 (Phase 1b — 사회적 증명 통계):
// /explore 페이지 상단 배너에 표시.
//
// "오늘 X건 잡힘" = 오늘 invalidated 된 매물 (다른 사용자가 채감, sold-out)
// "Y건 놓침" = 무료 사용자가 못 본 신선 매물 (last_verified_at > NOW() - 6h, 유료 전용 영역)
//
// FOMO 효과: "유료면 6h 전에 X건 잡았을 텐데" 후회 시각화.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_SECONDS = 60;
const FRESH_LAG_HOURS = 6;

export async function GET() {
  try {
    const headers = serviceHeaders();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();
    const sixHoursAgo = new Date(Date.now() - FRESH_LAG_HOURS * 60 * 60 * 1000).toISOString();

    const [caughtRes, freshRes] = await Promise.all([
      // 오늘 invalidated 된 매물 (다른 사용자가 잡았거나 sold out)
      restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.invalidated&updated_at=gte.${encodeURIComponent(todayIso)}`,
        { headers: { ...headers, Prefer: "count=exact" } },
      ),
      // 무료 사용자가 못 본 신선 매물 (6h 미만, 유료 전용 영역)
      restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.ready&last_verified_at=gt.${encodeURIComponent(sixHoursAgo)}`,
        { headers: { ...headers, Prefer: "count=exact" } },
      ),
    ]);

    // Supabase REST: Content-Range header에 total count
    function parseCount(res: Response): number {
      const range = res.headers.get("content-range") ?? "";
      const m = range.match(/\/(\d+)$/);
      return m ? Number(m[1]) : 0;
    }

    const caughtToday = parseCount(caughtRes);
    const freshLocked = parseCount(freshRes);

    return NextResponse.json({
      caughtToday,    // "오늘 N건 잡힘"
      freshLocked,    // "Y건 놓침" (무료 사용자가 못 본 신선 매물)
      freshLagHours: FRESH_LAG_HOURS,
    }, {
      headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, caughtToday: 0, freshLocked: 0 }, { status: 500 });
  }
}
