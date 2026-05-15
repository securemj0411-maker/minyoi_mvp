// Wave 93b: 핫딜 reservation "열기" — opened 마킹 (디테일 정보는 reservations API에서 이미 옴).
// body: { pids: number[] | "all" } — 단일/복수/전체.

import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OpenBody = { pids?: number[] | "all" };

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: OpenBody;
  try {
    body = (await req.json()) as OpenBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const userRef = userRefForAuthUser(auth.user.id);
  const now = new Date().toISOString();

  let filter: string;
  if (body.pids === "all") {
    filter = `user_ref=eq.${encodeURIComponent(userRef)}&decision=eq.pending&expires_at=gte.${encodeURIComponent(now)}`;
  } else if (Array.isArray(body.pids) && body.pids.length > 0) {
    const cleaned = body.pids.filter((p) => Number.isFinite(p));
    if (cleaned.length === 0) return NextResponse.json({ opened: 0 });
    filter = `user_ref=eq.${encodeURIComponent(userRef)}&pid=in.(${cleaned.join(",")})&decision=eq.pending&expires_at=gte.${encodeURIComponent(now)}`;
  } else {
    return NextResponse.json({ error: "pids required" }, { status: 400 });
  }

  const res = await restFetch(`${tableUrl("mvp_hotdeal_reservations")}?${filter}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      decision: "opened",
      opened_at: now,
      updated_at: now,
    }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: `open failed: ${await res.text().catch(() => "")}` }, { status: 500 });
  }
  const rows = (await res.json()) as Array<{ pid: number }>;
  return NextResponse.json({ opened: rows.length, pids: rows.map((r) => r.pid) });
}
