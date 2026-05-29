// Wave launch-96 (사용자 결정 — 즉시 grant 모델 → 신청·승인 모델):
//   사용자 "입금 완료" → 신청 row 생성 + 운영자 텔레그램 알림.
//   운영자가 3분 안에 승인 누르면 즉시 grant. 안 누르면 cron 이 자동 grant (양심 신뢰).
//   기존 즉시 grant launch-95 흐름은 deprecated.

import { NextRequest, NextResponse } from "next/server";

import { signAdminAction } from "@/lib/admin-action-token";
import { planForKey, type PlanKey } from "@/lib/plan-config";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { notifyAdminTelegram } from "@/lib/telegram-notify";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTO_APPROVE_WINDOW_MS = 3 * 60 * 1000; // 3분
const RATE_LIMIT_WINDOW_MS = 30 * 60 * 1000; // 30분 — 같은 사용자 재신청 방지
const MANUAL_DEPOSIT_SUCCESS_WINDOW_MS = 24 * 60 * 60 * 1000; // 24시간 — 자동지급 반복 악용 차단
const MANUAL_DEPOSIT_REJECTED_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 입금 미확인 후 반복 신청 차단
const SUPPORT_OPEN_KAKAO_URL = "https://open.kakao.com/o/g6prauwi";

