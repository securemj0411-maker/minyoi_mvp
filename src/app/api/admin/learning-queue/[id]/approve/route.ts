// Wave 244 (2026-05-19): learning queue admin approve endpoint.
//
// POST /api/admin/learning-queue/[id]/approve
//   body: { patchType?: 'mustNotContain' | 'narrow_split' | 'other' (default 'mustNotContain') }
//
// 동작:
//   1. mvp_catalog_pending_patches 에 row insert (sku_id + patterns + source_queue_id)
//   2. mvp_catalog_learning_queue.status = 'approved' + reviewed_at + reviewed_by 박음
//   3. catalog 자동 박힘 X — admin manual approve 강제. 사용자 정책.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PATCH_TYPES = new Set(["mustNotContain", "narrow_split", "other"]);

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

  let body: { patchType?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body 없어도 default 적용.
  }
  const patchType = body.patchType ?? "mustNotContain";
  if (!VALID_PATCH_TYPES.has(patchType)) {
    return NextResponse.json({ error: `invalid_patch_type: ${patchType}` }, { status: 400 });
  }

  try {
    // 1. queue row fetch (sku_id + suggested_must_not_contain 가져옴)
    const qRes = await restFetch(
      `${tableUrl("mvp_catalog_learning_queue")}?select=id,sku_id,suggested_must_not_contain,status&id=eq.${queueId}&limit=1`,
      { headers: serviceHeaders() },
    );
    if (!qRes.ok) {
      return NextResponse.json({ error: "queue_fetch_failed" }, { status: 500 });
    }
    const qRows = (await qRes.json()) as Array<{ id: number; sku_id: string; suggested_must_not_contain: string[] | null; status: string }>;
    const queueRow = qRows[0];
    if (!queueRow) {
      return NextResponse.json({ error: "queue_not_found" }, { status: 404 });
    }
    if (queueRow.status !== "pending") {
      return NextResponse.json({ error: `already_${queueRow.status}` }, { status: 409 });
    }
    const patterns = queueRow.suggested_must_not_contain ?? [];
    if (patterns.length === 0) {
      return NextResponse.json({ error: "no_patterns_to_apply" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 2. pending_patches insert
    const insertRes = await restFetch(`${tableUrl("mvp_catalog_pending_patches")}`, {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "return=representation" },
      body: JSON.stringify([{
        sku_id: queueRow.sku_id,
        patch_type: patchType,
        patterns,
        source_queue_id: queueRow.id,
        status: "pending",
        created_by: adminEmail,
      }]),
    });
    if (!insertRes.ok) {
      const detail = await insertRes.text().catch(() => "");
      return NextResponse.json({ error: "patch_insert_failed", detail: detail.slice(0, 200) }, { status: 500 });
    }
    const inserted = (await insertRes.json()) as Array<{ id: number }>;
    const patchId = inserted[0]?.id ?? null;

    // 3. queue row 업데이트
    const patchRes = await restFetch(`${tableUrl("mvp_catalog_learning_queue")}?id=eq.${queueId}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "approved",
        reviewed_at: now,
        reviewed_by: adminEmail,
        updated_at: now,
      }),
    });
    if (!patchRes.ok) {
      // pending_patch 는 이미 박혔지만 queue 업데이트 실패 — admin 이 수동 정정 가능.
      const detail = await patchRes.text().catch(() => "");
      console.warn("[admin/learning-queue/approve] queue patch failed but pending_patch saved", detail.slice(0, 200));
      return NextResponse.json({
        ok: true,
        partial: true,
        patchId,
        warning: "pending_patch_saved_but_queue_update_failed",
      });
    }

    return NextResponse.json({
      ok: true,
      patchId,
      queueId,
      skuId: queueRow.sku_id,
      patterns,
      by: adminEmail,
      at: now,
    });
  } catch (err) {
    console.error("[admin/learning-queue/approve] error", err);
    return NextResponse.json({ error: "approve_failed" }, { status: 500 });
  }
}
