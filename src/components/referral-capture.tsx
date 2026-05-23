"use client";

// Wave 743/744 (2026-05-24): 레퍼럴 추적 + 인증 후 자동 claim.
//   가입 방식 무관 (카카오 / 이메일 autoConfirm / 등) universal 처리.
//
// 두 단계:
//   1. URL ?ref= 잡아서 localStorage 에 저장 (모든 페이지 mount 시)
//   2. 사용자 인증 상태 확인 → ref 있고 로그인됐으면 /api/me/referral/claim POST → 성공 시 storage clear
//
// localStorage 사용 이유: sessionStorage 는 탭 단위라 새 탭 열면 손실. localStorage 는 영구.
// 단 callback 으로 이미 처리된 경우 — claim endpoint 가 already_referred 반환 → silent skip.

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

    // 2. 저장된 code 있고 인증된 사용자면 server claim
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let cancelled = false;
    (async () => {
      try {
        const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
        if (!stored || !REFERRAL_CODE_PATTERN.test(stored)) return;
        const { data } = await supabase.auth.getUser();
        if (!data?.user || cancelled) return;
        // 인증된 사용자 — claim endpoint 호출
        const res = await fetch("/api/me/referral/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: stored }),
        });
        if (cancelled) return;
        if (res.ok) {
          const result = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
          // 성공 또는 already_referred / self_referral / referrer_not_found → storage clear (재시도 막음)
          localStorage.removeItem(REFERRAL_STORAGE_KEY);
          if (result.ok) {
            console.log("[referral-capture] claim granted");
            // app-nav 가 listen — 자동 refetch + nav UI 갱신
            window.dispatchEvent(new CustomEvent("minyoi:credits-changed"));
          } else {
            console.log("[referral-capture] claim skipped", { reason: result.error });
          }
        } else {
          // 401 = 인증 안 됨 (race condition) — storage 유지, 다음 페이지 진입에 다시 시도
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
