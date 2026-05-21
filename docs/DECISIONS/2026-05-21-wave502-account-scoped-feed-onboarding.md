# 2026-05-21 Wave 502 — 계정별 첫 피드 온보딩 저장

## 결정
- 첫 피드 가치 카드와 예산 필터 저장은 DB가 아니라 계정별 `localStorage`로 처리한다.
- 같은 브라우저에서 여러 테스트 계정으로 가입해도 온보딩 상태가 섞이지 않도록 Supabase `user.id`를 storage scope로 사용한다.
- DB schema/API는 건드리지 않는다. 온보딩 문구와 예산 칩은 아직 실험 단계라, 빠른 변경과 첫 화면 속도를 우선한다.

## 구현
- `MeDashboardClient`가 로그인된 `user.id`를 `ExploreClient`에 `storageScope`로 전달한다.
- `ExploreClient`의 첫 피드 카드 seen 상태와 예산 필터 키를 `baseKey:userId` 형태로 저장한다.

## 보류
- 기기 간 동기화, 전환율 분석, 온보딩 완료 이벤트 누적이 필요해지면 `profiles.feed_onboarding_seen_at`, `initial_budget_preference` 같은 DB 필드로 승격한다.
