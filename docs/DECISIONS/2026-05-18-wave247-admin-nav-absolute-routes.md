# 2026-05-18 Wave 247 — Admin nav absolute routes

## 배경

운영자 회원 목록 페이지에서 `사용자 신고 검수`를 누르면 `/loss-reports`로 이동해 404가 났다. 운영자 홈 URL은 `/cauleexxy...`처럼 마지막 slash가 없는 경로인데, `href="./loss-reports"`는 브라우저에서 현재 경로를 디렉터리가 아니라 파일처럼 해석해 root의 `/loss-reports`로 resolve된다. `신고 통계`도 같은 위험이 있었다.

## 결정

1. 운영자 내부 nav는 상대 경로 대신 `src/lib/admin-routes.ts`의 absolute path 상수를 사용한다.
2. 회원 목록, 사용자 신고 검수, 신고 통계 3개 페이지 모두 같은 상수를 공유한다.
3. 이미 잘못 열린 `/loss-reports`, `/feedback-stats`는 admin 사용자에게만 실제 obfuscated 운영자 경로로 redirect한다.
4. 비운영자/비로그인 사용자는 legacy 짧은 경로에서도 `notFound()` 처리한다.

## 보류

- `/admin`과 `/cauleexxy...` 운영자 경로 통합은 보류한다. 이번 wave는 깨진 nav와 stale short URL 복구만 처리한다.

## 검증

- `tests/admin-routes-contract.test.ts` 추가.
- `git diff --check` 통과.
- `npx tsx --test tests/admin-routes-contract.test.ts` 통과.
- `npx tsx --test tests/admin-routes-contract.test.ts tests/me-page-contract.test.ts tests/me-mobile-first-cta-contract.test.ts` 통과.
- `npm run build` 통과. 빌드 route 목록에 `/loss-reports`, `/feedback-stats` legacy redirect route와 obfuscated admin route가 모두 포함됨.
