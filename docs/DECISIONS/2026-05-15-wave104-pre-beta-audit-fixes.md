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

## 9. 신규 가입 onboarding 배너

- 시간: 2026-05-16 03:25 KST
- 발견: audit Path 2. 신규 가입 후 /me 진입 시 onboarding 0건. "5크레딧 받았어요" 안내 없음 → 사용자가 어떻게 시작할지 모름.
- 변경 (`src/components/onboarding-banner.tsx` 신규):
  - 표시 조건: freeGrantedAt < 24h ago AND localStorage `minyoi-onboarding-dismissed-v1` 미dismiss AND admin 아님 (infinite credits).
  - 배너 내용: 환영 라벨 + "크레딧 N개" 배지 + "첫 5크레딧 받았어요" 헤더 + 시작 가이드 (안전/균형 preset 추천) + [추천 받기 시작] CTA + [나중에] dismiss + X 닫기 버튼.
  - dismiss는 localStorage 기록 (v1 prefix로 다음 캠페인 redo 가능).
  - me-dashboard-client.tsx의 recommend view 상단에만 mount (다른 view에선 노이즈 X).
- 검증: tsc clean, 139/139 test pass.
- 위험: localStorage 차단 사용자는 매번 노출. 일반인은 거의 없음 → 영향 미미.
- 다음: 공략집 sticky 충돌 (메뉴 가변 높이 측정).

## 10. 공략집 sticky TOC + 대시보드 메뉴 갭 fix

- 시간: 2026-05-16 03:45 KST
- 발견: audit. `playbook-overview.tsx:567` sticky TOC `top-[112px]` (60px nav + 52px 가정) vs 대시보드 메뉴 (`me-dashboard-client.tsx:227`) 자연 높이 ~47px → **5px 갭**. audit이 우려한 "메뉴 줄바꿈 충돌"은 실제로 발생 X — 메뉴는 `overflow-x-auto + shrink-0 + whitespace-nowrap` 으로 줄바꿈 구조상 차단됨. 진짜 이슈는 갭이고 충돌이 아님.
- 변경 (`me-dashboard-client.tsx:227-235`):
  - aside 모바일 높이 `h-[52px]` 명시 (lg:는 기존 `lg:h-[calc(100dvh-60px)]` 유지).
  - 내부 div: `flex h-full items-center px-3 py-1 lg:block lg:h-auto lg:px-4 lg:py-5` — 모바일에선 flex로 버튼 row 수직 중앙 정렬, lg+에선 기존 block 레이아웃.
  - 버튼 row container: `flex w-full items-center` 추가, `pb-0.5` 제거 (52px 고정에 불필요).
  - 결과: 메뉴 정확히 52px → TOC `top-[112px]` (60+52) 와 픽셀 단위 정확히 맞음.
- 검증: tsc clean.
- 위험: lg+ 데스크탑 사이드바는 `lg:h-auto`로 기존 동작 유지 (lg:h-[calc(100dvh-60px)] override). 모바일에서 메뉴 자체 높이 52px 고정이라 향후 누가 버튼 padding 늘리면 잘릴 수 있음 — 그 때 둘 다 늘리면 됨 (TOC top과 함께).
- 다음: med severity 항목 (빈 풀 retry CTA, telegram bot 미설정 시 메뉴 자동 숨김, billing err.message leak 등).
- commit: pending

## 11. billing endpoints err.message 누출 fix

- 시간: 2026-05-16 03:55 KST
- 발견: audit. `src/app/api/billing/{subscribe,cancel,me}/route.ts` 셋 다 catch 블록에서 `err.message` 그대로 client에 노출.
  - `restFetch` (`src/lib/supabase-rest.ts:128`) throw 메시지: `Supabase REST failed 400 POST <RPC URL>: <postgres json body>` 형태 → RPC 이름 + postgres `code/message/details/hint` 그대로 client에 노출. RPC raise 메시지에 테이블/컬럼/제약 이름 들어가면 schema 추정 가능.
