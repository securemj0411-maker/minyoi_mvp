import { NextResponse } from "next/server";
import { fetchJoongnaDetail } from "@/lib/joongna";
import { isDaangnMarketplaceSource, isJoongnaMarketplaceSource, listingUrlForSource, marketplaceSourceLabel, normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { marketplaceFactsFromRawJson, marketplaceLocationCombinedWithRegion } from "@/lib/marketplace-safety";
import { resolveDaangnFullRegion } from "@/lib/daangn-region-resolver";
import { decodePoolAccessToken } from "@/lib/pool-access-token";
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

  const body = await req.json().catch(() => ({})) as { pid?: unknown; accessToken?: unknown };
  // Wave 755 (2026-05-26): teaser locked 매물은 synthetic pid 라 DB lookup fail.
  //   feed teaser → accessToken 발급 → 여기서 decode → real pid 사용.
  //   accessToken 우선, 없으면 pid (admin/내 매물 화면 같은 unlocked path 호환).
  const accessToken = typeof body.accessToken === "string" ? body.accessToken : null;
  const tokenPid = accessToken ? decodePoolAccessToken(accessToken) : null;
  const pid = tokenPid ?? Number(body.pid);
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_pid" }, { status: 400 });
  }

  // 2026-05-26: ready 검사 + daangn 매물 분기 순서 조정.
  //   기존: ready 검사 fail 시 즉시 404 → daangn 매물 (pool 0건) 다 차단 → UI "동네 정보 없음".
  //   변경: raw_listings 먼저 조회. daangn 매물이면 ready 무관 region 반환 (auth user 이므로 안전).
  //         다른 source 는 ready 검사 통과해야 다음 단계.
  const rows = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid,source,seller_source,url,description_preview,raw_json,daangn_region_id,daangn_region_name&pid=eq.${pid}&limit=1`,
    { headers: serviceHeaders() },
  ).then((res) => res.json() as Promise<Array<{
    pid: number;
    source: string | null;
    seller_source: string | null;
    url: string | null;
    description_preview: string | null;
    raw_json: Record<string, unknown> | null;
    daangn_region_id: string | null;
    daangn_region_name: string | null;
  }>>);
  const row = rows[0];
  // 2026-05-26 v3: row 없을 때 404 대신 200 with null — frontend cache 의 stale pid 차단 시 console error red 방지.
  //   UI 측 결과 동일 ("동네 정보 없음" fallback). 다만 error log noise 제거.
  if (!row) return NextResponse.json({ ok: true, location: null, source: "not_found" });

  // 2026-05-26 v2: ready 검사 완전 제거.
  //   원인: 피드 노출 시점엔 ready 였던 매물이 cron tick 사이 invalidated/spent 되면
  //         endpoint 호출 시 ready 검사 fail → 404. 사용자가 본 매물 표시 못 함.
  //   auth user 통과한 다음이라 보안 영향 X. row 존재만 검증.
  const marketplaceSource = normalizeMarketplaceSource(row.source ?? row.seller_source);

  // Wave 772 (2026-05-27): region_id → "{시도} {시군구} {동}" full path resolve.
  const resolvedRegion = resolveDaangnFullRegion(row.daangn_region_id, row.daangn_region_name);

  // daangn 매물 fast-path: full region 즉시 반환.
  if (isDaangnMarketplaceSource(marketplaceSource) && resolvedRegion) {
    return NextResponse.json({ ok: true, location: resolvedRegion, source: "stored" });
  }
  const storedLocation = marketplaceLocationCombinedWithRegion(row.raw_json, row.description_preview, resolvedRegion);
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
