// Wave launch-51: 카카오 공유 보너스 API.
//   사용자가 Kakao.Share.sendDefault callback 후 호출.
//   진짜 공유 검증 X (카카오 webhook 없음) — abuse 차단 = 24h 1회 제한.
//   통과 시 mvp_user_credits.balance += 1 + last_share_bonus_at = NOW().

import { NextRequest, NextResponse } from "next/server";

import { restFetch, jsonBody, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOLDOWN_HOURS = 24;
const BONUS_AMOUNT = 1;

type CreditsRow = {
  user_ref: string;
  balance: number;
  last_share_bonus_at: string | null;
};

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userRef = userRefForAuthUser(auth.user.id);
  if (!userRef) {
    return NextResponse.json({ error: "user_ref_missing" }, { status: 400 });
  }

  try {
    const headers = serviceHeaders();
    // 현재 credits + 마지막 공유 시점 fetch
    const res = await restFetch(
      `${tableUrl("mvp_user_credits")}?select=user_ref,balance,last_share_bonus_at&user_ref=eq.${encodeURIComponent(userRef)}&limit=1`,
      { headers },
    );
    const rows = (await res.json()) as CreditsRow[];
    const current = rows[0] ?? null;

    if (current?.last_share_bonus_at) {
      const last = Date.parse(current.last_share_bonus_at);
      const hoursSince = (Date.now() - last) / (60 * 60 * 1000);
      if (Number.isFinite(hoursSince) && hoursSince < COOLDOWN_HOURS) {
        const remainingHours = Math.ceil(COOLDOWN_HOURS - hoursSince);
        return NextResponse.json({
          ok: false,
          error: "cooldown",
          remainingHours,
          message: `${remainingHours}시간 후에 다시 받을 수 있어요`,
        }, { status: 429 });
      }
    }

    const newBalance = (current?.balance ?? 0) + BONUS_AMOUNT;
    const now = new Date().toISOString();

    await restFetch(`${tableUrl("mvp_user_credits")}?on_conflict=user_ref`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: jsonBody([{
        user_ref: userRef,
        auth_user_id: auth.user.id,
        balance: newBalance,
        last_share_bonus_at: now,
        updated_at: now,
      }]),
    });

    return NextResponse.json({
      ok: true,
      bonus: BONUS_AMOUNT,
      balance: newBalance,
      message: `공유해주셔서 감사해요! 크레딧 ${BONUS_AMOUNT}개 받았어요`,
    });
  } catch (err) {
    console.error("share-bonus failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "share_bonus_failed" }, { status: 500 });
  }
}
