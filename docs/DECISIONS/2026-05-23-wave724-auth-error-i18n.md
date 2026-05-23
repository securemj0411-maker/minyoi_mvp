## Wave 724 — Supabase Auth 에러 메시지 한글화 + 카카오 OAuth error param 처리

- 시간: 2026-05-23 KST
- 발견: Wave 723 audit (`auth-form.tsx:107,149,167`)에서 `setMessage(error.message)` 로 Supabase 영문 메시지 raw 노출. "Invalid login credentials" / "User already registered" / "Database error saving new user" 등이 한국어 사용자에게 그대로 보임 → 입문자 stuck. callback route 도 `code` 없음만 잡고 `error`/`error_description` 무시.

### 변경

#### 1. 새 lib `src/lib/auth-error-messages.ts`
- `translateSupabaseAuthError(raw)` — 12 패턴 (invalid_credentials / email_not_confirmed / user_already_exists / weak_password / invalid_email / email_rate_limit / over_request_rate_limit / signup_disabled / anonymous_disabled / database_error / access_denied / provider_disabled) 부분 문자열 매칭 → 일반인 친화 한글. 매칭 안 되면 generic fallback (raw 영문 노출 금지).
- `classifyOAuthCallbackError(error, errorDescription)` — provider 가 보내는 OAuth error param 을 `oauth-denied` / `oauth-db-error` / `oauth-rate-limit` / `oauth-error` 4가지 좁은 코드로 정규화.

#### 2. [src/components/auth-form.tsx](../../src/components/auth-form.tsx)
- 3곳 `setMessage(error.message)` → `setMessage(translateSupabaseAuthError(error.message))` (kakao signInWithOAuth / signUp / signInWithPassword). 동시에 `console.error` 로 운영자 추적 로그 남김.
- `authErrorMessage()` 에 4 new case (`oauth-denied` / `oauth-db-error` / `oauth-rate-limit` / `oauth-error`) 추가.
- 가입 완료 메시지: "(Supabase 설정에 따라 자동 로그인일 수도 있어요)" 같은 운영 내부 표현 제거. "받은 이메일의 인증 링크를 눌러 로그인을 완료해주세요. 메일이 안 오면 스팸함도 확인해주세요." 로 일반인 행동 안내.
- env 없는 fallback 메시지: ".env.local 의 NEXT_PUBLIC_SUPABASE_ANON_KEY 확인하세요" → "지금은 로그인을 받을 수 없는 상태예요. 잠시 후 다시 시도하거나 운영자에게 문의해주세요." (prod env 사고 시 사용자 노출 대비).

#### 3. [src/app/auth/callback/route.ts](../../src/app/auth/callback/route.ts)
- 진입 시 `error`/`error_description` query param 먼저 검사. 있으면 `classifyOAuthCallbackError` 로 좁은 code 만들어 `?auth=...` redirect.
- `exchangeCodeForSession` 실패 시 메시지에 "database" 포함되면 `oauth-db-error` 로 분기 (이전엔 일률 `exchange-failed`).
- 두 케이스 모두 `console.error` 로 raw 메시지 운영자 로그.

### 검증
- `npx tsc --noEmit` — auth 관련 파일 0 error.
- 매핑 함수 unit test 없음 (helper 단순 함수라 명세 README + 운영 로그로 충분 — 별도 wave 가능).

### 위험
- 알려지지 않은 Supabase 메시지는 generic fallback 으로 묻힘 → 운영자가 `console.error` 로그 봐야 진단 가능. 단 raw 영문 노출보다 사용자 경험 우선.
- `classifyOAuthCallbackError` 패턴 매칭이 미래 Supabase 메시지 변경에 깨질 수 있음 — 운영 로그 모니터링으로 보완.

### 다음 (남은 wave 723 audit follow-up)
- error.tsx digest raw 노출
- 팩 오픈 fake progress 30~60초 뻗음 UX
- 모바일 dashboard sidebar 숨김
- Beta 배지 + admin-pool 카드 emerald 잔재
- 신발 condition_tier DB 채움 % 측정
