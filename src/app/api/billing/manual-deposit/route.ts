// Wave launch-95 (사용자 결정 — 토스페이먼츠 가맹심사 중 임시 흐름):
//   양심 신뢰 즉시 grant + 30분 rate limit + blocked 체크 + admin 회수 가능.
//
//   - auth user 검증 + blocked_at 체크 (차단 사용자 거부)
//   - last_manual_deposit_at 30분 rate limit (메시지에 시간 표시 X — 일반 안내)
//   - balance += plan.monthlyCredits + ledger row insert + last_manual_deposit_at=now()
//
//   토스페이먼츠 가맹 승인 후엔 이 endpoint deprecated.

import { NextRequest, NextResponse } from "next/server";

import { planForKey, type PlanKey } from "@/lib/plan-config";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 30 * 60 * 1000; // 30분

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

  // 현재 user_credits state 조회 (blocked_at + last_manual_deposit_at + balance)
  const credRes = await restFetch(
    `${tableUrl("mvp_user_credits")}?select=balance,blocked_at,blocked_reason,last_manual_deposit_at&user_ref=eq.${encodeURIComponent(userRef)}&auth_user_id=eq.${authUserId}&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!credRes.ok) return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  const credRows = (await credRes.json()) as Array<{
    balance: number;
    blocked_at: string | null;
    blocked_reason: string | null;
    last_manual_deposit_at: string | null;
  }>;
  const current = credRows[0] ?? { balance: 0, blocked_at: null, blocked_reason: null, last_manual_deposit_at: null };

  // 차단된 사용자 거부.
  if (current.blocked_at) {
    return NextResponse.json({
      error: "account_blocked",
      message: "결제가 차단된 계정이에요. 운영자에게 문의해주세요.",
    }, { status: 403 });
  }

  // Rate limit: 30분 내 재충전 차단. 메시지에 시간 명시 X (사용자 결정).
  if (current.last_manual_deposit_at) {
    const lastTs = new Date(current.last_manual_deposit_at).getTime();
    if (Number.isFinite(lastTs) && Date.now() - lastTs < RATE_LIMIT_WINDOW_MS) {
      return NextResponse.json({
        error: "deposit_too_soon",
        message: "이미 진행 중인 신청이 있어요. 잠시 후 다시 시도해주세요.",
      }, { status: 429 });
    }
  }

  const newBalance = (current.balance ?? 0) + plan.monthlyCredits;
  const nowIso = new Date().toISOString();

  // user_credits upsert (balance, last_manual_deposit_at)
  const upsertRes = await restFetch(
    `${tableUrl("mvp_user_credits")}?on_conflict=user_ref`,
    {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: jsonBody([{
        user_ref: userRef,
        auth_user_id: authUserId,
        balance: newBalance,
        last_manual_deposit_at: nowIso,
        updated_at: nowIso,
      }]),
    },
  );
  if (!upsertRes.ok) {
    const errText = await upsertRes.text();
    console.error("[manual-deposit] upsert failed", errText);
    return NextResponse.json({ error: "grant_failed" }, { status: 500 });
  }

  // ledger row insert — admin 회수 시 reference.
  const ledgerRes = await restFetch(
    `${tableUrl("mvp_credit_ledger")}`,
    {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: jsonBody([{
        user_ref: userRef,
        auth_user_id: authUserId,
        event_type: "manual_deposit_grant",
        amount: plan.monthlyCredits,
        balance_after: newBalance,
        metadata: {
          plan_key: planKey,
          price_krw: plan.priceKrw,
          depositor_name: depositorName,
          honor_trust: true,
          note: "토스페이먼츠 가맹심사 중 임시 흐름",
        },
        created_at: nowIso,
      }]),
    },
  );
  if (!ledgerRes.ok) {
    console.warn("[manual-deposit] ledger insert failed (granted but no audit row)");
  }

  return NextResponse.json({
    ok: true,
    balance: newBalance,
    granted: plan.monthlyCredits,
    planKey,
  });
}
