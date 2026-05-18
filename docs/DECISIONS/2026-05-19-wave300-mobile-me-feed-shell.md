# Wave 300 — 모바일 `/me` 상품 피드 껍데기 제거

## 배경
- 모바일 `/me`에서 `나의 상품 / 공략집` 서브 네비게이션이 상품 피드 위 공간을 차지했다.
- 실제 상품 목록도 `내 추천 보관함` 외곽 카드 안에 다시 상품 카드가 들어가는 구조라, 당근마켓식 피드처럼 바로 읽히지 않고 usable area가 줄어들었다.
- 사용자는 모바일에서 상품 자체가 더 크게, 바로 보이도록 원했다.

## 결정
- 모바일에서는 `/me` 서브 네비게이션을 숨긴다.
- 데스크톱에서는 기존 sidebar view 전환을 유지한다.
- 모바일에서는 `내 추천 보관함` 외곽 카드/제목을 제거하고, 상품 리스트가 페이지에 바로 붙도록 한다.
- 데스크톱에서는 기존 보관함 카드 UI를 유지한다.
- 모바일 `더 찾아보기`는 페이지 하단 중앙 fixed CTA로 강화한다.
- 기존 목록 하단 `더 찾아보기` 버튼은 모바일에서 숨기고 데스크톱에서만 유지한다.

## 구현
- `src/components/me-dashboard-client.tsx`
  - 모바일 sidebar tab bar를 숨기고 `lg` 이상에서만 sidebar를 표시.
  - 모바일 history section의 horizontal padding을 제거하고 bottom fixed CTA 공간을 위해 `pb-24` 적용.
  - 모바일 상단 `나의 상품` 헤더와 상단/하단 일반 `더 찾아보기` 버튼을 숨기고, fixed CTA를 추가.
- `src/components/user-reveal-dashboard.tsx`
  - 모바일에서 보관함 section의 border/background/padding/shadow 제거.
  - 모바일 `내 추천 보관함` 제목 영역 제거.
  - 모바일 요약/검색/페이지 카운트는 페이지형 얇은 bar로 유지.

## 보류
- 모바일에서 공략집으로 진입하는 별도 entry point는 이번 wave에서 추가하지 않았다.
- `SavedMoneyCounter`, `MyFeedbackActivity` 위치 재배치는 별도 UX 판단이 필요해 보류했다.

## 검증
- `npx eslint src/components/me-dashboard-client.tsx src/components/user-reveal-dashboard.tsx`
- `npm run build`
- `http://127.0.0.1:3000/me` dev 서버 smoke. 자동화 브라우저는 비로그인 세션이라 실제 추천 보관함 데이터는 확인하지 못했고, 비로그인 preview 로드와 모바일 서브 탭 부재를 확인했다.