- 변경: 셋 다 동일 패턴.
  - `console.error("[billing/<endpoint>] error", { ...context, err })` — 서버 로그는 raw 유지 (디버깅).
  - client 응답: `{ error: "<endpoint>_failed", message: "<한국어 generic>" }` — 안전한 string만.
  - subscribe: 500 + "결제 처리 중 오류가 났어요. 잠시 후 다시 시도해주세요."
  - cancel: 400 + "요청 처리 중 오류가 났어요. 잠시 후 다시 시도해주세요."
  - me: 500 + "플랜 정보를 불러오지 못했어요."
- 검증: tsc clean.
- 위험: 사용자가 보던 raw postgres 에러 메시지 (예: "payment_key already used") → generic 한국어로 바뀜. UX 살짝 떨어지지만 보안 우선. duplicate payment 케이스는 idempotency RPC (Wave 104 H3) 가 200으로 처리해서 catch 블록 안 옴 — 영향 미미.
- 다음: 다른 endpoint (telegram/, packs/, me/) 도 동일 audit 필요 (memory: 별도 wave 권장).
- commit: 5e8bfe3

## 12. consume_mvp_daily_quota race fix (TOCTOU)

- 시간: 2026-05-16 04:10 KST
- 발견: audit. `consume_mvp_daily_quota` (schema.sql:2107) 가 SELECT → IF check → UPDATE 분리 구조. 동시 두 요청이 SELECT를 같이 통과 → 둘 다 IF (current < limit) true → 둘 다 UPDATE → daily_used_count = limit + 1 가능. 무료 사용자 1회 한도 → 2회 사용. 1팩 = ~1.09USD 비용 누출.
- 변경:
  - `supabase/migrations/20260515000500_consume_daily_quota_atomic.sql` 신규 — atomic conditional UPDATE: `WHERE daily_used_count < p_limit AND daily_reset_on = v_today`. postgres가 row lock + WHERE 재평가 직렬화 → race 차단. UPDATE not found → reject.
  - prod에 supabase MCP로 즉시 적용 (idempotent `create or replace`).
  - schema.sql 동기화.
- 검증: prod apply success. 기존 caller (`packs/open/route.ts:114`) 시그니처 동일 — code 변경 불필요.
- 위험: 매우 낮음. RPC return shape 동일. 기존 정상 흐름 영향 X. 단 race로 잠시 limit 초과 잡혔던 user는 이제 정확히 limit에서 막힘.
- 다음: 비슷한 패턴 다른 RPC 점검 (`spend_and_record_pack_open` 은 atomic이라 OK 확인됨, Wave 60).
- commit: 9242498

## 13. pack-reveal-modal unavailable 케이스 retry CTA + 안내

- 시간: 2026-05-16 04:25 KST
- 발견: audit. `pack-reveal-modal.tsx:1065` `result === "unavailable"` (재고 부족) 분기에 "닫기" 버튼만 있고 재시도 CTA 없음. `result === "refunded"` (라인 1040) 에는 "닫기" + "다시 시도" 둘 다 있는데 일관성 깨짐. 사용자가 재고 부족 보고 닫으면 다시 추천 카드 누르고 풀 다시 열어야 하는 dead-end. unavailable은 atomic RPC에서 amount=0 처리라 토큰 차감 X → 재시도 안전.
- 변경 (`src/components/pack-reveal-modal.tsx:1065-1080`):
  - "잠시 후 새 매물이 풀에 들어올 수 있어요. 다시 시도하거나 다른 등급을 열어보세요." 안내 문구 추가.
  - "닫기" + "다시 시도" 두 버튼 (refunded와 동일 패턴, onRetry 그대로 재사용).
