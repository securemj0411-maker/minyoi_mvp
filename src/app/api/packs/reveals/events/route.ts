import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { isDetailEventType } from "@/lib/detail-analytics";
import { checkRateLimit } from "@/lib/rate-limit";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_MAX = 240;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_SESSION_ID = 96;
const MAX_SURFACE = 48;
const MAX_METADATA_BYTES = 6000;

function compactMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(raw).slice(0, 40)) {
    if (item == null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      next[key.slice(0, 80)] = typeof item === "string" ? item.slice(0, 500) : item;
    }
  }
  const encoded = JSON.stringify(next);
  if (encoded.length <= MAX_METADATA_BYTES) return next;
  return { truncated: true };
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
  const pid = Number(payload.pid);
  const eventType = payload.eventType;
  const userRef = userRefForAuthUser(auth.user.id);

  if (!Number.isFinite(pid) || pid <= 0) return NextResponse.json({ error: "invalid pid" }, { status: 400 });
  if (!isDetailEventType(eventType)) return NextResponse.json({ error: "invalid event type" }, { status: 400 });

  if (!isAdminUser(auth.user)) {
    const rate = await checkRateLimit({
      bucketKey: `detail_events:user:${userRef}`,
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

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId.trim().slice(0, MAX_SESSION_ID) : null;
  const surface = typeof payload.surface === "string" && payload.surface.trim()
    ? payload.surface.trim().slice(0, MAX_SURFACE)
    : "detail_modal";
  const stepIndex = Number.isFinite(Number(payload.stepIndex)) ? Math.trunc(Number(payload.stepIndex)) : null;
  const stepTotal = Number.isFinite(Number(payload.stepTotal)) ? Math.trunc(Number(payload.stepTotal)) : null;

  try {
    await restFetch(tableUrl("mvp_detail_events"), {
      method: "POST",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        user_ref: userRef,
        auth_user_id: auth.user.id,
        pid: Math.trunc(pid),
        event_type: eventType,
        surface,
        session_id: sessionId,
        step_index: stepIndex,
        step_total: stepTotal,
        metadata: compactMetadata(payload.metadata),
      }),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[detail-events] insert failed", { err: message, userRef, pid, eventType });
    return NextResponse.json({ error: "detail_event_failed" }, { status: 500 });
  }
}
