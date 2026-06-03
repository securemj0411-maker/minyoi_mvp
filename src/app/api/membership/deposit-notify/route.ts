import { NextResponse } from "next/server";
import { signAdminAction } from "@/lib/admin-action-token";
import { getMembershipPlan } from "@/lib/membership-plans";
import { notifyAdminTelegram } from "@/lib/telegram-notify";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { getProStatus } from "@/lib/user-subscription";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTO_APPROVE_AFTER_MS = 5 * 60 * 1000;

function adminNoteLine(message: string) {
  return `[${new Date().toISOString()}] ${message}`;
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);
  const status = await getProStatus(auth.user, userRef);

  const pendingRes = await restFetch(
    `${tableUrl("mvp_membership_applications")}?select=id,user_ref,email,display_name,application_kind,product_key,price_krw,admin_note,deposit_confirmed_at,scheduled_auto_approve_at&auth_user_id=eq.${auth.user.id}&status=eq.pending&order=created_at.desc&limit=1`,
    { headers: serviceHeaders() },
  );
  const pendingRows = (await pendingRes.json()) as Array<{
    id: number;
    user_ref: string | null;
    email: string | null;
    display_name: string | null;
    application_kind: string | null;
    product_key: string | null;
    price_krw: number | null;
    admin_note: string | null;
    deposit_confirmed_at: string | null;
    scheduled_auto_approve_at: string | null;
  }>;
  const application = pendingRows[0] ?? null;
  if (!application) {
    if (status.isPro || status.isAdmin || status.isBetaTester) {
      return NextResponse.json({ ok: true, alreadyMember: true, notified: false });
    }
    return NextResponse.json({ error: "no_pending_application" }, { status: 404 });
  }
  if ((status.isPro || status.isAdmin || status.isBetaTester) && application.application_kind !== "renewal") {
    return NextResponse.json({ ok: true, alreadyMember: true, notified: false });
  }

  const selectedPlan = getMembershipPlan(application.product_key);
  const previousAdminNote = application.admin_note?.trim() ?? "";
  const name = application.display_name
    ?? auth.user.user_metadata?.name
    ?? auth.user.user_metadata?.full_name
    ?? auth.user.user_metadata?.nickname
    ?? "이름 없음";
  const email = application.email ?? auth.user.email ?? "email 없음";
  const nowIso = new Date().toISOString();
  const depositConfirmedAt = application.deposit_confirmed_at ?? nowIso;
  const scheduledAutoApproveAt = new Date(Date.now() + AUTO_APPROVE_AFTER_MS).toISOString();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://minyoi-mvp.vercel.app";
  const approveToken = signAdminAction("membership_application", application.id, "approve");
  const rejectToken = signAdminAction("membership_application", application.id, "reject");
  const approveLink = `${baseUrl}/api/admin/membership-applications/decide?id=${application.id}&decision=approve&token=${encodeURIComponent(approveToken)}`;
  const rejectLink = `${baseUrl}/api/admin/membership-applications/decide?id=${application.id}&decision=reject&token=${encodeURIComponent(rejectToken)}`;

  const notifyResult = await notifyAdminTelegram(
    [
      application.application_kind === "renewal" ? "[득템잡이] 멤버십 연장 입금 확인 요청" : "[득템잡이] 멤버십 입금 확인 요청",
      `예약 ID: ${application.id}`,
      `이름: ${String(name)}`,
      `이메일: ${email}`,
      `auth_user_id: ${auth.user.id}`,
      `user_ref: ${application.user_ref ?? userRef}`,
      `종류: ${application.application_kind === "renewal" ? "연장 예약" : "신규 신청"}`,
      `상품: ${selectedPlan.label} / ${Number(application.price_krw ?? selectedPlan.priceKrw).toLocaleString("ko-KR")}원`,
      "처리: 아래 버튼을 열고 확인 버튼을 눌러야 승인/거절 처리",
      "보장: 5분 내 미처리 시 자동 승인",
      `자동 승인 예정: ${scheduledAutoApproveAt}`,
    ].join("\n"),
    {
      parseMode: null,
      replyMarkup: {
        inline_keyboard: [[
          { text: "✅ 승인 확인 열기", url: approveLink },
          { text: "❌ 거절 확인 열기", url: rejectLink },
        ]],
      },
    },
  );

  const adminNote = [
    previousAdminNote,
    adminNoteLine("user_deposit_confirmed"),
    notifyResult.ok
      ? adminNoteLine("telegram_deposit_notified")
      : adminNoteLine(`telegram_deposit_notify_failed:${notifyResult.reason ?? "unknown"}`),
  ].filter(Boolean).join("\n").slice(-1800);

  await restFetch(`${tableUrl("mvp_membership_applications")}?id=eq.${application.id}&status=eq.pending`, {
    method: "PATCH",
    headers: serviceHeaders("return=minimal"),
    body: jsonBody({
      deposit_confirmed_at: depositConfirmedAt,
      scheduled_auto_approve_at: scheduledAutoApproveAt,
      admin_note: adminNote,
      updated_at: nowIso,
    }),
  });

  if (!notifyResult.ok) {
    console.warn("[membership/deposit-notify] telegram notify failed", {
      applicationId: application.id,
      reason: notifyResult.reason ?? "unknown",
    });
  }

  return NextResponse.json({
    ok: true,
    notified: true,
    applicationId: application.id,
    scheduledAutoApproveAt,
    serverNow: nowIso,
    telegramSent: notifyResult.ok,
    telegramReason: notifyResult.ok ? null : notifyResult.reason ?? "unknown",
  });
}
