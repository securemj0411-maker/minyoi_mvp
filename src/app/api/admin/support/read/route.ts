import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { conversationId?: unknown } | null;
  const conversationId = Number(body?.conversationId);
  if (!Number.isFinite(conversationId) || conversationId <= 0) return NextResponse.json({ error: "bad_conversation" }, { status: 400 });

  const res = await restFetch(
    `${tableUrl("mvp_support_conversations")}?id=eq.${Math.floor(conversationId)}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: jsonBody({ admin_unread_count: 0, updated_at: new Date().toISOString() }),
    },
  );
  if (!res.ok) return NextResponse.json({ error: "read_update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
