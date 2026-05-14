// Wave 93a: 텔레그램 verify code 발급 → deep link 반환.
// 사용자가 /me 핫딜 알림 → "텔레그램 연결" 클릭 시 호출.

import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { buildVerifyDeepLink, generateVerifyCode, getBotUsername } from "@/lib/telegram-bot";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_CODE_TTL_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!getBotUsername()) {
    return NextResponse.json({ error: "telegram bot not configured" }, { status: 503 });
  }

  const userRef = userRefForAuthUser(auth.user.id);
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
