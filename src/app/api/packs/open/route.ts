import { NextResponse } from "next/server";
import { openPack, type PackBand } from "@/lib/pack-open";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_USER_REF = 64;

function isPackBand(value: unknown): value is PackBand {
  return value === 1 || value === 2 || value === 3;
}

export async function POST(req: Request) {
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

  const tokensSpent = Number(payload.tokensSpent ?? band);
  const requestedCards = Number(payload.requestedCards ?? 2);

  try {
    const result = await openPack({
      band,
      userRef,
      tokensSpent: Number.isFinite(tokensSpent) ? Math.max(0, Math.round(tokensSpent)) : band,
      requestedCards: Number.isFinite(requestedCards) ? Math.max(1, Math.min(4, Math.round(requestedCards))) : 2,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ result: "error", message }, { status: 500 });
  }
}
