import { NextRequest, NextResponse } from "next/server";

import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManualDepositHistoryRow = {
  id: number;
  plan_key: string;
  amount: number;
  price_krw: number;
  depositor_name: string;
  status: string;
  scheduled_auto_approve_at: string;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const res = await restFetch(
    `${tableUrl("mvp_manual_deposit_requests")}?select=id,plan_key,amount,price_krw,depositor_name,status,scheduled_auto_approve_at,decided_at,decided_by,created_at&auth_user_id=eq.${encodeURIComponent(auth.user.id)}&order=created_at.desc&limit=20`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) return NextResponse.json({ error: "lookup_failed" }, { status: 500 });

  const rows = (await res.json()) as ManualDepositHistoryRow[];

  return NextResponse.json({
    requests: rows.map((row) => ({
      id: row.id,
      planKey: row.plan_key,
      credits: row.amount,
      priceKrw: row.price_krw,
      depositorName: row.depositor_name,
      status: row.status,
      scheduledAutoApproveAt: row.scheduled_auto_approve_at,
      decidedAt: row.decided_at,
      decidedBy: row.decided_by,
      createdAt: row.created_at,
    })),
  });
}
