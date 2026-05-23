"use client";

// Wave 743/744/746 (2026-05-24): 레퍼럴 추적 + 인증 후 자동 claim.
//   가입 방식 무관 (카카오 / 이메일 autoConfirm / 등) universal 처리.
//   토스트는 BalanceToast (layout.tsx) 가 처리 — balance UPDATE 감지 시 자동 표시.
//
// 두 단계:
//   1. URL ?ref= 잡아서 localStorage 에 저장
//   2. 인증된 사용자면 /api/me/referral/claim POST → 성공 시 storage clear → BalanceToast 가 토스트

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const REFERRAL_STORAGE_KEY = "minyoi_referral";
const REFERRAL_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export default function ReferralCapture() {
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

    // 2. 저장된 code 있고 인증된 사용자면 server claim (토스트는 BalanceToast 가 자동 처리)
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let cancelled = false;
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
            // BalanceToast 가 Realtime UPDATE 잡아 토스트 표시. 별도 처리 X.
          } else {
            console.log("[referral-capture] claim skipped", { reason: result.error });
          }
        } else {
          console.warn("[referral-capture] claim http error", { status: res.status });
        }
      } catch (err) {
        console.warn("[referral-capture] claim failed", err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
