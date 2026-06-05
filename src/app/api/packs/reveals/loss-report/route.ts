// Wave 182 (2026-05-17): 손해 신고 + 운영자 검수 큐 진입.
// 사업 보고서 #6 Loss Recovery — 손해 본 사용자가 churn 확률 가장 높음.
//
// 흐름:
// 1. 사용자가 카드에 "손해 봤어요" 클릭 → 짧은 사유 입력
// 2. mvp_reveal_feedback 에 feedback_type='loss_report' type-scoped upsert
//    - admin_status='pending', compensation_granted_tokens=0 박힘
// 3. 운영자가 /cau.../loss-reports 에서 확인하면 시세·상태 보정 데이터로 반영
// 4. 응답: "신고 접수. 운영자 확인 후 보정 반영."
//
// 중복 신고 차단: 같은 (user_ref, pid) 이미 loss_report 박혀있으면 중복 접수 방지.

import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl, jsonBody } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    if (isDuplicate) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: "이미 신고된 매물입니다. 운영자 검토 진행 중입니다.",
      });
    }

    // 2. type-scoped upsert 신고. 기존 bought/watching/bad_pick state는 보존한다.
    const upsertBody = jsonBody({
      user_ref: userRef,
      pid,
      feedback_type: "loss_report",
      note,
      source: "reveal_dashboard",
      admin_status: "pending",
      compensation_granted_tokens: 0,
      updated_at: new Date().toISOString(),
    });
    const upsertRes = await restFetch(
      `${tableUrl("mvp_reveal_feedback")}?on_conflict=user_ref,pid,feedback_type`,
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

    return NextResponse.json({
      ok: true,
      duplicate: false,
      message: "신고 접수됨. 운영자가 확인 후 시세·상태·모델 보정에 반영합니다.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[loss-report] failed", { err: message, userRef, pid });
    return NextResponse.json({ error: "loss_report_failed" }, { status: 500 });
  }
}