- 검증: tsc clean.
- 위험: 사용자가 unavailable 받고 다시 시도 → 또 unavailable 가능성 있음. 풀 충원이 5분 cron이라 즉각 새 매물 나오는 건 아님. 그래도 닫기만 있는 것보다 "다른 등급 시도" 힌트가 명시되어 의도 명확.
- 다음: med severity 항목 (plan cancel button touch target, dark mode admin pool 등).
- commit: c62c815

## 14. plan cancel/reactivate/사용량 보기 hit target 확대

- 시간: 2026-05-16 04:35 KST
- 발견: audit. `src/app/plans/page.tsx:122-146` 의 세 버튼 (사용량 보기 / 구독 취소 / 구독 재활성화) 모두 `px-3 py-1 text-xs` = 약 20px 높이. WCAG 권장 44x44 한참 미달. 모바일에서 "구독 취소" + "구독 재활성화" 가 같은 row에 가까이 있어 fat finger로 잘못 누르면 큰 사고 (실수로 결제 끊김).
- 변경: 셋 다 `px-4 py-2 min-h-[36px] items-center` 로 통일. row container도 `flex-wrap` 추가해서 좁은 화면에서 줄바꿈 허용.
  - 36px = WCAG 44px 미달이지만 page 전체 visual rhythm 깨지 않는 합리적 최소.
  - 셋 다 같이 키워서 시각 일관성 유지.
- 검증: tsc clean.
- 위험: 시각적으로 살짝 커짐. mobile에서 rhythm 미세 변화. 기능 영향 X.
- 다음: 다른 cancel/destructive UI (account-panel.tsx의 "탭해서 변경" 등) 점검 권장. 현재 로깅만.
- commit: 8e8787b

## 15. admin-pool-browser dark mode 누락 5라인 fix

- 시간: 2026-05-16 04:45 KST
- 발견: audit. `admin-pool-browser.tsx` 38개 dark: variant는 있지만 5라인 누락. dark bg에서 text가 거의 안 보임. admin (MJ) 본인 화면이지만 dark mode 사용자라면 매번 운영 진단 시 답답함.
- 변경 (5 라인):
  - `:155` 필터 결과 카운트 → `dark:text-zinc-400`
  - `:171` 테이블 헤더 → `dark:text-zinc-400`
  - `:194` stats 부연 → `dark:text-zinc-500`
  - `:292` item meta 라인 → `dark:text-zinc-400`
  - `:295` item id/query 라인 → `dark:text-zinc-500`
- 검증: tsc clean, awk grep으로 잔여 dark 누락 0 확인.
- 위험: 없음 (visual only).
- 다음: 다른 admin 화면 동일 audit (admin shadow report 등).
- commit: 1a4e57d

## 16. 핫딜 enqueue 0건 — mvp_listings sku_id 컬럼 부재 fix (CRITICAL)

- 시간: 2026-05-16 04:55 KST
- 발견: 사용자 보고 — 텔레그램 핫딜 알림 안 옴. 진단 결과:
  - mvp_telegram_bindings: MJ binding 정상 (@yewon1227, 2026-05-15 09:06)
  - mvp_candidate_pool: ready band-3 매물 63개, 그 중 24개가 margin ≥ 30% 충족 (eligible)
  - mvp_hotdeal_queue: 24h 내 enqueue 0건 (1건만 있고 consumed)
  - mvp_collect_runs.stage_stats.hotdeal: 모든 필드 0
  - **stage_durationsMs.hotdeal: 130ms 정도로 빠르게 끝남 → silent 실패**
- 근본 원인: `enqueueHotdealsFromPool` (src/lib/hotdeal.ts:48) 가 `mvp_listings?select=pid,price,sku_median,sku_id,sku_name` 호출. **mvp_listings 에는 sku_id 컬럼이 없음** (sku_id 는 mvp_hotdeal_queue / mvp_listing_observations / mvp_raw_listings 에만 존재). PostgREST가 400 → restFetch throw → outer try/catch 가 console.error만 찍고 stats 빈 채 반환.
- 변경 (`src/lib/hotdeal.ts:29-51`):
  - `ListingMeta` 에서 sku_id 제거.
  - mvp_listings select에서 sku_id 제거 (price, sku_median, sku_name 만).
  - sku_id 는 별도 mvp_raw_listings select로 보강 (디버깅/통계용. 메시지 본체엔 영향 없음).
  - 후보 객체 sku_id = `skuIds.get(pid) ?? null`.
