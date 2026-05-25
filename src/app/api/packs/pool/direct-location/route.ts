import { NextResponse } from "next/server";
import { fetchJoongnaDetail } from "@/lib/joongna";
import { isJoongnaMarketplaceSource, listingUrlForSource, marketplaceSourceLabel, normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { marketplaceFactsFromRawJson, marketplaceLocationCombined } from "@/lib/marketplace-safety";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isReadyPoolPid(pid: number) {
  const rows = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid&pid=eq.${pid}&status=eq.ready&limit=1`,
    { headers: serviceHeaders() },
  ).then((res) => res.json() as Promise<Array<{ pid?: number }>>);
  return rows.length > 0;
}

async function patchTradeLocation(pid: number, rawJson: Record<string, unknown> | null, tradeLocation: string) {
  await restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${pid}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ raw_json: { ...(rawJson ?? {}), tradeLocation } }),
  }).catch((err) => console.warn("[direct-location] tradeLocation patch failed", err instanceof Error ? err.message : String(err)));
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({})) as { pid?: unknown };
  const pid = Number(body.pid);
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_pid" }, { status: 400 });
  }

  if (!(await isReadyPoolPid(pid))) {
    return NextResponse.json({ ok: false, error: "not_ready" }, { status: 404 });
  }

  const rows = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid,source,seller_source,url,description_preview,raw_json&pid=eq.${pid}&limit=1`,
    { headers: serviceHeaders() },
  ).then((res) => res.json() as Promise<Array<{
    pid: number;
    source: string | null;
    seller_source: string | null;
    url: string | null;
    description_preview: string | null;
    raw_json: Record<string, unknown> | null;
  }>>);
  const row = rows[0];
  if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const storedLocation = marketplaceLocationCombined(row.raw_json, row.description_preview);
  if (storedLocation) {
    return NextResponse.json({ ok: true, location: storedLocation, source: "stored" });
  }

  const marketplaceSource = normalizeMarketplaceSource(row.source ?? row.seller_source);
  const facts = marketplaceFactsFromRawJson({
    marketplaceSource,
    marketplaceLabel: marketplaceSourceLabel(marketplaceSource),
    rawJson: row.raw_json,
  });
  const labels = new Set((facts.tradeLabels ?? []).map((label) => label.trim()));
  if (!isJoongnaMarketplaceSource(marketplaceSource) || (!labels.has("직거래") && facts.productTradeType !== 4 && facts.productTradeType !== 5)) {
    return NextResponse.json({ ok: true, location: null, source: "unavailable" });
  }

  const listingUrl = listingUrlForSource(pid, row.url, marketplaceSource);
  if (!listingUrl) {
    return NextResponse.json({ ok: true, location: null, source: "unavailable" });
  }

  try {
    const detail = await fetchJoongnaDetail(listingUrl, 7_000);
    const liveLocation = detail.tradeLocation?.trim() || null;
    if (detail.ok && liveLocation) {
      await patchTradeLocation(pid, row.raw_json, liveLocation);
      return NextResponse.json({ ok: true, location: liveLocation, source: "live" });
    }
  } catch (err) {
    console.warn("[direct-location] live location fetch failed", err instanceof Error ? err.message : String(err));
  }

  return NextResponse.json({ ok: true, location: null, source: "unavailable" });
}
