import { NextResponse } from "next/server";
import { getMembershipPlan } from "@/lib/membership-plans";
import { notifyAdminTelegram } from "@/lib/telegram-notify";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { getProStatus } from "@/lib/user-subscription";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminNoteLine(message: string) {
  return `[${new Date().toISOString()}] ${message}`;
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);
  const status = await getProStatus(auth.user, userRef);
  if (status.isPro || status.isAdmin || status.isBetaTester) {
    return NextResponse.json({ ok: true, alreadyMember: true, notified: false });
  }

  const pendingRes = await restFetch(
    `${tableUrl("mvp_membership_applications")}?select=id,user_ref,email,display_name,product_key,price_krw,admin_note&auth_user_id=eq.${auth.user.id}&status=eq.pending&limit=1`,
    { headers: serviceHeaders() },
  );
  const pendingRows = (await pendingRes.json()) as Array<{
    id: number;
    user_ref: string | null;
    email: string | null;
    display_name: string | null;
    product_key: string | null;
    price_krw: number | null;
    admin_note: string | null;
  }>;
  const application = pendingRows[0] ?? null;
  if (!application) {
    return NextResponse.json({ error: "no_pending_application" }, { status: 404 });
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

  const notifyResult = await notifyAdminTelegram(
    [
      "[득템잡이] 멤버십 입금 확인 요청",
      `예약 ID: ${application.id}`,
      `이름: ${String(name)}`,
      `이메일: ${email}`,
      `auth_user_id: ${auth.user.id}`,
      `user_ref: ${application.user_ref ?? userRef}`,
      `상품: ${selectedPlan.label} / ${Number(application.price_krw ?? selectedPlan.priceKrw).toLocaleString("ko-KR")}원`,
      "처리: cau 운영자 페이지에서 입금 확인 후 승인",
      "기대 응답: 보통 3분 내 확인",
    ].join("\n"),
    { parseMode: null },
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
    telegramSent: notifyResult.ok,
    telegramReason: notifyResult.ok ? null : notifyResult.reason ?? "unknown",
  });
}