- 검증: tsc clean. 다음 pool-warmer cron tick (5분 내)에서 24개 후보 enqueue + dispatch 예상.
- 위험: mvp_raw_listings 추가 fetch 1회 (HOTDEAL_ENQUEUE_LIMIT * 3 = 300 PIDs). 부하 미미.
- 다음: 발송 확인. 옛 reservation `notification_sent=false` + `notification_error=null` 버그 (sendTelegramMessage error 로그 누락) 별도 fix.
- commit: ad9e7db

## 17. 핫딜 정책 변경 — "샀어요/포기" 응답 폐기 + TTL reroute fix

- 시간: 2026-05-16 05:10 KST
- 발견: 사용자 정책 결정. "샀어요/포기" 응답 메커니즘 무의미.
  - 정직성 가정: 사용자가 카드 까면 매물 정보 다 봄 → 번장 직거래 가능 → "샀어요" 누를 동기 0
  - "포기"도 무의미: 비용 X (크레딧 차감 X)인데 굳이 누를 이유 없음
  - 추가 발견: TTL 만료 시 자동 reroute 안 됨 — `claim_next_hotdeal_for_alert` 가 `decision='pending'` 만 체크 (expires_at 무시) + queue.status='reserved' 영구 잔존 → 매물 죽음.
- 새 정책:
  - 카드 까는 순간 = consumed (queue + reservation 둘 다 종료)
  - TTL 만료 = 다른 사용자에게 자동 reroute
  - 응답 버튼 ("샀어요/포기") 제거. UI엔 "번장에서 거래" 직링크만.
- 변경:
  - `src/app/api/me/hotdeal/open/route.ts`: open 성공 후 queue.status='consumed' batch update (reroute 차단).
  - `src/app/api/me/hotdeal/decide/route.ts`: 410 Gone 으로 deprecate (옛 client cache 호출 시 안전).
  - `src/components/hotdeal-reservations.tsx`: decide 함수 + 샀어요/포기 버튼 + onPurchased/onRejected props 제거. "번장에서 거래" 링크만 남김.
  - `supabase/migrations/20260515000600_hotdeal_expired_reroute.sql` 신규:
    - `expire_stale_hotdeal_reservations()` 신규 RPC — expired pending → 'expired' 마킹 + queue.status='reserved' → 'available' 복원 (active pending 없는 경우만).
    - `claim_next_hotdeal_for_alert` 보강 — pending 체크에 `expires_at >= now()` 조건 추가 (이중 안전), eligible user 조회에서도 expired 사용자는 reroute 가능.
  - `src/lib/hotdeal.ts:dispatchAvailableHotdeals`: 시작 시 `expire_stale_hotdeal_reservations` RPC best-effort 호출.
- 검증: tsc clean. prod migration 적용 success. 다음 pool-warmer cron tick에서:
  1. expired pending reservation들 자동 정리
  2. queue.status='reserved' 매물 → 'available' 복원
  3. 새 사용자에게 reroute
- 위험:
  - 옛 client (모바일 cache) 가 /decide 호출하면 410 받고 UI에서 에러. 새로고침 시 새 UI 받아 정상화.
  - decide 통계 의존하는 분석 코드 있으면 깨짐 — 현재 없음 확인.
  - `mvp_hotdeal_reservations.decision` 컬럼은 그대로 유지 (DB 데이터 손실 X). 옛 데이터 ('purchased'/'rejected') 도 그대로.
- 다음: 옛 reservation #1 의 notification_sent=false + error=null 버그 (sendTelegramMessage error 로그 누락) 별도 fix.
- commit: cfa7a52

