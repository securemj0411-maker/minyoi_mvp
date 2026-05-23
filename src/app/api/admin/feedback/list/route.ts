// Wave launch-103: admin 피드백 검토 list — 최근 7일 + 50건.

import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await restFetch(
    `${tableUrl("mvp_user_feedback")}?select=*&created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=80`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  const rows = await res.json();
  return NextResponse.json({ feedback: rows });
}
