// Wave launch-103: 사용자 피드백/신고 제출 — 운영자 검토 후 20 크레딧 보상.
// Wave launch-107 (2026-05-24): sold_out 카테고리 즉시 임시 invalidate + 24h dedup.
//   사용자 신고 → 매물 즉시 풀에서 빠짐 (다른 사용자한테 안 보임).
//   운영자 approve → 정식 sold_confirmed, reject → ready 복귀.

import { NextRequest, NextResponse } from "next/server";

import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { notifyAdminTelegram } from "@/lib/telegram-notify";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set(["fake", "price_wrong", "sold_out", "category_wrong", "other"]);
const CATEGORY_LABELS: Record<string, string> = {
  fake: "가품 의심",
  price_wrong: "시세 이상",
  sold_out: "이미 거래 완료",
  category_wrong: "카테고리 오분류",
  other: "기타",
};

type Body = {
  pid?: number | string | null;
  pidContext?: Record<string, unknown> | null;
  category?: string;
  message?: string;
};

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_body" }, { status: 400 }); }

  const category = typeof body.category === "string" ? body.category : "";
  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }
  const message = (body.message ?? "").toString().trim();
  if (message.length < 5) {
    return NextResponse.json({ error: "message_too_short", message: "5자 이상 적어주세요." }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "message_too_long" }, { status: 400 });
  }
  const pidRaw = body.pid;
  const pid = pidRaw == null ? null : Number(pidRaw);
  const pidValid = pid != null && Number.isFinite(pid) && pid > 0 ? Math.floor(pid) : null;

  const authUserId = auth.user.id;
  const userRef = userRefForAuthUser(authUserId);

  // Wave launch-107: sold_out dedup — 같은 사용자가 같은 매물 sold_out 24h 안 1회 제한.
  //   악용 방지 (한 사용자가 매물 여러 번 신고해서 풀에서 계속 빼는 패턴 차단).
  //   다른 카테고리 (fake/price_wrong/category_wrong/other) 는 제한 없음.
  if (category === "sold_out" && pidValid != null) {
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dupRes = await restFetch(
      `${tableUrl("mvp_user_feedback")}?select=id&auth_user_id=eq.${authUserId}&pid=eq.${pidValid}&category=eq.sold_out&created_at=gte.${encodeURIComponent(sinceIso)}&limit=1`,
      { headers: serviceHeaders() },
    );
    if (dupRes.ok) {
      const rows = (await dupRes.json()) as Array<{ id: number }>;
      if (rows.length > 0) {
        return NextResponse.json({
          error: "duplicate_report",
          message: "이미 신고하셨어요. 운영자 검토 후 결과를 알려드릴게요.",
        }, { status: 429 });
      }
    }
  }

  try {
    const insertRes = await restFetch(
      `${tableUrl("mvp_user_feedback")}`,
      {
        method: "POST",
        headers: { ...serviceHeaders(), Prefer: "return=representation" },
        body: jsonBody([{
          auth_user_id: authUserId,
          user_ref: userRef,
          pid: pidValid,
          pid_context: body.pidContext ?? null,
          category,
          message,
          status: "pending",
          reward_amount: 20,
        }]),
      },
    );
    if (!insertRes.ok) {
      const errText = await insertRes.text().catch(() => "");
      console.error("[feedback/submit] insert failed", { status: insertRes.status, body: errText.slice(0, 200) });
      return NextResponse.json({
        error: "submit_failed",
        message: "신고 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
      }, { status: 500 });
    }
    const rows = (await insertRes.json()) as Array<{ id: number }>;
    const feedbackId = rows[0]?.id;

    // Wave launch-107: sold_out 즉시 임시 invalidate — 다른 사용자한테 즉시 안 보임.
    //   reason="user_report_sold_pending" 박아서 recovery-worker 자동 복귀 차단.
    //   운영자 approve → reason='user_report_sold_confirmed' + listing_state='sold_confirmed' (정식)
    //   운영자 reject → status='ready' + reason 클리어 (decide route 가 처리)
    let pendingInvalidated = false;
    if (category === "sold_out" && pidValid != null) {
      try {
        const nowIso = new Date().toISOString();
        const patchRes = await restFetch(
          `${tableUrl("mvp_candidate_pool")}?pid=eq.${pidValid}&status=in.(ready,reserved)`,
          {
            method: "PATCH",
            headers: { ...serviceHeaders(), Prefer: "return=minimal" },
            body: jsonBody({
              status: "invalidated",
              invalidated_reason: `user_report_sold_pending:fb${feedbackId}`,
              updated_at: nowIso,
            }),
          },
        );
        pendingInvalidated = patchRes.ok;
      } catch (err) {
        console.error("[feedback/submit] pool invalidate failed", err instanceof Error ? err.message : String(err));
        // 풀 invalidate 실패해도 피드백 자체는 살림 (운영자 수동 처리 가능).
      }
    }

    // 운영자 텔레그램 알림 — 승인 / 거절 link.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://minyoi-mvp.vercel.app";
    const approveLink = `${baseUrl}/api/admin/feedback/decide?id=${feedbackId}&decision=approve`;
    const rejectLink = `${baseUrl}/api/admin/feedback/decide?id=${feedbackId}&decision=reject`;
    const escapedMessage = message.length > 200 ? `${message.slice(0, 200)}...` : message;
    const pidLine = pidValid ? `• 매물 ID: \`${pidValid}\`` : "• 매물: 전역 피드백 (매물 없음)";
    // Wave launch-107: sold_out 이면 즉시 풀 제외 표기 추가.
    const soldOutLine = pendingInvalidated
      ? "\n⚠️ *즉시 풀 제외됨* — 거절 시 자동 복귀"
      : "";
    const msg = [
      "🚨 *사용자 피드백 / 신고* (검토 → +20 크레딧)",
      "",
      `• 신고 ID: \`${feedbackId}\``,
      `• 회원: ${escapeMarkdown(auth.user.email ?? authUserId)}`,
      pidLine,
      `• 카테고리: *${escapeMarkdown(CATEGORY_LABELS[category] ?? category)}*${soldOutLine}`,
      "",
      "내용:",
      `> ${escapeMarkdown(escapedMessage)}`,
      "",
      `[✅ 승인 (+20)](${approveLink}) / [❌ 거절](${rejectLink})`,
    ].join("\n");
    await notifyAdminTelegram(msg);

    return NextResponse.json({ ok: true, feedbackId, reward: 20, pendingInvalidated });
  } catch (err) {
    console.error("[feedback/submit] error", err instanceof Error ? err.message : String(err));
    return NextResponse.json({
      error: "submit_failed",
      message: "신고 처리 중 오류가 발생했어요.",
    }, { status: 500 });
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*`\[\]()])/g, "\\$1");
}
