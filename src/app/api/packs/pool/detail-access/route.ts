import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { consumeDetailAccess } from "@/lib/detail-access";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isReadyPoolPid(pid: number): Promise<boolean> {
  const rows = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid&pid=eq.${pid}&status=eq.ready&limit=1`,
    { headers: serviceHeaders() },
  ).then((res) => res.json() as Promise<Array<{ pid?: number }>>);
  return rows.length > 0;
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const pid = Number(payload.pid);
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ error: "invalid_pid", message: "매물 정보가 올바르지 않아요." }, { status: 400 });
  }

  if (!isAdminUser(auth.user) && !(await isReadyPoolPid(pid))) {
    return NextResponse.json(
      { error: "not_ready", message: "이 매물은 지금 상세보기 대상이 아니에요. 새로고침 후 다시 확인해주세요." },
      { status: 404 },
    );
  }

  const userRef = userRefForAuthUser(auth.user.id);
  const access = await consumeDetailAccess({ user: auth.user, userRef, pid });
  if (!access.ok) {
    return NextResponse.json(
      {
        error: access.error,
        message: access.message,
        creditBalance: access.creditBalance,
        freeUsed: access.freeUsed,
        freeLimit: access.freeLimit,
      },
      { status: access.status },
    );
  }

  return NextResponse.json({
    ok: true,
    accessType: access.accessType,
    alreadyOpened: access.alreadyOpened,
    creditSpent: access.creditSpent,
    creditBalance: access.creditBalance,
    freeUsed: access.freeUsed,
    freeLimit: access.freeLimit,
  });
}
