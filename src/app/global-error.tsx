// Wave 106: root layout 자체 에러 핸들러 (error.tsx 가 처리 못 하는 root-level 에러).
// 자체 <html><body> 필요.

"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error.tsx] root error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f6f1e8", margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 64, fontWeight: 900, color: "#dc2626", lineHeight: 1 }}>!</div>
          <h1 style={{ marginTop: 16, fontSize: 24, fontWeight: 900, color: "#223127" }}>
            앱을 시작하지 못했어요
          </h1>
          <p style={{ marginTop: 12, fontSize: 14, color: "#5a6658", lineHeight: 1.6 }}>
            심각한 오류가 발생했어요. 페이지를 새로고침해주세요. 계속되면 잠시 후 다시 시도해주세요.
          </p>
          {/* Wave 725 (2026-05-23): error.digest 는 운영자 추적용 anonymous hash.
              이전엔 raw 노출 → 입문자에겐 무서운 텍스트.
              details toggle 로 숨김 — CS 문의 시 사용자가 펼쳐서 복사 가능. */}
          {error.digest ? (
            <details style={{ marginTop: 12, fontSize: 11, color: "#9ca3af", display: "inline-block", textAlign: "left" }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, textAlign: "center" }}>
                기술 정보 (운영자 문의 시 사용)
              </summary>
              <p style={{ marginTop: 4, fontFamily: "monospace", color: "#9ca3af" }}>
                {error.digest}
              </p>
            </details>
          ) : null}
          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={reset}
              style={{ height: 44, padding: "0 20px", borderRadius: 12, background: "#2563eb", color: "#ffffff", fontWeight: 900, fontSize: 14, border: "none", cursor: "pointer" }}
            >
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
