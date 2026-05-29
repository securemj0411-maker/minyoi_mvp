// Wave launch-51: 카카오 공유 보너스 상태 API.
//   GET 은 공유 보너스 cooldown 조회만 담당한다.
//   POST 즉시 지급 경로는 검증 없는 free-credit 표면이라 폐기했다.

import { NextRequest, NextResponse } from "next/server";

import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOLDOWN_HOURS = 24;
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
  return NextResponse.json(
    {
      ok: false,
      error: "deprecated",
      message: "공유 보너스는 카카오 공유 성공 웹훅으로만 지급돼요.",
    },
    { status: 410 },
  );
}
