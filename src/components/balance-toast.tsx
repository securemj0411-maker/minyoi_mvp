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

    // Wave 767 (2026-05-26 사용자 보고 — 매 상세보기마다 토스트 박힘):
    //   원인: Supabase Realtime payload.old 가 default REPLICA IDENTITY 일 때 balance column 안 박힘.
    //   → oldBalance = Number(undefined ?? 0) = 0 → 매 차감 후 newBalance > 0 = "받았어요" 토스트.
    //   해결 A (DB): REPLICA IDENTITY FULL 박음 (Migration wave767).
    //   해결 B (client safety net — 이 변수): localStorage 의 last seen balance 와 비교.
    //     payload.old 신뢰 안 되더라도 lastSeenBalance < newBalance 일 때만 토스트 박힘.
    const LAST_SEEN_STORAGE_KEY = "minyoi:balance:last-seen";
    let lastSeenBalance: number | null = null;
    try {
      const raw = window.localStorage.getItem(LAST_SEEN_STORAGE_KEY);
      if (raw != null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) lastSeenBalance = parsed;
      }
    } catch { /* localStorage 사용 불가 — null 유지 */ }

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
            // Wave 767 — payload.old.balance 가 undefined (default replica identity) 이면 lastSeenBalance 사용.
            const oldBalanceFromPayload = payload.old?.balance;
            const oldBalance = oldBalanceFromPayload != null
              ? Number(oldBalanceFromPayload)
              : (lastSeenBalance ?? newBalance); // lastSeenBalance 없으면 newBalance (= gained 0 → toast skip)
            const previousLastSeen = lastSeenBalance;
            // lastSeenBalance 갱신 — 다음 event 의 비교 기준
            lastSeenBalance = newBalance;
            try { window.localStorage.setItem(LAST_SEEN_STORAGE_KEY, String(newBalance)); } catch { /* ignore */ }

            if (newBalance <= oldBalance) return;
            // Wave 767 추가 safety — lastSeenBalance 있었으면 그것 기준으로 한 번 더 검증 (증가 시만 토스트).
            if (previousLastSeen != null && newBalance <= previousLastSeen) return;

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
