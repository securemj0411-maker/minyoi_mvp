## Wave 733 — 레퍼럴 URL fallback + 진단 로그

- 시간: 2026-05-24 KST
- 발견: 사용자 직접 테스트 `https://minyoi-mvp.vercel.app/?ref=GSWXEA` → 카카오 가입 후 보상 미지급.
  DB 진단:
  - GSWXEA 추천인 존재 ✓
  - 새 가입자 `9d523c4c-78c0-496b-b155-0a3c4063baae` 생성 ✓ (signup_at: 19:51:16 UTC)
  - 새 가입자의 `referral_code` **NULL** ❌ → `ensureReferralCode` 안 호출됨
  - `mvp_referrals` row **0건** ❌
  - ledger 에 `referral_signup_*` event 없음 ❌
- Wave 731 commit: 19:44:30 UTC. 가입 시각은 7분 후. Vercel deploy 보통 1-3분이라 끝났어야 함.
- 가능 원인:
  1. Vercel deploy 가 wave 731 안 잡았거나 deploy 완료 전 가입 (가능성 30%)
  2. **카카오 OAuth flow 중 쿠키 손실** (vercel.app → kakao → supabase → vercel.app redirect, lax sameSite 도 OAuth POST/redirect 흐름에선 손실 risk)
  3. middleware 가 production 에서 작동 안 함

### 변경 — URL param fallback (쿠키 의존도 ↓)

#### 1. [src/components/auth-form.tsx](../../src/components/auth-form.tsx:107)
- `signInWithKakao()` 에서 URL `?ref=` + 쿠키 둘 다 시도해서 refCode 추출
- `signInWithOAuth({redirectTo})` 의 redirectTo URL 에 `&ref=<CODE>` 박음
- 카카오 OAuth 가 redirectTo 그대로 callback 으로 전달 — 쿠키 손실 위험 회피

#### 2. [src/app/auth/callback/route.ts](../../src/app/auth/callback/route.ts)
- referrerCode = URL `?ref=` 먼저 → 쿠키 fallback
- console.log 진단 추가:
  - `[auth/callback] referral signup attempt` (source: url/cookie + code + userId)
  - `[auth/callback] referral signup granted` (성공)
  - `[auth/callback] referral signup skipped` (실패 + reason)
  → Vercel logs 에서 callback 실제 작동 여부 + 어디서 끊기는지 추적 가능

### 검증

- `npx tsc --noEmit` — 0 error.
- Vercel deploy 후 사용자 재테스트 필요.

### 미해결

- **9d523c4c 가입자 보상 누락** — 이미 가입했으므로 새 코드로 받을 수 없음. 운영자 결정 필요:
  - A. 수동으로 `mvp_referrals` row 박고 양쪽 +5 보상 SQL 실행
  - B. 그냥 두고 다음 테스트에 작동 확인
- **Vercel deploy 상태 확인** — 사용자가 https://vercel.com/dashboard 에서 wave 731 (249e037) deploy 성공 여부 확인 필요.

### 위험

- redirectTo URL 에 `&ref=CODE` 박혀도 카카오 OAuth 가 URL 수정하지 않으니 안전.
- 6자 패턴 검증 박혀있어 임의 값 차단.
- URL 노출 (브라우저 주소창) 은 일시적 — 가입 완료 후 next path 로 redirect 되어 사라짐.
