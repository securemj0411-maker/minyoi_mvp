// Wave launch-119 (2026-05-24): Apple Touch icon — iOS Safari add-to-homescreen + 카톡 공유.
//   180×180 PNG. icon.tsx 의 디자인 확대 (가격표 + 별 + 구멍).

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        <svg width="140" height="140" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M 18 55 L 55 18 Q 60 14, 65 14 L 80 14 Q 86 14, 86 20 L 86 35 Q 86 40, 82 45 L 45 82 Q 40 86, 34 80 L 20 66 Q 14 60, 18 55 Z"
            fill="white"
          />
          <circle cx="68" cy="32" r="6" fill="#0064FF" />
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