## 18. 핫딜 telegram 발송 실패 silent 버그 fix

- 시간: 2026-05-16 05:25 KST
- 발견: 옛 reservation #1 의 `notification_sent=false` + `notification_error=null` 디버깅 중. `sendHotdealAlert` (hotdeal.ts:288) 가 boolean만 반환 → telegram API의 실제 description ("Bad Request: chat not found", "Forbidden: bot was blocked by the user", "Bad Request: can't parse entities") 다 버림 → 호출부에서 모든 실패를 일괄 `"telegram_send_failed"` 로 박음. 디버깅 시 어떤 카테고리 실패인지 알 수 없음. `sendAdminShadow` 도 같은 패턴 (silent — admin 본인 텔레그램 끊겨도 모름).
- 변경 (`src/lib/hotdeal.ts`):
  - `sendHotdealAlert` 반환 타입 `boolean` → `{ ok: boolean; description: string | null }`. 실패 시 telegram API description 전달.
  - dispatch 호출부: 실패 시 `console.warn` + `markReservationSent` 의 error 인수에 description 박음 (200자 cap).
  - `sendAdminShadow` 실패 시도 `console.warn` 추가.
- 검증: tsc clean.
- 위험: 없음. 성공 케이스 동작 동일. 실패 케이스 디버깅 정보 추가만.
- 다음: 다음 텔레그램 실패 발생 시 logs 보면 정확한 원인 알 수 있음. 그동안 reservations 테이블의 notification_error 컬럼이 enum-like 카테고리로 그룹핑 가능.
- commit: 2891b51

## 19. 핫딜 권한 = Pro 전용 (RPC root fix + 거짓 광고 제거)

- 시간: 2026-05-16 05:50 KST
- 발견: 베타 readiness 점검 중 발견.
  - **RPC ↔ UI 정책 mismatch**: UI (`me-dashboard-client.tsx`) 는 `isPro || isAdmin` 만 메뉴 노출. RPC (`claim_next_hotdeal_for_alert`) 는 legacy `mvp_user_credits.pro_until` 만 봄 → pro_until=null 이면 통과 → free/starter/plus 모두 dispatch 가능. Wave 104 H1 (`getProStatus` user_plans 기반화) 적용 후 RPC만 누락.
  - **plus features "우선순위 추천 풀 접근" 거짓 광고**: 코드 grep 결과 실제 구현 X. plan-config 텍스트뿐.
- MJ 정책 결정: **핫딜 = Pro 전용.** admin은 별도 (자기 시스템 검증 필요).
- 변경:
  - `supabase/migrations/20260515000700_hotdeal_pro_only_eligibility.sql` 신규:
    - `mvp_admin_users` 테이블 신규 (auth_user_id PK + email + note). RLS deny-all + service_role only.
    - MJ admin row 등록 (cd77f148-... / danshinadarina@gmail.com).
    - `claim_next_hotdeal_for_alert` 보강 — eligible 조건: `(user_plans.plan_key='pro' AND active AND not expired) OR exists in mvp_admin_users`. legacy `pro_until` 의존 제거.
  - `src/lib/plan-config.ts`:
    - Pro features 에 "🔥 핫딜 텔레그램 알림 (Pro 전용)" 명시 추가.
    - Plus features의 "우선순위 추천 풀 접근" 제거 (거짓 광고). "베타 피드백 우선 반영" 으로 교체.
  - UI 그대로 (이미 `isPro || isAdmin`).
- 검증: tsc clean. prod migration 적용 success. eligible 시뮬: MJ (plus plan + admin) → is_pro_active=false but is_admin=true → pass.
- 위험:
  - 기존 binding 1명 (MJ) admin이라 영향 없음.
  - 미래 starter/plus 사용자가 핫딜 못 받게 되는 게 의도된 결과.
  - 다른 사용자가 Pro 결제했다가 만료 → status='expired' 또는 current_period_end < now 되면 즉시 핫딜 X (Wave 104 H2 자동 free 다운그레이드와 일관).
