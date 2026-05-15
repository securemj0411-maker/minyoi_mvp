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
          {error.digest ? (
            <p style={{ marginTop: 8, fontSize: 11, fontFamily: "monospace", color: "#9ca3af" }}>
              오류 코드: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 24, height: 44, padding: "0 20px", borderRadius: 12, background: "#314238", color: "#f7f1e6", fontWeight: 900, fontSize: 14, border: "none", cursor: "pointer" }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
