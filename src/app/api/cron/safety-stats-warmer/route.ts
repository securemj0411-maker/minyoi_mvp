// Wave launch-62: safety-stats cache warmer cron.
//   사용자 짚음: 첫 가입 onboarding modal 의 "몇 만건 걸렀다" 통계 로딩 느림.
//   원인: 22개 PostgREST count query 병렬 호출, in-memory cache 만 (Vercel serverless instance 별 miss).
//   fix: cron 이 매 30분 self-fetch (with cache bypass) → DB snapshot table upsert.
//        API GET 시 DB read 1회 = 빠른 응답.
//
//   schedule: vercel.json 의 "*/30 * * * *" (매 30분)
//   maxDuration: 60s (22 query × 평균 ~1s = 22s)

import { NextRequest, NextResponse } from "next/server";

import { checkCronAuth } from "@/lib/cron-auth";
import { cronProjectRoleSkip } from "@/lib/cron-guard";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const URL_BASE = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .replace(/\/rest\/v1\/?$/, "")
  .replace(/\/$/, "") + "/rest/v1";

async function warmSnapshot() {
  // self-fetch safety-stats API. 단 in-memory cache miss 강제 (bypass param 또는 fresh instance)
  // cache miss 시 22 query 실행 → response 받음 → DB 박음.
  // 단 self-fetch 는 같은 instance/region 일 수도. 그러면 in-memory cache hit 가능 — bypass 필요.
  //
  // 가장 단순 = direct DB write 보다 self-fetch + cache busting URL param.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://minyoi-mvp.vercel.app";
  const cacheBust = Date.now();
  const res = await fetch(`${baseUrl}/api/public/safety-stats?_warmer=${cacheBust}`, {
    cache: "no-store",
    headers: { "x-minyoi-warmer": "1" },
  });
  if (!res.ok) {
    throw new Error(`safety-stats self-fetch failed: ${res.status}`);
  }
  const payload = await res.json();

  // Wave launch-87 (사용자 보고 — 폰 첫 가입 시 숫자 안 나옴 진짜 원인):
  //   이전 키 "v2:global::::" (4 trailing colons) 가 API safetyStatsCacheKey 결과 "v2:global:::"
  //   (3 trailing colons) 와 mismatch → API 가 영원히 cache miss → 매번 live query 23개 fail → 500.
  //   API 코드 safetyStatsCacheKey: ["v2", "global", "", "", ""].join(":") = "v2:global:::" (3 colons).
  //   cron 도 동일하게 5 element join 으로 통일.
  const scopeKey = ["v2", "global", "", "", ""].join(":");

  await restFetch(`${tableUrl("mvp_safety_stats_snapshot")}?on_conflict=scope_key`, {
    method: "POST",
    headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: jsonBody([{
      scope_key: scopeKey,
      payload,
      updated_at: new Date().toISOString(),
    }]),
  });

  return { scopeKey, totalBlocked: (payload as { stats?: { total_blocked_7d?: number } })?.stats?.total_blocked_7d ?? 0 };
}

export async function GET(req: NextRequest) {
  const { authOk } = checkCronAuth(req);
  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const roleSkip = cronProjectRoleSkip("safety_stats_warmer");
  if (roleSkip) return NextResponse.json(roleSkip);

  try {
    const result = await warmSnapshot();
    return NextResponse.json({ ok: true, ...result, ts: new Date().toISOString() });
  } catch (err) {
    console.error("[safety-stats-warmer] failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

// Silence URL_BASE unused warning (used in env-only paths)
void URL_BASE;
