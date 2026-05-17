// Wave 182 (2026-05-17): 손해 신고 + 즉시 토큰 보상 + 운영자 검수 큐 진입.
// 사업 보고서 #6 Loss Recovery — 손해 본 사용자가 churn 확률 가장 높음 → 즉시 보상으로 advocate 전환.
//
// 흐름:
// 1. 사용자가 카드에 "손해 봤어요" 클릭 → 짧은 사유 입력
// 2. mvp_reveal_feedback 에 feedback_type='loss_report' upsert
//    - admin_status='pending', compensation_granted_tokens=3 박힘
// 3. refundUserCredits(amount=3, metadata={ reason: 'loss_report', pid })
// 4. 응답: "즉시 토큰 3개 지급. 24시간 안에 운영자가 확인합니다."
//
// 중복 신고 차단: 같은 (user_ref, pid) 이미 loss_report 박혀있으면 토큰 미지급 + 안내.

import { NextResponse } from "next/server";
import { refundUserCredits } from "@/lib/user-credits";
import { checkRateLimit } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl, jsonBody } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPENSATION_TOKENS = 3;
const MAX_USER_REF = 64;
const MAX_NOTE = 1000;
// 손해 신고 spam 차단: 시간당 5건.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const payload = (body ?? {}) as Record<string, unknown>;
  const userRefRaw = req.headers.get("x-user-ref") ?? payload.userRef;
  const userRef = typeof userRefRaw === "string" ? userRefRaw.trim().slice(0, MAX_USER_REF) : "";
  const pid = Number(payload.pid);
  const noteRaw = typeof payload.note === "string" ? payload.note : "";
  const note = noteRaw.slice(0, MAX_NOTE);

  if (!userRef) return NextResponse.json({ error: "missing user ref" }, { status: 400 });
  if (userRef !== userRefForAuthUser(auth.user.id)) {
    return NextResponse.json({ error: "user ref does not match session" }, { status: 403 });
  }
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ error: "invalid pid" }, { status: 400 });
  }
  if (note.trim().length < 5) {
    return NextResponse.json(
      { error: "note_too_short", message: "어떤 손해였는지 5자 이상 적어주세요. (예: '받았는데 배터리 효율 60%')" },
      { status: 400 },
    );
  }

  // rate limit
  const rate = await checkRateLimit({
    bucketKey: `loss_report:user:${userRef}`,
    maxRequests: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "신고가 너무 잦아요. 잠시 후 다시 시도해주세요.", retryAfter: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    // 1. 중복 검사 — 같은 (user_ref, pid) 이미 loss_report 박혀있으면 보상 X.
    const dupCheckUrl = `${tableUrl("mvp_reveal_feedback")}?select=id,compensation_granted_tokens,admin_status&user_ref=eq.${encodeURIComponent(userRef)}&pid=eq.${pid}&feedback_type=eq.loss_report&limit=1`;
    const dupRes = await restFetch(dupCheckUrl, { headers: serviceHeaders() });
    const dupRows = (await dupRes.json()) as Array<{ id: number; compensation_granted_tokens: number; admin_status: string | null }>;
    const isDuplicate = dupRows.length > 0;

    // 2. upsert 신고. on_conflict (user_ref, pid) — 기존 feedback (bad_pick 등) 있을 수도. 덮어쓰기.
    const compensation = isDuplicate ? 0 : COMPENSATION_TOKENS;
    const upsertBody = jsonBody({
      user_ref: userRef,
      pid,
      feedback_type: "loss_report",
      note,
      source: "reveal_dashboard",
      admin_status: "pending",
      compensation_granted_tokens: compensation,
      updated_at: new Date().toISOString(),
    });
    const upsertRes = await restFetch(
      `${tableUrl("mvp_reveal_feedback")}?on_conflict=user_ref,pid`,
      {
        method: "POST",
        headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
        body: upsertBody,
      },
    );
    if (!upsertRes.ok) {
      const text = await upsertRes.text();
      console.error("[loss-report] upsert failed", { status: upsertRes.status, text, userRef, pid });
      return NextResponse.json({ error: "feedback_record_failed" }, { status: 500 });
    }

    // 3. 보상 (중복 아니면 토큰 3개 지급).
    let tokensAfter: number | null = null;
    if (!isDuplicate) {
      const refund = await refundUserCredits({
        user: auth.user,
        userRef,
        amount: COMPENSATION_TOKENS,
        metadata: { reason: "loss_report", pid, source: "loss_report_api" },
      });
      tokensAfter = refund.tokens;
    }

    return NextResponse.json({
      ok: true,
      duplicate: isDuplicate,
      compensationTokens: compensation,
      tokensAfter,
      message: isDuplicate
        ? "이미 신고된 매물입니다. 운영자 검토 진행 중입니다."
        : `신고 접수됨. 즉시 토큰 ${COMPENSATION_TOKENS}개 지급되었어요. 24시간 안에 운영자가 확인합니다.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[loss-report] failed", { err: message, userRef, pid });
    return NextResponse.json({ error: "loss_report_failed" }, { status: 500 });
  }
}
