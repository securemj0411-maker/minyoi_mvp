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

## 5. Billing H1 — Pro 결제해도 기능 못 받음 (치명상)

- 시간: 2026-05-16 02:10 KST
- 발견: audit. `subscribe_mvp_plan` RPC가 `mvp_user_plans` 만 update, `mvp_user_credits.pro_until`은 안 건드림. 그러나 `getProStatus` (src/lib/user-subscription.ts) 가 `pro_until` 만 읽음 → 결제해도 isPro=false → 핫딜 알림 메뉴 안 보임 + 신선도 슬라이더 1~2시간 잠김. 환불 분쟁 직격타.
- 변경: `getProStatus` 재작성. source of truth = `mvp_user_plans.plan_key`. 우선순위:
  1. admin → auto-Pro (테스트/운영 편의, source="admin")
  2. mvp_user_plans.plan_key === 'pro' AND (current_period_end null or future) AND status !== 'expired' (source="subscription")
  3. legacy fallback: mvp_user_credits.pro_until > now (admin 수동 박기 back-compat, source="legacy_pro_until")
  4. 그 외 → isPro=false
- cancelAtPeriodEnd 정책: status='cancelled'여도 current_period_end 안이면 Pro 유지 (mid-cycle 취소 시 정상). expired는 false.
- 검증: tsc clean, 139/139 test pass.
- 위험:
  - `/api/me/subscription` 호출이 supabase REST 1회 → 2회로 증가 (legacy fallback 분기). 정상 케이스(plan='pro')는 1회로 끝.
  - claim_next_hotdeal_for_alert RPC는 여전히 `uc.pro_until is null or > now` 조건 (lax). 실제 Pro 게이팅은 UI 메뉴 차단으로 1차 방어. 정식 fix는 RPC를 mvp_user_plans 기반으로 재작성 (별도 wave).
- 다음:
  - start-verify route에 Pro check 추가 (defense in depth, free 사용자 직접 POST 차단).
  - claim_next_hotdeal_for_alert RPC를 mvp_user_plans 조인 기반으로 재작성.
  - H2 (만료 자동 다운그레이드 cron) 별도 fix.
  - H3 (subscribe RPC payment_key UNIQUE + 중복 가드) 별도 fix.

## 6. Billing H3 — subscribe RPC 멱등성 (이중 청구 차단)

- 시간: 2026-05-16 02:30 KST
- 발견: audit. `subscribe_mvp_plan` RPC가 멱등성 없음. 같은 paymentKey 두 번 호출 (네트워크 race / 사용자 새로고침) 시 RPC 두 번 실행 → 크레딧 두 번 grant + payment_events 중복 row. #4 rate limit는 spam 차단용 (분당 3회), 정상 race condition은 통과.
- 변경 (`supabase/migrations/20260515000300_subscribe_mvp_plan_idempotent.sql`):
  1. `mvp_payment_events.payment_key` UNIQUE 인덱스 (partial — null 허용). DB level race condition 안전망 (concurrent insert 자동 차단).
  2. RPC 시작에 early return 가드:
     - payment_key가 이미 mvp_payment_events에 있으면:
       - 동일 user_ref면 기존 결과 반환 (idempotent — 사용자가 같은 응답 받음, 중복 처리 X)
       - 다른 user_ref면 raise exception (key 도용 방지)
- 적용: supabase MCP apply_migration 즉시 prod 적용 + migration 파일 commit.
- 검증: tsc clean (RPC는 SQL이라 tsc 무관). 실 결제 두 번 호출 테스트는 별도 (mock 단계라 위험 X).
- 위험: 기존 mvp_payment_events에 payment_key 중복 row가 있으면 UNIQUE 인덱스 생성 실패. prod 데이터 확인했고 mock paymentKey는 timestamp 기반이라 자연 unique → 문제 없음.
- 다음: H2 (만료 자동 다운그레이드 cron) 별도 fix.

## 7. Billing H2 — 만료 자동 다운그레이드 (housekeeper inline)

