import { NextRequest, NextResponse } from "next/server";

import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupportConversationStatus = {
  id: number;
  auth_user_id: string;
  status: "open" | "closed";
  user_unread_count: number | null;
  last_message_at: string | null;
  last_admin_message_at: string | null;
};

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const res = await restFetch(
    `${tableUrl("mvp_support_conversations")}?select=id,auth_user_id,status,user_unread_count,last_message_at,last_admin_message_at&auth_user_id=eq.${auth.user.id}&status=eq.open&order=last_message_at.desc&limit=1`,
    { headers: serviceHeaders(), cache: "no-store" },
  ).catch(() => null);
  if (!res?.ok) return NextResponse.json({ error: "support_status_failed" }, { status: 500 });
  const rows = (await res.json().catch(() => [])) as SupportConversationStatus[];
  const conversation = rows[0] ?? null;

  return NextResponse.json({
    ok: true,
    conversationId: conversation?.id ?? null,
    unreadCount: Number(conversation?.user_unread_count ?? 0),
    lastMessageAt: conversation?.last_message_at ?? null,
    lastAdminMessageAt: conversation?.last_admin_message_at ?? null,
  });
}
