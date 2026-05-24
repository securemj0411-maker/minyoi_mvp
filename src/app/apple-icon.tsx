// Wave launch-118 (2026-05-24): Apple Touch icon — iOS Safari add-to-homescreen + 카톡 공유.
//   180×180 PNG. icon.tsx 의 sticker 확대.

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
          background: "linear-gradient(135deg, #3182f6 0%, #1c64dd 100%)",
          color: "white",
          fontSize: 110,
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
