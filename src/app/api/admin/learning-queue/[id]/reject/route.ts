// Wave 244 (2026-05-19): learning queue admin reject endpoint.
//
// POST /api/admin/learning-queue/[id]/reject
//   body: { reason?: string }
//
// 동작:
//   1. mvp_catalog_learning_queue.status = 'rejected' + false_positive=true + reviewed_at + reviewed_by 박음
//   2. enqueueLearningSignal 이 false_positive=true 인 (sku_id, matched_text) 다시 안 박음.
//      → 같은 reject 한 패턴 다시 큐에 안 들어옴.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const adminEmail = auth.user.email ?? auth.user.id;

  const { id: idRaw } = await ctx.params;
  const queueId = Number(idRaw);
  if (!Number.isFinite(queueId) || queueId <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: { reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body 없어도 OK
  }
  const reviewerNote = (body.reason ?? "").toString().slice(0, 300);

  try {
    const qRes = await restFetch(
      `${tableUrl("mvp_catalog_learning_queue")}?select=id,status&id=eq.${queueId}&limit=1`,
      { headers: serviceHeaders() },
    );
    if (!qRes.ok) {
      return NextResponse.json({ error: "queue_fetch_failed" }, { status: 500 });
    }
    const qRows = (await qRes.json()) as Array<{ id: number; status: string }>;
    const queueRow = qRows[0];
    if (!queueRow) {
      return NextResponse.json({ error: "queue_not_found" }, { status: 404 });
    }
    if (queueRow.status !== "pending") {
      return NextResponse.json({ error: `already_${queueRow.status}` }, { status: 409 });
    }

    const now = new Date().toISOString();

    const patchPayload: Record<string, unknown> = {
      status: "rejected",
      false_positive: true,
      reviewed_at: now,
      reviewed_by: adminEmail,
      updated_at: now,
    };
    // reason 은 ai_reason 컬럼 덮어쓰지 않음. reviewed_by 가 reason 포함 — admin email + note (간단).
    if (reviewerNote.length > 0) {
      patchPayload.reviewed_by = `${adminEmail} :: ${reviewerNote}`;
    }

    const patchRes = await restFetch(`${tableUrl("mvp_catalog_learning_queue")}?id=eq.${queueId}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify(patchPayload),
    });
    if (!patchRes.ok) {
      const detail = await patchRes.text().catch(() => "");
      return NextResponse.json({ error: "reject_failed", detail: detail.slice(0, 200) }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      queueId,
      by: adminEmail,
      at: now,
      reason: reviewerNote || null,
    });
  } catch (err) {
    console.error("[admin/learning-queue/reject] error", err);
    return NextResponse.json({ error: "reject_failed" }, { status: 500 });
  }
}
