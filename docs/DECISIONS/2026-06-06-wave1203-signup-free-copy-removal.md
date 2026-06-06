# Wave 1203 — 가입폼 "매물 2개 무료" 거짓 약속 제거 (audit P1)

날짜: 2026-06-06
관련: Wave 1199 audit 정책 항목, auth-form.tsx
commit: 181b2aa7

## 문제
owner 기억 안 나는 "매물 2개 무료" 문구가 가입 화면(auth-form.tsx:237)에 존재.
- 옛 "무료 상세보기 2회" 기능(task #25 paywall 1→2, last_free_browse_at 컬럼)의 잔재.
- 지금은 비멤버가 무조건 /plans로 강제돼 무료로 볼 화면이 없음 → **작동 안 하는 거짓 약속**.
- 실제 무료 browse 로직도 paywall에 안 붙어있어 사실상 죽음.
- onboarding-banner.tsx에도 있었으나 죽은 컴포넌트 → Wave 1204에서 파일째 삭제됨.

## fix (owner "이거 지우고" 결정)
auth-form.tsx 문구 2곳:
- 237: "가입하면 매물 2개를 무료로 자세히 볼 수 있어요" → "우리 동네 매물을 가장 먼저 만나보세요"
- 387: "계정은 **무료 상세보기 중복 사용을 막고**, ..." → "무료 상세보기 중복 사용을 막고" 제거.

## owner 결정 (관련)
- 이메일 가입 인증 dead-end / signup 라우트 고아 → skip (이메일 가입 폐지 예정 + 카카오 전용).

## TS check
clean.
