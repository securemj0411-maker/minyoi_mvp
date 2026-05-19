# 2026-05-19 Wave 343 — /me history view = ExploreClient 병합

사용자 지적: 처음부터 비즈니스 모델 = "/me에 1 페이지(30개) 보여주는 거"였는데 내가 welcome 4개 + 별도 /explore 페이지로 잘못 분리. /me 자체가 새 모델.

## 결정

### /me 페이지 통합
- `/me` 진입 시 history view (default) → **ExploreClient** (30개 풀 + cooldown + sold out + 통계 + paywall 예고)
- Welcome 4개 reveal flow **폐기** — 진입 즉시 30개 풀
- 다른 view (guides/hotdeal-alerts/admin-pool/admin-classification) — **그대로 유지** (사용자 요청)
- SavedMoneyCounter / MyFeedbackActivity 위/아래 유지 (가치 정보)

### /explore 페이지 삭제
- `src/app/explore/` 디렉토리 제거 (page.tsx 포함)
- 별도 페이지 불필요 — /me history가 곧 탐색

### nav "탐색" 링크 제거
- Wave 338b에서 박은 거 — 잘못. /me로 통합되니 별개 nav 불필요

### Welcome flow
- API `/api/packs/welcome` + `mvp_welcome_grants` 테이블 **유지** (히스토리)
- 클라이언트 호출 폐기 (me-dashboard-client useEffect 제거)
- 이전 가입자 reveal 기록 무손상

### ExploreClient 수정
- `<main>` → `<div>` (me-dashboard-client section 안에 박혀서 main 중첩 위반 차단)
- 외부 padding 조정 (mx-auto max-w-6xl 유지)

## 변경 파일

수정:
- `src/components/me-dashboard-client.tsx`
  - history view block을 ExploreClient로 교체
  - "더 찾아보기" 버튼 3개 + seekMoreOpen modal 제거
  - "나의 상품" 헤더 제거
  - welcome useEffect 제거
  - welcomePending / seekMoreOpen / welcomeRequestedRef state 제거
  - 미사용 import 정리 (UserRevealDashboard, RecommendationWorkspace, PackageIcon, SearchIcon, userRefForAuthUser, dispatchPackRevealsUpdated, PackBand, PackOpenResult, RevealCard, useRef)
- `src/components/explore-client.tsx`
  - `<main>` → `<div>` (HTML 중첩 위반 차단)
- `src/components/app-nav.tsx`
  - navLinks에서 "탐색" 제거

삭제:
- `src/app/explore/page.tsx`
- `src/app/explore/` 디렉토리

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗 (warning 0)

## 보류 — 후속 정리

- `UserRevealDashboard` 컴포넌트 자체 (1612줄) — 다른 곳 사용 0이면 삭제 가능. 별도 wave 확인 후.
- `RecommendationWorkspace` 컴포넌트 — 다른 곳 사용 0이면 삭제 가능.
- `/api/packs/welcome` endpoint — 안전하게 유지 (이전 데이터)
- `/api/packs/me` endpoint — UserRevealDashboard 사용 안 하면 삭제 가능. 단 다른 곳 호출하면 보존.
- `mvp_welcome_grants` 테이블 — 유지 (히스토리 데이터 보존)

## 사용자 흐름

```
가입 / 로그인
  ↓
/me 진입 (default = history view)
  ↓
ExploreClient — 30개 매물 풀 (6h+) + cooldown + sold out + 통계 + paywall 예고
  ↓
카드 클릭 → PackRevealModal (시세/협상/가품/판매 도우미)
  ↓
"새 30개 받기" (30분 cooldown 후)
```

다른 view (guides/hotdeal/admin) — sidebar에서 클릭 시 그대로 동작.
