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

async function updateApplicationAdminNote(applicationId: number | null, note: string) {
  if (!applicationId) return;
  await restFetch(`${tableUrl("mvp_membership_applications")}?id=eq.${applicationId}`, {
    method: "PATCH",
    headers: serviceHeaders("return=minimal"),
    body: jsonBody({ admin_note: note }),
  }).catch((err) => {
    console.warn("[membership/apply] admin note update failed", err instanceof Error ? err.message : String(err));
  });
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await req.json().catch(() => ({}))) as { productKey?: string; intent?: string };
  const selectedPlan = getMembershipPlan(body.productKey);

  const userRef = userRefForAuthUser(auth.user.id);
  const status = await getProStatus(auth.user, userRef);
  const hasActiveMembership = status.isPro || status.isAdmin || status.isBetaTester;
  const isRenewal = hasActiveMembership && body.intent === "renewal";
  if (hasActiveMembership && !isRenewal) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  const email = auth.user.email ?? "email 없음";
  const name = auth.user.user_metadata?.name ?? auth.user.user_metadata?.full_name ?? auth.user.user_metadata?.nickname ?? "이름 없음";
  const pendingRes = await restFetch(
    `${tableUrl("mvp_membership_applications")}?select=id,status,admin_note,application_kind,deposit_confirmed_at,scheduled_auto_approve_at&auth_user_id=eq.${auth.user.id}&status=eq.pending&order=created_at.desc&limit=1`,
    { headers: serviceHeaders() },
  );
  const pendingRows = (await pendingRes.json()) as Array<{
    id: number;
    status: string;
    admin_note: string | null;
    application_kind: string | null;
    deposit_confirmed_at: string | null;
    scheduled_auto_approve_at: string | null;
  }>;
  let applicationId = pendingRows[0]?.id ?? null;
  const previousAdminNote = pendingRows[0]?.admin_note?.trim() ?? "";
  const isRepeatApplication = Boolean(applicationId);
  const depositAlreadyConfirmed = Boolean(pendingRows[0]?.deposit_confirmed_at);
  if (applicationId && depositAlreadyConfirmed) {
    return NextResponse.json({
      ok: true,
      applicationId,
      depositAlreadyConfirmed: true,
      scheduledAutoApproveAt: pendingRows[0]?.scheduled_auto_approve_at ?? null,
      telegramSent: false,
      telegramReason: "deposit_already_confirmed",
    });
  }
  if (!applicationId) {
    const insertRes = await restFetch(`${tableUrl("mvp_membership_applications")}`, {
      method: "POST",
      headers: serviceHeaders("return=representation"),
      body: jsonBody([{
        user_ref: userRef,
        auth_user_id: auth.user.id,
        email: auth.user.email ?? null,
        display_name: String(name),
        application_kind: isRenewal ? "renewal" : "new",
        product_key: selectedPlan.key,
        price_krw: selectedPlan.priceKrw,
        status: "pending",
      }]),
    });
    const inserted = (await insertRes.json()) as Array<{ id: number }>;
    applicationId = inserted[0]?.id ?? null;
  } else if (!depositAlreadyConfirmed) {
    await restFetch(`${tableUrl("mvp_membership_applications")}?id=eq.${applicationId}&status=eq.pending`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        application_kind: isRenewal ? "renewal" : "new",
        product_key: selectedPlan.key,
        price_krw: selectedPlan.priceKrw,
        updated_at: new Date().toISOString(),
      }),
    });
  }

  const notifyResult = await notifyAdminTelegram(
    [
      isRenewal ? "[득템잡이] 멤버십 연장 예약 / 입금 대기" : "[득템잡이] 선공개 300명 자리 예약 / 입금 대기",
      `예약 ID: ${applicationId ?? "unknown"}`,
      `이름: ${String(name)}`,
      `이메일: ${email}`,
      `auth_user_id: ${auth.user.id}`,
      `user_ref: ${userRef}`,
      `상품: ${selectedPlan.label} / ${selectedPlan.priceKrw.toLocaleString("ko-KR")}원`,
      `월 단가: ${selectedPlan.monthlyLabel}`,
      isRenewal ? `현재 만료일: ${status.proUntil ?? "기간 제한 없음"}` : "내 지역 티오: 신청자 기준 mock 확인 완료",
      "처리: 사용자가 입금했어요 버튼을 누르면 승인/거절 링크를 다시 보냅니다.",
    ].filter(Boolean).join("\n"),
    { parseMode: null },
  );

  const notificationLine = notifyResult.ok
    ? adminNoteLine(isRepeatApplication ? "telegram_notified_again" : "telegram_notified")
    : adminNoteLine(`telegram_notify_failed:${notifyResult.reason ?? "unknown"}`);
  await updateApplicationAdminNote(
    applicationId,
    [previousAdminNote, notificationLine].filter(Boolean).join("\n").slice(-1800),
  );

  if (!notifyResult.ok) {
    console.warn("[membership/apply] telegram notify failed", {
      applicationId,
      reason: notifyResult.reason ?? "unknown",
    });
  }

  return NextResponse.json({
    ok: true,
    applicationId,
    applicationKind: isRenewal ? "renewal" : "new",
    productKey: selectedPlan.key,
    priceKrw: selectedPlan.priceKrw,
    depositAlreadyConfirmed: false,
    scheduledAutoApproveAt: pendingRows[0]?.scheduled_auto_approve_at ?? null,
    telegramSent: notifyResult.ok,
    telegramReason: notifyResult.ok ? null : notifyResult.reason ?? "unknown",
  });
}

