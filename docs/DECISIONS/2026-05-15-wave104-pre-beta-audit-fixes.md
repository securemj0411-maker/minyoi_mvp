# Wave 104 — 베타 직전 audit 기반 fix (1~3)

audit (4 parallel agents) 결과 punch list 중 high severity 항목 순차 fix. 각 항목별 commit 분리.

## 1. Telegram webhook secret prod 강제

- 시간: 2026-05-16 00:50 KST
- 발견: audit. `verifySecret` (src/app/api/telegram/webhook/route.ts:31) 이 env 미설정 시 `return true` (dev 백도어). prod에서 `HOTDEAL_TELEGRAM_WEBHOOK_SECRET` 깜빡 빠뜨리면 누구나 webhook payload 주입 → 임의 chat_id로 verify_code 매칭해 다른 사용자 텔레그램 hijack 가능.
- 변경: `NODE_ENV === "production" && !expected` 시 강제 401 + console.error 로그. dev 환경은 기존 통과 동작 유지.
- 검증: tsc clean, 139/139 test pass.
- 위험: prod env에 secret 빠진 채 배포되면 webhook 100% reject — telegram bot 작동 정지. 외부 작업 (vercel env 확인) 선행 필수.
- 다음: vercel env에 HOTDEAL_TELEGRAM_WEBHOOK_SECRET 박혀있는지 확인 (사용자 작업).
- commit: c0ecc85

## 2. mvp_hotdeal_* migration + RLS 명시

- 시간: 2026-05-16 01:05 KST
- 발견: audit. `mvp_hotdeal_queue` / `mvp_hotdeal_reservations` / `claim_next_hotdeal_for_alert` RPC가 supabase MCP로 prod에 직접 박혔지만 supabase/migrations/ 누락. 환경 복제 불가 + RLS 상태 코드로 추적 X.
- 변경: `supabase/migrations/20260515000200_hotdeal_tables.sql` 신규.
  - 두 테이블 `if not exists` (idempotent — prod 적용된 상태에서 안전 재실행)
  - `enable row level security` 명시 (anon/authenticated 차단, service_role만 우회)
  - check constraint + 인덱스 + unique partial idx 포함
  - claim_next_hotdeal_for_alert RPC `create or replace`
- 검증: 파일 추가만, 실 적용은 prod에 이미 됨.
- 위험: 없음 (idempotent).
- 다음: 다음에 신규 테이블 만들 때 supabase MCP + migration 파일 동시 작성 룰화.
- commit: 68896b7

## 3. 핫딜 시스템 inline 통합 — 별도 cron 제거

- 시간: 2026-05-16 01:25 KST
- 발견: 사용자 진단 + audit. hotdeal-worker가 별도 cron route인데 QStash schedule 미등록 → cron_runs_24h=0 → 자동 발송 0회. 사용자 통찰: "기존 파이프라인 끝에 자연스럽게 붙이면 됨".
- 변경:
  - `runPoolWarmerPipeline` (src/lib/tick-pipeline.ts:3731) 에 hotdeal stage 추가:
    1. enqueueHotdealsFromPool (차익 ≥ 30% + band ≥ 3 매물 큐)
    2. dispatchAvailableHotdeals (가중치 랜덤 1명 선출 + telegram 발송 + admin shadow)
  - 기존 5분 주기 pool-warmer cron에 piggyback. QStash 별도 등록 불필요.
  - `/api/cron/hotdeal-worker` route는 수동 테스트용 유지.
  - timingsMs에 hotdeal_scanned/enqueued/sent/admin_shadow 박아 collect_runs에서 추적.
- 별도 fix (admin shadow): `sendAdminShadow` (src/lib/hotdeal.ts:295) 가 본인 선출 시 skip하던 로직 제거 → admin은 선출 무관 항상 [ADMIN SHADOW] full-detail 사본 받음.
- 검증: tsc clean, 139/139 test pass.
- 위험: pool-warmer 한 번 실행이 +1~2초 길어짐 (큐가 비어있어도 dispatch loop 돌긴 함). 영향 미미.
- 다음: 다음 pool-warmer 실행 (5분 내) 시 텔레그램 핑 확인. 안 오면 Vercel logs `[hotdeal stage]` 검색.
- commit: 2bfa6e5, e8758fc

## 4. start-verify + billing/subscribe rate limit

- 시간: 2026-05-16 01:50 KST
- 발견: audit. 두 endpoint rate limit 0:
  - `/api/me/telegram/start-verify`: bot이 무한 호출하면 verify code spam + supabase upsert 폭증.
  - `/api/billing/subscribe`: 같은 paymentKey 재호출 시 H3 (subscribe RPC idempotency 없음)와 결합되면 크레딧 이중 grant.
- 변경: 두 route 모두 기존 `checkRateLimit` 패턴 (packs/open과 동일) 적용.
  - start-verify: 분당 5회 (bucket: `telegram.start-verify:user:<userRef>`)
  - subscribe: 분당 3회 (bucket: `billing.subscribe:user:<userRef>`)
  - 초과 시 429 + retry_after. admin은 isAdminUser 체크로 면제.
- 검증: tsc clean, 139/139 test pass.
- 위험: 정상 사용자가 한도 초과할 가능성 매우 낮음 (start-verify 5번/분 = UI에서 드물게 누름, subscribe 3번/분 = 결제는 1~2회면 끝).
- 다음: H3 (subscribe RPC payment_key UNIQUE 인덱스 + 중복 가드) 별도 처리 필요. rate limit는 1차 방어, idempotency가 진짜 fix.

## 보너스: audit false positive

- `/api/cron/landing-showcases` auth 누락 보고됐으나 실 코드 (route.ts:10-13) 에 이미 `checkCronAuth` 박혀있음. 스킵.
