// Wave 199 (2026-05-19): 가입 동의 기록 API.
// 호출 시점: auth/callback 직후, 또는 이메일 가입 직후. 클라이언트가 localStorage 의 동의 정보 전달.
// 보안:
//   - 인증된 user 만 본인 consent insert. user_id = auth.uid()
//   - service_role_key 가 박음 (RLS 우회 가능)
//   - 같은 (user_id, consent_type) 중복 insert 허용 — 약관 개정 시 재동의 row 추가 (history).
import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl, jsonBody } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConsentInput = {
  terms?: boolean;
  privacy?: boolean;
  age_14?: boolean;
  marketing?: boolean;
};

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: ConsentInput;
  try {
    body = (await req.json()) as ConsentInput;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // 필수 3개 검증 — 동의 안 했으면 reject (Wave 198 가입 단 컨트롤도 동일)
  if (!body.terms || !body.privacy || !body.age_14) {
    return NextResponse.json({ error: "required_consents_missing" }, { status: 400 });
  }

  // IP / User-Agent (증빙)
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const rows = [
    { type: "terms" as const, agreed: body.terms },
    { type: "privacy" as const, agreed: body.privacy },
    { type: "age_14" as const, agreed: body.age_14 },
    ...(body.marketing ? [{ type: "marketing" as const, agreed: true }] : []),
  ].filter((r) => r.agreed).map((r) => ({
    user_id: auth.user.id,
    consent_type: r.type,
    version: "v1",
    ip_address: ipAddress,
    user_agent: userAgent,
    source: "signup",
  }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  try {
    const res = await restFetch(tableUrl("mvp_user_consents"), {
      method: "POST",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody(rows),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[consents] insert failed", { status: res.status, text });
      return NextResponse.json({ error: "consents_insert_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, inserted: rows.length });
  } catch (err) {
    console.error("[consents] error", err);
    return NextResponse.json({ error: "consents_insert_failed" }, { status: 500 });
  }
}
