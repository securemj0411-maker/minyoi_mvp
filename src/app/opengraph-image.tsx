// Wave launch-120b (2026-05-24): piggy brand mark (정확) — OG image (1200×630).
//   카톡/Twitter/Facebook 공유 카드. 정확한 brand mark + text.

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
        <svg width="220" height="220" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="22" fill="#0064FF" />
          <circle cx="50" cy="52" r="38" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />
          <path d="M14 28 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 z" fill="#fff" />
          <path d="M86 28 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 z" fill="#fff" />
          <path d="M84 70 l1.5 3 l3 1.5 l-3 1.5 l-1.5 3 l-1.5 -3 l-3 -1.5 l3 -1.5 z" fill="#fff" />
          <path d="M28 40 L34 32 L38 48 Z" fill="#fff" />
          <path d="M72 40 L66 32 L62 48 Z" fill="#fff" />
          <circle cx="50" cy="58" r="24" fill="#fff" />
          <circle cx="42" cy="54" r="2.4" fill="#0064FF" />
          <circle cx="58" cy="54" r="2.4" fill="#0064FF" />
          <ellipse cx="50" cy="66" rx="11" ry="7" fill="#0064FF" opacity="0.16" />
          <path d="M44 64 L46 70 L48 66 L50 70 L52 66 L54 70 L56 64" stroke="#0064FF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <div style={{ marginTop: 40, fontSize: 96, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>
          득템잡이
        </div>
        <div style={{ marginTop: 24, fontSize: 32, fontWeight: 600, opacity: 0.95 }}>
          AI 중고 시세 비교 — 시세보다 저렴한 매물만
        </div>
      </div>
    ),
    { ...size },
  );
}
