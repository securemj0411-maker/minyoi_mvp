import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

// Wave 340: /explore 운영자 모니터링 API.
// 매물 풀 상태 + 사용자 활동 + 카테고리 분포 + profit_band 분포.
// 신규 데이터 수집 없이 기존 DB 쿼리만.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRESH_LAG_HOURS = 6;

type PoolRow = {
  pid: number;
  status: string;
  category: string | null;
  profit_band: number | null;
  last_verified_at: string;
  updated_at: string;
};

type UserRow = {
  user_ref: string;
  last_free_browse_at: string | null;
};

function parseCount(res: Response): number {
  const range = res.headers.get("content-range") ?? "";
  const m = range.match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  try {
    const headers = serviceHeaders();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();
    const sixHoursAgoIso = new Date(Date.now() - FRESH_LAG_HOURS * 60 * 60 * 1000).toISOString();

    // 매물 풀 상태 — count by status + freshness
    const [
      readyTotalRes,
      readyEligibleRes,    // 6h+ 매물 (무료 사용자가 보는 것)
      readyFreshRes,       // 6h 미만 (구독자 전용 영역)
      invalidatedTodayRes,
      spentTodayRes,
      poolRowsRes,         // 카테고리/profit_band 분포용
      browseUsersTodayRes, // 오늘 refresh한 사용자
    ] = await Promise.all([
      restFetch(`${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.ready`, { headers: { ...headers, Prefer: "count=exact" } }),
      restFetch(`${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.ready&last_verified_at=lte.${encodeURIComponent(sixHoursAgoIso)}`, { headers: { ...headers, Prefer: "count=exact" } }),
      restFetch(`${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.ready&last_verified_at=gt.${encodeURIComponent(sixHoursAgoIso)}`, { headers: { ...headers, Prefer: "count=exact" } }),
      restFetch(`${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.invalidated&updated_at=gte.${encodeURIComponent(todayIso)}`, { headers: { ...headers, Prefer: "count=exact" } }),
      restFetch(`${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.spent&updated_at=gte.${encodeURIComponent(todayIso)}`, { headers: { ...headers, Prefer: "count=exact" } }),
      restFetch(`${tableUrl("mvp_candidate_pool")}?select=pid,status,category,profit_band,last_verified_at,updated_at&status=eq.ready&limit=2000`, { headers }),
      restFetch(`${tableUrl("mvp_user_credits")}?select=user_ref,last_free_browse_at&last_free_browse_at=gte.${encodeURIComponent(todayIso)}`, { headers }),
    ]);

    const poolRows = (await poolRowsRes.json()) as PoolRow[];
    const browseUsers = (await browseUsersTodayRes.json()) as UserRow[];

    // 카테고리 분포
    const categoryDistribution: Record<string, number> = {};
    for (const row of poolRows) {
      const cat = row.category ?? "unknown";
      categoryDistribution[cat] = (categoryDistribution[cat] ?? 0) + 1;
    }
    const categoryRanking = Object.entries(categoryDistribution)
      .sort(([, a], [, b]) => b - a)
      .map(([category, count]) => ({ category, count }));

    // profit_band 분포
    const bandDistribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "null": 0 };
    for (const row of poolRows) {
      const key = row.profit_band == null ? "null" : String(row.profit_band);
      bandDistribution[key] = (bandDistribution[key] ?? 0) + 1;
    }

    return NextResponse.json({
      poolStatus: {
        readyTotal: parseCount(readyTotalRes),
        readyEligible: parseCount(readyEligibleRes), // 6h+
        readyFresh: parseCount(readyFreshRes),       // 6h 미만 (구독자 전용)
        invalidatedToday: parseCount(invalidatedTodayRes),
        spentToday: parseCount(spentTodayRes),
      },
      userActivity: {
        browseUsersToday: browseUsers.length,
      },
      categoryDistribution: categoryRanking.slice(0, 20),
      bandDistribution,
      freshLagHours: FRESH_LAG_HOURS,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("explore_monitor failed", { err: message });
    return NextResponse.json({ error: "monitor_load_failed" }, { status: 500 });
  }
}
