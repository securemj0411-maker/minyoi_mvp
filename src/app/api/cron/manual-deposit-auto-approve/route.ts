// Wave launch-96: 3분 안에 운영자 미승인 → 자동 grant (양심 신뢰).
//   schedule: 매분. pending + scheduled_auto_approve_at <= NOW() 매물 다 grant.

import { NextRequest, NextResponse } from "next/server";

import { checkCronAuth } from "@/lib/cron-auth";
import { grantManualDeposit, type ManualDepositRequest } from "@/lib/manual-deposit-grant";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { notifyAdminTelegram } from "@/lib/telegram-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { authOk } = checkCronAuth(req);
  if (!authOk) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const nowIso = new Date().toISOString();
  // pending 중 scheduled_at 지난 row 다 fetch.
  const res = await restFetch(
    `${tableUrl("mvp_manual_deposit_requests")}?select=*&status=eq.pending&scheduled_auto_approve_at=lte.${encodeURIComponent(nowIso)}&order=created_at.asc&limit=20`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 500 });
  }
  const rows = (await res.json()) as ManualDepositRequest[];
  const results: Array<{ id: number; ok: boolean; reason?: string }> = [];
  for (const row of rows) {
    try {
      const grant = await grantManualDeposit(row, "auto");
      results.push({ id: row.id, ok: grant.ok, reason: grant.error });
      if (grant.ok) {
        // 자동 grant 됐다고 운영자에게 알림 (이미 timer 가 흘러서 인지하고 있을 수 있지만 audit).
        await notifyAdminTelegram(
          `⏱ *자동 지급 완료* (3분 경과)\n\n• 신청 ID: \`${row.id}\`\n• 입금자: ${row.depositor_name}\n• 크레딧: ${row.amount.toLocaleString("ko-KR")}\n• 신규 잔액: ${grant.newBalance?.toLocaleString("ko-KR")}`,
        );
      }
    } catch (err) {
      results.push({ id: row.id, ok: false, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
