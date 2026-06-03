import { NextResponse } from "next/server";
import { readPreviewPoolCache } from "@/lib/preview-pool-showcases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_SECONDS = 300;

// Public guest preview endpoint.
// The expensive source/price/velocity selection runs in /api/cron/preview-pool.
// This route intentionally reads only the precomputed DB materialized cache.
export async function GET() {
  const items = await readPreviewPoolCache();
  const cacheControl = items.length > 0
    ? `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`
    : "no-store, max-age=0";
  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control": cacheControl,
      },
    },
  );
}
