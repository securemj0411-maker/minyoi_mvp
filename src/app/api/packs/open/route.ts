import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { reportCriticalIncident } from "@/lib/operational-notifier";
import { openPack, type PackBand } from "@/lib/pack-open";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_USER_REF = 64;
const MIN_REQUESTED_CARDS = 2;
const MAX_REQUESTED_CARDS = 30;
const CARDS_PER_COST_STEP = 2;
const BASE_COST_BY_BAND: Record<PackBand, number> = {
  1: 1,
  2: 2,
  3: 3,
};

const RATE_LIMIT_MAX = Math.max(1, Number(process.env.PACKS_OPEN_RATE_LIMIT_MAX ?? 5));
const RATE_LIMIT_WINDOW_SECONDS = Math.max(1, Number(process.env.PACKS_OPEN_RATE_LIMIT_WINDOW_SECONDS ?? 10));

function isPackBand(value: unknown): value is PackBand {
  return value === 1 || value === 2 || value === 3;
}

function clampRequestedCards(value: number) {
  const rounded = Number.isFinite(value) ? Math.round(value) : MIN_REQUESTED_CARDS;
  const capped = Math.max(MIN_REQUESTED_CARDS, Math.min(MAX_REQUESTED_CARDS, rounded));
  return capped % 2 === 0 ? capped : capped - 1;
}

function tokenCostFor(band: PackBand, requestedCards: number) {
  return Math.ceil(requestedCards / CARDS_PER_COST_STEP) * BASE_COST_BY_BAND[band];
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
  const band = Number(payload.band);
  if (!isPackBand(band)) {
    return NextResponse.json({ error: "band must be 1, 2, or 3" }, { status: 400 });
  }

  const userRefRaw = req.headers.get("x-user-ref") ?? payload.userRef;
  const userRef = typeof userRefRaw === "string" ? userRefRaw.trim().slice(0, MAX_USER_REF) : "";
  if (!userRef) {
    return NextResponse.json({ error: "missing user ref" }, { status: 400 });
  }
  if (userRef !== userRefForAuthUser(auth.user.id)) {
    return NextResponse.json({ error: "user ref does not match session" }, { status: 403 });
  }

  if (!isAdminUser(auth.user)) {
    const rate = await checkRateLimit({
      bucketKey: `packs.open:user:${userRef}`,
      maxRequests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "요청이 너무 잦아요. 잠시 후 다시 시도해주세요.",
          retryAfter: rate.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      );
    }
  }

  const requestedCards = Number(payload.requestedCards ?? 2);
  const sanitizedRequestedCards = clampRequestedCards(requestedCards);
  const tokenCost = tokenCostFor(band, sanitizedRequestedCards);
  const infinite = isAdminUser(auth.user);

  try {
    const result = await openPack({
      band,
      userRef,
      authUserId: auth.user.id,
      isInfiniteCredits: infinite,
      tokensSpent: tokenCost,
      requestedCards: sanitizedRequestedCards,
      consumeInventory: !infinite,
    });
    // 성공/실패/취소 모두 result 안에 tokensRemaining/infiniteCredits 포함됨
    if (result.result === "success") {
      return NextResponse.json(result);
    }
    // unavailable/refunded: 크레딧 차감 없음 (atomic RPC에서 amount=0으로 처리)
    return NextResponse.json({
      ...result,
      tokensRemaining: undefined,
      infiniteCredits: infinite,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("pack_open threw", { userRef, band, requestedCards: sanitizedRequestedCards, err: message });
    await reportCriticalIncident({
      source: "packs.open.threw",
      summary: `openPack 예외 (크레딧 미차감 상태)`,
      context: { userRef, band, requestedCards: sanitizedRequestedCards, error: message },
    });
    return NextResponse.json({ result: "error", message }, { status: 500 });
  }
}
