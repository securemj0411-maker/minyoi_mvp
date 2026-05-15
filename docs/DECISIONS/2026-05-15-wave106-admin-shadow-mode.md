# Wave 106 — Admin Shadow Mode (운영자 일반인 가장)

> Status: **applied (code).** owner 요청 — admin이 일반 회원 경험(rate limit / 플랜 게이팅 / Pro UI / 무한 크레딧 해제)을 테스트할 수 있게 nav bar 5번 클릭 토글.

CLAUDE.md 6 필드 포맷.

## 1. 메커니즘

- 시간: 2026-05-15
- 발견: owner 요청 — admin이 본인 권한 무력화하고 일반 회원으로 가장. rate limit 적용 / 플랜 게이팅 적용 / Pro UI 해제 / 무한 크레딧 해제. UI는 navigation bar 5번 클릭 (admin dot).
- 변경:
  - **신규 파일** `[mvp/src/lib/admin-shadow-mode.ts](mvp/src/lib/admin-shadow-mode.ts)` — cookie 기반 헬퍼:
    - `hasAdminShadowClient()` / `setAdminShadowClient(on)` — 브라우저 (document.cookie)
    - `hasAdminShadowFromRequest(req)` — server API route (req header cookie)
    - `hasAdminShadowFromCookies()` — server component (next/headers)
    - cookie: `admin_shadow=1`, path=/, max-age=30일, SameSite=Lax
  - **[mvp/src/lib/auth-users.ts](mvp/src/lib/auth-users.ts)**:
    - `isAdminUser(user)` — 그대로 (이메일만 체크, sync)
    - 신규 `isEffectiveAdmin(user, req)` — admin email + shadow off. API route용 (sync)
    - 신규 `isEffectiveAdminAsync(user)` — server component용 (async, next/headers)
  - **API migration** (3개):
    - `[mvp/src/app/api/packs/open/route.ts](mvp/src/app/api/packs/open/route.ts)` line 74, 99 — `isAdminUser` → `isEffectiveAdmin(auth.user, req)`. rate limit + 무한 크레딧 우회 모두 shadow 적용.
    - `[mvp/src/app/api/credits/me/route.ts](mvp/src/app/api/credits/me/route.ts)` line 20 — 동일. rate limit 우회 shadow 적용.
    - `[mvp/src/lib/user-subscription.ts](mvp/src/lib/user-subscription.ts)` `getProStatus()` — admin auto-Pro 분기에 `!(await hasAdminShadowFromCookies())` 추가. shadow 시 일반 user처럼 mvp_user_plans 기반 isPro 산출.
  - **app-nav 5번 클릭**:
    - `[mvp/src/components/app-nav.tsx](mvp/src/components/app-nav.tsx)` `handleAdminDotClick` — `realAdmin` 분기:
      - realAdmin: shadow toggle (cookie set/remove) + `window.location.reload()` (server-side cookie 검사 반영)
      - !realAdmin: 기존 Wave 69 adminOverride toggle (UI 가장)
    - `admin` derived: `(realAdmin && !adminShadow) || (!realAdmin && adminOverride)` — UI에서 admin 메뉴/aside 표시 여부 결정.
  - **me-dashboard 메뉴**:
    - `[mvp/src/components/me-dashboard-client.tsx](mvp/src/components/me-dashboard-client.tsx)` — `effectiveAdmin = isAdminUser(user) && !shadowMode`. `hotdeal-alerts` 탭 + `admin-pool` 탭 조건 update. shadow 시 운영자 메뉴 숨김 → 일반 user 시야.
- 검증:
  - `npx eslint --max-warnings=0` exit 0
  - `npx tsc --noEmit` exit 0
  - `npm run test:core` 139/139 pass
- 위험: 낮음.
  - shadow cookie는 client만 set (server는 read-only). admin email인 사람만 토글 의미 있음.
  - cookie 30일 max-age. 사용자가 잊고 두면 계속 shadow 상태 → 5번 다시 클릭으로 OFF.
  - `/api/admin/beta-tester`와 `/cauleex.../` 회원 페이지는 isAdminUser 그대로 (shadow 영향 X). owner가 shadow 토글 → 일반 user 동선 테스트하다가 회원 페이지 못 들어가면 안 되므로 의도된 차이.
- 다음:
  - shadow 활성 시 visual indicator (작은 빨간 dot 등) — 별도 wave에서.
  - 더 많은 API migration 필요하면 isEffectiveAdmin 확장 (현재 3 API만, 나머지는 admin only 기능이라 shadow 영향 무의미).

## 2. 사용법 (owner용)

1. **활성**: navigation bar 좌측 admin dot 5번 빠르게 클릭 (1.5초 안)
2. **확인**: `Shadow Mode ON (일반인 가장 — ...)` alert + 페이지 자동 reload
3. **결과**:
   - me-dashboard에서 `핫딜 알림` / `운영자 풀` 메뉴 사라짐
   - 팩 열기 시 rate limit 적용 (10초당 5회) + 일일 quota 차감 + 크레딧 차감
   - 요금제 페이지에서 본인 플랜대로 isPro 표시
4. **해제**: 같은 admin dot 5번 다시 클릭 → `Shadow Mode OFF (운영자 복귀)` alert + reload

## 3. 거론 금지

- localStorage만으로 shadow mode 구현 — server-side 못 읽음. cookie 필수.
- admin 외 사용자에게 shadow mode 노출 — non-admin은 영향 0 (cookie 박혀도 isAdminUser 자체가 false).
- isAdminUser 자체를 async cookie-aware로 변경 — 30+ callsite 일괄 refactor 무리. 별도 wave.
