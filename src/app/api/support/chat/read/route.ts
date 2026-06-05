import { NextRequest, NextResponse } from "next/server";

import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const res = await restFetch(
    `${tableUrl("mvp_support_conversations")}?auth_user_id=eq.${auth.user.id}&status=eq.open`,
    {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({ user_unread_count: 0, updated_at: new Date().toISOString() }),
    },
  ).catch(() => null);
  if (!res?.ok) return NextResponse.json({ error: "support_read_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
