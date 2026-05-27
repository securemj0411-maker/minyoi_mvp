// Wave 886.9 (2026-05-27): GPS 좌표 → Kakao reverseGeocode 결과 반환 (저장 X).
//   사용자가 GPS로 잡힌 위치를 확인하고 OK/취소할 수 있도록 분리.
//   POST /api/user/home-region 으로 저장하는 건 사용자 확인 후 별도 호출.

import { NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/kakao-reverse-geocode";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "invalid_coords" }, { status: 400 });
  }
  const geo = await reverseGeocode(lat, lng);
  if (!geo.ok) {
    return NextResponse.json({ ok: false, error: geo.error ?? "geocode_failed" }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    region1: geo.region1,
    region2: geo.region2,
    region3: geo.region3,
    fullPath: geo.fullPath,
    lat,
    lng,
  });
}
