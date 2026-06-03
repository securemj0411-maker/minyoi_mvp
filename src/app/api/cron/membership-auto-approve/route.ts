import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { cronProjectRoleSkip } from "@/lib/cron-guard";
import { approveMembershipApplication } from "@/lib/membership-application-approval";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { notifyAdminTelegram } from "@/lib/telegram-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type DueApplicationRow = {
  id: number;
  display_name: string | null;
  email: string | null;
  product_key: string | null;
  price_krw: number | null;
  scheduled_auto_approve_at: string | null;
};

export async function GET(req: NextRequest) {
  const { authOk } = checkCronAuth(req);
  if (!authOk) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const roleSkip = cronProjectRoleSkip("membership_auto_approve");
  if (roleSkip) return NextResponse.json(roleSkip);

  const nowIso = new Date().toISOString();
  const res = await restFetch(
    `${tableUrl("mvp_membership_applications")}?select=id,display_name,email,product_key,price_krw,scheduled_auto_approve_at&status=eq.pending&scheduled_auto_approve_at=lte.${encodeURIComponent(nowIso)}&order=created_at.asc&limit=20`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 500 });

  const rows = (await res.json()) as DueApplicationRow[];
  const results: Array<{ id: number; ok: boolean; activated?: boolean; status?: string | null; reason?: string | null }> = [];
  for (const row of rows) {
    try {
      const approval = await approveMembershipApplication(row.id, "auto", null);
      results.push({ id: row.id, ok: approval.ok, activated: approval.activated, status: approval.status, reason: approval.error });
      if (approval.ok && approval.activated) {
        await notifyAdminTelegram(
          [
            "⏱ 멤버십 자동 승인 완료 (5분 경과)",
            `예약 ID: ${row.id}`,
            `이름: ${row.display_name ?? "이름 없음"}`,
            `이메일: ${row.email ?? "email 없음"}`,
            `상품: ${row.product_key ?? approval.productKey ?? "membership"} / ${Number(row.price_krw ?? approval.priceKrw ?? 0).toLocaleString("ko-KR")}원`,
          ].join("\n"),
          { parseMode: null },
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
