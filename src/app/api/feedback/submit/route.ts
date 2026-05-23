// Wave launch-103: 사용자 피드백/신고 제출 — 운영자 검토 후 20 크레딧 보상.

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

    // 운영자 텔레그램 알림 — 승인 / 거절 link.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://minyoi-mvp.vercel.app";
    const approveLink = `${baseUrl}/api/admin/feedback/decide?id=${feedbackId}&decision=approve`;
    const rejectLink = `${baseUrl}/api/admin/feedback/decide?id=${feedbackId}&decision=reject`;
    const escapedMessage = message.length > 200 ? `${message.slice(0, 200)}...` : message;
    const pidLine = pidValid ? `• 매물 ID: \`${pidValid}\`` : "• 매물: 전역 피드백 (매물 없음)";
    const msg = [
      "🚨 *사용자 피드백 / 신고* (검토 → +20 크레딧)",
      "",
      `• 신고 ID: \`${feedbackId}\``,
      `• 회원: ${escapeMarkdown(auth.user.email ?? authUserId)}`,
      pidLine,
      `• 카테고리: *${escapeMarkdown(CATEGORY_LABELS[category] ?? category)}*`,
      "",
      "내용:",
      `> ${escapeMarkdown(escapedMessage)}`,
      "",
      `[✅ 승인 (+20)](${approveLink}) / [❌ 거절](${rejectLink})`,
    ].join("\n");
    await notifyAdminTelegram(msg);

    return NextResponse.json({ ok: true, feedbackId, reward: 20 });
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
