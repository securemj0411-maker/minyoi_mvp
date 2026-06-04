import { NextRequest, NextResponse } from "next/server";

import { ADMIN_DISPLAY_NAME, isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConversationRow = {
  id: number;
  auth_user_id: string;
  status: string;
  user_unread_count: number;
};

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { conversationId?: unknown; message?: unknown } | null;
  const conversationId = Number(body?.conversationId);
  const message = String(body?.message ?? "").trim();
  if (!Number.isFinite(conversationId) || conversationId <= 0) return NextResponse.json({ error: "bad_conversation" }, { status: 400 });
  if (message.length < 1) return NextResponse.json({ error: "message_empty" }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: "message_too_long" }, { status: 400 });

  const lookupRes = await restFetch(
    `${tableUrl("mvp_support_conversations")}?select=*&id=eq.${Math.floor(conversationId)}&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!lookupRes.ok) return NextResponse.json({ error: "conversation_lookup_failed" }, { status: 500 });
  const conversations = (await lookupRes.json()) as ConversationRow[];
  const conversation = conversations[0];
  if (!conversation) return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });

  const insertRes = await restFetch(
    tableUrl("mvp_support_messages"),
    {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "return=representation" },
      body: jsonBody([{
        conversation_id: conversation.id,
        auth_user_id: conversation.auth_user_id,
        sender: "admin",
        admin_name: ADMIN_DISPLAY_NAME,
        body: message,
      }]),
    },
  );
  if (!insertRes.ok) return NextResponse.json({ error: "reply_insert_failed" }, { status: 500 });
  const rows = (await insertRes.json()) as Array<Record<string, unknown>>;
  const nowIso = new Date().toISOString();

  await restFetch(
    `${tableUrl("mvp_support_conversations")}?id=eq.${conversation.id}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: jsonBody({
        status: "open",
        user_unread_count: (conversation.user_unread_count ?? 0) + 1,
        admin_unread_count: 0,
        last_message_at: nowIso,
        last_admin_message_at: nowIso,
        updated_at: nowIso,
      }),
    },
  );

  return NextResponse.json({ message: rows[0] ?? null });
}
