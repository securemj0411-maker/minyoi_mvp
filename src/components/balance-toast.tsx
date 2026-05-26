"use client";

// Wave 746 (2026-05-24): Universal 크레딧 보너스 토스트 — 모든 페이지 + 모든 보너스 source 통합.
//   layout.tsx 에 박혀 어떤 페이지에 있든 balance UPDATE 감지 시 토스트 표시.
//
// 작동:
//   1. mvp_user_credits 본인 row Realtime subscribe (postgres_changes UPDATE filter auth_user_id)
//   2. balance 증가 감지 → 토스트 "+N 크레딧 받았어요 🎁" + nav 갱신 event
//   3. last_share_bonus_at 변경 감지 → "minyoi:share-bonus-received" event 발생 (explore-client cooldown UI 갱신용)
//
// 커버 범위:
//   - 레퍼럴 가입 (referral_signup_*) — claim endpoint 처리 후 balance UPDATE
//   - 결제 시 추천인 보너스 (referral_first_payment)
//   - 카톡 공유 webhook (kakao_share_webhook)
//   - 미래 모든 balance 증가 케이스
//
// 익명 (비로그인) 시 subscribe X. 인증된 사용자만.

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const TOAST_DURATION_MS = 4500;

export default function BalanceToast() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let cancelled = false;
    let toastTimer: number | null = null;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    // Wave 765b (2026-05-26 사용자 정정 — 토스트 중복 버그):
    //   사용자: "3크레딧 받았어요 토스트 뜬 후, 다른 매물 보면 2크레딧 받았어요 라고 또 띄움".
    //   원인: Realtime UPDATE event 가 reconnect 시 replay 되거나 multiple trigger.
    //   해결: 마지막 toast 의 (oldBalance, newBalance) transition 30초 내 중복 차단 (dedup).
    let lastShownTransition: { from: number; to: number; ts: number } | null = null;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user || cancelled) return;
      const userId = data.user.id;

      const channel = supabase
        .channel(`balance-toast-${userId}`)
        .on(
          "postgres_changes" as never,
          {
            event: "UPDATE",
            schema: "public",
            table: "mvp_user_credits",
            filter: `auth_user_id=eq.${userId}`,
          },
          (payload: {
            new?: { balance?: number; last_share_bonus_at?: string | null };
            old?: { balance?: number; last_share_bonus_at?: string | null };
          }) => {
            const newBalance = Number(payload.new?.balance ?? 0);
            const oldBalance = Number(payload.old?.balance ?? 0);
            if (newBalance <= oldBalance) return;

            const gained = newBalance - oldBalance;

            // Wave 765b dedup — 같은 transition 30초 내 두 번째 트리거 차단.
            const now = Date.now();
            if (lastShownTransition) {
              const sameTransition = lastShownTransition.from === oldBalance && lastShownTransition.to === newBalance;
              const ageMs = now - lastShownTransition.ts;
              if (sameTransition && ageMs < 30_000) return;
            }
            lastShownTransition = { from: oldBalance, to: newBalance, ts: now };

            // 카톡 공유 보너스인지 (last_share_bonus_at 변경) — explore-client cooldown UI 갱신용 event
            const shareBonus =
              payload.new?.last_share_bonus_at &&
              payload.new.last_share_bonus_at !== payload.old?.last_share_bonus_at;
            if (shareBonus) {
              window.dispatchEvent(new CustomEvent("minyoi:share-bonus-received"));
            }

            // 토스트 표시 — Wave 765d (2026-05-26 사용자 정정): "크레딧" 추상 → "매물 N개 더 보기" 직관화.
            //   카톡 공유 보너스 (shareBonus=true) 일 때 "공유 고마워요!" prefix.
            //   가치 명시 — 매물 1개 ≈ 시세분석 + 셀러 + 원본 정보 (사용자 평균 ~3만원 차익 매물).
            const toastMessage = shareBonus
              ? `공유 고마워요! 매물 ${gained}개 더 자세히 볼 수 있어요`
              : `매물 ${gained}개 더 자세히 볼 수 있어요 🎁`;
            setToast(toastMessage);
            if (toastTimer != null) window.clearTimeout(toastTimer);
            toastTimer = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);

            // nav 크레딧 자동 refetch
            window.dispatchEvent(new CustomEvent("minyoi:credits-changed"));
          },
        )
        .subscribe();
      channelRef = channel;
    })();

    return () => {
      cancelled = true;
      if (toastTimer != null) window.clearTimeout(toastTimer);
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 px-4"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-[0_12px_32px_rgba(49,130,246,0.4)] animate-[fade-in_240ms_ease-out]">
        {toast}
      </div>
    </div>
  );
}
