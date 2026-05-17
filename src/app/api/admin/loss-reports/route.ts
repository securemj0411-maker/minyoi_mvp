// Wave 182 (2026-05-17): 운영자 손해 신고 검수 API.
// GET: 신고 목록 (pending → resolved → dismissed 순)
// PATCH: 신고 status + 응답 메시지 update.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { restFetch, serviceHeaders, tableUrl, jsonBody } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeedbackRow = {
  id: number;
  user_ref: string;
  pid: number;
  feedback_type: string;
  note: string;
  source: string;
  admin_status: string | null;
  admin_response_note: string | null;
  admin_responded_at: string | null;
  compensation_granted_tokens: number;
  created_at: string;
  updated_at: string;
};

type ListingMetaRow = {
  pid: number;
  name: string | null;
  price: number | null;
  thumbnail_url: string | null;
};

const VALID_STATUSES = new Set(["pending", "resolved", "dismissed"]);

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const url = new URL(req.url);
  const statusFilter = (url.searchParams.get("status") ?? "all").trim().toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? "100") || 100));

  try {
    let filter = "feedback_type=eq.loss_report";
    if (statusFilter === "pending") filter += "&admin_status=is.null";
    else if (statusFilter === "resolved") filter += "&admin_status=eq.resolved";
    else if (statusFilter === "dismissed") filter += "&admin_status=eq.dismissed";
    // statusFilter === "all" → 모두

    const feedbackRes = await restFetch(
      `${tableUrl("mvp_reveal_feedback")}?select=*&${filter}&order=created_at.desc&limit=${limit}`,
      { headers: serviceHeaders() },
    );
    const rows = (await feedbackRes.json()) as FeedbackRow[];

    // pending 우선 정렬 (admin_status=null 먼저, 그 다음 dismissed → resolved).
    rows.sort((a, b) => {
      const aPending = a.admin_status == null || a.admin_status === "pending";
      const bPending = b.admin_status == null || b.admin_status === "pending";
      if (aPending !== bPending) return aPending ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const pids = Array.from(new Set(rows.map((r) => Number(r.pid))));
    let listingMap = new Map<number, ListingMetaRow>();
    if (pids.length > 0) {
      const listingRes = await restFetch(
        `${tableUrl("mvp_listings")}?select=pid,name,price,thumbnail_url&pid=in.(${pids.join(",")})`,
        { headers: serviceHeaders() },
      );
      const listings = (await listingRes.json()) as ListingMetaRow[];
      listingMap = new Map(listings.map((l) => [Number(l.pid), l]));
    }

    const items = rows.map((r) => {
      const listing = listingMap.get(Number(r.pid)) ?? null;
      return {
        id: r.id,
        userRef: r.user_ref,
        pid: r.pid,
        note: r.note,
        source: r.source,
        adminStatus: r.admin_status ?? "pending",
        adminResponseNote: r.admin_response_note,
        adminRespondedAt: r.admin_responded_at,
        compensationGrantedTokens: r.compensation_granted_tokens,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        listing: listing
          ? {
              name: listing.name,
              price: listing.price,
              thumbnailUrl: listing.thumbnail_url,
              bunjangUrl: `https://m.bunjang.co.kr/products/${r.pid}`,
            }
          : null,
      };
    });

    const counts = {
      pending: items.filter((i) => i.adminStatus === "pending").length,
      resolved: items.filter((i) => i.adminStatus === "resolved").length,
      dismissed: items.filter((i) => i.adminStatus === "dismissed").length,
      total: items.length,
    };

    return NextResponse.json({ items, counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[admin/loss-reports] GET failed", { err: message });
    return NextResponse.json({ error: "loss_reports_failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const payload = (body ?? {}) as Record<string, unknown>;

  const id = Number(payload.id);
  const status = String(payload.adminStatus ?? "").trim().toLowerCase();
  const responseNote = typeof payload.adminResponseNote === "string" ? payload.adminResponseNote : "";

  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });

  try {
    const updateRes = await restFetch(
      `${tableUrl("mvp_reveal_feedback")}?id=eq.${id}`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders(), Prefer: "return=representation" },
        body: jsonBody({
          admin_status: status,
          admin_response_note: responseNote.slice(0, 2000),
          admin_responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!updateRes.ok) {
      const text = await updateRes.text();
      console.error("[admin/loss-reports] PATCH failed", { status: updateRes.status, text });
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
    const rows = (await updateRes.json()) as FeedbackRow[];
    return NextResponse.json({ ok: true, updated: rows[0] ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[admin/loss-reports] PATCH error", { err: message });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
