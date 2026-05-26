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
// Wave 736 (2026-05-24): 카톡 공유 보너스. share-webhook 과 일관성.
// Wave 765c (2026-05-26 사용자 BM 결정): 3 → 2 — 균형 (인센티브 + BM 안전).
// Note: POST 호출은 Wave 734 에서 deprecate 됨 (즉시 지급 → webhook 의존). GET 은 cooldown 조회용 유지.
const BONUS_AMOUNT = 2;

type CreditsRow = {
  user_ref: string;
  balance: number;
  last_share_bonus_at: string | null;
};

// Wave launch-53 (사용자 짚음 "하루 1번이면 그다음 button 비활성/알림 떠야"):
//   GET = cooldown 상태만 조회 (보너스 안 박음). mount 시 호출해서 button 상태 결정.
export async function GET(req: NextRequest) {
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
    const res = await restFetch(
      `${tableUrl("mvp_user_credits")}?select=last_share_bonus_at&user_ref=eq.${encodeURIComponent(userRef)}&limit=1`,
      { headers },
    );
    const rows = (await res.json()) as Array<{ last_share_bonus_at: string | null }>;
    const last = rows[0]?.last_share_bonus_at ? Date.parse(rows[0].last_share_bonus_at) : null;

    if (last == null || !Number.isFinite(last)) {
      return NextResponse.json({ canShare: true, remainingHours: 0 });
    }
    const hoursSince = (Date.now() - last) / (60 * 60 * 1000);
    if (hoursSince >= COOLDOWN_HOURS) {
      return NextResponse.json({ canShare: true, remainingHours: 0 });
    }
    return NextResponse.json({
      canShare: false,
      remainingHours: Math.ceil(COOLDOWN_HOURS - hoursSince),
    });
  } catch (err) {
    console.error("share-bonus status failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ canShare: true, remainingHours: 0 }, { status: 200 });
  }
}

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
