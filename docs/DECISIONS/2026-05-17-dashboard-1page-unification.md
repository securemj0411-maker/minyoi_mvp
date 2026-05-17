# 2026-05-17 me-dashboard: 추천 받기 + 나의 상품 1 페이지 통합 (Phase 1a)

## 사용자 의도

> "추천상품받기랑 나의상품을 분리하지말고 (학습비용이 너무 크지 않나?)
> 대시보드는 나의상품 페이지임. 무료사용자는 초반에 카드 뽑기로 5회 무료 뽑는게 아니라
> 이미 5개를 보여줌. 바로 가치 인식. 더 없어? 하면 더 찾아보기 버튼."

핵심:
- **2 페이지 → 1 페이지** (학습 비용 감소)
- **즉시 가치 인식** ("이게 뭐지?" 진입 장벽 차단)
- **카드 뽑기 게임 요소 보존** (더 찾아보기 optional)
- **funnel 명확** (5회/일 → 업그레이드)

## Phase 1a 박음 (이 PR)

### 변경

- `src/components/me-dashboard-client.tsx`
  - 사이드바 메뉴 `"recommend"` 제거 (사용자 안 보임 — url param `?view=recommend` 로만 진입 가능)
  - default view `"recommend"` → `"history"` (나의 상품)
  - 나의 상품 상단에 **"🔍 더 찾아보기" 버튼** 추가 → `setActiveView("recommend")` switch
  - recommend view 에 **"← 나의 상품으로" 버튼** 추가 (메뉴 없으니 돌아갈 path 보장)

### Trade-off

- **현재**: view switch (페이지 navigate). 사용자 요청 = "모달" 인데 phase 1b 로 보류
- 기존 사용자 영향: dashboard 진입 시 history view (이전 recommend) — 익숙한 사용자는 url 직접 변경 시 recommend view 진입 가능
- url param `?view=recommend` 그대로 작동 (deeplink 호환)

## Phase 1b 보류 — 모달 변환

- 사용자 명시 요청 = "더 찾아보기 버튼 누르면 추천 상품 받기 기능이 **모달로** 나오는거임"
- 현재 RecommendationWorkspace 가 page 형태 — 모달 wrap 필요
- 별도 작업 (1-2시간) — RecommendationWorkspace 안의 OnboardingBanner / SafetyStatsBadge 모달 안에서 어떻게 표시할지 결정 필요

## Phase 2 보류 — 신규 가입 자동 5 매물

- 사용자 의도: "가입 직후 5 매물 자동 보임 — 카드 뽑기 X"
- 박을 작업:
  - 신규 가입 detection (Supabase auth hook 또는 첫 방문 detection)
  - pool 에서 자동 5 매물 reserve (기준: profit band 다양 / top score / 랜덤?)
  - dashboard 첫 방문 시 자동 표시
- 별도 작업 (3-5시간) — auth + onboarding flow 복잡

## Phase 3 보류 — 5회/일 제한 + 업그레이드 prompt

- 무료 사용자 카드 뽑기 5회/일 제한 (이미 박혀있을 수도 — pack-shop 정책 확인 필요)
- 한도 초과 시 "업그레이드" 모달
- 별도 작업 (1-2시간)

## 영향

- 즉시: 사용자 dashboard 진입 → 나의 상품 list 즉시 보임 (학습 비용 ↓)
- 옛 사용자 deeplink (`/me?view=recommend`) 호환 유지
- "더 찾아보기" 버튼 발견성 ↑ (이전: 메뉴에서 별도 클릭 필요)

## Test

288/288 pass.

## Commit

`2506f9a` me-dashboard: 추천 받기 메뉴 폐기 + 나의 상품 1페이지 통합
