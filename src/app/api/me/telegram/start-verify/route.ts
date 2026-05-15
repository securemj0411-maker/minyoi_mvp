// Wave 93a: 텔레그램 verify code 발급 → deep link 반환.
// 사용자가 /me 핫딜 알림 → "텔레그램 연결" 클릭 시 호출.

import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { checkRateLimit } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { buildVerifyDeepLink, generateVerifyCode, getBotUsername } from "@/lib/telegram-bot";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_CODE_TTL_MS = 10 * 60 * 1000;
// Wave 104: bot이 무한 호출해 verify code spam + supabase upsert 폭증 방지.
// 정책: 분당 5회 (사용자가 실수로 여러 번 눌러도 통과). admin은 면제.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!getBotUsername()) {
    return NextResponse.json({ error: "telegram bot not configured" }, { status: 503 });
  }

  const userRef = userRefForAuthUser(auth.user.id);

  if (!isAdminUser(auth.user)) {
    const rate = await checkRateLimit({
      bucketKey: `telegram.start-verify:user:${userRef}`,
      maxRequests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "잠시 후 다시 시도해주세요.",
          retryAfter: rate.retryAfterSeconds,
        },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
  }
  const code = generateVerifyCode();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + VERIFY_CODE_TTL_MS).toISOString();

  const upsertRes = await restFetch(`${tableUrl("mvp_telegram_bindings")}?on_conflict=user_ref`, {
    method: "POST",
    headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{
      user_ref: userRef,
      auth_user_id: auth.user.id,
      verify_code: code,
      verify_code_expires_at: expiresAt,
      updated_at: now,
    }]),
  });
  if (!upsertRes.ok) {
    return NextResponse.json({ error: `upsert failed: ${await upsertRes.text().catch(() => "")}` }, { status: 500 });
  }

  return NextResponse.json({
    code,
    expiresAt,
    deepLink: buildVerifyDeepLink(code),
    botUsername: getBotUsername(),
  });
}
