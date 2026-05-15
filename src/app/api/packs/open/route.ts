import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { reportCriticalIncident } from "@/lib/operational-notifier";
import { openPack, type PackBand } from "@/lib/pack-open";
import { computeTokenCost, type CostFilters } from "@/lib/pack-cost";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_USER_REF = 64;
const MIN_REQUESTED_CARDS = 2;
const MAX_REQUESTED_CARDS = 30;

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

function parseFilters(payload: Record<string, unknown>): CostFilters | null {
  const f = payload.filters as Record<string, unknown> | undefined;
  if (!f) return null;
  const minProfitManwon = Number(f.minProfitManwon ?? NaN);
  const minConfidencePct = Number(f.minConfidencePct ?? NaN);
  const priceMaxManwon = Number(f.priceMaxManwon ?? NaN);
  if (!Number.isFinite(minProfitManwon) || !Number.isFinite(minConfidencePct) || !Number.isFinite(priceMaxManwon)) {
    return null;
  }
  return {
    minProfitManwon: Math.max(0, Math.min(100, minProfitManwon)),
    minConfidencePct: Math.max(0, Math.min(100, minConfidencePct)),
    priceMaxManwon: Math.max(0, Math.min(10000, priceMaxManwon)),
  };
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
  const filters = parseFilters(payload);  // Wave 78: 동적 cost — 고급 모드에서만 filter 전달, 없으면 base × steps만
  const tokenCost = computeTokenCost(band, sanitizedRequestedCards, filters);
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
    return NextResponse.json({ result: "error", message: "pack_open_failed" }, { status: 500 });
  }
}
