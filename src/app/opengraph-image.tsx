// Wave launch-119 (2026-05-24): OG image dynamic — 카톡/Twitter/Facebook 공유 카드.
//   기존 /new_balance.jpeg (Wave 740) → brand logo + tagline.
//   1200×630 PNG, Next.js ImageResponse build 시 자동 생성.

import { ImageResponse } from "next/og";

export const alt = "득템잡이 — AI 중고 시세 비교";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0064FF",
          color: "white",
          padding: 80,
        }}
      >
        {/* Logo */}
        <svg width="200" height="200" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="22" fill="white" />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M52 16 L82 16 Q86 16 86 20 L86 50 Q86 53 84 55 L50 89 Q47 92 44 89 L13 58 Q10 55 13 52 L47 18 Q49 16 52 16 Z M50 60 L55 50 L65 45 L55 40 L50 30 L45 40 L35 45 L45 50 Z M70 32 m-5 0 a5 5 0 1 1 10 0 a5 5 0 1 1 -10 0 Z"
            fill="#0064FF"
          />
        </svg>
        {/* 브랜드명 */}
        <div
          style={{
            marginTop: 40,
            fontSize: 96,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          득템잡이
        </div>
        {/* Tagline */}
        <div
          style={{
            marginTop: 24,
            fontSize: 32,
            fontWeight: 600,
            opacity: 0.95,
          }}
        >
          AI 중고 시세 비교 — 시세보다 저렴한 매물만
        </div>
      </div>
    ),
    { ...size },
  );
}
