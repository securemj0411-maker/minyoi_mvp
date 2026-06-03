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
  const body = (await req.json().catch(() => ({}))) as { productKey?: string };
  const selectedPlan = getMembershipPlan(body.productKey);

  const userRef = userRefForAuthUser(auth.user.id);
  const status = await getProStatus(auth.user, userRef);
  if (status.isPro || status.isAdmin || status.isBetaTester) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  const email = auth.user.email ?? "email 없음";
  const name = auth.user.user_metadata?.name ?? auth.user.user_metadata?.full_name ?? auth.user.user_metadata?.nickname ?? "이름 없음";
  const pendingRes = await restFetch(
    `${tableUrl("mvp_membership_applications")}?select=id,status,admin_note&auth_user_id=eq.${auth.user.id}&status=eq.pending&limit=1`,
    { headers: serviceHeaders() },
  );
  const pendingRows = (await pendingRes.json()) as Array<{ id: number; status: string; admin_note: string | null }>;
  let applicationId = pendingRows[0]?.id ?? null;
  const previousAdminNote = pendingRows[0]?.admin_note?.trim() ?? "";
  const isRepeatApplication = Boolean(applicationId);
  if (!applicationId) {
    const insertRes = await restFetch(`${tableUrl("mvp_membership_applications")}`, {
      method: "POST",
      headers: serviceHeaders("return=representation"),
      body: jsonBody([{
        user_ref: userRef,
        auth_user_id: auth.user.id,
        email: auth.user.email ?? null,
        display_name: String(name),
        product_key: selectedPlan.key,
        price_krw: selectedPlan.priceKrw,
        status: "pending",
      }]),
    });
    const inserted = (await insertRes.json()) as Array<{ id: number }>;
    applicationId = inserted[0]?.id ?? null;
  } else {
    await restFetch(`${tableUrl("mvp_membership_applications")}?id=eq.${applicationId}&status=eq.pending`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        product_key: selectedPlan.key,
        price_krw: selectedPlan.priceKrw,
        updated_at: new Date().toISOString(),
      }),
    });
  }

  const notifyResult = await notifyAdminTelegram(
    [
      "[득템잡이] 선공개 300명 자리 예약 / 입금 대기",
      `예약 ID: ${applicationId ?? "unknown"}`,
      `이름: ${String(name)}`,
      `이메일: ${email}`,
      `auth_user_id: ${auth.user.id}`,
      `user_ref: ${userRef}`,
      `상품: ${selectedPlan.label} / ${selectedPlan.priceKrw.toLocaleString("ko-KR")}원`,
      `월 단가: ${selectedPlan.monthlyLabel}`,
      "내 지역 티오: 신청자 기준 mock 확인 완료",
      "처리: 입금 확인 후 cau 운영자 페이지에서 승인/거절",
    ].join("\n"),
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
    productKey: selectedPlan.key,
    priceKrw: selectedPlan.priceKrw,
    telegramSent: notifyResult.ok,
    telegramReason: notifyResult.ok ? null : notifyResult.reason ?? "unknown",
  });
}

export async function DELETE(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);
  const status = await getProStatus(auth.user, userRef);
  if (status.isPro || status.isAdmin || status.isBetaTester) {
    return NextResponse.json({ ok: true, alreadyMember: true, cancelled: false });
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
    return NextResponse.json({ ok: true, cancelled: false });
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
