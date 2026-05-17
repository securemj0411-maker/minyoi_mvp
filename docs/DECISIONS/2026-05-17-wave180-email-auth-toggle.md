# Wave 180 — 운영자 임시 이메일 가입 토글

- 시간: 2026-05-17 KST
- 발견: 운영자가 "신규사용자인척" 가입해서 /me 흐름 (welcome 5매물 → 팩 reveal → 나의 상품) 전수 테스트 필요. 기존 카카오 로그인은 본인 계정이 admin (danshinadarina@gmail.com) 이라 신규 첫 가입 흐름 재현 불가.

## 변경

- `src/components/auth-form.tsx`
  - `NEXT_PUBLIC_ENABLE_EMAIL_AUTH === "1"` 일 때만 이메일/비밀번호 input + submit 노출
  - `signInWithPassword` (login mode) / `signUp` (signup mode) client-side 호출
  - 비밀번호 6자 이상 client validation
  - signup ↔ login cross-link (토글 ON 시만)
- `src/app/signup/page.tsx`
  - 토글 OFF: `redirect("/login")` 유지 (카카오 only)
  - 토글 ON: `AuthForm mode="signup"` 노출
- `.env.local`
  - `NEXT_PUBLIC_ENABLE_EMAIL_AUTH=1` 박음 (로컬만)

## 정책 안전장치

- env 토글 ON 일 때만 UI 노출. Vercel prod env 에 안 박으면 일반 사용자 눈에 자동 카카오 only.
- `.env*` 는 `.gitignore` 처리되어 secrets/토글이 git 에 안 들어감.
- `/api/auth/signup` route 는 그대로 410 Gone 유지 — client-side `supabase.auth.signUp` 직접 호출이라 server route 활성화 불필요.

## 검증

- `npx tsc --noEmit` clean (auth-form / signup 관련 에러 없음)
- dev server 재기동 후 `/signup` 진입 → 이메일/비밀번호 form 표시 확인 필요 (사용자)
- prod (Vercel) 에서 env 미박힘 시 `/signup` → `/login` redirect 정상 동작 확인 필요

## 위험

- Supabase dashboard 의 Email provider 활성 상태에 따라 동작 차이:
  - email confirm ON: signUp 후 이메일 클릭 필요 — `data.session` null → 안내 메시지 표시
  - email confirm OFF: signUp 즉시 `data.session` 생성 → 자동 redirect
- `auth/callback/route.ts` 가 카카오 OAuth 콜백만 처리하면 email confirm 링크 클릭 시 동작 미정. 필요 시 별도 확인.
- 정책 위반 risk: 토글 prod 활성화 시 일반 사용자가 다중 이메일 계정으로 추천 매물 독점 가능. **Vercel env 에 박지 말 것**.

## 다음

- 운영자가 신규사용자 흐름 테스트 완료 후 토글 OFF (`.env.local` 한 줄 제거 또는 `=0`).
- 영구 이메일 가입 정책 필요 시 별도 wave 로 본인 인증 (휴대폰/이메일 OTP) 설계 박기.
