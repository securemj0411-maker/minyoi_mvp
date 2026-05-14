// Wave 93a: 텔레그램 연동 해제 — chat_id null로 reset (verify_code도 clear).

import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);
  const now = new Date().toISOString();
  const res = await restFetch(
    `${tableUrl("mvp_telegram_bindings")}?user_ref=eq.${encodeURIComponent(userRef)}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        chat_id: null,
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
