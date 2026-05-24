// Wave launch-118 (2026-05-24): favicon dynamic generation — 구글 검색 결과 아이콘.
// Wave launch-119 (2026-05-24): 사용자 정식 로고 path 적용 (가격표+별+구멍, evenodd).
//   public/logo.svg 와 동일 path — favicon 32×32 PNG 로 build 시 자동 생성.

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
        }}
      >
        <svg width="32" height="32" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="22" fill="#0064FF" />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M52 16 L82 16 Q86 16 86 20 L86 50 Q86 53 84 55 L50 89 Q47 92 44 89 L13 58 Q10 55 13 52 L47 18 Q49 16 52 16 Z M50 60 L55 50 L65 45 L55 40 L50 30 L45 40 L35 45 L45 50 Z M70 32 m-5 0 a5 5 0 1 1 10 0 a5 5 0 1 1 -10 0 Z"
            fill="#FFFFFF"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
