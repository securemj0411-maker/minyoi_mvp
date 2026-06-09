"use client";

import { useEffect } from "react";

// Wave 1231 (2026-06-09): 신규 가입 완료 시 GA4 `sign_up` 이벤트 1회 발사 (구글애즈 회원가입 전환 측정).
//   /auth/callback 이 "방금 생성된 계정"이면 redirect URL 에 ?signup=new 를 붙임 → 여기서 감지해 발사.
//   기존 회원 로그인은 ?signup=new 가 안 붙어서 발사 안 됨.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export default function GtagSignupTracker() {
  useEffect(() => {
    // Wave 1233: 쿠키 ga_signup=1 (콜백이 신규가입 때 심음, redirect 생존) 또는 ?signup=new 감지 → 1회 발사.
    const hasCookie = /(?:^|;\s*)ga_signup=1(?:;|$)/.test(document.cookie);
    let url: URL | null = null;
    let hasQuery = false;
    try {
      url = new URL(window.location.href);
      hasQuery = url.searchParams.get("signup") === "new";
    } catch {
      url = null;
    }
    if (!hasCookie && !hasQuery) return;

    // 중복 발사 방지 — 쿠키/쿼리 즉시 제거.
    if (hasCookie) document.cookie = "ga_signup=; max-age=0; path=/";
    if (hasQuery && url) {
      url.searchParams.delete("signup");
      window.history.replaceState({}, "", url.toString());
    }

    // gtag 로드 대기 후 발사 (head 스크립트라 보통 즉시 준비됨, 안 되면 retry).
    let tries = 0;
    const fire = () => {
      if (typeof window.gtag === "function") {
        window.gtag("event", "sign_up", { method: "signup" });
      } else if (tries++ < 20) {
        setTimeout(fire, 250);
      }
    };
    fire();
  }, []);

  return null;
}
