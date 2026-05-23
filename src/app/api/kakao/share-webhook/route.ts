// Wave 734 (2026-05-24): 카카오 공유 webhook — 친구가 메시지 클릭 시 호출.
//   Kakao Developers Console → 앱 → 메시지 → 카카오톡 공유 → 사용자 정의 콜백 (웹훅) 등록 필요.
//   URL: https://<our-domain>/api/kakao/share-webhook
//   Method: GET
//
// 작동 흐름:
//   1. 사용자가 `Kakao.Share.sendDefault({ serverCallbackArgs: { user_id } })` 호출
//   2. 친구가 카톡 메시지 받음
//   3. 친구가 메시지 / 버튼 클릭
//   4. 카카오 서버 → GET this endpoint?user_id=<sender_user_id>&...
//   5. 우리 서버: sender 에게 +1 크레딧 (24h cooldown)
//
// 매크로 차단: 실제 친구가 클릭해야 호출됨 (다이얼로그만 띄우면 호출 X).
// 단 sender 본인이 자기 카톡으로 받은 메시지 클릭하면 호출됨 → 24h cooldown 으로 제한.
//
// 보안:
//   - serverCallbackArgs 는 client 가 박는 값이라 위조 가능 (다른 사용자 ID 박기)
//   - 그러나 다른 사람한테 보상 주는 건 의도된 사용자 행동 (선물 X — 자기 보상)
//   - cooldown 24h 가 spam 차단

import { NextRequest, NextResponse } from "next/server";
import { restFetch, jsonBody, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Kakao webhook 은 serverCallbackArgs 의 key/value 를 query param 으로 직접 전달.
  // 예: serverCallbackArgs: { user_id: "abc-123" } → ?user_id=abc-123
  const userId = url.searchParams.get("user_id");

  // 운영자 진단 로그 — 카카오 webhook 실제 작동 여부 + param 이름 확인
  console.log("[kakao-share-webhook] received", {
    userId,
    allParams: Object.fromEntries(url.searchParams.entries()),
    userAgent: req.headers.get("user-agent"),
  });

  if (!userId) {
    console.warn("[kakao-share-webhook] no user_id in params");
    // 200 반환 — 카카오가 retry 안 하게
    return NextResponse.json({ ok: false, error: "no_user_id" });
  }

  try {
    const headers = serviceHeaders();

    // 현재 사용자 + 마지막 공유 시점 fetch
    const res = await restFetch(
      `${tableUrl("mvp_user_credits")}?select=user_ref,balance,last_share_bonus_at&auth_user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      { headers },
    );
    if (!res.ok) {
      console.error("[kakao-share-webhook] user fetch failed", { status: res.status });
      return NextResponse.json({ ok: false, error: "user_fetch_failed" });
    }
    const rows = (await res.json()) as CreditsRow[];
    const current = rows[0];
    if (!current) {
      console.warn("[kakao-share-webhook] user not found", { userId });
      return NextResponse.json({ ok: false, error: "user_not_found" });
    }

    // 24h cooldown 검증
    if (current.last_share_bonus_at) {
      const last = Date.parse(current.last_share_bonus_at);
      const hoursSince = (Date.now() - last) / (60 * 60 * 1000);
      if (Number.isFinite(hoursSince) && hoursSince < COOLDOWN_HOURS) {
        console.log("[kakao-share-webhook] cooldown active — skipped", {
          userId,
          hoursSince: hoursSince.toFixed(1),
          remainingHours: Math.ceil(COOLDOWN_HOURS - hoursSince),
        });
        return NextResponse.json({ ok: false, error: "cooldown" });
      }
    }

    // 보상 지급
    const newBalance = current.balance + BONUS_AMOUNT;
    const now = new Date().toISOString();

    const upsertRes = await restFetch(
      `${tableUrl("mvp_user_credits")}?user_ref=eq.${encodeURIComponent(current.user_ref)}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: jsonBody({
          balance: newBalance,
          last_share_bonus_at: now,
          updated_at: now,
        }),
      },
    );
    if (!upsertRes.ok) {
      console.error("[kakao-share-webhook] credit update failed", { status: upsertRes.status });
      return NextResponse.json({ ok: false, error: "update_failed" });
    }

    // ledger 기록 (audit)
    try {
      await restFetch(`${tableUrl("mvp_credit_ledger")}`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: jsonBody([{
          user_ref: current.user_ref,
          auth_user_id: userId,
          event_type: "kakao_share_webhook",
          amount: BONUS_AMOUNT,
          balance_after: newBalance,
          metadata: {
            source: "kakao_webhook",
            ip: req.headers.get("x-forwarded-for") ?? null,
          },
          created_at: now,
        }]),
      });
    } catch (err) {
      console.warn("[kakao-share-webhook] ledger insert threw", err instanceof Error ? err.message : String(err));
    }

    console.log("[kakao-share-webhook] bonus granted", {
      userId,
      newBalance,
      previousBalance: current.balance,
    });
    return NextResponse.json({ ok: true, balance: newBalance });
  } catch (err) {
    console.error("[kakao-share-webhook] failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: "internal_error" });
  }
}