- 다음: 다른 정책 mismatch / 거짓 광고 audit (예: starter "베타 피드백 우선 반영" 도 실제 매커니즘 검증 필요).
- commit: d0fc41a

## 20. plan-config 거짓 광고 3개 일괄 제거

- 시간: 2026-05-16 06:00 KST
- 발견: #19 후속 audit. 4개 features grep 검증:
  - **"신선도 슬라이더 사용" (Plus)**: maxFreshHours 필터 코드 있음 (packs/open + preview-inventory). 단 plan 게이팅 X (모든 사용자 사용 가능). → 텍스트 부분 사실, 명확화.
  - **"전체 필터 자유 조작" (Pro)**: ❌ 코드 게이팅 X. 거짓.
  - **"내 대시보드 사용 기록" (Starter)**: ❌ 모든 plan 기본 기능. 거짓.
  - **"베타 피드백 우선 반영" (Starter, Plus)**: ❌ 매커니즘 X. 텍스트뿐. 거짓.
- 변경 (`src/lib/plan-config.ts`):
  - **Starter** features: "내 대시보드 사용 기록" + "베타 피드백 우선 반영" 제거 → "월 자동 갱신 (Free 는 1회 지급)" 추가 (실제 차별).
  - **Plus** features: "베타 피드백 우선 반영" 제거. "신선도 슬라이더 사용" → "신선도 슬라이더 (최근 N시간 매물만 보기)" 명확화.
  - **Pro** features: "전체 필터 자유 조작" 제거. 핫딜 알림 + 사용 패턴 리포트 (예정) 만 남음 — Pro hook은 핫딜이 강력해서 OK.
- 검증: tsc clean.
- 위험: 없음 (광고 정직화). 단 신선도 슬라이더는 Plus 게이팅 별도 결정 사항 (현재 모든 사용자 가능 — 정책으로 박을지 사용자 결정).
- 다음: 매물 source 다양성 / 풀 충분성 진단 (베타 사용자가 실제 어떤 카테고리 보게 되는가). memory: Wave 90 후속.
- commit: 96977f5

## 21. how-it-works 지원 카테고리 공시 정확화 + 비-Apple 카테고리 정직 표시

- 시간: 2026-05-16 06:15 KST
- 발견: 카테고리 분포 진단 결과 — Apple 편향 77% (airpods 69 + ipad 44 + applewatch 44 + macbook 32 = 189 / 245 ready). how-it-works 페이지 supportRows 가 outdated:
  - tablet status="비공개 검증" → 실제는 지원 (51건 ready)
  - laptop status="보류" → 실제는 지원 (32건 ready)
  - game_console / desktop / speaker / smartphone 누락
  - 신발/가방/의류 등 미지원 카테고리 명시 X — 비-Apple 사용자가 가입 후 실망 risk
- 정책 결정 (MJ): source 다양화는 별도 wave (큰 작업) — 일단 베타 시작은 Apple 풀로. 그러나 사용자 기대 set 위해 정직한 공시 박음.
- 변경 (`src/app/how-it-works/page.tsx`):
  - supportRows DB 실측 기반 갱신 (각 카테고리에 실제 매물 수 명시).
  - 신발/가방/의류 "지원 예정 (X)" 새 status 추가 + 빨간 톤 배지로 명시 — 비-Apple 사용자가 가입 전 알 수 있게.
  - status 색깔 처리에 "지원 예정" 케이스 분기 추가.
- 검증: tsc clean.
- 위험: 일부 사용자가 미지원 보고 가입 안 할 수 있음 — 의도된 결과 (실망 후 이탈보다 사전 배제가 신뢰).
- 다음: 다른 page (랜딩 / / 요금제) 의 카테고리 언급 audit. 별도 wave에서 source 다양화 진행.
- commit: bfa3f7b

## 22. 보류 결정 일괄 기록 (이번 세션 누적)

