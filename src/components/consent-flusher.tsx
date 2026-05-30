"use client";

// Wave 800 (2026-05-27 사용자 정정): 카카오 OAuth 가입 시 telegram 알림 누락 fix.
//   기존: auth-form 가 즉시 session (이메일 가입 autoConfirm) 시만 flushPendingConsents 박음.
//   문제: 카카오 OAuth 는 redirect → callback → 새 페이지 → auth-form remount X → flushPendingConsents 안 박힘
//         → /api/auth/consents POST 안 박힘 → telegram 알림 누락.
//   해결: layout 에 박힌 client component 가 Supabase auth state 감지 → SIGNED_IN 시 자동 flush.
//         이메일 가입 / 카카오 가입 둘 다 cover. localStorage 의 pending consents 박혀있으면 flush.
//         consent table 에 row 박힘 → consents endpoint 의 isFirstSignup detect → telegram 알림.

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { flushPendingConsents } from "@/lib/pending-consents";

export default function ConsentFlusher() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let cancelled = false;

    // 마운트 직후 1번 시도 (이미 session 박힌 상태 — 페이지 전환 직후 카카오 callback redirect 후)
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && !cancelled) {
        await flushPendingConsents().catch((err) => {
          console.warn("[consent-flusher] initial flush failed (non-fatal)", err);
        });
      }
    })();

    // SIGNED_IN event 감지 — 신규 가입 / 로그인 둘 다 trigger.
    //   pending-consents 가 localStorage 에 박혀있어야만 flush 가 실제 insert (없으면 no-op).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (event === "SIGNED_IN" && session?.user) {
        await flushPendingConsents().catch((err) => {
          console.warn("[consent-flusher] auth-event flush failed (non-fatal)", err);
        });
      }
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  return null;
}
