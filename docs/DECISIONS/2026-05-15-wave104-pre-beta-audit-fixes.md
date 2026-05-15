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
- commit: pending

### 보너스: audit false positive (총 3건)
- `/api/cron/landing-showcases` auth 누락 보고됐으나 실 코드 (route.ts:10-13) 에 `checkCronAuth` 박혀있음. 스킵.
- `pack-reveal-modal.tsx`에 닫기 버튼 없음 보고됐으나 실 코드 (line 944-952) "닫기" 버튼 + Esc keydown (line 872) 둘 다 있음. 스킵.
- `pack-shop.tsx` 랜딩 main 패딩 X 보고됐으나 inner div (line 262) `px-4 sm:px-6 lg:px-8` 박혀있음. 시각적 동일. 스킵.
