// Wave 159 (2026-05-17): admin 전용 listing_type override.
// 운영자가 AI/regex 분류를 강제로 덮어씀. listing_type_override IS NOT NULL이면
// tick-pipeline scoreStage가 (listing_type=normal OR override=normal) 조건으로 fetch.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_OVERRIDE = new Set([
  "normal",
  "accessory",
  "parts",
  "damaged",
  "callout",
  "buying",
  "commercial",
  "multi",
  "unknown",
]);

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const adminEmail = auth.user.email ?? auth.user.id;

  let body: { pid?: number; override?: string | null; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const pid = Number(body.pid);
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ error: "invalid_pid" }, { status: 400 });
  }
  const override = body.override == null || body.override === "" ? null : String(body.override).trim();
  if (override != null && !VALID_OVERRIDE.has(override)) {
    return NextResponse.json({ error: `invalid_override: ${override}` }, { status: 400 });
  }
  const reason = String(body.reason ?? "").slice(0, 200);

  const now = new Date().toISOString();
  const patchPayload = override == null
    ? {
        listing_type_override: null,
        listing_type_override_by: null,
        listing_type_override_at: null,
        listing_type_override_reason: null,
        score_dirty: true,
        updated_at: now,
      }
    : {
        listing_type_override: override,
        listing_type_override_by: adminEmail,
        listing_type_override_at: now,
        listing_type_override_reason: reason || null,
        score_dirty: true,
        updated_at: now,
      };

  const res = await restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${pid}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify(patchPayload),
  });
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "patch_failed", detail: text.slice(0, 200) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pid, override, by: adminEmail, at: now });
}
