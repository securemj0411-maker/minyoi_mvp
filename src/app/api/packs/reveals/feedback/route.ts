import { NextResponse } from "next/server";
import { submitRevealFeedback, type RevealFeedbackType } from "@/lib/pack-open";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_USER_REF = 64;
const FEEDBACK_TYPES = new Set<RevealFeedbackType>([
  "interested",
  "bought",
  "missed_sold",
  "bad_pick",
  "watching",
]);

function isFeedbackType(value: unknown): value is RevealFeedbackType {
  return typeof value === "string" && FEEDBACK_TYPES.has(value as RevealFeedbackType);
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const userRefRaw = req.headers.get("x-user-ref") ?? payload.userRef;
  const userRef = typeof userRefRaw === "string" ? userRefRaw.trim().slice(0, MAX_USER_REF) : "";
  const pid = Number(payload.pid);
  const feedbackType = payload.feedbackType;
  const note = typeof payload.note === "string" ? payload.note : "";

  if (!userRef) return NextResponse.json({ error: "missing user ref" }, { status: 400 });
  if (userRef !== userRefForAuthUser(auth.user.id)) {
    return NextResponse.json({ error: "user ref does not match session" }, { status: 403 });
  }
  if (!Number.isFinite(pid)) return NextResponse.json({ error: "invalid pid" }, { status: 400 });
  if (!isFeedbackType(feedbackType)) return NextResponse.json({ error: "invalid feedback type" }, { status: 400 });

  try {
    await submitRevealFeedback({ userRef, pid, feedbackType, note });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
