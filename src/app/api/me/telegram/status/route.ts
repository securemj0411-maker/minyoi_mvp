// Wave 93a: 사용자 텔레그램 연동 상태 조회.

import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { getBotUsername } from "@/lib/telegram-bot";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);
  const res = await restFetch(
    `${tableUrl("mvp_telegram_bindings")}?select=chat_id,telegram_username,verified_at,paused,verify_code_expires_at&user_ref=eq.${encodeURIComponent(userRef)}&limit=1`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  const row = rows[0];

  return NextResponse.json({
    botConfigured: Boolean(getBotUsername()),
    botUsername: getBotUsername(),
    connected: Boolean(row?.chat_id),
    chatId: row?.chat_id ?? null,
    telegramUsername: row?.telegram_username ?? null,
    verifiedAt: row?.verified_at ?? null,
    paused: Boolean(row?.paused),
    pendingVerifyExpiresAt: row?.verify_code_expires_at ?? null,
  });
}
