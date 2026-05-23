// Wave launch-97: cau admin page 에 표시할 pending 신청 list.

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

  // 최근 24h pending + 최근 처리된 5개 (참고용)
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const res = await restFetch(
    `${tableUrl("mvp_manual_deposit_requests")}?select=*&created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=50`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  const rows = await res.json();

  return NextResponse.json({ requests: rows });
}
