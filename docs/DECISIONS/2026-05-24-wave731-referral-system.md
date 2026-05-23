## Wave 731 — 레퍼럴 시스템 (DB + 가입 보상 + 결제 보너스 + UI)

- 시간: 2026-05-24 KST
- 발견: 사용자 비즈니스 결정 — 카카오 본인인증 90%+ 어뷰징 차단 가능하므로 후한 보상 구조 박음. 가입 양쪽 +5 / 첫 결제 시 추천인 +3/+30/+60 (플랜 비례 15%). 결제 보너스 즉시 지급 (24h 지연 X — 베타 traffic 작아 환불 사기 risk 낮음).

### 변경

#### 1. DB Migration (`wave731_referral_system`)
- `mvp_user_credits` 에 `referral_code TEXT` 컬럼 + UNIQUE index (NULL 허용)
- `mvp_referrals` 새 테이블 — 추천 관계 + 단계별 보상 시점 추적
  - `referrer_user_id`, `referred_user_id` (UNIQUE — 1 사용자 1번만 추천받음)
  - `signup_rewarded_at`, `signup_reward_credits`
  - `first_payment_rewarded_at`, `first_payment_plan_key`, `first_payment_credits`
  - CHECK 제약: `referrer != referred` (자기 자신 추천 차단)
- 인덱스 2개 + RLS 활성 (service_role 만 접근, DENY_ALL 패턴)

#### 2. 코어 라이브러리 [src/lib/referral.ts](../../src/lib/referral.ts) (신규)
- `generateReferralCode()` — 6자 랜덤 (헷갈리는 문자 0/O/1/I/L 제외)
- `ensureReferralCode(userId, userRef)` — 사용자 코드 부여 (idempotent, 충돌 5회 retry)
- `findReferrerByCode(code)` — 코드로 추천인 lookup
- `createReferralAndGrantSignupBonus({ referrerCode, referredUserId, referredUserRef })` — 관계 생성 + 양쪽 +5
- `grantReferralPaymentBonus({ referredUserId, planKey })` — 첫 결제 보너스 (`first_payment_rewarded_at` race 방어 박힌 PATCH)
- `getReferralStats(userId)` — `/invite` 페이지 용 현황 fetch
- 내부 `grantCreditsToUser()` — manual-deposit-grant 패턴 (read-modify-write + ledger 기록)

#### 3. URL `?ref=` 추적 [src/middleware.ts](../../src/middleware.ts) (신규)
- 사용자 첫 진입 페이지 (`/`, `/signup`, `/login`, `/invite`, `/how-it-works`, `/plans`) 에서 `?ref=ABC123` 감지 → 쿠키 `minyoi_referral` 30일 저장
- 패턴 검증 (6자 alphabet) 통과만 저장 — 임의 값 방어

#### 4. 가입 callback hook [src/app/auth/callback/route.ts](../../src/app/auth/callback/route.ts)
- 가입 성공 직후:
  1. `ensureReferralCode` — 신규 사용자 자기 코드 부여
  2. `minyoi_referral` 쿠키 있으면 `createReferralAndGrantSignupBonus` 호출
  3. 성공/실패 무관 쿠키 clear
- 보상 실패해도 가입 흐름 영향 X (try-catch + warn 로그)

#### 5. 결제 보너스 hook [src/lib/manual-deposit-grant.ts](../../src/lib/manual-deposit-grant.ts)
- `grantManualDeposit` 의 ledger 기록 후 직전에 `grantReferralPaymentBonus` 호출
- 추천받은 적 없거나 이미 보상 받은 추천이면 noop
- 실패해도 결제 grant 흐름 영향 X

#### 6. API endpoint [src/app/api/me/referral/route.ts](../../src/app/api/me/referral/route.ts) (신규)
- `GET /api/me/referral` — 사용자 코드 + 추천 현황 (가입/결제/누적 크레딧)
- `ensureReferralCode` idempotent — 코드 없는 기존 사용자도 처음 호출 시 자동 생성

#### 7. UI 페이지 [src/app/invite/page.tsx](../../src/app/invite/page.tsx) + [src/components/invite-client.tsx](../../src/components/invite-client.tsx) (신규)
- 사용자 추천 코드 표시 (font-mono, 큰 글씨)
- 공유 링크 복사 버튼 (clipboard API + prompt fallback)
- 카카오 공유 버튼 (Kakao SDK `sendDefault` 사용)
- 추천 현황 (가입수/결제수/누적크레딧)
- 보상 구조 details toggle 안내
- bounce-high dots (Wave 730 도입)

#### 8. Nav drawer link [src/components/app-nav.tsx](../../src/components/app-nav.tsx)
- 모바일 drawer mobileNavLinks 에 "친구 초대" entry 추가
  - href: `/invite`, label: "친구 초대", caption: "가입하면 둘 다 +5 크레딧"

### 어뷰징 방어 layer

1. **카카오 본인인증 필수** (휴대폰 번호 1개 = 카카오 계정 1개)
2. **`referred_user_id` UNIQUE** — 1 사용자 = 1번만 추천받음
3. **CHECK 제약** — 자기 자신 추천 차단
4. **race 방어** — `first_payment_rewarded_at` IS NULL 조건 PATCH 후 반환된 row 0개면 noop
5. **referral_code 패턴** — 정규식 6자 [A-HJ-NP-Z2-9]{6} 만 허용

### 보상 구조 (사용자 확정)

| 이벤트 | 추천인 | 신규 | 비고 |
|---|---:|---:|---|
| 신규 가입 | +5 | +5 | 오픈 이벤트, 정상화 시 +3 (코드는 SIGNUP_REWARD_CREDITS 상수) |
| 첫 결제 (Starter 3,900원) | +3 | — | 15% |
| 첫 결제 (Plus 19,900원) | +30 | — | 15% |
| 첫 결제 (Pro 39,900원) | +60 | — | 12% |
| 카카오 공유 (cooldown 24h) | +3 (본인) | — | 기존 launch-50/51 패턴 그대로 |

### 검증

- `npx tsc --noEmit` — 0 error.
- DB migration apply 성공 (`{ success: true }`).
- 실제 가입/결제 흐름은 staging 또는 직접 테스트 필요.

### 위험 / 미구현

- **환불 회수 미구현** — 사용자가 보너스 사용 후 결제 환불 시 운영자 수동 처리. baseline 모니터링 후 24h 지연 또는 회수 로직 추가 가능.
- **race condition (credit balance read-modify-write)** — `grantCreditsToUser` 가 atomic 아님. 베타 traffic 작아 OK. 향후 atomic RPC 로 마이그.
- **카카오 공유 + 친구 초대 통합 미정** — 기존 explore-client 카카오 공유 (`?ref=kakao_share`, cooldown 보너스) 와 `/invite` 의 친구 초대 카카오 공유 (`?ref=<USER_CODE>`) 가 분리됨. 향후 통합 검토.
- **결제 보너스 즉시 지급** — 사용자 결정. 환불 사기 risk 있지만 베타 단계 traffic 작아 모니터링 가능.

### 다음

- 실제 가입 → 추천 코드 발급 → 친구 가입 → 보상 지급 흐름 사용자 spot check.
- 환불 모니터링 (manual-deposit 환불 시 운영자 alert).
- /invite 페이지 카카오 공유 cooldown 보너스 (24h +3) 통합 검토.
