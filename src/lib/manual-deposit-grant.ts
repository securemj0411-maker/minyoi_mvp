// Wave launch-96: 충전 신청 → 크레딧 grant 공통 로직.
//   `/api/admin/manual-deposit/decide` 수동 승인 + cron auto-approve 양쪽에서 호출.
// Wave 731 (2026-05-24): 첫 결제 시 추천인 보너스 (플랜 비례) 즉시 지급.

import { grantReferralPaymentBonus } from "@/lib/referral";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

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

type ManualDepositApprovalRpcRow = {
  ok: boolean;
  granted: boolean;
  request_id: number;
  status: string | null;
  new_balance: number | null;
  error: string | null;
  user_ref: string | null;
  auth_user_id: string | null;
  plan_key: string | null;
  amount: number | null;
  price_krw: number | null;
  depositor_name: string | null;
};

export async function grantManualDeposit(
  request: ManualDepositRequest,
  decidedBy: "admin" | "auto",
): Promise<{ ok: boolean; newBalance?: number; error?: string }> {
  if (request.status !== "pending") {
    return { ok: false, error: `already_${request.status}` };
  }

  const approveRes = await restFetch(
    rpcUrl("approve_mvp_manual_deposit_request"),
    {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({
        p_request_id: request.id,
        p_decided_by: decidedBy,
      }),
    },
  );
  const rows = (await approveRes.json()) as ManualDepositApprovalRpcRow[];
  const approval = rows[0];
  if (!approval?.ok) {
    return { ok: false, error: approval?.error ?? "approval_failed" };
  }

  // Wave 731: 첫 결제 시 추천인 보너스 지급 (플랜 비례 +3/+30/+60).
  //   - 추천받은 적 없는 사용자면 noop
  //   - 이미 first_payment 보상 받은 추천이면 noop
  //   - 실패해도 사용자 결제 흐름 영향 X (try-catch)
  if (approval.granted) {
    try {
      const bonus = await grantReferralPaymentBonus({
        referredUserId: approval.auth_user_id ?? request.auth_user_id,
        planKey: approval.plan_key ?? request.plan_key,
      });
      if (bonus.ok) {
        console.log("[manual-deposit-grant] referral payment bonus granted", {
          referredUserId: approval.auth_user_id ?? request.auth_user_id,
          planKey: approval.plan_key ?? request.plan_key,
          bonusCredits: bonus.rewardedCredits,
          referrerUserId: bonus.referrerUserId,
        });
      }
    } catch (err) {
      console.warn("[manual-deposit-grant] referral bonus failed", err instanceof Error ? err.message : String(err));
    }
  }

  return { ok: true, newBalance: Number(approval.new_balance ?? 0) };
}

export async function rejectManualDeposit(
  request: ManualDepositRequest,
): Promise<{ ok: boolean }> {
  if (request.status !== "pending") {
    return { ok: false };
  }
  const nowIso = new Date().toISOString();
  const rejectRes = await restFetch(
    `${tableUrl("mvp_manual_deposit_requests")}?id=eq.${request.id}&status=eq.pending`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=representation" },
      body: jsonBody({
        status: "rejected",
        decided_at: nowIso,
        decided_by: "admin",
      }),
    },
  );
  const rows = (await rejectRes.json()) as Array<{ id: number }>;
  return { ok: rows.length > 0 };
}
