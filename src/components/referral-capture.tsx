"use client";

// Wave 743/744/745 (2026-05-24): 레퍼럴 추적 + 인증 후 자동 claim + 성공 토스트.
//   가입 방식 무관 (카카오 / 이메일 autoConfirm / 등) universal 처리.
//
// 두 단계:
//   1. URL ?ref= 잡아서 localStorage 에 저장 (모든 페이지 mount 시)
//   2. 사용자 인증 상태 확인 → ref 있고 로그인됐으면 /api/me/referral/claim POST → 성공 시 storage clear + 토스트 안내
//
// localStorage 사용 이유: sessionStorage 는 탭 단위. localStorage 영구.
// claim endpoint 가 self_referral / already_referred / referrer_not_found 차단.

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const REFERRAL_STORAGE_KEY = "minyoi_referral";
const REFERRAL_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
const TOAST_DURATION_MS = 4500;

export default function ReferralCapture() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. URL ?ref= → localStorage 저장
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get("ref");
      if (ref) {
        const normalized = ref.toUpperCase();
        if (REFERRAL_CODE_PATTERN.test(normalized) && !localStorage.getItem(REFERRAL_STORAGE_KEY)) {
          localStorage.setItem(REFERRAL_STORAGE_KEY, normalized);
          console.log("[referral-capture] code saved", { code: normalized });
        }
      }
    } catch {
      // storage 비활성 (private mode 등)
    }

    // 2. 저장된 code 있고 인증된 사용자면 server claim
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let cancelled = false;
    let toastTimer: number | null = null;
    (async () => {
      try {
        const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
        if (!stored || !REFERRAL_CODE_PATTERN.test(stored)) return;
        const { data } = await supabase.auth.getUser();
        if (!data?.user || cancelled) return;
        const res = await fetch("/api/me/referral/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: stored }),
        });
        if (cancelled) return;
        if (res.ok) {
          const result = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
          localStorage.removeItem(REFERRAL_STORAGE_KEY);
          if (result.ok) {
            console.log("[referral-capture] claim granted");
            // nav 크레딧 자동 refetch
            window.dispatchEvent(new CustomEvent("minyoi:credits-changed"));
            // 토스트 표시
            setToast("친구 추천으로 크레딧 5개 받았어요! 🎁");
            toastTimer = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
          } else {
            console.log("[referral-capture] claim skipped", { reason: result.error });
          }
        } else {
          // 401 = 인증 안 됨 (race) — storage 유지, 다음 페이지 진입에 다시 시도
          console.warn("[referral-capture] claim http error", { status: res.status });
        }
      } catch (err) {
        console.warn("[referral-capture] claim failed", err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      if (toastTimer != null) window.clearTimeout(toastTimer);
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
