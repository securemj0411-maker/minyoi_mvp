import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.bunjang.co.kr",
      },
      {
        protocol: "https",
        hostname: "**.joongna.com",
      },
    ],
  },
};

// Wave launch-16 (사용자 짚음 — localhost 무한 로딩):
// withSentryConfig 가 dev 에서도 wrap 하면서 Turbopack + dev hot reload 와 충돌.
// production 빌드 시에만 dynamic wrap. dev 는 native Next config 사용 → 가벼움.
const isProductionBuild = process.env.NODE_ENV === "production";

const exportedConfig: NextConfig = isProductionBuild
  ? (() => {
      try {
        // require 로 conditional — dev 에선 모듈 load 자체 안 함
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { withSentryConfig } = require("@sentry/nextjs");
        return withSentryConfig(nextConfig, {
          org: "c1ef8e3f9b0f",
          project: "javascript-nextjs",
          silent: !process.env.CI,
          widenClientFileUpload: true,
        });
      } catch {
        // sentry 패키지 깨졌어도 production 빌드 안 막음
        return nextConfig;
      }
    })()
  : nextConfig;

export default exportedConfig;