- 시간: 2026-05-16 02:45 KST
- 발견: audit. `current_period_end` 지난 paid plan 사용자가 영원히 'active' 상태로 남음. cancel_at_period_end=true 사용자도 만료 시 free 다운 안 됨. 풀 사이즈 산정 + 일일 한도 enforcement 모두 broken.
- 변경:
  - `expire_mvp_plans()` RPC 신규 (migration 20260515000400):
    - plan_key in (starter/plus/pro) AND current_period_end < now() → free, status='expired', daily_used=0 reset.
    - returns expired_count.
    - REVOKE EXECUTE FROM public/anon (service_role only).
  - `housekeeperStage` (src/lib/tick-pipeline.ts:3367) inline 호출 추가. 1시간 주기 housekeeper cron이 자연 trigger. 별도 schedule 불필요.
  - 만료된 카운트는 `stats.timingsMs.plans_expired`에 기록 + console.log.
- 검증: tsc clean, 139/139 test pass.
- 위험:
  - status='expired' 인 row를 다시 paid로 결제 시 H3 idempotent fix가 ON CONFLICT (user_ref) DO UPDATE로 처리 → 정상 재구독 가능.
  - getProStatus는 `status !== 'expired'` 체크로 expired 사용자 정확히 free 반환.
- 다음: 핵심 user flow 항목으로 이동 (로그인 콜백 에러, onboarding, pack reveal 메모 cap mismatch, 핫딜 reveal band fallback).

## 8. 핵심 user flow + UI batch fix (4건)

- 시간: 2026-05-16 03:05 KST
- 발견: audit (path 1/3/5 + Mobile/UI).

### 8a. 로그인 콜백 에러 silent
- `/auth/callback` route가 실패 시 `?auth=missing-code|missing-env|exchange-failed`로 redirect하지만 auth-form이 param 무시 → 사용자가 "왜 다시 login 화면?" 모름.
- 변경: `auth-form.tsx`에 `authErrorMessage()` 한국어 매핑 + `useState(() => ...)` 초기값으로 메시지 표시. 기존 `{message}` 렌더링 그대로 활용.

### 8b. pack reveal 검증 메모 cap mismatch
- client `maxLength={5000}` / server `note?.slice(0, 500)` → 사용자가 길게 쓰고 저장 누르면 silent truncate (4500자 사라짐).
- 변경: `pack-open.ts:598` server cap 500 → 5000으로 일치. 메모는 빈도 낮아 DB bloat 위험 미미.

### 8c. 핫딜 reveal band fallback 잘못
- `/api/me/hotdeal/open`이 `pack_open_id=null + source='hotdeal'`로 reveal insert. `/api/packs/me`가 `bandByOpenId.get(null)` undefined → fallback band 2 표시 (실제 band 3 매물인데).
- 변경: `packs/me/route.ts`에서:
  - reveals query에 `source` 추가
  - source='hotdeal' pid 모아서 `mvp_hotdeal_queue.band` batch fetch
  - rendering 시 `source === 'hotdeal'` 분기로 hotdeal band 사용 (fallback 3)

### 8d. market-source-debug + 고수익 경고 모달 Esc 미지원
- 두 모달 다 backdrop click만 있고 keydown listener 없음. 다른 모달 (pack-reveal, mobile drawer)과 일관성 깨짐.
- 변경:
  - `market-source-debug.tsx`: useEffect로 Esc keydown + body scroll lock 추가
  - `recommendation-workspace.tsx` warningOpen: 동일 패턴 추가
- 검증: tsc clean, 139/139 test pass.
- 다음: 신규 가입 onboarding (별도 wave — UI 디자인 필요), 공략집 sticky 충돌 (메뉴 가변 높이 fix — 측정 필요).

### 보너스: audit false positive (총 2건)
- `/api/cron/landing-showcases` auth 누락 보고됐으나 실 코드 (route.ts:10-13) 에 `checkCronAuth` 박혀있음. 스킵.
- `pack-reveal-modal.tsx`에 닫기 버튼 없음 보고됐으나 실 코드 (line 944-952) "닫기" 버튼 + Esc keydown (line 872) 둘 다 있음. 스킵.
- `pack-shop.tsx` 랜딩 main 패딩 X 보고됐으나 inner div (line 262) `px-4 sm:px-6 lg:px-8` 박혀있음. 시각적 동일. 스킵.
