import { NextResponse } from "next/server";
import { fetchJoongnaDetail } from "@/lib/joongna";
import { isDaangnMarketplaceSource, isJoongnaMarketplaceSource, listingUrlForSource, marketplaceSourceLabel, normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { marketplaceFactsFromRawJson, marketplaceLocationCombinedWithRegion } from "@/lib/marketplace-safety";
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

  // 2026-05-26: ready 검사 + daangn 매물 분기 순서 조정.
  //   기존: ready 검사 fail 시 즉시 404 → daangn 매물 (pool 0건) 다 차단 → UI "동네 정보 없음".
  //   변경: raw_listings 먼저 조회. daangn 매물이면 ready 무관 region 반환 (auth user 이므로 안전).
  //         다른 source 는 ready 검사 통과해야 다음 단계.
  const rows = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid,source,seller_source,url,description_preview,raw_json,daangn_region_name&pid=eq.${pid}&limit=1`,
    { headers: serviceHeaders() },
  ).then((res) => res.json() as Promise<Array<{
    pid: number;
    source: string | null;
    seller_source: string | null;
    url: string | null;
    description_preview: string | null;
    raw_json: Record<string, unknown> | null;
    daangn_region_name: string | null;
  }>>);
  const row = rows[0];
  if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // daangn 매물 fast-path: pool ready 무관 region 반환.
  const normalizedSourceForFast = normalizeMarketplaceSource(row.source ?? row.seller_source);
  if (isDaangnMarketplaceSource(normalizedSourceForFast) && row.daangn_region_name) {
    return NextResponse.json({ ok: true, location: row.daangn_region_name.trim(), source: "stored" });
  }

  if (!(await isReadyPoolPid(pid))) {
    return NextResponse.json({ ok: false, error: "not_ready" }, { status: 404 });
  }

  const marketplaceSource = normalizeMarketplaceSource(row.source ?? row.seller_source);
  const storedLocation = marketplaceLocationCombinedWithRegion(row.raw_json, row.description_preview, row.daangn_region_name);
  if (storedLocation) {
    return NextResponse.json({ ok: true, location: storedLocation, source: "stored" });
  }
  const facts = marketplaceFactsFromRawJson({
    marketplaceSource,
    marketplaceLabel: marketplaceSourceLabel(marketplaceSource),
    rawJson: row.raw_json,
  });
  if (isDaangnMarketplaceSource(marketplaceSource)) {
    return NextResponse.json({ ok: true, location: null, source: "unavailable" });
  }
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
