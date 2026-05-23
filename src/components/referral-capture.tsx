"use client";

// Wave 743 (2026-05-24): 모든 페이지 mount 시 ?ref= URL param 잡아서 sessionStorage 에 저장.
//   middleware 가 production 에서 작동 안 하는 경우 대비 fallback (client-side 추적).
//   layout.tsx 에 박혀 모든 페이지에서 자동 실행.
//
// 흐름:
//   1. 사용자 /?ref=GSWXEA 진입 → useEffect 가 URL 검사 → sessionStorage 에 저장
//   2. 다른 페이지로 navigate (/login → /signup) — URL 에서 ?ref= 사라져도 sessionStorage 유지
//   3. signup 페이지 button 클릭 → auth-form.tsx 가 sessionStorage 우선 읽기
//   4. signInWithOAuth redirectTo URL 에 &ref= 박아 callback 에 전달

import { useEffect } from "react";

const REFERRAL_SESSION_KEY = "minyoi_referral";
const REFERRAL_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export default function ReferralCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get("ref");
      if (!ref) return;
      const normalized = ref.toUpperCase();
      if (!REFERRAL_CODE_PATTERN.test(normalized)) return;
      // 이미 저장된 게 있으면 덮어쓰지 않음 (첫 추천만 유효)
      if (sessionStorage.getItem(REFERRAL_SESSION_KEY)) return;
      sessionStorage.setItem(REFERRAL_SESSION_KEY, normalized);
      console.log("[referral-capture] saved", { code: normalized });
    } catch {
      // ignore — storage 비활성 (private mode 등)
    }
  }, []);

  return null;
}
