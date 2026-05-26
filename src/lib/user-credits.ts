import type { User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/auth-users";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

// Wave 766 (2026-05-26 사용자 결정): 가입 시 2 크레딧 grant — "무료 2회 access" rate-limit bucket 폐기.
//   기존: FREE_CREDIT_GRANT=0 + FREE_DETAIL_ACCESS_LIMIT=2 (rate-limit 별도 시스템)
//   변경: FREE_CREDIT_GRANT=2 + free rate-limit 폐기 → 모든 reveal = 크레딧 차감 1 path.
//   효과:
//     - UI 일관 ("1개 무료" stale 카피 자동 해소)
//     - 단순화 (free/credit 분기 사라짐)
//     - paywall 첫 도달 시 valueSummary 박스 (스크린샷 #1 design) 는 누적 reveal ≤ 2 조건으로 보존.
export const FREE_CREDIT_GRANT = 2;
export const ADMIN_CREDIT_LABEL = "∞";

export type UserCreditState = {
  tokens: number;
  infinite: boolean;
  freeGrantedAt: string | null;
};

export type SpendCreditResult = UserCreditState & {
  ok: boolean;
  message?: string;
};

type ClaimCreditRow = {
  balance?: number;
  free_granted_at?: string | null;
};

type SpendCreditRow = {
  ok?: boolean;
  balance?: number;
  message?: string | null;
};

type RefundCreditRow = {
  balance?: number;
};

function adminCreditState(): UserCreditState {
  return {
    tokens: Number.MAX_SAFE_INTEGER,
    infinite: true,
    freeGrantedAt: null,
  };
}

function metadataJson(metadata: Record<string, unknown>) {
  return metadata;
}

export async function claimUserCredits(user: User, userRef: string): Promise<UserCreditState> {
  if (isAdminUser(user)) return adminCreditState();

  const res = await restFetch(rpcUrl("claim_mvp_user_credits"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({
      p_user_ref: userRef,
      p_auth_user_id: user.id,
      p_free_grant: FREE_CREDIT_GRANT,
    }),
  });
  const rows = (await res.json()) as ClaimCreditRow[];
  const row = rows[0] ?? {};
  return {
    tokens: Math.max(0, Number(row.balance ?? 0)),
    infinite: false,
    freeGrantedAt: row.free_granted_at ?? null,
  };
}

// SELECT only — 페이지뷰당 DB write 방지. row 없으면 null 반환.
// 신규 사용자 첫 호출은 호출자에서 claimUserCredits로 fallback.
export async function getUserCreditsReadOnly(
  user: User,
  userRef: string,
): Promise<UserCreditState | null> {
  if (isAdminUser(user)) return adminCreditState();

  const url = `${tableUrl("mvp_user_credits")}?select=balance,free_granted_at&user_ref=eq.${encodeURIComponent(userRef)}&auth_user_id=eq.${user.id}&limit=1`;
  const res = await restFetch(url, {
    method: "GET",
    headers: serviceHeaders(),
  });
  const rows = (await res.json()) as ClaimCreditRow[];
  if (rows.length === 0) return null;
  const row = rows[0]!;
  return {
    tokens: Math.max(0, Number(row.balance ?? 0)),
    infinite: false,
    freeGrantedAt: row.free_granted_at ?? null,
  };
}

export async function spendUserCredits(input: {
  user: User;
  userRef: string;
  amount: number;
  metadata?: Record<string, unknown>;
}): Promise<SpendCreditResult> {
  if (isAdminUser(input.user)) {
    return {
      ...adminCreditState(),
      ok: true,
      message: "ok",
    };
  }

  await claimUserCredits(input.user, input.userRef);
  const amount = Math.max(0, Math.round(input.amount));
  const res = await restFetch(rpcUrl("spend_mvp_user_credits"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({
      p_user_ref: input.userRef,
      p_auth_user_id: input.user.id,
      p_amount: amount,
      p_metadata: metadataJson(input.metadata ?? {}),
    }),
  });
  const rows = (await res.json()) as SpendCreditRow[];
  const row = rows[0] ?? {};
  return {
    ok: Boolean(row.ok),
    tokens: Math.max(0, Number(row.balance ?? 0)),
    infinite: false,
    freeGrantedAt: null,
    message: row.message ?? undefined,
  };
}

export async function refundUserCredits(input: {
  user: User;
  userRef: string;
  amount: number;
  metadata?: Record<string, unknown>;
}): Promise<UserCreditState> {
  if (isAdminUser(input.user)) return adminCreditState();

  const amount = Math.max(0, Math.round(input.amount));
  const res = await restFetch(rpcUrl("refund_mvp_user_credits"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({
      p_user_ref: input.userRef,
      p_auth_user_id: input.user.id,
      p_amount: amount,
      p_metadata: metadataJson(input.metadata ?? {}),
    }),
  });
  const rows = (await res.json()) as RefundCreditRow[];
  const row = rows[0] ?? {};
  return {
    tokens: Math.max(0, Number(row.balance ?? 0)),
    infinite: false,
    freeGrantedAt: null,
  };
}
