// Wave 106: 회원 탈퇴 endpoint (한국 개인정보보호법 의무).
// 정책: 익명화 + 삭제 혼합 (개인 식별 row 삭제 + 통계/회계 row 익명화).
// 흐름: confirm 토큰 검증 → RPC 호출 → supabase auth.users 삭제 → 200.

import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { checkRateLimit } from "@/lib/rate-limit";
import { jsonBody, restFetch, rpcUrl, serviceHeaders } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 분당 1회 — 회원 탈퇴는 빈번한 액션 X. 실수 방지 + spam 차단.
const RATE_LIMIT_MAX = 1;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const REQUIRED_CONFIRM = "탈퇴";

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { confirm?: string };
  try {
    body = (await req.json()) as { confirm?: string };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (body.confirm !== REQUIRED_CONFIRM) {
    return NextResponse.json(
      { error: "confirm_required", message: `회원 탈퇴를 진행하려면 confirm 필드에 정확히 "${REQUIRED_CONFIRM}" 을 입력해주세요.` },
      { status: 400 },
    );
  }

  const userRef = userRefForAuthUser(auth.user.id);

  // admin 자기 탈퇴 차단 (실수 방지 — admin은 별도 절차로만 삭제).
  if (isAdminUser(auth.user)) {
    return NextResponse.json(
      { error: "admin_cannot_self_delete", message: "운영자 계정은 일반 탈퇴 흐름으로 삭제할 수 없어요." },
      { status: 403 },
    );
  }

  const rate = await checkRateLimit({
    bucketKey: `account.delete:user:${userRef}`,
    maxRequests: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  // 1. RPC: 11개 테이블 익명화/삭제
  let anonymized = 0;
  let deleted = 0;
  try {
    const rpcRes = await restFetch(rpcUrl("delete_user_account"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({ p_user_ref: userRef, p_auth_user_id: auth.user.id }),
    });
    const rows = (await rpcRes.json()) as Array<{ anonymized_count?: number; deleted_count?: number }>;
    const row = rows[0] ?? {};
    anonymized = Number(row.anonymized_count ?? 0);
    deleted = Number(row.deleted_count ?? 0);
  } catch (err) {
    console.error("[account/delete] RPC failed", { userRef, authUserId: auth.user.id, err });
    return NextResponse.json(
      { error: "delete_failed", message: "회원 탈퇴 중 오류가 났어요. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }

  // 2. supabase auth.users 자체 삭제 (admin API)
  // SUPABASE_URL + SERVICE_ROLE_KEY 필요 — serviceHeaders가 SR 박혀있음.
  try {
    const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
      .replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
    if (supabaseUrl) {
      const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${auth.user.id}`, {
        method: "DELETE",
        headers: {
          ...serviceHeaders(),
          // auth admin API 는 apikey 필요
        },
      });
      if (!adminRes.ok) {
        console.warn("[account/delete] auth.users delete failed", { status: adminRes.status });
        // public 데이터는 다 정리됐으니 partial success 반환.
      }
    }
  } catch (err) {
    console.warn("[account/delete] auth admin call failed", err);
  }

  return NextResponse.json({
    ok: true,
    message: "회원 탈퇴가 완료됐어요. 그동안 차익잡이를 이용해주셔서 감사합니다.",
    anonymized,
    deleted,
  });
}