export async function DELETE(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);
  const pendingRes = await restFetch(
    `${tableUrl("mvp_membership_applications")}?select=id,user_ref,email,display_name,application_kind,product_key,price_krw,admin_note,deposit_confirmed_at&auth_user_id=eq.${auth.user.id}&status=eq.pending&order=created_at.desc&limit=1`,
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
  }>;
  const application = pendingRows[0] ?? null;
  if (!application) {
    return NextResponse.json({ ok: true, cancelled: false });
  }
  if (application.deposit_confirmed_at) {
    return NextResponse.json({
      error: "deposit_already_confirmed",
      message: "입금 확인 요청 후에는 예약 취소가 막혀요. 운영자에게 환불/취소를 요청해주세요.",
    }, { status: 409 });
  }

  const selectedPlan = getMembershipPlan(application.product_key);
  const previousAdminNote = application.admin_note?.trim() ?? "";
  const name = application.display_name ?? auth.user.user_metadata?.name ?? auth.user.user_metadata?.full_name ?? auth.user.user_metadata?.nickname ?? "이름 없음";
  const email = application.email ?? auth.user.email ?? "email 없음";
  const nowIso = new Date().toISOString();

  const notifyResult = await notifyAdminTelegram(
    [
      "[득템잡이] 선공개 300명 자리 예약 취소",
      `예약 ID: ${application.id}`,
      `이름: ${String(name)}`,
      `이메일: ${email}`,
      `auth_user_id: ${auth.user.id}`,
      `user_ref: ${application.user_ref ?? userRef}`,
      `상품: ${selectedPlan.label} / ${Number(application.price_krw ?? selectedPlan.priceKrw).toLocaleString("ko-KR")}원`,
      `종류: ${application.application_kind === "renewal" ? "연장 예약" : "신규 신청"}`,
      "처리: 신청자가 입금 전 예약 취소",
    ].join("\n"),
    { parseMode: null },
  );

  const adminNote = [
    previousAdminNote,
    adminNoteLine("user_cancelled_reservation"),
    notifyResult.ok
      ? adminNoteLine("telegram_cancel_notified")
      : adminNoteLine(`telegram_cancel_notify_failed:${notifyResult.reason ?? "unknown"}`),
  ].filter(Boolean).join("\n").slice(-1800);

  await restFetch(`${tableUrl("mvp_membership_applications")}?id=eq.${application.id}&status=eq.pending`, {
    method: "PATCH",
    headers: serviceHeaders("return=minimal"),
    body: jsonBody({
      status: "rejected",
      admin_note: adminNote,
      decided_at: nowIso,
      updated_at: nowIso,
    }),
  });

  if (!notifyResult.ok) {
    console.warn("[membership/apply] cancellation telegram notify failed", {
      applicationId: application.id,
      reason: notifyResult.reason ?? "unknown",
    });
  }

  return NextResponse.json({
    ok: true,
    cancelled: true,
    applicationId: application.id,
    telegramSent: notifyResult.ok,
    telegramReason: notifyResult.ok ? null : notifyResult.reason ?? "unknown",
  });
}
