// Wave 1227: 사이드바 nav 뱃지용 대기 건수 — 운영자가 클릭 없이 "입금확인 3·상담 2" 한눈에.
//   가벼운 count=exact 쿼리 4개(인덱스). 셸에서 30초 폴링.

import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth-users";
import { serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function countRows(table: string, filter: string): Promise<number> {
  const res = await fetch(`${tableUrl(table)}?select=id&${filter}&limit=1`, {
    headers: { ...serviceHeaders(), Prefer: "count=exact" },
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return 0;
  const range = res.headers.get("content-range") ?? "0-0/0";
  return Number(range.split("/")[1] ?? 0);
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const [depositRequests, manualDeposits, unreadSupport, pendingFeedback] = await Promise.all([
    // 입금했어요를 누른(입금확인 요청) 멤버십 신청
    countRows("mvp_membership_applications", "status=eq.pending&deposit_confirmed_at=not.is.null"),
    // 대기 중 수동 충전 신청
    countRows("mvp_manual_deposit_requests", "status=eq.pending"),
    // 안 읽은 메시지가 있는 상담 (운영자가 읽으면 admin_unread_count=0 → 뱃지에서 빠짐). status=open 은 닫기 전까지 안 줄어 알림용으로 부적합.
    countRows("mvp_support_conversations", "admin_unread_count=gt.0"),
    // 대기 중 사용자 신고
    countRows("mvp_user_feedback", "status=eq.pending"),
  ]);

  return NextResponse.json({
    depositRequests,
    manualDeposits,
    unreadSupport,
    pendingFeedback,
    computedAt: new Date().toISOString(),
  });
}
