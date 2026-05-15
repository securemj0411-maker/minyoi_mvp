// Wave 93b: 핫딜 reservation 결정 — 샀어요/포기.

import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DecideBody = { pid: number; decision: "purchased" | "rejected" };

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: DecideBody;
  try {
    body = (await req.json()) as DecideBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.pid || (body.decision !== "purchased" && body.decision !== "rejected")) {
    return NextResponse.json({ error: "pid + decision required" }, { status: 400 });
  }

  const userRef = userRefForAuthUser(auth.user.id);
  const now = new Date().toISOString();

  const res = await restFetch(
    `${tableUrl("mvp_hotdeal_reservations")}?user_ref=eq.${encodeURIComponent(userRef)}&pid=eq.${body.pid}&decision=in.(pending,opened)`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({
        decision: body.decision,
        decided_at: now,
        updated_at: now,
      }),
    },
  );
  if (!res.ok) {
    return NextResponse.json({ error: `decide failed: ${await res.text().catch(() => "")}` }, { status: 500 });
  }
  const rows = (await res.json()) as Array<{ id: number }>;
  if (rows.length === 0) return NextResponse.json({ error: "no active reservation" }, { status: 404 });

  // queue도 consumed로 마킹 (purchased) 또는 다음 candidate에게 (rejected → expired-처리해서 다시 dispatch).
  const queueStatus = body.decision === "purchased" ? "consumed" : "available";
  await restFetch(`${tableUrl("mvp_hotdeal_queue")}?pid=eq.${body.pid}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({
      status: queueStatus,
      consumed_at: body.decision === "purchased" ? now : null,
      updated_at: now,
    }),
  });

  return NextResponse.json({ ok: true, decision: body.decision });
}
