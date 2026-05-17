import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

// 2026-05-17: 사용자 매물 삭제 (dashboard "선택 삭제" / "전체 삭제").
// mvp_pack_reveals + mvp_reveal_feedback row 다 delete (user_ref 본인 매물만).
// 진짜 DELETE — undo 없음. 사용자 의도 = "내 dashboard 에서 안 보이게".

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_PIDS_PER_REQUEST = 500;

export async function POST(req: Request) {
  const userResult = await requireSupabaseUser(req);
  if (!userResult.ok) {
    return NextResponse.json({ error: userResult.error }, { status: userResult.status });
  }
  const userRef = userRefForAuthUser(userResult.user.id);
  const encodedUserRef = encodeURIComponent(userRef);

  const rateLimitKey = `packs-reveals-delete:${userRef}`;
  const rate = checkRateLimit(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS);
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited", retryAfterSeconds: rate.retryAfterSeconds }, { status: 429 });
  }

  let body: { pids?: unknown; all?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const all = body.all === true;
  const pids = Array.isArray(body.pids)
    ? body.pids.filter((v) => typeof v === "number" && Number.isFinite(v)).map(Number)
    : [];

  if (!all && pids.length === 0) {
    return NextResponse.json({ error: "no_pids" }, { status: 400 });
  }
  if (pids.length > MAX_PIDS_PER_REQUEST) {
    return NextResponse.json({ error: "too_many_pids", max: MAX_PIDS_PER_REQUEST }, { status: 400 });
  }

  const headers = serviceHeaders("return=minimal");

  // 전체 삭제 or pid 매칭 delete. 둘 다 user_ref 본인 것만.
  const baseFilter = `user_ref=eq.${encodedUserRef}`;
  const pidFilter = all ? "" : `&pid=in.(${pids.join(",")})`;

  try {
    await Promise.all([
      restFetch(`${tableUrl("mvp_pack_reveals")}?${baseFilter}${pidFilter}`, {
        method: "DELETE",
        headers,
      }),
      restFetch(`${tableUrl("mvp_reveal_feedback")}?${baseFilter}${pidFilter}`, {
        method: "DELETE",
        headers,
      }),
    ]);
    return NextResponse.json({ ok: true, mode: all ? "all" : "selected", count: all ? "all" : pids.length });
  } catch (err) {
    console.error("[packs/reveals/delete] error", err);
    return NextResponse.json({ error: "delete_failed", message: "삭제에 실패했어요." }, { status: 500 });
  }
}
