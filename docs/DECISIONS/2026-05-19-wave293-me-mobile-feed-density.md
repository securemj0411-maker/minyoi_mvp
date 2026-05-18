# 2026-05-19 Wave 293 — /me mobile feed density

## Context

사용자가 /me 모바일 상품 목록을 당근마켓 피드와 비교하며 상품 사이 간격이 크고 사진이 작아 보인다고 피드백했다.

기존 /me 목록은 추천 리포트 성격의 카드 UI라 모바일에서도 둥근 카드, 넓은 내부 패딩, 작은 썸네일, 별도 차익 박스가 반복되어 실제 상품 피드보다 밀도가 낮아 보였다.

## Decisions

1. 모바일 상품 목록은 카드보다 피드 row에 가깝게 보이도록 바꿨다.
   - 모바일 기본 간격을 `gap-0`으로 줄이고 row 사이를 얇은 하단 border로 구분한다.
   - 데스크톱 `sm:` 이상에서는 기존 카드형 grid 느낌을 유지한다.

2. 모바일 썸네일을 118px 정사각형 기준으로 키웠다.
   - 기존 64~76px 계열보다 상품 실물을 먼저 볼 수 있게 했다.
   - 이미지 `sizes`도 모바일 118px 기준으로 맞췄다.

3. 모바일 차익 영역은 큰 boxed panel에서 얇은 요약 줄로 줄였다.
   - `차익`, 금액, 퍼센트, 시세 갱신 chip만 한 줄에 가깝게 보여준다.
   - 데스크톱에서는 기존 inset accent box를 유지한다.

4. 제목은 모바일에서 2줄까지 보이게 했다.
   - 당근류 피드처럼 상품명 이해도를 높이고, 데스크톱에서는 기존 truncate 흐름을 유지한다.

## Verification

- `/me mobile product feed uses dense rows with larger thumbnails` contract test 추가.
- `npx tsx --test tests/me-mobile-first-cta-contract.test.ts tests/me-page-contract.test.ts`
- `npm run test:core`
- 로컬 브라우저 모바일 viewport(390×844)에서 `/me` 진입 확인. 단, 로컬 세션이 로그인 전 상태라 실제 상품 row는 브라우저로 직접 확인하지 못했고, 인증 전 화면이 깨지지 않는 것까지만 확인했다.

## Deferred

- 실제 모바일 기기에서 상품 사진 crop/row height를 한 번 더 보며 112px vs 118px vs 124px 최종값을 조정할 수 있다.
- 하단 floating `더 찾아보기` CTA가 마지막 row를 가리는 문제는 별도 CTA placement pass에서 판단한다.
