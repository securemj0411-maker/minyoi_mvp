import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const conversationsRes = await restFetch(
    `${tableUrl("mvp_support_conversations")}?select=*&order=last_message_at.desc&limit=80`,
    { headers: serviceHeaders() },
  );
  if (!conversationsRes.ok) return NextResponse.json({ error: "conversation_lookup_failed" }, { status: 500 });
  const conversations = (await conversationsRes.json()) as Array<Record<string, unknown> & { id: number }>;
  const ids = conversations.map((row) => row.id).filter((id) => Number.isFinite(id));
  if (!ids.length) return NextResponse.json({ conversations: [] });

  const messagesRes = await restFetch(
    `${tableUrl("mvp_support_messages")}?select=*&conversation_id=in.(${ids.join(",")})&order=created_at.asc&limit=1000`,
    { headers: serviceHeaders() },
  );
  if (!messagesRes.ok) return NextResponse.json({ error: "message_lookup_failed" }, { status: 500 });
  const messages = (await messagesRes.json()) as Array<Record<string, unknown> & { conversation_id: number }>;
  const byConversation = new Map<number, Array<Record<string, unknown>>>();
  for (const message of messages) {
    const list = byConversation.get(message.conversation_id) ?? [];
    list.push(message);
    byConversation.set(message.conversation_id, list);
  }

  return NextResponse.json({
    conversations: conversations.map((conversation) => ({
      ...conversation,
      messages: byConversation.get(conversation.id) ?? [],
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { conversationId?: unknown; status?: unknown } | null;
  const conversationId = Number(body?.conversationId);
  const status = String(body?.status ?? "");
  if (!Number.isFinite(conversationId) || conversationId <= 0) return NextResponse.json({ error: "bad_conversation" }, { status: 400 });
  if (!["open", "closed"].includes(status)) return NextResponse.json({ error: "bad_status" }, { status: 400 });

  const nowIso = new Date().toISOString();
  const res = await restFetch(
    `${tableUrl("mvp_support_conversations")}?id=eq.${Math.floor(conversationId)}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: jsonBody({ status, updated_at: nowIso }),
    },
  );
  if (!res.ok) return NextResponse.json({ error: "status_update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
