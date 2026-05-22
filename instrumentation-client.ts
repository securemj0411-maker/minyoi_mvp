// Wave launch-8 (audit CRITICAL #7): Sentry client-side 에러 추적.
// 사용자 브라우저에서 발생한 JS 에러 / unhandled promise rejection 자동 capture.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 무료 5K event/월 — sample rate 조정으로 비용 컨트롤.
  // 런칭 직후엔 전수 (1.0) → 트래픽 늘면 0.1 로 다운샘플.
  tracesSampleRate: 1.0,
  // 세션 replay 는 비용 큼 — error 발생 세션만 일부 캡처.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,

  // dev 환경엔 console.error 도 send 안 함.
  enabled: process.env.NODE_ENV === "production",

  // PII 마스킹 — 사용자 이메일 / 결제 정보 등 자동 차단.
  sendDefaultPii: false,

  // 통합 — Next.js App Router 기본.
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
