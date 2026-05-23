// Wave 731 (2026-05-24): 레퍼럴 시스템 — 추천 코드 생성 + 가입/결제 보상 지급.
//
// 흐름:
//   1. 가입 후 사용자에게 referral_code 자동 생성 (ensureReferralCode)
//   2. 추천 링크 (`?ref=ABC123`) 로 신규 가입 시 → createReferralAndGrantSignupBonus (양쪽 +5)
//   3. 신규 사용자 첫 결제 시 → grantReferralPaymentBonus (추천인 +3/+30/+60)
//
// 어뷰징 방어:
//   - 카카오 본인인증 필수 (auth-form.tsx)
//   - referred_user_id UNIQUE (1 사용자 = 1번만 추천받음)
//   - CHECK (referrer != referred) — 자기 자신 추천 차단
//
// 미구현 (사용자 결정에 따라):
//   - 환불 시 추천 보너스 회수 — 즉시 지급 정책, 환불 시 운영자 수동 처리

import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const REFERRAL_CODE_LENGTH = 6;
// 헷갈리는 문자 (0/O, 1/I/L) 제외 — 사용자 입력/카톡 공유 시 오타 방지
const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const SIGNUP_REWARD_CREDITS = 5;

// 결제 보너스 — 플랜 비례 (사용자 결정: 15%/15%/12%)
export const PAYMENT_BONUS_BY_PLAN: Record<string, number> = {
  starter: 3,   // 3,900원 → +3 크레딧 (~585원, 15%)
  plus: 30,     // 19,900원 → +30 크레딧 (~3,000원, 15%)
  pro: 60,      // 39,900원 → +60 크레딧 (~4,800원, 12%)
};

/**
 * 6자 랜덤 추천 코드 생성. 충돌 retry 는 호출자 책임.
 */
export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_CODE_ALPHABET[Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * 사용자가 referral_code 없으면 생성해서 저장. 있으면 그대로 반환.
 * UNIQUE 충돌 시 최대 5회 retry.
 */
export async function ensureReferralCode(authUserId: string, userRef: string): Promise<string | null> {
  // 기존 코드 확인
  const existingRes = await restFetch(
    `${tableUrl("mvp_user_credits")}?select=referral_code&auth_user_id=eq.${authUserId}&limit=1`,
    { headers: serviceHeaders() },
  );
  if (existingRes.ok) {
    const rows = (await existingRes.json()) as Array<{ referral_code: string | null }>;
    if (rows[0]?.referral_code) return rows[0].referral_code;
  }

  // 새 코드 생성 + UNIQUE 충돌 retry
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const upsertRes = await restFetch(
      `${tableUrl("mvp_user_credits")}?on_conflict=user_ref`,
      {
        method: "POST",
        headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
        body: jsonBody([{
          user_ref: userRef,
          auth_user_id: authUserId,
          referral_code: code,
        }]),
      },
    );
    if (upsertRes.ok) return code;
    // 23505 unique violation 등 → 다음 try
  }
  console.error("[referral] failed to generate unique code after 5 attempts");
  return null;
}

/**
 * 추천 코드 → 추천인 정보. 없으면 null.
 */
