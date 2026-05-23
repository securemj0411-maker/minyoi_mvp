// Wave launch-96: 충전 신청 → 크레딧 grant 공통 로직.
//   `/api/admin/manual-deposit/decide` 수동 승인 + cron auto-approve 양쪽에서 호출.
// Wave 731 (2026-05-24): 첫 결제 시 추천인 보너스 (플랜 비례) 즉시 지급.

import { grantReferralPaymentBonus } from "@/lib/referral";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export type ManualDepositRequest = {
  id: number;
  user_ref: string;
  auth_user_id: string;
  plan_key: string;
  amount: number;
  price_krw: number;
  depositor_name: string;
  status: string;
};

export async function grantManualDeposit(
  request: ManualDepositRequest,
  decidedBy: "admin" | "auto",
): Promise<{ ok: boolean; newBalance?: number; error?: string }> {
  if (request.status !== "pending") {
    return { ok: false, error: `already_${request.status}` };
  }

  // 현재 balance
  const credRes = await restFetch(
    `${tableUrl("mvp_user_credits")}?select=balance&user_ref=eq.${encodeURIComponent(request.user_ref)}&auth_user_id=eq.${request.auth_user_id}&limit=1`,
    { headers: serviceHeaders() },
  );
  const credRows = credRes.ok ? ((await credRes.json()) as Array<{ balance: number }>) : [];
  const currentBalance = Number(credRows[0]?.balance ?? 0);
  const newBalance = currentBalance + request.amount;
  const nowIso = new Date().toISOString();

  // user_credits upsert
  const upsertRes = await restFetch(
    `${tableUrl("mvp_user_credits")}?on_conflict=user_ref`,
    {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: jsonBody([{
        user_ref: request.user_ref,
        auth_user_id: request.auth_user_id,
        balance: newBalance,
        updated_at: nowIso,
      }]),
    },
  );
  if (!upsertRes.ok) {
    const text = await upsertRes.text().catch(() => "");
    console.error("[manual-deposit-grant] upsert failed", { status: upsertRes.status, body: text.slice(0, 200) });
    return { ok: false, error: `upsert_${upsertRes.status}` };
  }

  // request status update
  await restFetch(
    `${tableUrl("mvp_manual_deposit_requests")}?id=eq.${request.id}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: jsonBody({
        status: decidedBy === "admin" ? "approved" : "auto_approved",
        decided_at: nowIso,
        decided_by: decidedBy,
      }),
    },
  );

  // ledger audit
  try {
    await restFetch(
      `${tableUrl("mvp_credit_ledger")}`,
      {
        method: "POST",
        headers: { ...serviceHeaders(), Prefer: "return=minimal" },
        body: jsonBody([{
          user_ref: request.user_ref,
          auth_user_id: request.auth_user_id,
          event_type: decidedBy === "admin" ? "manual_deposit_admin_approved" : "manual_deposit_auto_approved",
          amount: request.amount,
          balance_after: newBalance,
          metadata: {
            request_id: request.id,
            plan_key: request.plan_key,
            price_krw: request.price_krw,
            depositor_name: request.depositor_name,
            decided_by: decidedBy,
          },
          created_at: nowIso,
        }]),
      },
    );
  } catch (err) {
    console.warn("[manual-deposit-grant] ledger insert threw", err instanceof Error ? err.message : String(err));
  }

  // Wave 731: 첫 결제 시 추천인 보너스 지급 (플랜 비례 +3/+30/+60).
  //   - 추천받은 적 없는 사용자면 noop
  //   - 이미 first_payment 보상 받은 추천이면 noop
  //   - 실패해도 사용자 결제 흐름 영향 X (try-catch)
  try {
    const bonus = await grantReferralPaymentBonus({
      referredUserId: request.auth_user_id,
      planKey: request.plan_key,
    });
    if (bonus.ok) {
      console.log("[manual-deposit-grant] referral payment bonus granted", {
        referredUserId: request.auth_user_id,
        planKey: request.plan_key,
        bonusCredits: bonus.rewardedCredits,
        referrerUserId: bonus.referrerUserId,
      });
    }
  } catch (err) {
    console.warn("[manual-deposit-grant] referral bonus failed", err instanceof Error ? err.message : String(err));
  }

  return { ok: true, newBalance };
}

export async function rejectManualDeposit(
  request: ManualDepositRequest,
): Promise<{ ok: boolean }> {
  if (request.status !== "pending") {
    return { ok: false };
  }
  const nowIso = new Date().toISOString();
  await restFetch(
    `${tableUrl("mvp_manual_deposit_requests")}?id=eq.${request.id}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: jsonBody({
        status: "rejected",
        decided_at: nowIso,
        decided_by: "admin",
      }),
    },
  );
  return { ok: true };
}
