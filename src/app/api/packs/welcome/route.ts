import { NextResponse } from "next/server";
import { openPack } from "@/lib/pack-open";
import { checkRateLimit } from "@/lib/rate-limit";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

// 2026-05-17: 신규 가입자 welcome 5 매물 — 가입 직후 즉시 가치 인식.
// 사용자 의도: "신규가입자한테 5개 보여줘야하는데 가치를 확실히 인식시켜야"
//
// 정책:
// - 사용자별 1회만 — mvp_pack_reveals 에 row 있으면 skip
// - 무료 (consumeInventory: false, tokensSpent: 0)
// - band 2 default (중간 매물)
// - rate limit 10/분 (welcome 은 1회지만 보안)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WELCOME_BAND = 2;
// 2026-05-17 fix: openPack 이 홀수 requestedCards 를 (n-1) 짝수로 내림 (pack-open.ts:800).
// 5 요청 → 4 카드. 사용자 합의 4 수용 → WELCOME_CARDS=4 (스펙·실제 일치, 무의미한 5→4 마법 제거).
const WELCOME_CARDS = 4;

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userRef = userRefForAuthUser(auth.user.id);

  const rate = await checkRateLimit({
    bucketKey: `packs.welcome:user:${userRef}`,
    maxRequests: 10,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    // 1. 이미 reveal 매물 있으면 welcome skip (1회만).
    const existingRes = await restFetch(
      `${tableUrl("mvp_pack_reveals")}?select=pid&user_ref=eq.${encodeURIComponent(userRef)}&limit=1`,
      { headers: serviceHeaders() },
    );
    const existing = (await existingRes.json()) as Array<{ pid: number }>;
    if (existing.length > 0) {
      return NextResponse.json({ result: "already_used", reason: "사용자가 이미 매물을 받았습니다." });
    }

    // 2. 5 매물 reserve (무료).
    const packResult = await openPack({
      band: WELCOME_BAND,
      userRef,
      authUserId: auth.user.id,
      isInfiniteCredits: true, // 무료 — credit deduct skip
      tokensSpent: 0,
      requestedCards: WELCOME_CARDS,
      consumeInventory: false,
    });

    return NextResponse.json(packResult);
  } catch (err) {
    console.error("[packs/welcome] error", err);
    return NextResponse.json({ error: "welcome_failed" }, { status: 500 });
  }
}
