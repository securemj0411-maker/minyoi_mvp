// Wave 93b: 클라이언트가 Pro 여부 확인용 (UI 게이팅).

import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { getProStatus } from "@/lib/user-subscription";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);
  const status = await getProStatus(auth.user, userRef);
  return NextResponse.json(status);
}
