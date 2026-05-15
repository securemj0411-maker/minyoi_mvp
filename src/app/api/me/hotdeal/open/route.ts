// Wave 93b: 핫딜 reservation "열기" — opened 마킹 (디테일 정보는 reservations API에서 이미 옴).
// body: { pids: number[] | "all" } — 단일/복수/전체.

import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { checkRateLimit } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wave 106: spam 차단. 카드 까는 endpoint = queue.status='consumed' 처리 → spam 시 다른 사용자에게
// reroute 차단됨. 분당 10회 = 정상 사용자 한 번에 다 까는 케이스 충분히 커버.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

type OpenBody = { pids?: number[] | "all" };

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: OpenBody;
  try {
    body = (await req.json()) as OpenBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const userRef = userRefForAuthUser(auth.user.id);

  if (!isAdminUser(auth.user)) {
    const rate = await checkRateLimit({
      bucketKey: `hotdeal.open:user:${userRef}`,
      maxRequests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "rate_limited", message: "너무 자주 열고 있어요. 잠시 후 다시 시도해주세요.", retryAfter: rate.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
  }
  const now = new Date().toISOString();

  let filter: string;
  if (body.pids === "all") {
    filter = `user_ref=eq.${encodeURIComponent(userRef)}&decision=eq.pending&expires_at=gte.${encodeURIComponent(now)}`;
  } else if (Array.isArray(body.pids) && body.pids.length > 0) {
    const cleaned = body.pids.filter((p) => Number.isFinite(p));
    if (cleaned.length === 0) return NextResponse.json({ opened: 0 });
    filter = `user_ref=eq.${encodeURIComponent(userRef)}&pid=in.(${cleaned.join(",")})&decision=eq.pending&expires_at=gte.${encodeURIComponent(now)}`;
  } else {
    return NextResponse.json({ error: "pids required" }, { status: 400 });
  }

  const res = await restFetch(`${tableUrl("mvp_hotdeal_reservations")}?${filter}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      decision: "opened",
      opened_at: now,
      updated_at: now,
    }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: `open failed: ${await res.text().catch(() => "")}` }, { status: 500 });
  }
  const rows = (await res.json()) as Array<{ pid: number }>;

  // 핫딜 reveal도 mvp_pack_reveals에 박아 "나의 상품"에 자연스럽게 노출.
  // pack_open_id NULL + source='hotdeal'. expected_profit / confidence는 queue 정보로.
  if (rows.length > 0) {
    const pids = rows.map((r) => r.pid);
    const queueRes = await restFetch(
      `${tableUrl("mvp_hotdeal_queue")}?select=pid,profit_amount&pid=in.(${pids.join(",")})`,
      { headers: serviceHeaders() },
    );
    const queueByPid = new Map(((await queueRes.json()) as Array<{ pid: number; profit_amount: number }>).map((r) => [Number(r.pid), Number(r.profit_amount)]));

    // 이미 reveal row 있는 pid는 skip (re-open 시 중복 방지).
    const existingRes = await restFetch(
      `${tableUrl("mvp_pack_reveals")}?select=pid&user_ref=eq.${encodeURIComponent(userRef)}&pid=in.(${pids.join(",")})`,
      { headers: serviceHeaders() },
    );
    const existing = new Set(((await existingRes.json()) as Array<{ pid: number }>).map((r) => Number(r.pid)));
    const fresh = pids.filter((p) => !existing.has(p));

    if (fresh.length > 0) {
      await restFetch(`${tableUrl("mvp_pack_reveals")}`, {
        method: "POST",
        headers: { ...serviceHeaders(), Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(fresh.map((pid) => {
          const profit = queueByPid.get(pid) ?? 0;
          return {
            pid,
            user_ref: userRef,
            pack_open_id: null,
            source: "hotdeal",
            expected_profit_min: profit,
            expected_profit_max: profit,
            confidence: 0.9,
            revealed_at: now,
          };
        })),
      }).catch(() => undefined);
    }
  }

  // Wave 106: 카드 까는 순간 = consumed. "샀어요/포기" 응답 메커니즘 폐기.
  // 사용자 정책: 까면 끝, 시간 내 안 까면 다른 사람한테 자동 reroute.
  // queue.status='consumed' 박아서 다른 사용자에게 reroute 차단.
  if (rows.length > 0) {
    const pids = rows.map((r) => r.pid);
    await restFetch(
      `${tableUrl("mvp_hotdeal_queue")}?pid=in.(${pids.join(",")})&status=in.(reserved,available)`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders(), Prefer: "return=minimal" },
        body: JSON.stringify({ status: "consumed", consumed_at: now, updated_at: now }),
      },
    ).catch(() => undefined);
  }

  return NextResponse.json({ opened: rows.length, pids: rows.map((r) => r.pid) });
}
