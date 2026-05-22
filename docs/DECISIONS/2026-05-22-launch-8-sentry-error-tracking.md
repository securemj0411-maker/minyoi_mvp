# 2026-05-22 — Launch CRITICAL #7: Sentry 에러 추적 도입

## audit 발견
176개 `console.error/warn/log` — Vercel 로그에만 남음.
production 에러 = 사용자 카톡 컴플레인 와야 인지. **silent failure 다발 risk**.

## 도입 = Sentry (@sentry/nextjs v10)
무료 5K event/월 (MVP 단계 충분). 사용자가 sentry.io 가입 + Next.js project 생성.
DSN: `https://254a48f4b32fd833b01ea0a295678da6@o4511432616574976.ingest.us.sentry.io/4511432622342144`

## 박은 파일
- `instrumentation-client.ts` — 브라우저 JS 에러 + unhandled rejection + replay
  (error 발생 세션 10%만 캡처 — 비용 컨트롤)
- `instrumentation.ts` — server (Node) + edge runtime 에러. Next register hook + onRequestError
- `next.config.ts` — `withSentryConfig` wrap
- `.env.local` — DSN 박음 (gitignored)
- `.env.local.example` — placeholder 박음 (Vercel env 가이드)

## 설정 디테일
- `enabled: process.env.NODE_ENV === "production"` — dev/test 환경에선 send X
- `sendDefaultPii: false` — 사용자 이메일 / 결제 정보 자동 마스킹
- `tracesSampleRate: 1.0` — 런칭 직후 전수. 트래픽 늘면 0.1 로 다운샘플
- `replaysSessionSampleRate: 0` — 정상 세션 replay 안 함 (비용)
- `replaysOnErrorSampleRate: 0.1` — 에러 세션만 10% replay (디버그)
- `maskAllText: true, blockAllMedia: true` — replay PII 차단

## Vercel env 필요 (사용자 액션)
사용자가 Vercel dashboard → Settings → Environment Variables 에 박을 거:
- `NEXT_PUBLIC_SENTRY_DSN` = `https://254a...sentry.io/...`
- `SENTRY_DSN` = 같은 값
- `SENTRY_AUTH_TOKEN` (선택) — source map upload 자동화. 없어도 동작 OK.

## 검증
- `npm run build` 성공 ✓
- 일단 sentry test event 보내는 건 production 배포 후 확인 (NODE_ENV=production 이라야)

## 메모리 룰 합치
- 일반인 친화: 사용자에겐 안 보임 (운영자 알림용)
- decision log: 이 파일
- DELETE/DROP 룰: 안 해당 (additive only)

## 후속
- 트래픽 늘면 `tracesSampleRate` 0.1 로 다운샘플
- Sentry Alerts → Slack/이메일 통합 (Sentry 대시보드에서 설정)
- Source map upload — SENTRY_AUTH_TOKEN env 박힌 후 자동
