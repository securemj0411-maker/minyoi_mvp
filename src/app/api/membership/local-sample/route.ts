import { NextResponse } from "next/server";
import { readMembershipLocalSample } from "@/lib/membership-local-samples";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const district = (url.searchParams.get("district") ?? url.searchParams.get("region") ?? "").trim();
  if (!district) {
    return NextResponse.json({ ok: false, error: "district_required" }, { status: 400 });
  }

  const item = await readMembershipLocalSample(district);
  return NextResponse.json({ ok: true, item });
}
