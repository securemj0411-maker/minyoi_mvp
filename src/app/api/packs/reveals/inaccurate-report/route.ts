// Wave 182c (2026-05-17): 정보 오류 신고 + 토큰 +3 보상.
// loss_report (매물 받고 손해) 보다 임계값 낮음 — 매수 전에도 "이 정보 이상함" 즉시 신고 가능.
// 사용자 피드백 자연 수집 + 토큰 보상으로 유인 → feedback-resolutions polling source.
// Wave 245 (2026-05-18): 보상은 신고 즉시가 아니라 운영자 승인(resolved) 시점에 지급.
//
// 흐름:
// 1. 사용자가 매물 상세 모달에서 "정보 오류 신고" 클릭
// 2. 카테고리 선택 (시세 부정확 / 매물 정보 다름 / 이미 판매됨 / 가짜 가격 의심 / 기타)
//    + optional 사유 (자유 입력)
// 3. mvp_reveal_feedback type-scoped upsert (feedback_type='inaccurate_report')
//    - admin_status='pending', compensation_granted_tokens=0
// 4. 운영자가 /cau.../loss-reports 에서 승인하면 RPC가 토큰 +3을 원자적으로 지급
// 5. 응답: "신고 접수. 승인되면 토큰 3개 지급."
//
// 중복 신고 차단: 같은 (user_ref, pid) 이미 inaccurate_report 박혀있으면 토큰 미지급.

import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl, jsonBody } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPENSATION_TOKENS = 3;
const MAX_USER_REF = 64;
const MAX_NOTE = 1000;
// 부정확 신고 spam 차단: 시간당 10건 (loss_report 보다 임계값 낮으니 한도 더 큼).
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

const VALID_CATEGORIES = new Set([
  "price",        // 시세 부정확
  "info",         // 매물 정보 다름 (옵션/색상/용량 등)
  "sold",         // 이미 판매됨
  "fake_price",   // 가짜 가격 의심
  "other",        // 기타
]);

const CATEGORY_LABEL: Record<string, string> = {
  price: "시세 부정확",
  info: "매물 정보 다름",
  sold: "이미 판매됨",
  fake_price: "가짜 가격 의심",
  other: "기타",
};

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const payload = (body ?? {}) as Record<string, unknown>;

  const userRefRaw = req.headers.get("x-user-ref") ?? payload.userRef;
  const userRef = typeof userRefRaw === "string" ? userRefRaw.trim().slice(0, MAX_USER_REF) : "";
  const pid = Number(payload.pid);
  const category = String(payload.category ?? "").trim().toLowerCase();
  const noteRaw = typeof payload.note === "string" ? payload.note : "";
  const note = noteRaw.slice(0, MAX_NOTE);

  if (!userRef) return NextResponse.json({ error: "missing user ref" }, { status: 400 });
  if (userRef !== userRefForAuthUser(auth.user.id)) {
    return NextResponse.json({ error: "user ref does not match session" }, { status: 403 });
  }
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ error: "invalid pid" }, { status: 400 });
  }
  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  // rate limit
  const rate = await checkRateLimit({
    bucketKey: `inaccurate_report:user:${userRef}`,
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
    // 1. 중복 검사
    const dupCheckUrl = `${tableUrl("mvp_reveal_feedback")}?select=id&user_ref=eq.${encodeURIComponent(userRef)}&pid=eq.${pid}&feedback_type=eq.inaccurate_report&limit=1`;
    const dupRes = await restFetch(dupCheckUrl, { headers: serviceHeaders() });
    const dupRows = (await dupRes.json()) as Array<{ id: number }>;
    const isDuplicate = dupRows.length > 0;
    if (isDuplicate) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        compensationTokens: 0,
        pendingCompensationTokens: 0,
        tokensAfter: null,
        message: "이미 신고된 매물입니다. 운영자 검토 진행 중입니다.",
      });
    }

    // 2. 카테고리 prefix 박힌 note (운영자가 보기 쉽게).
    const categoryLabel = CATEGORY_LABEL[category] ?? category;
    const combinedNote = note ? `[${categoryLabel}] ${note}` : `[${categoryLabel}]`;

    // 3. type-scoped upsert. This must not erase bought/watching/bad_pick state.
    const upsertBody = jsonBody({
      user_ref: userRef,
      pid,
      feedback_type: "inaccurate_report",
      note: combinedNote,
      source: "reveal_modal",
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
      console.error("[inaccurate-report] upsert failed", { status: upsertRes.status, text, userRef, pid });
      return NextResponse.json({ error: "feedback_record_failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      duplicate: false,
      compensationTokens: 0,
      pendingCompensationTokens: COMPENSATION_TOKENS,
      tokensAfter: null,
      message: `신고 접수됨. 운영자가 확인 후 적절하면 토큰 ${COMPENSATION_TOKENS}개를 지급합니다.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[inaccurate-report] failed", { err: message, userRef, pid });
    return NextResponse.json({ error: "inaccurate_report_failed" }, { status: 500 });
  }
}
