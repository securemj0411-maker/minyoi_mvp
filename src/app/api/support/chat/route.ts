import { NextRequest, NextResponse } from "next/server";

import { displayNameForUser } from "@/lib/auth-users";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { notifyAdminTelegram } from "@/lib/telegram-notify";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupportConversation = {
  id: number;
  auth_user_id: string;
  user_ref: string;
  user_email: string | null;
  user_display_name: string | null;
  subject: string;
  status: "open" | "closed";
  admin_unread_count: number;
  user_unread_count: number;
  last_message_at: string;
  last_user_message_at: string | null;
  last_admin_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupportMessage = {
  id: number;
  conversation_id: number;
  auth_user_id: string;
  sender: "user" | "admin" | "system";
  body: string;
  admin_name: string | null;
  created_at: string;
};

async function findOpenConversation(authUserId: string) {
  const res = await restFetch(
    `${tableUrl("mvp_support_conversations")}?select=*&auth_user_id=eq.${authUserId}&status=eq.open&order=last_message_at.desc&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) throw new Error("conversation_lookup_failed");
  const rows = (await res.json()) as SupportConversation[];
  return rows[0] ?? null;
}

async function createConversation(authUserId: string, userRef: string, email: string | null, displayName: string) {
  const res = await restFetch(
    tableUrl("mvp_support_conversations"),
    {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "return=representation" },
      body: jsonBody([{
        auth_user_id: authUserId,
        user_ref: userRef,
        user_email: email,
        user_display_name: displayName,
        subject: "1대1 고객상담",
      }]),
    },
  );
  if (!res.ok) throw new Error("conversation_create_failed");
  const rows = (await res.json()) as SupportConversation[];
  return rows[0];
}

async function getOrCreateConversation(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return { auth, conversation: null };
  const authUserId = auth.user.id;
  const userRef = userRefForAuthUser(authUserId);
  const existing = await findOpenConversation(authUserId);
  if (existing) return { auth, conversation: existing };
  const displayName = displayNameForUser(auth.user);
  const conversation = await createConversation(authUserId, userRef, auth.user.email ?? null, displayName);
  return { auth, conversation };
}

async function loadMessages(conversationId: number) {
  const res = await restFetch(
    `${tableUrl("mvp_support_messages")}?select=*&conversation_id=eq.${conversationId}&order=created_at.asc&limit=200`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) throw new Error("messages_lookup_failed");
  return (await res.json()) as SupportMessage[];
}

export async function GET(req: NextRequest) {
  try {
    const result = await getOrCreateConversation(req);
    if (!result.auth.ok) return NextResponse.json({ error: result.auth.error }, { status: result.auth.status });
    if (!result.conversation) return NextResponse.json({ error: "conversation_missing" }, { status: 500 });
    const messages = await loadMessages(result.conversation.id);
    return NextResponse.json({ conversation: result.conversation, messages });
  } catch (err) {
    console.error("[support/chat] GET failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "support_chat_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await getOrCreateConversation(req);
    if (!result.auth.ok) return NextResponse.json({ error: result.auth.error }, { status: result.auth.status });
    const conversation = result.conversation;
    if (!conversation) return NextResponse.json({ error: "conversation_missing" }, { status: 500 });

    const body = (await req.json().catch(() => null)) as { message?: unknown } | null;
    const message = String(body?.message ?? "").trim();
    if (message.length < 1) return NextResponse.json({ error: "message_empty" }, { status: 400 });
    if (message.length > 2000) return NextResponse.json({ error: "message_too_long" }, { status: 400 });

    const nowIso = new Date().toISOString();
    const insertRes = await restFetch(
      tableUrl("mvp_support_messages"),
      {
        method: "POST",
        headers: { ...serviceHeaders(), Prefer: "return=representation" },
        body: jsonBody([{
          conversation_id: conversation.id,
          auth_user_id: result.auth.user.id,
          sender: "user",
          body: message,
        }]),
      },
    );
    if (!insertRes.ok) return NextResponse.json({ error: "message_insert_failed" }, { status: 500 });
    const rows = (await insertRes.json()) as SupportMessage[];
    const inserted = rows[0];

    await restFetch(
      `${tableUrl("mvp_support_conversations")}?id=eq.${conversation.id}`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders(), Prefer: "return=minimal" },
        body: jsonBody({
          status: "open",
          admin_unread_count: (conversation.admin_unread_count ?? 0) + 1,
          last_message_at: nowIso,
          last_user_message_at: nowIso,
          updated_at: nowIso,
        }),
      },
    );

    const notifyResult = await notifyAdminTelegram([
      "[득템잡이] 1:1 고객상담",
      `상담 ID: ${conversation.id}`,
      `이름: ${conversation.user_display_name ?? "이름 없음"}`,
      `이메일: ${conversation.user_email ?? result.auth.user.email ?? "-"}`,
      "",
      message,
      "",
      "처리: cau 운영자 페이지 고객센터에서 답장",
    ].join("\n"), { parseMode: null });
    if (!notifyResult.ok) {
      console.warn("[support/chat] telegram notify failed", notifyResult.reason ?? "unknown");
    }

    return NextResponse.json({
      conversation: {
        ...conversation,
        admin_unread_count: (conversation.admin_unread_count ?? 0) + 1,
        last_message_at: nowIso,
        last_user_message_at: nowIso,
        updated_at: nowIso,
      },
      message: inserted,
      telegramSent: notifyResult.ok,
      telegramReason: notifyResult.ok ? null : (notifyResult.reason ?? "unknown"),
    });
  } catch (err) {
    console.error("[support/chat] POST failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "support_message_failed" }, { status: 500 });
  }
}