- 시간: 2026-05-16 06:25 KST
- 기록 누락 sweep — 이번 세션에서 결정했지만 결정 로그에 안 박힌 보류 항목들 일괄 정리. memory rule (`feedback_decision_log_required.md`) 위반 차단.

### 22a. 신선도 슬라이더 plan 게이팅 — 보류

- 발견 (#19, #20): `maxFreshHours` 필터 코드 (`packs/open` + `packs/preview-inventory`) 가 plan 게이팅 X — 모든 사용자 (free 포함) 사용 가능. plan-config 에선 Plus features 로 광고 → mismatch.
- 임시 처리: features 텍스트만 "신선도 슬라이더 (최근 N시간 매물만 보기)" 로 명확화. 코드 게이팅 안 박음.
- 보류 사유: Plus 이상 게이팅 박는 건 정책 결정 (free/starter 사용자 화남 risk). MJ 답변 대기.
- 후속: MJ 결정 시 (a) 게이팅 박기 또는 (b) features 텍스트 제거 (모든 사용자 동일).

### 22b. source 다양화 (신발/가방/의류 등) — 별도 wave 보류

- 발견 (#21): Apple 편향 77% (245 ready 중 189 Apple). 비-Apple 카테고리 (신발/가방/의류/스포츠) 0건. memory: Wave 90 후속 미진행 확인.
- 임시 처리: how-it-works 페이지에 "지원 예정 (X)" 빨간 배지로 정직 공시. 사용자 기대 set.
- 보류 사유: catalog SKU 추가 + mining + parser + readiness = 1-2일 큰 wave. 베타 launch 일정 영향. MJ 결정: 일단 Apple 풀로 베타 시작 + launch 후 데이터 보면서 우선순위 결정.
- 후속: 별도 wave (예: Wave 107 source 다양화) 신규 박음. 신발/가방 1개 SKU 시범 추가 → mining 가능성 검증부터.

### 22c. MJ user_plans plan_key='plus' 잔재 — 보류

- 발견 (#19): MJ admin 의 user_plans row 가 plan_key='plus' 박혀 있음 (test 결제 잔재 추정). 정책 변경 후 admin 별도 처리 (mvp_admin_users) 라 영향 X.
- 임시 처리: 그대로 둠 (admin이라 어차피 isPro=true 강제, 핫딜도 admin 자격으로 받음).
- 보류 사유: 사용자 의도 불분명. test 잔재면 cleanup 가능하지만 destructive 액션이라 MJ 컨펌 필요.
- 후속: MJ 답변 시 plan_key='pro' update 또는 row delete.

### 22d. /api/me/hotdeal/decide 410 deprecation — 옛 client cache risk

- 발견 (#17): 옛 client (모바일 cache) 가 /decide 호출하면 410 받고 UI 에러.
- 임시 처리: 410 Gone 응답 + sanitized 한국어 메시지.
- 보류 사유: 옛 client cache 만료 시점 (며칠) 까진 일부 사용자가 410 볼 수 있음. monitoring 만으로 충분.
- 후속: 1주 후 logs 확인. 410 호출이 0이면 route 자체 삭제 가능.

### 22e. 다른 endpoint err.message 누출 audit — 별도 wave

- 발견 (#11): billing 3개 endpoint 누출 fix 했지만 telegram/, packs/, me/ 도 동일 패턴 가능성 (memory: `project_security_error_message_leak_review.md`).
- 임시 처리: billing 만 fix.
- 보류 사유: 별도 audit wave 권장 (memory 박힌 사항). 작업량 큼.
- 후속: 별도 wave (예: Wave 108 endpoint err sanitize sweep) 신규.

### 22f. 옛 reservation #1 notification_sent=false 미해석 — 추가 진단 보류

- 발견 (#16, #18): pid 407359580 reservation 이 notification_sent=false + error=null. #18 fix (description 보존) 박았지만 옛 row는 그대로.
- 임시 처리: 미래 실패는 description 박힘. 옛 row 1건은 그대로 둠.
- 보류 사유: 옛 row 1건 디버그 가치 낮음. 새 패턴 발생 시 #18 코드로 잡힘.
- 후속: 새 fail 발생 + 명확한 패턴 보이면 추가 진단.

## 23. 페이지 marketing 약속 audit (랜딩 + /plans + how-it-works)

- 시간: 2026-05-16 06:35 KST
- 검토 범위: 사용자 가입 전 첫 접점 3개 페이지의 marketing 약속 vs 실제 코드 동작 일치 검증.

### 23a. 랜딩 (`pack-shop.tsx`) trustPoints 4개 검증 — 모두 작동

| 약속 | 코드 검증 | 상태 |
|---|---|---|
| "다시 확인 후 추천" | pool-warmer last_verified_at 갱신 + lifecycle terminal_recheck mode | ✅ |
| "검증 실패 시 환불" | pack-open.ts result:"refunded" + atomic RPC amount=0 + daily quota refund | ✅ |
| "같은 본품끼리만 비교" | comparable_key 매커니즘 (option-parser + ruleMatch) | ✅ |
| "택배비 포함 수익 계산" | candidates.ts estimated_buy_cost + net_gap_after_shipping 계산 | ✅ |

Hero 톤도 정직 ("AI 시세 기반 추정 — 수익 보장 X" disclosure 명시). 강한 보장 어휘 0건. 거짓 광고 0.

### 23b. `/plans` "Mock 결제" 모호함 fix

- 발견: `/plans` hero 의 "Mock 결제 / 베타 검증" 배지가 사용자에게 "실제 청구 들어가나? 안 들어가나?" 모호. `subscribe_mvp_plan` RPC 가 paymentKey 받고 user_plans 활성화하지만 토스 실제 연동 X (mock paymentKey만). 사용자가 "구독" 버튼 누르면 → 진짜 청구 X 인데 plan 활성화 → 혼란 risk.
- 변경 (`src/app/plans/page.tsx:83-95`):
  - hero p 텍스트 아래에 amber 안내 박스 추가: "⚠️ 베타 기간엔 mock 결제로 운영됩니다. 실제 결제는 안 들어가고, plan 만 활성화돼서 기능을 체험하실 수 있어요. 정식 토스 연동은 정식 출시 때."
  - 배지 "Mock 결제 / 베타 검증" → "Mock 결제 (청구 X) / 베타 한정" 명확화.
- 검증: tsc clean.
- 위험: 일부 사용자가 "그럼 실제 출시 때 다시 결제해야 하나?" 의문. 정식 launch 시 별도 안내 + migration 필요 (현재 박은 plan row를 어떻게 처리?).
- 다음: 정식 launch 시점에 (a) 토스 연동 wave + (b) 베타 plan row migration 정책 결정.

### 23c. how-it-works supportRows — #21 에서 이미 fix

- 동일 audit 범위인데 #21 에서 별도 처리됨. 중복 fix X.

### 23d. 검토 결과 종합

- 거짓 marketing 0 (정직 톤 일관).
- 단 "Mock 결제" 명확화만 필요했음 → fix.
- 다른 페이지 (account, admin 등) 추가 audit 권장 (사용자 진입 후 페이지).

- commit: pending

### 보너스: audit false positive (총 3건)
- `/api/cron/landing-showcases` auth 누락 보고됐으나 실 코드 (route.ts:10-13) 에 `checkCronAuth` 박혀있음. 스킵.
- `pack-reveal-modal.tsx`에 닫기 버튼 없음 보고됐으나 실 코드 (line 944-952) "닫기" 버튼 + Esc keydown (line 872) 둘 다 있음. 스킵.
- `pack-shop.tsx` 랜딩 main 패딩 X 보고됐으나 inner div (line 262) `px-4 sm:px-6 lg:px-8` 박혀있음. 시각적 동일. 스킵.
