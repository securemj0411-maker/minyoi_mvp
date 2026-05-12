import { NextResponse } from "next/server";
import { loadInventory } from "@/lib/pack-open";
import { checkRateLimit, clientIpKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RATE_LIMIT_MAX = Math.max(1, Number(process.env.PACKS_INVENTORY_RATE_LIMIT_MAX ?? 30));
const RATE_LIMIT_WINDOW_SECONDS = Math.max(1, Number(process.env.PACKS_INVENTORY_RATE_LIMIT_WINDOW_SECONDS ?? 10));

export async function GET(req: Request) {
  const rate = await checkRateLimit({
    bucketKey: `packs.inventory:ip:${clientIpKey(req)}`,
    maxRequests: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        retryAfter: rate.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  try {
    const inventory = await loadInventory();
    return NextResponse.json({ inventory, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
