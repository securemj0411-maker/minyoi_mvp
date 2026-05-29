// Wave 773 (2026-05-27): 사용자 거주 동네 설정/조회 API.
//   POST: GPS (lat/lng) 또는 manual (daangn_region_id) 둘 다 받음.
//   GET: 사용자 현재 home region 반환.

import { NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/kakao-reverse-geocode";
import { matchDaangnRegionByPath, listAllDaangnRegions } from "@/lib/daangn-region-matcher";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { hasUserActionHeader } from "@/lib/user-action-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SetHomeRegionPayload = {
  // GPS path
  lat?: number;
  lng?: number;
  fullPath?: string;
  // Manual path
  daangn_region_id?: string;
};

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  if (url.searchParams.get("list") === "1") {
    // 검색용 region list (onboarding dropdown).
    return NextResponse.json({ ok: true, regions: listAllDaangnRegions() });
  }

  const rows = await restFetch(
    `${tableUrl("mvp_user_home_regions")}?select=daangn_region_id,daangn_region_name,daangn_full_path,source,set_at&user_id=eq.${auth.user.id}&limit=1`,
    { headers: serviceHeaders() },
  ).then((res) => res.json() as Promise<Array<{
    daangn_region_id: string;
    daangn_region_name: string;
    daangn_full_path: string | null;
    source: string;
    set_at: string;
  }>>);

  const row = rows[0];
  return NextResponse.json({ ok: true, home_region: row ?? null });
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  if (!hasUserActionHeader(req.headers)) {
    return NextResponse.json({ ok: false, error: "missing_user_action_header" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as SetHomeRegionPayload;

  let regionId: string | null = null;
  let regionName: string | null = null;
  let fullPath: string | null = null;
  let source: "gps" | "manual" = "manual";

  if (body.lat != null && body.lng != null) {
    // GPS/address path: preview/search 단계에서 사용자가 확인한 fullPath 가 있으면 그 값을 우선한다.
    // 같은 좌표를 저장 시점에 다시 reverse-geocode 하며 다른 행정동으로 바뀌는 UX를 막는다.
    let geoFullPath = typeof body.fullPath === "string" ? body.fullPath.trim().replace(/\s+/g, " ") : "";
    let geoRegionName = geoFullPath ? geoFullPath.split(" ").filter(Boolean).at(-1) ?? geoFullPath : "";

    if (!geoFullPath) {
      const geo = await reverseGeocode(body.lat, body.lng);
      if (!geo.ok || !geo.fullPath) {
        return NextResponse.json({ ok: false, error: "geocode_failed", detail: geo.error }, { status: 400 });
      }
      geoFullPath = geo.fullPath;
      geoRegionName = geo.region3 ?? geo.region2 ?? geo.fullPath;
    }

    const match = matchDaangnRegionByPath(geoFullPath);
    if (!match) {
      // Fallback: Kakao 결과 그대로 저장 (Daangn region 못 찾아도 사용자 거주지 자체는 알아야).
      regionId = "0";  // unknown daangn id
      regionName = geoRegionName || geoFullPath;
      fullPath = geoFullPath;
    } else {
      regionId = match.daangn_region_id;
      regionName = match.daangn_region_name;
      fullPath = match.daangn_full_path;
    }
    source = "gps";
  } else if (body.daangn_region_id) {
    // Manual path: dropdown 선택. ID로 region 정보 조회.
    const all = listAllDaangnRegions();
    const found = all.find((r) => r.daangn_region_id === String(body.daangn_region_id));
    if (!found) {
      return NextResponse.json({ ok: false, error: "invalid_region_id" }, { status: 400 });
    }
    regionId = found.daangn_region_id;
    regionName = found.daangn_region_name;
    fullPath = found.daangn_full_path;
    source = "manual";
  } else {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  // Upsert.
  const upsertRes = await restFetch(
    `${tableUrl("mvp_user_home_regions")}?on_conflict=user_id`,
    {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        user_id: auth.user.id,
        daangn_region_id: regionId,
        daangn_region_name: regionName,
        daangn_full_path: fullPath,
        source,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!upsertRes.ok) {
    const err = await upsertRes.text().catch(() => "");
    return NextResponse.json({ ok: false, error: "upsert_failed", detail: err }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    home_region: { daangn_region_id: regionId, daangn_region_name: regionName, daangn_full_path: fullPath, source },
  });
}
