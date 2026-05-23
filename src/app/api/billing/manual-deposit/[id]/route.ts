// Wave launch-97: 사용자 측 신청 status polling endpoint.
//   본인 신청만 조회 가능. 운영자 승인 또는 cron auto-grant 시 status 변경 → frontend 즉시 인지.

import { NextRequest, NextResponse } from "next/server";

import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: idRaw } = await ctx.params;
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const res = await restFetch(
    `${tableUrl("mvp_manual_deposit_requests")}?select=id,auth_user_id,amount,status,scheduled_auto_approve_at,decided_at,decided_by,created_at&id=eq.${id}&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  const rows = (await res.json()) as Array<{
    id: number;
    auth_user_id: string;
    amount: number;
    status: string;
    scheduled_auto_approve_at: string;
    decided_at: string | null;
    decided_by: string | null;
    created_at: string;
  }>;
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // 본인 신청만 (admin 우회 안 둠 — 사용자 측 polling 용도).
  if (row.auth_user_id !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: row.id,
    amount: row.amount,
    status: row.status,
    scheduledAutoApproveAt: row.scheduled_auto_approve_at,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by,
    createdAt: row.created_at,
  });
}