export async function findReferrerByCode(code: string): Promise<{ user_id: string; user_ref: string } | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const res = await restFetch(
    `${tableUrl("mvp_user_credits")}?select=auth_user_id,user_ref&referral_code=eq.${encodeURIComponent(normalized)}&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ auth_user_id: string; user_ref: string }>;
  if (!rows[0]) return null;
  return { user_id: rows[0].auth_user_id, user_ref: rows[0].user_ref };
}

/**
 * 추천 관계 생성 + 양쪽 가입 보상 (+5) 즉시 지급.
 * - 추천 코드 못 찾으면 noop (silent fail — 가입 자체는 막지 않음)
 * - 자기 자신 추천 차단
 * - 이미 추천받은 사용자면 noop (UNIQUE constraint)
 */
export async function createReferralAndGrantSignupBonus(input: {
  referrerCode: string;
  referredUserId: string;
  referredUserRef: string;
}): Promise<{ ok: boolean; error?: string }> {
  const referrer = await findReferrerByCode(input.referrerCode);
  if (!referrer) return { ok: false, error: "referrer_not_found" };

  if (referrer.user_id === input.referredUserId) {
    return { ok: false, error: "self_referral" };
  }

  // 이미 referred 인지 명시 check (UNIQUE constraint 가 race 방어)
  const existingRes = await restFetch(
    `${tableUrl("mvp_referrals")}?select=id&referred_user_id=eq.${input.referredUserId}&limit=1`,
    { headers: serviceHeaders() },
  );
  if (existingRes.ok) {
    const rows = (await existingRes.json()) as Array<{ id: number }>;
    if (rows.length > 0) return { ok: false, error: "already_referred" };
  }

  // 추천 관계 row insert 먼저 (UNIQUE 충돌 시 보상 안 지급 보장)
  const insertRes = await restFetch(
    `${tableUrl("mvp_referrals")}`,
    {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: jsonBody([{
        referrer_user_id: referrer.user_id,
        referrer_user_ref: referrer.user_ref,
        referred_user_id: input.referredUserId,
        referred_user_ref: input.referredUserRef,
        referrer_code: input.referrerCode.toUpperCase(),
        signup_reward_credits: SIGNUP_REWARD_CREDITS,
      }]),
    },
  );
  if (!insertRes.ok) {
    const text = await insertRes.text().catch(() => "");
    console.error("[referral] insert failed", { status: insertRes.status, body: text.slice(0, 200) });
    return { ok: false, error: "insert_failed" };
  }

  // 양쪽에 +5 토큰 지급
  await grantCreditsToUser(referrer.user_id, referrer.user_ref, SIGNUP_REWARD_CREDITS, "referral_signup_referrer", {
    referred_user_id: input.referredUserId,
    referred_user_ref: input.referredUserRef,
  });
  await grantCreditsToUser(input.referredUserId, input.referredUserRef, SIGNUP_REWARD_CREDITS, "referral_signup_referred", {
    referrer_user_id: referrer.user_id,
    referrer_code: input.referrerCode.toUpperCase(),
  });

  return { ok: true };
}

/**
 * 첫 결제 시 추천인 보너스 지급. manual-deposit-grant.ts 에서 호출.
 * - 추천받은 적 없는 사용자면 noop
 * - 이미 first_payment 보상 받은 추천이면 noop
 * - 플랜 키 매칭 안 되면 noop
 */
export async function grantReferralPaymentBonus(input: {
  referredUserId: string;
  planKey: string;
}): Promise<{ ok: boolean; rewardedCredits?: number; referrerUserId?: string }> {
  const bonusCredits = PAYMENT_BONUS_BY_PLAN[input.planKey];
  if (!bonusCredits) return { ok: false };

  // 추천받은 적 있고 + 아직 first_payment 보상 안 받았으면 지급
  const refRes = await restFetch(
    `${tableUrl("mvp_referrals")}?select=id,referrer_user_id,referrer_user_ref&referred_user_id=eq.${input.referredUserId}&first_payment_rewarded_at=is.null&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!refRes.ok) return { ok: false };
  const refs = (await refRes.json()) as Array<{ id: number; referrer_user_id: string; referrer_user_ref: string }>;
  if (refs.length === 0) return { ok: false };
  const ref = refs[0];

  // referrals row 먼저 mark (race 방어 — first_payment_rewarded_at 박힌 row 는 다시 안 지급)
  const markRes = await restFetch(
    `${tableUrl("mvp_referrals")}?id=eq.${ref.id}&first_payment_rewarded_at=is.null`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=representation" },
      body: jsonBody({
        first_payment_rewarded_at: new Date().toISOString(),
        first_payment_plan_key: input.planKey,
        first_payment_credits: bonusCredits,
      }),
    },
  );
  if (!markRes.ok) {
    console.error("[referral] payment bonus mark failed", { status: markRes.status });
    return { ok: false };
  }
  const updated = (await markRes.json().catch(() => [])) as Array<unknown>;
  if (updated.length === 0) {
    // 다른 process 가 먼저 mark 했음 (race)
    return { ok: false };
  }

  // 추천인에게 보너스 지급
  await grantCreditsToUser(ref.referrer_user_id, ref.referrer_user_ref, bonusCredits, "referral_first_payment", {
    referred_user_id: input.referredUserId,
    plan_key: input.planKey,
    referral_id: ref.id,
  });

  return { ok: true, rewardedCredits: bonusCredits, referrerUserId: ref.referrer_user_id };
}

/**
 * 사용자 추천 현황 조회 (/invite 페이지 용).
 */
export async function getReferralStats(authUserId: string): Promise<{
  signupCount: number;
  paymentCount: number;
  totalCredits: number;
}> {
  const res = await restFetch(
    `${tableUrl("mvp_referrals")}?select=signup_reward_credits,first_payment_credits&referrer_user_id=eq.${authUserId}`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) return { signupCount: 0, paymentCount: 0, totalCredits: 0 };
  const rows = (await res.json()) as Array<{ signup_reward_credits: number | null; first_payment_credits: number | null }>;
  let signupCount = 0;
  let paymentCount = 0;
  let totalCredits = 0;
  for (const r of rows) {
    signupCount += 1;
    totalCredits += Number(r.signup_reward_credits ?? 0);
    if (r.first_payment_credits != null) {
      paymentCount += 1;
      totalCredits += Number(r.first_payment_credits);
    }
  }
  return { signupCount, paymentCount, totalCredits };
}

/**
 * 사용자에게 크레딧 지급 + ledger 기록. manual-deposit-grant.ts 패턴 따름.
 * race condition: read-modify-write 라 동시 grant 시 손실 위험. 베타 단계 traffic 작아 OK.
 * 향후 atomic RPC 로 마이그 필요.
 */
async function grantCreditsToUser(
  authUserId: string,
  userRef: string,
  amount: number,
  eventType: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  // 현재 balance
  const credRes = await restFetch(
    `${tableUrl("mvp_user_credits")}?select=balance&auth_user_id=eq.${authUserId}&limit=1`,
    { headers: serviceHeaders() },
  );
  const credRows = credRes.ok ? ((await credRes.json()) as Array<{ balance: number }>) : [];
  const currentBalance = Number(credRows[0]?.balance ?? 0);
  const newBalance = currentBalance + amount;
  const nowIso = new Date().toISOString();

  // upsert balance
  const upsertRes = await restFetch(
    `${tableUrl("mvp_user_credits")}?on_conflict=user_ref`,
    {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: jsonBody([{
        user_ref: userRef,
        auth_user_id: authUserId,
        balance: newBalance,
        updated_at: nowIso,
      }]),
    },
  );
  if (!upsertRes.ok) {
    console.error("[referral] credit upsert failed", { status: upsertRes.status, eventType });
    return;
  }

  // ledger 기록 (audit + 환불 시 추적용)
  try {
    await restFetch(
      `${tableUrl("mvp_credit_ledger")}`,
      {
        method: "POST",
        headers: { ...serviceHeaders(), Prefer: "return=minimal" },
        body: jsonBody([{
          user_ref: userRef,
          auth_user_id: authUserId,
          event_type: eventType,
          amount,
          balance_after: newBalance,
          metadata,
          created_at: nowIso,
        }]),
      },
    );
  } catch (err) {
    console.warn("[referral] ledger insert threw", err instanceof Error ? err.message : String(err));
  }
}
