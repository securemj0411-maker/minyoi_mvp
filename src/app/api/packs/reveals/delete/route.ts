import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

// 2026-05-17: 사용자 매물 삭제 (dashboard "선택 삭제" / "전체 삭제").
// Wave 240: hard delete 대신 mvp_pack_reveals soft-hide.
// 사용자 의도는 "내 dashboard 에서 안 보이게"이고, feedback/report/매수 신호는 보존해야 한다.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_PIDS_PER_REQUEST = 500;

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userRef = userRefForAuthUser(auth.user.id);
  const encodedUserRef = encodeURIComponent(userRef);

  const rate = await checkRateLimit({
    bucketKey: `reveals.delete:user:${userRef}`,
    maxRequests: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "삭제 요청이 너무 잦아요. 잠시 후 다시 시도해주세요.", retryAfter: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
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

  // 전체 삭제 or pid 매칭 soft-hide. user_ref 본인 것만.
  const baseFilter = `user_ref=eq.${encodedUserRef}`;
  const pidFilter = all ? "" : `&pid=in.(${pids.join(",")})`;
  const now = new Date().toISOString();

  try {
    await restFetch(`${tableUrl("mvp_pack_reveals")}?${baseFilter}${pidFilter}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        hidden_at: now,
        hidden_reason: all ? "user_hide_all" : "user_hide_selected",
        hidden_source: "me_dashboard",
      }),
    });
    return NextResponse.json({ ok: true, mode: all ? "all" : "selected", count: all ? "all" : pids.length });
  } catch (err) {
    console.error("[packs/reveals/delete] hide error", err);
    return NextResponse.json({ error: "hide_failed", message: "숨김 처리에 실패했어요." }, { status: 500 });
  }
}
