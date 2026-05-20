import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { submitRevealFeedback } from "@/lib/pack-open";
import { checkRateLimit } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_USER_REF = 64;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;

async function assertVisibleRevealOwnership(userRef: string, pid: number) {
  const rowsRes = await restFetch(
    `${tableUrl("mvp_pack_reveals")}?select=pid&user_ref=eq.${encodeURIComponent(userRef)}&pid=eq.${pid}&hidden_at=is.null&limit=1`,
    { headers: serviceHeaders() },
  );
  const rows = (await rowsRes.json()) as Array<{ pid: number }>;
  return rows.length > 0;
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const userRefRaw = req.headers.get("x-user-ref") ?? payload.userRef;
  const userRef = typeof userRefRaw === "string" ? userRefRaw.trim().slice(0, MAX_USER_REF) : "";
  const pid = Number(payload.pid);
  const saved = payload.saved;

  if (!userRef) return NextResponse.json({ error: "missing_user_ref" }, { status: 400 });
  if (userRef !== userRefForAuthUser(auth.user.id)) {
    return NextResponse.json({ error: "user_ref_mismatch" }, { status: 403 });
  }
  if (!Number.isFinite(pid)) return NextResponse.json({ error: "invalid_pid" }, { status: 400 });
  if (typeof saved !== "boolean") return NextResponse.json({ error: "invalid_saved" }, { status: 400 });

  if (!isAdminUser(auth.user)) {
    const rate = await checkRateLimit({
      bucketKey: `reveals.save:user:${userRef}`,
      maxRequests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: rate.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
  }

  try {
    const ownsReveal = await assertVisibleRevealOwnership(userRef, pid);
    if (!ownsReveal) return NextResponse.json({ error: "reveal_not_found" }, { status: 404 });

    if (saved) {
      await submitRevealFeedback({ userRef, pid, feedbackType: "watching", note: "스크랩 저장" });
    } else {
      await restFetch(
        `${tableUrl("mvp_reveal_feedback")}?user_ref=eq.${encodeURIComponent(userRef)}&pid=eq.${pid}&feedback_type=eq.watching`,
        { method: "DELETE", headers: serviceHeaders("return=minimal") },
      );
    }

    return NextResponse.json({ ok: true, saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[packs/reveals/save] failed", { err: message, userRef, pid, saved });
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
