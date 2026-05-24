// Wave launch-118 (2026-05-24): favicon dynamic generation — 구글 검색 결과 아이콘.
//   기존 favicon.ico (Next.js default) 가 구글 검색 결과에서 표시 우선순위 낮음.
//   icon.tsx (Next.js App Router) 가 build 시 32×32 PNG 자동 생성 → favicon 으로 사용.
//   사용자 정식 로고 만들면 그때 교체.

import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #3182f6 0%, #1c64dd 100%)",
          color: "white",
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: "-0.06em",
          fontFamily: "-apple-system, system-ui, sans-serif",
        }}
      >
        득
      </div>
    ),
    { ...size },
  );
}
