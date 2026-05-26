// Wave 886.4 (2026-05-27): 카카오 주소 검색 endpoint.
//   GET /api/user/home-region/search?q=상도동 → [{ fullPath, region1/2/3, lat, lng }]
//   사용자 선택 후 frontend가 lat/lng를 POST /api/user/home-region 으로 전달 → 기존 GPS 경로 재사용.

import { NextResponse } from "next/server";
import { searchAddress } from "@/lib/kakao-address-search";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ ok: true, results: [] });
  }
  const limit = Math.min(20, Math.max(5, Number(url.searchParams.get("limit") ?? "15") || 15));

  const res = await searchAddress(q, limit);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error ?? "search_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, results: res.results });
}
