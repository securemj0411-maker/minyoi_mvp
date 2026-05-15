// Wave 93a: 텔레그램 연동 해제 — chat_id null로 reset (verify_code도 clear).

import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { checkRateLimit } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wave 106: disconnect spam 차단. 분당 5회 = 정상 사용자 충분.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);
  const now = new Date().toISOString();

  if (!isAdminUser(auth.user)) {
    const rate = await checkRateLimit({
      bucketKey: `telegram.disconnect:user:${userRef}`,
      maxRequests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: rate.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
  }
  const res = await restFetch(
    `${tableUrl("mvp_telegram_bindings")}?user_ref=eq.${encodeURIComponent(userRef)}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        chat_id: null,
        telegram_user_id: null,
        telegram_username: null,
        verified_at: null,
        verify_code: null,
        verify_code_expires_at: null,
        paused: false,
        updated_at: now,
      }),
    },
  );
  if (!res.ok) {
    return NextResponse.json({ error: `disconnect failed: ${await res.text().catch(() => "")}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