type Body = {
  planKey?: string;
  depositorName?: string;
};

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ error: "bad_body" }, { status: 400 }); }

  const plan = planForKey(body.planKey ?? null);
  if (plan.key === "free") return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  const planKey: PlanKey = plan.key;

  const depositorName = (body.depositorName ?? "").trim();
  if (depositorName.length < 1 || depositorName.length > 40) {
    return NextResponse.json({ error: "invalid_depositor", message: "입금자 성명을 입력해주세요." }, { status: 400 });
  }

  const authUserId = auth.user.id;
  const userRef = userRefForAuthUser(authUserId);

  try {
    // 차단된 사용자 거부 (user_credits.blocked_at 체크).
    const credRes = await restFetch(
      `${tableUrl("mvp_user_credits")}?select=blocked_at&user_ref=eq.${encodeURIComponent(userRef)}&auth_user_id=eq.${authUserId}&limit=1`,
      { headers: serviceHeaders() },
    );
    if (credRes.ok) {
      const credRows = (await credRes.json()) as Array<{ blocked_at: string | null }>;
      if (credRows[0]?.blocked_at) {
        return NextResponse.json({
          error: "account_blocked",
          message: "결제가 차단된 계정이에요. 운영자에게 문의해주세요.",
        }, { status: 403 });
      }
    }

    // 같은 사용자 pending 신청 또는 30분 내 직전 신청 차단.
    const recentRes = await restFetch(
      `${tableUrl("mvp_manual_deposit_requests")}?select=id,status,created_at&auth_user_id=eq.${authUserId}&order=created_at.desc&limit=1`,
      { headers: serviceHeaders() },
    );
    if (recentRes.ok) {
      const recentRows = (await recentRes.json()) as Array<{ id: number; status: string; created_at: string }>;
      const recent = recentRows[0];
      if (recent) {
        if (recent.status === "pending") {
          return NextResponse.json({
            error: "deposit_pending",
            message: "이미 진행 중인 신청이 있어요. 잠시 후 다시 확인해주세요.",
          }, { status: 429 });
        }
        const lastTs = new Date(recent.created_at).getTime();
        if (Number.isFinite(lastTs) && Date.now() - lastTs < RATE_LIMIT_WINDOW_MS) {
          return NextResponse.json({
            error: "deposit_too_soon",
            message: "이미 진행 중인 신청이 있어요. 잠시 후 다시 시도해주세요.",
          }, { status: 429 });
        }
      }
    }

    const recentSuccessCutoff = new Date(Date.now() - MANUAL_DEPOSIT_SUCCESS_WINDOW_MS).toISOString();
    const recentSuccessRes = await restFetch(
      `${tableUrl("mvp_manual_deposit_requests")}?select=id,status,created_at&auth_user_id=eq.${authUserId}&status=in.(approved,auto_approved)&created_at=gte.${encodeURIComponent(recentSuccessCutoff)}&order=created_at.desc&limit=1`,
      { headers: serviceHeaders() },
    );
    if (recentSuccessRes.ok) {
      const rows = (await recentSuccessRes.json()) as Array<{ id: number; status: string; created_at: string }>;
      if (rows.length > 0) {
        return NextResponse.json({
          error: "manual_deposit_daily_cap",
          message: "오늘 계좌이체 충전 신청은 이미 처리됐어요. 추가 충전이 필요하면 고객센터 오픈카톡으로 연락해주세요.",
          supportUrl: SUPPORT_OPEN_KAKAO_URL,
        }, { status: 429 });
      }
    }

    const rejectedCutoff = new Date(Date.now() - MANUAL_DEPOSIT_REJECTED_COOLDOWN_MS).toISOString();
    const recentRejectedRes = await restFetch(
      `${tableUrl("mvp_manual_deposit_requests")}?select=id,status,created_at&auth_user_id=eq.${authUserId}&status=eq.rejected&created_at=gte.${encodeURIComponent(rejectedCutoff)}&order=created_at.desc&limit=1`,
      { headers: serviceHeaders() },
    );
    if (recentRejectedRes.ok) {
      const rows = (await recentRejectedRes.json()) as Array<{ id: number; status: string; created_at: string }>;
      if (rows.length > 0) {
        return NextResponse.json({
          error: "manual_deposit_recent_reject",
          message: "최근 입금 확인이 어려웠던 신청이 있어요. 추가 충전은 고객센터 오픈카톡으로 연락해주세요.",
          supportUrl: SUPPORT_OPEN_KAKAO_URL,
        }, { status: 429 });
      }
    }

    // 신청 row 생성. 3분 후 auto-approve scheduled.
    const nowIso = new Date().toISOString();
    const scheduledIso = new Date(Date.now() + AUTO_APPROVE_WINDOW_MS).toISOString();
    const insertRes = await restFetch(
      `${tableUrl("mvp_manual_deposit_requests")}`,
      {
        method: "POST",
        headers: { ...serviceHeaders(), Prefer: "return=representation" },
        body: jsonBody([{
          user_ref: userRef,
          auth_user_id: authUserId,
          plan_key: planKey,
          amount: plan.monthlyCredits,
          price_krw: plan.priceKrw,
          depositor_name: depositorName,
          status: "pending",
          scheduled_auto_approve_at: scheduledIso,
          created_at: nowIso,
        }]),
      },
    );
    if (!insertRes.ok) {
      const errText = await insertRes.text().catch(() => "");
      console.error("[manual-deposit] request insert failed", { status: insertRes.status, body: errText.slice(0, 200) });
      return NextResponse.json({
        error: "request_failed",
        message: "충전 신청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.",
      }, { status: 500 });
    }
    const insertedRows = (await insertRes.json()) as Array<{ id: number }>;
    const requestId = insertedRows[0]?.id;

    // 운영자 텔레그램 알림. fail 해도 신청 자체는 OK (자동 승인으로 fallback).
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://minyoi-mvp.vercel.app";
    const approveToken = signAdminAction("manual_deposit", requestId, "approve");
    const rejectToken = signAdminAction("manual_deposit", requestId, "reject");
    const approveLink = `${baseUrl}/api/admin/manual-deposit/decide?id=${requestId}&decision=approve&token=${encodeURIComponent(approveToken)}`;
    const rejectLink = `${baseUrl}/api/admin/manual-deposit/decide?id=${requestId}&decision=reject&token=${encodeURIComponent(rejectToken)}`;
    const msg = [
      "💰 *충전 신청* (3분 안에 결정 / 안 누르면 자동 지급)",
      "",
      `• 신청 ID: \`${requestId}\``,
      `• 입금자명: *${escapeMarkdown(depositorName)}*`,
      `• 패키지: ${plan.monthlyCredits.toLocaleString("ko-KR")} 크레딧 (${plan.priceKrw.toLocaleString("ko-KR")}원)`,
      `• 회원: ${escapeMarkdown(auth.user.email ?? authUserId)}`,
      "",
      `통장 확인 후 → [✅ 승인](${approveLink}) / [❌ 거절](${rejectLink})`,
    ].join("\n");
    await notifyAdminTelegram(msg);

    return NextResponse.json({
      ok: true,
      requestId,
      etaSeconds: Math.floor(AUTO_APPROVE_WINDOW_MS / 1000),
      planKey,
      credits: plan.monthlyCredits,
    });
  } catch (err) {
    console.error("[manual-deposit] endpoint error", err instanceof Error ? err.message : String(err));
    return NextResponse.json({
      error: "deposit_failed",
      message: "처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
    }, { status: 500 });
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*`\[\]()])/g, "\\$1");
}
