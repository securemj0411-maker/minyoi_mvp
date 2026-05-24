// Wave launch-118 (2026-05-24): favicon dynamic generation — 구글 검색 결과 아이콘.
// Wave launch-119 (2026-05-24): 사용자 로고 디자인 적용 — 가격표 + 별(sparkle) + 구멍.
//   색깔: #0064FF (toss-blue 보다 진한 brand blue, 사용자 결정).
//   icon.tsx (Next.js App Router) 가 build 시 32×32 PNG 자동 생성.

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
          background: "#0064FF",
        }}
      >
        {/* 가격표 + 별 + 구멍 SVG. viewBox 100, 32×32 안에 padding 살림. */}
        <svg width="24" height="24" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          {/* 가격표 본체 (tilted tag, 좌측 둥글고 우측 sharp) */}
          <path
            d="M 18 55 L 55 18 Q 60 14, 65 14 L 80 14 Q 86 14, 86 20 L 86 35 Q 86 40, 82 45 L 45 82 Q 40 86, 34 80 L 20 66 Q 14 60, 18 55 Z"
            fill="white"
          />
          {/* 구멍 (우측 상단 원) */}
          <circle cx="68" cy="32" r="6" fill="#0064FF" />
          {/* 별 (4-pointed sparkle, 가격표 중앙) */}
          <path
            d="M 47 42 L 53 53 L 64 49 L 53 55 L 49 66 L 47 55 L 36 51 L 47 55 Z"
            fill="#0064FF"
            transform="rotate(-15, 50, 53)"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
