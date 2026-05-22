// Wave launch-8 (audit CRITICAL #7): Sentry client-side 에러 추적.
// Wave launch-16 (사용자 짚음 — localhost:3000 무한 로딩):
// dev 환경에선 SDK 자체 load skip. replayIntegration 이 무거워서 dev 첫 load hang 가능.
// production 만 init.

import * as Sentry from "@sentry/nextjs";

if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // 무료 5K event/월 — sample rate 조정으로 비용 컨트롤.
    tracesSampleRate: 1.0,
    // 세션 replay 는 비용 큼 — error 발생 세션만 일부 캡처.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,

    // PII 마스킹 — 사용자 이메일 / 결제 정보 등 자동 차단.
    sendDefaultPii: false,

    // 통합 — App Router 기본.
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
