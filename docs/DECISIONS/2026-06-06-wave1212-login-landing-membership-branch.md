# Wave 1212 — 로그인 후 착지 멤버십 분기 (온보딩 깜빡임 fix)

날짜: 2026-06-06
관련: 온보딩 흐름 검토, auth/callback/route.ts
owner: 온보딩 흐름 검토 → "단계 표시(1번)는 세로 공간 늘어 별로 / 로그인 깜빡임(2번)은 좋음"

## 문제 (2번)
카카오 로그인 → `/auth/callback`이 next(기본 `/me`)로 redirect → `/me`가 비멤버를 `/plans`로 또 redirect.
→ **로그인 → /me 잠깐 → /plans 이중 점프**라 첫 화면이 한 번 깜빡.

## fix
callback redirect 직전, `next === "/me"`(기본 피드 착지)인데 비멤버면 → **`/plans`로 직접** 보냄.
- `getProStatus(authUser, userRef)` + `hasMembershipAccess` 체크 (callback에 authUser:79 / userRef:81 이미 있음).
- 멤버나 명시적 next(예: /lookup)는 그대로 → 영향 0.
- 멤버십 조회 실패 시 기본 next 유지(/me가 게이트로 재처리) — fail-safe.

→ 비멤버 신규 가입자(주 흐름)는 로그인 직후 바로 /plans. /me 경유 깜빡임 제거.

## 범위
- 카카오 로그인(주력)은 callback 경유 → fix 적용. 이메일 로그인은 client signInWithPassword라 callback 미경유지만,
  이메일 가입은 폐지 예정(owner)이라 무관.

## 온보딩 검토 결과 (참고)
- 1번 진행 단계 표시(●○○○) → owner: 세로 공간 늘어 **skip**.
- 거주지 첫 단계는 "우리 동네 매물 독점" 제목으로 맥락 OK (헷갈림 약함).

## TS check
clean.
