// Wave 185 (2026-05-17): 사용자 본인 피드백 활동 가시화.
// 사업 보고서 retention #6 (Loss Recovery 가시화) + L7 (Feedback Loop) 결합.
//
// 흐름: 사용자가 정보 오류 신고 → 토큰 +3 → 24h 내 운영자 검수 → **결과 가시화** ← 이 wave
// 가시화 없으면 신고 동기 1회성 (토큰만). 가시화 후 compound loop 활성화.
//
// 응답:
// - thisMonth: 이번 달 신고 stats (전체/보정/대기/기각 count + 토큰 합)
// - allTime: 누적 stats (동일 구조)
// - recentReports: 최근 신고 list (자세히 보기 모달용, 최대 50건)

import { NextResponse } from "next/server";
import { logAndRespond } from "@/lib/error-response";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeedbackRow = {
  id: number;
  pid: number;
  note: string;
  admin_status: string | null;
  admin_response_note: string | null;
  admin_responded_at: string | null;
  compensation_granted_tokens: number;
  created_at: string;
};

type Stats = {
  totalCount: number;
  resolvedCount: number;
  pendingCount: number;
  dismissedCount: number;
  tokensReceived: number;
};

function emptyStats(): Stats {
  return { totalCount: 0, resolvedCount: 0, pendingCount: 0, dismissedCount: 0, tokensReceived: 0 };
}

function aggregateStats(rows: FeedbackRow[]): Stats {
  const stats = emptyStats();
  for (const r of rows) {
    stats.totalCount += 1;
    stats.tokensReceived += Math.max(0, Number(r.compensation_granted_tokens ?? 0));
    const status = r.admin_status ?? "pending";
    if (status === "resolved") stats.resolvedCount += 1;
    else if (status === "dismissed") stats.dismissedCount += 1;
    else stats.pendingCount += 1;
  }
  return stats;
}

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userRef = userRefForAuthUser(auth.user.id);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString();

  try {
    // 1. 전체 기간 신고 fetch (max 200건, 최근 신고가 가장 활용도 ↑)
    const allUrl = `${tableUrl("mvp_reveal_feedback")}?select=id,pid,note,admin_status,admin_response_note,admin_responded_at,compensation_granted_tokens,created_at&user_ref=eq.${encodeURIComponent(userRef)}&feedback_type=eq.inaccurate_report&order=created_at.desc&limit=200`;
    const allRes = await restFetch(allUrl, { headers: serviceHeaders() });
    const allRows = (await allRes.json()) as FeedbackRow[];

    const thisMonthRows = allRows.filter((r) => r.created_at >= monthStartIso);
    const thisMonth = aggregateStats(thisMonthRows);
    const allTime = aggregateStats(allRows);

    // 2. 최근 신고 list (자세히 보기 모달용) — 최근 50건만, listing meta 합침
    const recentRows = allRows.slice(0, 50);
    let listingMap = new Map<number, { name: string | null; thumbnail_url: string | null; price: number | null }>();
    if (recentRows.length > 0) {
      const pids = Array.from(new Set(recentRows.map((r) => Number(r.pid))));
      const listingRes = await restFetch(
        `${tableUrl("mvp_listings")}?select=pid,name,price,thumbnail_url&pid=in.(${pids.join(",")})`,
        { headers: serviceHeaders() },
      );
      const listings = (await listingRes.json()) as Array<{ pid: number; name: string | null; price: number | null; thumbnail_url: string | null }>;
      listingMap = new Map(listings.map((l) => [Number(l.pid), { name: l.name, price: l.price, thumbnail_url: l.thumbnail_url }]));
    }

    const recentReports = recentRows.map((r) => {
      const listing = listingMap.get(Number(r.pid)) ?? null;
      return {
        id: r.id,
        pid: r.pid,
        note: r.note,
        adminStatus: (r.admin_status ?? "pending") as "pending" | "resolved" | "dismissed",
        adminResponseNote: r.admin_response_note,
        adminRespondedAt: r.admin_responded_at,
        compensationTokens: r.compensation_granted_tokens,
        createdAt: r.created_at,
        listing: listing
          ? {
              name: listing.name,
              price: listing.price,
              thumbnailUrl: listing.thumbnail_url,
              bunjangUrl: `https://m.bunjang.co.kr/products/${r.pid}`,
            }
          : null,
      };
    });

    return NextResponse.json({
      thisMonth,
      allTime,
      recentReports,
      monthLabel: `${monthStart.getUTCFullYear()}년 ${monthStart.getUTCMonth() + 1}월`,
    });
  } catch (err) {
    return logAndRespond("[feedback-activity]", err, "feedback_activity_failed", {
      userMessage: "피드백 활동을 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
      context: { userRef },
    });
  }
}
