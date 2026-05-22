import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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

// Wave launch-8 (audit CRITICAL #7): Sentry wrap.
// production 에러 자동 capture + (auth token 박힌 후) source map upload.
export default withSentryConfig(nextConfig, {
  // org / project — sentry.io 대시보드 기준.
  org: "c1ef8e3f9b0f",
  project: "javascript-nextjs",

  // build log silence — Vercel 빌드 깨끗하게.
  silent: !process.env.CI,

  // source map upload — SENTRY_AUTH_TOKEN env 있을 때만 동작.
  widenClientFileUpload: true,

  // Wave launch-13: disableLogger + reactComponentAnnotation 제거.
  // Sentry v10 에서 deprecated + Turbopack (Next 16) 무시. build log 노이즈만 ↑.
});
