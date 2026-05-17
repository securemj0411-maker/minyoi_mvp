// Wave 194 (2026-05-17): 사용자가 운영자 응답 본 시점 박음.
// 호출 시점: MyFeedbackActivity 자세히 보기 모달 열 때 (자동).
//
// 흐름:
// 1. 사용자 inaccurate_report 중 admin_responded_at 박힌 row 모두
// 2. user_seen_at = now() (이미 박혀있어도 update — 마지막 확인 시점)
//
// 비파괴: user_seen_at 만 update. 다른 컬럼 영향 X.

import { NextResponse } from "next/server";
import { logAndRespond } from "@/lib/error-response";
import { restFetch, serviceHeaders, tableUrl, jsonBody } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userRef = userRefForAuthUser(auth.user.id);

  try {
    // PATCH 모든 user 의 inaccurate_report 중 admin_responded_at not null + (user_seen_at null OR user_seen_at < admin_responded_at).
    // PostgREST 는 col1 < col2 비교 직접 안 됨 → 일단 모든 응답 row 박힌 것 update (= over-mark 약간, 영향 적음).
    const now = new Date().toISOString();
    const res = await restFetch(
      `${tableUrl("mvp_reveal_feedback")}?user_ref=eq.${encodeURIComponent(userRef)}&feedback_type=eq.inaccurate_report&admin_responded_at=not.is.null`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders(), Prefer: "return=minimal" },
        body: jsonBody({ user_seen_at: now, updated_at: now }),
      },
    );

    if (!res.ok) {
      return logAndRespond("[feedback-mark-seen]", new Error(`status_${res.status}`), "feedback_mark_seen_failed", {
        userMessage: "확인 처리에 실패했어요.",
        context: { userRef },
      });
    }

    return NextResponse.json({ ok: true, seenAt: now });
  } catch (err) {
    return logAndRespond("[feedback-mark-seen]", err, "feedback_mark_seen_failed", {
      userMessage: "확인 처리에 실패했어요.",
      context: { userRef },
    });
  }
}
