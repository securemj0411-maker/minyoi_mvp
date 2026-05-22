// Wave launch-49: scrap localStorage → DB
//   사용자 짚음: localStorage 만 박혀 있어 device 간 sync X, logout 시 사라짐, 5MB 한도 risk.
//   DB 박음 = 사용자 데이터 보호 + 모든 device 동기화.
//
// Endpoints:
//   GET    /api/packs/scraps              → 사용자 scrap 목록
//   POST   /api/packs/scraps              → 매물 scrap 추가 (body: { pid, pool_item })
//   DELETE /api/packs/scraps?pid=X        → scrap 제거
//   POST   /api/packs/scraps/import       → localStorage 의 scrap bulk import (별 route)
import { NextRequest, NextResponse } from "next/server";

import { restFetch, jsonBody, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ScrapRow = {
  pid: number;
  pool_item: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userRef = userRefForAuthUser(auth.user.id);
  if (!userRef) {
    return NextResponse.json({ error: "user_ref_missing" }, { status: 400 });
  }

  try {
    const res = await restFetch(
      `${tableUrl("mvp_user_scraps")}?select=pid,pool_item,created_at,updated_at&user_ref=eq.${encodeURIComponent(userRef)}&order=created_at.desc&limit=500`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as ScrapRow[];
    return NextResponse.json({ items: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("scraps/GET failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "scraps_load_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userRef = userRefForAuthUser(auth.user.id);
  if (!userRef) {
    return NextResponse.json({ error: "user_ref_missing" }, { status: 400 });
  }

  let body: { pid?: unknown; pool_item?: unknown; items?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // bulk import (localStorage migration) 또는 single add 둘 다 지원
  const rawItems: Array<{ pid: unknown; pool_item: unknown }> = Array.isArray(body.items)
    ? (body.items as Array<{ pid: unknown; pool_item: unknown }>)
    : body.pid != null
      ? [{ pid: body.pid, pool_item: body.pool_item }]
      : [];

  const upsertRows = rawItems
    .map((item) => {
      const pid = Number(item.pid);
      if (!Number.isFinite(pid) || pid <= 0) return null;
      const poolItem = item.pool_item;
      if (!poolItem || typeof poolItem !== "object") return null;
      return {
        user_ref: userRef,
        pid,
        pool_item: poolItem,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (upsertRows.length === 0) {
    return NextResponse.json({ error: "no_valid_items" }, { status: 400 });
  }

  try {
    await restFetch(
      `${tableUrl("mvp_user_scraps")}?on_conflict=user_ref,pid`,
      {
        method: "POST",
        headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
        body: jsonBody(upsertRows),
      },
    );
    return NextResponse.json({ ok: true, count: upsertRows.length });
  } catch (err) {
    console.error("scraps/POST failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "scraps_save_failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userRef = userRefForAuthUser(auth.user.id);
  if (!userRef) {
    return NextResponse.json({ error: "user_ref_missing" }, { status: 400 });
  }

  const pidParam = req.nextUrl.searchParams.get("pid");
  const pid = Number(pidParam);
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ error: "pid_required" }, { status: 400 });
  }

  try {
    await restFetch(
      `${tableUrl("mvp_user_scraps")}?user_ref=eq.${encodeURIComponent(userRef)}&pid=eq.${pid}`,
      { method: "DELETE", headers: serviceHeaders() },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("scraps/DELETE failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "scraps_delete_failed" }, { status: 500 });
  }
}
