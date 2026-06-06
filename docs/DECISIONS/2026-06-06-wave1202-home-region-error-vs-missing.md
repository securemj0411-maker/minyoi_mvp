# Wave 1202 — 홈동네 조회 에러/미설정 구분 (audit P1 #1)

날짜: 2026-06-06
관련: Wave 1199 audit, user-home-region-loader.ts

## 문제

동네 설정 다 끝낸 정상 멤버가 메인(`/`·`/me`) 진입 시, `mvp_user_home_regions` 조회가
일시 실패(DB 부하·statement timeout)하면 피드 대신 `/onboarding/home-region`로 튕김.

원인: `loadUserHomeRegion`이 `!res.ok`와 `catch`에서 **둘 다 null** 반환 →
호출처 redirect 게이트가 "조회 실패"를 "동네 미설정"으로 오인 → 온보딩으로 redirect.
(다음 성공 로드 시 자동 복귀라 하드 루프는 아니나, 부하 커지면 자주 깜빡.)

## fix

`loadUserHomeRegion` 반환을 `UserHomeRegion | null` → **`{ region, errored }`** 로 분리:
- 성공+있음: `{ region, errored: false }`
- 성공+없음: `{ region: null, errored: false }`
- 조회 실패(!res.ok / catch): `{ region: null, errored: true }`

호출처 4곳:
- `page.tsx` / `me/page.tsx`: `if (!region && !errored) redirect(온보딩)` — **에러면 redirect 보류**(피드 렌더, 다음 로드 복구).
- `onboarding/home-region/page.tsx`: `region`만 추출. 에러면 region=null이라 온보딩 유지(사용자 설정 시도 가능, 무한루프 없음).
- `api/packs/pool/route.ts`: `region`만 추출(거리필터용). 에러면 null → 거리필터 skip(전체 반환), 무해.

## TS check
clean (4곳 + loader).

## Sign-off
에러를 "미설정"으로 오인하던 redirect 버그 차단. owner가 "1번 먼저" 지정한 audit P1 항목.
(2번 이메일 재전송·signup 관련은 owner 결정으로 skip — 이메일 가입 폐지 예정 + 카카오 전용.)
